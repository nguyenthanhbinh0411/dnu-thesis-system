using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using ThesisManagement.Api.Application.Common;
using ThesisManagement.Api.Data;
using ThesisManagement.Api.DTOs.DefensePeriods;
using ThesisManagement.Api.Models;
using ThesisManagement.Api.Services.FileStorage;
using ThesisManagement.Api.Application.Command.Notifications;

namespace ThesisManagement.Api.Application.Command.DefensePeriods.Services
{
    public interface IDefenseRevisionWorkflowService
    {
        Task ApproveRevisionAsync(int revisionId, string lecturerCode, int actorUserId, CancellationToken cancellationToken = default);
        Task RejectRevisionAsync(int revisionId, string reason, string lecturerCode, int actorUserId, CancellationToken cancellationToken = default);
        Task SubmitStudentRevisionAsync(StudentRevisionSubmissionDto request, string studentCode, int actorUserId, CancellationToken cancellationToken = default);
        Task ReviewBySecretaryAsync(int revisionId, string action, string? comment, string secretaryUserCode, int actorUserId, DateTime? newDeadline = null, CancellationToken cancellationToken = default);
    }

    public sealed class DefenseRevisionWorkflowService : IDefenseRevisionWorkflowService
    {
        private readonly ApplicationDbContext _db;
        private readonly ThesisManagement.Api.Services.IUnitOfWork _uow;
        private readonly IDefenseAuditTrailService _auditTrail;
        private readonly DefenseRevisionQuorumOptions _quorumOptions;
        private readonly IFileStorageService _storageService;
        private readonly INotificationEventPublisher _notificationPublisher;

        public DefenseRevisionWorkflowService(
            ApplicationDbContext db,
            ThesisManagement.Api.Services.IUnitOfWork uow,
            IDefenseAuditTrailService auditTrail,
            IFileStorageService storageService,
            INotificationEventPublisher notificationPublisher,
            IOptions<DefenseRevisionQuorumOptions> quorumOptions)
        {
            _db = db;
            _uow = uow;
            _auditTrail = auditTrail;
            _storageService = storageService;
            _notificationPublisher = notificationPublisher;
            _quorumOptions = quorumOptions.Value;
        }

        public Task ApproveRevisionAsync(int revisionId, string lecturerCode, int actorUserId, CancellationToken cancellationToken = default)
            => UpdateRevisionStatusAsync(revisionId, lecturerCode, actorUserId, true, null, cancellationToken);

        public Task RejectRevisionAsync(int revisionId, string reason, string lecturerCode, int actorUserId, CancellationToken cancellationToken = default)
            => UpdateRevisionStatusAsync(revisionId, lecturerCode, actorUserId, false, reason, cancellationToken);

        public async Task SubmitStudentRevisionAsync(StudentRevisionSubmissionDto request, string studentCode, int actorUserId, CancellationToken cancellationToken = default)
        {
            await using var tx = await _uow.BeginTransactionAsync(cancellationToken);

            var file = request.File;

            if (file == null || file.Length == 0)
            {
                throw new BusinessRuleException("File PDF là bắt buộc.");
            }

            if (!file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
            {
                throw new BusinessRuleException("Chỉ chấp nhận file PDF.");
            }

            var assignment = await _db.DefenseAssignments
                .Join(_db.Topics, a => a.TopicCode, t => t.TopicCode, (a, t) => new { Assignment = a, Topic = t })
                .Where(x => x.Assignment.AssignmentID == request.AssignmentId && x.Topic.ProposerStudentCode == studentCode)
                .Select(x => x.Assignment)
                .FirstOrDefaultAsync(cancellationToken);

            if (assignment == null)
            {
                throw new BusinessRuleException("Không tìm thấy assignment của sinh viên.");
            }

            string? uploadedRevisionUrl = null;
            try
            {
                var uploadResult = await _storageService.UploadAsync(file, "uploads/revisions", cancellationToken);
                if (!uploadResult.Success)
                {
                    throw new BusinessRuleException(uploadResult.ErrorMessage ?? "Không thể upload file revision.");
                }

                uploadedRevisionUrl = uploadResult.Data!;

                var revision = await _db.DefenseRevisions.FirstOrDefaultAsync(x => x.AssignmentId == request.AssignmentId, cancellationToken);
                var beforeSnapshot = revision == null ? null : new { revision.RevisedContent, revision.RevisionFileUrl, revision.FinalStatus };
                if (revision == null)
                {
                    revision = new DefenseRevision
                    {
                        AssignmentId = request.AssignmentId,
                        Status = RevisionStatus.WaitingStudent,
                        SubmissionCount = 0,
                        CreatedAt = DateTime.UtcNow
                    };
                    await _uow.DefenseRevisions.AddAsync(revision);
                }

                if (revision.SubmissionDeadline.HasValue && DateTime.UtcNow > revision.SubmissionDeadline.Value)
                {
                    revision.Status = RevisionStatus.Expired;
                    revision.LastUpdated = DateTime.UtcNow;
                    _uow.DefenseRevisions.Update(revision);
                    await _uow.SaveChangesAsync();
                    throw new BusinessRuleException("Đã quá hạn nộp hậu đồ án tốt nghiệp.");
                }

                revision.RevisedContent = request.RevisedContent;
                revision.RevisionFileUrl = uploadedRevisionUrl;
                revision.Status = RevisionStatus.StudentSubmitted;
                revision.SubmissionCount = Math.Max(0, revision.SubmissionCount) + 1;
                revision.IsCtApproved = false;
                revision.IsGvhdApproved = false;
                revision.IsUvtkApproved = false;
                revision.FinalStatus = RevisionFinalStatus.Pending;
                revision.LastUpdated = DateTime.UtcNow;
                if (revision.Id > 0)
                {
                    _uow.DefenseRevisions.Update(revision);
                }

                await _uow.SaveChangesAsync();
                await tx.CommitAsync(cancellationToken);

                await _auditTrail.WriteAsync(
                    "STUDENT_REVISION_SUBMIT",
                    "SUCCESS",
                    beforeSnapshot,
                    new { revision.RevisedContent, revision.RevisionFileUrl, revision.Status, revision.SubmissionCount, revision.FinalStatus },
                    new { request.AssignmentId, StudentCode = studentCode },
                    actorUserId,
                    cancellationToken);

                // Notify Parties
                try
                {
                    var committeeInfo = await _db.DefenseAssignments
                        .Where(a => a.AssignmentID == request.AssignmentId)
                        .Select(a => new { a.CommitteeID, a.TopicCode })
                        .FirstOrDefaultAsync(cancellationToken);

                    if (committeeInfo?.CommitteeID != null)
                    {
                        // 1. Notify Secretary (UVTK)
                        var secretary = await _db.CommitteeMembers
                            .Where(m => m.CommitteeID == committeeInfo.CommitteeID)
                            .Where(m => m.Role != null && (m.Role.ToUpper().Contains("UVTK") || m.Role.ToUpper().Contains("THU") || m.Role.ToUpper() == "TK"))
                            .Select(m => m.MemberUserCode)
                            .FirstOrDefaultAsync(cancellationToken);

                        if (!string.IsNullOrWhiteSpace(secretary))
                        {
                            await _notificationPublisher.PublishAsync(new NotificationEventRequest(
                                NotifCategory: "DEFENSE_REVISION",
                                NotifTitle: "Hậu đồ án tốt nghiệp: Sinh viên đã nộp bản chỉnh sửa",
                                NotifBody: $"Sinh viên {studentCode} đã nộp bản chỉnh sửa cho đề tài {committeeInfo.TopicCode}. Vui lòng kiểm tra và phê duyệt.",
                                NotifPriority: "NORMAL",
                                ActionType: "VIEW_REVISION",
                                ActionUrl: $"/lecturer/revisions?committeeId={committeeInfo.CommitteeID}",
                                RelatedEntityName: "DefenseAssignment",
                                RelatedEntityCode: committeeInfo.TopicCode,
                                RelatedEntityID: request.AssignmentId,
                                IsGlobal: false,
                                TargetUserCodes: new List<string> { secretary }
                            ));
                        }

                        // 2. No notification to student on submission - only secretary review outcome notification
                    }
                }
                catch
                {
                    // Ignore notification errors to not block the main flow
                }
            }
            catch
            {
                if (!string.IsNullOrWhiteSpace(uploadedRevisionUrl))
                {
                    await _storageService.DeleteAsync(uploadedRevisionUrl, cancellationToken);
                }

                throw;
            }
        }

        private async Task UpdateRevisionStatusAsync(int revisionId, string lecturerCode, int actorUserId, bool approved, string? reason, CancellationToken cancellationToken)
        {
            await using var tx = await _uow.BeginTransactionAsync(cancellationToken);

            var revision = await _db.DefenseRevisions.FirstOrDefaultAsync(x => x.Id == revisionId, cancellationToken);
            if (revision == null)
            {
                throw new BusinessRuleException("Không tìm thấy revision.");
            }

            var assignment = await _db.DefenseAssignments.AsNoTracking().FirstOrDefaultAsync(x => x.AssignmentID == revision.AssignmentId, cancellationToken);
            if (assignment == null || !assignment.CommitteeID.HasValue)
            {
                throw new BusinessRuleException("Revision không thuộc hội đồng hợp lệ.");
            }

            var topic = await _db.Topics.AsNoTracking().FirstOrDefaultAsync(x => x.TopicCode == assignment.TopicCode, cancellationToken);
            if (topic == null)
            {
                throw new BusinessRuleException("Không tìm thấy đề tài của revision.");
            }

            var member = await _db.CommitteeMembers.AsNoTracking()
                .FirstOrDefaultAsync(x => x.CommitteeID == assignment.CommitteeID && x.MemberLecturerCode == lecturerCode, cancellationToken);
            var role = member != null ? NormalizeRole(member.Role) : string.Empty;
            var isSupervisor = !string.IsNullOrWhiteSpace(topic.SupervisorLecturerCode)
                && string.Equals(topic.SupervisorLecturerCode, lecturerCode, StringComparison.OrdinalIgnoreCase);
            // Only secretary (UVTK) is allowed to perform final approve/reject actions.
            var canApprove = role == "UVTK";
            if (!canApprove)
            {
                throw new BusinessRuleException("Chỉ Thư ký hội đồng mới có quyền duyệt hồ sơ hậu đồ án tốt nghiệp.");
            }

            if (!approved && string.IsNullOrWhiteSpace(reason))
            {
                throw new BusinessRuleException("Lý do từ chối revision là bắt buộc.", "UC4.1.REJECT_REASON_REQUIRED");
            }

            var beforeSnapshot = new
            {
                revision.IsCtApproved,
                revision.IsUvtkApproved,
                revision.IsGvhdApproved,
                revision.FinalStatus
            };

            // Only set secretary approval flag here; chair and supervisor approvals are not required in the new flow.
            if (role == "UVTK") revision.IsUvtkApproved = approved;

            revision.FinalStatus = ResolveFinalStatus(revision, approved, _quorumOptions);
            revision.LastUpdated = DateTime.UtcNow;
            _uow.DefenseRevisions.Update(revision);

            await _uow.SaveChangesAsync();
            await tx.CommitAsync(cancellationToken);

            await _auditTrail.WriteAsync(
                approved ? "REVISION_APPROVE" : "REVISION_REJECT",
                "SUCCESS",
                beforeSnapshot,
                new
                {
                    revision.IsCtApproved,
                    revision.IsUvtkApproved,
                    revision.IsGvhdApproved,
                    revision.FinalStatus,
                    Quorum = new
                    {
                        _quorumOptions.MinimumApprovals,
                        _quorumOptions.RequireChairApproval,
                        _quorumOptions.RequireSecretaryApproval,
                        _quorumOptions.RequireSupervisorApproval,
                        _quorumOptions.RejectAsVeto
                    }
                },
                new { RevisionId = revisionId, LecturerCode = lecturerCode, Reason = reason },
                actorUserId,
                cancellationToken);
        }

        public async Task ReviewBySecretaryAsync(int revisionId, string action, string? comment, string secretaryUserCode, int actorUserId, DateTime? newDeadline = null, CancellationToken cancellationToken = default)
        {
            await using var tx = await _uow.BeginTransactionAsync(cancellationToken);

            var revision = await _db.DefenseRevisions.FirstOrDefaultAsync(x => x.Id == revisionId, cancellationToken);
            if (revision == null)
            {
                throw new BusinessRuleException("Không tìm thấy revision.");
            }

            var normalizedAction = (action ?? string.Empty).Trim().ToUpperInvariant();
            if (normalizedAction == "APPROVE")
            {
                revision.Status = RevisionStatus.Approved;
                revision.FinalStatus = RevisionFinalStatus.Approved;
                revision.SecretaryApprovedAt = DateTime.UtcNow;
            }
            else if (normalizedAction == "REJECT")
            {
                revision.Status = RevisionStatus.Rejected;
                revision.FinalStatus = RevisionFinalStatus.Rejected;
                if (newDeadline.HasValue)
                {
                    revision.SubmissionDeadline = newDeadline.Value;
                }
                revision.SecretaryApprovedAt = DateTime.UtcNow;
            }
            else
            {
                throw new BusinessRuleException("Action không hợp lệ. Chỉ chấp nhận APPROVE hoặc REJECT.");
            }

            revision.SecretaryComment = comment;
            revision.SecretaryUserCode = secretaryUserCode;
            revision.LastUpdated = DateTime.UtcNow;

            _uow.DefenseRevisions.Update(revision);
            await _uow.SaveChangesAsync();
            await _auditTrail.WriteAsync(
                "SECRETARY_REVIEW_REVISION",
                "SUCCESS",
                null,
                new { revision.Id, revision.Status, revision.SecretaryComment, revision.SecretaryUserCode, revision.SecretaryApprovedAt },
                new { RevisionId = revisionId, Action = normalizedAction },
                actorUserId,
                cancellationToken);

            await tx.CommitAsync(cancellationToken);

            // Notify Student of result
            try
            {
                var studentInfo = await _db.DefenseAssignments
                    .Join(_db.Topics, a => a.TopicCode, t => t.TopicCode, (a, t) => new { a.AssignmentID, t.ProposerStudentCode, t.TopicCode })
                    .Where(x => x.AssignmentID == revision.AssignmentId)
                    .Select(x => new { x.ProposerStudentCode, x.TopicCode })
                    .FirstOrDefaultAsync(cancellationToken);

                if (studentInfo != null && !string.IsNullOrWhiteSpace(studentInfo.ProposerStudentCode))
                {
                    var isApproved = normalizedAction == "APPROVE";
                    var title = isApproved ? "Thư ký hội đồng đã duyệt" : "Thư ký hội đồng đã từ chối";
                    var body = isApproved 
                        ? $"Báo cáo hoàn thiện của bạn đã được thư ký hội đồng duyệt. Chúc mừng bạn đã hoàn thành khóa luận!"
                        : $"Báo cáo hoàn thiện của bạn đã bị từ chối. Lý do: {comment ?? "Vui lòng xem chi tiết"}"; // Removed deadline info for reject
                    
                    await _notificationPublisher.PublishAsync(new NotificationEventRequest(
                        NotifCategory: "DEFENSE_REVISION",
                        NotifTitle: title,
                        NotifBody: body,
                        NotifPriority: isApproved ? "NORMAL" : "HIGH",
                        ActionType: "VIEW_REVISION_RESULT",
                        ActionUrl: $"/student/defense-info",
                        RelatedEntityName: "DefenseRevision",
                        RelatedEntityCode: studentInfo.TopicCode,
                        RelatedEntityID: revisionId,
                        IsGlobal: false,
                        TargetUserCodes: new List<string> { studentInfo.ProposerStudentCode }
                    ));
                }
            }
            catch { }
        }

        private static RevisionFinalStatus ResolveFinalStatus(DefenseRevision revision, bool approved, DefenseRevisionQuorumOptions options)
        {
            if (!approved && options.RejectAsVeto)
            {
                return RevisionFinalStatus.Rejected;
            }

            // New flow: only secretary approval determines finalization. Use quorum options to allow flexibility,
            // but by default require secretary approval to mark as Approved.
            var approvalCount = revision.IsUvtkApproved ? 1 : 0;
            var requireCount = Math.Max(1, options.MinimumApprovals);
            var requiredRolesOk = (!options.RequireSecretaryApproval || revision.IsUvtkApproved);

            if (requiredRolesOk && approvalCount >= requireCount)
            {
                return RevisionFinalStatus.Approved;
            }

            return RevisionFinalStatus.Pending;
        }

        private static string NormalizeRole(string? role)
        {
            if (string.IsNullOrWhiteSpace(role))
            {
                return string.Empty;
            }

            var upper = role.Trim().ToUpperInvariant();
            if (upper.Contains("GVHD")) return "GVHD";
            if (upper.Contains("CHU") || upper == "CT") return "CT";
            if (upper.Contains("UVTK") || upper.Contains("THU") || upper == "TK" || upper.Contains("SECRETARY")) return "UVTK";
            if (upper.Contains("UVPB") || upper.Contains("PHAN") || upper == "PB" || upper.Contains("REVIEWER")) return "UVPB";
            if (upper == "UV" || upper.Contains("UY VIEN") || upper == "MEMBER") return "UV";
            return upper;
        }
    }
}

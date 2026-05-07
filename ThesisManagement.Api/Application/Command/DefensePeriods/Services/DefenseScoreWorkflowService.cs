using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using ThesisManagement.Api.Application.Common;
using ThesisManagement.Api.Application.Common.Resilience;
using ThesisManagement.Api.Data;
using ThesisManagement.Api.DTOs.DefensePeriods;
using ThesisManagement.Api.Hubs;
using ThesisManagement.Api.Models;

namespace ThesisManagement.Api.Application.Command.DefensePeriods.Services
{
    public interface IDefenseScoreWorkflowService
    {
        Task SubmitIndependentScoreAsync(int committeeId, LecturerScoreSubmitDto request, string lecturerCode, int actorUserId, CancellationToken cancellationToken = default);
        Task OpenSessionAsync(int committeeId, string lecturerCode, int actorUserId, CancellationToken cancellationToken = default);
        Task LockSessionAsync(int committeeId, string lecturerCode, int actorUserId, CancellationToken cancellationToken = default);
        Task CloseSessionAsync(int committeeId, string lecturerCode, int actorUserId, CancellationToken cancellationToken = default);
    }

    public sealed class DefenseScoreWorkflowService : IDefenseScoreWorkflowService
    {
        private const decimal ScoreVarianceThreshold = 2.0m;

        private sealed class DefensePeriodSessionConfigSnapshot
        {
            public bool CouncilListLocked { get; set; }
        }

        private sealed class SubmittedScoreRow
        {
            public int ScoreID { get; set; }
            public int AssignmentID { get; set; }
            public string MemberLecturerCode { get; set; } = string.Empty;
            public decimal Score { get; set; }
            public string? Role { get; set; }
            public DateTime? LastUpdated { get; set; }
        }

        private readonly ApplicationDbContext _db;
        private readonly ThesisManagement.Api.Services.IUnitOfWork _uow;
        private readonly IHubContext<ChatHub> _hub;
        private readonly IDefenseAuditTrailService _auditTrail;
        private readonly IDefenseResiliencePolicy _resiliencePolicy;

        public DefenseScoreWorkflowService(
            ApplicationDbContext db,
            ThesisManagement.Api.Services.IUnitOfWork uow,
            IHubContext<ChatHub> hub,
            IDefenseAuditTrailService auditTrail,
            IDefenseResiliencePolicy resiliencePolicy)
        {
            _db = db;
            _uow = uow;
            _hub = hub;
            _auditTrail = auditTrail;
            _resiliencePolicy = resiliencePolicy;
        }

        public async Task SubmitIndependentScoreAsync(int committeeId, LecturerScoreSubmitDto request, string lecturerCode, int actorUserId, CancellationToken cancellationToken = default)
        {
            await using var tx = await _uow.BeginTransactionAsync(cancellationToken);

            if (request.Score < 0m || request.Score > 10m)
            {
                throw new BusinessRuleException("Điểm phải nằm trong khoảng [0,10].", "UC3.2.INVALID_SCORE_RANGE");
            }

            var assignment = await _db.DefenseAssignments.AsNoTracking().FirstOrDefaultAsync(x => x.AssignmentID == request.AssignmentId && x.CommitteeID == committeeId, cancellationToken);
            if (assignment == null)
            {
                throw new BusinessRuleException("Assignment không thuộc hội đồng.");
            }

            var member = await _db.CommitteeMembers.AsNoTracking()
                .FirstOrDefaultAsync(x => x.CommitteeID == committeeId && x.MemberLecturerCode == lecturerCode, cancellationToken);
            if (member == null)
            {
                throw new BusinessRuleException("Giảng viên không thuộc hội đồng.");
            }

            var committeeState = await _db.Committees.AsNoTracking().FirstOrDefaultAsync(x => x.CommitteeID == committeeId, cancellationToken);
            if (committeeState == null)
            {
                throw new BusinessRuleException("Không tìm thấy hội đồng.");
            }

            var normalizedCommitteeStatus = DefenseWorkflowStateMachine.ParseCommitteeStatus(committeeState.Status);
            var normalizedAssignmentStatus = DefenseWorkflowStateMachine.ParseAssignmentStatus(assignment.Status);
            if (normalizedCommitteeStatus == CommitteeStatus.Draft)
            {
                throw new BusinessRuleException("Hội đồng đang ở trạng thái Draft. Cần sẵn sàng và mở ca trước khi chấm điểm.", "UC3.4.INVALID_COMMITTEE_STATE");
            }

            if (normalizedCommitteeStatus == CommitteeStatus.Ready && normalizedAssignmentStatus == AssignmentStatus.Pending)
            {
                throw new BusinessRuleException("Cần mở ca bảo vệ trước khi chấm điểm.", "UC3.4.SESSION_NOT_OPEN");
            }

            if (normalizedCommitteeStatus == CommitteeStatus.Finalized || normalizedCommitteeStatus == CommitteeStatus.Published)
            {
                throw new BusinessRuleException("Hội đồng đã chốt/công bố kết quả, không thể chấm điểm thêm.", "UC3.4.INVALID_COMMITTEE_STATE");
            }

            // Check if DEFENSE_RESULTS is locked (scores have been finalized by Chair)
            var result = await _db.DefenseResults.AsNoTracking().FirstOrDefaultAsync(x => x.AssignmentId == request.AssignmentId, cancellationToken);
            if (result != null && result.IsLocked)
            {
                throw new BusinessRuleException("Phiên điểm đang bị khóa, cần mở khóa trước khi chỉnh sửa điểm.");
            }

            var score = await _db.DefenseScores.FirstOrDefaultAsync(x => x.AssignmentID == request.AssignmentId && x.MemberLecturerCode == lecturerCode, cancellationToken);
            var beforeScoreSnapshot = score == null
                ? null
                : new
                {
                    score.Score,
                    score.Comment,
                    score.IsSubmitted,
                    score.LastUpdated
                };
            if (score == null)
            {
                score = new DefenseScore
                {
                    ScoreCode = $"SC{DateTime.UtcNow:yyyyMMddHHmmssfff}",
                    AssignmentID = request.AssignmentId,
                    AssignmentCode = assignment.AssignmentCode,
                    MemberLecturerProfileID = member.MemberLecturerProfileID,
                    MemberLecturerCode = lecturerCode,
                    MemberLecturerUserID = member.MemberUserID,
                    MemberLecturerUserCode = member.MemberUserCode,
                    Role = NormalizeRole(member.Role),
                    CreatedAt = DateTime.UtcNow
                };
                await _uow.DefenseScores.AddAsync(score);
            }

            score.Score = request.Score;
            score.Comment = request.Comment;
            score.IsSubmitted = true;
            score.LastUpdated = DateTime.UtcNow;
            if (score.ScoreID > 0)
            {
                _uow.DefenseScores.Update(score);
            }

            await _uow.SaveChangesAsync();

            // NOTE: Do NOT write to DEFENSE_RESULTS here.
            // DEFENSE_RESULTS is only populated when the Chair locks (chốt) the session.

            await _auditTrail.WriteAsync(
                "SUBMIT_INDEPENDENT_SCORE",
                "SUCCESS",
                beforeScoreSnapshot,
                new
                {
                    score.Score,
                    score.Comment,
                    score.IsSubmitted,
                    score.LastUpdated,
                    score.Role
                },
                new
                {
                    CommitteeId = committeeId,
                    request.AssignmentId,
                    LecturerCode = lecturerCode
                },
                actorUserId,
                cancellationToken);

            var trackedAssignment = await _db.DefenseAssignments.FirstOrDefaultAsync(x => x.AssignmentID == request.AssignmentId, cancellationToken);
            if (trackedAssignment != null)
            {
                var assignmentStatus = DefenseWorkflowStateMachine.ParseAssignmentStatus(trackedAssignment.Status);
                if (assignmentStatus == AssignmentStatus.Pending)
                {
                    trackedAssignment.Status = DefenseWorkflowStateMachine.ToValue(AssignmentStatus.Defending);
                    trackedAssignment.LastUpdated = DateTime.UtcNow;
                    _uow.DefenseAssignments.Update(trackedAssignment);
                    await _uow.SaveChangesAsync();
                }
            }

            // Variance warning (notification only, no auto-lock)
            var allScores = await _db.DefenseScores
                .Where(x => x.AssignmentID == request.AssignmentId && x.IsSubmitted)
                .Select(x => x.Score)
                .ToListAsync(cancellationToken);
            if (allScores.Count >= 2)
            {
                var variance = allScores.Max() - allScores.Min();
                if (variance > ScoreVarianceThreshold)
                {
                    await _resiliencePolicy.ExecuteAsync("DEFENSE_HUB_NOTIFY", async ct =>
                    {
                        await _hub.Clients.All.SendAsync("DefenseScoreVarianceAlert", new { CommitteeId = committeeId, AssignmentId = request.AssignmentId, Variance = variance }, ct);
                    }, cancellationToken);
                }
            }

            await tx.CommitAsync(cancellationToken);
        }

        public async Task OpenSessionAsync(int committeeId, string lecturerCode, int actorUserId, CancellationToken cancellationToken = default)
        {
            await using var tx = await _uow.BeginTransactionAsync(cancellationToken);

            var member = await _db.CommitteeMembers.AsNoTracking()
                .FirstOrDefaultAsync(x => x.CommitteeID == committeeId && x.MemberLecturerCode == lecturerCode, cancellationToken);
            if (member == null || NormalizeRole(member.Role) != "CT")
            {
                throw new BusinessRuleException("Chỉ Chủ tịch hội đồng (CT) được mở ca bảo vệ.");
            }

            var committee = await _db.Committees.FirstOrDefaultAsync(x => x.CommitteeID == committeeId, cancellationToken);
            if (committee == null)
            {
                throw new BusinessRuleException("Không tìm thấy hội đồng.");
            }

            if (committee.DefenseTermId.HasValue)
            {
                var configJson = await _db.DefenseTerms.AsNoTracking()
                    .Where(x => x.DefenseTermId == committee.DefenseTermId.Value)
                    .Select(x => x.ConfigJson)
                    .FirstOrDefaultAsync(cancellationToken);

                if (!IsCouncilListLocked(configJson))
                {
                    throw new BusinessRuleException(
                        "Danh sách hội đồng chưa được chốt. Cần chốt hội đồng trước khi mở ca bảo vệ.",
                        "UC3.4.COUNCIL_LIST_NOT_LOCKED");
                }
            }

            var assignments = await _db.DefenseAssignments.Where(x => x.CommitteeID == committeeId).ToListAsync(cancellationToken);
            if (assignments.Count == 0)
            {
                throw new BusinessRuleException("Hội đồng chưa có đề tài để mở ca bảo vệ.", "UC3.4.SESSION_EMPTY");
            }

            var beforeSnapshot = new { committee.Status, committee.LastUpdated };
            var committeeStatus = DefenseWorkflowStateMachine.ParseCommitteeStatus(committee.Status);
            if (committeeStatus == CommitteeStatus.Draft)
            {
                throw new BusinessRuleException("Hội đồng đang ở trạng thái Draft. Không thể mở ca bảo vệ.", "UC3.4.INVALID_COMMITTEE_STATE");
            }

            if (committeeStatus == CommitteeStatus.Finalized || committeeStatus == CommitteeStatus.Published)
            {
                throw new BusinessRuleException("Hội đồng đã chốt/công bố kết quả, không thể mở ca bảo vệ.", "UC3.4.INVALID_COMMITTEE_STATE");
            }

            var now = DateTime.UtcNow;
            if (committeeStatus == CommitteeStatus.Ready || committeeStatus == CommitteeStatus.Completed)
            {
                committee.Status = DefenseWorkflowStateMachine.ToValue(CommitteeStatus.Ongoing);
            }

            committee.LastUpdated = now;
            _uow.Committees.Update(committee);

            // Delete all old DefenseResults for this committee's assignments when reopening
            // This ensures a clean slate for rescoring
            var assignmentIds = assignments.Select(x => x.AssignmentID).ToList();
            var oldResults = await _db.DefenseResults
                .Where(x => assignmentIds.Contains(x.AssignmentId))
                .ToListAsync(cancellationToken);
            
            foreach (var result in oldResults)
            {
                _uow.DefenseResults.Remove(result);
            }

            foreach (var assignment in assignments)
            {
                var assignmentStatus = DefenseWorkflowStateMachine.ParseAssignmentStatus(assignment.Status);
                if (assignmentStatus == AssignmentStatus.Pending || assignmentStatus == AssignmentStatus.Graded)
                {
                    assignment.Status = DefenseWorkflowStateMachine.ToValue(AssignmentStatus.Defending);
                    assignment.LastUpdated = now;
                    _uow.DefenseAssignments.Update(assignment);
                }
            }

            await _uow.SaveChangesAsync();
            await tx.CommitAsync(cancellationToken);

            await _auditTrail.WriteAsync(
                "OPEN_SESSION",
                "SUCCESS",
                beforeSnapshot,
                new { committee.Status, committee.LastUpdated },
                new { CommitteeId = committeeId, LecturerCode = lecturerCode },
                actorUserId,
                cancellationToken);

            await _resiliencePolicy.ExecuteAsync("DEFENSE_HUB_NOTIFY", async ct =>
            {
                await _hub.Clients.All.SendAsync("DefenseSessionOpened", new { CommitteeId = committeeId, LecturerCode = lecturerCode }, ct);
            }, cancellationToken);
        }

        public async Task CloseSessionAsync(int committeeId, string lecturerCode, int actorUserId, CancellationToken cancellationToken = default)
        {
            await using var tx = await _uow.BeginTransactionAsync(cancellationToken);

            var chair = await _db.CommitteeMembers.AsNoTracking().FirstOrDefaultAsync(x => x.CommitteeID == committeeId && x.MemberLecturerCode == lecturerCode && x.Role != null && x.Role.ToUpper().Contains("CT"), cancellationToken);
            if (chair == null)
            {
                throw new BusinessRuleException("Chỉ Chủ tịch hội đồng (CT) được đóng phiên bảo vệ.");
            }

            var committee = await _db.Committees.FirstOrDefaultAsync(x => x.CommitteeID == committeeId, cancellationToken);
            if (committee == null)
            {
                throw new BusinessRuleException("Không tìm thấy hội đồng.");
            }

            var committeeStatus = DefenseWorkflowStateMachine.ParseCommitteeStatus(committee.Status);
            if (committeeStatus != CommitteeStatus.Completed)
            {
                throw new BusinessRuleException("Hội đồng chưa hoàn thành chốt điểm để đóng phiên.", "UC3.5.INVALID_COMMITTEE_STATE");
            }

            var now = DateTime.UtcNow;
            DefenseWorkflowStateMachine.EnsureCommitteeTransition(CommitteeStatus.Completed, CommitteeStatus.Finalized, "UC3.5.INVALID_COMMITTEE_STATE");
            committee.Status = DefenseWorkflowStateMachine.ToValue(CommitteeStatus.Finalized);
            committee.LastUpdated = now;
            _uow.Committees.Update(committee);

            await _uow.SaveChangesAsync();
            await tx.CommitAsync(cancellationToken);

            await _auditTrail.WriteAsync(
                "CLOSE_SESSION",
                "SUCCESS",
                new { CommitteeId = committeeId, BeforeStatus = CommitteeStatus.Completed },
                new { CommitteeId = committeeId, AfterStatus = CommitteeStatus.Finalized },
                new { CommitteeId = committeeId, LecturerCode = lecturerCode },
                actorUserId,
                cancellationToken);

            await _resiliencePolicy.ExecuteAsync("DEFENSE_HUB_NOTIFY", async ct =>
            {
                await _hub.Clients.All.SendAsync("DefenseSessionClosed", new { CommitteeId = committeeId, LecturerCode = lecturerCode }, ct);
            }, cancellationToken);
        }

        public async Task LockSessionAsync(int committeeId, string lecturerCode, int actorUserId, CancellationToken cancellationToken = default)
        {
            await using var tx = await _uow.BeginTransactionAsync(cancellationToken);

            var chair = await _db.CommitteeMembers.AsNoTracking().FirstOrDefaultAsync(x => x.CommitteeID == committeeId && x.MemberLecturerCode == lecturerCode && x.Role != null && x.Role.ToUpper().Contains("CT"), cancellationToken);
            if (chair == null)
            {
                throw new BusinessRuleException("Chỉ Chủ tịch hội đồng (CT) được khóa ca bảo vệ.");
            }

            var committee = await _db.Committees.FirstOrDefaultAsync(x => x.CommitteeID == committeeId, cancellationToken);
            if (committee == null)
            {
                throw new BusinessRuleException("Không tìm thấy hội đồng.");
            }

            var committeeStatus = DefenseWorkflowStateMachine.ParseCommitteeStatus(committee.Status);
            if (committeeStatus != CommitteeStatus.Ongoing && committeeStatus != CommitteeStatus.Completed)
            {
                throw new BusinessRuleException("Chỉ có thể đóng ca khi hội đồng đang ở trạng thái Ongoing.", "UC3.5.INVALID_COMMITTEE_STATE");
            }

            var assignmentIds = await _db.DefenseAssignments.AsNoTracking().Where(x => x.CommitteeID == committeeId).Select(x => x.AssignmentID).ToListAsync(cancellationToken);
            var existingResults = await _db.DefenseResults.Where(x => assignmentIds.Contains(x.AssignmentId)).ToListAsync(cancellationToken);
            var existingResultIds = existingResults.Select(x => x.AssignmentId).ToHashSet();
            var topicSupervisorScoreMap = await _db.DefenseAssignments.AsNoTracking()
                .Where(x => assignmentIds.Contains(x.AssignmentID) && !string.IsNullOrWhiteSpace(x.TopicCode))
                .Join(_db.Topics.AsNoTracking(), a => a.TopicCode, t => t.TopicCode, (a, t) => new { a.AssignmentID, t.Score })
                .ToDictionaryAsync(x => x.AssignmentID, x => x.Score, cancellationToken);
            var now = DateTime.UtcNow;

            var committeeMemberRows = await _db.CommitteeMembers.AsNoTracking()
                .Where(x => x.CommitteeID == committeeId && !string.IsNullOrWhiteSpace(x.MemberLecturerCode))
                .Select(x => new
                {
                    x.MemberLecturerCode,
                    x.Role
                })
                .ToListAsync(cancellationToken);

            var normalizedMemberCodes = committeeMemberRows
                .Select(x => x.MemberLecturerCode!.Trim().ToUpperInvariant())
                .Distinct(StringComparer.Ordinal)
                .ToList();

            var committeeRoleMap = committeeMemberRows
                .GroupBy(x => x.MemberLecturerCode!.Trim().ToUpperInvariant())
                .ToDictionary(
                    g => g.Key,
                    g => NormalizeRole(g.Select(x => x.Role).FirstOrDefault()),
                    StringComparer.Ordinal);

            if (normalizedMemberCodes.Count == 0)
            {
                throw new BusinessRuleException("Hội đồng chưa có thành viên để chốt điểm.", DefenseUcErrorCodes.Scoring.IncompleteAlert);
            }

            var rawSubmittedScores = await _db.DefenseScores.AsNoTracking()
                .Where(x => assignmentIds.Contains(x.AssignmentID) && x.IsSubmitted && !string.IsNullOrWhiteSpace(x.MemberLecturerCode))
                .Select(x => new SubmittedScoreRow
                {
                    ScoreID = x.ScoreID,
                    AssignmentID = x.AssignmentID,
                    MemberLecturerCode = x.MemberLecturerCode!,
                    Score = x.Score,
                    LastUpdated = x.LastUpdated
                })
                .ToListAsync(cancellationToken);

            foreach (var row in rawSubmittedScores)
            {
                if (committeeRoleMap.TryGetValue(row.MemberLecturerCode.Trim().ToUpperInvariant(), out var role))
                {
                    row.Role = role;
                }
            }

            var submittedByAssignment = rawSubmittedScores
                .GroupBy(x => x.AssignmentID)
                .ToDictionary(
                    g => g.Key,
                    g => g.GroupBy(v => v.MemberLecturerCode!.Trim().ToUpperInvariant())
                        .Select(v => v
                            .OrderByDescending(o => o.LastUpdated ?? DateTime.MinValue)
                            .ThenByDescending(o => o.ScoreID)
                            .First())
                        .ToList());

            var beforeStatuses = existingResults.Select(x => new { x.AssignmentId, x.IsLocked }).ToList();
            foreach (var assignmentId in assignmentIds)
            {
                submittedByAssignment.TryGetValue(assignmentId, out var submittedRows);
                submittedRows ??= new List<SubmittedScoreRow>();

                var submittedMemberCodes = submittedRows
                    .Select(x => x.MemberLecturerCode.Trim().ToUpperInvariant())
                    .Distinct(StringComparer.Ordinal)
                    .ToList();

                var missingMemberCodes = normalizedMemberCodes
                    .Where(x => !submittedMemberCodes.Contains(x, StringComparer.Ordinal))
                    .ToList();

                if (missingMemberCodes.Count > 0)
                {
                    throw new BusinessRuleException(
                        "Chưa đủ điểm của toàn bộ thành viên hội đồng để khóa ca.",
                        DefenseUcErrorCodes.Scoring.IncompleteAlert,
                        new
                        {
                            CommitteeId = committeeId,
                            AssignmentId = assignmentId,
                            MissingMemberCodes = missingMemberCodes
                        });
                }

                var scoreCt = ResolveRoleScore(submittedRows, x => x.Role, x => x.Score, "CT");
                var scoreTk = ResolveRoleScore(submittedRows, x => x.Role, x => x.Score, "UVTK");
                var scorePb = ResolveRoleScore(submittedRows, x => x.Role, x => x.Score, "UVPB");
                topicSupervisorScoreMap.TryGetValue(assignmentId, out var topicSupervisorScore);
                var scoreGvhd = topicSupervisorScore ?? submittedRows
                    .Where(x => NormalizeRole((string?)x.Role) == "GVHD")
                    .Select(x => (decimal?)x.Score)
                    .FirstOrDefault();
                var finalScore = ResolveFinalScore(scoreGvhd, scoreCt, scoreTk, scorePb);

                if (!finalScore.HasValue)
                {
                    throw new BusinessRuleException(
                        $"Đề tài với mã {assignmentId} không đủ điều kiện chốt điểm vì thiếu điểm thành phần (cần ít nhất 3 thành viên chấm).",
                        DefenseUcErrorCodes.Scoring.IncompleteAlert);
                }

                if (!existingResultIds.Contains(assignmentId))
                {
                    await _uow.DefenseResults.AddAsync(new DefenseResult
                    {
                        AssignmentId = assignmentId,
                        ScoreGvhd = scoreGvhd,
                        ScoreCt = scoreCt,
                        ScoreUvtk = scoreTk,
                        ScoreUvpb = scorePb,
                        FinalScoreNumeric = finalScore,
                        FinalScoreText = ToGrade(finalScore),
                        IsLocked = true,
                        CreatedAt = now,
                        LastUpdated = now
                    });
                    continue;
                }

                var result = existingResults.First(x => x.AssignmentId == assignmentId);
                result.ScoreGvhd = scoreGvhd;
                result.ScoreCt = scoreCt;
                result.ScoreUvtk = scoreTk;
                result.ScoreUvpb = scorePb;
                result.FinalScoreNumeric = finalScore;
                result.FinalScoreText = ToGrade(finalScore);
                result.IsLocked = true;
                result.LastUpdated = now;
                _uow.DefenseResults.Update(result);
            }

            if (committeeStatus == CommitteeStatus.Ongoing)
            {
                DefenseWorkflowStateMachine.EnsureCommitteeTransition(committeeStatus, CommitteeStatus.Completed, "UC3.5.INVALID_COMMITTEE_STATE");
                committee.Status = DefenseWorkflowStateMachine.ToValue(CommitteeStatus.Completed);
            }

            committee.LastUpdated = now;
            _uow.Committees.Update(committee);

            var committeeAssignments = await _db.DefenseAssignments.Where(x => x.CommitteeID == committeeId).ToListAsync(cancellationToken);
            foreach (var assignment in committeeAssignments)
            {
                assignment.Status = DefenseWorkflowStateMachine.ToValue(AssignmentStatus.Graded);
                assignment.LastUpdated = now;
                _uow.DefenseAssignments.Update(assignment);
            }

            // Ensure each assignment has a DefenseMinute (protocol) record - requirement: "mỗi đề tài là 1 Biên bản riêng"
            var existingMinutes = await _db.DefenseMinutes
                .Where(x => assignmentIds.Contains(x.AssignmentId))
                .Select(x => x.AssignmentId)
                .ToHashSetAsync(cancellationToken);

            var secretaryProfile = await _db.LecturerProfiles
                .FirstOrDefaultAsync(x => x.LecturerCode == lecturerCode, cancellationToken);

            var secretaryId = secretaryProfile?.LecturerProfileID ?? 0;

            foreach (var assignmentId in assignmentIds)
            {
                if (!existingMinutes.Contains(assignmentId))
                {
                    // Create new DefenseMinute for this assignment if it doesn't exist
                    await _uow.DefenseMinutes.AddAsync(new DefenseMinute
                    {
                        AssignmentId = assignmentId,
                        SecretaryId = secretaryId > 0 ? secretaryId : 0,
                        CreatedAt = now,
                        LastUpdated = now
                    });
                }
            }

            await _uow.SaveChangesAsync();
            await tx.CommitAsync(cancellationToken);

            await _auditTrail.WriteAsync(
                "LOCK_SESSION",
                "SUCCESS",
                new { CommitteeId = committeeId, ResultStates = beforeStatuses },
                new { CommitteeId = committeeId, LockedAll = true, CommitteeStatus = committee?.Status },
                new { LecturerCode = lecturerCode },
                actorUserId,
                cancellationToken);
        }

        private static bool IsCouncilListLocked(string? configJson)
        {
            if (string.IsNullOrWhiteSpace(configJson))
            {
                return false;
            }

            try
            {
                var config = JsonSerializer.Deserialize<DefensePeriodSessionConfigSnapshot>(configJson);
                return config?.CouncilListLocked ?? false;
            }
            catch
            {
                return false;
            }
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

        private static decimal? ResolveRoleScore<T>(
            IEnumerable<T> source,
            Func<T, string?> roleSelector,
            Func<T, decimal> scoreSelector,
            string targetRole)
        {
            var values = source
                .Where(x => NormalizeRole(roleSelector(x)) == targetRole)
                .Select(scoreSelector)
                .ToList();

            if (values.Count == 0)
            {
                return null;
            }

            return Math.Round(values.Average(), 1);
        }

        private static string? ToGrade(decimal? score)
        {
            if (!score.HasValue)
            {
                return null;
            }

            var s = score.Value;
            if (s >= 9m) return "A";
            if (s >= 7m) return "B";
            if (s >= 5.5m) return "C";
            if (s >= 4m) return "D";
            return "F";
        }

        private async Task RecalculateAggregateForAssignmentIfCompleteAsync(int committeeId, int assignmentId, CancellationToken cancellationToken)
        {
            var committeeMemberRows = await _db.CommitteeMembers.AsNoTracking()
                .Where(x => x.CommitteeID == committeeId && !string.IsNullOrWhiteSpace(x.MemberLecturerCode))
                .Select(x => new
                {
                    x.MemberLecturerCode,
                    x.Role
                })
                .ToListAsync(cancellationToken);

            var normalizedMemberCodes = committeeMemberRows
                .Select(x => x.MemberLecturerCode!.Trim().ToUpperInvariant())
                .Distinct(StringComparer.Ordinal)
                .ToList();

            var committeeRoleMap = committeeMemberRows
                .GroupBy(x => x.MemberLecturerCode!.Trim().ToUpperInvariant())
                .ToDictionary(
                    g => g.Key,
                    g => NormalizeRole(g.Select(x => x.Role).FirstOrDefault()),
                    StringComparer.Ordinal);

            if (normalizedMemberCodes.Count == 0)
            {
                return;
            }

            var submittedRows = await _db.DefenseScores.AsNoTracking()
                .Where(x => x.AssignmentID == assignmentId && x.IsSubmitted && !string.IsNullOrWhiteSpace(x.MemberLecturerCode))
                .Select(x => new SubmittedScoreRow
                {
                    ScoreID = x.ScoreID,
                    AssignmentID = x.AssignmentID,
                    MemberLecturerCode = x.MemberLecturerCode!,
                    Score = x.Score,
                    LastUpdated = x.LastUpdated
                })
                .ToListAsync(cancellationToken);

            foreach (var row in submittedRows)
            {
                if (committeeRoleMap.TryGetValue(row.MemberLecturerCode.Trim().ToUpperInvariant(), out var role))
                {
                    row.Role = role;
                }
            }

            var perMemberLatest = submittedRows
                .GroupBy(x => x.MemberLecturerCode!.Trim().ToUpperInvariant())
                .Select(g => g
                    .OrderByDescending(v => v.LastUpdated ?? DateTime.MinValue)
                    .ThenByDescending(v => v.ScoreID)
                    .First())
                .ToList();

            var submittedMemberCodes = perMemberLatest
                .Select(x => x.MemberLecturerCode!.Trim().ToUpperInvariant())
                .Distinct(StringComparer.Ordinal)
                .ToList();

            if (normalizedMemberCodes.Any(x => !submittedMemberCodes.Contains(x, StringComparer.Ordinal)))
            {
                return;
            }

            var scoreCt = ResolveRoleScore(perMemberLatest, x => x.Role, x => x.Score, "CT");
            var scoreTk = ResolveRoleScore(perMemberLatest, x => x.Role, x => x.Score, "UVTK");
            var scorePb = ResolveRoleScore(perMemberLatest, x => x.Role, x => x.Score, "UVPB");
            var topicSupervisorScore = await GetTopicSupervisorScoreByAssignmentAsync(assignmentId, cancellationToken);
            var scoreGvhd = topicSupervisorScore ?? perMemberLatest.Where(x => NormalizeRole(x.Role) == "GVHD").Select(x => (decimal?)x.Score).FirstOrDefault();
            var finalScore = ResolveFinalScore(scoreGvhd, scoreCt, scoreTk, scorePb);

            var now = DateTime.UtcNow;
            var result = await _db.DefenseResults.FirstOrDefaultAsync(x => x.AssignmentId == assignmentId, cancellationToken);
            if (result == null)
            {
                result = new DefenseResult
                {
                    AssignmentId = assignmentId,
                    ScoreGvhd = scoreGvhd,
                    ScoreCt = scoreCt,
                    ScoreUvtk = scoreTk,
                    ScoreUvpb = scorePb,
                    FinalScoreNumeric = finalScore,
                    FinalScoreText = ToGrade(finalScore),
                    IsLocked = false,
                    CreatedAt = now,
                    LastUpdated = now
                };
                await _uow.DefenseResults.AddAsync(result);
            }
            else
            {
                result.ScoreGvhd = scoreGvhd;
                result.ScoreCt = scoreCt;
                result.ScoreUvtk = scoreTk;
                result.ScoreUvpb = scorePb;
                result.FinalScoreNumeric = finalScore;
                result.FinalScoreText = ToGrade(finalScore);
                result.LastUpdated = now;
                _uow.DefenseResults.Update(result);
            }

            await _uow.SaveChangesAsync();
        }

        private static decimal? ResolveFinalScore(
            decimal? scoreGvhd,
            decimal? scoreCt,
            decimal? scoreTk,
            decimal? scorePb)
        {
            var componentScores = new[] { scoreGvhd, scoreCt, scoreTk, scorePb }
                .Where(x => x.HasValue)
                .Select(x => x!.Value)
                .ToList();

            if (componentScores.Count >= 3)
            {
                return Math.Round(componentScores.Average(), 1);
            }

            return null;
        }

        private async Task<decimal?> GetTopicSupervisorScoreByAssignmentAsync(int assignmentId, CancellationToken cancellationToken)
        {
            return await _db.DefenseAssignments.AsNoTracking()
                .Where(x => x.AssignmentID == assignmentId && !string.IsNullOrWhiteSpace(x.TopicCode))
                .Join(_db.Topics.AsNoTracking(), a => a.TopicCode, t => t.TopicCode, (a, t) => (decimal?)t.Score)
                .FirstOrDefaultAsync(cancellationToken);
        }
    }
}

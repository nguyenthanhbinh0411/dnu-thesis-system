using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using ThesisManagement.Api.Application.Command.ProgressSubmissions;
using ThesisManagement.Api.Application.Command.Notifications;
using ThesisManagement.Api.Application.Common;
using ThesisManagement.Api.Data;
using ThesisManagement.Api.DTOs.ProgressSubmissions.Command;
using ThesisManagement.Api.DTOs.Reports.Command;
using ThesisManagement.Api.DTOs.Reports.Query;
using ThesisManagement.Api.Models;
using ThesisManagement.Api.Services;
using ThesisManagement.Api.Services.FileStorage;

namespace ThesisManagement.Api.Application.Command.Reports
{
    public interface IReportCommandProcessor
    {
        Task<OperationResult<StudentProgressSubmitResultDto>> SubmitStudentProgressAsync(StudentProgressSubmitFormDto payload, IReadOnlyList<IFormFile> files);
        Task<OperationResult<object>> ReviewLecturerSubmissionAsync(int submissionId, ProgressSubmissionUpdateDto dto);
    }

    public class ReportCommandProcessor : IReportCommandProcessor
    {
        private readonly IUnitOfWork _uow;
        private readonly ApplicationDbContext _db;
        private readonly IUpdateProgressSubmissionCommand _updateProgressSubmissionCommand;
        private readonly INotificationEventPublisher _notificationEventPublisher;
        private readonly IFileStorageService _storageService;

        public ReportCommandProcessor(
            IUnitOfWork uow,
            ApplicationDbContext db,
            IUpdateProgressSubmissionCommand updateProgressSubmissionCommand,
            INotificationEventPublisher notificationEventPublisher,
            IFileStorageService storageService)
        {
            _uow = uow;
            _db = db;
            _updateProgressSubmissionCommand = updateProgressSubmissionCommand;
            _notificationEventPublisher = notificationEventPublisher;
            _storageService = storageService;
        }

        public async Task<OperationResult<StudentProgressSubmitResultDto>> SubmitStudentProgressAsync(StudentProgressSubmitFormDto payload, IReadOnlyList<IFormFile> files)
        {
            if (string.IsNullOrWhiteSpace(payload.TopicCode) || string.IsNullOrWhiteSpace(payload.MilestoneCode) || string.IsNullOrWhiteSpace(payload.StudentUserCode))
                return OperationResult<StudentProgressSubmitResultDto>.Failed("topicCode, milestoneCode, studentUserCode are required", 400);

            var topic = await _uow.Topics.Query().FirstOrDefaultAsync(x => x.TopicCode == payload.TopicCode && x.ProposerUserCode == payload.StudentUserCode);
            if (topic == null)
                return OperationResult<StudentProgressSubmitResultDto>.Failed("Topic not found for this student", 404);

            if (IsPendingTopic(topic.Status))
                return OperationResult<StudentProgressSubmitResultDto>.Failed("Topic is pending approval", 409);

            var latestSubmission = await _uow.ProgressSubmissions.Query()
                .Where(x => x.StudentUserCode == payload.StudentUserCode)
                .OrderByDescending(x => x.SubmittedAt)
                .ThenByDescending(x => x.SubmissionID)
                .FirstOrDefaultAsync();

            if (latestSubmission != null && IsPendingLecturerState(latestSubmission.LecturerState))
                return OperationResult<StudentProgressSubmitResultDto>.Failed("Latest submission is still pending review", 409);

            var milestone = await _uow.ProgressMilestones.Query().FirstOrDefaultAsync(x => x.MilestoneCode == payload.MilestoneCode && x.TopicCode == payload.TopicCode);
            if (milestone == null)
                return OperationResult<StudentProgressSubmitResultDto>.Failed("Milestone not found", 404);

            var studentUser = await _uow.Users.Query()
                .Where(x => x.UserCode == payload.StudentUserCode)
                .Select(x => new { x.UserID, x.UserCode })
                .FirstOrDefaultAsync();

            if (studentUser == null)
                return OperationResult<StudentProgressSubmitResultDto>.Failed("Student user not found", 404);

            var effectiveLecturerCode = string.IsNullOrWhiteSpace(payload.LecturerCode)
                ? topic.SupervisorLecturerCode
                : payload.LecturerCode;

            LecturerProfile? lecturerProfile = null;
            if (!string.IsNullOrWhiteSpace(effectiveLecturerCode))
            {
                lecturerProfile = await _uow.LecturerProfiles.Query()
                    .FirstOrDefaultAsync(x => x.LecturerCode == effectiveLecturerCode);
            }

            if (lecturerProfile == null && topic.SupervisorLecturerProfileID.HasValue)
            {
                lecturerProfile = await _uow.LecturerProfiles.Query()
                    .FirstOrDefaultAsync(x => x.LecturerProfileID == topic.SupervisorLecturerProfileID.Value);
            }

            if (lecturerProfile == null)
                return OperationResult<StudentProgressSubmitResultDto>.Failed("Lecturer profile not found", 404);

            var studentProfile = await _uow.StudentProfiles.Query().FirstOrDefaultAsync(x => x.UserCode == payload.StudentUserCode);

            await using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var uploadedUrls = new List<string>();
                var submission = new ProgressSubmission
                {
                    SubmissionCode = await GenerateSubmissionCodeAsync(),
                    MilestoneID = milestone.MilestoneID,
                    MilestoneCode = milestone.MilestoneCode,
                    StudentUserCode = payload.StudentUserCode,
                    StudentUserID = studentUser.UserID,
                    StudentProfileCode = payload.StudentProfileCode ?? studentProfile?.StudentCode,
                    StudentProfileID = studentProfile?.StudentProfileID,
                    LecturerCode = lecturerProfile.LecturerCode,
                    LecturerProfileID = lecturerProfile.LecturerProfileID,
                    Ordinal = milestone.Ordinal,
                    AttemptNumber = payload.AttemptNumber ?? 1,
                    LecturerState = "PENDING",
                    ReportTitle = payload.ReportTitle,
                    ReportDescription = payload.ReportDescription,
                    SubmittedAt = DateTime.UtcNow,
                    LastUpdated = DateTime.UtcNow
                };

                await _db.ProgressSubmissions.AddAsync(submission);
                await _db.SaveChangesAsync();

                var attachedFiles = new List<SubmissionFile>();
                foreach (var file in files)
                {
                    if (file.Length <= 0) continue;

                    var uploadResult = await _storageService.UploadAsync(file, "uploads", allowLocalFallback: false);
                    if (!uploadResult.Success)
                    {
                        foreach (var uploadedUrl in uploadedUrls)
                        {
                            await _storageService.DeleteAsync(uploadedUrl);
                        }

                        await transaction.RollbackAsync();
                        return OperationResult<StudentProgressSubmitResultDto>.Failed(uploadResult.ErrorMessage ?? "Upload file failed", uploadResult.StatusCode);
                    }

                    var originalFileName = Path.GetFileName(file.FileName);
                    uploadedUrls.Add(uploadResult.Data!);

                    attachedFiles.Add(new SubmissionFile
                    {
                        SubmissionID = submission.SubmissionID,
                        SubmissionCode = submission.SubmissionCode,
                        FileURL = uploadResult.Data!,
                        FileName = originalFileName,
                        FileSizeBytes = file.Length,
                        MimeType = file.ContentType,
                        UploadedAt = DateTime.UtcNow,
                        UploadedByUserCode = payload.StudentUserCode,
                        UploadedByUserID = null
                    });
                }

                if (attachedFiles.Count > 0)
                {
                    await _db.SubmissionFiles.AddRangeAsync(attachedFiles);
                    await _db.SaveChangesAsync();
                }

                await transaction.CommitAsync();

                if (!string.IsNullOrWhiteSpace(lecturerProfile.UserCode))
                {
                    await _notificationEventPublisher.PublishAsync(new NotificationEventRequest(
                        NotifCategory: "PROGRESS_SUBMISSION",
                        NotifTitle: "Có báo cáo tiến độ mới",
                        NotifBody: $"Sinh viên {payload.StudentUserCode} vừa nộp báo cáo {submission.SubmissionCode} cho mốc {submission.MilestoneCode}. "
                            + $"Tiêu đề báo cáo: {(string.IsNullOrWhiteSpace(submission.ReportTitle) ? "(không có tiêu đề)" : submission.ReportTitle)}. "
                            + "Vui lòng vào chi tiết để xem tệp đính kèm và thực hiện đánh giá.",
                        NotifPriority: "NORMAL",
                        ActionType: "OPEN_SUBMISSION",
                        ActionUrl: $"/reports/submissions/{submission.SubmissionID}",
                        RelatedEntityName: "PROGRESS_SUBMISSION",
                        RelatedEntityCode: submission.SubmissionCode,
                        RelatedEntityID: submission.SubmissionID,
                        IsGlobal: false,
                        TargetUserCodes: new List<string> { lecturerProfile.UserCode }));
                }

                var result = new StudentProgressSubmitResultDto(
                    new ReportSubmissionDto(
                        submission.SubmissionID,
                        submission.SubmissionCode,
                        submission.MilestoneID,
                        submission.MilestoneCode,
                        submission.StudentUserCode,
                        submission.StudentProfileCode,
                        submission.LecturerCode,
                        submission.Ordinal,
                        submission.SubmittedAt,
                        submission.AttemptNumber,
                        submission.LecturerComment,
                        submission.LecturerState,
                        submission.FeedbackLevel,
                        submission.ReportTitle,
                        submission.ReportDescription,
                        submission.LastUpdated,
                        attachedFiles.Select(MapFile).ToList()),
                    "Submit progress report successfully");

                return OperationResult<StudentProgressSubmitResultDto>.Succeeded(result, 201);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return OperationResult<StudentProgressSubmitResultDto>.Failed($"Submit failed: {ex.Message}", 500);
            }
        }

        public async Task<OperationResult<object>> ReviewLecturerSubmissionAsync(int submissionId, ProgressSubmissionUpdateDto dto)
        {
            var result = await _updateProgressSubmissionCommand.ExecuteAsync(submissionId, dto);
            if (!result.Success)
                return OperationResult<object>.Failed(result.ErrorMessage ?? "Request failed", result.StatusCode);

            var reviewedSubmission = await _uow.ProgressSubmissions.Query()
                .Include(x => x.Milestone)
                .FirstOrDefaultAsync(x => x.SubmissionID == submissionId);

            if (reviewedSubmission == null)
                return OperationResult<object>.Failed("Submission not found after update", 404);

            // Handle workflow transition if approved
            if (IsApprovedLecturerState(dto.LecturerState))
            {
                await HandleWorkflowTransitionAsync(reviewedSubmission, dto);
            }

            if (!string.IsNullOrWhiteSpace(reviewedSubmission.StudentUserCode))
            {
                await _notificationEventPublisher.PublishAsync(new NotificationEventRequest(
                    NotifCategory: "PROGRESS_REVIEW",
                    NotifTitle: "Báo cáo tiến độ đã được đánh giá",
                    NotifBody: $"Báo cáo {reviewedSubmission.SubmissionCode} đã được giảng viên cập nhật kết quả. "
                        + $"Trạng thái: {(string.IsNullOrWhiteSpace(dto.LecturerState) ? reviewedSubmission.LecturerState : dto.LecturerState)}. "
                        + (string.IsNullOrWhiteSpace(dto.LecturerComment)
                            ? "Vui lòng mở chi tiết để xem phản hồi đầy đủ."
                            : $"Nhận xét: {dto.LecturerComment}"),
                    NotifPriority: "NORMAL",
                    ActionType: "OPEN_SUBMISSION",
                    ActionUrl: $"/reports/submissions/{submissionId}",
                    RelatedEntityName: "PROGRESS_SUBMISSION",
                    RelatedEntityCode: reviewedSubmission.SubmissionCode,
                    RelatedEntityID: reviewedSubmission.SubmissionID,
                    IsGlobal: false,
                    TargetUserCodes: new List<string> { reviewedSubmission.StudentUserCode }));
            }

            return OperationResult<object>.Succeeded(result.Data);
        }

        private static bool IsPendingTopic(string? status)
        {
            if (string.IsNullOrWhiteSpace(status))
                return false;

            var normalized = status.Trim().ToLowerInvariant();
            return normalized.Contains("pending") || normalized.Contains("cho duyet") || normalized.Contains("chờ duyệt");
        }

        private static bool IsPendingLecturerState(string? lecturerState)
        {
            if (string.IsNullOrWhiteSpace(lecturerState))
                return true;

            var normalized = lecturerState.Trim().ToLowerInvariant();
            return normalized is "pending" or "cho duyet" or "chờ duyệt" or "dang cho" or "đang chờ";
        }

        private static bool IsApprovedLecturerState(string? lecturerState)
        {
            if (string.IsNullOrWhiteSpace(lecturerState))
                return false;

            var normalized = lecturerState.Trim().ToLowerInvariant();
            return normalized is "approved" or "accepted" or "đã duyệt" or "da duyet" or "dat" or "đạt";
        }

        private async Task HandleWorkflowTransitionAsync(ProgressSubmission submission, ProgressSubmissionUpdateDto dto)
        {
            if (submission.MilestoneID == null) return;

            var currentMilestone = submission.Milestone;
            if (currentMilestone == null)
            {
                currentMilestone = await _uow.ProgressMilestones.GetByIdAsync(submission.MilestoneID.Value);
            }

            if (currentMilestone == null) return;

            // 1. Mark current milestone as Completed
            currentMilestone.State = "Completed";
            currentMilestone.LastUpdated = DateTime.UtcNow;

            // Set completion time based on ordinal
            switch (currentMilestone.Ordinal)
            {
                case 1: currentMilestone.CompletedAt1 = DateTime.UtcNow; break;
                case 2: currentMilestone.CompletedAt2 = DateTime.UtcNow; break;
                case 3: currentMilestone.CompletedAt3 = DateTime.UtcNow; break;
                case 4: currentMilestone.CompletedAt4 = DateTime.UtcNow; break;
                case 5: currentMilestone.CompletedAt5 = DateTime.UtcNow; break;
            }

            _uow.ProgressMilestones.Update(currentMilestone);

            var currentOrdinal = currentMilestone.Ordinal ?? 0;
            var topicId = currentMilestone.TopicID;

            // 2. Handle Final Milestone (Ordinal 4 - MS_FULL)
            if (currentOrdinal == 4 || currentMilestone.MilestoneTemplateCode == "MS_FULL")
            {
                var topic = await _uow.Topics.GetByIdAsync(topicId);
                if (topic != null)
                {
                    topic.Score = dto.Score ?? topic.Score;
                    topic.Status = "Đủ điều kiện bảo vệ";
                    topic.LastUpdated = DateTime.UtcNow;
                    topic.LecturerComment = submission.LecturerComment ?? topic.LecturerComment;

                    // Map Evaluation Fields (Phiếu đánh giá)
                    topic.ReviewQuality = dto.ReviewQuality ?? topic.ReviewQuality;
                    topic.ReviewAttitude = dto.ReviewAttitude ?? topic.ReviewAttitude;
                    topic.ReviewCapability = dto.ReviewCapability ?? topic.ReviewCapability;
                    topic.ReviewResultProcessing = dto.ReviewResultProcessing ?? topic.ReviewResultProcessing;
                    topic.ReviewAchievements = dto.ReviewAchievements ?? topic.ReviewAchievements;
                    topic.ReviewLimitations = dto.ReviewLimitations ?? topic.ReviewLimitations;
                    topic.ReviewConclusion = dto.ReviewConclusion ?? topic.ReviewConclusion;
                    topic.ScoreInWords = dto.ScoreInWords ?? topic.ScoreInWords;

                    // Map structural fields (Kết cấu đồ án)
                    topic.NumChapters = dto.NumChapters ?? topic.NumChapters;
                    topic.NumPages = dto.NumPages ?? topic.NumPages;
                    topic.NumTables = dto.NumTables ?? topic.NumTables;
                    topic.NumFigures = dto.NumFigures ?? topic.NumFigures;
                    topic.NumReferences = dto.NumReferences ?? topic.NumReferences;
                    topic.NumVietnameseReferences = dto.NumVietnameseReferences ?? topic.NumVietnameseReferences;
                    topic.NumForeignReferences = dto.NumForeignReferences ?? topic.NumForeignReferences;

                    _uow.Topics.Update(topic);
                }
            }
            // 3. Handle transition to next milestone
            else if (currentOrdinal < 4)
            {
                var nextOrdinal = currentOrdinal + 1;
                var nextTemplate = await _uow.MilestoneTemplates.Query()
                    .FirstOrDefaultAsync(x => x.Ordinal == nextOrdinal);

                if (nextTemplate != null)
                {
                    var nextMilestone = await _uow.ProgressMilestones.Query()
                        .FirstOrDefaultAsync(x => x.TopicID == topicId && x.Ordinal == nextOrdinal);

                    if (nextMilestone == null)
                    {
                        nextMilestone = new ProgressMilestone
                        {
                            MilestoneID = await GetNextProgressMilestoneIdAsync(),
                            MilestoneCode = await GenerateMilestoneCodeAsync(),
                            TopicID = topicId,
                            TopicCode = currentMilestone.TopicCode,
                            MilestoneTemplateCode = nextTemplate.MilestoneTemplateCode,
                            Ordinal = nextOrdinal,
                            Deadline = nextTemplate.Deadline,
                            State = "Pending", // Initially Pending, Lazy Update will move to In Progress
                            CreatedAt = DateTime.UtcNow,
                            LastUpdated = DateTime.UtcNow
                        };
                        await _uow.ProgressMilestones.AddAsync(nextMilestone);
                    }
                    else if (nextMilestone.State != "Completed")
                    {
                        nextMilestone.State = "Pending";
                        nextMilestone.LastUpdated = DateTime.UtcNow;
                        _uow.ProgressMilestones.Update(nextMilestone);
                    }
                }
            }

            await _uow.SaveChangesAsync();
        }

        private async Task<int> GetNextProgressMilestoneIdAsync()
        {
            var currentMax = await _uow.ProgressMilestones.Query()
                .Select(x => (int?)x.MilestoneID)
                .MaxAsync() ?? 0;

            return currentMax + 1;
        }

        private async Task<string> GenerateMilestoneCodeAsync()
        {
            var now = DateTime.UtcNow;
            var prefix = $"MS{now:yyMMdd}";

            var recentCodes = await _uow.ProgressMilestones.Query()
                .Where(x => x.MilestoneCode.StartsWith(prefix))
                .OrderByDescending(x => x.MilestoneCode)
                .Take(1)
                .Select(x => x.MilestoneCode)
                .ToListAsync();

            var sequence = 1;
            var lastCode = recentCodes.FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(lastCode) && lastCode.Length >= prefix.Length + 3)
            {
                var suffix = lastCode.Substring(prefix.Length, 3);
                if (int.TryParse(suffix, out var parsed))
                    sequence = parsed + 1;
            }

            return $"{prefix}{sequence:D3}";
        }

        private static ReportSubmissionFileDto MapFile(SubmissionFile file)
            => new(
                file.FileID,
                file.SubmissionCode,
                file.FileURL,
                file.FileName,
                file.FileSizeBytes,
                file.MimeType,
                file.UploadedAt,
                file.UploadedByUserCode);

        private async Task<string> GenerateSubmissionCodeAsync()
        {
            var datePart = DateTime.UtcNow.ToString("yyyyMMdd");
            var prefix = $"SUBF{datePart}";
            var existing = await _db.ProgressSubmissions
                .Where(s => EF.Functions.Like(s.SubmissionCode, prefix + "%"))
                .Select(s => s.SubmissionCode)
                .ToListAsync();

            var maxSuffix = 0;
            foreach (var code in existing)
            {
                if (code.Length <= prefix.Length) continue;
                var suffix = code.Substring(prefix.Length);
                if (int.TryParse(suffix, out var number))
                    maxSuffix = Math.Max(maxSuffix, number);
            }

            return $"{prefix}{(maxSuffix + 1):D3}";
        }
    }
}

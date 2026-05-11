using Microsoft.EntityFrameworkCore;
using ThesisManagement.Api.Application.Common;
using ThesisManagement.Api.Data;
using ThesisManagement.Api.DTOs.Reports.Query;
using ThesisManagement.Api.Models;
using ThesisManagement.Api.Services;

namespace ThesisManagement.Api.Application.Query.Reports
{
    public interface IReportQueryProcessor
    {
        Task<OperationResult<StudentDashboardDto>> GetStudentDashboardAsync(string userCode);
        Task<OperationResult<StudentProgressHistoryDto>> GetStudentProgressHistoryAsync(StudentProgressHistoryFilterDto filter);
        Task<OperationResult<LecturerSubmissionListDto>> GetLecturerSubmissionListAsync(LecturerSubmissionFilterDto filter);
    }

    public class ReportQueryProcessor : IReportQueryProcessor
    {
        private readonly IUnitOfWork _uow;
        private readonly ApplicationDbContext _db;

        public ReportQueryProcessor(IUnitOfWork uow, ApplicationDbContext db)
        {
            _uow = uow;
            _db = db;
        }

        public async Task<OperationResult<StudentDashboardDto>> GetStudentDashboardAsync(string userCode)
        {
            if (string.IsNullOrWhiteSpace(userCode))
                return OperationResult<StudentDashboardDto>.Failed("userCode is required", 400);

            var topic = await _uow.Topics.Query()
                .Where(x => x.ProposerUserCode == userCode)
                .OrderByDescending(x => x.LastUpdated ?? x.CreatedAt)
                .ThenByDescending(x => x.TopicID)
                .FirstOrDefaultAsync();

            if (topic == null)
            {
                var empty = new StudentDashboardDto(
                    null,
                    new List<ReportTagDto>(),
                    null,
                    null,
                    new List<ReportTagDto>(),
                    false,
                    "Sinh vien chua co de tai",
                    false,
                    null);
                return OperationResult<StudentDashboardDto>.Succeeded(empty);
            }

            var topicTags = await GetTopicTagsAsync(topic);
            var currentMilestone = await GetCurrentMilestoneByTopicCodeAsync(topic.TopicCode);
            var currentMilestoneOrdinal = currentMilestone?.Ordinal;
            var supervisor = await GetSupervisorAsync(topic.SupervisorLecturerCode, topic.SupervisorLecturerProfileID);
            var supervisorTags = await GetSupervisorTagsAsync(topic.SupervisorLecturerCode, topic.SupervisorLecturerProfileID);

            var canSubmit = true;
            string? blockReason = null;

            if (IsPendingTopic(topic.Status))
            {
                canSubmit = false;
                blockReason = "De tai dang cho duyet";
            }

            var latestSubmission = await _uow.ProgressSubmissions.Query()
                .Where(x => x.StudentUserCode == userCode)
                .OrderByDescending(x => x.SubmittedAt)
                .ThenByDescending(x => x.SubmissionID)
                .FirstOrDefaultAsync();

            if (canSubmit && latestSubmission != null && IsPendingLecturerState(latestSubmission.LecturerState))
            {
                canSubmit = false;
                blockReason = "Bao cao gan nhat chua duoc giang vien xu ly";
            }

            var currentMilestoneSubmission = currentMilestoneOrdinal.HasValue
                ? await _uow.ProgressSubmissions.Query()
                    .Where(x => x.StudentUserCode == userCode && x.Ordinal == currentMilestoneOrdinal.Value)
                    .OrderByDescending(x => x.SubmittedAt)
                    .ThenByDescending(x => x.SubmissionID)
                    .FirstOrDefaultAsync()
                : null;

            var dto = new StudentDashboardDto(
                MapTopic(topic),
                topicTags,
                currentMilestone,
                supervisor,
                supervisorTags,
                canSubmit,
                blockReason,
                currentMilestoneSubmission != null,
                GetCurrentMilestoneSubmissionStatus(currentMilestoneSubmission));

            return OperationResult<StudentDashboardDto>.Succeeded(dto);
        }

        public async Task<OperationResult<StudentProgressHistoryDto>> GetStudentProgressHistoryAsync(StudentProgressHistoryFilterDto filter)
        {
            if (string.IsNullOrWhiteSpace(filter.UserCode))
                return OperationResult<StudentProgressHistoryDto>.Failed("userCode is required", 400);

            var page = filter.Page <= 0 ? 1 : filter.Page;
            var pageSize = filter.PageSize <= 0 ? 10 : Math.Min(filter.PageSize, 100);

            var topic = await _uow.Topics.Query()
                .Where(x => x.ProposerUserCode == filter.UserCode)
                .OrderByDescending(x => x.LastUpdated ?? x.CreatedAt)
                .ThenByDescending(x => x.TopicID)
                .FirstOrDefaultAsync();

            var currentMilestone = topic == null
                ? null
                : await GetCurrentMilestoneByTopicCodeAsync(topic.TopicCode);
            var currentMilestoneOrdinal = currentMilestone?.Ordinal;

            var query = _uow.ProgressSubmissions.Query().Where(x => x.StudentUserCode == filter.UserCode);

            if (!string.IsNullOrWhiteSpace(filter.State))
                query = query.Where(x => x.LecturerState == filter.State);

            if (filter.FromDate.HasValue)
                query = query.Where(x => x.SubmittedAt.HasValue && x.SubmittedAt.Value >= filter.FromDate.Value);

            if (filter.ToDate.HasValue)
                query = query.Where(x => x.SubmittedAt.HasValue && x.SubmittedAt.Value <= filter.ToDate.Value);

            if (!string.IsNullOrWhiteSpace(filter.MilestoneCode))
                query = query.Where(x => x.MilestoneCode == filter.MilestoneCode);

            var totalCount = await query.CountAsync();

            var submissions = await query
                .OrderByDescending(x => x.SubmittedAt)
                .ThenByDescending(x => x.SubmissionID)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var submissionCodes = submissions
                .Where(x => !string.IsNullOrWhiteSpace(x.SubmissionCode))
                .Select(x => x.SubmissionCode!)
                .Distinct()
                .ToList();

            var files = submissionCodes.Count == 0
                ? new List<SubmissionFile>()
                : await _uow.SubmissionFiles.Query()
                    .Where(x => x.SubmissionCode != null && submissionCodes.Contains(x.SubmissionCode))
                    .OrderByDescending(x => x.UploadedAt)
                    .ToListAsync();

            var fileLookup = files
                .GroupBy(x => x.SubmissionCode ?? string.Empty)
                .ToDictionary(
                    g => g.Key,
                    g => (IReadOnlyList<ReportSubmissionFileDto>)g.Select(MapFile).ToList());

            var items = submissions.Select(x =>
            {
                fileLookup.TryGetValue(x.SubmissionCode, out var fileItems);
                fileItems ??= new List<ReportSubmissionFileDto>();

                var isCurrentMilestoneSubmission = currentMilestoneOrdinal.HasValue && x.Ordinal == currentMilestoneOrdinal.Value;
                var submissionStatus = isCurrentMilestoneSubmission
                    ? GetCurrentMilestoneSubmissionStatus(x)
                    : null;

                return new StudentProgressHistoryItemDto(
                    MapSubmission(x, fileItems),
                    isCurrentMilestoneSubmission,
                    submissionStatus);
            }).ToList();

            var dto = new StudentProgressHistoryDto(items, page, pageSize, totalCount);
            return OperationResult<StudentProgressHistoryDto>.Succeeded(dto);
        }

        public async Task<OperationResult<LecturerSubmissionListDto>> GetLecturerSubmissionListAsync(LecturerSubmissionFilterDto filter)
        {
            if (string.IsNullOrWhiteSpace(filter.LecturerCode))
                return OperationResult<LecturerSubmissionListDto>.Failed("lecturerCode is required", 400);

            var page = filter.Page <= 0 ? 1 : filter.Page;
            var pageSize = filter.PageSize <= 0 ? 20 : Math.Min(filter.PageSize, 100);

            var query = _uow.ProgressSubmissions.Query().Where(x => x.LecturerCode == filter.LecturerCode);

            if (!string.IsNullOrWhiteSpace(filter.State))
                query = query.Where(x => x.LecturerState == filter.State);

            var totalCount = await query.CountAsync();

            var submissions = await query
                .OrderByDescending(x => x.SubmittedAt)
                .ThenByDescending(x => x.SubmissionID)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var milestoneCodes = submissions
                .Where(x => !string.IsNullOrWhiteSpace(x.MilestoneCode))
                .Select(x => x.MilestoneCode!)
                .Distinct()
                .ToList();

            var milestones = milestoneCodes.Count == 0
                ? new List<ProgressMilestone>()
                : await _uow.ProgressMilestones.Query()
                    .Where(x => x.MilestoneCode != null && milestoneCodes.Contains(x.MilestoneCode))
                    .ToListAsync();

            var topicCodes = milestones
                .Where(x => !string.IsNullOrWhiteSpace(x.TopicCode))
                .Select(x => x.TopicCode!)
                .Distinct()
                .ToList();

            var topics = topicCodes.Count == 0
                ? new List<Topic>()
                : await _uow.Topics.Query().Where(x => topicCodes.Contains(x.TopicCode)).ToListAsync();

            var userCodes = submissions
                .Where(x => !string.IsNullOrWhiteSpace(x.StudentUserCode))
                .Select(x => x.StudentUserCode!)
                .Distinct()
                .ToList();

            var students = userCodes.Count == 0
                ? new List<StudentProfile>()
                : await _uow.StudentProfiles.Query().Where(x => x.UserCode != null && userCodes.Contains(x.UserCode)).ToListAsync();

            var supervisorCodes = topics
                .Where(x => !string.IsNullOrWhiteSpace(x.SupervisorLecturerCode))
                .Select(x => x.SupervisorLecturerCode!)
                .Distinct()
                .ToList();

            var supervisors = supervisorCodes.Count == 0
                ? new List<LecturerProfile>()
                : await _uow.LecturerProfiles.Query().Where(x => supervisorCodes.Contains(x.LecturerCode)).ToListAsync();

            var submissionCodes = submissions
                .Where(x => !string.IsNullOrWhiteSpace(x.SubmissionCode))
                .Select(x => x.SubmissionCode!)
                .Distinct()
                .ToList();

            var files = submissionCodes.Count == 0
                ? new List<SubmissionFile>()
                : await _uow.SubmissionFiles.Query()
                    .Where(x => x.SubmissionCode != null && submissionCodes.Contains(x.SubmissionCode))
                    .OrderByDescending(x => x.UploadedAt)
                    .ToListAsync();

            var milestoneByCode = milestones.ToDictionary(x => x.MilestoneCode, x => x);
            var topicByCode = topics.ToDictionary(x => x.TopicCode, x => x);
            var studentByUserCode = students.Where(x => !string.IsNullOrWhiteSpace(x.UserCode)).ToDictionary(x => x.UserCode!, x => x);
            var supervisorByCode = supervisors.ToDictionary(x => x.LecturerCode, x => x);
            var filesBySubmissionCode = files
                .GroupBy(x => x.SubmissionCode ?? string.Empty)
                .ToDictionary(g => g.Key, g => (IReadOnlyList<ReportSubmissionFileDto>)g.Select(MapFile).ToList());

            var rows = new List<LecturerSubmissionRowDto>();
            foreach (var submission in submissions)
            {
                milestoneByCode.TryGetValue(submission.MilestoneCode ?? string.Empty, out var milestone);
                Topic? topic = null;
                if (milestone?.TopicCode != null)
                    topicByCode.TryGetValue(milestone.TopicCode, out topic);

                ReportStudentDto? studentDto = null;
                if (!string.IsNullOrWhiteSpace(submission.StudentUserCode) && studentByUserCode.TryGetValue(submission.StudentUserCode, out var student))
                    studentDto = MapStudent(student);

                ReportSupervisorDto? supervisorDto = null;
                if (topic?.SupervisorLecturerCode != null && supervisorByCode.TryGetValue(topic.SupervisorLecturerCode, out var supervisor))
                    supervisorDto = MapSupervisor(supervisor);

                filesBySubmissionCode.TryGetValue(submission.SubmissionCode, out var fileDtos);
                fileDtos ??= new List<ReportSubmissionFileDto>();

                rows.Add(new LecturerSubmissionRowDto(
                    MapSubmission(submission, fileDtos),
                    studentDto,
                    topic == null ? null : MapTopic(topic),
                    supervisorDto));
            }

            var dto = new LecturerSubmissionListDto(rows, page, pageSize, totalCount);
            return OperationResult<LecturerSubmissionListDto>.Succeeded(dto);
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

        private static string GetCurrentMilestoneSubmissionStatus(ProgressSubmission? submission)
        {
            if (submission == null)
                return "Chưa nộp";

            return IsPendingLecturerState(submission.LecturerState)
                ? "Đã nộp - chờ giảng viên xử lý"
                : "Đã nộp";
        }

        private async Task<List<ReportTagDto>> GetTopicTagsAsync(Topic topic)
        {
            var tagCodes = await _uow.TopicTags.Query()
                .Where(x => x.TopicCode == topic.TopicCode && x.TagCode != null)
                .Select(x => x.TagCode!)
                .Distinct()
                .ToListAsync();

            if (tagCodes.Count == 0)
                return new List<ReportTagDto>();

            return await _uow.Tags.Query()
                .Where(x => tagCodes.Contains(x.TagCode))
                .Select(x => new ReportTagDto(x.TagCode, x.TagName))
                .ToListAsync();
        }

        private async Task<List<ReportTagDto>> GetSupervisorTagsAsync(string? lecturerCode, int? lecturerProfileId)
        {
            var lecturerTagQuery = _uow.LecturerTags.Query().Where(x => x.TagCode != null);
            if (!string.IsNullOrWhiteSpace(lecturerCode))
            {
                lecturerTagQuery = lecturerTagQuery.Where(x => x.LecturerCode == lecturerCode);
            }
            else if (lecturerProfileId.HasValue)
            {
                lecturerTagQuery = lecturerTagQuery.Where(x => x.LecturerProfileID == lecturerProfileId.Value);
            }
            else
            {
                return new List<ReportTagDto>();
            }

            var tagCodes = await lecturerTagQuery
                .Select(x => x.TagCode!)
                .Distinct()
                .ToListAsync();

            // Fallback: data may store only LecturerProfileID even when Topic has LecturerCode.
            if (tagCodes.Count == 0 && !string.IsNullOrWhiteSpace(lecturerCode))
            {
                var profile = await _uow.LecturerProfiles.Query()
                    .Where(x => x.LecturerCode == lecturerCode)
                    .Select(x => new { x.LecturerProfileID })
                    .FirstOrDefaultAsync();

                if (profile != null)
                {
                    tagCodes = await _uow.LecturerTags.Query()
                        .Where(x => x.LecturerProfileID == profile.LecturerProfileID && x.TagCode != null)
                        .Select(x => x.TagCode!)
                        .Distinct()
                        .ToListAsync();
                }
            }

            if (tagCodes.Count == 0)
                return new List<ReportTagDto>();

            return await _uow.Tags.Query()
                .Where(x => tagCodes.Contains(x.TagCode))
                .Select(x => new ReportTagDto(x.TagCode, x.TagName))
                .ToListAsync();
        }

        private async Task<ReportMilestoneDto?> GetCurrentMilestoneByTopicCodeAsync(string topicCode)
        {
            var milestone = await _uow.ProgressMilestones.Query()
                .Where(x => x.TopicCode == topicCode)
                .OrderByDescending(x => x.StartedAt)
                .ThenBy(x => x.Ordinal)
                .FirstOrDefaultAsync(x => x.State == "Đang thực hiện")
                ?? await _uow.ProgressMilestones.Query()
                    .Where(x => x.TopicCode == topicCode)
                    .OrderByDescending(x => x.Ordinal)
                    .ThenByDescending(x => x.LastUpdated)
                    .FirstOrDefaultAsync();

            if (milestone == null)
                return null;

            return new ReportMilestoneDto(
                milestone.MilestoneID,
                milestone.MilestoneCode,
                milestone.TopicCode,
                milestone.MilestoneTemplateCode,
                milestone.Ordinal,
                milestone.Deadline,
                milestone.State,
                milestone.StartedAt,
                milestone.CompletedAt1,
                milestone.CompletedAt2,
                milestone.CompletedAt3,
                milestone.CompletedAt4,
                milestone.CompletedAt5);
        }

        private async Task<ReportSupervisorDto?> GetSupervisorAsync(string? supervisorLecturerCode, int? supervisorLecturerProfileId)
        {
            LecturerProfile? supervisor = null;
            if (!string.IsNullOrWhiteSpace(supervisorLecturerCode))
            {
                supervisor = await _uow.LecturerProfiles.Query().FirstOrDefaultAsync(x => x.LecturerCode == supervisorLecturerCode);
            }

            if (supervisor == null && supervisorLecturerProfileId.HasValue)
            {
                supervisor = await _uow.LecturerProfiles.Query().FirstOrDefaultAsync(x => x.LecturerProfileID == supervisorLecturerProfileId.Value);
            }

            if (supervisor == null)
                return null;

            var viewCount = await _db.LecturerDashboardView
                .Where(x => x.LecturerProfileID == supervisor.LecturerProfileID)
                .Select(x => (int?)x.CurrentGuidingCount)
                .FirstOrDefaultAsync();

            return MapSupervisor(supervisor, viewCount);
        }

        private static ReportTopicDto MapTopic(Topic topic)
            => new(
                topic.TopicID,
                topic.TopicCode,
                topic.Title,
                topic.Summary,
                topic.Type,
                topic.Status,
                topic.CatalogTopicCode,
                topic.SupervisorLecturerCode,
                topic.CreatedAt,
                topic.LastUpdated,
                topic.Score,
                topic.ReviewQuality,
                topic.ReviewAttitude,
                topic.ReviewCapability,
                topic.ReviewResultProcessing,
                topic.ReviewAchievements,
                topic.ReviewLimitations,
                topic.ReviewConclusion,
                topic.ScoreInWords,
                topic.NumChapters,
                topic.NumPages,
                topic.NumTables,
                topic.NumFigures,
                topic.NumReferences,
                topic.NumVietnameseReferences,
                topic.NumForeignReferences);

        private static ReportSupervisorDto MapSupervisor(LecturerProfile supervisor, int? currentGuidingCountOverride = null)
            => new(
                supervisor.LecturerProfileID,
                supervisor.LecturerCode,
                supervisor.FullName,
                supervisor.Degree,
                supervisor.Email,
                supervisor.PhoneNumber,
            supervisor.DepartmentCode,
            supervisor.GuideQuota,
            currentGuidingCountOverride ?? supervisor.CurrentGuidingCount);

        private static ReportStudentDto MapStudent(StudentProfile student)
            => new(
                student.StudentProfileID,
                student.StudentCode,
                student.UserCode,
                student.FullName,
                student.StudentEmail,
                student.PhoneNumber,
                student.DepartmentCode,
                student.ClassCode);

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

        private static ReportSubmissionDto MapSubmission(ProgressSubmission submission, IReadOnlyList<ReportSubmissionFileDto> files)
            => new(
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
                files);
    }
}

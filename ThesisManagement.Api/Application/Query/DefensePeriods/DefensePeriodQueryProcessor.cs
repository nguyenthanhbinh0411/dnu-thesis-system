using System.Text;
using System.Text.Json;
using System.Globalization;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using ThesisManagement.Api.Application.Common;
using ThesisManagement.Api.Data;
using ThesisManagement.Api.DTOs;
using ThesisManagement.Api.DTOs.DefensePeriods;
using ThesisManagement.Api.DTOs.DocumentExports;
using ThesisManagement.Api.Models;
using ThesisManagement.Api.Services.DocumentExports;

namespace ThesisManagement.Api.Application.Query.DefensePeriods
{
    public interface IDefensePeriodQueryProcessor
    {
        Task<ApiResponse<List<EligibleStudentDto>>> GetStudentsAsync(int periodId, bool eligibleOnly, CancellationToken cancellationToken = default);
        Task<ApiResponse<DefensePeriodConfigDto>> GetConfigAsync(int periodId, CancellationToken cancellationToken = default);
        Task<ApiResponse<DefensePeriodStateDto>> GetStateAsync(int periodId, CancellationToken cancellationToken = default);
        Task<ApiResponse<RollbackAvailabilityDto>> GetRollbackAvailabilityAsync(int periodId, CancellationToken cancellationToken = default);
        Task<ApiResponse<List<SyncErrorDetailDto>>> GetSyncErrorsAsync(int periodId, CancellationToken cancellationToken = default);
        Task<ApiResponse<(byte[] Content, string FileName, string ContentType)>> ExportSyncErrorsAsync(int periodId, string format, CancellationToken cancellationToken = default);
        Task<ApiResponse<List<LecturerCapabilityDto>>> GetLecturerCapabilitiesAsync(int periodId, CancellationToken cancellationToken = default);
        Task<ApiResponse<PagedResult<CouncilDraftDto>>> GetCouncilsAsync(int periodId, CouncilFilterDto filter, CancellationToken cancellationToken = default);
        Task<ApiResponse<CouncilDraftDto>> GetCouncilDetailAsync(int periodId, int councilId, CancellationToken cancellationToken = default);
        Task<ApiResponse<List<TopicTagUsageDto>>> GetTopicTagsAsync(int periodId, string? tagCode = null, CancellationToken cancellationToken = default);
        Task<ApiResponse<List<LecturerTagUsageDto>>> GetLecturerTagsAsync(int periodId, string? tagCode = null, CancellationToken cancellationToken = default);
        Task<ApiResponse<List<CommitteeTagUsageDto>>> GetCommitteeTagsAsync(int periodId, string? tagCode = null, CancellationToken cancellationToken = default);
        Task<ApiResponse<DefensePeriodTagOverviewDto>> GetTagOverviewAsync(int periodId, CancellationToken cancellationToken = default);
        Task<ApiResponse<List<DefensePeriodCalendarDayDto>>> GetCouncilCalendarAsync(int periodId, DateTime? fromDate = null, DateTime? toDate = null, CancellationToken cancellationToken = default);

        Task<ApiResponse<object>> GetLecturerCommitteesAsync(string lecturerCode, int? periodId = null, CancellationToken cancellationToken = default);
        Task<ApiResponse<List<LecturerCommitteeMinuteDto>>> GetLecturerMinutesAsync(int committeeId, int? periodId = null, CancellationToken cancellationToken = default);
        Task<ApiResponse<List<object>>> GetLecturerRevisionQueueAsync(string lecturerCode, int? periodId = null, CancellationToken cancellationToken = default);

        Task<ApiResponse<StudentDefenseInfoDtoV2>> GetStudentDefenseInfoAsync(string studentCode, int? periodId = null, CancellationToken cancellationToken = default);
        Task<ApiResponse<List<StudentNotificationDto>>> GetStudentNotificationsAsync(string studentCode, int? periodId = null, CancellationToken cancellationToken = default);
        Task<ApiResponse<List<object>>> GetStudentRevisionHistoryAsync(string studentCode, int? periodId = null, CancellationToken cancellationToken = default);

        Task<ApiResponse<AnalyticsOverviewDto>> GetOverviewAsync(int periodId, CancellationToken cancellationToken = default);
        Task<ApiResponse<List<CouncilAnalyticsDto>>> GetAnalyticsByCouncilAsync(int periodId, CancellationToken cancellationToken = default);
        Task<ApiResponse<AnalyticsDistributionDto>> GetDistributionAsync(int periodId, CancellationToken cancellationToken = default);
        Task<ApiResponse<List<ScoringMatrixRowDto>>> GetScoringMatrixAsync(int periodId, int? committeeId = null, bool isForLecturer = false, CancellationToken cancellationToken = default);
        Task<ApiResponse<List<ScoringProgressDto>>> GetScoringProgressAsync(int periodId, int? committeeId = null, CancellationToken cancellationToken = default);
        Task<ApiResponse<List<TopicFinalScoreProgressDto>>> GetTopicFinalScoreProgressAsync(int periodId, int? committeeId = null, CancellationToken cancellationToken = default);
        Task<ApiResponse<List<ScoringAlertDto>>> GetScoringAlertsAsync(int periodId, int? committeeId = null, CancellationToken cancellationToken = default);
        Task<ApiResponse<(byte[] Content, string FileName, string ContentType)>> BuildReportAsync(int periodId, string reportType, string format, int? councilId, CancellationToken cancellationToken = default);
        Task<ApiResponse<(byte[] Content, string FileName, string ContentType)>> BuildReportAsync(int periodId, DefensePeriodReportExportRequestDto request, CancellationToken cancellationToken = default);
        Task<ApiResponse<List<ExportHistoryDto>>> GetExportHistoryAsync(int periodId, CancellationToken cancellationToken = default);
        Task<ApiResponse<List<PublishHistoryDto>>> GetPublishHistoryAsync(int periodId, CancellationToken cancellationToken = default);
        Task<ApiResponse<List<CouncilAuditHistoryDto>>> GetCouncilAuditHistoryAsync(int periodId, int? councilId, CancellationToken cancellationToken = default);
        Task<ApiResponse<List<RevisionAuditTrailDto>>> GetRevisionAuditTrailAsync(int periodId, int revisionId, CancellationToken cancellationToken = default);
          Task<ApiResponse<CommitteeRosterExportSnapshotDto>> GetCommitteeRosterExportAsync(int periodId, CancellationToken cancellationToken = default);
     }

    internal sealed class DefensePeriodConfigSnapshot
    {
        public List<string> Rooms { get; set; } = new();
        public string MorningStart { get; set; } = "07:30";
        public string AfternoonStart { get; set; } = "13:30";
        public int SoftMaxCapacity { get; set; } = 4;
        public bool LecturerCapabilitiesLocked { get; set; }
        public bool CouncilConfigConfirmed { get; set; }
        public bool CouncilListLocked { get; set; }
        public bool Finalized { get; set; }
        public bool ScoresPublished { get; set; }
        public ConfirmCouncilConfigDto CouncilConfig { get; set; } = new();
        public List<int> CouncilIds { get; set; } = new();
    }

    public class DefensePeriodQueryProcessor : IDefensePeriodQueryProcessor
    {
        private sealed class CouncilSummaryRow
        {
            public int CouncilId { get; set; }
            public string CommitteeCode { get; set; } = string.Empty;
            public string Room { get; set; } = string.Empty;
            public string DefenseDate { get; set; } = string.Empty;
            public int StudentCount { get; set; }
            public decimal Avg { get; set; }
            public decimal Max { get; set; }
            public decimal Min { get; set; }
        }

        private sealed class ScoreRowData
        {
            public int CouncilId { get; set; }
            public string CommitteeCode { get; set; } = string.Empty;
            public string? Room { get; set; }
            public DateTime? DefenseDate { get; set; }
            public string Session { get; set; } = string.Empty;
            public string StudentCode { get; set; } = string.Empty;
            public string StudentName { get; set; } = string.Empty;
            public string TopicTitle { get; set; } = string.Empty;
            public decimal? Score { get; set; }
            public string? Grade { get; set; }
        }

        private sealed record ReportColumnDefinition(string Key, string Header);

        private sealed class CommitteeAssignmentSnapshotRow
        {
            public int CommitteeId { get; set; }
            public int AssignmentId { get; set; }
            public int? Session { get; set; }
            public DateTime? ScheduledAt { get; set; }
            public TimeSpan? StartTime { get; set; }
            public TimeSpan? EndTime { get; set; }
            public int? OrderIndex { get; set; }
        }

        private sealed class CommitteeMemberSnapshotRow
        {
            public int CommitteeId { get; set; }
            public string? MemberLecturerCode { get; set; }
            public string? Role { get; set; }
            public bool? IsOnline { get; set; }
        }

        private sealed class LecturerNameSnapshotRow
        {
            public string LecturerCode { get; set; } = string.Empty;
            public string Name { get; set; } = string.Empty;
            public string? Degree { get; set; }
            public string? Organization { get; set; }
        }

        private sealed class CouncilCalendarProjection
        {
            public int CouncilId { get; set; }
            public string CommitteeCode { get; set; } = string.Empty;
            public string Name { get; set; } = string.Empty;
            public string? Room { get; set; }
            public DateTime DefenseDate { get; set; }
            public string Status { get; set; } = string.Empty;
        }

        private readonly ApplicationDbContext _db;
        private readonly IDocumentExportService? _documentExportService;

        public DefensePeriodQueryProcessor(ApplicationDbContext db, IDocumentExportService? documentExportService = null)
        {
            _db = db;
            _documentExportService = documentExportService;
        }

        public async Task<ApiResponse<List<EligibleStudentDto>>> GetStudentsAsync(int periodId, bool eligibleOnly, CancellationToken cancellationToken = default)
        {
            var periodExists = await PeriodExistsAsync(periodId, cancellationToken);
            if (!periodExists)
            {
                return ApiResponse<List<EligibleStudentDto>>.Fail("Không tìm thấy đợt bảo vệ.", 404);
            }

            var periodStudents = await _db.DefenseTermStudents.AsNoTracking()
                .Where(x => x.DefenseTermId == periodId)
                .OrderBy(x => x.StudentCode)
                .ToListAsync(cancellationToken);

            if (periodStudents.Count == 0)
            {
                return ApiResponse<List<EligibleStudentDto>>.SuccessResponse(new List<EligibleStudentDto>());
            }

            var studentCodes = periodStudents
                .Where(x => !string.IsNullOrWhiteSpace(x.StudentCode))
                .Select(x => x.StudentCode)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var students = await _db.StudentProfiles.AsNoTracking()
                .Where(s => studentCodes.Contains(s.StudentCode))
                .ToDictionaryAsync(x => x.StudentCode, x => x.FullName ?? x.StudentCode, cancellationToken);

            var topics = await _db.Topics.AsNoTracking()
                .Where(t => t.DefenseTermId == periodId && t.ProposerStudentCode != null && studentCodes.Contains(t.ProposerStudentCode))
                .OrderBy(t => t.TopicCode)
                .ToListAsync(cancellationToken);

            var eligibleTopicCodes = await LoadEligibleTopicCodesFromMilestonesAsync(topics, cancellationToken);
            var topicTagMap = await LoadTopicTagMapAsync(topics.Select(x => x.TopicCode).ToList(), cancellationToken);
            var topicByStudentCode = topics
                .Where(t => !string.IsNullOrWhiteSpace(t.ProposerStudentCode))
                .GroupBy(t => t.ProposerStudentCode!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    g => g.Key,
                    g => g.OrderByDescending(x => x.LastUpdated ?? x.CreatedAt).ThenBy(x => x.TopicCode).First(),
                    StringComparer.OrdinalIgnoreCase);

            var rows = periodStudents.Select(periodStudent =>
            {
                topicByStudentCode.TryGetValue(periodStudent.StudentCode, out var topic);

                var isEligible = topic != null && eligibleTopicCodes.Contains(topic.TopicCode);
                var valid = topic != null && !string.IsNullOrWhiteSpace(topic.SupervisorLecturerCode);
                return new EligibleStudentDto
                {
                    StudentCode = periodStudent.StudentCode,
                    StudentName = students.TryGetValue(periodStudent.StudentCode, out var n) ? n : periodStudent.StudentCode,
                    TopicTitle = topic?.Title ?? string.Empty,
                    SupervisorCode = topic?.SupervisorLecturerCode,
                    Tags = topic != null && topicTagMap.TryGetValue(topic.TopicCode, out var tags) ? tags.ToList() : new List<string>(),
                    IsEligible = isEligible,
                    Valid = valid,
                    Error = valid ? null : (topic == null ? "Chưa có đề tài trong đợt" : "Thiếu SupervisorCode")
                };
            }).ToList();

            if (eligibleOnly)
            {
                rows = rows.Where(x => x.IsEligible).ToList();
            }

            return ApiResponse<List<EligibleStudentDto>>.SuccessResponse(rows);
        }

        public async Task<ApiResponse<DefensePeriodConfigDto>> GetConfigAsync(int periodId, CancellationToken cancellationToken = default)
        {
            var period = await _db.DefenseTerms.AsNoTracking().FirstOrDefaultAsync(x => x.DefenseTermId == periodId, cancellationToken);
            if (period == null)
            {
                return ApiResponse<DefensePeriodConfigDto>.Fail("Không tìm thấy đợt bảo vệ.", 404);
            }

            var config = await GetPeriodConfigAsync(periodId, cancellationToken);
            var dto = new DefensePeriodConfigDto
            {
                StartDate = period.StartDate,
                EndDate = period.EndDate,
                Rooms = config.Rooms,
                MorningStart = config.MorningStart,
                AfternoonStart = config.AfternoonStart,
                SoftMaxCapacity = config.SoftMaxCapacity,
                TopicsPerSessionConfig = config.CouncilConfig.TopicsPerSessionConfig,
                MembersPerCouncilConfig = config.CouncilConfig.MembersPerCouncilConfig,
                Tags = config.CouncilConfig.Tags
            };

            return ApiResponse<DefensePeriodConfigDto>.SuccessResponse(dto);
        }

        public async Task<ApiResponse<DefensePeriodStateDto>> GetStateAsync(int periodId, CancellationToken cancellationToken = default)
        {
            var period = await _db.DefenseTerms.AsNoTracking().FirstOrDefaultAsync(x => x.DefenseTermId == periodId, cancellationToken);
            if (period == null)
            {
                return ApiResponse<DefensePeriodStateDto>.Fail("Không tìm thấy đợt bảo vệ.", 404);
            }

            var config = await GetPeriodConfigAsync(periodId, cancellationToken);
            var isArchived = string.Equals(period.Status, "Archived", StringComparison.OrdinalIgnoreCase);
            var readiness = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase)
            {
                ["module2"] = config.CouncilConfigConfirmed && config.LecturerCapabilitiesLocked,
                ["canFinalize"] = config.CouncilIds.Count > 0 && config.CouncilListLocked && !config.Finalized,
                ["canLockCouncils"] = config.CouncilIds.Count > 0
                    && config.LecturerCapabilitiesLocked
                    && config.CouncilConfigConfirmed
                    && !config.CouncilListLocked
                    && !config.Finalized,
                ["canReopenCouncils"] = config.CouncilListLocked && !config.Finalized && !config.ScoresPublished,
                ["canPublish"] = config.Finalized && !config.ScoresPublished,
                ["canRollbackPublish"] = config.ScoresPublished,
                ["canRollbackFinalize"] = config.Finalized && !config.ScoresPublished,
                ["canArchive"] = !isArchived && config.ScoresPublished,
                ["canReopen"] = isArchived
            };

            var allowedActions = new List<string>();
            if (isArchived)
            {
                allowedActions.Add("REOPEN");
            }
            else
            {
                if (!config.LecturerCapabilitiesLocked)
                {
                    allowedActions.Add("LOCK_LECTURER_CAPABILITIES");
                }

                if (!config.CouncilConfigConfirmed)
                {
                    allowedActions.Add("CONFIRM_COUNCIL_CONFIG");
                }

                if (!config.Finalized)
                {
                    if (!config.CouncilListLocked)
                    {
                        allowedActions.Add("GENERATE_COUNCILS");
                        allowedActions.Add("UPDATE_COUNCILS");

                        if (readiness["canLockCouncils"])
                        {
                            allowedActions.Add("LOCK_COUNCILS");
                        }
                    }
                    else if (readiness["canReopenCouncils"])
                    {
                        allowedActions.Add("REOPEN_COUNCILS");
                    }
                }

                if (readiness["canFinalize"])
                {
                    allowedActions.Add("FINALIZE");
                }

                if (readiness["canPublish"])
                {
                    allowedActions.Add("PUBLISH");
                }

                if (readiness["canRollbackPublish"])
                {
                    allowedActions.Add("ROLLBACK_PUBLISH");
                }

                if (readiness["canRollbackFinalize"])
                {
                    allowedActions.Add("ROLLBACK_FINALIZE");
                }

                if (readiness["canArchive"])
                {
                    allowedActions.Add("ARCHIVE");
                }
            }

            var warnings = new List<string>();
            if (!config.LecturerCapabilitiesLocked)
            {
                warnings.Add("UC2.READINESS.LECTURER_CAPABILITIES_UNLOCKED");
            }

            if (!config.CouncilConfigConfirmed)
            {
                warnings.Add("UC2.READINESS.COUNCIL_CONFIG_NOT_CONFIRMED");
            }

            if (config.CouncilIds.Count == 0)
            {
                warnings.Add("UC2.READINESS.NO_COUNCILS");
            }

            if (config.CouncilIds.Count > 0 && !config.CouncilListLocked)
            {
                warnings.Add("UC2.READINESS.COUNCIL_LIST_NOT_LOCKED");
            }

            var dto = new DefensePeriodStateDto
            {
                StartDate = period.StartDate,
                EndDate = period.EndDate,
                LecturerCapabilitiesLocked = config.LecturerCapabilitiesLocked,
                CouncilConfigConfirmed = config.CouncilConfigConfirmed,
                CouncilListLocked = config.CouncilListLocked,
                Finalized = config.Finalized,
                ScoresPublished = config.ScoresPublished,
                CouncilCount = config.CouncilIds.Count,
                AllowedActions = allowedActions,
                Readiness = readiness,
                Warnings = warnings
            };

            return ApiResponse<DefensePeriodStateDto>.SuccessResponse(
                dto,
                allowedActions: allowedActions,
                warnings: warnings
                    .Select(code => new ApiWarning
                    {
                        Type = "soft",
                        Code = code,
                        Message = code
                    })
                    .ToList());
        }

        public async Task<ApiResponse<RollbackAvailabilityDto>> GetRollbackAvailabilityAsync(int periodId, CancellationToken cancellationToken = default)
        {
            var period = await _db.DefenseTerms.AsNoTracking().FirstOrDefaultAsync(x => x.DefenseTermId == periodId, cancellationToken);
            if (period == null)
            {
                return ApiResponse<RollbackAvailabilityDto>.Fail("Không tìm thấy đợt bảo vệ.", 404);
            }

            var config = await GetPeriodConfigAsync(periodId, cancellationToken);
            var canRollbackPublish = config.ScoresPublished;
            var canRollbackFinalize = config.Finalized && !config.ScoresPublished;

            var blockers = new List<string>();
            if (!config.ScoresPublished)
            {
                blockers.Add("Chưa publish điểm nên không thể rollback publish.");
            }

            if (!config.Finalized)
            {
                blockers.Add("Đợt bảo vệ chưa finalize nên không thể rollback finalize.");
            }
            else if (config.ScoresPublished)
            {
                blockers.Add("Đang ở trạng thái đã publish. Cần rollback publish trước khi rollback finalize.");
            }

            var recommendedTarget = string.Empty;
            if (config.ScoresPublished && config.Finalized)
            {
                recommendedTarget = "ALL";
            }
            else if (canRollbackPublish)
            {
                recommendedTarget = "PUBLISH";
            }
            else if (canRollbackFinalize)
            {
                recommendedTarget = "FINALIZE";
            }

            return ApiResponse<RollbackAvailabilityDto>.SuccessResponse(new RollbackAvailabilityDto
            {
                CurrentPeriodStatus = period.Status ?? string.Empty,
                Finalized = config.Finalized,
                ScoresPublished = config.ScoresPublished,
                CanRollbackPublish = canRollbackPublish,
                CanRollbackFinalize = canRollbackFinalize,
                RecommendedTarget = recommendedTarget,
                Blockers = blockers
            });
        }

        public async Task<ApiResponse<List<SyncErrorDetailDto>>> GetSyncErrorsAsync(int periodId, CancellationToken cancellationToken = default)
        {
            var periodExists = await PeriodExistsAsync(periodId, cancellationToken);
            if (!periodExists)
            {
                return ApiResponse<List<SyncErrorDetailDto>>.Fail("Không tìm thấy đợt bảo vệ.", 404);
            }

            var rows = await BuildSyncErrorRowsAsync(periodId, cancellationToken);
            return ApiResponse<List<SyncErrorDetailDto>>.SuccessResponse(rows);
        }

        public async Task<ApiResponse<(byte[] Content, string FileName, string ContentType)>> ExportSyncErrorsAsync(int periodId, string format, CancellationToken cancellationToken = default)
        {
            var normalizedFormat = (format ?? "csv").Trim().ToLowerInvariant();
            if (normalizedFormat != "csv" && normalizedFormat != "xlsx")
            {
                return ApiResponse<(byte[] Content, string FileName, string ContentType)>.Fail("Định dạng không hợp lệ. Chỉ hỗ trợ csv hoặc xlsx.", 400);
            }

            var periodExists = await PeriodExistsAsync(periodId, cancellationToken);
            if (!periodExists)
            {
                return ApiResponse<(byte[] Content, string FileName, string ContentType)>.Fail("Không tìm thấy đợt bảo vệ.", 404);
            }

            var rows = await BuildSyncErrorRowsAsync(periodId, cancellationToken);
            var fileNameBase = $"sync-errors_{periodId}_{DateTime.UtcNow:yyyyMMddHHmmss}";

            if (normalizedFormat == "xlsx")
            {
                var xlsxBytes = BuildSyncErrorsXlsxContent(rows);
                return ApiResponse<(byte[] Content, string FileName, string ContentType)>.SuccessResponse((
                    xlsxBytes,
                    $"{fileNameBase}.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            }

            var sb = new StringBuilder();
            sb.AppendLine("RowNo,TopicCode,StudentCode,SupervisorCode,Field,ErrorCode,Message");
            foreach (var row in rows)
            {
                sb.AppendLine(string.Join(",",
                    EscapeCsv(row.RowNo.ToString()),
                    EscapeCsv(row.TopicCode),
                    EscapeCsv(row.StudentCode),
                    EscapeCsv(row.SupervisorCode ?? string.Empty),
                    EscapeCsv(row.Field),
                    EscapeCsv(row.ErrorCode),
                    EscapeCsv(row.Message)));
            }

            var bytes = Encoding.UTF8.GetBytes(sb.ToString());
            return ApiResponse<(byte[] Content, string FileName, string ContentType)>.SuccessResponse((
                bytes,
                $"{fileNameBase}.csv",
                "text/csv; charset=utf-8"));
        }

        public async Task<ApiResponse<List<LecturerCapabilityDto>>> GetLecturerCapabilitiesAsync(int periodId, CancellationToken cancellationToken = default)
        {
            var periodExists = await PeriodExistsAsync(periodId, cancellationToken);
            if (!periodExists)
            {
                return ApiResponse<List<LecturerCapabilityDto>>.Fail("Không tìm thấy đợt bảo vệ.", 404);
            }

            var periodLecturers = await _db.DefenseTermLecturers.AsNoTracking()
                .Where(x => x.DefenseTermId == periodId)
                .OrderBy(x => x.LecturerCode)
                .ToListAsync(cancellationToken);

            if (periodLecturers.Count == 0)
            {
                return ApiResponse<List<LecturerCapabilityDto>>.SuccessResponse(new List<LecturerCapabilityDto>());
            }

            var lecturerCodes = periodLecturers
                .Where(x => !string.IsNullOrWhiteSpace(x.LecturerCode))
                .Select(x => x.LecturerCode)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var lecturers = await _db.LecturerProfiles.AsNoTracking()
                .Where(l => lecturerCodes.Contains(l.LecturerCode))
                .Select(l => new { l.LecturerCode, Name = l.FullName })
                .OrderBy(x => x.LecturerCode)
                .ToListAsync(cancellationToken);

            var tagRows = await _db.LecturerTags.AsNoTracking()
                .Join(_db.Tags.AsNoTracking(), lt => lt.TagID, tg => tg.TagID, (lt, tg) => new { lt.LecturerCode, tg.TagCode })
                .Where(x => x.LecturerCode != null && lecturerCodes.Contains(x.LecturerCode))
                .ToListAsync(cancellationToken);

            var tagMap = tagRows
                .GroupBy(x => x.LecturerCode!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(v => v.TagCode).Distinct(StringComparer.OrdinalIgnoreCase).ToList(),
                    StringComparer.OrdinalIgnoreCase);

            var data = lecturers.Select(l => new LecturerCapabilityDto
            {
                LecturerCode = l.LecturerCode,
                LecturerName = l.Name ?? l.LecturerCode,
                Tags = tagMap.TryGetValue(l.LecturerCode, out var tags) ? tags : new List<string>(),
                Warning = !tagMap.TryGetValue(l.LecturerCode, out var lecturerTags) || lecturerTags.Count == 0
                    ? "Thiếu tag chuyên môn"
                    : null
            }).ToList();

            return ApiResponse<List<LecturerCapabilityDto>>.SuccessResponse(data);
        }

        public async Task<ApiResponse<PagedResult<CouncilDraftDto>>> GetCouncilsAsync(int periodId, CouncilFilterDto filter, CancellationToken cancellationToken = default)
        {
            var config = await GetPeriodConfigAsync(periodId, cancellationToken);
            var query = _db.Committees.AsNoTracking().Where(c => config.CouncilIds.Contains(c.CommitteeID));

            if (!string.IsNullOrWhiteSpace(filter.Keyword))
            {
                var keyword = filter.Keyword.Trim();
                query = query.Where(c => (c.CommitteeCode != null && c.CommitteeCode.Contains(keyword)) || (c.Name != null && c.Name.Contains(keyword)));
            }

            if (!string.IsNullOrWhiteSpace(filter.Room))
            {
                var room = filter.Room.Trim();
                query = query.Where(c => c.Room == room);
            }

            if (!string.IsNullOrWhiteSpace(filter.Tag))
            {
                var tag = filter.Tag.Trim();
                var tagCommitteeIds = await _db.CommitteeTags.AsNoTracking().Where(ct => ct.TagCode == tag).Select(ct => ct.CommitteeID).ToListAsync(cancellationToken);
                query = query.Where(c => tagCommitteeIds.Contains(c.CommitteeID));
            }

            var totalCount = await query.CountAsync(cancellationToken);
            var committeeIds = await query.OrderBy(c => c.CommitteeCode)
                .Skip((Math.Max(filter.Page, 1) - 1) * Math.Max(filter.Size, 1))
                .Take(Math.Max(filter.Size, 1))
                .Select(c => c.CommitteeID)
                .ToListAsync(cancellationToken);

            var items = new List<CouncilDraftDto>();
            foreach (var committeeId in committeeIds)
            {
                var detail = await BuildCouncilDtoAsync(periodId, committeeId, cancellationToken);
                items.Add(detail);
            }

            return ApiResponse<PagedResult<CouncilDraftDto>>.SuccessResponse(new PagedResult<CouncilDraftDto>
            {
                Items = items,
                TotalCount = totalCount
            });
        }

        public async Task<ApiResponse<List<DefensePeriodCalendarDayDto>>> GetCouncilCalendarAsync(int periodId, DateTime? fromDate = null, DateTime? toDate = null, CancellationToken cancellationToken = default)
        {
            var period = await _db.DefenseTerms.AsNoTracking().FirstOrDefaultAsync(x => x.DefenseTermId == periodId, cancellationToken);
            if (period == null)
            {
                return ApiResponse<List<DefensePeriodCalendarDayDto>>.Fail("Không tìm thấy đợt bảo vệ.", 404);
            }

            var rangeStart = (fromDate ?? period.StartDate).Date;
            var rangeEnd = (toDate ?? period.EndDate ?? period.StartDate).Date;

            if (rangeEnd < rangeStart)
            {
                return ApiResponse<List<DefensePeriodCalendarDayDto>>.Fail("fromDate phải nhỏ hơn hoặc bằng toDate.", 400);
            }

            var config = await GetPeriodConfigAsync(periodId, cancellationToken);
            var rows = config.CouncilIds.Count == 0
                ? new List<CouncilCalendarProjection>()
                : await _db.Committees.AsNoTracking()
                    .Where(c => config.CouncilIds.Contains(c.CommitteeID) && c.DefenseDate >= rangeStart && c.DefenseDate <= rangeEnd)
                    .OrderBy(c => c.DefenseDate)
                    .ThenBy(c => c.Room)
                    .ThenBy(c => c.CommitteeCode)
                    .Select(c => new CouncilCalendarProjection
                    {
                        CouncilId = c.CommitteeID,
                        CommitteeCode = c.CommitteeCode ?? string.Empty,
                        Name = c.Name ?? c.CommitteeCode ?? string.Empty,
                        Room = c.Room,
                        DefenseDate = c.DefenseDate ?? period.StartDate,
                        Status = c.Status ?? string.Empty
                    })
                    .ToListAsync(cancellationToken);

            var grouped = rows.GroupBy(x => x.DefenseDate.Date).ToDictionary(g => g.Key, g => g.ToList());
            var days = new List<DefensePeriodCalendarDayDto>();

            for (var date = rangeStart; date <= rangeEnd; date = date.AddDays(1))
            {
                grouped.TryGetValue(date, out var councils);
                var items = councils == null
                    ? new List<DefensePeriodCalendarCouncilItemDto>()
                    : councils.Select(x => new DefensePeriodCalendarCouncilItemDto
                    {
                        CouncilId = x.CouncilId,
                        CommitteeCode = x.CommitteeCode,
                        Name = x.Name,
                        Room = x.Room,
                        DefenseDate = x.DefenseDate,
                        Status = x.Status
                    }).ToList();

                days.Add(new DefensePeriodCalendarDayDto
                {
                    Date = date,
                    CouncilCount = items.Count,
                    Councils = items
                });
            }

            return ApiResponse<List<DefensePeriodCalendarDayDto>>.SuccessResponse(days);
        }

        public async Task<ApiResponse<CouncilDraftDto>> GetCouncilDetailAsync(int periodId, int councilId, CancellationToken cancellationToken = default)
        {
            var config = await GetPeriodConfigAsync(periodId, cancellationToken);
            if (!config.CouncilIds.Contains(councilId))
            {
                return ApiResponse<CouncilDraftDto>.Fail("Hội đồng không thuộc đợt bảo vệ.", 404);
            }

            var detail = await BuildCouncilDtoAsync(periodId, councilId, cancellationToken);
            return ApiResponse<CouncilDraftDto>.SuccessResponse(detail);
        }

        public async Task<ApiResponse<List<TopicTagUsageDto>>> GetTopicTagsAsync(int periodId, string? tagCode = null, CancellationToken cancellationToken = default)
        {
            var scopedTopicCodes = await GetScopedTopicCodesAsync(periodId, cancellationToken);
            var normalizedTagCode = string.IsNullOrWhiteSpace(tagCode) ? null : tagCode.Trim();

            var query = _db.TopicTags.AsNoTracking()
                .Where(x => x.TopicCode != null && scopedTopicCodes.Contains(x.TopicCode!))
                .Join(_db.Tags.AsNoTracking(), tt => tt.TagID, tg => tg.TagID, (tt, tg) => new { tt, tg })
                .Join(_db.Topics.AsNoTracking(), x => x.tt.TopicCode, t => t.TopicCode, (x, t) => new { x.tt, x.tg, t })
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(normalizedTagCode))
            {
                query = query.Where(x => x.tg.TagCode == normalizedTagCode);
            }

            var rows = await query
                .OrderBy(x => x.tt.TopicCode)
                .ThenBy(x => x.tg.TagCode)
                .Select(x => new TopicTagUsageDto
                {
                    TopicCode = x.tt.TopicCode ?? string.Empty,
                    TopicTitle = x.t.Title,
                    TagCode = x.tg.TagCode,
                    TagName = x.tg.TagName,
                    CreatedAt = x.tt.CreatedAt
                })
                .ToListAsync(cancellationToken);

            return ApiResponse<List<TopicTagUsageDto>>.SuccessResponse(rows);
        }

        public async Task<ApiResponse<List<LecturerTagUsageDto>>> GetLecturerTagsAsync(int periodId, string? tagCode = null, CancellationToken cancellationToken = default)
        {
            var scopedLecturerCodes = await GetScopedLecturerCodesAsync(periodId, cancellationToken);
            var normalizedTagCode = string.IsNullOrWhiteSpace(tagCode) ? null : tagCode.Trim();

            var query = _db.LecturerTags.AsNoTracking()
                .Where(x => x.LecturerCode != null && scopedLecturerCodes.Contains(x.LecturerCode!))
                .Join(_db.Tags.AsNoTracking(), lt => lt.TagID, tg => tg.TagID, (lt, tg) => new { lt, tg })
                .GroupJoin(
                    _db.LecturerProfiles.AsNoTracking(),
                    x => x.lt.LecturerCode,
                    lp => lp.LecturerCode,
                    (x, profile) => new { x.lt, x.tg, LecturerName = profile.Select(p => p.FullName).FirstOrDefault() })
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(normalizedTagCode))
            {
                query = query.Where(x => x.tg.TagCode == normalizedTagCode);
            }

            var rows = await query
                .OrderBy(x => x.lt.LecturerCode)
                .ThenBy(x => x.tg.TagCode)
                .Select(x => new LecturerTagUsageDto
                {
                    LecturerCode = x.lt.LecturerCode ?? string.Empty,
                    LecturerName = string.IsNullOrWhiteSpace(x.LecturerName) ? (x.lt.LecturerCode ?? string.Empty) : x.LecturerName!,
                    TagCode = x.tg.TagCode,
                    TagName = x.tg.TagName,
                    AssignedAt = x.lt.AssignedAt
                })
                .ToListAsync(cancellationToken);

            return ApiResponse<List<LecturerTagUsageDto>>.SuccessResponse(rows);
        }

        public async Task<ApiResponse<List<CommitteeTagUsageDto>>> GetCommitteeTagsAsync(int periodId, string? tagCode = null, CancellationToken cancellationToken = default)
        {
            var config = await GetPeriodConfigAsync(periodId, cancellationToken);
            var normalizedTagCode = string.IsNullOrWhiteSpace(tagCode) ? null : tagCode.Trim();

            if (config.CouncilIds.Count == 0)
            {
                return ApiResponse<List<CommitteeTagUsageDto>>.SuccessResponse(new List<CommitteeTagUsageDto>());
            }

            var query = _db.CommitteeTags.AsNoTracking()
                .Where(x => config.CouncilIds.Contains(x.CommitteeID))
                .Join(_db.Tags.AsNoTracking(), ct => ct.TagID, tg => tg.TagID, (ct, tg) => new { ct, tg })
                .Join(_db.Committees.AsNoTracking(), x => x.ct.CommitteeID, c => c.CommitteeID, (x, c) => new { x.ct, x.tg, c.CommitteeCode })
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(normalizedTagCode))
            {
                query = query.Where(x => x.tg.TagCode == normalizedTagCode);
            }

            var rows = await query
                .OrderBy(x => x.ct.CommitteeID)
                .ThenBy(x => x.tg.TagCode)
                .Select(x => new CommitteeTagUsageDto
                {
                    CommitteeId = x.ct.CommitteeID,
                    CommitteeCode = x.CommitteeCode ?? x.ct.CommitteeCode,
                    TagCode = x.tg.TagCode,
                    TagName = x.tg.TagName,
                    CreatedAt = x.ct.CreatedAt
                })
                .ToListAsync(cancellationToken);

            return ApiResponse<List<CommitteeTagUsageDto>>.SuccessResponse(rows);
        }

        public async Task<ApiResponse<DefensePeriodTagOverviewDto>> GetTagOverviewAsync(int periodId, CancellationToken cancellationToken = default)
        {
            var topicTagRows = await GetTopicTagsAsync(periodId, null, cancellationToken);
            var lecturerTagRows = await GetLecturerTagsAsync(periodId, null, cancellationToken);
            var committeeTagRows = await GetCommitteeTagsAsync(periodId, null, cancellationToken);

            if (!topicTagRows.Success)
            {
                return ApiResponse<DefensePeriodTagOverviewDto>.Fail(topicTagRows.Message ?? "Không thể truy xuất topic tags.", topicTagRows.HttpStatusCode);
            }

            if (!lecturerTagRows.Success)
            {
                return ApiResponse<DefensePeriodTagOverviewDto>.Fail(lecturerTagRows.Message ?? "Không thể truy xuất lecturer tags.", lecturerTagRows.HttpStatusCode);
            }

            if (!committeeTagRows.Success)
            {
                return ApiResponse<DefensePeriodTagOverviewDto>.Fail(committeeTagRows.Message ?? "Không thể truy xuất committee tags.", committeeTagRows.HttpStatusCode);
            }

            var topicData = topicTagRows.Data ?? new List<TopicTagUsageDto>();
            var lecturerData = lecturerTagRows.Data ?? new List<LecturerTagUsageDto>();
            var committeeData = committeeTagRows.Data ?? new List<CommitteeTagUsageDto>();

            var topicMap = topicData.GroupBy(x => x.TagCode, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.Select(v => v.TopicCode).Distinct(StringComparer.OrdinalIgnoreCase).Count(), StringComparer.OrdinalIgnoreCase);
            var lecturerMap = lecturerData.GroupBy(x => x.TagCode, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.Select(v => v.LecturerCode).Distinct(StringComparer.OrdinalIgnoreCase).Count(), StringComparer.OrdinalIgnoreCase);
            var committeeMap = committeeData.GroupBy(x => x.TagCode, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.Select(v => v.CommitteeId).Distinct().Count(), StringComparer.OrdinalIgnoreCase);

            var allTagCodes = topicMap.Keys
                .Concat(lecturerMap.Keys)
                .Concat(committeeMap.Keys)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var tagNameMap = await _db.Tags.AsNoTracking()
                .Where(x => allTagCodes.Contains(x.TagCode))
                .ToDictionaryAsync(x => x.TagCode, x => x.TagName, StringComparer.OrdinalIgnoreCase, cancellationToken);

            var summary = allTagCodes
                .OrderBy(x => x)
                .Select(code => new TagSummaryDto
                {
                    TagCode = code,
                    TagName = tagNameMap.TryGetValue(code, out var name) ? name : code,
                    TopicCount = topicMap.TryGetValue(code, out var topicCount) ? topicCount : 0,
                    LecturerCount = lecturerMap.TryGetValue(code, out var lecturerCount) ? lecturerCount : 0,
                    CommitteeCount = committeeMap.TryGetValue(code, out var committeeCount) ? committeeCount : 0
                })
                .ToList();

            var dto = new DefensePeriodTagOverviewDto
            {
                DistinctTagCount = summary.Count,
                TopicTagLinks = topicData.Count,
                LecturerTagLinks = lecturerData.Count,
                CommitteeTagLinks = committeeData.Count,
                Tags = summary
            };

            return ApiResponse<DefensePeriodTagOverviewDto>.SuccessResponse(dto);
        }

        public async Task<ApiResponse<object>> GetLecturerCommitteesAsync(string lecturerCode, int? periodId = null, CancellationToken cancellationToken = default)
        {
            HashSet<int>? scopedCouncilIds = null;
            DefensePeriodConfigSnapshot? periodConfig = null;
            if (periodId.HasValue)
            {
                periodConfig = await GetPeriodConfigAsync(periodId.Value, cancellationToken);
                if (!periodConfig.CouncilListLocked)
                {
                    return ApiResponse<object>.SuccessResponse(new
                    {
                        LecturerCode = lecturerCode,
                        CouncilListLocked = false,
                        CouncilLockStatus = ToCouncilLockStatus(false),
                        Committees = new List<object>()
                    });
                }

                scopedCouncilIds = periodConfig.CouncilIds.ToHashSet();
            }

            var query = _db.CommitteeMembers.AsNoTracking()
                .Where(m => m.MemberLecturerCode == lecturerCode)
                .Join(_db.Committees.AsNoTracking(), m => m.CommitteeID, c => c.CommitteeID, (m, c) => new
                {
                    c.CommitteeID,
                    c.CommitteeCode,
                    c.Name,
                    c.Room,
                    c.DefenseDate,
                    c.Status,
                    Role = m.Role
                })
                .AsQueryable();

            if (scopedCouncilIds != null)
            {
                query = query.Where(x => scopedCouncilIds.Contains(x.CommitteeID));
            }

            var committees = await query.OrderBy(x => x.DefenseDate).ToListAsync(cancellationToken);
            var committeeIds = committees.Select(x => x.CommitteeID).Distinct().ToList();

            var assignmentRows = committeeIds.Count == 0
                ? new List<CommitteeAssignmentSnapshotRow>()
                : (await _db.DefenseAssignments.AsNoTracking()
                    .Where(x => x.CommitteeID.HasValue && committeeIds.Contains(x.CommitteeID.Value))
                    .OrderBy(x => x.Session)
                    .ThenBy(x => x.OrderIndex)
                    .ThenBy(x => x.AssignmentID)
                    .Select(x => new CommitteeAssignmentSnapshotRow
                    {
                        CommitteeId = x.CommitteeID!.Value,
                        AssignmentId = x.AssignmentID,
                        Session = x.Session,
                        ScheduledAt = x.ScheduledAt,
                        StartTime = x.StartTime,
                        EndTime = x.EndTime,
                        OrderIndex = x.OrderIndex
                    })
                    .ToListAsync(cancellationToken)).ToList();

            var assignmentsByCommittee = assignmentRows
                .GroupBy(x => x.CommitteeId)
                .ToDictionary(g => g.Key, g => g.ToList());

            var committeeMembers = committeeIds.Count == 0
                ? new List<CommitteeMemberSnapshotRow>()
                : (await _db.CommitteeMembers.AsNoTracking()
                    .Where(x => x.CommitteeID.HasValue && committeeIds.Contains(x.CommitteeID.Value))
                    .ToListAsync(cancellationToken))
                    .Select(x => new CommitteeMemberSnapshotRow
                    {
                        CommitteeId = x.CommitteeID!.Value,
                        MemberLecturerCode = x.MemberLecturerCode,
                        Role = x.Role,
                        IsOnline = ReadCommitteeMemberOnlineFlag(x)
                    })
                    .ToList();

            var memberLecturerCodes = committeeMembers
                .Where(x => !string.IsNullOrWhiteSpace(x.MemberLecturerCode))
                .Select(x => x.MemberLecturerCode!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var lecturerNameRows = memberLecturerCodes.Count == 0
                ? new List<LecturerNameSnapshotRow>()
                : (await _db.LecturerProfiles.AsNoTracking()
                    .Where(x => x.LecturerCode != null && memberLecturerCodes.Contains(x.LecturerCode))
                    .Select(x => new LecturerNameSnapshotRow
                    {
                        LecturerCode = x.LecturerCode!,
                        Name = x.FullName ?? x.LecturerCode!,
                        Degree = x.Degree,
                        Organization = x.Organization
                    })
                    .ToListAsync(cancellationToken)).ToList();

            var lecturerNameMap = lecturerNameRows
                .Where(x => !string.IsNullOrWhiteSpace(x.LecturerCode))
                .ToDictionary(x => x.LecturerCode, x => x.Name, StringComparer.OrdinalIgnoreCase);
            var lecturerDegreeMap = lecturerNameRows
                .Where(x => !string.IsNullOrWhiteSpace(x.LecturerCode))
                .ToDictionary(x => x.LecturerCode, x => x.Degree, StringComparer.OrdinalIgnoreCase);
            var lecturerOrganizationMap = lecturerNameRows
                .Where(x => !string.IsNullOrWhiteSpace(x.LecturerCode))
                .ToDictionary(x => x.LecturerCode, x => x.Organization, StringComparer.OrdinalIgnoreCase);

            var membersByCommittee = committeeMembers
                .GroupBy(x => x.CommitteeId)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select((member, index) =>
                    {
                        var code = member.MemberLecturerCode ?? string.Empty;
                        return new
                        {
                            MemberId = $"{g.Key}-{index + 1}",
                            LecturerCode = code,
                            LecturerName = !string.IsNullOrWhiteSpace(code) && lecturerNameMap.TryGetValue(code, out var lecturerName)
                                ? lecturerName
                                : code,
                            Degree = !string.IsNullOrWhiteSpace(code) && lecturerDegreeMap.TryGetValue(code, out var degree)
                                ? degree
                                : null,
                            Organization = !string.IsNullOrWhiteSpace(code) && lecturerOrganizationMap.TryGetValue(code, out var organization)
                                ? organization
                                : null,
                            Role = member.Role ?? string.Empty,
                            RoleCode = NormalizeCommitteeRole(member.Role),
                            IsOnline = member.IsOnline,
                            OnlineStatus = ToMemberOnlineStatus(member.IsOnline)
                        };
                    }).Cast<object>().ToList());

            var committeeDateMap = committees.ToDictionary(x => x.CommitteeID, x => x.DefenseDate);

            var scheduleByCommittee = assignmentsByCommittee
                .ToDictionary(
                    g => g.Key,
                    g =>
                    {
                        var orderedAssignments = g.Value
                            .OrderBy(x => x.Session ?? int.MaxValue)
                            .ThenBy(x => x.OrderIndex ?? int.MaxValue)
                            .ThenBy(x => x.ScheduledAt ?? DateTime.MaxValue)
                            .ThenBy(x => x.AssignmentId)
                            .ToList();

                        var first = orderedAssignments.First();
                        var startTime = ResolveScheduledTimeOfDay(first.ScheduledAt, first.StartTime, first.Session, periodConfig);
                        var endTime = first.EndTime;
                        if (!endTime.HasValue && startTime.HasValue)
                        {
                            endTime = startTime.Value.Add(TimeSpan.FromMinutes(90));
                        }

                        committeeDateMap.TryGetValue(g.Key, out var defenseDate);
                        var scheduledAt = ResolveScheduledAt(first.ScheduledAt, defenseDate, first.StartTime, first.Session, periodConfig);

                        return new
                        {
                            SessionCode = ToSessionCode(first.Session),
                            ScheduledAt = scheduledAt,
                            StartTime = startTime?.ToString(@"hh\:mm"),
                            EndTime = endTime?.ToString(@"hh\:mm"),
                            AssignmentCount = orderedAssignments.Count
                        };
                    });

            var enrichedCommittees = committees.Select(x =>
            {
                var normalizedRole = NormalizeCommitteeRole(x.Role);
                scheduleByCommittee.TryGetValue(x.CommitteeID, out var schedule);
                membersByCommittee.TryGetValue(x.CommitteeID, out var members);
                members ??= new List<object>();

                return new
                {
                    x.CommitteeID,
                    x.CommitteeCode,
                    x.Name,
                    x.Room,
                    DefenseDate = schedule?.ScheduledAt ?? x.DefenseDate,
                    Session = schedule?.SessionCode ?? DefenseSessionCodes.Morning,
                    StartTime = schedule?.StartTime,
                    EndTime = schedule?.EndTime,
                    AssignmentCount = schedule?.AssignmentCount ?? 0,
                    StudentCount = schedule?.AssignmentCount ?? 0,
                    MemberCount = members.Count,
                    Members = members,
                    Status = x.Status,
                    Role = x.Role,
                    NormalizedRole = normalizedRole,
                    AllowedScoringActions = BuildAllowedScoringActions(normalizedRole),
                    AllowedMinuteActions = BuildAllowedMinuteActions(normalizedRole),
                    AllowedRevisionActions = BuildAllowedRevisionActions(normalizedRole)
                };
            }).ToList();

            var councilListLocked = periodConfig?.CouncilListLocked ?? true;

            return ApiResponse<object>.SuccessResponse(new
            {
                LecturerCode = lecturerCode,
                CouncilListLocked = councilListLocked,
                CouncilLockStatus = ToCouncilLockStatus(councilListLocked),
                Committees = enrichedCommittees
            });
        }

        public async Task<ApiResponse<List<LecturerCommitteeMinuteDto>>> GetLecturerMinutesAsync(int committeeId, int? periodId = null, CancellationToken cancellationToken = default)
        {
            if (periodId.HasValue)
            {
                var config = await GetPeriodConfigAsync(periodId.Value, cancellationToken);
                if (!config.CouncilIds.Contains(committeeId))
                {
                    return ApiResponse<List<LecturerCommitteeMinuteDto>>.Fail("Hội đồng không thuộc đợt bảo vệ.", 404);
                }
            }

            var assignmentRows = await _db.DefenseAssignments.AsNoTracking()
                .Where(x => x.CommitteeID == committeeId)
                .Join(_db.Topics.AsNoTracking(), a => a.TopicCode, t => t.TopicCode, (a, t) => new { a, t })
                .OrderBy(x => x.a.Session)
                .ThenBy(x => x.a.OrderIndex)
                .ToListAsync(cancellationToken);

            if (assignmentRows.Count == 0)
            {
                return ApiResponse<List<LecturerCommitteeMinuteDto>>.SuccessResponse(new List<LecturerCommitteeMinuteDto>());
            }

            var assignmentIds = assignmentRows
                .Select(x => x.a.AssignmentID)
                .Distinct()
                .ToList();

            var minuteRows = await _db.DefenseMinutes.AsNoTracking()
                .Where(x => assignmentIds.Contains(x.AssignmentId))
                .OrderByDescending(x => x.LastUpdated)
                .ThenByDescending(x => x.Id)
                .ToListAsync(cancellationToken);

            var resultRows = await _db.DefenseResults.AsNoTracking()
                .Where(x => assignmentIds.Contains(x.AssignmentId))
                .OrderByDescending(x => x.LastUpdated)
                .ThenByDescending(x => x.Id)
                .ToListAsync(cancellationToken);

            var minuteByAssignmentId = minuteRows
                .GroupBy(x => x.AssignmentId)
                .ToDictionary(g => g.Key, g => g.First());

            var resultByAssignmentId = resultRows
                .GroupBy(x => x.AssignmentId)
                .ToDictionary(g => g.Key, g => g.First());

            var rows = assignmentRows.Select(x =>
            {
                minuteByAssignmentId.TryGetValue(x.a.AssignmentID, out var minute);
                resultByAssignmentId.TryGetValue(x.a.AssignmentID, out var result);
                var parsedMinute = ParseMinutePayload(minute?.ReviewerComments);

                return new LecturerCommitteeMinuteDto
                {
                    CommitteeId = x.a.CommitteeID ?? committeeId,
                    CommitteeCode = x.a.CommitteeCode ?? string.Empty,
                    AssignmentId = x.a.AssignmentID,
                    TopicCode = x.t.TopicCode,
                    TopicTitle = x.t.Title,
                    SummaryContent = minute != null ? minute.SummaryContent : null,
                    ReviewerComments = parsedMinute.PlainReviewerComments,
                    CommitteeMemberComments = parsedMinute.CommitteeMemberComments,
                    QnaDetails = minute != null ? minute.QnaDetails : null,
                    QuestionAnswers = parsedMinute.QuestionAnswers,
                    Strengths = minute != null ? minute.Strengths : null,
                    Weaknesses = minute != null ? minute.Weaknesses : null,
                    Recommendations = minute != null ? minute.Recommendations : null,
                    ChapterContents = parsedMinute.ChapterContents,
                    CouncilDiscussionConclusion = parsedMinute.CouncilDiscussionConclusion,
                    ChairConclusion = parsedMinute.ChairConclusion,
                    ReviewerSections = parsedMinute.ReviewerSections,
                    ScoreGvhd = x.t.Score ?? (result != null ? result.ScoreGvhd : null),
                    ScoreCt = result != null ? result.ScoreCt : null,
                    ScoreTk = result != null ? result.ScoreUvtk : null,
                    ScorePb = result != null ? result.ScoreUvpb : null,
                    FinalScore = result != null ? result.FinalScoreNumeric : null,
                    FinalGrade = result != null ? result.FinalScoreText : null,
                    LastUpdated = minute != null ? minute.LastUpdated : (result != null ? result.LastUpdated : null)
                };
            }).ToList();

            return ApiResponse<List<LecturerCommitteeMinuteDto>>.SuccessResponse(rows);
        }

        private sealed class ParsedMinutePayload
        {
            public string? PlainReviewerComments { get; set; }
            public List<MinuteChapterInputDto> ChapterContents { get; set; } = new();
            public string? CouncilDiscussionConclusion { get; set; }
            public string? ChairConclusion { get; set; }
            public string? CommitteeMemberComments { get; set; }
            public List<MinuteQuestionAnswerDto> QuestionAnswers { get; set; } = new();
            public ReviewerStructuredSectionsDto? ReviewerSections { get; set; }
        }

        private sealed class MinuteExtendedPayload
        {
            public List<MinuteChapterInputDto>? ChapterContents { get; set; }
            public string? CouncilDiscussionConclusion { get; set; }
            public string? ChairConclusion { get; set; }
            public string? CommitteeMemberComments { get; set; }
            public List<MinuteQuestionAnswerDto>? QuestionAnswers { get; set; }
            public ReviewerStructuredSectionsDto? ReviewerSections { get; set; }
        }

        private static ParsedMinutePayload ParseMinutePayload(string? rawReviewerComments)
        {
            var payload = new ParsedMinutePayload();
            if (string.IsNullOrWhiteSpace(rawReviewerComments))
            {
                return payload;
            }

            var marker = "[MINUTE_EXTENDED_JSON]";
            var text = rawReviewerComments.Trim();
            var markerIndex = text.IndexOf(marker, StringComparison.Ordinal);
            if (markerIndex < 0)
            {
                payload.PlainReviewerComments = text;
                return payload;
            }

            var plain = text[..markerIndex].TrimEnd();
            payload.PlainReviewerComments = string.IsNullOrWhiteSpace(plain) ? null : plain;

            var json = text[(markerIndex + marker.Length)..].Trim();
            if (string.IsNullOrWhiteSpace(json))
            {
                return payload;
            }

            try
            {
                var extended = JsonSerializer.Deserialize<MinuteExtendedPayload>(json);
                if (extended == null)
                {
                    return payload;
                }

                payload.ChapterContents = (extended.ChapterContents ?? new List<MinuteChapterInputDto>())
                    .Where(x => !string.IsNullOrWhiteSpace(x.ChapterTitle) || !string.IsNullOrWhiteSpace(x.Content))
                    .Select(x => new MinuteChapterInputDto
                    {
                        ChapterTitle = (x.ChapterTitle ?? string.Empty).Trim(),
                        Content = (x.Content ?? string.Empty).Trim()
                    })
                    .ToList();
                payload.CouncilDiscussionConclusion = extended.CouncilDiscussionConclusion;
                payload.ChairConclusion = extended.ChairConclusion;
                payload.CommitteeMemberComments = extended.CommitteeMemberComments;
                payload.QuestionAnswers = (extended.QuestionAnswers ?? new List<MinuteQuestionAnswerDto>())
                    .Where(x => !string.IsNullOrWhiteSpace(x.Question) || !string.IsNullOrWhiteSpace(x.Answer))
                    .Select(x => new MinuteQuestionAnswerDto
                    {
                        Question = (x.Question ?? string.Empty).Trim(),
                        Answer = (x.Answer ?? string.Empty).Trim()
                    })
                    .ToList();
                payload.ReviewerSections = extended.ReviewerSections;
            }
            catch
            {
                // Keep backward compatibility if stored payload is malformed.
            }

            return payload;
        }

        public async Task<ApiResponse<List<object>>> GetLecturerRevisionQueueAsync(string lecturerCode, int? periodId = null, CancellationToken cancellationToken = default)
        {
            HashSet<int>? scopedCouncilIds = null;
            if (periodId.HasValue)
            {
                var config = await GetPeriodConfigAsync(periodId.Value, cancellationToken);
                scopedCouncilIds = config.CouncilIds.ToHashSet();
            }

            var committeeQueue = await _db.CommitteeMembers.AsNoTracking()
                .Where(cm => cm.MemberLecturerCode == lecturerCode)
                .Join(_db.DefenseAssignments.AsNoTracking(), cm => cm.CommitteeID, da => da.CommitteeID, (cm, da) => da)
                .Where(da => scopedCouncilIds == null || (da.CommitteeID.HasValue && scopedCouncilIds.Contains(da.CommitteeID.Value)))
                .Join(_db.DefenseRevisions.AsNoTracking(), da => da.AssignmentID, rv => rv.AssignmentId, (da, rv) => new { da, rv })
                .Join(_db.Topics.AsNoTracking(), x => x.da.TopicCode, t => t.TopicCode, (x, t) => new
                {
                    x.rv.Id,
                    x.rv.AssignmentId,
                    x.rv.FinalStatus,
                    x.rv.RevisionFileUrl,
                    x.rv.LastUpdated,
                    t.TopicCode,
                    t.Title,
                    t.ProposerStudentCode
                })
                .Where(x => x.FinalStatus == RevisionFinalStatus.Pending)
                .OrderByDescending(x => x.LastUpdated)
                .ToListAsync(cancellationToken);

            var supervisorQueue = await _db.Topics.AsNoTracking()
                .Where(t => t.SupervisorLecturerCode == lecturerCode)
                .Join(_db.DefenseAssignments.AsNoTracking(), t => t.TopicCode, da => da.TopicCode, (t, da) => new { t, da })
                .Where(td => scopedCouncilIds == null || (td.da.CommitteeID.HasValue && scopedCouncilIds.Contains(td.da.CommitteeID.Value)))
                .Join(_db.DefenseRevisions.AsNoTracking(), td => td.da.AssignmentID, rv => rv.AssignmentId, (td, rv) => new
                {
                    rv.Id,
                    rv.AssignmentId,
                    rv.FinalStatus,
                    rv.RevisionFileUrl,
                    rv.LastUpdated,
                    td.t.TopicCode,
                    td.t.Title,
                    td.t.ProposerStudentCode
                })
                .Where(x => x.FinalStatus == RevisionFinalStatus.Pending)
                .OrderByDescending(x => x.LastUpdated)
                .ToListAsync(cancellationToken);

            var queue = committeeQueue
                .Concat(supervisorQueue)
                .GroupBy(x => x.Id)
                .Select(g => g.First())
                .OrderByDescending(x => x.LastUpdated)
                .Cast<object>()
                .ToList();

            return ApiResponse<List<object>>.SuccessResponse(queue);
        }

        public async Task<ApiResponse<StudentDefenseInfoDtoV2>> GetStudentDefenseInfoAsync(string studentCode, int? periodId = null, CancellationToken cancellationToken = default)
        {
            var normalizedStudentCode = string.IsNullOrWhiteSpace(studentCode) ? string.Empty : studentCode.Trim();
            var (resolvedStudentCode, resolvedStudentName, candidateIdentityCodes) =
                await ResolveStudentIdentityAsync(normalizedStudentCode, cancellationToken);

            var studentName = string.IsNullOrWhiteSpace(resolvedStudentName)
                ? resolvedStudentCode
                : resolvedStudentName;

            var normalizedStudentCodeSet = candidateIdentityCodes
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x.Trim().ToUpperInvariant())
                .Distinct(StringComparer.Ordinal)
                .ToList();

            if (normalizedStudentCodeSet.Count == 0 && !string.IsNullOrWhiteSpace(resolvedStudentCode))
            {
                normalizedStudentCodeSet.Add(resolvedStudentCode.ToUpperInvariant());
            }

            DefensePeriodConfigSnapshot? periodConfig = null;
            if (periodId.HasValue)
            {
                var periodExists = await PeriodExistsAsync(periodId.Value, cancellationToken);
                if (!periodExists)
                {
                    return ApiResponse<StudentDefenseInfoDtoV2>.Fail("Không tìm thấy đợt bảo vệ.", 404);
                }

                periodConfig = await GetPeriodConfigAsync(periodId.Value, cancellationToken);
            }

            var councilListLocked = periodConfig?.CouncilListLocked ?? true;

            var topicQuery = _db.Topics.AsNoTracking()
                .Where(t => t.ProposerStudentCode != null
                    && normalizedStudentCodeSet.Contains(t.ProposerStudentCode.ToUpper()));

            if (periodId.HasValue)
            {
                topicQuery = topicQuery.Where(t => t.DefenseTermId == periodId.Value);
            }

            var topic = await topicQuery
                .OrderByDescending(t => t.LastUpdated ?? t.CreatedAt)
                .ThenBy(t => t.TopicCode)
                .FirstOrDefaultAsync(cancellationToken);

            if (topic == null)
            {
                if (periodId.HasValue)
                {
                    return ApiResponse<StudentDefenseInfoDtoV2>.SuccessResponse(
                        new StudentDefenseInfoDtoV2
                        {
                            StudentCode = resolvedStudentCode,
                            StudentName = studentName,
                            CouncilListLocked = councilListLocked,
                            CouncilLockStatus = ToCouncilLockStatus(councilListLocked)
                        },
                        code: "DEFENSE_INFO_NOT_READY",
                        warnings: new List<ApiWarning>
                        {
                            new()
                            {
                                Type = "soft",
                                Code = "DEFENSE_INFO_NOT_READY",
                                Message = "Chưa có thông tin bảo vệ chi tiết cho sinh viên trong đợt hiện tại."
                            }
                        });
                }

                return ApiResponse<StudentDefenseInfoDtoV2>.Fail("Chưa có thông tin bảo vệ.", 404);
            }

            var assignmentQuery = _db.DefenseAssignments.AsNoTracking()
                .Where(a => a.TopicCode == topic.TopicCode);

            if (periodId.HasValue)
            {
                assignmentQuery = assignmentQuery.Where(a => a.DefenseTermId == periodId.Value);
            }

            var assignment = await assignmentQuery
                .OrderByDescending(a => a.LastUpdated)
                .ThenByDescending(a => a.CreatedAt)
                .ThenByDescending(a => a.AssignmentID)
                .FirstOrDefaultAsync(cancellationToken);

            if (assignment == null && periodId.HasValue && periodConfig?.CouncilIds.Count > 0)
            {
                assignment = await _db.DefenseAssignments.AsNoTracking()
                    .Where(a => a.TopicCode == topic.TopicCode
                        && a.CommitteeID.HasValue
                        && periodConfig.CouncilIds.Contains(a.CommitteeID.Value))
                    .OrderByDescending(a => a.LastUpdated)
                    .ThenByDescending(a => a.CreatedAt)
                    .ThenByDescending(a => a.AssignmentID)
                    .FirstOrDefaultAsync(cancellationToken);
            }

            Committee? committee = null;
            if (assignment != null)
            {
                var committeeQuery = _db.Committees.AsNoTracking()
                    .Where(c => (assignment.CommitteeID.HasValue && c.CommitteeID == assignment.CommitteeID.Value)
                        || (!string.IsNullOrWhiteSpace(assignment.CommitteeCode) && c.CommitteeCode == assignment.CommitteeCode));

                committee = await committeeQuery.FirstOrDefaultAsync(cancellationToken);
            }

            DefenseResult? result = null;
            if (assignment != null)
            {
                result = await _db.DefenseResults.AsNoTracking()
                    .FirstOrDefaultAsync(r => r.AssignmentId == assignment.AssignmentID, cancellationToken);
            }

            var warnings = new List<ApiWarning>();
            if (periodId.HasValue && periodConfig != null && !periodConfig.CouncilListLocked)
            {
                warnings.Add(new ApiWarning
                {
                    Type = "soft",
                    Code = "DEFENSE_INFO_NOT_READY",
                    Message = "Danh sách hội đồng chưa chốt, một số thông tin bảo vệ có thể đang được cập nhật."
                });
            }

            if (assignment == null)
            {
                warnings.Add(new ApiWarning
                {
                    Type = "soft",
                    Code = "DEFENSE_INFO_ASSIGNMENT_PENDING",
                    Message = "Đã có đề tài nhưng lịch bảo vệ chưa được phân công đầy đủ."
                });
            }
            else if (committee == null)
            {
                warnings.Add(new ApiWarning
                {
                    Type = "soft",
                    Code = "DEFENSE_INFO_COMMITTEE_PENDING",
                    Message = "Lịch bảo vệ đã có nhưng thông tin hội đồng/phòng đang được cập nhật."
                });
            }

            var scheduledAt = ResolveScheduledAt(
                assignment?.ScheduledAt,
                committee?.DefenseDate,
                assignment?.StartTime,
                assignment?.Session,
                periodConfig);

            var projection = new StudentDefenseInfoDtoV2
            {
                StudentCode = resolvedStudentCode,
                StudentName = studentName,
                TopicCode = topic.TopicCode,
                TopicTitle = topic.Title,
                CommitteeCode = committee?.CommitteeCode ?? assignment?.CommitteeCode,
                Room = committee?.Room,
                ScheduledAt = scheduledAt,
                Session = assignment?.Session,
                SessionCode = assignment?.Session.HasValue == true ? ToSessionCode(assignment.Session) : null,
                FinalScore = result != null ? result.FinalScoreNumeric : null,
                Grade = result != null ? result.FinalScoreText : null,
                CouncilListLocked = councilListLocked,
                CouncilLockStatus = ToCouncilLockStatus(councilListLocked)
            };

            return ApiResponse<StudentDefenseInfoDtoV2>.SuccessResponse(
                projection,
                code: warnings.Count > 0 ? "DEFENSE_INFO_PARTIAL" : null,
                warnings: warnings);
        }

        public async Task<ApiResponse<List<StudentNotificationDto>>> GetStudentNotificationsAsync(string studentCode, int? periodId = null, CancellationToken cancellationToken = default)
        {
            var query = _db.SyncAuditLogs.AsNoTracking()
                .Where(x => x.Action.Contains("PUBLISH") || x.Action.Contains("FINALIZE") || x.Action.Contains("SYNC"))
                .AsQueryable();

            if (periodId.HasValue)
            {
                var periodToken = $"period={periodId.Value}";
                query = query.Where(x => x.Records.Contains(periodToken));
            }

            var notices = await query.OrderByDescending(x => x.Timestamp)
                .Take(30)
                .Select(x => new StudentNotificationDto
                {
                    Type = x.Action,
                    Message = x.Records,
                    Timestamp = x.Timestamp
                })
                .ToListAsync(cancellationToken);

            return ApiResponse<List<StudentNotificationDto>>.SuccessResponse(notices);
        }

        public async Task<ApiResponse<List<object>>> GetStudentRevisionHistoryAsync(string studentCode, int? periodId = null, CancellationToken cancellationToken = default)
        {
            var normalizedStudentCode = string.IsNullOrWhiteSpace(studentCode) ? string.Empty : studentCode.Trim();
            var (_, _, candidateIdentityCodes) = await ResolveStudentIdentityAsync(normalizedStudentCode, cancellationToken);

            var normalizedStudentCodeSet = candidateIdentityCodes
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x.Trim().ToUpperInvariant())
                .Distinct(StringComparer.Ordinal)
                .ToList();

            if (normalizedStudentCodeSet.Count == 0 && !string.IsNullOrWhiteSpace(normalizedStudentCode))
            {
                normalizedStudentCodeSet.Add(normalizedStudentCode.ToUpperInvariant());
            }

            if (normalizedStudentCodeSet.Count == 0)
            {
                return ApiResponse<List<object>>.SuccessResponse(new List<object>());
            }

            HashSet<int>? scopedCouncilIds = null;
            if (periodId.HasValue)
            {
                var config = await GetPeriodConfigAsync(periodId.Value, cancellationToken);
                scopedCouncilIds = config.CouncilIds.ToHashSet();
            }

            var history = await _db.Topics.AsNoTracking()
                .Where(t => t.ProposerStudentCode != null
                    && normalizedStudentCodeSet.Contains(t.ProposerStudentCode.ToUpper()))
                .Join(_db.DefenseAssignments.AsNoTracking(), t => t.TopicCode, a => a.TopicCode, (t, a) => a)
                .Where(a => scopedCouncilIds == null || (a.CommitteeID.HasValue && scopedCouncilIds.Contains(a.CommitteeID.Value)))
                .Join(_db.DefenseRevisions.AsNoTracking(), a => a.AssignmentID, r => r.AssignmentId, (a, r) => new
                {
                    r.Id,
                    r.AssignmentId,
                    r.RevisionFileUrl,
                    r.FinalStatus,
                    r.IsCtApproved,
                    r.IsUvtkApproved,
                    r.IsGvhdApproved,
                    r.CreatedAt,
                    r.LastUpdated
                })
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync(cancellationToken);

            return ApiResponse<List<object>>.SuccessResponse(history.Cast<object>().ToList());
        }

        public async Task<ApiResponse<AnalyticsOverviewDto>> GetOverviewAsync(int periodId, CancellationToken cancellationToken = default)
        {
            var scoreRows = await GetScoreRowsAsync(periodId, cancellationToken);
            var numeric = scoreRows.Where(x => x.Score.HasValue).Select(x => x.Score!.Value).ToList();
            var total = scoreRows.Count;
            var highestRow = scoreRows.Where(x => x.Score.HasValue).OrderByDescending(x => x.Score).ThenBy(x => x.StudentCode).FirstOrDefault();
            var lowestRow = scoreRows.Where(x => x.Score.HasValue).OrderBy(x => x.Score).ThenBy(x => x.StudentCode).FirstOrDefault();

            var dto = new AnalyticsOverviewDto
            {
                TotalStudents = total,
                Average = numeric.Count == 0 ? 0 : Math.Round(numeric.Average(), 2),
                PassRate = total == 0 ? 0 : Math.Round((decimal)numeric.Count(x => x >= 4) * 100 / total, 2),
                Highest = numeric.Count == 0 ? 0 : numeric.Max(),
                Lowest = numeric.Count == 0 ? 0 : numeric.Min(),
                HighestStudentCode = highestRow?.StudentCode,
                HighestStudentName = highestRow?.StudentName,
                HighestTopicTitle = highestRow?.TopicTitle,
                LowestStudentCode = lowestRow?.StudentCode,
                LowestStudentName = lowestRow?.StudentName,
                LowestTopicTitle = lowestRow?.TopicTitle
            };

            return ApiResponse<AnalyticsOverviewDto>.SuccessResponse(dto);
        }

        public async Task<ApiResponse<List<CouncilAnalyticsDto>>> GetAnalyticsByCouncilAsync(int periodId, CancellationToken cancellationToken = default)
        {
            var scoreRows = await GetScoreRowsAsync(periodId, cancellationToken);
            var grouped = scoreRows.GroupBy(x => new { x.CouncilId, x.Room }).Select(g =>
            {
                var values = g.Where(r => r.Score.HasValue).Select(r => r.Score!.Value).ToList();
                return new CouncilAnalyticsDto
                {
                    CouncilId = g.Key.CouncilId,
                    CouncilCode = g.First().CouncilId.ToString(),
                    Room = g.Key.Room,
                    Count = g.Count(),
                    Avg = values.Count == 0 ? 0 : Math.Round(values.Average(), 2),
                    Max = values.Count == 0 ? 0 : values.Max(),
                    Min = values.Count == 0 ? 0 : values.Min()
                };
            }).OrderBy(x => x.CouncilId).ToList();

            return ApiResponse<List<CouncilAnalyticsDto>>.SuccessResponse(grouped);
        }

        public async Task<ApiResponse<AnalyticsDistributionDto>> GetDistributionAsync(int periodId, CancellationToken cancellationToken = default)
        {
            var rows = await GetScoreRowsAsync(periodId, cancellationToken);
            var vals = rows.Where(x => x.Score.HasValue).Select(x => x.Score!.Value).ToList();

            var distribution = new AnalyticsDistributionDto
            {
                Excellent = vals.Count(x => x >= 9),
                Good = vals.Count(x => x >= 7 && x < 9),
                Fair = vals.Count(x => x >= 5.5m && x < 7),
                Weak = vals.Count(x => x < 5.5m)
            };

            return ApiResponse<AnalyticsDistributionDto>.SuccessResponse(distribution);
        }

        public async Task<ApiResponse<List<ScoringMatrixRowDto>>> GetScoringMatrixAsync(int periodId, int? committeeId = null, bool isForLecturer = false, CancellationToken cancellationToken = default)
        {
            var assignments = await GetScopedAssignmentsAsync(periodId, committeeId, cancellationToken);
            if (assignments.Count == 0)
            {
                return ApiResponse<List<ScoringMatrixRowDto>>.SuccessResponse(new List<ScoringMatrixRowDto>());
            }

            var assignmentIds = assignments.Select(x => x.AssignmentID).ToList();
            var committeeIds = assignments.Where(x => x.CommitteeID.HasValue).Select(x => x.CommitteeID!.Value).Distinct().ToList();
            var topicCodes = assignments.Where(x => !string.IsNullOrWhiteSpace(x.TopicCode)).Select(x => x.TopicCode!).Distinct().ToList();
            var periodConfig = await GetPeriodConfigAsync(periodId, cancellationToken);
            var topicTagMap = await LoadTopicTagMapAsync(topicCodes, cancellationToken);

            var defenseDocuments = await _db.DefenseDocuments.AsNoTracking()
                .Where(x => assignmentIds.Contains(x.AssignmentId))
                .OrderByDescending(x => x.GeneratedAt)
                .ThenBy(x => x.DocumentId)
                .Select(x => new DefenseDocumentDto
                {
                    DocumentId = x.DocumentId,
                    AssignmentId = x.AssignmentId,
                    DocumentType = x.DocumentType,
                    FileName = x.DocumentType,
                    FileUrl = x.FileUrl,
                    MimeType = null,
                    GeneratedAt = x.GeneratedAt,
                    UploadedAt = x.GeneratedAt
                })
                .ToListAsync(cancellationToken);

            var defenseDocumentsByAssignment = defenseDocuments
                .GroupBy(x => x.AssignmentId)
                .ToDictionary(g => g.Key, g => g.ToList());

            var submissionCandidates = await _db.ProgressSubmissions.AsNoTracking()
                .Join(_db.ProgressMilestones.AsNoTracking(), ps => ps.MilestoneID, pm => pm.MilestoneID, (ps, pm) => new
                {
                    TopicCode = pm.TopicCode,
                    ps.SubmissionID,
                    ps.SubmittedAt,
                    ps.LastUpdated,
                    ps.ReportTitle
                })
                .Where(x => x.TopicCode != null && topicCodes.Contains(x.TopicCode))
                .ToListAsync(cancellationToken);

            var latestSubmissionByTopic = submissionCandidates
                .Where(x => !string.IsNullOrWhiteSpace(x.TopicCode))
                .GroupBy(x => x.TopicCode!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    g => g.Key,
                    g => g
                        .OrderByDescending(v => v.SubmittedAt ?? v.LastUpdated)
                        .ThenByDescending(v => v.SubmissionID)
                        .First(),
                    StringComparer.OrdinalIgnoreCase);

            var latestSubmissionIds = latestSubmissionByTopic.Values
                .Select(x => x.SubmissionID)
                .Distinct()
                .ToList();

            var submissionFiles = await _db.SubmissionFiles.AsNoTracking()
                .Where(x => latestSubmissionIds.Contains(x.SubmissionID))
                .Select(x => new
                {
                    x.FileID,
                    x.SubmissionID,
                    x.FileURL,
                    x.FileName,
                    x.MimeType,
                    x.UploadedAt
                })
                .ToListAsync(cancellationToken);

            var submissionFilesBySubmissionId = submissionFiles
                .GroupBy(x => x.SubmissionID)
                .ToDictionary(g => g.Key, g => g.ToList());

            var fallbackDocumentsByAssignment = new Dictionary<int, List<DefenseDocumentDto>>();
            foreach (var assignment in assignments)
            {
                if (string.IsNullOrWhiteSpace(assignment.TopicCode))
                {
                    continue;
                }

                if (!latestSubmissionByTopic.TryGetValue(assignment.TopicCode!, out var latestSubmission))
                {
                    continue;
                }

                if (!submissionFilesBySubmissionId.TryGetValue(latestSubmission.SubmissionID, out var files))
                {
                    continue;
                }

                var mappedFiles = files
                    .Select(file => new DefenseDocumentDto
                    {
                        DocumentId = file.FileID,
                        AssignmentId = assignment.AssignmentID,
                        DocumentType = "REPORT_SUBMISSION",
                        FileName = !string.IsNullOrWhiteSpace(file.FileName)
                            ? file.FileName
                            : (!string.IsNullOrWhiteSpace(latestSubmission.ReportTitle)
                                ? latestSubmission.ReportTitle
                                : $"Bao-cao-{latestSubmission.SubmissionID}"),
                        FileUrl = file.FileURL,
                        MimeType = file.MimeType,
                        GeneratedAt = file.UploadedAt ?? DateTime.UtcNow,
                        UploadedAt = file.UploadedAt
                    })
                    .ToList();

                fallbackDocumentsByAssignment[assignment.AssignmentID] = mappedFiles;
            }

            var committees = await _db.Committees.AsNoTracking()
                .Where(x => committeeIds.Contains(x.CommitteeID))
                .ToDictionaryAsync(x => x.CommitteeID, cancellationToken);

            var topics = await _db.Topics.AsNoTracking()
                .Where(x => topicCodes.Contains(x.TopicCode))
                .ToDictionaryAsync(x => x.TopicCode, cancellationToken);

            var supervisorCodes = topics.Values
                .Where(x => !string.IsNullOrWhiteSpace(x.SupervisorLecturerCode))
                .Select(x => x.SupervisorLecturerCode!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var supervisorNameRows = await _db.LecturerProfiles.AsNoTracking()
                .Where(x => x.LecturerCode != null && supervisorCodes.Contains(x.LecturerCode))
                .Select(x => new
                {
                    x.LecturerCode,
                    Name = x.FullName ?? x.LecturerCode,
                    x.Organization
                })
                .ToListAsync(cancellationToken);

            var supervisorNameMap = supervisorNameRows
                .Where(x => !string.IsNullOrWhiteSpace(x.LecturerCode))
                .ToDictionary(x => x.LecturerCode!, x => x.Name, StringComparer.OrdinalIgnoreCase);
            var lecturerOrganizationMap = supervisorNameRows
                .Where(x => !string.IsNullOrWhiteSpace(x.LecturerCode))
                .ToDictionary(x => x.LecturerCode!, x => x.Organization, StringComparer.OrdinalIgnoreCase);

            var studentCodes = topics.Values
                .Where(x => !string.IsNullOrWhiteSpace(x.ProposerStudentCode))
                .Select(x => x.ProposerStudentCode!)
                .Distinct()
                .ToList();

            var students = await _db.StudentProfiles.AsNoTracking()
                .Where(x => studentCodes.Contains(x.StudentCode))
                .ToListAsync(cancellationToken);

            var studentNames = students
                .Where(x => !string.IsNullOrWhiteSpace(x.StudentCode))
                .ToDictionary(x => x.StudentCode!, x => x.FullName ?? x.StudentCode, StringComparer.OrdinalIgnoreCase);

            var classIds = students
                .Where(x => x.ClassID.HasValue)
                .Select(x => x.ClassID!.Value)
                .Distinct()
                .ToList();

            var classes = classIds.Count == 0
                ? new List<Class>()
                : await _db.Classes.AsNoTracking()
                    .Where(x => classIds.Contains(x.ClassID))
                    .ToListAsync(cancellationToken);

            var classById = classes.ToDictionary(x => x.ClassID, x => x);

            var cohortCodes = classes
                .Where(x => !string.IsNullOrWhiteSpace(x.CohortCode))
                .Select(x => x.CohortCode!.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var cohorts = cohortCodes.Count == 0
                ? new List<Cohort>()
                : await _db.Cohorts.AsNoTracking()
                    .Where(x => x.CohortCode != null && cohortCodes.Contains(x.CohortCode))
                    .ToListAsync(cancellationToken);

            var cohortByCode = cohorts
                .Where(x => !string.IsNullOrWhiteSpace(x.CohortCode))
                .ToDictionary(x => x.CohortCode!, x => x, StringComparer.OrdinalIgnoreCase);

            var committeeMembers = await _db.CommitteeMembers.AsNoTracking()
                .Where(x => x.CommitteeID.HasValue && committeeIds.Contains(x.CommitteeID.Value))
                .Select(x => new { CommitteeId = x.CommitteeID!.Value, x.MemberLecturerCode, x.Role })
                .ToListAsync(cancellationToken);

            var committeeMemberCodes = committeeMembers
                .Where(x => !string.IsNullOrWhiteSpace(x.MemberLecturerCode))
                .Select(x => x.MemberLecturerCode!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var committeeMemberNameRows = committeeMemberCodes.Count == 0
                ? new List<LecturerNameSnapshotRow>()
                : await _db.LecturerProfiles.AsNoTracking()
                    .Where(x => x.LecturerCode != null && committeeMemberCodes.Contains(x.LecturerCode))
                    .Select(x => new LecturerNameSnapshotRow
                    {
                        LecturerCode = x.LecturerCode!,
                        Name = x.FullName ?? x.LecturerCode!
                    })
                    .ToListAsync(cancellationToken);

            var committeeMemberNameMap = committeeMemberNameRows
                .Where(x => !string.IsNullOrWhiteSpace(x.LecturerCode))
                .ToDictionary(x => x.LecturerCode, x => x.Name, StringComparer.OrdinalIgnoreCase);

            var memberCountMap = committeeMembers
                .GroupBy(x => x.CommitteeId)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(v => v.MemberLecturerCode).Where(v => !string.IsNullOrWhiteSpace(v)).Distinct(StringComparer.OrdinalIgnoreCase).Count());

            var scoreRows = await _db.DefenseScores.AsNoTracking()
                .Where(x => assignmentIds.Contains(x.AssignmentID))
                .Select(x => new { x.AssignmentID, x.Score, x.IsSubmitted, x.Comment, x.MemberLecturerCode })
                .ToListAsync(cancellationToken);

            var resultMap = await _db.DefenseResults.AsNoTracking()
                .Where(x => assignmentIds.Contains(x.AssignmentId))
                .ToDictionaryAsync(x => x.AssignmentId, cancellationToken);

            var scoreMap = scoreRows
                .GroupBy(x => x.AssignmentID)
                .ToDictionary(
                    g => g.Key,
                    g => new
                    {
                        SubmittedCount = g.Count(v => v.IsSubmitted),
                        SubmittedScores = g.Where(v => v.IsSubmitted).Select(v => v.Score).ToList()
                    });

            // Build per-assignment, per-role score lookup from DEFENSE_SCORES
            // This ensures individual scores are visible immediately after submission
            var roleScoreLookup = scoreRows
                .Where(x => x.IsSubmitted)
                .Select(x => 
                {
                    var committeeId = assignments.FirstOrDefault(a => a.AssignmentID == x.AssignmentID)?.CommitteeID;
                    var role = string.Empty;
                    if (committeeId.HasValue)
                    {
                        var member = committeeMembers.FirstOrDefault(m => m.CommitteeId == committeeId.Value && string.Equals(m.MemberLecturerCode, x.MemberLecturerCode, StringComparison.OrdinalIgnoreCase));
                        if (member != null)
                        {
                            role = NormalizeRole(member.Role ?? "");
                        }
                    }
                    return new { x.AssignmentID, x.Score, x.Comment, Role = role };
                })
                .Where(x => !string.IsNullOrWhiteSpace(x.Role))
                .GroupBy(x => x.AssignmentID)
                .ToDictionary(
                    g => g.Key,
                    g => g.GroupBy(v => v.Role)
                        .ToDictionary(
                            rg => rg.Key,
                            rg => rg.OrderByDescending(v => v.Score).First()));

            var rows = assignments
                .OrderBy(x => x.CommitteeID)
                .ThenBy(x => x.Session)
                .ThenBy(x => x.OrderIndex)
                .Select(assignment =>
                {
                    var cid = assignment.CommitteeID ?? 0;
                    committees.TryGetValue(cid, out var committee);
                    topics.TryGetValue(assignment.TopicCode ?? string.Empty, out var topic);
                    var topicCode = topic?.TopicCode ?? assignment.TopicCode ?? string.Empty;

                    var studentCode = topic?.ProposerStudentCode ?? string.Empty;
                    var studentProfile = students.FirstOrDefault(x => string.Equals(x.StudentCode, studentCode, StringComparison.OrdinalIgnoreCase));
                    var studentName = !string.IsNullOrWhiteSpace(studentCode) && studentNames.TryGetValue(studentCode, out var name)
                        ? name
                        : studentCode;

                    Class? studentClass = null;
                    Cohort? studentCohort = null;
                    if (studentProfile != null && studentProfile.ClassID.HasValue && classById.TryGetValue(studentProfile.ClassID.Value, out var resolvedClass))
                    {
                        studentClass = resolvedClass;
                        if (!string.IsNullOrWhiteSpace(resolvedClass.CohortCode) && cohortByCode.TryGetValue(resolvedClass.CohortCode.Trim(), out var resolvedCohort))
                        {
                            studentCohort = resolvedCohort;
                        }
                    }

                    var supervisorCode = topic?.SupervisorLecturerCode ?? string.Empty;
                    var supervisorName = !string.IsNullOrWhiteSpace(supervisorCode) && supervisorNameMap.TryGetValue(supervisorCode, out var lecturerName)
                        ? lecturerName
                        : supervisorCode;
                    var supervisorOrganization = !string.IsNullOrWhiteSpace(supervisorCode) && lecturerOrganizationMap.TryGetValue(supervisorCode, out var organization)
                        ? organization
                        : null;

                    var topicTags = topicTagMap.TryGetValue(topicCode, out var tags)
                        ? tags.ToList()
                        : new List<string>();

                    var requiredCount = memberCountMap.TryGetValue(cid, out var count) ? count : 0;
                    scoreMap.TryGetValue(assignment.AssignmentID, out var scoreBucket);
                    var submittedCount = scoreBucket?.SubmittedCount ?? 0;
                    var submittedScores = scoreBucket?.SubmittedScores ?? new List<decimal>();
                    decimal? variance = submittedScores.Count >= 2 ? submittedScores.Max() - submittedScores.Min() : null;

                    resultMap.TryGetValue(assignment.AssignmentID, out var defenseResult);
                    var isLocked = defenseResult?.IsLocked ?? false;
                    var topicSupervisorScore = topic?.Score;
                    var resolvedSupervisorScore = topicSupervisorScore ?? defenseResult?.ScoreGvhd;

                    var scheduledAt = ResolveScheduledAt(
                        assignment.ScheduledAt,
                        committee?.DefenseDate,
                        assignment.StartTime,
                        assignment.Session,
                        periodConfig);

                    var resolvedStartTime = ResolveScheduledTimeOfDay(
                        assignment.ScheduledAt,
                        assignment.StartTime,
                        assignment.Session,
                        periodConfig);

                    var resolvedEndTime = assignment.EndTime;
                    if (!resolvedEndTime.HasValue && resolvedStartTime.HasValue)
                    {
                        resolvedEndTime = resolvedStartTime.Value.Add(TimeSpan.FromMinutes(90));
                    }

                    var status = isLocked
                        ? "LOCKED"
                        : submittedCount >= requiredCount && requiredCount > 0
                            ? "WAITING_PUBLIC"
                            : submittedCount > 0
                                ? "IN_PROGRESS"
                                : "PENDING";

                    var committeeChairCode = committeeMembers
                        .FirstOrDefault(m => m.CommitteeId == cid && string.Equals(NormalizeRole(m.Role), "CT", StringComparison.OrdinalIgnoreCase))
                        ?.MemberLecturerCode;
                    var committeeSecretaryCode = committeeMembers
                        .FirstOrDefault(m => m.CommitteeId == cid && string.Equals(NormalizeRole(m.Role), "UVTK", StringComparison.OrdinalIgnoreCase))
                        ?.MemberLecturerCode;
                    var committeeReviewerCode = committeeMembers
                        .FirstOrDefault(m => m.CommitteeId == cid && string.Equals(NormalizeRole(m.Role), "UVPB", StringComparison.OrdinalIgnoreCase))
                        ?.MemberLecturerCode;

                    var committeeChairName = !string.IsNullOrWhiteSpace(committeeChairCode) && committeeMemberNameMap.TryGetValue(committeeChairCode, out var chairNameValue)
                        ? chairNameValue
                        : committeeChairCode;
                    var committeeSecretaryName = !string.IsNullOrWhiteSpace(committeeSecretaryCode) && committeeMemberNameMap.TryGetValue(committeeSecretaryCode, out var secretaryNameValue)
                        ? secretaryNameValue
                        : committeeSecretaryCode;
                    var committeeReviewerName = !string.IsNullOrWhiteSpace(committeeReviewerCode) && committeeMemberNameMap.TryGetValue(committeeReviewerCode, out var reviewerNameValue)
                        ? reviewerNameValue
                        : committeeReviewerCode;

                    var hasGeneratedDocuments = defenseDocumentsByAssignment.TryGetValue(assignment.AssignmentID, out var generatedDocuments)
                        && generatedDocuments.Count > 0;
                    var documents = hasGeneratedDocuments
                        ? generatedDocuments!
                        : (fallbackDocumentsByAssignment.TryGetValue(assignment.AssignmentID, out var fallbackDocuments)
                            ? fallbackDocuments
                            : new List<DefenseDocumentDto>());

                    // Score resolution:
                    // - When LOCKED (chốt): use DEFENSE_RESULTS (finalized, for export)
                    // - When NOT locked: show live scores for lecturers, hide for admins
                    roleScoreLookup.TryGetValue(assignment.AssignmentID, out var roleScores);

                    decimal? liveScoreCt, liveScoreTk, liveScorePb, liveScoreGvhd;
                    string? commentCt = null, commentTk = null, commentPb = null, commentGvhd = null;

                    if (isLocked && defenseResult != null)
                    {
                        // Locked: use finalized DEFENSE_RESULTS scores
                        liveScoreCt = defenseResult.ScoreCt;
                        liveScoreTk = defenseResult.ScoreUvtk;
                        liveScorePb = defenseResult.ScoreUvpb;
                        liveScoreGvhd = defenseResult.ScoreGvhd ?? resolvedSupervisorScore;
                        topicSupervisorScore = defenseResult.ScoreGvhd;
                        // Comments still come from DEFENSE_SCORES (DEFENSE_RESULTS doesn't store comments)
                        if (roleScores != null)
                        {
                            if (roleScores.TryGetValue("CT", out var ctc)) commentCt = ctc.Comment;
                            if (roleScores.TryGetValue("UVTK", out var tkc)) commentTk = tkc.Comment;
                            if (roleScores.TryGetValue("UVPB", out var pbc)) commentPb = pbc.Comment;
                            if (roleScores.TryGetValue("GVHD", out var gvhdc)) commentGvhd = gvhdc.Comment;
                        }
                    }
                    else if (isForLecturer)
                    {
                        // Not locked but for lecturer: use live DEFENSE_SCORES
                        liveScoreCt = roleScores != null && roleScores.TryGetValue("CT", out var ctRow) ? (decimal?)ctRow.Score : null;
                        liveScoreTk = roleScores != null && roleScores.TryGetValue("UVTK", out var tkRow) ? (decimal?)tkRow.Score : null;
                        liveScorePb = roleScores != null && roleScores.TryGetValue("UVPB", out var pbRow) ? (decimal?)pbRow.Score : null;
                        liveScoreGvhd = resolvedSupervisorScore
                            ?? (roleScores != null && roleScores.TryGetValue("GVHD", out var gvhdRow) ? (decimal?)gvhdRow.Score : null);
                        if (roleScores != null)
                        {
                            if (roleScores.TryGetValue("CT", out var ctc2)) commentCt = ctc2.Comment;
                            if (roleScores.TryGetValue("UVTK", out var tkc2)) commentTk = tkc2.Comment;
                            if (roleScores.TryGetValue("UVPB", out var pbc2)) commentPb = pbc2.Comment;
                            if (roleScores.TryGetValue("GVHD", out var gvhdc2)) commentGvhd = gvhdc2.Comment;
                        }
                    }
                    else
                    {
                        // Not locked and for admin: hide scores
                        liveScoreCt = null;
                        liveScoreTk = null;
                        liveScorePb = null;
                        liveScoreGvhd = null;
                        commentCt = null;
                        commentTk = null;
                        commentPb = null;
                        commentGvhd = null;
                        topicSupervisorScore = null;
                    }

                    decimal? liveFinalScore = null;
                    string? liveFinalGrade = null;
                    if (isLocked)
                    {
                        liveFinalScore = defenseResult?.FinalScoreNumeric;
                        liveFinalGrade = defenseResult?.FinalScoreText;
                    }
                    else if (isForLecturer)
                    {
                        var liveComponentScores = new List<decimal>();
                        if (liveScoreGvhd.HasValue) liveComponentScores.Add(liveScoreGvhd.Value);
                        if (liveScoreCt.HasValue) liveComponentScores.Add(liveScoreCt.Value);
                        if (liveScoreTk.HasValue) liveComponentScores.Add(liveScoreTk.Value);
                        if (liveScorePb.HasValue) liveComponentScores.Add(liveScorePb.Value);

                        if (liveComponentScores.Count >= 3)
                        {
                            liveFinalScore = Math.Round(liveComponentScores.Average(), 1);
                            
                            if (liveFinalScore >= 8.5m) liveFinalGrade = "Giỏi";
                            else if (liveFinalScore >= 7.0m) liveFinalGrade = "Khá";
                            else if (liveFinalScore >= 5.5m) liveFinalGrade = "Trung bình";
                            else if (liveFinalScore >= 4.0m) liveFinalGrade = "Yếu";
                            else liveFinalGrade = "Kém";
                        }
                    }
                    else
                    {
                        // Not locked and for admin: hide final scores
                        liveFinalScore = null;
                        liveFinalGrade = null;
                    }

                    return new ScoringMatrixRowDto
                    {
                        CommitteeId = cid,
                        CommitteeCode = committee?.CommitteeCode ?? assignment.CommitteeCode ?? string.Empty,
                        CommitteeName = committee?.Name ?? string.Empty,
                        Room = committee?.Room,
                        AssignmentId = assignment.AssignmentID,
                        AssignmentCode = assignment.AssignmentCode,
                        TopicCode = topicCode,
                        TopicTitle = topic?.Title ?? string.Empty,
                        SupervisorLecturerCode = supervisorCode,
                        SupervisorLecturerName = supervisorName,
                        CommitteeChairCode = committeeChairCode,
                        CommitteeChairName = committeeChairName,
                        CommitteeSecretaryCode = committeeSecretaryCode,
                        CommitteeSecretaryName = committeeSecretaryName,
                        CommitteeReviewerCode = committeeReviewerCode,
                        CommitteeReviewerName = committeeReviewerName,
                        Chair = committeeChairCode,
                        ChairName = committeeChairName,
                        Secretary = committeeSecretaryCode,
                        SecretaryName = committeeSecretaryName,
                        Reviewer = committeeReviewerCode,
                        ReviewerName = committeeReviewerName,
                        TopicTags = topicTags,
                        StudentCode = studentCode,
                        StudentName = studentName,
                        ClassName = studentClass?.ClassName ?? studentClass?.ClassCode,
                        CohortCode = studentCohort?.CohortCode ?? studentClass?.CohortCode,
                        SupervisorOrganization = supervisorOrganization,
                        Session = assignment.Session,
                        SessionCode = ToSessionCode(assignment.Session),
                        ScheduledAt = scheduledAt,
                        StartTime = resolvedStartTime?.ToString(@"hh\:mm"),
                        EndTime = resolvedEndTime?.ToString(@"hh\:mm"),
                        SubmittedCount = submittedCount,
                        RequiredCount = requiredCount,
                        IsLocked = isLocked,
                        ScoreGvhd = liveScoreGvhd,
                        ScoreCt = liveScoreCt,
                        ScoreTk = liveScoreTk,
                        ScorePb = liveScorePb,
                        CommentCt = commentCt,
                        CommentTk = commentTk,
                        CommentPb = commentPb,
                        CommentGvhd = commentGvhd,
                        TopicSupervisorScore = topicSupervisorScore,
                        FinalScore = liveFinalScore,
                        FinalGrade = liveFinalGrade,
                        Variance = variance,
                        Status = status,
                        DefenseDocuments = documents
                    };
                })
                .ToList();

            return ApiResponse<List<ScoringMatrixRowDto>>.SuccessResponse(rows);
        }

        public async Task<ApiResponse<List<ScoringProgressDto>>> GetScoringProgressAsync(int periodId, int? committeeId = null, CancellationToken cancellationToken = default)
        {
            var matrixResult = await GetScoringMatrixAsync(periodId, committeeId, isForLecturer: false, cancellationToken);
            if (!matrixResult.Success || matrixResult.Data == null)
            {
                return ApiResponse<List<ScoringProgressDto>>.Fail(matrixResult.Message ?? "Không thể lấy scoring matrix.", matrixResult.HttpStatusCode == 0 ? 400 : matrixResult.HttpStatusCode, matrixResult.Errors, matrixResult.Code);
            }

            var progress = matrixResult.Data
                .GroupBy(x => new { x.CommitteeId, x.CommitteeCode })
                .Select(g =>
                {
                    var total = g.Count();
                    var waiting = g.Count(x => x.Status == "WAITING_PUBLIC");
                    var locked = g.Count(x => x.Status == "LOCKED");
                    var completed = locked + waiting;

                    return new ScoringProgressDto
                    {
                        CommitteeId = g.Key.CommitteeId,
                        CommitteeCode = g.Key.CommitteeCode,
                        TotalAssignments = total,
                        CompletedAssignments = completed,
                        WaitingPublicAssignments = waiting,
                        ProgressPercent = total == 0 ? 0 : Math.Round((decimal)completed * 100m / total, 2)
                    };
                })
                .OrderBy(x => x.CommitteeId)
                .ToList();

            return ApiResponse<List<ScoringProgressDto>>.SuccessResponse(progress);
        }

        public async Task<ApiResponse<List<TopicFinalScoreProgressDto>>> GetTopicFinalScoreProgressAsync(int periodId, int? committeeId = null, CancellationToken cancellationToken = default)
        {
            var matrixResult = await GetScoringMatrixAsync(periodId, committeeId, isForLecturer: false, cancellationToken);
            if (!matrixResult.Success || matrixResult.Data == null)
            {
                return ApiResponse<List<TopicFinalScoreProgressDto>>.Fail(
                    matrixResult.Message ?? "Không thể lấy scoring matrix.",
                    matrixResult.HttpStatusCode == 0 ? 400 : matrixResult.HttpStatusCode,
                    matrixResult.Errors,
                    matrixResult.Code);
            }

            var progress = matrixResult.Data
                .GroupBy(x => new { x.CommitteeId, x.CommitteeCode })
                .Select(g =>
                {
                    var total = g.Count();
                    var scored = g.Count(x => x.FinalScore.HasValue);
                    return new TopicFinalScoreProgressDto
                    {
                        CommitteeId = g.Key.CommitteeId,
                        CommitteeCode = g.Key.CommitteeCode,
                        TotalTopics = total,
                        ScoredTopics = scored,
                        ProgressPercent = total == 0 ? 0 : Math.Round((decimal)scored * 100m / total, 2)
                    };
                })
                .OrderBy(x => x.CommitteeId)
                .ToList();

            return ApiResponse<List<TopicFinalScoreProgressDto>>.SuccessResponse(progress);
        }

        public async Task<ApiResponse<List<ScoringAlertDto>>> GetScoringAlertsAsync(int periodId, int? committeeId = null, CancellationToken cancellationToken = default)
        {
            const decimal varianceThreshold = 2.0m;

            var matrixResult = await GetScoringMatrixAsync(periodId, committeeId, isForLecturer: false, cancellationToken);
            if (!matrixResult.Success || matrixResult.Data == null)
            {
                return ApiResponse<List<ScoringAlertDto>>.Fail(matrixResult.Message ?? "Không thể lấy scoring matrix.", matrixResult.HttpStatusCode == 0 ? 400 : matrixResult.HttpStatusCode, matrixResult.Errors, matrixResult.Code);
            }

            var alerts = new List<ScoringAlertDto>();
            foreach (var row in matrixResult.Data)
            {
                if (row.Variance.HasValue && row.Variance.Value > varianceThreshold)
                {
                    alerts.Add(new ScoringAlertDto
                    {
                        AlertCode = DefenseUcErrorCodes.Scoring.VarianceAlert,
                        Type = "VARIANCE",
                        CommitteeId = row.CommitteeId,
                        CommitteeCode = row.CommitteeCode,
                        AssignmentId = row.AssignmentId,
                        AssignmentCode = row.AssignmentCode,
                        Message = $"Chênh lệch điểm vượt ngưỡng cho assignment {row.AssignmentCode}.",
                        Value = row.Variance,
                        Threshold = varianceThreshold
                    });
                }

                if (!row.IsLocked && row.RequiredCount > 0 && row.SubmittedCount < row.RequiredCount)
                {
                    alerts.Add(new ScoringAlertDto
                    {
                        AlertCode = DefenseUcErrorCodes.Scoring.IncompleteAlert,
                        Type = "INCOMPLETE",
                        CommitteeId = row.CommitteeId,
                        CommitteeCode = row.CommitteeCode,
                        AssignmentId = row.AssignmentId,
                        AssignmentCode = row.AssignmentCode,
                        Message = $"Assignment {row.AssignmentCode} chưa đủ điểm thành phần ({row.SubmittedCount}/{row.RequiredCount}).",
                        Value = row.SubmittedCount,
                        Threshold = row.RequiredCount
                    });
                }
            }

            return ApiResponse<List<ScoringAlertDto>>.SuccessResponse(alerts);
        }

        public async Task<ApiResponse<(byte[] Content, string FileName, string ContentType)>> BuildReportAsync(int periodId, string reportType, string format, int? councilId, CancellationToken cancellationToken = default)
        {
            var rows = await GetScoreRowsAsync(periodId, cancellationToken);
            if (councilId.HasValue)
            {
                rows = rows.Where(r => r.CouncilId == councilId.Value).ToList();
            }

            var normalizedFormat = (format ?? "word").Trim().ToLowerInvariant();
            if (normalizedFormat == "docx")
            {
                normalizedFormat = "word";
            }

            var normalizedType = NormalizeExportReportType(reportType);
            var safeType = string.IsNullOrWhiteSpace(normalizedType) ? "report" : normalizedType;
            var fileNameBase = councilId.HasValue ? $"{safeType}_{periodId}_c{councilId.Value}" : $"{safeType}_{periodId}";

            if (normalizedType == "scoreboard")
            {
                if (!councilId.HasValue)
                {
                    return ApiResponse<(byte[] Content, string FileName, string ContentType)>.Fail(
                        "Cần committeeId để xuất bảng điểm.",
                        400);
                }

                var committee = await _db.Committees.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.CommitteeID == councilId.Value, cancellationToken);

                if (committee == null)
                {
                    return ApiResponse<(byte[] Content, string FileName, string ContentType)>.Fail(
                        "Không tìm thấy hội đồng.",
                        404);
                }

                if (normalizedFormat != "word" && normalizedFormat != "pdf")
                {
                    return ApiResponse<(byte[] Content, string FileName, string ContentType)>.Fail(
                        "Định dạng không hợp lệ. Chỉ hỗ trợ word hoặc pdf.",
                        400);
                }

                if (_documentExportService == null)
                {
                    return ApiResponse<(byte[] Content, string FileName, string ContentType)>.Fail(
                        "Dịch vụ xuất tài liệu chưa được cấu hình.",
                        500);
                }

                // Fetch the defense assignment for this committee
                var assignment = await _db.DefenseAssignments.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.CommitteeID == councilId.Value, cancellationToken);

                // Fetch defense result for score data
                DefenseResult? defenseResult = null;
                if (assignment != null)
                {
                    defenseResult = await _db.DefenseResults.AsNoTracking()
                        .FirstOrDefaultAsync(x => x.AssignmentId == assignment.AssignmentID, cancellationToken);
                }

                // Fetch student and class information
                StudentProfile? student = null;
                Class? studentClass = null;
                if (assignment != null)
                {
                    var topic = await _db.Topics.AsNoTracking()
                        .FirstOrDefaultAsync(x => x.TopicCode == assignment.TopicCode, cancellationToken);

                    if (topic != null && !string.IsNullOrWhiteSpace(topic.ProposerStudentCode))
                    {
                        student = await _db.StudentProfiles.AsNoTracking()
                            .FirstOrDefaultAsync(x => x.StudentCode == topic.ProposerStudentCode.Trim(), cancellationToken);

                        if (student?.ClassID.HasValue == true)
                        {
                            studentClass = await _db.Classes.AsNoTracking()
                                .FirstOrDefaultAsync(x => x.ClassID == student.ClassID.Value, cancellationToken);
                        }
                    }
                }

                var reportData = new ReportData
                {
                    CommitteeCode = FirstNonEmpty(committee.CommitteeCode, committee.Name),
                    DefenseDate = FormatDate(committee.DefenseDate),
                    DefenseDay = committee.DefenseDate?.Day.ToString("00"),
                    DefenseMonth = committee.DefenseDate?.Month.ToString("00"),
                    DefenseYear = committee.DefenseDate?.Year.ToString(),
                    MajorCode = "CNTT",
                    MajorName = "Công nghệ thông tin",
                    ScoreCTNumber = defenseResult != null ? FormatScore(defenseResult.ScoreCt) : string.Empty,
                    ScoreCTText = defenseResult?.FinalScoreText,
                    ScoreCTNote = string.Empty,
                    ScorePBNumber = defenseResult != null ? FormatScore(defenseResult.ScoreUvpb) : string.Empty,
                    ScorePBText = defenseResult?.FinalScoreText,
                    ScorePBNote = string.Empty,
                    ScoreTKNumber = defenseResult != null ? FormatScore(defenseResult.ScoreUvtk) : string.Empty,
                    ScoreTKText = defenseResult?.FinalScoreText,
                    ScoreTKNote = string.Empty,
                    FinalScoreNumber = defenseResult != null ? FormatScore(defenseResult.FinalScoreNumeric) : string.Empty,
                    FinalScoreText = defenseResult?.FinalScoreText,
                    StudentCode = student?.StudentCode,
                    StudentFullName = student?.FullName,
                    ClassName = FirstNonEmpty(studentClass?.ClassName, studentClass?.ClassCode)
                };

                if (normalizedFormat == "pdf")
                {
                    var export = await _documentExportService.ExportPdfAsync(DocumentExportType.BangDiem, reportData, cancellationToken);
                    await TrackExportAsync(periodId, $"{fileNameBase}.pdf", "Success", cancellationToken);
                    return ApiResponse<(byte[] Content, string FileName, string ContentType)>.SuccessResponse((
                        export.Content,
                        $"{fileNameBase}.pdf",
                        export.ContentType));
                }

                var wordExport = await _documentExportService.ExportWordAsync(DocumentExportType.BangDiem, reportData, cancellationToken);
                await TrackExportAsync(periodId, $"{fileNameBase}.docx", "Success", cancellationToken);
                return ApiResponse<(byte[] Content, string FileName, string ContentType)>.SuccessResponse((
                    wordExport.Content,
                    $"{fileNameBase}.docx",
                    wordExport.ContentType));
            }

            if (normalizedFormat == "pdf")
            {
                var pdfBytes = BuildPdfContent(rows, normalizedType, councilId);
                await TrackExportAsync(periodId, $"{fileNameBase}.pdf", "Success", cancellationToken);
                return ApiResponse<(byte[] Content, string FileName, string ContentType)>.SuccessResponse((
                    pdfBytes,
                    $"{fileNameBase}.pdf",
                    "application/pdf"));
            }

            if (normalizedFormat == "xlsx")
            {
                var xlsxBytes = BuildXlsxContent(rows, normalizedType, councilId);
                await TrackExportAsync(periodId, $"{fileNameBase}.xlsx", "Success", cancellationToken);
                return ApiResponse<(byte[] Content, string FileName, string ContentType)>.SuccessResponse((
                    xlsxBytes,
                    $"{fileNameBase}.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            }

            if (normalizedFormat != "csv")
            {
                return ApiResponse<(byte[] Content, string FileName, string ContentType)>.Fail(
                    "Định dạng không hợp lệ. Chỉ hỗ trợ csv, xlsx hoặc pdf.",
                    400);
            }

            var csvBytes = BuildCsvContent(rows, normalizedType, councilId);
            await TrackExportAsync(periodId, $"{fileNameBase}.csv", "Success", cancellationToken);
            return ApiResponse<(byte[] Content, string FileName, string ContentType)>.SuccessResponse((
                csvBytes,
                $"{fileNameBase}.csv",
                "text/csv; charset=utf-8"));
        }

        public async Task<ApiResponse<(byte[] Content, string FileName, string ContentType)>> BuildReportAsync(
            int periodId,
            DefensePeriodReportExportRequestDto request,
            CancellationToken cancellationToken = default)
        {
            if (request == null)
            {
                return ApiResponse<(byte[] Content, string FileName, string ContentType)>.Fail("Thiếu payload export.", 400);
            }

            var normalizedType = NormalizeExportReportType(request.ReportType);
            var normalizedFormat = (request.Format ?? "xlsx").Trim().ToLowerInvariant();
            if (normalizedFormat == "excel")
            {
                normalizedFormat = "xlsx";
            }

            var rows = await GetScoreRowsAsync(periodId, cancellationToken);
            if (request.CouncilId.HasValue)
            {
                rows = rows.Where(r => r.CouncilId == request.CouncilId.Value).ToList();
            }

            if (normalizedType == "scoreboard")
            {
                return await BuildReportAsync(periodId, request.ReportType, request.Format ?? "xlsx", request.CouncilId, cancellationToken);
            }

            if (normalizedFormat != "xlsx" && normalizedFormat != "pdf" && normalizedFormat != "csv")
            {
                return ApiResponse<(byte[] Content, string FileName, string ContentType)>.Fail(
                    "Định dạng export chỉ hỗ trợ: xlsx, pdf, csv.",
                    400);
            }

            var fileStem = BuildFlexibleReportStem(normalizedType, periodId, request.CouncilId);
            var selectedFields = request.SelectedFields ?? new List<string>();

            return normalizedFormat switch
            {
                "xlsx" => ApiResponse<(byte[] Content, string FileName, string ContentType)>.SuccessResponse((
                    BuildFlexibleXlsxContent(rows, normalizedType, selectedFields),
                    $"{fileStem}.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")),
                "pdf" => ApiResponse<(byte[] Content, string FileName, string ContentType)>.SuccessResponse((
                    BuildFlexiblePdfContent(rows, normalizedType, selectedFields),
                    $"{fileStem}.pdf",
                    "application/pdf")),
                _ => ApiResponse<(byte[] Content, string FileName, string ContentType)>.SuccessResponse((
                    BuildFlexibleCsvContent(rows, normalizedType, selectedFields),
                    $"{fileStem}.csv",
                    "text/csv; charset=utf-8"))
            };
        }

        public async Task<ApiResponse<List<ExportHistoryDto>>> GetExportHistoryAsync(int periodId, CancellationToken cancellationToken = default)
        {
            var rows = await _db.ExportFiles.AsNoTracking()
                .Where(x => x.TermId == periodId)
                .OrderByDescending(x => x.CreatedAt)
                .Take(200)
                .Select(x => new ExportHistoryDto
                {
                    ExportFileId = x.ExportFileId,
                    FileCode = x.FileCode,
                    TermId = x.TermId,
                    Status = x.Status,
                    FileUrl = x.FileUrl,
                    CreatedAt = x.CreatedAt
                })
                .ToListAsync(cancellationToken);

            return ApiResponse<List<ExportHistoryDto>>.SuccessResponse(rows);
        }

        public async Task<ApiResponse<List<PublishHistoryDto>>> GetPublishHistoryAsync(int periodId, CancellationToken cancellationToken = default)
        {
            var periodToken = $"period={periodId}";
            var rows = await _db.SyncAuditLogs.AsNoTracking()
                .Where(x => x.Action.Contains("PUBLISH") && x.Records.Contains(periodToken))
                .OrderByDescending(x => x.Timestamp)
                .Take(200)
                .Select(x => new PublishHistoryDto
                {
                    SyncAuditLogId = x.SyncAuditLogId,
                    Action = x.Action,
                    Result = x.Result,
                    Records = x.Records,
                    Timestamp = x.Timestamp
                })
                .ToListAsync(cancellationToken);

            return ApiResponse<List<PublishHistoryDto>>.SuccessResponse(rows);
        }

        public async Task<ApiResponse<List<CouncilAuditHistoryDto>>> GetCouncilAuditHistoryAsync(int periodId, int? councilId, CancellationToken cancellationToken = default)
        {
            var actionSet = new[]
            {
                "CREATE_COUNCIL",
                "UPDATE_COUNCIL",
                "DELETE_COUNCIL",
                "GENERATE_COUNCILS",
                "FINALIZE"
            };

            var periodToken = $"period={periodId}";
            var query = _db.SyncAuditLogs.AsNoTracking()
                .Where(x => actionSet.Contains(x.Action) && x.Records.Contains(periodToken));

            if (councilId.HasValue)
            {
                var councilToken = $"council={councilId.Value}";
                query = query.Where(x => x.Records.Contains(councilToken));
            }

            var rows = await query
                .OrderByDescending(x => x.Timestamp)
                .Take(300)
                .Select(x => new CouncilAuditHistoryDto
                {
                    SyncAuditLogId = x.SyncAuditLogId,
                    Action = x.Action,
                    Result = x.Result,
                    Records = x.Records,
                    Timestamp = x.Timestamp
                })
                .ToListAsync(cancellationToken);

            return ApiResponse<List<CouncilAuditHistoryDto>>.SuccessResponse(rows);
        }

        public async Task<ApiResponse<List<RevisionAuditTrailDto>>> GetRevisionAuditTrailAsync(int periodId, int revisionId, CancellationToken cancellationToken = default)
        {
            var periodPathToken = $"/defense-periods/{periodId}/";
            var revisionToken = $"\"RevisionId\":{revisionId}";
            var revisionTokenAlt = $"revisionId={revisionId}";

            var rows = await _db.SyncAuditLogs.AsNoTracking()
                .Where(x => x.Action.Contains("REVISION")
                    && (x.Records.Contains(periodPathToken) || x.Records.Contains($"period={periodId}"))
                    && (x.Records.Contains(revisionToken) || x.Records.Contains(revisionTokenAlt)))
                .OrderByDescending(x => x.Timestamp)
                .Take(300)
                .Select(x => new RevisionAuditTrailDto
                {
                    SyncAuditLogId = x.SyncAuditLogId,
                    Action = x.Action,
                    Result = x.Result,
                    Records = x.Records,
                    Timestamp = x.Timestamp
                })
                .ToListAsync(cancellationToken);

            return ApiResponse<List<RevisionAuditTrailDto>>.SuccessResponse(rows);
        }

        private async Task<List<ScoreRowData>> GetScoreRowsAsync(int periodId, CancellationToken cancellationToken)
        {
            var config = await GetPeriodConfigAsync(periodId, cancellationToken);
            if (config.CouncilIds.Count == 0)
            {
                return new List<ScoreRowData>();
            }

            return await _db.DefenseAssignments.AsNoTracking()
                .Where(a => a.CommitteeID.HasValue && config.CouncilIds.Contains(a.CommitteeID.Value))
                .Join(_db.Topics.AsNoTracking(), a => a.TopicCode, t => t.TopicCode, (a, t) => new { a, t })
                .Join(_db.Committees.AsNoTracking(), at => at.a.CommitteeID, c => c.CommitteeID, (at, c) => new { at.a, at.t, c })
                .GroupJoin(_db.DefenseResults.AsNoTracking(), x => x.a.AssignmentID, r => r.AssignmentId, (x, r) => new { x, result = r.FirstOrDefault() })
                .Select(x => new ScoreRowData
                {
                    CouncilId = x.x.c.CommitteeID,
                    CommitteeCode = x.x.c.CommitteeCode ?? string.Empty,
                    Room = x.x.c.Room,
                    DefenseDate = x.x.c.DefenseDate,
                    Session = ToSessionCode(x.x.a.Session),
                    StudentCode = x.x.t.ProposerStudentCode ?? string.Empty,
                    StudentName = _db.StudentProfiles.Where(s => s.StudentCode == x.x.t.ProposerStudentCode).Select(s => s.FullName).FirstOrDefault() ?? (x.x.t.ProposerStudentCode ?? string.Empty),
                    TopicTitle = x.x.t.Title,
                    Score = x.result != null ? x.result.FinalScoreNumeric : null,
                    Grade = x.result != null ? x.result.FinalScoreText : null
                })
                .ToListAsync(cancellationToken);
        }

        public async Task<ApiResponse<CommitteeRosterExportSnapshotDto>> GetCommitteeRosterExportAsync(int periodId, CancellationToken cancellationToken = default)
        {
            var result = new CommitteeRosterExportSnapshotDto
            {
                ExportedAt = DateTime.Now,
                Rows = new List<CommitteeRosterRowDto>()
            };

            var councils = await _db.Committees.AsNoTracking()
                .Where(c => c.DefenseTermId == periodId)
                .OrderBy(c => c.CommitteeID)
                .ToListAsync(cancellationToken);

            if (councils.Count == 0)
                return ApiResponse<CommitteeRosterExportSnapshotDto>.SuccessResponse(result);

            var councilIds = councils.Select(c => c.CommitteeID).ToList();
            result.TotalCommittees = councils.Count;

            var assignments = await _db.DefenseAssignments.AsNoTracking()
                .Where(a => a.CommitteeID.HasValue && councilIds.Contains(a.CommitteeID.Value))
                .ToListAsync(cancellationToken);

            var topicCodes = assignments.Select(a => a.TopicCode).Where(c => !string.IsNullOrEmpty(c)).Distinct().ToList();
            var topics = topicCodes.Count == 0
                ? new Dictionary<string, Topic>()
                : await _db.Topics.AsNoTracking()
                    .Where(t => topicCodes.Contains(t.TopicCode))
                    .ToDictionaryAsync(t => t.TopicCode ?? "", t => t, cancellationToken);

            var studentCodes = topics.Values.Select(t => t.ProposerStudentCode)
                .Where(c => !string.IsNullOrEmpty(c)).Distinct().ToList();
            var students = studentCodes.Count == 0 ? new Dictionary<string, StudentProfile>()
                : await _db.StudentProfiles.AsNoTracking()
                    .Where(s => studentCodes.Contains(s.StudentCode))
                    .ToDictionaryAsync(s => s.StudentCode ?? "", s => s, cancellationToken);

            var lecturerCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var topic in topics.Values)
                if (!string.IsNullOrWhiteSpace(topic.SupervisorLecturerCode))
                    lecturerCodes.Add(topic.SupervisorLecturerCode.Trim());

            var members = await _db.CommitteeMembers.AsNoTracking()
                .Where(m => m.CommitteeID.HasValue && councilIds.Contains(m.CommitteeID.Value))
                .ToListAsync(cancellationToken);

            foreach (var member in members)
            {
                if (!string.IsNullOrWhiteSpace(member.MemberLecturerCode))
                {
                    lecturerCodes.Add(member.MemberLecturerCode.Trim());
                }
            }

            var lecturers = lecturerCodes.Count == 0 ? new Dictionary<string, LecturerProfile>()
                : await _db.LecturerProfiles.AsNoTracking()
                    .Where(l => l.LecturerCode != null && lecturerCodes.Contains(l.LecturerCode))
                    .ToDictionaryAsync(l => l.LecturerCode ?? "", l => l, StringComparer.OrdinalIgnoreCase, cancellationToken);

            int rowNumber = 1;
            var memberDict = members.GroupBy(m => m.CommitteeID!.Value).ToDictionary(g => g.Key, g => g.ToList());

            foreach (var committee in councils)
            {
                var committeeAssignments = assignments
                    .Where(a => a.CommitteeID == committee.CommitteeID)
                    .OrderBy(a => a.Session).ThenBy(a => a.AssignmentID).ToList();

                if (!memberDict.TryGetValue(committee.CommitteeID, out var committeeMembers))
                    committeeMembers = new List<ThesisManagement.Api.Models.CommitteeMember>();

                var chair = committeeMembers.FirstOrDefault(m => m.Role?.ToUpper() == "CT");
                var secretary = committeeMembers.FirstOrDefault(m => m.Role?.ToUpper() == "UVTK");
                var reviewer = committeeMembers.FirstOrDefault(m => m.Role?.ToUpper() == "UVPB");

                foreach (var assignment in committeeAssignments)
                {
                    var topic = assignment.TopicCode != null && topics.TryGetValue(assignment.TopicCode, out var t) ? t : null;
                    var studentCode = topic?.ProposerStudentCode;
                    var student = studentCode != null && students.TryGetValue(studentCode, out var s) ? s : null;
                    var advisorCode = topic?.SupervisorLecturerCode;
                    var advisorDisplay = advisorCode != null && lecturers.TryGetValue(advisorCode, out var adv)
                        ? $"{adv.Degree} {adv.FullName}".Trim() : advisorCode;

                    result.Rows.Add(new CommitteeRosterRowDto
                    {
                        RowNumber = rowNumber++,
                        StudentCode = studentCode,
                        StudentFullName = student?.FullName,
                        AdvisorDisplay = advisorDisplay,
                        CommitteeCode = committee.CommitteeCode,
                        ChairDisplay = GetLecturerDisplay(chair, lecturers),
                        ChairWorkplace = GetLecturerWorkplace(chair, lecturers),
                        SecretaryDisplay = GetLecturerDisplay(secretary, lecturers),
                        SecretaryWorkplace = GetLecturerWorkplace(secretary, lecturers),
                        ReviewerDisplay = GetLecturerDisplay(reviewer, lecturers),
                        ReviewerWorkplace = GetLecturerWorkplace(reviewer, lecturers),
                        DefenseSession = assignment.Session.HasValue ? (assignment.Session.Value == 1 ? "Sáng" : "Chiều") : "",
                        DefenseDate = committee.DefenseDate?.ToString("dd/MM/yyyy") ?? ""
                    });
                }
            }

            return ApiResponse<CommitteeRosterExportSnapshotDto>.SuccessResponse(result);
        }

        private string? GetLecturerDisplay(ThesisManagement.Api.Models.CommitteeMember? member, Dictionary<string, LecturerProfile> lecturers)
        {
            if (member == null || string.IsNullOrWhiteSpace(member.MemberLecturerCode)) return null;
            return lecturers.TryGetValue(member.MemberLecturerCode, out var l)
                ? $"{l.Degree} {l.FullName}".Trim() : member.MemberLecturerCode;
        }

        private string? GetLecturerWorkplace(ThesisManagement.Api.Models.CommitteeMember? member, Dictionary<string, LecturerProfile> lecturers)
        {
            if (member == null || string.IsNullOrWhiteSpace(member.MemberLecturerCode)) return null;
            return lecturers.TryGetValue(member.MemberLecturerCode, out var l) ? l.Organization : null;
        }

        private async Task<List<DefenseAssignment>> GetScopedAssignmentsAsync(int periodId, int? committeeId, CancellationToken cancellationToken)
        {
            var config = await GetPeriodConfigAsync(periodId, cancellationToken);
            if (config.CouncilIds.Count == 0)
            {
                return new List<DefenseAssignment>();
            }

            var scopedIds = config.CouncilIds;
            if (committeeId.HasValue)
            {
                if (!scopedIds.Contains(committeeId.Value))
                {
                    return new List<DefenseAssignment>();
                }

                scopedIds = new List<int> { committeeId.Value };
            }

            return await _db.DefenseAssignments.AsNoTracking()
                .Where(x => x.CommitteeID.HasValue && scopedIds.Contains(x.CommitteeID.Value))
                .ToListAsync(cancellationToken);
        }

        private static string NormalizeExportReportType(string? reportType)
        {
            var normalized = (reportType ?? string.Empty).Trim().ToLowerInvariant();
            return normalized switch
            {
                "form-1" => "scoreboard",
                "scoreboard" => "scoreboard",
                "minutes" => "minutes",
                "review" => "review",
                "council-summary" => "council-summary",
                "final-term" => "final-term",
                "sync-errors" => "sync-errors",
                _ => normalized
            };
        }

        private static string FirstNonEmpty(params string?[] values)
        {
            foreach (var value in values)
            {
                if (!string.IsNullOrWhiteSpace(value))
                {
                    return value.Trim();
                }
            }

            return string.Empty;
        }

        private static string FormatDate(DateTime? value)
        {
            return value.HasValue ? value.Value.ToString("dd/MM/yyyy") : string.Empty;
        }

        private static string FormatScore(decimal? score)
        {
            return score.HasValue ? score.Value.ToString("0.##") : string.Empty;
        }

        private static string BuildReviewNote(ScoreRowData row)
        {
            if (!row.Score.HasValue)
            {
                return "Chưa đủ điểm thành phần để nhận xét tổng kết.";
            }

            if (row.Score.Value >= 8.5m)
            {
                return "Đề tài đạt chất lượng tốt, trình bày rõ ràng.";
            }

            if (row.Score.Value >= 7m)
            {
                return "Đề tài đạt yêu cầu, cần hoàn thiện thêm phần thảo luận.";
            }

            if (row.Score.Value >= 5m)
            {
                return "Đề tài đạt mức trung bình, cần chỉnh sửa trước khi lưu hồ sơ.";
            }

            return "Đề tài cần bổ sung nội dung và bảo vệ lại theo góp ý hội đồng.";
        }

        private static byte[] BuildCsvContent(List<ScoreRowData> rows, string reportType, int? councilId)
        {
            var normalizedType = NormalizeExportReportType(reportType);
            var sb = new StringBuilder();

            if (normalizedType == "council-summary")
            {
                sb.AppendLine("CouncilId,Room,StudentCount,Avg,Max,Min");
                foreach (var row in BuildCouncilSummary(rows))
                {
                    sb.AppendLine(string.Join(",",
                        EscapeCsv(row.CouncilId.ToString()),
                        EscapeCsv(row.Room),
                        EscapeCsv(row.StudentCount.ToString()),
                        EscapeCsv(row.Avg.ToString("0.0")),
                        EscapeCsv(row.Max.ToString("0.0")),
                        EscapeCsv(row.Min.ToString("0.0"))));
                }
            }
            else if (normalizedType == "minutes")
            {
                sb.AppendLine("CouncilId,Room,Session,StudentCode,StudentName,TopicTitle,Result");
                foreach (var row in rows.OrderBy(r => r.CouncilId).ThenBy(r => r.Session).ThenBy(r => r.StudentCode))
                {
                    var result = row.Score.HasValue ? "Đã thông qua" : "Chờ chốt";
                    sb.AppendLine(string.Join(",",
                        EscapeCsv(row.CouncilId.ToString()),
                        EscapeCsv(row.Room ?? string.Empty),
                        EscapeCsv(row.Session),
                        EscapeCsv(row.StudentCode),
                        EscapeCsv(row.StudentName),
                        EscapeCsv(row.TopicTitle),
                        EscapeCsv(result)));
                }
            }
            else if (normalizedType == "review")
            {
                sb.AppendLine("CouncilId,StudentCode,StudentName,TopicTitle,Score,Grade,Review");
                foreach (var row in rows.OrderBy(r => r.CouncilId).ThenBy(r => r.StudentCode))
                {
                    sb.AppendLine(string.Join(",",
                        EscapeCsv(row.CouncilId.ToString()),
                        EscapeCsv(row.StudentCode),
                        EscapeCsv(row.StudentName),
                        EscapeCsv(row.TopicTitle),
                        EscapeCsv(row.Score?.ToString("0.0") ?? string.Empty),
                        EscapeCsv(row.Grade ?? string.Empty),
                        EscapeCsv(BuildReviewNote(row))));
                }
            }
            else
            {
                sb.AppendLine("CouncilId,Room,Session,StudentCode,StudentName,TopicTitle,Score,Grade");
                foreach (var row in rows.OrderBy(r => r.CouncilId).ThenBy(r => r.Session).ThenBy(r => r.StudentCode))
                {
                    sb.AppendLine(string.Join(",",
                        EscapeCsv(row.CouncilId.ToString()),
                        EscapeCsv(row.Room ?? string.Empty),
                        EscapeCsv(row.Session),
                        EscapeCsv(row.StudentCode),
                        EscapeCsv(row.StudentName),
                        EscapeCsv(row.TopicTitle),
                        EscapeCsv(row.Score?.ToString("0.0") ?? string.Empty),
                        EscapeCsv(row.Grade ?? string.Empty)));
                }

                if (normalizedType == "final-term")
                {
                    var numeric = rows.Where(r => r.Score.HasValue).Select(r => r.Score!.Value).ToList();
                    if (numeric.Count > 0)
                    {
                        sb.AppendLine();
                        sb.AppendLine($"Highest,{numeric.Max():0.0}");
                        sb.AppendLine($"Lowest,{numeric.Min():0.0}");
                    }
                }

                if (normalizedType == "form-1" && councilId.HasValue)
                {
                    sb.AppendLine();
                    sb.AppendLine($"Council,{EscapeCsv(councilId.Value.ToString())}");
                }
            }

            return Encoding.UTF8.GetBytes(sb.ToString());
        }

        private static byte[] BuildXlsxContent(List<ScoreRowData> rows, string reportType, int? councilId)
        {
            using var workbook = new XLWorkbook();
            var sheet = workbook.Worksheets.Add("Report");
            var normalizedType = NormalizeExportReportType(reportType);

            if (normalizedType == "scoreboard")
            {
                return BuildForm1TemplateXlsx(workbook, rows, councilId);
            }

            if (normalizedType == "council-summary")
            {
                sheet.Cell(1, 1).Value = "CouncilId";
                sheet.Cell(1, 2).Value = "Room";
                sheet.Cell(1, 3).Value = "StudentCount";
                sheet.Cell(1, 4).Value = "Avg";
                sheet.Cell(1, 5).Value = "Max";
                sheet.Cell(1, 6).Value = "Min";

                var summaries = BuildCouncilSummary(rows);
                for (var i = 0; i < summaries.Count; i++)
                {
                    var row = summaries[i];
                    var r = i + 2;
                    sheet.Cell(r, 1).Value = row.CouncilId;
                    sheet.Cell(r, 2).Value = row.Room;
                    sheet.Cell(r, 3).Value = row.StudentCount;
                    sheet.Cell(r, 4).Value = row.Avg;
                    sheet.Cell(r, 5).Value = row.Max;
                    sheet.Cell(r, 6).Value = row.Min;
                }
            }
            else if (normalizedType == "minutes")
            {
                sheet.Cell(1, 1).Value = "CouncilId";
                sheet.Cell(1, 2).Value = "Room";
                sheet.Cell(1, 3).Value = "Session";
                sheet.Cell(1, 4).Value = "StudentCode";
                sheet.Cell(1, 5).Value = "StudentName";
                sheet.Cell(1, 6).Value = "TopicTitle";
                sheet.Cell(1, 7).Value = "Result";

                var ordered = rows.OrderBy(r => r.CouncilId).ThenBy(r => r.Session).ThenBy(r => r.StudentCode).ToList();
                for (var i = 0; i < ordered.Count; i++)
                {
                    var row = ordered[i];
                    var r = i + 2;
                    sheet.Cell(r, 1).Value = row.CouncilId;
                    sheet.Cell(r, 2).Value = row.Room ?? string.Empty;
                    sheet.Cell(r, 3).Value = row.Session;
                    sheet.Cell(r, 4).Value = row.StudentCode;
                    sheet.Cell(r, 5).Value = row.StudentName;
                    sheet.Cell(r, 6).Value = row.TopicTitle;
                    sheet.Cell(r, 7).Value = row.Score.HasValue ? "Đã thông qua" : "Chờ chốt";
                }
            }
            else if (normalizedType == "review")
            {
                sheet.Cell(1, 1).Value = "CouncilId";
                sheet.Cell(1, 2).Value = "StudentCode";
                sheet.Cell(1, 3).Value = "StudentName";
                sheet.Cell(1, 4).Value = "TopicTitle";
                sheet.Cell(1, 5).Value = "Score";
                sheet.Cell(1, 6).Value = "Grade";
                sheet.Cell(1, 7).Value = "Review";

                var ordered = rows.OrderBy(r => r.CouncilId).ThenBy(r => r.StudentCode).ToList();
                for (var i = 0; i < ordered.Count; i++)
                {
                    var row = ordered[i];
                    var r = i + 2;
                    sheet.Cell(r, 1).Value = row.CouncilId;
                    sheet.Cell(r, 2).Value = row.StudentCode;
                    sheet.Cell(r, 3).Value = row.StudentName;
                    sheet.Cell(r, 4).Value = row.TopicTitle;
                    sheet.Cell(r, 5).Value = row.Score.HasValue ? row.Score.Value : string.Empty;
                    sheet.Cell(r, 6).Value = row.Grade ?? string.Empty;
                    sheet.Cell(r, 7).Value = BuildReviewNote(row);
                }
            }
            else
            {
                sheet.Cell(1, 1).Value = "CouncilId";
                sheet.Cell(1, 2).Value = "Room";
                sheet.Cell(1, 3).Value = "Session";
                sheet.Cell(1, 4).Value = "StudentCode";
                sheet.Cell(1, 5).Value = "StudentName";
                sheet.Cell(1, 6).Value = "TopicTitle";
                sheet.Cell(1, 7).Value = "Score";
                sheet.Cell(1, 8).Value = "Grade";

                var ordered = rows.OrderBy(r => r.CouncilId).ThenBy(r => r.Session).ThenBy(r => r.StudentCode).ToList();
                for (var i = 0; i < ordered.Count; i++)
                {
                    var row = ordered[i];
                    var r = i + 2;
                    sheet.Cell(r, 1).Value = row.CouncilId;
                    sheet.Cell(r, 2).Value = row.Room ?? string.Empty;
                    sheet.Cell(r, 3).Value = row.Session;
                    sheet.Cell(r, 4).Value = row.StudentCode;
                    sheet.Cell(r, 5).Value = row.StudentName;
                    sheet.Cell(r, 6).Value = row.TopicTitle;
                    sheet.Cell(r, 7).Value = row.Score.HasValue ? row.Score.Value : string.Empty;
                    sheet.Cell(r, 8).Value = row.Grade ?? string.Empty;
                }

                var nextRow = ordered.Count + 3;
                if (normalizedType == "final-term")
                {
                    var numeric = rows.Where(r => r.Score.HasValue).Select(r => r.Score!.Value).ToList();
                    if (numeric.Count > 0)
                    {
                        sheet.Cell(nextRow, 1).Value = "Highest";
                        sheet.Cell(nextRow, 2).Value = numeric.Max();
                        sheet.Cell(nextRow + 1, 1).Value = "Lowest";
                        sheet.Cell(nextRow + 1, 2).Value = numeric.Min();
                        nextRow += 2;
                    }
                }

                if (normalizedType == "form-1" && councilId.HasValue)
                {
                    sheet.Cell(nextRow, 1).Value = "Council";
                    sheet.Cell(nextRow, 2).Value = councilId.Value;
                }
            }

            sheet.RangeUsed()?.Style.Font.SetBold(false);
            sheet.Row(1).Style.Font.SetBold(true);
            sheet.Columns().AdjustToContents();

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return stream.ToArray();
        }

        private static byte[] BuildForm1TemplateXlsx(XLWorkbook workbook, List<ScoreRowData> rows, int? councilId)
        {
            var sheet = workbook.Worksheet("Report");

            sheet.Style.Font.FontName = "Times New Roman";
            sheet.Style.Font.FontSize = 12;
            sheet.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            sheet.Style.Alignment.WrapText = true;

            sheet.PageSetup.PaperSize = XLPaperSize.A4Paper;
            sheet.PageSetup.PageOrientation = XLPageOrientation.Portrait;
            sheet.PageSetup.Margins.Top = 0.35;
            sheet.PageSetup.Margins.Bottom = 0.35;
            sheet.PageSetup.Margins.Left = 0.25;
            sheet.PageSetup.Margins.Right = 0.25;
            sheet.PageSetup.Scale = 100;
            sheet.PageSetup.PagesWide = 1;
            sheet.PageSetup.PagesTall = 0;
            sheet.PageSetup.CenterHorizontally = true;

            sheet.Column(1).Width = 6;
            sheet.Column(2).Width = 14;
            sheet.Column(3).Width = 24;
            sheet.Column(4).Width = 44;
            sheet.Column(5).Width = 10;
            sheet.Column(6).Width = 10;
            sheet.Column(7).Width = 11;
            sheet.Column(8).Width = 18;

            sheet.Range(1, 1, 1, 4).Merge().Value = "TRUONG DAI HOC DA NANG";
            sheet.Range(2, 1, 2, 4).Merge().Value = "TRUONG DAI HOC BACH KHOA";
            sheet.Range(1, 5, 1, 8).Merge().Value = "CONG HOA XA HOI CHU NGHIA VIET NAM";
            sheet.Range(2, 5, 2, 8).Merge().Value = "Doc lap - Tu do - Hanh phuc";
            sheet.Range(1, 1, 2, 8).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            sheet.Range(1, 1, 2, 8).Style.Font.SetBold(true);

            sheet.Range(4, 1, 4, 8).Merge().Value = "BANG TONG HOP KET QUA BAO VE KHOA LUAN";
            sheet.Range(4, 1, 4, 8).Style.Font.SetBold(true);
            sheet.Range(4, 1, 4, 8).Style.Font.FontSize = 14;
            sheet.Range(4, 1, 4, 8).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

            var councilText = councilId.HasValue ? councilId.Value.ToString(CultureInfo.InvariantCulture) : "Tat ca";
            sheet.Range(6, 1, 6, 4).Merge().Value = $"Hoi dong: {councilText}";
            sheet.Range(6, 5, 6, 8).Merge().Value = $"Ngay in: {DateTime.Now:dd/MM/yyyy HH:mm}";
            sheet.Range(6, 1, 6, 8).Style.Font.SetBold(true);
            sheet.Range(6, 1, 6, 4).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Left;
            sheet.Range(6, 5, 6, 8).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;

            var headerRow = 8;
            sheet.Cell(headerRow, 1).Value = "STT";
            sheet.Cell(headerRow, 2).Value = "MSSV";
            sheet.Cell(headerRow, 3).Value = "Ho va ten";
            sheet.Cell(headerRow, 4).Value = "Ten de tai";
            sheet.Cell(headerRow, 5).Value = "Buoi";
            sheet.Cell(headerRow, 6).Value = "Diem";
            sheet.Cell(headerRow, 7).Value = "Diem chu";
            sheet.Cell(headerRow, 8).Value = "Ghi chu";

            var ordered = rows.OrderBy(r => r.CouncilId).ThenBy(r => r.Session).ThenBy(r => r.StudentCode).ToList();
            var startRow = headerRow + 1;
            for (var i = 0; i < ordered.Count; i++)
            {
                var row = ordered[i];
                var r = startRow + i;
                sheet.Cell(r, 1).Value = i + 1;
                sheet.Cell(r, 2).Value = row.StudentCode;
                sheet.Cell(r, 3).Value = row.StudentName;
                sheet.Cell(r, 4).Value = row.TopicTitle;
                sheet.Cell(r, 5).Value = row.Session;
                sheet.Cell(r, 6).Value = row.Score.HasValue ? row.Score.Value : string.Empty;
                sheet.Cell(r, 7).Value = row.Grade ?? string.Empty;
                sheet.Cell(r, 8).Value = string.Empty;
            }

            var lastDataRow = startRow + Math.Max(ordered.Count, 1) - 1;
            var tableRange = sheet.Range(headerRow, 1, lastDataRow, 8);
            tableRange.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            tableRange.Style.Border.InsideBorder = XLBorderStyleValues.Thin;
            tableRange.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            sheet.Range(startRow, 3, lastDataRow, 4).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Left;
            sheet.Range(startRow, 8, lastDataRow, 8).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Left;
            sheet.Row(headerRow).Style.Font.SetBold(true);
            sheet.Row(headerRow).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

            var summaryRow = lastDataRow + 2;
            var numeric = rows.Where(r => r.Score.HasValue).Select(r => r.Score!.Value).ToList();
            if (numeric.Count > 0)
            {
                sheet.Range(summaryRow, 1, summaryRow, 2).Merge().Value = "Diem cao nhat";
                sheet.Cell(summaryRow, 3).Value = numeric.Max();
                sheet.Range(summaryRow + 1, 1, summaryRow + 1, 2).Merge().Value = "Diem thap nhat";
                sheet.Cell(summaryRow + 1, 3).Value = numeric.Min();
                sheet.Range(summaryRow + 2, 1, summaryRow + 2, 2).Merge().Value = "Diem trung binh";
                sheet.Cell(summaryRow + 2, 3).Value = Math.Round(numeric.Average(), 2);

                sheet.Range(summaryRow, 1, summaryRow + 2, 3).Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
                sheet.Range(summaryRow, 1, summaryRow + 2, 3).Style.Border.InsideBorder = XLBorderStyleValues.Thin;
                sheet.Range(summaryRow, 1, summaryRow + 2, 2).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Left;
            }

            var signRow = summaryRow + 5;
            sheet.Range(signRow, 1, signRow, 4).Merge().Value = "CHU TICH HOI DONG";
            sheet.Range(signRow, 5, signRow, 8).Merge().Value = "UY VIEN THU KY";
            sheet.Range(signRow, 1, signRow, 8).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            sheet.Range(signRow, 1, signRow, 8).Style.Font.SetBold(true);

            sheet.Range(signRow + 1, 5, signRow + 1, 8).Merge().Value = $"Da Nang, ngay {DateTime.Now:dd} thang {DateTime.Now:MM} nam {DateTime.Now:yyyy}";
            sheet.Range(signRow + 1, 5, signRow + 1, 8).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            sheet.Range(signRow + 1, 5, signRow + 1, 8).Style.Font.SetItalic(true);

            sheet.Range(signRow + 5, 1, signRow + 5, 4).Merge().Value = "(Ky, ghi ro ho ten)";
            sheet.Range(signRow + 5, 5, signRow + 5, 8).Merge().Value = "(Ky, ghi ro ho ten)";
            sheet.Range(signRow + 5, 1, signRow + 5, 8).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            sheet.Range(signRow + 5, 1, signRow + 5, 8).Style.Font.SetItalic(true);

            sheet.Row(headerRow).Height = 24;
            for (var r = startRow; r <= lastDataRow; r++)
            {
                sheet.Row(r).Height = 22;
            }

            sheet.Range(1, 1, signRow + 5, 8).Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            var usedRange = sheet.RangeUsed();
            if (usedRange != null)
            {
                usedRange.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            }

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return stream.ToArray();
        }

        private static byte[] BuildPdfContent(List<ScoreRowData> rows, string reportType, int? councilId)
        {
            QuestPDF.Settings.License = LicenseType.Community;
            var normalizedType = NormalizeExportReportType(reportType);

            return Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Margin(24);
                    page.Size(PageSizes.A4.Landscape());
                    page.DefaultTextStyle(x => x.FontSize(10));

                    page.Header().Column(col =>
                    {
                        col.Item().Text("Defense Report").Bold().FontSize(16);
                        col.Item().Text($"Type: {reportType}");
                        col.Item().Text($"Council: {(councilId.HasValue ? councilId.Value.ToString() : "ALL")}");
                        col.Item().Text($"Generated: {DateTime.Now:yyyy-MM-dd HH:mm}");
                    });

                    if (normalizedType == "council-summary")
                    {
                        var summaries = BuildCouncilSummary(rows);
                        page.Content().PaddingTop(12).Table(table =>
                        {
                            table.ColumnsDefinition(columns =>
                            {
                                columns.ConstantColumn(70);
                                columns.ConstantColumn(70);
                                columns.ConstantColumn(70);
                                columns.ConstantColumn(70);
                                columns.ConstantColumn(70);
                                columns.ConstantColumn(70);
                            });

                            table.Header(header =>
                            {
                                header.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).Background(Colors.Grey.Lighten2).PaddingVertical(4).PaddingHorizontal(3).Text("Council").Bold();
                                header.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).Background(Colors.Grey.Lighten2).PaddingVertical(4).PaddingHorizontal(3).Text("Room").Bold();
                                header.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).Background(Colors.Grey.Lighten2).PaddingVertical(4).PaddingHorizontal(3).Text("Students").Bold();
                                header.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).Background(Colors.Grey.Lighten2).PaddingVertical(4).PaddingHorizontal(3).Text("Avg").Bold();
                                header.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).Background(Colors.Grey.Lighten2).PaddingVertical(4).PaddingHorizontal(3).Text("Max").Bold();
                                header.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).Background(Colors.Grey.Lighten2).PaddingVertical(4).PaddingHorizontal(3).Text("Min").Bold();
                            });

                            foreach (var summary in summaries)
                            {
                                table.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).PaddingVertical(3).PaddingHorizontal(3).Text(summary.CouncilId.ToString());
                                table.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).PaddingVertical(3).PaddingHorizontal(3).Text(summary.Room);
                                table.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).PaddingVertical(3).PaddingHorizontal(3).Text(summary.StudentCount.ToString());
                                table.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).PaddingVertical(3).PaddingHorizontal(3).Text(summary.Avg.ToString("0.0"));
                                table.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).PaddingVertical(3).PaddingHorizontal(3).Text(summary.Max.ToString("0.0"));
                                table.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).PaddingVertical(3).PaddingHorizontal(3).Text(summary.Min.ToString("0.0"));
                            }
                        });
                    }
                    else if (normalizedType == "minutes")
                    {
                        page.Content().PaddingTop(12).Table(table =>
                        {
                            table.ColumnsDefinition(columns =>
                            {
                                columns.ConstantColumn(60);
                                columns.ConstantColumn(70);
                                columns.ConstantColumn(55);
                                columns.ConstantColumn(80);
                                columns.RelativeColumn(1.2f);
                                columns.RelativeColumn(1.8f);
                                columns.ConstantColumn(80);
                            });

                            table.Header(header =>
                            {
                                header.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).Background(Colors.Grey.Lighten2).PaddingVertical(4).PaddingHorizontal(3).Text("Council").Bold();
                                header.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).Background(Colors.Grey.Lighten2).PaddingVertical(4).PaddingHorizontal(3).Text("Room").Bold();
                                header.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).Background(Colors.Grey.Lighten2).PaddingVertical(4).PaddingHorizontal(3).Text("Session").Bold();
                                header.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).Background(Colors.Grey.Lighten2).PaddingVertical(4).PaddingHorizontal(3).Text("Student").Bold();
                                header.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).Background(Colors.Grey.Lighten2).PaddingVertical(4).PaddingHorizontal(3).Text("Name").Bold();
                                header.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).Background(Colors.Grey.Lighten2).PaddingVertical(4).PaddingHorizontal(3).Text("Topic").Bold();
                                header.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).Background(Colors.Grey.Lighten2).PaddingVertical(4).PaddingHorizontal(3).Text("Result").Bold();
                            });

                            foreach (var row in rows)
                            {
                                table.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).PaddingVertical(3).PaddingHorizontal(3).Text(row.CouncilId.ToString());
                                table.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).PaddingVertical(3).PaddingHorizontal(3).Text(row.Room ?? string.Empty);
                                table.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).PaddingVertical(3).PaddingHorizontal(3).Text(row.Session);
                                table.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).PaddingVertical(3).PaddingHorizontal(3).Text(row.StudentCode);
                                table.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).PaddingVertical(3).PaddingHorizontal(3).Text(row.StudentName);
                                table.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).PaddingVertical(3).PaddingHorizontal(3).Text(row.TopicTitle);
                                table.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).PaddingVertical(3).PaddingHorizontal(3).Text(row.Score.HasValue ? "Đã thông qua" : "Chờ chốt");
                            }
                        });
                    }
                    else if (normalizedType == "review")
                    {
                        page.Content().PaddingTop(12).Table(table =>
                        {
                            table.ColumnsDefinition(columns =>
                            {
                                columns.ConstantColumn(60);
                                columns.ConstantColumn(80);
                                columns.RelativeColumn(1.2f);
                                columns.RelativeColumn(1.8f);
                                columns.ConstantColumn(55);
                                columns.ConstantColumn(45);
                                columns.RelativeColumn(1.6f);
                            });

                            table.Header(header =>
                            {
                                header.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).Background(Colors.Grey.Lighten2).PaddingVertical(4).PaddingHorizontal(3).Text("Council").Bold();
                                header.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).Background(Colors.Grey.Lighten2).PaddingVertical(4).PaddingHorizontal(3).Text("Student").Bold();
                                header.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).Background(Colors.Grey.Lighten2).PaddingVertical(4).PaddingHorizontal(3).Text("Name").Bold();
                                header.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).Background(Colors.Grey.Lighten2).PaddingVertical(4).PaddingHorizontal(3).Text("Topic").Bold();
                                header.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).Background(Colors.Grey.Lighten2).PaddingVertical(4).PaddingHorizontal(3).Text("Score").Bold();
                                header.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).Background(Colors.Grey.Lighten2).PaddingVertical(4).PaddingHorizontal(3).Text("Grade").Bold();
                                header.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).Background(Colors.Grey.Lighten2).PaddingVertical(4).PaddingHorizontal(3).Text("Review").Bold();
                            });

                            foreach (var row in rows)
                            {
                                table.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).PaddingVertical(3).PaddingHorizontal(3).Text(row.CouncilId.ToString());
                                table.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).PaddingVertical(3).PaddingHorizontal(3).Text(row.StudentCode);
                                table.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).PaddingVertical(3).PaddingHorizontal(3).Text(row.StudentName);
                                table.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).PaddingVertical(3).PaddingHorizontal(3).Text(row.TopicTitle);
                                table.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).PaddingVertical(3).PaddingHorizontal(3).Text(row.Score?.ToString("0.0") ?? string.Empty);
                                table.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).PaddingVertical(3).PaddingHorizontal(3).Text(row.Grade ?? string.Empty);
                                table.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).PaddingVertical(3).PaddingHorizontal(3).Text(BuildReviewNote(row));
                            }
                        });
                    }
                    else
                    {
                        page.Content().PaddingTop(12).Table(table =>
                        {
                            table.ColumnsDefinition(columns =>
                            {
                                columns.ConstantColumn(60);
                                columns.ConstantColumn(70);
                                columns.ConstantColumn(55);
                                columns.ConstantColumn(80);
                                columns.RelativeColumn(1.2f);
                                columns.RelativeColumn(1.8f);
                                columns.ConstantColumn(55);
                                columns.ConstantColumn(45);
                            });

                            table.Header(header =>
                            {
                                header.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).Background(Colors.Grey.Lighten2).PaddingVertical(4).PaddingHorizontal(3).Text("Council").Bold();
                                header.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).Background(Colors.Grey.Lighten2).PaddingVertical(4).PaddingHorizontal(3).Text("Room").Bold();
                                header.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).Background(Colors.Grey.Lighten2).PaddingVertical(4).PaddingHorizontal(3).Text("Session").Bold();
                                header.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).Background(Colors.Grey.Lighten2).PaddingVertical(4).PaddingHorizontal(3).Text("Student").Bold();
                                header.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).Background(Colors.Grey.Lighten2).PaddingVertical(4).PaddingHorizontal(3).Text("Name").Bold();
                                header.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).Background(Colors.Grey.Lighten2).PaddingVertical(4).PaddingHorizontal(3).Text("Topic").Bold();
                                header.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).Background(Colors.Grey.Lighten2).PaddingVertical(4).PaddingHorizontal(3).Text("Score").Bold();
                                header.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).Background(Colors.Grey.Lighten2).PaddingVertical(4).PaddingHorizontal(3).Text("Grade").Bold();
                            });

                            foreach (var row in rows)
                            {
                                table.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).PaddingVertical(3).PaddingHorizontal(3).Text(row.CouncilId.ToString());
                                table.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).PaddingVertical(3).PaddingHorizontal(3).Text(row.Room ?? string.Empty);
                                table.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).PaddingVertical(3).PaddingHorizontal(3).Text(row.Session);
                                table.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).PaddingVertical(3).PaddingHorizontal(3).Text(row.StudentCode);
                                table.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).PaddingVertical(3).PaddingHorizontal(3).Text(row.StudentName);
                                table.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).PaddingVertical(3).PaddingHorizontal(3).Text(row.TopicTitle);
                                table.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).PaddingVertical(3).PaddingHorizontal(3).Text(row.Score?.ToString("0.0") ?? string.Empty);
                                table.Cell().Border(0.6f).BorderColor(Colors.Grey.Lighten1).PaddingVertical(3).PaddingHorizontal(3).Text(row.Grade ?? string.Empty);
                            }
                        });
                    }

                    var numeric = rows.Where(r => r.Score.HasValue).Select(r => r.Score!.Value).ToList();
                    if (numeric.Count > 0)
                    {
                        page.Footer().AlignRight().Text($"Highest: {numeric.Max():0.0} | Lowest: {numeric.Min():0.0}").SemiBold();
                    }
                });
            }).GeneratePdf();
        }

        private static List<CouncilSummaryRow> BuildCouncilSummary(List<ScoreRowData> rows)
        {
            return rows
                .GroupBy(r => new { r.CouncilId, Room = r.Room ?? string.Empty })
                .Select(g =>
                {
                    var vals = g.Where(x => x.Score.HasValue).Select(x => x.Score!.Value).ToList();
                    var first = g.First();
                    return new CouncilSummaryRow
                    {
                        CouncilId = g.Key.CouncilId,
                        CommitteeCode = first.CommitteeCode,
                        Room = g.Key.Room,
                        DefenseDate = first.DefenseDate.HasValue ? first.DefenseDate.Value.ToString("dd/MM/yyyy") : string.Empty,
                        StudentCount = g.Count(),
                        Avg = vals.Count == 0 ? 0 : Math.Round(vals.Average(), 1),
                        Max = vals.Count == 0 ? 0 : vals.Max(),
                        Min = vals.Count == 0 ? 0 : vals.Min()
                    };
                })
                .OrderBy(x => x.CouncilId)
                .ToList();
        }

        private static string BuildFlexibleReportStem(string normalizedType, int periodId, int? councilId)
        {
            var baseName = normalizedType switch
            {
                "council-summary" => "bang-diem-theo-hoi-dong",
                "final-term" => "bang-diem-toan-dot",
                "minutes" => "bien-ban",
                "review" => "nhan-xet",
                _ => normalizedType
            };

            return councilId.HasValue
                ? $"{baseName}_{periodId}_c{councilId.Value}"
                : $"{baseName}_{periodId}";
        }

        private static string GetFlexibleReportTitle(string normalizedType)
        {
            return normalizedType switch
            {
                "council-summary" => "BANG DIEM THEO DANH SACH HOI DONG",
                "final-term" => "BANG DIEM TOAN DOT",
                "minutes" => "BANG TONG HOP BIEN BAN",
                "review" => "BANG NHAN XET",
                _ => "BAO CAO XUAT FILE"
            };
        }

        private static List<ReportColumnDefinition> ResolveFlexibleColumns(string normalizedType, IReadOnlyCollection<string>? selectedFields)
        {
            var defaults = normalizedType == "council-summary"
                ? new List<ReportColumnDefinition>
                {
                    new("CouncilId", "CouncilId"),
                    new("CommitteeCode", "Ma Hoi Dong"),
                    new("Room", "Phong"),
                    new("StudentCount", "So De Tai"),
                    new("Avg", "Diem TB"),
                    new("Max", "Diem Cao Nhat"),
                    new("Min", "Diem Thap Nhat")
                }
                : new List<ReportColumnDefinition>
                {
                    new("CouncilId", "CouncilId"),
                    new("CommitteeCode", "Ma Hoi Dong"),
                    new("Room", "Phong"),
                    new("DefenseDate", "Ngay Bao Ve"),
                    new("Session", "Buoi"),
                    new("StudentCode", "MSSV"),
                    new("StudentName", "Ho va ten"),
                    new("TopicTitle", "Ten de tai"),
                    new("Score", "Diem"),
                    new("Grade", "Diem chu")
                };

            if (selectedFields == null || selectedFields.Count == 0)
            {
                return defaults;
            }

            var defaultMap = defaults.ToDictionary(x => x.Key, x => x, StringComparer.OrdinalIgnoreCase);
            var resolved = new List<ReportColumnDefinition>();

            foreach (var field in selectedFields)
            {
                var key = (field ?? string.Empty).Trim();
                if (string.IsNullOrWhiteSpace(key) || !defaultMap.TryGetValue(key, out var column))
                {
                    continue;
                }

                if (resolved.All(x => !string.Equals(x.Key, column.Key, StringComparison.OrdinalIgnoreCase)))
                {
                    resolved.Add(column);
                }
            }

            return resolved.Count > 0 ? resolved : defaults;
        }

        private static string GetFlexibleRowValue(ScoreRowData row, string key)
        {
            return key switch
            {
                "CouncilId" => row.CouncilId.ToString(),
                "CommitteeCode" => row.CommitteeCode,
                "Room" => row.Room ?? string.Empty,
                "DefenseDate" => row.DefenseDate.HasValue ? row.DefenseDate.Value.ToString("dd/MM/yyyy") : string.Empty,
                "Session" => row.Session,
                "StudentCode" => row.StudentCode,
                "StudentName" => row.StudentName,
                "TopicTitle" => row.TopicTitle,
                "Score" => row.Score.HasValue ? row.Score.Value.ToString("0.0") : string.Empty,
                "Grade" => row.Grade ?? string.Empty,
                _ => string.Empty
            };
        }

        private static string GetFlexibleSummaryValue(CouncilSummaryRow row, string key)
        {
            return key switch
            {
                "CouncilId" => row.CouncilId.ToString(),
                "CommitteeCode" => row.CommitteeCode,
                "Room" => row.Room,
                "DefenseDate" => row.DefenseDate,
                "StudentCount" => row.StudentCount.ToString(),
                "Avg" => row.Avg.ToString("0.0"),
                "Max" => row.Max.ToString("0.0"),
                "Min" => row.Min.ToString("0.0"),
                _ => string.Empty
            };
        }

        private static byte[] BuildFlexibleCsvContent(List<ScoreRowData> rows, string reportType, IReadOnlyCollection<string>? selectedFields)
        {
            var normalizedType = NormalizeExportReportType(reportType);
            var columns = ResolveFlexibleColumns(normalizedType, selectedFields);
            var summaryRows = normalizedType == "council-summary" ? BuildCouncilSummary(rows) : new List<CouncilSummaryRow>();
            var sb = new StringBuilder();

            sb.AppendLine($"# TRUONG DAI HOC DAI NAM");
            sb.AppendLine($"# KHOA CONG NGHE THONG TIN");
            sb.AppendLine($"# {GetFlexibleReportTitle(normalizedType)}");
            sb.AppendLine($"# Ngay xuat: {DateTime.Now:dd/MM/yyyy HH:mm}");

            sb.AppendLine(string.Join(",", columns.Select(x => EscapeCsv(x.Header))));

            if (normalizedType == "council-summary")
            {
                foreach (var row in summaryRows)
                {
                    sb.AppendLine(string.Join(",", columns.Select(x => EscapeCsv(GetFlexibleSummaryValue(row, x.Key)))));
                }
            }
            else
            {
                foreach (var row in rows.OrderBy(r => r.CouncilId).ThenBy(r => r.Session).ThenBy(r => r.StudentCode))
                {
                    sb.AppendLine(string.Join(",", columns.Select(x => EscapeCsv(GetFlexibleRowValue(row, x.Key)))));
                }

                if (normalizedType == "final-term")
                {
                    var numeric = rows.Where(r => r.Score.HasValue).Select(r => r.Score!.Value).ToList();
                    if (numeric.Count > 0)
                    {
                        sb.AppendLine();
                        sb.AppendLine($"# Highest,{numeric.Max():0.0}");
                        sb.AppendLine($"# Lowest,{numeric.Min():0.0}");
                    }
                }
            }

            sb.AppendLine($"# NGUOI LAP BIEU,{DateTime.Now:dd/MM/yyyy}");
            sb.AppendLine("# TRUONG KHOA");

            return Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
        }

        private static byte[] BuildFlexibleXlsxContent(List<ScoreRowData> rows, string reportType, IReadOnlyCollection<string>? selectedFields)
        {
            var normalizedType = NormalizeExportReportType(reportType);
            var columns = ResolveFlexibleColumns(normalizedType, selectedFields);
            var summaryRows = normalizedType == "council-summary" ? BuildCouncilSummary(rows) : new List<CouncilSummaryRow>();

            using var workbook = new XLWorkbook();
            var sheet = workbook.AddWorksheet("Report");
            var columnCount = Math.Max(columns.Count, 1);

            sheet.Style.Font.FontName = "Times New Roman";
            sheet.Style.Font.FontSize = 13;
            sheet.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            sheet.Style.Alignment.WrapText = true;

            for (var col = 1; col <= columnCount; col++)
            {
                sheet.Column(col).Width = col == 1 ? 8 : 18;
            }

            var headerEndColumn = columnCount;
            sheet.Range(1, 1, 1, Math.Min(headerEndColumn, 4)).Merge().Value = "TRƯỜNG ĐẠI HỌC ĐẠI NAM";
            sheet.Range(2, 1, 2, Math.Min(headerEndColumn, 4)).Merge().Value = "KHOA CÔNG NGHỆ THÔNG TIN";
            sheet.Range(1, Math.Max(1, headerEndColumn - 3), 1, headerEndColumn).Merge().Value = "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM";
            sheet.Range(2, Math.Max(1, headerEndColumn - 3), 2, headerEndColumn).Merge().Value = "Độc lập - Tự do - Hạnh phúc";
            sheet.Range(4, 1, 4, headerEndColumn).Merge().Value = GetFlexibleReportTitle(normalizedType);
            sheet.Range(5, 1, 5, headerEndColumn).Merge().Value = "NGÀNH CÔNG NGHỆ THÔNG TIN";

            sheet.Range(1, 1, 5, headerEndColumn).Style.Font.Bold = true;
            sheet.Range(4, 1, 5, headerEndColumn).Style.Font.FontSize = 14;
            sheet.Range(1, 1, 2, headerEndColumn).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Left;
            sheet.Range(1, Math.Max(1, headerEndColumn - 3), 2, headerEndColumn).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;
            sheet.Range(4, 1, 5, headerEndColumn).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

            var headerRow = 7;
            for (var i = 0; i < columns.Count; i++)
            {
                sheet.Cell(headerRow, i + 1).Value = columns[i].Header;
            }

            var currentRow = headerRow + 1;
            if (normalizedType == "council-summary")
            {
                foreach (var row in summaryRows)
                {
                    for (var i = 0; i < columns.Count; i++)
                    {
                        sheet.Cell(currentRow, i + 1).Value = GetFlexibleSummaryValue(row, columns[i].Key);
                    }
                    currentRow++;
                }
            }
            else
            {
                foreach (var row in rows.OrderBy(r => r.CouncilId).ThenBy(r => r.Session).ThenBy(r => r.StudentCode))
                {
                    for (var i = 0; i < columns.Count; i++)
                    {
                        sheet.Cell(currentRow, i + 1).Value = GetFlexibleRowValue(row, columns[i].Key);
                    }
                    currentRow++;
                }
            }

            var lastDataRow = Math.Max(currentRow - 1, headerRow);
            var tableRange = sheet.Range(headerRow, 1, lastDataRow, columnCount);
            tableRange.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            tableRange.Style.Border.InsideBorder = XLBorderStyleValues.Thin;
            tableRange.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            sheet.Range(headerRow, 1, headerRow, columnCount).Style.Font.Bold = true;

            if (normalizedType == "final-term")
            {
                var numeric = rows.Where(r => r.Score.HasValue).Select(r => r.Score!.Value).ToList();
                if (numeric.Count > 0)
                {
                    var summaryRow = lastDataRow + 2;
                    sheet.Range(summaryRow, 1, summaryRow, Math.Min(2, columnCount)).Merge().Value = "Diem cao nhat";
                    sheet.Cell(summaryRow, Math.Min(3, columnCount)).Value = numeric.Max();
                    sheet.Range(summaryRow + 1, 1, summaryRow + 1, Math.Min(2, columnCount)).Merge().Value = "Diem thap nhat";
                    sheet.Cell(summaryRow + 1, Math.Min(3, columnCount)).Value = numeric.Min();
                }
            }

            var footerRow = lastDataRow + 6;
            sheet.Range(footerRow, 1, footerRow, Math.Max(1, columnCount / 2)).Merge().Value = "NGƯỜI LẬP BIỂU";
            sheet.Range(footerRow, Math.Max(2, columnCount / 2 + 1), footerRow, columnCount).Merge().Value = "TRƯỞNG KHOA";
            sheet.Range(footerRow, 1, footerRow, columnCount).Style.Font.Bold = true;
            sheet.Range(footerRow + 1, Math.Max(2, columnCount / 2 + 1), footerRow + 1, columnCount).Merge().Value = $"Hà Nội, ngày {DateTime.Now:dd} tháng {DateTime.Now:MM} năm {DateTime.Now:yyyy}";

            using var ms = new MemoryStream();
            workbook.SaveAs(ms);
            return ms.ToArray();
        }

        private static byte[] BuildFlexiblePdfContent(List<ScoreRowData> rows, string reportType, IReadOnlyCollection<string>? selectedFields)
        {
            QuestPDF.Settings.License = LicenseType.Community;
            var normalizedType = NormalizeExportReportType(reportType);
            var columns = ResolveFlexibleColumns(normalizedType, selectedFields);
            var summaryRows = normalizedType == "council-summary" ? BuildCouncilSummary(rows) : new List<CouncilSummaryRow>();

            return Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Margin(20);
                    page.Size(PageSizes.A4.Landscape());
                    page.DefaultTextStyle(x => x.FontSize(9).FontFamily("Times New Roman"));

                    page.Header().Column(column =>
                    {
                        column.Spacing(2);
                        column.Item().Row(row =>
                        {
                            row.RelativeItem().Column(left =>
                            {
                                left.Item().Text("TRƯỜNG ĐẠI HỌC ĐẠI NAM").Bold().FontSize(12);
                                left.Item().Text("KHOA CÔNG NGHỆ THÔNG TIN").Bold().FontSize(12);
                            });

                            row.RelativeItem().AlignRight().Column(right =>
                            {
                                right.Item().Text("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM").Bold().FontSize(12);
                                right.Item().Text("Độc lập - Tự do - Hạnh phúc").Bold().FontSize(12);
                            });
                        });

                        column.Item().PaddingTop(6).AlignCenter().Text(GetFlexibleReportTitle(normalizedType)).Bold().FontSize(14);
                        column.Item().AlignCenter().Text("NGÀNH CÔNG NGHỆ THÔNG TIN").Bold().FontSize(12);
                        column.Item().AlignRight().Text($"Ngày xuất: {DateTime.Now:dd/MM/yyyy HH:mm}").FontSize(9);
                    });

                    page.Content().PaddingTop(10).Column(column =>
                    {
                        if (columns.Count == 0)
                        {
                            column.Item().Text("Không có cột hợp lệ để xuất.");
                            return;
                        }

                        column.Item().Table(table =>
                        {
                            table.ColumnsDefinition(definition =>
                            {
                                definition.ConstantColumn(30);
                                for (var i = 1; i < columns.Count; i++)
                                {
                                    definition.RelativeColumn();
                                }
                            });

                            table.Header(header =>
                            {
                                for (var i = 0; i < columns.Count; i++)
                                {
                                    header.Cell().Background(Colors.Grey.Lighten2).Border(0.5f).Padding(4).AlignCenter().Text(columns[i].Header).Bold();
                                }
                            });

                            if (normalizedType == "council-summary")
                            {
                                foreach (var row in summaryRows)
                                {
                                    for (var i = 0; i < columns.Count; i++)
                                    {
                                        table.Cell().Border(0.5f).Padding(3).AlignCenter().Text(GetFlexibleSummaryValue(row, columns[i].Key));
                                    }
                                }
                            }
                            else
                            {
                                foreach (var row in rows.OrderBy(r => r.CouncilId).ThenBy(r => r.Session).ThenBy(r => r.StudentCode))
                                {
                                    for (var i = 0; i < columns.Count; i++)
                                    {
                                        table.Cell().Border(0.5f).Padding(3).AlignCenter().Text(GetFlexibleRowValue(row, columns[i].Key));
                                    }
                                }
                            }
                        });

                        if (normalizedType == "final-term")
                        {
                            var numeric = rows.Where(r => r.Score.HasValue).Select(r => r.Score!.Value).ToList();
                            if (numeric.Count > 0)
                            {
                                column.Item().PaddingTop(8).Text($"Diem cao nhat: {numeric.Max():0.0} | Diem thap nhat: {numeric.Min():0.0}").SemiBold();
                            }
                        }

                        column.Item().PaddingTop(14).Row(row =>
                        {
                            row.RelativeItem().Column(left =>
                            {
                                left.Item().AlignCenter().Text("NGƯỜI LẬP BIỂU").Bold();
                                left.Item().AlignCenter().PaddingTop(28).Text("(Ký, ghi rõ họ tên)");
                            });

                            row.RelativeItem().Column(right =>
                            {
                                right.Item().AlignCenter().Text($"Hà Nội, ngày {DateTime.Now:dd} tháng {DateTime.Now:MM} năm {DateTime.Now:yyyy}").Italic();
                                right.Item().AlignCenter().Text("TRƯỞNG KHOA").Bold();
                                right.Item().AlignCenter().PaddingTop(28).Text("(Ký, ghi rõ họ tên)");
                            });
                        });
                    });
                });
            }).GeneratePdf();
        }

        private static string NormalizeCommitteeRole(string? role)
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

        private static bool? ReadCommitteeMemberOnlineFlag(ThesisManagement.Api.Models.CommitteeMember member)
        {
            var property = member.GetType().GetProperty("IsOnline");
            if (property == null)
            {
                return null;
            }

            var value = property.GetValue(member);
            if (value is bool boolValue)
            {
                return boolValue;
            }

            return null;
        }

        private static string ToMemberOnlineStatus(bool? isOnline)
        {
            if (!isOnline.HasValue)
            {
                return "UNKNOWN";
            }

            return isOnline.Value ? "ONLINE" : "OFFLINE";
        }

        private static string ToCouncilLockStatus(bool councilListLocked)
        {
            return councilListLocked ? "LOCKED" : "UNLOCKED";
        }

        private async Task<(string StudentCode, string StudentName, List<string> CandidateIdentityCodes)> ResolveStudentIdentityAsync(
            string studentCodeOrUserCode,
            CancellationToken cancellationToken)
        {
            var normalizedIdentityCode = string.IsNullOrWhiteSpace(studentCodeOrUserCode)
                ? string.Empty
                : studentCodeOrUserCode.Trim();

            if (string.IsNullOrWhiteSpace(normalizedIdentityCode))
            {
                return (string.Empty, string.Empty, new List<string>());
            }

            var identityCodeUpper = normalizedIdentityCode.ToUpperInvariant();
            var profile = await _db.StudentProfiles.AsNoTracking()
                .Where(x =>
                    (x.StudentCode != null && x.StudentCode.ToUpper() == identityCodeUpper)
                    || (x.UserCode != null && x.UserCode.ToUpper() == identityCodeUpper))
                .OrderByDescending(x => x.LastUpdated ?? x.CreatedAt)
                .Select(x => new
                {
                    x.StudentCode,
                    x.UserCode,
                    x.FullName
                })
                .FirstOrDefaultAsync(cancellationToken);

            if (profile == null)
            {
                return (
                    normalizedIdentityCode,
                    normalizedIdentityCode,
                    new List<string> { normalizedIdentityCode });
            }

            var candidateCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                normalizedIdentityCode
            };

            if (!string.IsNullOrWhiteSpace(profile.StudentCode))
            {
                candidateCodes.Add(profile.StudentCode.Trim());
            }

            if (!string.IsNullOrWhiteSpace(profile.UserCode))
            {
                candidateCodes.Add(profile.UserCode.Trim());
            }

            var resolvedStudentCode = string.IsNullOrWhiteSpace(profile.StudentCode)
                ? normalizedIdentityCode
                : profile.StudentCode.Trim();

            var resolvedStudentName = string.IsNullOrWhiteSpace(profile.FullName)
                ? resolvedStudentCode
                : profile.FullName.Trim();

            return (
                resolvedStudentCode,
                resolvedStudentName,
                candidateCodes.ToList());
        }

        private static DateTime? ResolveScheduledAt(
            DateTime? assignmentScheduledAt,
            DateTime? committeeDefenseDate,
            TimeSpan? assignmentStartTime,
            int? assignmentSession,
            DefensePeriodConfigSnapshot? periodConfig)
        {
            var datePart = assignmentScheduledAt ?? committeeDefenseDate;
            if (!datePart.HasValue)
            {
                return null;
            }

            var timePart = ResolveScheduledTimeOfDay(assignmentScheduledAt, assignmentStartTime, assignmentSession, periodConfig);
            if (!timePart.HasValue)
            {
                return datePart;
            }

            return datePart.Value.Date.Add(timePart.Value);
        }

        private static TimeSpan? ResolveScheduledTimeOfDay(
            DateTime? assignmentScheduledAt,
            TimeSpan? assignmentStartTime,
            int? assignmentSession,
            DefensePeriodConfigSnapshot? periodConfig)
        {
            if (assignmentStartTime.HasValue && assignmentStartTime.Value > TimeSpan.Zero)
            {
                return assignmentStartTime.Value;
            }

            if (assignmentScheduledAt.HasValue && assignmentScheduledAt.Value.TimeOfDay > TimeSpan.Zero)
            {
                return assignmentScheduledAt.Value.TimeOfDay;
            }

            return ResolveSessionStartTime(assignmentSession, periodConfig);
        }

        private static TimeSpan? ResolveSessionStartTime(int? assignmentSession, DefensePeriodConfigSnapshot? periodConfig)
        {
            if (!assignmentSession.HasValue)
            {
                return null;
            }

            return assignmentSession.Value == 1
                ? ParseConfigTime(periodConfig?.MorningStart, new TimeSpan(7, 30, 0))
                : ParseConfigTime(periodConfig?.AfternoonStart, new TimeSpan(13, 30, 0));
        }

        private static TimeSpan ParseConfigTime(string? raw, TimeSpan fallback)
        {
            if (string.IsNullOrWhiteSpace(raw))
            {
                return fallback;
            }

            return TimeSpan.TryParse(raw, CultureInfo.InvariantCulture, out var parsed)
                ? parsed
                : fallback;
        }

        private static List<string> BuildAllowedScoringActions(string normalizedRole)
        {
            var actions = new List<string> { "SUBMIT" };
            if (normalizedRole == "CT")
            {
                actions.Add("OPEN_SESSION");
                actions.Add("LOCK_SESSION");
            }

            return actions;
        }

        private static List<string> BuildAllowedMinuteActions(string normalizedRole)
        {
            if (normalizedRole == "CT" || normalizedRole == "UVTK")
            {
                return new List<string> { "UPSERT_MINUTES" };
            }

            if (normalizedRole == "UVPB")
            {
                return new List<string> { "UPSERT_REVIEW" };
            }

            return new List<string>();
        }

        private static List<string> BuildAllowedRevisionActions(string normalizedRole)
        {
            if (normalizedRole == "CT" || normalizedRole == "UVTK")
            {
                return new List<string> { "APPROVE", "REJECT" };
            }

            return new List<string>();
        }

        private static string EscapeCsv(string value)
        {
            if (value.Contains(',') || value.Contains('"') || value.Contains('\n') || value.Contains('\r'))
            {
                return $"\"{value.Replace("\"", "\"\"")}\"";
            }

            return value;
        }

        private static byte[] BuildSyncErrorsXlsxContent(List<SyncErrorDetailDto> rows)
        {
            using var workbook = new XLWorkbook();
            var sheet = workbook.Worksheets.Add("SyncErrors");

            sheet.Cell(1, 1).Value = "RowNo";
            sheet.Cell(1, 2).Value = "TopicCode";
            sheet.Cell(1, 3).Value = "StudentCode";
            sheet.Cell(1, 4).Value = "SupervisorCode";
            sheet.Cell(1, 5).Value = "Field";
            sheet.Cell(1, 6).Value = "ErrorCode";
            sheet.Cell(1, 7).Value = "Message";

            for (var i = 0; i < rows.Count; i++)
            {
                var row = rows[i];
                var r = i + 2;
                sheet.Cell(r, 1).Value = row.RowNo;
                sheet.Cell(r, 2).Value = row.TopicCode;
                sheet.Cell(r, 3).Value = row.StudentCode;
                sheet.Cell(r, 4).Value = row.SupervisorCode ?? string.Empty;
                sheet.Cell(r, 5).Value = row.Field;
                sheet.Cell(r, 6).Value = row.ErrorCode;
                sheet.Cell(r, 7).Value = row.Message;
            }

            sheet.Row(1).Style.Font.SetBold(true);
            sheet.Columns().AdjustToContents();

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return stream.ToArray();
        }

        private async Task<List<SyncErrorDetailDto>> BuildSyncErrorRowsAsync(int periodId, CancellationToken cancellationToken)
        {
            var topics = await _db.Topics.AsNoTracking()
                .Where(t => t.DefenseTermId == periodId)
                .OrderBy(t => t.TopicCode)
                .ToListAsync(cancellationToken);
            var eligibleTopicCodes = await LoadEligibleTopicCodesFromMilestonesAsync(topics, cancellationToken);
            var rows = new List<SyncErrorDetailDto>();

            for (var i = 0; i < topics.Count; i++)
            {
                var topic = topics[i];
                var rowNo = i + 1;
                var studentCode = topic.ProposerStudentCode ?? string.Empty;
                var supervisorCode = topic.SupervisorLecturerCode;

                if (string.IsNullOrWhiteSpace(studentCode))
                {
                    rows.Add(new SyncErrorDetailDto
                    {
                        RowNo = rowNo,
                        TopicCode = topic.TopicCode,
                        StudentCode = studentCode,
                        SupervisorCode = supervisorCode,
                        Field = "StudentCode",
                        ErrorCode = DefenseUcErrorCodes.Sync.MissingStudentCode,
                        Message = "Thiếu StudentCode"
                    });
                }

                if (string.IsNullOrWhiteSpace(supervisorCode))
                {
                    rows.Add(new SyncErrorDetailDto
                    {
                        RowNo = rowNo,
                        TopicCode = topic.TopicCode,
                        StudentCode = studentCode,
                        SupervisorCode = supervisorCode,
                        Field = "SupervisorCode",
                        ErrorCode = DefenseUcErrorCodes.Sync.MissingSupervisorCode,
                        Message = "Thiếu SupervisorCode"
                    });
                }

                if (!eligibleTopicCodes.Contains(topic.TopicCode))
                {
                    rows.Add(new SyncErrorDetailDto
                    {
                        RowNo = rowNo,
                        TopicCode = topic.TopicCode,
                        StudentCode = studentCode,
                        SupervisorCode = supervisorCode,
                        Field = "TopicStatus",
                        ErrorCode = DefenseUcErrorCodes.Sync.InvalidTopicStatus,
                        Message = "Topic chưa có trạng thái 'Đủ điều kiện bảo vệ'."
                    });
                }
            }

            return rows;
        }

        private async Task<HashSet<string>> GetScopedTopicCodesAsync(int periodId, CancellationToken cancellationToken)
        {
            var config = await GetPeriodConfigAsync(periodId, cancellationToken);
            if (config.CouncilIds.Count == 0)
            {
                var allTopicCodes = await _db.Topics.AsNoTracking()
                    .Where(x => x.DefenseTermId == periodId && !string.IsNullOrWhiteSpace(x.TopicCode))
                    .Select(x => x.TopicCode)
                    .ToListAsync(cancellationToken);

                return allTopicCodes.ToHashSet(StringComparer.OrdinalIgnoreCase);
            }

            var scopedTopicCodes = await _db.DefenseAssignments.AsNoTracking()
                .Where(x => x.CommitteeID.HasValue && config.CouncilIds.Contains(x.CommitteeID.Value) && x.TopicCode != null)
                .Select(x => x.TopicCode!)
                .Distinct()
                .ToListAsync(cancellationToken);

            return scopedTopicCodes.ToHashSet(StringComparer.OrdinalIgnoreCase);
        }

        private async Task<HashSet<string>> GetScopedLecturerCodesAsync(int periodId, CancellationToken cancellationToken)
        {
            var periodLecturerCodes = await _db.DefenseTermLecturers.AsNoTracking()
                .Where(x => x.DefenseTermId == periodId && x.LecturerCode != null)
                .Select(x => x.LecturerCode!)
                .Distinct()
                .ToListAsync(cancellationToken);

            return periodLecturerCodes
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
        }

        private async Task TrackExportAsync(int periodId, string fileName, string status, CancellationToken cancellationToken)
        {
            try
            {
                var code = $"EXP{DateTime.UtcNow:yyyyMMddHHmmssfff}";
                var existing = await _db.ExportFiles.AsNoTracking()
                    .Where(x => x.FileCode == code)
                    .Select(x => x.FileCode)
                    .FirstOrDefaultAsync(cancellationToken) != null;
                if (existing)
                {
                    code = $"EXP{DateTime.UtcNow:yyyyMMddHHmmssfff}{Random.Shared.Next(10, 99)}";
                }

                _db.ExportFiles.Add(new ExportFile
                {
                    FileCode = code,
                    TermId = periodId,
                    Status = status,
                    FileUrl = fileName,
                    CreatedAt = DateTime.UtcNow
                });

                await _db.SaveChangesAsync(cancellationToken);
            }
            catch (Exception ex)
            {
                // Log the exception but don't fail the export - the EXPORTFILES table might not exist
                System.Diagnostics.Debug.WriteLine($"Export tracking failed: {ex.Message}");
                // In production, you would log this: _logger?.LogWarning($"Export tracking failed: {ex.Message}");
            }
        }

        private async Task<bool> PeriodExistsAsync(int periodId, CancellationToken cancellationToken)
        {
            var existingPeriodId = await _db.DefenseTerms.AsNoTracking()
                .Where(x => x.DefenseTermId == periodId)
                .Select(x => (int?)x.DefenseTermId)
                .FirstOrDefaultAsync(cancellationToken);

            return existingPeriodId.HasValue;
        }

        private async Task<Dictionary<string, HashSet<string>>> LoadTopicTagMapAsync(List<string> topicCodes, CancellationToken cancellationToken)
        {
            if (topicCodes.Count == 0)
            {
                return new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);
            }

            var rows = await _db.TopicTags.AsNoTracking()
                .Where(x => x.TopicCode != null && topicCodes.Contains(x.TopicCode))
                .Join(_db.Tags.AsNoTracking(), tt => tt.TagID, tg => tg.TagID, (tt, tg) => new { tt.TopicCode, tg.TagCode })
                .ToListAsync(cancellationToken);

            return rows
                .Where(x => !string.IsNullOrWhiteSpace(x.TopicCode))
                .GroupBy(x => x.TopicCode!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(v => v.TagCode).Distinct(StringComparer.OrdinalIgnoreCase).ToHashSet(StringComparer.OrdinalIgnoreCase),
                    StringComparer.OrdinalIgnoreCase);
        }

        private async Task<Dictionary<string, HashSet<string>>> LoadLecturerTagMapAsync(List<string> lecturerCodes, CancellationToken cancellationToken)
        {
            if (lecturerCodes.Count == 0)
            {
                return new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);
            }

            var rows = await _db.LecturerTags.AsNoTracking()
                .Where(x => x.LecturerCode != null && lecturerCodes.Contains(x.LecturerCode))
                .Join(_db.Tags.AsNoTracking(), lt => lt.TagID, tg => tg.TagID, (lt, tg) => new { lt.LecturerCode, tg.TagCode })
                .ToListAsync(cancellationToken);

            return rows
                .Where(x => !string.IsNullOrWhiteSpace(x.LecturerCode))
                .GroupBy(x => x.LecturerCode!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(v => v.TagCode).Distinct(StringComparer.OrdinalIgnoreCase).ToHashSet(StringComparer.OrdinalIgnoreCase),
                    StringComparer.OrdinalIgnoreCase);
        }

        private async Task<DefensePeriodConfigSnapshot> GetPeriodConfigAsync(int periodId, CancellationToken cancellationToken)
        {
            var period = await _db.DefenseTerms.AsNoTracking().FirstOrDefaultAsync(x => x.DefenseTermId == periodId, cancellationToken);
            if (period == null)
            {
                return new DefensePeriodConfigSnapshot();
            }

            DefensePeriodConfigSnapshot config;

            try
            {
                config = string.IsNullOrWhiteSpace(period.ConfigJson)
                    ? new DefensePeriodConfigSnapshot()
                    : (JsonSerializer.Deserialize<DefensePeriodConfigSnapshot>(period.ConfigJson) ?? new DefensePeriodConfigSnapshot());
            }
            catch
            {
                config = new DefensePeriodConfigSnapshot();
            }

            var fkCouncilIds = await _db.Committees.AsNoTracking()
                .Where(x => x.DefenseTermId == periodId)
                .Select(x => x.CommitteeID)
                .ToListAsync(cancellationToken);

            if (fkCouncilIds.Count > 0)
            {
                config.CouncilIds = config.CouncilIds
                    .Concat(fkCouncilIds)
                    .Distinct()
                    .OrderBy(x => x)
                    .ToList();
            }

            return config;
        }

        private Task<HashSet<string>> LoadEligibleTopicCodesFromMilestonesAsync(IEnumerable<Topic> topics, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var eligibleTopicCodes = topics
                .Where(t => !string.IsNullOrWhiteSpace(t.TopicCode) && IsDefenseEligibleTopicStatus(t.Status))
                .Select(t => t.TopicCode)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            return Task.FromResult(eligibleTopicCodes);
        }

        private static bool IsDefenseEligibleTopicStatus(string? status)
        {
            var normalized = NormalizeKeyword(status);
            if (string.IsNullOrWhiteSpace(normalized))
            {
                return false;
            }

            return normalized.Contains("DU DIEU KIEN BAO VE", StringComparison.Ordinal)
                || normalized.Contains("ELIGIBLE", StringComparison.Ordinal)
                || normalized.Contains("READY FOR DEFENSE", StringComparison.Ordinal)
                || normalized.Contains("READY_FOR_DEFENSE", StringComparison.Ordinal)
                || normalized.Contains("APPROVED", StringComparison.Ordinal);
        }

        private static string NormalizeKeyword(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return string.Empty;
            }

            var decomposed = value.Trim().Normalize(NormalizationForm.FormD);
            var builder = new StringBuilder(decomposed.Length);

            foreach (var character in decomposed)
            {
                if (CharUnicodeInfo.GetUnicodeCategory(character) == UnicodeCategory.NonSpacingMark)
                {
                    continue;
                }

                builder.Append(char.ToUpperInvariant(character));
            }

            return builder
                .ToString()
                .Replace('\u0110', 'D')
                .Replace('\u0111', 'd')
                .Normalize(NormalizationForm.FormC);
        }

            private static string ToSessionCode(int? session)
            {
                return session == 1 ? DefenseSessionCodes.Morning : DefenseSessionCodes.Afternoon;
            }

        private async Task<CouncilDraftDto> BuildCouncilDtoAsync(int periodId, int councilId, CancellationToken cancellationToken)
        {
            var committee = await _db.Committees.AsNoTracking()
                .Where(x => x.CommitteeID == councilId)
                .Select(x => new Committee
                {
                    CommitteeID = x.CommitteeID,
                    CommitteeCode = x.CommitteeCode,
                    Name = x.Name,
                    DefenseDate = x.DefenseDate,
                    LastUpdated = x.LastUpdated,
                    Room = x.Room,
                    Status = x.Status
                })
                .FirstAsync(cancellationToken);

            var assignments = await _db.DefenseAssignments.AsNoTracking()
                .Where(x => x.CommitteeID == councilId)
                .OrderBy(x => x.Session)
                .ThenBy(x => x.OrderIndex)
                .ThenBy(x => x.AssignmentID)
                .Select(x => new DefenseAssignment
                {
                    AssignmentID = x.AssignmentID,
                    AssignmentCode = x.AssignmentCode,
                    TopicCode = x.TopicCode,
                    Session = x.Session,
                    ScheduledAt = x.ScheduledAt,
                    OrderIndex = x.OrderIndex
                })
                .ToListAsync(cancellationToken);
            var topicCodes = assignments.Where(x => !string.IsNullOrWhiteSpace(x.TopicCode)).Select(x => x.TopicCode!).ToList();
            var topics = await _db.Topics.AsNoTracking().Where(x => topicCodes.Contains(x.TopicCode)).ToListAsync(cancellationToken);
            var topicTagMap = await LoadTopicTagMapAsync(topicCodes, cancellationToken);
            var tags = await _db.CommitteeTags.AsNoTracking().Where(x => x.CommitteeID == councilId).Select(x => x.TagCode).ToListAsync(cancellationToken);
            var members = await _db.CommitteeMembers.AsNoTracking().Where(x => x.CommitteeID == councilId).ToListAsync(cancellationToken);
            var memberCodes = members
                .Where(x => !string.IsNullOrWhiteSpace(x.MemberLecturerCode))
                .Select(x => x.MemberLecturerCode!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            var lecturerTagMap = await LoadLecturerTagMapAsync(memberCodes, cancellationToken);
            var students = await _db.StudentProfiles.AsNoTracking().ToDictionaryAsync(x => x.StudentCode, x => x.FullName ?? x.StudentCode, cancellationToken);
            var lecturerNameMap = await _db.LecturerProfiles.AsNoTracking()
                .Select(l => new { l.LecturerCode, Name = l.FullName ?? l.LecturerCode })
                .ToDictionaryAsync(x => x.LecturerCode, x => x.Name, cancellationToken);
            const int minRequiredCount = 3;
            const int maxAllowedCount = 7;

            var dto = new CouncilDraftDto
            {
                Id = committee.CommitteeID,
                CommitteeCode = committee.CommitteeCode,
                Name = committee.Name ?? committee.CommitteeCode,
                DefenseDate = committee.DefenseDate,
                ConcurrencyToken = committee.LastUpdated.Ticks.ToString(CultureInfo.InvariantCulture),
                Room = committee.Room ?? string.Empty,
                SlotId = $"{committee.DefenseDate:yyyyMMdd}",
                CouncilTags = tags,
                Status = committee.Status ?? "Draft",
                ForbiddenLecturers = topics.Select(t => t.SupervisorLecturerCode).Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x!).Distinct(StringComparer.OrdinalIgnoreCase).ToList(),
                Members = members.Select(m => new CouncilMemberDto
                {
                    Role = m.Role ?? string.Empty,
                    LecturerCode = m.MemberLecturerCode ?? string.Empty,
                    LecturerName = lecturerNameMap.TryGetValue(m.MemberLecturerCode ?? string.Empty, out var name) ? name : (m.MemberLecturerCode ?? string.Empty),
                    Tags = lecturerTagMap.TryGetValue(m.MemberLecturerCode ?? string.Empty, out var memberTags)
                        ? memberTags.OrderBy(x => x).ToList()
                        : new List<string>()
                }).ToList()
            };

            foreach (var assignment in assignments)
            {
                var topic = topics.FirstOrDefault(t => t.TopicCode == assignment.TopicCode);
                if (topic == null)
                {
                    continue;
                }

                var studentCode = topic.ProposerStudentCode ?? string.Empty;
                dto.Assignments.Add(new CouncilAssignmentDto
                {
                    AssignmentId = assignment.AssignmentID,
                    AssignmentCode = assignment.AssignmentCode,
                    TopicCode = topic.TopicCode,
                    TopicTitle = topic.Title,
                    Tags = topicTagMap.TryGetValue(topic.TopicCode, out var assignmentTags)
                        ? assignmentTags.OrderBy(x => x).ToList()
                        : new List<string>(),
                    StudentCode = studentCode,
                    StudentName = students.TryGetValue(studentCode, out var studentName) ? studentName : studentCode,
                    Session = assignment.Session,
                    SessionCode = ToSessionCode(assignment.Session),
                    ScheduledAt = assignment.ScheduledAt,
                    StartTime = assignment.StartTime?.ToString(@"hh\:mm"),
                    EndTime = assignment.EndTime?.ToString(@"hh\:mm"),
                    OrderIndex = assignment.OrderIndex,
                    Status = string.Empty
                });
            }

            foreach (var assignment in assignments.Where(x => x.Session == 1))
            {
                var topic = topics.FirstOrDefault(t => t.TopicCode == assignment.TopicCode);
                if (topic == null) continue;
                dto.MorningStudents.Add(new EligibleStudentDto
                {
                    StudentCode = topic.ProposerStudentCode ?? string.Empty,
                    StudentName = topic.ProposerStudentCode != null && students.TryGetValue(topic.ProposerStudentCode, out var n) ? n : (topic.ProposerStudentCode ?? string.Empty),
                    TopicTitle = topic.Title,
                    SupervisorCode = topic.SupervisorLecturerCode,
                    Tags = topicTagMap.TryGetValue(topic.TopicCode, out var morningTags)
                        ? morningTags.OrderBy(x => x).ToList()
                        : new List<string>(),
                    IsEligible = true,
                    Valid = true
                });
            }

            foreach (var assignment in assignments.Where(x => x.Session == 2))
            {
                var topic = topics.FirstOrDefault(t => t.TopicCode == assignment.TopicCode);
                if (topic == null) continue;
                dto.AfternoonStudents.Add(new EligibleStudentDto
                {
                    StudentCode = topic.ProposerStudentCode ?? string.Empty,
                    StudentName = topic.ProposerStudentCode != null && students.TryGetValue(topic.ProposerStudentCode, out var n) ? n : (topic.ProposerStudentCode ?? string.Empty),
                    TopicTitle = topic.Title,
                    SupervisorCode = topic.SupervisorLecturerCode,
                    Tags = topicTagMap.TryGetValue(topic.TopicCode, out var afternoonTags)
                        ? afternoonTags.OrderBy(x => x).ToList()
                        : new List<string>(),
                    IsEligible = true,
                    Valid = true
                });
            }

            var morningTopicCount = dto.MorningStudents.Count;
            var afternoonTopicCount = dto.AfternoonStudents.Count;
            var memberCount = dto.Members.Count;

            if (morningTopicCount < minRequiredCount || morningTopicCount > maxAllowedCount
                || afternoonTopicCount < minRequiredCount || afternoonTopicCount > maxAllowedCount
                || memberCount < minRequiredCount || memberCount > maxAllowedCount)
            {
                dto.Warning =
                    $"Vi phạm chuẩn cứng: Sáng {morningTopicCount}/{maxAllowedCount}, Chiều {afternoonTopicCount}/{maxAllowedCount}, Thành viên {memberCount}/{maxAllowedCount} (yêu cầu từ {minRequiredCount} đến {maxAllowedCount}).";
                dto.Status = "Warning";
            }
            else if (string.Equals(dto.Status, "Draft", StringComparison.OrdinalIgnoreCase)
                || string.Equals(dto.Status, "Warning", StringComparison.OrdinalIgnoreCase))
            {
                dto.Status = "Ready";
            }

            return dto;
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

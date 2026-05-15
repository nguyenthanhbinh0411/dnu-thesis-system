using System.Text;
using System.Text.Json;
using System.Security.Cryptography;
using System.Globalization;
using System.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ThesisManagement.Api.Application.Common;
using ThesisManagement.Api.Application.Common.Heuristics;
using ThesisManagement.Api.Application.Common.Resilience;
using ThesisManagement.Api.Application.Command.Notifications;
using ThesisManagement.Api.Application.Command.DefensePeriods.Services;
using ThesisManagement.Api.Data;
using ThesisManagement.Api.DTOs;
using ThesisManagement.Api.DTOs.DefensePeriods;
using ThesisManagement.Api.Hubs;
using ThesisManagement.Api.Models;
using ThesisManagement.Api.Services;

namespace ThesisManagement.Api.Application.Command.DefensePeriods
{
    public interface IDefensePeriodCommandProcessor
    {
        Task<ApiResponse<SyncDefensePeriodResponseDto>> SyncAsync(int periodId, SyncDefensePeriodRequestDto request, int actorUserId, CancellationToken cancellationToken = default);
        Task<ApiResponse<bool>> UpdateConfigAsync(int periodId, UpdateDefensePeriodConfigDto request, int actorUserId, CancellationToken cancellationToken = default);
        Task<ApiResponse<bool>> LockLecturerCapabilitiesAsync(int periodId, int actorUserId, CancellationToken cancellationToken = default);
        Task<ApiResponse<bool>> ConfirmCouncilConfigAsync(int periodId, ConfirmCouncilConfigDto request, int actorUserId, CancellationToken cancellationToken = default);
        Task<ApiResponse<List<CouncilDraftDto>>> GenerateCouncilsAsync(int periodId, GenerateCouncilsRequestDto request, int actorUserId, CancellationToken cancellationToken = default);
        Task<ApiResponse<bool>> LockCouncilsAsync(int periodId, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default);
        Task<ApiResponse<bool>> ReopenCouncilsAsync(int periodId, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default);
        Task<ApiResponse<CouncilDraftDto>> CreateCouncilAsync(int periodId, CouncilUpsertDto request, int actorUserId, CancellationToken cancellationToken = default);
        Task<ApiResponse<CouncilDraftDto>> UpdateCouncilAsync(int periodId, int councilId, CouncilUpsertDto request, int actorUserId, CancellationToken cancellationToken = default);
        Task<ApiResponse<bool>> DeleteCouncilAsync(int periodId, int councilId, int actorUserId, CancellationToken cancellationToken = default);
        Task<ApiResponse<GenerateCouncilCodeResponseDto>> GenerateCouncilCodeAsync(int periodId, CancellationToken cancellationToken = default);
        Task<ApiResponse<CouncilDraftDto>> CreateCouncilStep1Async(int periodId, CouncilWorkflowStep1Dto request, int actorUserId, CancellationToken cancellationToken = default);
        Task<ApiResponse<CouncilDraftDto>> UpdateCouncilStep1Async(int periodId, int councilId, CouncilWorkflowStep1Dto request, int actorUserId, CancellationToken cancellationToken = default);
        Task<ApiResponse<CouncilDraftDto>> SaveCouncilMembersStepAsync(int periodId, int councilId, CouncilWorkflowStep2Dto request, int actorUserId, CancellationToken cancellationToken = default);
        Task<ApiResponse<CouncilDraftDto>> SaveCouncilTopicsStepAsync(int periodId, int councilId, CouncilWorkflowStep3Dto request, int actorUserId, CancellationToken cancellationToken = default);
        Task<ApiResponse<CouncilDraftDto>> AddCouncilMemberItemAsync(int periodId, int councilId, AddCouncilMemberItemDto request, int actorUserId, CancellationToken cancellationToken = default);
        Task<ApiResponse<CouncilDraftDto>> UpdateCouncilMemberItemAsync(int periodId, int councilId, string lecturerCode, UpdateCouncilMemberItemDto request, int actorUserId, CancellationToken cancellationToken = default);
        Task<ApiResponse<CouncilDraftDto>> RemoveCouncilMemberItemAsync(int periodId, int councilId, string lecturerCode, RemoveCouncilMemberItemDto request, int actorUserId, CancellationToken cancellationToken = default);
        Task<ApiResponse<CouncilDraftDto>> AddCouncilTopicItemAsync(int periodId, int councilId, AddCouncilTopicItemDto request, int actorUserId, CancellationToken cancellationToken = default);
        Task<ApiResponse<CouncilDraftDto>> UpdateCouncilTopicItemAsync(int periodId, int councilId, int assignmentId, UpdateCouncilTopicItemDto request, int actorUserId, CancellationToken cancellationToken = default);
        Task<ApiResponse<CouncilDraftDto>> RemoveCouncilTopicItemAsync(int periodId, int councilId, int assignmentId, RemoveCouncilTopicItemDto request, int actorUserId, CancellationToken cancellationToken = default);
        Task<ApiResponse<bool>> FinalizeAsync(int periodId, FinalizeDefensePeriodDto request, int actorUserId, CancellationToken cancellationToken = default);
        Task<ApiResponse<RollbackDefensePeriodResponseDto>> RollbackAsync(int periodId, RollbackDefensePeriodDto request, int actorUserId, CancellationToken cancellationToken = default);
        Task<ApiResponse<bool>> PublishScoresAsync(int periodId, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default);

        Task<ApiResponse<bool>> StartAsync(int periodId, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default);
        Task<ApiResponse<bool>> MoveNextStepAsync(int periodId, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default);
        Task<ApiResponse<bool>> PauseAsync(int periodId, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default);
        Task<ApiResponse<bool>> ResumeAsync(int periodId, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default);
        Task<ApiResponse<bool>> LockScoringAsync(int periodId, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default);
        Task<ApiResponse<bool>> CloseAsync(int periodId, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default);

        Task<ApiResponse<bool>> SaveLecturerMinuteAsync(int committeeId, UpdateLecturerMinutesDto request, string lecturerCode, int actorUserId, CancellationToken cancellationToken = default);
        Task<ApiResponse<bool>> SubmitIndependentScoreAsync(int committeeId, LecturerScoreSubmitDto request, string lecturerCode, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default);
        Task<ApiResponse<bool>> OpenSessionAsync(int committeeId, string lecturerCode, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default);
        Task<ApiResponse<bool>> LockSessionAsync(int committeeId, string lecturerCode, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default);
        Task<ApiResponse<bool>> ApproveRevisionAsync(int revisionId, string? reason, string lecturerCode, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default);
        Task<ApiResponse<bool>> RejectRevisionAsync(int revisionId, string reason, string lecturerCode, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default);

        Task<ApiResponse<bool>> SubmitStudentRevisionAsync(StudentRevisionSubmissionDto request, string studentCode, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default);
    }

    internal sealed class DefensePeriodConfigState
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

    public class DefensePeriodCommandProcessor : IDefensePeriodCommandProcessor
    {
        private sealed class MinuteExtendedData
        {
            public List<MinuteChapterInputDto> ChapterContents { get; set; } = new();
            public string? CouncilDiscussionConclusion { get; set; }
            public string? ChairConclusion { get; set; }
            public string? CommitteeMemberComments { get; set; }
            public List<MinuteQuestionAnswerDto> QuestionAnswers { get; set; } = new();
            public ReviewerStructuredSectionsDto? ReviewerSections { get; set; }
        }

        private sealed class RetryExecutionResult<T>
        {
            public T Data { get; init; } = default!;
            public int Attempts { get; init; }
        }

        private sealed record CommitteeLockNotificationItem(
            string UserCode,
            int CommitteeId,
            string CommitteeCode,
            string CommitteeName,
            DateTime? DefenseDate,
            string DefenseDateText,
            string RoleCode,
            string RoleLabel);

        private sealed record StudentLockNotificationItem(
            string UserCode,
            string CommitteeCode,
            string CommitteeName,
            string Room,
            string WeekdayText,
            string DefenseDateText,
            string TimeText);

        private const int MinMembersPerCouncil = 3;
        private const int MaxMembersPerCouncil = 7;
        private const int MinTopicsPerSession = 3;
        private const int MaxTopicsPerSession = 7;
        private static readonly string[] AllowedAdditionalRoles = new[] { "UVPB", "UV" };
        private static readonly TimeSpan SessionDuration = TimeSpan.FromMinutes(60);
        private readonly ApplicationDbContext _db;
        private readonly IUnitOfWork _uow;
        private readonly IHubContext<ChatHub> _hub;
        private readonly ICommitteeConstraintService _constraintService;
        private readonly IDefenseCommitteeHeuristicService _heuristicService;
        private readonly IDefenseScoreWorkflowService _scoreWorkflowService;
        private readonly IDefenseRevisionWorkflowService _revisionWorkflowService;
        private readonly IDefenseAuditTrailService _auditTrailService;
        private readonly IDefenseResiliencePolicy _resiliencePolicy;
        private readonly INotificationEventPublisher _notificationEventPublisher;
        private static string? _cachedRoomCodesReadSql;

        public DefensePeriodCommandProcessor(
            ApplicationDbContext db,
            IUnitOfWork uow,
            IHubContext<ChatHub> hub,
            ICommitteeConstraintService constraintService,
            IDefenseCommitteeHeuristicService heuristicService,
            IDefenseScoreWorkflowService scoreWorkflowService,
            IDefenseRevisionWorkflowService revisionWorkflowService,
            IDefenseAuditTrailService auditTrailService,
            IDefenseResiliencePolicy resiliencePolicy,
            INotificationEventPublisher notificationEventPublisher)
        {
            _db = db;
            _uow = uow;
            _hub = hub;
            _constraintService = constraintService;
            _heuristicService = heuristicService;
            _scoreWorkflowService = scoreWorkflowService;
            _revisionWorkflowService = revisionWorkflowService;
            _auditTrailService = auditTrailService;
            _resiliencePolicy = resiliencePolicy;
            _notificationEventPublisher = notificationEventPublisher;
        }

        public async Task<ApiResponse<SyncDefensePeriodResponseDto>> SyncAsync(int periodId, SyncDefensePeriodRequestDto request, int actorUserId, CancellationToken cancellationToken = default)
        {
            if (await IsIdempotentReplayAsync("SYNC_INPUT", periodId, request.IdempotencyKey, cancellationToken))
            {
                return ApiResponse<SyncDefensePeriodResponseDto>.SuccessResponse(new SyncDefensePeriodResponseDto
                {
                    Message = "Idempotent replay detected. Existing sync request was already processed."
                }, idempotencyReplay: true, code: DefenseUcErrorCodes.Sync.Replay);
            }

            var period = await GetPeriodAsync(periodId, cancellationToken);
            if (period == null)
            {
                return Fail<SyncDefensePeriodResponseDto>("Không tìm thấy đợt đồ án tốt nghiệp", 404);
            }

            await SyncPeriodCouncilIdsFromFkAsync(period, cancellationToken);

            var periodConfig = ReadConfig(period);
            var periodBeforeState = new
            {
                periodConfig.Rooms,
                periodConfig.MorningStart,
                periodConfig.AfternoonStart,
                periodConfig.SoftMaxCapacity,
                periodConfig.CouncilIds,
                periodConfig.LecturerCapabilitiesLocked,
                periodConfig.CouncilConfigConfirmed,
                periodConfig.Finalized,
                periodConfig.ScoresPublished
            };

            try
            {
                var retryResult = await ExecuteWithRetryAsync(
                    async () => await _db.Topics.AsNoTracking()
                        .Where(x => x.DefenseTermId == periodId)
                        .ToListAsync(cancellationToken),
                    request.RetryOnFailure,
                    cancellationToken);

                var topics = retryResult.Data;
                var eligibleTopicCodes = await LoadEligibleTopicCodesFromMilestonesAsync(topics, cancellationToken);
                var rowErrors = new List<SyncRowErrorDto>();
                foreach (var topic in topics)
                {
                    var errors = new List<string>();
                    if (string.IsNullOrWhiteSpace(topic.ProposerStudentCode))
                    {
                        errors.Add("Thiếu StudentCode");
                    }

                    if (string.IsNullOrWhiteSpace(topic.SupervisorLecturerCode))
                    {
                        errors.Add("Thiếu SupervisorCode");
                    }

                    if (!eligibleTopicCodes.Contains(topic.TopicCode))
                    {
                        errors.Add("Topic chưa có trạng thái 'Đủ điều kiện đồ án tốt nghiệp'.");
                    }

                    if (errors.Count > 0)
                    {
                        rowErrors.Add(new SyncRowErrorDto
                        {
                            TopicCode = topic.TopicCode,
                            Errors = errors
                        });
                    }
                }

                var eligibleCount = topics.Count - rowErrors.Count;
                var invalidCount = rowErrors.Count;
                var snapshotVersion = $"period-{periodId}-{DateTime.UtcNow:yyyyMMddHHmmssfff}";
                var errorBreakdown = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
                foreach (var row in rowErrors)
                {
                    foreach (var err in row.Errors)
                    {
                        if (!errorBreakdown.ContainsKey(err))
                        {
                            errorBreakdown[err] = 0;
                        }

                        errorBreakdown[err]++;
                    }
                }

                var readiness = BuildSyncReadiness(periodConfig, eligibleCount);

                await AddAuditSnapshotAsync(
                    "SYNC_INPUT",
                    "SUCCESS",
                    periodBeforeState,
                    new
                    {
                        SnapshotVersion = snapshotVersion,
                        EligibleCount = eligibleCount,
                        InvalidCount = invalidCount,
                        Attempts = retryResult.Attempts,
                        Readiness = readiness,
                        ErrorBreakdown = errorBreakdown
                    },
                    new
                    {
                        PeriodId = periodId,
                        RowErrorSample = rowErrors.Take(100).ToList(),
                        Actor = actorUserId
                    },
                    actorUserId,
                    cancellationToken);

                return ApiResponse<SyncDefensePeriodResponseDto>.SuccessResponse(new SyncDefensePeriodResponseDto
                {
                    TotalPulled = topics.Count,
                    EligibleCount = eligibleCount,
                    InvalidCount = invalidCount,
                    RetryAttempts = retryResult.Attempts,
                    SnapshotVersion = snapshotVersion,
                    Readiness = readiness,
                    ErrorBreakdown = errorBreakdown,
                    RowErrors = rowErrors,
                    Message = retryResult.Attempts > 1
                        ? $"Sync completed after {retryResult.Attempts} attempts."
                        : "Sync completed."
                }, code: DefenseUcErrorCodes.Sync.Success);
            }
            catch (OperationCanceledException)
            {
                await AddAuditSnapshotAsync(
                    "SYNC_INPUT",
                    "TIMEOUT",
                    periodBeforeState,
                    null,
                    new { PeriodId = periodId, Actor = actorUserId },
                    actorUserId,
                    CancellationToken.None);
                return Fail<SyncDefensePeriodResponseDto>("Sync timeout. Vui lòng thử lại.", 408, DefenseUcErrorCodes.Sync.Timeout);
            }
            catch (Exception ex)
            {
                await AddAuditSnapshotAsync(
                    "SYNC_INPUT",
                    "FAILED",
                    periodBeforeState,
                    null,
                    new { PeriodId = periodId, Actor = actorUserId, Error = ex.Message },
                    actorUserId,
                    CancellationToken.None);
                return Fail<SyncDefensePeriodResponseDto>("Sync thất bại. Vui lòng thử lại.", 500, DefenseUcErrorCodes.Sync.Failed);
            }
        }

        public async Task<ApiResponse<bool>> UpdateConfigAsync(int periodId, UpdateDefensePeriodConfigDto request, int actorUserId, CancellationToken cancellationToken = default)
        {
            try
            {
                var period = await EnsurePeriodAsync(periodId, cancellationToken);
                var config = ReadConfig(period);
                EnsureCouncilListUnlocked(config);
                var beforeState = new
                {
                    period.StartDate,
                    period.EndDate,
                    config.Rooms,
                    config.MorningStart,
                    config.AfternoonStart,
                    config.SoftMaxCapacity
                };

                var topicsPerSession = NormalizeTopicsPerSession(config.CouncilConfig.TopicsPerSessionConfig);
                ValidatePeriodConfig(request, topicsPerSession);

                var nextStartDate = request.StartDate?.Date ?? period.StartDate.Date;
                var nextEndDate = request.EndDate?.Date ?? period.EndDate?.Date;
                ValidateDefensePeriodWindow(nextStartDate, nextEndDate);

                var existingCouncilDates = await _db.Committees.AsNoTracking()
                    .Where(x => config.CouncilIds.Contains(x.CommitteeID))
                    .Select(x => new { x.CommitteeID, x.CommitteeCode, x.DefenseDate })
                    .ToListAsync(cancellationToken);

                var invalidCouncil = existingCouncilDates.FirstOrDefault(x => !x.DefenseDate.HasValue || x.DefenseDate.Value.Date < nextStartDate || (nextEndDate.HasValue && x.DefenseDate.Value.Date > nextEndDate.Value));
                if (invalidCouncil != null)
                {
                    throw new BusinessRuleException(
                        "Khoảng ngày mới không bao phủ toàn bộ hội đồng hiện tại.",
                        "UC1.2.DATE_RANGE_CONFLICT",
                        new { invalidCouncil.CommitteeID, invalidCouncil.CommitteeCode, invalidCouncil.DefenseDate, nextStartDate, nextEndDate });
                }

                config.Rooms = await NormalizeAndValidateRoomCodesAsync(request.Rooms, cancellationToken, "UC1.2.ROOM_NOT_FOUND");
                config.MorningStart = request.MorningStart;
                config.AfternoonStart = request.AfternoonStart;
                config.SoftMaxCapacity = request.SoftMaxCapacity;
                period.StartDate = nextStartDate;
                period.EndDate = nextEndDate;

                period.ConfigJson = JsonSerializer.Serialize(config);
                period.LastUpdated = DateTime.UtcNow;
                _uow.DefenseTerms.Update(period);
                await _uow.SaveChangesAsync();

                await AddAuditSnapshotAsync(
                    "UPDATE_PERIOD_CONFIG",
                    "SUCCESS",
                    beforeState,
                    new
                    {
                        period.StartDate,
                        period.EndDate,
                        config.Rooms,
                        config.MorningStart,
                        config.AfternoonStart,
                        config.SoftMaxCapacity
                    },
                    new { PeriodId = periodId },
                    actorUserId,
                    cancellationToken);
                return ApiResponse<bool>.SuccessResponse(true);
            }
            catch (BusinessRuleException ex)
            {
                return Fail<bool>(ex.Message, 400, ResolveUcCode(ex.Code, "UC1.2"), ex.Details);
            }
        }

        public async Task<ApiResponse<bool>> LockLecturerCapabilitiesAsync(int periodId, int actorUserId, CancellationToken cancellationToken = default)
        {
            try
            {
                var period = await EnsurePeriodAsync(periodId, cancellationToken);
                var config = ReadConfig(period);
                var beforeLocked = config.LecturerCapabilitiesLocked;
                config.LecturerCapabilitiesLocked = true;
                period.ConfigJson = JsonSerializer.Serialize(config);
                period.LastUpdated = DateTime.UtcNow;
                _uow.DefenseTerms.Update(period);
                await _uow.SaveChangesAsync();

                await AddAuditSnapshotAsync(
                    "LOCK_LECTURER_CAPABILITIES",
                    "SUCCESS",
                    new { LecturerCapabilitiesLocked = beforeLocked },
                    new { config.LecturerCapabilitiesLocked },
                    new { PeriodId = periodId },
                    actorUserId,
                    cancellationToken);
                return ApiResponse<bool>.SuccessResponse(true);
            }
            catch (BusinessRuleException ex)
            {
                return Fail<bool>(ex.Message, 400, ResolveUcCode(ex.Code, "UC1.3"), ex.Details);
            }
        }

        public async Task<ApiResponse<bool>> ConfirmCouncilConfigAsync(int periodId, ConfirmCouncilConfigDto request, int actorUserId, CancellationToken cancellationToken = default)
        {
            try
            {
                if (request.TopicsPerSessionConfig < MinTopicsPerSession || request.TopicsPerSessionConfig > MaxTopicsPerSession)
                {
                    throw new BusinessRuleException("topicsPerSessionConfig phải trong khoảng 3-7.");
                }

                if (request.MembersPerCouncilConfig < MinMembersPerCouncil || request.MembersPerCouncilConfig > MaxMembersPerCouncil)
                {
                    throw new BusinessRuleException("membersPerCouncilConfig phải trong khoảng 3-7.");
                }

                var period = await EnsurePeriodAsync(periodId, cancellationToken);
                var config = ReadConfig(period);
                EnsureCouncilListUnlocked(config);
                var normalizedConfigTags = NormalizeTagCodes(request.Tags);
                var tagCatalogByCode = await LoadTagCatalogByCodeAsync(cancellationToken);
                EnsureTagCodesExist(normalizedConfigTags, tagCatalogByCode, "UC2.1.TAG_NOT_FOUND");

                var beforeConfig = new
                {
                    config.CouncilConfigConfirmed,
                    config.CouncilConfig.TopicsPerSessionConfig,
                    config.CouncilConfig.MembersPerCouncilConfig,
                    config.CouncilConfig.Tags
                };
                config.CouncilConfig = new ConfirmCouncilConfigDto
                {
                    TopicsPerSessionConfig = request.TopicsPerSessionConfig,
                    MembersPerCouncilConfig = request.MembersPerCouncilConfig,
                    Tags = normalizedConfigTags
                };
                config.CouncilConfigConfirmed = true;
                period.ConfigJson = JsonSerializer.Serialize(config);
                period.LastUpdated = DateTime.UtcNow;

                _uow.DefenseTerms.Update(period);
                await _uow.SaveChangesAsync();
                await AddAuditSnapshotAsync(
                    "CONFIRM_COUNCIL_CONFIG",
                    "SUCCESS",
                    beforeConfig,
                    new
                    {
                        config.CouncilConfigConfirmed,
                        config.CouncilConfig.TopicsPerSessionConfig,
                        config.CouncilConfig.MembersPerCouncilConfig,
                        config.CouncilConfig.Tags
                    },
                    new { PeriodId = periodId },
                    actorUserId,
                    cancellationToken);

                return ApiResponse<bool>.SuccessResponse(true);
            }
            catch (BusinessRuleException ex)
            {
                return Fail<bool>(ex.Message, 400, ResolveUcCode(ex.Code, "UC2.1"), ex.Details);
            }
        }

        public async Task<ApiResponse<List<CouncilDraftDto>>> GenerateCouncilsAsync(int periodId, GenerateCouncilsRequestDto request, int actorUserId, CancellationToken cancellationToken = default)
        {
            if (await IsIdempotentReplayAsync("GENERATE_COUNCILS", periodId, request.IdempotencyKey, cancellationToken))
            {
                var periodState = await GetPeriodAsync(periodId, cancellationToken);
                if (periodState == null)
                {
                    return Fail<List<CouncilDraftDto>>("Không tìm thấy đợt đồ án tốt nghiệp", 404);
                }

                await SyncPeriodCouncilIdsFromFkAsync(periodState, cancellationToken);

                var configState = ReadConfig(periodState);
                var replayData = new List<CouncilDraftDto>();
                foreach (var councilId in configState.CouncilIds)
                {
                    replayData.Add(await BuildCouncilDtoAsync(periodId, councilId, null, cancellationToken));
                }

                return ApiResponse<List<CouncilDraftDto>>.SuccessResponse(replayData, code: DefenseUcErrorCodes.Council.GenerateReplay, idempotencyReplay: true);
            }

            await using var tx = await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                var period = await EnsurePeriodAsync(periodId, cancellationToken);
                var config = ReadConfig(period);
                EnsureCouncilListUnlocked(config);
                var beforeCouncilIds = config.CouncilIds.ToList();
                if (config.Finalized)
                {
                    throw new BusinessRuleException("Đợt đồ án tốt nghiệp đã finalize, không thể generate lại hội đồng.");
                }

                if (!config.LecturerCapabilitiesLocked)
                {
                    throw new BusinessRuleException("Cần khóa capability giảng viên trước khi generate hội đồng.");
                }

                if (!config.CouncilConfigConfirmed)
                {
                    throw new BusinessRuleException("Cần xác nhận cấu hình hội đồng (UC 2.1) trước khi tạo hội đồng.");
                }

                var selectedRooms = request.SelectedRooms
                    .Where(x => !string.IsNullOrWhiteSpace(x))
                    .Select(x => x.Trim().ToUpperInvariant())
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();
                if (selectedRooms.Count == 0)
                {
                    selectedRooms = config.Rooms
                        .Where(x => !string.IsNullOrWhiteSpace(x))
                        .Select(x => x.Trim().ToUpperInvariant())
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToList();
                }

                selectedRooms = await NormalizeAndValidateRoomCodesAsync(selectedRooms, cancellationToken, "UC2.2.ROOM_NOT_FOUND");

                if (selectedRooms.Count == 0)
                {
                    throw new BusinessRuleException("Cần chọn ít nhất 1 phòng trước khi generate hội đồng.");
                }

                var selectedTopicCodes = request.SelectedTopicCodes
                    .Where(x => !string.IsNullOrWhiteSpace(x))
                    .Select(x => x.Trim())
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                if (selectedTopicCodes.Count == 0)
                {
                    throw new BusinessRuleException(
                        "Cần chọn ít nhất 1 đề tài đồ án tốt nghiệp trước khi generate hội đồng.",
                        "UC2.2.TOPIC_SELECTION_EMPTY");
                }

                var selectedLecturerCodes = request.SelectedLecturerCodes
                    .Where(x => !string.IsNullOrWhiteSpace(x))
                    .Select(x => x.Trim())
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                if (selectedLecturerCodes.Count == 0)
                {
                    throw new BusinessRuleException(
                        "Cần chọn ít nhất 1 giảng viên tham gia trước khi generate hội đồng.",
                        "UC2.2.LECTURER_SELECTION_EMPTY");
                }

                var scopedStudentCodes = await _db.DefenseTermStudents
                    .AsNoTracking()
                    .Where(x => x.DefenseTermId == periodId && !string.IsNullOrWhiteSpace(x.StudentCode))
                    .Select(x => x.StudentCode)
                    .Distinct()
                    .ToListAsync(cancellationToken);

                if (scopedStudentCodes.Count == 0)
                {
                    throw new BusinessRuleException("Chưa có sinh viên trong scope đợt đồ án tốt nghiệp. Vui lòng cập nhật participants trước khi generate hội đồng.", "UC2.2.STUDENT_SCOPE_EMPTY");
                }

                var candidateTopics = await _db.Topics
                    .AsNoTracking()
                    .Where(t => t.DefenseTermId == periodId
                        && t.ProposerStudentCode != null
                        && scopedStudentCodes.Contains(t.ProposerStudentCode))
                    .OrderBy(t => t.TopicCode)
                    .ToListAsync(cancellationToken);

                var eligibleTopicCodes = await LoadEligibleTopicCodesFromMilestonesAsync(candidateTopics, cancellationToken);
                var eligibleTopics = candidateTopics
                    .Where(t => eligibleTopicCodes.Contains(t.TopicCode))
                    .ToList();

                if (eligibleTopics.Count == 0)
                {
                    throw new BusinessRuleException("Không có đề tài đủ điều kiện để tạo hội đồng.");
                }

                var eligibleTopicMap = eligibleTopics
                    .ToDictionary(x => x.TopicCode, x => x, StringComparer.OrdinalIgnoreCase);

                var invalidSelectedTopicCodes = selectedTopicCodes
                    .Where(code => !eligibleTopicMap.ContainsKey(code))
                    .ToList();

                if (invalidSelectedTopicCodes.Count > 0)
                {
                    throw new BusinessRuleException(
                        "Có đề tài đã chọn không thuộc scope hoặc chưa đủ điều kiện đồ án tốt nghiệp.",
                        "UC2.2.TOPIC_SELECTION_INVALID",
                        new { TopicCodes = invalidSelectedTopicCodes });
                }

                var selectedTopics = selectedTopicCodes
                    .Select(code => eligibleTopicMap[code])
                    .ToList();

                var topicTags = await LoadTopicTagMapAsync(selectedTopics.Select(t => t.TopicCode).ToList(), cancellationToken);

                var scopedLecturerCodes = await _db.DefenseTermLecturers
                    .AsNoTracking()
                    .Where(x => x.DefenseTermId == periodId && !string.IsNullOrWhiteSpace(x.LecturerCode))
                    .Select(x => x.LecturerCode)
                    .Distinct()
                    .ToListAsync(cancellationToken);

                if (scopedLecturerCodes.Count == 0)
                {
                    throw new BusinessRuleException("Chưa có giảng viên trong scope đợt đồ án tốt nghiệp. Vui lòng cập nhật participants trước khi generate hội đồng.", "UC2.2.LECTURER_SCOPE_EMPTY");
                }

                var scopedLecturerSet = scopedLecturerCodes.ToHashSet(StringComparer.OrdinalIgnoreCase);
                var invalidSelectedLecturerCodes = selectedLecturerCodes
                    .Where(code => !scopedLecturerSet.Contains(code))
                    .ToList();

                if (invalidSelectedLecturerCodes.Count > 0)
                {
                    throw new BusinessRuleException(
                        "Có giảng viên đã chọn không thuộc scope đợt đồ án tốt nghiệp.",
                        "UC2.2.LECTURER_SELECTION_INVALID",
                        new { LecturerCodes = invalidSelectedLecturerCodes });
                }

                var lecturers = await _db.DefenseTermLecturers
                    .AsNoTracking()
                    .Where(x => x.DefenseTermId == periodId
                        && !string.IsNullOrWhiteSpace(x.LecturerCode)
                        && selectedLecturerCodes.Contains(x.LecturerCode))
                    .Join(
                        _db.LecturerProfiles.AsNoTracking(),
                        dt => dt.LecturerCode,
                        lp => lp.LecturerCode,
                        (dt, lp) => new { dt, lp })
                    .GroupJoin(
                        _db.Users.AsNoTracking(),
                        x => x.dt.UserCode,
                        u => u.UserCode,
                        (x, users) => new
                        {
                            x.dt.LecturerProfileID,
                            x.dt.LecturerCode,
                            Name = x.lp.FullName,
                            x.dt.UserCode,
                            UserID = users.Select(u => (int?)u.UserID).FirstOrDefault()
                        })
                    .ToListAsync(cancellationToken);

                if (lecturers.Count == 0)
                {
                    throw new BusinessRuleException("Không tìm thấy giảng viên phù hợp trong danh sách đã chọn.", "UC2.2.LECTURER_SELECTION_INVALID");
                }

                var lecturerCodes = lecturers.Select(x => x.LecturerCode).ToList();
                var lecturerTagMap = await LoadLecturerTagMapAsync(lecturerCodes, cancellationToken);

                var historicalWorkloadRows = await _db.CommitteeMembers
                    .AsNoTracking()
                    .Where(x => x.MemberLecturerCode != null)
                    .Select(x => x.MemberLecturerCode!)
                    .ToListAsync(cancellationToken);

                var historicalWorkloadMap = historicalWorkloadRows
                    .GroupBy(x => x, StringComparer.OrdinalIgnoreCase)
                    .ToDictionary(g => g.Key, g => g.Count(), StringComparer.OrdinalIgnoreCase);

                var runtimeWorkloadMap = new Dictionary<string, int>(historicalWorkloadMap, StringComparer.OrdinalIgnoreCase);
                var runtimeConsecutiveCommitteeMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

                var previousCouncilIds = config.CouncilIds.ToHashSet();
                if (previousCouncilIds.Count > 0)
                {
                    var previousAssignments = await _db.DefenseAssignments.Where(x => x.CommitteeID.HasValue && previousCouncilIds.Contains(x.CommitteeID.Value)).ToListAsync(cancellationToken);
                    var previousMembers = await _db.CommitteeMembers.Where(x => x.CommitteeID.HasValue && previousCouncilIds.Contains(x.CommitteeID.Value)).ToListAsync(cancellationToken);
                    var previousTags = await _db.CommitteeTags.Where(x => previousCouncilIds.Contains(x.CommitteeID)).ToListAsync(cancellationToken);
                    var previousCommittees = await _db.Committees.Where(x => previousCouncilIds.Contains(x.CommitteeID)).ToListAsync(cancellationToken);

                    _db.DefenseAssignments.RemoveRange(previousAssignments);
                    _db.CommitteeMembers.RemoveRange(previousMembers);
                    _db.CommitteeTags.RemoveRange(previousTags);
                    _db.Committees.RemoveRange(previousCommittees);
                }

                config.CouncilIds = new List<int>();
                
                // Validate and build defense date range from request or period config
                var generationStartDate = request.GenerationStartDate ?? period.StartDate;
                var generationEndDate = request.GenerationEndDate ?? period.EndDate;
                ValidateDefensePeriodWindow(generationStartDate, generationEndDate);
                
                var defenseDates = BuildDefenseDateRange(generationStartDate, generationEndDate);
                var occupiedRoomDateSlots = (await _db.Committees.AsNoTracking()
                        .Where(x => x.DefenseTermId == periodId
                            && x.DefenseDate.HasValue
                            && !string.IsNullOrWhiteSpace(x.Room)
                            && !previousCouncilIds.Contains(x.CommitteeID))
                        .Select(x => new { x.Room, x.DefenseDate })
                        .ToListAsync(cancellationToken))
                    .Select(x => BuildRoomDateSlotKey(NormalizeRoomCode(x.Room!, "UC2.2.ROOM_INVALID"), x.DefenseDate!.Value.Date))
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);
                
                // Track councils per day for daily limit enforcement (key format: yyyy-MM-dd)
                var councilsPerDay = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

                var requestTags = NormalizeTagCodes(request.Tags).ToHashSet(StringComparer.OrdinalIgnoreCase);
                var configuredTags = NormalizeTagCodes(config.CouncilConfig.Tags).ToHashSet(StringComparer.OrdinalIgnoreCase);
                var preferredTags = requestTags.Count > 0 ? requestTags : configuredTags;
                var tagCatalogByCode = await LoadTagCatalogByCodeAsync(cancellationToken);
                EnsureTagCodesExist(preferredTags, tagCatalogByCode, "UC2.2.TAG_NOT_FOUND");

                var topics = preferredTags.Count == 0
                    ? selectedTopics
                    : selectedTopics.OrderByDescending(t => topicTags.TryGetValue(t.TopicCode, out var set) && set.Any(preferredTags.Contains)).ThenBy(t => t.TopicCode).ToList();

                var councils = new List<CouncilDraftDto>();
                var now = DateTime.UtcNow;
                var roomIndex = 0;
                var councilIndex = 1;

                var topicsPerSession = NormalizeTopicsPerSession(config.CouncilConfig.TopicsPerSessionConfig);
                var membersPerCouncil = NormalizeMembersPerCouncil(config.CouncilConfig.MembersPerCouncilConfig);
                var topicsPerCouncil = topicsPerSession * 2;

                for (var i = 0; i < topics.Count; i += topicsPerCouncil)
                {
                    var chunk = topics.Skip(i).Take(topicsPerCouncil).ToList();
                    if (chunk.Count < topicsPerCouncil)
                    {
                        break;
                    }

                    if (!TryAllocateRoomDateSlot(selectedRooms, defenseDates, occupiedRoomDateSlots, ref roomIndex, out var room, out var defenseDate))
                    {
                        throw new BusinessRuleException(
                            "Không còn slot phòng/ngày trống để xếp hội đồng tự động trong khoảng ngày hiện tại.",
                            "UC2.2.ROOM_DATE_CAPACITY_EXCEEDED",
                            new
                            {
                                Rooms = selectedRooms,
                                DateRange = new { From = defenseDates.First(), To = defenseDates.Last() },
                                AssignedCouncils = councils.Count
                            });
                    }
                    
                    // Check daily council limit if specified
                    if (request.MaxCouncilsPerDay > 0)
                    {
                        var defenseDayKey = defenseDate.Date.ToString("yyyy-MM-dd");
                        if (!councilsPerDay.ContainsKey(defenseDayKey))
                        {
                            councilsPerDay[defenseDayKey] = 0;
                        }
                        
                        if (councilsPerDay[defenseDayKey] >= request.MaxCouncilsPerDay)
                        {
                            throw new BusinessRuleException(
                                $"Vượt quá giới hạn {request.MaxCouncilsPerDay} hội đồng/ngày vào {defenseDayKey}.",
                                "UC2.2.DAILY_COUNCIL_LIMIT_EXCEEDED",
                                new
                                {
                                    Day = defenseDayKey,
                                    MaxCouncilsPerDay = request.MaxCouncilsPerDay,
                                    CurrentCount = councilsPerDay[defenseDayKey]
                                });
                        }
                        
                        councilsPerDay[defenseDayKey]++;
                    }

                    var generatedCode = await GenerateUniqueCommitteeCodeAsync(periodId, request.IdempotencyKey, cancellationToken);
                    var committee = new Committee
                    {
                        CommitteeCode = generatedCode,
                        Name = $"Hội đồng {councilIndex}",
                        DefenseDate = defenseDate,
                        Room = room,
                        DefenseTermId = periodId,
                        Status = "Draft",
                        CreatedAt = now,
                        LastUpdated = now
                    };

                    await _uow.Committees.AddAsync(committee);
                    await _uow.SaveChangesAsync();

                    config.CouncilIds.Add(committee.CommitteeID);

                    var morning = chunk.Take(topicsPerSession).ToList();
                    var afternoon = chunk.Skip(topicsPerSession).Take(topicsPerSession).ToList();
                    var allCodes = chunk.Select(x => x.SupervisorLecturerCode).Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x!.Trim()).ToHashSet(StringComparer.OrdinalIgnoreCase);

                    var topicDerivedCouncilTags = NormalizeTagCodes(
                            chunk.SelectMany(t => topicTags.TryGetValue(t.TopicCode, out var tags) ? tags.AsEnumerable() : Enumerable.Empty<string>()))
                        .ToHashSet(StringComparer.OrdinalIgnoreCase);

                    var heuristicTargetTags = preferredTags.Count > 0
                        ? preferredTags.ToHashSet(StringComparer.OrdinalIgnoreCase)
                        : topicDerivedCouncilTags;

                    var rankedLecturerCodes = _heuristicService
                        .RankLecturers(
                            lecturers
                                .Where(l => !allCodes.Contains(l.LecturerCode))
                                .Select(l => new LecturerHeuristicCandidate
                                {
                                    LecturerCode = l.LecturerCode,
                                    Tags = lecturerTagMap.TryGetValue(l.LecturerCode, out var tags)
                                        ? tags
                                        : new HashSet<string>(StringComparer.OrdinalIgnoreCase),
                                    Workload = runtimeWorkloadMap.TryGetValue(l.LecturerCode, out var load) ? load : 0,
                                    ConsecutiveCommitteeAssignments = runtimeConsecutiveCommitteeMap.TryGetValue(l.LecturerCode, out var streak) ? streak : 0
                                })
                                .ToList(),
                            heuristicTargetTags,
                            request.Strategy?.HeuristicWeights)
                        .Take(membersPerCouncil)
                        .Select(x => x.LecturerCode)
                        .ToList();

                    var availableLecturers = lecturers
                        .Where(x => rankedLecturerCodes.Contains(x.LecturerCode, StringComparer.OrdinalIgnoreCase))
                        .OrderBy(x => rankedLecturerCodes.FindIndex(code => string.Equals(code, x.LecturerCode, StringComparison.OrdinalIgnoreCase)))
                        .ToList();

                    var selectedLecturerTags = NormalizeTagCodes(
                            availableLecturers.SelectMany(l => lecturerTagMap.TryGetValue(l.LecturerCode, out var tags) ? tags.AsEnumerable() : Enumerable.Empty<string>()))
                        .ToHashSet(StringComparer.OrdinalIgnoreCase);

                    var finalCouncilTags = preferredTags.Count > 0
                        ? heuristicTargetTags
                        : topicDerivedCouncilTags
                            .Union(selectedLecturerTags, StringComparer.OrdinalIgnoreCase)
                            .ToHashSet(StringComparer.OrdinalIgnoreCase);

                    await AddCommitteeTagsAsync(
                        committee,
                        ResolveTagEntities(finalCouncilTags, tagCatalogByCode, "UC2.2.TAG_NOT_FOUND"),
                        now,
                        cancellationToken);

                    var rolePlan = BuildRolePlan(membersPerCouncil);
                    var warning = string.Empty;

                    if (availableLecturers.Count < membersPerCouncil)
                    {
                        warning = "Không đủ giảng viên phù hợp theo ràng buộc GVHD/Tag.";
                    }

                    for (var m = 0; m < Math.Min(availableLecturers.Count, membersPerCouncil); m++)
                    {
                        var lecturer = availableLecturers[m];
                        await _uow.CommitteeMembers.AddAsync(new CommitteeMember
                        {
                            CommitteeID = committee.CommitteeID,
                            CommitteeCode = committee.CommitteeCode,
                            MemberLecturerProfileID = lecturer.LecturerProfileID,
                            MemberLecturerCode = lecturer.LecturerCode,
                            MemberUserCode = lecturer.UserCode,
                            MemberUserID = lecturer.UserID,
                            Role = rolePlan[m],
                            IsChair = rolePlan[m] == "CT",
                            CreatedAt = now,
                            LastUpdated = now
                        });

                        runtimeWorkloadMap[lecturer.LecturerCode] = (runtimeWorkloadMap.TryGetValue(lecturer.LecturerCode, out var currentLoad) ? currentLoad : 0) + 1;
                    }

                    var selectedLecturerSet = availableLecturers
                        .Select(x => x.LecturerCode)
                        .ToHashSet(StringComparer.OrdinalIgnoreCase);

                    foreach (var lecturer in lecturers)
                    {
                        if (selectedLecturerSet.Contains(lecturer.LecturerCode))
                        {
                            runtimeConsecutiveCommitteeMap[lecturer.LecturerCode] =
                                (runtimeConsecutiveCommitteeMap.TryGetValue(lecturer.LecturerCode, out var streak) ? streak : 0) + 1;
                            continue;
                        }

                        runtimeConsecutiveCommitteeMap[lecturer.LecturerCode] = 0;
                    }

                    if (availableLecturers.Count == membersPerCouncil)
                    {
                        committee.Status = "Ready";
                    }
                    else
                    {
                        committee.Status = "Warning";
                    }

                    var morningStart = ParseTime(config.MorningStart, new TimeSpan(7, 30, 0));
                    var afternoonStart = ParseTime(config.AfternoonStart, new TimeSpan(13, 30, 0));

                    for (var idx = 0; idx < morning.Count; idx++)
                    {
                        var t = morning[idx];
                        var start = morningStart.Add(TimeSpan.FromMinutes(idx * 60));
                        await CreateAssignmentAsync(committee, t, 1, idx + 1, start, now, cancellationToken);
                    }

                    for (var idx = 0; idx < afternoon.Count; idx++)
                    {
                        var t = afternoon[idx];
                        var start = afternoonStart.Add(TimeSpan.FromMinutes(idx * 60));
                        await CreateAssignmentAsync(committee, t, 2, idx + 1, start, now, cancellationToken);
                    }

                    await _uow.SaveChangesAsync();

                    councils.Add(await BuildCouncilDtoAsync(periodId, committee.CommitteeID, warning, cancellationToken));
                    councilIndex++;
                }

                period.ConfigJson = JsonSerializer.Serialize(config);
                period.LastUpdated = now;
                _uow.DefenseTerms.Update(period);
                await _uow.SaveChangesAsync();

                await AddAuditSnapshotAsync(
                    "GENERATE_COUNCILS",
                    "SUCCESS",
                    new { PeriodId = periodId, CouncilIds = beforeCouncilIds, CouncilCount = beforeCouncilIds.Count },
                    new { PeriodId = periodId, CouncilIds = config.CouncilIds, CouncilCount = councils.Count },
                    new
                    {
                        GeneratedCount = councils.Count,
                        RequestTags = request.Tags,
                        request.SelectedTopicCodes,
                        request.SelectedLecturerCodes
                    },
                    actorUserId,
                    cancellationToken);
                await tx.CommitAsync(cancellationToken);
                await SendDefenseHubEventAsync("DefenseCouncilsGenerated", new { PeriodId = periodId, Count = councils.Count }, cancellationToken);

                return ApiResponse<List<CouncilDraftDto>>.SuccessResponse(councils);
            }
            catch (BusinessRuleException ex)
            {
                await tx.RollbackAsync(cancellationToken);
                return Fail<List<CouncilDraftDto>>(ex.Message, 400, ResolveUcCode(ex.Code, "UC2.2"), ex.Details);
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync(cancellationToken);
                return Fail<List<CouncilDraftDto>>(ex.Message, 500);
            }
        }

        public async Task<ApiResponse<bool>> LockCouncilsAsync(int periodId, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default)
        {
            var requestHash = ComputeRequestHash("UC2.6.LOCK_COUNCILS", periodId, idempotencyKey ?? string.Empty);
            var replay = await TryReplayResponseAsync<bool>("LOCK_COUNCILS", periodId, idempotencyKey, requestHash, cancellationToken);
            if (replay != null)
            {
                return replay;
            }

            ApiResponse<bool> response;
            await using var tx = await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                var period = await EnsurePeriodAsync(periodId, cancellationToken);
                var config = ReadConfig(period);

                if (config.CouncilListLocked)
                {
                    return ApiResponse<bool>.SuccessResponse(true, code: "UC2.LOCK_COUNCILS.ALREADY_LOCKED");
                }

                if (config.Finalized || config.ScoresPublished)
                {
                    throw new BusinessRuleException("Đợt đồ án tốt nghiệp đã finalize/publish, không thể chốt danh sách hội đồng.", "UC2.6.INVALID_PERIOD_STATE");
                }

                if (!config.LecturerCapabilitiesLocked)
                {
                    throw new BusinessRuleException("Cần khóa capability giảng viên trước khi chốt danh sách hội đồng.", "UC2.6.LECTURER_CAPABILITIES_UNLOCKED");
                }

                if (!config.CouncilConfigConfirmed)
                {
                    throw new BusinessRuleException("Cần xác nhận cấu hình hội đồng trước khi chốt danh sách.", "UC2.6.COUNCIL_CONFIG_NOT_CONFIRMED");
                }

                if (config.CouncilIds.Count == 0)
                {
                    throw new BusinessRuleException("Chưa có hội đồng để chốt danh sách.", "UC2.6.NO_COUNCILS");
                }

                var councils = await GetPeriodCommitteesAsync(periodId, config, cancellationToken);
                if (councils.Count == 0)
                {
                    throw new BusinessRuleException("Không tìm thấy hội đồng trong đợt để chốt danh sách.", "UC2.6.NO_COUNCILS");
                }

                var warnings = new List<string>();
                var now = DateTime.UtcNow;

                foreach (var council in councils)
                {
                    var councilStatus = DefenseWorkflowStateMachine.ParseCommitteeStatus(council.Status);
                    if (councilStatus == CommitteeStatus.Ongoing
                        || councilStatus == CommitteeStatus.Completed
                        || councilStatus == CommitteeStatus.Finalized
                        || councilStatus == CommitteeStatus.Published)
                    {
                        throw new BusinessRuleException(
                            "Đã có hội đồng bắt đầu/kết thúc đồ án tốt nghiệp, không thể chốt lại danh sách.",
                            "UC2.6.INVALID_COMMITTEE_STATE",
                            new { council.CommitteeID, council.CommitteeCode, council.Status });
                    }

                    var validation = await ValidateCouncilHardRulesAsync(
                        council.CommitteeID,
                        cancellationToken);

                    if (!string.IsNullOrWhiteSpace(validation))
                    {
                        warnings.Add($"{council.CommitteeCode}: {validation}");
                        council.Status = "Warning";
                    }
                    else if (councilStatus == CommitteeStatus.Draft
                        || string.Equals(council.Status, "Warning", StringComparison.OrdinalIgnoreCase))
                    {
                        council.Status = DefenseWorkflowStateMachine.ToValue(CommitteeStatus.Ready);
                    }

                    council.LastUpdated = now;
                    _uow.Committees.Update(council);
                }

                if (warnings.Count > 0)
                {
                    throw new BusinessRuleException(
                        "Không thể chốt danh sách hội đồng vì vẫn còn cảnh báo cấu hình.",
                        "UC2.6.COUNCIL_VALIDATION_FAILED",
                        warnings);
                }

                var beforeState = new
                {
                    period.Status,
                    config.CouncilListLocked,
                    CouncilCount = config.CouncilIds.Count
                };

                config.CouncilListLocked = true;
                period.ConfigJson = JsonSerializer.Serialize(config);
                period.LastUpdated = now;
                _uow.DefenseTerms.Update(period);

                await _uow.SaveChangesAsync();
                await tx.CommitAsync(cancellationToken);

                await AddAuditSnapshotAsync(
                    "LOCK_COUNCILS",
                    "SUCCESS",
                    beforeState,
                    new
                    {
                        period.Status,
                        config.CouncilListLocked,
                        CouncilCount = config.CouncilIds.Count
                    },
                    new { PeriodId = periodId, CouncilCount = councils.Count },
                    actorUserId,
                    cancellationToken);

                await SendDefenseHubEventAsync("DefenseCouncilsLocked", new { PeriodId = periodId, CouncilCount = councils.Count }, cancellationToken);
                await NotifyCouncilListLockedAsync(period, councils, cancellationToken);
                response = ApiResponse<bool>.SuccessResponse(true);
            }
            catch (BusinessRuleException ex)
            {
                await tx.RollbackAsync(cancellationToken);
                response = Fail<bool>(ex.Message, 400, ResolveUcCode(ex.Code, "UC2.6"), ex.Details);
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync(cancellationToken);
                response = Fail<bool>(ex.Message, 500, "UC2.6.LOCK_COUNCILS_FAILED");
            }

            await SaveIdempotencyResponseAsync("LOCK_COUNCILS", periodId, idempotencyKey, requestHash, response, cancellationToken);
            return response;
        }

        public async Task<ApiResponse<bool>> ReopenCouncilsAsync(int periodId, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default)
        {
            var requestHash = ComputeRequestHash("UC2.6.REOPEN_COUNCILS", periodId, idempotencyKey ?? string.Empty);
            var replay = await TryReplayResponseAsync<bool>("REOPEN_COUNCILS", periodId, idempotencyKey, requestHash, cancellationToken);
            if (replay != null)
            {
                return replay;
            }

            ApiResponse<bool> response;
            await using var tx = await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                var period = await EnsurePeriodAsync(periodId, cancellationToken);
                var config = ReadConfig(period);

                if (!config.CouncilListLocked)
                {
                    return ApiResponse<bool>.SuccessResponse(true, code: "UC2.REOPEN_COUNCILS.ALREADY_OPEN");
                }

                if (config.Finalized || config.ScoresPublished)
                {
                    throw new BusinessRuleException("Đợt đồ án tốt nghiệp đã finalize/publish, không thể mở lại danh sách hội đồng.", "UC2.6.INVALID_PERIOD_STATE");
                }

                var councils = await GetPeriodCommitteesAsync(periodId, config, cancellationToken);
                var blockedCouncil = councils.FirstOrDefault(council =>
                {
                    var status = DefenseWorkflowStateMachine.ParseCommitteeStatus(council.Status);
                    return status == CommitteeStatus.Ongoing
                        || status == CommitteeStatus.Completed
                        || status == CommitteeStatus.Finalized
                        || status == CommitteeStatus.Published;
                });

                if (blockedCouncil != null)
                {
                    throw new BusinessRuleException(
                        "Đã có hội đồng bắt đầu/kết thúc đồ án tốt nghiệp, không thể mở lại danh sách.",
                        "UC2.6.INVALID_COMMITTEE_STATE",
                        new { blockedCouncil.CommitteeID, blockedCouncil.CommitteeCode, blockedCouncil.Status });
                }

                var now = DateTime.UtcNow;
                var beforeState = new
                {
                    period.Status,
                    config.CouncilListLocked,
                    CouncilCount = config.CouncilIds.Count
                };

                config.CouncilListLocked = false;
                period.ConfigJson = JsonSerializer.Serialize(config);
                period.LastUpdated = now;
                _uow.DefenseTerms.Update(period);

                await _uow.SaveChangesAsync();
                await tx.CommitAsync(cancellationToken);

                await AddAuditSnapshotAsync(
                    "REOPEN_COUNCILS",
                    "SUCCESS",
                    beforeState,
                    new
                    {
                        period.Status,
                        config.CouncilListLocked,
                        CouncilCount = config.CouncilIds.Count
                    },
                    new { PeriodId = periodId },
                    actorUserId,
                    cancellationToken);

                await SendDefenseHubEventAsync("DefenseCouncilsReopened", new { PeriodId = periodId }, cancellationToken);
                response = ApiResponse<bool>.SuccessResponse(true);
            }
            catch (BusinessRuleException ex)
            {
                await tx.RollbackAsync(cancellationToken);
                response = Fail<bool>(ex.Message, 400, ResolveUcCode(ex.Code, "UC2.6"), ex.Details);
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync(cancellationToken);
                response = Fail<bool>(ex.Message, 500, "UC2.6.REOPEN_COUNCILS_FAILED");
            }

            await SaveIdempotencyResponseAsync("REOPEN_COUNCILS", periodId, idempotencyKey, requestHash, response, cancellationToken);
            return response;
        }

        public async Task<ApiResponse<CouncilDraftDto>> CreateCouncilAsync(int periodId, CouncilUpsertDto request, int actorUserId, CancellationToken cancellationToken = default)
        {
            await using var tx = await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                var period = await EnsurePeriodAsync(periodId, cancellationToken);
                var config = ReadConfig(period);
                EnsureCouncilListUnlocked(config);
                if (config.Finalized)
                {
                    throw new BusinessRuleException("Đợt đồ án tốt nghiệp đã finalize, không thể tạo mới hội đồng.");
                }

                if (!config.CouncilConfigConfirmed)
                {
                    throw new BusinessRuleException("Cần xác nhận cấu hình hội đồng (UC 2.1) trước khi tạo hội đồng.");
                }

                await ValidateCouncilPayloadAsync(periodId, config, request, cancellationToken);
                EnsureCouncilDateWithinPeriod(period, period.StartDate.Date);
                var normalizedRoom = await EnsureRoomCodeExistsAsync(request.Room, cancellationToken, "UC2.3.ROOM_NOT_FOUND");
                await EnsureRoomDateSlotAvailableAsync(periodId, normalizedRoom, period.StartDate.Date, null, cancellationToken, "UC2.3.ROOM_DATE_CONFLICT");

                var now = DateTime.UtcNow;
                var uniqueCommitteeCode = await GenerateUniqueCommitteeCodeAsync(periodId, null, cancellationToken);
                var committee = new Committee
                {
                    CommitteeCode = uniqueCommitteeCode,
                    Name = "Manual Council",
                    DefenseDate = period.StartDate.Date,
                    Room = normalizedRoom,
                    DefenseTermId = periodId,
                    Status = "Draft",
                    CreatedAt = now,
                    LastUpdated = now
                };

                await _uow.Committees.AddAsync(committee);
                await _uow.SaveChangesAsync();

                await ApplyCouncilPayloadAsync(committee, request, now, cancellationToken);

                if (!config.CouncilIds.Contains(committee.CommitteeID))
                {
                    config.CouncilIds.Add(committee.CommitteeID);
                }

                period.ConfigJson = JsonSerializer.Serialize(config);
                period.LastUpdated = now;
                _uow.DefenseTerms.Update(period);
                await _uow.SaveChangesAsync();
                await tx.CommitAsync(cancellationToken);
                await AddAuditSnapshotAsync(
                    "CREATE_COUNCIL",
                    "SUCCESS",
                    null,
                    new
                    {
                        committee.CommitteeID,
                        committee.CommitteeCode,
                        committee.Room,
                        committee.Status
                    },
                    new { PeriodId = periodId },
                    actorUserId,
                    cancellationToken);

                return ApiResponse<CouncilDraftDto>.SuccessResponse(await BuildCouncilDtoAsync(periodId, committee.CommitteeID, null, cancellationToken));
            }
            catch (BusinessRuleException ex)
            {
                await tx.RollbackAsync(cancellationToken);
                return Fail<CouncilDraftDto>(ex.Message, 400, ResolveUcCode(ex.Code, "UC2.3"), ex.Details);
            }
        }

        public async Task<ApiResponse<CouncilDraftDto>> UpdateCouncilAsync(int periodId, int councilId, CouncilUpsertDto request, int actorUserId, CancellationToken cancellationToken = default)
        {
            await using var tx = await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                var period = await EnsurePeriodAsync(periodId, cancellationToken);
                var config = ReadConfig(period);
                EnsureCouncilListUnlocked(config);
                if (!config.CouncilIds.Contains(councilId))
                {
                    throw new BusinessRuleException("Hội đồng không thuộc đợt đồ án tốt nghiệp này.");
                }

                await ValidateCouncilPayloadAsync(periodId, config, request, cancellationToken);

                var committee = await _db.Committees.FirstOrDefaultAsync(x => x.CommitteeID == councilId, cancellationToken);
                if (committee == null)
                {
                    throw new BusinessRuleException("Không tìm thấy hội đồng.");
                }

                EnsureCouncilDateWithinPeriod(period, committee.DefenseDate);

                if (string.IsNullOrWhiteSpace(request.ConcurrencyToken))
                {
                    throw new BusinessRuleException("Thiếu concurrencyToken khi cập nhật hội đồng.", "UC2.3.CONCURRENCY_TOKEN_REQUIRED");
                }

                var currentToken = committee.LastUpdated.Ticks.ToString(CultureInfo.InvariantCulture);
                if (!string.Equals(currentToken, request.ConcurrencyToken.Trim(), StringComparison.Ordinal))
                {
                    throw new BusinessRuleException(
                        "Dữ liệu hội đồng đã bị thay đổi bởi người khác. Vui lòng tải lại trước khi lưu.",
                        "UC2.3.CONCURRENCY_CONFLICT",
                        new { currentToken, requestToken = request.ConcurrencyToken });
                }

                var normalizedRoom = await EnsureRoomCodeExistsAsync(request.Room, cancellationToken, "UC2.3.ROOM_NOT_FOUND");
                await EnsureRoomDateSlotAvailableAsync(
                    periodId,
                    normalizedRoom,
                    committee.DefenseDate!.Value.Date,
                    councilId,
                    cancellationToken,
                    "UC2.3.ROOM_DATE_CONFLICT");

                var now = DateTime.UtcNow;
                committee.Room = normalizedRoom;
                committee.LastUpdated = now;
                committee.Status = "Draft";

                _uow.Committees.Update(committee);

                var existingAssignments = await _db.DefenseAssignments.Where(x => x.CommitteeID == councilId).ToListAsync(cancellationToken);
                var existingMembers = await _db.CommitteeMembers.Where(x => x.CommitteeID == councilId).ToListAsync(cancellationToken);
                var existingTags = await _db.CommitteeTags.Where(x => x.CommitteeID == councilId).ToListAsync(cancellationToken);

                _db.DefenseAssignments.RemoveRange(existingAssignments);
                _db.CommitteeMembers.RemoveRange(existingMembers);
                _db.CommitteeTags.RemoveRange(existingTags);

                await ApplyCouncilPayloadAsync(committee, request, now, cancellationToken);
                await _uow.SaveChangesAsync();
                await tx.CommitAsync(cancellationToken);
                await AddAuditSnapshotAsync(
                    "UPDATE_COUNCIL",
                    "SUCCESS",
                    null,
                    new
                    {
                        committee.CommitteeID,
                        committee.CommitteeCode,
                        committee.Room,
                        committee.Status,
                        committee.LastUpdated
                    },
                    new { PeriodId = periodId, CouncilId = councilId },
                    actorUserId,
                    cancellationToken);

                return ApiResponse<CouncilDraftDto>.SuccessResponse(await BuildCouncilDtoAsync(periodId, committee.CommitteeID, null, cancellationToken));
            }
            catch (BusinessRuleException ex)
            {
                await tx.RollbackAsync(cancellationToken);
                return Fail<CouncilDraftDto>(ex.Message, 400, ResolveUcCode(ex.Code, "UC2.3"), ex.Details);
            }
        }

        public async Task<ApiResponse<bool>> DeleteCouncilAsync(int periodId, int councilId, int actorUserId, CancellationToken cancellationToken = default)
        {
            await using var tx = await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                var period = await EnsurePeriodAsync(periodId, cancellationToken);
                var config = ReadConfig(period);
                EnsureCouncilListUnlocked(config);
                if (!config.CouncilIds.Contains(councilId))
                {
                    throw new BusinessRuleException("Hội đồng không thuộc đợt đồ án tốt nghiệp này.");
                }

                var committee = await _db.Committees.FirstOrDefaultAsync(x => x.CommitteeID == councilId, cancellationToken);
                if (committee == null)
                {
                    throw new BusinessRuleException("Không tìm thấy hội đồng.");
                }

                var assignments = await _db.DefenseAssignments.Where(x => x.CommitteeID == councilId).ToListAsync(cancellationToken);
                var topicCodes = assignments
                    .Where(x => !string.IsNullOrWhiteSpace(x.TopicCode))
                    .Select(x => x.TopicCode!)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();
                var members = await _db.CommitteeMembers.Where(x => x.CommitteeID == councilId).ToListAsync(cancellationToken);
                var tags = await _db.CommitteeTags.Where(x => x.CommitteeID == councilId).ToListAsync(cancellationToken);

                _db.DefenseAssignments.RemoveRange(assignments);
                await RestoreTopicsToEligibleStatusIfUnassignedAsync(periodId, councilId, topicCodes, DateTime.UtcNow, cancellationToken);
                _db.CommitteeMembers.RemoveRange(members);
                _db.CommitteeTags.RemoveRange(tags);
                _db.Committees.Remove(committee);

                config.CouncilIds.Remove(councilId);
                period.ConfigJson = JsonSerializer.Serialize(config);
                period.LastUpdated = DateTime.UtcNow;
                _uow.DefenseTerms.Update(period);
                await _uow.SaveChangesAsync();

                await tx.CommitAsync(cancellationToken);
                await AddAuditSnapshotAsync(
                    "DELETE_COUNCIL",
                    "SUCCESS",
                    new
                    {
                        committee.CommitteeID,
                        committee.CommitteeCode,
                        committee.Room,
                        committee.Status
                    },
                    null,
                    new { PeriodId = periodId, CouncilId = councilId },
                    actorUserId,
                    cancellationToken);
                return ApiResponse<bool>.SuccessResponse(true);
            }
            catch (BusinessRuleException ex)
            {
                await tx.RollbackAsync(cancellationToken);
                return Fail<bool>(ex.Message, 400, ResolveUcCode(ex.Code, "UC2.3"), ex.Details);
            }
        }

        public async Task<ApiResponse<GenerateCouncilCodeResponseDto>> GenerateCouncilCodeAsync(int periodId, CancellationToken cancellationToken = default)
        {
            try
            {
                _ = await EnsurePeriodAsync(periodId, cancellationToken);
                var code = await GenerateUniqueCommitteeCodeAsync(periodId, null, cancellationToken);
                return ApiResponse<GenerateCouncilCodeResponseDto>.SuccessResponse(new GenerateCouncilCodeResponseDto
                {
                    CommitteeCode = code
                }, code: DefenseUcErrorCodes.AutoCode.Success);
            }
            catch (BusinessRuleException ex)
            {
                return Fail<GenerateCouncilCodeResponseDto>(ex.Message, 400, ResolveUcCode(ex.Code, "UC2.3"), ex.Details);
            }
        }

        public async Task<ApiResponse<CouncilDraftDto>> CreateCouncilStep1Async(int periodId, CouncilWorkflowStep1Dto request, int actorUserId, CancellationToken cancellationToken = default)
        {
            await using var tx = await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                var period = await EnsurePeriodAsync(periodId, cancellationToken);
                var config = ReadConfig(period);
                EnsureCouncilListUnlocked(config);
                if (config.Finalized)
                {
                    throw new BusinessRuleException("Đợt đồ án tốt nghiệp đã finalize, không thể tạo hội đồng mới.", "UC2.3.FINALIZED");
                }

                if (string.IsNullOrWhiteSpace(request.Room))
                {
                    throw new BusinessRuleException("Room là bắt buộc.", "UC2.3.ROOM_REQUIRED");
                }

                EnsureCouncilDateWithinPeriod(period, request.DefenseDate);
                var normalizedRoom = await EnsureRoomCodeExistsAsync(request.Room, cancellationToken, "UC2.3.ROOM_NOT_FOUND");
                await EnsureRoomDateSlotAvailableAsync(periodId, normalizedRoom, request.DefenseDate.Date, null, cancellationToken, "UC2.3.ROOM_DATE_CONFLICT");

                var now = DateTime.UtcNow;
                var uniqueCommitteeCode = await GenerateUniqueCommitteeCodeAsync(periodId, null, cancellationToken);
                var committee = new Committee
                {
                    CommitteeCode = uniqueCommitteeCode,
                    Name = string.IsNullOrWhiteSpace(request.Name) ? $"Hội đồng {uniqueCommitteeCode}" : request.Name.Trim(),
                    DefenseDate = request.DefenseDate.Date,
                    Room = normalizedRoom,
                    DefenseTermId = periodId,
                    Status = "Draft",
                    CreatedAt = now,
                    LastUpdated = now
                };

                await _uow.Committees.AddAsync(committee);
                await _uow.SaveChangesAsync();

                await SaveCouncilTagsAsync(committee, request.CouncilTags, now, cancellationToken);

                if (!config.CouncilIds.Contains(committee.CommitteeID))
                {
                    config.CouncilIds.Add(committee.CommitteeID);
                }

                period.ConfigJson = JsonSerializer.Serialize(config);
                period.LastUpdated = now;
                _uow.DefenseTerms.Update(period);
                await _uow.SaveChangesAsync();

                await tx.CommitAsync(cancellationToken);
                await AddAuditSnapshotAsync(
                    "CREATE_COUNCIL_STEP1",
                    "SUCCESS",
                    null,
                    new
                    {
                        committee.CommitteeID,
                        committee.CommitteeCode,
                        committee.Name,
                        committee.DefenseDate,
                        committee.Room,
                        committee.Status
                    },
                    new { PeriodId = periodId },
                    actorUserId,
                    cancellationToken);
                return ApiResponse<CouncilDraftDto>.SuccessResponse(await BuildCouncilDtoAsync(periodId, committee.CommitteeID, null, cancellationToken));
            }
            catch (BusinessRuleException ex)
            {
                await tx.RollbackAsync(cancellationToken);
                return Fail<CouncilDraftDto>(ex.Message, 400, ResolveUcCode(ex.Code, "UC2.3.STEP1"), ex.Details);
            }
        }

        public async Task<ApiResponse<CouncilDraftDto>> UpdateCouncilStep1Async(int periodId, int councilId, CouncilWorkflowStep1Dto request, int actorUserId, CancellationToken cancellationToken = default)
        {
            await using var tx = await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                var period = await EnsurePeriodAsync(periodId, cancellationToken);
                var config = ReadConfig(period);
                EnsureCouncilListUnlocked(config);
                if (!config.CouncilIds.Contains(councilId))
                {
                    throw new BusinessRuleException("Hội đồng không thuộc đợt đồ án tốt nghiệp này.", "UC2.3.COUNCIL_NOT_IN_PERIOD");
                }

                var committee = await _db.Committees.FirstOrDefaultAsync(x => x.CommitteeID == councilId, cancellationToken);
                if (committee == null)
                {
                    throw new BusinessRuleException("Không tìm thấy hội đồng.", "UC2.3.COUNCIL_NOT_FOUND");
                }

                if (string.IsNullOrWhiteSpace(request.ConcurrencyToken))
                {
                    throw new BusinessRuleException("Thiếu concurrencyToken khi cập nhật hội đồng.", "UC2.3.CONCURRENCY_TOKEN_REQUIRED");
                }

                var currentToken = committee.LastUpdated.Ticks.ToString(CultureInfo.InvariantCulture);
                if (!string.Equals(currentToken, request.ConcurrencyToken.Trim(), StringComparison.Ordinal))
                {
                    throw new BusinessRuleException("Dữ liệu hội đồng đã thay đổi. Vui lòng tải lại trước khi lưu.", "UC2.3.CONCURRENCY_CONFLICT", new { currentToken, requestToken = request.ConcurrencyToken });
                }

                if (string.IsNullOrWhiteSpace(request.Room))
                {
                    throw new BusinessRuleException("Room là bắt buộc.", "UC2.3.ROOM_REQUIRED");
                }

                EnsureCouncilDateWithinPeriod(period, request.DefenseDate);
                var normalizedRoom = await EnsureRoomCodeExistsAsync(request.Room, cancellationToken, "UC2.3.ROOM_NOT_FOUND");
                await EnsureRoomDateSlotAvailableAsync(periodId, normalizedRoom, request.DefenseDate.Date, councilId, cancellationToken, "UC2.3.ROOM_DATE_CONFLICT");

                var now = DateTime.UtcNow;
                committee.Name = string.IsNullOrWhiteSpace(request.Name) ? committee.Name : request.Name.Trim();
                committee.Room = normalizedRoom;
                committee.DefenseDate = request.DefenseDate.Date;
                committee.Status = "Draft";
                committee.LastUpdated = now;
                _uow.Committees.Update(committee);

                await SaveCouncilTagsAsync(committee, request.CouncilTags, now, cancellationToken);
                await _uow.SaveChangesAsync();

                await tx.CommitAsync(cancellationToken);
                await AddAuditSnapshotAsync(
                    "UPDATE_COUNCIL_STEP1",
                    "SUCCESS",
                    null,
                    new
                    {
                        committee.CommitteeID,
                        committee.CommitteeCode,
                        committee.Name,
                        committee.DefenseDate,
                        committee.Room,
                        committee.Status,
                        committee.LastUpdated
                    },
                    new { PeriodId = periodId, CouncilId = councilId },
                    actorUserId,
                    cancellationToken);
                return ApiResponse<CouncilDraftDto>.SuccessResponse(await BuildCouncilDtoAsync(periodId, committee.CommitteeID, null, cancellationToken));
            }
            catch (BusinessRuleException ex)
            {
                await tx.RollbackAsync(cancellationToken);
                return Fail<CouncilDraftDto>(ex.Message, 400, ResolveUcCode(ex.Code, "UC2.3.STEP1"), ex.Details);
            }
        }

        public async Task<ApiResponse<CouncilDraftDto>> SaveCouncilMembersStepAsync(int periodId, int councilId, CouncilWorkflowStep2Dto request, int actorUserId, CancellationToken cancellationToken = default)
        {
            await using var tx = await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                var period = await EnsurePeriodAsync(periodId, cancellationToken);
                var config = ReadConfig(period);
                EnsureCouncilListUnlocked(config);
                if (!config.CouncilIds.Contains(councilId))
                {
                    throw new BusinessRuleException("Hội đồng không thuộc đợt đồ án tốt nghiệp này.", "UC2.3.COUNCIL_NOT_IN_PERIOD");
                }

                var committee = await _db.Committees.FirstOrDefaultAsync(x => x.CommitteeID == councilId, cancellationToken);
                if (committee == null)
                {
                    throw new BusinessRuleException("Không tìm thấy hội đồng.", "UC2.3.COUNCIL_NOT_FOUND");
                }

                if (string.IsNullOrWhiteSpace(request.ConcurrencyToken))
                {
                    throw new BusinessRuleException("Thiếu concurrencyToken khi cập nhật thành viên.", "UC2.3.CONCURRENCY_TOKEN_REQUIRED");
                }

                var currentToken = committee.LastUpdated.Ticks.ToString(CultureInfo.InvariantCulture);
                if (!string.Equals(currentToken, request.ConcurrencyToken.Trim(), StringComparison.Ordinal))
                {
                    throw new BusinessRuleException("Dữ liệu hội đồng đã thay đổi. Vui lòng tải lại trước khi lưu.", "UC2.3.CONCURRENCY_CONFLICT", new { currentToken, requestToken = request.ConcurrencyToken });
                }

                var now = DateTime.UtcNow;
                var existingMembers = await _db.CommitteeMembers.Where(x => x.CommitteeID == councilId).ToListAsync(cancellationToken);
                var beforeMembers = existingMembers
                    .Select(x => new
                    {
                        x.MemberLecturerCode,
                        x.Role,
                        x.IsChair,
                        x.MemberUserCode
                    })
                    .OrderBy(x => x.MemberLecturerCode)
                    .ToList();
                if (existingMembers.Count > 0)
                {
                    _db.CommitteeMembers.RemoveRange(existingMembers);
                }

                await SaveCouncilMembersAsync(committee, request.Members, now, cancellationToken);
                committee.LastUpdated = now;
                committee.Status = DefenseWorkflowStateMachine.ToValue(CommitteeStatus.Draft);
                _uow.Committees.Update(committee);
                await _uow.SaveChangesAsync();

                await tx.CommitAsync(cancellationToken);
                await AddAuditSnapshotAsync(
                    "SAVE_COUNCIL_STEP2_MEMBERS",
                    "SUCCESS",
                    new { CouncilId = councilId, Members = beforeMembers },
                    new
                    {
                        CouncilId = councilId,
                        MemberCount = request.Members.Count,
                        Members = request.Members
                            .Select(x => new { x.LecturerCode, x.Role })
                            .OrderBy(x => x.LecturerCode)
                            .ToList()
                    },
                    new { PeriodId = periodId },
                    actorUserId,
                    cancellationToken);
                return ApiResponse<CouncilDraftDto>.SuccessResponse(await BuildCouncilDtoAsync(periodId, committee.CommitteeID, null, cancellationToken));
            }
            catch (BusinessRuleException ex)
            {
                await tx.RollbackAsync(cancellationToken);
                return Fail<CouncilDraftDto>(ex.Message, 400, ResolveUcCode(ex.Code, "UC2.3.STEP2"), ex.Details);
            }
        }

        public async Task<ApiResponse<CouncilDraftDto>> SaveCouncilTopicsStepAsync(int periodId, int councilId, CouncilWorkflowStep3Dto request, int actorUserId, CancellationToken cancellationToken = default)
        {
            await using var tx = await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                var period = await EnsurePeriodAsync(periodId, cancellationToken);
                var config = ReadConfig(period);
                EnsureCouncilListUnlocked(config);
                if (!config.CouncilIds.Contains(councilId))
                {
                    throw new BusinessRuleException("Hội đồng không thuộc đợt đồ án tốt nghiệp này.", "UC2.3.COUNCIL_NOT_IN_PERIOD");
                }

                var committee = await _db.Committees.FirstOrDefaultAsync(x => x.CommitteeID == councilId, cancellationToken);
                if (committee == null)
                {
                    throw new BusinessRuleException("Không tìm thấy hội đồng.", "UC2.3.COUNCIL_NOT_FOUND");
                }

                if (string.IsNullOrWhiteSpace(request.ConcurrencyToken))
                {
                    throw new BusinessRuleException("Thiếu concurrencyToken khi cập nhật đề tài.", "UC2.3.CONCURRENCY_TOKEN_REQUIRED");
                }

                var currentToken = committee.LastUpdated.Ticks.ToString(CultureInfo.InvariantCulture);
                if (!string.Equals(currentToken, request.ConcurrencyToken.Trim(), StringComparison.Ordinal))
                {
                    throw new BusinessRuleException("Dữ liệu hội đồng đã thay đổi. Vui lòng tải lại trước khi lưu.", "UC2.3.CONCURRENCY_CONFLICT", new { currentToken, requestToken = request.ConcurrencyToken });
                }

                var now = DateTime.UtcNow;
                var existingAssignments = await _db.DefenseAssignments.Where(x => x.CommitteeID == councilId).ToListAsync(cancellationToken);
                var requestedTopicCodes = request.Assignments
                    .Where(x => !string.IsNullOrWhiteSpace(x.TopicCode))
                    .Select(x => x.TopicCode.Trim())
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);
                var removedTopicCodes = existingAssignments
                    .Where(x => !string.IsNullOrWhiteSpace(x.TopicCode) && !requestedTopicCodes.Contains(x.TopicCode!))
                    .Select(x => x.TopicCode!)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();
                var beforeAssignments = existingAssignments
                    .Select(x => new
                    {
                        x.TopicCode,
                        x.Session,
                        x.ScheduledAt,
                        x.StartTime,
                        x.EndTime,
                        x.OrderIndex,
                        x.Status
                    })
                    .OrderBy(x => x.Session)
                    .ThenBy(x => x.OrderIndex)
                    .ToList();
                if (existingAssignments.Count > 0)
                {
                    _db.DefenseAssignments.RemoveRange(existingAssignments);
                }

                await SaveCouncilAssignmentsAsync(committee, request.Assignments, now, cancellationToken);
                await RestoreTopicsToEligibleStatusIfUnassignedAsync(periodId, councilId, removedTopicCodes, now, cancellationToken);
                committee.LastUpdated = now;
                committee.Status = DefenseWorkflowStateMachine.ToValue(CommitteeStatus.Ready);
                _uow.Committees.Update(committee);
                await _uow.SaveChangesAsync();

                await tx.CommitAsync(cancellationToken);
                await AddAuditSnapshotAsync(
                    "SAVE_COUNCIL_STEP3_TOPICS",
                    "SUCCESS",
                    new { CouncilId = councilId, Assignments = beforeAssignments },
                    new
                    {
                        CouncilId = councilId,
                        TopicCount = request.Assignments.Count,
                        Assignments = request.Assignments
                            .Select(x => new
                            {
                                x.TopicCode,
                                x.SessionCode,
                                x.ScheduledAt,
                                x.StartTime,
                                x.EndTime,
                                x.OrderIndex
                            })
                            .OrderBy(x => x.SessionCode)
                            .ThenBy(x => x.OrderIndex)
                            .ToList()
                    },
                    new { PeriodId = periodId },
                    actorUserId,
                    cancellationToken);
                return ApiResponse<CouncilDraftDto>.SuccessResponse(await BuildCouncilDtoAsync(periodId, committee.CommitteeID, null, cancellationToken));
            }
            catch (BusinessRuleException ex)
            {
                await tx.RollbackAsync(cancellationToken);
                return Fail<CouncilDraftDto>(ex.Message, 400, ResolveUcCode(ex.Code, "UC2.3.STEP3"), ex.Details);
            }
        }

        public async Task<ApiResponse<CouncilDraftDto>> AddCouncilMemberItemAsync(int periodId, int councilId, AddCouncilMemberItemDto request, int actorUserId, CancellationToken cancellationToken = default)
        {
            await using var tx = await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                var period = await EnsurePeriodAsync(periodId, cancellationToken);
                var config = ReadConfig(period);
                EnsureCouncilListUnlocked(config);
                if (!config.CouncilIds.Contains(councilId))
                {
                    throw new BusinessRuleException("Hội đồng không thuộc đợt đồ án tốt nghiệp này.", "UC2.3.COUNCIL_NOT_IN_PERIOD");
                }

                var committee = await _db.Committees.FirstOrDefaultAsync(x => x.CommitteeID == councilId, cancellationToken);
                if (committee == null)
                {
                    throw new BusinessRuleException("Không tìm thấy hội đồng.", "UC2.3.COUNCIL_NOT_FOUND");
                }

                EnsureConcurrencyToken(committee, request.ConcurrencyToken);

                var normalizedLecturerCode = request.LecturerCode.Trim();
                var normalizedRole = NormalizeRole(request.Role);
                var membersPerCouncil = NormalizeMembersPerCouncil(config.CouncilConfig.MembersPerCouncilConfig);

                var existingMembers = await _db.CommitteeMembers.Where(x => x.CommitteeID == councilId).ToListAsync(cancellationToken);
                if (existingMembers.Any(x => string.Equals(x.MemberLecturerCode, normalizedLecturerCode, StringComparison.OrdinalIgnoreCase)))
                {
                    throw new BusinessRuleException("Không được trùng giảng viên trong cùng hội đồng.", "UC2.3.DUPLICATE_MEMBER", new { LecturerCode = normalizedLecturerCode });
                }

                if (existingMembers.Count >= membersPerCouncil)
                {
                    throw new BusinessRuleException($"Hội đồng chỉ cho phép tối đa {membersPerCouncil} thành viên.", "UC2.3.INVALID_MEMBER_COUNT");
                }

                var roles = existingMembers.Select(x => NormalizeRole(x.Role)).Append(normalizedRole).ToList();
                ValidateRolePlanPartial(roles, membersPerCouncil, "UC2.3.INVALID_ROLE_PLAN");

                await SaveCouncilMembersAsync(committee, existingMembers
                    .Select(x => new CouncilMemberInputDto
                    {
                        LecturerCode = x.MemberLecturerCode ?? string.Empty,
                        Role = x.Role ?? string.Empty
                    })
                    .Append(new CouncilMemberInputDto
                    {
                        LecturerCode = normalizedLecturerCode,
                        Role = normalizedRole
                    })
                    .ToList(), DateTime.UtcNow, cancellationToken);

                _db.CommitteeMembers.RemoveRange(existingMembers);
                committee.Status = DefenseWorkflowStateMachine.ToValue(CommitteeStatus.Draft);
                committee.LastUpdated = DateTime.UtcNow;
                _uow.Committees.Update(committee);
                await _uow.SaveChangesAsync();
                await tx.CommitAsync(cancellationToken);

                await AddAuditSnapshotAsync(
                    "ADD_COUNCIL_MEMBER_ITEM",
                    "SUCCESS",
                    new { CouncilId = councilId, MemberCount = existingMembers.Count },
                    new { CouncilId = councilId, MemberCount = existingMembers.Count + 1, LecturerCode = normalizedLecturerCode, Role = normalizedRole },
                    new { PeriodId = periodId },
                    actorUserId,
                    cancellationToken);

                return ApiResponse<CouncilDraftDto>.SuccessResponse(await BuildCouncilDtoAsync(periodId, councilId, null, cancellationToken));
            }
            catch (BusinessRuleException ex)
            {
                await tx.RollbackAsync(cancellationToken);
                return Fail<CouncilDraftDto>(ex.Message, 400, ResolveUcCode(ex.Code, "UC2.3.MEMBER_ITEM"), ex.Details);
            }
        }

        public async Task<ApiResponse<CouncilDraftDto>> UpdateCouncilMemberItemAsync(int periodId, int councilId, string lecturerCode, UpdateCouncilMemberItemDto request, int actorUserId, CancellationToken cancellationToken = default)
        {
            await using var tx = await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                var period = await EnsurePeriodAsync(periodId, cancellationToken);
                var config = ReadConfig(period);
                EnsureCouncilListUnlocked(config);
                if (!config.CouncilIds.Contains(councilId))
                {
                    throw new BusinessRuleException("Hội đồng không thuộc đợt đồ án tốt nghiệp này.", "UC2.3.COUNCIL_NOT_IN_PERIOD");
                }

                var committee = await _db.Committees.FirstOrDefaultAsync(x => x.CommitteeID == councilId, cancellationToken);
                if (committee == null)
                {
                    throw new BusinessRuleException("Không tìm thấy hội đồng.", "UC2.3.COUNCIL_NOT_FOUND");
                }

                EnsureConcurrencyToken(committee, request.ConcurrencyToken);

                var normalizedSourceCode = lecturerCode.Trim();
                var existingMembers = await _db.CommitteeMembers.Where(x => x.CommitteeID == councilId).ToListAsync(cancellationToken);
                var targetMember = existingMembers.FirstOrDefault(x => string.Equals(x.MemberLecturerCode, normalizedSourceCode, StringComparison.OrdinalIgnoreCase));
                if (targetMember == null)
                {
                    throw new BusinessRuleException("Không tìm thấy thành viên cần sửa.", "UC2.3.MEMBER_NOT_FOUND");
                }

                var nextLecturerCode = string.IsNullOrWhiteSpace(request.LecturerCode)
                    ? (targetMember.MemberLecturerCode ?? string.Empty)
                    : request.LecturerCode.Trim();
                var nextRole = string.IsNullOrWhiteSpace(request.Role)
                    ? NormalizeRole(targetMember.Role)
                    : NormalizeRole(request.Role);

                if (existingMembers.Any(x =>
                    !string.Equals(x.MemberLecturerCode, normalizedSourceCode, StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(x.MemberLecturerCode, nextLecturerCode, StringComparison.OrdinalIgnoreCase)))
                {
                    throw new BusinessRuleException("Không được trùng giảng viên trong cùng hội đồng.", "UC2.3.DUPLICATE_MEMBER", new { LecturerCode = nextLecturerCode });
                }

                var membersPerCouncil = NormalizeMembersPerCouncil(config.CouncilConfig.MembersPerCouncilConfig);
                var updatedMembers = existingMembers
                    .Select(x => new CouncilMemberInputDto
                    {
                        LecturerCode = string.Equals(x.MemberLecturerCode, normalizedSourceCode, StringComparison.OrdinalIgnoreCase)
                            ? nextLecturerCode
                            : (x.MemberLecturerCode ?? string.Empty),
                        Role = string.Equals(x.MemberLecturerCode, normalizedSourceCode, StringComparison.OrdinalIgnoreCase)
                            ? nextRole
                            : (x.Role ?? string.Empty)
                    })
                    .ToList();

                ValidateRolePlanPartial(updatedMembers.Select(x => NormalizeRole(x.Role)).ToList(), membersPerCouncil, "UC2.3.INVALID_ROLE_PLAN");

                _db.CommitteeMembers.RemoveRange(existingMembers);
                await SaveCouncilMembersAsync(committee, updatedMembers, DateTime.UtcNow, cancellationToken);

                committee.Status = DefenseWorkflowStateMachine.ToValue(CommitteeStatus.Draft);
                committee.LastUpdated = DateTime.UtcNow;
                _uow.Committees.Update(committee);
                await _uow.SaveChangesAsync();
                await tx.CommitAsync(cancellationToken);

                await AddAuditSnapshotAsync(
                    "UPDATE_COUNCIL_MEMBER_ITEM",
                    "SUCCESS",
                    new { CouncilId = councilId, SourceLecturerCode = normalizedSourceCode },
                    new { CouncilId = councilId, LecturerCode = nextLecturerCode, Role = nextRole },
                    new { PeriodId = periodId },
                    actorUserId,
                    cancellationToken);

                return ApiResponse<CouncilDraftDto>.SuccessResponse(await BuildCouncilDtoAsync(periodId, councilId, null, cancellationToken));
            }
            catch (BusinessRuleException ex)
            {
                await tx.RollbackAsync(cancellationToken);
                return Fail<CouncilDraftDto>(ex.Message, 400, ResolveUcCode(ex.Code, "UC2.3.MEMBER_ITEM"), ex.Details);
            }
        }

        public async Task<ApiResponse<CouncilDraftDto>> RemoveCouncilMemberItemAsync(int periodId, int councilId, string lecturerCode, RemoveCouncilMemberItemDto request, int actorUserId, CancellationToken cancellationToken = default)
        {
            await using var tx = await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                var period = await EnsurePeriodAsync(periodId, cancellationToken);
                var config = ReadConfig(period);
                EnsureCouncilListUnlocked(config);
                if (!config.CouncilIds.Contains(councilId))
                {
                    throw new BusinessRuleException("Hội đồng không thuộc đợt đồ án tốt nghiệp này.", "UC2.3.COUNCIL_NOT_IN_PERIOD");
                }

                var committee = await _db.Committees.FirstOrDefaultAsync(x => x.CommitteeID == councilId, cancellationToken);
                if (committee == null)
                {
                    throw new BusinessRuleException("Không tìm thấy hội đồng.", "UC2.3.COUNCIL_NOT_FOUND");
                }

                EnsureConcurrencyToken(committee, request.ConcurrencyToken);

                var normalizedLecturerCode = lecturerCode.Trim();
                var existingMembers = await _db.CommitteeMembers.Where(x => x.CommitteeID == councilId).ToListAsync(cancellationToken);
                var targetMember = existingMembers.FirstOrDefault(x => string.Equals(x.MemberLecturerCode, normalizedLecturerCode, StringComparison.OrdinalIgnoreCase));
                if (targetMember == null)
                {
                    throw new BusinessRuleException("Không tìm thấy thành viên cần xóa.", "UC2.3.MEMBER_NOT_FOUND");
                }

                _db.CommitteeMembers.Remove(targetMember);
                committee.Status = DefenseWorkflowStateMachine.ToValue(CommitteeStatus.Draft);
                committee.LastUpdated = DateTime.UtcNow;
                _uow.Committees.Update(committee);
                await _uow.SaveChangesAsync();
                await tx.CommitAsync(cancellationToken);

                await AddAuditSnapshotAsync(
                    "REMOVE_COUNCIL_MEMBER_ITEM",
                    "SUCCESS",
                    new { CouncilId = councilId, LecturerCode = normalizedLecturerCode },
                    new { CouncilId = councilId, MemberCount = Math.Max(0, existingMembers.Count - 1) },
                    new { PeriodId = periodId },
                    actorUserId,
                    cancellationToken);

                return ApiResponse<CouncilDraftDto>.SuccessResponse(await BuildCouncilDtoAsync(periodId, councilId, null, cancellationToken));
            }
            catch (BusinessRuleException ex)
            {
                await tx.RollbackAsync(cancellationToken);
                return Fail<CouncilDraftDto>(ex.Message, 400, ResolveUcCode(ex.Code, "UC2.3.MEMBER_ITEM"), ex.Details);
            }
        }

        public async Task<ApiResponse<CouncilDraftDto>> AddCouncilTopicItemAsync(int periodId, int councilId, AddCouncilTopicItemDto request, int actorUserId, CancellationToken cancellationToken = default)
        {
            await using var tx = await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                var period = await EnsurePeriodAsync(periodId, cancellationToken);
                var config = ReadConfig(period);
                EnsureCouncilListUnlocked(config);
                if (!config.CouncilIds.Contains(councilId))
                {
                    throw new BusinessRuleException("Hội đồng không thuộc đợt đồ án tốt nghiệp này.", "UC2.3.COUNCIL_NOT_IN_PERIOD");
                }

                var committee = await _db.Committees.FirstOrDefaultAsync(x => x.CommitteeID == councilId, cancellationToken);
                if (committee == null)
                {
                    throw new BusinessRuleException("Không tìm thấy hội đồng.", "UC2.3.COUNCIL_NOT_FOUND");
                }

                EnsureConcurrencyToken(committee, request.ConcurrencyToken);

                var normalizedTopicCode = request.TopicCode.Trim();
                var session = ToSessionNumber(request.SessionCode);
                var scheduledAt = (request.ScheduledAt ?? committee.DefenseDate ?? DateTime.UtcNow.Date).Date;
                var start = ParseRequiredTime(request.StartTime, "UC2.3.INVALID_START_TIME");
                var end = ParseRequiredTime(request.EndTime, "UC2.3.INVALID_END_TIME");
                if (end <= start)
                {
                    throw new BusinessRuleException("endTime phải lớn hơn startTime.", "UC2.3.INVALID_TIME_RANGE");
                }

                var assignments = await _db.DefenseAssignments.Where(x => x.CommitteeID == councilId).ToListAsync(cancellationToken);
                if (assignments.Any(x => string.Equals(x.TopicCode, normalizedTopicCode, StringComparison.OrdinalIgnoreCase)))
                {
                    throw new BusinessRuleException("Không được gán trùng đề tài trong cùng hội đồng.", "UC2.3.DUPLICATE_TOPIC", new { TopicCode = normalizedTopicCode });
                }

                var topicsPerSession = NormalizeTopicsPerSession(config.CouncilConfig.TopicsPerSessionConfig);
                if (assignments.Count(x => x.Session == session) >= topicsPerSession)
                {
                    throw new BusinessRuleException($"Mỗi buổi chỉ cho phép tối đa {topicsPerSession} đề tài.", "UC2.3.INVALID_TOPIC_COUNT_SESSION");
                }

                var topic = await _db.Topics.FirstOrDefaultAsync(
                    x => x.TopicCode == normalizedTopicCode && x.DefenseTermId == periodId,
                    cancellationToken);
                if (topic == null)
                {
                    throw new BusinessRuleException("Đề tài không tồn tại trong scope đợt đồ án tốt nghiệp.", "UC2.3.TOPIC_NOT_FOUND");
                }

                if (string.IsNullOrWhiteSpace(topic.ProposerStudentCode))
                {
                    throw new BusinessRuleException("Đề tài chưa có sinh viên đề xuất hợp lệ trong scope đợt.", "UC2.3.TOPIC_STUDENT_MISSING");
                }

                var studentInScope = await _db.DefenseTermStudents.AsNoTracking()
                    .Where(x => x.DefenseTermId == periodId && x.StudentCode == topic.ProposerStudentCode)
                    .Select(x => (int?)x.DefenseTermStudentID)
                    .FirstOrDefaultAsync(cancellationToken) != null;

                if (!studentInScope)
                {
                    throw new BusinessRuleException(
                        "Sinh viên của đề tài không thuộc scope đợt đồ án tốt nghiệp.",
                        "UC2.3.STUDENT_OUT_OF_SCOPE",
                        new { topic.ProposerStudentCode, topic.TopicCode });
                }

                await _constraintService.EnsureUniqueStudentAssignmentAsync(councilId, new[] { normalizedTopicCode }, cancellationToken);
                await _constraintService.EnsureNoLecturerOverlapAsync(councilId, new List<(DateTime Date, int Session)> { (scheduledAt, session) }, cancellationToken);

                var memberCodes = await _db.CommitteeMembers.AsNoTracking()
                    .Where(x => x.CommitteeID == councilId && x.MemberLecturerCode != null)
                    .Select(x => x.MemberLecturerCode!)
                    .ToListAsync(cancellationToken);
                if (!string.IsNullOrWhiteSpace(topic.SupervisorLecturerCode)
                    && memberCodes.Contains(topic.SupervisorLecturerCode, StringComparer.OrdinalIgnoreCase))
                {
                    throw new BusinessRuleException("Vi phạm ràng buộc GVHD không được nằm trong hội đồng của SV mình hướng dẫn.", "UC2.3.SUPERVISOR_CONFLICT");
                }

                var usedOrderIndexes = assignments
                    .Where(x => x.Session == session && x.OrderIndex.HasValue && x.OrderIndex.Value > 0)
                    .Select(x => x.OrderIndex!.Value)
                    .ToHashSet();

                var orderIndex = ResolveAssignmentOrderIndex(
                    usedOrderIndexes,
                    request.OrderIndex,
                    usedOrderIndexes.DefaultIfEmpty(0).Max() + 1,
                    "UC2.3.INVALID_ORDER_INDEX",
                    "UC2.3.DUPLICATE_ORDER_INDEX",
                    session);
                await _uow.DefenseAssignments.AddAsync(new DefenseAssignment
                {
                    AssignmentCode = $"AS{committee.CommitteeCode}_{normalizedTopicCode}_{session}_{orderIndex:D2}",
                    CommitteeID = committee.CommitteeID,
                    DefenseTermId = periodId,
                    CommitteeCode = committee.CommitteeCode,
                    TopicID = topic.TopicID,
                    TopicCode = normalizedTopicCode,
                    ScheduledAt = scheduledAt,
                    Session = session,
                    Shift = session == 1 ? DefenseSessionCodes.Morning : DefenseSessionCodes.Afternoon,
                    OrderIndex = orderIndex,
                    StartTime = start,
                    EndTime = end,
                    AssignedBy = "admin",
                    AssignedAt = DateTime.UtcNow,
                    Status = DefenseWorkflowStateMachine.ToValue(AssignmentStatus.Pending),
                    CreatedAt = DateTime.UtcNow,
                    LastUpdated = DateTime.UtcNow
                });

                MarkTopicAssigned(topic, DateTime.UtcNow);
                committee.Status = DefenseWorkflowStateMachine.ToValue(CommitteeStatus.Draft);
                committee.LastUpdated = DateTime.UtcNow;
                _uow.Committees.Update(committee);

                await _uow.SaveChangesAsync();
                await tx.CommitAsync(cancellationToken);

                await AddAuditSnapshotAsync(
                    "ADD_COUNCIL_TOPIC_ITEM",
                    "SUCCESS",
                    new { CouncilId = councilId, TopicCount = assignments.Count },
                    new { CouncilId = councilId, TopicCode = normalizedTopicCode, Session = session, OrderIndex = orderIndex },
                    new { PeriodId = periodId },
                    actorUserId,
                    cancellationToken);

                return ApiResponse<CouncilDraftDto>.SuccessResponse(await BuildCouncilDtoAsync(periodId, councilId, null, cancellationToken));
            }
            catch (BusinessRuleException ex)
            {
                await tx.RollbackAsync(cancellationToken);
                return Fail<CouncilDraftDto>(ex.Message, 400, ResolveUcCode(ex.Code, "UC2.3.TOPIC_ITEM"), ex.Details);
            }
        }

        public async Task<ApiResponse<CouncilDraftDto>> UpdateCouncilTopicItemAsync(int periodId, int councilId, int assignmentId, UpdateCouncilTopicItemDto request, int actorUserId, CancellationToken cancellationToken = default)
        {
            await using var tx = await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                var period = await EnsurePeriodAsync(periodId, cancellationToken);
                var config = ReadConfig(period);
                EnsureCouncilListUnlocked(config);
                if (!config.CouncilIds.Contains(councilId))
                {
                    throw new BusinessRuleException("Hội đồng không thuộc đợt đồ án tốt nghiệp này.", "UC2.3.COUNCIL_NOT_IN_PERIOD");
                }

                var committee = await _db.Committees.FirstOrDefaultAsync(x => x.CommitteeID == councilId, cancellationToken);
                if (committee == null)
                {
                    throw new BusinessRuleException("Không tìm thấy hội đồng.", "UC2.3.COUNCIL_NOT_FOUND");
                }

                EnsureConcurrencyToken(committee, request.ConcurrencyToken);

                var assignment = await _db.DefenseAssignments.FirstOrDefaultAsync(x => x.AssignmentID == assignmentId && x.CommitteeID == councilId, cancellationToken);
                if (assignment == null)
                {
                    throw new BusinessRuleException("Không tìm thấy đề tài cần sửa trong hội đồng.", "UC2.3.ASSIGNMENT_NOT_FOUND");
                }

                var assignedTopic = await _db.Topics.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.TopicCode == assignment.TopicCode && x.DefenseTermId == periodId, cancellationToken);
                if (assignedTopic == null)
                {
                    throw new BusinessRuleException("Đề tài của phân công không thuộc scope đợt đồ án tốt nghiệp.", "UC2.3.TOPIC_OUT_OF_SCOPE", new { assignment.TopicCode });
                }

                if (string.IsNullOrWhiteSpace(assignedTopic.ProposerStudentCode))
                {
                    throw new BusinessRuleException("Đề tài của phân công chưa có sinh viên đề xuất hợp lệ trong scope đợt.", "UC2.3.TOPIC_STUDENT_MISSING", new { assignment.TopicCode });
                }

                var scopedStudent = await _db.DefenseTermStudents.AsNoTracking()
                    .Where(x => x.DefenseTermId == periodId && x.StudentCode == assignedTopic.ProposerStudentCode)
                    .Select(x => (int?)x.DefenseTermStudentID)
                    .FirstOrDefaultAsync(cancellationToken) != null;
                if (!scopedStudent)
                {
                    throw new BusinessRuleException("Sinh viên của đề tài không thuộc scope đợt đồ án tốt nghiệp.", "UC2.3.STUDENT_OUT_OF_SCOPE", new { assignedTopic.TopicCode, assignedTopic.ProposerStudentCode });
                }

                var session = string.IsNullOrWhiteSpace(request.SessionCode) ? (assignment.Session ?? 1) : ToSessionNumber(request.SessionCode);
                var scheduledAt = (request.ScheduledAt ?? assignment.ScheduledAt ?? committee.DefenseDate ?? DateTime.UtcNow.Date).Date;
                var start = string.IsNullOrWhiteSpace(request.StartTime) ? (assignment.StartTime ?? TimeSpan.FromHours(7.5)) : ParseRequiredTime(request.StartTime, "UC2.3.INVALID_START_TIME");
                var end = string.IsNullOrWhiteSpace(request.EndTime) ? (assignment.EndTime ?? start.Add(TimeSpan.FromMinutes(60))) : ParseRequiredTime(request.EndTime, "UC2.3.INVALID_END_TIME");
                if (end <= start)
                {
                    throw new BusinessRuleException("endTime phải lớn hơn startTime.", "UC2.3.INVALID_TIME_RANGE");
                }

                var siblingAssignments = await _db.DefenseAssignments.AsNoTracking()
                    .Where(x => x.CommitteeID == councilId && x.AssignmentID != assignmentId)
                    .ToListAsync(cancellationToken);

                var topicsPerSession = NormalizeTopicsPerSession(config.CouncilConfig.TopicsPerSessionConfig);
                var sessionCount = siblingAssignments.Count(x => x.Session == session);
                if (sessionCount >= topicsPerSession)
                {
                    throw new BusinessRuleException($"Mỗi buổi chỉ cho phép tối đa {topicsPerSession} đề tài.", "UC2.3.INVALID_TOPIC_COUNT_SESSION");
                }

                var usedOrderIndexes = siblingAssignments
                    .Where(x => x.Session == session && x.OrderIndex.HasValue && x.OrderIndex.Value > 0)
                    .Select(x => x.OrderIndex!.Value)
                    .ToHashSet();

                var fallbackOrderIndex = assignment.OrderIndex.HasValue && assignment.OrderIndex.Value > 0
                    ? assignment.OrderIndex.Value
                    : usedOrderIndexes.DefaultIfEmpty(0).Max() + 1;

                var orderIndex = ResolveAssignmentOrderIndex(
                    usedOrderIndexes,
                    request.OrderIndex,
                    fallbackOrderIndex,
                    "UC2.3.INVALID_ORDER_INDEX",
                    "UC2.3.DUPLICATE_ORDER_INDEX",
                    session);

                assignment.Session = session;
                assignment.Shift = session == 1 ? DefenseSessionCodes.Morning : DefenseSessionCodes.Afternoon;
                assignment.ScheduledAt = scheduledAt;
                assignment.StartTime = start;
                assignment.EndTime = end;
                assignment.OrderIndex = orderIndex;
                assignment.LastUpdated = DateTime.UtcNow;
                assignment.AssignmentCode = $"AS{committee.CommitteeCode}_{assignment.TopicCode}_{session}_{orderIndex:D2}";

                committee.Status = DefenseWorkflowStateMachine.ToValue(CommitteeStatus.Draft);
                committee.LastUpdated = DateTime.UtcNow;
                _uow.Committees.Update(committee);
                await _uow.SaveChangesAsync();
                await tx.CommitAsync(cancellationToken);

                await AddAuditSnapshotAsync(
                    "UPDATE_COUNCIL_TOPIC_ITEM",
                    "SUCCESS",
                    new { CouncilId = councilId, AssignmentId = assignmentId },
                    new { CouncilId = councilId, AssignmentId = assignmentId, Session = session, assignment.OrderIndex },
                    new { PeriodId = periodId },
                    actorUserId,
                    cancellationToken);

                return ApiResponse<CouncilDraftDto>.SuccessResponse(await BuildCouncilDtoAsync(periodId, councilId, null, cancellationToken));
            }
            catch (BusinessRuleException ex)
            {
                await tx.RollbackAsync(cancellationToken);
                return Fail<CouncilDraftDto>(ex.Message, 400, ResolveUcCode(ex.Code, "UC2.3.TOPIC_ITEM"), ex.Details);
            }
        }

        public async Task<ApiResponse<CouncilDraftDto>> RemoveCouncilTopicItemAsync(int periodId, int councilId, int assignmentId, RemoveCouncilTopicItemDto request, int actorUserId, CancellationToken cancellationToken = default)
        {
            await using var tx = await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                var period = await EnsurePeriodAsync(periodId, cancellationToken);
                var config = ReadConfig(period);
                EnsureCouncilListUnlocked(config);
                if (!config.CouncilIds.Contains(councilId))
                {
                    throw new BusinessRuleException("Hội đồng không thuộc đợt đồ án tốt nghiệp này.", "UC2.3.COUNCIL_NOT_IN_PERIOD");
                }

                var committee = await _db.Committees.FirstOrDefaultAsync(x => x.CommitteeID == councilId, cancellationToken);
                if (committee == null)
                {
                    throw new BusinessRuleException("Không tìm thấy hội đồng.", "UC2.3.COUNCIL_NOT_FOUND");
                }

                EnsureConcurrencyToken(committee, request.ConcurrencyToken);

                var assignment = await _db.DefenseAssignments.FirstOrDefaultAsync(x => x.AssignmentID == assignmentId && x.CommitteeID == councilId, cancellationToken);
                if (assignment == null)
                {
                    throw new BusinessRuleException("Không tìm thấy đề tài cần xóa trong hội đồng.", "UC2.3.ASSIGNMENT_NOT_FOUND");
                }

                var now = DateTime.UtcNow;
                _db.DefenseAssignments.Remove(assignment);
                await RestoreTopicsToEligibleStatusIfUnassignedAsync(
                    periodId,
                    councilId,
                    string.IsNullOrWhiteSpace(assignment.TopicCode)
                        ? Array.Empty<string>()
                        : new[] { assignment.TopicCode },
                    now,
                    cancellationToken);
                committee.Status = DefenseWorkflowStateMachine.ToValue(CommitteeStatus.Draft);
                committee.LastUpdated = now;
                _uow.Committees.Update(committee);
                await _uow.SaveChangesAsync();
                await tx.CommitAsync(cancellationToken);

                await AddAuditSnapshotAsync(
                    "REMOVE_COUNCIL_TOPIC_ITEM",
                    "SUCCESS",
                    new { CouncilId = councilId, AssignmentId = assignmentId, assignment.TopicCode },
                    new { CouncilId = councilId },
                    new { PeriodId = periodId },
                    actorUserId,
                    cancellationToken);

                return ApiResponse<CouncilDraftDto>.SuccessResponse(await BuildCouncilDtoAsync(periodId, councilId, null, cancellationToken));
            }
            catch (BusinessRuleException ex)
            {
                await tx.RollbackAsync(cancellationToken);
                return Fail<CouncilDraftDto>(ex.Message, 400, ResolveUcCode(ex.Code, "UC2.3.TOPIC_ITEM"), ex.Details);
            }
        }

        public async Task<ApiResponse<bool>> FinalizeAsync(int periodId, FinalizeDefensePeriodDto request, int actorUserId, CancellationToken cancellationToken = default)
        {
            if (await IsIdempotentReplayAsync("FINALIZE", periodId, request.IdempotencyKey, cancellationToken))
            {
                return ApiResponse<bool>.SuccessResponse(true, code: DefenseUcErrorCodes.Council.FinalizeReplay, idempotencyReplay: true);
            }

            await using var tx = await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                var period = await EnsurePeriodAsync(periodId, cancellationToken);
                var config = ReadConfig(period);
                var beforeState = new { period.Status, config.Finalized, config.CouncilListLocked };

                if (!config.CouncilListLocked)
                {
                    throw new BusinessRuleException("Cần chốt danh sách hội đồng trước khi finalize.", "UC2.4.COUNCIL_LIST_NOT_LOCKED");
                }

                var councils = await GetPeriodCommitteesAsync(periodId, config, cancellationToken);
                var warnings = new List<string>();
                foreach (var committee in councils)
                {
                    var validation = await ValidateCouncilHardRulesAsync(
                        committee.CommitteeID,
                        cancellationToken);
                    if (!string.IsNullOrWhiteSpace(validation))
                    {
                        warnings.Add($"{committee.CommitteeCode}: {validation}");
                        committee.Status = "Warning";
                    }
                    else if (string.Equals(committee.Status, "Draft", StringComparison.OrdinalIgnoreCase))
                    {
                        DefenseWorkflowStateMachine.EnsureCommitteeTransition(CommitteeStatus.Draft, CommitteeStatus.Ready, "UC2.4.INVALID_COMMITTEE_STATE");
                        committee.Status = DefenseWorkflowStateMachine.ToValue(CommitteeStatus.Ready);
                    }

                    var normalizedStatus = DefenseWorkflowStateMachine.ParseCommitteeStatus(committee.Status);
                    if (normalizedStatus == CommitteeStatus.Completed)
                    {
                        DefenseWorkflowStateMachine.EnsureCommitteeTransition(CommitteeStatus.Completed, CommitteeStatus.Finalized, "UC2.4.INVALID_COMMITTEE_STATE");
                        committee.Status = DefenseWorkflowStateMachine.ToValue(CommitteeStatus.Finalized);
                    }
                }

                if (warnings.Count > 0 && !request.AllowFinalizeAfterWarning)
                {
                    throw new BusinessRuleException("Vẫn còn warning, bật allowFinalizeAfterWarning để chốt.", "UC2.4.FINALIZE_BLOCKED_BY_WARNING", warnings);
                }

                config.Finalized = true;
                period.Status = "Finalized";
                period.ConfigJson = JsonSerializer.Serialize(config);
                period.LastUpdated = DateTime.UtcNow;

                await _uow.SaveChangesAsync();
                await tx.CommitAsync(cancellationToken);

                await AddAuditSnapshotAsync(
                    "FINALIZE",
                    "SUCCESS",
                    beforeState,
                    new { period.Status, config.Finalized, config.CouncilListLocked },
                    new { PeriodId = periodId, WarningCount = warnings.Count, Warnings = warnings },
                    actorUserId,
                    cancellationToken);
                await SendDefenseHubEventAsync("DefensePeriodFinalized", new { PeriodId = periodId, WarningCount = warnings.Count }, cancellationToken);

                return ApiResponse<bool>.SuccessResponse(true);
            }
            catch (BusinessRuleException ex)
            {
                await tx.RollbackAsync(cancellationToken);
                return Fail<bool>(ex.Message, 400, ResolveUcCode(ex.Code, "UC2.4"), ex.Details);
            }
        }

        public async Task<ApiResponse<bool>> PublishScoresAsync(int periodId, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default)
        {
            if (await IsIdempotentReplayAsync("PUBLISH_SCORES", periodId, idempotencyKey, cancellationToken))
            {
                return ApiResponse<bool>.SuccessResponse(true, code: DefenseUcErrorCodes.Publish.Replay, idempotencyReplay: true);
            }

            await using var tx = await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                var period = await EnsurePeriodAsync(periodId, cancellationToken);
                var config = ReadConfig(period);
                var beforeState = new { period.Status, config.ScoresPublished };
                if (!config.Finalized)
                {
                    throw new BusinessRuleException("Chỉ được công bố điểm sau khi finalize.", "UC4.3.PUBLISH_BEFORE_FINALIZE");
                }

                var assignments = await GetPeriodAssignmentsAsync(periodId, config, cancellationToken);
                var now = DateTime.UtcNow;
                foreach (var assignment in assignments)
                {
                    var topic = await _db.Topics.AsNoTracking().FirstOrDefaultAsync(x => x.TopicCode == assignment.TopicCode, cancellationToken);
                    if (topic == null)
                    {
                        throw new BusinessRuleException($"Không tìm thấy đề tài cho assignment {assignment.AssignmentID}.");
                    }

                    var result = await _db.DefenseResults.FirstOrDefaultAsync(x => x.AssignmentId == assignment.AssignmentID, cancellationToken);
                    if (result == null)
                    {
                        result = new DefenseResult
                        {
                            AssignmentId = assignment.AssignmentID,
                            CreatedAt = now,
                            LastUpdated = now,
                            IsLocked = true
                        };
                        await _uow.DefenseResults.AddAsync(result);
                    }

                    var scores = await _db.DefenseScores.Where(x => x.AssignmentID == assignment.AssignmentID && x.IsSubmitted).ToListAsync(cancellationToken);
                    if (scores.Count == 0)
                    {
                        throw new BusinessRuleException($"Assignment {assignment.AssignmentCode} chưa có dữ liệu điểm để công bố.");
                    }

                    decimal? scoreCt = scores.Where(x => NormalizeRole(x.Role) == "CT").Select(x => (decimal?)x.Score).FirstOrDefault();
                    var scoreTkValues = scores.Where(x => NormalizeRole(x.Role) == "UVTK").Select(x => x.Score).ToList();
                    var scorePbValues = scores.Where(x => NormalizeRole(x.Role) == "UVPB").Select(x => x.Score).ToList();
                    decimal? scoreTk = scoreTkValues.Count == 0 ? null : Math.Round(scoreTkValues.Average(), 1);
                    decimal? scorePb = scorePbValues.Count == 0 ? null : Math.Round(scorePbValues.Average(), 1);
                    decimal? scoreGvhd = topic.Score ?? result.ScoreGvhd;

                    if (!scoreGvhd.HasValue && !string.IsNullOrWhiteSpace(topic.SupervisorLecturerCode))
                    {
                        scoreGvhd = scores
                            .Where(x => string.Equals(x.MemberLecturerCode, topic.SupervisorLecturerCode, StringComparison.OrdinalIgnoreCase))
                            .Select(x => (decimal?)x.Score)
                            .FirstOrDefault();
                    }

                    var availableScores = new List<decimal>();
                    if (scoreGvhd.HasValue) availableScores.Add(scoreGvhd.Value);
                    if (scoreCt.HasValue) availableScores.Add(scoreCt.Value);
                    if (scoreTk.HasValue) availableScores.Add(scoreTk.Value);
                    if (scorePb.HasValue) availableScores.Add(scorePb.Value);

                    if (availableScores.Count < 3)
                    {
                        throw new BusinessRuleException(
                            $"Cần ít nhất 3 đầu điểm hợp lệ (GVHD/CT/UVTK/UVPB) cho assignment {assignment.AssignmentCode} để công bố điểm tổng.",
                            details: new
                            {
                                assignment.AssignmentCode,
                                Missing = new
                                {
                                    GVHD = !scoreGvhd.HasValue,
                                    CT = !scoreCt.HasValue,
                                    UVTK = !scoreTk.HasValue,
                                    UVPB = !scorePb.HasValue
                                }
                            });
                    }

                    result.ScoreGvhd = scoreGvhd;
                    result.ScoreCt = scoreCt;
                    result.ScoreUvtk = scoreTk;
                    result.ScoreUvpb = scorePb;
                    result.FinalScoreNumeric = Math.Round(availableScores.Average(), 1);
                    result.FinalScoreText = ToGrade(result.FinalScoreNumeric);
                    result.LastUpdated = now;
                    result.IsLocked = true;
                    _uow.DefenseResults.Update(result);
                }

                config.ScoresPublished = true;
                period.Status = "Published";
                period.ConfigJson = JsonSerializer.Serialize(config);
                period.LastUpdated = now;
                _uow.DefenseTerms.Update(period);

                var councils = await GetPeriodCommitteesAsync(periodId, config, cancellationToken);
                foreach (var council in councils)
                {
                    var status = DefenseWorkflowStateMachine.ParseCommitteeStatus(council.Status);
                    if (status == CommitteeStatus.Finalized)
                    {
                        DefenseWorkflowStateMachine.EnsureCommitteeTransition(CommitteeStatus.Finalized, CommitteeStatus.Published, "UC4.3.INVALID_COMMITTEE_STATE");
                        council.Status = DefenseWorkflowStateMachine.ToValue(CommitteeStatus.Published);
                        council.LastUpdated = now;
                        _uow.Committees.Update(council);
                    }
                }

                await _uow.SaveChangesAsync();
                await tx.CommitAsync(cancellationToken);

                await AddAuditSnapshotAsync(
                    "PUBLISH_SCORES",
                    "SUCCESS",
                    beforeState,
                    new { period.Status, config.ScoresPublished },
                    new { PeriodId = periodId },
                    actorUserId,
                    cancellationToken);
                await SendDefenseHubEventAsync("DefenseScoresPublished", new { PeriodId = periodId }, cancellationToken);
                return ApiResponse<bool>.SuccessResponse(true);
            }
            catch (BusinessRuleException ex)
            {
                await tx.RollbackAsync(cancellationToken);
                return Fail<bool>(ex.Message, 400, ResolveUcCode(ex.Code, "UC4.3"), ex.Details);
            }
        }

        public async Task<ApiResponse<RollbackDefensePeriodResponseDto>> RollbackAsync(int periodId, RollbackDefensePeriodDto request, int actorUserId, CancellationToken cancellationToken = default)
        {
            if (await IsIdempotentReplayAsync("ROLLBACK", periodId, request.IdempotencyKey, cancellationToken))
            {
                return ApiResponse<RollbackDefensePeriodResponseDto>.SuccessResponse(new RollbackDefensePeriodResponseDto
                {
                    Target = request.Target,
                    RolledBackAt = DateTime.UtcNow
                }, code: DefenseUcErrorCodes.Publish.RollbackReplay, idempotencyReplay: true);
            }

            await using var tx = await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                var period = await EnsurePeriodAsync(periodId, cancellationToken);
                var config = ReadConfig(period);
                var target = (request.Target ?? string.Empty).Trim().ToUpperInvariant();
                if (string.IsNullOrWhiteSpace(request.Reason))
                {
                    throw new BusinessRuleException("Lý do rollback là bắt buộc.", "UC4.4.ROLLBACK_REASON_REQUIRED");
                }

                if (target != "PUBLISH" && target != "FINALIZE" && target != "ALL")
                {
                    throw new BusinessRuleException("Target rollback không hợp lệ. Chỉ hỗ trợ PUBLISH, FINALIZE hoặc ALL.", "UC4.4.ROLLBACK_TARGET_INVALID");
                }

                var now = DateTime.UtcNow;
                var beforePeriodStatus = period.Status ?? string.Empty;
                var beforeFinalized = config.Finalized;
                var beforeScoresPublished = config.ScoresPublished;
                var updatedCommitteeCount = 0;
                var updatedResultCount = 0;

                async Task<(int CommitteeCount, int ResultCount)> RollbackPublishAsync()
                {
                    if (!config.ScoresPublished)
                    {
                        throw new BusinessRuleException("Đợt đồ án tốt nghiệp chưa publish điểm để rollback.", "UC4.4.ROLLBACK_PUBLISH_INVALID_STATE");
                    }

                    var councils = await GetPeriodCommitteesAsync(periodId, config, cancellationToken);
                    var localCommitteeCount = 0;
                    foreach (var council in councils)
                    {
                        var status = DefenseWorkflowStateMachine.ParseCommitteeStatus(council.Status);
                        if (status == CommitteeStatus.Published)
                        {
                            council.Status = DefenseWorkflowStateMachine.ToValue(CommitteeStatus.Finalized);
                            council.LastUpdated = now;
                            _uow.Committees.Update(council);
                            localCommitteeCount++;
                        }
                    }

                    var localResultCount = 0;
                    if (request.ForceUnlockScores)
                    {
                        var assignments = await GetPeriodAssignmentsAsync(periodId, config, cancellationToken);
                        var assignmentIds = assignments.Select(x => x.AssignmentID).ToList();
                        if (assignmentIds.Count > 0)
                        {
                            var results = await _db.DefenseResults.Where(x => assignmentIds.Contains(x.AssignmentId)).ToListAsync(cancellationToken);
                            foreach (var result in results)
                            {
                                if (!result.IsLocked)
                                {
                                    continue;
                                }

                                result.IsLocked = false;
                                result.LastUpdated = now;
                                _uow.DefenseResults.Update(result);
                                localResultCount++;
                            }
                        }
                    }

                    config.ScoresPublished = false;
                    period.Status = config.Finalized ? "Finalized" : "Preparing";
                    return (localCommitteeCount, localResultCount);
                }

                async Task<int> RollbackFinalizeAsync()
                {
                    if (config.ScoresPublished)
                    {
                        throw new BusinessRuleException("Đợt đồ án tốt nghiệp đã publish điểm. Cần rollback publish trước khi rollback finalize.", "UC4.4.ROLLBACK_FINALIZE_BLOCKED_BY_PUBLISH");
                    }

                    if (!config.Finalized)
                    {
                        throw new BusinessRuleException("Đợt đồ án tốt nghiệp chưa finalize để rollback.", "UC2.5.ROLLBACK_FINALIZE_INVALID_STATE");
                    }

                    var councils = await GetPeriodCommitteesAsync(periodId, config, cancellationToken);
                    var localCommitteeCount = 0;
                    foreach (var council in councils)
                    {
                        var status = DefenseWorkflowStateMachine.ParseCommitteeStatus(council.Status);
                        if (status == CommitteeStatus.Finalized)
                        {
                            council.Status = DefenseWorkflowStateMachine.ToValue(CommitteeStatus.Completed);
                            council.LastUpdated = now;
                            _uow.Committees.Update(council);
                            localCommitteeCount++;
                        }
                    }

                    config.Finalized = false;
                    period.Status = "Preparing";
                    return localCommitteeCount;
                }

                if (target == "PUBLISH")
                {
                    var rollbackPublish = await RollbackPublishAsync();
                    updatedCommitteeCount += rollbackPublish.CommitteeCount;
                    updatedResultCount += rollbackPublish.ResultCount;
                }

                if (target == "FINALIZE")
                {
                    updatedCommitteeCount += await RollbackFinalizeAsync();
                }

                if (target == "ALL")
                {
                    if (config.ScoresPublished)
                    {
                        var assignments = await GetPeriodAssignmentsAsync(periodId, config, cancellationToken);
                        var assignmentIds = assignments.Select(x => x.AssignmentID).ToList();
                        if (request.ForceUnlockScores && assignmentIds.Count > 0)
                        {
                            var results = await _db.DefenseResults.Where(x => assignmentIds.Contains(x.AssignmentId) && x.IsLocked).ToListAsync(cancellationToken);
                            foreach (var result in results)
                            {
                                result.IsLocked = false;
                                result.LastUpdated = now;
                                _uow.DefenseResults.Update(result);
                            }

                            updatedResultCount += results.Count;
                        }

                        var councils = await GetPeriodCommitteesAsync(periodId, config, cancellationToken);
                        foreach (var council in councils)
                        {
                            var status = DefenseWorkflowStateMachine.ParseCommitteeStatus(council.Status);
                            if (status == CommitteeStatus.Published)
                            {
                                council.Status = DefenseWorkflowStateMachine.ToValue(CommitteeStatus.Finalized);
                                council.LastUpdated = now;
                                _uow.Committees.Update(council);
                                updatedCommitteeCount++;
                            }
                        }

                        config.ScoresPublished = false;
                        period.Status = config.Finalized ? "Finalized" : "Preparing";
                    }

                    if (config.Finalized)
                    {
                        var councils = await GetPeriodCommitteesAsync(periodId, config, cancellationToken);
                        foreach (var council in councils)
                        {
                            var status = DefenseWorkflowStateMachine.ParseCommitteeStatus(council.Status);
                            if (status == CommitteeStatus.Finalized)
                            {
                                council.Status = DefenseWorkflowStateMachine.ToValue(CommitteeStatus.Completed);
                                council.LastUpdated = now;
                                _uow.Committees.Update(council);
                                updatedCommitteeCount++;
                            }
                        }

                        config.Finalized = false;
                        period.Status = "Preparing";
                    }
                }

                period.ConfigJson = JsonSerializer.Serialize(config);
                period.LastUpdated = now;
                _uow.DefenseTerms.Update(period);

                await _uow.SaveChangesAsync();
                await tx.CommitAsync(cancellationToken);

                await AddAuditSnapshotAsync(
                    $"ROLLBACK_{target}",
                    "SUCCESS",
                    new
                    {
                        PeriodStatus = beforePeriodStatus,
                        Finalized = beforeFinalized,
                        ScoresPublished = beforeScoresPublished
                    },
                    new
                    {
                        PeriodStatus = period.Status,
                        Finalized = config.Finalized,
                        ScoresPublished = config.ScoresPublished
                    },
                    new
                    {
                        PeriodId = periodId,
                        Target = target,
                        request.Reason,
                        UpdatedCommittees = updatedCommitteeCount,
                        UpdatedResults = updatedResultCount
                    },
                    actorUserId,
                    cancellationToken);

                await SendDefenseHubEventAsync("DefensePeriodRollback", new { PeriodId = periodId, Target = target, Reason = request.Reason }, cancellationToken);

                return ApiResponse<RollbackDefensePeriodResponseDto>.SuccessResponse(new RollbackDefensePeriodResponseDto
                {
                    Target = target,
                    PeriodStatusBefore = beforePeriodStatus,
                    PeriodStatusAfter = period.Status ?? string.Empty,
                    FinalizedBefore = beforeFinalized,
                    FinalizedAfter = config.Finalized,
                    ScoresPublishedBefore = beforeScoresPublished,
                    ScoresPublishedAfter = config.ScoresPublished,
                    UpdatedCommitteeCount = updatedCommitteeCount,
                    UpdatedResultCount = updatedResultCount,
                    RolledBackAt = now
                });
            }
            catch (BusinessRuleException ex)
            {
                await tx.RollbackAsync(cancellationToken);
                return Fail<RollbackDefensePeriodResponseDto>(ex.Message, 400, ResolveUcCode(ex.Code, "UC4.4"), ex.Details);
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync(cancellationToken);
                return Fail<RollbackDefensePeriodResponseDto>(ex.Message, 500, DefenseUcErrorCodes.Publish.RollbackFailed);
            }
        }

        public async Task<ApiResponse<bool>> StartAsync(int periodId, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default)
        {
            if (await IsIdempotentReplayAsync("START", periodId, idempotencyKey, cancellationToken))
            {
                return ApiResponse<bool>.SuccessResponse(true, idempotencyReplay: true);
            }

            await using var tx = await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                var period = await EnsurePeriodAsync(periodId, cancellationToken);
                
                var anyRunning = await _db.DefenseTerms.AsNoTracking()
                    .Where(x => x.Status == "Running" && x.DefenseTermId != periodId)
                    .Select(x => (int?)x.DefenseTermId)
                    .FirstOrDefaultAsync(cancellationToken) != null;
                if (anyRunning)
                {
                    throw new BusinessRuleException("Đã có đợt đồ án tốt nghiệp khác đang chạy. Vui lòng tạm dừng hoặc kết thúc đợt đó trước.", "UC2.START.ALREADY_RUNNING");
                }

                if (period.Status == "Running")
                {
                    return ApiResponse<bool>.SuccessResponse(true, code: "UC2.START.ALREADY_STARTED");
                }

                period.Status = "Running";
                period.LastUpdated = DateTime.UtcNow;
                _uow.DefenseTerms.Update(period);
                await _uow.SaveChangesAsync();
                await tx.CommitAsync(cancellationToken);

                await AddAuditSnapshotAsync("START", "SUCCESS", new { period.Status }, new { Status = "Running" }, new { PeriodId = periodId }, actorUserId, cancellationToken);
                return ApiResponse<bool>.SuccessResponse(true);
            }
            catch (BusinessRuleException ex)
            {
                await tx.RollbackAsync(cancellationToken);
                return Fail<bool>(ex.Message, 400, ResolveUcCode(ex.Code, "UC2.START"), ex.Details);
            }
        }

        public async Task<ApiResponse<bool>> MoveNextStepAsync(int periodId, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default)
        {
            if (await IsIdempotentReplayAsync("MOVE_NEXT", periodId, idempotencyKey, cancellationToken))
            {
                return ApiResponse<bool>.SuccessResponse(true, idempotencyReplay: true);
            }

            await using var tx = await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                var period = await EnsurePeriodAsync(periodId, cancellationToken);
                var currentStatus = DefenseWorkflowStateMachine.ParsePeriodStatus(period.Status);
                
                if (currentStatus == DefenseTermStatus.Closed)
                {
                    throw new BusinessRuleException("Đợt đồ án đã kết thúc, không thể chuyển tiếp.", "UC2.NEXT.ALREADY_CLOSED");
                }

                var nextStatus = (DefenseTermStatus)((int)currentStatus + 1);
                
                // Special handling for jumps if needed, but for now strictly sequential
                DefenseWorkflowStateMachine.EnsurePeriodTransition(currentStatus, nextStatus, "UC2.NEXT.INVALID_TRANSITION");

                // Business logic validations for specific steps
                if (nextStatus == DefenseTermStatus.Running)
                {
                    var anyRunning = await _db.DefenseTerms.AsNoTracking()
                        .Where(x => x.Status == "Running" && x.DefenseTermId != periodId)
                        .Select(x => (int?)x.DefenseTermId)
                        .FirstOrDefaultAsync(cancellationToken) != null;
                    if (anyRunning)
                    {
                        throw new BusinessRuleException("Đã có đợt đồ án tốt nghiệp khác đang chạy. Vui lòng tạm dừng hoặc kết thúc đợt đó trước.", "UC2.NEXT.ALREADY_RUNNING");
                    }
                }

                period.Status = DefenseWorkflowStateMachine.ToValue(nextStatus);
                period.LastUpdated = DateTime.UtcNow;
                _uow.DefenseTerms.Update(period);
                await _uow.SaveChangesAsync();
                await tx.CommitAsync(cancellationToken);

                await AddAuditSnapshotAsync("MOVE_NEXT", "SUCCESS", new { Before = currentStatus.ToString() }, new { After = nextStatus.ToString() }, new { PeriodId = periodId }, actorUserId, cancellationToken);
                return ApiResponse<bool>.SuccessResponse(true);
            }
            catch (BusinessRuleException ex)
            {
                await tx.RollbackAsync(cancellationToken);
                return Fail<bool>(ex.Message, 400, ResolveUcCode(ex.Code, "UC2.NEXT"), ex.Details);
            }
        }

        public async Task<ApiResponse<bool>> PauseAsync(int periodId, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default)
        {
            await using var tx = await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                var period = await EnsurePeriodAsync(periodId, cancellationToken);
                if (period.Status != "Running")
                {
                    throw new BusinessRuleException("Chỉ có thể tạm dừng đợt đồ án tốt nghiệp đang chạy.", "UC2.PAUSE.INVALID_STATE");
                }

                period.Status = "Paused";
                period.LastUpdated = DateTime.UtcNow;
                _uow.DefenseTerms.Update(period);
                await _uow.SaveChangesAsync();
                await tx.CommitAsync(cancellationToken);

                await AddAuditSnapshotAsync("PAUSE", "SUCCESS", new { period.Status }, new { Status = "Paused" }, new { PeriodId = periodId }, actorUserId, cancellationToken);
                return ApiResponse<bool>.SuccessResponse(true);
            }
            catch (BusinessRuleException ex)
            {
                await tx.RollbackAsync(cancellationToken);
                return Fail<bool>(ex.Message, 400, ResolveUcCode(ex.Code, "UC2.PAUSE"), ex.Details);
            }
        }

        public async Task<ApiResponse<bool>> ResumeAsync(int periodId, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default)
        {
            await using var tx = await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                var period = await EnsurePeriodAsync(periodId, cancellationToken);
                if (period.Status != "Paused")
                {
                    throw new BusinessRuleException("Chỉ có thể tiếp tục đợt đồ án tốt nghiệp đang tạm dừng.", "UC2.RESUME.INVALID_STATE");
                }

                var anyRunning = await _db.DefenseTerms.AsNoTracking()
                    .Where(x => x.Status == "Running" && x.DefenseTermId != periodId)
                    .Select(x => (int?)x.DefenseTermId)
                    .FirstOrDefaultAsync(cancellationToken) != null;
                if (anyRunning)
                {
                    throw new BusinessRuleException("Đã có đợt đồ án tốt nghiệp khác đang chạy. Không thể resume đợt này.", "UC2.RESUME.ALREADY_RUNNING");
                }

                period.Status = "Running";
                period.LastUpdated = DateTime.UtcNow;
                _uow.DefenseTerms.Update(period);
                await _uow.SaveChangesAsync();
                await tx.CommitAsync(cancellationToken);

                await AddAuditSnapshotAsync("RESUME", "SUCCESS", new { period.Status }, new { Status = "Running" }, new { PeriodId = periodId }, actorUserId, cancellationToken);
                return ApiResponse<bool>.SuccessResponse(true);
            }
            catch (BusinessRuleException ex)
            {
                await tx.RollbackAsync(cancellationToken);
                return Fail<bool>(ex.Message, 400, ResolveUcCode(ex.Code, "UC2.RESUME"), ex.Details);
            }
        }

        public async Task<ApiResponse<bool>> LockScoringAsync(int periodId, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default)
        {
            await using var tx = await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                var period = await EnsurePeriodAsync(periodId, cancellationToken);
                var config = ReadConfig(period);
                
                if (config.ScoresPublished)
                {
                    throw new BusinessRuleException("Điểm đã công bố, không thể khóa scoring.", "UC2.LOCK_SCORING.ALREADY_PUBLISHED");
                }

                if (period.Status != "Running" && period.Status != "Paused")
                {
                    throw new BusinessRuleException("Chỉ có thể khóa scoring khi đợt đang chạy hoặc tạm dừng.", "UC2.LOCK_SCORING.INVALID_STATE");
                }

                period.Status = "ScoringLocked";
                period.LastUpdated = DateTime.UtcNow;
                _uow.DefenseTerms.Update(period);
                await _uow.SaveChangesAsync();
                await tx.CommitAsync(cancellationToken);

                await AddAuditSnapshotAsync("LOCK_SCORING", "SUCCESS", new { period.Status }, new { Status = "ScoringLocked" }, new { PeriodId = periodId }, actorUserId, cancellationToken);
                return ApiResponse<bool>.SuccessResponse(true);
            }
            catch (BusinessRuleException ex)
            {
                await tx.RollbackAsync(cancellationToken);
                return Fail<bool>(ex.Message, 400, ResolveUcCode(ex.Code, "UC2.LOCK_SCORING"), ex.Details);
            }
        }

        public async Task<ApiResponse<bool>> CloseAsync(int periodId, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default)
        {
            await using var tx = await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                var period = await EnsurePeriodAsync(periodId, cancellationToken);
                var config = ReadConfig(period);

                if (!config.Finalized && !config.ScoresPublished)
                {
                    throw new BusinessRuleException("Cần finalize đợt đồ án tốt nghiệp trước khi đóng.", "UC2.CLOSE.NOT_FINALIZED");
                }

                period.Status = "Closed";
                period.LastUpdated = DateTime.UtcNow;
                _uow.DefenseTerms.Update(period);
                await _uow.SaveChangesAsync();
                await tx.CommitAsync(cancellationToken);

                await AddAuditSnapshotAsync("CLOSE", "SUCCESS", new { period.Status }, new { Status = "Closed" }, new { PeriodId = periodId }, actorUserId, cancellationToken);
                return ApiResponse<bool>.SuccessResponse(true);
            }
            catch (BusinessRuleException ex)
            {
                await tx.RollbackAsync(cancellationToken);
                return Fail<bool>(ex.Message, 400, ResolveUcCode(ex.Code, "UC2.CLOSE"), ex.Details);
            }
        }

        public async Task<ApiResponse<bool>> SaveLecturerMinuteAsync(int committeeId, UpdateLecturerMinutesDto request, string lecturerCode, int actorUserId, CancellationToken cancellationToken = default)
        {
            try
            {
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

                var normalizedRole = NormalizeRole(member.Role);
                if (normalizedRole != "UVTK" && normalizedRole != "CT" && normalizedRole != "UVPB")
                {
                    throw new BusinessRuleException("Chỉ thành viên hội đồng có quyền biên bản mới được cập nhật.", "UC3.1.INVALID_ROLE");
                }

                var normalizedLecturerCode = (lecturerCode ?? string.Empty).Trim();
                var secretaryProfileId = await _db.LecturerProfiles.AsNoTracking()
                    .Where(x => x.LecturerCode != null && x.LecturerCode.ToUpper() == normalizedLecturerCode.ToUpper())
                    .Select(x => (int?)x.LecturerProfileID)
                    .FirstOrDefaultAsync(cancellationToken);

                if (!secretaryProfileId.HasValue)
                {
                    throw new BusinessRuleException("Không tìm thấy hồ sơ giảng viên để lưu biên bản.", DefenseUcErrorCodes.Minutes.LecturerProfileNotFound);
                }

                var minute = await _db.DefenseMinutes.FirstOrDefaultAsync(x => x.AssignmentId == request.AssignmentId, cancellationToken);
                MinuteExtendedData extendedData;
                var beforeSnapshot = minute == null
                    ? null
                    : new
                    {
                        minute.SummaryContent,
                        minute.ReviewerComments,
                        minute.QnaDetails,
                        minute.Strengths,
                        minute.Weaknesses,
                        minute.Recommendations,
                        minute.LastUpdated
                    };
                if (minute == null)
                {
                    minute = new DefenseMinute
                    {
                        AssignmentId = request.AssignmentId,
                        SecretaryId = secretaryProfileId.Value,
                        CreatedAt = DateTime.UtcNow
                    };
                    await _uow.DefenseMinutes.AddAsync(minute);
                    extendedData = new MinuteExtendedData();
                }
                else
                {
                    extendedData = ParseMinuteExtendedData(minute.ReviewerComments);
                }

                var normalizedChapterInputs = (request.ChapterContents ?? new List<MinuteChapterInputDto>())
                    .Where(x => !string.IsNullOrWhiteSpace(x.ChapterTitle) || !string.IsNullOrWhiteSpace(x.Content))
                    .Select(x => new MinuteChapterInputDto
                    {
                        ChapterTitle = (x.ChapterTitle ?? string.Empty).Trim(),
                        Content = (x.Content ?? string.Empty).Trim()
                    })
                    .ToList();

                var normalizedQuestionAnswers = (request.QuestionAnswers ?? new List<MinuteQuestionAnswerDto>())
                    .Select(x => new MinuteQuestionAnswerDto
                    {
                        Question = (x.Question ?? string.Empty).Trim(),
                        Answer = (x.Answer ?? string.Empty).Trim()
                    })
                    .Where(x => !string.IsNullOrWhiteSpace(x.Question) || !string.IsNullOrWhiteSpace(x.Answer))
                    .ToList();

                var incomingReviewerSections = request.ReviewerSections == null
                    ? null
                    : new ReviewerStructuredSectionsDto
                    {
                        Necessity = request.ReviewerSections.Necessity,
                        Novelty = request.ReviewerSections.Novelty,
                        MethodologyReliability = request.ReviewerSections.MethodologyReliability,
                        ResultsContent = request.ReviewerSections.ResultsContent,
                        Limitations = request.ReviewerSections.Limitations,
                        Suggestions = request.ReviewerSections.Suggestions,
                        OverallConclusion = request.ReviewerSections.OverallConclusion
                    };

                if (normalizedRole == "UVPB")
                {
                    if (incomingReviewerSections != null)
                    {
                        extendedData.ReviewerSections = incomingReviewerSections;
                    }

                    if (!string.IsNullOrWhiteSpace(request.ReviewerComments))
                    {
                        minute.ReviewerComments = request.ReviewerComments;
                    }
                }
                else
                {
                    minute.SummaryContent = request.SummaryContent;
                    extendedData.CommitteeMemberComments = request.CommitteeMemberComments;
                    minute.QnaDetails = request.QnaDetails;
                    minute.Strengths = request.Strengths;
                    minute.Weaknesses = request.Weaknesses;
                    minute.Recommendations = request.Recommendations;

                    extendedData.ChapterContents = normalizedChapterInputs;
                    extendedData.QuestionAnswers = normalizedQuestionAnswers;
                    extendedData.CouncilDiscussionConclusion = request.CouncilDiscussionConclusion;
                    extendedData.ChairConclusion = request.ChairConclusion;

                    if (incomingReviewerSections != null)
                    {
                        extendedData.ReviewerSections = incomingReviewerSections;
                    }
                }

                minute.ReviewerComments = ComposeReviewerComments(minute.ReviewerComments, extendedData);
                minute.LastUpdated = DateTime.UtcNow;

                if (minute.Id > 0)
                {
                    _uow.DefenseMinutes.Update(minute);
                }

                await _uow.SaveChangesAsync();
                await AddAuditSnapshotAsync(
                    "SAVE_LECTURER_MINUTE",
                    "SUCCESS",
                    beforeSnapshot,
                    new
                    {
                        minute.SummaryContent,
                        minute.ReviewerComments,
                        minute.QnaDetails,
                        minute.Strengths,
                        minute.Weaknesses,
                        minute.Recommendations,
                        minute.LastUpdated
                    },
                    new
                    {
                        CommitteeId = committeeId,
                        request.AssignmentId,
                        LecturerCode = lecturerCode,
                        Role = normalizedRole
                    },
                    actorUserId,
                    cancellationToken);
                await SendDefenseHubEventAsync("DefenseMinuteAutosaved", new { CommitteeId = committeeId, AssignmentId = request.AssignmentId, IntervalSeconds = 30 }, cancellationToken);

                var minuteWarnings = BuildMinuteEmptyFieldWarnings(
                    normalizedRole,
                    request,
                    incomingReviewerSections,
                    normalizedChapterInputs,
                    normalizedQuestionAnswers);

                minuteWarnings.Insert(0, new ApiWarning
                {
                    Type = "success",
                    Code = DefenseUcErrorCodes.Minutes.SaveSuccess,
                    Message = "Lưu biên bản thành công."
                });

                return ApiResponse<bool>.SuccessResponse(
                    true,
                    code: DefenseUcErrorCodes.Minutes.SaveSuccess,
                    warnings: minuteWarnings,
                    allowedActions: new List<string> { "EDIT_MINUTE" });
            }
            catch (BusinessRuleException ex)
            {
                return Fail<bool>(ex.Message, 400, ResolveUcCode(ex.Code, "UC3.1"), ex.Details);
            }
        }

        private static List<ApiWarning> BuildMinuteEmptyFieldWarnings(
            string normalizedRole,
            UpdateLecturerMinutesDto request,
            ReviewerStructuredSectionsDto? incomingReviewerSections,
            List<MinuteChapterInputDto> normalizedChapterInputs,
            List<MinuteQuestionAnswerDto> normalizedQuestionAnswers)
        {
            var warnings = new List<ApiWarning>();

            if (normalizedRole == "UVPB")
            {
                var hasStructuredReviewerContent = incomingReviewerSections != null
                    && (!string.IsNullOrWhiteSpace(incomingReviewerSections.Necessity)
                        || !string.IsNullOrWhiteSpace(incomingReviewerSections.Novelty)
                        || !string.IsNullOrWhiteSpace(incomingReviewerSections.MethodologyReliability)
                        || !string.IsNullOrWhiteSpace(incomingReviewerSections.ResultsContent)
                        || !string.IsNullOrWhiteSpace(incomingReviewerSections.Limitations)
                        || !string.IsNullOrWhiteSpace(incomingReviewerSections.Suggestions)
                        || !string.IsNullOrWhiteSpace(incomingReviewerSections.OverallConclusion));

                if (string.IsNullOrWhiteSpace(request.ReviewerComments) && !hasStructuredReviewerContent)
                {
                    warnings.Add(new ApiWarning
                    {
                        Type = "soft",
                        Code = "UC3.1.MINUTE.EMPTY_REVIEWER_CONTENT",
                        Message = "Phần nhận xét phản biện đang để trống."
                    });
                }

                return warnings;
            }

            if (string.IsNullOrWhiteSpace(request.SummaryContent))
            {
                warnings.Add(new ApiWarning
                {
                    Type = "soft",
                    Code = "UC3.1.MINUTE.EMPTY_SUMMARY",
                    Message = "Nội dung tóm tắt đang để trống."
                });
            }

            if (string.IsNullOrWhiteSpace(request.Strengths))
            {
                warnings.Add(new ApiWarning
                {
                    Type = "soft",
                    Code = "UC3.1.MINUTE.EMPTY_STRENGTHS",
                    Message = "Mục ưu điểm đang để trống."
                });
            }

            if (string.IsNullOrWhiteSpace(request.Weaknesses))
            {
                warnings.Add(new ApiWarning
                {
                    Type = "soft",
                    Code = "UC3.1.MINUTE.EMPTY_WEAKNESSES",
                    Message = "Mục nhược điểm đang để trống."
                });
            }

            if (string.IsNullOrWhiteSpace(request.Recommendations))
            {
                warnings.Add(new ApiWarning
                {
                    Type = "soft",
                    Code = "UC3.1.MINUTE.EMPTY_RECOMMENDATIONS",
                    Message = "Mục kiến nghị đang để trống."
                });
            }

            if (normalizedChapterInputs.Count == 0)
            {
                warnings.Add(new ApiWarning
                {
                    Type = "soft",
                    Code = "UC3.1.MINUTE.EMPTY_CHAPTERS",
                    Message = "Danh sách nội dung theo chương đang để trống."
                });
            }

            if (normalizedQuestionAnswers.Count == 0)
            {
                warnings.Add(new ApiWarning
                {
                    Type = "soft",
                    Code = "UC3.1.MINUTE.EMPTY_QNA",
                    Message = "Danh sách câu hỏi và trả lời đang để trống."
                });
            }

            return warnings;
        }

        private static MinuteExtendedData ParseMinuteExtendedData(string? reviewerComments)
        {
            if (string.IsNullOrWhiteSpace(reviewerComments))
            {
                return new MinuteExtendedData();
            }

            var marker = "[MINUTE_EXTENDED_JSON]";
            var markerIndex = reviewerComments.IndexOf(marker, StringComparison.Ordinal);
            if (markerIndex < 0)
            {
                return new MinuteExtendedData();
            }

            var jsonPart = reviewerComments[(markerIndex + marker.Length)..].Trim();
            if (string.IsNullOrWhiteSpace(jsonPart))
            {
                return new MinuteExtendedData();
            }

            try
            {
                return JsonSerializer.Deserialize<MinuteExtendedData>(jsonPart) ?? new MinuteExtendedData();
            }
            catch
            {
                return new MinuteExtendedData();
            }
        }

        private static string? ComposeReviewerComments(string? plainReviewerComments, MinuteExtendedData extendedData)
        {
            var plain = (plainReviewerComments ?? string.Empty).Trim();
            var marker = "[MINUTE_EXTENDED_JSON]";
            var markerIndex = plain.IndexOf(marker, StringComparison.Ordinal);
            if (markerIndex >= 0)
            {
                plain = plain[..markerIndex].TrimEnd();
            }

            var json = JsonSerializer.Serialize(extendedData);
            if (string.IsNullOrWhiteSpace(plain))
            {
                return $"{marker}{json}";
            }

            return $"{plain}\n\n{marker}{json}";
        }

        public async Task<ApiResponse<bool>> SubmitIndependentScoreAsync(int committeeId, LecturerScoreSubmitDto request, string lecturerCode, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default)
        {
            var requestHash = ComputeRequestHash("UC3.SUBMIT_INDEPENDENT_SCORE", committeeId, lecturerCode, request.AssignmentId, request.Score, request.Comment ?? string.Empty);
            var replay = await TryReplayResponseAsync<bool>("SUBMIT_INDEPENDENT_SCORE", committeeId, idempotencyKey, requestHash, cancellationToken);
            if (replay != null)
            {
                return replay;
            }

            ApiResponse<bool> response;
            try
            {
                await _scoreWorkflowService.SubmitIndependentScoreAsync(committeeId, request, lecturerCode, actorUserId, cancellationToken);
                response = ApiResponse<bool>.SuccessResponse(true, code: DefenseUcErrorCodes.Scoring.SubmitSuccess);
            }
            catch (BusinessRuleException ex)
            {
                response = Fail<bool>(ex.Message, 400, ResolveUcCode(ex.Code, "UC3.2"), ex.Details);
            }

            await SaveIdempotencyResponseAsync("SUBMIT_INDEPENDENT_SCORE", committeeId, idempotencyKey, requestHash, response, cancellationToken);
            return response;
        }

        public async Task<ApiResponse<bool>> OpenSessionAsync(int committeeId, string lecturerCode, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default)
        {
            var requestHash = ComputeRequestHash("UC3.OPEN_SESSION", committeeId, lecturerCode);
            var replay = await TryReplayResponseAsync<bool>("OPEN_SESSION", committeeId, idempotencyKey, requestHash, cancellationToken);
            if (replay != null)
            {
                return replay;
            }

            ApiResponse<bool> response;
            try
            {
                await _scoreWorkflowService.OpenSessionAsync(committeeId, lecturerCode, actorUserId, cancellationToken);
                response = ApiResponse<bool>.SuccessResponse(true, code: DefenseUcErrorCodes.Scoring.OpenSuccess);
            }
            catch (BusinessRuleException ex)
            {
                response = Fail<bool>(ex.Message, 400, ResolveUcCode(ex.Code, "UC3.4"), ex.Details);
            }

            await SaveIdempotencyResponseAsync("OPEN_SESSION", committeeId, idempotencyKey, requestHash, response, cancellationToken);
            return response;
        }

        public async Task<ApiResponse<bool>> LockSessionAsync(int committeeId, string lecturerCode, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default)
        {
            var requestHash = ComputeRequestHash("UC3.LOCK_SESSION", committeeId, lecturerCode);
            var replay = await TryReplayResponseAsync<bool>("LOCK_SESSION", committeeId, idempotencyKey, requestHash, cancellationToken);
            if (replay != null)
            {
                return replay;
            }

            ApiResponse<bool> response;
            try
            {
                await _scoreWorkflowService.LockSessionAsync(committeeId, lecturerCode, actorUserId, cancellationToken);
                response = ApiResponse<bool>.SuccessResponse(true, code: DefenseUcErrorCodes.Scoring.LockSuccess);
            }
            catch (BusinessRuleException ex)
            {
                response = Fail<bool>(ex.Message, 400, ResolveUcCode(ex.Code, "UC3.5"), ex.Details);
            }

            await SaveIdempotencyResponseAsync("LOCK_SESSION", committeeId, idempotencyKey, requestHash, response, cancellationToken);
            return response;
        }

        public async Task<ApiResponse<bool>> ApproveRevisionAsync(int revisionId, string? reason, string lecturerCode, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default)
        {
            var requestHash = ComputeRequestHash("UC4.APPROVE_REVISION", revisionId, lecturerCode);
            var replay = await TryReplayResponseAsync<bool>("APPROVE_REVISION", revisionId, idempotencyKey, requestHash, cancellationToken);
            if (replay != null)
            {
                return replay;
            }

            ApiResponse<bool> response;
            try
            {
                await _revisionWorkflowService.ApproveRevisionAsync(revisionId, lecturerCode, actorUserId, cancellationToken);

                // If the acting lecturer is the committee secretary, perform the secretary review step
                // to finalize status and notify the student.
                var assignment = await _db.DefenseRevisions
                    .Where(r => r.Id == revisionId)
                    .Join(_db.DefenseAssignments, r => r.AssignmentId, a => a.AssignmentID, (r, a) => a)
                    .AsNoTracking()
                    .FirstOrDefaultAsync(cancellationToken);

                if (assignment != null && assignment.CommitteeID.HasValue)
                {
                    var member = await _db.CommitteeMembers.AsNoTracking()
                        .FirstOrDefaultAsync(m => m.CommitteeID == assignment.CommitteeID && m.MemberLecturerCode == lecturerCode, cancellationToken);

                    if (member != null && string.Equals(NormalizeRole(member.Role), "UVTK", StringComparison.OrdinalIgnoreCase))
                    {
                        // Secretary review: approve and notify student with the provided reason
                        await _revisionWorkflowService.ReviewBySecretaryAsync(revisionId, "APPROVE", reason, lecturerCode, actorUserId, null, cancellationToken);
                    }
                }
                response = ApiResponse<bool>.SuccessResponse(true, code: DefenseUcErrorCodes.Revision.ApproveSuccess);
            }
            catch (BusinessRuleException ex)
            {
                response = Fail<bool>(ex.Message, 400, ResolveUcCode(ex.Code, "UC4.1"), ex.Details);
            }

            await SaveIdempotencyResponseAsync("APPROVE_REVISION", revisionId, idempotencyKey, requestHash, response, cancellationToken);
            return response;
        }

        public async Task<ApiResponse<bool>> RejectRevisionAsync(int revisionId, string reason, string lecturerCode, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default)
        {
            var requestHash = ComputeRequestHash("UC4.REJECT_REVISION", revisionId, lecturerCode, reason);
            var replay = await TryReplayResponseAsync<bool>("REJECT_REVISION", revisionId, idempotencyKey, requestHash, cancellationToken);
            if (replay != null)
            {
                return replay;
            }

            ApiResponse<bool> response;
            try
            {
                await _revisionWorkflowService.RejectRevisionAsync(revisionId, reason, lecturerCode, actorUserId, cancellationToken);

                // If the acting lecturer is the committee secretary, perform the secretary review step
                // to set rejection and notify the student.
                var assignment = await _db.DefenseRevisions
                    .Where(r => r.Id == revisionId)
                    .Join(_db.DefenseAssignments, r => r.AssignmentId, a => a.AssignmentID, (r, a) => a)
                    .AsNoTracking()
                    .FirstOrDefaultAsync(cancellationToken);

                if (assignment != null && assignment.CommitteeID.HasValue)
                {
                    var member = await _db.CommitteeMembers.AsNoTracking()
                        .FirstOrDefaultAsync(m => m.CommitteeID == assignment.CommitteeID && m.MemberLecturerCode == lecturerCode, cancellationToken);

                    if (member != null && string.Equals(NormalizeRole(member.Role), "UVTK", StringComparison.OrdinalIgnoreCase))
                    {
                        await _revisionWorkflowService.ReviewBySecretaryAsync(revisionId, "REJECT", reason, lecturerCode, actorUserId, null, cancellationToken);
                    }
                }
                response = ApiResponse<bool>.SuccessResponse(true, code: DefenseUcErrorCodes.Revision.RejectSuccess);
            }
            catch (BusinessRuleException ex)
            {
                response = Fail<bool>(ex.Message, 400, ResolveUcCode(ex.Code, "UC4.1"), ex.Details);
            }

            await SaveIdempotencyResponseAsync("REJECT_REVISION", revisionId, idempotencyKey, requestHash, response, cancellationToken);
            return response;
        }

        public async Task<ApiResponse<bool>> SubmitStudentRevisionAsync(StudentRevisionSubmissionDto request, string studentCode, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default)
        {
            var file = request.File;
            var requestHash = ComputeRequestHash("UC4.SUBMIT_STUDENT_REVISION", request.AssignmentId, studentCode, request.RevisedContent ?? string.Empty, file?.FileName ?? string.Empty, file?.Length ?? 0);
            var replay = await TryReplayResponseAsync<bool>("SUBMIT_STUDENT_REVISION", request.AssignmentId, idempotencyKey, requestHash, cancellationToken);
            if (replay != null)
            {
                return replay;
            }

            ApiResponse<bool> response;
            try
            {
                await _revisionWorkflowService.SubmitStudentRevisionAsync(request, studentCode, actorUserId, cancellationToken);
                response = ApiResponse<bool>.SuccessResponse(true, code: DefenseUcErrorCodes.Revision.SubmitSuccess);
            }
            catch (BusinessRuleException ex)
            {
                response = Fail<bool>(ex.Message, 400, ResolveUcCode(ex.Code, "UC4.1"), ex.Details);
            }

            await SaveIdempotencyResponseAsync("SUBMIT_STUDENT_REVISION", request.AssignmentId, idempotencyKey, requestHash, response, cancellationToken);
            return response;
        }

        private async Task ApplyCouncilPayloadAsync(Committee committee, CouncilUpsertDto request, DateTime now, CancellationToken cancellationToken)
        {
            var periodId = committee.DefenseTermId;
            var requestedStudentCodes = request.MorningStudentCodes
                .Concat(request.AfternoonStudentCodes)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var scopedStudentCodes = await _db.DefenseTermStudents.AsNoTracking()
                .Where(x => x.DefenseTermId == periodId && x.StudentCode != null)
                .Select(x => x.StudentCode)
                .Distinct()
                .ToListAsync(cancellationToken);

            var scopedStudentSet = scopedStudentCodes.ToHashSet(StringComparer.OrdinalIgnoreCase);
            var outOfScopeStudents = requestedStudentCodes.Where(code => !scopedStudentSet.Contains(code)).ToList();
            if (outOfScopeStudents.Count > 0)
            {
                throw new BusinessRuleException(
                    "Có sinh viên không thuộc scope đợt đồ án tốt nghiệp.",
                    "UC2.3.STUDENT_OUT_OF_SCOPE",
                    new { Students = outOfScopeStudents });
            }

            var topics = await _db.Topics
                .Where(x => x.DefenseTermId == periodId
                    && x.ProposerStudentCode != null
                    && requestedStudentCodes.Contains(x.ProposerStudentCode))
                .ToListAsync(cancellationToken);

            var topicByStudent = topics
                .Where(t => !string.IsNullOrWhiteSpace(t.ProposerStudentCode))
                .GroupBy(t => t.ProposerStudentCode!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    g => g.Key,
                    g => g.OrderByDescending(x => x.LastUpdated ?? x.CreatedAt).ThenBy(x => x.TopicCode).First(),
                    StringComparer.OrdinalIgnoreCase);

            var missingStudents = requestedStudentCodes.Where(code => !topicByStudent.ContainsKey(code)).ToList();
            if (missingStudents.Count > 0)
            {
                throw new BusinessRuleException(
                    "Không tìm thấy đề tài theo scope đợt cho một số sinh viên.",
                    "UC2.3.TOPIC_NOT_FOUND",
                    new { Students = missingStudents });
            }

            var forbiddenSupervisors = topics
                .Select(x => x.SupervisorLecturerCode)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x!.Trim())
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            foreach (var member in request.Members)
            {
                var normalizedLecturerCode = (member.LecturerCode ?? string.Empty).Trim();
                if (forbiddenSupervisors.Contains(normalizedLecturerCode))
                {
                    throw new BusinessRuleException(
                        "GVHD của sinh viên trong hội đồng không được nằm trong thành viên hội đồng.",
                        "UC2.3.LECTURER_SUPERVISOR_CONFLICT",
                        new { member.LecturerCode });
                }
            }

            var requestedLecturerCodes = request.Members
                .Where(x => !string.IsNullOrWhiteSpace(x.LecturerCode))
                .Select(x => x.LecturerCode.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var lecturers = await _db.DefenseTermLecturers
                .AsNoTracking()
                .Where(x => x.DefenseTermId == periodId && requestedLecturerCodes.Contains(x.LecturerCode))
                .Join(_db.LecturerProfiles.AsNoTracking(), dt => dt.LecturerCode, lp => lp.LecturerCode, (dt, lp) => new { dt, lp })
                .GroupJoin(
                    _db.Users.AsNoTracking(),
                    x => x.dt.UserCode,
                    u => u.UserCode,
                    (x, users) => new
                    {
                        x.dt.LecturerCode,
                        x.dt.LecturerProfileID,
                        x.dt.UserCode,
                        UserID = users.Select(u => (int?)u.UserID).FirstOrDefault()
                    })
                .ToListAsync(cancellationToken);

            var lecturerMap = lecturers.ToDictionary(x => x.LecturerCode, StringComparer.OrdinalIgnoreCase);
            var outOfScopeLecturers = requestedLecturerCodes.Where(code => !lecturerMap.ContainsKey(code)).ToList();
            if (outOfScopeLecturers.Count > 0)
            {
                throw new BusinessRuleException(
                    "Có giảng viên không thuộc scope đợt đồ án tốt nghiệp.",
                    "UC2.3.LECTURER_OUT_OF_SCOPE",
                    new { Lecturers = outOfScopeLecturers });
            }

            if (!committee.DefenseTermId.HasValue)
            {
                throw new BusinessRuleException("Hội đồng chưa thuộc đợt đồ án tốt nghiệp.", "UC2.3.COUNCIL_NOT_IN_PERIOD");
            }

            await EnsureLecturerSingleCouncilPerDayAsync(
                committee.DefenseTermId.Value,
                committee.CommitteeID,
                committee.DefenseDate,
                requestedLecturerCodes,
                cancellationToken);

            foreach (var member in request.Members)
            {
                var normalizedLecturerCode = (member.LecturerCode ?? string.Empty).Trim();
                var lecturer = lecturerMap[normalizedLecturerCode];

                await _uow.CommitteeMembers.AddAsync(new CommitteeMember
                {
                    CommitteeID = committee.CommitteeID,
                    CommitteeCode = committee.CommitteeCode,
                    MemberLecturerCode = lecturer.LecturerCode,
                    MemberLecturerProfileID = lecturer.LecturerProfileID,
                    MemberUserCode = lecturer.UserCode,
                    MemberUserID = lecturer.UserID,
                    Role = NormalizeRole(member.Role),
                    IsChair = string.Equals(NormalizeRole(member.Role), "CT", StringComparison.OrdinalIgnoreCase),
                    CreatedAt = now,
                    LastUpdated = now
                });
            }

            var requestedCouncilTags = NormalizeTagCodes(request.CouncilTags);
            var desiredCouncilTags = requestedCouncilTags;
            if (desiredCouncilTags.Count == 0)
            {
                var councilTopicCodes = topicByStudent.Values
                    .Select(x => x.TopicCode)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                var topicTagMap = await LoadTopicTagMapAsync(councilTopicCodes, cancellationToken);
                var lecturerTagMap = await LoadLecturerTagMapAsync(requestedLecturerCodes, cancellationToken);
                desiredCouncilTags = NormalizeTagCodes(
                    topicTagMap.Values.SelectMany(x => x)
                        .Concat(lecturerTagMap.Values.SelectMany(x => x)));
            }

            var tagCatalogByCode = await LoadTagCatalogByCodeAsync(cancellationToken);
            await AddCommitteeTagsAsync(
                committee,
                ResolveTagEntities(desiredCouncilTags, tagCatalogByCode, "UC2.3.TAG_NOT_FOUND"),
                now,
                cancellationToken);

            var morningStart = new TimeSpan(7, 30, 0);
            var afternoonStart = new TimeSpan(13, 30, 0);

            for (var i = 0; i < request.MorningStudentCodes.Count; i++)
            {
                var studentCode = (request.MorningStudentCodes[i] ?? string.Empty).Trim();
                if (!topicByStudent.TryGetValue(studentCode, out var topic))
                {
                    throw new BusinessRuleException($"Không tìm thấy đề tài cho sinh viên {studentCode}.");
                }

                await CreateAssignmentAsync(committee, topic, 1, i + 1, morningStart.Add(TimeSpan.FromMinutes(i * 60)), now, cancellationToken);
            }

            for (var i = 0; i < request.AfternoonStudentCodes.Count; i++)
            {
                var studentCode = (request.AfternoonStudentCodes[i] ?? string.Empty).Trim();
                if (!topicByStudent.TryGetValue(studentCode, out var topic))
                {
                    throw new BusinessRuleException($"Không tìm thấy đề tài cho sinh viên {studentCode}.");
                }

                await CreateAssignmentAsync(committee, topic, 2, i + 1, afternoonStart.Add(TimeSpan.FromMinutes(i * 60)), now, cancellationToken);
            }

            committee.Status = "Ready";
            _uow.Committees.Update(committee);
        }

        private async Task SaveCouncilTagsAsync(Committee committee, List<string> requestedTagCodes, DateTime now, CancellationToken cancellationToken)
        {
            var existingTags = await _db.CommitteeTags.Where(x => x.CommitteeID == committee.CommitteeID).ToListAsync(cancellationToken);
            if (existingTags.Count > 0)
            {
                _db.CommitteeTags.RemoveRange(existingTags);
            }

            var normalizedTagCodes = NormalizeTagCodes(requestedTagCodes);

            if (normalizedTagCodes.Count == 0)
            {
                return;
            }

            var tagCatalogByCode = await LoadTagCatalogByCodeAsync(cancellationToken);
            await AddCommitteeTagsAsync(
                committee,
                ResolveTagEntities(normalizedTagCodes, tagCatalogByCode, "UC2.3.TAG_NOT_FOUND"),
                now,
                cancellationToken);
        }

        private async Task SaveCouncilMembersAsync(Committee committee, List<CouncilMemberInputDto> members, DateTime now, CancellationToken cancellationToken)
        {
            var normalizedMembers = members
                .Where(x => !string.IsNullOrWhiteSpace(x.LecturerCode))
                .Select(x => new CouncilMemberInputDto
                {
                    LecturerCode = x.LecturerCode.Trim(),
                    Role = NormalizeRole(x.Role)
                })
                .ToList();

            var duplicateLecturer = normalizedMembers
                .GroupBy(x => x.LecturerCode, StringComparer.OrdinalIgnoreCase)
                .FirstOrDefault(g => g.Count() > 1);
            if (duplicateLecturer != null)
            {
                throw new BusinessRuleException("Không được trùng giảng viên trong cùng hội đồng.", "UC2.3.DUPLICATE_MEMBER", new { duplicateLecturer.Key });
            }

            var lecturerCodes = normalizedMembers.Select(x => x.LecturerCode).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            var lecturers = await _db.DefenseTermLecturers
                .AsNoTracking()
                .Where(x => x.DefenseTermId == committee.DefenseTermId && lecturerCodes.Contains(x.LecturerCode))
                .Join(_db.LecturerProfiles.AsNoTracking(), dt => dt.LecturerCode, lp => lp.LecturerCode, (dt, lp) => new { dt, lp })
                .GroupJoin(
                    _db.Users.AsNoTracking(),
                    x => x.dt.UserCode,
                    u => u.UserCode,
                    (x, users) => new
                    {
                        x.dt.LecturerCode,
                        x.dt.LecturerProfileID,
                        x.dt.UserCode,
                        UserID = users.Select(u => (int?)u.UserID).FirstOrDefault()
                    })
                .ToListAsync(cancellationToken);

            var lecturerMap = lecturers.ToDictionary(x => x.LecturerCode, StringComparer.OrdinalIgnoreCase);
            var outOfScopeLecturers = lecturerCodes.Where(code => !lecturerMap.ContainsKey(code)).ToList();
            if (outOfScopeLecturers.Count > 0)
            {
                throw new BusinessRuleException(
                    "Có giảng viên không thuộc scope đợt đồ án tốt nghiệp.",
                    "UC2.3.LECTURER_OUT_OF_SCOPE",
                    new { Lecturers = outOfScopeLecturers });
            }

            if (!committee.DefenseTermId.HasValue)
            {
                throw new BusinessRuleException("Hội đồng chưa thuộc đợt đồ án tốt nghiệp.", "UC2.3.COUNCIL_NOT_IN_PERIOD");
            }

            await EnsureLecturerSingleCouncilPerDayAsync(
                committee.DefenseTermId.Value,
                committee.CommitteeID,
                committee.DefenseDate,
                lecturerCodes,
                cancellationToken);

            foreach (var member in normalizedMembers)
            {
                var lecturer = lecturerMap[member.LecturerCode];

                await _uow.CommitteeMembers.AddAsync(new CommitteeMember
                {
                    CommitteeID = committee.CommitteeID,
                    CommitteeCode = committee.CommitteeCode,
                    MemberLecturerCode = lecturer.LecturerCode,
                    MemberLecturerProfileID = lecturer.LecturerProfileID,
                    MemberUserCode = lecturer.UserCode,
                    MemberUserID = lecturer.UserID,
                    Role = member.Role,
                    IsChair = string.Equals(member.Role, "CT", StringComparison.OrdinalIgnoreCase),
                    CreatedAt = now,
                    LastUpdated = now
                });
            }
        }

        private async Task EnsureLecturerSingleCouncilPerDayAsync(
            int periodId,
            int currentCommitteeId,
            DateTime? defenseDate,
            IReadOnlyCollection<string> lecturerCodes,
            CancellationToken cancellationToken)
        {
            if (!defenseDate.HasValue || lecturerCodes.Count == 0)
            {
                return;
            }

            var normalizedLecturerCodes = lecturerCodes
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (normalizedLecturerCodes.Count == 0)
            {
                return;
            }

            var dayStart = defenseDate.Value.Date;
            var dayEnd = dayStart.AddDays(1);

            var conflicts = await _db.CommitteeMembers.AsNoTracking()
                .Where(member =>
                    member.CommitteeID.HasValue &&
                    member.CommitteeID.Value != currentCommitteeId &&
                    member.MemberLecturerCode != null &&
                    normalizedLecturerCodes.Contains(member.MemberLecturerCode))
                .Join(
                    _db.Committees.AsNoTracking(),
                    member => member.CommitteeID!.Value,
                    committee => committee.CommitteeID,
                    (member, committee) => new
                    {
                        LecturerCode = member.MemberLecturerCode!,
                        committee.CommitteeID,
                        committee.CommitteeCode,
                        committee.DefenseTermId,
                        committee.DefenseDate
                    })
                .Where(item =>
                    item.DefenseTermId == periodId &&
                    item.DefenseDate.HasValue &&
                    item.DefenseDate.Value >= dayStart &&
                    item.DefenseDate.Value < dayEnd)
                .ToListAsync(cancellationToken);

            if (conflicts.Count == 0)
            {
                return;
            }

            var conflictLecturers = conflicts
                .Select(x => x.LecturerCode)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(x => x)
                .ToList();
            var conflictCouncils = conflicts
                .Select(x => string.IsNullOrWhiteSpace(x.CommitteeCode) ? $"ID-{x.CommitteeID}" : x.CommitteeCode!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(x => x)
                .ToList();

            throw new BusinessRuleException(
                $"Giảng viên chỉ được tham gia 1 hội đồng trong ngày {dayStart:yyyy-MM-dd}.",
                "UC2.3.LECTURER_DAY_CONFLICT",
                new
                {
                    Date = dayStart.ToString("yyyy-MM-dd"),
                    Lecturers = conflictLecturers,
                    Councils = conflictCouncils
                });
        }

        private async Task SaveCouncilAssignmentsAsync(Committee committee, List<CouncilAssignmentInputDto> assignments, DateTime now, CancellationToken cancellationToken)
        {
            var normalizedAssignments = assignments
                .Where(x => !string.IsNullOrWhiteSpace(x.TopicCode))
                .Select(x => new
                {
                    TopicCode = x.TopicCode.Trim(),
                    Session = ToSessionNumber(x.SessionCode),
                    ScheduledAt = (x.ScheduledAt ?? committee.DefenseDate ?? now.Date).Date,
                    StartTime = ParseRequiredTime(x.StartTime, "UC2.3.INVALID_START_TIME"),
                    EndTime = ParseRequiredTime(x.EndTime, "UC2.3.INVALID_END_TIME"),
                    OrderIndex = x.OrderIndex
                })
                .ToList();

            var usedOrderIndexesBySession = new Dictionary<int, HashSet<int>>();
            var nextOrderIndexBySession = new Dictionary<int, int>();

            var duplicateTopic = normalizedAssignments
                .GroupBy(x => x.TopicCode, StringComparer.OrdinalIgnoreCase)
                .FirstOrDefault(g => g.Count() > 1);
            if (duplicateTopic != null)
            {
                throw new BusinessRuleException("Không được gán trùng đề tài trong cùng hội đồng.", "UC2.3.DUPLICATE_TOPIC", new { duplicateTopic.Key });
            }

            if (normalizedAssignments.Any(x => x.EndTime <= x.StartTime))
            {
                throw new BusinessRuleException("endTime phải lớn hơn startTime.", "UC2.3.INVALID_TIME_RANGE");
            }

            var topicCodes = normalizedAssignments.Select(x => x.TopicCode).ToList();
            var topics = await _db.Topics
                .Where(x => x.DefenseTermId == committee.DefenseTermId && topicCodes.Contains(x.TopicCode))
                .ToListAsync(cancellationToken);
            if (topics.Count != topicCodes.Count)
            {
                throw new BusinessRuleException("Có đề tài không tồn tại trong scope đợt đồ án tốt nghiệp.", "UC2.3.TOPIC_NOT_FOUND");
            }

            var scopedStudentCodes = await _db.DefenseTermStudents.AsNoTracking()
                .Where(x => x.DefenseTermId == committee.DefenseTermId && x.StudentCode != null)
                .Select(x => x.StudentCode)
                .Distinct()
                .ToListAsync(cancellationToken);
            var scopedStudentSet = scopedStudentCodes.ToHashSet(StringComparer.OrdinalIgnoreCase);

            var outOfScopeStudents = topics
                .Where(x => string.IsNullOrWhiteSpace(x.ProposerStudentCode) || !scopedStudentSet.Contains(x.ProposerStudentCode!))
                .Select(x => x.ProposerStudentCode ?? string.Empty)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (outOfScopeStudents.Count > 0)
            {
                throw new BusinessRuleException(
                    "Có sinh viên của đề tài không thuộc scope đợt đồ án tốt nghiệp.",
                    "UC2.3.STUDENT_OUT_OF_SCOPE",
                    new { Students = outOfScopeStudents });
            }

            await _constraintService.ValidateBeforeAssignmentAsync(
                committee.CommitteeID,
                topicCodes,
                normalizedAssignments.Select(x => (x.ScheduledAt.Date, x.Session)).Distinct().ToList(),
                cancellationToken);

            for (var i = 0; i < normalizedAssignments.Count; i++)
            {
                var row = normalizedAssignments[i];
                if (!usedOrderIndexesBySession.TryGetValue(row.Session, out var usedOrderIndexes))
                {
                    usedOrderIndexes = new HashSet<int>();
                    usedOrderIndexesBySession[row.Session] = usedOrderIndexes;
                }

                if (!nextOrderIndexBySession.TryGetValue(row.Session, out var nextOrderIndex))
                {
                    nextOrderIndex = 1;
                }

                var orderIndex = ResolveAssignmentOrderIndex(
                    usedOrderIndexes,
                    row.OrderIndex,
                    nextOrderIndex,
                    "UC2.3.INVALID_ORDER_INDEX",
                    "UC2.3.DUPLICATE_ORDER_INDEX",
                    row.Session);

                nextOrderIndexBySession[row.Session] = Math.Max(nextOrderIndex, orderIndex + 1);
                var topic = topics.First(x => string.Equals(x.TopicCode, row.TopicCode, StringComparison.OrdinalIgnoreCase));

                await _uow.DefenseAssignments.AddAsync(new DefenseAssignment
                {
                    AssignmentCode = $"AS{committee.CommitteeCode}_{topic.TopicCode}_{row.Session}_{orderIndex:D2}",
                    CommitteeID = committee.CommitteeID,
                    DefenseTermId = committee.DefenseTermId,
                    CommitteeCode = committee.CommitteeCode,
                    TopicID = topic.TopicID,
                    TopicCode = topic.TopicCode,
                    ScheduledAt = row.ScheduledAt,
                    Session = row.Session,
                    Shift = row.Session == 1 ? DefenseSessionCodes.Morning : DefenseSessionCodes.Afternoon,
                    OrderIndex = orderIndex,
                    StartTime = row.StartTime,
                    EndTime = row.EndTime,
                    AssignedBy = "admin",
                    AssignedAt = now,
                    Status = DefenseWorkflowStateMachine.ToValue(AssignmentStatus.Pending),
                    CreatedAt = now,
                    LastUpdated = now
                });

                MarkTopicAssigned(topic, now);
            }

            var committeeHasMembers = await _db.CommitteeMembers.AsNoTracking()
                .Where(x => x.CommitteeID == committee.CommitteeID)
                .Select(x => (int?)x.CommitteeMemberID)
                .FirstOrDefaultAsync(cancellationToken) != null;
            if (committeeHasMembers && normalizedAssignments.Count > 0)
            {
                committee.Status = DefenseWorkflowStateMachine.ToValue(CommitteeStatus.Ready);
                committee.LastUpdated = now;
                _uow.Committees.Update(committee);
            }
        }

        private async Task CreateAssignmentAsync(Committee committee, Topic topic, int session, int orderIndex, TimeSpan start, DateTime now, CancellationToken cancellationToken)
        {
            await _uow.DefenseAssignments.AddAsync(new DefenseAssignment
            {
            AssignmentCode = $"AS{committee.CommitteeCode}_{topic.TopicCode}_{session}_{orderIndex:D2}",
                CommitteeID = committee.CommitteeID,
                DefenseTermId = committee.DefenseTermId,
                CommitteeCode = committee.CommitteeCode,
                TopicID = topic.TopicID,
                TopicCode = topic.TopicCode,
            ScheduledAt = committee.DefenseDate ?? now.Date,
                Session = session,
            OrderIndex = orderIndex,
                StartTime = start,
                EndTime = start.Add(TimeSpan.FromMinutes(60)),
                AssignedBy = "system",
                AssignedAt = now,
                Status = DefenseWorkflowStateMachine.ToValue(AssignmentStatus.Pending),
                CreatedAt = now,
                LastUpdated = now
            });

            MarkTopicAssigned(topic, now);
        }

        private void MarkTopicAssigned(Topic topic, DateTime now)
        {
            var tracked = _db.Topics.Local.FirstOrDefault(x => x.TopicCode == topic.TopicCode);
            if (tracked != null)
            {
                tracked.Status = "Đã phân hội đồng";
                tracked.LastUpdated = now;
                return;
            }

            // Update only assignment-related fields to avoid full-row updates on detached Topic snapshots.
            var topicStub = new Topic
            {
                TopicID = topic.TopicID,
                TopicCode = topic.TopicCode
            };
            _db.Topics.Attach(topicStub);
            topicStub.Status = "Đã phân hội đồng";
            topicStub.LastUpdated = now;
            _db.Entry(topicStub).Property(x => x.Status).IsModified = true;
            _db.Entry(topicStub).Property(x => x.LastUpdated).IsModified = true;
        }

        private async Task RestoreTopicsToEligibleStatusIfUnassignedAsync(
            int periodId,
            int councilId,
            IReadOnlyCollection<string> topicCodes,
            DateTime now,
            CancellationToken cancellationToken)
        {
            var normalizedTopicCodes = topicCodes
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (normalizedTopicCodes.Count == 0)
            {
                return;
            }

            var topicCodesAssignedElsewhere = await _db.DefenseAssignments.AsNoTracking()
                .Where(x => x.DefenseTermId == periodId
                    && x.CommitteeID.HasValue
                    && x.CommitteeID.Value != councilId
                    && x.TopicCode != null
                    && normalizedTopicCodes.Contains(x.TopicCode))
                .Select(x => x.TopicCode!)
                .Distinct()
                .ToListAsync(cancellationToken);

            var topicCodesToRestore = normalizedTopicCodes
                .Except(topicCodesAssignedElsewhere, StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (topicCodesToRestore.Count == 0)
            {
                return;
            }

            var topicsToRestore = await _db.Topics
                .Where(x => x.DefenseTermId == periodId
                    && topicCodesToRestore.Contains(x.TopicCode))
                .ToListAsync(cancellationToken);

            foreach (var topic in topicsToRestore)
            {
                MarkTopicEligible(topic, now);
            }
        }

        private void MarkTopicEligible(Topic topic, DateTime now)
        {
            var tracked = _db.Topics.Local.FirstOrDefault(x => x.TopicCode == topic.TopicCode);
            if (tracked != null)
            {
                tracked.Status = "Đủ điều kiện bảo vệ";
                tracked.LastUpdated = now;
                return;
            }

            var topicStub = new Topic
            {
                TopicID = topic.TopicID,
                TopicCode = topic.TopicCode
            };
            _db.Topics.Attach(topicStub);
            topicStub.Status = "Đủ điều kiện bảo vệ";
            topicStub.LastUpdated = now;
            _db.Entry(topicStub).Property(x => x.Status).IsModified = true;
            _db.Entry(topicStub).Property(x => x.LastUpdated).IsModified = true;
        }

        private async Task ValidateCouncilPayloadAsync(int periodId, DefensePeriodConfigState config, CouncilUpsertDto request, CancellationToken cancellationToken)
        {
            var topicsPerSession = NormalizeTopicsPerSession(config.CouncilConfig.TopicsPerSessionConfig);
            var membersPerCouncil = NormalizeMembersPerCouncil(config.CouncilConfig.MembersPerCouncilConfig);

            if (request.MorningStudentCodes.Count != topicsPerSession)
            {
                throw new BusinessRuleException($"Mỗi hội đồng phải có đúng {topicsPerSession} sinh viên buổi sáng.", "UC2.3.INVALID_TOPIC_COUNT_SESSION");
            }

            if (request.AfternoonStudentCodes.Count != topicsPerSession)
            {
                throw new BusinessRuleException($"Mỗi hội đồng phải có đúng {topicsPerSession} sinh viên buổi chiều.", "UC2.3.INVALID_TOPIC_COUNT_SESSION");
            }

            if (request.Members.Count != membersPerCouncil)
            {
                throw new BusinessRuleException($"Mỗi hội đồng phải có đúng {membersPerCouncil} thành viên.", "UC2.3.INVALID_MEMBER_COUNT");
            }

            var roles = request.Members.Select(x => NormalizeRole(x.Role)).ToList();
            ValidateRolePlan(roles, membersPerCouncil, "UC2.3.INVALID_ROLE_PLAN");

            var normalizedLecturerCodes = request.Members
                .Where(x => !string.IsNullOrWhiteSpace(x.LecturerCode))
                .Select(x => x.LecturerCode.Trim())
                .ToList();

            var duplicateLecturer = normalizedLecturerCodes
                .GroupBy(x => x, StringComparer.OrdinalIgnoreCase)
                .FirstOrDefault(g => g.Count() > 1);
            if (duplicateLecturer != null)
            {
                throw new BusinessRuleException("Không được trùng giảng viên trong cùng hội đồng.", "UC2.3.DUPLICATE_MEMBER", new { duplicateLecturer.Key });
            }

            var scopedLecturerCodes = await _db.DefenseTermLecturers.AsNoTracking()
                .Where(x => x.DefenseTermId == periodId && x.LecturerCode != null)
                .Select(x => x.LecturerCode)
                .Distinct()
                .ToListAsync(cancellationToken);

            var scopedLecturerSet = scopedLecturerCodes.ToHashSet(StringComparer.OrdinalIgnoreCase);
            var outOfScopeLecturers = normalizedLecturerCodes
                .Where(code => !scopedLecturerSet.Contains(code))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (outOfScopeLecturers.Count > 0)
            {
                throw new BusinessRuleException(
                    "Có giảng viên không thuộc scope đợt đồ án tốt nghiệp.",
                    "UC2.3.LECTURER_OUT_OF_SCOPE",
                    new { Lecturers = outOfScopeLecturers });
            }

            var students = request.MorningStudentCodes
                .Concat(request.AfternoonStudentCodes)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x.Trim())
                .ToList();
            var expectedTotalTopics = topicsPerSession * 2;

            if (students.Count != expectedTotalTopics)
            {
                throw new BusinessRuleException("Danh sách sinh viên không hợp lệ hoặc thiếu mã sinh viên.", "UC2.3.INVALID_TOPIC_COUNT_SESSION");
            }

            if (students.Distinct(StringComparer.OrdinalIgnoreCase).Count() != expectedTotalTopics)
            {
                throw new BusinessRuleException("Không được trùng sinh viên giữa 2 buổi.");
            }

            var scopedStudentCodes = await _db.DefenseTermStudents.AsNoTracking()
                .Where(x => x.DefenseTermId == periodId && x.StudentCode != null)
                .Select(x => x.StudentCode)
                .Distinct()
                .ToListAsync(cancellationToken);

            var scopedStudentSet = scopedStudentCodes.ToHashSet(StringComparer.OrdinalIgnoreCase);
            var outOfScopeStudents = students
                .Where(code => !scopedStudentSet.Contains(code))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (outOfScopeStudents.Count > 0)
            {
                throw new BusinessRuleException(
                    "Có sinh viên không thuộc scope đợt đồ án tốt nghiệp.",
                    "UC2.3.STUDENT_OUT_OF_SCOPE",
                    new { Students = outOfScopeStudents });
            }

            var selectedTopics = await _db.Topics.AsNoTracking()
                .Where(t => t.DefenseTermId == periodId
                    && t.ProposerStudentCode != null
                    && students.Contains(t.ProposerStudentCode))
                .ToListAsync(cancellationToken);

            var topicByStudent = selectedTopics
                .Where(t => !string.IsNullOrWhiteSpace(t.ProposerStudentCode))
                .GroupBy(t => t.ProposerStudentCode!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    g => g.Key,
                    g => g.OrderByDescending(x => x.LastUpdated ?? x.CreatedAt).ThenBy(x => x.TopicCode).First(),
                    StringComparer.OrdinalIgnoreCase);

            var missingStudents = students
                .Where(code => !topicByStudent.ContainsKey(code))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (missingStudents.Count > 0)
            {
                throw new BusinessRuleException(
                    "Danh sách sinh viên không hợp lệ hoặc chưa đủ điều kiện trong scope đợt.",
                    "UC2.3.TOPIC_NOT_FOUND",
                    new { Students = missingStudents });
            }
        }

        private static void ValidatePeriodConfig(UpdateDefensePeriodConfigDto request, int topicsPerSession)
        {
            var rooms = request.Rooms.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()).ToList();
            if (rooms.Count == 0)
            {
                throw new BusinessRuleException("Cần khai báo ít nhất 1 phòng đồ án tốt nghiệp.");
            }

            if (!TimeSpan.TryParse(request.MorningStart, out var morningStart))
            {
                throw new BusinessRuleException("morningStart không đúng định dạng HH:mm.");
            }

            if (!TimeSpan.TryParse(request.AfternoonStart, out var afternoonStart))
            {
                throw new BusinessRuleException("afternoonStart không đúng định dạng HH:mm.");
            }

            var effectiveTopicsPerSession = NormalizeTopicsPerSession(topicsPerSession);
            var morningEnd = morningStart.Add(SessionDuration.Multiply(effectiveTopicsPerSession));
            if (afternoonStart < morningEnd)
            {
                throw new BusinessRuleException("Khung giờ chiều bị chồng lấn với lịch sáng. afternoonStart phải >= giờ kết thúc buổi sáng.");
            }
        }

        private static void ValidateDefensePeriodWindow(DateTime startDate, DateTime? endDate)
        {
            if (endDate.HasValue && endDate.Value.Date < startDate.Date)
            {
                throw new BusinessRuleException("EndDate phải lớn hơn hoặc bằng StartDate.", "UC1.2.DATE_RANGE_INVALID");
            }
        }

        private static void EnsureCouncilListUnlocked(DefensePeriodConfigState config)
        {
            if (config.CouncilListLocked)
            {
                throw new BusinessRuleException(
                    "Danh sách hội đồng đã được chốt. Vui lòng mở lại chốt trước khi chỉnh sửa.",
                    "UC2.6.COUNCIL_LIST_LOCKED");
            }
        }

        private static void EnsureCouncilDateWithinPeriod(DefenseTerm period, DateTime? defenseDate)
        {
            var startDate = period.StartDate.Date;
            var endDate = period.EndDate?.Date;
            if (!defenseDate.HasValue)
            {
                throw new BusinessRuleException("Ngày hội đồng là bắt buộc.", "UC2.3.DATE_REQUIRED");
            }

            var councilDate = defenseDate.Value.Date;

            if (councilDate < startDate)
            {
                throw new BusinessRuleException("Ngày hội đồng phải nằm trong khoảng ngày của đợt đồ án tốt nghiệp.", "UC2.3.DATE_BEFORE_PERIOD", new { councilDate, startDate, endDate });
            }

            if (endDate.HasValue && councilDate > endDate.Value)
            {
                throw new BusinessRuleException("Ngày hội đồng phải nằm trong khoảng ngày của đợt đồ án tốt nghiệp.", "UC2.3.DATE_AFTER_PERIOD", new { councilDate, startDate, endDate });
            }
        }

        private static string NormalizeRoomCode(string? roomCode, string errorCode)
        {
            if (string.IsNullOrWhiteSpace(roomCode))
            {
                throw new BusinessRuleException("Room là bắt buộc.", errorCode);
            }

            var normalized = roomCode.Trim().ToUpperInvariant();
            if (normalized.Length > 40)
            {
                throw new BusinessRuleException("Room tối đa 40 ký tự.", errorCode, new { Room = normalized });
            }

            return normalized;
        }

        private static string BuildRoomDateSlotKey(string roomCode, DateTime defenseDate)
        {
            return $"{roomCode}|{defenseDate:yyyyMMdd}";
        }

        private static List<DateTime> BuildDefenseDateRange(DefenseTerm period)
        {
            var start = period.StartDate.Date;
            var end = (period.EndDate ?? period.StartDate).Date;
            if (end < start)
            {
                end = start;
            }

            var dates = new List<DateTime>();
            for (var date = start; date <= end; date = date.AddDays(1))
            {
                dates.Add(date);
            }

            return dates;
        }

        private static List<DateTime> BuildDefenseDateRange(DateTime startDate, DateTime? endDate)
        {
            var start = startDate.Date;
            var end = (endDate ?? startDate).Date;
            if (end < start)
            {
                end = start;
            }

            var dates = new List<DateTime>();
            for (var date = start; date <= end; date = date.AddDays(1))
            {
                dates.Add(date);
            }

            return dates;
        }

        private static bool TryAllocateRoomDateSlot(
            IReadOnlyList<string> roomCodes,
            IReadOnlyList<DateTime> defenseDates,
            HashSet<string> occupiedSlots,
            ref int roomIndex,
            out string roomCode,
            out DateTime defenseDate)
        {
            roomCode = string.Empty;
            defenseDate = default;

            if (roomCodes.Count == 0 || defenseDates.Count == 0)
            {
                return false;
            }

            for (var d = 0; d < defenseDates.Count; d++)
            {
                var date = defenseDates[d].Date;
                for (var r = 0; r < roomCodes.Count; r++)
                {
                    var idx = (roomIndex + r) % roomCodes.Count;
                    var candidateRoom = roomCodes[idx];
                    var key = BuildRoomDateSlotKey(candidateRoom, date);
                    if (occupiedSlots.Contains(key))
                    {
                        continue;
                    }

                    occupiedSlots.Add(key);
                    roomIndex = (idx + 1) % roomCodes.Count;
                    roomCode = candidateRoom;
                    defenseDate = date;
                    return true;
                }
            }

            return false;
        }

        private async Task<List<string>> NormalizeAndValidateRoomCodesAsync(IEnumerable<string> roomCodes, CancellationToken cancellationToken, string errorCode)
        {
            var normalizedCodes = roomCodes
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => NormalizeRoomCode(x, errorCode))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (normalizedCodes.Count == 0)
            {
                return normalizedCodes;
            }

            var existingCodes = (await LoadRoomCodesForValidationAsync(cancellationToken))
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x.Trim().ToUpperInvariant())
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var missingCodes = normalizedCodes
                .Where(code => !existingCodes.Contains(code))
                .OrderBy(code => code)
                .ToList();

            if (missingCodes.Count > 0)
            {
                throw new BusinessRuleException(
                    "Có phòng chưa tồn tại trong danh mục phòng.",
                    errorCode,
                    new { Rooms = missingCodes });
            }

            return normalizedCodes;
        }

        private async Task<string> EnsureRoomCodeExistsAsync(string roomCode, CancellationToken cancellationToken, string errorCode)
        {
            var normalizedRoom = NormalizeRoomCode(roomCode, errorCode);
            var existingCode = (await LoadRoomCodesForValidationAsync(cancellationToken))
                .FirstOrDefault(x => string.Equals(x, normalizedRoom, StringComparison.OrdinalIgnoreCase));

            if (string.IsNullOrWhiteSpace(existingCode))
            {
                throw new BusinessRuleException(
                    "Phòng không tồn tại trong danh mục phòng.",
                    errorCode,
                    new { Room = normalizedRoom });
            }

            return normalizedRoom;
        }

        private async Task<List<string>> LoadRoomCodesForValidationAsync(CancellationToken cancellationToken)
        {
            try
            {
                var rooms = await _db.Rooms.AsNoTracking()
                    .Select(x => x.RoomCode)
                    .ToListAsync(cancellationToken);

                return rooms
                    .Where(x => !string.IsNullOrWhiteSpace(x))
                    .Select(x => x.Trim().ToUpperInvariant())
                    .ToList();
            }
            catch (Exception ex) when (IsOracleSchemaProjectionError(ex))
            {
                // Fall back to raw SQL to support legacy Oracle schemas with different column names.
            }

            var sqlCandidates = new[]
            {
                "SELECT ROOM_CODE FROM ROOMS",
                "SELECT ROOMCODE FROM ROOMS"
            };

            var orderedCandidates = string.IsNullOrWhiteSpace(_cachedRoomCodesReadSql)
                ? sqlCandidates
                : (new[] { _cachedRoomCodesReadSql! }
                    .Concat(sqlCandidates.Where(x => !string.Equals(x, _cachedRoomCodesReadSql, StringComparison.Ordinal)))
                    .ToArray());

            var connection = _db.Database.GetDbConnection();
            var shouldClose = connection.State != ConnectionState.Open;
            if (shouldClose)
            {
                await connection.OpenAsync(cancellationToken);
            }

            try
            {
                foreach (var sql in orderedCandidates)
                {
                    try
                    {
                        using var command = connection.CreateCommand();
                        command.CommandText = sql;

                        using var reader = await command.ExecuteReaderAsync(cancellationToken);
                        var rows = new List<string>();

                        while (await reader.ReadAsync(cancellationToken))
                        {
                            if (reader.IsDBNull(0))
                            {
                                continue;
                            }

                            var roomCode = reader.GetValue(0)?.ToString();
                            if (string.IsNullOrWhiteSpace(roomCode))
                            {
                                continue;
                            }

                            rows.Add(roomCode.Trim().ToUpperInvariant());
                        }

                        _cachedRoomCodesReadSql = sql;
                        return rows;
                    }
                    catch (Exception ex) when (IsOracleSchemaProjectionError(ex))
                    {
                        // Try the next candidate projection.
                    }
                }
            }
            finally
            {
                if (shouldClose)
                {
                    await connection.CloseAsync();
                }
            }

            return new List<string>();
        }

        private async Task EnsureRoomDateSlotAvailableAsync(
            int periodId,
            string roomCode,
            DateTime defenseDate,
            int? excludeCommitteeId,
            CancellationToken cancellationToken,
            string errorCode)
        {
            var normalizedRoom = NormalizeRoomCode(roomCode, errorCode);
            var dayStart = defenseDate.Date;
            var dayEnd = dayStart.AddDays(1);

            var conflict = await _db.Committees.AsNoTracking()
                .Where(x => x.DefenseTermId == periodId
                    && x.DefenseDate.HasValue
                    && x.DefenseDate.Value >= dayStart
                    && x.DefenseDate.Value < dayEnd
                    && x.Room == normalizedRoom
                    && (!excludeCommitteeId.HasValue || x.CommitteeID != excludeCommitteeId.Value))
                .Select(x => new { x.CommitteeID, x.CommitteeCode, x.DefenseDate })
                .FirstOrDefaultAsync(cancellationToken);

            if (conflict != null)
            {
                throw new BusinessRuleException(
                    "Phòng đã được hội đồng khác sử dụng trong ngày này.",
                    errorCode,
                    new
                    {
                        Room = normalizedRoom,
                        Date = dayStart,
                        ConflictCommitteeId = conflict.CommitteeID,
                        ConflictCommitteeCode = conflict.CommitteeCode
                    });
            }
        }

        private static bool IsOracleInvalidIdentifier(Exception ex)
        {
            return ex.Message.Contains("ORA-00904", StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsOracleTableOrViewMissing(Exception ex)
        {
            return ex.Message.Contains("ORA-00942", StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsOracleSchemaProjectionError(Exception ex)
        {
            return IsOracleInvalidIdentifier(ex) || IsOracleTableOrViewMissing(ex);
        }

        private static async Task<RetryExecutionResult<T>> ExecuteWithRetryAsync<T>(Func<Task<T>> action, bool retryOnFailure, CancellationToken cancellationToken)
        {
            var maxAttempts = retryOnFailure ? 3 : 1;
            var lastException = (Exception?)null;
            for (var attempt = 1; attempt <= maxAttempts; attempt++)
            {
                cancellationToken.ThrowIfCancellationRequested();
                try
                {
                    return new RetryExecutionResult<T>
                    {
                        Data = await action(),
                        Attempts = attempt
                    };
                }
                catch (Exception ex) when (attempt < maxAttempts)
                {
                    lastException = ex;
                    await Task.Delay(TimeSpan.FromMilliseconds(300 * attempt), cancellationToken);
                }
            }

            throw lastException ?? new InvalidOperationException("Sync thất bại sau nhiều lần thử.");
        }

        private static Dictionary<string, bool> BuildSyncReadiness(DefensePeriodConfigState config, int eligibleCount)
        {
            return new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase)
            {
                ["module2Ready"] = config.LecturerCapabilitiesLocked && config.CouncilConfigConfirmed && eligibleCount > 0,
                ["hasEligibleTopics"] = eligibleCount > 0,
                ["lecturerCapabilitiesLocked"] = config.LecturerCapabilitiesLocked,
                ["councilConfigConfirmed"] = config.CouncilConfigConfirmed
            };
        }

        private async Task<string> GenerateUniqueCommitteeCodeAsync(int periodId, string? requestKey, CancellationToken cancellationToken)
        {
            _ = periodId;
            _ = requestKey;
            return await GenerateUniqueCommitteeCodeWithoutReservationAsync(cancellationToken);
        }

        private async Task<string> GenerateUniqueCommitteeCodeWithoutReservationAsync(CancellationToken cancellationToken)
        {
            var year = DateTime.UtcNow.Year;
            var prefix = $"HD-{year}-";

            var existingCodes = await _db.Committees.AsNoTracking()
                .Where(x => x.CommitteeCode != null && x.CommitteeCode.StartsWith(prefix))
                .Select(x => x.CommitteeCode!)
                .ToListAsync(cancellationToken);

            var maxSeq = 0;
            foreach (var existingCode in existingCodes)
            {
                if (!existingCode.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                var sequenceText = existingCode.Substring(prefix.Length);
                if (int.TryParse(sequenceText, out var sequence) && sequence > maxSeq)
                {
                    maxSeq = sequence;
                }
            }

            for (var attempt = 1; attempt <= 200; attempt++)
            {
                var seq = maxSeq + attempt;
                var code = $"HD-{year}-{seq:D4}";

                var existsInCommittee = await _db.Committees.AsNoTracking()
                    .Where(x => x.CommitteeCode == code)
                    .Select(x => (int?)x.CommitteeID)
                    .FirstOrDefaultAsync(cancellationToken) != null;

                if (!existsInCommittee)
                {
                    return code;
                }
            }

            throw new BusinessRuleException("Không thể tạo mã hội đồng duy nhất. Vui lòng thử lại.", DefenseUcErrorCodes.AutoCode.ReservationFailed);
        }

        private async Task<string?> ValidateCouncilHardRulesAsync(int councilId, CancellationToken cancellationToken)
        {
            var assignments = await _db.DefenseAssignments.AsNoTracking().Where(x => x.CommitteeID == councilId).ToListAsync(cancellationToken);
            var members = await _db.CommitteeMembers.AsNoTracking().Where(x => x.CommitteeID == councilId).ToListAsync(cancellationToken);

            var morningTopicCount = assignments.Count(x => !string.IsNullOrWhiteSpace(x.TopicCode) && (x.Session ?? 1) == 1);
            if (morningTopicCount < MinTopicsPerSession || morningTopicCount > MaxTopicsPerSession)
            {
                return $"Buổi sáng phải có từ {MinTopicsPerSession} đến {MaxTopicsPerSession} đề tài.";
            }

            var afternoonTopicCount = assignments.Count(x => !string.IsNullOrWhiteSpace(x.TopicCode) && (x.Session ?? 1) == 2);
            if (afternoonTopicCount < MinTopicsPerSession || afternoonTopicCount > MaxTopicsPerSession)
            {
                return $"Buổi chiều phải có từ {MinTopicsPerSession} đến {MaxTopicsPerSession} đề tài.";
            }

            if (members.Count < MinMembersPerCouncil || members.Count > MaxMembersPerCouncil)
            {
                return $"Mỗi hội đồng phải có từ {MinMembersPerCouncil} đến {MaxMembersPerCouncil} thành viên.";
            }

            try
            {
                ValidateRolePlan(members.Select(x => NormalizeRole(x.Role)).ToList(), members.Count, "UC2.3.INVALID_ROLE_PLAN");
            }
            catch (BusinessRuleException ex)
            {
                return ex.Message;
            }

            try
            {
                await _constraintService.EnsureRequiredRolesAsync(councilId, cancellationToken);
            }
            catch (BusinessRuleException ex)
            {
                return ex.Message;
            }

            var topicCodes = assignments.Where(x => !string.IsNullOrWhiteSpace(x.TopicCode)).Select(x => x.TopicCode!).ToList();
            var forbiddenSupervisors = await _db.Topics.AsNoTracking()
                .Where(x => topicCodes.Contains(x.TopicCode))
                .Select(x => x.SupervisorLecturerCode)
                .Where(x => x != null)
                .Select(x => x!)
                .ToListAsync(cancellationToken);

            var conflict = members.Any(m => forbiddenSupervisors.Contains(m.MemberLecturerCode ?? string.Empty, StringComparer.OrdinalIgnoreCase));
            if (conflict)
            {
                return "Vi phạm ràng buộc GVHD không được nằm trong hội đồng của SV mình hướng dẫn.";
            }

            return null;
        }

        private async Task<CouncilDraftDto> BuildCouncilDtoAsync(int periodId, int councilId, string? manualWarning, CancellationToken cancellationToken)
        {
            var committee = await _db.Committees.AsNoTracking().FirstAsync(x => x.CommitteeID == councilId, cancellationToken);
            var assignments = await _db.DefenseAssignments.AsNoTracking()
                .Where(x => x.CommitteeID == councilId)
                .OrderBy(x => x.Session)
                .ThenBy(x => x.OrderIndex)
                .ThenBy(x => x.AssignmentID)
                .ToListAsync(cancellationToken);
            var members = await _db.CommitteeMembers.AsNoTracking().Where(x => x.CommitteeID == councilId).ToListAsync(cancellationToken);
            var tagCodes = await _db.CommitteeTags.AsNoTracking().Where(x => x.CommitteeID == councilId).Select(x => x.TagCode).ToListAsync(cancellationToken);

            var topicCodes = assignments.Where(x => !string.IsNullOrWhiteSpace(x.TopicCode)).Select(x => x.TopicCode!).ToList();
            var topics = await _db.Topics.AsNoTracking().Where(x => topicCodes.Contains(x.TopicCode)).ToListAsync(cancellationToken);
            var topicTagMap = await LoadTopicTagMapAsync(topicCodes, cancellationToken);
            var studentCodes = topics.Where(x => !string.IsNullOrWhiteSpace(x.ProposerStudentCode)).Select(x => x.ProposerStudentCode!).ToList();
            var studentMap = await _db.StudentProfiles.AsNoTracking()
                .Where(x => studentCodes.Contains(x.StudentCode))
                .ToDictionaryAsync(x => x.StudentCode, x => x.FullName ?? x.StudentCode, cancellationToken);

            var forbidden = topics.Select(x => x.SupervisorLecturerCode).Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x!).Distinct(StringComparer.OrdinalIgnoreCase).ToList();

            var lecturers = await _db.LecturerProfiles.AsNoTracking()
                .Select(l => new { l.LecturerCode, Name = l.FullName })
                .ToDictionaryAsync(x => x.LecturerCode, x => x.Name ?? x.LecturerCode, cancellationToken);
            var memberCodes = members
                .Where(x => !string.IsNullOrWhiteSpace(x.MemberLecturerCode))
                .Select(x => x.MemberLecturerCode!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            var lecturerTagMap = await LoadLecturerTagMapAsync(memberCodes, cancellationToken);

            var dto = new CouncilDraftDto
            {
                Id = committee.CommitteeID,
                CommitteeCode = committee.CommitteeCode,
                Name = committee.Name ?? committee.CommitteeCode,
                DefenseDate = committee.DefenseDate,
                ConcurrencyToken = committee.LastUpdated.Ticks.ToString(CultureInfo.InvariantCulture),
                Room = committee.Room ?? string.Empty,
                SlotId = $"{committee.DefenseDate:yyyyMMdd}",
                CouncilTags = tagCodes,
                ForbiddenLecturers = forbidden,
                Members = members.Select(m => new CouncilMemberDto
                {
                    Role = NormalizeRole(m.Role),
                    LecturerCode = m.MemberLecturerCode ?? string.Empty,
                    LecturerName = lecturers.TryGetValue(m.MemberLecturerCode ?? string.Empty, out var n) ? n : (m.MemberLecturerCode ?? string.Empty),
                    Tags = lecturerTagMap.TryGetValue(m.MemberLecturerCode ?? string.Empty, out var memberTags)
                        ? memberTags.OrderBy(x => x).ToList()
                        : new List<string>()
                }).ToList(),
                Status = committee.Status ?? "Draft"
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
                    StudentName = studentMap.TryGetValue(studentCode, out var studentName) ? studentName : studentCode,
                    Session = assignment.Session,
                    SessionCode = assignment.Session == 1 ? DefenseSessionCodes.Morning : DefenseSessionCodes.Afternoon,
                    ScheduledAt = assignment.ScheduledAt,
                    StartTime = assignment.StartTime?.ToString(@"hh\:mm"),
                    EndTime = assignment.EndTime?.ToString(@"hh\:mm"),
                    OrderIndex = assignment.OrderIndex,
                    Status = assignment.Status ?? string.Empty
                });
            }

            foreach (var assignment in assignments.Where(x => x.Session == 1))
            {
                var topic = topics.FirstOrDefault(t => t.TopicCode == assignment.TopicCode);
                if (topic == null)
                {
                    continue;
                }

                dto.MorningStudents.Add(new EligibleStudentDto
                {
                    StudentCode = topic.ProposerStudentCode ?? string.Empty,
                    StudentName = topic.ProposerStudentCode != null && studentMap.TryGetValue(topic.ProposerStudentCode, out var name) ? name : (topic.ProposerStudentCode ?? string.Empty),
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
                if (topic == null)
                {
                    continue;
                }

                dto.AfternoonStudents.Add(new EligibleStudentDto
                {
                    StudentCode = topic.ProposerStudentCode ?? string.Empty,
                    StudentName = topic.ProposerStudentCode != null && studentMap.TryGetValue(topic.ProposerStudentCode, out var name) ? name : (topic.ProposerStudentCode ?? string.Empty),
                    TopicTitle = topic.Title,
                    SupervisorCode = topic.SupervisorLecturerCode,
                    Tags = topicTagMap.TryGetValue(topic.TopicCode, out var afternoonTags)
                        ? afternoonTags.OrderBy(x => x).ToList()
                        : new List<string>(),
                    IsEligible = true,
                    Valid = true
                });
            }

            dto.Warning = manualWarning ?? await ValidateCouncilHardRulesAsync(
                councilId,
                cancellationToken);
            if (!string.IsNullOrWhiteSpace(dto.Warning))
            {
                dto.Status = "Warning";
            }
            else if (string.Equals(dto.Status, "Draft", StringComparison.OrdinalIgnoreCase)
                || string.Equals(dto.Status, "Warning", StringComparison.OrdinalIgnoreCase))
            {
                dto.Status = DefenseWorkflowStateMachine.ToValue(CommitteeStatus.Ready);
            }

            return dto;
        }

        private async Task<List<Committee>> GetPeriodCommitteesAsync(int periodId, DefensePeriodConfigState config, CancellationToken cancellationToken)
        {
            var configCouncilIds = config.CouncilIds
                .Distinct()
                .ToList();

            if (configCouncilIds.Count == 0)
            {
                return await _db.Committees
                    .Where(x => x.DefenseTermId == periodId)
                    .ToListAsync(cancellationToken);
            }

            return await _db.Committees
                .Where(x => x.DefenseTermId == periodId || configCouncilIds.Contains(x.CommitteeID))
                .ToListAsync(cancellationToken);
        }

        private async Task<List<DefenseAssignment>> GetPeriodAssignmentsAsync(int periodId, DefensePeriodConfigState config, CancellationToken cancellationToken)
        {
            var configCouncilIds = config.CouncilIds
                .Distinct()
                .ToList();

            if (configCouncilIds.Count == 0)
            {
                return await _db.DefenseAssignments
                    .Where(x => x.DefenseTermId == periodId)
                    .ToListAsync(cancellationToken);
            }

            return await _db.DefenseAssignments
                .Where(x => x.DefenseTermId == periodId || (x.CommitteeID.HasValue && configCouncilIds.Contains(x.CommitteeID.Value)))
                .ToListAsync(cancellationToken);
        }

        private async Task<DefenseTerm?> GetPeriodAsync(int periodId, CancellationToken cancellationToken)
        {
            return await _db.DefenseTerms.FirstOrDefaultAsync(x => x.DefenseTermId == periodId, cancellationToken);
        }

        private async Task<DefenseTerm> EnsurePeriodAsync(int periodId, CancellationToken cancellationToken)
        {
            var period = await GetPeriodAsync(periodId, cancellationToken);
            if (period == null)
            {
                throw new BusinessRuleException("Không tìm thấy đợt đồ án tốt nghiệp.");
            }

            await SyncPeriodCouncilIdsFromFkAsync(period, cancellationToken);

            return period;
        }

        private async Task SyncPeriodCouncilIdsFromFkAsync(DefenseTerm period, CancellationToken cancellationToken)
        {
            var fkCouncilIds = await _db.Committees
                .AsNoTracking()
                .Where(x => x.DefenseTermId == period.DefenseTermId)
                .Select(x => x.CommitteeID)
                .ToListAsync(cancellationToken);

            if (fkCouncilIds.Count == 0)
            {
                return;
            }

            var config = ReadConfig(period);
            var mergedCouncilIds = config.CouncilIds
                .Concat(fkCouncilIds)
                .Distinct()
                .OrderBy(x => x)
                .ToList();

            var currentCouncilSet = config.CouncilIds.ToHashSet();
            if (currentCouncilSet.Count == mergedCouncilIds.Count && currentCouncilSet.SetEquals(mergedCouncilIds))
            {
                return;
            }

            config.CouncilIds = mergedCouncilIds;
            period.ConfigJson = JsonSerializer.Serialize(config);
        }

        private static DefensePeriodConfigState ReadConfig(DefenseTerm period)
        {
            if (string.IsNullOrWhiteSpace(period.ConfigJson))
            {
                return new DefensePeriodConfigState();
            }

            try
            {
                return JsonSerializer.Deserialize<DefensePeriodConfigState>(period.ConfigJson) ?? new DefensePeriodConfigState();
            }
            catch
            {
                return new DefensePeriodConfigState();
            }
        }

        private async Task AddAuditAsync(string action, string result, string records, CancellationToken cancellationToken)
        {
            await _auditTrailService.WriteAsync(action, result, null, null, new { Records = records }, null, cancellationToken);
        }

        private async Task AddAuditSnapshotAsync(
            string action,
            string result,
            object? before,
            object? after,
            object? details,
            int actorUserId,
            CancellationToken cancellationToken)
        {
            await _auditTrailService.WriteAsync(action, result, before, after, details, actorUserId, cancellationToken);
        }

        private async Task SendDefenseHubEventAsync(string eventName, object payload, CancellationToken cancellationToken)
        {
            await _resiliencePolicy.ExecuteAsync("DEFENSE_HUB_NOTIFY", async ct =>
            {
                await _hub.Clients.All.SendAsync(eventName, payload, ct);
            }, cancellationToken);
        }

        private async Task NotifyCouncilListLockedAsync(DefenseTerm period, IReadOnlyCollection<Committee> councils, CancellationToken cancellationToken)
        {
            var periodConfig = ReadConfig(period);

            var councilIds = councils
                .Select(x => x.CommitteeID)
                .Distinct()
                .ToList();

            if (councilIds.Count == 0)
            {
                return;
            }

            var topicCodes = await _db.DefenseAssignments.AsNoTracking()
                .Where(x => x.CommitteeID.HasValue && councilIds.Contains(x.CommitteeID.Value) && !string.IsNullOrWhiteSpace(x.TopicCode))
                .Select(x => x.TopicCode!)
                .Distinct()
                .ToListAsync(cancellationToken);

            var topics = topicCodes.Count == 0
                ? new List<Topic>()
                : await _db.Topics.AsNoTracking()
                    .Where(x => topicCodes.Contains(x.TopicCode))
                    .ToListAsync(cancellationToken);

            var committeeMembers = await _db.CommitteeMembers.AsNoTracking()
                .Where(x => x.CommitteeID.HasValue && councilIds.Contains(x.CommitteeID.Value))
                .ToListAsync(cancellationToken);

            var topicStudentCodes = topics
                .Select(x => NormalizeIdentityCode(x.ProposerStudentCode))
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var topicStudentProfileIds = topics
                .Where(x => x.ProposerStudentProfileID.HasValue && x.ProposerStudentProfileID.Value > 0)
                .Select(x => x.ProposerStudentProfileID!.Value)
                .Distinct()
                .ToList();

            var committeeLecturerCodes = committeeMembers
                .Select(x => NormalizeIdentityCode(x.MemberLecturerCode))
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var committeeLecturerProfileIds = committeeMembers
                .Where(x => x.MemberLecturerProfileID.HasValue && x.MemberLecturerProfileID.Value > 0)
                .Select(x => x.MemberLecturerProfileID!.Value)
                .Distinct()
                .ToList();

            var studentIdentityRows = await _db.StudentProfiles.AsNoTracking()
                .Where(x =>
                    (topicStudentCodes.Count > 0 && topicStudentCodes.Contains(x.StudentCode))
                    || (topicStudentProfileIds.Count > 0 && topicStudentProfileIds.Contains(x.StudentProfileID)))
                .Select(x => new
                {
                    x.StudentProfileID,
                    x.StudentCode,
                    x.UserCode,
                    x.UserID
                })
                .ToListAsync(cancellationToken);

            var allLecturerCodes = committeeLecturerCodes;

            var allLecturerProfileIds = committeeLecturerProfileIds;

            var lecturerIdentityRows = await _db.LecturerProfiles.AsNoTracking()
                .Where(x =>
                    (allLecturerCodes.Count > 0 && allLecturerCodes.Contains(x.LecturerCode))
                    || (allLecturerProfileIds.Count > 0 && allLecturerProfileIds.Contains(x.LecturerProfileID)))
                .Select(x => new
                {
                    x.LecturerProfileID,
                    x.LecturerCode,
                    x.UserCode,
                    x.UserID
                })
                .ToListAsync(cancellationToken);

            var studentTermRows = await _db.DefenseTermStudents.AsNoTracking()
                .Where(x => x.DefenseTermId == period.DefenseTermId
                    && !string.IsNullOrWhiteSpace(x.StudentCode)
                    && !string.IsNullOrWhiteSpace(x.UserCode))
                .Select(x => new { x.StudentCode, x.UserCode })
                .ToListAsync(cancellationToken);

            var studentUserMap = BuildUserCodeLookup(studentTermRows, x => x.StudentCode, x => x.UserCode);
            var studentProfileUserMap = BuildUserCodeLookup(studentIdentityRows, x => x.StudentCode, x => x.UserCode);
            var studentProfileUserById = BuildUserCodeByIdLookup(studentIdentityRows, x => x.StudentProfileID, x => x.UserCode);

            var lecturerTermRows = await _db.DefenseTermLecturers.AsNoTracking()
                .Where(x => x.DefenseTermId == period.DefenseTermId
                    && !string.IsNullOrWhiteSpace(x.LecturerCode)
                    && !string.IsNullOrWhiteSpace(x.UserCode))
                .Select(x => new { x.LecturerCode, x.UserCode })
                .ToListAsync(cancellationToken);

            var lecturerUserMap = BuildUserCodeLookup(lecturerTermRows, x => x.LecturerCode, x => x.UserCode);
            var lecturerProfileUserMap = BuildUserCodeLookup(lecturerIdentityRows, x => x.LecturerCode, x => x.UserCode);
            var lecturerProfileUserById = BuildUserCodeByIdLookup(lecturerIdentityRows, x => x.LecturerProfileID, x => x.UserCode);

            var userIds = new HashSet<int>();
            foreach (var topic in topics)
            {
                if (topic.ProposerUserID > 0)
                {
                    userIds.Add(topic.ProposerUserID);
                }

            }

            foreach (var member in committeeMembers)
            {
                if (member.MemberUserID.HasValue && member.MemberUserID.Value > 0)
                {
                    userIds.Add(member.MemberUserID.Value);
                }
            }

            foreach (var row in studentIdentityRows)
            {
                if (row.UserID > 0)
                {
                    userIds.Add(row.UserID);
                }
            }

            foreach (var row in lecturerIdentityRows)
            {
                if (row.UserID > 0)
                {
                    userIds.Add(row.UserID);
                }
            }

            var userRows = new List<(int UserID, string? UserCode)>();
            if (userIds.Count > 0)
            {
                userRows = await _db.Users.AsNoTracking()
                    .Where(x => userIds.Contains(x.UserID))
                    .Select(x => new ValueTuple<int, string?>(x.UserID, x.UserCode))
                    .ToListAsync(cancellationToken);
            }

            var userCodeByUserId = BuildUserCodeByIdLookup(userRows, x => (int?)x.UserID, x => x.UserCode);

            var studentAssignmentTargets = topics
                .Select(x =>
                {
                    return CoalesceUserCode(
                        x.ProposerUserCode,
                        ResolveMappedUserCode(studentUserMap, x.ProposerStudentCode),
                        ResolveMappedUserCode(studentProfileUserMap, x.ProposerStudentCode),
                        ResolveMappedUserCode(studentProfileUserById, x.ProposerStudentProfileID),
                        ResolveMappedUserCode(userCodeByUserId, x.ProposerUserID));
                })
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Select(x => x!)
                .ToList();

            var committeeById = councils.ToDictionary(x => x.CommitteeID, x => x);
            var assignmentRows = await _db.DefenseAssignments.AsNoTracking()
                .Where(x => x.CommitteeID.HasValue && councilIds.Contains(x.CommitteeID.Value) && !string.IsNullOrWhiteSpace(x.TopicCode))
                .Select(x => new
                {
                    x.TopicCode,
                    x.CommitteeID,
                    x.ScheduledAt,
                    x.StartTime,
                    x.Session,
                    x.OrderIndex
                })
                .ToListAsync(cancellationToken);

            var assignmentByTopicCode = assignmentRows
                .Where(x => !string.IsNullOrWhiteSpace(x.TopicCode))
                .GroupBy(x => x.TopicCode!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    g => g.Key,
                    g => g.OrderBy(x => x.OrderIndex ?? int.MaxValue)
                        .ThenBy(x => x.StartTime ?? TimeSpan.MaxValue)
                        .First(),
                    StringComparer.OrdinalIgnoreCase);

            var studentNotificationItems = new List<StudentLockNotificationItem>();
            var studentNotificationKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var topic in topics)
            {
                var userCode = CoalesceUserCode(
                    topic.ProposerUserCode,
                    ResolveMappedUserCode(studentUserMap, topic.ProposerStudentCode),
                    ResolveMappedUserCode(studentProfileUserMap, topic.ProposerStudentCode),
                    ResolveMappedUserCode(studentProfileUserById, topic.ProposerStudentProfileID),
                    ResolveMappedUserCode(userCodeByUserId, topic.ProposerUserID));

                if (string.IsNullOrWhiteSpace(userCode)
                    || string.IsNullOrWhiteSpace(topic.TopicCode)
                    || !assignmentByTopicCode.TryGetValue(topic.TopicCode, out var assignment)
                    || !assignment.CommitteeID.HasValue
                    || !committeeById.TryGetValue(assignment.CommitteeID.Value, out var committee))
                {
                    continue;
                }

                var committeeCode = string.IsNullOrWhiteSpace(committee.CommitteeCode)
                    ? $"ID-{committee.CommitteeID}"
                    : committee.CommitteeCode.Trim();
                var committeeName = string.IsNullOrWhiteSpace(committee.Name)
                    ? committeeCode
                    : committee.Name.Trim();
                var room = string.IsNullOrWhiteSpace(committee.Room)
                    ? "Đang cập nhật"
                    : committee.Room.Trim();
                var defenseDate = assignment.ScheduledAt ?? committee.DefenseDate;
                var defenseDateText = defenseDate.HasValue
                    ? defenseDate.Value.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture)
                    : "Đang cập nhật";
                var weekdayText = defenseDate.HasValue
                    ? ToVietnameseWeekdayLabel(defenseDate.Value)
                    : "Đang cập nhật";
                var timeText = ResolveDefenseTimeText(
                    assignment.ScheduledAt,
                    assignment.StartTime,
                    assignment.Session,
                    periodConfig);

                var key = $"{userCode}|{committeeCode}|{room}|{defenseDateText}|{timeText}";
                if (!studentNotificationKeys.Add(key))
                {
                    continue;
                }

                studentNotificationItems.Add(new StudentLockNotificationItem(
                    userCode,
                    committeeCode,
                    committeeName,
                    room,
                    weekdayText,
                    defenseDateText,
                    timeText));
            }

            var studentNotificationGroups = studentNotificationItems
                .GroupBy(x => x.UserCode, StringComparer.OrdinalIgnoreCase)
                .ToList();
            var committeeNotificationItems = new List<CommitteeLockNotificationItem>();
            var committeeMemberNotificationKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var member in committeeMembers)
            {
                var userCode = CoalesceUserCode(
                    member.MemberUserCode,
                    ResolveMappedUserCode(lecturerUserMap, member.MemberLecturerCode),
                    ResolveMappedUserCode(lecturerProfileUserMap, member.MemberLecturerCode),
                    ResolveMappedUserCode(lecturerProfileUserById, member.MemberLecturerProfileID),
                    ResolveMappedUserCode(userCodeByUserId, member.MemberUserID));

                if (string.IsNullOrWhiteSpace(userCode))
                {
                    continue;
                }

                if (!member.CommitteeID.HasValue || member.CommitteeID.Value <= 0)
                {
                    continue;
                }

                var roleCode = NormalizeRole(member.Role);
                if (string.IsNullOrWhiteSpace(roleCode))
                {
                    roleCode = "UV";
                }

                var key = $"{userCode}|{member.CommitteeID.Value}|{roleCode}";
                if (!committeeMemberNotificationKeys.Add(key))
                {
                    continue;
                }

                var committeeCode = $"ID-{member.CommitteeID.Value}";
                var committeeName = committeeCode;
                DateTime? defenseDate = null;
                var defenseDateText = "Đang cập nhật";

                if (committeeById.TryGetValue(member.CommitteeID.Value, out var committee))
                {
                    committeeCode = string.IsNullOrWhiteSpace(committee.CommitteeCode)
                        ? $"ID-{committee.CommitteeID}"
                        : committee.CommitteeCode.Trim();
                    committeeName = string.IsNullOrWhiteSpace(committee.Name)
                        ? committeeCode
                        : committee.Name.Trim();
                    defenseDate = committee.DefenseDate;
                    defenseDateText = defenseDate.HasValue
                        ? defenseDate.Value.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture)
                        : "Đang cập nhật";
                }

                committeeNotificationItems.Add(new CommitteeLockNotificationItem(
                    userCode,
                    member.CommitteeID.Value,
                    committeeCode,
                    committeeName,
                    defenseDate,
                    defenseDateText,
                    roleCode,
                    ToCommitteeRoleLabel(roleCode)));
            }

            var committeeNotificationGroups = committeeNotificationItems
                .GroupBy(x => x.UserCode, StringComparer.OrdinalIgnoreCase)
                .ToList();

            var termName = string.IsNullOrWhiteSpace(period.Name)
                ? $"Đợt đồ án tốt nghiệp #{period.DefenseTermId}"
                : period.Name.Trim();

            if (studentNotificationGroups.Count > 0)
            {
                foreach (var group in studentNotificationGroups)
                {
                    await PublishCouncilLockNotificationAsync(
                        notifTitle: "Danh sách hội đồng đã chốt xong",
                        notifBody: BuildStudentLockNotificationBody(termName, group.ToList()),
                        actionType: "OPEN_DEFENSE_STUDENT",
                        actionUrl: $"/defense/periods/{period.DefenseTermId}/student",
                        period,
                        new List<string> { group.Key });
                }
            }

            foreach (var group in committeeNotificationGroups)
            {
                await PublishCouncilLockNotificationAsync(
                    notifTitle: "Danh sách hội đồng đã chốt xong",
                    notifBody: BuildCommitteeLockNotificationBody(termName, group.ToList()),
                    actionType: "OPEN_DEFENSE_COMMITTEE",
                    actionUrl: $"/defense/periods/{period.DefenseTermId}/lecturer/committees",
                    period,
                    new List<string> { group.Key });
            }

        }

        private static string BuildStudentLockNotificationBody(string termName, IReadOnlyCollection<StudentLockNotificationItem> items)
        {
            var orderedItems = items
                .OrderBy(x => x.DefenseDateText, StringComparer.OrdinalIgnoreCase)
                .ThenBy(x => x.CommitteeCode, StringComparer.OrdinalIgnoreCase)
                .ThenBy(x => x.TimeText, StringComparer.OrdinalIgnoreCase)
                .ToList();

            var builder = new StringBuilder();
            builder.Append(termName);
            builder.Append(": danh sách hội đồng đã chốt xong. Hãy vào trang Sinh viên của tôi để biết thêm chi tiết.");
            builder.AppendLine();
            builder.AppendLine("Lịch đồ án tốt nghiệp của bạn:");

            foreach (var item in orderedItems)
            {
                builder.Append("- Hội đồng ");
                builder.Append(item.CommitteeCode);
                builder.Append(" - ");
                builder.Append(item.CommitteeName);
                builder.Append(" | Phòng: ");
                builder.Append(item.Room);
                builder.Append(" | ");
                builder.Append(item.WeekdayText);
                builder.Append(", ");
                builder.Append(item.DefenseDateText);
                builder.Append(" lúc ");
                builder.Append(item.TimeText);
                builder.AppendLine();
            }

            return builder.ToString().Trim();
        }

        private static string BuildCommitteeLockNotificationBody(string termName, IReadOnlyCollection<CommitteeLockNotificationItem> items)
        {
            var orderedItems = items
                .OrderBy(x => x.DefenseDate ?? DateTime.MaxValue)
                .ThenBy(x => x.CommitteeCode, StringComparer.OrdinalIgnoreCase)
                .ThenBy(x => x.RoleCode, StringComparer.OrdinalIgnoreCase)
                .ToList();

            var builder = new StringBuilder();
            builder.Append(termName);
            builder.Append(": danh sách hội đồng đã chốt xong. Hãy vào trang Hội đồng của tôi để biết thêm chi tiết.");
            builder.AppendLine();
            builder.AppendLine("Hội đồng của bạn:");

            foreach (var item in orderedItems)
            {
                builder.Append("- ");
                builder.Append(item.CommitteeCode);
                builder.Append(" - ");
                builder.Append(item.CommitteeName);
                builder.Append(" | Ngày: ");
                builder.Append(item.DefenseDateText);
                builder.Append(" | Vai trò: ");
                builder.Append(item.RoleLabel);
                builder.AppendLine();
            }

            return builder.ToString().Trim();
        }

        private Task PublishCouncilLockNotificationAsync(
            string notifTitle,
            string notifBody,
            string actionType,
            string actionUrl,
            DefenseTerm period,
            List<string> targetUserCodes)
        {
            return _notificationEventPublisher.PublishAsync(new NotificationEventRequest(
                NotifCategory: "DEFENSE_COUNCIL_LOCK",
                NotifTitle: notifTitle,
                NotifBody: notifBody,
                NotifPriority: "HIGH",
                ActionType: actionType,
                ActionUrl: actionUrl,
                RelatedEntityName: "DEFENSE_TERM",
                RelatedEntityCode: period.DefenseTermId.ToString(CultureInfo.InvariantCulture),
                RelatedEntityID: period.DefenseTermId,
                IsGlobal: false,
                TargetUserCodes: targetUserCodes));
        }

        private static Dictionary<string, string> BuildUserCodeLookup<T>(
            IEnumerable<T> rows,
            Func<T, string?> keySelector,
            Func<T, string?> userCodeSelector)
        {
            var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

            foreach (var row in rows)
            {
                var key = NormalizeIdentityCode(keySelector(row));
                var userCode = NormalizeIdentityCode(userCodeSelector(row));
                if (string.IsNullOrWhiteSpace(key) || string.IsNullOrWhiteSpace(userCode))
                {
                    continue;
                }

                if (!result.ContainsKey(key))
                {
                    result[key] = userCode;
                }
            }

            return result;
        }

        private static Dictionary<int, string> BuildUserCodeByIdLookup<T>(
            IEnumerable<T> rows,
            Func<T, int?> keySelector,
            Func<T, string?> userCodeSelector)
        {
            var result = new Dictionary<int, string>();

            foreach (var row in rows)
            {
                var key = keySelector(row);
                var userCode = NormalizeIdentityCode(userCodeSelector(row));
                if (!key.HasValue || key.Value <= 0 || string.IsNullOrWhiteSpace(userCode))
                {
                    continue;
                }

                if (!result.ContainsKey(key.Value))
                {
                    result[key.Value] = userCode;
                }
            }

            return result;
        }

        private static string? ResolveMappedUserCode(IReadOnlyDictionary<string, string> lookup, string? key)
        {
            var normalizedKey = NormalizeIdentityCode(key);
            if (string.IsNullOrWhiteSpace(normalizedKey))
            {
                return null;
            }

            return lookup.TryGetValue(normalizedKey, out var mappedUserCode)
                ? NormalizeIdentityCode(mappedUserCode)
                : null;
        }

        private static string? ResolveMappedUserCode(IReadOnlyDictionary<int, string> lookup, int? key)
        {
            if (!key.HasValue || key.Value <= 0)
            {
                return null;
            }

            return lookup.TryGetValue(key.Value, out var mappedUserCode)
                ? NormalizeIdentityCode(mappedUserCode)
                : null;
        }

        private static string? CoalesceUserCode(params string?[] candidates)
        {
            foreach (var candidate in candidates)
            {
                var normalized = NormalizeIdentityCode(candidate);
                if (!string.IsNullOrWhiteSpace(normalized))
                {
                    return normalized;
                }
            }

            return null;
        }

        private static string? NormalizeIdentityCode(string? value)
        {
            return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        }

        private static string ResolveDefenseTimeText(
            DateTime? scheduledAt,
            TimeSpan? startTime,
            int? session,
            DefensePeriodConfigState periodConfig)
        {
            var resolvedStartTime = ResolveDefenseStartTime(scheduledAt, startTime, session, periodConfig);
            return resolvedStartTime.HasValue
                ? resolvedStartTime.Value.ToString(@"hh\:mm", CultureInfo.InvariantCulture)
                : "Đang cập nhật";
        }

        private static TimeSpan? ResolveDefenseStartTime(
            DateTime? scheduledAt,
            TimeSpan? startTime,
            int? session,
            DefensePeriodConfigState periodConfig)
        {
            if (startTime.HasValue && startTime.Value > TimeSpan.Zero)
            {
                return startTime.Value;
            }

            if (scheduledAt.HasValue && scheduledAt.Value.TimeOfDay > TimeSpan.Zero)
            {
                return scheduledAt.Value.TimeOfDay;
            }

            return ResolveSessionStartTime(session, periodConfig);
        }

        private static TimeSpan? ResolveSessionStartTime(int? session, DefensePeriodConfigState periodConfig)
        {
            if (!session.HasValue)
            {
                return null;
            }

            return session.Value == 1
                ? ParseConfigTime(periodConfig.MorningStart, new TimeSpan(7, 30, 0))
                : ParseConfigTime(periodConfig.AfternoonStart, new TimeSpan(13, 30, 0));
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

        private static string ToVietnameseWeekdayLabel(DateTime date)
        {
            return date.DayOfWeek switch
            {
                DayOfWeek.Monday => "Thứ Hai",
                DayOfWeek.Tuesday => "Thứ Ba",
                DayOfWeek.Wednesday => "Thứ Tư",
                DayOfWeek.Thursday => "Thứ Năm",
                DayOfWeek.Friday => "Thứ Sáu",
                DayOfWeek.Saturday => "Thứ Bảy",
                DayOfWeek.Sunday => "Chủ nhật",
                _ => "Đang cập nhật"
            };
        }

        private static string ToCommitteeRoleLabel(string normalizedRole)
        {
            return normalizedRole switch
            {
                "CT" => "Chủ tịch hội đồng",
                "UVTK" => "Ủy viên thư ký hội đồng",
                "UVPB" => "Ủy viên phản biện hội đồng",
                "UV" => "Ủy viên hội đồng",
                _ => "Thành viên hội đồng"
            };
        }

        private static int NormalizeMembersPerCouncil(int value)
        {
            if (value < MinMembersPerCouncil || value > MaxMembersPerCouncil)
            {
                return 3;
            }

            return value;
        }

        private static int NormalizeTopicsPerSession(int value)
        {
            if (value < MinTopicsPerSession || value > MaxTopicsPerSession)
            {
                return 3;
            }

            return value;
        }

        private static List<string> BuildRolePlan(int membersPerCouncil)
        {
            var normalizedCount = NormalizeMembersPerCouncil(membersPerCouncil);
            var roles = new List<string> { "CT", "UVTK" };
            if (normalizedCount >= 3)
            {
                roles.Add("UVPB");
            }

            for (var i = roles.Count; i < normalizedCount; i++)
            {
                roles.Add("UV");
            }

            return roles;
        }

        private static void ValidateRolePlan(List<string> roles, int expectedCount, string errorCode)
        {
            ValidateRolePlanCore(roles, expectedCount, errorCode, requireExactCount: true);
        }

        private static void ValidateRolePlanPartial(List<string> roles, int maxCount, string errorCode)
        {
            ValidateRolePlanCore(roles, maxCount, errorCode, requireExactCount: false);
        }

        private static void ValidateRolePlanCore(List<string> roles, int expectedCount, string errorCode, bool requireExactCount)
        {
            var normalizedExpectedCount = NormalizeMembersPerCouncil(expectedCount);
            var normalizedRoles = roles.Select(NormalizeRole).Where(x => !string.IsNullOrWhiteSpace(x)).ToList();

            if (requireExactCount && normalizedRoles.Count != normalizedExpectedCount)
            {
                throw new BusinessRuleException($"Số lượng thành viên phải đúng {normalizedExpectedCount}.", errorCode);
            }

            if (!requireExactCount && normalizedRoles.Count > normalizedExpectedCount)
            {
                throw new BusinessRuleException($"Số lượng thành viên vượt quá {normalizedExpectedCount}.", errorCode);
            }

            var invalidRole = normalizedRoles.FirstOrDefault(x => x != "CT" && x != "UVTK" && !AllowedAdditionalRoles.Contains(x, StringComparer.OrdinalIgnoreCase));
            if (!string.IsNullOrWhiteSpace(invalidRole))
            {
                throw new BusinessRuleException("Vai trò chỉ hỗ trợ CT, UVTK, UVPB, UV.", errorCode, new { Role = invalidRole });
            }

            var chairCount = normalizedRoles.Count(x => x == "CT");
            var secretaryCount = normalizedRoles.Count(x => x == "UVTK");
            var reviewerCount = normalizedRoles.Count(x => x == "UVPB");
            if (chairCount > 1 || secretaryCount > 1)
            {
                throw new BusinessRuleException("Hội đồng chỉ được có tối đa 1 CT và 1 UVTK.", errorCode);
            }

            if (requireExactCount)
            {
                if (chairCount != 1 || secretaryCount != 1)
                {
                    throw new BusinessRuleException("Hội đồng phải có đúng 1 CT và 1 UVTK.", errorCode);
                }

                var additionalCount = normalizedRoles.Count(x => x == "UVPB" || x == "UV");
                if (additionalCount != normalizedExpectedCount - 2)
                {
                    throw new BusinessRuleException("Các thành viên còn lại phải thuộc vai trò UVPB hoặc UV.", errorCode);
                }

                if (reviewerCount < 1)
                {
                    throw new BusinessRuleException("Hội đồng phải có tối thiểu 1 UVPB.", errorCode);
                }
            }
        }

        private static void EnsureConcurrencyToken(Committee committee, string? requestToken)
        {
            if (string.IsNullOrWhiteSpace(requestToken))
            {
                throw new BusinessRuleException("Thiếu concurrencyToken khi cập nhật hội đồng.", "UC2.3.CONCURRENCY_TOKEN_REQUIRED");
            }

            var currentToken = committee.LastUpdated.Ticks.ToString(CultureInfo.InvariantCulture);
            if (!string.Equals(currentToken, requestToken.Trim(), StringComparison.Ordinal))
            {
                throw new BusinessRuleException(
                    "Dữ liệu hội đồng đã thay đổi. Vui lòng tải lại trước khi lưu.",
                    "UC2.3.CONCURRENCY_CONFLICT",
                    new { currentToken, requestToken });
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

        private static string? ToGrade(decimal? score)
        {
            if (!score.HasValue) return null;
            var s = score.Value;
            if (s >= 9.0m && s <= 10.0m) return "A+";
            if (s >= 8.5m && s < 9.0m) return "A";
            if (s >= 8.0m && s < 8.5m) return "B+";
            if (s >= 7.0m && s < 8.0m) return "B";
            if (s >= 6.5m && s < 7.0m) return "C+";
            if (s >= 5.5m && s < 6.5m) return "C";
            if (s >= 5.0m && s < 5.5m) return "D+";
            if (s >= 4.0m && s < 5.0m) return "D";
            return "F";
        }

        private static TimeSpan ParseTime(string? value, TimeSpan fallback)
        {
            if (!string.IsNullOrWhiteSpace(value) && TimeSpan.TryParse(value, out var parsed))
            {
                return parsed;
            }

            return fallback;
        }

        private static TimeSpan ParseRequiredTime(string? value, string errorCode)
        {
            if (string.IsNullOrWhiteSpace(value) || !TimeSpan.TryParse(value, out var parsed))
            {
                throw new BusinessRuleException("Thời gian không hợp lệ, yêu cầu định dạng HH:mm.", errorCode);
            }

            return parsed;
        }

        private static int ToSessionNumber(string? sessionCode)
        {
            if (string.IsNullOrWhiteSpace(sessionCode))
            {
                return 1;
            }

            return string.Equals(sessionCode.Trim(), DefenseSessionCodes.Afternoon, StringComparison.OrdinalIgnoreCase) ? 2 : 1;
        }

        private static int ResolveAssignmentOrderIndex(
            HashSet<int> usedOrderIndexes,
            int? requestedOrderIndex,
            int fallbackOrderIndex,
            string invalidOrderCode,
            string duplicateOrderCode,
            int session)
        {
            if (requestedOrderIndex.HasValue)
            {
                if (requestedOrderIndex.Value <= 0)
                {
                    throw new BusinessRuleException("OrderIndex phải lớn hơn 0.", invalidOrderCode);
                }

                if (!usedOrderIndexes.Add(requestedOrderIndex.Value))
                {
                    throw new BusinessRuleException(
                        "Thứ tự đề tài trong cùng buổi không được trùng.",
                        duplicateOrderCode,
                        new { Session = session, OrderIndex = requestedOrderIndex.Value });
                }

                return requestedOrderIndex.Value;
            }

            var orderIndex = Math.Max(1, fallbackOrderIndex);
            while (!usedOrderIndexes.Add(orderIndex))
            {
                orderIndex++;
            }

            return orderIndex;
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

        private static bool IsCouncilAssignmentCompatibleTopicStatus(string? status)
        {
            return IsDefenseEligibleTopicStatus(status)
                || IsDefenseAssignedTopicStatus(status);
        }

        private static bool IsDefenseAssignedTopicStatus(string? status)
        {
            var normalized = NormalizeKeyword(status);
            if (string.IsNullOrWhiteSpace(normalized))
            {
                return false;
            }

            return normalized.Contains("DA PHAN HOI DONG", StringComparison.Ordinal)
                || normalized.Contains("ASSIGNED", StringComparison.Ordinal)
                || normalized.Contains("IN COUNCIL", StringComparison.Ordinal)
                || normalized.Contains("IN_COUNCIL", StringComparison.Ordinal)
                || normalized.Contains("COUNCIL_ASSIGNED", StringComparison.Ordinal);
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

        private static string NormalizeTagCode(string? value)
        {
            return string.IsNullOrWhiteSpace(value) ? string.Empty : value.Trim();
        }

        private static List<string> NormalizeTagCodes(IEnumerable<string>? tagCodes)
        {
            if (tagCodes == null)
            {
                return new List<string>();
            }

            return tagCodes
                .Select(NormalizeTagCode)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        private async Task<Dictionary<string, Tag>> LoadTagCatalogByCodeAsync(CancellationToken cancellationToken)
        {
            var tags = await _db.Tags.AsNoTracking().ToListAsync(cancellationToken);
            var tagCatalogByCode = new Dictionary<string, Tag>(StringComparer.OrdinalIgnoreCase);

            foreach (var tag in tags)
            {
                var normalizedCode = NormalizeTagCode(tag.TagCode);
                if (string.IsNullOrWhiteSpace(normalizedCode))
                {
                    continue;
                }

                if (!tagCatalogByCode.ContainsKey(normalizedCode))
                {
                    tagCatalogByCode[normalizedCode] = tag;
                }
            }

            return tagCatalogByCode;
        }

        private static void EnsureTagCodesExist(IEnumerable<string> tagCodes, IReadOnlyDictionary<string, Tag> tagCatalogByCode, string errorCode)
        {
            var normalizedTagCodes = NormalizeTagCodes(tagCodes);
            var missingTagCodes = normalizedTagCodes
                .Where(code => !tagCatalogByCode.ContainsKey(code))
                .ToList();

            if (missingTagCodes.Count > 0)
            {
                throw new BusinessRuleException(
                    "Có tag không tồn tại trong danh mục tags.",
                    errorCode,
                    new { TagCodes = missingTagCodes });
            }
        }

        private static List<Tag> ResolveTagEntities(IEnumerable<string> tagCodes, IReadOnlyDictionary<string, Tag> tagCatalogByCode, string errorCode)
        {
            var normalizedTagCodes = NormalizeTagCodes(tagCodes);
            EnsureTagCodesExist(normalizedTagCodes, tagCatalogByCode, errorCode);

            return normalizedTagCodes
                .Select(code => tagCatalogByCode[code])
                .GroupBy(x => x.TagID)
                .Select(g => g.First())
                .ToList();
        }

        private async Task AddCommitteeTagsAsync(Committee committee, IEnumerable<Tag> tagEntities, DateTime now, CancellationToken cancellationToken)
        {
            foreach (var tag in tagEntities)
            {
                await _uow.CommitteeTags.AddAsync(new CommitteeTag
                {
                    CommitteeID = committee.CommitteeID,
                    CommitteeCode = committee.CommitteeCode,
                    TagID = tag.TagID,
                    TagCode = tag.TagCode,
                    CreatedAt = now
                });
            }
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
                    g => g.Select(v => NormalizeTagCode(v.TagCode))
                        .Where(code => !string.IsNullOrWhiteSpace(code))
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToHashSet(StringComparer.OrdinalIgnoreCase),
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
                    g => g.Select(v => NormalizeTagCode(v.TagCode))
                        .Where(code => !string.IsNullOrWhiteSpace(code))
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToHashSet(StringComparer.OrdinalIgnoreCase),
                    StringComparer.OrdinalIgnoreCase);
        }

        private static string ResolveUcCode(string? code, string fallbackUc)
        {
            if (string.IsNullOrWhiteSpace(code) || string.Equals(code, "BUSINESS_RULE_VIOLATION", StringComparison.OrdinalIgnoreCase))
            {
                return fallbackUc;
            }

            return code;
        }

        private async Task<bool> IsIdempotentReplayAsync(string action, int periodId, string? key, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(key))
            {
                return false;
            }

            var now = DateTime.UtcNow;
            var normalizedKey = key.Trim();

            var replay = await _db.IdempotencyRecords.AsNoTracking()
                .Where(x => x.Action == action
                    && x.PeriodID == periodId
                    && x.RequestKey == normalizedKey
                    && x.ExpiresAt > now)
                .Select(x => (int?)x.IdempotencyRecordID)
                .FirstOrDefaultAsync(cancellationToken) != null;

            if (replay)
            {
                return true;
            }

            var expiredRows = await _db.IdempotencyRecords
                .Where(x => x.ExpiresAt <= now)
                .ToListAsync(cancellationToken);

            if (expiredRows.Count > 0)
            {
                _db.IdempotencyRecords.RemoveRange(expiredRows);
            }

            await _db.IdempotencyRecords.AddAsync(new IdempotencyRecord
            {
                Action = action,
                PeriodID = periodId,
                RequestKey = normalizedKey,
                RequestHash = ComputeRequestHash(action, periodId, normalizedKey, "PRECHECK"),
                CreatedAt = now,
                ExpiresAt = now.AddHours(2)
            }, cancellationToken);

            try
            {
                await _db.SaveChangesAsync(cancellationToken);
                return false;
            }
            catch
            {
                return true;
            }
        }

        private static string ComputeRequestHash(params object?[] parts)
        {
            var payload = string.Join("|", parts.Select(p => p?.ToString() ?? string.Empty));
            var bytes = Encoding.UTF8.GetBytes(payload);
            var hash = SHA256.HashData(bytes);
            return Convert.ToHexString(hash);
        }

        private async Task<ApiResponse<T>?> TryReplayResponseAsync<T>(string action, int scopeId, string? idempotencyKey, string requestHash, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(idempotencyKey))
            {
                return null;
            }

            var now = DateTime.UtcNow;
            var normalizedKey = idempotencyKey.Trim();

            var record = await _db.IdempotencyRecords
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    x => x.Action == action
                        && x.PeriodID == scopeId
                        && x.RequestKey == normalizedKey
                        && x.ExpiresAt > now,
                    cancellationToken);

            if (record == null)
            {
                return null;
            }

            if (!string.Equals(record.RequestHash, requestHash, StringComparison.Ordinal))
            {
                throw new BusinessRuleException(
                    "Idempotency-Key đã được dùng cho payload khác.",
                    DefenseUcErrorCodes.Idempotency.KeyReusedDifferentPayload,
                    new { action, scopeId });
            }

            if (!string.IsNullOrWhiteSpace(record.ResponsePayload))
            {
                var replay = JsonSerializer.Deserialize<ApiResponse<T>>(record.ResponsePayload!);
                if (replay != null)
                {
                    replay.IdempotencyReplay = true;
                    replay.Code ??= $"{action}.REPLAY";
                    replay.HttpStatusCode = replay.HttpStatusCode == 0
                        ? (record.ResponseStatusCode ?? (replay.Success ? 200 : 400))
                        : replay.HttpStatusCode;
                    return replay;
                }
            }

            if (record.RecordStatus == IdempotencyRecordStatus.Processing)
            {
                throw new BusinessRuleException(
                    "Yêu cầu cùng Idempotency-Key đang được xử lý, vui lòng thử lại sau.",
                    DefenseUcErrorCodes.Idempotency.RequestInProgress);
            }

            return null;
        }

        private async Task SaveIdempotencyResponseAsync<T>(string action, int scopeId, string? idempotencyKey, string requestHash, ApiResponse<T> response, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(idempotencyKey))
            {
                return;
            }

            var now = DateTime.UtcNow;
            var normalizedKey = idempotencyKey.Trim();

            var record = await _db.IdempotencyRecords.FirstOrDefaultAsync(
                x => x.Action == action
                    && x.PeriodID == scopeId
                    && x.RequestKey == normalizedKey,
                cancellationToken);

            if (record == null)
            {
                record = new IdempotencyRecord
                {
                    Action = action,
                    PeriodID = scopeId,
                    RequestKey = normalizedKey,
                    RequestHash = requestHash,
                    CreatedAt = now,
                    ExpiresAt = now.AddHours(2)
                };
                await _db.IdempotencyRecords.AddAsync(record, cancellationToken);
            }
            else if (!string.Equals(record.RequestHash, requestHash, StringComparison.Ordinal))
            {
                throw new BusinessRuleException(
                    "Idempotency-Key đã được dùng cho payload khác.",
                    DefenseUcErrorCodes.Idempotency.KeyReusedDifferentPayload,
                    new { action, scopeId });
            }

            record.ResponsePayload = JsonSerializer.Serialize(response);
            record.ResponseStatusCode = response.HttpStatusCode == 0 ? (response.Success ? 200 : 400) : response.HttpStatusCode;
            record.ResponseSuccess = response.Success;
            record.RecordStatus = response.Success ? IdempotencyRecordStatus.Completed : IdempotencyRecordStatus.Failed;
            record.CompletedAt = DateTime.UtcNow;
            record.ExpiresAt = now.AddHours(2);

            await _db.SaveChangesAsync(cancellationToken);
        }

        private static ApiResponse<T> Fail<T>(string message, int statusCode, string? code = null, object? details = null)
        {
            var resolvedCode = string.IsNullOrWhiteSpace(code) ? DefenseUcErrorCodes.Common.BusinessRuleViolation : code;
            if (statusCode == 400 && IsConflictErrorCode(resolvedCode))
            {
                statusCode = 409;
            }

            var normalizedMessage = message.StartsWith("[", StringComparison.Ordinal) ? message : $"[{resolvedCode}] {message}";
            var warnings = BuildWarningsFromDetails(resolvedCode, details);

            return new ApiResponse<T>
            {
                Success = false,
                HttpStatusCode = statusCode,
                Message = normalizedMessage,
                Code = resolvedCode,
                Errors = details,
                Warnings = warnings
            };
        }

        private static bool IsConflictErrorCode(string code)
        {
            if (string.IsNullOrWhiteSpace(code))
            {
                return false;
            }

            var normalized = code.ToUpperInvariant();
            return normalized.Contains("CONFLICT", StringComparison.Ordinal)
                || normalized.Contains("DUPLICATE", StringComparison.Ordinal)
                || normalized.Contains("OVERLAP", StringComparison.Ordinal)
                || normalized.Contains("BLOCKED", StringComparison.Ordinal)
                || normalized.Contains("INVALID_STATE", StringComparison.Ordinal)
                || normalized.Contains("FINALIZED", StringComparison.Ordinal)
                || normalized.Contains("IDEMPOTENCY", StringComparison.Ordinal)
                || normalized.Contains("RESERVATION_FAILED", StringComparison.Ordinal)
                || normalized.Contains("PUBLISH_BEFORE_FINALIZE", StringComparison.Ordinal);
        }

        private static List<ApiWarning> BuildWarningsFromDetails(string code, object? details)
        {
            if (!code.Contains("WARNING", StringComparison.OrdinalIgnoreCase))
            {
                return new List<ApiWarning>();
            }

            var warningMessages = ExtractDetailMessages(details);
            if (warningMessages.Count == 0)
            {
                return new List<ApiWarning>();
            }

            return warningMessages
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Select(x => new ApiWarning
                {
                    Type = "soft",
                    Code = code,
                    Message = x
                })
                .ToList();
        }

        private static List<string> ExtractDetailMessages(object? details)
        {
            if (details == null)
            {
                return new List<string>();
            }

            if (details is string text)
            {
                var message = text.Trim();
                return message.Length == 0 ? new List<string>() : new List<string> { message };
            }

            if (details is IEnumerable<string> stringValues)
            {
                return stringValues
                    .Where(x => !string.IsNullOrWhiteSpace(x))
                    .Select(x => x.Trim())
                    .ToList();
            }

            if (details is IEnumerable<object> objectValues)
            {
                return objectValues
                    .Select(x => x?.ToString() ?? string.Empty)
                    .Where(x => !string.IsNullOrWhiteSpace(x))
                    .Select(x => x.Trim())
                    .ToList();
            }

            return new List<string>();
        }
    }
}

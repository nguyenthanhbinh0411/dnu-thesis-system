using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Data;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ThesisManagement.Api.Application.Command.DefenseTermLecturers;
using ThesisManagement.Api.Application.Command.DefenseTermStudents;
using ThesisManagement.Api.Application.Common;
using ThesisManagement.Api.Application.Command.DefenseExecution;
using ThesisManagement.Api.Application.Command.DefenseSetup;
using ThesisManagement.Api.Application.Query.DefenseTermLecturers;
using ThesisManagement.Api.Application.Query.DefenseTermStudents;
using ThesisManagement.Api.Application.Query.DefenseExecution;
using ThesisManagement.Api.Application.Query.DefenseSetup;
using ThesisManagement.Api.DTOs.DefenseTermLecturers.Command;
using ThesisManagement.Api.DTOs.DefenseTermLecturers.Query;
using ThesisManagement.Api.DTOs.DefenseTermStudents.Command;
using ThesisManagement.Api.DTOs.DefenseTermStudents.Query;
using ThesisManagement.Api.DTOs;
using ThesisManagement.Api.DTOs.DefensePeriods;
using ThesisManagement.Api.Data;
using ThesisManagement.Api.Models;
using ThesisManagement.Api.Services.DefenseOperationsExport;

namespace ThesisManagement.Api.Controllers
{
    [ApiController]
    [Route("api/defense-periods")]
    [Authorize]
    public class DefensePeriodsController : BaseApiController
    {
        private readonly ApplicationDbContext _db;
        private readonly ISyncDefensePeriodCommand _syncCommand;
        private readonly IGetDefensePeriodStudentsQuery _getStudentsQuery;
        private readonly IGetDefensePeriodConfigQuery _getConfigQuery;
        private readonly IGetDefensePeriodStateQuery _getStateQuery;
        private readonly IGetRollbackAvailabilityQuery _getRollbackAvailabilityQuery;
        private readonly IGetDefenseSyncErrorsQuery _getSyncErrorsQuery;
        private readonly IExportDefenseSyncErrorsQuery _exportSyncErrorsQuery;
        private readonly IGetLecturerCapabilitiesQueryV2 _getLecturerCapabilitiesQuery;
        private readonly IUpdateDefensePeriodConfigCommand _updateConfigCommand;
        private readonly ILockLecturerCapabilitiesCommand _lockCapabilitiesCommand;
        private readonly IConfirmCouncilConfigCommand _confirmCouncilConfigCommand;
        private readonly IGenerateCouncilsCommand _generateCouncilsCommand;
        private readonly ILockCouncilsCommand _lockCouncilsCommand;
        private readonly IReopenCouncilsCommand _reopenCouncilsCommand;
        private readonly IGetCouncilsQueryV2 _getCouncilsQuery;
        private readonly IGetCouncilDetailQueryV2 _getCouncilDetailQuery;
        private readonly IGetTopicTagsQueryV2 _getTopicTagsQuery;
        private readonly IGetLecturerTagsQueryV2 _getLecturerTagsQuery;
        private readonly IGetCommitteeTagsQueryV2 _getCommitteeTagsQuery;
        private readonly IGetDefenseTagOverviewQueryV2 _getDefenseTagOverviewQuery;
        private readonly IGetCouncilCalendarQuery _getCouncilCalendarQuery;
        private readonly ICreateCouncilCommand _createCouncilCommand;
        private readonly IUpdateCouncilCommand _updateCouncilCommand;
        private readonly IDeleteCouncilCommand _deleteCouncilCommand;
        private readonly IGenerateCouncilCodeCommand _generateCouncilCodeCommand;
        private readonly ICreateCouncilStep1Command _createCouncilStep1Command;
        private readonly IUpdateCouncilStep1Command _updateCouncilStep1Command;
        private readonly ISaveCouncilMembersStepCommand _saveCouncilMembersStepCommand;
        private readonly ISaveCouncilTopicsStepCommand _saveCouncilTopicsStepCommand;
        private readonly IAddCouncilMemberItemCommand _addCouncilMemberItemCommand;
        private readonly IUpdateCouncilMemberItemCommand _updateCouncilMemberItemCommand;
        private readonly IRemoveCouncilMemberItemCommand _removeCouncilMemberItemCommand;
        private readonly IAddCouncilTopicItemCommand _addCouncilTopicItemCommand;
        private readonly IUpdateCouncilTopicItemCommand _updateCouncilTopicItemCommand;
        private readonly IRemoveCouncilTopicItemCommand _removeCouncilTopicItemCommand;
        private readonly IFinalizeDefensePeriodCommand _finalizeCommand;
        private readonly IRollbackDefensePeriodCommand _rollbackCommand;
        private readonly IPublishDefensePeriodScoresCommand _publishScoresCommand;
        private readonly IGetDefenseOverviewAnalyticsQuery _overviewQuery;
        private readonly IGetDefenseByCouncilAnalyticsQuery _byCouncilQuery;
        private readonly IGetDefenseDistributionAnalyticsQuery _distributionQuery;
        private readonly IGetScoringMatrixQuery _scoringMatrixQuery;
        private readonly IGetScoringProgressQuery _scoringProgressQuery;
        private readonly IGetScoringAlertsQuery _scoringAlertsQuery;
        private readonly IBuildDefenseReportQuery _reportQuery;
        private readonly IGetDefenseExportHistoryQuery _exportHistoryQuery;
        private readonly IGetDefensePublishHistoryQuery _publishHistoryQuery;
        private readonly IGetCouncilAuditHistoryQuery _councilAuditHistoryQuery;
        private readonly IGetRevisionAuditTrailQuery _revisionAuditTrailQuery;
        private readonly IDefenseOperationsExportService _operationsExportService;
        private readonly ICommitteeRosterExportService _committeeRosterExportService;
        private readonly ICreateDefenseTermStudentCommand _createDefenseTermStudentCommand;
        private readonly IUpdateDefenseTermStudentCommand _updateDefenseTermStudentCommand;
        private readonly IDeleteDefenseTermStudentCommand _deleteDefenseTermStudentCommand;
        private readonly ICreateDefenseTermLecturerCommand _createDefenseTermLecturerCommand;
        private readonly IUpdateDefenseTermLecturerCommand _updateDefenseTermLecturerCommand;
        private readonly IDeleteDefenseTermLecturerCommand _deleteDefenseTermLecturerCommand;

        public DefensePeriodsController(
            Services.IUnitOfWork uow,
            Services.ICodeGenerator codeGen,
            AutoMapper.IMapper mapper,
            ApplicationDbContext db,
            ISyncDefensePeriodCommand syncCommand,
            IGetDefensePeriodStudentsQuery getStudentsQuery,
            IGetDefensePeriodConfigQuery getConfigQuery,
            IGetDefensePeriodStateQuery getStateQuery,
            IGetRollbackAvailabilityQuery getRollbackAvailabilityQuery,
            IGetDefenseSyncErrorsQuery getSyncErrorsQuery,
            IExportDefenseSyncErrorsQuery exportSyncErrorsQuery,
            IGetLecturerCapabilitiesQueryV2 getLecturerCapabilitiesQuery,
            IUpdateDefensePeriodConfigCommand updateConfigCommand,
            ILockLecturerCapabilitiesCommand lockCapabilitiesCommand,
            IConfirmCouncilConfigCommand confirmCouncilConfigCommand,
            IGenerateCouncilsCommand generateCouncilsCommand,
            ILockCouncilsCommand lockCouncilsCommand,
            IReopenCouncilsCommand reopenCouncilsCommand,
            IGetCouncilsQueryV2 getCouncilsQuery,
            IGetCouncilDetailQueryV2 getCouncilDetailQuery,
            IGetTopicTagsQueryV2 getTopicTagsQuery,
            IGetLecturerTagsQueryV2 getLecturerTagsQuery,
            IGetCommitteeTagsQueryV2 getCommitteeTagsQuery,
            IGetDefenseTagOverviewQueryV2 getDefenseTagOverviewQuery,
            IGetCouncilCalendarQuery getCouncilCalendarQuery,
            ICreateCouncilCommand createCouncilCommand,
            IUpdateCouncilCommand updateCouncilCommand,
            IDeleteCouncilCommand deleteCouncilCommand,
            IGenerateCouncilCodeCommand generateCouncilCodeCommand,
            ICreateCouncilStep1Command createCouncilStep1Command,
            IUpdateCouncilStep1Command updateCouncilStep1Command,
            ISaveCouncilMembersStepCommand saveCouncilMembersStepCommand,
            ISaveCouncilTopicsStepCommand saveCouncilTopicsStepCommand,
            IAddCouncilMemberItemCommand addCouncilMemberItemCommand,
            IUpdateCouncilMemberItemCommand updateCouncilMemberItemCommand,
            IRemoveCouncilMemberItemCommand removeCouncilMemberItemCommand,
            IAddCouncilTopicItemCommand addCouncilTopicItemCommand,
            IUpdateCouncilTopicItemCommand updateCouncilTopicItemCommand,
            IRemoveCouncilTopicItemCommand removeCouncilTopicItemCommand,
            IFinalizeDefensePeriodCommand finalizeCommand,
            IRollbackDefensePeriodCommand rollbackCommand,
            IPublishDefensePeriodScoresCommand publishScoresCommand,
            IGetDefenseOverviewAnalyticsQuery overviewQuery,
            IGetDefenseByCouncilAnalyticsQuery byCouncilQuery,
            IGetDefenseDistributionAnalyticsQuery distributionQuery,
            IGetScoringMatrixQuery scoringMatrixQuery,
            IGetScoringProgressQuery scoringProgressQuery,
            IGetScoringAlertsQuery scoringAlertsQuery,
            IBuildDefenseReportQuery reportQuery,
            IGetDefenseExportHistoryQuery exportHistoryQuery,
            IGetDefensePublishHistoryQuery publishHistoryQuery,
            IGetCouncilAuditHistoryQuery councilAuditHistoryQuery,
            IGetRevisionAuditTrailQuery revisionAuditTrailQuery,
            IDefenseOperationsExportService operationsExportService,
            ICommitteeRosterExportService committeeRosterExportService,
            ICreateDefenseTermStudentCommand createDefenseTermStudentCommand,
            IUpdateDefenseTermStudentCommand updateDefenseTermStudentCommand,
            IDeleteDefenseTermStudentCommand deleteDefenseTermStudentCommand,
            ICreateDefenseTermLecturerCommand createDefenseTermLecturerCommand,
            IUpdateDefenseTermLecturerCommand updateDefenseTermLecturerCommand,
            IDeleteDefenseTermLecturerCommand deleteDefenseTermLecturerCommand) : base(uow, codeGen, mapper)
        {
            _db = db;
            _syncCommand = syncCommand;
            _getStudentsQuery = getStudentsQuery;
            _getConfigQuery = getConfigQuery;
            _getStateQuery = getStateQuery;
            _getRollbackAvailabilityQuery = getRollbackAvailabilityQuery;
            _getSyncErrorsQuery = getSyncErrorsQuery;
            _exportSyncErrorsQuery = exportSyncErrorsQuery;
            _getLecturerCapabilitiesQuery = getLecturerCapabilitiesQuery;
            _updateConfigCommand = updateConfigCommand;
            _lockCapabilitiesCommand = lockCapabilitiesCommand;
            _confirmCouncilConfigCommand = confirmCouncilConfigCommand;
            _generateCouncilsCommand = generateCouncilsCommand;
            _lockCouncilsCommand = lockCouncilsCommand;
            _reopenCouncilsCommand = reopenCouncilsCommand;
            _getCouncilsQuery = getCouncilsQuery;
            _getCouncilDetailQuery = getCouncilDetailQuery;
            _getTopicTagsQuery = getTopicTagsQuery;
            _getLecturerTagsQuery = getLecturerTagsQuery;
            _getCommitteeTagsQuery = getCommitteeTagsQuery;
            _getDefenseTagOverviewQuery = getDefenseTagOverviewQuery;
            _getCouncilCalendarQuery = getCouncilCalendarQuery;
            _createCouncilCommand = createCouncilCommand;
            _updateCouncilCommand = updateCouncilCommand;
            _deleteCouncilCommand = deleteCouncilCommand;
            _generateCouncilCodeCommand = generateCouncilCodeCommand;
            _createCouncilStep1Command = createCouncilStep1Command;
            _updateCouncilStep1Command = updateCouncilStep1Command;
            _saveCouncilMembersStepCommand = saveCouncilMembersStepCommand;
            _saveCouncilTopicsStepCommand = saveCouncilTopicsStepCommand;
            _addCouncilMemberItemCommand = addCouncilMemberItemCommand;
            _updateCouncilMemberItemCommand = updateCouncilMemberItemCommand;
            _removeCouncilMemberItemCommand = removeCouncilMemberItemCommand;
            _addCouncilTopicItemCommand = addCouncilTopicItemCommand;
            _updateCouncilTopicItemCommand = updateCouncilTopicItemCommand;
            _removeCouncilTopicItemCommand = removeCouncilTopicItemCommand;
            _finalizeCommand = finalizeCommand;
            _rollbackCommand = rollbackCommand;
            _publishScoresCommand = publishScoresCommand;
            _overviewQuery = overviewQuery;
            _byCouncilQuery = byCouncilQuery;
            _distributionQuery = distributionQuery;
            _scoringMatrixQuery = scoringMatrixQuery;
            _scoringProgressQuery = scoringProgressQuery;
            _scoringAlertsQuery = scoringAlertsQuery;
            _reportQuery = reportQuery;
            _exportHistoryQuery = exportHistoryQuery;
            _publishHistoryQuery = publishHistoryQuery;
            _councilAuditHistoryQuery = councilAuditHistoryQuery;
            _revisionAuditTrailQuery = revisionAuditTrailQuery;
            _operationsExportService = operationsExportService;
            _committeeRosterExportService = committeeRosterExportService;
            _createDefenseTermStudentCommand = createDefenseTermStudentCommand;
            _updateDefenseTermStudentCommand = updateDefenseTermStudentCommand;
            _deleteDefenseTermStudentCommand = deleteDefenseTermStudentCommand;
            _createDefenseTermLecturerCommand = createDefenseTermLecturerCommand;
            _updateDefenseTermLecturerCommand = updateDefenseTermLecturerCommand;
            _deleteDefenseTermLecturerCommand = deleteDefenseTermLecturerCommand;
        }

        [HttpGet]
        public Task<ActionResult<ApiResponse<IEnumerable<DefensePeriodListItemDto>>>> ListPeriodsCompact(
            [FromQuery] string? keyword = null,
            [FromQuery] string? status = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            return GetPeriods(keyword, status, page, pageSize);
        }

        [HttpPost]
        [Authorize(Roles = "Admin,Head")]
        public Task<ActionResult<ApiResponse<DefensePeriodDetailDto>>> CreatePeriodCompact([FromBody] DefensePeriodCreateDto request)
        {
            return CreatePeriod(request);
        }

        [HttpGet("{periodId:int}/snapshot")]
        [Authorize(Roles = "Admin,Head")]
        public async Task<ActionResult<ApiResponse<object>>> GetPeriodSnapshotCompact(int periodId)
        {
            var detailAction = await GetPeriodDetail(periodId);
            if (!TryExtractApiResponse(detailAction, out var detail, out var detailStatusCode) || detail == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy snapshot đợt.", 500));
            }

            if (!detail.Success)
            {
                return MapFailure(detail, detailStatusCode, "Không thể lấy chi tiết đợt.");
            }

            var dashboardAction = await GetDashboard(periodId);
            if (!TryExtractApiResponse(dashboardAction, out var dashboard, out var dashboardStatusCode) || dashboard == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy snapshot đợt.", 500));
            }

            if (!dashboard.Success)
            {
                return MapFailure(dashboard, dashboardStatusCode, "Không thể lấy dashboard đợt.");
            }

            var configAction = await GetConfig(periodId);
            if (!TryExtractApiResponse(configAction, out var config, out var configStatusCode) || config == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy snapshot đợt.", 500));
            }

            if (!config.Success)
            {
                return MapFailure(config, configStatusCode, "Không thể lấy cấu hình đợt.");
            }

            var stateAction = await GetState(periodId);
            if (!TryExtractApiResponse(stateAction, out var state, out var stateStatusCode) || state == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy snapshot đợt.", 500));
            }

            if (!state.Success)
            {
                return MapFailure(state, stateStatusCode, "Không thể lấy trạng thái đợt.");
            }

            var workflowAction = await GetWorkflowSnapshot(periodId);
            if (!TryExtractApiResponse(workflowAction, out var workflow, out var workflowStatusCode) || workflow == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy snapshot đợt.", 500));
            }

            if (!workflow.Success)
            {
                return MapFailure(workflow, workflowStatusCode, "Không thể lấy workflow đợt.");
            }

            var snapshot = new
            {
                Detail = detail.Data,
                Dashboard = dashboard.Data,
                Config = config.Data,
                State = state.Data,
                Workflow = workflow.Data
            };

            return Ok(ApiResponse<object>.SuccessResponse(
                snapshot,
                allowedActions: state.Data?.AllowedActions ?? new List<string>(),
                warnings: state.Warnings));
        }

        [HttpPatch("{periodId:int}")]
        [Authorize(Roles = "Admin,Head")]
        public Task<ActionResult<ApiResponse<DefensePeriodDetailDto>>> UpdatePeriodCompact(int periodId, [FromBody] DefensePeriodUpdateDto request)
        {
            return UpdatePeriod(periodId, request);
        }

        [HttpPost("{periodId:int}/lifecycle")]
        [Authorize(Roles = "Admin,Head")]
        public async Task<ActionResult<ApiResponse<object>>> HandleLifecycleAction(int periodId, [FromBody] DefensePeriodLifecycleActionRequestDto request)
        {
            var action = (request.Action ?? string.Empty).Trim().ToUpperInvariant();
            if (string.Equals(action, "REOPEN_COUNCILS", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(GetRequestRole(), "Admin", StringComparison.OrdinalIgnoreCase))
            {
                return StatusCode(403, ApiResponse<object>.Fail("Chỉ tài khoản Admin mới được mở lại chốt danh sách hội đồng.", 403));
            }

            var syncRequest = request.Sync ?? new SyncDefensePeriodRequestDto();
            syncRequest.IdempotencyKey ??= request.IdempotencyKey;
            if (request.RetryOnFailure.HasValue)
            {
                syncRequest.RetryOnFailure = request.RetryOnFailure.Value;
            }

            var finalizeRequest = request.Finalize ?? new FinalizeDefensePeriodDto();
            finalizeRequest.IdempotencyKey ??= request.IdempotencyKey;
            if (request.AllowFinalizeAfterWarning.HasValue)
            {
                finalizeRequest.AllowFinalizeAfterWarning = request.AllowFinalizeAfterWarning.Value;
            }

            var rollbackRequest = request.Rollback ?? new RollbackDefensePeriodDto
            {
                Target = "PUBLISH",
                Reason = "Lifecycle rollback",
                ForceUnlockScores = true
            };

            if (!string.IsNullOrWhiteSpace(request.RollbackTarget))
            {
                rollbackRequest.Target = request.RollbackTarget;
            }

            if (!string.IsNullOrWhiteSpace(request.RollbackReason))
            {
                rollbackRequest.Reason = request.RollbackReason;
            }

            if (request.RollbackForceUnlockScores.HasValue)
            {
                rollbackRequest.ForceUnlockScores = request.RollbackForceUnlockScores.Value;
            }

            rollbackRequest.IdempotencyKey ??= request.IdempotencyKey;
            rollbackRequest.Target = string.IsNullOrWhiteSpace(rollbackRequest.Target) ? "PUBLISH" : rollbackRequest.Target;
            rollbackRequest.Reason = string.IsNullOrWhiteSpace(rollbackRequest.Reason) ? "Lifecycle rollback" : rollbackRequest.Reason;

            var archiveRequest = request.Archive ?? new DefensePeriodArchiveRequestDto();
            if (string.IsNullOrWhiteSpace(archiveRequest.IdempotencyKey))
            {
                archiveRequest.IdempotencyKey = request.IdempotencyKey;
            }

            var reopenRequest = request.Reopen ?? new DefensePeriodReopenRequestDto();
            if (string.IsNullOrWhiteSpace(reopenRequest.IdempotencyKey))
            {
                reopenRequest.IdempotencyKey = request.IdempotencyKey;
            }

            return action switch
            {
                "SYNC" => WrapAsObject(
                    await Sync(
                        periodId,
                        syncRequest,
                        request.IdempotencyKey),
                    action),
                "FINALIZE" => WrapAsObject(
                    await FinalizePeriod(
                        periodId,
                        finalizeRequest,
                        request.IdempotencyKey),
                    action),
                "PUBLISH" => WrapAsObject(
                    await PublishScores(periodId, request.IdempotencyKey),
                    action),
                "ROLLBACK" => WrapAsObject(
                    await RollbackPeriod(
                        periodId,
                        rollbackRequest,
                        request.IdempotencyKey),
                    action),
                "LOCK_COUNCILS" => WrapAsObject(
                    await LockCouncils(periodId, request.IdempotencyKey),
                    action),
                "REOPEN_COUNCILS" => WrapAsObject(
                    await ReopenCouncils(periodId, request.IdempotencyKey),
                    action),
                "ARCHIVE" => WrapAsObject(
                    await ArchivePeriod(periodId, archiveRequest),
                    action),
                "REOPEN" => WrapAsObject(
                    await ReopenPeriod(periodId, reopenRequest),
                    action),
                _ => BadRequest(ApiResponse<object>.Fail("Action không hợp lệ. Hỗ trợ: SYNC, FINALIZE, PUBLISH, ROLLBACK, LOCK_COUNCILS, REOPEN_COUNCILS, ARCHIVE, REOPEN.", 400))
            };
        }

        [HttpGet("{periodId:int}/setup/snapshot")]
        [Authorize(Roles = "Admin,Head")]
        public async Task<ActionResult<ApiResponse<object>>> GetSetupSnapshot(int periodId)
        {
            var configAction = await GetConfig(periodId);
            if (!TryExtractApiResponse(configAction, out var config, out var configStatusCode) || config == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy setup snapshot.", 500));
            }

            if (!config.Success)
            {
                return MapFailure(config, configStatusCode, "Không thể lấy cấu hình setup.");
            }

            var stateAction = await GetState(periodId);
            if (!TryExtractApiResponse(stateAction, out var state, out var stateStatusCode) || state == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy setup snapshot.", 500));
            }

            if (!state.Success)
            {
                return MapFailure(state, stateStatusCode, "Không thể lấy trạng thái setup.");
            }

            var studentsAction = await GetStudentParticipants(periodId, "eligible", null);
            if (!TryExtractApiResponse(studentsAction, out var students, out var studentsStatusCode) || students == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy setup snapshot.", 500));
            }

            if (!students.Success)
            {
                return MapFailure(students, studentsStatusCode, "Không thể lấy participants sinh viên.");
            }

            var lecturersAction = await GetLecturerParticipants(periodId, "all", null);
            if (!TryExtractApiResponse(lecturersAction, out var lecturers, out var lecturersStatusCode) || lecturers == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy setup snapshot.", 500));
            }

            if (!lecturers.Success)
            {
                return MapFailure(lecturers, lecturersStatusCode, "Không thể lấy participants giảng viên.");
            }

            var topicsAction = await GetRegistrationTopics(periodId, null, false, false, 1, 200);
            if (!TryExtractApiResponse(topicsAction, out var topics, out var topicsStatusCode) || topics == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy setup snapshot.", 500));
            }

            if (!topics.Success)
            {
                return MapFailure(topics, topicsStatusCode, "Không thể lấy danh sách đề tài.");
            }

            var councilsAction = await GetCouncils(periodId, null, null, null, 1, 200);
            if (!TryExtractApiResponse(councilsAction, out var councils, out var councilsStatusCode) || councils == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy setup snapshot.", 500));
            }

            if (!councils.Success)
            {
                return MapFailure(councils, councilsStatusCode, "Không thể lấy danh sách hội đồng.");
            }

            var autoConfigAction = await GetAutoGenerateConfig(periodId);
            if (!TryExtractApiResponse(autoConfigAction, out var autoConfig, out var autoConfigStatusCode) || autoConfig == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy setup snapshot.", 500));
            }

            if (!autoConfig.Success)
            {
                return MapFailure(autoConfig, autoConfigStatusCode, "Không thể lấy cấu hình auto-generate.");
            }

            var snapshot = new
            {
                Config = config.Data,
                State = state.Data,
                Students = students.Data,
                Lecturers = lecturers.Data,
                Topics = topics.Data,
                Councils = councils.Data,
                AutoGenerate = autoConfig.Data
            };

            return Ok(ApiResponse<object>.SuccessResponse(
                snapshot,
                allowedActions: state.Data?.AllowedActions ?? new List<string>(),
                warnings: state.Warnings));
        }

            [HttpGet("{periodId:int}/management/snapshot")]
            [Authorize(Roles = "Admin,Head")]
            public Task<ActionResult<ApiResponse<object>>> GetManagementSnapshotCompact(int periodId)
            {
                return GetSetupSnapshot(periodId);
            }

        [HttpPut("{periodId:int}/setup/config")]
        [Authorize(Roles = "Admin,Head")]
        public async Task<ActionResult<ApiResponse<object>>> UpdateSetupConfigCompact(int periodId, [FromBody] DefensePeriodSetupConfigRequestDto request)
        {
            if (request.Config == null && !request.LockLecturerCapabilities && request.CouncilConfig == null)
            {
                return BadRequest(ApiResponse<object>.Fail("Không có thay đổi setup nào được gửi lên.", 400));
            }

            var operations = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);

            if (request.Config != null)
            {
                var configAction = await UpdateConfig(periodId, request.Config);
                if (!TryExtractApiResponse(configAction, out var configResult, out var configStatusCode) || configResult == null)
                {
                    return StatusCode(500, ApiResponse<object>.Fail("Không thể cập nhật setup config.", 500));
                }

                if (!configResult.Success)
                {
                    return MapFailure(configResult, configStatusCode, "Cập nhật cấu hình đợt thất bại.");
                }

                operations["CONFIG_UPDATED"] = configResult.Data;
            }

            if (request.LockLecturerCapabilities)
            {
                var lockAction = await LockLecturerCapabilities(periodId);
                if (!TryExtractApiResponse(lockAction, out var lockResult, out var lockStatusCode) || lockResult == null)
                {
                    return StatusCode(500, ApiResponse<object>.Fail("Không thể cập nhật setup config.", 500));
                }

                if (!lockResult.Success)
                {
                    return MapFailure(lockResult, lockStatusCode, "Khóa năng lực giảng viên thất bại.");
                }

                operations["CAPABILITIES_LOCKED"] = lockResult.Data;
            }

            if (request.CouncilConfig != null)
            {
                var confirmAction = await ConfirmCouncilConfig(periodId, request.CouncilConfig);
                if (!TryExtractApiResponse(confirmAction, out var confirmResult, out var confirmStatusCode) || confirmResult == null)
                {
                    return StatusCode(500, ApiResponse<object>.Fail("Không thể cập nhật setup config.", 500));
                }

                if (!confirmResult.Success)
                {
                    return MapFailure(confirmResult, confirmStatusCode, "Xác nhận cấu hình hội đồng thất bại.");
                }

                operations["COUNCIL_CONFIG_CONFIRMED"] = confirmResult.Data;
            }

            var stateAction = await GetState(periodId);
            if (!TryExtractApiResponse(stateAction, out var state, out var stateStatusCode) || state == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy trạng thái sau cập nhật setup.", 500));
            }

            if (!state.Success)
            {
                return MapFailure(state, stateStatusCode, "Không thể lấy trạng thái sau cập nhật setup.");
            }

            var data = new
            {
                Operations = operations,
                State = state.Data
            };

            return Ok(ApiResponse<object>.SuccessResponse(
                data,
                allowedActions: state.Data?.AllowedActions ?? new List<string>(),
                warnings: state.Warnings));
        }

        [HttpGet("{periodId:int}/participants")]
        [Authorize(Roles = "Admin,Head")]
        public async Task<ActionResult<ApiResponse<object>>> GetParticipantsCompact(int periodId, [FromQuery] DefensePeriodParticipantsQueryDto query)
        {
            if (!TryNormalizeParticipantKind(query.Kind, out var normalizedKind))
            {
                return BadRequest(ApiResponse<object>.Fail("kind không hợp lệ. Hỗ trợ: student, lecturer.", 400));
            }

            var normalizedView = NormalizeParticipantView(query.View);
            if (normalizedView != "scope" && normalizedView != "runtime")
            {
                return BadRequest(ApiResponse<object>.Fail("view không hợp lệ. Hỗ trợ: scope, runtime.", 400));
            }

            if (!await DefensePeriodExistsAsync(periodId))
            {
                return NotFound(ApiResponse<object>.Fail("Không tìm thấy đợt bảo vệ.", 404));
            }

            if (normalizedView == "runtime")
            {
                var source = string.IsNullOrWhiteSpace(query.Source) ? "all" : query.Source.Trim();
                if (normalizedKind == "student")
                {
                    return WrapAsObject(await GetStudentParticipants(periodId, source, query.Keyword), "LIST_PARTICIPANTS");
                }

                return WrapAsObject(await GetLecturerParticipants(periodId, source, query.Keyword), "LIST_PARTICIPANTS");
            }

            if (normalizedKind == "student")
            {
                return WrapAsObject(
                    await GetStudentScopeParticipants(periodId, query.Keyword, query.Page, query.Size),
                    "LIST_PARTICIPANTS");
            }

            return WrapAsObject(
                await GetLecturerScopeParticipants(periodId, query.Keyword, query.Page, query.Size, query.Role, query.IsPrimary),
                "LIST_PARTICIPANTS");
        }

        [HttpGet("{periodId:int}/topics")]
        [Authorize(Roles = "Admin,Head")]
        public Task<ActionResult<ApiResponse<DefensePeriodRegistrationOverviewDto>>> GetTopicsCompact(
            int periodId,
            [FromQuery] string? keyword = null,
            [FromQuery] bool onlyEligible = false,
            [FromQuery] bool onlyUnassigned = false,
            [FromQuery] int page = 1,
            [FromQuery] int size = 50,
            [FromQuery(Name = "pageSize")] int? pageSize = null)
        {
            var effectiveSize = pageSize.GetValueOrDefault(size);
            return GetRegistrationTopics(periodId, keyword, onlyEligible, onlyUnassigned, page, effectiveSize);
        }

        [HttpPost("{periodId:int}/participants/upsert")]
        [Authorize(Roles = "Admin,Head")]
        public async Task<ActionResult<ApiResponse<object>>> UpsertParticipantCompact(int periodId, [FromBody] DefensePeriodParticipantUpsertRequestDto request)
        {
            if (!TryNormalizeParticipantKind(request.Kind, out var normalizedKind))
            {
                return BadRequest(ApiResponse<object>.Fail("kind không hợp lệ. Hỗ trợ: student, lecturer.", 400));
            }

            if (!await DefensePeriodExistsAsync(periodId))
            {
                return NotFound(ApiResponse<object>.Fail("Không tìm thấy đợt bảo vệ.", 404));
            }

            if (normalizedKind == "student")
            {
                return await UpsertStudentScopeParticipant(periodId, request);
            }

            return await UpsertLecturerScopeParticipant(periodId, request);
        }

        [HttpDelete("{periodId:int}/participants")]
        [Authorize(Roles = "Admin,Head")]
        public async Task<ActionResult<ApiResponse<object>>> DeleteParticipantCompact(
            int periodId,
            [FromQuery] string kind,
            [FromQuery] int id)
        {
            if (!TryNormalizeParticipantKind(kind, out var normalizedKind))
            {
                return BadRequest(ApiResponse<object>.Fail("kind không hợp lệ. Hỗ trợ: student, lecturer.", 400));
            }

            if (id <= 0)
            {
                return BadRequest(ApiResponse<object>.Fail("id phải lớn hơn 0.", 400));
            }

            if (!await DefensePeriodExistsAsync(periodId))
            {
                return NotFound(ApiResponse<object>.Fail("Không tìm thấy đợt bảo vệ.", 404));
            }

            if (normalizedKind == "student")
            {
                var exists = await _uow.DefenseTermStudents.Query().AsNoTracking()
                    .Where(x => x.DefenseTermStudentID == id && x.DefenseTermId == periodId)
                    .Select(x => (int?)x.DefenseTermStudentID)
                    .FirstOrDefaultAsync()
                    .ConfigureAwait(false);

                if (!exists.HasValue)
                {
                    return NotFound(ApiResponse<object>.Fail("Không tìm thấy participant sinh viên trong đợt.", 404));
                }

                var result = await _deleteDefenseTermStudentCommand.ExecuteAsync(id);
                return MapOperationResult(result, "DELETE_PARTICIPANT");
            }

            var lecturerExists = await _uow.DefenseTermLecturers.Query().AsNoTracking()
                .Where(x => x.DefenseTermLecturerID == id && x.DefenseTermId == periodId)
                .Select(x => (int?)x.DefenseTermLecturerID)
                .FirstOrDefaultAsync()
                .ConfigureAwait(false);

            if (!lecturerExists.HasValue)
            {
                return NotFound(ApiResponse<object>.Fail("Không tìm thấy participant giảng viên trong đợt.", 404));
            }

            var lecturerResult = await _deleteDefenseTermLecturerCommand.ExecuteAsync(id);
            return MapOperationResult(lecturerResult, "DELETE_PARTICIPANT");
        }

        private async Task<ActionResult<ApiResponse<object>>> GetStudentScopeParticipants(int periodId, string? keyword, int page, int size)
        {
            var query = _uow.DefenseTermStudents.Query().AsNoTracking()
                .Where(x => x.DefenseTermId == periodId);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                var normalizedKeyword = keyword.Trim().ToUpperInvariant();
                query = query.Where(x =>
                    (x.StudentCode != null && x.StudentCode.ToUpper().Contains(normalizedKeyword))
                    || (x.UserCode != null && x.UserCode.ToUpper().Contains(normalizedKeyword)));
            }

            var safePage = Math.Max(page, 1);
            var safeSize = Math.Clamp(size, 1, 500);
            var totalCount = await query.CountAsync();

            var items = await query
                .OrderByDescending(x => x.LastUpdated)
                .ThenByDescending(x => x.DefenseTermStudentID)
                .Skip((safePage - 1) * safeSize)
                .Take(safeSize)
                .Select(x => new DefenseTermStudentReadDto(
                    x.DefenseTermStudentID,
                    x.DefenseTermId,
                    x.StudentProfileID,
                    x.StudentCode,
                    x.UserCode,
                    x.CreatedAt,
                    x.LastUpdated))
                .ToListAsync();

            var data = new
            {
                Kind = "student",
                View = "scope",
                Page = safePage,
                Size = safeSize,
                Items = items
            };

            return Ok(ApiResponse<object>.SuccessResponse(data, totalCount));
        }

        private async Task<ActionResult<ApiResponse<object>>> GetLecturerScopeParticipants(
            int periodId,
            string? keyword,
            int page,
            int size,
            string? role,
            bool? isPrimary)
        {
            var query = _uow.DefenseTermLecturers.Query().AsNoTracking()
                .Where(x => x.DefenseTermId == periodId);

            if (!string.IsNullOrWhiteSpace(role))
            {
                var normalizedRole = role.Trim().ToUpperInvariant();
                query = query.Where(x => x.Role != null && x.Role.ToUpper().Contains(normalizedRole));
            }

            if (isPrimary.HasValue)
            {
                query = query.Where(x => x.IsPrimary == isPrimary.Value);
            }

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                var normalizedKeyword = keyword.Trim().ToUpperInvariant();
                query = query.Where(x =>
                    (x.LecturerCode != null && x.LecturerCode.ToUpper().Contains(normalizedKeyword))
                    || (x.UserCode != null && x.UserCode.ToUpper().Contains(normalizedKeyword))
                    || (x.Role != null && x.Role.ToUpper().Contains(normalizedKeyword)));
            }

            var safePage = Math.Max(page, 1);
            var safeSize = Math.Clamp(size, 1, 500);
            var totalCount = await query.CountAsync();

            var items = await query
                .GroupJoin(
                    _uow.LecturerProfiles.Query().AsNoTracking(),
                    dt => dt.LecturerCode,
                    lp => lp.LecturerCode,
                    (dt, profiles) => new
                    {
                        Row = dt,
                        LecturerName = profiles.Select(p => p.FullName).FirstOrDefault()
                    })
                .OrderByDescending(x => x.Row.LastUpdated)
                .ThenByDescending(x => x.Row.DefenseTermLecturerID)
                .Skip((safePage - 1) * safeSize)
                .Take(safeSize)
                .Select(x => new DefenseTermLecturerReadDto(
                    x.Row.DefenseTermLecturerID,
                    x.Row.DefenseTermId,
                    x.Row.LecturerProfileID,
                    x.Row.LecturerCode,
                    string.IsNullOrWhiteSpace(x.LecturerName) ? x.Row.LecturerCode : x.LecturerName!,
                    x.Row.UserCode,
                    x.Row.Role,
                    x.Row.IsPrimary,
                    x.Row.CreatedAt,
                    x.Row.LastUpdated))
                .ToListAsync();

            var data = new
            {
                Kind = "lecturer",
                View = "scope",
                Page = safePage,
                Size = safeSize,
                Items = items
            };

            return Ok(ApiResponse<object>.SuccessResponse(data, totalCount));
        }

        private async Task<ActionResult<ApiResponse<object>>> UpsertStudentScopeParticipant(int periodId, DefensePeriodParticipantUpsertRequestDto request)
        {
            if (request.Student == null)
            {
                return BadRequest(ApiResponse<object>.Fail("Thiếu payload student cho kind=student.", 400));
            }

            if (request.Id.HasValue)
            {
                if (request.Id.Value <= 0)
                {
                    return BadRequest(ApiResponse<object>.Fail("id phải lớn hơn 0.", 400));
                }

                var exists = await _uow.DefenseTermStudents.Query().AsNoTracking()
                    .Where(x => x.DefenseTermStudentID == request.Id.Value && x.DefenseTermId == periodId)
                    .Select(x => (int?)x.DefenseTermStudentID)
                    .FirstOrDefaultAsync()
                    .ConfigureAwait(false);

                if (!exists.HasValue)
                {
                    return NotFound(ApiResponse<object>.Fail("Không tìm thấy participant sinh viên trong đợt.", 404));
                }

                var updateDto = new DefenseTermStudentUpdateDto(
                    periodId,
                    request.Student.StudentProfileID,
                    request.Student.StudentCode,
                    request.Student.UserCode,
                    null,
                    DateTime.UtcNow);

                var updateResult = await _updateDefenseTermStudentCommand.ExecuteAsync(request.Id.Value, updateDto);
                return MapOperationResult(updateResult, "UPSERT_PARTICIPANT");
            }

            var createDto = new DefenseTermStudentCreateDto(
                periodId,
                request.Student.StudentProfileID,
                request.Student.StudentCode,
                request.Student.UserCode,
                DateTime.UtcNow,
                DateTime.UtcNow);

            var createResult = await _createDefenseTermStudentCommand.ExecuteAsync(createDto);
            return MapOperationResult(createResult, "UPSERT_PARTICIPANT");
        }

        private async Task<ActionResult<ApiResponse<object>>> UpsertLecturerScopeParticipant(int periodId, DefensePeriodParticipantUpsertRequestDto request)
        {
            if (request.Lecturer == null)
            {
                return BadRequest(ApiResponse<object>.Fail("Thiếu payload lecturer cho kind=lecturer.", 400));
            }

            if (request.Id.HasValue)
            {
                if (request.Id.Value <= 0)
                {
                    return BadRequest(ApiResponse<object>.Fail("id phải lớn hơn 0.", 400));
                }

                var exists = await _uow.DefenseTermLecturers.Query().AsNoTracking()
                    .Where(x => x.DefenseTermLecturerID == request.Id.Value && x.DefenseTermId == periodId)
                    .Select(x => (int?)x.DefenseTermLecturerID)
                    .FirstOrDefaultAsync()
                    .ConfigureAwait(false);

                if (!exists.HasValue)
                {
                    return NotFound(ApiResponse<object>.Fail("Không tìm thấy participant giảng viên trong đợt.", 404));
                }

                var updateDto = new DefenseTermLecturerUpdateDto(
                    periodId,
                    request.Lecturer.LecturerProfileID,
                    request.Lecturer.LecturerCode,
                    request.Lecturer.UserCode,
                    request.Lecturer.Role,
                    request.Lecturer.IsPrimary,
                    null,
                    DateTime.UtcNow);

                var updateResult = await _updateDefenseTermLecturerCommand.ExecuteAsync(request.Id.Value, updateDto);
                return MapOperationResult(updateResult, "UPSERT_PARTICIPANT");
            }

            var createDto = new DefenseTermLecturerCreateDto(
                periodId,
                request.Lecturer.LecturerProfileID,
                request.Lecturer.LecturerCode,
                request.Lecturer.UserCode,
                request.Lecturer.Role,
                request.Lecturer.IsPrimary ?? false,
                DateTime.UtcNow,
                DateTime.UtcNow);

            var createResult = await _createDefenseTermLecturerCommand.ExecuteAsync(createDto);
            return MapOperationResult(createResult, "UPSERT_PARTICIPANT");
        }

        [HttpPost("{periodId:int}/setup/generate")]
        [Authorize(Roles = "Admin,Head")]
        public async Task<ActionResult<ApiResponse<object>>> SetupGenerateCompact(int periodId, [FromBody] DefensePeriodSetupGenerateRequestDto request)
        {
            var mode = (request.Mode ?? string.Empty).Trim().ToUpperInvariant();
            request.Request ??= new GenerateCouncilsRequestDto();

            if (mode == "SIMULATE")
            {
                return WrapAsObject(await SimulateAutoGenerate(periodId, request.Request), mode);
            }

            if (mode == "GENERATE")
            {
                request.Request.IdempotencyKey ??= request.IdempotencyKey;
                return WrapAsObject(await GenerateCouncils(periodId, request.Request, request.Request.IdempotencyKey), mode);
            }

            return BadRequest(ApiResponse<object>.Fail("Mode không hợp lệ. Hỗ trợ: SIMULATE, GENERATE.", 400));
        }

        [HttpGet("{periodId:int}/councils")]
        [Authorize(Roles = "Admin,Head")]
        public async Task<ActionResult<ApiResponse<object>>> GetCouncilsCompact(
            int periodId,
            [FromQuery] int? councilId = null,
            [FromQuery] string? keyword = null,
            [FromQuery] string? tag = null,
            [FromQuery] string? room = null,
            [FromQuery] int page = 1,
            [FromQuery] int size = 20)
        {
            if (councilId.HasValue)
            {
                return WrapAsObject(await GetCouncilDetail(periodId, councilId.Value), "COUNCIL_DETAIL");
            }

            return WrapAsObject(await GetCouncils(periodId, keyword, tag, room, page, size), "COUNCIL_LIST");
        }

        [HttpPost("{periodId:int}/councils/upsert")]
        [Authorize(Roles = "Admin,Head")]
        public async Task<ActionResult<ApiResponse<object>>> UpsertCouncilCompact(int periodId, [FromBody] CouncilCompactUpsertRequestDto request)
        {
            var operation = NormalizeCouncilUpsertOperation(request.Operation);
            if (string.IsNullOrWhiteSpace(operation))
            {
                if (request.Data == null)
                {
                    return BadRequest(ApiResponse<object>.Fail("Thiếu payload data cho thao tác upsert hội đồng.", 400));
                }

                if (request.CouncilId.HasValue)
                {
                    return WrapAsObject(await UpdateCouncil(periodId, request.CouncilId.Value, request.Data), "UPDATE_COUNCIL");
                }

                return WrapAsObject(await CreateCouncil(periodId, request.Data), "CREATE_COUNCIL");
            }

            switch (operation)
            {
                case "CREATE":
                    if (request.Data == null)
                    {
                        return BadRequest(ApiResponse<object>.Fail("operation=CREATE yêu cầu data.", 400));
                    }

                    return WrapAsObject(await CreateCouncil(periodId, request.Data), "CREATE_COUNCIL");

                case "UPDATE":
                    if (!request.CouncilId.HasValue || request.CouncilId.Value <= 0)
                    {
                        return BadRequest(ApiResponse<object>.Fail("operation=UPDATE yêu cầu councilId > 0.", 400));
                    }

                    if (request.Data == null)
                    {
                        return BadRequest(ApiResponse<object>.Fail("operation=UPDATE yêu cầu data.", 400));
                    }

                    return WrapAsObject(await UpdateCouncil(periodId, request.CouncilId.Value, request.Data), "UPDATE_COUNCIL");

                case "CREATE_STEP1":
                    if (request.Step1 == null)
                    {
                        return BadRequest(ApiResponse<object>.Fail("operation=CREATE_STEP1 yêu cầu step1.", 400));
                    }

                    return WrapAsObject(await CreateCouncilStep1(periodId, request.Step1), "CREATE_STEP1");

                case "UPDATE_STEP1":
                    if (!request.CouncilId.HasValue || request.CouncilId.Value <= 0)
                    {
                        return BadRequest(ApiResponse<object>.Fail("operation=UPDATE_STEP1 yêu cầu councilId > 0.", 400));
                    }

                    if (request.Step1 == null)
                    {
                        return BadRequest(ApiResponse<object>.Fail("operation=UPDATE_STEP1 yêu cầu step1.", 400));
                    }

                    return WrapAsObject(await UpdateCouncilStep1(periodId, request.CouncilId.Value, request.Step1), "UPDATE_STEP1");

                case "SAVE_MEMBERS":
                    if (!request.CouncilId.HasValue || request.CouncilId.Value <= 0)
                    {
                        return BadRequest(ApiResponse<object>.Fail("operation=SAVE_MEMBERS yêu cầu councilId > 0.", 400));
                    }

                    if (request.Step2 == null)
                    {
                        return BadRequest(ApiResponse<object>.Fail("operation=SAVE_MEMBERS yêu cầu step2.", 400));
                    }

                    return WrapAsObject(await SaveCouncilMembersStep(periodId, request.CouncilId.Value, request.Step2), "SAVE_MEMBERS");

                case "ADD_MEMBER":
                    if (!request.CouncilId.HasValue || request.CouncilId.Value <= 0)
                    {
                        return BadRequest(ApiResponse<object>.Fail("operation=ADD_MEMBER yêu cầu councilId > 0.", 400));
                    }

                    if (request.MemberAdd == null)
                    {
                        return BadRequest(ApiResponse<object>.Fail("operation=ADD_MEMBER yêu cầu memberAdd.", 400));
                    }

                    return WrapAsObject(await AddCouncilMemberItem(periodId, request.CouncilId.Value, request.MemberAdd), "ADD_MEMBER");

                case "UPDATE_MEMBER":
                    if (!request.CouncilId.HasValue || request.CouncilId.Value <= 0)
                    {
                        return BadRequest(ApiResponse<object>.Fail("operation=UPDATE_MEMBER yêu cầu councilId > 0.", 400));
                    }

                    if (string.IsNullOrWhiteSpace(request.LecturerCode))
                    {
                        return BadRequest(ApiResponse<object>.Fail("operation=UPDATE_MEMBER yêu cầu lecturerCode.", 400));
                    }

                    if (request.MemberUpdate == null)
                    {
                        return BadRequest(ApiResponse<object>.Fail("operation=UPDATE_MEMBER yêu cầu memberUpdate.", 400));
                    }

                    return WrapAsObject(
                        await UpdateCouncilMemberItem(periodId, request.CouncilId.Value, request.LecturerCode.Trim(), request.MemberUpdate),
                        "UPDATE_MEMBER");

                case "REMOVE_MEMBER":
                    if (!request.CouncilId.HasValue || request.CouncilId.Value <= 0)
                    {
                        return BadRequest(ApiResponse<object>.Fail("operation=REMOVE_MEMBER yêu cầu councilId > 0.", 400));
                    }

                    if (string.IsNullOrWhiteSpace(request.LecturerCode))
                    {
                        return BadRequest(ApiResponse<object>.Fail("operation=REMOVE_MEMBER yêu cầu lecturerCode.", 400));
                    }

                    if (string.IsNullOrWhiteSpace(request.ConcurrencyToken))
                    {
                        return BadRequest(ApiResponse<object>.Fail("operation=REMOVE_MEMBER yêu cầu concurrencyToken.", 400));
                    }

                    return WrapAsObject(
                        await RemoveCouncilMemberItem(periodId, request.CouncilId.Value, request.LecturerCode.Trim(), request.ConcurrencyToken),
                        "REMOVE_MEMBER");

                case "SAVE_TOPICS":
                    if (!request.CouncilId.HasValue || request.CouncilId.Value <= 0)
                    {
                        return BadRequest(ApiResponse<object>.Fail("operation=SAVE_TOPICS yêu cầu councilId > 0.", 400));
                    }

                    if (request.Step3 == null)
                    {
                        return BadRequest(ApiResponse<object>.Fail("operation=SAVE_TOPICS yêu cầu step3.", 400));
                    }

                    return WrapAsObject(await SaveCouncilTopicsStep(periodId, request.CouncilId.Value, request.Step3), "SAVE_TOPICS");

                case "ADD_TOPIC":
                    if (!request.CouncilId.HasValue || request.CouncilId.Value <= 0)
                    {
                        return BadRequest(ApiResponse<object>.Fail("operation=ADD_TOPIC yêu cầu councilId > 0.", 400));
                    }

                    if (request.TopicAdd == null)
                    {
                        return BadRequest(ApiResponse<object>.Fail("operation=ADD_TOPIC yêu cầu topicAdd.", 400));
                    }

                    return WrapAsObject(await AddCouncilTopicItem(periodId, request.CouncilId.Value, request.TopicAdd), "ADD_TOPIC");

                case "UPDATE_TOPIC":
                    if (!request.CouncilId.HasValue || request.CouncilId.Value <= 0)
                    {
                        return BadRequest(ApiResponse<object>.Fail("operation=UPDATE_TOPIC yêu cầu councilId > 0.", 400));
                    }

                    if (!request.AssignmentId.HasValue || request.AssignmentId.Value <= 0)
                    {
                        return BadRequest(ApiResponse<object>.Fail("operation=UPDATE_TOPIC yêu cầu assignmentId > 0.", 400));
                    }

                    if (request.TopicUpdate == null)
                    {
                        return BadRequest(ApiResponse<object>.Fail("operation=UPDATE_TOPIC yêu cầu topicUpdate.", 400));
                    }

                    return WrapAsObject(
                        await UpdateCouncilTopicItem(periodId, request.CouncilId.Value, request.AssignmentId.Value, request.TopicUpdate),
                        "UPDATE_TOPIC");

                case "REMOVE_TOPIC":
                    if (!request.CouncilId.HasValue || request.CouncilId.Value <= 0)
                    {
                        return BadRequest(ApiResponse<object>.Fail("operation=REMOVE_TOPIC yêu cầu councilId > 0.", 400));
                    }

                    if (!request.AssignmentId.HasValue || request.AssignmentId.Value <= 0)
                    {
                        return BadRequest(ApiResponse<object>.Fail("operation=REMOVE_TOPIC yêu cầu assignmentId > 0.", 400));
                    }

                    if (string.IsNullOrWhiteSpace(request.ConcurrencyToken))
                    {
                        return BadRequest(ApiResponse<object>.Fail("operation=REMOVE_TOPIC yêu cầu concurrencyToken.", 400));
                    }

                    return WrapAsObject(
                        await RemoveCouncilTopicItem(periodId, request.CouncilId.Value, request.AssignmentId.Value, request.ConcurrencyToken),
                        "REMOVE_TOPIC");
            }

            return BadRequest(ApiResponse<object>.Fail(
                "operation không hợp lệ. Hỗ trợ: CREATE, UPDATE, CREATE_STEP1, UPDATE_STEP1, SAVE_MEMBERS, ADD_MEMBER, UPDATE_MEMBER, REMOVE_MEMBER, SAVE_TOPICS, ADD_TOPIC, UPDATE_TOPIC, REMOVE_TOPIC.",
                400));
        }

        [HttpDelete("{periodId:int}/councils/{councilId:int}")]
        [Authorize(Roles = "Admin,Head")]
        public async Task<ActionResult<ApiResponse<object>>> DeleteCouncilCompact(int periodId, int councilId)
        {
            return WrapAsObject(await DeleteCouncil(periodId, councilId), "DELETE_COUNCIL");
        }

        [HttpGet("{periodId:int}/monitoring/snapshot")]
        [Authorize(Roles = "Admin,Head")]
        public async Task<ActionResult<ApiResponse<object>>> GetMonitoringSnapshotCompact(int periodId, [FromQuery] int? committeeId = null)
        {
            var pipelineAction = await GetE2EPipeline(periodId);
            if (!TryExtractApiResponse(pipelineAction, out var pipeline, out var pipelineStatusCode) || pipeline == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy monitoring snapshot.", 500));
            }

            if (!pipeline.Success)
            {
                return MapFailure(pipeline, pipelineStatusCode, "Không thể lấy pipeline tổng quan.");
            }

            var overviewAction = await GetOverview(periodId);
            if (!TryExtractApiResponse(overviewAction, out var overview, out var overviewStatusCode) || overview == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy monitoring snapshot.", 500));
            }

            if (!overview.Success)
            {
                return MapFailure(overview, overviewStatusCode, "Không thể lấy analytics overview.");
            }

            var byCouncilAction = await GetByCouncil(periodId);
            if (!TryExtractApiResponse(byCouncilAction, out var byCouncil, out var byCouncilStatusCode) || byCouncil == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy monitoring snapshot.", 500));
            }

            if (!byCouncil.Success)
            {
                return MapFailure(byCouncil, byCouncilStatusCode, "Không thể lấy analytics theo hội đồng.");
            }

            var distributionAction = await GetDistribution(periodId);
            if (!TryExtractApiResponse(distributionAction, out var distribution, out var distributionStatusCode) || distribution == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy monitoring snapshot.", 500));
            }

            if (!distribution.Success)
            {
                return MapFailure(distribution, distributionStatusCode, "Không thể lấy phân bố điểm.");
            }

            var progressAction = await GetScoringProgress(periodId, committeeId);
            if (!TryExtractApiResponse(progressAction, out var progress, out var progressStatusCode) || progress == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy monitoring snapshot.", 500));
            }

            if (!progress.Success)
            {
                return MapFailure(progress, progressStatusCode, "Không thể lấy tiến độ chấm điểm.");
            }

            var alertsAction = await GetScoringAlerts(periodId, committeeId);
            if (!TryExtractApiResponse(alertsAction, out var alerts, out var alertsStatusCode) || alerts == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy monitoring snapshot.", 500));
            }

            if (!alerts.Success)
            {
                return MapFailure(alerts, alertsStatusCode, "Không thể lấy cảnh báo chấm điểm.");
            }

            var tagOverviewAction = await GetTagOverview(periodId);
            if (!TryExtractApiResponse(tagOverviewAction, out var tagOverview, out var tagOverviewStatusCode) || tagOverview == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy monitoring snapshot.", 500));
            }

            if (!tagOverview.Success)
            {
                return MapFailure(tagOverview, tagOverviewStatusCode, "Không thể lấy tag overview.");
            }

            var data = new
            {
                Pipeline = pipeline.Data,
                Analytics = new
                {
                    Overview = overview.Data,
                    ByCouncil = byCouncil.Data,
                    Distribution = distribution.Data
                },
                Scoring = new
                {
                    Progress = progress.Data,
                    Alerts = alerts.Data
                },
                Tags = tagOverview.Data
            };

            return Ok(ApiResponse<object>.SuccessResponse(data));
        }

        [HttpGet("{periodId:int}/audit/snapshot")]
        [Authorize(Roles = "Admin,Head")]
        public async Task<ActionResult<ApiResponse<object>>> GetAuditSnapshotCompact(
            int periodId,
            [FromQuery] int size = 100,
            [FromQuery] int? councilId = null,
            [FromQuery] int? revisionId = null)
        {
            var syncHistoryAction = await GetSyncHistory(periodId, size);
            if (!TryExtractApiResponse(syncHistoryAction, out var syncHistory, out var syncHistoryStatusCode) || syncHistory == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy audit snapshot.", 500));
            }

            if (!syncHistory.Success)
            {
                return MapFailure(syncHistory, syncHistoryStatusCode, "Không thể lấy sync history.");
            }

            var publishHistoryAction = await GetPublishHistory(periodId);
            if (!TryExtractApiResponse(publishHistoryAction, out var publishHistory, out var publishHistoryStatusCode) || publishHistory == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy audit snapshot.", 500));
            }

            if (!publishHistory.Success)
            {
                return MapFailure(publishHistory, publishHistoryStatusCode, "Không thể lấy publish history.");
            }

            var councilAuditAction = await GetCouncilAuditHistory(periodId, councilId);
            if (!TryExtractApiResponse(councilAuditAction, out var councilAudit, out var councilAuditStatusCode) || councilAudit == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy audit snapshot.", 500));
            }

            if (!councilAudit.Success)
            {
                return MapFailure(councilAudit, councilAuditStatusCode, "Không thể lấy council audit history.");
            }

            List<RevisionAuditTrailDto> revisionTrail = new();
            if (revisionId.HasValue)
            {
                var revisionAction = await GetRevisionAuditTrail(periodId, revisionId.Value);
                if (!TryExtractApiResponse(revisionAction, out var revisionAudit, out var revisionAuditStatusCode) || revisionAudit == null)
                {
                    return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy audit snapshot.", 500));
                }

                if (!revisionAudit.Success)
                {
                    return MapFailure(revisionAudit, revisionAuditStatusCode, "Không thể lấy revision audit trail.");
                }

                revisionTrail = revisionAudit.Data ?? new List<RevisionAuditTrailDto>();
            }

            var data = new
            {
                SyncHistory = syncHistory.Data,
                PublishHistory = publishHistory.Data,
                CouncilAuditHistory = councilAudit.Data,
                RevisionAuditTrail = revisionTrail
            };

            return Ok(ApiResponse<object>.SuccessResponse(data));
        }

        [HttpGet("{periodId:int}/operations/snapshot")]
        [Authorize(Roles = "Admin,Head")]
        public async Task<ActionResult<ApiResponse<object>>> GetOperationsSnapshotCompact(
            int periodId,
            [FromQuery] DefensePeriodOperationsSnapshotQueryDto query)
        {
            if (query.CommitteeId.HasValue && query.CommitteeId.Value <= 0)
            {
                return BadRequest(ApiResponse<object>.Fail("committeeId phải lớn hơn 0.", 400));
            }

            if (query.RevisionId.HasValue && query.RevisionId.Value <= 0)
            {
                return BadRequest(ApiResponse<object>.Fail("revisionId phải lớn hơn 0.", 400));
            }

            var monitoringAction = await GetMonitoringSnapshotCompact(periodId, query.CommitteeId);
            if (!TryExtractApiResponse(monitoringAction, out var monitoring, out var monitoringStatusCode) || monitoring == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy operations snapshot.", 500));
            }

            if (!monitoring.Success)
            {
                return MapFailure(monitoring, monitoringStatusCode, "Không thể lấy monitoring snapshot.");
            }

            var scoringMatrixAction = await GetScoringMatrix(periodId, query.CommitteeId);
            if (!TryExtractApiResponse(scoringMatrixAction, out var scoringMatrix, out var scoringMatrixStatusCode) || scoringMatrix == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy operations snapshot.", 500));
            }

            if (!scoringMatrix.Success)
            {
                return MapFailure(scoringMatrix, scoringMatrixStatusCode, "Không thể lấy scoring matrix.");
            }

            var progressAction = await GetProgressPipeline(periodId);
            if (!TryExtractApiResponse(progressAction, out var progress, out var progressStatusCode) || progress == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy operations snapshot.", 500));
            }

            if (!progress.Success)
            {
                return MapFailure(progress, progressStatusCode, "Không thể lấy progress pipeline.");
            }

            var postDefenseAction = await GetPostDefensePipeline(
                periodId,
                query.RevisionStatus,
                query.RevisionKeyword,
                query.RevisionPage,
                query.RevisionSize);
            if (!TryExtractApiResponse(postDefenseAction, out var postDefense, out var postDefenseStatusCode) || postDefense == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy operations snapshot.", 500));
            }

            if (!postDefense.Success)
            {
                return MapFailure(postDefense, postDefenseStatusCode, "Không thể lấy hậu bảo vệ.");
            }

            var auditAction = await GetAuditSnapshotCompact(periodId, query.AuditSize, query.CommitteeId, query.RevisionId);
            if (!TryExtractApiResponse(auditAction, out var audit, out var auditStatusCode) || audit == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy operations snapshot.", 500));
            }

            if (!audit.Success)
            {
                return MapFailure(audit, auditStatusCode, "Không thể lấy audit snapshot.");
            }

            var stateAction = await GetState(periodId);
            if (!TryExtractApiResponse(stateAction, out var state, out var stateStatusCode) || state == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy operations snapshot.", 500));
            }

            if (!state.Success)
            {
                return MapFailure(state, stateStatusCode, "Không thể lấy trạng thái đợt.");
            }

            var safeScoringMatrix = scoringMatrix.Data?.Select(row =>
            {
                if (row.IsLocked || row.Status == "LOCKED")
                {
                    return row;
                }
                
                return new ScoringMatrixRowDto
                {
                    CommitteeId = row.CommitteeId,
                    CommitteeCode = row.CommitteeCode,
                    CommitteeName = row.CommitteeName,
                    Room = row.Room,
                    AssignmentId = row.AssignmentId,
                    AssignmentCode = row.AssignmentCode,
                    TopicCode = row.TopicCode,
                    TopicTitle = row.TopicTitle,
                    SupervisorLecturerCode = row.SupervisorLecturerCode,
                    SupervisorLecturerName = row.SupervisorLecturerName,
                    CommitteeChairCode = row.CommitteeChairCode,
                    CommitteeChairName = row.CommitteeChairName,
                    CommitteeSecretaryCode = row.CommitteeSecretaryCode,
                    CommitteeSecretaryName = row.CommitteeSecretaryName,
                    CommitteeReviewerCode = row.CommitteeReviewerCode,
                    CommitteeReviewerName = row.CommitteeReviewerName,
                    Chair = row.Chair,
                    ChairName = row.ChairName,
                    Secretary = row.Secretary,
                    SecretaryName = row.SecretaryName,
                    Reviewer = row.Reviewer,
                    ReviewerName = row.ReviewerName,
                    TopicTags = row.TopicTags,
                    Session = row.Session,
                    SessionCode = row.SessionCode,
                    ScheduledAt = row.ScheduledAt,
                    StartTime = row.StartTime,
                    EndTime = row.EndTime,
                    StudentCode = row.StudentCode,
                    StudentName = row.StudentName,
                    ClassName = row.ClassName,
                    CohortCode = row.CohortCode,
                    SupervisorOrganization = row.SupervisorOrganization,
                    SubmittedCount = row.SubmittedCount,
                    RequiredCount = row.RequiredCount,
                    IsLocked = row.IsLocked,
                    Status = row.Status,
                    DefenseDocuments = row.DefenseDocuments,
                    TopicSupervisorScore = row.TopicSupervisorScore,
                    ScoreCt = null,
                    ScoreTk = null,
                    ScorePb = null,
                    ScoreGvhd = null,
                    FinalScore = null,
                    FinalGrade = null,
                    Variance = null,
                    CommentCt = null,
                    CommentTk = null,
                    CommentPb = null,
                    CommentGvhd = null
                };
            }).ToList();

            var data = new
            {
                Monitoring = monitoring.Data,
                ScoringMatrix = safeScoringMatrix,
                ProgressTracking = progress.Data,
                PostDefense = postDefense.Data,
                Audit = audit.Data,
                Reporting = new
                {
                    SupportedReportTypes = new[]
                    {
                        "council-summary",
                        "form-1",
                        "final-term",
                        "sync-errors"
                    },
                    DefaultFormat = "csv"
                }
            };

            return Ok(ApiResponse<object>.SuccessResponse(
                data,
                allowedActions: state.Data?.AllowedActions ?? new List<string>(),
                warnings: state.Warnings));
        }

        [HttpGet("{periodId:int}/operations/export")]
        [Authorize]
        public async Task<ActionResult<ApiResponse<object>>> ExportOperationsSnapshotCompact(
            int periodId,
            [FromQuery] DefensePeriodOperationsSnapshotQueryDto query,
            [FromQuery] string format = "xlsx")
        {
            var operationsAction = await GetOperationsSnapshotCompact(periodId, query);
            if (!TryExtractApiResponse(operationsAction, out var operations, out var operationsStatusCode) || operations == null)
            {
                return FromResult(ApiResponse<object>.Fail("Không thể lấy dữ liệu điều hành chấm điểm.", 500));
            }

            if (!operations.Success)
            {
                return MapFailure(operations, operationsStatusCode, "Không thể lấy dữ liệu điều hành chấm điểm.");
            }

            var stateAction = await GetState(periodId);
            if (!TryExtractApiResponse(stateAction, out var state, out var stateStatusCode) || state == null)
            {
                return FromResult(ApiResponse<object>.Fail("Không thể lấy trạng thái đợt.", 500));
            }

            if (!state.Success)
            {
                return MapFailure(state, stateStatusCode, "Không thể lấy trạng thái đợt.");
            }

            var councilsAction = await GetCouncils(periodId, null, null, null, 1, 1000);
            if (!TryExtractApiResponse(councilsAction, out var councils, out var councilsStatusCode) || councils == null)
            {
                return FromResult(ApiResponse<object>.Fail("Không thể lấy danh sách hội đồng.", 500));
            }

            if (!councils.Success)
            {
                return MapFailure(councils, councilsStatusCode, "Không thể lấy danh sách hội đồng.");
            }

            var exportSnapshot = JsonSerializer.Deserialize<DefenseOperationsExportSnapshotDto>(
                JsonSerializer.Serialize(operations.Data)) ?? new DefenseOperationsExportSnapshotDto();
            exportSnapshot.DefenseTermId = periodId;
            exportSnapshot.State = state.Data ?? new DefensePeriodStateDto();
            exportSnapshot.Councils = councils.Data ?? new PagedResult<CouncilDraftDto>();

            var exportResult = await _operationsExportService.ExportAsync(exportSnapshot, format, HttpContext.RequestAborted);
            if (!exportResult.Success)
            {
                return StatusCode(exportResult.HttpStatusCode == 0 ? 400 : exportResult.HttpStatusCode, exportResult);
            }

            var exportedFile = exportResult.Data!;
            return File(exportedFile.Content, exportedFile.ContentType, exportedFile.FileName);
        }

        [HttpGet("{periodId:int}/reports/export")]
        [Authorize]
        public async Task<IActionResult> ExportReportCompact(
            int periodId,
            [FromQuery] string reportType = "final-term",
            [FromQuery] string format = "csv",
            [FromQuery] int? councilId = null)
        {
            var normalized = (reportType ?? string.Empty).Trim().ToLowerInvariant();

            if (normalized == "council-summary")
            {
                return await ExportCouncilSummary(periodId, format);
            }

            if (normalized == "form-1")
            {
                if (!councilId.HasValue)
                {
                    return BadRequest(ApiResponse<object>.Fail("reportType=form-1 yêu cầu councilId.", 400));
                }

                return await ExportCouncilPackage(periodId, "scoreboard", councilId.Value, format);
            }

            if (normalized == "scoreboard" || normalized == "minutes" || normalized == "review")
            {
                if (!councilId.HasValue)
                {
                    return BadRequest(ApiResponse<object>.Fail($"reportType={normalized} yêu cầu councilId.", 400));
                }

                return await ExportCouncilPackage(periodId, normalized, councilId.Value, format);
            }

            if (normalized == "final-term")
            {
                return await ExportFinalTerm(periodId, councilId, format);
            }

            if (normalized == "committee-roster")
            {
                return await ExportCommitteeRoster(periodId, format);
            }

            if (normalized == "sync-errors")
            {
                return await ExportSyncErrors(periodId, format);
            }

            return BadRequest(ApiResponse<object>.Fail("reportType không hợp lệ. Hỗ trợ: council-summary, scoreboard, minutes, review, form-1, final-term, committee-roster, sync-errors.", 400));
        }

        [HttpPost("{periodId:int}/reports/export")]
        [Authorize]
        public async Task<IActionResult> ExportReportCustom(int periodId, [FromBody] DefensePeriodReportExportRequestDto request)
        {
            if (request == null)
            {
                return BadRequest(ApiResponse<object>.Fail("Thiếu payload export.", 400));
            }

            if (string.IsNullOrWhiteSpace(request.ReportType))
            {
                return BadRequest(ApiResponse<object>.Fail("ReportType là bắt buộc.", 400));
            }

            if (string.IsNullOrWhiteSpace(request.Format))
            {
                return BadRequest(ApiResponse<object>.Fail("Format là bắt buộc.", 400));
            }

            var result = await _reportQuery.ExecuteAsync(request, periodId, HttpContext.RequestAborted);
            if (!result.Success)
            {
                return StatusCode(result.HttpStatusCode == 0 ? 400 : result.HttpStatusCode, result);
            }

            return File(result.Data.Content, result.Data.ContentType, result.Data.FileName);
        }

        private ActionResult<ApiResponse<object>> WrapAsObject<T>(ActionResult<ApiResponse<T>> actionResult, string action)
        {
            if (!TryExtractApiResponse(actionResult, out var response, out var statusCode) || response == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể xử lý phản hồi nội bộ.", 500));
            }

            if (!response.Success)
            {
                return StatusCode(statusCode, ApiResponse<object>.Fail(
                    response.Message ?? "Yêu cầu thất bại.",
                    statusCode,
                    response.Errors,
                    response.Code,
                    response.Warnings,
                    response.AllowedActions));
            }

            return StatusCode(statusCode, ApiResponse<object>.SuccessResponse(
                new
                {
                    Action = action,
                    Data = response.Data
                },
                response.TotalCount,
                statusCode,
                response.Code,
                response.Warnings,
                response.IdempotencyReplay,
                response.ConcurrencyToken,
                response.AllowedActions));
        }

        private ActionResult<ApiResponse<object>> MapFailure<T>(ApiResponse<T> response, int statusCode, string fallbackMessage)
        {
            return StatusCode(statusCode, ApiResponse<object>.Fail(
                response.Message ?? fallbackMessage,
                statusCode,
                response.Errors,
                response.Code,
                response.Warnings,
                response.AllowedActions));
        }

        private ActionResult<ApiResponse<object>> MapOperationResult<T>(OperationResult<T> result, string action)
        {
            var statusCode = result.StatusCode == 0
                ? (result.Success ? 200 : 400)
                : result.StatusCode;

            if (!result.Success)
            {
                return StatusCode(statusCode, ApiResponse<object>.Fail(
                    result.ErrorMessage ?? "Yêu cầu thất bại.",
                    statusCode));
            }

            return StatusCode(statusCode, ApiResponse<object>.SuccessResponse(
                new
                {
                    Action = action,
                    Data = result.Data
                },
                httpStatusCode: statusCode));
        }

        private async Task<bool> DefensePeriodExistsAsync(int periodId)
        {
            return await _uow.DefenseTerms.Query().AsNoTracking()
                .Where(x => x.DefenseTermId == periodId)
                .Select(x => (int?)x.DefenseTermId)
                .FirstOrDefaultAsync()
                .ConfigureAwait(false) != null;
        }

        private static bool TryNormalizeParticipantKind(string? kind, out string normalizedKind)
        {
            var normalized = (kind ?? string.Empty).Trim().ToLowerInvariant();

            if (normalized == "student" || normalized == "students")
            {
                normalizedKind = "student";
                return true;
            }

            if (normalized == "lecturer" || normalized == "lecturers")
            {
                normalizedKind = "lecturer";
                return true;
            }

            normalizedKind = string.Empty;
            return false;
        }

        private static string NormalizeParticipantView(string? view)
        {
            var normalized = (view ?? "scope").Trim().ToLowerInvariant();
            return normalized switch
            {
                "scope" => "scope",
                "runtime" => "runtime",
                _ => normalized
            };
        }

        private static string NormalizeCouncilUpsertOperation(string? operation)
        {
            var normalized = (operation ?? string.Empty).Trim().ToUpperInvariant();
            return normalized switch
            {
                "" => string.Empty,
                "CREATE" => "CREATE",
                "UPDATE" => "UPDATE",
                "CREATE_STEP1" => "CREATE_STEP1",
                "STEP1_CREATE" => "CREATE_STEP1",
                "UPDATE_STEP1" => "UPDATE_STEP1",
                "STEP1_UPDATE" => "UPDATE_STEP1",
                "SAVE_MEMBERS" => "SAVE_MEMBERS",
                "STEP2_SAVE" => "SAVE_MEMBERS",
                "SAVE_STEP2_MEMBERS" => "SAVE_MEMBERS",
                "ADD_MEMBER" => "ADD_MEMBER",
                "MEMBER_ADD" => "ADD_MEMBER",
                "UPDATE_MEMBER" => "UPDATE_MEMBER",
                "MEMBER_UPDATE" => "UPDATE_MEMBER",
                "REMOVE_MEMBER" => "REMOVE_MEMBER",
                "MEMBER_REMOVE" => "REMOVE_MEMBER",
                "SAVE_TOPICS" => "SAVE_TOPICS",
                "STEP3_SAVE" => "SAVE_TOPICS",
                "SAVE_STEP3_TOPICS" => "SAVE_TOPICS",
                "ADD_TOPIC" => "ADD_TOPIC",
                "TOPIC_ADD" => "ADD_TOPIC",
                "UPDATE_TOPIC" => "UPDATE_TOPIC",
                "TOPIC_UPDATE" => "UPDATE_TOPIC",
                "REMOVE_TOPIC" => "REMOVE_TOPIC",
                "TOPIC_REMOVE" => "REMOVE_TOPIC",
                _ => normalized
            };
        }

        private static bool TryExtractApiResponse<T>(ActionResult<ApiResponse<T>> actionResult, out ApiResponse<T>? response, out int statusCode)
        {
            if (actionResult.Value != null)
            {
                response = actionResult.Value;
                statusCode = response.HttpStatusCode == 0 ? (response.Success ? 200 : 400) : response.HttpStatusCode;
                return true;
            }

            if (actionResult.Result is ObjectResult objectResult && objectResult.Value is ApiResponse<T> typed)
            {
                response = typed;
                statusCode = objectResult.StatusCode ?? (typed.HttpStatusCode == 0 ? (typed.Success ? 200 : 400) : typed.HttpStatusCode);
                return true;
            }

            response = null;
            statusCode = 500;
            return false;
        }


        private async Task<ActionResult<ApiResponse<IEnumerable<DefensePeriodListItemDto>>>> GetPeriods(
            [FromQuery] string? keyword = null,
            [FromQuery] string? status = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            var query = _uow.DefenseTerms.Query().AsNoTracking();

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                var normalizedKeyword = keyword.Trim().ToUpperInvariant();
                query = query.Where(x => x.Name.ToUpper().Contains(normalizedKeyword));
            }

            if (!string.IsNullOrWhiteSpace(status))
            {
                string normalizedStatus;
                try
                {
                    normalizedStatus = NormalizePeriodStatus(status);
                }
                catch (ArgumentException ex)
                {
                    return BadRequest(ApiResponse<object>.Fail(ex.Message, 400));
                }

                query = query.Where(x => x.Status == normalizedStatus);
            }

            var safePage = Math.Max(page, 1);
            var safePageSize = Math.Clamp(pageSize, 1, 200);
            var total = await query.CountAsync();

            var items = await query
                .OrderByDescending(x => x.StartDate)
                .ThenByDescending(x => x.DefenseTermId)
                .Skip((safePage - 1) * safePageSize)
                .Take(safePageSize)
                .Select(x => new DefensePeriodListItemDto
                {
                    DefenseTermId = x.DefenseTermId,
                    Name = x.Name,
                    StartDate = x.StartDate,
                    EndDate = x.EndDate,
                    Status = x.Status,
                    CreatedAt = x.CreatedAt,
                    LastUpdated = x.LastUpdated
                })
                .ToListAsync();

            return Ok(ApiResponse<IEnumerable<DefensePeriodListItemDto>>.SuccessResponse(items, total));
        }


        private async Task<ActionResult<ApiResponse<DefensePeriodDetailDto>>> GetPeriodDetail(int periodId)
        {
            var period = await _uow.DefenseTerms.Query().AsNoTracking().FirstOrDefaultAsync(x => x.DefenseTermId == periodId);
            if (period == null)
            {
                return NotFound(ApiResponse<object>.Fail("Không tìm thấy đợt bảo vệ.", 404));
            }

            var councilIds = await GetPeriodCouncilIdsAsync(period);
            var councilCount = councilIds.Count;
            var assignmentCount = 0;
            var resultCount = 0;
            var revisionCount = 0;

            if (councilIds.Count > 0)
            {
                assignmentCount = await _uow.DefenseAssignments.Query()
                    .AsNoTracking()
                    .Where(x => x.CommitteeID.HasValue && councilIds.Contains(x.CommitteeID.Value))
                    .CountAsync();

                var assignmentIds = await _uow.DefenseAssignments.Query()
                    .AsNoTracking()
                    .Where(x => x.CommitteeID.HasValue && councilIds.Contains(x.CommitteeID.Value))
                    .Select(x => x.AssignmentID)
                    .ToListAsync();

                if (assignmentIds.Count > 0)
                {
                    resultCount = await _uow.DefenseResults.Query()
                        .AsNoTracking()
                        .Where(x => assignmentIds.Contains(x.AssignmentId))
                        .CountAsync();

                    revisionCount = await _uow.DefenseRevisions.Query()
                        .AsNoTracking()
                        .Where(x => assignmentIds.Contains(x.AssignmentId))
                        .CountAsync();
                }
            }

            var configResult = await _getConfigQuery.ExecuteAsync(periodId);
            var stateResult = await _getStateQuery.ExecuteAsync(periodId);

            var dto = new DefensePeriodDetailDto
            {
                DefenseTermId = period.DefenseTermId,
                Name = period.Name,
                StartDate = period.StartDate,
                EndDate = period.EndDate,
                Status = period.Status,
                CreatedAt = period.CreatedAt,
                LastUpdated = period.LastUpdated,
                CouncilCount = councilCount,
                AssignmentCount = assignmentCount,
                ResultCount = resultCount,
                RevisionCount = revisionCount,
                Config = configResult.Success ? configResult.Data : null,
                State = stateResult.Success ? stateResult.Data : null
            };

            return Ok(ApiResponse<DefensePeriodDetailDto>.SuccessResponse(dto));
        }


        private async Task<ActionResult<ApiResponse<DefensePeriodDetailDto>>> CreatePeriod([FromBody] DefensePeriodCreateDto request)
        {
            try
            {
                ValidatePeriodWindow(request.StartDate, request.EndDate);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<object>.Fail(ex.Message, 400));
            }

            string normalizedStatus;
            try
            {
                normalizedStatus = NormalizePeriodStatus(string.IsNullOrWhiteSpace(request.Status) ? "Draft" : request.Status);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<object>.Fail(ex.Message, 400));
            }

            var duplicatedName = await _uow.DefenseTerms.Query().AsNoTracking()
                .Where(x => x.Name.ToUpper() == request.Name.Trim().ToUpper())
                .Select(x => (int?)x.DefenseTermId)
                .FirstOrDefaultAsync() != null;
            if (duplicatedName)
            {
                return Conflict(ApiResponse<object>.Fail("Tên đợt bảo vệ đã tồn tại.", 409));
            }

            var now = DateTime.UtcNow;
            var period = new Models.DefenseTerm
            {
                Name = request.Name.Trim(),
                StartDate = request.StartDate.Date,
                EndDate = request.EndDate?.Date,
                Status = normalizedStatus,
                CreatedAt = now,
                LastUpdated = now
            };

            await _uow.DefenseTerms.AddAsync(period);
            await _uow.SaveChangesAsync();

            var dto = new DefensePeriodDetailDto
            {
                DefenseTermId = period.DefenseTermId,
                Name = period.Name,
                StartDate = period.StartDate,
                EndDate = period.EndDate,
                Status = period.Status,
                CreatedAt = period.CreatedAt,
                LastUpdated = period.LastUpdated,
                CouncilCount = 0,
                AssignmentCount = 0,
                ResultCount = 0,
                RevisionCount = 0
            };

            return StatusCode(201, ApiResponse<DefensePeriodDetailDto>.SuccessResponse(dto, 1, 201));
        }


        private async Task<ActionResult<ApiResponse<DefensePeriodDetailDto>>> UpdatePeriod(int periodId, [FromBody] DefensePeriodUpdateDto request)
        {
            try
            {
                ValidatePeriodWindow(request.StartDate, request.EndDate);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<object>.Fail(ex.Message, 400));
            }

            string normalizedStatus;
            try
            {
                normalizedStatus = NormalizePeriodStatus(string.IsNullOrWhiteSpace(request.Status) ? "Draft" : request.Status);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<object>.Fail(ex.Message, 400));
            }

            var period = await _uow.DefenseTerms.GetByIdAsync(periodId);
            if (period == null)
            {
                return NotFound(ApiResponse<object>.Fail("Không tìm thấy đợt bảo vệ.", 404));
            }

            var duplicatedName = await _uow.DefenseTerms.Query().AsNoTracking()
                .Where(x => x.DefenseTermId != periodId && x.Name.ToUpper() == request.Name.Trim().ToUpper())
                .Select(x => (int?)x.DefenseTermId)
                .FirstOrDefaultAsync() != null;
            if (duplicatedName)
            {
                return Conflict(ApiResponse<object>.Fail("Tên đợt bảo vệ đã tồn tại.", 409));
            }

            period.Name = request.Name.Trim();
            period.StartDate = request.StartDate.Date;
            period.EndDate = request.EndDate?.Date;
            period.Status = normalizedStatus;
            period.LastUpdated = DateTime.UtcNow;

            _uow.DefenseTerms.Update(period);
            await _uow.SaveChangesAsync();

            var councilIds = await GetPeriodCouncilIdsAsync(period);
            var assignmentCount = 0;
            var resultCount = 0;
            var revisionCount = 0;

            if (councilIds.Count > 0)
            {
                assignmentCount = await _uow.DefenseAssignments.Query()
                    .AsNoTracking()
                    .Where(x => x.CommitteeID.HasValue && councilIds.Contains(x.CommitteeID.Value))
                    .CountAsync();

                var assignmentIds = await _uow.DefenseAssignments.Query()
                    .AsNoTracking()
                    .Where(x => x.CommitteeID.HasValue && councilIds.Contains(x.CommitteeID.Value))
                    .Select(x => x.AssignmentID)
                    .ToListAsync();

                if (assignmentIds.Count > 0)
                {
                    resultCount = await _uow.DefenseResults.Query()
                        .AsNoTracking()
                        .Where(x => assignmentIds.Contains(x.AssignmentId))
                        .CountAsync();

                    revisionCount = await _uow.DefenseRevisions.Query()
                        .AsNoTracking()
                        .Where(x => assignmentIds.Contains(x.AssignmentId))
                        .CountAsync();
                }
            }

            var configResult = await _getConfigQuery.ExecuteAsync(periodId);
            var stateResult = await _getStateQuery.ExecuteAsync(periodId);

            var dto = new DefensePeriodDetailDto
            {
                DefenseTermId = period.DefenseTermId,
                Name = period.Name,
                StartDate = period.StartDate,
                EndDate = period.EndDate,
                Status = period.Status,
                CreatedAt = period.CreatedAt,
                LastUpdated = period.LastUpdated,
                CouncilCount = councilIds.Count,
                AssignmentCount = assignmentCount,
                ResultCount = resultCount,
                RevisionCount = revisionCount,
                Config = configResult.Success ? configResult.Data : null,
                State = stateResult.Success ? stateResult.Data : null
            };

            return Ok(ApiResponse<DefensePeriodDetailDto>.SuccessResponse(dto));
        }


        private async Task<ActionResult<ApiResponse<object>>> DeletePeriod(int periodId)
        {
            var period = await _uow.DefenseTerms.GetByIdAsync(periodId);
            if (period == null)
            {
                return NotFound(ApiResponse<object>.Fail("Không tìm thấy đợt bảo vệ.", 404));
            }

            var councilIds = await GetPeriodCouncilIdsAsync(period);
            if (councilIds.Count > 0)
            {
                var hasAssignments = await _uow.DefenseAssignments.Query()
                    .AsNoTracking()
                    .Where(x => x.CommitteeID.HasValue && councilIds.Contains(x.CommitteeID.Value))
                    .Select(x => (int?)x.AssignmentID)
                    .FirstOrDefaultAsync() != null;

                if (hasAssignments)
                {
                    return Conflict(ApiResponse<object>.Fail("Đợt đã phát sinh phân công bảo vệ, không thể xóa.", 409));
                }

                var hasCommittees = await _uow.Committees.Query().AsNoTracking()
                    .Where(x => councilIds.Contains(x.CommitteeID))
                    .Select(x => (int?)x.CommitteeID)
                    .FirstOrDefaultAsync() != null;
                if (hasCommittees)
                {
                    return Conflict(ApiResponse<object>.Fail("Đợt đã phát sinh hội đồng, không thể xóa.", 409));
                }
            }

            _uow.DefenseTerms.Remove(period);
            await _uow.SaveChangesAsync();
            return Ok(ApiResponse<object>.SuccessResponse(null));
        }


        private async Task<ActionResult<ApiResponse<DefensePeriodDashboardDto>>> GetDashboard(int periodId)
        {
            var period = await _uow.DefenseTerms.Query().AsNoTracking().FirstOrDefaultAsync(x => x.DefenseTermId == periodId);
            if (period == null)
            {
                return NotFound(ApiResponse<object>.Fail("Không tìm thấy đợt bảo vệ.", 404));
            }

            var stateResult = await _getStateQuery.ExecuteAsync(periodId);
            if (!stateResult.Success || stateResult.Data == null)
            {
                return StatusCode(stateResult.HttpStatusCode == 0 ? 400 : stateResult.HttpStatusCode, ApiResponse<object>.Fail(stateResult.Message ?? "Không lấy được trạng thái đợt.", stateResult.HttpStatusCode == 0 ? 400 : stateResult.HttpStatusCode, stateResult.Errors, stateResult.Code));
            }

            var eligibleResult = await _getStudentsQuery.ExecuteAsync(periodId, true);
            if (!eligibleResult.Success || eligibleResult.Data == null)
            {
                return StatusCode(eligibleResult.HttpStatusCode == 0 ? 400 : eligibleResult.HttpStatusCode, ApiResponse<object>.Fail(eligibleResult.Message ?? "Không lấy được danh sách sinh viên đủ điều kiện.", eligibleResult.HttpStatusCode == 0 ? 400 : eligibleResult.HttpStatusCode, eligibleResult.Errors, eligibleResult.Code));
            }

            var capabilityResult = await _getLecturerCapabilitiesQuery.ExecuteAsync(periodId);
            if (!capabilityResult.Success || capabilityResult.Data == null)
            {
                return StatusCode(capabilityResult.HttpStatusCode == 0 ? 400 : capabilityResult.HttpStatusCode, ApiResponse<object>.Fail(capabilityResult.Message ?? "Không lấy được danh sách giảng viên theo đợt.", capabilityResult.HttpStatusCode == 0 ? 400 : capabilityResult.HttpStatusCode, capabilityResult.Errors, capabilityResult.Code));
            }

            var councilIds = await GetPeriodCouncilIdsAsync(period);
            var councilCount = councilIds.Count == 0
                ? 0
                : await _uow.Committees.Query().AsNoTracking().CountAsync(x => councilIds.Contains(x.CommitteeID));

            var assignmentIds = councilIds.Count == 0
                ? new List<int>()
                : await _uow.DefenseAssignments.Query().AsNoTracking()
                    .Where(x => x.CommitteeID.HasValue && councilIds.Contains(x.CommitteeID.Value))
                    .Select(x => x.AssignmentID)
                    .ToListAsync();

            var assignmentCount = assignmentIds.Count;

            var resultCount = assignmentIds.Count == 0
                ? 0
                : await _uow.DefenseResults.Query().AsNoTracking().CountAsync(x => assignmentIds.Contains(x.AssignmentId));

            var revisionCount = assignmentIds.Count == 0
                ? 0
                : await _uow.DefenseRevisions.Query().AsNoTracking().CountAsync(x => assignmentIds.Contains(x.AssignmentId));

            var assignedParticipants = await BuildAssignedStudentParticipantsAsync(periodId, councilIds);
            var assignedStudentCount = assignedParticipants
                .Where(x => !string.IsNullOrWhiteSpace(x.StudentCode))
                .Select(x => x.StudentCode)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Count();

            var assignedTopicCount = assignedParticipants
                .Where(x => !string.IsNullOrWhiteSpace(x.TopicCode))
                .Select(x => x.TopicCode)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Count();

            var assignedSupervisorCount = assignedParticipants
                .Where(x => !string.IsNullOrWhiteSpace(x.SupervisorCode))
                .Select(x => x.SupervisorCode)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Count();

            var eligibleStudentCount = eligibleResult.Data.Count;
            var eligibleSupervisorCount = eligibleResult.Data
                .Where(x => !string.IsNullOrWhiteSpace(x.SupervisorCode))
                .Select(x => x.SupervisorCode)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Count();

            var committeeLecturerRows = councilIds.Count == 0
                ? new List<string>()
                : await _uow.CommitteeMembers.Query().AsNoTracking()
                    .Where(x => x.CommitteeID.HasValue && councilIds.Contains(x.CommitteeID.Value) && x.MemberLecturerCode != null)
                    .Select(x => x.MemberLecturerCode!)
                    .ToListAsync();

            var committeeLecturerCount = committeeLecturerRows
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Count();

            var assignmentCoveragePercent = eligibleStudentCount == 0
                ? 0
                : Math.Round(Math.Min(100m, assignedStudentCount * 100m / eligibleStudentCount), 2);

            var dto = new DefensePeriodDashboardDto
            {
                DefenseTermId = period.DefenseTermId,
                Name = period.Name,
                StartDate = period.StartDate,
                EndDate = period.EndDate,
                Status = period.Status,
                LecturerCapabilitiesLocked = stateResult.Data.LecturerCapabilitiesLocked,
                CouncilConfigConfirmed = stateResult.Data.CouncilConfigConfirmed,
                Finalized = stateResult.Data.Finalized,
                ScoresPublished = stateResult.Data.ScoresPublished,
                EligibleStudentCount = eligibleStudentCount,
                EligibleSupervisorCount = eligibleSupervisorCount,
                AssignedStudentCount = assignedStudentCount,
                AssignedSupervisorCount = assignedSupervisorCount,
                AssignedTopicCount = assignedTopicCount,
                CapabilityLecturerCount = capabilityResult.Data.Count,
                CommitteeLecturerCount = committeeLecturerCount,
                CouncilCount = councilCount,
                AssignmentCount = assignmentCount,
                ResultCount = resultCount,
                RevisionCount = revisionCount,
                AssignmentCoveragePercent = assignmentCoveragePercent,
                AllowedActions = stateResult.Data.AllowedActions ?? new List<string>(),
                Warnings = stateResult.Data.Warnings ?? new List<string>()
            };

            return Ok(ApiResponse<DefensePeriodDashboardDto>.SuccessResponse(dto));
        }


        private async Task<ActionResult<ApiResponse<List<DefensePeriodStudentParticipantDto>>>> GetStudentParticipants(
            int periodId,
            [FromQuery] string source = "all",
            [FromQuery] string? keyword = null)
        {
            var period = await _uow.DefenseTerms.Query().AsNoTracking().FirstOrDefaultAsync(x => x.DefenseTermId == periodId);
            if (period == null)
            {
                return NotFound(ApiResponse<object>.Fail("Không tìm thấy đợt bảo vệ.", 404));
            }

            var normalizedSource = (source ?? "all").Trim().ToLowerInvariant();
            if (normalizedSource != "all" && normalizedSource != "eligible" && normalizedSource != "assigned")
            {
                return BadRequest(ApiResponse<object>.Fail("source ch? h? tr?: all, eligible, assigned.", 400));
            }

            var councilIds = await GetPeriodCouncilIdsAsync(period);

            var eligibleParticipants = new List<DefensePeriodStudentParticipantDto>();
            if (normalizedSource == "all" || normalizedSource == "eligible")
            {
                var eligibleResult = await _getStudentsQuery.ExecuteAsync(periodId, true);
                if (!eligibleResult.Success || eligibleResult.Data == null)
                {
                    return StatusCode(eligibleResult.HttpStatusCode == 0 ? 400 : eligibleResult.HttpStatusCode, ApiResponse<object>.Fail(eligibleResult.Message ?? "Không lấy được danh sách sinh viên đủ điều kiện.", eligibleResult.HttpStatusCode == 0 ? 400 : eligibleResult.HttpStatusCode, eligibleResult.Errors, eligibleResult.Code));
                }

                eligibleParticipants = eligibleResult.Data.Select(x => new DefensePeriodStudentParticipantDto
                {
                    StudentCode = x.StudentCode,
                    StudentName = x.StudentName,
                    TopicCode = null,
                    TopicTitle = x.TopicTitle,
                    SupervisorCode = x.SupervisorCode,
                    Tags = x.Tags?.ToList() ?? new List<string>(),
                    CommitteeId = null,
                    CommitteeCode = null,
                    AssignmentId = null,
                    Source = "ELIGIBLE_POOL",
                    IsEligible = x.IsEligible,
                    Valid = x.Valid,
                    Error = x.Error
                }).ToList();
            }

            var assignedParticipants = new List<DefensePeriodStudentParticipantDto>();
            if (normalizedSource == "all" || normalizedSource == "assigned")
            {
                assignedParticipants = await BuildAssignedStudentParticipantsAsync(periodId, councilIds);
            }

            List<DefensePeriodStudentParticipantDto> data;
            if (normalizedSource == "eligible")
            {
                data = eligibleParticipants;
            }
            else if (normalizedSource == "assigned")
            {
                data = assignedParticipants;
            }
            else
            {
                data = eligibleParticipants
                    .Concat(assignedParticipants)
                    .GroupBy(BuildStudentTopicKey, StringComparer.OrdinalIgnoreCase)
                    .Select(g => g.OrderByDescending(x => string.Equals(x.Source, "ASSIGNED", StringComparison.OrdinalIgnoreCase)).First())
                    .ToList();
            }

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                var normalizedKeyword = keyword.Trim().ToUpperInvariant();
                data = data.Where(x =>
                        (!string.IsNullOrWhiteSpace(x.StudentCode) && x.StudentCode.ToUpperInvariant().Contains(normalizedKeyword))
                        || (!string.IsNullOrWhiteSpace(x.StudentName) && x.StudentName.ToUpperInvariant().Contains(normalizedKeyword))
                        || (!string.IsNullOrWhiteSpace(x.TopicCode) && x.TopicCode.ToUpperInvariant().Contains(normalizedKeyword))
                        || (!string.IsNullOrWhiteSpace(x.TopicTitle) && x.TopicTitle.ToUpperInvariant().Contains(normalizedKeyword))
                        || (!string.IsNullOrWhiteSpace(x.SupervisorCode) && x.SupervisorCode.ToUpperInvariant().Contains(normalizedKeyword))
                    || (!string.IsNullOrWhiteSpace(x.CommitteeCode) && x.CommitteeCode.ToUpperInvariant().Contains(normalizedKeyword))
                    || x.Tags.Any(tag => tag.ToUpperInvariant().Contains(normalizedKeyword)))
                    .ToList();
            }

            data = data
                .OrderByDescending(x => string.Equals(x.Source, "ASSIGNED", StringComparison.OrdinalIgnoreCase))
                .ThenBy(x => x.StudentCode)
                .ThenBy(x => x.TopicCode ?? x.TopicTitle)
                .ToList();

            return Ok(ApiResponse<List<DefensePeriodStudentParticipantDto>>.SuccessResponse(data, totalCount: data.Count));
        }


        private async Task<ActionResult<ApiResponse<List<DefensePeriodLecturerParticipantDto>>>> GetLecturerParticipants(
            int periodId,
            [FromQuery] string source = "all",
            [FromQuery] string? keyword = null)
        {
            var period = await _uow.DefenseTerms.Query().AsNoTracking().FirstOrDefaultAsync(x => x.DefenseTermId == periodId);
            if (period == null)
            {
                return NotFound(ApiResponse<object>.Fail("Không tìm thấy đợt bảo vệ.", 404));
            }

            var normalizedSource = (source ?? "all").Trim().ToLowerInvariant();
            if (normalizedSource != "all" && normalizedSource != "capability" && normalizedSource != "committee" && normalizedSource != "supervisor")
            {
                return BadRequest(ApiResponse<object>.Fail("source ch? h? tr?: all, capability, committee, supervisor.", 400));
            }

            var capabilityResult = await _getLecturerCapabilitiesQuery.ExecuteAsync(periodId);
            if (!capabilityResult.Success || capabilityResult.Data == null)
            {
                return StatusCode(capabilityResult.HttpStatusCode == 0 ? 400 : capabilityResult.HttpStatusCode, ApiResponse<object>.Fail(capabilityResult.Message ?? "Không lấy được danh sách giảng viên theo đợt.", capabilityResult.HttpStatusCode == 0 ? 400 : capabilityResult.HttpStatusCode, capabilityResult.Errors, capabilityResult.Code));
            }

            var councilIds = await GetPeriodCouncilIdsAsync(period);
            var assignedStudents = await BuildAssignedStudentParticipantsAsync(periodId, councilIds);

            var supervisorMap = assignedStudents
                .Where(x => !string.IsNullOrWhiteSpace(x.SupervisorCode))
                .GroupBy(x => x.SupervisorCode!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.Count(), StringComparer.OrdinalIgnoreCase);

            var committeeRows = councilIds.Count == 0
                ? new List<(string LecturerCode, string Role, int CommitteeId)>()
                : (await _uow.CommitteeMembers.Query().AsNoTracking()
                    .Where(x => x.CommitteeID.HasValue && councilIds.Contains(x.CommitteeID.Value) && x.MemberLecturerCode != null)
                    .Select(x => new
                    {
                        LecturerCode = x.MemberLecturerCode!,
                        Role = x.Role ?? string.Empty,
                        CommitteeId = x.CommitteeID!.Value
                    })
                    .ToListAsync())
                    .Select(x => (x.LecturerCode, x.Role, x.CommitteeId))
                    .ToList();

            var lecturerCodes = capabilityResult.Data
                .Select(x => x.LecturerCode)
                .Concat(supervisorMap.Keys)
                .Concat(committeeRows.Select(x => x.LecturerCode))
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var lecturerNameMap = lecturerCodes.Count == 0
                ? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                : (await _uow.LecturerProfiles.Query().AsNoTracking()
                    .Where(x => lecturerCodes.Contains(x.LecturerCode))
                    .Select(x => new { x.LecturerCode, x.FullName })
                    .ToListAsync())
                    .ToDictionary(
                        x => x.LecturerCode,
                        x => string.IsNullOrWhiteSpace(x.FullName) ? x.LecturerCode : x.FullName!,
                        StringComparer.OrdinalIgnoreCase);

            var lecturerTagMap = await LoadLecturerTagMapAsync(lecturerCodes);

            var participants = new Dictionary<string, DefensePeriodLecturerParticipantDto>(StringComparer.OrdinalIgnoreCase);

            foreach (var capability in capabilityResult.Data)
            {
                if (string.IsNullOrWhiteSpace(capability.LecturerCode))
                {
                    continue;
                }

                participants[capability.LecturerCode] = new DefensePeriodLecturerParticipantDto
                {
                    LecturerCode = capability.LecturerCode,
                    LecturerName = capability.LecturerName,
                    Tags = capability.Tags?.ToList() ?? new List<string>(),
                    IsInCapabilityPool = true,
                    IsSupervisor = false,
                    IsCommitteeMember = false,
                    GuidedTopicCount = 0,
                    CommitteeCount = 0,
                    CommitteeRoles = new List<string>(),
                    Warnings = string.IsNullOrWhiteSpace(capability.Warning)
                        ? new List<string>()
                        : new List<string> { capability.Warning }
                };
            }

            foreach (var supervisor in supervisorMap)
            {
                if (!participants.TryGetValue(supervisor.Key, out var dto))
                {
                    dto = new DefensePeriodLecturerParticipantDto
                    {
                        LecturerCode = supervisor.Key,
                        LecturerName = lecturerNameMap.TryGetValue(supervisor.Key, out var name) ? name : supervisor.Key,
                        Tags = lecturerTagMap.TryGetValue(supervisor.Key, out var supervisorTags)
                            ? supervisorTags.OrderBy(x => x).ToList()
                            : new List<string>()
                    };
                    participants[supervisor.Key] = dto;
                }

                dto.IsSupervisor = true;
                dto.GuidedTopicCount = supervisor.Value;
            }

            foreach (var committeeGroup in committeeRows.GroupBy(x => x.LecturerCode, StringComparer.OrdinalIgnoreCase))
            {
                if (!participants.TryGetValue(committeeGroup.Key, out var dto))
                {
                    dto = new DefensePeriodLecturerParticipantDto
                    {
                        LecturerCode = committeeGroup.Key,
                        LecturerName = lecturerNameMap.TryGetValue(committeeGroup.Key, out var name) ? name : committeeGroup.Key,
                        Tags = lecturerTagMap.TryGetValue(committeeGroup.Key, out var committeeTags)
                            ? committeeTags.OrderBy(x => x).ToList()
                            : new List<string>()
                    };
                    participants[committeeGroup.Key] = dto;
                }

                dto.IsCommitteeMember = true;
                dto.CommitteeCount = committeeGroup.Select(x => x.CommitteeId).Distinct().Count();
                dto.CommitteeRoles = committeeGroup
                    .Select(x => string.IsNullOrWhiteSpace(x.Role) ? "N/A" : x.Role.Trim().ToUpperInvariant())
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(x => x)
                    .ToList();
            }

            foreach (var item in participants.Values)
            {
                if (string.IsNullOrWhiteSpace(item.LecturerName))
                {
                    item.LecturerName = lecturerNameMap.TryGetValue(item.LecturerCode, out var name)
                        ? name
                        : item.LecturerCode;
                }

                if (item.Tags.Count == 0 && lecturerTagMap.TryGetValue(item.LecturerCode, out var lecturerTags))
                {
                    item.Tags = lecturerTags.OrderBy(x => x).ToList();
                }
            }

            var data = participants.Values.AsEnumerable();
            data = normalizedSource switch
            {
                "capability" => data.Where(x => x.IsInCapabilityPool),
                "committee" => data.Where(x => x.IsCommitteeMember),
                "supervisor" => data.Where(x => x.IsSupervisor),
                _ => data
            };

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                var normalizedKeyword = keyword.Trim().ToUpperInvariant();
                data = data.Where(x =>
                    (!string.IsNullOrWhiteSpace(x.LecturerCode) && x.LecturerCode.ToUpperInvariant().Contains(normalizedKeyword))
                    || (!string.IsNullOrWhiteSpace(x.LecturerName) && x.LecturerName.ToUpperInvariant().Contains(normalizedKeyword))
                    || x.CommitteeRoles.Any(r => r.ToUpperInvariant().Contains(normalizedKeyword))
                    || x.Tags.Any(tag => tag.ToUpperInvariant().Contains(normalizedKeyword)));
            }

            var list = data
                .OrderBy(x => x.LecturerCode)
                .ToList();

            return Ok(ApiResponse<List<DefensePeriodLecturerParticipantDto>>.SuccessResponse(list, totalCount: list.Count));
        }


        private async Task<ActionResult<ApiResponse<DefensePeriodWorkflowSnapshotDto>>> GetWorkflowSnapshot(int periodId)
        {
            var period = await _uow.DefenseTerms.Query().AsNoTracking().FirstOrDefaultAsync(x => x.DefenseTermId == periodId);
            if (period == null)
            {
                return NotFound(ApiResponse<object>.Fail("Không tìm thấy đợt bảo vệ.", 404));
            }

            var stateResult = await _getStateQuery.ExecuteAsync(periodId);
            if (!stateResult.Success || stateResult.Data == null)
            {
                return StatusCode(stateResult.HttpStatusCode == 0 ? 400 : stateResult.HttpStatusCode, ApiResponse<object>.Fail(stateResult.Message ?? "Không lấy được trạng thái đợt.", stateResult.HttpStatusCode == 0 ? 400 : stateResult.HttpStatusCode, stateResult.Errors, stateResult.Code));
            }

            var configResult = await _getConfigQuery.ExecuteAsync(periodId);
            var configCompleted = configResult.Success
                && configResult.Data != null
                && configResult.Data.Rooms.Count > 0;

            var syncLogId = await _uow.SyncAuditLogs.Query().AsNoTracking()
                .Where(x => x.Records.Contains($"period={periodId}") && x.Action.Contains("SYNC") && x.Result.Contains("SUCCESS"))
                .Select(x => (int?)x.SyncAuditLogId)
                .FirstOrDefaultAsync();
            var syncCompleted = syncLogId.HasValue;

            var state = stateResult.Data;
            var isArchived = string.Equals(period.Status, "Archived", StringComparison.OrdinalIgnoreCase);

            var steps = new List<DefensePeriodWorkflowStepDto>
            {
                new()
                {
                    StepKey = "PERIOD_CREATED",
                    StepName = "Khởi tạo đợt",
                    Completed = true,
                    Enabled = false,
                    BlockedReason = null
                },
                new()
                {
                    StepKey = "PERIOD_CONFIGURED",
                    StepName = "Cấu hình đợt",
                    Completed = configCompleted,
                    Enabled = !state.Finalized && !isArchived,
                    BlockedReason = configCompleted ? null : "Cần khai báo phòng và khung giờ cho đợt."
                },
                new()
                {
                    StepKey = "SYNC_ELIGIBLE_INPUT",
                    StepName = "Đồng bộ danh sách đủ điều kiện",
                    Completed = syncCompleted,
                    Enabled = !state.Finalized && !isArchived,
                    BlockedReason = syncCompleted ? null : "Chưa thực hiện sync đầu vào UC1."
                },
                new()
                {
                    StepKey = "LOCK_LECTURER_CAPABILITIES",
                    StepName = "Khóa năng lực giảng viên",
                    Completed = state.LecturerCapabilitiesLocked,
                    Enabled = state.AllowedActions.Contains("LOCK_LECTURER_CAPABILITIES", StringComparer.OrdinalIgnoreCase),
                    BlockedReason = state.LecturerCapabilitiesLocked ? null : "Cần khóa năng lực giảng viên trước khi lập hội đồng."
                },
                new()
                {
                    StepKey = "CONFIRM_COUNCIL_CONFIG",
                    StepName = "Xác nhận cấu hình hội đồng",
                    Completed = state.CouncilConfigConfirmed,
                    Enabled = state.AllowedActions.Contains("CONFIRM_COUNCIL_CONFIG", StringComparer.OrdinalIgnoreCase),
                    BlockedReason = state.CouncilConfigConfirmed ? null : "Cần xác nhận cấu hình hội đồng UC2.1."
                },
                new()
                {
                    StepKey = "GENERATE_COUNCILS",
                    StepName = "Sinh/chỉnh hội đồng",
                    Completed = state.CouncilCount > 0,
                    Enabled = state.AllowedActions.Contains("GENERATE_COUNCILS", StringComparer.OrdinalIgnoreCase)
                        || state.AllowedActions.Contains("UPDATE_COUNCILS", StringComparer.OrdinalIgnoreCase),
                    BlockedReason = state.CouncilCount > 0 ? null : "Chưa có hội đồng trong đợt."
                },
                new()
                {
                    StepKey = "FINALIZE_PERIOD",
                    StepName = "Chốt danh sách bảo vệ",
                    Completed = state.Finalized,
                    Enabled = state.AllowedActions.Contains("FINALIZE", StringComparer.OrdinalIgnoreCase),
                    BlockedReason = state.Finalized ? null : "Cần có hội đồng hợp lệ trước khi finalize."
                },
                new()
                {
                    StepKey = "PUBLISH_SCORES",
                    StepName = "Công bố kết quả",
                    Completed = state.ScoresPublished,
                    Enabled = state.AllowedActions.Contains("PUBLISH", StringComparer.OrdinalIgnoreCase),
                    BlockedReason = state.ScoresPublished ? null : "Cần finalize trước khi publish điểm."
                },
                new()
                {
                    StepKey = "ARCHIVE_PERIOD",
                    StepName = "Đóng đợt",
                    Completed = isArchived,
                    Enabled = !isArchived && state.ScoresPublished,
                    BlockedReason = isArchived ? null : "Chỉ đóng đợt sau khi đã publish."
                }
            };

            var completionPercent = steps.Count == 0
                ? 0
                : (int)Math.Round(steps.Count(x => x.Completed) * 100m / steps.Count, MidpointRounding.AwayFromZero);

            var snapshot = new DefensePeriodWorkflowSnapshotDto
            {
                DefenseTermId = period.DefenseTermId,
                Name = period.Name,
                Status = period.Status,
                StartDate = period.StartDate,
                EndDate = period.EndDate,
                CompletionPercent = completionPercent,
                AllowedActions = state.AllowedActions ?? new List<string>(),
                Warnings = state.Warnings ?? new List<string>(),
                Steps = steps
            };

            return Ok(ApiResponse<DefensePeriodWorkflowSnapshotDto>.SuccessResponse(snapshot));
        }


        private async Task<ActionResult<ApiResponse<DefensePeriodStatusTransitionResponseDto>>> ArchivePeriod(int periodId, [FromBody] DefensePeriodArchiveRequestDto? request = null)
        {
            request ??= new DefensePeriodArchiveRequestDto();
            request.IdempotencyKey = string.IsNullOrWhiteSpace(request.IdempotencyKey)
                ? null
                : request.IdempotencyKey.Trim();

            var requestHash = ComputeLifecycleRequestHash(
                "ARCHIVE_PERIOD",
                periodId,
                request.ForceArchiveWithoutPublish,
                request.Reason ?? string.Empty);

            var replay = await TryGetLifecycleReplayAsync("ARCHIVE_PERIOD", periodId, request.IdempotencyKey, requestHash);
            if (replay != null)
            {
                return replay;
            }

            var period = await _uow.DefenseTerms.GetByIdAsync(periodId);
            if (period == null)
            {
                var notFound = ApiResponse<DefensePeriodStatusTransitionResponseDto>.Fail("Không tìm thấy đợt bảo vệ.", 404);
                await SaveLifecycleResponseAsync("ARCHIVE_PERIOD", periodId, request.IdempotencyKey, requestHash, notFound);
                return NotFound(notFound);
            }

            var beforeStatus = period.Status;
            if (string.Equals(beforeStatus, "Archived", StringComparison.OrdinalIgnoreCase))
            {
                var alreadyArchived = ApiResponse<DefensePeriodStatusTransitionResponseDto>.SuccessResponse(new DefensePeriodStatusTransitionResponseDto
                {
                    DefenseTermId = periodId,
                    StatusBefore = beforeStatus,
                    StatusAfter = beforeStatus,
                    Reason = request.Reason,
                    ChangedAt = DateTime.UtcNow
                });
                await SaveLifecycleResponseAsync("ARCHIVE_PERIOD", periodId, request.IdempotencyKey, requestHash, alreadyArchived);
                return Ok(alreadyArchived);
            }

            var stateResult = await _getStateQuery.ExecuteAsync(periodId);
            if (!stateResult.Success || stateResult.Data == null)
            {
                var stateFailure = ApiResponse<DefensePeriodStatusTransitionResponseDto>.Fail(
                    stateResult.Message ?? "Không lấy được trạng thái đợt.",
                    stateResult.HttpStatusCode == 0 ? 400 : stateResult.HttpStatusCode,
                    stateResult.Errors,
                    stateResult.Code,
                    stateResult.Warnings,
                    stateResult.AllowedActions);

                await SaveLifecycleResponseAsync("ARCHIVE_PERIOD", periodId, request.IdempotencyKey, requestHash, stateFailure);
                return StatusCode(stateFailure.HttpStatusCode, stateFailure);
            }

            if (!request.ForceArchiveWithoutPublish && !stateResult.Data.ScoresPublished)
            {
                var conflict = ApiResponse<DefensePeriodStatusTransitionResponseDto>.Fail(
                    "Chỉ được đóng đợt sau khi đã publish điểm. Có thể dùng ForceArchiveWithoutPublish nếu được phân quyền nội bộ.",
                    409);

                await SaveLifecycleResponseAsync("ARCHIVE_PERIOD", periodId, request.IdempotencyKey, requestHash, conflict);
                return Conflict(conflict);
            }

            var now = DateTime.UtcNow;
            period.Status = "Archived";
            period.LastUpdated = now;
            _uow.DefenseTerms.Update(period);

            await _uow.SyncAuditLogs.AddAsync(new Models.SyncAuditLog
            {
                Action = "ARCHIVE_PERIOD",
                Result = "SUCCESS",
                Records = $"period={periodId};before={beforeStatus};after=Archived;reason={request.Reason ?? string.Empty};force={request.ForceArchiveWithoutPublish}",
                Timestamp = now
            });

            await _uow.SaveChangesAsync();

            var response = ApiResponse<DefensePeriodStatusTransitionResponseDto>.SuccessResponse(new DefensePeriodStatusTransitionResponseDto
            {
                DefenseTermId = periodId,
                StatusBefore = beforeStatus,
                StatusAfter = period.Status,
                Reason = request.Reason,
                ChangedAt = now
            });

            await SaveLifecycleResponseAsync("ARCHIVE_PERIOD", periodId, request.IdempotencyKey, requestHash, response);
            return Ok(response);
        }


        private async Task<ActionResult<ApiResponse<DefensePeriodStatusTransitionResponseDto>>> ReopenPeriod(int periodId, [FromBody] DefensePeriodReopenRequestDto? request = null)
        {
            request ??= new DefensePeriodReopenRequestDto();
            request.IdempotencyKey = string.IsNullOrWhiteSpace(request.IdempotencyKey)
                ? null
                : request.IdempotencyKey.Trim();

            var requestHash = ComputeLifecycleRequestHash(
                "REOPEN_PERIOD",
                periodId,
                request.Reason ?? string.Empty);

            var replay = await TryGetLifecycleReplayAsync("REOPEN_PERIOD", periodId, request.IdempotencyKey, requestHash);
            if (replay != null)
            {
                return replay;
            }

            var period = await _uow.DefenseTerms.GetByIdAsync(periodId);
            if (period == null)
            {
                var notFound = ApiResponse<DefensePeriodStatusTransitionResponseDto>.Fail("Không tìm thấy đợt bảo vệ.", 404);
                await SaveLifecycleResponseAsync("REOPEN_PERIOD", periodId, request.IdempotencyKey, requestHash, notFound);
                return NotFound(notFound);
            }

            var beforeStatus = period.Status;
            if (!string.Equals(beforeStatus, "Archived", StringComparison.OrdinalIgnoreCase))
            {
                var conflict = ApiResponse<DefensePeriodStatusTransitionResponseDto>.Fail("Chỉ có thể mở lại khi đợt đang ở trạng thái Archived.", 409);
                await SaveLifecycleResponseAsync("REOPEN_PERIOD", periodId, request.IdempotencyKey, requestHash, conflict);
                return Conflict(conflict);
            }

            var now = DateTime.UtcNow;
            period.Status = "Preparing";
            period.LastUpdated = now;
            _uow.DefenseTerms.Update(period);

            await _uow.SyncAuditLogs.AddAsync(new Models.SyncAuditLog
            {
                Action = "REOPEN_PERIOD",
                Result = "SUCCESS",
                Records = $"period={periodId};before={beforeStatus};after=Preparing;reason={request.Reason ?? string.Empty}",
                Timestamp = now
            });

            await _uow.SaveChangesAsync();

            var response = ApiResponse<DefensePeriodStatusTransitionResponseDto>.SuccessResponse(new DefensePeriodStatusTransitionResponseDto
            {
                DefenseTermId = periodId,
                StatusBefore = beforeStatus,
                StatusAfter = period.Status,
                Reason = request.Reason,
                ChangedAt = now
            });

            await SaveLifecycleResponseAsync("REOPEN_PERIOD", periodId, request.IdempotencyKey, requestHash, response);
            return Ok(response);
        }


        private async Task<ActionResult<ApiResponse<DefensePeriodPipelineOverviewDto>>> GetE2EPipeline(int periodId)
        {
            var period = await _uow.DefenseTerms.Query().AsNoTracking().FirstOrDefaultAsync(x => x.DefenseTermId == periodId);
            if (period == null)
            {
                return NotFound(ApiResponse<object>.Fail("Không tìm thấy đợt bảo vệ.", 404));
            }

            var stateResult = await _getStateQuery.ExecuteAsync(periodId);
            if (!stateResult.Success || stateResult.Data == null)
            {
                return StatusCode(
                    stateResult.HttpStatusCode == 0 ? 400 : stateResult.HttpStatusCode,
                    ApiResponse<object>.Fail(
                        stateResult.Message ?? "Không lấy được trạng thái đợt.",
                        stateResult.HttpStatusCode == 0 ? 400 : stateResult.HttpStatusCode,
                        stateResult.Errors,
                        stateResult.Code));
            }

            var context = await BuildPeriodPipelineContextAsync(period);
            var registrationItems = await BuildRegistrationItemsAsync(context);

            var totalTopics = registrationItems.Count;
            var eligibleTopics = registrationItems.Count(x => x.IsEligibleForDefense);
            var assignedTopics = registrationItems.Count(x => x.IsAssignedToCouncil);
            var scoredTopics = registrationItems.Count(x => x.HasScoringResult);

            var milestoneCount = context.Milestones.Count;
            var completedMilestoneCount = context.Milestones.Count(HasCompletedMilestone);

            var revisionTotal = context.Revisions.Count;
            var pendingRevisionCount = context.Revisions.Count(x => x.FinalStatus == Models.RevisionFinalStatus.Pending);
            var approvedRevisionCount = context.Revisions.Count(x => x.FinalStatus == Models.RevisionFinalStatus.Approved);
            var rejectedRevisionCount = context.Revisions.Count(x => x.FinalStatus == Models.RevisionFinalStatus.Rejected);

            var state = stateResult.Data;

            var stageRegistrationBlocked = totalTopics > 0 && eligibleTopics == 0;
            var stageProgressBlocked = totalTopics > 0 && milestoneCount == 0;

            var councilBlockedReasons = new List<string>();
            if (!state.LecturerCapabilitiesLocked)
            {
                councilBlockedReasons.Add("Cần lock năng lực giảng viên trước khi lập hội đồng.");
            }

            if (!state.CouncilConfigConfirmed)
            {
                councilBlockedReasons.Add("Cần xác nhận cấu hình hội đồng trước khi phân bổ.");
            }

            var stageCouncilBlocked = councilBlockedReasons.Count > 0;
            var stageDefenseBlocked = !state.Finalized;
            var stagePostDefenseBlocked = !state.ScoresPublished;

            var stages = new List<DefensePeriodPipelineStageDto>
            {
                new()
                {
                    Sequence = 1,
                    StageKey = "REGISTRATION",
                    StageName = "Đăng ký đề tài",
                    TotalCount = totalTopics,
                    CompletedCount = eligibleTopics,
                    CompletionPercent = CalculateCompletionPercent(totalTopics, eligibleTopics),
                    Status = ResolvePipelineStageStatus(totalTopics, eligibleTopics, stageRegistrationBlocked),
                    BlockedReason = stageRegistrationBlocked ? "Chưa có đề tài đủ điều kiện theo pool sinh viên/giảng viên và milestone." : null
                },
                new()
                {
                    Sequence = 2,
                    StageKey = "PROGRESS_TRACKING",
                    StageName = "Theo dõi tiến độ",
                    TotalCount = milestoneCount,
                    CompletedCount = completedMilestoneCount,
                    CompletionPercent = CalculateCompletionPercent(milestoneCount, completedMilestoneCount),
                    Status = ResolvePipelineStageStatus(milestoneCount, completedMilestoneCount, stageProgressBlocked),
                    BlockedReason = stageProgressBlocked ? "Chưa khởi tạo milestone cho đề tài trong đợt." : null
                },
                new()
                {
                    Sequence = 3,
                    StageKey = "COUNCIL_SETUP",
                    StageName = "Thiết lập hội đồng",
                    TotalCount = eligibleTopics,
                    CompletedCount = assignedTopics,
                    CompletionPercent = CalculateCompletionPercent(eligibleTopics, assignedTopics),
                    Status = ResolvePipelineStageStatus(eligibleTopics, assignedTopics, stageCouncilBlocked),
                    BlockedReason = stageCouncilBlocked ? string.Join(" ", councilBlockedReasons) : null
                },
                new()
                {
                    Sequence = 4,
                    StageKey = "DEFENSE_SCORING",
                    StageName = "Bảo vệ và chấm điểm",
                    TotalCount = assignedTopics,
                    CompletedCount = scoredTopics,
                    CompletionPercent = CalculateCompletionPercent(assignedTopics, scoredTopics),
                    Status = ResolvePipelineStageStatus(assignedTopics, scoredTopics, stageDefenseBlocked),
                    BlockedReason = stageDefenseBlocked ? "Cần finalize đợt trước khi chấm điểm và khóa kết quả." : null
                },
                new()
                {
                    Sequence = 5,
                    StageKey = "POST_DEFENSE",
                    StageName = "Hậu bảo vệ",
                    TotalCount = revisionTotal,
                    CompletedCount = approvedRevisionCount + rejectedRevisionCount,
                    CompletionPercent = CalculateCompletionPercent(revisionTotal, approvedRevisionCount + rejectedRevisionCount),
                    Status = ResolvePipelineStageStatus(revisionTotal, approvedRevisionCount + rejectedRevisionCount, stagePostDefenseBlocked),
                    BlockedReason = stagePostDefenseBlocked ? "Cần publish điểm trước khi đóng toàn bộ nghiệp vụ hậu bảo vệ." : null
                }
            };

            var overallCompletionPercent = stages.Count == 0
                ? 0
                : (int)Math.Round(stages.Average(x => x.CompletionPercent), MidpointRounding.AwayFromZero);

            var dto = new DefensePeriodPipelineOverviewDto
            {
                DefenseTermId = period.DefenseTermId,
                Name = period.Name,
                Status = period.Status,
                StartDate = period.StartDate,
                EndDate = period.EndDate,
                OverallCompletionPercent = overallCompletionPercent,
                TotalTopics = totalTopics,
                EligibleTopics = eligibleTopics,
                AssignedTopics = assignedTopics,
                ScoredTopics = scoredTopics,
                PendingRevisionCount = pendingRevisionCount,
                ApprovedRevisionCount = approvedRevisionCount,
                RejectedRevisionCount = rejectedRevisionCount,
                AllowedActions = state.AllowedActions ?? new List<string>(),
                Warnings = state.Warnings ?? new List<string>(),
                Stages = stages
            };

            return Ok(ApiResponse<DefensePeriodPipelineOverviewDto>.SuccessResponse(dto));
        }


        private async Task<ActionResult<ApiResponse<DefensePeriodRegistrationOverviewDto>>> GetRegistrationTopics(
            int periodId,
            [FromQuery] string? keyword = null,
            [FromQuery] bool onlyEligible = false,
            [FromQuery] bool onlyUnassigned = false,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            var period = await _uow.DefenseTerms.Query().AsNoTracking().FirstOrDefaultAsync(x => x.DefenseTermId == periodId);
            if (period == null)
            {
                return NotFound(ApiResponse<object>.Fail("Không tìm thấy đợt bảo vệ.", 404));
            }

            var context = await BuildPeriodPipelineContextAsync(period);
            var items = await BuildRegistrationItemsAsync(context);

            var totalTopics = items.Count;
            var eligibleTopics = items.Count(x => x.IsEligibleForDefense);
            var missingStudentCount = items.Count(x => string.IsNullOrWhiteSpace(x.StudentCode));
            var missingSupervisorCount = items.Count(x => string.IsNullOrWhiteSpace(x.SupervisorCode));
            var assignedTopics = items.Count(x => x.IsAssignedToCouncil);
            var unassignedEligibleTopics = items.Count(x => x.IsEligibleForDefense && !x.IsAssignedToCouncil);
            var assignmentCoveragePercent = eligibleTopics == 0
                ? 0
                : Math.Round(assignedTopics * 100m / eligibleTopics, 2);

            IEnumerable<DefensePeriodRegistrationTopicItemDto> filtered = items;

            if (onlyEligible)
            {
                filtered = filtered.Where(x => x.IsEligibleForDefense);
            }

            if (onlyUnassigned)
            {
                filtered = filtered.Where(x => !x.IsAssignedToCouncil);
            }

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                var normalizedKeyword = keyword.Trim().ToUpperInvariant();
                filtered = filtered.Where(x =>
                    x.TopicCode.ToUpperInvariant().Contains(normalizedKeyword)
                    || x.TopicTitle.ToUpperInvariant().Contains(normalizedKeyword)
                    || (!string.IsNullOrWhiteSpace(x.StudentCode) && x.StudentCode.ToUpperInvariant().Contains(normalizedKeyword))
                    || x.StudentName.ToUpperInvariant().Contains(normalizedKeyword)
                    || (!string.IsNullOrWhiteSpace(x.SupervisorCode) && x.SupervisorCode.ToUpperInvariant().Contains(normalizedKeyword))
                    || x.SupervisorName.ToUpperInvariant().Contains(normalizedKeyword)
                        || (!string.IsNullOrWhiteSpace(x.CommitteeCode) && x.CommitteeCode.ToUpperInvariant().Contains(normalizedKeyword))
                        || x.Tags.Any(tag => tag.ToUpperInvariant().Contains(normalizedKeyword)));
            }

            var filteredList = filtered
                .OrderByDescending(x => x.IsEligibleForDefense)
                .ThenByDescending(x => x.IsAssignedToCouncil)
                .ThenBy(x => x.TopicCode)
                .ToList();

            var safePage = Math.Max(page, 1);
            var safePageSize = Math.Clamp(pageSize, 1, 200);
            var pagedItems = filteredList
                .Skip((safePage - 1) * safePageSize)
                .Take(safePageSize)
                .ToList();

            var dto = new DefensePeriodRegistrationOverviewDto
            {
                DefenseTermId = periodId,
                TotalTopics = totalTopics,
                EligibleTopics = eligibleTopics,
                MissingStudentCount = missingStudentCount,
                MissingSupervisorCount = missingSupervisorCount,
                AssignedTopics = assignedTopics,
                UnassignedEligibleTopics = unassignedEligibleTopics,
                AssignmentCoveragePercent = assignmentCoveragePercent,
                Items = pagedItems
            };

            return Ok(ApiResponse<DefensePeriodRegistrationOverviewDto>.SuccessResponse(dto, filteredList.Count));
        }


        private async Task<ActionResult<ApiResponse<DefensePeriodProgressOverviewDto>>> GetProgressPipeline(int periodId)
        {
            var period = await _uow.DefenseTerms.Query().AsNoTracking().FirstOrDefaultAsync(x => x.DefenseTermId == periodId);
            if (period == null)
            {
                return NotFound(ApiResponse<object>.Fail("Không tìm thấy đợt bảo vệ.", 404));
            }

            var context = await BuildPeriodPipelineContextAsync(period);

            var milestoneCount = context.Milestones.Count;
            var completedMilestoneCount = context.Milestones.Count(HasCompletedMilestone);
            var ongoingMilestoneCount = context.Milestones.Count(IsOngoingMilestone);
            var overdueMilestoneCount = context.Milestones.Count(x => x.Deadline.HasValue && x.Deadline.Value.Date < DateTime.UtcNow.Date && !HasCompletedMilestone(x));

            var submissionCount = context.Submissions.Count;
            var lecturerReviewedSubmissionCount = context.Submissions.Count(x => !string.IsNullOrWhiteSpace(x.LecturerState));

            var stateBreakdown = context.Milestones
                .GroupBy(x => string.IsNullOrWhiteSpace(x.State) ? "Unknown" : x.State.Trim(), StringComparer.OrdinalIgnoreCase)
                .Select(g => new DefensePeriodProgressMilestoneStateCountDto
                {
                    State = g.Key,
                    Count = g.Count()
                })
                .OrderByDescending(x => x.Count)
                .ThenBy(x => x.State)
                .ToList();

            var dto = new DefensePeriodProgressOverviewDto
            {
                DefenseTermId = periodId,
                TopicCount = context.Topics.Count,
                MilestoneCount = milestoneCount,
                CompletedMilestoneCount = completedMilestoneCount,
                OngoingMilestoneCount = ongoingMilestoneCount,
                OverdueMilestoneCount = overdueMilestoneCount,
                SubmissionCount = submissionCount,
                LecturerReviewedSubmissionCount = lecturerReviewedSubmissionCount,
                MilestoneStates = stateBreakdown
            };

            return Ok(ApiResponse<DefensePeriodProgressOverviewDto>.SuccessResponse(dto));
        }


        private async Task<ActionResult<ApiResponse<DefensePeriodPostDefenseOverviewDto>>> GetPostDefensePipeline(
            int periodId,
            [FromQuery] string? status = null,
            [FromQuery] string? keyword = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            var period = await _uow.DefenseTerms.Query().AsNoTracking().FirstOrDefaultAsync(x => x.DefenseTermId == periodId);
            if (period == null)
            {
                return NotFound(ApiResponse<object>.Fail("Không tìm thấy đợt bảo vệ.", 404));
            }

            var normalizedStatus = string.IsNullOrWhiteSpace(status) ? "all" : status.Trim().ToLowerInvariant();
            if (normalizedStatus != "all" && normalizedStatus != "pending" && normalizedStatus != "approved" && normalizedStatus != "rejected")
            {
                return BadRequest(ApiResponse<object>.Fail("status chỉ hỗ trợ: all, pending, approved, rejected.", 400));
            }

            var context = await BuildPeriodPipelineContextAsync(period);
            var assignmentById = context.Assignments.ToDictionary(x => x.AssignmentID, x => x);
            var topicByCode = context.Topics
                .Where(x => !string.IsNullOrWhiteSpace(x.TopicCode))
                .GroupBy(x => x.TopicCode, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.LastUpdated ?? x.CreatedAt).First(), StringComparer.OrdinalIgnoreCase);

            var studentCodes = topicByCode.Values
                .Where(x => !string.IsNullOrWhiteSpace(x.ProposerStudentCode))
                .Select(x => x.ProposerStudentCode!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var studentNameMap = studentCodes.Count == 0
                ? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                : (await _uow.StudentProfiles.Query().AsNoTracking()
                    .Where(x => studentCodes.Contains(x.StudentCode))
                    .Select(x => new { x.StudentCode, x.FullName })
                    .ToListAsync())
                    .ToDictionary(
                        x => x.StudentCode,
                        x => string.IsNullOrWhiteSpace(x.FullName) ? x.StudentCode : x.FullName!,
                        StringComparer.OrdinalIgnoreCase);

            var rows = context.Revisions
                .Select(revision =>
                {
                    assignmentById.TryGetValue(revision.AssignmentId, out var assignment);

                    Models.Topic? topic = null;
                    if (!string.IsNullOrWhiteSpace(assignment?.TopicCode))
                    {
                        topicByCode.TryGetValue(assignment.TopicCode, out topic);
                    }

                    var studentCode = topic?.ProposerStudentCode ?? string.Empty;
                    var studentName = string.IsNullOrWhiteSpace(studentCode)
                        ? string.Empty
                        : (studentNameMap.TryGetValue(studentCode, out var foundName) ? foundName : studentCode);

                    return new DefensePeriodPostDefenseRevisionItemDto
                    {
                        RevisionId = revision.Id,
                        AssignmentId = revision.AssignmentId,
                        TopicCode = assignment?.TopicCode ?? string.Empty,
                        TopicTitle = topic?.Title ?? string.Empty,
                        StudentCode = studentCode,
                        StudentName = studentName,
                        FinalStatus = revision.FinalStatus.ToString().ToUpperInvariant(),
                        IsGvhdApproved = revision.IsGvhdApproved,
                        IsUvtkApproved = revision.IsUvtkApproved,
                        IsCtApproved = revision.IsCtApproved,
                        LastUpdated = revision.LastUpdated
                    };
                })
                .ToList();

            IEnumerable<DefensePeriodPostDefenseRevisionItemDto> filtered = rows;
            filtered = normalizedStatus switch
            {
                "pending" => filtered.Where(x => x.FinalStatus == "PENDING"),
                "approved" => filtered.Where(x => x.FinalStatus == "APPROVED"),
                "rejected" => filtered.Where(x => x.FinalStatus == "REJECTED"),
                _ => filtered
            };

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                var normalizedKeyword = keyword.Trim().ToUpperInvariant();
                filtered = filtered.Where(x =>
                    x.TopicCode.ToUpperInvariant().Contains(normalizedKeyword)
                    || x.TopicTitle.ToUpperInvariant().Contains(normalizedKeyword)
                    || x.StudentCode.ToUpperInvariant().Contains(normalizedKeyword)
                    || x.StudentName.ToUpperInvariant().Contains(normalizedKeyword));
            }

            var filteredList = filtered
                .OrderByDescending(x => x.LastUpdated)
                .ThenByDescending(x => x.RevisionId)
                .ToList();

            var safePage = Math.Max(page, 1);
            var safePageSize = Math.Clamp(pageSize, 1, 200);
            var pagedItems = filteredList
                .Skip((safePage - 1) * safePageSize)
                .Take(safePageSize)
                .ToList();

            var publishedScores = context.Results.Count(x => HasScoringData(x));
            var lockedScores = context.Results.Count(x => x.IsLocked);

            var dto = new DefensePeriodPostDefenseOverviewDto
            {
                DefenseTermId = periodId,
                TotalRevisions = rows.Count,
                PendingRevisions = rows.Count(x => x.FinalStatus == "PENDING"),
                ApprovedRevisions = rows.Count(x => x.FinalStatus == "APPROVED"),
                RejectedRevisions = rows.Count(x => x.FinalStatus == "REJECTED"),
                PublishedScores = publishedScores,
                LockedScores = lockedScores,
                Items = pagedItems
            };

            return Ok(ApiResponse<DefensePeriodPostDefenseOverviewDto>.SuccessResponse(dto, filteredList.Count));
        }


        private async Task<ActionResult<ApiResponse<SyncDefensePeriodResponseDto>>> Sync(int periodId, [FromBody] SyncDefensePeriodRequestDto request, [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey = null)
        {
            request.IdempotencyKey ??= idempotencyKey;
            var result = await _syncCommand.ExecuteAsync(periodId, request, CurrentUserId);
            await AttachPeriodStateMetadataAsync(periodId, result);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<List<EligibleStudentDto>>>> GetStudents(int periodId, [FromQuery] bool eligible = true)
        {
            var result = await _getStudentsQuery.ExecuteAsync(periodId, eligible);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<DefensePeriodConfigDto>>> GetConfig(int periodId)
        {
            var result = await _getConfigQuery.ExecuteAsync(periodId);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<DefensePeriodStateDto>>> GetState(int periodId)
        {
            var result = await _getStateQuery.ExecuteAsync(periodId);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<RollbackAvailabilityDto>>> GetRollbackAvailability(int periodId)
        {
            var result = await _getRollbackAvailabilityQuery.ExecuteAsync(periodId);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<List<SyncErrorDetailDto>>>> GetSyncErrors(int periodId)
        {
            var result = await _getSyncErrorsQuery.ExecuteAsync(periodId);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<List<CouncilAuditHistoryDto>>>> GetSyncHistory(int periodId, [FromQuery] int size = 100)
        {
            var limit = Math.Clamp(size, 1, 500);
            var periodToken = $"period={periodId}";
            var rows = await _uow.SyncAuditLogs.Query().AsNoTracking()
                .Where(x => x.Records.Contains(periodToken) || x.Action.Contains("SYNC"))
                .OrderByDescending(x => x.Timestamp)
                .Take(limit)
                .Select(x => new CouncilAuditHistoryDto
                {
                    SyncAuditLogId = x.SyncAuditLogId,
                    Action = x.Action,
                    Result = x.Result,
                    Records = x.Records,
                    Timestamp = x.Timestamp
                })
                .ToListAsync();

            return Ok(ApiResponse<List<CouncilAuditHistoryDto>>.SuccessResponse(rows, code: "UC1.SYNC_HISTORY.SUCCESS"));
        }


        private async Task<IActionResult> ExportSyncErrors(int periodId, [FromQuery] string format = "csv")
        {
            var result = await _exportSyncErrorsQuery.ExecuteAsync(periodId, format);
            if (!result.Success)
            {
                return StatusCode(result.HttpStatusCode == 0 ? 400 : result.HttpStatusCode, result);
            }

            return File(result.Data.Content, result.Data.ContentType, result.Data.FileName);
        }


        private async Task<ActionResult<ApiResponse<List<LecturerCapabilityDto>>>> GetLecturerCapabilities(int periodId)
        {
            var result = await _getLecturerCapabilitiesQuery.ExecuteAsync(periodId);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<bool>>> UpdateConfig(int periodId, [FromBody] UpdateDefensePeriodConfigDto request)
        {
            var result = await _updateConfigCommand.ExecuteAsync(periodId, request, CurrentUserId);
            await AttachPeriodStateMetadataAsync(periodId, result);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<bool>>> LockLecturerCapabilities(int periodId)
        {
            var result = await _lockCapabilitiesCommand.ExecuteAsync(periodId, CurrentUserId);
            await AttachPeriodStateMetadataAsync(periodId, result);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<bool>>> ConfirmCouncilConfig(int periodId, [FromBody] ConfirmCouncilConfigDto request)
        {
            var result = await _confirmCouncilConfigCommand.ExecuteAsync(periodId, request, CurrentUserId);
            await AttachPeriodStateMetadataAsync(periodId, result);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<List<CouncilDraftDto>>>> GenerateCouncils(int periodId, [FromBody] GenerateCouncilsRequestDto request, [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey = null)
        {
            request.IdempotencyKey ??= idempotencyKey;
            var result = await _generateCouncilsCommand.ExecuteAsync(periodId, request, CurrentUserId);
            await AttachPeriodStateMetadataAsync(periodId, result);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<AutoGenerateConfigDto>>> GetAutoGenerateConfig(int periodId)
        {
            var configResult = await _getConfigQuery.ExecuteAsync(periodId);
            if (!configResult.Success || configResult.Data == null)
            {
                return StatusCode(configResult.HttpStatusCode == 0 ? 400 : configResult.HttpStatusCode, ApiResponse<AutoGenerateConfigDto>.Fail(configResult.Message ?? "Không lấy được cấu hình.", configResult.HttpStatusCode == 0 ? 400 : configResult.HttpStatusCode, configResult.Errors, code: configResult.Code));
            }

            var stateResult = await _getStateQuery.ExecuteAsync(periodId);
            if (!stateResult.Success || stateResult.Data == null)
            {
                return StatusCode(stateResult.HttpStatusCode == 0 ? 400 : stateResult.HttpStatusCode, ApiResponse<AutoGenerateConfigDto>.Fail(stateResult.Message ?? "Không lấy được trạng thái.", stateResult.HttpStatusCode == 0 ? 400 : stateResult.HttpStatusCode, stateResult.Errors, code: stateResult.Code));
            }

            var roomCodes = await LoadRoomCodesForAutoGenerateAsync(CancellationToken.None);
            var availableRooms = roomCodes.Count > 0 ? roomCodes : configResult.Data.Rooms;

            var canGenerate = stateResult.Data.LecturerCapabilitiesLocked
                && stateResult.Data.CouncilConfigConfirmed
                && !stateResult.Data.Finalized
                && availableRooms.Count > 0;

            var warnings = new List<string>();
            if (!stateResult.Data.LecturerCapabilitiesLocked)
            {
                warnings.Add("UC2.READINESS.LECTURER_CAPABILITIES_UNLOCKED");
            }

            if (!stateResult.Data.CouncilConfigConfirmed)
            {
                warnings.Add("UC2.READINESS.COUNCIL_CONFIG_NOT_CONFIRMED");
            }

            if (stateResult.Data.Finalized)
            {
                warnings.Add("UC2.READINESS.PERIOD_FINALIZED");
            }

            if (availableRooms.Count == 0)
            {
                warnings.Add("UC2.READINESS.NO_ROOMS_AVAILABLE");
            }

            var response = new AutoGenerateConfigDto
            {
                AvailableRooms = availableRooms,
                DefaultSelectedRooms = availableRooms,
                SoftMaxCapacity = configResult.Data.SoftMaxCapacity,
                TopicsPerSession = configResult.Data.TopicsPerSessionConfig,
                MembersPerCouncil = configResult.Data.MembersPerCouncilConfig,
                LecturerCapabilitiesLocked = stateResult.Data.LecturerCapabilitiesLocked,
                CouncilConfigConfirmed = stateResult.Data.CouncilConfigConfirmed,
                Finalized = stateResult.Data.Finalized,
                ScoresPublished = stateResult.Data.ScoresPublished,
                CanGenerate = canGenerate,
                Warnings = warnings,
                DefaultHeuristicWeights = new GenerateCouncilHeuristicWeightsDto
                {
                    TagMatchWeight = 0.50m,
                    WorkloadWeight = 0.20m,
                    FairnessWeight = 0.15m,
                    ConsecutiveCommitteePenaltyWeight = 0.20m
                }
            };

            return Ok(ApiResponse<AutoGenerateConfigDto>.SuccessResponse(
                response,
                code: "UC2.AUTO_GENERATE.CONFIG.SUCCESS",
                warnings: warnings.Select(x => new ApiWarning { Type = "soft", Code = x, Message = x }).ToList(),
                allowedActions: stateResult.Data.AllowedActions));
        }


        private async Task<ActionResult<ApiResponse<AutoGenerateSimulationResultDto>>> SimulateAutoGenerate(int periodId, [FromBody] GenerateCouncilsRequestDto request)
        {
            var configResult = await _getConfigQuery.ExecuteAsync(periodId);
            if (!configResult.Success || configResult.Data == null)
            {
                return StatusCode(configResult.HttpStatusCode == 0 ? 400 : configResult.HttpStatusCode, ApiResponse<AutoGenerateSimulationResultDto>.Fail(configResult.Message ?? "Không lấy được cấu hình.", configResult.HttpStatusCode == 0 ? 400 : configResult.HttpStatusCode, configResult.Errors, code: configResult.Code));
            }

            var stateResult = await _getStateQuery.ExecuteAsync(periodId);
            if (!stateResult.Success || stateResult.Data == null)
            {
                return StatusCode(stateResult.HttpStatusCode == 0 ? 400 : stateResult.HttpStatusCode, ApiResponse<AutoGenerateSimulationResultDto>.Fail(stateResult.Message ?? "Không lấy được trạng thái.", stateResult.HttpStatusCode == 0 ? 400 : stateResult.HttpStatusCode, stateResult.Errors, code: stateResult.Code));
            }

            var period = await _uow.DefenseTerms.Query().AsNoTracking().FirstOrDefaultAsync(x => x.DefenseTermId == periodId);
            if (period == null)
            {
                return NotFound(ApiResponse<AutoGenerateSimulationResultDto>.Fail("Không tìm thấy đợt bảo vệ.", 404));
            }

            var periodStart = period.StartDate.Date;
            var periodEnd = (period.EndDate ?? period.StartDate).Date;
            if (periodEnd < periodStart)
            {
                periodEnd = periodStart;
            }

            var periodDayCount = (periodEnd - periodStart).Days + 1;

            var selectedRooms = request.SelectedRooms
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (selectedRooms.Count == 0)
            {
                var dbRooms = await LoadRoomCodesForAutoGenerateAsync(CancellationToken.None);
                selectedRooms = dbRooms.Count > 0 ? dbRooms : configResult.Data.Rooms;
            }

            var selectedTopicCodes = request.SelectedTopicCodes
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var selectedLecturerCodes = request.SelectedLecturerCodes
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var scopedStudentCodes = await _uow.DefenseTermStudents.Query().AsNoTracking()
                .Where(x => x.DefenseTermId == periodId && !string.IsNullOrWhiteSpace(x.StudentCode))
                .Select(x => x.StudentCode)
                .Distinct()
                .ToListAsync();

            var selectedTopicsInScope = selectedTopicCodes.Count == 0
                ? new List<(string TopicCode, string? Status)>()
                : (await _uow.Topics.Query().AsNoTracking()
                    .Where(t => t.DefenseTermId == periodId
                        && t.ProposerStudentCode != null
                        && scopedStudentCodes.Contains(t.ProposerStudentCode)
                        && selectedTopicCodes.Contains(t.TopicCode))
                    .Select(t => new { t.TopicCode, Status = (string?)t.Status })
                    .ToListAsync())
                    .Select(t => (TopicCode: t.TopicCode, Status: t.Status))
                    .ToList();

            var eligibleSelectedTopicCodes = selectedTopicsInScope
                .Where(x => IsDefenseEligibleTopicStatus(x.Status))
                .Select(x => x.TopicCode)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var invalidSelectedTopicCodes = selectedTopicCodes
                .Where(code => !eligibleSelectedTopicCodes.Contains(code))
                .ToList();

            var scopedLecturerCodes = await _uow.DefenseTermLecturers.Query().AsNoTracking()
                .Where(x => x.DefenseTermId == periodId && !string.IsNullOrWhiteSpace(x.LecturerCode))
                .Select(x => x.LecturerCode)
                .Distinct()
                .ToListAsync();

            var scopedLecturerSet = scopedLecturerCodes.ToHashSet(StringComparer.OrdinalIgnoreCase);
            var invalidSelectedLecturerCodes = selectedLecturerCodes
                .Where(code => !scopedLecturerSet.Contains(code))
                .ToList();

            var eligibleTopics = eligibleSelectedTopicCodes.Count;

            var topicsPerSession = request.Strategy?.MaxPerSession > 0 ? request.Strategy.MaxPerSession : configResult.Data.TopicsPerSessionConfig;
            var estimatedCapacity = selectedRooms.Count * periodDayCount * 2 * topicsPerSession;
            var estimatedAssigned = Math.Min(eligibleTopics, estimatedCapacity);
            var coveragePercent = eligibleTopics == 0 ? 100m : Math.Round((decimal)estimatedAssigned * 100m / eligibleTopics, 2);

            var canGenerate = stateResult.Data.LecturerCapabilitiesLocked
                && stateResult.Data.CouncilConfigConfirmed
                && !stateResult.Data.Finalized
                && selectedRooms.Count > 0
                && selectedTopicCodes.Count > 0
                && selectedLecturerCodes.Count > 0
                && invalidSelectedTopicCodes.Count == 0
                && invalidSelectedLecturerCodes.Count == 0;

            var warnings = new List<string>();
            if (!stateResult.Data.LecturerCapabilitiesLocked)
            {
                warnings.Add("UC2.READINESS.LECTURER_CAPABILITIES_UNLOCKED");
            }

            if (!stateResult.Data.CouncilConfigConfirmed)
            {
                warnings.Add("UC2.READINESS.COUNCIL_CONFIG_NOT_CONFIRMED");
            }

            if (selectedRooms.Count == 0)
            {
                warnings.Add("UC2.READINESS.NO_ROOMS_AVAILABLE");
            }

            if (selectedTopicCodes.Count == 0)
            {
                warnings.Add("UC2.SIMULATION.TOPIC_SELECTION_EMPTY");
            }

            if (selectedLecturerCodes.Count == 0)
            {
                warnings.Add("UC2.SIMULATION.LECTURER_SELECTION_EMPTY");
            }

            if (invalidSelectedTopicCodes.Count > 0)
            {
                warnings.Add("UC2.SIMULATION.TOPIC_SELECTION_INVALID");
            }

            if (invalidSelectedLecturerCodes.Count > 0)
            {
                warnings.Add("UC2.SIMULATION.LECTURER_SELECTION_INVALID");
            }

            if (estimatedCapacity < eligibleTopics)
            {
                warnings.Add("UC2.SIMULATION.CAPACITY_INSUFFICIENT");
            }

            var explainability = new List<string>
            {
                $"Input rooms={selectedRooms.Count}; periodDays={periodDayCount}; topicsPerSession={topicsPerSession}; sessionsPerRoomPerDay=2",
                $"Selected topics={selectedTopicCodes.Count}; selected lecturers={selectedLecturerCodes.Count}",
                $"Eligible topics={eligibleTopics}; estimatedCapacity={estimatedCapacity}; estimatedAssigned={estimatedAssigned}",
                $"Coverage={coveragePercent}%"
            };

            if (invalidSelectedTopicCodes.Count > 0)
            {
                explainability.Add($"Invalid topic selections={string.Join(",", invalidSelectedTopicCodes)}");
            }

            if (invalidSelectedLecturerCodes.Count > 0)
            {
                explainability.Add($"Invalid lecturer selections={string.Join(",", invalidSelectedLecturerCodes)}");
            }

            if (request.Strategy?.HeuristicWeights != null)
            {
                explainability.Add($"Weights: tag={request.Strategy.HeuristicWeights.TagMatchWeight ?? 0.50m}, workload={request.Strategy.HeuristicWeights.WorkloadWeight ?? 0.20m}, fairness={request.Strategy.HeuristicWeights.FairnessWeight ?? 0.15m}, consecutivePenalty={request.Strategy.HeuristicWeights.ConsecutiveCommitteePenaltyWeight ?? 0.20m}");
            }

            var status = !canGenerate
                ? "failure"
                : (warnings.Count > 0 ? "success-with-warning" : "success");

            var response = new AutoGenerateSimulationResultDto
            {
                Status = status,
                CanGenerate = canGenerate,
                AllowedActions = stateResult.Data.AllowedActions,
                Warnings = warnings,
                Explainability = explainability,
                Coverage = new AutoGenerateCoverageStatsDto
                {
                    EligibleTopics = eligibleTopics,
                    EstimatedCapacity = estimatedCapacity,
                    EstimatedAssigned = estimatedAssigned,
                    CoveragePercent = coveragePercent
                }
            };

            return Ok(ApiResponse<AutoGenerateSimulationResultDto>.SuccessResponse(
                response,
                code: "UC2.AUTO_GENERATE.SIMULATION.SUCCESS",
                warnings: warnings.Select(x => new ApiWarning { Type = "soft", Code = x, Message = x }).ToList(),
                allowedActions: stateResult.Data.AllowedActions));
        }


        private async Task<ActionResult<ApiResponse<PagedResult<CouncilDraftDto>>>> GetCouncils(int periodId, [FromQuery] string? keyword, [FromQuery] string? tag, [FromQuery] string? room, [FromQuery] int page = 1, [FromQuery] int size = 20)
        {
            var filter = new CouncilFilterDto
            {
                Keyword = keyword,
                Tag = tag,
                Room = room,
                Page = page,
                Size = size
            };

            var result = await _getCouncilsQuery.ExecuteAsync(periodId, filter);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<List<DefensePeriodCalendarDayDto>>>> GetCouncilCalendar(int periodId, [FromQuery] DateTime? fromDate = null, [FromQuery] DateTime? toDate = null)
        {
            var result = await _getCouncilCalendarQuery.ExecuteAsync(periodId, fromDate, toDate);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<CouncilDraftDto>>> GetCouncilDetail(int periodId, int councilId)
        {
            var result = await _getCouncilDetailQuery.ExecuteAsync(periodId, councilId);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<List<TopicTagUsageDto>>>> GetTopicTags(int periodId, [FromQuery] string? tagCode = null)
        {
            var result = await _getTopicTagsQuery.ExecuteAsync(periodId, tagCode);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<List<LecturerTagUsageDto>>>> GetLecturerTags(int periodId, [FromQuery] string? tagCode = null)
        {
            var result = await _getLecturerTagsQuery.ExecuteAsync(periodId, tagCode);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<List<CommitteeTagUsageDto>>>> GetCommitteeTags(int periodId, [FromQuery] string? tagCode = null)
        {
            var result = await _getCommitteeTagsQuery.ExecuteAsync(periodId, tagCode);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<DefensePeriodTagOverviewDto>>> GetTagOverview(int periodId)
        {
            var result = await _getDefenseTagOverviewQuery.ExecuteAsync(periodId);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<CouncilDraftDto>>> CreateCouncil(int periodId, [FromBody] CouncilUpsertDto request)
        {
            var result = await _createCouncilCommand.ExecuteAsync(periodId, request, CurrentUserId);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 201 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<CouncilDraftDto>>> UpdateCouncil(int periodId, int councilId, [FromBody] CouncilUpsertDto request)
        {
            var result = await _updateCouncilCommand.ExecuteAsync(periodId, councilId, request, CurrentUserId);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<bool>>> DeleteCouncil(int periodId, int councilId)
        {
            var result = await _deleteCouncilCommand.ExecuteAsync(periodId, councilId, CurrentUserId);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<GenerateCouncilCodeResponseDto>>> GenerateCouncilCode(int periodId)
        {
            var result = await _generateCouncilCodeCommand.ExecuteAsync(periodId);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<CouncilDraftDto>>> CreateCouncilStep1(int periodId, [FromBody] CouncilWorkflowStep1Dto request)
        {
            var result = await _createCouncilStep1Command.ExecuteAsync(periodId, request, CurrentUserId);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 201 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<CouncilDraftDto>>> UpdateCouncilStep1(int periodId, int councilId, [FromBody] CouncilWorkflowStep1Dto request)
        {
            var result = await _updateCouncilStep1Command.ExecuteAsync(periodId, councilId, request, CurrentUserId);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<CouncilDraftDto>>> SaveCouncilMembersStep(int periodId, int councilId, [FromBody] CouncilWorkflowStep2Dto request)
        {
            var result = await _saveCouncilMembersStepCommand.ExecuteAsync(periodId, councilId, request, CurrentUserId);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<CouncilDraftDto>>> AddCouncilMemberItem(int periodId, int councilId, [FromBody] AddCouncilMemberItemDto request)
        {
            var result = await _addCouncilMemberItemCommand.ExecuteAsync(periodId, councilId, request, CurrentUserId);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<CouncilDraftDto>>> UpdateCouncilMemberItem(int periodId, int councilId, string lecturerCode, [FromBody] UpdateCouncilMemberItemDto request)
        {
            var result = await _updateCouncilMemberItemCommand.ExecuteAsync(periodId, councilId, lecturerCode, request, CurrentUserId);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<CouncilDraftDto>>> RemoveCouncilMemberItem(int periodId, int councilId, string lecturerCode, [FromQuery] string concurrencyToken)
        {
            var request = new RemoveCouncilMemberItemDto { ConcurrencyToken = concurrencyToken };
            var result = await _removeCouncilMemberItemCommand.ExecuteAsync(periodId, councilId, lecturerCode, request, CurrentUserId);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<CouncilDraftDto>>> SaveCouncilTopicsStep(int periodId, int councilId, [FromBody] CouncilWorkflowStep3Dto request)
        {
            var result = await _saveCouncilTopicsStepCommand.ExecuteAsync(periodId, councilId, request, CurrentUserId);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<CouncilDraftDto>>> AddCouncilTopicItem(int periodId, int councilId, [FromBody] AddCouncilTopicItemDto request)
        {
            var result = await _addCouncilTopicItemCommand.ExecuteAsync(periodId, councilId, request, CurrentUserId);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<CouncilDraftDto>>> UpdateCouncilTopicItem(int periodId, int councilId, int assignmentId, [FromBody] UpdateCouncilTopicItemDto request)
        {
            var result = await _updateCouncilTopicItemCommand.ExecuteAsync(periodId, councilId, assignmentId, request, CurrentUserId);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<CouncilDraftDto>>> RemoveCouncilTopicItem(int periodId, int councilId, int assignmentId, [FromQuery] string concurrencyToken)
        {
            var request = new RemoveCouncilTopicItemDto { ConcurrencyToken = concurrencyToken };
            var result = await _removeCouncilTopicItemCommand.ExecuteAsync(periodId, councilId, assignmentId, request, CurrentUserId);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<bool>>> FinalizePeriod(int periodId, [FromBody] FinalizeDefensePeriodDto request, [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey = null)
        {
            request.IdempotencyKey ??= idempotencyKey;
            var result = await _finalizeCommand.ExecuteAsync(periodId, request, CurrentUserId);
            await AttachPeriodStateMetadataAsync(periodId, result);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<bool>>> LockCouncils(int periodId, [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey = null)
        {
            var result = await _lockCouncilsCommand.ExecuteAsync(periodId, CurrentUserId, idempotencyKey);
            await AttachPeriodStateMetadataAsync(periodId, result);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<bool>>> ReopenCouncils(int periodId, [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey = null)
        {
            var result = await _reopenCouncilsCommand.ExecuteAsync(periodId, CurrentUserId, idempotencyKey);
            await AttachPeriodStateMetadataAsync(periodId, result);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<RollbackDefensePeriodResponseDto>>> RollbackPeriod(int periodId, [FromBody] RollbackDefensePeriodDto request, [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey = null)
        {
            request.IdempotencyKey ??= idempotencyKey;
            var result = await _rollbackCommand.ExecuteAsync(periodId, request, CurrentUserId);
            await AttachPeriodStateMetadataAsync(periodId, result);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<bool>>> PublishScores(int periodId, [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey = null)
        {
            var result = await _publishScoresCommand.ExecuteAsync(periodId, CurrentUserId, idempotencyKey);
            await AttachPeriodStateMetadataAsync(periodId, result);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<AnalyticsOverviewDto>>> GetOverview(int periodId)
        {
            var result = await _overviewQuery.ExecuteAsync(periodId);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<List<CouncilAnalyticsDto>>>> GetByCouncil(int periodId)
        {
            var result = await _byCouncilQuery.ExecuteAsync(periodId);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<AnalyticsDistributionDto>>> GetDistribution(int periodId)
        {
            var result = await _distributionQuery.ExecuteAsync(periodId);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<List<ScoringMatrixRowDto>>>> GetScoringMatrix(int periodId, [FromQuery] int? committeeId = null)
        {
            var result = await _scoringMatrixQuery.ExecuteAsync(periodId, committeeId);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<List<ScoringProgressDto>>>> GetScoringProgress(int periodId, [FromQuery] int? committeeId = null)
        {
            var result = await _scoringProgressQuery.ExecuteAsync(periodId, committeeId);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<List<ScoringAlertDto>>>> GetScoringAlerts(int periodId, [FromQuery] int? committeeId = null)
        {
            var result = await _scoringAlertsQuery.ExecuteAsync(periodId, committeeId);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<IActionResult> ExportCouncilSummary(int periodId, [FromQuery] string format = "csv")
        {
            var result = await _reportQuery.ExecuteAsync(periodId, "council-summary", format, null);
            if (!result.Success)
            {
                return StatusCode(result.HttpStatusCode == 0 ? 400 : result.HttpStatusCode, result);
            }

            return File(result.Data.Content, result.Data.ContentType, result.Data.FileName);
        }


        private async Task<IActionResult> ExportForm1(int periodId, [FromQuery] int councilId, [FromQuery] string format = "csv")
        {
            var result = await _reportQuery.ExecuteAsync(periodId, "form-1", format, councilId);
            if (!result.Success)
            {
                return StatusCode(result.HttpStatusCode == 0 ? 400 : result.HttpStatusCode, result);
            }

            return File(result.Data.Content, result.Data.ContentType, result.Data.FileName);
        }


        private async Task<IActionResult> ExportCouncilPackage(int periodId, string reportType, int councilId, [FromQuery] string format = "csv")
        {
            var result = await _reportQuery.ExecuteAsync(periodId, reportType, format, councilId);
            if (!result.Success)
            {
                return StatusCode(result.HttpStatusCode == 0 ? 400 : result.HttpStatusCode, result);
            }

            return File(result.Data.Content, result.Data.ContentType, result.Data.FileName);
        }


        private async Task<IActionResult> ExportFinalTerm(int periodId, [FromQuery] int? councilId = null, [FromQuery] string format = "csv")
        {
            var result = await _reportQuery.ExecuteAsync(periodId, "final-term", format, councilId);
            if (!result.Success)
            {
                return StatusCode(result.HttpStatusCode == 0 ? 400 : result.HttpStatusCode, result);
            }

            return File(result.Data.Content, result.Data.ContentType, result.Data.FileName);
        }

        private async Task<IActionResult> ExportCommitteeRoster(int periodId, [FromQuery] string format = "xlsx")
        {
            var normalizedFormat = (format ?? "xlsx").Trim().ToLowerInvariant();
            if (normalizedFormat != "xlsx" && normalizedFormat != "excel" && normalizedFormat != "csv" && normalizedFormat != "pdf")
            {
                return BadRequest(ApiResponse<object>.Fail("reportType=committee-roster chỉ hỗ trợ format=xlsx, csv hoặc pdf.", 400));
            }

            var snapshot = await BuildCommitteeRosterSnapshot(periodId, HttpContext.RequestAborted);
            var exportResult = await _committeeRosterExportService.ExportRosterAsync(snapshot, periodId, normalizedFormat, HttpContext.RequestAborted);
            return File(exportResult.Content, exportResult.ContentType, exportResult.FileName);
        }

        private async Task<CommitteeRosterExportSnapshotDto> BuildCommitteeRosterSnapshot(int periodId, CancellationToken cancellationToken)
        {
            var assignments = await _db.DefenseAssignments
                .AsNoTracking()
                .Where(x => x.DefenseTermId == periodId)
                .Where(x => !string.IsNullOrWhiteSpace(x.CommitteeCode) || x.CommitteeID.HasValue)
                .ToListAsync(cancellationToken);

            if (assignments.Count == 0)
            {
                return new CommitteeRosterExportSnapshotDto
                {
                    TotalCommittees = 0,
                    ExportedAt = DateTime.UtcNow
                };
            }

            var topicIds = assignments
                .Where(x => x.TopicID.HasValue)
                .Select(x => x.TopicID!.Value)
                .Distinct()
                .ToList();

            var topics = await _db.Topics
                .AsNoTracking()
                .Where(t => topicIds.Contains(t.TopicID))
                .ToDictionaryAsync(t => t.TopicID, t => t, cancellationToken);

            var committeeIds = assignments
                .Where(x => x.CommitteeID.HasValue)
                .Select(x => x.CommitteeID!.Value)
                .Distinct()
                .ToList();

            var committeeCodes = assignments
                .Where(x => !string.IsNullOrWhiteSpace(x.CommitteeCode))
                .Select(x => x.CommitteeCode!.Trim())
                .Where(c => c.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var committeesById = new Dictionary<int, Committee>();
            if (committeeIds.Count > 0)
            {
                committeesById = await _db.Committees
                    .AsNoTracking()
                    .Where(c => committeeIds.Contains(c.CommitteeID))
                    .ToDictionaryAsync(c => c.CommitteeID, c => c, cancellationToken);

                foreach (var fallbackCode in committeesById.Values
                    .Where(c => !string.IsNullOrWhiteSpace(c.CommitteeCode))
                    .Select(c => c.CommitteeCode!.Trim())
                    .Distinct(StringComparer.OrdinalIgnoreCase))
                {
                    if (!committeeCodes.Contains(fallbackCode, StringComparer.OrdinalIgnoreCase))
                    {
                        committeeCodes.Add(fallbackCode);
                    }
                }
            }

            var studentCodes = topics.Values
                .Where(t => !string.IsNullOrWhiteSpace(t.ProposerStudentCode))
                .Select(t => t.ProposerStudentCode!.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var studentProfiles = await _db.StudentProfiles
                .AsNoTracking()
                .Where(x => studentCodes.Contains(x.StudentCode))
                .ToDictionaryAsync(x => x.StudentCode, x => x, StringComparer.OrdinalIgnoreCase, cancellationToken);

            var memberLecturerCodes = await _db.CommitteeMembers
                .AsNoTracking()
                .Where(m => (committeeCodes.Contains(m.CommitteeCode!) || (m.CommitteeID.HasValue && committeeIds.Contains(m.CommitteeID.Value)))
                            && !string.IsNullOrWhiteSpace(m.MemberLecturerCode))
                .Select(m => m.MemberLecturerCode!)
                .Distinct()
                .ToListAsync(cancellationToken);

            var supervisorCodes = topics.Values
                .Where(t => !string.IsNullOrWhiteSpace(t.SupervisorLecturerCode))
                .Select(t => t.SupervisorLecturerCode!.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var lecturerCodes = memberLecturerCodes
                .Concat(supervisorCodes)
                .Where(code => !string.IsNullOrWhiteSpace(code))
                .Select(code => code.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var lecturerProfiles = await _db.LecturerProfiles
                .AsNoTracking()
                .Where(l => lecturerCodes.Contains(l.LecturerCode))
                .ToDictionaryAsync(l => l.LecturerCode, l => l, StringComparer.OrdinalIgnoreCase, cancellationToken);

            var committeeMembers = await _db.CommitteeMembers
                .AsNoTracking()
                .Where(m => (!string.IsNullOrWhiteSpace(m.CommitteeCode) && committeeCodes.Contains(m.CommitteeCode!.Trim()))
                            || (m.CommitteeID.HasValue && committeeIds.Contains(m.CommitteeID.Value)))
                .ToListAsync(cancellationToken);

            var membersByCommitteeCode = committeeMembers
                .GroupBy(m => (m.CommitteeCode ?? string.Empty).Trim(), StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.OrdinalIgnoreCase);

            var committeeByCode = await _db.Committees
                .AsNoTracking()
                .Where(c => c.DefenseTermId == periodId && !string.IsNullOrWhiteSpace(c.CommitteeCode) && committeeCodes.Contains(c.CommitteeCode!.Trim()))
                .ToDictionaryAsync(c => c.CommitteeCode!.Trim(), c => c, StringComparer.OrdinalIgnoreCase, cancellationToken);

            var rows = new List<CommitteeRosterRowDto>();

            foreach (var assignment in assignments)
            {
                if (!assignment.TopicID.HasValue)
                {
                    continue;
                }

                if (!topics.TryGetValue(assignment.TopicID.Value, out var topic))
                {
                    continue;
                }

                var topicStudentCode = string.IsNullOrWhiteSpace(topic.ProposerStudentCode)
                    ? string.Empty
                    : topic.ProposerStudentCode!.Trim();

                var committeeCode = !string.IsNullOrWhiteSpace(assignment.CommitteeCode)
                    ? assignment.CommitteeCode!.Trim()
                    : assignment.CommitteeID.HasValue && committeesById.TryGetValue(assignment.CommitteeID.Value, out var committeeById) && !string.IsNullOrWhiteSpace(committeeById.CommitteeCode)
                        ? committeeById.CommitteeCode!.Trim()
                        : string.Empty;

                if (string.IsNullOrWhiteSpace(committeeCode))
                {
                    continue;
                }

                var studentProfile = !string.IsNullOrWhiteSpace(topicStudentCode) && studentProfiles.TryGetValue(topicStudentCode, out var profile)
                    ? profile
                    : null;

                var advisorProfile = !string.IsNullOrWhiteSpace(topic.SupervisorLecturerCode) && lecturerProfiles.TryGetValue(topic.SupervisorLecturerCode!.Trim(), out var advisor)
                    ? advisor
                    : null;

                var committeeMemberList = membersByCommitteeCode.TryGetValue(committeeCode, out var groupMembers)
                    ? groupMembers
                    : new List<CommitteeMember>();

                var chairMember = ResolveCommitteeRole(committeeMemberList, "CT");
                var secretaryMember = ResolveCommitteeRole(committeeMemberList, "UVTK");
                var reviewerMember = ResolveCommitteeRole(committeeMemberList, "UVPB");

                rows.Add(new CommitteeRosterRowDto
                {
                    StudentCode = topicStudentCode,
                    StudentFullName = studentProfile?.FullName?.Trim() ?? topicStudentCode,
                    AdvisorDisplay = BuildLecturerDisplayName(advisorProfile, topic.SupervisorLecturerCode),
                    CommitteeCode = committeeCode,
                    ChairDisplay = BuildCommitteeMemberDisplay(chairMember, lecturerProfiles),
                    ChairWorkplace = BuildCommitteeMemberWorkplace(chairMember, lecturerProfiles),
                    SecretaryDisplay = BuildCommitteeMemberDisplay(secretaryMember, lecturerProfiles),
                    SecretaryWorkplace = BuildCommitteeMemberWorkplace(secretaryMember, lecturerProfiles),
                    ReviewerDisplay = BuildCommitteeMemberDisplay(reviewerMember, lecturerProfiles),
                    ReviewerWorkplace = BuildCommitteeMemberWorkplace(reviewerMember, lecturerProfiles),
                    DefenseSession = BuildDefenseSessionText(assignment),
                    DefenseDate = BuildDefenseDateText(assignment, committeeCode, committeeByCode)
                });
            }

            var sortedRows = rows
                .OrderBy(x => x.CommitteeCode)
                .ThenBy(x => x.StudentCode)
                .ToList();

            var numberedRows = new List<CommitteeRosterRowDto>();
            foreach (var group in sortedRows.GroupBy(x => x.CommitteeCode, StringComparer.OrdinalIgnoreCase))
            {
                var rowNumber = 1;
                foreach (var row in group)
                {
                    row.RowNumber = rowNumber++;
                    numberedRows.Add(row);
                }
            }

            return new CommitteeRosterExportSnapshotDto
            {
                Rows = numberedRows,
                TotalCommittees = numberedRows.Select(x => x.CommitteeCode).Distinct(StringComparer.OrdinalIgnoreCase).Count(),
                ExportedAt = DateTime.UtcNow
            };
        }

        private static string BuildLecturerDisplayName(LecturerProfile? profile, string? fallbackCode)
        {
            if (profile != null)
            {
                var name = profile.FullName?.Trim() ?? fallbackCode?.Trim();
                if (!string.IsNullOrWhiteSpace(profile.Degree))
                {
                    return $"{profile.Degree.Trim()} {name ?? string.Empty}".Trim();
                }

                return name ?? string.Empty;
            }

            return fallbackCode?.Trim() ?? string.Empty;
        }

        private static string BuildCommitteeMemberDisplay(CommitteeMember? member, IReadOnlyDictionary<string, LecturerProfile> lecturerProfiles)
        {
            if (member == null)
            {
                return string.Empty;
            }

            var profile = TryGetMemberLecturerProfile(member, lecturerProfiles);
            return BuildLecturerDisplayName(profile, member.MemberLecturerCode ?? member.MemberUserCode);
        }

        private static string BuildCommitteeMemberWorkplace(CommitteeMember? member, IReadOnlyDictionary<string, LecturerProfile> lecturerProfiles)
        {
            if (member == null)
            {
                return string.Empty;
            }

            var profile = TryGetMemberLecturerProfile(member, lecturerProfiles);
            return profile?.Organization?.Trim() ?? string.Empty;
        }

        private static CommitteeMember? ResolveCommitteeRole(IReadOnlyList<CommitteeMember> members, string expectedRole)
        {
            var normalizedExpected = expectedRole?.Trim().ToUpperInvariant();
            var exactMatch = members.FirstOrDefault(m => string.Equals(NormalizeCommitteeRole(m.Role), normalizedExpected, StringComparison.OrdinalIgnoreCase));
            if (exactMatch != null)
            {
                return exactMatch;
            }

            if (normalizedExpected == "CT")
            {
                return members.FirstOrDefault(m => m.IsChair == true);
            }

            return null;
        }

        private static string? NormalizeCommitteeRole(string? role)
        {
            if (string.IsNullOrWhiteSpace(role))
            {
                return null;
            }

            var upper = role.Trim().ToUpperInvariant();
            if (upper.Contains("CT") || upper.Contains("CHỦ") || upper.Contains("CHAIR"))
            {
                return "CT";
            }

            if (upper.Contains("UVTK") || upper.Contains("THƯ KÝ") || upper.Contains("THU KY") || upper.Contains("TK") || upper.Contains("SECRETARY"))
            {
                return "UVTK";
            }

            if (upper.Contains("UVPB") || upper.Contains("PHẢN BIỆN") || upper.Contains("PHAN BIEN") || upper.Contains("PB") || upper.Contains("REVIEWER"))
            {
                return "UVPB";
            }

            return upper;
        }

        private static LecturerProfile? TryGetMemberLecturerProfile(CommitteeMember member, IReadOnlyDictionary<string, LecturerProfile> lecturerProfiles)
        {
            if (!string.IsNullOrWhiteSpace(member.MemberLecturerCode) && lecturerProfiles.TryGetValue(member.MemberLecturerCode!.Trim(), out var profile))
            {
                return profile;
            }

            return null;
        }

        private static string BuildDefenseSessionText(DefenseAssignment assignment)
        {
            if (!string.IsNullOrWhiteSpace(assignment.Shift))
            {
                return assignment.Shift.Trim();
            }

            if (assignment.Session.HasValue)
            {
                return assignment.Session.Value == 1 ? "Sáng" : assignment.Session.Value == 2 ? "Chiều" : $"Buổi {assignment.Session.Value}";
            }

            return string.Empty;
        }

        private static string BuildDefenseDateText(DefenseAssignment assignment, string committeeCode, IReadOnlyDictionary<string, Committee> committeeByCode)
        {
            var defenseDate = assignment.ScheduledAt ?? (committeeByCode.TryGetValue(committeeCode, out var committee) ? committee.DefenseDate : null);
            return defenseDate.HasValue ? defenseDate.Value.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture) : string.Empty;
        }

        private async Task<ActionResult<ApiResponse<List<ExportHistoryDto>>>> GetExportHistory(int periodId)
        {
            var result = await _exportHistoryQuery.ExecuteAsync(periodId);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<List<PublishHistoryDto>>>> GetPublishHistory(int periodId)
        {
            var result = await _publishHistoryQuery.ExecuteAsync(periodId);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<List<CouncilAuditHistoryDto>>>> GetCouncilAuditHistory(int periodId, [FromQuery] int? councilId = null)
        {
            var result = await _councilAuditHistoryQuery.ExecuteAsync(periodId, councilId);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }


        private async Task<ActionResult<ApiResponse<List<RevisionAuditTrailDto>>>> GetRevisionAuditTrail(int periodId, int revisionId)
        {
            var result = await _revisionAuditTrailQuery.ExecuteAsync(periodId, revisionId);
            return StatusCode(result.HttpStatusCode == 0 ? (result.Success ? 200 : 400) : result.HttpStatusCode, result);
        }

        private async Task AttachPeriodStateMetadataAsync<T>(int periodId, ApiResponse<T> response)
        {
            var stateResult = await _getStateQuery.ExecuteAsync(periodId);
            if (!stateResult.Success || stateResult.Data == null)
            {
                return;
            }

            response.AllowedActions = stateResult.Data.AllowedActions ?? new List<string>();

            var warningCodeSet = response.Warnings
                .Select(x => x.Code)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            foreach (var warningCode in stateResult.Data.Warnings)
            {
                if (warningCodeSet.Contains(warningCode))
                {
                    continue;
                }

                response.Warnings.Add(new ApiWarning
                {
                    Type = "soft",
                    Code = warningCode,
                    Message = warningCode
                });
            }
        }

        private async Task<List<DefensePeriodStudentParticipantDto>> BuildAssignedStudentParticipantsAsync(int periodId, HashSet<int> councilIds)
        {
            var periodStudentCodes = await _uow.DefenseTermStudents.Query().AsNoTracking()
                .Where(x => x.DefenseTermId == periodId)
                .Select(x => x.StudentCode)
                .ToListAsync();

            var periodLecturerCodes = await _uow.DefenseTermLecturers.Query().AsNoTracking()
                .Where(x => x.DefenseTermId == periodId)
                .Select(x => x.LecturerCode)
                .ToListAsync();

            var studentCodeSet = periodStudentCodes
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var lecturerCodeSet = periodLecturerCodes
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            if (studentCodeSet.Count == 0 || lecturerCodeSet.Count == 0)
            {
                return new List<DefensePeriodStudentParticipantDto>();
            }

            var rows = await _uow.DefenseAssignments.Query().AsNoTracking()
                .Where(x => x.TopicCode != null && x.CommitteeID.HasValue && (x.DefenseTermId == periodId || councilIds.Contains(x.CommitteeID.Value)))
                .Join(
                    _uow.Committees.Query().AsNoTracking(),
                    a => a.CommitteeID!.Value,
                    c => c.CommitteeID,
                    (a, c) => new
                    {
                        a.AssignmentID,
                        a.TopicCode,
                        CommitteeId = c.CommitteeID,
                        c.CommitteeCode
                    })
                .Join(
                    _uow.Topics.Query().AsNoTracking(),
                    ac => ac.TopicCode!,
                    t => t.TopicCode,
                    (ac, t) => new
                    {
                        ac.AssignmentID,
                        ac.CommitteeId,
                        ac.CommitteeCode,
                        TopicCode = t.TopicCode,
                        TopicTitle = t.Title,
                        StudentCode = t.ProposerStudentCode,
                        SupervisorCode = t.SupervisorLecturerCode
                    })
                .Where(x => !string.IsNullOrWhiteSpace(x.StudentCode) && studentCodeSet.Contains(x.StudentCode!) && !string.IsNullOrWhiteSpace(x.SupervisorCode) && lecturerCodeSet.Contains(x.SupervisorCode!))
                .ToListAsync();

            var topicTagMap = await LoadTopicTagMapAsync(
                rows.Where(x => !string.IsNullOrWhiteSpace(x.TopicCode)).Select(x => x.TopicCode!).Distinct(StringComparer.OrdinalIgnoreCase).ToList());

            var studentCodes = rows
                .Where(x => !string.IsNullOrWhiteSpace(x.StudentCode))
                .Select(x => x.StudentCode!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var studentNameMap = studentCodes.Count == 0
                ? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                : (await _uow.StudentProfiles.Query().AsNoTracking()
                    .Where(x => studentCodes.Contains(x.StudentCode))
                    .Select(x => new { x.StudentCode, x.FullName })
                    .ToListAsync())
                    .ToDictionary(
                        x => x.StudentCode,
                        x => string.IsNullOrWhiteSpace(x.FullName) ? x.StudentCode : x.FullName!,
                        StringComparer.OrdinalIgnoreCase);

            var data = rows.Select(x => new DefensePeriodStudentParticipantDto
            {
                StudentCode = x.StudentCode ?? string.Empty,
                StudentName = !string.IsNullOrWhiteSpace(x.StudentCode) && studentNameMap.TryGetValue(x.StudentCode!, out var name)
                    ? name
                    : (x.StudentCode ?? string.Empty),
                TopicCode = x.TopicCode,
                TopicTitle = x.TopicTitle,
                SupervisorCode = x.SupervisorCode,
                Tags = topicTagMap.TryGetValue(x.TopicCode ?? string.Empty, out var tags)
                    ? tags.OrderBy(t => t).ToList()
                    : new List<string>(),
                CommitteeId = x.CommitteeId,
                CommitteeCode = x.CommitteeCode,
                AssignmentId = x.AssignmentID,
                Source = "ASSIGNED",
                IsEligible = true,
                Valid = true,
                Error = null
            }).ToList();

            return data;
        }

        private static string BuildStudentTopicKey(DefensePeriodStudentParticipantDto row)
        {
            var studentCode = string.IsNullOrWhiteSpace(row.StudentCode) ? "-" : row.StudentCode.Trim().ToUpperInvariant();
            var topicCode = string.IsNullOrWhiteSpace(row.TopicCode) ? "-" : row.TopicCode.Trim().ToUpperInvariant();
            var topicTitle = string.IsNullOrWhiteSpace(row.TopicTitle) ? "-" : row.TopicTitle.Trim().ToUpperInvariant();
            return $"{studentCode}|{topicCode}|{topicTitle}";
        }

        private async Task<Dictionary<string, HashSet<string>>> LoadTopicTagMapAsync(List<string> topicCodes)
        {
            if (topicCodes.Count == 0)
            {
                return new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);
            }

            var rows = await _uow.TopicTags.Query().AsNoTracking()
                .Where(x => x.TopicCode != null && topicCodes.Contains(x.TopicCode))
                .Join(_uow.Tags.Query().AsNoTracking(), tt => tt.TagID, tg => tg.TagID, (tt, tg) => new { tt.TopicCode, tg.TagCode })
                .ToListAsync(HttpContext.RequestAborted);

            return rows
                .Where(x => !string.IsNullOrWhiteSpace(x.TopicCode))
                .GroupBy(x => x.TopicCode!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(v => v.TagCode).Distinct(StringComparer.OrdinalIgnoreCase).ToHashSet(StringComparer.OrdinalIgnoreCase),
                    StringComparer.OrdinalIgnoreCase);
        }

        private async Task<Dictionary<string, HashSet<string>>> LoadLecturerTagMapAsync(List<string> lecturerCodes)
        {
            if (lecturerCodes.Count == 0)
            {
                return new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);
            }

            var rows = await _uow.LecturerTags.Query().AsNoTracking()
                .Where(x => x.LecturerCode != null && lecturerCodes.Contains(x.LecturerCode))
                .Join(_uow.Tags.Query().AsNoTracking(), lt => lt.TagID, tg => tg.TagID, (lt, tg) => new { lt.LecturerCode, tg.TagCode })
                .ToListAsync(HttpContext.RequestAborted);

            return rows
                .Where(x => !string.IsNullOrWhiteSpace(x.LecturerCode))
                .GroupBy(x => x.LecturerCode!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(v => v.TagCode).Distinct(StringComparer.OrdinalIgnoreCase).ToHashSet(StringComparer.OrdinalIgnoreCase),
                    StringComparer.OrdinalIgnoreCase);
        }

        private async Task<PeriodPipelineContext> BuildPeriodPipelineContextAsync(Models.DefenseTerm period)
        {
            var topics = await _uow.Topics.Query().AsNoTracking()
                .Where(x => x.DefenseTermId == period.DefenseTermId)
                .ToListAsync();

            var topicIds = topics.Select(x => x.TopicID).Distinct().ToList();
            var milestones = topicIds.Count == 0
                ? new List<Models.ProgressMilestone>()
                : await _uow.ProgressMilestones.Query().AsNoTracking()
                    .Where(x => topicIds.Contains(x.TopicID))
                    .ToListAsync();

            var milestoneIds = milestones.Select(x => x.MilestoneID).Distinct().ToList();
            var submissions = milestoneIds.Count == 0
                ? new List<Models.ProgressSubmission>()
                : await _uow.ProgressSubmissions.Query().AsNoTracking()
                    .Where(x => x.MilestoneID.HasValue && milestoneIds.Contains(x.MilestoneID.Value))
                    .ToListAsync();

            var studentCodes = await _uow.DefenseTermStudents.Query().AsNoTracking()
                .Where(x => x.DefenseTermId == period.DefenseTermId)
                .Select(x => x.StudentCode)
                .ToListAsync();

            var lecturerCodes = await _uow.DefenseTermLecturers.Query().AsNoTracking()
                .Where(x => x.DefenseTermId == period.DefenseTermId)
                .Select(x => x.LecturerCode)
                .ToListAsync();

            var councilIds = await GetPeriodCouncilIdsAsync(period);
            var assignments = await _uow.DefenseAssignments.Query().AsNoTracking()
                .Where(x => x.DefenseTermId == period.DefenseTermId || (x.CommitteeID.HasValue && councilIds.Contains(x.CommitteeID.Value)))
                .Select(x => new Models.DefenseAssignment
                {
                    AssignmentID = x.AssignmentID,
                    TopicCode = x.TopicCode,
                    CommitteeID = x.CommitteeID,
                    CommitteeCode = x.CommitteeCode,
                    LastUpdated = x.LastUpdated
                })
                .ToListAsync();

            var assignmentIds = assignments.Select(x => x.AssignmentID).Distinct().ToList();
            var results = assignmentIds.Count == 0
                ? new List<Models.DefenseResult>()
                : await _uow.DefenseResults.Query().AsNoTracking()
                    .Where(x => assignmentIds.Contains(x.AssignmentId))
                    .ToListAsync();

            var revisions = assignmentIds.Count == 0
                ? new List<Models.DefenseRevision>()
                : await _uow.DefenseRevisions.Query().AsNoTracking()
                    .Where(x => assignmentIds.Contains(x.AssignmentId))
                    .ToListAsync();

            return new PeriodPipelineContext
            {
                Period = period,
                Topics = topics,
                Milestones = milestones,
                Submissions = submissions,
                Assignments = assignments,
                Results = results,
                Revisions = revisions,
                CouncilIds = councilIds,
                PeriodStudentCodes = new HashSet<string>(studentCodes, StringComparer.OrdinalIgnoreCase),
                PeriodLecturerCodes = new HashSet<string>(lecturerCodes, StringComparer.OrdinalIgnoreCase)
            };
        }

        private async Task<List<string>> LoadRoomCodesForAutoGenerateAsync(CancellationToken cancellationToken)
        {
            // Query raw SQL directly to avoid Oracle schema drift logs when ROOM_CODE/ROOMCODE differs.
            return await LoadRoomCodesByRawSqlAsync(cancellationToken);
        }

        private async Task<List<string>> LoadRoomCodesByRawSqlAsync(CancellationToken cancellationToken)
        {
            var sqlCandidates = new[]
            {
                "SELECT ROOM_CODE FROM ROOMS WHERE ROOM_CODE IS NOT NULL ORDER BY ROOM_CODE",
                "SELECT ROOMCODE FROM ROOMS WHERE ROOMCODE IS NOT NULL ORDER BY ROOMCODE"
            };

            var connection = _db.Database.GetDbConnection();
            var shouldClose = connection.State != ConnectionState.Open;
            if (shouldClose)
            {
                await connection.OpenAsync(cancellationToken);
            }

            try
            {
                foreach (var sql in sqlCandidates)
                {
                    try
                    {
                        using var command = connection.CreateCommand();
                        command.CommandText = sql;
                        using var reader = await command.ExecuteReaderAsync(cancellationToken);
                        var rows = new List<string>();
                        while (await reader.ReadAsync(cancellationToken))
                        {
                            var value = reader.IsDBNull(0) ? null : reader.GetString(0);
                            if (!string.IsNullOrWhiteSpace(value))
                            {
                                rows.Add(value.Trim().ToUpperInvariant());
                            }
                        }

                        if (rows.Count > 0)
                        {
                            return rows.Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(x => x).ToList();
                        }
                    }
                    catch (Exception ex) when (ex.Message.Contains("ORA-00904", StringComparison.OrdinalIgnoreCase))
                    {
                        // Try the next candidate column name.
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

        private async Task<List<DefensePeriodRegistrationTopicItemDto>> BuildRegistrationItemsAsync(PeriodPipelineContext context)
        {
            var milestoneByTopicId = context.Milestones
                .GroupBy(x => x.TopicID)
                .ToDictionary(g => g.Key, g => g.ToList());

            var milestoneToTopicMap = context.Milestones
                .ToDictionary(x => x.MilestoneID, x => x.TopicID);

            var lastSubmissionByTopicId = context.Submissions
                .Where(x => x.MilestoneID.HasValue && milestoneToTopicMap.ContainsKey(x.MilestoneID.Value))
                .GroupBy(x => milestoneToTopicMap[x.MilestoneID!.Value])
                .ToDictionary(g => g.Key, g => g.Max(x => x.SubmittedAt));

            var assignmentByTopicCode = context.Assignments
                .Where(x => !string.IsNullOrWhiteSpace(x.TopicCode))
                .GroupBy(x => x.TopicCode!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    g => g.Key,
                    g => g.OrderByDescending(x => x.LastUpdated).First(),
                    StringComparer.OrdinalIgnoreCase);

            var resultByAssignmentId = context.Results
                .GroupBy(x => x.AssignmentId)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.LastUpdated).First());

            var committeeIds = context.Assignments
                .Where(x => x.CommitteeID.HasValue)
                .Select(x => x.CommitteeID!.Value)
                .Distinct()
                .ToList();

            var committeeCodeMap = committeeIds.Count == 0
                ? new Dictionary<int, string>()
                : (await _uow.Committees.Query().AsNoTracking()
                    .Where(x => committeeIds.Contains(x.CommitteeID))
                    .Select(x => new { x.CommitteeID, x.CommitteeCode })
                    .ToListAsync())
                    .ToDictionary(x => x.CommitteeID, x => x.CommitteeCode);

            var studentCodes = context.Topics
                .Where(x => !string.IsNullOrWhiteSpace(x.ProposerStudentCode))
                .Select(x => x.ProposerStudentCode!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var supervisorCodes = context.Topics
                .Where(x => !string.IsNullOrWhiteSpace(x.SupervisorLecturerCode))
                .Select(x => x.SupervisorLecturerCode!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var studentNameMap = studentCodes.Count == 0
                ? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                : (await _uow.StudentProfiles.Query().AsNoTracking()
                    .Where(x => studentCodes.Contains(x.StudentCode))
                    .Select(x => new { x.StudentCode, x.FullName })
                    .ToListAsync())
                    .ToDictionary(
                        x => x.StudentCode,
                        x => string.IsNullOrWhiteSpace(x.FullName) ? x.StudentCode : x.FullName!,
                        StringComparer.OrdinalIgnoreCase);

            var supervisorNameMap = supervisorCodes.Count == 0
                ? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                : (await _uow.LecturerProfiles.Query().AsNoTracking()
                    .Where(x => supervisorCodes.Contains(x.LecturerCode))
                    .Select(x => new { x.LecturerCode, x.FullName })
                    .ToListAsync())
                    .ToDictionary(
                        x => x.LecturerCode,
                        x => string.IsNullOrWhiteSpace(x.FullName) ? x.LecturerCode : x.FullName!,
                        StringComparer.OrdinalIgnoreCase);

            var topicTagMap = await LoadTopicTagMapAsync(
                context.Topics.Where(x => !string.IsNullOrWhiteSpace(x.TopicCode)).Select(x => x.TopicCode!).ToList());

            var items = new List<DefensePeriodRegistrationTopicItemDto>(context.Topics.Count);
            foreach (var topic in context.Topics)
            {
                milestoneByTopicId.TryGetValue(topic.TopicID, out var topicMilestones);
                topicMilestones ??= new List<Models.ProgressMilestone>();

                var lastMilestoneUpdatedAt = topicMilestones.Count == 0
                    ? null
                    : topicMilestones.Max(x => (DateTime?)x.LastUpdated);

                lastSubmissionByTopicId.TryGetValue(topic.TopicID, out var lastSubmissionAt);

                var inPeriodStudentPool = !string.IsNullOrWhiteSpace(topic.ProposerStudentCode)
                    && context.PeriodStudentCodes.Contains(topic.ProposerStudentCode);
                var inPeriodLecturerPool = !string.IsNullOrWhiteSpace(topic.SupervisorLecturerCode)
                    && context.PeriodLecturerCodes.Contains(topic.SupervisorLecturerCode);

                assignmentByTopicCode.TryGetValue(topic.TopicCode, out var assignment);
                var isAssignedToCouncil = assignment != null;
                var hasEligibleStatus = IsDefenseEligibleTopicStatus(topic.Status);

                var isEligible = inPeriodStudentPool
                    && inPeriodLecturerPool
                    && hasEligibleStatus;
                var resolvedTopicStatus = ResolveTopicStatusForCouncilAssignment(topic.Status, isAssignedToCouncil);
                var hasScoringResult = assignment != null
                    && resultByAssignmentId.TryGetValue(assignment.AssignmentID, out var result)
                    && HasScoringData(result);

                var studentCode = topic.ProposerStudentCode;
                var supervisorCode = topic.SupervisorLecturerCode;

                var studentName = string.IsNullOrWhiteSpace(studentCode)
                    ? string.Empty
                    : (studentNameMap.TryGetValue(studentCode, out var mappedStudentName) ? mappedStudentName : studentCode);

                var supervisorName = string.IsNullOrWhiteSpace(supervisorCode)
                    ? string.Empty
                    : (supervisorNameMap.TryGetValue(supervisorCode, out var mappedLecturerName) ? mappedLecturerName : supervisorCode);

                var committeeCode = assignment?.CommitteeCode;
                if (string.IsNullOrWhiteSpace(committeeCode)
                    && assignment?.CommitteeID != null
                    && committeeCodeMap.TryGetValue(assignment.CommitteeID.Value, out var mappedCommitteeCode))
                {
                    committeeCode = mappedCommitteeCode;
                }

                items.Add(new DefensePeriodRegistrationTopicItemDto
                {
                    TopicId = topic.TopicID,
                    TopicCode = topic.TopicCode,
                    TopicTitle = topic.Title,
                    Tags = topicTagMap.TryGetValue(topic.TopicCode, out var topicTags)
                        ? topicTags.OrderBy(x => x).ToList()
                        : new List<string>(),
                    TopicStatus = resolvedTopicStatus,
                    StudentCode = studentCode,
                    StudentName = studentName,
                    SupervisorCode = supervisorCode,
                    SupervisorName = supervisorName,
                    InPeriodStudentPool = inPeriodStudentPool,
                    InPeriodLecturerPool = inPeriodLecturerPool,
                    HasCompletedMilestone = hasEligibleStatus,
                    IsEligibleForDefense = isEligible,
                    IsAssignedToCouncil = isAssignedToCouncil,
                    HasScoringResult = hasScoringResult,
                    AssignmentId = assignment?.AssignmentID,
                    CommitteeId = assignment?.CommitteeID,
                    CommitteeCode = committeeCode,
                    LastMilestoneUpdatedAt = lastMilestoneUpdatedAt,
                    LastSubmissionAt = lastSubmissionAt
                });
            }

            return items;
        }

        private static bool HasCompletedMilestone(Models.ProgressMilestone milestone)
        {
            if (milestone.CompletedAt1.HasValue
                || milestone.CompletedAt2.HasValue
                || milestone.CompletedAt3.HasValue
                || milestone.CompletedAt4.HasValue
                || milestone.CompletedAt5.HasValue)
            {
                return true;
            }

            var normalizedState = NormalizeKeyword(milestone.State);
            return normalizedState.Contains("HOAN THANH")
                || normalizedState.Contains("COMPLETED")
                || normalizedState.Contains("COMPLETE")
                || normalizedState.Contains("DONE")
                || normalizedState.Contains("APPROVED");
        }

        private static bool IsOngoingMilestone(Models.ProgressMilestone milestone)
        {
            if (HasCompletedMilestone(milestone))
            {
                return false;
            }

            var normalizedState = NormalizeKeyword(milestone.State);
            if (normalizedState.Contains("DANG")
                || normalizedState.Contains("IN PROGRESS")
                || normalizedState.Contains("PROCESS")
                || normalizedState.Contains("DOING"))
            {
                return true;
            }

            return milestone.StartedAt.HasValue;
        }

        private static bool HasScoringData(Models.DefenseResult result)
        {
            return result.FinalScoreNumeric.HasValue
                || !string.IsNullOrWhiteSpace(result.FinalScoreText)
                || result.ScoreCt.HasValue
                || result.ScoreGvhd.HasValue
                || result.ScoreUvtk.HasValue
                || result.ScoreUvpb.HasValue;
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

        private static string ResolveTopicStatusForCouncilAssignment(string? topicStatus, bool isAssignedToCouncil)
        {
            if (isAssignedToCouncil)
            {
                return "Đã phân hội đồng";
            }

            return topicStatus ?? string.Empty;
        }

        private static decimal CalculateCompletionPercent(int totalCount, int completedCount)
        {
            if (totalCount <= 0)
            {
                return 0;
            }

            var safeCompleted = Math.Clamp(completedCount, 0, totalCount);
            return Math.Round(safeCompleted * 100m / totalCount, 2);
        }

        private static string ResolvePipelineStageStatus(int totalCount, int completedCount, bool blocked)
        {
            if (blocked && !(totalCount > 0 && completedCount >= totalCount))
            {
                return "BLOCKED";
            }

            if (totalCount <= 0 || completedCount <= 0)
            {
                return "NOT_STARTED";
            }

            if (completedCount >= totalCount)
            {
                return "COMPLETED";
            }

            return "IN_PROGRESS";
        }

        private sealed class PeriodPipelineContext
        {
            public Models.DefenseTerm Period { get; set; } = null!;
            public HashSet<int> CouncilIds { get; set; } = new();
            public HashSet<string> PeriodStudentCodes { get; set; } = new(StringComparer.OrdinalIgnoreCase);
            public HashSet<string> PeriodLecturerCodes { get; set; } = new(StringComparer.OrdinalIgnoreCase);
            public List<Models.Topic> Topics { get; set; } = new();
            public List<Models.ProgressMilestone> Milestones { get; set; } = new();
            public List<Models.ProgressSubmission> Submissions { get; set; } = new();
            public List<Models.DefenseAssignment> Assignments { get; set; } = new();
            public List<Models.DefenseResult> Results { get; set; } = new();
            public List<Models.DefenseRevision> Revisions { get; set; } = new();
        }

        private async Task<ActionResult<ApiResponse<DefensePeriodStatusTransitionResponseDto>>?> TryGetLifecycleReplayAsync(
            string action,
            int periodId,
            string? idempotencyKey,
            string requestHash)
        {
            if (string.IsNullOrWhiteSpace(idempotencyKey))
            {
                return null;
            }

            var now = DateTime.UtcNow;
            var normalizedKey = idempotencyKey.Trim();

            var record = await _db.IdempotencyRecords
                .AsNoTracking()
                .FirstOrDefaultAsync(x =>
                    x.Action == action
                    && x.PeriodID == periodId
                    && x.RequestKey == normalizedKey
                    && x.ExpiresAt > now);

            if (record == null)
            {
                return null;
            }

            if (!string.Equals(record.RequestHash, requestHash, StringComparison.Ordinal))
            {
                return Conflict(ApiResponse<DefensePeriodStatusTransitionResponseDto>.Fail(
                    "Idempotency-Key đã được dùng cho payload khác.",
                    409,
                    code: "IDEMPOTENCY_KEY_REUSED_DIFFERENT_PAYLOAD"));
            }

            if (!string.IsNullOrWhiteSpace(record.ResponsePayload))
            {
                var replay = JsonSerializer.Deserialize<ApiResponse<DefensePeriodStatusTransitionResponseDto>>(record.ResponsePayload!);
                if (replay != null)
                {
                    replay.IdempotencyReplay = true;
                    replay.Code ??= $"{action}.REPLAY";

                    var statusCode = replay.HttpStatusCode == 0
                        ? (record.ResponseStatusCode ?? (replay.Success ? 200 : 400))
                        : replay.HttpStatusCode;

                    return StatusCode(statusCode, replay);
                }
            }

            if (record.RecordStatus == Models.IdempotencyRecordStatus.Processing)
            {
                return Conflict(ApiResponse<DefensePeriodStatusTransitionResponseDto>.Fail(
                    "Yêu cầu cùng Idempotency-Key đang được xử lý, vui lòng thử lại sau.",
                    409,
                    code: "IDEMPOTENCY_REQUEST_IN_PROGRESS"));
            }

            return null;
        }

        private async Task SaveLifecycleResponseAsync(
            string action,
            int periodId,
            string? idempotencyKey,
            string requestHash,
            ApiResponse<DefensePeriodStatusTransitionResponseDto> response)
        {
            if (string.IsNullOrWhiteSpace(idempotencyKey))
            {
                return;
            }

            var now = DateTime.UtcNow;
            var normalizedKey = idempotencyKey.Trim();

            var record = await _db.IdempotencyRecords.FirstOrDefaultAsync(x =>
                x.Action == action
                && x.PeriodID == periodId
                && x.RequestKey == normalizedKey);

            if (record == null)
            {
                record = new Models.IdempotencyRecord
                {
                    Action = action,
                    PeriodID = periodId,
                    RequestKey = normalizedKey,
                    RequestHash = requestHash,
                    CreatedAt = now,
                    ExpiresAt = now.AddHours(2)
                };

                await _db.IdempotencyRecords.AddAsync(record);
            }
            else if (!string.Equals(record.RequestHash, requestHash, StringComparison.Ordinal))
            {
                return;
            }

            record.ResponsePayload = JsonSerializer.Serialize(response);
            record.ResponseStatusCode = response.HttpStatusCode == 0
                ? (response.Success ? 200 : 400)
                : response.HttpStatusCode;
            record.ResponseSuccess = response.Success;
            record.RecordStatus = response.Success
                ? Models.IdempotencyRecordStatus.Completed
                : Models.IdempotencyRecordStatus.Failed;
            record.CompletedAt = now;
            record.ExpiresAt = now.AddHours(2);

            await _db.SaveChangesAsync();
        }

        private static string ComputeLifecycleRequestHash(params object?[] parts)
        {
            var payload = string.Join("|", parts.Select(x => x?.ToString() ?? string.Empty));
            var bytes = Encoding.UTF8.GetBytes(payload);
            var hash = SHA256.HashData(bytes);
            return Convert.ToHexString(hash);
        }

        private static void ValidatePeriodWindow(DateTime startDate, DateTime? endDate)
        {
            if (endDate.HasValue && endDate.Value.Date < startDate.Date)
            {
                throw new ArgumentException("EndDate phải lớn hơn hoặc bằng StartDate.");
            }
        }

        private static string NormalizePeriodStatus(string status)
        {
            var normalized = status.Trim().ToUpperInvariant();
            return normalized switch
            {
                "DRAFT" => "Draft",
                "PREPARING" => "Preparing",
                "FINALIZED" => "Finalized",
                "PUBLISHED" => "Published",
                "ARCHIVED" => "Archived",
                _ => throw new ArgumentException("Status ch? h? tr?: Draft, Preparing, Finalized, Published, Archived.")
            };
        }

        private async Task<HashSet<int>> GetPeriodCouncilIdsAsync(Models.DefenseTerm period)
        {
            var councilIds = LoadCouncilIdsFromConfig(period.ConfigJson);
            var fkCouncilIds = await _uow.Committees.Query().AsNoTracking()
                .Where(x => x.DefenseTermId == period.DefenseTermId)
                .Select(x => x.CommitteeID)
                .ToListAsync();

            foreach (var councilId in fkCouncilIds)
            {
                councilIds.Add(councilId);
            }

            return councilIds;
        }

        private static HashSet<int> LoadCouncilIdsFromConfig(string? configJson)
        {
            if (string.IsNullOrWhiteSpace(configJson))
            {
                return new HashSet<int>();
            }

            try
            {
                using var doc = JsonDocument.Parse(configJson);
                if (!doc.RootElement.TryGetProperty("CouncilIds", out var councilIdsElement)
                    || councilIdsElement.ValueKind != JsonValueKind.Array)
                {
                    return new HashSet<int>();
                }

                var ids = new HashSet<int>();
                foreach (var item in councilIdsElement.EnumerateArray())
                {
                    if (item.ValueKind == JsonValueKind.Number && item.TryGetInt32(out var id))
                    {
                        ids.Add(id);
                    }
                }

                return ids;
            }
            catch
            {
                return new HashSet<int>();
            }
        }

        public class ScoringActionRequestDto
        {
            public string Action { get; set; } = string.Empty;
            public string? CommitteeCode { get; set; }
            public string? CommitteeId { get; set; }
            public List<int>? Targets { get; set; }
        }

        [HttpGet("{periodId:int}/scoring/progress-topic-final")]
        [Authorize(Roles = "Admin,Head")]
        public async Task<ActionResult<ApiResponse<object>>> GetScoringProgressTopicFinal(int periodId)
        {
            var scoringMatrixAction = await GetScoringMatrix(periodId, null);
            if (!TryExtractApiResponse(scoringMatrixAction, out var scoringMatrix, out var statusCode) || scoringMatrix == null || !scoringMatrix.Success)
            {
                return StatusCode(statusCode, ApiResponse<object>.Fail("Không thể lấy danh sách đề tài.", statusCode));
            }

            var safeScoringMatrix = scoringMatrix.Data?.Select(row =>
            {
                var isScored = row.SubmittedCount >= row.RequiredCount && row.RequiredCount > 0;
                var effectiveStatus = (row.IsLocked || row.Status == "LOCKED") 
                    ? "LOCKED" 
                    : (isScored ? "WAITING_PUBLISH" : (row.Status ?? "PENDING"));

                if (row.IsLocked || row.Status == "LOCKED")
                {
                    return (object)new
                    {
                        row.AssignmentId,
                        row.TopicTitle,
                        row.TopicCode,
                        row.StudentName,
                        row.StudentCode,
                        row.CommitteeCode,
                        CurrentScore = row.ScoreGvhd,
                        row.FinalScore,
                        row.FinalGrade,
                        row.SubmittedCount,
                        row.RequiredCount,
                        Status = effectiveStatus
                    };
                }

                return (object)new
                {
                    row.AssignmentId,
                    row.TopicTitle,
                    row.TopicCode,
                    row.StudentName,
                    row.StudentCode,
                    row.CommitteeCode,
                    CurrentScore = (decimal?)null,
                    FinalScore = (decimal?)null,
                    FinalGrade = (string?)null,
                    row.SubmittedCount,
                    row.RequiredCount,
                    Status = effectiveStatus
                };
            }).ToList();

            return Ok(ApiResponse<object>.SuccessResponse(safeScoringMatrix));
        }

        [HttpGet("{periodId:int}/scoring/distribution")]
        [Authorize(Roles = "Admin,Head")]
        public async Task<ActionResult<ApiResponse<object>>> GetScoringDistribution(int periodId)
        {
            var distributionAction = await GetDistribution(periodId);
            if (!TryExtractApiResponse(distributionAction, out var distribution, out var distributionStatusCode) || distribution == null || !distribution.Success)
            {
                return StatusCode(distributionStatusCode, ApiResponse<object>.Fail("Không thể lấy phân bố điểm.", distributionStatusCode));
            }
            return Ok(ApiResponse<object>.SuccessResponse(distribution.Data));
        }

        [HttpPost("{periodId:int}/scoring/actions")]
        [Authorize(Roles = "Admin,Head")]
        public async Task<ActionResult<ApiResponse<object>>> PostScoringActions(int periodId, [FromBody] ScoringActionRequestDto request)
        {
            var action = request.Action?.Trim().ToUpper() ?? "";
            var committeeIdStr = request.CommitteeId ?? request.CommitteeCode ?? "";
            
            if (!int.TryParse(committeeIdStr, out var committeeId) || committeeId <= 0)
            {
                return BadRequest(ApiResponse<object>.Fail("CommitteeId hoặc CommitteeCode không hợp lệ.", 400));
            }

            if (!new[] { "OPEN", "LOCK", "REOPEN" }.Contains(action))
            {
                return BadRequest(ApiResponse<object>.Fail("Action phải là: OPEN, LOCK, hoặc REOPEN.", 400));
            }

            // Validate committee exists
            var committee = await _db.Committees.AsNoTracking()
                .FirstOrDefaultAsync(x => x.CommitteeID == committeeId);
            
            if (committee == null)
            {
                return NotFound(ApiResponse<object>.Fail($"Không tìm thấy hội đồng với ID {committeeId}.", 404));
            }

            // Return success response - actual workflow triggered by lecturers via lecturer endpoint
            return Ok(ApiResponse<object>.SuccessResponse(new
            {
                Action = action,
                CommitteeId = committeeId,
                CommitteeName = committee.Name,
                CommitteeCode = committee.CommitteeCode,
                Processed = true,
                Message = $"Yêu cầu {action} cho hội đồng {committee.CommitteeCode} đã được nhận."
            }));
        }
    }
}

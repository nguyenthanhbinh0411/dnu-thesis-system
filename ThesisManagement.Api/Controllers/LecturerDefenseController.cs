using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Text;
using System.Text.Json;
using ThesisManagement.Api.Application.Common;
using ThesisManagement.Api.Application.Command.DefenseExecution;
using ThesisManagement.Api.Application.Command.DefenseTermLecturers;
using ThesisManagement.Api.Application.Query.DefenseExecution;
using ThesisManagement.Api.DTOs;
using ThesisManagement.Api.DTOs.DefensePeriods;
using ThesisManagement.Api.DTOs.DefenseTermLecturers.Command;
using ThesisManagement.Api.DTOs.DefenseTermLecturers.Query;
using ThesisManagement.Api.Services.DefenseDocuments;

namespace ThesisManagement.Api.Controllers
{
    [ApiController]
    [Route("api/defense-periods/{periodId:int}/lecturer")]
    [Authorize]
    public class LecturerDefenseController : BaseApiController
    {
        private readonly IGetLecturerCommitteesQueryV2 _getCommitteesQuery;
        private readonly IGetLecturerMinutesQuery _getMinutesQuery;
        private readonly ISaveLecturerMinuteCommand _saveMinuteCommand;
        private readonly ISubmitLecturerIndependentScoreCommand _submitScoreCommand;
        private readonly IOpenLecturerSessionCommand _openSessionCommand;
        private readonly ILockLecturerSessionCommand _lockSessionCommand;
        private readonly IGetLecturerRevisionQueueQuery _revisionQueueQuery;
        private readonly IApproveRevisionByLecturerCommand _approveRevisionCommand;
        private readonly IRejectRevisionByLecturerCommand _rejectRevisionCommand;
        private readonly IGetScoringMatrixQuery _scoringMatrixQuery;
        private readonly IGetScoringProgressQuery _scoringProgressQuery;
        private readonly IGetTopicFinalScoreProgressQuery _topicFinalScoreProgressQuery;
        private readonly IGetScoringAlertsQuery _scoringAlertsQuery;
        private readonly IBuildDefenseReportQuery _buildDefenseReportQuery;
        private readonly ICreateDefenseTermLecturerCommand _createDefenseTermLecturerCommand;
        private readonly IUpdateDefenseTermLecturerCommand _updateDefenseTermLecturerCommand;
        private readonly IDeleteDefenseTermLecturerCommand _deleteDefenseTermLecturerCommand;
        private readonly IDefenseTemplateExportService _defenseTemplateExportService;

        public LecturerDefenseController(
            Services.IUnitOfWork uow,
            Services.ICodeGenerator codeGen,
            AutoMapper.IMapper mapper,
            IGetLecturerCommitteesQueryV2 getCommitteesQuery,
            IGetLecturerMinutesQuery getMinutesQuery,
            ISaveLecturerMinuteCommand saveMinuteCommand,
            ISubmitLecturerIndependentScoreCommand submitScoreCommand,
            IOpenLecturerSessionCommand openSessionCommand,
            ILockLecturerSessionCommand lockSessionCommand,
            IGetLecturerRevisionQueueQuery revisionQueueQuery,
            IApproveRevisionByLecturerCommand approveRevisionCommand,
            IRejectRevisionByLecturerCommand rejectRevisionCommand,
            IGetScoringMatrixQuery scoringMatrixQuery,
            IGetScoringProgressQuery scoringProgressQuery,
            IGetTopicFinalScoreProgressQuery topicFinalScoreProgressQuery,
            IGetScoringAlertsQuery scoringAlertsQuery,
            IBuildDefenseReportQuery buildDefenseReportQuery,
            ICreateDefenseTermLecturerCommand createDefenseTermLecturerCommand,
            IUpdateDefenseTermLecturerCommand updateDefenseTermLecturerCommand,
            IDeleteDefenseTermLecturerCommand deleteDefenseTermLecturerCommand,
            IDefenseTemplateExportService defenseTemplateExportService) : base(uow, codeGen, mapper)
        {
            _getCommitteesQuery = getCommitteesQuery;
            _getMinutesQuery = getMinutesQuery;
            _saveMinuteCommand = saveMinuteCommand;
            _submitScoreCommand = submitScoreCommand;
            _openSessionCommand = openSessionCommand;
            _lockSessionCommand = lockSessionCommand;
            _revisionQueueQuery = revisionQueueQuery;
            _approveRevisionCommand = approveRevisionCommand;
            _rejectRevisionCommand = rejectRevisionCommand;
            _scoringMatrixQuery = scoringMatrixQuery;
            _scoringProgressQuery = scoringProgressQuery;
            _topicFinalScoreProgressQuery = topicFinalScoreProgressQuery;
            _scoringAlertsQuery = scoringAlertsQuery;
            _buildDefenseReportQuery = buildDefenseReportQuery;
            _createDefenseTermLecturerCommand = createDefenseTermLecturerCommand;
            _updateDefenseTermLecturerCommand = updateDefenseTermLecturerCommand;
            _deleteDefenseTermLecturerCommand = deleteDefenseTermLecturerCommand;
            _defenseTemplateExportService = defenseTemplateExportService;
        }

        private sealed class LecturerCommitteeAccessScope
        {
            public bool CouncilListLocked { get; set; }
            public HashSet<int> CommitteeIds { get; } = new();
            public int CommitteeCount => CommitteeIds.Count;
            public bool IsSecretary { get; set; }
            public bool HasPendingRevisions { get; set; }
            public bool HasCommitteeAccess => CouncilListLocked && CommitteeCount > 0;
        }

        private static List<ScoringProgressDto> BuildScoringProgressSnapshot(IEnumerable<ScoringMatrixRowDto> matrixRows)
        {
            return matrixRows
                .GroupBy(x => new { x.CommitteeId, x.CommitteeCode })
                .Select(g =>
                {
                    var total = g.Count();
                    // Consider a row "completed" only when it is explicitly completed/locked or a final score exists.
                    var completed = g.Count(x => x.Status == "COMPLETED" || x.Status == "LOCKED" || x.FinalScore.HasValue);
                    return new ScoringProgressDto
                    {
                        CommitteeId = g.Key.CommitteeId,
                        CommitteeCode = g.Key.CommitteeCode,
                        TotalAssignments = total,
                        CompletedAssignments = completed,
                        ProgressPercent = total == 0 ? 0 : Math.Round((decimal)completed * 100m / total, 2)
                    };
                })
                .OrderBy(x => x.CommitteeId)
                .ToList();
        }

        private static List<TopicFinalScoreProgressDto> BuildTopicFinalScoreProgressSnapshot(IEnumerable<ScoringMatrixRowDto> matrixRows)
        {
            return matrixRows
                .GroupBy(x => new { x.CommitteeId, x.CommitteeCode })
                .Select(g =>
                {
                    var total = g.Count();
                    // Count a topic as "scored" only when the final score has been calculated.
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
        }

        private static List<ScoringAlertDto> BuildScoringAlertsSnapshot(IEnumerable<ScoringMatrixRowDto> matrixRows)
        {
            const decimal varianceThreshold = 2.0m;

            var alerts = new List<ScoringAlertDto>();
            foreach (var row in matrixRows)
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

            return alerts;
        }

        private static int? ReadCommitteeIdFromElement(JsonElement committeeElement)
        {
            static int? TryReadInt(JsonElement source, string propertyName)
            {
                if (!source.TryGetProperty(propertyName, out var value))
                {
                    return null;
                }

                if (value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var numeric))
                {
                    return numeric;
                }

                if (value.ValueKind == JsonValueKind.String && int.TryParse(value.GetString(), out var parsed))
                {
                    return parsed;
                }

                return null;
            }

            var candidates = new[]
            {
                "CommitteeID",
                "CommitteeId",
                "committeeID",
                "committeeId",
                "Id",
                "id"
            };

            foreach (var propertyName in candidates)
            {
                var maybeId = TryReadInt(committeeElement, propertyName);
                if (maybeId.HasValue && maybeId.Value > 0)
                {
                    return maybeId.Value;
                }
            }

            return null;
        }

        private static LecturerCommitteeAccessScope ResolveLecturerCommitteeAccessScope(object? committeesData)
        {
            var scope = new LecturerCommitteeAccessScope();

            if (committeesData == null)
            {
                return scope;
            }

            try
            {
                using var committeesDocument = JsonDocument.Parse(JsonSerializer.Serialize(committeesData));
                var committeesRoot = committeesDocument.RootElement;

                if (committeesRoot.TryGetProperty("CouncilListLocked", out var councilListLockedElement) &&
                    (councilListLockedElement.ValueKind == JsonValueKind.True || councilListLockedElement.ValueKind == JsonValueKind.False))
                {
                    scope.CouncilListLocked = councilListLockedElement.GetBoolean();
                }

                if (committeesRoot.TryGetProperty("Committees", out var committeesElement) &&
                    committeesElement.ValueKind == JsonValueKind.Array)
                {
                    foreach (var committeeElement in committeesElement.EnumerateArray())
                    {
                        var maybeCommitteeId = ReadCommitteeIdFromElement(committeeElement);
                        if (maybeCommitteeId.HasValue)
                        {
                            scope.CommitteeIds.Add(maybeCommitteeId.Value);
                        }

                        if (committeeElement.TryGetProperty("NormalizedRole", out var roleElement) || 
                            committeeElement.TryGetProperty("normalizedRole", out roleElement))
                        {
                            var role = roleElement.GetString();
                            if (role == "UVTK" || role == "SECRETARY")
                            {
                                scope.IsSecretary = true;
                            }
                        }
                    }
                }

                return scope;
            }
            catch
            {
                return scope;
            }
        }

        [HttpGet("snapshot")]
        [Authorize(Roles = "Lecturer,Head,Secretary")]
        public async Task<ActionResult<ApiResponse<object>>> GetLecturerSnapshot(int periodId, [FromQuery] int? committeeId = null)
        {
            var lecturerCode = GetRequestUserCode() ?? string.Empty;

            var committeesResult = await _getCommitteesQuery.ExecuteAsync(lecturerCode, periodId);
            if (!committeesResult.Success)
            {
                return FromResult(ApiResponse<object>.Fail(
                    committeesResult.Message ?? "Không thể lấy danh sách hội đồng.",
                    committeesResult.HttpStatusCode == 0 ? 400 : committeesResult.HttpStatusCode,
                    committeesResult.Errors,
                    committeesResult.Code,
                    committeesResult.Warnings,
                    committeesResult.AllowedActions));
            }

            var accessScope = ResolveLecturerCommitteeAccessScope(committeesResult.Data);
            var councilListLocked = accessScope.CouncilListLocked;
            var committeeCount = accessScope.CommitteeCount;
            var hasCommitteeAccess = accessScope.HasCommitteeAccess;
            var scopedCommitteeIds = accessScope.CommitteeIds;

            if (committeeId.HasValue && hasCommitteeAccess && !scopedCommitteeIds.Contains(committeeId.Value))
            {
                return FromResult(ApiResponse<object>.Fail(
                    "Bạn không thuộc hội đồng được yêu cầu.",
                    403,
                    code: "LECTURER_COMMITTEE_ACCESS_DENIED"));
            }

            var revisionQueueResult = ApiResponse<List<object>>.SuccessResponse(new List<object>());
            var matrixResult = ApiResponse<List<ScoringMatrixRowDto>>.SuccessResponse(new List<ScoringMatrixRowDto>());
            var progressResult = ApiResponse<List<ScoringProgressDto>>.SuccessResponse(new List<ScoringProgressDto>());
            var topicFinalProgressResult = ApiResponse<List<TopicFinalScoreProgressDto>>.SuccessResponse(new List<TopicFinalScoreProgressDto>());
            var alertsResult = ApiResponse<List<ScoringAlertDto>>.SuccessResponse(new List<ScoringAlertDto>());
            var minutes = new List<LecturerCommitteeMinuteDto>();

            if (hasCommitteeAccess)
            {
                // Execute queries sequentially to avoid DbContext threading violations
                // EF Core does not support concurrent async operations on the same DbContext instance
                revisionQueueResult = await _revisionQueueQuery.ExecuteAsync(lecturerCode, periodId);
                if (!revisionQueueResult.Success)
                {
                    return FromResult(ApiResponse<object>.Fail(
                        revisionQueueResult.Message ?? "Không thể lấy revision queue.",
                        revisionQueueResult.HttpStatusCode == 0 ? 400 : revisionQueueResult.HttpStatusCode,
                        revisionQueueResult.Errors,
                        revisionQueueResult.Code,
                        revisionQueueResult.Warnings,
                        revisionQueueResult.AllowedActions));
                }

                matrixResult = await _scoringMatrixQuery.ExecuteAsync(periodId, committeeId, isForLecturer: true);
                if (!matrixResult.Success)
                {
                    return FromResult(ApiResponse<object>.Fail(
                        matrixResult.Message ?? "Không thể lấy scoring matrix.",
                        matrixResult.HttpStatusCode == 0 ? 400 : matrixResult.HttpStatusCode,
                        matrixResult.Errors,
                        matrixResult.Code,
                        matrixResult.Warnings,
                        matrixResult.AllowedActions));
                }

                var matrixRows = matrixResult.Data ?? new List<ScoringMatrixRowDto>();
                progressResult = ApiResponse<List<ScoringProgressDto>>.SuccessResponse(BuildScoringProgressSnapshot(matrixRows));
                topicFinalProgressResult = ApiResponse<List<TopicFinalScoreProgressDto>>.SuccessResponse(BuildTopicFinalScoreProgressSnapshot(matrixRows));
                alertsResult = ApiResponse<List<ScoringAlertDto>>.SuccessResponse(BuildScoringAlertsSnapshot(matrixRows));

                if (committeeId.HasValue)
                {
                    var minutesResult = await _getMinutesQuery.ExecuteAsync(committeeId.Value, periodId);
                    if (!minutesResult.Success)
                    {
                        return FromResult(ApiResponse<object>.Fail(
                            minutesResult.Message ?? "Không thể lấy biên bản hội đồng.",
                            minutesResult.HttpStatusCode == 0 ? 400 : minutesResult.HttpStatusCode,
                            minutesResult.Errors,
                            minutesResult.Code,
                            minutesResult.Warnings,
                            minutesResult.AllowedActions));
                    }

                    minutes = minutesResult.Data ?? new List<LecturerCommitteeMinuteDto>();
                }
            }

            var snapshot = new
            {
                LecturerCode = lecturerCode,
                CouncilListLocked = councilListLocked,
                HasCommitteeAccess = hasCommitteeAccess,
                CommitteeCount = committeeCount,
                Committees = committeesResult.Data,
                RevisionQueue = revisionQueueResult.Data,
                Scoring = new
                {
                    Matrix = matrixResult.Data,
                    Progress = progressResult.Data,
                    TopicFinalProgress = topicFinalProgressResult.Data,
                    Alerts = alertsResult.Data
                },
                Minutes = minutes
            };

            return FromResult(ApiResponse<object>.SuccessResponse(snapshot));
        }

        [HttpGet("/api/lecturer-defense/current/snapshot")]
        [Authorize(Roles = "Lecturer,Head,Secretary")]
        public async Task<ActionResult<ApiResponse<object>>> GetCurrentLecturerSnapshot([FromQuery] int? committeeId = null)
        {
            var resolved = await ResolveCurrentLecturerPeriodAsync(HttpContext.RequestAborted);
            if (!resolved.Success || resolved.Period == null)
            {
                return StatusCode(resolved.StatusCode, ApiResponse<object>.Fail(
                    resolved.Message ?? "Không thể xác định đợt đồ án tốt nghiệp hiện tại.",
                    resolved.StatusCode,
                    code: resolved.Code));
            }

            var snapshotResult = await GetLecturerSnapshot(resolved.Period.DefenseTermId, committeeId);
            if (!TryExtractApiResponse(snapshotResult, out var snapshot, out var snapshotStatusCode) || snapshot == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy snapshot giảng viên.", 500));
            }

            if (!snapshot.Success)
            {
                return StatusCode(snapshotStatusCode, ApiResponse<object>.Fail(
                    snapshot.Message ?? "Không lấy được snapshot giảng viên.",
                    snapshotStatusCode,
                    snapshot.Errors,
                    snapshot.Code,
                    snapshot.Warnings,
                    snapshot.AllowedActions));
            }

            var payload = new
            {
                Period = new
                {
                    resolved.Period.DefenseTermId,
                    resolved.Period.Name,
                    resolved.Period.Status,
                    resolved.Period.StartDate,
                    resolved.Period.EndDate
                },
                Snapshot = snapshot.Data
            };

            return StatusCode(snapshotStatusCode, ApiResponse<object>.SuccessResponse(
                payload,
                snapshot.TotalCount,
                snapshotStatusCode,
                snapshot.Code,
                snapshot.Warnings,
                snapshot.IdempotencyReplay,
                snapshot.ConcurrencyToken,
                snapshot.AllowedActions));
        }

        [HttpGet("/api/lecturer-defense/current/access")]
        [Authorize(Roles = "Lecturer,Head,Secretary")]
        public async Task<ActionResult<ApiResponse<object>>> GetCurrentLecturerAccess()
        {
            var resolved = await ResolveCurrentLecturerPeriodAsync(HttpContext.RequestAborted);
            if (!resolved.Success || resolved.Period == null)
            {
                return StatusCode(resolved.StatusCode, ApiResponse<object>.Fail(
                    resolved.Message ?? "Không thể xác định đợt đồ án tốt nghiệp hiện tại.",
                    resolved.StatusCode,
                    code: resolved.Code));
            }

            var lecturerCode = GetRequestUserCode() ?? string.Empty;
            var committeesResult = await _getCommitteesQuery.ExecuteAsync(lecturerCode, resolved.Period.DefenseTermId, HttpContext.RequestAborted);
            if (!committeesResult.Success)
            {
                    return FromResult(ApiResponse<object>.Fail(
                        committeesResult.Message ?? "Không thể lấy danh sách hội đồng.",
                        committeesResult.HttpStatusCode == 0 ? 400 : committeesResult.HttpStatusCode,
                        committeesResult.Errors,
                        committeesResult.Code,
                        committeesResult.Warnings,
                        committeesResult.AllowedActions));
            }

            var accessScope = ResolveLecturerCommitteeAccessScope(committeesResult.Data);
            
            // Check for pending revisions if secretary
            if (accessScope.IsSecretary)
            {
                var revisionResult = await _revisionQueueQuery.ExecuteAsync(lecturerCode, resolved.Period.DefenseTermId, HttpContext.RequestAborted);
                if (revisionResult.Success && revisionResult.Data != null)
                {
                    // Check if there are any revisions in any committee
                    // The data is a list of group objects, each has a 'Revisions' list
                    using var revisionDoc = JsonDocument.Parse(JsonSerializer.Serialize(revisionResult.Data));
                    foreach (var group in revisionDoc.RootElement.EnumerateArray())
                    {
                        if (group.TryGetProperty("Revisions", out var revisions) && revisions.ValueKind == JsonValueKind.Array && revisions.GetArrayLength() > 0)
                        {
                            accessScope.HasPendingRevisions = true;
                            break;
                        }
                    }
                }
            }

            var payload = new
            {
                Period = new
                {
                    resolved.Period.DefenseTermId,
                    resolved.Period.Name,
                    resolved.Period.Status,
                    resolved.Period.StartDate,
                    resolved.Period.EndDate
                },
                CouncilListLocked = accessScope.CouncilListLocked,
                HasCommitteeAccess = accessScope.HasCommitteeAccess,
                CommitteeCount = accessScope.CommitteeCount,
                IsSecretary = accessScope.IsSecretary,
                HasPendingRevisions = accessScope.HasPendingRevisions
            };

            return StatusCode(200, ApiResponse<object>.SuccessResponse(payload));
        }

        [HttpPost("minutes/upsert")]
        [Authorize(Roles = "Lecturer,Head,Secretary")]
        public async Task<ActionResult<ApiResponse<object>>> UpsertMinutes(int periodId, [FromBody] LecturerMinutesUpsertRequestDto request)
        {
            var result = await SaveMinutes(periodId, request.CommitteeId, request.Data);
            return WrapAsObject(result, "UPSERT_MINUTES");
        }

        [HttpGet("minutes/export-docx")]
        [HttpGet("minutes/export-document")]
        [Authorize(Roles = "Lecturer,Head,Secretary")]
        public async Task<IActionResult> ExportMinutesDocx(
            int periodId,
            [FromQuery] int committeeId,
            [FromQuery] int assignmentId,
            [FromQuery] string template = "meeting",
            [FromQuery] string format = "word")
        {
            var normalizedTemplate = (template ?? string.Empty).Trim().ToLowerInvariant();
            var normalizedFormat = (format ?? string.Empty).Trim().ToLowerInvariant();
            if (normalizedFormat == "docx")
            {
                normalizedFormat = "word";
            }

            if (normalizedFormat != "word" && normalizedFormat != "pdf")
            {
                return BadRequest(ApiResponse<object>.Fail("Định dạng không hợp lệ. Chỉ hỗ trợ word hoặc pdf.", 400));
            }

            ApiResponse<(byte[] Content, string FileName, string ContentType)> result;

            switch (normalizedTemplate)
            {
                case "meeting":
                case "minutes":
                case "bien-ban":
                    result = normalizedFormat switch
                    {
                        "pdf" => await _defenseTemplateExportService.ExportMeetingMinutesPdfAsync(
                            periodId,
                            committeeId,
                            assignmentId,
                            HttpContext.RequestAborted),
                        _ => await _defenseTemplateExportService.ExportMeetingMinutesAsync(
                            periodId,
                            committeeId,
                            assignmentId,
                            HttpContext.RequestAborted),
                    };
                    break;

                case "reviewer":
                case "nhan-xet":
                case "review":
                    result = normalizedFormat switch
                    {
                        "pdf" => await _defenseTemplateExportService.ExportReviewerCommentsPdfAsync(
                            periodId,
                            committeeId,
                            assignmentId,
                            HttpContext.RequestAborted),
                        _ => await _defenseTemplateExportService.ExportReviewerCommentsAsync(
                            periodId,
                            committeeId,
                            assignmentId,
                            HttpContext.RequestAborted),
                    };
                    break;

                default:
                    return BadRequest(ApiResponse<object>.Fail("template không hợp lệ. Hỗ trợ: meeting, reviewer.", 400));
            }

            if (!result.Success || result.Data.Content.Length == 0)
            {
                return StatusCode(
                    result.HttpStatusCode == 0 ? 400 : result.HttpStatusCode,
                    ApiResponse<object>.Fail(
                        result.Message ?? "Không thể xuất tài liệu.",
                        result.HttpStatusCode == 0 ? 400 : result.HttpStatusCode,
                        result.Errors,
                        result.Code));
            }

            return File(result.Data.Content, result.Data.ContentType, result.Data.FileName);
        }

        [HttpGet("reports/export-form-1")]
        [Authorize(Roles = "Lecturer,Head,Secretary")]
        public async Task<IActionResult> ExportScoreSheet(
            int periodId,
            [FromQuery] int committeeId,
            [FromQuery] string format = "word")
        {
            var normalizedFormat = (format ?? string.Empty).Trim().ToLowerInvariant();
            var response = await _buildDefenseReportQuery.ExecuteAsync(periodId, "form-1", normalizedFormat, committeeId, HttpContext.RequestAborted);

            if (!response.Success || response.Data.Content.Length == 0)
            {
                return StatusCode(
                    response.HttpStatusCode == 0 ? 400 : response.HttpStatusCode,
                    ApiResponse<object>.Fail(
                        response.Message ?? "Không thể xuất bảng điểm.",
                        response.HttpStatusCode == 0 ? 400 : response.HttpStatusCode,
                        response.Errors,
                        response.Code));
            }

            return File(response.Data.Content, response.Data.ContentType, response.Data.FileName);
        }

        [HttpGet("scoring/progress-topic-final")]
        [Authorize(Roles = "Lecturer,Head,Secretary")]
        public async Task<ActionResult<ApiResponse<List<TopicFinalScoreProgressDto>>>> GetTopicFinalScoreProgress(int periodId, [FromQuery] int? committeeId = null)
        {
            var response = await _topicFinalScoreProgressQuery.ExecuteAsync(periodId, committeeId, HttpContext.RequestAborted);
            return StatusCode(response.HttpStatusCode == 0 ? 200 : response.HttpStatusCode, response);
        }

        [HttpPost("scoring/actions")]
        [Authorize(Roles = "Lecturer,Head,Secretary")]
        public async Task<ActionResult<ApiResponse<object>>> HandleScoringAction(int periodId, [FromBody] LecturerScoringActionRequestDto request)
        {
            var action = (request.Action ?? string.Empty).Trim().ToUpperInvariant();

            if (action == "SUBMIT")
            {
                if (request.Score == null)
                {
                    return BadRequest(ApiResponse<object>.Fail("Thiếu payload score cho action SUBMIT.", 400));
                }

                return WrapAsObject(
                    await SubmitIndependentScore(
                        periodId,
                        request.CommitteeId,
                        request.Score,
                        request.IdempotencyKey),
                    action);
            }

            if (action == "LOCK_SESSION")
            {
                return WrapAsObject(
                    await LockSession(periodId, request.CommitteeId, request.IdempotencyKey),
                    action);
            }

            if (action == "OPEN_SESSION")
            {
                return WrapAsObject(
                    await OpenSession(periodId, request.CommitteeId, request.IdempotencyKey),
                    action);
            }

            return BadRequest(ApiResponse<object>.Fail("Action không hợp lệ. Hỗ trợ: SUBMIT, OPEN_SESSION, LOCK_SESSION.", 400));
        }

        [HttpPost("revisions/actions")]
        [Authorize(Roles = "Lecturer,Head,Secretary")]
        public async Task<ActionResult<ApiResponse<object>>> HandleRevisionAction(int periodId, [FromBody] LecturerRevisionActionRequestDto request)
        {
            var action = (request.Action ?? string.Empty).Trim().ToUpperInvariant();

            return action switch
            {
                "APPROVE" => WrapAsObject(
                    await ApproveRevision(periodId, request.RevisionId, request.Approve?.Reason, request.IdempotencyKey),
                    action),
                "REJECT" => WrapAsObject(
                    await RejectRevision(
                        periodId,
                        request.RevisionId,
                        request.Reject ?? new RejectRevisionRequestDto { Reason = "Rejected by lecturer action" },
                        request.IdempotencyKey),
                    action),
                _ => BadRequest(ApiResponse<object>.Fail("Action không hợp lệ. Hỗ trợ: APPROVE, REJECT.", 400))
            };
        }

        [HttpGet("/api/LecturerDefense/get-list")]
        [Authorize(Roles = "Admin,Head,Secretary")]
        public async Task<ActionResult<ApiResponse<IEnumerable<LecturerDefenseListItemDto>>>> GetList(
            [FromQuery] int defenseTermId,
            [FromQuery] string source = "all",
            [FromQuery] string? keyword = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            if (defenseTermId <= 0)
            {
                return BadRequest(ApiResponse<object>.Fail("Thiếu defenseTermId hợp lệ.", 400));
            }

            if (!await DefensePeriodExistsAsync(defenseTermId, HttpContext.RequestAborted))
            {
                return NotFound(ApiResponse<object>.Fail("Không tìm thấy đợt đồ án tốt nghiệp.", 404));
            }

            var safePage = Math.Max(page, 1);
            var safePageSize = Math.Clamp(pageSize, 1, 500);

            var data = await BuildLecturerDefenseListAsync(defenseTermId, source, keyword, HttpContext.RequestAborted);
            var paged = data
                .Skip((safePage - 1) * safePageSize)
                .Take(safePageSize)
                .ToList();

            return Ok(ApiResponse<IEnumerable<LecturerDefenseListItemDto>>.SuccessResponse(paged, data.Count));
        }

        [HttpPost("/api/LecturerDefense/create")]
        [Authorize(Roles = "Admin,Head,Secretary")]
        public async Task<ActionResult<ApiResponse<DefenseTermLecturerReadDto>>> Create([FromBody] DefenseTermLecturerCreateDto request)
        {
            var result = await _createDefenseTermLecturerCommand.ExecuteAsync(request);
            return MapLecturerResult(result);
        }

        [HttpPost("/api/LecturerDefense/create-selected")]
        [Authorize(Roles = "Admin,Head,Secretary")]
        public async Task<ActionResult<ApiResponse<DefenseParticipantBulkOperationResultDto>>> CreateSelected([FromBody] LecturerDefenseBulkCreateRequestDto request)
        {
            if (request.DefenseTermId <= 0)
            {
                return BadRequest(ApiResponse<object>.Fail("Thiếu defenseTermId hợp lệ.", 400));
            }

            var normalizedCodes = request.LecturerCodes
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var normalizedProfileIds = request.LecturerProfileIds
                .Where(x => x > 0)
                .Distinct()
                .ToList();

            if (normalizedCodes.Count == 0 && normalizedProfileIds.Count == 0)
            {
                return BadRequest(ApiResponse<object>.Fail("Danh sách giảng viên được chọn đang rỗng.", 400));
            }

            var candidates = await _uow.LecturerProfiles.Query().AsNoTracking()
                .Where(x => normalizedProfileIds.Contains(x.LecturerProfileID) || normalizedCodes.Contains(x.LecturerCode))
                .OrderBy(x => x.LecturerCode)
                .ToListAsync();

            var resultItems = new List<DefenseParticipantBulkOperationItemDto>();

            var foundIds = candidates.Select(x => x.LecturerProfileID).ToHashSet();
            foreach (var profileId in normalizedProfileIds.Where(id => !foundIds.Contains(id)))
            {
                resultItems.Add(new DefenseParticipantBulkOperationItemDto
                {
                    Key = $"LecturerProfileID:{profileId}",
                    Success = false,
                    Message = "Không tìm thấy giảng viên profile tương ứng."
                });
            }

            var foundCodes = candidates
                .Where(x => !string.IsNullOrWhiteSpace(x.LecturerCode))
                .Select(x => x.LecturerCode)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            foreach (var code in normalizedCodes.Where(c => !foundCodes.Contains(c)))
            {
                resultItems.Add(new DefenseParticipantBulkOperationItemDto
                {
                    Key = code,
                    Success = false,
                    Message = "Không tìm thấy giảng viên profile tương ứng."
                });
            }

            foreach (var lecturer in candidates
                .GroupBy(x => x.LecturerCode, StringComparer.OrdinalIgnoreCase)
                .Select(g => g.First())
                .OrderBy(x => x.LecturerCode))
            {
                var createDto = new DefenseTermLecturerCreateDto(
                    request.DefenseTermId,
                    lecturer.LecturerProfileID,
                    lecturer.LecturerCode,
                    lecturer.UserCode,
                    request.IsPrimary,
                    null,
                    null);

                var createResult = await _createDefenseTermLecturerCommand.ExecuteAsync(createDto);
                resultItems.Add(new DefenseParticipantBulkOperationItemDto
                {
                    Key = lecturer.LecturerCode,
                    Success = createResult.Success,
                    Id = createResult.Data?.DefenseTermLecturerID,
                    Message = createResult.Success
                        ? "Thêm vào đợt đồ án tốt nghiệp thành công."
                        : (createResult.ErrorMessage ?? "Thêm vào đợt đồ án tốt nghiệp thất bại.")
                });
            }

            var response = new DefenseParticipantBulkOperationResultDto
            {
                Total = resultItems.Count,
                Succeeded = resultItems.Count(x => x.Success),
                Failed = resultItems.Count(x => !x.Success),
                Items = resultItems
            };

            return Ok(ApiResponse<DefenseParticipantBulkOperationResultDto>.SuccessResponse(response, response.Total));
        }

        [HttpPut("/api/LecturerDefense/update/{id:int}")]
        [Authorize(Roles = "Admin,Head,Secretary")]
        public async Task<ActionResult<ApiResponse<DefenseTermLecturerReadDto>>> Update(int id, [FromBody] DefenseTermLecturerUpdateDto request)
        {
            var result = await _updateDefenseTermLecturerCommand.ExecuteAsync(id, request);
            return MapLecturerResult(result);
        }

        [HttpDelete("/api/LecturerDefense/delete/{id:int}")]
        [Authorize(Roles = "Admin,Head,Secretary")]
        public async Task<ActionResult<ApiResponse<object>>> Delete(int id)
        {
            var result = await _deleteDefenseTermLecturerCommand.ExecuteAsync(id);
            if (!result.Success)
            {
                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(
                    result.ErrorMessage ?? "Xóa giảng viên đợt đồ án tốt nghiệp thất bại.",
                    result.StatusCode));
            }

            return Ok(ApiResponse<object>.SuccessResponse(new
            {
                Id = id,
                Message = result.Data
            }));
        }

        [HttpGet("/api/LecturerDefense/export")]
        [Authorize(Roles = "Admin,Head,Secretary")]
        public async Task<IActionResult> Export(
            [FromQuery] int defenseTermId,
            [FromQuery] string source = "all",
            [FromQuery] string? keyword = null,
            [FromQuery] string format = "csv")
        {
            if (defenseTermId <= 0)
            {
                return BadRequest(ApiResponse<object>.Fail("Thiếu defenseTermId hợp lệ.", 400));
            }

            if (!string.Equals(format, "csv", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(ApiResponse<object>.Fail("Định dạng export chỉ hỗ trợ: csv.", 400));
            }

            var rows = await BuildLecturerDefenseListAsync(defenseTermId, source, keyword, HttpContext.RequestAborted);
            var sb = new StringBuilder();
            sb.AppendLine("LecturerProfileID,LecturerCode,FullName,Degree,DepartmentCode,UserCode,Tags,TagCodes,GuidedTopicCount,CommitteeCount,CommitteeRoles,IsSupervisor,IsCommitteeMember");

            foreach (var row in rows)
            {
                sb.AppendLine(string.Join(",",
                    EscapeCsv(row.LecturerProfileID.ToString()),
                    EscapeCsv(row.LecturerCode),
                    EscapeCsv(row.FullName),
                    EscapeCsv(row.Degree),
                    EscapeCsv(row.DepartmentCode),
                    EscapeCsv(row.UserCode),
                    EscapeCsv(string.Join("|", row.Tags)),
                    EscapeCsv(string.Join("|", row.TagCodes)),
                    EscapeCsv(row.GuidedTopicCount.ToString()),
                    EscapeCsv(row.CommitteeCount.ToString()),
                    EscapeCsv(string.Join("|", row.CommitteeRoles)),
                    EscapeCsv(row.IsSupervisor ? "1" : "0"),
                    EscapeCsv(row.IsCommitteeMember ? "1" : "0")));
            }

            var content = Encoding.UTF8.GetBytes(sb.ToString());
            var fileName = $"lecturer-defense-{defenseTermId}-{DateTime.UtcNow:yyyyMMddHHmmss}.csv";
            return File(content, "text/csv; charset=utf-8", fileName);
        }

        private async Task<List<LecturerDefenseListItemDto>> BuildLecturerDefenseListAsync(
            int defenseTermId,
            string source,
            string? keyword,
            CancellationToken cancellationToken)
        {
            var normalizedSource = string.IsNullOrWhiteSpace(source)
                ? "all"
                : source.Trim().ToLowerInvariant();

            var scopedLecturerCodes = await _uow.DefenseTermLecturers.Query().AsNoTracking()
                .Where(x => x.DefenseTermId == defenseTermId && !string.IsNullOrWhiteSpace(x.LecturerCode))
                .Select(x => x.LecturerCode)
                .Distinct()
                .ToListAsync(cancellationToken);

            if (scopedLecturerCodes.Count == 0)
            {
                return new List<LecturerDefenseListItemDto>();
            }

            var lecturerProfiles = await _uow.LecturerProfiles.Query().AsNoTracking()
                .Where(x => scopedLecturerCodes.Contains(x.LecturerCode))
                .ToListAsync(cancellationToken);

            var profileMap = lecturerProfiles
                .GroupBy(x => x.LecturerCode, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    g => g.Key,
                    g => g.OrderByDescending(x => x.LastUpdated ?? x.CreatedAt).First(),
                    StringComparer.OrdinalIgnoreCase);

            var supervisorTopicRows = await _uow.Topics.Query().AsNoTracking()
                .Where(x => x.DefenseTermId == defenseTermId
                    && !string.IsNullOrWhiteSpace(x.SupervisorLecturerCode)
                    && scopedLecturerCodes.Contains(x.SupervisorLecturerCode!))
                .Select(x => new
                {
                    x.SupervisorLecturerCode,
                    x.Status
                })
                .ToListAsync(cancellationToken);

            var guidedTopicCountMap = supervisorTopicRows
                .Where(x => !string.IsNullOrWhiteSpace(x.SupervisorLecturerCode) && IsDefenseEligibleTopicStatus(x.Status))
                .GroupBy(x => x.SupervisorLecturerCode!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.Count(), StringComparer.OrdinalIgnoreCase);

            var committeeRows = await _uow.Committees.Query().AsNoTracking()
                .Where(x => x.DefenseTermId == defenseTermId)
                .Join(
                    _uow.CommitteeMembers.Query().AsNoTracking(),
                    c => c.CommitteeID,
                    m => m.CommitteeID,
                    (c, m) => new
                    {
                        m.MemberLecturerCode,
                        m.Role,
                        c.CommitteeID
                    })
                .Where(x => !string.IsNullOrWhiteSpace(x.MemberLecturerCode) && scopedLecturerCodes.Contains(x.MemberLecturerCode!))
                .ToListAsync(cancellationToken);

            var committeeCountMap = committeeRows
                .GroupBy(x => x.MemberLecturerCode!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(v => v.CommitteeID).Distinct().Count(),
                    StringComparer.OrdinalIgnoreCase);

            var committeeRoleMap = committeeRows
                .GroupBy(x => x.MemberLecturerCode!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    g => g.Key,
                    g => g
                        .Select(v => string.IsNullOrWhiteSpace(v.Role) ? "N/A" : v.Role.Trim().ToUpperInvariant())
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .OrderBy(v => v)
                        .ToList(),
                    StringComparer.OrdinalIgnoreCase);

            var lecturerTagRows = await _uow.LecturerTags.Query().AsNoTracking()
                .Where(x => x.LecturerCode != null && scopedLecturerCodes.Contains(x.LecturerCode))
                .Join(
                    _uow.Tags.Query().AsNoTracking(),
                    lt => lt.TagID,
                    tg => tg.TagID,
                    (lt, tg) => new
                    {
                        lt.LecturerCode,
                        tg.TagCode,
                        tg.TagName
                    })
                .ToListAsync(cancellationToken);

            var lecturerTagCodeMap = lecturerTagRows
                .Where(x => !string.IsNullOrWhiteSpace(x.LecturerCode))
                .GroupBy(x => x.LecturerCode!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(v => v.TagCode).Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(v => v).ToList(),
                    StringComparer.OrdinalIgnoreCase);

            var lecturerTagNameMap = lecturerTagRows
                .Where(x => !string.IsNullOrWhiteSpace(x.LecturerCode))
                .GroupBy(x => x.LecturerCode!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    g => g.Key,
                    g => g
                        .Select(v => string.IsNullOrWhiteSpace(v.TagName) ? v.TagCode : v.TagName!)
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .OrderBy(v => v)
                        .ToList(),
                    StringComparer.OrdinalIgnoreCase);

            IEnumerable<LecturerDefenseListItemDto> query = scopedLecturerCodes
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(x => x)
                .Select(code =>
                {
                    profileMap.TryGetValue(code, out var profile);
                    guidedTopicCountMap.TryGetValue(code, out var guidedTopicCount);
                    committeeCountMap.TryGetValue(code, out var committeeCount);

                    return new LecturerDefenseListItemDto
                    {
                        LecturerProfileID = profile?.LecturerProfileID ?? 0,
                        LecturerCode = code,
                        UserCode = profile?.UserCode,
                        DepartmentCode = profile?.DepartmentCode,
                        Degree = profile?.Degree,
                        GuideQuota = profile?.GuideQuota ?? 0,
                        DefenseQuota = profile?.DefenseQuota ?? 0,
                        CurrentGuidingCount = profile?.CurrentGuidingCount ?? 0,
                        Gender = profile?.Gender,
                        DateOfBirth = profile?.DateOfBirth,
                        Email = profile?.Email,
                        PhoneNumber = profile?.PhoneNumber,
                        ProfileImage = profile?.ProfileImage,
                        Address = profile?.Address,
                        Notes = profile?.Notes,
                        FullName = string.IsNullOrWhiteSpace(profile?.FullName) ? code : profile!.FullName,
                        CreatedAt = profile?.CreatedAt,
                        LastUpdated = profile?.LastUpdated,
                        TagCodes = lecturerTagCodeMap.TryGetValue(code, out var tagCodes)
                            ? tagCodes
                            : new List<string>(),
                        Tags = lecturerTagNameMap.TryGetValue(code, out var tagNames)
                            ? tagNames
                            : new List<string>(),
                        IsInCapabilityPool = true,
                        IsSupervisor = guidedTopicCount > 0,
                        IsCommitteeMember = committeeCount > 0,
                        GuidedTopicCount = guidedTopicCount,
                        CommitteeCount = committeeCount,
                        CommitteeRoles = committeeRoleMap.TryGetValue(code, out var roles)
                            ? roles
                            : new List<string>(),
                        Warnings = lecturerTagNameMap.TryGetValue(code, out var existingTags) && existingTags.Count > 0
                            ? new List<string>()
                            : new List<string> { "Thiếu tag chuyên môn" }
                    };
                });

            query = normalizedSource switch
            {
                "committee" => query.Where(x => x.IsCommitteeMember),
                "supervisor" => query.Where(x => x.IsSupervisor),
                _ => query
            };

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                var normalizedKeyword = NormalizeKeyword(keyword);
                query = query.Where(x =>
                    NormalizeKeyword(x.LecturerCode).Contains(normalizedKeyword)
                    || NormalizeKeyword(x.FullName).Contains(normalizedKeyword)
                    || NormalizeKeyword(x.Degree).Contains(normalizedKeyword)
                    || x.Tags.Any(tag => NormalizeKeyword(tag).Contains(normalizedKeyword))
                    || x.CommitteeRoles.Any(role => NormalizeKeyword(role).Contains(normalizedKeyword)));
            }

            return query.OrderBy(x => x.LecturerCode).ToList();
        }

        private async Task<bool> DefensePeriodExistsAsync(int periodId, CancellationToken cancellationToken)
        {
            var period = await _uow.DefenseTerms.Query().AsNoTracking()
                .Where(x => x.DefenseTermId == periodId)
                .Select(x => (int?)x.DefenseTermId)
                .FirstOrDefaultAsync(cancellationToken);

            return period.HasValue;
        }

        private async Task<(bool Success, int StatusCode, string? Message, string? Code, CurrentDefenseTermContextDto? Period)> ResolveCurrentLecturerPeriodAsync(CancellationToken cancellationToken)
        {
            var requestUserCode = (GetRequestUserCode() ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(requestUserCode) && CurrentUserId <= 0)
            {
                return (false, 401, "Không xác định được người dùng hiện tại.", "AUTH.USER_CONTEXT_MISSING", null);
            }

            var profile = await _uow.LecturerProfiles.Query().AsNoTracking()
                .Where(x =>
                    (CurrentUserId > 0 && x.UserID == CurrentUserId)
                    || (!string.IsNullOrWhiteSpace(requestUserCode)
                        && ((x.UserCode != null && x.UserCode == requestUserCode)
                            || x.LecturerCode == requestUserCode)))
                .OrderByDescending(x => x.LastUpdated ?? x.CreatedAt)
                .Select(x => new
                {
                    x.LecturerProfileID,
                    x.LecturerCode,
                    x.UserCode
                })
                .FirstOrDefaultAsync(cancellationToken);

            if (profile == null)
            {
                return (false, 404, "Không tìm thấy hồ sơ giảng viên tương ứng với tài khoản hiện tại.", "DEFENSE_PERIOD_PROFILE_NOT_FOUND", null);
            }

            var profileLecturerCode = profile.LecturerCode?.Trim() ?? string.Empty;
            var profileUserCode = string.IsNullOrWhiteSpace(profile.UserCode) ? null : profile.UserCode.Trim();

            var periodIds = await _uow.DefenseTermLecturers.Query().AsNoTracking()
                .Where(x =>
                    x.LecturerProfileID == profile.LecturerProfileID
                    || x.LecturerCode == profileLecturerCode
                    || (!string.IsNullOrWhiteSpace(profileUserCode) && x.UserCode == profileUserCode)
                    || (!string.IsNullOrWhiteSpace(requestUserCode) && (x.UserCode == requestUserCode || x.LecturerCode == requestUserCode)))
                .Select(x => x.DefenseTermId)
                .Distinct()
                .ToListAsync(cancellationToken);

            if (periodIds.Count == 0)
            {
                return (false, 404, "Giảng viên chưa được gán vào đợt đồ án tốt nghiệp nào.", "DEFENSE_PERIOD_MAPPING_NOT_FOUND", null);
            }

            var periods = await _uow.DefenseTerms.Query().AsNoTracking()
                .Where(x => periodIds.Contains(x.DefenseTermId))
                .OrderByDescending(x => x.StartDate)
                .ThenByDescending(x => x.DefenseTermId)
                .Select(x => new CurrentDefenseTermContextDto
                {
                    DefenseTermId = x.DefenseTermId,
                    Name = x.Name,
                    Status = x.Status,
                    StartDate = x.StartDate,
                    EndDate = x.EndDate
                })
                .ToListAsync(cancellationToken);

            var activePeriods = periods
                .Where(x => !string.Equals(x.Status, "Archived", StringComparison.OrdinalIgnoreCase))
                .ToList();

            if (activePeriods.Count == 0)
            {
                return (false, 404, "Giảng viên chưa được gán vào đợt đồ án tốt nghiệp đang hoạt động.", "DEFENSE_PERIOD_ACTIVE_MAPPING_NOT_FOUND", null);
            }

            if (activePeriods.Count > 1)
            {
                var activePeriodIds = string.Join(", ", activePeriods.Select(x => x.DefenseTermId));
                return (false, 409, $"Phát hiện nhiều đợt đồ án tốt nghiệp đang hoạt động cho giảng viên hiện tại ({activePeriodIds}).", "DEFENSE_PERIOD_AMBIGUOUS", null);
            }

            return (true, 200, null, null, activePeriods[0]);
        }

        private ActionResult<ApiResponse<DefenseTermLecturerReadDto>> MapLecturerResult(OperationResult<DefenseTermLecturerReadDto> result)
        {
            if (!result.Success)
            {
                return StatusCode(result.StatusCode, ApiResponse<DefenseTermLecturerReadDto>.Fail(
                    result.ErrorMessage ?? "Yêu cầu thất bại.",
                    result.StatusCode));
            }

            return StatusCode(result.StatusCode == 0 ? 200 : result.StatusCode,
                ApiResponse<DefenseTermLecturerReadDto>.SuccessResponse(result.Data, result.Data == null ? 0 : 1));
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

        private static string EscapeCsv(string? value)
        {
            if (string.IsNullOrEmpty(value))
            {
                return string.Empty;
            }

            if (value.Contains(',') || value.Contains('"') || value.Contains('\n') || value.Contains('\r'))
            {
                return $"\"{value.Replace("\"", "\"\"")}\"";
            }

            return value;
        }

        private async Task<ActionResult<ApiResponse<object>>> GetCommittees(int periodId)
        {
            var lecturerCode = GetRequestUserCode() ?? string.Empty;
            var result = await _getCommitteesQuery.ExecuteAsync(lecturerCode, periodId);
            return FromResult(result);
        }

        private async Task<ActionResult<ApiResponse<List<LecturerCommitteeMinuteDto>>>> GetMinutes(int periodId, int id)
        {
            var result = await _getMinutesQuery.ExecuteAsync(id, periodId);
            return FromResult(result);
        }

        private async Task<ActionResult<ApiResponse<bool>>> SaveMinutes(int periodId, int id, [FromBody] UpdateLecturerMinutesDto request)
        {
            var guard = await _getMinutesQuery.ExecuteAsync(id, periodId);
            if (!guard.Success)
            {
                return StatusCode(guard.HttpStatusCode == 0 ? 400 : guard.HttpStatusCode, ApiResponse<bool>.Fail(guard.Message ?? "Không thể truy vấn biên bản hội đồng.", guard.HttpStatusCode == 0 ? 400 : guard.HttpStatusCode, guard.Errors, guard.Code));
            }

            var lecturerCode = GetRequestUserCode() ?? string.Empty;
            var result = await _saveMinuteCommand.ExecuteAsync(id, request, lecturerCode, CurrentUserId);
            return FromResult(result);
        }

        private async Task<ActionResult<ApiResponse<bool>>> OpenSession(int periodId, int id, [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey = null)
        {
            var guard = await _getMinutesQuery.ExecuteAsync(id, periodId);
            if (!guard.Success)
            {
                return StatusCode(guard.HttpStatusCode == 0 ? 400 : guard.HttpStatusCode, ApiResponse<bool>.Fail(guard.Message ?? "Không thể truy vấn biên bản hội đồng.", guard.HttpStatusCode == 0 ? 400 : guard.HttpStatusCode, guard.Errors, guard.Code));
            }

            var lecturerCode = GetRequestUserCode() ?? string.Empty;
            var result = await _openSessionCommand.ExecuteAsync(id, lecturerCode, CurrentUserId, idempotencyKey);
            return FromResult(result);
        }

        private async Task<ActionResult<ApiResponse<bool>>> SubmitIndependentScore(int periodId, int id, [FromBody] LecturerScoreSubmitDto request, [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey = null)
        {
            var guard = await _getMinutesQuery.ExecuteAsync(id, periodId);
            if (!guard.Success)
            {
                return StatusCode(guard.HttpStatusCode == 0 ? 400 : guard.HttpStatusCode, ApiResponse<bool>.Fail(guard.Message ?? "Không thể truy vấn biên bản hội đồng.", guard.HttpStatusCode == 0 ? 400 : guard.HttpStatusCode, guard.Errors, guard.Code));
            }

            var lecturerCode = GetRequestUserCode() ?? string.Empty;
            var result = await _submitScoreCommand.ExecuteAsync(id, request, lecturerCode, CurrentUserId, idempotencyKey);
            return FromResult(result);
        }

        private async Task<ActionResult<ApiResponse<bool>>> LockSession(int periodId, int id, [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey = null)
        {
            var guard = await _getMinutesQuery.ExecuteAsync(id, periodId);
            if (!guard.Success)
            {
                return StatusCode(guard.HttpStatusCode == 0 ? 400 : guard.HttpStatusCode, ApiResponse<bool>.Fail(guard.Message ?? "Không thể truy vấn biên bản hội đồng.", guard.HttpStatusCode == 0 ? 400 : guard.HttpStatusCode, guard.Errors, guard.Code));
            }

            var lecturerCode = GetRequestUserCode() ?? string.Empty;
            var result = await _lockSessionCommand.ExecuteAsync(id, lecturerCode, CurrentUserId, idempotencyKey);
            return FromResult(result);
        }

        [HttpGet("revisions")]
        [Authorize(Roles = "Lecturer,Head,Secretary")]
        public async Task<ActionResult<ApiResponse<List<object>>>> GetRevisionQueue(int periodId)
        {
            var lecturerCode = GetRequestUserCode() ?? string.Empty;
            var result = await _revisionQueueQuery.ExecuteAsync(lecturerCode, periodId);
            return FromResult(result);
        }

        private async Task<ActionResult<ApiResponse<List<ScoringMatrixRowDto>>>> GetScoringMatrix(int periodId, [FromQuery] int? committeeId = null)
        {
            var result = await _scoringMatrixQuery.ExecuteAsync(periodId, committeeId, isForLecturer: true);
            return FromResult(result);
        }

        private async Task<ActionResult<ApiResponse<List<ScoringProgressDto>>>> GetScoringProgress(int periodId, [FromQuery] int? committeeId = null)
        {
            var result = await _scoringProgressQuery.ExecuteAsync(periodId, committeeId);
            return FromResult(result);
        }

        private async Task<ActionResult<ApiResponse<List<ScoringAlertDto>>>> GetScoringAlerts(int periodId, [FromQuery] int? committeeId = null)
        {
            var result = await _scoringAlertsQuery.ExecuteAsync(periodId, committeeId);
            return FromResult(result);
        }

        private async Task<ActionResult<ApiResponse<bool>>> ApproveRevision(int periodId, int revisionId, string? reason, [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey = null)
        {
            var lecturerCode = GetRequestUserCode() ?? string.Empty;
            var result = await _approveRevisionCommand.ExecuteAsync(revisionId, reason, lecturerCode, CurrentUserId, idempotencyKey);
            return FromResult(result);
        }

        private async Task<ActionResult<ApiResponse<bool>>> RejectRevision(int periodId, int revisionId, [FromBody] RejectRevisionRequestDto request, [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey = null)
        {
            var lecturerCode = GetRequestUserCode() ?? string.Empty;
            var result = await _rejectRevisionCommand.ExecuteAsync(revisionId, request, lecturerCode, CurrentUserId, idempotencyKey);
            return FromResult(result);
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

        private sealed class CurrentDefenseTermContextDto
        {
            public int DefenseTermId { get; set; }
            public string Name { get; set; } = string.Empty;
            public string Status { get; set; } = string.Empty;
            public DateTime StartDate { get; set; }
            public DateTime? EndDate { get; set; }
        }
    }
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Text;
using System.Text.Json;
using ThesisManagement.Api.Application.Common;
using ThesisManagement.Api.Application.Command.DefenseExecution;
using ThesisManagement.Api.Application.Command.DefenseTermStudents;
using ThesisManagement.Api.Application.Query.DefenseExecution;
using ThesisManagement.Api.DTOs;
using ThesisManagement.Api.DTOs.DefensePeriods;
using ThesisManagement.Api.DTOs.DefenseTermStudents.Command;
using ThesisManagement.Api.DTOs.DefenseTermStudents.Query;

namespace ThesisManagement.Api.Controllers
{
    [ApiController]
    [Route("api/defense-periods/{periodId:int}/student")]
    [Authorize]
    public class StudentDefenseController : BaseApiController
    {
        private readonly IGetStudentDefenseInfoQueryV2 _getDefenseInfoQuery;
        private readonly IGetStudentNotificationsQuery _getNotificationsQuery;
        private readonly ISubmitStudentRevisionCommand _submitRevisionCommand;
        private readonly IGetStudentRevisionHistoryQuery _revisionHistoryQuery;
        private readonly ICreateDefenseTermStudentCommand _createDefenseTermStudentCommand;
        private readonly IUpdateDefenseTermStudentCommand _updateDefenseTermStudentCommand;
        private readonly IDeleteDefenseTermStudentCommand _deleteDefenseTermStudentCommand;

        public StudentDefenseController(
            Services.IUnitOfWork uow,
            Services.ICodeGenerator codeGen,
            AutoMapper.IMapper mapper,
            IGetStudentDefenseInfoQueryV2 getDefenseInfoQuery,
            IGetStudentNotificationsQuery getNotificationsQuery,
            ISubmitStudentRevisionCommand submitRevisionCommand,
            IGetStudentRevisionHistoryQuery revisionHistoryQuery,
            ICreateDefenseTermStudentCommand createDefenseTermStudentCommand,
            IUpdateDefenseTermStudentCommand updateDefenseTermStudentCommand,
            IDeleteDefenseTermStudentCommand deleteDefenseTermStudentCommand) : base(uow, codeGen, mapper)
        {
            _getDefenseInfoQuery = getDefenseInfoQuery;
            _getNotificationsQuery = getNotificationsQuery;
            _submitRevisionCommand = submitRevisionCommand;
            _revisionHistoryQuery = revisionHistoryQuery;
            _createDefenseTermStudentCommand = createDefenseTermStudentCommand;
            _updateDefenseTermStudentCommand = updateDefenseTermStudentCommand;
            _deleteDefenseTermStudentCommand = deleteDefenseTermStudentCommand;
        }

        [HttpGet("snapshot")]
        [Authorize(Roles = "Student")]
        public async Task<ActionResult<ApiResponse<object>>> GetStudentSnapshot(int periodId)
        {
            var infoResult = await GetDefenseInfo(periodId);
            if (!TryExtractApiResponse(infoResult, out var info, out var infoStatusCode) || info == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy snapshot sinh viên.", 500));
            }

            if (!info.Success)
            {
                return StatusCode(infoStatusCode, ApiResponse<object>.Fail(
                    info.Message ?? "Không lấy được thông tin đồ án tốt nghiệp.",
                    infoStatusCode,
                    info.Errors,
                    info.Code,
                    info.Warnings,
                    info.AllowedActions));
            }

            var noticesResult = await GetNotifications(periodId);
            if (!TryExtractApiResponse(noticesResult, out var notices, out var noticesStatusCode) || notices == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy snapshot sinh viên.", 500));
            }

            if (!notices.Success)
            {
                return StatusCode(noticesStatusCode, ApiResponse<object>.Fail(
                    notices.Message ?? "Không lấy được thông báo.",
                    noticesStatusCode,
                    notices.Errors,
                    notices.Code,
                    notices.Warnings,
                    notices.AllowedActions));
            }

            var revisionsResult = await GetRevisionHistory(periodId);
            if (!TryExtractApiResponse(revisionsResult, out var revisions, out var revisionsStatusCode) || revisions == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy snapshot sinh viên.", 500));
            }

            if (!revisions.Success)
            {
                return StatusCode(revisionsStatusCode, ApiResponse<object>.Fail(
                    revisions.Message ?? "Không lấy được lịch sử chỉnh sửa.",
                    revisionsStatusCode,
                    revisions.Errors,
                    revisions.Code,
                    revisions.Warnings,
                    revisions.AllowedActions));
            }

            var snapshot = new
            {
                DefenseInfo = info.Data,
                Notifications = notices.Data,
                RevisionHistory = revisions.Data
            };

            return FromResult(ApiResponse<object>.SuccessResponse(snapshot));
        }

        [HttpGet("/api/student-defense/current/snapshot")]
        [Authorize(Roles = "Student")]
        public async Task<ActionResult<ApiResponse<object>>> GetCurrentStudentSnapshot()
        {
            var resolved = await ResolveCurrentStudentPeriodAsync(HttpContext.RequestAborted);
            if (!resolved.Success || resolved.Period == null)
            {
                return StatusCode(resolved.StatusCode, ApiResponse<object>.Fail(
                    resolved.Message ?? "Không thể xác định đợt đồ án tốt nghiệp hiện tại.",
                    resolved.StatusCode,
                    code: resolved.Code));
            }

            var snapshotResult = await GetStudentSnapshot(resolved.Period.DefenseTermId);
            if (!TryExtractApiResponse(snapshotResult, out var snapshot, out var snapshotStatusCode) || snapshot == null)
            {
                return StatusCode(500, ApiResponse<object>.Fail("Không thể lấy snapshot sinh viên.", 500));
            }

            if (!snapshot.Success)
            {
                return StatusCode(snapshotStatusCode, ApiResponse<object>.Fail(
                    snapshot.Message ?? "Không lấy được snapshot sinh viên.",
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

        [HttpPost("revisions")]
        [Consumes("multipart/form-data")]
        [Authorize(Roles = "Student")]
        public async Task<ActionResult<ApiResponse<object>>> SubmitRevisionCompact(int periodId, [FromForm] StudentRevisionSubmissionDto request, [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey = null)
        {
            var result = await SubmitRevision(periodId, request, idempotencyKey);
            return WrapAsObject(result, "SUBMIT_REVISION");
        }

        [HttpGet("/api/StudentDefense/get-list")]
        [Authorize(Roles = "Admin,Head,Secretary")]
        public async Task<ActionResult<ApiResponse<IEnumerable<StudentDefenseListItemDto>>>> GetList(
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

            var data = await BuildStudentDefenseListAsync(defenseTermId, source, keyword, HttpContext.RequestAborted);
            var paged = data
                .Skip((safePage - 1) * safePageSize)
                .Take(safePageSize)
                .ToList();

            return Ok(ApiResponse<IEnumerable<StudentDefenseListItemDto>>.SuccessResponse(paged, data.Count));
        }

        [HttpPost("/api/StudentDefense/create")]
        [Authorize(Roles = "Admin,Head,Secretary")]
        public async Task<ActionResult<ApiResponse<DefenseTermStudentReadDto>>> Create([FromBody] DefenseTermStudentCreateDto request)
        {
            var result = await _createDefenseTermStudentCommand.ExecuteAsync(request);
            return MapStudentResult(result);
        }

        [HttpPost("/api/StudentDefense/create-selected")]
        [Authorize(Roles = "Admin,Head,Secretary")]
        public async Task<ActionResult<ApiResponse<DefenseParticipantBulkOperationResultDto>>> CreateSelected([FromBody] StudentDefenseBulkCreateRequestDto request)
        {
            if (request.DefenseTermId <= 0)
            {
                return BadRequest(ApiResponse<object>.Fail("Thiếu defenseTermId hợp lệ.", 400));
            }

            var normalizedCodes = request.StudentCodes
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var normalizedProfileIds = request.StudentProfileIds
                .Where(x => x > 0)
                .Distinct()
                .ToList();

            if (normalizedCodes.Count == 0 && normalizedProfileIds.Count == 0)
            {
                return BadRequest(ApiResponse<object>.Fail("Danh sách sinh viên được chọn đang rỗng.", 400));
            }

            var candidates = await _uow.StudentProfiles.Query().AsNoTracking()
                .Where(x => normalizedProfileIds.Contains(x.StudentProfileID) || normalizedCodes.Contains(x.StudentCode))
                .OrderBy(x => x.StudentCode)
                .ToListAsync();

            var resultItems = new List<DefenseParticipantBulkOperationItemDto>();

            var foundIds = candidates.Select(x => x.StudentProfileID).ToHashSet();
            foreach (var profileId in normalizedProfileIds.Where(id => !foundIds.Contains(id)))
            {
                resultItems.Add(new DefenseParticipantBulkOperationItemDto
                {
                    Key = $"StudentProfileID:{profileId}",
                    Success = false,
                    Message = "Không tìm thấy sinh viên profile tương ứng."
                });
            }

            var foundCodes = candidates
                .Where(x => !string.IsNullOrWhiteSpace(x.StudentCode))
                .Select(x => x.StudentCode)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            foreach (var code in normalizedCodes.Where(c => !foundCodes.Contains(c)))
            {
                resultItems.Add(new DefenseParticipantBulkOperationItemDto
                {
                    Key = code,
                    Success = false,
                    Message = "Không tìm thấy sinh viên profile tương ứng."
                });
            }

            foreach (var student in candidates
                .GroupBy(x => x.StudentCode, StringComparer.OrdinalIgnoreCase)
                .Select(g => g.First())
                .OrderBy(x => x.StudentCode))
            {
                var createDto = new DefenseTermStudentCreateDto(
                    request.DefenseTermId,
                    student.StudentProfileID,
                    student.StudentCode,
                    student.UserCode,
                    null,
                    null);

                var createResult = await _createDefenseTermStudentCommand.ExecuteAsync(createDto);
                resultItems.Add(new DefenseParticipantBulkOperationItemDto
                {
                    Key = student.StudentCode,
                    Success = createResult.Success,
                    Id = createResult.Data?.DefenseTermStudentID,
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

        [HttpPut("/api/StudentDefense/update/{id:int}")]
        [Authorize(Roles = "Admin,Head,Secretary")]
        public async Task<ActionResult<ApiResponse<DefenseTermStudentReadDto>>> Update(int id, [FromBody] DefenseTermStudentUpdateDto request)
        {
            var result = await _updateDefenseTermStudentCommand.ExecuteAsync(id, request);
            return MapStudentResult(result);
        }

        [HttpDelete("/api/StudentDefense/delete/{id:int}")]
        [Authorize(Roles = "Admin,Head,Secretary")]
        public async Task<ActionResult<ApiResponse<object>>> Delete(int id)
        {
            var result = await _deleteDefenseTermStudentCommand.ExecuteAsync(id);
            if (!result.Success)
            {
                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(
                    result.ErrorMessage ?? "Xóa sinh viên đợt đồ án tốt nghiệp thất bại.",
                    result.StatusCode));
            }

            return Ok(ApiResponse<object>.SuccessResponse(new
            {
                Id = id,
                Message = result.Data
            }));
        }

        [HttpGet("/api/StudentDefense/export")]
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

            var rows = await BuildStudentDefenseListAsync(defenseTermId, source, keyword, HttpContext.RequestAborted);
            var sb = new StringBuilder();
            sb.AppendLine("StudentProfileID,StudentCode,FullName,ClassCode,FacultyCode,TopicCode,TopicTitle,TopicStatus,SupervisorCode,SupervisorName,TopicTags,IsEligibleForDefense,IsAssignedToCouncil,CommitteeCode");

            foreach (var row in rows)
            {
                sb.AppendLine(string.Join(",",
                    EscapeCsv(row.StudentProfileID.ToString()),
                    EscapeCsv(row.StudentCode),
                    EscapeCsv(row.FullName),
                    EscapeCsv(row.ClassCode),
                    EscapeCsv(row.FacultyCode),
                    EscapeCsv(row.TopicCode),
                    EscapeCsv(row.TopicTitle),
                    EscapeCsv(row.TopicStatus),
                    EscapeCsv(row.SupervisorCode),
                    EscapeCsv(row.SupervisorName),
                    EscapeCsv(string.Join("|", row.TopicTags)),
                    EscapeCsv(row.IsEligibleForDefense ? "1" : "0"),
                    EscapeCsv(row.IsAssignedToCouncil ? "1" : "0"),
                    EscapeCsv(row.CommitteeCode)));
            }

            var content = Encoding.UTF8.GetBytes(sb.ToString());
            var fileName = $"student-defense-{defenseTermId}-{DateTime.UtcNow:yyyyMMddHHmmss}.csv";
            return File(content, "text/csv; charset=utf-8", fileName);
        }

        private async Task<List<StudentDefenseListItemDto>> BuildStudentDefenseListAsync(
            int defenseTermId,
            string source,
            string? keyword,
            CancellationToken cancellationToken)
        {
            var normalizedSource = string.IsNullOrWhiteSpace(source)
                ? "all"
                : source.Trim().ToLowerInvariant();

            var periodStudents = await _uow.DefenseTermStudents.Query().AsNoTracking()
                .Where(x => x.DefenseTermId == defenseTermId && !string.IsNullOrWhiteSpace(x.StudentCode))
                .Select(x => x.StudentCode)
                .Distinct()
                .ToListAsync(cancellationToken);

            if (periodStudents.Count == 0)
            {
                return new List<StudentDefenseListItemDto>();
            }

            var studentProfiles = await _uow.StudentProfiles.Query().AsNoTracking()
                .Where(x => periodStudents.Contains(x.StudentCode))
                .ToListAsync(cancellationToken);

            var studentProfileMap = studentProfiles
                .GroupBy(x => x.StudentCode, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    g => g.Key,
                    g => g.OrderByDescending(x => x.LastUpdated ?? x.CreatedAt).First(),
                    StringComparer.OrdinalIgnoreCase);

            var periodTopics = await _uow.Topics.Query().AsNoTracking()
                .Where(x => x.DefenseTermId == defenseTermId
                    && !string.IsNullOrWhiteSpace(x.ProposerStudentCode)
                    && periodStudents.Contains(x.ProposerStudentCode!))
                .OrderByDescending(x => x.LastUpdated ?? x.CreatedAt)
                .ThenBy(x => x.TopicCode)
                .ToListAsync(cancellationToken);

            var topicByStudent = periodTopics
                .Where(x => !string.IsNullOrWhiteSpace(x.ProposerStudentCode))
                .GroupBy(x => x.ProposerStudentCode!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    g => g.Key,
                    g => g.First(),
                    StringComparer.OrdinalIgnoreCase);

            var topicCodes = periodTopics
                .Where(x => !string.IsNullOrWhiteSpace(x.TopicCode))
                .Select(x => x.TopicCode)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var assignments = await _uow.DefenseAssignments.Query().AsNoTracking()
                .Where(x => x.DefenseTermId == defenseTermId && x.TopicCode != null && topicCodes.Contains(x.TopicCode))
                .OrderByDescending(x => x.LastUpdated)
                .ToListAsync(cancellationToken);

            var assignmentByTopicCode = assignments
                .GroupBy(x => x.TopicCode!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    g => g.Key,
                    g => g.First(),
                    StringComparer.OrdinalIgnoreCase);

            var committeeIds = assignments
                .Where(x => x.CommitteeID.HasValue)
                .Select(x => x.CommitteeID!.Value)
                .Distinct()
                .ToList();

            var committeeCodeMap = committeeIds.Count == 0
                ? new Dictionary<int, string>()
                : (await _uow.Committees.Query().AsNoTracking()
                    .Where(x => committeeIds.Contains(x.CommitteeID))
                    .Select(x => new { x.CommitteeID, x.CommitteeCode })
                    .ToListAsync(cancellationToken))
                    .ToDictionary(x => x.CommitteeID, x => x.CommitteeCode ?? string.Empty);

            var supervisorCodes = periodTopics
                .Where(x => !string.IsNullOrWhiteSpace(x.SupervisorLecturerCode))
                .Select(x => x.SupervisorLecturerCode!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var supervisorNameMap = supervisorCodes.Count == 0
                ? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                : (await _uow.LecturerProfiles.Query().AsNoTracking()
                    .Where(x => supervisorCodes.Contains(x.LecturerCode))
                    .Select(x => new { x.LecturerCode, x.FullName })
                    .ToListAsync(cancellationToken))
                    .ToDictionary(
                        x => x.LecturerCode,
                        x => string.IsNullOrWhiteSpace(x.FullName) ? x.LecturerCode : x.FullName!,
                        StringComparer.OrdinalIgnoreCase);

            var topicTagRows = topicCodes.Count == 0
                ? new List<(string TopicCode, string TagName)>()
                : (await _uow.TopicTags.Query().AsNoTracking()
                    .Where(x => x.TopicCode != null && topicCodes.Contains(x.TopicCode))
                    .Join(
                        _uow.Tags.Query().AsNoTracking(),
                        tt => tt.TagID,
                        tg => tg.TagID,
                        (tt, tg) => new
                        {
                            tt.TopicCode,
                            tg.TagCode,
                            tg.TagName
                        })
                    .ToListAsync(cancellationToken))
                    .Where(x => !string.IsNullOrWhiteSpace(x.TopicCode))
                    .Select(x => (
                        TopicCode: x.TopicCode!,
                        TagName: string.IsNullOrWhiteSpace(x.TagName) ? x.TagCode : x.TagName!))
                    .ToList();

            var topicTagNameMap = topicTagRows
                .GroupBy(x => x.TopicCode, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(v => v.TagName).Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(v => v).ToList(),
                    StringComparer.OrdinalIgnoreCase);

            IEnumerable<StudentDefenseListItemDto> query = periodStudents
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(x => x)
                .Select(studentCode =>
                {
                    studentProfileMap.TryGetValue(studentCode, out var profile);
                    topicByStudent.TryGetValue(studentCode, out var topic);

                    Models.DefenseAssignment? assignment = null;
                    if (!string.IsNullOrWhiteSpace(topic?.TopicCode))
                    {
                        assignmentByTopicCode.TryGetValue(topic.TopicCode, out assignment);
                    }

                    var isEligible = topic != null && IsDefenseEligibleTopicStatus(topic.Status);

                    var supervisorName = string.IsNullOrWhiteSpace(topic?.SupervisorLecturerCode)
                        ? string.Empty
                        : (supervisorNameMap.TryGetValue(topic.SupervisorLecturerCode, out var name)
                            ? name
                            : topic.SupervisorLecturerCode);

                    var committeeCode = assignment?.CommitteeCode;
                    if (string.IsNullOrWhiteSpace(committeeCode)
                        && assignment?.CommitteeID != null
                        && committeeCodeMap.TryGetValue(assignment.CommitteeID.Value, out var mappedCommitteeCode))
                    {
                        committeeCode = mappedCommitteeCode;
                    }

                    var sourceLabel = assignment is not null
                        ? "ASSIGNED"
                        : (isEligible ? "ELIGIBLE_POOL" : "PERIOD_SCOPE");

                    return new StudentDefenseListItemDto
                    {
                        StudentProfileID = profile?.StudentProfileID ?? 0,
                        StudentCode = studentCode,
                        UserCode = profile?.UserCode,
                        DepartmentCode = profile?.DepartmentCode,
                        ClassCode = profile?.ClassCode,
                        FacultyCode = profile?.FacultyCode,
                        StudentImage = profile?.StudentImage,
                        GPA = profile?.GPA,
                        AcademicStanding = profile?.AcademicStanding,
                        Gender = profile?.Gender,
                        DateOfBirth = profile?.DateOfBirth,
                        PhoneNumber = profile?.PhoneNumber,
                        StudentEmail = profile?.StudentEmail,
                        Address = profile?.Address,
                        EnrollmentYear = profile?.EnrollmentYear,
                        Status = profile?.Status,
                        GraduationYear = profile?.GraduationYear,
                        Notes = profile?.Notes,
                        FullName = string.IsNullOrWhiteSpace(profile?.FullName) ? studentCode : profile!.FullName,
                        CreatedAt = profile?.CreatedAt,
                        LastUpdated = profile?.LastUpdated,
                        TopicCode = topic?.TopicCode,
                        TopicTitle = topic?.Title ?? string.Empty,
                        TopicStatus = topic?.Status,
                        SupervisorCode = topic?.SupervisorLecturerCode,
                        SupervisorName = supervisorName,
                        TopicTags = !string.IsNullOrWhiteSpace(topic?.TopicCode) && topicTagNameMap.TryGetValue(topic.TopicCode, out var tagNames)
                            ? tagNames
                            : new List<string>(),
                        IsEligibleForDefense = isEligible,
                        IsAssignedToCouncil = assignment is not null,
                        CommitteeId = assignment?.CommitteeID,
                        CommitteeCode = committeeCode,
                        AssignmentId = assignment?.AssignmentID,
                        Source = sourceLabel,
                        Error = topic == null
                            ? "Chưa có đề tài trong đợt"
                            : (isEligible ? null : "Đề tài chưa có trạng thái 'Đủ điều kiện đồ án tốt nghiệp'.")
                    };
                });

            query = normalizedSource switch
            {
                "eligible" => query.Where(x => x.IsEligibleForDefense),
                "assigned" => query.Where(x => x.IsAssignedToCouncil),
                _ => query
            };

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                var normalizedKeyword = NormalizeKeyword(keyword);
                query = query.Where(x =>
                    NormalizeKeyword(x.StudentCode).Contains(normalizedKeyword)
                    || NormalizeKeyword(x.FullName).Contains(normalizedKeyword)
                    || NormalizeKeyword(x.ClassCode).Contains(normalizedKeyword)
                    || NormalizeKeyword(x.FacultyCode).Contains(normalizedKeyword)
                    || NormalizeKeyword(x.TopicCode).Contains(normalizedKeyword)
                    || NormalizeKeyword(x.TopicTitle).Contains(normalizedKeyword)
                    || NormalizeKeyword(x.SupervisorCode).Contains(normalizedKeyword)
                    || NormalizeKeyword(x.SupervisorName).Contains(normalizedKeyword)
                    || NormalizeKeyword(x.CommitteeCode).Contains(normalizedKeyword)
                    || x.TopicTags.Any(tag => NormalizeKeyword(tag).Contains(normalizedKeyword)));
            }

            return query
                .OrderByDescending(x => x.IsAssignedToCouncil)
                .ThenBy(x => x.StudentCode)
                .ToList();
        }

        private async Task<bool> DefensePeriodExistsAsync(int periodId, CancellationToken cancellationToken)
        {
            var period = await _uow.DefenseTerms.Query().AsNoTracking()
                .Where(x => x.DefenseTermId == periodId)
                .Select(x => (int?)x.DefenseTermId)
                .FirstOrDefaultAsync(cancellationToken);

            return period.HasValue;
        }

        private async Task<(bool Success, int StatusCode, string? Message, string? Code, CurrentDefenseTermContextDto? Period)> ResolveCurrentStudentPeriodAsync(CancellationToken cancellationToken)
        {
            var requestUserCode = (GetRequestUserCode() ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(requestUserCode) && CurrentUserId <= 0)
            {
                return (false, 401, "Không xác định được người dùng hiện tại.", "AUTH.USER_CONTEXT_MISSING", null);
            }

            var profile = await _uow.StudentProfiles.Query().AsNoTracking()
                .Where(x =>
                    (CurrentUserId > 0 && x.UserID == CurrentUserId)
                    || (!string.IsNullOrWhiteSpace(requestUserCode)
                        && ((x.UserCode != null && x.UserCode == requestUserCode)
                            || x.StudentCode == requestUserCode)))
                .OrderByDescending(x => x.LastUpdated ?? x.CreatedAt)
                .Select(x => new
                {
                    x.StudentProfileID,
                    x.StudentCode,
                    x.UserCode
                })
                .FirstOrDefaultAsync(cancellationToken);

            if (profile == null)
            {
                return (false, 404, "Không tìm thấy hồ sơ sinh viên tương ứng với tài khoản hiện tại.", "DEFENSE_PERIOD_PROFILE_NOT_FOUND", null);
            }

            var profileStudentCode = profile.StudentCode?.Trim() ?? string.Empty;
            var profileUserCode = string.IsNullOrWhiteSpace(profile.UserCode) ? null : profile.UserCode.Trim();

            var periodIds = await _uow.DefenseTermStudents.Query().AsNoTracking()
                .Where(x =>
                    x.StudentProfileID == profile.StudentProfileID
                    || x.StudentCode == profileStudentCode
                    || (!string.IsNullOrWhiteSpace(profileUserCode) && x.UserCode == profileUserCode)
                    || (!string.IsNullOrWhiteSpace(requestUserCode) && (x.UserCode == requestUserCode || x.StudentCode == requestUserCode)))
                .Select(x => x.DefenseTermId)
                .Distinct()
                .ToListAsync(cancellationToken);

            if (periodIds.Count == 0)
            {
                return (false, 404, "Sinh viên chưa được gán vào đợt đồ án tốt nghiệp nào.", "DEFENSE_PERIOD_MAPPING_NOT_FOUND", null);
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
                return (false, 404, "Sinh viên chưa được gán vào đợt đồ án tốt nghiệp đang hoạt động.", "DEFENSE_PERIOD_ACTIVE_MAPPING_NOT_FOUND", null);
            }

            if (activePeriods.Count > 1)
            {
                var activePeriodIds = string.Join(", ", activePeriods.Select(x => x.DefenseTermId));
                return (false, 409, $"Phát hiện nhiều đợt đồ án tốt nghiệp đang hoạt động cho sinh viên hiện tại ({activePeriodIds}).", "DEFENSE_PERIOD_AMBIGUOUS", null);
            }

            return (true, 200, null, null, activePeriods[0]);
        }

        private ActionResult<ApiResponse<DefenseTermStudentReadDto>> MapStudentResult(OperationResult<DefenseTermStudentReadDto> result)
        {
            if (!result.Success)
            {
                return StatusCode(result.StatusCode, ApiResponse<DefenseTermStudentReadDto>.Fail(
                    result.ErrorMessage ?? "Yêu cầu thất bại.",
                    result.StatusCode));
            }

            return StatusCode(result.StatusCode == 0 ? 200 : result.StatusCode,
                ApiResponse<DefenseTermStudentReadDto>.SuccessResponse(result.Data, result.Data == null ? 0 : 1));
        }

        private async Task<string> ResolveRequestStudentCodeAsync(CancellationToken cancellationToken)
        {
            var requestUserCode = (GetRequestUserCode() ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(requestUserCode) && CurrentUserId <= 0)
            {
                return string.Empty;
            }

            var requestUserCodeUpper = requestUserCode.ToUpperInvariant();
            var profile = await _uow.StudentProfiles.Query().AsNoTracking()
                .Where(x =>
                    (CurrentUserId > 0 && x.UserID == CurrentUserId)
                    || (!string.IsNullOrWhiteSpace(requestUserCode)
                        && ((x.UserCode != null && x.UserCode.ToUpper() == requestUserCodeUpper)
                            || x.StudentCode.ToUpper() == requestUserCodeUpper)))
                .OrderByDescending(x => x.LastUpdated ?? x.CreatedAt)
                .Select(x => new
                {
                    x.StudentCode
                })
                .FirstOrDefaultAsync(cancellationToken);

            if (profile == null || string.IsNullOrWhiteSpace(profile.StudentCode))
            {
                return requestUserCode;
            }

            return profile.StudentCode.Trim();
        }

        private async Task<ActionResult<ApiResponse<StudentDefenseInfoDtoV2>>> GetDefenseInfo(int periodId)
        {
            var studentCode = await ResolveRequestStudentCodeAsync(HttpContext.RequestAborted);
            var result = await _getDefenseInfoQuery.ExecuteAsync(studentCode, periodId);
            return FromResult(result);
        }

        private async Task<ActionResult<ApiResponse<List<StudentNotificationDto>>>> GetNotifications(int periodId)
        {
            var studentCode = await ResolveRequestStudentCodeAsync(HttpContext.RequestAborted);
            var result = await _getNotificationsQuery.ExecuteAsync(studentCode, periodId);
            return FromResult(result);
        }

        private async Task<ActionResult<ApiResponse<bool>>> SubmitRevision(int periodId, [FromForm] StudentRevisionSubmissionDto request, [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey = null)
        {
            var validPeriodAssignment = await IsAssignmentInPeriodAsync(periodId, request.AssignmentId);
            if (!validPeriodAssignment)
            {
                var fail = ApiResponse<bool>.Fail("Assignment không thuộc đợt đồ án tốt nghiệp.", 404, code: DefenseUcErrorCodes.Revision.AssignmentNotInPeriod);
                return FromResult(fail);
            }

            var studentCode = await ResolveRequestStudentCodeAsync(HttpContext.RequestAborted);
            var result = await _submitRevisionCommand.ExecuteAsync(request, studentCode, CurrentUserId, idempotencyKey);
            return FromResult(result);
        }

        private async Task<ActionResult<ApiResponse<List<object>>>> GetRevisionHistory(int periodId)
        {
            var studentCode = await ResolveRequestStudentCodeAsync(HttpContext.RequestAborted);
            var result = await _revisionHistoryQuery.ExecuteAsync(studentCode, periodId);
            return FromResult(result);
        }

        private async Task<bool> IsAssignmentInPeriodAsync(int periodId, int assignmentId)
        {
            var assignment = await _uow.DefenseAssignments.GetByIdAsync(assignmentId);
            if (assignment == null)
            {
                return false;
            }

            if (assignment.DefenseTermId == periodId)
            {
                return true;
            }

            if (assignment.CommitteeID.HasValue)
            {
                var committeeMatchedByFk = await _uow.Committees.Query()
                    .AsNoTracking()
                    .Where(x => x.CommitteeID == assignment.CommitteeID.Value && x.DefenseTermId == periodId)
                    .Select(x => (int?)x.CommitteeID)
                    .FirstOrDefaultAsync() != null;

                if (committeeMatchedByFk)
                {
                    return true;
                }
            }

            var period = await _uow.DefenseTerms.GetByIdAsync(periodId);
            if (period == null || string.IsNullOrWhiteSpace(period.ConfigJson) || !assignment.CommitteeID.HasValue)
            {
                return false;
            }

            try
            {
                using var doc = JsonDocument.Parse(period.ConfigJson);
                if (!doc.RootElement.TryGetProperty("CouncilIds", out var councils) || councils.ValueKind != JsonValueKind.Array)
                {
                    return false;
                }

                foreach (var item in councils.EnumerateArray())
                {
                    if (item.ValueKind == JsonValueKind.Number && item.GetInt32() == assignment.CommitteeID.Value)
                    {
                        return true;
                    }
                }
            }
            catch
            {
                return false;
            }

            return false;
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

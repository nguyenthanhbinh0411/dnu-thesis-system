using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Primitives;
using ThesisManagement.Api.Application.Command.Reports;
using ThesisManagement.Api.Application.Query.Reports;
using ThesisManagement.Api.DTOs;
using ThesisManagement.Api.DTOs.ProgressSubmissions.Command;
using ThesisManagement.Api.DTOs.Reports.Command;
using ThesisManagement.Api.DTOs.Reports.Query;
using ThesisManagement.Api.Models;
using ThesisManagement.Api.Services;
using ThesisManagement.Api.Services.Reports;

namespace ThesisManagement.Api.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/reports")]
    public class ReportsController : ControllerBase
    {
        private readonly IUnitOfWork _uow;
        private readonly IGetStudentDashboardQuery _getStudentDashboardQuery;
        private readonly IGetStudentProgressHistoryQuery _getStudentProgressHistoryQuery;
        private readonly IGetLecturerSubmissionListQuery _getLecturerSubmissionListQuery;
        private readonly ISubmitStudentProgressReportCommand _submitStudentProgressReportCommand;
        private readonly IReviewLecturerSubmissionCommand _reviewLecturerSubmissionCommand;
        private readonly IProgressEvaluationDocumentService _evaluationService;

        public ReportsController(
            IUnitOfWork uow,
            IGetStudentDashboardQuery getStudentDashboardQuery,
            IGetStudentProgressHistoryQuery getStudentProgressHistoryQuery,
            IGetLecturerSubmissionListQuery getLecturerSubmissionListQuery,
            ISubmitStudentProgressReportCommand submitStudentProgressReportCommand,
            IReviewLecturerSubmissionCommand reviewLecturerSubmissionCommand,
            IProgressEvaluationDocumentService evaluationService)
        {
            _uow = uow;
            _getStudentDashboardQuery = getStudentDashboardQuery;
            _getStudentProgressHistoryQuery = getStudentProgressHistoryQuery;
            _getLecturerSubmissionListQuery = getLecturerSubmissionListQuery;
            _submitStudentProgressReportCommand = submitStudentProgressReportCommand;
            _reviewLecturerSubmissionCommand = reviewLecturerSubmissionCommand;
            _evaluationService = evaluationService;
        }

        [HttpGet("student/dashboard")]
        public async Task<IActionResult> GetStudentDashboard([FromQuery] string userCode)
        {
            var result = await _getStudentDashboardQuery.ExecuteAsync(userCode);
            if (!result.Success)
                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(result.ErrorMessage ?? "Request failed", result.StatusCode));

            return Ok(ApiResponse<StudentDashboardDto>.SuccessResponse(result.Data));
        }

        [HttpGet("student/dashboard/get-list")]
        public async Task<IActionResult> GetStudentDashboardList(
            [FromQuery] StudentDashboardListFilterDto filter)
        {
            var safePage = filter.Page < 0 ? 0 : filter.Page;
            var safePageSize = !filter.PageSize.HasValue || filter.PageSize.Value <= 0
                ? 20
                : Math.Min(filter.PageSize.Value, 100);

            var studentQuery = _uow.StudentProfiles.Query()
                .AsNoTracking()
                .Where(x => !string.IsNullOrWhiteSpace(x.UserCode));

            if (!string.IsNullOrWhiteSpace(filter.Search))
            {
                var keyword = filter.Search.Trim();
                studentQuery = studentQuery.Where(x =>
                    (x.UserCode != null && x.UserCode.Contains(keyword)) ||
                    x.StudentCode.Contains(keyword) ||
                    (x.FullName != null && x.FullName.Contains(keyword)) ||
                    (x.StudentEmail != null && x.StudentEmail.Contains(keyword)) ||
                    (x.PhoneNumber != null && x.PhoneNumber.Contains(keyword)) ||
                    (x.DepartmentCode != null && x.DepartmentCode.Contains(keyword)) ||
                    (x.ClassCode != null && x.ClassCode.Contains(keyword)) ||
                    (x.FacultyCode != null && x.FacultyCode.Contains(keyword)));
            }

            if (!string.IsNullOrWhiteSpace(filter.UserCode))
                studentQuery = studentQuery.Where(x => x.UserCode != null && x.UserCode.Contains(filter.UserCode));

            if (!string.IsNullOrWhiteSpace(filter.StudentCode))
                studentQuery = studentQuery.Where(x => x.StudentCode.Contains(filter.StudentCode));

            if (!string.IsNullOrWhiteSpace(filter.FullName))
                studentQuery = studentQuery.Where(x => x.FullName != null && x.FullName.Contains(filter.FullName));

            if (!string.IsNullOrWhiteSpace(filter.StudentEmail))
                studentQuery = studentQuery.Where(x => x.StudentEmail != null && x.StudentEmail.Contains(filter.StudentEmail));

            if (!string.IsNullOrWhiteSpace(filter.PhoneNumber))
                studentQuery = studentQuery.Where(x => x.PhoneNumber != null && x.PhoneNumber.Contains(filter.PhoneNumber));

            if (!string.IsNullOrWhiteSpace(filter.DepartmentCode))
                studentQuery = studentQuery.Where(x => x.DepartmentCode == filter.DepartmentCode);

            if (!string.IsNullOrWhiteSpace(filter.ClassCode))
                studentQuery = studentQuery.Where(x => x.ClassCode == filter.ClassCode);

            if (!string.IsNullOrWhiteSpace(filter.FacultyCode))
                studentQuery = studentQuery.Where(x => x.FacultyCode == filter.FacultyCode);

            if (!string.IsNullOrWhiteSpace(filter.Status))
                studentQuery = studentQuery.Where(x => x.Status == filter.Status);

            if (!string.IsNullOrWhiteSpace(filter.Gender))
                studentQuery = studentQuery.Where(x => x.Gender == filter.Gender);

            if (filter.EnrollmentYearFrom.HasValue)
                studentQuery = studentQuery.Where(x => x.EnrollmentYear.HasValue && x.EnrollmentYear.Value >= filter.EnrollmentYearFrom.Value);

            if (filter.EnrollmentYearTo.HasValue)
                studentQuery = studentQuery.Where(x => x.EnrollmentYear.HasValue && x.EnrollmentYear.Value <= filter.EnrollmentYearTo.Value);

            if (filter.GraduationYearFrom.HasValue)
                studentQuery = studentQuery.Where(x => x.GraduationYear.HasValue && x.GraduationYear.Value >= filter.GraduationYearFrom.Value);

            if (filter.GraduationYearTo.HasValue)
                studentQuery = studentQuery.Where(x => x.GraduationYear.HasValue && x.GraduationYear.Value <= filter.GraduationYearTo.Value);

            if (filter.MinGpa.HasValue)
                studentQuery = studentQuery.Where(x => x.GPA.HasValue && x.GPA.Value >= filter.MinGpa.Value);

            if (filter.MaxGpa.HasValue)
                studentQuery = studentQuery.Where(x => x.GPA.HasValue && x.GPA.Value <= filter.MaxGpa.Value);

            if (filter.HasTopic.HasValue)
            {
                if (filter.HasTopic.Value)
                {
                    studentQuery = studentQuery.Where(x => x.UserCode != null && _uow.Topics.Query().Any(t => t.ProposerUserCode == x.UserCode));
                }
                else
                {
                    studentQuery = studentQuery.Where(x => x.UserCode != null && !_uow.Topics.Query().Any(t => t.ProposerUserCode == x.UserCode));
                }
            }

            if (!string.IsNullOrWhiteSpace(filter.TopicCode))
            {
                studentQuery = studentQuery.Where(x => x.UserCode != null && _uow.Topics.Query()
                    .Any(t => t.ProposerUserCode == x.UserCode && t.TopicCode.Contains(filter.TopicCode)));
            }

            if (!string.IsNullOrWhiteSpace(filter.TopicStatus))
            {
                studentQuery = studentQuery.Where(x => x.UserCode != null && _uow.Topics.Query()
                    .Any(t => t.ProposerUserCode == x.UserCode && t.Status == filter.TopicStatus));
            }

            if (!string.IsNullOrWhiteSpace(filter.TopicType))
            {
                studentQuery = studentQuery.Where(x => x.UserCode != null && _uow.Topics.Query()
                    .Any(t => t.ProposerUserCode == x.UserCode && t.Type == filter.TopicType));
            }

            if (!string.IsNullOrWhiteSpace(filter.SupervisorLecturerCode))
            {
                studentQuery = studentQuery.Where(x => x.UserCode != null && _uow.Topics.Query()
                    .Any(t => t.ProposerUserCode == x.UserCode && t.SupervisorLecturerCode == filter.SupervisorLecturerCode));
            }

            var totalCount = await studentQuery.CountAsync();

            var students = await studentQuery
                .OrderBy(x => x.StudentCode)
                .ThenBy(x => x.StudentProfileID)
                .Skip(safePage * safePageSize)
                .Take(safePageSize)
                .ToListAsync();

            var items = new List<StudentDashboardListItemDto>();
            foreach (var studentProfile in students)
            {
                var code = studentProfile.UserCode!;
                var result = await _getStudentDashboardQuery.ExecuteAsync(code);
                if (!result.Success)
                    return StatusCode(result.StatusCode, ApiResponse<object>.Fail($"userCode '{code}': {result.ErrorMessage}", result.StatusCode));

                if (result.Data != null)
                {
                    var dashboard = result.Data;
                    var student = MapStudentDetail(studentProfile);

                    items.Add(new StudentDashboardListItemDto(
                        student,
                        dashboard.Topic,
                        dashboard.TopicTags,
                        dashboard.CurrentMilestone,
                        dashboard.Supervisor,
                        dashboard.SupervisorTags,
                        dashboard.CanSubmit,
                        dashboard.BlockReason,
                        dashboard.HasCurrentMilestoneSubmission,
                        dashboard.CurrentMilestoneSubmissionStatus));
                }
            }

            var dto = new StudentDashboardListDto(items, safePage, safePageSize, totalCount);
            return Ok(ApiResponse<StudentDashboardListDto>.SuccessResponse(dto, dto.TotalCount));
        }

        private static StudentDashboardStudentDetailDto MapStudentDetail(StudentProfile x)
            => new(
                x.StudentProfileID,
                x.StudentCode,
                x.UserCode,
                x.FullName,
                x.StudentEmail,
                x.PhoneNumber,
                x.DepartmentCode,
                x.ClassCode,
                x.FacultyCode,
                x.StudentImage,
                x.GPA,
                x.AcademicStanding,
                x.Gender,
                x.DateOfBirth,
                x.Address,
                x.EnrollmentYear,
                x.GraduationYear,
                x.Status,
                x.Notes,
                x.CreatedAt,
                x.LastUpdated);

        [HttpGet("student/progress-history")]
        public async Task<IActionResult> GetStudentProgressHistory(
            [FromQuery] string userCode,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? state = null,
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null,
            [FromQuery] string? milestoneCode = null)
        {
            var filter = new StudentProgressHistoryFilterDto(
                UserCode: userCode,
                Page: page,
                PageSize: pageSize,
                State: state,
                FromDate: fromDate,
                ToDate: toDate,
                MilestoneCode: milestoneCode);

            var result = await _getStudentProgressHistoryQuery.ExecuteAsync(filter);
            if (!result.Success)
                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(result.ErrorMessage ?? "Request failed", result.StatusCode));

            return Ok(ApiResponse<StudentProgressHistoryDto>.SuccessResponse(result.Data, result.Data?.TotalCount ?? 0));
        }

        [HttpPost("student/progress-submit")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> SubmitStudentProgress()
        {
            if (!Request.HasFormContentType)
                return BadRequest(ApiResponse<object>.Fail("Content-Type must be multipart/form-data", 400));

            var form = await Request.ReadFormAsync();

            string Get(string key)
            {
                if (form.TryGetValue(key, out StringValues value) && !StringValues.IsNullOrEmpty(value))
                    return value.ToString();
                return string.Empty;
            }

            var payload = new StudentProgressSubmitFormDto(
                TopicCode: Get("topicCode"),
                MilestoneCode: Get("milestoneCode"),
                StudentUserCode: Get("studentUserCode"),
                StudentProfileCode: string.IsNullOrWhiteSpace(Get("studentProfileCode")) ? null : Get("studentProfileCode"),
                LecturerCode: string.IsNullOrWhiteSpace(Get("lecturerCode")) ? null : Get("lecturerCode"),
                ReportTitle: string.IsNullOrWhiteSpace(Get("reportTitle")) ? null : Get("reportTitle"),
                ReportDescription: string.IsNullOrWhiteSpace(Get("reportDescription")) ? null : Get("reportDescription"),
                AttemptNumber: int.TryParse(Get("attemptNumber"), out var attemptNumber) ? attemptNumber : null);

            var result = await _submitStudentProgressReportCommand.ExecuteAsync(payload, form.Files);
            if (!result.Success)
                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(result.ErrorMessage ?? "Request failed", result.StatusCode));

            return StatusCode(result.StatusCode, ApiResponse<StudentProgressSubmitResultDto>.SuccessResponse(result.Data, 1, result.StatusCode));
        }

        [HttpGet("lecturer/submissions")]
        public async Task<IActionResult> GetLecturerSubmissions(
            [FromQuery] string lecturerCode,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] string? state = null)
        {
            var filter = new LecturerSubmissionFilterDto(
                LecturerCode: lecturerCode,
                Page: page,
                PageSize: pageSize,
                State: state);

            var result = await _getLecturerSubmissionListQuery.ExecuteAsync(filter);
            if (!result.Success)
                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(result.ErrorMessage ?? "Request failed", result.StatusCode));

            return Ok(ApiResponse<LecturerSubmissionListDto>.SuccessResponse(result.Data, result.Data?.TotalCount ?? 0));
        }

        [HttpPut("lecturer/submissions/{submissionId:int}/review")]
        public async Task<IActionResult> ReviewSubmission(int submissionId, [FromBody] ProgressSubmissionUpdateDto dto)
        {
            var result = await _reviewLecturerSubmissionCommand.ExecuteAsync(submissionId, dto);
            if (!result.Success)
                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(result.ErrorMessage ?? "Request failed", result.StatusCode));

            return Ok(ApiResponse<object>.SuccessResponse(result.Data));
        }

        [HttpGet("topics/{topicCode}/export-evaluation")]
        public async Task<IActionResult> ExportEvaluationForm(string topicCode)
        {
            var topic = await _uow.Topics.Query()
                .FirstOrDefaultAsync(x => x.TopicCode == topicCode);

            if (topic == null)
                return NotFound(ApiResponse<object>.Fail("Topic not found", 404));

            var student = await _uow.StudentProfiles.Query()
                .FirstOrDefaultAsync(x => x.StudentCode == topic.ProposerStudentCode);

            var lecturer = await _uow.LecturerProfiles.Query()
                .FirstOrDefaultAsync(x => x.LecturerCode == topic.SupervisorLecturerCode);

            var major = student != null && !string.IsNullOrWhiteSpace(student.DepartmentCode)
                ? await _uow.Departments.Query().FirstOrDefaultAsync(x => x.DepartmentCode == student.DepartmentCode)
                : null;

            var now = DateTime.Now;
            var data = new ProgressEvaluationTemplateDataDto
            {
                LecturerName = lecturer?.FullName,
                LecturerDegree = lecturer?.Degree,
                StudentName = student?.FullName,
                StudentCode = student?.StudentCode,
                ClassName = student?.ClassCode,
                EnrollmentYear = student?.EnrollmentYear?.ToString(),
                MajorName = major?.Name,
                TopicTitle = topic.Title,

                ReviewQuality = topic.ReviewQuality,
                ReviewAttitude = topic.ReviewAttitude,
                ReviewCapability = topic.ReviewCapability,
                ReviewResultProcessing = topic.ReviewResultProcessing,
                ReviewAchievements = topic.ReviewAchievements,
                ReviewLimitations = topic.ReviewLimitations,
                ReviewConclusion = topic.ReviewConclusion,

                NumChapters = topic.NumChapters?.ToString(),
                NumPages = topic.NumPages?.ToString(),
                NumTables = topic.NumTables?.ToString(),
                NumFigures = topic.NumFigures?.ToString(),
                NumReferences = topic.NumReferences?.ToString(),
                NumVnReferences = topic.NumVietnameseReferences?.ToString(),
                NumForeignReferences = topic.NumForeignReferences?.ToString(),

                ScoreNumber = topic.Score?.ToString("F1"),
                ScoreInWords = topic.ScoreInWords,

                Day = now.Day.ToString("D2"),
                Month = now.Month.ToString("D2"),
                Year = now.Year.ToString()
            };

            var fileBytes = await _evaluationService.BuildEvaluationFormAsync(data);
            var fileName = $"Phieu_Danh_Gia_{topicCode}.docx";

            return File(fileBytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", fileName);
        }
    }
}

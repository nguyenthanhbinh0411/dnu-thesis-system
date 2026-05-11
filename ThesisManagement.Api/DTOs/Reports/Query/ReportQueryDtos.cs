using System;
using System.Collections.Generic;

namespace ThesisManagement.Api.DTOs.Reports.Query
{
    public record ReportTagDto(
        string TagCode,
        string TagName);

    public record ReportTopicDto(
        int TopicID,
        string TopicCode,
        string Title,
        string? Summary,
        string Type,
        string Status,
        string? CatalogTopicCode,
        string? SupervisorLecturerCode,
        DateTime? CreatedAt,
        DateTime? LastUpdated,
        decimal? Score,
        string? ReviewQuality = null,
        string? ReviewAttitude = null,
        string? ReviewCapability = null,
        string? ReviewResultProcessing = null,
        string? ReviewAchievements = null,
        string? ReviewLimitations = null,
        string? ReviewConclusion = null,
        string? ScoreInWords = null,
        int? NumChapters = null,
        int? NumPages = null,
        int? NumTables = null,
        int? NumFigures = null,
        int? NumReferences = null,
        int? NumVietnameseReferences = null,
        int? NumForeignReferences = null);

    public record ReportMilestoneDto(
        int MilestoneID,
        string MilestoneCode,
        string? TopicCode,
        string? MilestoneTemplateCode,
        int? Ordinal,
        DateTime? Deadline,
        string? State,
        DateTime? StartedAt,
        DateTime? CompletedAt1,
        DateTime? CompletedAt2,
        DateTime? CompletedAt3,
        DateTime? CompletedAt4,
        DateTime? CompletedAt5);

    public record ReportSupervisorDto(
        int LecturerProfileID,
        string LecturerCode,
        string? FullName,
        string? Degree,
        string? Email,
        string? PhoneNumber,
        string? DepartmentCode,
        int? GuideQuota,
        int? CurrentGuidingCount);

    public record ReportSubmissionFileDto(
        int FileID,
        string? SubmissionCode,
        string FileURL,
        string? FileName,
        long? FileSizeBytes,
        string? MimeType,
        DateTime? UploadedAt,
        string? UploadedByUserCode);

    public record ReportSubmissionDto(
        int SubmissionID,
        string SubmissionCode,
        int? MilestoneID,
        string? MilestoneCode,
        string? StudentUserCode,
        string? StudentProfileCode,
        string? LecturerCode,
        int? Ordinal,
        DateTime? SubmittedAt,
        int? AttemptNumber,
        string? LecturerComment,
        string? LecturerState,
        string? FeedbackLevel,
        string? ReportTitle,
        string? ReportDescription,
        DateTime? LastUpdated,
        IReadOnlyList<ReportSubmissionFileDto> Files);

    public record StudentDashboardDto(
        ReportTopicDto? Topic,
        IReadOnlyList<ReportTagDto> TopicTags,
        ReportMilestoneDto? CurrentMilestone,
        ReportSupervisorDto? Supervisor,
        IReadOnlyList<ReportTagDto> SupervisorTags,
        bool CanSubmit,
        string? BlockReason,
        bool HasCurrentMilestoneSubmission,
        string? CurrentMilestoneSubmissionStatus);

    public record StudentDashboardStudentDetailDto(
        int StudentProfileID,
        string StudentCode,
        string? UserCode,
        string? FullName,
        string? StudentEmail,
        string? PhoneNumber,
        string? DepartmentCode,
        string? ClassCode,
        string? FacultyCode,
        string? StudentImage,
        decimal? GPA,
        string? AcademicStanding,
        string? Gender,
        DateTime? DateOfBirth,
        string? Address,
        int? EnrollmentYear,
        int? GraduationYear,
        string? Status,
        string? Notes,
        DateTime? CreatedAt,
        DateTime? LastUpdated);

    public record StudentDashboardListItemDto(
        StudentDashboardStudentDetailDto? Student,
        ReportTopicDto? Topic,
        IReadOnlyList<ReportTagDto> TopicTags,
        ReportMilestoneDto? CurrentMilestone,
        ReportSupervisorDto? Supervisor,
        IReadOnlyList<ReportTagDto> SupervisorTags,
        bool CanSubmit,
        string? BlockReason,
        bool HasCurrentMilestoneSubmission,
        string? CurrentMilestoneSubmissionStatus);

    public record StudentDashboardListDto(
        IReadOnlyList<StudentDashboardListItemDto> Items,
        int Page,
        int PageSize,
        int TotalCount);

    public class StudentDashboardListFilterDto
    {
        public int Page { get; set; } = 0;
        public int? PageSize { get; set; }

        public string? Search { get; set; }
        public string? UserCode { get; set; }
        public string? StudentCode { get; set; }
        public string? FullName { get; set; }
        public string? StudentEmail { get; set; }
        public string? PhoneNumber { get; set; }
        public string? DepartmentCode { get; set; }
        public string? ClassCode { get; set; }
        public string? FacultyCode { get; set; }
        public string? Status { get; set; }
        public string? Gender { get; set; }
        public int? EnrollmentYearFrom { get; set; }
        public int? EnrollmentYearTo { get; set; }
        public int? GraduationYearFrom { get; set; }
        public int? GraduationYearTo { get; set; }
        public decimal? MinGpa { get; set; }
        public decimal? MaxGpa { get; set; }

        public bool? HasTopic { get; set; }
        public string? TopicCode { get; set; }
        public string? TopicStatus { get; set; }
        public string? TopicType { get; set; }
        public string? SupervisorLecturerCode { get; set; }
    }

    public record StudentProgressHistoryItemDto(
        ReportSubmissionDto Submission,
        bool IsCurrentMilestoneSubmission,
        string? CurrentMilestoneSubmissionStatus);

    public record StudentProgressHistoryDto(
        IReadOnlyList<StudentProgressHistoryItemDto> Items,
        int Page,
        int PageSize,
        int TotalCount);

    public record StudentProgressSubmitResultDto(
        ReportSubmissionDto Submission,
        string Message);

    public record LecturerSubmissionRowDto(
        ReportSubmissionDto Submission,
        ReportStudentDto? Student,
        ReportTopicDto? Topic,
        ReportSupervisorDto? Supervisor);

    public record LecturerSubmissionListDto(
        IReadOnlyList<LecturerSubmissionRowDto> Items,
        int Page,
        int PageSize,
        int TotalCount);

    public record ReportStudentDto(
        int StudentProfileID,
        string StudentCode,
        string? UserCode,
        string? FullName,
        string? StudentEmail,
        string? PhoneNumber,
        string? DepartmentCode,
        string? ClassCode);

    public record StudentProgressHistoryFilterDto(
        string UserCode,
        int Page = 1,
        int PageSize = 10,
        string? State = null,
        DateTime? FromDate = null,
        DateTime? ToDate = null,
        string? MilestoneCode = null);

    public record LecturerSubmissionFilterDto(
        string LecturerCode,
        int Page = 1,
        int PageSize = 20,
        string? State = null);
}

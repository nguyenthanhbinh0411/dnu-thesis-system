namespace ThesisManagement.Api.DTOs.ProgressSubmissions.Command
{
    public record ProgressSubmissionCreateDto(
        int? MilestoneID,
        string MilestoneCode,
        int? StudentUserID,
        string StudentUserCode,
        int? StudentProfileID,
        string? StudentProfileCode,
        int? LecturerProfileID,
        string? LecturerCode,
        int? AttemptNumber,
        string? ReportTitle,
        string? ReportDescription);

    public record ProgressSubmissionUpdateDto(
        string? LecturerComment,
        string? LecturerState,
        string? FeedbackLevel,
        decimal? Score,
        // Evaluation review fields (Phiếu đánh giá)
        string? ReviewQuality = null,
        string? ReviewAttitude = null,
        string? ReviewCapability = null,
        string? ReviewResultProcessing = null,
        string? ReviewAchievements = null,
        string? ReviewLimitations = null,
        string? ReviewConclusion = null,
        string? ScoreInWords = null,
        // structural fields (Kết cấu đồ án)
        int? NumChapters = null,
        int? NumPages = null,
        int? NumTables = null,
        int? NumFigures = null,
        int? NumReferences = null,
        int? NumVietnameseReferences = null,
        int? NumForeignReferences = null);
}
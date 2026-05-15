namespace ThesisManagement.Api.Services.DefenseOperationsExport.Internal
{
    public static class DefenseExportConstants
    {
        public static class Templates
        {
            public const string Dashboard = "dashboard";
            public const string Scoring = "scoring";
            public const string ScoringConfig = "scoring-config";
            public const string PostDefense = "post-defense";
            public const string Councils = "councils";
            public const string Topics = "topics";
        }
    }

    public enum CouncilExportStatus
    {
        Pending,
        Ready,
        Ongoing,
        Locked,
        Completed,
        Published,
        Unknown
    }

    public enum ScoringExportStatus
    {
        Scored,
        Waiting,
        Alert,
        Scoring,
        Locked,
        Unknown
    }

    public enum ResultExportStatus
    {
        Passed,
        Failed,
        Unknown
    }

    public record DefenseExportBrandingOptions
    {
        public string Institution { get; set; } = "TRƯỜNG ĐẠI HỌC ĐẠI NAM";
        public string Department { get; set; } = "KHOA CÔNG NGHỆ THÔNG TIN";
        public string MottoLine1 { get; set; } = "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM";
        public string MottoLine2 { get; set; } = "Độc lập - Tự do - Hạnh phúc";
        public string Signatory1Role { get; set; } = "NGƯỜI LẬP BIỂU";
        public string Signatory1Name { get; set; } = "Nguyễn Thị Hương Giang";
        public string Signatory2Role { get; set; } = "TRƯỞNG KHOA";
        public string Signatory2Name { get; set; } = "Trần Đăng Công";
        public string Location { get; set; } = "Hà Nội";
    }

    public record CouncilExportRow(
        string CommitteeCode,
        string Name,
        string Room,
        string Chair,
        string Secretary,
        string Reviewer,
        int TotalTopics,
        int ScoredTopics,
        int Remaining,
        CouncilExportStatus Status);

    public record ScoringExportRawDto(
        int CommitteeId,
        string CommitteeCode,
        string CommitteeName,
        string StudentCode,
        string StudentName,
        string TopicCode,
        string TopicTitle,
        string SupervisorLecturerName,
        string CommitteeChairName,
        string CommitteeSecretaryName,
        string CommitteeReviewerName,
        decimal? ScoreCt,
        decimal? ScoreTk,
        decimal? ScorePb,
        decimal? ScoreGvhd,
        string? CommentCt,
        string? CommentTk,
        string? CommentPb,
        string? CommentGvhd,
        decimal? FinalScore,
        decimal? Variance,
        ScoringExportStatus Status,
        bool IsLocked,
        int SubmittedCount,
        int RequiredCount,
        int DocumentCount,
        int AssignmentId,
        string? Room = null,
        DateTime? DefenseDate = null,
        string? Session = null,
        string? StartTime = null,
        string? EndTime = null,
        string? ClassName = null,
        string? CohortCode = null,
        string? TopicTags = null,
        string? AssignmentCode = null,
        string? SupervisorLecturerCode = null,
        string? SupervisorOrganization = null,
        string? RevisionReason = null,
        DateTime? SubmissionDeadline = null,
        string? SecretaryComment = null,
        string? CommitteeChairCode = null,
        string? CommitteeSecretaryCode = null,
        string? CommitteeReviewerCode = null);

    public record PostDefenseExportRow(
        int RevisionId,
        string TopicTitle,
        string StudentDisplay,
        string CommitteeCode,
        string ChairName,
        string SecretaryName,
        string FinalStatus,
        string RevisionReason,
        DateTime? SubmissionDeadline,
        string GvhdApproved,
        string UvtkApproved,
        string CtApproved,
        DateTime LastUpdated);

    public record DefenseExportMetrics(
        int TotalCouncils,
        int TotalTopics,
        int ScoredTopics,
        int DefendingTopics,
        int PendingTopics,
        decimal CompletionPercent,
        int ActiveCouncils,
        int WarningCount,
        string CouncilSummary,
        string ScoringSummary,
        string KpiSummary,
        string PostSummary);
}

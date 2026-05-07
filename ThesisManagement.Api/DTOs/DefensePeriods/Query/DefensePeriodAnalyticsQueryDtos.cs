namespace ThesisManagement.Api.DTOs.DefensePeriods
{
    public class AnalyticsOverviewDto
    {
        public int TotalStudents { get; set; }
        public decimal Average { get; set; }
        public decimal PassRate { get; set; }
        public decimal Highest { get; set; }
        public decimal Lowest { get; set; }
        public string? HighestStudentCode { get; set; }
        public string? HighestStudentName { get; set; }
        public string? HighestTopicTitle { get; set; }
        public string? LowestStudentCode { get; set; }
        public string? LowestStudentName { get; set; }
        public string? LowestTopicTitle { get; set; }
    }

    public class CouncilAnalyticsDto
    {
        public int CouncilId { get; set; }
        public string CouncilCode { get; set; } = string.Empty;
        public string? Room { get; set; }
        public int Count { get; set; }
        public decimal Avg { get; set; }
        public decimal Max { get; set; }
        public decimal Min { get; set; }
    }

    public class AnalyticsDistributionDto
    {
        public int Excellent { get; set; }
        public int Good { get; set; }
        public int Fair { get; set; }
        public int Weak { get; set; }
    }

    public class DefenseDocumentDto
    {
        public int DocumentId { get; set; }
        public int AssignmentId { get; set; }
        public string DocumentType { get; set; } = string.Empty;
        public string? FileName { get; set; }
        public string FileUrl { get; set; } = string.Empty;
        public string? MimeType { get; set; }
        public DateTime GeneratedAt { get; set; }
        public DateTime? UploadedAt { get; set; }
    }

    public class ScoringMatrixRowDto
    {
        public int CommitteeId { get; set; }
        public string CommitteeCode { get; set; } = string.Empty;
        public string CommitteeName { get; set; } = string.Empty;
        public string? Room { get; set; }
        public int AssignmentId { get; set; }
        public string AssignmentCode { get; set; } = string.Empty;
        public string TopicCode { get; set; } = string.Empty;
        public string TopicTitle { get; set; } = string.Empty;
        public string? SupervisorLecturerCode { get; set; }
        public string? SupervisorLecturerName { get; set; }
        public string? CommitteeChairCode { get; set; }
        public string? CommitteeChairName { get; set; }
        public string? CommitteeSecretaryCode { get; set; }
        public string? CommitteeSecretaryName { get; set; }
        public string? CommitteeReviewerCode { get; set; }
        public string? CommitteeReviewerName { get; set; }
        public string? Chair { get; set; }
        public string? ChairName { get; set; }
        public string? Secretary { get; set; }
        public string? SecretaryName { get; set; }
        public string? Reviewer { get; set; }
        public string? ReviewerName { get; set; }
        public List<string> TopicTags { get; set; } = new();
        public int? Session { get; set; }
        public string? SessionCode { get; set; }
        public DateTime? ScheduledAt { get; set; }
        public string? StartTime { get; set; }
        public string? EndTime { get; set; }
        public string StudentCode { get; set; } = string.Empty;
        public string StudentName { get; set; } = string.Empty;
        public string? ClassName { get; set; }
        public string? CohortCode { get; set; }
        public string? SupervisorOrganization { get; set; }
        public int SubmittedCount { get; set; }
        public int RequiredCount { get; set; }
        public bool IsLocked { get; set; }
        public decimal? ScoreGvhd { get; set; }
        public decimal? ScoreCt { get; set; }
        public decimal? ScoreTk { get; set; }
        public decimal? ScorePb { get; set; }
        public string? CommentGvhd { get; set; }
        public string? CommentCt { get; set; }
        public string? CommentTk { get; set; }
        public string? CommentPb { get; set; }
        public decimal? TopicSupervisorScore { get; set; }
        public decimal? FinalScore { get; set; }
        public string? FinalGrade { get; set; }
        public decimal? Variance { get; set; }
        public string Status { get; set; } = string.Empty;
        public List<DefenseDocumentDto> DefenseDocuments { get; set; } = new();
    }

    public class ScoringProgressDto
    {
        public int CommitteeId { get; set; }
        public string CommitteeCode { get; set; } = string.Empty;
        public int TotalAssignments { get; set; }
        public int CompletedAssignments { get; set; }
        public int WaitingPublicAssignments { get; set; }
        public decimal ProgressPercent { get; set; }
    }

    public class ScoringAlertDto
    {
        public string AlertCode { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public int CommitteeId { get; set; }
        public string CommitteeCode { get; set; } = string.Empty;
        public int AssignmentId { get; set; }
        public string AssignmentCode { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public decimal? Value { get; set; }
        public decimal? Threshold { get; set; }
    }
}

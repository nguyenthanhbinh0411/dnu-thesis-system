namespace ThesisManagement.Api.DTOs.DefensePeriods
{
    public static class DefenseSessionCodes
    {
        public const string Morning = "MORNING";
        public const string Afternoon = "AFTERNOON";
    }

    public class EligibleStudentDto
    {
        public string StudentCode { get; set; } = string.Empty;
        public string StudentName { get; set; } = string.Empty;
        public string TopicTitle { get; set; } = string.Empty;
        public string? SupervisorCode { get; set; }
        public List<string> Tags { get; set; } = new();
        public bool IsEligible { get; set; }
        public bool Valid { get; set; }
        public string? Error { get; set; }
    }

    public class LecturerCapabilityDto
    {
        public string LecturerCode { get; set; } = string.Empty;
        public string LecturerName { get; set; } = string.Empty;
        public List<string> Tags { get; set; } = new();
        public string? Warning { get; set; }
    }

    public class CouncilMemberDto
    {
        public string Role { get; set; } = string.Empty;
        public string LecturerCode { get; set; } = string.Empty;
        public string LecturerName { get; set; } = string.Empty;
        public string? Degree { get; set; }
        public string? Organization { get; set; }
        public List<string> Tags { get; set; } = new();
    }

    public class CouncilDraftDto
    {
        public int Id { get; set; }
        public string CommitteeCode { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public DateTime? DefenseDate { get; set; }
        public string ConcurrencyToken { get; set; } = string.Empty;
        public string Room { get; set; } = string.Empty;
        public string SlotId { get; set; } = string.Empty;
        public List<string> CouncilTags { get; set; } = new();
        public List<EligibleStudentDto> MorningStudents { get; set; } = new();
        public List<EligibleStudentDto> AfternoonStudents { get; set; } = new();
        public List<CouncilAssignmentDto> Assignments { get; set; } = new();
        public List<string> ForbiddenLecturers { get; set; } = new();
        public List<CouncilMemberDto> Members { get; set; } = new();
        public string? Warning { get; set; }
        public string Status { get; set; } = "Draft";
    }

    public class CouncilAssignmentDto
    {
        public int AssignmentId { get; set; }
        public string AssignmentCode { get; set; } = string.Empty;
        public string TopicCode { get; set; } = string.Empty;
        public string TopicTitle { get; set; } = string.Empty;
        public List<string> Tags { get; set; } = new();
        public string StudentCode { get; set; } = string.Empty;
        public string StudentName { get; set; } = string.Empty;
        public int? Session { get; set; }
        public string SessionCode { get; set; } = string.Empty;
        public DateTime? ScheduledAt { get; set; }
        public string? StartTime { get; set; }
        public string? EndTime { get; set; }
        public int? OrderIndex { get; set; }
        public string Status { get; set; } = string.Empty;
    }

    public class CouncilFilterDto
    {
        public string? Keyword { get; set; }
        public string? Tag { get; set; }
        public string? Room { get; set; }
        public int Page { get; set; } = 1;
        public int Size { get; set; } = 20;
    }

    public class DefensePeriodCalendarCouncilItemDto
    {
        public int CouncilId { get; set; }
        public string CommitteeCode { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Room { get; set; }
        public DateTime DefenseDate { get; set; }
        public string Status { get; set; } = string.Empty;
    }

    public class DefensePeriodCalendarDayDto
    {
        public DateTime Date { get; set; }
        public int CouncilCount { get; set; }
        public List<DefensePeriodCalendarCouncilItemDto> Councils { get; set; } = new();
    }

    public class LecturerCommitteeMinuteDto
    {
        public int CommitteeId { get; set; }
        public string CommitteeCode { get; set; } = string.Empty;
        public int AssignmentId { get; set; }
        public string TopicCode { get; set; } = string.Empty;
        public string TopicTitle { get; set; } = string.Empty;
        public string? SummaryContent { get; set; }
        public string? ReviewerComments { get; set; }
        public string? CommitteeMemberComments { get; set; }
        public string? QnaDetails { get; set; }
        public List<MinuteQuestionAnswerDto> QuestionAnswers { get; set; } = new();
        public string? Strengths { get; set; }
        public string? Weaknesses { get; set; }
        public string? Recommendations { get; set; }
        public List<MinuteChapterInputDto> ChapterContents { get; set; } = new();
        public string? CouncilDiscussionConclusion { get; set; }
        public string? ChairConclusion { get; set; }
        public ReviewerStructuredSectionsDto? ReviewerSections { get; set; }
        public decimal? ScoreGvhd { get; set; }
        public decimal? ScoreCt { get; set; }
        public decimal? ScoreTk { get; set; }
        public decimal? ScorePb { get; set; }
        public decimal? FinalScore { get; set; }
        public string? FinalGrade { get; set; }
        public DateTime? LastUpdated { get; set; }
    }

    public class TopicFinalScoreProgressDto
    {
        public int CommitteeId { get; set; }
        public string CommitteeCode { get; set; } = string.Empty;
        public int TotalTopics { get; set; }
        public int ScoredTopics { get; set; }
        public decimal ProgressPercent { get; set; }
    }

    public class StudentDefenseInfoDtoV2
    {
        public string StudentCode { get; set; } = string.Empty;
        public string StudentName { get; set; } = string.Empty;
        public string TopicCode { get; set; } = string.Empty;
        public string TopicTitle { get; set; } = string.Empty;
        public string? CommitteeCode { get; set; }
        public string? Room { get; set; }
        public DateTime? ScheduledAt { get; set; }
        public int? Session { get; set; }
        public string? SessionCode { get; set; }
        public decimal? FinalScore { get; set; }
        public string? Grade { get; set; }
        public bool CouncilListLocked { get; set; }
        public string CouncilLockStatus { get; set; } = "UNLOCKED";

        // Scoring Details
        public decimal? ScoreGvhd { get; set; }
        public decimal? ScoreCt { get; set; }
        public decimal? ScoreUvtk { get; set; }
        public decimal? ScoreUvpb { get; set; }
        public bool IsScoreLocked { get; set; }

        // Revision info
        public StudentRevisionInfoDto? Revision { get; set; }
    }

    public class StudentRevisionInfoDto
    {
        public int RevisionId { get; set; }
        public int AssignmentId { get; set; }
        public bool NeedsRevision { get; set; }
        public string? RevisionReason { get; set; }
        public string? RequiredContent { get; set; }
        public DateTime? Deadline { get; set; }
        public string? Status { get; set; }
    }

    public class StudentNotificationDto
    {
        public string Type { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; }
    }

    public class TopicTagUsageDto
    {
        public string TopicCode { get; set; } = string.Empty;
        public string TopicTitle { get; set; } = string.Empty;
        public string TagCode { get; set; } = string.Empty;
        public string TagName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }

    public class LecturerTagUsageDto
    {
        public string LecturerCode { get; set; } = string.Empty;
        public string LecturerName { get; set; } = string.Empty;
        public string TagCode { get; set; } = string.Empty;
        public string TagName { get; set; } = string.Empty;
        public DateTime? AssignedAt { get; set; }
    }

    public class CommitteeTagUsageDto
    {
        public int CommitteeId { get; set; }
        public string CommitteeCode { get; set; } = string.Empty;
        public string TagCode { get; set; } = string.Empty;
        public string TagName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }

    public class TagSummaryDto
    {
        public string TagCode { get; set; } = string.Empty;
        public string TagName { get; set; } = string.Empty;
        public int TopicCount { get; set; }
        public int LecturerCount { get; set; }
        public int CommitteeCount { get; set; }
    }

    public class DefensePeriodTagOverviewDto
    {
        public int DistinctTagCount { get; set; }
        public int TopicTagLinks { get; set; }
        public int LecturerTagLinks { get; set; }
        public int CommitteeTagLinks { get; set; }
        public List<TagSummaryDto> Tags { get; set; } = new();
    }

    public class RollbackAvailabilityDto
    {
        public string CurrentPeriodStatus { get; set; } = string.Empty;
        public bool Finalized { get; set; }
        public bool ScoresPublished { get; set; }
        public bool CanRollbackPublish { get; set; }
        public bool CanRollbackFinalize { get; set; }
        public string RecommendedTarget { get; set; } = string.Empty;
        public List<string> Blockers { get; set; } = new();
    }

    public class AutoGenerateConfigDto
    {
        public List<string> AvailableRooms { get; set; } = new();
        public List<string> DefaultSelectedRooms { get; set; } = new();
        public int SoftMaxCapacity { get; set; }
        public int TopicsPerSession { get; set; }
        public int MembersPerCouncil { get; set; }
        public bool LecturerCapabilitiesLocked { get; set; }
        public bool CouncilConfigConfirmed { get; set; }
        public bool Finalized { get; set; }
        public bool ScoresPublished { get; set; }
        public bool CanGenerate { get; set; }
        public List<string> Warnings { get; set; } = new();
        public GenerateCouncilHeuristicWeightsDto DefaultHeuristicWeights { get; set; } = new();
    }

    public class AutoGenerateCoverageStatsDto
    {
        public int EligibleTopics { get; set; }
        public int EstimatedCapacity { get; set; }
        public int EstimatedAssigned { get; set; }
        public decimal CoveragePercent { get; set; }
    }

    public class AutoGenerateSimulationResultDto
    {
        public string Status { get; set; } = string.Empty;
        public bool CanGenerate { get; set; }
        public List<string> AllowedActions { get; set; } = new();
        public List<string> Warnings { get; set; } = new();
        public List<string> Explainability { get; set; } = new();
        public AutoGenerateCoverageStatsDto Coverage { get; set; } = new();
    }
}

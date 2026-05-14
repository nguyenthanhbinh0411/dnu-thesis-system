namespace ThesisManagement.Api.DTOs.DefensePeriods
{
    public class DefensePeriodPipelineOverviewDto
    {
        public int DefenseTermId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateTime StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public int OverallCompletionPercent { get; set; }

        public int TotalTopics { get; set; }
        public int EligibleTopics { get; set; }
        public int AssignedTopics { get; set; }
        public int ScoredTopics { get; set; }
        public int PendingRevisionCount { get; set; }
        public int ApprovedRevisionCount { get; set; }
        public int RejectedRevisionCount { get; set; }

        public List<string> AllowedActions { get; set; } = new();
        public List<string> Warnings { get; set; } = new();
        public List<DefensePeriodPipelineStageDto> Stages { get; set; } = new();
    }

    public class DefensePeriodPipelineStageDto
    {
        public int Sequence { get; set; }
        public string StageKey { get; set; } = string.Empty;
        public string StageName { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public decimal CompletionPercent { get; set; }
        public int TotalCount { get; set; }
        public int CompletedCount { get; set; }
        public string? BlockedReason { get; set; }
    }

    public class DefensePeriodRegistrationOverviewDto
    {
        public int DefenseTermId { get; set; }
        public int TotalTopics { get; set; }
        public int EligibleTopics { get; set; }
        public int MissingStudentCount { get; set; }
        public int MissingSupervisorCount { get; set; }
        public int AssignedTopics { get; set; }
        public int UnassignedEligibleTopics { get; set; }
        public decimal AssignmentCoveragePercent { get; set; }
        public List<DefensePeriodRegistrationTopicItemDto> Items { get; set; } = new();
    }

    public class DefensePeriodRegistrationTopicItemDto
    {
        public int TopicId { get; set; }
        public string TopicCode { get; set; } = string.Empty;
        public string TopicTitle { get; set; } = string.Empty;
        public List<string> Tags { get; set; } = new();
        public string TopicStatus { get; set; } = string.Empty;
        public string? StudentCode { get; set; }
        public string StudentName { get; set; } = string.Empty;
        public string? SupervisorCode { get; set; }
        public string SupervisorName { get; set; } = string.Empty;
        public bool InPeriodStudentPool { get; set; }
        public bool InPeriodLecturerPool { get; set; }
        public bool HasCompletedMilestone { get; set; }
        public bool IsEligibleForDefense { get; set; }
        public bool IsAssignedToCouncil { get; set; }
        public bool HasScoringResult { get; set; }
        public int? AssignmentId { get; set; }
        public int? CommitteeId { get; set; }
        public string? CommitteeCode { get; set; }
        public DateTime? LastMilestoneUpdatedAt { get; set; }
        public DateTime? LastSubmissionAt { get; set; }
    }

    public class DefensePeriodProgressOverviewDto
    {
        public int DefenseTermId { get; set; }
        public int TopicCount { get; set; }
        public int MilestoneCount { get; set; }
        public int CompletedMilestoneCount { get; set; }
        public int OngoingMilestoneCount { get; set; }
        public int OverdueMilestoneCount { get; set; }
        public int SubmissionCount { get; set; }
        public int LecturerReviewedSubmissionCount { get; set; }
        public List<DefensePeriodProgressMilestoneStateCountDto> MilestoneStates { get; set; } = new();
    }

    public class DefensePeriodProgressMilestoneStateCountDto
    {
        public string State { get; set; } = string.Empty;
        public int Count { get; set; }
    }

    public class DefensePeriodPostDefenseOverviewDto
    {
        public int DefenseTermId { get; set; }
        public int TotalRevisions { get; set; }
        public int PendingRevisions { get; set; }
        public int ApprovedRevisions { get; set; }
        public int RejectedRevisions { get; set; }
        public int PublishedScores { get; set; }
        public int LockedScores { get; set; }
        public List<DefensePeriodPostDefenseRevisionItemDto> Items { get; set; } = new();
    }

    public class DefensePeriodPostDefenseRevisionItemDto
    {
        public int RevisionId { get; set; }
        public int AssignmentId { get; set; }
        public string TopicCode { get; set; } = string.Empty;
        public string TopicTitle { get; set; } = string.Empty;
        public string StudentCode { get; set; } = string.Empty;
        public string StudentName { get; set; } = string.Empty;
        public string FinalStatus { get; set; } = string.Empty;
        public string RevisionReason { get; set; } = string.Empty;
        public DateTime? SubmissionDeadline { get; set; }
        public string SecretaryComment { get; set; } = string.Empty;
        public string CommitteeCode { get; set; } = string.Empty;
        public string SecretaryName { get; set; } = string.Empty;
        public string ChairName { get; set; } = string.Empty;
        public bool IsGvhdApproved { get; set; }
        public bool IsUvtkApproved { get; set; }
        public bool IsCtApproved { get; set; }
        public DateTime LastUpdated { get; set; }
    }
}

using System.ComponentModel.DataAnnotations;

namespace ThesisManagement.Api.DTOs.DefensePeriods
{
    public class SyncDefensePeriodRequestDto
    {
        public bool RetryOnFailure { get; set; } = true;
        public string? IdempotencyKey { get; set; }
    }

    public class SyncDefensePeriodResponseDto
    {
        public int TotalPulled { get; set; }
        public int EligibleCount { get; set; }
        public int InvalidCount { get; set; }
        public int RetryAttempts { get; set; } = 1;
        public string SnapshotVersion { get; set; } = string.Empty;
        public Dictionary<string, bool> Readiness { get; set; } = new();
        public Dictionary<string, int> ErrorBreakdown { get; set; } = new();
        public List<SyncRowErrorDto> RowErrors { get; set; } = new();
        public string Message { get; set; } = string.Empty;
    }

    public class SyncRowErrorDto
    {
        public string TopicCode { get; set; } = string.Empty;
        public List<string> Errors { get; set; } = new();
    }

    public class UpdateDefensePeriodConfigDto
    {
        public DateTime? StartDate { get; set; }

        public DateTime? EndDate { get; set; }

        [Required]
        public List<string> Rooms { get; set; } = new();

        [Required]
        public string MorningStart { get; set; } = "07:30";

        [Required]
        public string AfternoonStart { get; set; } = "13:30";

        [Range(1, 10)]
        public int SoftMaxCapacity { get; set; } = 4;
    }

    public class ConfirmCouncilConfigDto
    {
        [Range(3, 7)]
        public int TopicsPerSessionConfig { get; set; } = 3;

        [Range(3, 7)]
        public int MembersPerCouncilConfig { get; set; } = 3;

        public List<string> Tags { get; set; } = new();
    }

    public class GenerateCouncilsRequestDto
    {
        [MinLength(1)]
        public List<string> SelectedTopicCodes { get; set; } = new();

        [MinLength(1)]
        public List<string> SelectedLecturerCodes { get; set; } = new();

        public List<string> SelectedRooms { get; set; } = new();
        
        /// <summary>
        /// Ngày bắt đầu tạo hội đồng (nếu null thì dùng StartDate của đợt bảo vệ)
        /// </summary>
        public DateTime? GenerationStartDate { get; set; }
        
        /// <summary>
        /// Ngày kết thúc tạo hội đồng (nếu null thì dùng EndDate của đợt bảo vệ)
        /// </summary>
        public DateTime? GenerationEndDate { get; set; }
        
        /// <summary>
        /// Số lượng hội đồng tối đa mỗi ngày (nếu 0 thì không giới hạn)
        /// </summary>
        [Range(0, 100)]
        public int MaxCouncilsPerDay { get; set; } = 0;
        
        public List<string> Tags { get; set; } = new();
        public GenerateCouncilStrategyDto Strategy { get; set; } = new();
        public GenerateCouncilConstraintsDto Constraints { get; set; } = new();
        public string? IdempotencyKey { get; set; }
    }

    public class GenerateCouncilStrategyDto
    {
        public bool GroupByTag { get; set; } = true;
        [Range(1, 10)]
        public int MaxPerSession { get; set; } = 4;
        public bool PrioritizeMatchTag { get; set; } = true;
        public GenerateCouncilHeuristicWeightsDto? HeuristicWeights { get; set; }
    }

    public class GenerateCouncilHeuristicWeightsDto
    {
        [Range(0, 1)]
        public decimal? TagMatchWeight { get; set; }

        [Range(0, 1)]
        public decimal? WorkloadWeight { get; set; }

        [Range(0, 1)]
        public decimal? FairnessWeight { get; set; }

        [Range(0, 1)]
        public decimal? ConsecutiveCommitteePenaltyWeight { get; set; }
    }

    public class GenerateCouncilConstraintsDto
    {
        public bool AvoidSupervisorConflict { get; set; } = true;
        public bool AvoidLecturerOverlap { get; set; } = true;
        public List<string> RequireRoles { get; set; } = new() { "CT", "UVTK", "UVPB" };
    }

    public class DefensePeriodReportExportRequestDto
    {
        [Required]
        public string ReportType { get; set; } = "final-term";

        [Required]
        public string Format { get; set; } = "xlsx";

        public int? CouncilId { get; set; }

        public List<string> SelectedFields { get; set; } = new();
    }

    public class CouncilUpsertDto
    {
        [Required]
        public string Room { get; set; } = string.Empty;

        // Optimistic concurrency token from CouncilDraftDto.ConcurrencyToken (required for update).
        public string? ConcurrencyToken { get; set; }

        public List<string> CouncilTags { get; set; } = new();

        [Required]
        public List<string> MorningStudentCodes { get; set; } = new();

        [Required]
        public List<string> AfternoonStudentCodes { get; set; } = new();

        [Required]
        public List<CouncilMemberInputDto> Members { get; set; } = new();
    }

    public class CouncilMemberInputDto
    {
        [Required]
        public string Role { get; set; } = string.Empty;

        [Required]
        public string LecturerCode { get; set; } = string.Empty;
    }

    public class FinalizeDefensePeriodDto
    {
        public bool AllowFinalizeAfterWarning { get; set; }
        public string? IdempotencyKey { get; set; }
    }

    public class RollbackDefensePeriodDto
    {
        [Required]
        [RegularExpression("^(PUBLISH|FINALIZE|ALL)$", ErrorMessage = "Target chỉ hỗ trợ PUBLISH, FINALIZE hoặc ALL")]
        public string Target { get; set; } = "PUBLISH";

        [Required]
        public string Reason { get; set; } = string.Empty;

        // Khi rollback publish, mở khóa toàn bộ kết quả để có thể sửa điểm nhanh.
        public bool ForceUnlockScores { get; set; } = true;

        public string? IdempotencyKey { get; set; }
    }

    public class RollbackDefensePeriodResponseDto
    {
        public string Target { get; set; } = string.Empty;
        public string PeriodStatusBefore { get; set; } = string.Empty;
        public string PeriodStatusAfter { get; set; } = string.Empty;
        public bool FinalizedBefore { get; set; }
        public bool FinalizedAfter { get; set; }
        public bool ScoresPublishedBefore { get; set; }
        public bool ScoresPublishedAfter { get; set; }
        public int UpdatedCommitteeCount { get; set; }
        public int UpdatedResultCount { get; set; }
        public DateTime RolledBackAt { get; set; }
    }

    public class GenerateCouncilCodeResponseDto
    {
        public string CommitteeCode { get; set; } = string.Empty;
    }

    public class CouncilWorkflowStep1Dto
    {
        public string? Name { get; set; }

        public DateTime DefenseDate { get; set; }

        [Required]
        public string Room { get; set; } = string.Empty;

        public List<string> CouncilTags { get; set; } = new();

        public string? ConcurrencyToken { get; set; }
    }

    public class CouncilWorkflowStep2Dto
    {
        public string? ConcurrencyToken { get; set; }
        public List<CouncilMemberInputDto> Members { get; set; } = new();
    }

    public class CouncilAssignmentInputDto
    {
        [Required]
        public string TopicCode { get; set; } = string.Empty;

        public DateTime? ScheduledAt { get; set; }

        [Required]
        public string SessionCode { get; set; } = DefenseSessionCodes.Morning;

        [Required]
        public string StartTime { get; set; } = "07:30";

        [Required]
        public string EndTime { get; set; } = "08:30";

        [Range(1, int.MaxValue)]
        public int? OrderIndex { get; set; }
    }

    public class CouncilWorkflowStep3Dto
    {
        public string? ConcurrencyToken { get; set; }
        public List<CouncilAssignmentInputDto> Assignments { get; set; } = new();
    }

    public class AddCouncilMemberItemDto
    {
        [Required]
        public string ConcurrencyToken { get; set; } = string.Empty;

        [Required]
        public string Role { get; set; } = string.Empty;

        [Required]
        public string LecturerCode { get; set; } = string.Empty;
    }

    public class UpdateCouncilMemberItemDto
    {
        [Required]
        public string ConcurrencyToken { get; set; } = string.Empty;

        public string? Role { get; set; }

        public string? LecturerCode { get; set; }
    }

    public class RemoveCouncilMemberItemDto
    {
        [Required]
        public string ConcurrencyToken { get; set; } = string.Empty;
    }

    public class AddCouncilTopicItemDto
    {
        [Required]
        public string ConcurrencyToken { get; set; } = string.Empty;

        [Required]
        public string TopicCode { get; set; } = string.Empty;

        public DateTime? ScheduledAt { get; set; }

        [Required]
        public string SessionCode { get; set; } = DefenseSessionCodes.Morning;

        [Required]
        public string StartTime { get; set; } = "07:30";

        [Required]
        public string EndTime { get; set; } = "08:30";

        [Range(1, int.MaxValue)]
        public int? OrderIndex { get; set; }
    }

    public class UpdateCouncilTopicItemDto
    {
        [Required]
        public string ConcurrencyToken { get; set; } = string.Empty;

        public DateTime? ScheduledAt { get; set; }

        public string? SessionCode { get; set; }

        public string? StartTime { get; set; }

        public string? EndTime { get; set; }

        [Range(1, int.MaxValue)]
        public int? OrderIndex { get; set; }
    }

    public class RemoveCouncilTopicItemDto
    {
        [Required]
        public string ConcurrencyToken { get; set; } = string.Empty;
    }

    public class DefensePeriodLifecycleActionRequestDto
    {
        [Required]
        public string Action { get; set; } = string.Empty;

        public string? IdempotencyKey { get; set; }

        public SyncDefensePeriodRequestDto? Sync { get; set; }

        public FinalizeDefensePeriodDto? Finalize { get; set; }

        // Fallback when FE sends finalize fields at root level instead of nested Finalize object.
        public bool? AllowFinalizeAfterWarning { get; set; }

        public RollbackDefensePeriodDto? Rollback { get; set; }

        // Fallback when FE sends rollback fields at root level instead of nested Rollback object.
        public string? RollbackTarget { get; set; }
        public string? RollbackReason { get; set; }
        public bool? RollbackForceUnlockScores { get; set; }

        // Fallback when FE sends sync fields at root level instead of nested Sync object.
        public bool? RetryOnFailure { get; set; }

        public DefensePeriodArchiveRequestDto? Archive { get; set; }

        public DefensePeriodReopenRequestDto? Reopen { get; set; }
    }

    public class DefensePeriodSetupConfigRequestDto
    {
        public UpdateDefensePeriodConfigDto? Config { get; set; }

        public bool LockLecturerCapabilities { get; set; }

        public ConfirmCouncilConfigDto? CouncilConfig { get; set; }
    }

    public class DefensePeriodSetupGenerateRequestDto
    {
        [Required]
        public string Mode { get; set; } = "GENERATE";

        [Required]
        public GenerateCouncilsRequestDto Request { get; set; } = new();

        public string? IdempotencyKey { get; set; }
    }

    public class CouncilCompactUpsertRequestDto
    {
        // Optional operation-driven mode for FE compact integration.
        // If omitted, API keeps backward compatible behavior based on CouncilId + Data.
        public string? Operation { get; set; }

        public int? CouncilId { get; set; }

        public string? LecturerCode { get; set; }

        public int? AssignmentId { get; set; }

        public string? ConcurrencyToken { get; set; }

        public CouncilUpsertDto? Data { get; set; }

        public CouncilWorkflowStep1Dto? Step1 { get; set; }

        public CouncilWorkflowStep2Dto? Step2 { get; set; }

        public CouncilWorkflowStep3Dto? Step3 { get; set; }

        public AddCouncilMemberItemDto? MemberAdd { get; set; }

        public UpdateCouncilMemberItemDto? MemberUpdate { get; set; }

        public AddCouncilTopicItemDto? TopicAdd { get; set; }

        public UpdateCouncilTopicItemDto? TopicUpdate { get; set; }
    }
}

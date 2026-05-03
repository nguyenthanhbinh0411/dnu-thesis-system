using ThesisManagement.Api.DTOs;

namespace ThesisManagement.Api.DTOs.DefensePeriods
{
    public class DefenseOperationsExportSnapshotDto
    {
        public int DefenseTermId { get; set; }
        public DefensePeriodStateDto State { get; set; } = new();
        public DefenseOperationsMonitoringSnapshotDto Monitoring { get; set; } = new();
        public PagedResult<CouncilDraftDto> Councils { get; set; } = new();
        public List<ScoringMatrixRowDto> ScoringMatrix { get; set; } = new();
        public DefensePeriodProgressOverviewDto ProgressTracking { get; set; } = new();
        public DefensePeriodPostDefenseOverviewDto PostDefense { get; set; } = new();
        public DefenseOperationsAuditSnapshotDto Audit { get; set; } = new();
    }

    public class DefenseOperationsMonitoringSnapshotDto
    {
        public DefensePeriodPipelineOverviewDto Pipeline { get; set; } = new();
        public DefenseOperationsAnalyticsSnapshotDto Analytics { get; set; } = new();
        public DefenseOperationsScoringSnapshotDto Scoring { get; set; } = new();
        public DefensePeriodTagOverviewDto Tags { get; set; } = new();
    }

    public class DefenseOperationsAnalyticsSnapshotDto
    {
        public AnalyticsOverviewDto Overview { get; set; } = new();
        public List<CouncilAnalyticsDto> ByCouncil { get; set; } = new();
        public AnalyticsDistributionDto Distribution { get; set; } = new();
    }

    public class DefenseOperationsScoringSnapshotDto
    {
        public List<ScoringProgressDto> Progress { get; set; } = new();
        public List<ScoringAlertDto> Alerts { get; set; } = new();
    }

    public class DefenseOperationsAuditSnapshotDto
    {
        public List<CouncilAuditHistoryDto> SyncHistory { get; set; } = new();
        public List<PublishHistoryDto> PublishHistory { get; set; } = new();
        public List<CouncilAuditHistoryDto> CouncilAuditHistory { get; set; } = new();
        public List<RevisionAuditTrailDto> RevisionAuditTrail { get; set; } = new();
    }
}
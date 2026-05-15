using System.Linq;
using ThesisManagement.Api.DTOs.DefensePeriods;

namespace ThesisManagement.Api.Services.DefenseOperationsExport.Internal
{
    public static class DefenseMetricsBuilder
    {
        public static DefenseExportMetrics Build(DefenseOperationsExportSnapshotDto snapshot)
        {
            var scoring = snapshot.ScoringMatrix ?? new List<ScoringMatrixRowDto>();
            var councils = snapshot.Councils?.Items ?? new List<CouncilDraftDto>();

            var totalCouncils = snapshot.Councils?.TotalCount > 0 ? snapshot.Councils.TotalCount : councils.Count();
            var totalTopics = councils.Sum(x => x.Assignments?.Count ?? 0);
            var scoredTopics = scoring.Count(x => x.FinalScore.HasValue);
            var defendingTopics = scoring.Count(x => (x.Status ?? string.Empty).Trim().ToUpperInvariant() == "DEFENDING");
            var pendingTopics = scoring.Count(x => (x.Status ?? string.Empty).Trim().ToUpperInvariant() == "PENDING");
            var completionPercent = totalTopics == 0 ? 0m : Math.Round((decimal)scoredTopics / totalTopics * 100m, 1);
            var activeCouncils = councils.Count(x => DefenseExportRules.IsActiveCouncil(DefenseExportRules.NormalizeCouncilStatus(x.Status)));
            var warningCount = snapshot.Monitoring?.Scoring?.Alerts?.Count ?? 0;

            // Summary Strings
            var councilItems = snapshot.Councils?.Items ?? new List<CouncilDraftDto>();
            var pendingC = councilItems.Count(x => DefenseExportRules.NormalizeCouncilStatus(x.Status) == CouncilExportStatus.Pending);
            var readyC = councilItems.Count(x => DefenseExportRules.NormalizeCouncilStatus(x.Status) == CouncilExportStatus.Ready);
            var ongoingC = councilItems.Count(x => DefenseExportRules.NormalizeCouncilStatus(x.Status) == CouncilExportStatus.Ongoing);
            var lockedC = councilItems.Count(x => DefenseExportRules.NormalizeCouncilStatus(x.Status) == CouncilExportStatus.Locked);
            var publishedC = councilItems.Count(x => DefenseExportRules.NormalizeCouncilStatus(x.Status) == CouncilExportStatus.Published);

            var councilSummary = $"Hội đồng: {totalCouncils} | Chờ: {pendingC} | Sẵn sàng: {readyC} | Đang chấm: {ongoingC} | Đã chốt: {lockedC} | Đã công bố: {publishedC}";
            
            var scoringTotal = scoring.Count;
            var scoringWaiting = scoring.Count(x => x.SubmittedCount < x.RequiredCount);
            var scoringAlert = scoring.Count(x => DefenseExportRules.IsHighVariance(x.Variance));
            var scoringLocked = scoring.Count(x => x.IsLocked);
            var scoringSummary = $"Ma trận chấm điểm: {scoringTotal} dòng | Đang chờ: {scoringWaiting} | Đã khóa: {scoringLocked} | Lệch điểm (>=2): {scoringAlert}";

            var kpiSummary = $"Tổng số hội đồng: {totalCouncils} | Tổng số đề tài: {totalTopics} | Đã chấm: {scoredTopics} | Tỷ lệ hoàn thành: {completionPercent:0.0}% | Hoạt động: {activeCouncils}";

            var post = snapshot.PostDefense;
            var postSummary = post != null ? $"Hậu đồ án tốt nghiệp: Tổng {post.TotalRevisions} | Chờ duyệt {post.PendingRevisions} | Đã duyệt {post.ApprovedRevisions} | Từ chối {post.RejectedRevisions}" : "-";

            return new DefenseExportMetrics(
                totalCouncils,
                totalTopics,
                scoredTopics,
                defendingTopics,
                pendingTopics,
                completionPercent,
                activeCouncils,
                warningCount,
                councilSummary,
                scoringSummary,
                kpiSummary,
                postSummary);
        }
    }
}

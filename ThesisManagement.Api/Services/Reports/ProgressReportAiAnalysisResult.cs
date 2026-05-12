using System.Collections.Generic;

namespace ThesisManagement.Api.Services.Reports
{
    public class ProgressReportAiAnalysisResult
    {
        public string Summary { get; set; } = string.Empty;
        public List<string> KeyAchievements { get; set; } = new();
        public List<string> IdentifiedRisks { get; set; } = new();
        public List<string> SuggestionsForLecturer { get; set; } = new();
        public string RiskLevel { get; set; } = "Thấp"; // Thấp, Trung bình, Cao
        public string RecommendedAction { get; set; } = string.Empty; // Chấp nhận, Cần làm rõ, Cảnh báo
        public string SuggestedFeedback { get; set; } = string.Empty;
    }
}

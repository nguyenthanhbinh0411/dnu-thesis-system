using System.Collections.Generic;

namespace ThesisManagement.Api.Services.Reports
{
    public class ThesisAiAnalysisResult
    {
        public double OverallScore { get; set; }
        public string Status { get; set; } = string.Empty;
        public List<CriterionRating> Criteria { get; set; } = new();
        public List<string> Pros { get; set; } = new();
        public List<string> Cons { get; set; } = new();
        public List<string> Suggestions { get; set; } = new();
        public string Summary { get; set; } = string.Empty;
        public string FeedbackForStudent { get; set; } = string.Empty;
    }

    public class CriterionRating
    {
        public string Name { get; set; } = string.Empty;
        public double Score { get; set; }
        public string Comment { get; set; } = string.Empty;
    }
}

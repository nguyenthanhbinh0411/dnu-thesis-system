using System.Threading.Tasks;

namespace ThesisManagement.Api.Services.Reports
{
    public interface IThesisAiAnalysisService
    {
        Task<ThesisAiAnalysisResult> AnalyzeThesisAsync(string title, string description, string techStack, string major);
        Task<ProgressReportAiAnalysisResult> AnalyzeProgressReportAsync(string milestoneCode, string milestoneName, string reportTitle, string reportDescription, string? fileUrl = null);
    }
}

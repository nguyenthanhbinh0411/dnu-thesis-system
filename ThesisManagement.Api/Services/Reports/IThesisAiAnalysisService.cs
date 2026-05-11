using System.Threading.Tasks;

namespace ThesisManagement.Api.Services.Reports
{
    public interface IThesisAiAnalysisService
    {
        Task<ThesisAiAnalysisResult> AnalyzeThesisAsync(string title, string description, string techStack, string major);
    }
}

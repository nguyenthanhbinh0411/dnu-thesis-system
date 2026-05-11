using System;
using System.Text.Json;
using System.Threading.Tasks;
using ThesisManagement.Api.Helpers;
using ThesisManagement.Api.Services.Chat;

namespace ThesisManagement.Api.Services.Reports
{
    public class ThesisAiAnalysisService : IThesisAiAnalysisService
    {
        private readonly IGroqService _groqService;

        public ThesisAiAnalysisService(IGroqService groqService)
        {
            _groqService = groqService;
        }

        public async Task<ThesisAiAnalysisResult> AnalyzeThesisAsync(string title, string description, string techStack, string major)
        {
            var userMessage = $@"
[CHUYÊN NGÀNH]: {major}
[ĐỀ TÀI]: {title}
[MÔ TẢ]: {description}
[CÔNG NGHỆ]: {techStack}
";

            string jsonResponse = string.Empty;
            try
            {
                jsonResponse = await _groqService.GetRawCompletionAsync(
                    AiPrompts.ThesisReviewerSystemPrompt, 
                    userMessage, 
                    useJsonMode: true);

                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                };
                var result = JsonSerializer.Deserialize<ThesisAiAnalysisResult>(jsonResponse, options);
                return result ?? GetFallbackResult("AI trả về kết quả rỗng.");
            }
            catch (Exception ex)
            {
                // Log error here if needed
                return GetFallbackResult($"Lỗi khi phân tích dữ liệu AI: {ex.Message}");
            }
        }

        private ThesisAiAnalysisResult GetFallbackResult(string errorMessage)
        {
            return new ThesisAiAnalysisResult
            {
                OverallScore = 0,
                Status = "Lỗi hệ thống",
                Summary = $"Không thể lấy kết quả phân tích từ AI. Chi tiết: {errorMessage}",
                Criteria = new List<CriterionRating>
                {
                    new CriterionRating { Name = "Lỗi", Score = 0, Comment = "Vui lòng thử lại sau hoặc liên hệ quản trị viên." }
                }
            };
        }
    }
}

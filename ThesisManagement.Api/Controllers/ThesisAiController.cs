using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using ThesisManagement.Api.DTOs;
using ThesisManagement.Api.DTOs.Reports;
using ThesisManagement.Api.Services.Reports;

namespace ThesisManagement.Api.Controllers
{
    [ApiController]
    [Route("api/thesis-ai")]
    [Authorize]
    public class ThesisAiController : ControllerBase
    {
        private readonly IThesisAiAnalysisService _aiService;

        public ThesisAiController(IThesisAiAnalysisService aiService)
        {
            _aiService = aiService;
        }

        /// <summary>
        /// Phân tích đề tài khóa luận bằng AI
        /// </summary>
        /// <param name="request">Thông tin đề tài và chuyên ngành</param>
        /// <returns>Kết quả phân tích chi tiết từ AI</returns>
        [HttpPost("analyze")]
        public async Task<IActionResult> Analyze([FromBody] ThesisAiAnalysisRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Title))
                return BadRequest(ApiResponse<object>.Fail("Tên đề tài không được để trống", 400));

            // Nếu frontend không gửi Major, mặc định là Công nghệ thông tin
            var major = string.IsNullOrWhiteSpace(request.Major) ? "Công nghệ thông tin" : request.Major;

            var result = await _aiService.AnalyzeThesisAsync(
                request.Title, 
                request.Description, 
                request.TechStack, 
                major);

            // Vì service đã xử lý lỗi và trả về FallbackResult, ta luôn trả về SuccessResponse ở tầng API
            return Ok(ApiResponse<ThesisAiAnalysisResult>.SuccessResponse(result));
        }
    }
}

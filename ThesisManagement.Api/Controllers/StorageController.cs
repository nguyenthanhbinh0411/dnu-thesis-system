using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ThesisManagement.Api.DTOs;
using ThesisManagement.Api.Services.FileStorage;

namespace ThesisManagement.Api.Controllers
{
    [ApiController]
    [Route("api/storage")]
    public class StorageController : ControllerBase
    {
        private readonly IFileStorageService _storageService;

        public StorageController(IFileStorageService storageService)
        {
            _storageService = storageService;
        }

        [HttpGet("mega/{nodeId}")]
        [AllowAnonymous]
        [ResponseCache(Duration = 86400, Location = ResponseCacheLocation.Any, NoStore = false)]
        public async Task<IActionResult> DownloadMegaFile(string nodeId, CancellationToken cancellationToken)
        {
            var result = await _storageService.OpenReadAsync($"/api/storage/mega/{nodeId}", cancellationToken);
            if (!result.Success)
                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(result.ErrorMessage ?? "Request failed", result.StatusCode));

            return File(result.Data!.Stream, result.Data.ContentType, result.Data.FileName);
        }

        [HttpGet("list")]
        [Authorize]
        public async Task<IActionResult> List([FromQuery] string scope = "uploads", CancellationToken cancellationToken = default)
        {
            var result = await _storageService.ListAsync(scope, cancellationToken);
            if (!result.Success)
                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(result.ErrorMessage ?? "Request failed", result.StatusCode));

            return Ok(ApiResponse<IEnumerable<FileStorageListItem>>.SuccessResponse(result.Data!));
        }

        public sealed record MoveFileRequest(string Url, string TargetScope);

        [HttpPost("move")]
        [Authorize]
        public async Task<IActionResult> Move([FromBody] MoveFileRequest request, CancellationToken cancellationToken = default)
        {
            var result = await _storageService.MoveAsync(request.Url, request.TargetScope, cancellationToken);
            if (!result.Success)
                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(result.ErrorMessage ?? "Request failed", result.StatusCode));

            return Ok(ApiResponse<object>.SuccessResponse(new { url = result.Data }));
        }

        public sealed record DeleteFileRequest(string Url);

        [HttpDelete("delete")]
        [Authorize]
        public async Task<IActionResult> Delete([FromBody] DeleteFileRequest request, CancellationToken cancellationToken = default)
        {
            var result = await _storageService.DeleteAsync(request.Url, cancellationToken);
            if (!result.Success)
                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(result.ErrorMessage ?? "Request failed", result.StatusCode));

            return Ok(ApiResponse<object>.SuccessResponse(result.Data));
        }
    }
}
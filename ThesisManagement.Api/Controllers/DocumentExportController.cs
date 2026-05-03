using Microsoft.AspNetCore.Mvc;
using ThesisManagement.Api.DTOs.DocumentExports;
using ThesisManagement.Api.Services.DocumentExports;

namespace ThesisManagement.Api.Controllers;

[ApiController]
[Route("api/export")]
[Route("export")]
public sealed class DocumentExportController : ControllerBase
{
    private readonly IDocumentExportService _documentExportService;

    public DocumentExportController(IDocumentExportService documentExportService)
    {
        _documentExportService = documentExportService;
    }

    [HttpPost("word/{type}")]
    public async Task<IActionResult> ExportWord([FromRoute] string type, [FromBody] ReportData reportData, CancellationToken cancellationToken)
    {
        if (!DocumentExportTypeParser.TryParse(type, out var exportType))
        {
            return BadRequest(new { message = $"Unsupported export type '{type}'." });
        }

        var result = await _documentExportService.ExportWordAsync(exportType, reportData, cancellationToken);
        return File(result.Content, result.ContentType, result.FileName);
    }

    [HttpPost("pdf/{type}")]
    public async Task<IActionResult> ExportPdf([FromRoute] string type, [FromBody] ReportData reportData, CancellationToken cancellationToken)
    {
        if (!DocumentExportTypeParser.TryParse(type, out var exportType))
        {
            return BadRequest(new { message = $"Unsupported export type '{type}'." });
        }

        var result = await _documentExportService.ExportPdfAsync(exportType, reportData, cancellationToken);
        return File(result.Content, result.ContentType, result.FileName);
    }
}

internal static class DocumentExportTypeParser
{
    public static bool TryParse(string? value, out DocumentExportType exportType)
    {
        exportType = DocumentExportType.BangDiem;

        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        return value.Trim().ToLowerInvariant() switch
        {
            "bangdiem" or "bang-diem" or "diem" or "score" or "scoresheet" => TryAssign(DocumentExportType.BangDiem, out exportType),
            "bienban" or "bien-ban" or "meeting" or "minutes" => TryAssign(DocumentExportType.BienBan, out exportType),
            "nhanxet" or "nhan-xet" or "review" or "reviewer" => TryAssign(DocumentExportType.NhanXet, out exportType),
            _ => false
        };
    }

    private static bool TryAssign(DocumentExportType value, out DocumentExportType exportType)
    {
        exportType = value;
        return true;
    }
}

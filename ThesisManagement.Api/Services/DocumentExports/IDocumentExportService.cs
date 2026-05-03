using ThesisManagement.Api.DTOs.DocumentExports;

namespace ThesisManagement.Api.Services.DocumentExports;

public interface IDocumentExportService
{
    Task<ExportFileResult> ExportWordAsync(DocumentExportType type, ReportData reportData, CancellationToken cancellationToken = default);

    Task<ExportFileResult> ExportPdfAsync(DocumentExportType type, ReportData reportData, CancellationToken cancellationToken = default);
}

using ThesisManagement.Api.Application.Common;
using ThesisManagement.Api.DTOs;
using ThesisManagement.Api.DTOs.DefensePeriods;

namespace ThesisManagement.Api.Services.DefenseOperationsExport
{
    public interface IDefenseOperationsExportService
    {
        Task<ApiResponse<(byte[] Content, string FileName, string ContentType)>> ExportAsync(
            DefenseOperationsExportSnapshotDto snapshot,
            string format,
            CancellationToken cancellationToken = default);
    }
}
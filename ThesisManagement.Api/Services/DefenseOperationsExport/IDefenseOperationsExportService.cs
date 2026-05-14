using System.Threading;
using System.Collections.Generic;
using System.Threading.Tasks;
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
            string? template = "dashboard",
            List<string>? selectedFields = null,
            CancellationToken cancellationToken = default);
    }
}
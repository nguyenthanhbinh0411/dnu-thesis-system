using System.Threading;
using System.Threading.Tasks;
using ThesisManagement.Api.DTOs.Reports.Query;

namespace ThesisManagement.Api.Services.Reports
{
    public interface IProgressEvaluationDocumentService
    {
        Task<byte[]> BuildEvaluationFormAsync(ProgressEvaluationTemplateDataDto data, CancellationToken cancellationToken = default);
    }
}

using ThesisManagement.Api.DTOs;

namespace ThesisManagement.Api.Services.DefenseDocuments
{
    public interface IDefenseTemplateExportService
    {
        Task<ApiResponse<(byte[] Content, string FileName, string ContentType)>> ExportMeetingMinutesAsync(
            int periodId,
            int committeeId,
            int assignmentId,
            CancellationToken cancellationToken = default);

        Task<ApiResponse<(byte[] Content, string FileName, string ContentType)>> ExportMeetingMinutesPdfAsync(
            int periodId,
            int committeeId,
            int assignmentId,
            CancellationToken cancellationToken = default);

        Task<ApiResponse<(byte[] Content, string FileName, string ContentType)>> ExportReviewerCommentsAsync(
            int periodId,
            int committeeId,
            int assignmentId,
            CancellationToken cancellationToken = default);

        Task<ApiResponse<(byte[] Content, string FileName, string ContentType)>> ExportReviewerCommentsPdfAsync(
            int periodId,
            int committeeId,
            int assignmentId,
            CancellationToken cancellationToken = default);
    }
}

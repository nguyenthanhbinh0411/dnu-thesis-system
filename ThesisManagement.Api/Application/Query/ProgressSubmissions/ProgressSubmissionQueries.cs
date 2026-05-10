using Microsoft.EntityFrameworkCore;
using ThesisManagement.Api.DTOs.ProgressSubmissions.Command;
using ThesisManagement.Api.Services;

namespace ThesisManagement.Api.Application.Query.ProgressSubmissions
{
    public interface IGetProgressSubmissionCreateQuery
    {
        Task<object> ExecuteAsync();
    }

    public interface IGetProgressSubmissionUpdateQuery
    {
        Task<ProgressSubmissionUpdateDto?> ExecuteAsync(int id);
    }

    public class GetProgressSubmissionCreateQuery : IGetProgressSubmissionCreateQuery
    {
        private readonly IUnitOfWork _uow;
        public GetProgressSubmissionCreateQuery(IUnitOfWork uow) { _uow = uow; }
        public async Task<object> ExecuteAsync()
        {
            var sampleCode = await GenerateSubmissionCodeAsync();
            return new
            {
                SubmissionCode = sampleCode,
                MilestoneID = (int?)null,
                MilestoneCode = string.Empty,
                Ordinal = (int?)null,
                StudentUserID = (int?)null,
                StudentUserCode = string.Empty,
                StudentProfileID = (int?)null,
                StudentProfileCode = (string?)null,
                LecturerProfileID = (int?)null,
                LecturerCode = (string?)null,
                AttemptNumber = (int?)1,
                ReportTitle = (string?)null,
                ReportDescription = (string?)null
            };
        }

        private async Task<string> GenerateSubmissionCodeAsync()
        {
            var datePart = DateTime.UtcNow.ToString("yyyyMMdd");
            var prefix = $"SUBF{datePart}";
            var existing = await _uow.ProgressSubmissions.Query().Where(s => EF.Functions.Like(s.SubmissionCode, prefix + "%")).Select(s => s.SubmissionCode).ToListAsync();
            var maxSuffix = 0;
            foreach (var c in existing)
            {
                if (c.Length > prefix.Length)
                {
                    var suffix = c.Substring(prefix.Length);
                    if (int.TryParse(suffix, out var n))
                        maxSuffix = Math.Max(maxSuffix, n);
                }
            }
            return $"{prefix}{(maxSuffix + 1):D3}";
        }
    }

    public class GetProgressSubmissionUpdateQuery : IGetProgressSubmissionUpdateQuery
    {
        private readonly IUnitOfWork _uow;
        public GetProgressSubmissionUpdateQuery(IUnitOfWork uow) { _uow = uow; }
        public async Task<ProgressSubmissionUpdateDto?> ExecuteAsync(int id)
        {
            var ent = await _uow.ProgressSubmissions.GetByIdAsync(id);
            if (ent == null) return null;
            return new ProgressSubmissionUpdateDto(ent.LecturerComment, ent.LecturerState, ent.FeedbackLevel, null);
        }
    }
}

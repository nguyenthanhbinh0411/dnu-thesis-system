using System.Globalization;
using System.Threading;
using System.Linq;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.AspNetCore.Http;
using System.Security.Claims;
using ThesisManagement.Api.DTOs;
using ThesisManagement.Api.DTOs.DefensePeriods;
using ThesisManagement.Api.Services.DefenseOperationsExport.Exporters;
using ThesisManagement.Api.Services.DefenseOperationsExport.Internal;

namespace ThesisManagement.Api.Services.DefenseOperationsExport
{
    public sealed class DefenseOperationsExportService : IDefenseOperationsExportService
    {
        private const string XlsxContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        private const string PdfContentType = "application/pdf";

        private readonly ILogger<DefenseOperationsExportService> _logger;
        private readonly DefenseExportBrandingOptions _branding;
        private readonly TimeProvider _clock;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public DefenseOperationsExportService(
            ILogger<DefenseOperationsExportService> logger,
            IOptions<DefenseExportBrandingOptions> branding,
            IHttpContextAccessor httpContextAccessor,
            TimeProvider? clock = null)
        {
            _logger = logger;
            _branding = branding.Value;
            _httpContextAccessor = httpContextAccessor;
            _clock = clock ?? TimeProvider.System;
        }

        static DefenseOperationsExportService()
        {
            try
            {
                QuestPDF.Settings.License = QuestPDF.Infrastructure.LicenseType.Community;
            }
            catch
            {
                // Ignore license errors in static constructor
            }
        }

        public async Task<ApiResponse<(byte[] Content, string FileName, string ContentType)>> ExportAsync(
            DefenseOperationsExportSnapshotDto snapshot,
            string format,
            string? template = "dashboard",
            List<string>? selectedFields = null,
            CancellationToken cancellationToken = default)
        {
            try
            {
                ArgumentNullException.ThrowIfNull(snapshot);
                _logger.LogInformation("Starting export for term {TermId} in format {Format} with template {Template}", 
                    snapshot.DefenseTermId, format, template);

                var normalizedFormat = (format ?? string.Empty).Trim().ToLowerInvariant();
                if (normalizedFormat != "xlsx" && normalizedFormat != "pdf")
                {
                    return ApiResponse<(byte[] Content, string FileName, string ContentType)>.Fail("Chỉ hỗ trợ định dạng xlsx hoặc pdf.", 400);
                }

                var normalizedTemplate = (template ?? DefenseExportConstants.Templates.Dashboard).Trim().ToLowerInvariant();
                var now = _clock.GetLocalNow().DateTime;

                // 1. Resolve Fields for the template
                var finalFields = selectedFields;
                if (finalFields == null || finalFields.Count == 0)
                {
                    finalFields = normalizedTemplate switch
                    {
                        DefenseExportConstants.Templates.Dashboard => DefenseExportTemplates.Dashboard.ToList(),
                        DefenseExportConstants.Templates.Scoring => DefenseExportTemplates.ScoringMatrix.ToList(),
                        DefenseExportConstants.Templates.PostDefense => DefenseExportTemplates.PostDefense.ToList(),
                        DefenseExportConstants.Templates.Councils => DefenseExportTemplates.Councils.ToList(),
                        DefenseExportConstants.Templates.Topics => DefenseExportTemplates.Topics.ToList(),
                        "official-transcript" => DefenseExportTemplates.OfficialTranscript.ToList(),
                        "council-minutes" => DefenseExportTemplates.CouncilMinutes.ToList(),
                        "statistics" => DefenseExportTemplates.Statistics.ToList(),
                        _ => DefenseExportTemplates.Dashboard.ToList()
                    };
                }

                // 2. Build Shared Data Models
                var metrics = DefenseMetricsBuilder.Build(snapshot);
                var scoringByCouncil = snapshot.ScoringMatrix?
                    .GroupBy(x => x.CommitteeId)
                    .ToDictionary(g => g.Key, g => g.ToList()) ?? new Dictionary<int, List<ScoringMatrixRowDto>>();

                var councilRows = BuildCouncilRows(snapshot, scoringByCouncil);
                var scoringRows = BuildScoringRows(snapshot);
                var postDefenseRows = BuildPostDefenseRows(snapshot);

                // 3. Resolve Current User
                var currentUser = _httpContextAccessor.HttpContext?.User;
                var currentUserName = currentUser?.FindFirstValue("FullName") 
                                    ?? currentUser?.FindFirstValue(ClaimTypes.Name) 
                                    ?? currentUser?.Identity?.Name 
                                    ?? "Hệ thống";

                byte[] content;
                if (normalizedFormat == "xlsx")
                {
                    var exporter = new DefenseExcelExporter(_branding);
                    content = exporter.Export(snapshot, normalizedTemplate, metrics, councilRows, scoringRows, postDefenseRows, now, currentUserName, finalFields);
                }
                else
                {
                    var exporter = new DefensePdfExporter(_branding);
                    content = exporter.Export(snapshot, normalizedTemplate, metrics, councilRows, scoringRows, postDefenseRows, now, currentUserName, finalFields);
                }

                var fileStem = BuildFileStem(snapshot, normalizedTemplate, now);
                var contentType = normalizedFormat == "xlsx" ? XlsxContentType : PdfContentType;

                return ApiResponse<(byte[] Content, string FileName, string ContentType)>.SuccessResponse(
                    (content, $"{fileStem}.{normalizedFormat}", contentType));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Export failed for term {TermId}", snapshot.DefenseTermId);
                return ApiResponse<(byte[] Content, string FileName, string ContentType)>.Fail($"Lỗi khi xuất file: {ex.Message}", 500);
            }
        }

        private List<CouncilExportRow> BuildCouncilRows(DefenseOperationsExportSnapshotDto snapshot, Dictionary<int, List<ScoringMatrixRowDto>> scoringByCouncil)
        {
            var items = snapshot.Councils?.Items ?? new List<CouncilDraftDto>();
            return items.OrderBy(x => x.DefenseDate).ThenBy(x => x.CommitteeCode).Select(council =>
            {
                scoringByCouncil.TryGetValue(council.Id, out var councilScores);
                var scoredTopics = councilScores?.Count(x => x.FinalScore.HasValue) ?? 0;
                var totalTopics = council.Assignments?.Count ?? 0;
                
                return new CouncilExportRow(
                    council.CommitteeCode ?? "-",
                    council.Name ?? "-",
                    council.Room ?? "-",
                    DefenseExportDisplayFormatter.ResolveCouncilMemberDisplay(council, "CT"),
                    DefenseExportDisplayFormatter.ResolveCouncilMemberDisplay(council, "UVTK"),
                    DefenseExportDisplayFormatter.ResolveCouncilMemberDisplay(council, "UVPB"),
                    totalTopics,
                    scoredTopics,
                    Math.Max(totalTopics - scoredTopics, 0),
                    DefenseExportRules.NormalizeCouncilStatus(council.Status)
                );
            }).ToList();
        }

        private List<ScoringExportRawDto> BuildScoringRows(DefenseOperationsExportSnapshotDto snapshot)
        {
            var scoring = snapshot.ScoringMatrix ?? new List<ScoringMatrixRowDto>();
            return scoring.OrderBy(x => x.CommitteeCode).ThenBy(x => x.StudentCode).Select(score =>
            {
                return new ScoringExportRawDto(
                    score.CommitteeId,
                    score.CommitteeCode ?? "-",
                    score.CommitteeName ?? "-",
                    score.StudentCode ?? "-",
                    score.StudentName ?? "-",
                    score.TopicCode ?? "-",
                    score.TopicTitle ?? "-",
                    score.SupervisorLecturerName ?? "-",
                    score.CommitteeChairName ?? "-",
                    score.CommitteeSecretaryName ?? "-",
                    score.CommitteeReviewerName ?? "-",
                    score.ScoreCt,
                    score.ScoreTk,
                    score.ScorePb,
                    score.ScoreGvhd,
                    score.CommentCt,
                    score.CommentTk,
                    score.CommentPb,
                    score.CommentGvhd,
                    score.FinalScore,
                    score.Variance,
                    DefenseExportRules.BuildScoringStatus(score),
                    score.IsLocked,
                    score.SubmittedCount,
                    score.RequiredCount,
                    score.DocumentCount,
                    Room: score.Room ?? "-",
                    DefenseDate: score.ScheduledAt,
                    Session: score.Session == 1 ? "Sáng" : score.Session == 2 ? "Chiều" : (score.SessionCode ?? "-"),
                    StartTime: score.StartTime ?? "-",
                    EndTime: score.EndTime ?? "-",
                    ClassName: score.ClassName ?? "-",
                    CohortCode: score.CohortCode ?? "-",
                    TopicTags: score.TopicTags != null ? string.Join(", ", score.TopicTags) : "-",
                    AssignmentCode: score.AssignmentCode ?? "-",
                    AssignmentId: score.AssignmentId,
                    SupervisorLecturerCode: score.SupervisorLecturerCode,
                    SupervisorOrganization: score.SupervisorOrganization,
                    RevisionReason: score.RevisionReason,
                    SubmissionDeadline: score.SubmissionDeadline,
                    SecretaryComment: score.SecretaryComment,
                    CommitteeChairCode: score.CommitteeChairCode,
                    CommitteeSecretaryCode: score.CommitteeSecretaryCode,
                    CommitteeReviewerCode: score.CommitteeReviewerCode
                );
            }).ToList();
        }

        private List<PostDefenseExportRow> BuildPostDefenseRows(DefenseOperationsExportSnapshotDto snapshot)
        {
            var revisions = snapshot.PostDefense?.Items ?? new List<DefensePeriodPostDefenseRevisionItemDto>();
            return revisions.OrderByDescending(x => x.LastUpdated).ThenByDescending(x => x.RevisionId).Select(revision =>
            {
                return new PostDefenseExportRow(
                    revision.RevisionId,
                    revision.TopicTitle ?? "-",
                    $"{revision.StudentCode} - {revision.StudentName}",
                    revision.CommitteeCode ?? "-",
                    revision.ChairName ?? "-",
                    revision.SecretaryName ?? "-",
                    revision.FinalStatus ?? "-",
                    revision.RevisionReason ?? "-",
                    revision.SubmissionDeadline,
                    revision.IsGvhdApproved ? "Đã duyệt" : "Chưa",
                    revision.IsUvtkApproved ? "Đã duyệt" : "Chưa",
                    revision.IsCtApproved ? "Đã duyệt" : "Chưa",
                    revision.LastUpdated
                );
            }).ToList();
        }

        private string BuildFileStem(DefenseOperationsExportSnapshotDto snapshot, string template, DateTime now)
        {
            var prefix = template switch
            {
                DefenseExportConstants.Templates.Dashboard => "dashboard",
                DefenseExportConstants.Templates.Scoring => "bang-diem",
                DefenseExportConstants.Templates.PostDefense => "hau-bao-ve",
                DefenseExportConstants.Templates.Councils => "hoi-dong",
                DefenseExportConstants.Templates.Topics => "de-tai",
                _ => "export"
            };
            return $"{prefix}_{snapshot.DefenseTermId}_{now:yyyyMMdd_HHmm}";
        }
    }
}
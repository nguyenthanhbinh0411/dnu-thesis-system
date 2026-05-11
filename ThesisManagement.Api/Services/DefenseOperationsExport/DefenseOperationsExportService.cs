using System.Globalization;
using ClosedXML.Excel;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using ThesisManagement.Api.Application.Common;
using ThesisManagement.Api.DTOs;
using ThesisManagement.Api.DTOs.DefensePeriods;

namespace ThesisManagement.Api.Services.DefenseOperationsExport
{
    public sealed class DefenseOperationsExportService : IDefenseOperationsExportService
    {
        private const string XlsxContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        private const string PdfContentType = "application/pdf";

        public Task<ApiResponse<(byte[] Content, string FileName, string ContentType)>> ExportAsync(
            DefenseOperationsExportSnapshotDto snapshot,
            string format,
            CancellationToken cancellationToken = default)
        {
            var normalizedFormat = (format ?? string.Empty).Trim().ToLowerInvariant();
            if (normalizedFormat != "xlsx" && normalizedFormat != "pdf")
            {
                return Task.FromResult(ApiResponse<(byte[] Content, string FileName, string ContentType)>.Fail(
                    "Chỉ hỗ trợ định dạng xlsx hoặc pdf cho điều hành chấm điểm.",
                    400));
            }

            var fileStem = BuildFileStem(snapshot);
            return Task.FromResult(normalizedFormat == "xlsx"
                ? ApiResponse<(byte[] Content, string FileName, string ContentType)>.SuccessResponse((BuildWorkbook(snapshot), $"{fileStem}.xlsx", XlsxContentType))
                : ApiResponse<(byte[] Content, string FileName, string ContentType)>.SuccessResponse((BuildPdf(snapshot), $"{fileStem}.pdf", PdfContentType)));
        }

        private static byte[] BuildWorkbook(DefenseOperationsExportSnapshotDto snapshot)
        {
            using var workbook = new XLWorkbook();
            var worksheet = workbook.AddWorksheet("DieuHanhChamDiem");

            ConfigureWorksheet(worksheet);

            var row = 1;
            WriteHeader(worksheet, snapshot, ref row);
            row += 1;
            WriteKpiSection(worksheet, snapshot, ref row);
            row += 1;
            WriteCouncilSection(worksheet, snapshot, ref row);
            row += 1;
            WriteScoringMatrixSection(worksheet, snapshot, ref row);
            row += 1;
            WriteAnalyticsSection(worksheet, snapshot, ref row);
            row += 1;
            WriteAlertSection(worksheet, snapshot, ref row);
            row += 1;
            WritePostDefenseSection(worksheet, snapshot, ref row);
            row += 1;
            WriteAuditSection(worksheet, snapshot, ref row);
            row += 2;
            WriteSignatureSection(worksheet, snapshot, ref row);

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return stream.ToArray();
        }

        private static byte[] BuildPdf(DefenseOperationsExportSnapshotDto snapshot)
        {
            QuestPDF.Settings.License = LicenseType.Community;

            return Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Margin(22);
                    page.Size(PageSizes.A4);
                    page.DefaultTextStyle(x => x.FontSize(9));

                    page.Header().Column(column =>
                    {
                        column.Spacing(2);
                        column.Item().Row(row =>
                        {
                            row.RelativeItem().Column(left =>
                            {
                                left.Item().Text("TRƯỜNG ĐẠI HỌC ĐẠI NAM").Bold().FontSize(12);
                                left.Item().Text("KHOA CÔNG NGHỆ THÔNG TIN").Bold().FontSize(12);
                            });

                            row.RelativeItem().AlignRight().Column(right =>
                            {
                                right.Item().Text("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM").Bold().FontSize(12);
                                right.Item().Text("Độc lập - Tự do - Hạnh phúc").Bold().FontSize(12);
                            });
                        });

                        column.Item().PaddingTop(6).AlignCenter().Text("ĐIỀU HÀNH CHẤM ĐIỂM BẢO VỆ ĐỒ ÁN").Bold().FontSize(14);
                        column.Item().AlignCenter().Text(BuildPeriodTitle(snapshot)).Bold().FontSize(12);
                    });

                    page.Content().PaddingTop(10).Column(column =>
                    {
                        column.Spacing(8);
                        column.Item().Text(BuildPeriodMeta(snapshot));
                        column.Item().Text(BuildKpiSummary(snapshot));
                        column.Item().Text(BuildCouncilSummary(snapshot));
                        column.Item().Text(BuildScoringSummary(snapshot));
                        column.Item().Text(BuildAnalyticsSummary(snapshot));
                        column.Item().Text(BuildAlertSummary(snapshot));
                        column.Item().Text(BuildPostDefenseSummary(snapshot));
                        column.Item().Text(BuildAuditSummary(snapshot));

                        column.Item().PaddingTop(12).Row(row =>
                        {
                            row.RelativeItem().Column(left =>
                            {
                                left.Item().AlignCenter().Text("NGƯỜI LẬP BIỂU").Bold();
                                left.Item().AlignCenter().PaddingTop(40).Text("Nguyễn Thị Hương Giang").Bold();
                            });

                            row.RelativeItem().Column(right =>
                            {
                                right.Item().AlignCenter().Text($"Hà Nội, ngày {DateTime.Now:dd} tháng {DateTime.Now:MM} năm {DateTime.Now:yyyy}").Italic();
                                right.Item().AlignCenter().Text("TRƯỞNG KHOA").Bold();
                                right.Item().AlignCenter().PaddingTop(40).Text("Trần Đăng Công").Bold();
                            });
                        });
                    });
                });
            }).GeneratePdf();
        }

        private static void ConfigureWorksheet(IXLWorksheet worksheet)
        {
            worksheet.Columns(1, 12).Width = 15;
            worksheet.Row(1).Height = 22;
            worksheet.Row(2).Height = 22;
            worksheet.Row(3).Height = 10;
            worksheet.Row(4).Height = 24;
            worksheet.Row(5).Height = 22;
            worksheet.Row(6).Height = 8;

            worksheet.Style.Font.FontName = "Times New Roman";
            worksheet.Style.Font.FontSize = 11;
            worksheet.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
        }

        private static void WriteHeader(IXLWorksheet worksheet, DefenseOperationsExportSnapshotDto snapshot, ref int row)
        {
            MergeAndStyle(worksheet, row, 1, row, 6, "TRƯỜNG ĐẠI HỌC ĐẠI NAM", true, 12);
            MergeAndStyle(worksheet, row, 7, row, 12, "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", true, 12);
            row++;
            MergeAndStyle(worksheet, row, 1, row, 6, "KHOA CÔNG NGHỆ THÔNG TIN", true, 12);
            MergeAndStyle(worksheet, row, 7, row, 12, "Độc lập - Tự do - Hạnh phúc", true, 12);
            row++;
            row++;
            MergeAndStyle(worksheet, row, 1, row, 12, "ĐIỀU HÀNH CHẤM ĐIỂM BẢO VỆ ĐỒ ÁN", true, 14);
            row++;
            MergeAndStyle(worksheet, row, 1, row, 12, BuildPeriodTitle(snapshot), true, 12);
            row += 2;

            var period = snapshot.State;
            var metaText = $"Trạng thái: {BuildStatusLabel(period)} | Bắt đầu: {FormatDate(period.StartDate)} | Kết thúc: {FormatDate(period.EndDate)} | Còn lại: {BuildRemainingDays(period)} ngày";
            MergeAndStyle(worksheet, row, 1, row, 12, metaText, false, 10);
            row += 2;
        }

        private static void WriteKpiSection(IXLWorksheet worksheet, DefenseOperationsExportSnapshotDto snapshot, ref int row)
        {
            WriteSectionTitle(worksheet, row, 1, 12, "DASHBOARD TONG QUAN");
            row += 1;

            var totalCouncils = GetCouncilCount(snapshot);
            var totalTopics = snapshot.Councils.Items.Sum(x => x.Assignments.Count);
            var scoredTopics = snapshot.ScoringMatrix.Count(x => x.FinalScore.HasValue);
            var defendingTopics = snapshot.ScoringMatrix.Count(x => NormalizeStatus(x.Status) == "DEFENDING");
            var notStartedTopics = snapshot.ScoringMatrix.Count(x => NormalizeStatus(x.Status) == "PENDING");
            var completionPercent = totalTopics == 0 ? 0m : Math.Round((decimal)scoredTopics / totalTopics * 100m, 1);
            var activeCouncils = snapshot.Councils.Items.Count(x => IsActiveCouncilStatus(x.Status));
            var warningCount = snapshot.Monitoring.Scoring.Alerts.Count;

            WriteCard(worksheet, row, 1, 3, "TONG SO HOI DONG", totalCouncils.ToString(), $"{activeCouncils} dang hoat dong");
            WriteCard(worksheet, row, 4, 3, "TONG SO DE TAI", totalTopics.ToString(), "Tat ca hoi dong");
            WriteCard(worksheet, row, 7, 3, "DA CHAM", scoredTopics.ToString(), $"{completionPercent:0.0}% hoan thanh");
            WriteCard(worksheet, row, 10, 3, "DANG BAO VE", defendingTopics.ToString(), "Realtime tracking");
            row += 3;

            WriteCard(worksheet, row, 1, 3, "CHUA BAT DAU", notStartedTopics.ToString(), "Dang cho mo ca");
            WriteCard(worksheet, row, 4, 3, "TY LE HOAN THIEN", $"{completionPercent:0.0}%", "Tien do chot diem");
            WriteCard(worksheet, row, 7, 3, "HOI DONG HOAT DONG", activeCouncils.ToString(), "Co the cham diem");
            WriteCard(worksheet, row, 10, 3, "CANH BAO", warningCount.ToString(), "Ton tai hien tai");
            row += 4;
        }

        private static void WriteCouncilSection(IXLWorksheet worksheet, DefenseOperationsExportSnapshotDto snapshot, ref int row)
        {
            WriteSectionTitle(worksheet, row, 1, 12, "THEO DOI HOI DONG");
            row += 1;

            var headers = new[] { "Ma Hoi Dong", "Ten Hoi Dong", "Phong", "Chu tich", "Thu ky", "Phan bien", "So de tai", "Da cham", "Con lai", "Trang thai" };
            WriteTableHeader(worksheet, row, 1, headers);
            row++;

            foreach (var council in snapshot.Councils.Items.OrderBy(x => x.DefenseDate).ThenBy(x => x.CommitteeCode))
            {
                var scoredTopics = snapshot.ScoringMatrix.Count(x => x.CommitteeId == council.Id && x.FinalScore.HasValue);
                var totalTopics = council.Assignments.Count;
                var remaining = Math.Max(totalTopics - scoredTopics, 0);
                var chair = ResolveCouncilMemberDisplay(council, "CT");
                var secretary = ResolveCouncilMemberDisplay(council, "UVTK");
                var reviewer = ResolveCouncilMemberDisplay(council, "UVPB");

                WriteDataRow(worksheet, row, 1, new object[]
                {
                    council.CommitteeCode,
                    council.Name,
                    council.Room,
                    chair,
                    secretary,
                    reviewer,
                    totalTopics,
                    scoredTopics,
                    remaining,
                    council.Status
                });
                row++;
            }

            row += 1;
        }

        private static void WriteScoringMatrixSection(IXLWorksheet worksheet, DefenseOperationsExportSnapshotDto snapshot, ref int row)
        {
            WriteSectionTitle(worksheet, row, 1, 12, "MA TRAN CHAM DIEM");
            row += 1;

            var headers = new[] { "Ma Hoi Dong", "Ma SV", "Ho ten", "Ten de tai", "GVHD", "CT", "UVTK", "UVPB", "TB", "Do lech", "Trang thai" };
            WriteTableHeader(worksheet, row, 1, headers);
            row++;

            foreach (var score in snapshot.ScoringMatrix.OrderBy(x => x.CommitteeCode).ThenBy(x => x.StudentCode))
            {
                var status = BuildScoringStatus(score);
                WriteDataRow(worksheet, row, 1, new object[]
                {
                    score.CommitteeCode,
                    score.StudentCode,
                    score.StudentName,
                    score.TopicTitle,
                    score.ScoreGvhd.HasValue ? score.ScoreGvhd.Value.ToString("0.0", CultureInfo.InvariantCulture) : "waiting",
                    score.ScoreCt.HasValue ? score.ScoreCt.Value.ToString("0.0", CultureInfo.InvariantCulture) : "waiting",
                    score.ScoreTk.HasValue ? score.ScoreTk.Value.ToString("0.0", CultureInfo.InvariantCulture) : "waiting",
                    score.ScorePb.HasValue ? score.ScorePb.Value.ToString("0.0", CultureInfo.InvariantCulture) : "waiting",
                    score.FinalScore.HasValue ? score.FinalScore.Value.ToString("0.0", CultureInfo.InvariantCulture) : "waiting",
                    score.Variance.HasValue ? score.Variance.Value.ToString("0.0", CultureInfo.InvariantCulture) : "-",
                    status
                });

                if (score.Variance.HasValue && score.Variance.Value >= 2m)
                {
                    worksheet.Row(row).Style.Fill.BackgroundColor = XLColor.FromArgb(255, 239, 213);
                }

                row++;
            }

            row += 1;
        }

        private static void WriteAnalyticsSection(IXLWorksheet worksheet, DefenseOperationsExportSnapshotDto snapshot, ref int row)
        {
            WriteSectionTitle(worksheet, row, 1, 12, "THONG KE SAU KHI CHAM XONG");
            row += 1;

            var overview = snapshot.Monitoring.Analytics.Overview;
            var gradeDistribution = BuildGradeDistribution(snapshot);
            var councilProgressRows = snapshot.Monitoring.Scoring.Progress.OrderBy(x => x.CommitteeCode).ToList();

            MergeAndStyle(worksheet, row, 1, row, 4, $"Diem trung binh hoi dong: {overview.Average:0.0}", true, 11);
            MergeAndStyle(worksheet, row, 5, row, 8, $"Diem trung binh dot: {overview.Average:0.0}", true, 11);
            MergeAndStyle(worksheet, row, 9, row, 12, $"Ty le dat: {overview.PassRate:0.0}%", true, 11);
            row += 1;

            MergeAndStyle(worksheet, row, 1, row, 4, $"Cao nhat: {overview.Highest:0.0} - {overview.HighestStudentName}", false, 10);
            MergeAndStyle(worksheet, row, 5, row, 8, $"Thap nhat: {overview.Lowest:0.0} - {overview.LowestStudentName}", false, 10);
            MergeAndStyle(worksheet, row, 9, row, 12, $"Dat: {overview.TotalStudents} sinh vien", false, 10);
            row += 2;

            WriteSectionTitle(worksheet, row, 1, 12, "PHAN BO XEP LOAI");
            row += 1;
            var gradeHeaders = new[] { "A", "B", "C", "D", "F" };
            WriteTableHeader(worksheet, row, 1, gradeHeaders);
            row++;
            WriteDataRow(worksheet, row, 1, gradeDistribution.Values.Cast<object>().ToArray());
            row += 2;

            WriteSectionTitle(worksheet, row, 1, 12, "TIEN DO KHOA CA THEO HOI DONG");
            row += 1;
            WriteTableHeader(worksheet, row, 1, new[] { "Ma Hoi Dong", "Tong so", "Da xong", "Tien do" });
            row++;
            foreach (var progress in councilProgressRows)
            {
                WriteDataRow(worksheet, row, 1, new object[]
                {
                    progress.CommitteeCode,
                    progress.TotalAssignments,
                    progress.CompletedAssignments,
                    $"{progress.ProgressPercent:0.0}%"
                });
                row++;
            }

            row += 1;
        }

        private static void WriteAlertSection(IXLWorksheet worksheet, DefenseOperationsExportSnapshotDto snapshot, ref int row)
        {
            WriteSectionTitle(worksheet, row, 1, 12, "CANH BAO");
            row += 1;

            WriteTableHeader(worksheet, row, 1, new[] { "Ma canh bao", "Loai", "Hoi dong", "De tai", "Noi dung", "Gia tri", "Nguong" });
            row++;

            foreach (var alert in snapshot.Monitoring.Scoring.Alerts)
            {
                WriteDataRow(worksheet, row, 1, new object[]
                {
                    alert.AlertCode,
                    alert.Type,
                    alert.CommitteeCode,
                    alert.AssignmentCode,
                    alert.Message,
                    alert.Value?.ToString("0.0", CultureInfo.InvariantCulture) ?? "-",
                    alert.Threshold?.ToString("0.0", CultureInfo.InvariantCulture) ?? "-"
                });
                row++;
            }

            row += 1;
        }

        private static void WritePostDefenseSection(IXLWorksheet worksheet, DefenseOperationsExportSnapshotDto snapshot, ref int row)
        {
            WriteSectionTitle(worksheet, row, 1, 12, "HAU BAO VE");
            row += 1;

            WriteTableHeader(worksheet, row, 1, new[] { "ID", "De tai", "Sinh vien", "Trang thai", "GVHD", "UVTK", "CT", "Cap nhat" });
            row++;

            foreach (var revision in snapshot.PostDefense.Items.OrderByDescending(x => x.LastUpdated).ThenByDescending(x => x.RevisionId))
            {
                WriteDataRow(worksheet, row, 1, new object[]
                {
                    revision.RevisionId,
                    revision.TopicTitle,
                    $"{revision.StudentCode} - {revision.StudentName}",
                    revision.FinalStatus,
                    revision.IsGvhdApproved ? "YES" : "NO",
                    revision.IsUvtkApproved ? "YES" : "NO",
                    revision.IsCtApproved ? "YES" : "NO",
                    revision.LastUpdated
                });
                row++;
            }

            row += 1;
        }

        private static void WriteAuditSection(IXLWorksheet worksheet, DefenseOperationsExportSnapshotDto snapshot, ref int row)
        {
            WriteSectionTitle(worksheet, row, 1, 12, "NHAT KY HE THONG");
            row += 1;

            WriteTableHeader(worksheet, row, 1, new[] { "Thoi gian", "Loai", "Ket qua", "Du lieu" });
            row++;

            var timeline = snapshot.Audit.SyncHistory
                .Select(x => new { Timestamp = x.Timestamp, Type = x.Action, Result = x.Result, Data = x.Records })
                .Concat(snapshot.Audit.PublishHistory.Select(x => new { Timestamp = x.Timestamp, Type = x.Action, Result = x.Result, Data = x.Records }))
                .Concat(snapshot.Audit.CouncilAuditHistory.Select(x => new { Timestamp = x.Timestamp, Type = "COUNCIL", Result = x.Result, Data = x.Records }))
                .Concat(snapshot.Audit.RevisionAuditTrail.Select(x => new { Timestamp = x.Timestamp, Type = "REVISION", Result = x.Result, Data = x.Records }))
                .OrderByDescending(x => x.Timestamp)
                .ToList();

            foreach (var item in timeline)
            {
                WriteDataRow(worksheet, row, 1, new object[]
                {
                    item.Timestamp,
                    item.Type,
                    item.Result,
                    item.Data
                });
                row++;
            }

            row += 1;
        }

        private static void WriteSignatureSection(IXLWorksheet worksheet, DefenseOperationsExportSnapshotDto snapshot, ref int row)
        {
            MergeAndStyle(worksheet, row, 2, row, 6, "NGƯỜI LẬP BIỂU", true, 11);
            MergeAndStyle(worksheet, row, 8, row, 12, "TRƯỞNG KHOA", true, 11);
            row += 3;
            MergeAndStyle(worksheet, row, 2, row, 6, "Nguyễn Thị Hương Giang", true, 11);
            MergeAndStyle(worksheet, row, 8, row, 12, "Trần Đăng Công", true, 11);
            row += 1;
            MergeAndStyle(worksheet, row, 8, row, 12, $"Hà Nội, ngày {DateTime.Now:dd} tháng {DateTime.Now:MM} năm {DateTime.Now:yyyy}", false, 10);
        }

        private static void WriteSectionTitle(IXLWorksheet worksheet, int row, int startCol, int endCol, string title)
        {
            MergeAndStyle(worksheet, row, startCol, row, endCol, title, true, 11);
        }

        private static void WriteCard(IXLWorksheet worksheet, int row, int startCol, int span, string title, string value, string subtitle)
        {
            var endCol = startCol + span - 1;
            var range = worksheet.Range(row, startCol, row + 2, endCol);
            range.Merge();
            range.Style.Fill.BackgroundColor = XLColor.FromArgb(236, 253, 245);
            range.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            range.Style.Border.OutsideBorderColor = XLColor.FromArgb(34, 197, 94);
            range.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            range.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            range.Style.Alignment.WrapText = true;
            range.Style.Font.FontName = "Times New Roman";

            var cell = worksheet.Cell(row, startCol);
            cell.Value = $"{title}\n{value}\n{subtitle}";
            cell.Style.Font.Bold = true;
            cell.Style.Font.FontSize = 11;
        }

        private static void WriteTableHeader(IXLWorksheet worksheet, int row, int startCol, IReadOnlyList<string> headers)
        {
            for (var i = 0; i < headers.Count; i++)
            {
                var cell = worksheet.Cell(row, startCol + i);
                cell.Value = headers[i];
                cell.Style.Font.Bold = true;
                cell.Style.Fill.BackgroundColor = XLColor.FromArgb(31, 41, 55);
                cell.Style.Font.FontColor = XLColor.White;
                cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
                cell.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;

                var normalizedHeader = headers[i].Trim().ToLowerInvariant();
                if (normalizedHeader.Contains("de tai") || normalizedHeader.Contains("topictitle"))
                {
                    worksheet.Column(startCol + i).Width = 38;
                }
                else if (normalizedHeader.Contains("noi dung") || normalizedHeader.Contains("review"))
                {
                    worksheet.Column(startCol + i).Width = 40;
                }
            }
        }

        private static void WriteDataRow(IXLWorksheet worksheet, int row, int startCol, IReadOnlyList<object> values)
        {
            var maxTextLength = 0;
            for (var i = 0; i < values.Count; i++)
            {
                var cell = worksheet.Cell(row, startCol + i);
                var cellText = values[i] switch
                {
                    null => string.Empty,
                    DateTime dt => dt == default ? string.Empty : dt.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
                    decimal d => d.ToString("0.0", CultureInfo.InvariantCulture),
                    bool b => b ? "YES" : "NO",
                    _ => values[i]?.ToString() ?? string.Empty
                };
                cell.Value = cellText;
                maxTextLength = Math.Max(maxTextLength, cellText.Length);
                cell.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
                cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
                cell.Style.Alignment.WrapText = true;
                if (i < 2)
                {
                    cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                }
            }

            worksheet.Row(row).Height = maxTextLength > 90 ? 42 : maxTextLength > 50 ? 30 : 22;
        }

        private static void MergeAndStyle(IXLWorksheet worksheet, int startRow, int startCol, int endRow, int endCol, string text, bool bold, int fontSize)
        {
            var range = worksheet.Range(startRow, startCol, endRow, endCol);
            range.Merge();
            range.Value = text;
            range.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            range.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            range.Style.Alignment.WrapText = true;
            range.Style.Font.FontName = "Times New Roman";
            range.Style.Font.Bold = bold;
            range.Style.Font.FontSize = fontSize;
        }

        private static string BuildPeriodTitle(DefenseOperationsExportSnapshotDto snapshot)
        {
            return $"NGANH CONG NGHE THONG TIN - DOT BAO VE ID {snapshot.DefenseTermId}";
        }

        private static string BuildPeriodMeta(DefenseOperationsExportSnapshotDto snapshot)
        {
            var state = snapshot.State;
            return $"Trang thai: {BuildStatusLabel(state)} | Bat dau: {FormatDate(state.StartDate)} | Ket thuc: {FormatDate(state.EndDate)} | Con lai: {BuildRemainingDays(state)} ngay";
        }

        private static string BuildKpiSummary(DefenseOperationsExportSnapshotDto snapshot)
        {
            var totalCouncils = GetCouncilCount(snapshot);
            var totalTopics = snapshot.Councils.Items.Sum(x => x.Assignments.Count);
            var scoredTopics = snapshot.ScoringMatrix.Count(x => x.FinalScore.HasValue);
            var activeCouncils = snapshot.Councils.Items.Count(x => IsActiveCouncilStatus(x.Status));
            var warnings = snapshot.Monitoring.Scoring.Alerts.Count;
            var completion = totalTopics == 0 ? 0m : Math.Round((decimal)scoredTopics / totalTopics * 100m, 1);

            return $"Tong so hoi dong: {totalCouncils} | Tong so de tai: {totalTopics} | Da cham: {scoredTopics} | Ty le hoan thanh: {completion:0.0}% | Hoi dong hoat dong: {activeCouncils} | Canh bao: {warnings}";
        }

        private static string BuildCouncilSummary(DefenseOperationsExportSnapshotDto snapshot)
        {
            var totalCouncils = GetCouncilCount(snapshot);
            var pending = snapshot.Councils.Items.Count(x => NormalizeStatus(x.Status) == "PENDING");
            var ready = snapshot.Councils.Items.Count(x => NormalizeStatus(x.Status) == "READY");
            var ongoing = snapshot.Councils.Items.Count(x => NormalizeStatus(x.Status) == "ONGOING");
            var locked = snapshot.Councils.Items.Count(x => NormalizeStatus(x.Status) == "LOCKED");
            var published = snapshot.Councils.Items.Count(x => NormalizeStatus(x.Status) == "PUBLISHED");

            return $"Hoi dong: {totalCouncils} | Pending: {pending} | Ready: {ready} | Ongoing: {ongoing} | Locked: {locked} | Published: {published}";
        }

        private static string BuildScoringSummary(DefenseOperationsExportSnapshotDto snapshot)
        {
            var total = snapshot.ScoringMatrix.Count;
            var waiting = snapshot.ScoringMatrix.Count(x => x.SubmittedCount < x.RequiredCount);
            var alert = snapshot.ScoringMatrix.Count(x => x.Variance.HasValue && x.Variance.Value >= 2m);
            var locked = snapshot.ScoringMatrix.Count(x => x.IsLocked);
            return $"Ma tran cham diem: {total} dong | Waiting: {waiting} | Locked: {locked} | Lech diem: {alert}";
        }

        private static string BuildAnalyticsSummary(DefenseOperationsExportSnapshotDto snapshot)
        {
            var overview = snapshot.Monitoring.Analytics.Overview;
            return $"Diem trung binh toan dot: {overview.Average:0.0} | Dat: {overview.PassRate:0.0}% | Cao nhat: {overview.Highest:0.0} | Thap nhat: {overview.Lowest:0.0}";
        }

        private static string BuildAlertSummary(DefenseOperationsExportSnapshotDto snapshot)
        {
            var alerts = snapshot.Monitoring.Scoring.Alerts;
            if (alerts.Count == 0)
            {
                return "Canh bao: khong co";
            }

            var first = alerts.First();
            return $"Canh bao: {alerts.Count} | Gan nhat: {first.Message} ({first.CommitteeCode}/{first.AssignmentCode})";
        }

        private static string BuildPostDefenseSummary(DefenseOperationsExportSnapshotDto snapshot)
        {
            var post = snapshot.PostDefense;
            return $"Hau bao ve: Tong {post.TotalRevisions} | Pending {post.PendingRevisions} | Approved {post.ApprovedRevisions} | Rejected {post.RejectedRevisions} | PublishedScores {post.PublishedScores} | LockedScores {post.LockedScores}";
        }

        private static string BuildAuditSummary(DefenseOperationsExportSnapshotDto snapshot)
        {
            var sync = snapshot.Audit.SyncHistory.Count;
            var publish = snapshot.Audit.PublishHistory.Count;
            var council = snapshot.Audit.CouncilAuditHistory.Count;
            var revision = snapshot.Audit.RevisionAuditTrail.Count;
            return $"Nhat ky: Sync {sync} | Publish {publish} | Council {council} | Revision {revision}";
        }

        private static string BuildPeriodStatusLabel(DefensePeriodStateDto state)
        {
            if (state.Finalized && state.ScoresPublished)
            {
                return "PUBLISHED";
            }

            if (state.Finalized)
            {
                return "FINALIZED";
            }

            if (state.CouncilListLocked)
            {
                return "LOCKED";
            }

            return state.CouncilConfigConfirmed ? "READY" : "DRAFT";
        }

        private static string BuildStatusLabel(DefensePeriodStateDto state) => BuildPeriodStatusLabel(state);

        private static string FormatDate(DateTime dateTime) => dateTime == default ? "-" : dateTime.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);

        private static string FormatDate(DateTime? dateTime) => dateTime.HasValue ? dateTime.Value.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture) : "-";

        private static string BuildRemainingDays(DefensePeriodStateDto state)
        {
            if (!state.EndDate.HasValue)
            {
                return "-";
            }

            return Math.Ceiling((state.EndDate.Value.Date - DateTime.Today).TotalDays).ToString(CultureInfo.InvariantCulture);
        }

        private static int GetCouncilCount(DefenseOperationsExportSnapshotDto snapshot)
        {
            return snapshot.Councils.TotalCount > 0 ? snapshot.Councils.TotalCount : snapshot.Councils.Items.Count();
        }

        private static bool IsActiveCouncilStatus(string? status)
        {
            var normalized = NormalizeStatus(status);
            return normalized is "READY" or "ONGOING" or "LOCKED" or "COMPLETED" or "PUBLISHED";
        }

        private static string NormalizeStatus(string? status)
        {
            if (string.IsNullOrWhiteSpace(status))
            {
                return string.Empty;
            }

            return status.Trim().ToUpperInvariant();
        }

        private static string ResolveCouncilMemberDisplay(CouncilDraftDto council, string role)
        {
            var member = council.Members.FirstOrDefault(x => string.Equals(x.Role, role, StringComparison.OrdinalIgnoreCase));
            if (member == null)
            {
                return "-";
            }

            var parts = new List<string>();
            if (!string.IsNullOrWhiteSpace(member.Degree))
            {
                parts.Add(member.Degree.Trim());
            }

            if (!string.IsNullOrWhiteSpace(member.LecturerName))
            {
                parts.Add(member.LecturerName.Trim());
            }

            var display = string.Join(' ', parts);
            if (!string.IsNullOrWhiteSpace(member.Organization))
            {
                display = string.IsNullOrWhiteSpace(display)
                    ? member.Organization.Trim()
                    : $"{display} - {member.Organization.Trim()}";
            }

            return display;
        }

        private static string BuildScoringStatus(ScoringMatrixRowDto row)
        {
            if (row.IsLocked)
            {
                return "LOCKED";
            }

            if (row.FinalScore.HasValue)
            {
                return "SCORED";
            }

            if (row.SubmittedCount <= 0)
            {
                return "WAITING";
            }

            return row.Variance.HasValue && row.Variance.Value >= 2m ? "ALERT" : "SCORING";
        }

        private static Dictionary<string, int> BuildGradeDistribution(DefenseOperationsExportSnapshotDto snapshot)
        {
            var distribution = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
            {
                ["A"] = 0,
                ["B"] = 0,
                ["C"] = 0,
                ["D"] = 0,
                ["F"] = 0
            };

            foreach (var row in snapshot.ScoringMatrix.Where(x => x.FinalScore.HasValue))
            {
                var grade = row.FinalGrade?.Trim().ToUpperInvariant();
                if (grade == null || !distribution.ContainsKey(grade))
                {
                    grade = row.FinalScore >= 9m ? "A"
                        : row.FinalScore >= 7m ? "B"
                        : row.FinalScore >= 5.5m ? "C"
                        : row.FinalScore >= 4m ? "D"
                        : "F";
                }

                distribution[grade]++;
            }

            return distribution;
        }

        private static string BuildFileStem(DefenseOperationsExportSnapshotDto snapshot)
        {
            var periodSuffix = snapshot.DefenseTermId > 0 ? snapshot.DefenseTermId.ToString(CultureInfo.InvariantCulture) : "operations";
            return $"dieu-hanh-cham-diem-{periodSuffix}-{DateTime.UtcNow:yyyyMMdd-HHmmss}";
        }
    }
}
using System.Globalization;
using ClosedXML.Excel;
using ThesisManagement.Api.DTOs.DefensePeriods;
using ThesisManagement.Api.Services.DefenseOperationsExport.Internal;

namespace ThesisManagement.Api.Services.DefenseOperationsExport.Exporters
{
    public class DefenseExcelExporter
    {
        private readonly DefenseExportBrandingOptions _branding;

        public DefenseExcelExporter(DefenseExportBrandingOptions branding)
        {
            _branding = branding;
        }

        public byte[] Export(
            DefenseOperationsExportSnapshotDto snapshot,
            string template,
            DefenseExportMetrics metrics,
            IReadOnlyList<CouncilExportRow> councilRows,
            IReadOnlyList<ScoringExportRawDto> scoringRows,
            IReadOnlyList<PostDefenseExportRow> postDefenseRows,
            DateTime now,
            string currentUserName,
            IReadOnlyList<string>? selectedFields = null)
        {
            using var workbook = new XLWorkbook();
            var worksheet = workbook.AddWorksheet("BaoCao");

            ConfigureWorksheet(worksheet);

            var row = 1;
            WriteHeader(worksheet, snapshot, ref row, template, metrics, now);
            row += 1;

            switch (template)
            {
                case DefenseExportConstants.Templates.Dashboard:
                    WriteKpiSection(worksheet, metrics, ref row);
                    row += 1;
                    WriteCouncilSection(worksheet, councilRows, ref row);
                    row += 1;
                    WriteScoringMatrixSection(worksheet, scoringRows, selectedFields ?? new List<string>(), ref row);
                    row += 1;
                    WritePostDefenseSection(worksheet, postDefenseRows, ref row);
                    break;

                case DefenseExportConstants.Templates.Scoring:
                case DefenseExportConstants.Templates.ScoringConfig:
                    WriteScoringMatrixSection(worksheet, scoringRows, selectedFields ?? new List<string>(), ref row);
                    break;

                case DefenseExportConstants.Templates.PostDefense:
                    WritePostDefenseSection(worksheet, postDefenseRows, ref row);
                    break;

                case DefenseExportConstants.Templates.Councils:
                    WriteCouncilSection(worksheet, councilRows, ref row);
                    break;

                case DefenseExportConstants.Templates.Topics:
                    WriteTopicListSection(worksheet, scoringRows, selectedFields ?? new List<string>(), ref row);
                    break;

                case "custom":
                case "official-transcript":
                case "council-minutes":
                case "statistics":
                    WriteCustomSection(worksheet, scoringRows, selectedFields ?? new List<string>(), ref row);
                    break;

                default:
                    WriteKpiSection(worksheet, metrics, ref row);
                    row += 1;
                    WriteScoringMatrixSection(worksheet, scoringRows, selectedFields ?? new List<string>(), ref row);
                    break;
            }

            row += 1;
            WriteSummarySection(worksheet, scoringRows, ref row);
            row += 2;
            WriteSignatureSection(worksheet, ref row, now, currentUserName);

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return stream.ToArray();
        }

        private void ConfigureWorksheet(IXLWorksheet worksheet)
        {
            worksheet.Columns(1, 12).Width = 15;
            worksheet.Style.Font.FontName = "Times New Roman";
            worksheet.Style.Font.FontSize = 11;
            worksheet.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
        }

        private void WriteHeader(IXLWorksheet worksheet, DefenseOperationsExportSnapshotDto snapshot, ref int row, string template, DefenseExportMetrics metrics, DateTime now)
        {
            // Institution & Department (Left)
            MergeAndStyle(worksheet, row, 1, row, 4, "TRƯỜNG ĐẠI HỌC ĐẠI NAM", true, 11, XLAlignmentHorizontalValues.Left);
            // Motto Line 1 (Right)
            MergeAndStyle(worksheet, row, 6, row, 10, "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", true, 11, XLAlignmentHorizontalValues.Center);
            row++;
            
            MergeAndStyle(worksheet, row, 1, row, 4, "KHOA CÔNG NGHỆ THÔNG TIN", true, 11, XLAlignmentHorizontalValues.Left);
            // Motto Line 2 (Right)
            MergeAndStyle(worksheet, row, 6, row, 10, "Độc lập - Tự do - Hạnh phúc", true, 11, XLAlignmentHorizontalValues.Center);
            row++;
            
            // Border below motto
            var borderRange = worksheet.Range(row, 7, row, 9);
            borderRange.Style.Border.TopBorder = XLBorderStyleValues.Thin;
            row += 2;

            // Main Titles
            MergeAndStyle(worksheet, row, 1, row, 10, GetReportTitle(template).ToUpperInvariant(), true, 14);
            row++;
            MergeAndStyle(worksheet, row, 1, row, 10, "NGÀNH CÔNG NGHỆ THÔNG TIN", true, 12);
            row += 2;
        }

        private void WriteKpiSection(IXLWorksheet worksheet, DefenseExportMetrics metrics, ref int row)
        {
            WriteSectionTitle(worksheet, row, 1, 12, "DASHBOARD TỔNG QUAN");
            row += 1;

            WriteCard(worksheet, row, 1, 3, "TỔNG SỐ HỘI ĐỒNG", metrics.TotalCouncils.ToString(), $"{metrics.ActiveCouncils} đang hoạt động");
            WriteCard(worksheet, row, 4, 3, "TỔNG SỐ ĐỀ TÀI", metrics.TotalTopics.ToString(), "Tất cả hội đồng");
            WriteCard(worksheet, row, 7, 3, "ĐÃ CHẤM", metrics.ScoredTopics.ToString(), $"{metrics.CompletionPercent:0.0}% hoàn thành");
            WriteCard(worksheet, row, 10, 3, "ĐANG ĐỒ ÁN TỐT NGHIỆP", metrics.DefendingTopics.ToString(), "Realtime tracking");
            row += 3;

            WriteCard(worksheet, row, 1, 3, "CHƯA BẮT ĐẦU", metrics.PendingTopics.ToString(), "Đang chờ mở ca");
            WriteCard(worksheet, row, 4, 3, "TỶ LỆ HOÀN THIỆN", $"{metrics.CompletionPercent:0.0}%", "Tiến độ chốt điểm");
            WriteCard(worksheet, row, 7, 3, "HỘI ĐỒNG HOẠT ĐỘNG", metrics.ActiveCouncils.ToString(), "Có thể chấm điểm");
            WriteCard(worksheet, row, 10, 3, "CẢNH BÁO", metrics.WarningCount.ToString(), "Tồn tại hiện tại");
            row += 4;
        }

        private void WriteCouncilSection(IXLWorksheet worksheet, IReadOnlyList<CouncilExportRow> rows, ref int row)
        {
            WriteSectionTitle(worksheet, row, 1, 12, "THEO DÕI HỘI ĐỒNG");
            row += 1;

            var headers = new[] { "Mã Hội Đồng", "Tên Hội Đồng", "Phòng", "Chủ tịch", "Thư ký", "Phản biện", "Số đề tài", "Đã chấm", "Còn lại", "Trạng thái" };
            WriteTableHeader(worksheet, row, 1, headers);
            row++;

            foreach (var council in rows)
            {
                WriteDataRow(worksheet, row, 1, new object[]
                {
                    council.CommitteeCode,
                    council.Name,
                    council.Room,
                    council.Chair,
                    council.Secretary,
                    council.Reviewer,
                    council.TotalTopics,
                    council.ScoredTopics,
                    council.Remaining,
                    council.Status
                });
                row++;
            }
            row += 1;
        }

        private void WriteScoringMatrixSection(IXLWorksheet worksheet, IReadOnlyList<ScoringExportRawDto> rows, IReadOnlyList<string> fields, ref int row)
        {
            WriteGenericSection(worksheet, row, 1, fields, "BẢNG ĐIỂM CHI TIẾT", rows);
            row += rows.Count + 3;
        }

        private void WriteTopicListSection(IXLWorksheet worksheet, IReadOnlyList<ScoringExportRawDto> rows, IReadOnlyList<string> fields, ref int row)
        {
            WriteGenericSection(worksheet, row, 1, fields, "DANH SÁCH ĐỀ TÀI", rows);
            row += rows.Count + 3;
        }

        private void WriteGenericSection(IXLWorksheet worksheet, int startRow, int startCol, IReadOnlyList<string> fields, string title, IReadOnlyList<ScoringExportRawDto> data)
        {
            if (fields.Count == 0) return;

            WriteSectionTitle(worksheet, startRow, startCol, fields.Count, title);
            var headerRow = startRow + 1;
            
            var headers = fields.Select(DefenseExportRegistry.GetLabel).ToArray();
            WriteTableHeader(worksheet, headerRow, startCol, headers);

            var currentRow = headerRow + 1;
            foreach (var item in data)
            {
                var values = fields.Select(f => DefenseExportValueFormatter.Format(DefenseExportRegistry.ResolveValue(item, f))).ToArray();
                WriteDataRow(worksheet, currentRow, startCol, values);
                
                // Highlight high variance
                if (fields.Contains("Variance") && DefenseExportRules.IsHighVariance(item.Variance))
                {
                    worksheet.Row(currentRow).Style.Fill.BackgroundColor = XLColor.FromArgb(255, 239, 213);
                }

                currentRow++;
            }
        }

        private void WritePostDefenseSection(IXLWorksheet worksheet, IReadOnlyList<PostDefenseExportRow> rows, ref int row)
        {
            WriteSectionTitle(worksheet, row, 1, 12, "DANH SÁCH HẬU ĐỒ ÁN TỐT NGHIỆP CHI TIẾT");
            row += 1;

            var headers = new[] { "ID", "Hội đồng", "Chủ tịch", "Thư ký", "Đề tài", "Sinh viên", "Lý do nộp hậu", "Hạn nộp", "Trạng thái", "GVHD", "UVTK", "CT", "Cập nhật" };
            WriteTableHeader(worksheet, row, 1, headers);
            row++;

            foreach (var revision in rows)
            {
                WriteDataRow(worksheet, row, 1, new object[]
                {
                    revision.RevisionId,
                    revision.CommitteeCode,
                    revision.ChairName,
                    revision.SecretaryName,
                    revision.TopicTitle,
                    revision.StudentDisplay,
                    revision.RevisionReason,
                    revision.SubmissionDeadline?.ToString("dd/MM/yyyy") ?? "-",
                    revision.FinalStatus,
                    revision.GvhdApproved,
                    revision.UvtkApproved,
                    revision.CtApproved,
                    revision.LastUpdated
                });
                row++;
            }
            row += 1;
        }

        private void WriteCustomSection(IXLWorksheet worksheet, IReadOnlyList<ScoringExportRawDto> rows, IReadOnlyList<string> selectedFields, ref int row)
        {
            WriteGenericSection(worksheet, row, 1, selectedFields, "BÁO CÁO TÙY CHỈNH", rows);
            row += rows.Count + 3;
        }

        private void WriteSummarySection(IXLWorksheet worksheet, IReadOnlyList<ScoringExportRawDto> rows, ref int row)
        {
            if (rows.Count == 0) return;

            var scores = rows
                .Select(x => x.FinalScore)
                .Where(x => x.HasValue)
                .Select(x => x!.Value)
                .ToList();

            if (scores.Count == 0) return;

            var max = scores.Max();
            var min = scores.Min();

            worksheet.Cell(row, 1).Value = "Điểm cao nhất";
            worksheet.Cell(row, 1).Style.Font.Bold = true;
            worksheet.Cell(row, 4).Value = max.ToString("0.0", CultureInfo.InvariantCulture);
            row++;

            worksheet.Cell(row, 1).Value = "Điểm thấp nhất";
            worksheet.Cell(row, 1).Style.Font.Bold = true;
            worksheet.Cell(row, 4).Value = min.ToString("0.0", CultureInfo.InvariantCulture);
            row++;
        }

        private void WriteSignatureSection(IXLWorksheet worksheet, ref int row, DateTime now, string currentUserName)
        {
            MergeAndStyle(worksheet, row, 2, row, 6, "Người lập biểu", true, 11);
            MergeAndStyle(worksheet, row, 8, row, 12, $"{_branding.Location}, ngày {now:dd} tháng {now:MM} năm {now:yyyy}", false, 10);
            row++;
            MergeAndStyle(worksheet, row, 8, row, 12, _branding.Signatory2Role, true, 11);
            row += 3;
            MergeAndStyle(worksheet, row, 2, row, 6, currentUserName, true, 11);
            MergeAndStyle(worksheet, row, 8, row, 12, _branding.Signatory2Name, true, 11);
            row += 1;
        }

        private void WriteSectionTitle(IXLWorksheet worksheet, int row, int startCol, int endCol, string title)
        {
            if (string.IsNullOrWhiteSpace(title)) return;

            // Skip rendering small table captions/titles to keep templates cleaner.
            // Examples: "BẢNG ...", "DANH SÁCH ...", "THEO DÕI ...".
            var upper = title.ToUpperInvariant();
            if (upper.Contains("BẢNG") || upper.Contains("BANG") || upper.Contains("DANH SÁCH") || upper.Contains("THEO DÕI"))
            {
                return;
            }

            MergeAndStyle(worksheet, row, startCol, row, endCol, title, true, 11);
        }

        private void WriteCard(IXLWorksheet worksheet, int row, int startCol, int span, string title, string value, string subtitle)
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

        private void WriteTableHeader(IXLWorksheet worksheet, int row, int startCol, IReadOnlyList<string> headers)
        {
            for (var i = 0; i < headers.Count; i++)
            {
                var cell = worksheet.Cell(row, startCol + i);
                cell.Value = headers[i];
                cell.Style.Font.Bold = true;
                // keep header background white (no fill) and default font color
                cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
                cell.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;

                var h = headers[i];
                if (h.Contains("đề tài", StringComparison.OrdinalIgnoreCase) || h.Contains("Topic", StringComparison.OrdinalIgnoreCase))
                {
                    worksheet.Column(startCol + i).Width = 38;
                }
            }
        }

        private void WriteDataRow(IXLWorksheet worksheet, int row, int startCol, IReadOnlyList<object> values)
        {
            var maxTextLength = 0;
            for (var i = 0; i < values.Count; i++)
            {
                var cell = worksheet.Cell(row, startCol + i);
                var cellValue = values[i];
                cell.Value = cellValue?.ToString() ?? string.Empty;
                maxTextLength = Math.Max(maxTextLength, cell.Value.ToString().Length);
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

        private void MergeAndStyle(IXLWorksheet worksheet, int startRow, int startCol, int endRow, int endCol, string text, bool bold, int fontSize, XLAlignmentHorizontalValues horizontalAlignment = XLAlignmentHorizontalValues.Center)
        {
            var range = worksheet.Range(startRow, startCol, endRow, endCol);
            range.Merge();
            range.Value = text;
            range.Style.Alignment.Horizontal = horizontalAlignment;
            range.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            range.Style.Alignment.WrapText = true;
            range.Style.Font.FontName = "Times New Roman";
            range.Style.Font.Bold = bold;
            range.Style.Font.FontSize = fontSize;
        }

        private string GetReportTitle(string template)
        {
            return template switch
            {
                DefenseExportConstants.Templates.Dashboard => "BÁO CÁO TỔNG HỢP ĐIỀU HÀNH CHẤM ĐIỂM",
                DefenseExportConstants.Templates.Scoring => "BẢNG ĐIỂM CHI TIẾT ĐỒ ÁN TỐT NGHIỆP",
                DefenseExportConstants.Templates.ScoringConfig => "CẤU HÌNH VÀ BẢNG ĐIỂM ĐỒ ÁN TỐT NGHIỆP",
                DefenseExportConstants.Templates.PostDefense => "DANH SÁCH THEO DÕI HẬU ĐỒ ÁN TỐT NGHIỆP",
                DefenseExportConstants.Templates.Councils => "DANH SÁCH HỘI ĐỒNG ĐỒ ÁN TỐT NGHIỆP",
                DefenseExportConstants.Templates.Topics => "DANH SÁCH ĐỀ TÀI ĐỒ ÁN TỐT NGHIỆP",
                _ => "BÁO CÁO ĐIỀU HÀNH CHẤM ĐIỂM"
            };
        }

        private string BuildPeriodTitle(DefenseOperationsExportSnapshotDto snapshot) => 
            $"{_branding.Department.ToUpperInvariant()} - ĐỢT ĐỒ ÁN TỐT NGHIỆP ID {snapshot.DefenseTermId}";

        private string BuildRemainingDays(DefensePeriodStateDto state)
        {
            if (!state.EndDate.HasValue) return "-";
            var days = Math.Ceiling((state.EndDate.Value.Date - DateTime.Today).TotalDays);
            return Math.Max(0, (int)days).ToString(CultureInfo.InvariantCulture);
        }
    }
}

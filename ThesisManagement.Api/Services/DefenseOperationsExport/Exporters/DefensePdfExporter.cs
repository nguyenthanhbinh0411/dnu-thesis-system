using System.Globalization;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using ThesisManagement.Api.DTOs.DefensePeriods;
using ThesisManagement.Api.Services.DefenseOperationsExport.Internal;

namespace ThesisManagement.Api.Services.DefenseOperationsExport.Exporters
{
    public class DefensePdfExporter
    {
        private readonly DefenseExportBrandingOptions _branding;

        public DefensePdfExporter(DefenseExportBrandingOptions branding)
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
            return Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Margin(22);
                    page.Size(PageSizes.A4);
                    page.DefaultTextStyle(x => x.FontSize(9).FontFamily(Fonts.TimesNewRoman));

                    page.Header().Column(column =>
                    {
                        column.Spacing(2);
                        column.Item().Row(row =>
                        {
                            row.RelativeItem().Column(left =>
                            {
                                left.Item().Text("TRƯỜNG ĐẠI HỌC ĐẠI NAM").Bold().FontSize(10);
                                left.Item().Text("KHOA CÔNG NGHỆ THÔNG TIN").Bold().FontSize(10);
                            });

                            row.RelativeItem().AlignRight().Column(right =>
                            {
                                right.Item().AlignCenter().Text("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM").Bold().FontSize(10);
                                right.Item().AlignCenter().Text("Độc lập - Tự do - Hạnh phúc").Bold().FontSize(10);
                                right.Item().AlignCenter().PaddingTop(2).Width(80).LineHorizontal(1).LineColor(Colors.Black);
                            });
                        });

                        column.Item().PaddingTop(15).AlignCenter().Text(GetReportTitle(template).ToUpperInvariant()).Bold().FontSize(14);
                        column.Item().AlignCenter().Text("NGÀNH CÔNG NGHỆ THÔNG TIN").Bold().FontSize(11);
                    });

                    page.Content().PaddingTop(10).Column(column =>
                    {
                        column.Spacing(8);
                        column.Item().Text(BuildPeriodMeta(snapshot));

                        if (template == DefenseExportConstants.Templates.Dashboard)
                        {
                            column.Item().Text(metrics.KpiSummary ?? "-");
                            column.Item().Text(metrics.CouncilSummary ?? "-");
                            column.Item().Text(metrics.ScoringSummary ?? "-");

                            var councilTitle = "DANH SÁCH HỘI ĐỒNG";
                            if (ShouldRenderTitle(councilTitle)) column.Item().PaddingTop(12).Text(councilTitle).Bold().FontSize(11);
                            column.Item().PaddingTop(6).Table(table => BuildPdfCouncilTable(table, councilRows));

                            var scoringTitle = "BẢNG ĐIỂM CHI TIẾT (RÚT GỌN)";
                            if (ShouldRenderTitle(scoringTitle)) column.Item().PaddingTop(12).Text(scoringTitle).Bold().FontSize(11);
                            column.Item().PaddingTop(6).Table(table => BuildPdfScoringMatrixTable(table, scoringRows));

                            var postTitle = "DANH SÁCH HẬU ĐỒ ÁN TỐT NGHIỆP";
                            if (ShouldRenderTitle(postTitle)) column.Item().PaddingTop(12).Text(postTitle).Bold().FontSize(11);
                            column.Item().PaddingTop(6).Table(table => BuildPdfPostDefenseTable(table, postDefenseRows));
                        }
                        else if (template == DefenseExportConstants.Templates.Scoring || template == DefenseExportConstants.Templates.ScoringConfig)
                        {
                            var scoringTitle = "BẢNG ĐIỂM CHI TIẾT";
                            if (ShouldRenderTitle(scoringTitle)) column.Item().PaddingTop(12).Text(scoringTitle).Bold().FontSize(11);
                            column.Item().PaddingTop(6).Table(table => BuildPdfGenericTable(table, scoringRows, selectedFields ?? new List<string>()));
                        }
                        else if (template == DefenseExportConstants.Templates.PostDefense)
                        {
                            var postTitle = "DANH SÁCH HẬU ĐỒ ÁN TỐT NGHIỆP";
                            if (ShouldRenderTitle(postTitle)) column.Item().PaddingTop(12).Text(postTitle).Bold().FontSize(11);
                            column.Item().PaddingTop(6).Table(table => BuildPdfPostDefenseTable(table, postDefenseRows));
                        }
                        else if (template == DefenseExportConstants.Templates.Councils)
                        {
                            var councilTitle = "DANH SÁCH HỘI ĐỒNG";
                            if (ShouldRenderTitle(councilTitle)) column.Item().PaddingTop(12).Text(councilTitle).Bold().FontSize(11);
                            column.Item().PaddingTop(6).Table(table => BuildPdfCouncilTable(table, councilRows));
                        }
                        else if (template == DefenseExportConstants.Templates.Topics)
                        {
                            var topicsTitle = "DANH SÁCH ĐỀ TÀI";
                            if (ShouldRenderTitle(topicsTitle)) column.Item().PaddingTop(12).Text(topicsTitle).Bold().FontSize(11);
                            column.Item().PaddingTop(6).Table(table => BuildPdfGenericTable(table, scoringRows, selectedFields ?? new List<string>()));
                        }
                        else if (template == "custom" || template == "official-transcript" || template == "council-minutes" || template == "statistics")
                        {
                            var customTitle = "BÁO CÁO TÙY CHỈNH";
                            if (ShouldRenderTitle(customTitle)) column.Item().PaddingTop(12).Text(customTitle).Bold().FontSize(11);
                            column.Item().PaddingTop(6).Table(table => BuildPdfGenericTable(table, scoringRows, selectedFields ?? new List<string>()));
                        }

                        // Summary Section
                        var scores = scoringRows
                            .Select(x => x.FinalScore)
                            .Where(x => x.HasValue).Select(x => x!.Value).ToList();
                        
                        if (scores.Any())
                        {
                            column.Item().PaddingTop(10).Row(row =>
                            {
                                row.Spacing(20);
                                row.AutoItem().Text(x => { x.Span("Điểm cao nhất: ").Bold(); x.Span(scores.Max().ToString("0.0")); });
                                row.AutoItem().Text(x => { x.Span("Điểm thấp nhất: ").Bold(); x.Span(scores.Min().ToString("0.0")); });
                            });
                        }

                        column.Item().PaddingTop(24).Row(row =>
                        {
                            row.RelativeItem().Column(left =>
                            {
                                left.Item().AlignCenter().Text("Người lập biểu").Bold();
                                left.Item().AlignCenter().PaddingTop(40).Text(currentUserName).Bold();
                            });

                            row.RelativeItem().Column(right =>
                            {
                                right.Item().AlignCenter().Text($"{_branding.Location}, ngày {now:dd} tháng {now:MM} năm {now:yyyy}").Italic();
                                right.Item().AlignCenter().Text("TRƯỞNG KHOA").Bold();
                                right.Item().AlignCenter().PaddingTop(40).Text(_branding.Signatory2Name).Bold();
                            });
                        });
                    });

                    page.Footer().AlignCenter().Text(x =>
                    {
                        x.Span("Trang ");
                        x.CurrentPageNumber();
                    });
                });
            }).GeneratePdf();
        }

        private void BuildPdfCouncilTable(TableDescriptor table, IReadOnlyList<CouncilExportRow> rows)
        {
            var headers = new[] { "Mã Hội Đồng", "Tên Hội Đồng", "Phòng", "Chủ tịch", "Thư ký", "Số đề tài", "Đã chấm", "Trạng thái" };
            table.ColumnsDefinition(columns =>
            {
                columns.ConstantColumn(60); columns.RelativeColumn(); columns.ConstantColumn(40);
                columns.RelativeColumn(); columns.RelativeColumn(); columns.ConstantColumn(30);
                columns.ConstantColumn(30); columns.ConstantColumn(50);
            });

            table.Header(header => { foreach (var h in headers) header.Cell().Element(PdfHeaderStyle).Text(h); });

            foreach (var council in rows)
            {
                table.Cell().Element(PdfCellStyle).AlignCenter().Text(council.CommitteeCode);
                table.Cell().Element(PdfCellStyle).Text(council.Name);
                table.Cell().Element(PdfCellStyle).AlignCenter().Text(council.Room);
                table.Cell().Element(PdfCellStyle).Text(council.Chair);
                table.Cell().Element(PdfCellStyle).Text(council.Secretary);
                table.Cell().Element(PdfCellStyle).AlignCenter().Text(council.TotalTopics.ToString());
                table.Cell().Element(PdfCellStyle).AlignCenter().Text(council.ScoredTopics.ToString());
                table.Cell().Element(PdfCellStyle).AlignCenter().Text(council.Status.ToString());
            }
        }

        private void BuildPdfGenericTable(TableDescriptor table, IReadOnlyList<ScoringExportRawDto> rows, IReadOnlyList<string> fields)
        {
            if (fields == null || fields.Count == 0) return;

            table.ColumnsDefinition(columns =>
            {
                foreach (var _ in fields) columns.RelativeColumn();
            });

            table.Header(header =>
            {
                foreach (var field in fields)
                {
                    header.Cell().Element(PdfHeaderStyle).Text(DefenseExportRegistry.GetLabel(field));
                }
            });

            foreach (var score in rows)
            {
                foreach (var field in fields)
                {
                    var val = DefenseExportRegistry.ResolveValue(score, field);
                    table.Cell().Element(PdfCellStyle).Text(DefenseExportValueFormatter.Format(val));
                }
            }
        }

        private IContainer PdfHeaderStyle(IContainer container) => container.DefaultTextStyle(x => x.Bold()).PaddingVertical(2).BorderBottom(1).BorderColor(Colors.Black).AlignCenter();
        private IContainer PdfCellStyle(IContainer container) => container.PaddingVertical(2).BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).AlignLeft();

        private bool ShouldRenderTitle(string title)
        {
            if (string.IsNullOrWhiteSpace(title)) return false;
            var upper = title.ToUpperInvariant();
            return !(upper.Contains("BẢNG") || upper.Contains("BANG") || upper.Contains("DANH SÁCH") || upper.Contains("THEO DÕI"));
        }

        private string GetReportTitle(string template) => template switch
        {
            DefenseExportConstants.Templates.Dashboard => "BÁO CÁO TỔNG HỢP ĐIỀU HÀNH CHẤM ĐIỂM",
            DefenseExportConstants.Templates.Scoring => "BẢNG ĐIỂM CHI TIẾT ĐỒ ÁN TỐT NGHIỆP",
            DefenseExportConstants.Templates.ScoringConfig => "CẤU HÌNH VÀ BẢNG ĐIỂM ĐỒ ÁN TỐT NGHIỆP",
            DefenseExportConstants.Templates.PostDefense => "DANH SÁCH THEO DÕI HẬU ĐỒ ÁN TỐT NGHIỆP",
            DefenseExportConstants.Templates.Councils => "DANH SÁCH HỘI ĐỒNG ĐỒ ÁN TỐT NGHIỆP",
            DefenseExportConstants.Templates.Topics => "DANH SÁCH ĐỀ TÀI ĐỒ ÁN TỐT NGHIỆP",
            _ => "BÁO CÁO ĐIỀU HÀNH CHẤM ĐIỂM"
        };

        private string BuildPeriodTitle(DefenseOperationsExportSnapshotDto snapshot) => $"{_branding.Department.ToUpperInvariant()} - ĐỢT ĐỒ ÁN TỐT NGHIỆP ID {snapshot.DefenseTermId}";

        private string BuildPeriodMeta(DefenseOperationsExportSnapshotDto snapshot)
        {
            var state = snapshot.State ?? new DefensePeriodStateDto();
            return $"Trạng thái: {DefenseExportRules.BuildPeriodStatusLabel(state)} | Bắt đầu: {DefenseExportDateTimeFormatter.FormatDate(state.StartDate)} | Kết thúc: {DefenseExportDateTimeFormatter.FormatDate(state.EndDate)}";
        }

        private void BuildPdfScoringMatrixTable(TableDescriptor table, IReadOnlyList<ScoringExportRawDto> rows)
        {
            var headers = new[] { "Mã SV", "Họ tên", "Tên đề tài", "CT", "TK", "PB", "GVHD", "Điểm TB", "Trạng thái" };
            table.ColumnsDefinition(columns =>
            {
                foreach (var _ in headers)
                {
                    columns.RelativeColumn();
                }
            });

            table.Header(header =>
            {
                foreach (var headerText in headers)
                {
                    header.Cell().Element(PdfHeaderStyle).Text(headerText);
                }
            });

            foreach (var row in rows)
            {
                table.Cell().Element(PdfCellStyle).Text(row.StudentCode);
                table.Cell().Element(PdfCellStyle).Text(row.StudentName);
                table.Cell().Element(PdfCellStyle).Text(row.TopicTitle);
                table.Cell().Element(PdfCellStyle).Text(row.ScoreCt?.ToString("0.0") ?? "-");
                table.Cell().Element(PdfCellStyle).Text(row.ScoreTk?.ToString("0.0") ?? "-");
                table.Cell().Element(PdfCellStyle).Text(row.ScorePb?.ToString("0.0") ?? "-");
                table.Cell().Element(PdfCellStyle).Text(row.ScoreGvhd?.ToString("0.0") ?? "-");
                table.Cell().Element(PdfCellStyle).Text(row.FinalScore?.ToString("0.0") ?? "-");
                table.Cell().Element(PdfCellStyle).Text(row.Status.ToString());
            }
        }

        private void BuildPdfPostDefenseTable(TableDescriptor table, IReadOnlyList<PostDefenseExportRow> rows)
        {
            var headers = new[] { "ID", "Đề tài", "Sinh viên", "Trạng thái", "GVHD", "UVTK", "CT", "Cập nhật" };
            table.ColumnsDefinition(columns =>
            {
                foreach (var _ in headers)
                {
                    columns.RelativeColumn();
                }
            });

            table.Header(header =>
            {
                foreach (var headerText in headers)
                {
                    header.Cell().Element(PdfHeaderStyle).Text(headerText);
                }
            });

            foreach (var row in rows)
            {
                table.Cell().Element(PdfCellStyle).Text(row.RevisionId.ToString());
                table.Cell().Element(PdfCellStyle).Text(row.TopicTitle);
                table.Cell().Element(PdfCellStyle).Text(row.StudentDisplay);
                table.Cell().Element(PdfCellStyle).Text(row.FinalStatus);
                table.Cell().Element(PdfCellStyle).Text(row.GvhdApproved);
                table.Cell().Element(PdfCellStyle).Text(row.UvtkApproved);
                table.Cell().Element(PdfCellStyle).Text(row.CtApproved);
                table.Cell().Element(PdfCellStyle).Text(DefenseExportDateTimeFormatter.FormatDateTime(row.LastUpdated));
            }
        }
    }
}

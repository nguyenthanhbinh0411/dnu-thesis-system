using ClosedXML.Excel;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using ThesisManagement.Api.DTOs.DefensePeriods;

namespace ThesisManagement.Api.Services.DefenseOperationsExport;

public interface ICommitteeRosterExportService
{
    Task<(byte[] Content, string FileName, string ContentType)> ExportRosterAsync(
        CommitteeRosterExportSnapshotDto roster,
        int periodId,
        string format,
        CancellationToken cancellationToken = default);
}

public class CommitteeRosterExportService : ICommitteeRosterExportService
{
    private const string School = "TRƯỜNG ĐẠI HỌC ĐẠI NAM";
    private const string Faculty = "KHOA CÔNG NGHỆ THÔNG TIN";
    private const string Country = "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM";
    private const string CountryMotto = "Độc lập - Tự do - Hạnh phúc";
    private const string Title = "DANH SÁCH ĐỀ XUẤT HỘI ĐỒNG BẢO VỀ TỐT NGHIỆP";
    private const string Major = "NGÀNH CÔNG NGHỆ THÔNG TIN";

    public async Task<(byte[] Content, string FileName, string ContentType)> ExportRosterAsync(
        CommitteeRosterExportSnapshotDto roster,
        int periodId,
        string format,
        CancellationToken cancellationToken = default)
    {
        var normalizedFormat = (format ?? string.Empty).Trim().ToLowerInvariant();

        return await Task.Run(() =>
        {
            return normalizedFormat switch
            {
                "xlsx" or "excel" => BuildXlsx(roster, periodId),
                "csv" => BuildCsv(roster, periodId),
                "pdf" => BuildPdf(roster, periodId),
                _ => throw new InvalidOperationException("Unsupported format for committee roster export.")
            };
        }, cancellationToken);
    }

    private static (byte[] Content, string FileName, string ContentType) BuildXlsx(CommitteeRosterExportSnapshotDto roster, int periodId)
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.AddWorksheet("Danh sách");

        sheet.Style.Font.FontName = "Times New Roman";
        sheet.Style.Font.FontSize = 13;
        sheet.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
        sheet.Style.Alignment.WrapText = true;

        sheet.Column("A").Width = 6;
        sheet.Column("B").Width = 16;
        sheet.Column("C").Width = 32;
        sheet.Column("D").Width = 32;
        sheet.Column("E").Width = 10;
        sheet.Column("F").Width = 18;
        sheet.Column("G").Width = 14;
        sheet.Column("H").Width = 18;
        sheet.Column("I").Width = 14;
        sheet.Column("J").Width = 18;
        sheet.Column("K").Width = 14;
        sheet.Column("L").Width = 12;
        sheet.Column("M").Width = 16;

        BuildHeader(sheet);
        BuildDataRows(sheet, roster);
        ConfigurePrintSettings(sheet);

        using var ms = new MemoryStream();
        workbook.SaveAs(ms);
        var content = ms.ToArray();
        var fileName = $"DANH_SACH_HOI_DONG_{periodId}_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx";
        return (content, fileName, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    }

    private static void BuildHeader(IXLWorksheet sheet)
    {
        sheet.Range("A1:D1").Merge().Value = School;
        sheet.Range("A2:D2").Merge().Value = Faculty;
        sheet.Range("H1:M1").Merge().Value = Country;
        sheet.Range("H2:M2").Merge().Value = CountryMotto;
        sheet.Range("A4:M4").Merge().Value = Title;
        sheet.Range("A5:M5").Merge().Value = Major;

        sheet.Range("A7:A8").Merge().Value = "TT";
        sheet.Range("B7:B8").Merge().Value = "Mã SV";
        sheet.Range("C7:C8").Merge().Value = "Họ tên";
        sheet.Range("D7:D8").Merge().Value = "Người hướng dẫn";
        sheet.Range("E7:E8").Merge().Value = "Hội đồng";
        sheet.Range("F7:F8").Merge().Value = "Chủ tịch HĐ";
        sheet.Range("G7:G8").Merge().Value = "Nơi công tác";
        sheet.Range("H7:H8").Merge().Value = "Ủy viên thư ký";
        sheet.Range("I7:I8").Merge().Value = "Nơi công tác";
        sheet.Range("J7:J8").Merge().Value = "Ủy viên phản biện";
        sheet.Range("K7:K8").Merge().Value = "Nơi công tác";
        sheet.Range("L7:M7").Merge().Value = "Thời gian bảo vệ";
        sheet.Cell(8, 12).Value = "Buổi";
        sheet.Cell(8, 13).Value = "Ngày";

        sheet.Range("A1:D2").Style.Font.Bold = true;
        sheet.Range("H1:M2").Style.Font.Bold = true;
        sheet.Range("A4:M5").Style.Font.Bold = true;
        sheet.Range("A4:M5").Style.Font.FontSize = 14;

        sheet.Range("A1:D2").Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Left;
        sheet.Range("H1:M2").Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;
        sheet.Range("A4:M5").Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

        var headerRange = sheet.Range(7, 1, 8, 13);
        headerRange.Style.Font.Bold = true;
        headerRange.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        headerRange.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
        headerRange.Style.Alignment.WrapText = true;
        headerRange.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
        headerRange.Style.Border.InsideBorder = XLBorderStyleValues.Thin;
    }

    private static void BuildDataRows(IXLWorksheet sheet, CommitteeRosterExportSnapshotDto roster)
    {
        var rows = roster.Rows ?? new List<CommitteeRosterRowDto>();
        if (rows.Count == 0)
        {
            return;
        }

        var currentRow = 9;
        var councilGroups = BuildConsecutiveCouncilGroups(rows);

        foreach (var councilGroup in councilGroups)
        {
            var groupStart = currentRow;
            foreach (var row in councilGroup)
            {
                sheet.Cell(currentRow, 1).Value = row.RowNumber;
                sheet.Cell(currentRow, 2).Value = row.StudentCode;
                sheet.Cell(currentRow, 3).Value = row.StudentFullName;
                sheet.Cell(currentRow, 4).Value = row.AdvisorDisplay;
                sheet.Cell(currentRow, 5).Value = row.CommitteeCode;
                sheet.Cell(currentRow, 6).Value = row.ChairDisplay;
                sheet.Cell(currentRow, 7).Value = row.ChairWorkplace;
                sheet.Cell(currentRow, 8).Value = row.SecretaryDisplay;
                sheet.Cell(currentRow, 9).Value = row.SecretaryWorkplace;
                sheet.Cell(currentRow, 10).Value = row.ReviewerDisplay;
                sheet.Cell(currentRow, 11).Value = row.ReviewerWorkplace;
                sheet.Cell(currentRow, 12).Value = row.DefenseSession;
                sheet.Cell(currentRow, 13).Value = row.DefenseDate;

                for (int col = 1; col <= 13; col++)
                {
                    var cell = sheet.Cell(currentRow, col);
                    cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
                    cell.Style.Alignment.WrapText = true;
                    cell.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
                    cell.Style.Border.InsideBorder = XLBorderStyleValues.Thin;
                }

                sheet.Cell(currentRow, 1).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                sheet.Cell(currentRow, 2).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                sheet.Cell(currentRow, 3).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Left;
                sheet.Cell(currentRow, 4).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Left;
                sheet.Cell(currentRow, 5).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                sheet.Cell(currentRow, 6).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                sheet.Cell(currentRow, 7).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                sheet.Cell(currentRow, 8).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                sheet.Cell(currentRow, 9).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                sheet.Cell(currentRow, 10).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                sheet.Cell(currentRow, 11).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                sheet.Cell(currentRow, 12).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                sheet.Cell(currentRow, 13).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

                currentRow++;
            }

            var groupEnd = currentRow - 1;
            MergeVerticalGroup(sheet, 5, groupStart, groupEnd);
            MergeVerticalGroup(sheet, 6, groupStart, groupEnd);
            MergeVerticalGroup(sheet, 7, groupStart, groupEnd);
            MergeVerticalGroup(sheet, 8, groupStart, groupEnd);
            MergeVerticalGroup(sheet, 9, groupStart, groupEnd);
            MergeVerticalGroup(sheet, 10, groupStart, groupEnd);
            MergeVerticalGroup(sheet, 11, groupStart, groupEnd);

            var sessionGroups = BuildConsecutiveGroups(councilGroup, x => x.DefenseSession, groupStart);
            foreach (var sessionGroup in sessionGroups)
            {
                MergeVerticalGroup(sheet, 12, sessionGroup.StartRow, sessionGroup.EndRow);
            }

            var dateGroups = BuildConsecutiveGroups(councilGroup, x => x.DefenseDate, groupStart);
            foreach (var dateGroup in dateGroups)
            {
                MergeVerticalGroup(sheet, 13, dateGroup.StartRow, dateGroup.EndRow);
            }
        }

        BuildFooter(sheet, currentRow, roster.Rows?.Select(x => x.CommitteeCode).Distinct().Count() ?? 0);
    }

    private static void BuildFooter(IXLWorksheet sheet, int startRow, int councilCount)
    {
        sheet.Cell(startRow, 1).Value = $"Ấn định danh sách có: {councilCount:00} Hội đồng";
        sheet.Range(startRow, 1, startRow, 13).Merge();
        sheet.Row(startRow).Style.Font.Bold = true;
        sheet.Row(startRow).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Left;

        // Put date one row after the summary (remove extra blank row)
        sheet.Cell(startRow + 1, 8).Value = "Hà Nội, ngày  tháng  năm 202 ";
        sheet.Range(startRow + 1, 8, startRow + 1, 13).Merge();
        sheet.Row(startRow + 1).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;

        // Signatures (bold)
        sheet.Cell(startRow + 2, 1).Value = "NGƯỜI LẬP BIỂU";
        sheet.Cell(startRow + 2, 8).Value = "TRƯỞNG KHOA";
        sheet.Range(startRow + 2, 1, startRow + 2, 6).Merge();
        sheet.Range(startRow + 2, 8, startRow + 2, 13).Merge();
        sheet.Range(startRow + 2, 1, startRow + 2, 6).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        sheet.Range(startRow + 2, 8, startRow + 2, 13).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        sheet.Range(startRow + 2, 1, startRow + 2, 6).Style.Font.Bold = true;
        sheet.Range(startRow + 2, 8, startRow + 2, 13).Style.Font.Bold = true;

        // Clear a couple of rows after signatures for spacing
        sheet.Row(startRow + 3).Clear();
        sheet.Row(startRow + 4).Clear();
    }

    private static void ConfigurePrintSettings(IXLWorksheet sheet)
    {
        sheet.PageSetup.PageOrientation = XLPageOrientation.Landscape;
        sheet.PageSetup.PaperSize = XLPaperSize.A4Paper;
        sheet.PageSetup.Margins.Left = 0.5;
        sheet.PageSetup.Margins.Right = 0.5;
        sheet.PageSetup.Margins.Top = 0.5;
        sheet.PageSetup.Margins.Bottom = 0.5;
        sheet.PageSetup.CenterHorizontally = true;
        sheet.PageSetup.Scale = 100;
        sheet.PageSetup.PagesWide = 1;
        sheet.PageSetup.PagesTall = 0;
    }

    private static void MergeVerticalGroup(IXLWorksheet sheet, int column, int startRow, int endRow)
    {
        if (startRow >= endRow)
        {
            return;
        }

        var range = sheet.Range(startRow, column, endRow, column).Merge();
        range.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        range.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
        range.Style.Alignment.WrapText = true;
        range.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
        range.Style.Border.InsideBorder = XLBorderStyleValues.Thin;
    }

    private static List<List<CommitteeRosterRowDto>> BuildConsecutiveCouncilGroups(List<CommitteeRosterRowDto> rows)
    {
        var groups = new List<List<CommitteeRosterRowDto>>();
        if (rows.Count == 0)
        {
            return groups;
        }

        var currentGroup = new List<CommitteeRosterRowDto> { rows[0] };
        var currentKey = rows[0].CommitteeCode ?? string.Empty;

        for (int i = 1; i < rows.Count; i++)
        {
            var row = rows[i];
            var nextKey = row.CommitteeCode ?? string.Empty;
            if (!string.Equals(currentKey, nextKey, StringComparison.Ordinal))
            {
                groups.Add(currentGroup);
                currentGroup = new List<CommitteeRosterRowDto>();
                currentKey = nextKey;
            }

            currentGroup.Add(row);
        }

        groups.Add(currentGroup);
        return groups;
    }

    private static List<GroupRange<CommitteeRosterRowDto>> BuildConsecutiveGroups(List<CommitteeRosterRowDto> rows, Func<CommitteeRosterRowDto, string?> keySelector, int startingRow)
    {
        var groups = new List<GroupRange<CommitteeRosterRowDto>>();
        if (rows.Count == 0)
        {
            return groups;
        }

        var currentKey = keySelector(rows[0]) ?? string.Empty;
        var range = new GroupRange<CommitteeRosterRowDto> { StartRow = startingRow };
        range.Items.Add(rows[0]);

        for (int i = 1; i < rows.Count; i++)
        {
            var row = rows[i];
            var nextKey = keySelector(row) ?? string.Empty;
            if (!string.Equals(currentKey, nextKey, StringComparison.Ordinal))
            {
                range.EndRow = range.StartRow + range.Items.Count - 1;
                groups.Add(range);
                currentKey = nextKey;
                range = new GroupRange<CommitteeRosterRowDto> { StartRow = startingRow + i };
            }

            range.Items.Add(row);
        }

        range.EndRow = range.StartRow + range.Items.Count - 1;
        groups.Add(range);
        return groups;
    }

    private sealed class GroupRange<T>
    {
        public int StartRow { get; set; }
        public int EndRow { get; set; }
        public List<T> Items { get; } = new();
    }

    private static (byte[] Content, string FileName, string ContentType) BuildCsv(CommitteeRosterExportSnapshotDto roster, int periodId)
    {
        var culture = CultureInfo.InvariantCulture;
        var builder = new StringBuilder();

        builder.AppendLine("TT,Mã SV,Họ tên,Người hướng dẫn,Hội đồng,Chủ tịch HĐ,Nơi công tác,Uỷ viên thư ký,Nơi công tác,Uỷ viên phản biện,Nơi công tác,Thời gian bảo vệ - Buổi,Thời gian bảo vệ - Ngày");

        foreach (var row in roster.Rows ?? Enumerable.Empty<CommitteeRosterRowDto>())
        {
            var values = new[]
            {
                row.RowNumber.ToString(culture),
                EscapeCsv(row.StudentCode),
                EscapeCsv(row.StudentFullName),
                EscapeCsv(row.AdvisorDisplay),
                EscapeCsv(row.CommitteeCode),
                EscapeCsv(row.ChairDisplay),
                EscapeCsv(row.ChairWorkplace),
                EscapeCsv(row.SecretaryDisplay),
                EscapeCsv(row.SecretaryWorkplace),
                EscapeCsv(row.ReviewerDisplay),
                EscapeCsv(row.ReviewerWorkplace),
                EscapeCsv(row.DefenseSession),
                EscapeCsv(row.DefenseDate)
            };
            builder.AppendLine(string.Join(",", values));
        }

        var content = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(builder.ToString())).ToArray();
        var fileName = $"DANH_SACH_HOI_DONG_{periodId}_{DateTime.Now:yyyyMMdd_HHmmss}.csv";
        return (content, fileName, "text/csv; charset=utf-8");
    }

    private static (byte[] Content, string FileName, string ContentType) BuildPdf(CommitteeRosterExportSnapshotDto roster, int periodId)
    {
        QuestPDF.Settings.License = LicenseType.Community;
        var culture = CultureInfo.InvariantCulture;

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(18);
                page.DefaultTextStyle(x => x.FontSize(8).FontFamily("Times New Roman"));

                page.Header().Column(column =>
                {
                    column.Spacing(2);
                    column.Item().Row(row =>
                    {
                        row.RelativeItem().Column(left =>
                        {
                            left.Item().Text(School).Bold().FontSize(12);
                            left.Item().Text(Faculty).Bold().FontSize(11);
                        });
                        row.RelativeItem().AlignRight().Column(right =>
                        {
                            right.Item().Text(Country).Bold().FontSize(12);
                            right.Item().Text(CountryMotto).Bold().FontSize(10);
                        });
                    });

                    column.Item().PaddingTop(8).AlignCenter().Text(Title).Bold().FontSize(14);
                    column.Item().AlignCenter().Text(Major).Bold().FontSize(12);
                    column.Item().AlignCenter().Text($"Hà Nội, ngày {DateTime.Now:dd} tháng {DateTime.Now:MM} năm {DateTime.Now:yyyy}").FontSize(9);
                });

                page.Content().PaddingTop(8).Column(column =>
                {
                    column.Spacing(6);
                    if ((roster.Rows?.Count ?? 0) == 0)
                    {
                        column.Item().Text("Không có dữ liệu để xuất.").FontSize(10);
                    }
                    else
                    {
                        column.Item().Table(table =>
                        {
                            table.ColumnsDefinition(columns =>
                            {
                                columns.ConstantColumn(24);
                                columns.RelativeColumn(1.3f);
                                columns.RelativeColumn(2f);
                                columns.RelativeColumn(2f);
                                columns.RelativeColumn(1.4f);
                                columns.RelativeColumn(1.8f);
                                columns.RelativeColumn(1.8f);
                                columns.RelativeColumn(1.8f);
                                columns.RelativeColumn(1.8f);
                                columns.RelativeColumn(1.8f);
                                columns.RelativeColumn(1.8f);
                                columns.RelativeColumn(1.1f);
                                columns.RelativeColumn(1.1f);
                            });

                            table.Header(header =>
                            {
                                header.Cell().Background(Colors.Grey.Lighten3).Padding(4).Border(1).AlignCenter().Text("TT");
                                header.Cell().Background(Colors.Grey.Lighten3).Padding(4).Border(1).AlignCenter().Text("Mã SV");
                                header.Cell().Background(Colors.Grey.Lighten3).Padding(4).Border(1).AlignCenter().Text("Họ tên");
                                header.Cell().Background(Colors.Grey.Lighten3).Padding(4).Border(1).AlignCenter().Text("Người hướng dẫn");
                                header.Cell().Background(Colors.Grey.Lighten3).Padding(4).Border(1).AlignCenter().Text("Hội đồng");
                                header.Cell().Background(Colors.Grey.Lighten3).Padding(4).Border(1).AlignCenter().Text("Chủ tịch HĐ");
                                header.Cell().Background(Colors.Grey.Lighten3).Padding(4).Border(1).AlignCenter().Text("Nơi công tác");
                                header.Cell().Background(Colors.Grey.Lighten3).Padding(4).Border(1).AlignCenter().Text("Ủy viên thư ký");
                                header.Cell().Background(Colors.Grey.Lighten3).Padding(4).Border(1).AlignCenter().Text("Nơi công tác");
                                header.Cell().Background(Colors.Grey.Lighten3).Padding(4).Border(1).AlignCenter().Text("Ủy viên phản biện");
                                header.Cell().Background(Colors.Grey.Lighten3).Padding(4).Border(1).AlignCenter().Text("Nơi công tác");
                                header.Cell().Background(Colors.Grey.Lighten3).Padding(4).Border(1).AlignCenter().Text("Buổi");
                                header.Cell().Background(Colors.Grey.Lighten3).Padding(4).Border(1).AlignCenter().Text("Ngày");
                            });

                            foreach (var row in roster.Rows!)
                            {
                                table.Cell().Border(1).Padding(4).AlignCenter().Text(row.RowNumber.ToString(culture));
                                table.Cell().Border(1).Padding(4).Text(row.StudentCode);
                                table.Cell().Border(1).Padding(4).Text(row.StudentFullName);
                                table.Cell().Border(1).Padding(4).Text(row.AdvisorDisplay);
                                table.Cell().Border(1).Padding(4).AlignCenter().Text(row.CommitteeCode);
                                table.Cell().Border(1).Padding(4).Text(row.ChairDisplay);
                                table.Cell().Border(1).Padding(4).Text(row.ChairWorkplace);
                                table.Cell().Border(1).Padding(4).Text(row.SecretaryDisplay);
                                table.Cell().Border(1).Padding(4).Text(row.SecretaryWorkplace);
                                table.Cell().Border(1).Padding(4).Text(row.ReviewerDisplay);
                                table.Cell().Border(1).Padding(4).Text(row.ReviewerWorkplace);
                                table.Cell().Border(1).Padding(4).AlignCenter().Text(row.DefenseSession);
                                table.Cell().Border(1).Padding(4).AlignCenter().Text(row.DefenseDate);
                            }
                        });
                    }

                    column.Item().PaddingTop(12).Row(row =>
                    {
                        row.RelativeItem().Column(left =>
                        {
                            left.Item().AlignCenter().Text("NGƯỜI LẬP BIỂU").Bold();
                            left.Item().PaddingTop(28).AlignCenter().Text("(Ký và ghi rõ họ tên)");
                        });
                        row.RelativeItem().Column(right =>
                        {
                            right.Item().AlignCenter().Text("TRƯỞNG KHOA").Bold();
                            right.Item().PaddingTop(28).AlignCenter().Text("(Ký và ghi rõ họ tên)");
                        });
                    });
                });
            });
        });

        var buffer = document.GeneratePdf();
        var fileName = $"DANH_SACH_HOI_DONG_{periodId}_{DateTime.Now:yyyyMMdd_HHmmss}.pdf";
        return (buffer, fileName, "application/pdf");
    }

    private static string EscapeCsv(string? value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return string.Empty;
        }

        var escaped = value.Replace("\"", "\"\"");
        if (escaped.Contains(',') || escaped.Contains('"') || escaped.Contains('\n') || escaped.Contains('\r'))
        {
            return $"\"{escaped}\"";
        }

        return escaped;
    }
}

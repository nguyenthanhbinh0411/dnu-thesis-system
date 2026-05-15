using System.Globalization;
using ThesisManagement.Api.DTOs.DefensePeriods;
using ThesisManagement.Api.Services.DefenseOperationsExport.Internal;

namespace ThesisManagement.Api.Services.DefenseOperationsExport.Internal
{
    public static class DefenseExportDateTimeFormatter
    {
        public static string FormatDate(DateTime dateTime) => 
            dateTime == default ? "-" : dateTime.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);

        public static string FormatDate(DateTime? dateTime) => 
            dateTime.HasValue ? dateTime.Value.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture) : "-";

        public static string FormatDateTime(DateTime dateTime) =>
            dateTime == default ? "-" : dateTime.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture);
    }

    public static class DefenseExportDisplayFormatter
    {
        public static string ResolveCouncilMemberDisplay(CouncilDraftDto council, string role)
        {
            if (council.Members == null) return "-";
            var member = council.Members.FirstOrDefault(x => string.Equals(x.Role, role, StringComparison.OrdinalIgnoreCase));
            if (member == null) return "-";

            var display = string.Join(' ', new[] { member.Degree, member.LecturerName }.Where(s => !string.IsNullOrWhiteSpace(s)));
            if (!string.IsNullOrWhiteSpace(member.Organization))
            {
                display = string.IsNullOrWhiteSpace(display) ? member.Organization.Trim() : $"{display} - {member.Organization.Trim()}";
            }
            return string.IsNullOrWhiteSpace(display) ? "-" : display;
        }

        public static string TranslateLabel(string? value)
        {
            if (string.IsNullOrWhiteSpace(value) || value == "-") return "-";
            
            return value.ToUpperInvariant() switch
            {
                "EXCELLENT" => "Xuất sắc",
                "GOOD" => "Giỏi",
                "FAIR" => "Khá",
                "AVERAGE" => "Trung bình",
                "FAILED" => "Không đạt",
                "PASSED" => "ĐẠT",
                "FINISHED" => "ĐÃ KẾT THÚC",
                "PUBLISHED" => "ĐÃ CÔNG BỐ",
                "COUNCIL_LOCKED" => "ĐÃ CHỐT HỘI ĐỒNG",
                "READY" => "SẴN SÀNG",
                "DRAFT" => "NHÁP",
                "SCORED" => "Đã chấm",
                "WAITING" => "Đang chờ",
                "ALERT" => "Lệch điểm",
                "SCORING" => "Đang chấm",
                "LOCKED" => "Đã khóa",
                "PENDING" => "Chờ đồ án tốt nghiệp",
                "ONGOING" => "Đang diễn ra",
                "COMPLETED" => "Hoàn thành",
                _ => value
            };
        }
    }

    public static class DefenseExportValueFormatter
    {
        public static string Format(object? value)
        {
            if (value == null || (value is string s && (s == string.Empty || s == "-"))) return "-";

            if (value is DateTime dt) return DefenseExportDateTimeFormatter.FormatDate(dt);
            if (value != null && value is DateTime) return DefenseExportDateTimeFormatter.FormatDate((DateTime)value);

            if (value is bool b) return b ? "CÓ" : "KHÔNG";

            if (value is decimal d) return d.ToString("0.0", CultureInfo.InvariantCulture);

            if (value is Enum e) return DefenseExportDisplayFormatter.TranslateLabel(e.ToString());

            if (value is string str) return DefenseExportDisplayFormatter.TranslateLabel(str);

            return value!.ToString() ?? "-";
        }
    }
}

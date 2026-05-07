namespace ThesisManagement.Api.DTOs.Dashboards.Query
{
    public class LecturerDashboardFilter
    {
        public string? LecturerCode { get; set; }
        public int Limit { get; set; } = 100;
        public int? Days { get; set; } = 30;
    }

    public class StudentServiceDashboardFilter
    {
        public int Limit { get; set; } = 200;
    }

    public class AdminDashboardFilter
    {
        public string? RoleName { get; set; }
        public string? LecturerCode { get; set; }
        public int Days { get; set; } = 30;
        public int Limit { get; set; } = 200;
    }
}

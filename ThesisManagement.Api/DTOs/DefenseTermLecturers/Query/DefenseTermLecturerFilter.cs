using ThesisManagement.Api.DTOs;

namespace ThesisManagement.Api.DTOs.DefenseTermLecturers.Query
{
    public class DefenseTermLecturerFilter : BaseFilter
    {
        public int? DefenseTermId { get; set; }
        public int? LecturerProfileID { get; set; }
        public string? LecturerCode { get; set; }
        public string? UserCode { get; set; }
        public bool? IsPrimary { get; set; }
    }
}
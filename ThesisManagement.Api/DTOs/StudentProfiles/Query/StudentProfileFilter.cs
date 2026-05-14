using System;
using System.Collections.Generic;

namespace ThesisManagement.Api.DTOs.StudentProfiles.Query
{
    public class StudentProfileFilter : BaseFilter
    {
        public IEnumerable<string>? StudentCodes { get; set; }
        public string? UserCode { get; set; }
        public string? DepartmentCode { get; set; }
        public string? StudentCode { get; set; }
        public string? ClassCode { get; set; }
        public string? FacultyCode { get; set; }
        public string? Gender { get; set; }
        public DateTime? DateOfBirthFrom { get; set; }
        public DateTime? DateOfBirthTo { get; set; }
        public string? PhoneNumber { get; set; }
        public string? StudentEmail { get; set; }
        public string? Address { get; set; }
        public int? MinEnrollmentYear { get; set; }
        public int? MaxEnrollmentYear { get; set; }
        public string? Status { get; set; }
        public int? MinGraduationYear { get; set; }
        public int? MaxGraduationYear { get; set; }
        public decimal? MinGPA { get; set; }
        public decimal? MaxGPA { get; set; }
        public string? AcademicStanding { get; set; }
        public int? ExcludeDefenseTermId { get; set; }
    }
}
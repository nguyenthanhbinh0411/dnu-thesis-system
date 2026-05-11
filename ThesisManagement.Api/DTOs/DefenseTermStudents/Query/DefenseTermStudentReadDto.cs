using System;

namespace ThesisManagement.Api.DTOs.DefenseTermStudents.Query
{
    public class DefenseTermStudentReadDto
    {
        public int DefenseTermStudentID { get; set; }
        public int DefenseTermId { get; set; }
        public int StudentProfileID { get; set; }
        public string StudentCode { get; set; } = string.Empty;
        public string UserCode { get; set; } = string.Empty;
        public string? FullName { get; set; }
        public string? ClassCode { get; set; }
        public string? FacultyCode { get; set; }
        public string? DepartmentCode { get; set; }
        public decimal? GPA { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime LastUpdated { get; set; }

        public DefenseTermStudentReadDto() { }

        public DefenseTermStudentReadDto(
            int defenseTermStudentID,
            int defenseTermId,
            int studentProfileID,
            string studentCode,
            string userCode,
            DateTime createdAt,
            DateTime lastUpdated)
        {
            DefenseTermStudentID = defenseTermStudentID;
            DefenseTermId = defenseTermId;
            StudentProfileID = studentProfileID;
            StudentCode = studentCode;
            UserCode = userCode;
            CreatedAt = createdAt;
            LastUpdated = lastUpdated;
        }
    }
}
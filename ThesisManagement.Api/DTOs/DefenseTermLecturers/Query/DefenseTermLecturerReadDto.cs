using System;

namespace ThesisManagement.Api.DTOs.DefenseTermLecturers.Query
{
    public class DefenseTermLecturerReadDto
    {
        public DefenseTermLecturerReadDto()
        {
            LecturerCode = string.Empty;
            LecturerName = string.Empty;
            FullName = string.Empty;
            UserCode = string.Empty;
        }

        public DefenseTermLecturerReadDto(
            int defenseTermLecturerID,
            int defenseTermId,
            int lecturerProfileID,
            string lecturerCode,
            string lecturerName,
            string fullName,
            string userCode,
            bool isPrimary,
            DateTime createdAt,
            DateTime lastUpdated)
        {
            DefenseTermLecturerID = defenseTermLecturerID;
            DefenseTermId = defenseTermId;
            LecturerProfileID = lecturerProfileID;
            LecturerCode = lecturerCode;
            LecturerName = lecturerName;
            FullName = fullName;
            UserCode = userCode;
            IsPrimary = isPrimary;
            CreatedAt = createdAt;
            LastUpdated = lastUpdated;
        }

        public int DefenseTermLecturerID { get; set; }
        public int DefenseTermId { get; set; }
        public int LecturerProfileID { get; set; }
        public string LecturerCode { get; set; }
        public string LecturerName { get; set; }
        public string FullName { get; set; }
        public string UserCode { get; set; }
        public bool IsPrimary { get; set; }
        public string? DepartmentCode { get; set; }
        public string? Degree { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime LastUpdated { get; set; }
    }
}
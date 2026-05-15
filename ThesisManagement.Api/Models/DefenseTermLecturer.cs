using System;

namespace ThesisManagement.Api.Models
{
    public class DefenseTermLecturer
    {
        public int DefenseTermLecturerID { get; set; }
        public int DefenseTermId { get; set; }
        public int LecturerProfileID { get; set; }
        public string LecturerCode { get; set; } = null!;
        public string UserCode { get; set; } = null!;
        public bool IsPrimary { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime LastUpdated { get; set; }

        public DefenseTerm? DefenseTerm { get; set; }
        public LecturerProfile? LecturerProfile { get; set; }
        public User? LecturerUser { get; set; }
    }
}

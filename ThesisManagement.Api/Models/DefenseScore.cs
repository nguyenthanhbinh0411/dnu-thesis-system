using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace ThesisManagement.Api.Models
{
    public class DefenseScore
    {
        public int ScoreID { get; set; }
        public string ScoreCode { get; set; } = null!;
        public int AssignmentID { get; set; } // Internal reference
        public string? AssignmentCode { get; set; } // Code-based reference
        public int? MemberLecturerProfileID { get; set; } // Internal reference
        public string? MemberLecturerCode { get; set; } // Code-based reference
        public int? MemberLecturerUserID { get; set; } // Internal reference
        public string? MemberLecturerUserCode { get; set; } // Code-based reference
        public string? Role { get; set; }
        public decimal Score { get; set; }
        public string? Comment { get; set; }
        public bool IsSubmitted { get; set; }
        
        /// <summary>
        /// Flag indicating that revision (hậu bảo vệ) is required for this assignment
        /// Set by lecturer when submitting scores if "Yêu cầu nộp lại báo cáo" checkbox is marked
        /// </summary>
        [Column("REVISION_REQUIRED")]
        public bool RevisionRequired { get; set; }

        [Column("REVISION_REASON")]
        public string? RevisionReason { get; set; }

        [Column("REVISION_DEADLINE_DAYS")]
        public int? RevisionDeadlineDays { get; set; }
        
        public DateTime? CreatedAt { get; set; }
        public DateTime? LastUpdated { get; set; }

        // Navigation properties removed to prevent EF shadow properties
        // public DefenseAssignment? Assignment { get; set; }
        public User? MemberLecturerUser { get; set; }
        // public LecturerProfile? MemberLecturerProfile { get; set; }
    }
}

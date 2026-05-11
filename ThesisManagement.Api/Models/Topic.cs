using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;

namespace ThesisManagement.Api.Models
{
    public class Topic
    {
        public int TopicID { get; set; }
        public string TopicCode { get; set; } = null!;
        public string Title { get; set; } = null!;
        public string? Summary { get; set; }
        public string Type { get; set; } = null!;
        public int ProposerUserID { get; set; } // Keep for internal use
        public string? ProposerUserCode { get; set; } // New: reference by code
        public string? ProposerStudentCode { get; set; } // New: reference by code
        public int? ProposerStudentProfileID { get; set; } // internal reference to student profile
        public int? SupervisorUserID { get; set; } // Keep for internal use
        public string? SupervisorUserCode { get; set; } // New: reference by code
        public string? SupervisorLecturerCode { get; set; } // New: reference by code
        public int? SupervisorLecturerProfileID { get; set; } // internal reference to lecturer profile
        public int? CatalogTopicID { get; set; } // Keep for internal use
        public string? CatalogTopicCode { get; set; } // New: reference by code
        public int? DepartmentID { get; set; } // Keep for internal use
        public string? DepartmentCode { get; set; } // New: reference by code
        public int? DefenseTermId { get; set; }
        public decimal? Score { get; set; }
        public string Status { get; set; } = null!;
        public int? ResubmitCount { get; set; }
    public DateTime? CreatedAt { get; set; }
    public DateTime? LastUpdated { get; set; }
    public string? LecturerComment { get; set; }

    // Evaluation review fields (Phiếu đánh giá)
    [Column("REVIEW_QUALITY")]
    public string? ReviewQuality { get; set; }
    [Column("REVIEW_ATTITUDE")]
    public string? ReviewAttitude { get; set; }
    [Column("REVIEW_CAPABILITY")]
    public string? ReviewCapability { get; set; }
    [Column("REVIEW_RESULT_PROCESSING")]
    public string? ReviewResultProcessing { get; set; }
    [Column("REVIEW_ACHIEVEMENTS")]
    public string? ReviewAchievements { get; set; }
    [Column("REVIEW_LIMITATIONS")]
    public string? ReviewLimitations { get; set; }
    [Column("REVIEW_CONCLUSION")]
    public string? ReviewConclusion { get; set; }
    [Column("SCORE_IN_WORDS")]
    public string? ScoreInWords { get; set; }

    // structural fields (Kết cấu đồ án)
    [Column("NUM_CHAPTERS")]
    public int? NumChapters { get; set; }
    [Column("NUM_PAGES")]
    public int? NumPages { get; set; }
    [Column("NUM_TABLES")]
    public int? NumTables { get; set; }
    [Column("NUM_FIGURES")]
    public int? NumFigures { get; set; }
    [Column("NUM_REFERENCES")]
    public int? NumReferences { get; set; }
    [Column("NUM_VN_REFERENCES")]
    public int? NumVietnameseReferences { get; set; }
    [Column("NUM_FOREIGN_REFERENCES")]
    public int? NumForeignReferences { get; set; }

        // Navigation properties - Only keep essential ones to avoid shadow properties
        public User? ProposerUser { get; set; }
        public CatalogTopic? CatalogTopic { get; set; }
        public DefenseTerm? DefenseTerm { get; set; }
    }
}

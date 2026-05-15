using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ThesisManagement.Api.Models
{
    [Table("DEFENSE_RESULTS")]
    public class DefenseResult
    {
        [Key]
        [Column("RESULTID")]
        public int Id { get; set; }

        [Column("ASSIGNMENTID")]
        public int AssignmentId { get; set; }

        [Column("SCORE_GVHD")]
        public decimal? ScoreGvhd { get; set; }

        [Column("SCORE_CT")]
        public decimal? ScoreCt { get; set; }

        [Column("SCORE_UVTK")]
        public decimal? ScoreUvtk { get; set; }

        [Column("SCORE_UVPB")]
        public decimal? ScoreUvpb { get; set; }

        [Column("FINALSCORE_NUMERIC")]
        public decimal? FinalScoreNumeric { get; set; }

        [Column("FINALSCORE_TEXT")]
        public string? FinalScoreText { get; set; }

        /// <summary>
        /// Auto-calculated pass/fail status: true if FinalScoreNumeric >= 5, false otherwise
        /// </summary>
        [Column("IS_PASSED")]
        public bool? IsPassed { get; set; }

        [Column("ISLOCKED")]
        public bool IsLocked { get; set; }

        [Column("CREATEDAT")]
        public DateTime CreatedAt { get; set; }

        [Column("LASTUPDATED")]
        public DateTime LastUpdated { get; set; }

        public DefenseAssignment? Assignment { get; set; }
    }
}

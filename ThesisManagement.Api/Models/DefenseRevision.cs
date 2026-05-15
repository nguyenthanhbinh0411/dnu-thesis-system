using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ThesisManagement.Api.Models
{
    [Table("DEFENSE_REVISIONS")]
    public class DefenseRevision
    {
        [Key]
        [Column("REVISIONID")]
        public int Id { get; set; }

        [Column("ASSIGNMENTID")]
        public int AssignmentId { get; set; }

        // Yêu cầu sửa từ hội đồng
        [Column("REQUIRED_REVISION_CONTENT")]
        public string? RequiredRevisionContent { get; set; }

        [Column("REVISION_REASON")]
        public string? RevisionReason { get; set; }

        [Column("SUBMISSION_DEADLINE")]
        public DateTime? SubmissionDeadline { get; set; }

        // Nộp từ sinh viên
        [Column("REVISEDCONTENT")]
        public string? RevisedContent { get; set; }

        [Column("REVISIONFILEURL")]
        public string? RevisionFileUrl { get; set; }

        [Column("SUBMISSION_COUNT")]
        public int SubmissionCount { get; set; } = 1;

        // Review từ thư ký
        [Column("REVISION_STATUS")]
        public RevisionStatus Status { get; set; } = RevisionStatus.WaitingStudent;

        [Column("SECRETARY_COMMENT")]
        public string? SecretaryComment { get; set; }

        [Column("SECRETARY_USER_CODE")]
        public string? SecretaryUserCode { get; set; }

        [Column("SECRETARY_APPROVED_AT")]
        public DateTime? SecretaryApprovedAt { get; set; }

        // Phê duyệt từ các bên
        [Column("IS_GVHD_APPROVED")]
        public bool IsGvhdApproved { get; set; }

        [Column("IS_UVTK_APPROVED")]
        public bool IsUvtkApproved { get; set; }

        [Column("IS_CT_APPROVED")]
        public bool IsCtApproved { get; set; }

        // Legacy support (deprecated, for backward compatibility)
        [Column("FINALSTATUS")]
        public RevisionFinalStatus? FinalStatus { get; set; }

        [Column("CREATEDAT")]
        public DateTime CreatedAt { get; set; }

        [Column("LASTUPDATED")]
        public DateTime LastUpdated { get; set; }

        public DefenseAssignment? Assignment { get; set; }
    }
}

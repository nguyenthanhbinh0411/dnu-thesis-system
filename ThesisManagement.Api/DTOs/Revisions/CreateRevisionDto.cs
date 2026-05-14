namespace ThesisManagement.Api.DTOs.Revisions
{
    /// <summary>
    /// Request to create a defense revision requirement
    /// Used when defense committee decides student needs to revise their work
    /// </summary>
    public class CreateRevisionDto
    {
        public int AssignmentId { get; set; }
        
        /// <summary>
        /// Description of what needs to be revised
        /// </summary>
        public string? RequiredRevisionContent { get; set; }
        
        /// <summary>
        /// Reason why revision is required (e.g., "Cần bổ sung thêm phần lý thuyết")
        /// </summary>
        public string? RevisionReason { get; set; }
        
        /// <summary>
        /// Deadline for student to submit revised content (default: 14 days from now)
        /// </summary>
        public DateTime? SubmissionDeadline { get; set; }
    }
}

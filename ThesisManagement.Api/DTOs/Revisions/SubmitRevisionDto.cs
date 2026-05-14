namespace ThesisManagement.Api.DTOs.Revisions
{
    /// <summary>
    /// Request from student to submit revised content
    /// </summary>
    public class SubmitRevisionDto
    {
        public int RevisionId { get; set; }
        
        /// <summary>
        /// Revised content text
        /// </summary>
        public string? RevisedContent { get; set; }
        
        /// <summary>
        /// URL to revised file (uploaded to storage)
        /// </summary>
        public string? RevisionFileUrl { get; set; }
        
        /// <summary>
        /// Idempotency key to prevent duplicate submissions
        /// </summary>
        public string? IdempotencyKey { get; set; }
    }
}

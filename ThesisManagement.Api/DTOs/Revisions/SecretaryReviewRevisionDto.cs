namespace ThesisManagement.Api.DTOs.Revisions
{
    /// <summary>
    /// Request from secretary to review/update revision status
    /// Secretary can approve, reject, or request resubmission
    /// </summary>
    public class SecretaryReviewRevisionDto
    {
        /// <summary>
        /// Action to take: APPROVE, REJECT
        /// </summary>
        public string Action { get; set; } = "APPROVE"; // APPROVE | REJECT
        
        /// <summary>
        /// Comment from secretary
        /// </summary>
        public string? Comment { get; set; }
        
        /// <summary>
        /// Optional: new deadline when REJECT and ask student to resubmit
        /// </summary>
        public DateTime? NewDeadline { get; set; }
        
        /// <summary>
        /// Idempotency key to prevent duplicate submissions
        /// </summary>
        public string? IdempotencyKey { get; set; }
    }
}

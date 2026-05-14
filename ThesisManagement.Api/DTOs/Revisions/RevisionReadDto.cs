namespace ThesisManagement.Api.DTOs.Revisions
{
    /// <summary>
    /// DTO for reading revision data - used for secretary dashboard and revision status display
    /// </summary>
    public class RevisionReadDto
    {
        public int Id { get; set; }
        public int AssignmentId { get; set; }
        
        // Assignment details
        public string? StudentCode { get; set; }
        public string? StudentName { get; set; }
        public string? TopicCode { get; set; }
        public string? TopicTitle { get; set; }
        public string? SupervisorName { get; set; }
        
        // Revision request details
        public string? RequiredRevisionContent { get; set; }
        public string? RevisionReason { get; set; }
        public DateTime? SubmissionDeadline { get; set; }
        
        // Student assignment status
        public bool IsPassed { get; set; }
        
        // Student submission
        public string? RevisedContent { get; set; }
        public string? RevisionFileUrl { get; set; }
        public int SubmissionCount { get; set; }
        public DateTime? LastSubmissionTime { get; set; }
        
        // Secretary review
        public string Status { get; set; } = "WaitingStudent";
        public string? SecretaryComment { get; set; }
        public string? SecretaryUserCode { get; set; }
        public string? SecretaryName { get; set; }
        public DateTime? SecretaryApprovedAt { get; set; }
        
        // Committee approvals (legacy)
        public bool IsGvhdApproved { get; set; }
        public bool IsUvtkApproved { get; set; }
        public bool IsCtApproved { get; set; }
        
        // Metadata
        public DateTime CreatedAt { get; set; }
        public DateTime LastUpdated { get; set; }
        
        // Calculated properties
        public bool IsOverdue => SubmissionDeadline.HasValue && DateTime.UtcNow > SubmissionDeadline.Value;
        public int DaysUntilDeadline 
        {
            get
            {
                if (!SubmissionDeadline.HasValue) return 0;
                return (int)(SubmissionDeadline.Value - DateTime.UtcNow).TotalDays;
            }
        }
    }
}

using ThesisManagement.Api.Models;
using ThesisManagement.Api.Repositories;
using Microsoft.EntityFrameworkCore.Storage;

namespace ThesisManagement.Api.Services
{
    public interface IUnitOfWork
    {
        IGenericRepository<Department> Departments { get; }
        IGenericRepository<User> Users { get; }
        IGenericRepository<StudentProfile> StudentProfiles { get; }
        IGenericRepository<LecturerProfile> LecturerProfiles { get; }
        IGenericRepository<CatalogTopic> CatalogTopics { get; }
        IGenericRepository<Topic> Topics { get; }
        IGenericRepository<Cohort> Cohorts { get; }
        IGenericRepository<ProgressMilestone> ProgressMilestones { get; }
        IGenericRepository<ProgressSubmission> ProgressSubmissions { get; }
            IGenericRepository<MilestoneTemplate> MilestoneTemplates { get; }
            IGenericRepository<SubmissionFile> SubmissionFiles { get; }
            IGenericRepository<Conversation> Conversations { get; }
            IGenericRepository<ConversationMember> ConversationMembers { get; }
            IGenericRepository<Message> Messages { get; }
            IGenericRepository<MessageAttachment> MessageAttachments { get; }
            IGenericRepository<MessageReaction> MessageReactions { get; }
            IGenericRepository<MessageReadReceipt> MessageReadReceipts { get; }
        IGenericRepository<Committee> Committees { get; }
        IGenericRepository<CommitteeMember> CommitteeMembers { get; }
        IGenericRepository<CommitteeSession> CommitteeSessions { get; }
        IGenericRepository<DefenseAssignment> DefenseAssignments { get; }
        IGenericRepository<DefenseScore> DefenseScores { get; }
        IGenericRepository<DefenseTerm> DefenseTerms { get; }

        IGenericRepository<DefenseTermStudent> DefenseTermStudents { get; }
        IGenericRepository<DefenseTermLecturer> DefenseTermLecturers { get; }
        IGenericRepository<Class> Classes { get; }
            IGenericRepository<TopicRenameRequest> TopicRenameRequests { get; }
            IGenericRepository<TopicRenameRequestFile> TopicRenameRequestFiles { get; }
            IGenericRepository<TopicTitleHistory> TopicTitleHistories { get; }

        IGenericRepository<Room> Rooms { get; }

        IGenericRepository<SyncAuditLog> SyncAuditLogs { get; }
        IGenericRepository<DefenseGroup> DefenseGroups { get; }
        IGenericRepository<ExportFile> ExportFiles { get; }
        IGenericRepository<EvaluationReview> EvaluationReviews { get; }
        IGenericRepository<DefenseMinute> DefenseMinutes { get; }
        IGenericRepository<DefenseResult> DefenseResults { get; }
        IGenericRepository<DefenseRevision> DefenseRevisions { get; }
        IGenericRepository<DefenseDocument> DefenseDocuments { get; }
        IGenericRepository<CommitteeTag> CommitteeTags { get; }
        IGenericRepository<Tag> Tags { get; }
        IGenericRepository<CatalogTopicTag> CatalogTopicTags { get; }
        IGenericRepository<TopicTag> TopicTags { get; }
        IGenericRepository<TopicLecturer> TopicLecturers { get; }
        IGenericRepository<LecturerTag> LecturerTags { get; }
        IGenericRepository<SystemActivityLog> SystemActivityLogs { get; }
        IGenericRepository<TopicWorkflowAudit> TopicWorkflowAudits { get; }
        IGenericRepository<Notification> Notifications { get; }
        IGenericRepository<NotificationRecipient> NotificationRecipients { get; }
        IGenericRepository<NotificationPreference> NotificationPreferences { get; }
        IGenericRepository<NotificationOutbox> NotificationOutbox { get; }
        
        // AI Chatbot
        IGenericRepository<ChatSession> ChatSessions { get; }
        IGenericRepository<ChatMessage> ChatMessages { get; }
        
        Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default);
        Task<int> SaveChangesAsync();
    }
}

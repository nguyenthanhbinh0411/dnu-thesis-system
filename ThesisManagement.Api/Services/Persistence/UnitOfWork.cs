using ThesisManagement.Api.Data;
using Microsoft.EntityFrameworkCore.Storage;
using ThesisManagement.Api.Models;
using ThesisManagement.Api.Repositories;

namespace ThesisManagement.Api.Services
{
    public class UnitOfWork : IUnitOfWork
    {
        private readonly ApplicationDbContext _db;
        public UnitOfWork(ApplicationDbContext db)
        {
            _db = db;
            Departments = new GenericRepository<Department>(_db);
            Users = new GenericRepository<User>(_db);
            StudentProfiles = new GenericRepository<StudentProfile>(_db);
            LecturerProfiles = new GenericRepository<LecturerProfile>(_db);
            CatalogTopics = new GenericRepository<CatalogTopic>(_db);
            Topics = new GenericRepository<Topic>(_db);
            Cohorts = new GenericRepository<Cohort>(_db);
            ProgressMilestones = new GenericRepository<ProgressMilestone>(_db);
            ProgressSubmissions = new GenericRepository<ProgressSubmission>(_db);
            MilestoneTemplates = new GenericRepository<MilestoneTemplate>(_db);
            SubmissionFiles = new GenericRepository<SubmissionFile>(_db);
            Conversations = new GenericRepository<Conversation>(_db);
            ConversationMembers = new GenericRepository<ConversationMember>(_db);
            Messages = new GenericRepository<Message>(_db);
            MessageAttachments = new GenericRepository<MessageAttachment>(_db);
            MessageReactions = new GenericRepository<MessageReaction>(_db);
            MessageReadReceipts = new GenericRepository<MessageReadReceipt>(_db);
            Committees = new GenericRepository<Committee>(_db);
            CommitteeMembers = new GenericRepository<CommitteeMember>(_db);
            CommitteeSessions = new GenericRepository<CommitteeSession>(_db);
            DefenseAssignments = new GenericRepository<DefenseAssignment>(_db);
            DefenseScores = new GenericRepository<DefenseScore>(_db);
            DefenseTerms = new GenericRepository<DefenseTerm>(_db);

            DefenseTermStudents = new GenericRepository<DefenseTermStudent>(_db);
            DefenseTermLecturers = new GenericRepository<DefenseTermLecturer>(_db);
            Classes = new GenericRepository<Class>(_db);
            TopicRenameRequests = new GenericRepository<TopicRenameRequest>(_db);
            TopicRenameRequestFiles = new GenericRepository<TopicRenameRequestFile>(_db);
            TopicTitleHistories = new GenericRepository<TopicTitleHistory>(_db);

            Rooms = new GenericRepository<Room>(_db);

            SyncAuditLogs = new GenericRepository<SyncAuditLog>(_db);
            DefenseGroups = new GenericRepository<DefenseGroup>(_db);
            ExportFiles = new GenericRepository<ExportFile>(_db);
            EvaluationReviews = new GenericRepository<EvaluationReview>(_db);
            DefenseMinutes = new GenericRepository<DefenseMinute>(_db);
            DefenseResults = new GenericRepository<DefenseResult>(_db);
            DefenseRevisions = new GenericRepository<DefenseRevision>(_db);
            DefenseDocuments = new GenericRepository<DefenseDocument>(_db);
            CommitteeTags = new GenericRepository<CommitteeTag>(_db);
            Tags = new GenericRepository<Tag>(_db);
            CatalogTopicTags = new GenericRepository<CatalogTopicTag>(_db);
            TopicTags = new GenericRepository<TopicTag>(_db);
            TopicLecturers = new GenericRepository<TopicLecturer>(_db);
            LecturerTags = new GenericRepository<LecturerTag>(_db);
            SystemActivityLogs = new GenericRepository<SystemActivityLog>(_db);
            TopicWorkflowAudits = new GenericRepository<TopicWorkflowAudit>(_db);
            Notifications = new GenericRepository<Notification>(_db);
            NotificationRecipients = new GenericRepository<NotificationRecipient>(_db);
            NotificationPreferences = new GenericRepository<NotificationPreference>(_db);
            NotificationOutbox = new GenericRepository<NotificationOutbox>(_db);
            
            ChatSessions = new GenericRepository<ChatSession>(_db);
            ChatMessages = new GenericRepository<ChatMessage>(_db);
        }

        public IGenericRepository<Department> Departments { get; }
        public IGenericRepository<User> Users { get; }
        public IGenericRepository<StudentProfile> StudentProfiles { get; }
        public IGenericRepository<LecturerProfile> LecturerProfiles { get; }
        public IGenericRepository<CatalogTopic> CatalogTopics { get; }
        public IGenericRepository<Topic> Topics { get; }
        public IGenericRepository<Cohort> Cohorts { get; }
        public IGenericRepository<ProgressMilestone> ProgressMilestones { get; }
        public IGenericRepository<ProgressSubmission> ProgressSubmissions { get; }
    public IGenericRepository<MilestoneTemplate> MilestoneTemplates { get; }
    public IGenericRepository<SubmissionFile> SubmissionFiles { get; }
        public IGenericRepository<Conversation> Conversations { get; }
        public IGenericRepository<ConversationMember> ConversationMembers { get; }
        public IGenericRepository<Message> Messages { get; }
        public IGenericRepository<MessageAttachment> MessageAttachments { get; }
        public IGenericRepository<MessageReaction> MessageReactions { get; }
        public IGenericRepository<MessageReadReceipt> MessageReadReceipts { get; }
        public IGenericRepository<Committee> Committees { get; }
        public IGenericRepository<CommitteeMember> CommitteeMembers { get; }
    public IGenericRepository<CommitteeSession> CommitteeSessions { get; }
        public IGenericRepository<DefenseAssignment> DefenseAssignments { get; }
        public IGenericRepository<DefenseScore> DefenseScores { get; }
        public IGenericRepository<DefenseTerm> DefenseTerms { get; }
        public IGenericRepository<DefenseTermStudent> DefenseTermStudents { get; }
        public IGenericRepository<DefenseTermLecturer> DefenseTermLecturers { get; }
        public IGenericRepository<Class> Classes { get; }
        public IGenericRepository<TopicRenameRequest> TopicRenameRequests { get; }
        public IGenericRepository<TopicRenameRequestFile> TopicRenameRequestFiles { get; }
        public IGenericRepository<TopicTitleHistory> TopicTitleHistories { get; }

        public IGenericRepository<Room> Rooms { get; }

        public IGenericRepository<SyncAuditLog> SyncAuditLogs { get; }
        public IGenericRepository<DefenseGroup> DefenseGroups { get; }
        public IGenericRepository<ExportFile> ExportFiles { get; }
        public IGenericRepository<EvaluationReview> EvaluationReviews { get; }
        public IGenericRepository<DefenseMinute> DefenseMinutes { get; }
        public IGenericRepository<DefenseResult> DefenseResults { get; }
        public IGenericRepository<DefenseRevision> DefenseRevisions { get; }
        public IGenericRepository<DefenseDocument> DefenseDocuments { get; }
        public IGenericRepository<CommitteeTag> CommitteeTags { get; }
        public IGenericRepository<Tag> Tags { get; }
        public IGenericRepository<CatalogTopicTag> CatalogTopicTags { get; }
        public IGenericRepository<TopicTag> TopicTags { get; }
        public IGenericRepository<TopicLecturer> TopicLecturers { get; }
        public IGenericRepository<LecturerTag> LecturerTags { get; }
        public IGenericRepository<SystemActivityLog> SystemActivityLogs { get; }
        public IGenericRepository<TopicWorkflowAudit> TopicWorkflowAudits { get; }
        public IGenericRepository<Notification> Notifications { get; }
        public IGenericRepository<NotificationRecipient> NotificationRecipients { get; }
        public IGenericRepository<NotificationPreference> NotificationPreferences { get; }
        public IGenericRepository<NotificationOutbox> NotificationOutbox { get; }
        
        public IGenericRepository<ChatSession> ChatSessions { get; }
        public IGenericRepository<ChatMessage> ChatMessages { get; }

        public async Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default)
        {
            return await _db.Database.BeginTransactionAsync(cancellationToken);
        }

        public async Task<int> SaveChangesAsync()
        {
            return await _db.SaveChangesAsync();
        }
    }
}

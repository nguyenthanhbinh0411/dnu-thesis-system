using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Microsoft.AspNetCore.Http;
using System.Linq;
using System.Text.Json;
using System.Reflection;
using System.ComponentModel.DataAnnotations.Schema;
using ThesisManagement.Api.Models;
using ThesisManagement.Api.Services;

namespace ThesisManagement.Api.Data
{
    public class ApplicationDbContext : DbContext
    {
        private readonly ICurrentUserService? _currentUserService;
        private readonly IHttpContextAccessor? _httpContextAccessor;

        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> opts) : base(opts) { }

        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> opts, ICurrentUserService currentUserService, IHttpContextAccessor httpContextAccessor) 
            : base(opts)
        {
            _currentUserService = currentUserService;
            _httpContextAccessor = httpContextAccessor;
        }

        public DbSet<Department> Departments => Set<Department>();
        public DbSet<Class> Classes => Set<Class>();
        public DbSet<User> Users => Set<User>();
        public DbSet<StudentProfile> StudentProfiles => Set<StudentProfile>();
        public DbSet<LecturerProfile> LecturerProfiles => Set<LecturerProfile>();
        public DbSet<CatalogTopic> CatalogTopics => Set<CatalogTopic>();
        public DbSet<Topic> Topics => Set<Topic>();
        public DbSet<Cohort> Cohorts => Set<Cohort>();
        public DbSet<ProgressMilestone> ProgressMilestones => Set<ProgressMilestone>();
        public DbSet<ProgressSubmission> ProgressSubmissions => Set<ProgressSubmission>();
        public DbSet<Committee> Committees => Set<Committee>();
        public DbSet<CommitteeMember> CommitteeMembers => Set<CommitteeMember>();
        public DbSet<CommitteeSession> CommitteeSessions => Set<CommitteeSession>();
        public DbSet<DefenseAssignment> DefenseAssignments => Set<DefenseAssignment>();
        public DbSet<DefenseScore> DefenseScores => Set<DefenseScore>();
        public DbSet<DefenseTerm> DefenseTerms => Set<DefenseTerm>();

        public DbSet<DefenseTermStudent> DefenseTermStudents => Set<DefenseTermStudent>();
        public DbSet<DefenseTermLecturer> DefenseTermLecturers => Set<DefenseTermLecturer>();
        public DbSet<TopicRenameRequest> TopicRenameRequests => Set<TopicRenameRequest>();
        public DbSet<TopicRenameRequestFile> TopicRenameRequestFiles => Set<TopicRenameRequestFile>();
        public DbSet<TopicTitleHistory> TopicTitleHistories => Set<TopicTitleHistory>();

        public DbSet<Room> Rooms => Set<Room>();
        public DbSet<IdempotencyRecord> IdempotencyRecords => Set<IdempotencyRecord>();

        public DbSet<SyncAuditLog> SyncAuditLogs => Set<SyncAuditLog>();
        public DbSet<DefenseGroup> DefenseGroups => Set<DefenseGroup>();
        public DbSet<ExportFile> ExportFiles => Set<ExportFile>();
        public DbSet<EvaluationReview> EvaluationReviews => Set<EvaluationReview>();
        public DbSet<DefenseMinute> DefenseMinutes => Set<DefenseMinute>();
        public DbSet<DefenseResult> DefenseResults => Set<DefenseResult>();
        public DbSet<DefenseRevision> DefenseRevisions => Set<DefenseRevision>();
        public DbSet<DefenseDocument> DefenseDocuments => Set<DefenseDocument>();
        public DbSet<CommitteeCodeReservation> CommitteeCodeReservations => Set<CommitteeCodeReservation>();
        public DbSet<CommitteeTag> CommitteeTags => Set<CommitteeTag>();
        
        public DbSet<TopicLecturer> TopicLecturers => Set<TopicLecturer>();
        
        // New DbSets for Tag system
        public DbSet<Tag> Tags => Set<Tag>();
        public DbSet<CatalogTopicTag> CatalogTopicTags => Set<CatalogTopicTag>();
        public DbSet<TopicTag> TopicTags => Set<TopicTag>();
        public DbSet<LecturerTag> LecturerTags => Set<LecturerTag>();
        public DbSet<MilestoneTemplate> MilestoneTemplates => Set<MilestoneTemplate>();
        public DbSet<SubmissionFile> SubmissionFiles => Set<SubmissionFile>();
        public DbSet<Conversation> Conversations => Set<Conversation>();
        public DbSet<ConversationMember> ConversationMembers => Set<ConversationMember>();
        public DbSet<Message> Messages => Set<Message>();
        public DbSet<MessageAttachment> MessageAttachments => Set<MessageAttachment>();
        public DbSet<MessageReaction> MessageReactions => Set<MessageReaction>();
        public DbSet<MessageReadReceipt> MessageReadReceipts => Set<MessageReadReceipt>();
        public DbSet<TopicWorkflowAudit> TopicWorkflowAudits => Set<TopicWorkflowAudit>();
        public DbSet<Notification> Notifications => Set<Notification>();
        public DbSet<NotificationRecipient> NotificationRecipients => Set<NotificationRecipient>();
        public DbSet<NotificationPreference> NotificationPreferences => Set<NotificationPreference>();
        public DbSet<NotificationOutbox> NotificationOutbox => Set<NotificationOutbox>();
        public DbSet<LecturerDashboardView> LecturerDashboardView => Set<LecturerDashboardView>();
        
        // AI Chatbot tables
        public DbSet<ChatSession> ChatSessions => Set<ChatSession>();
        public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();
        
        // System Activity Logs
        public DbSet<SystemActivityLog> SystemActivityLogs => Set<SystemActivityLog>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Departments
            modelBuilder.Entity<Department>(b =>
            {
                b.HasKey(x => x.DepartmentID);
                b.Property(x => x.DepartmentCode).HasMaxLength(30).IsRequired();
                b.Property(x => x.Name).HasMaxLength(200).IsRequired();
                b.HasIndex(x => x.DepartmentCode).IsUnique();
                b.Property(x => x.CreatedAt).HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.LastUpdated).HasDefaultValueSql("SYSTIMESTAMP");
            });

            // Users
            modelBuilder.Entity<User>(b =>
            {
                b.HasKey(x => x.UserID);
                b.Property(x => x.UserCode).HasMaxLength(40).IsRequired();
                b.HasIndex(x => x.UserCode).IsUnique();
                b.Property(x => x.PasswordHash).HasMaxLength(255).IsRequired();
                b.Property(x => x.Role).HasMaxLength(20).IsRequired();
                b.Property(x => x.CreatedAt).HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.LastUpdated).HasDefaultValueSql("SYSTIMESTAMP");
            });

            // StudentProfiles
            modelBuilder.Entity<StudentProfile>(b =>
            {
                b.HasKey(x => x.StudentProfileID);
                b.Property(x => x.StudentCode).HasMaxLength(30).IsRequired();
                b.HasIndex(x => x.StudentCode).IsUnique();
                b.HasOne(x => x.User).WithOne(x => x.StudentProfile).HasForeignKey<StudentProfile>(x => x.UserID);
                b.HasOne(x => x.Department).WithMany().HasForeignKey(x => x.DepartmentID).OnDelete(DeleteBehavior.SetNull);
                b.HasOne(x => x.Class).WithMany(x => x.StudentProfiles).HasForeignKey(x => x.ClassID).OnDelete(DeleteBehavior.SetNull);
                b.Property(x => x.StudentImage).HasMaxLength(255);
                b.Property(x => x.FullName).HasMaxLength(150);

                // New columns added to StudentProfiles
                b.Property(x => x.Gender).HasMaxLength(10);
                b.Property(x => x.DateOfBirth).HasColumnType("date");
                b.Property(x => x.PhoneNumber).HasMaxLength(20);
                b.Property(x => x.StudentEmail).HasMaxLength(150);
                b.Property(x => x.Address).HasMaxLength(255);
                b.Property(x => x.FullName).HasMaxLength(100);
                b.Property(x => x.EnrollmentYear);
                b.Property(x => x.Status).HasMaxLength(50).HasDefaultValue("Đang học");
                b.Property(x => x.GraduationYear);
                b.Property(x => x.Notes);

                b.Property(x => x.CreatedAt).HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.LastUpdated).HasDefaultValueSql("SYSTIMESTAMP");
            });

            // Classes
            modelBuilder.Entity<Class>(b =>
            {
                b.ToTable("CLASSES");
                b.HasKey(x => x.ClassID);
                b.Property(x => x.ClassID).HasColumnName("CLASSID");
                b.Property(x => x.ClassCode).HasColumnName("CLASSCODE").HasMaxLength(30).IsRequired();
                b.HasIndex(x => x.ClassCode).IsUnique();
                b.Property(x => x.ClassName).HasColumnName("CLASSNAME").HasMaxLength(150).IsRequired();
                b.Property(x => x.DepartmentID).HasColumnName("DEPARTMENTID");
                b.Property(x => x.DepartmentCode).HasColumnName("DEPARTMENTCODE").HasMaxLength(30);
                b.Property(x => x.CohortCode).HasColumnName("COHORT_CODE").HasMaxLength(50);
                b.Property(x => x.EnrollmentYear).HasColumnName("ENROLLMENTYEAR");
                b.Property(x => x.Status).HasColumnName("STATUS").HasMaxLength(30).HasDefaultValue("Đang hoạt động");
                b.Property(x => x.CreatedAt).HasColumnName("CREATEDAT").HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.LastUpdated).HasColumnName("LASTUPDATED");
                b.HasOne(x => x.Department).WithMany().HasForeignKey(x => x.DepartmentID).OnDelete(DeleteBehavior.Restrict);
            });

            // LecturerProfiles
            modelBuilder.Entity<LecturerProfile>(b =>
            {
                b.HasKey(x => x.LecturerProfileID);
                b.Property(x => x.LecturerCode).HasMaxLength(30).IsRequired();
                b.HasIndex(x => x.LecturerCode).IsUnique();
                b.Property(x => x.Degree).HasMaxLength(50);
                b.Property(x => x.Specialties).HasMaxLength(500);
                b.Property(x => x.FullName).HasMaxLength(150);
                b.HasOne(x => x.User).WithOne(x => x.LecturerProfile).HasForeignKey<LecturerProfile>(x => x.UserCode).HasPrincipalKey<User>(x => x.UserCode);
                b.HasOne(x => x.Department).WithMany(x => x.LecturerProfiles).HasForeignKey(x => x.DepartmentCode).HasPrincipalKey(x => x.DepartmentCode);
                b.Property(x => x.Organization).HasMaxLength(255);
                b.Property(x => x.GuideQuota).HasDefaultValue(10);
                b.Property(x => x.DefenseQuota).HasDefaultValue(8);
                b.Property(x => x.CurrentGuidingCount).HasDefaultValue(0);
                // New lecturer profile columns
                b.Property(x => x.Gender).HasMaxLength(10);
                b.Property(x => x.DateOfBirth).HasColumnType("date");
                b.Property(x => x.Email).HasMaxLength(100);
                b.Property(x => x.PhoneNumber).HasMaxLength(20);
                b.Property(x => x.ProfileImage).HasMaxLength(255);
                b.Property(x => x.Address).HasMaxLength(255);
                b.Property(x => x.Notes);
                b.Property(x => x.FullName).HasMaxLength(100);
                b.Property(x => x.CreatedAt).HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.LastUpdated).HasDefaultValueSql("SYSTIMESTAMP");
            });

            // CatalogTopics
            modelBuilder.Entity<CatalogTopic>(b =>
            {
                b.HasKey(x => x.CatalogTopicID);
                b.Property(x => x.CatalogTopicCode).HasMaxLength(40).IsRequired();
                b.HasIndex(x => x.CatalogTopicCode).IsUnique();
                b.Property(x => x.Title).HasMaxLength(255).IsRequired();
                b.Property(x => x.Summary).HasMaxLength(1000);
                b.Property(x => x.AssignedStatus).HasMaxLength(20);
                b.HasOne(x => x.Department).WithMany(x => x.CatalogTopics).HasForeignKey(x => x.DepartmentCode).HasPrincipalKey(x => x.DepartmentCode);
                b.Property(x => x.CreatedAt).HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.LastUpdated).HasDefaultValueSql("SYSTIMESTAMP");
            });

            // Topics
            modelBuilder.Entity<Topic>(b =>
            {
                b.ToTable("TOPICS", tb =>
                {
                    // Inform EF Core that triggers exist on this table so it avoids using a bare OUTPUT clause.
                    // Update the trigger names below to match the actual triggers defined in the database.
                    tb.HasTrigger("TR_Topics_Insert");
                    tb.HasTrigger("TR_Topics_Update");
                    tb.HasTrigger("TR_Topics_Delete");
                });
                b.HasKey(x => x.TopicID);
                b.Property(x => x.TopicCode).HasMaxLength(40).IsRequired();
                b.HasIndex(x => x.TopicCode).IsUnique();
                b.Property(x => x.Title).HasMaxLength(200).IsRequired();
                b.Property(x => x.Summary).HasMaxLength(1000);
                b.Property(x => x.Type).HasMaxLength(20).IsRequired();
                b.Property(x => x.Status).HasMaxLength(30).IsRequired();
                
                // Configure only the ProposerUser navigation property
                b.HasOne(x => x.ProposerUser).WithMany().HasForeignKey(x => x.ProposerUserCode).HasPrincipalKey(x => x.UserCode).OnDelete(DeleteBehavior.Restrict);
                

                
                // Property configurations
                b.Property(x => x.ProposerUserCode).HasMaxLength(40);
                b.Property(x => x.ProposerStudentCode).HasMaxLength(30);
                b.Property(x => x.SupervisorUserCode).HasMaxLength(40);
                b.Property(x => x.SupervisorLecturerCode).HasMaxLength(30);
                b.Property(x => x.CatalogTopicCode).HasMaxLength(40);
                b.Property(x => x.DepartmentCode).HasMaxLength(30);
                b.Property(x => x.DefenseTermId);
                b.Property(x => x.Score).HasPrecision(5, 2);
                // Oracle: map to CLOB by convention
                b.Property(x => x.LecturerComment);
                
                b.Property(x => x.CreatedAt).HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.LastUpdated).HasDefaultValueSql("SYSTIMESTAMP");
                
                // Evaluation review column mappings
                b.Property(x => x.ReviewQuality).HasColumnName("REVIEW_QUALITY");
                b.Property(x => x.ReviewAttitude).HasColumnName("REVIEW_ATTITUDE");
                b.Property(x => x.ReviewCapability).HasColumnName("REVIEW_CAPABILITY");
                b.Property(x => x.ReviewResultProcessing).HasColumnName("REVIEW_RESULT_PROCESSING");
                b.Property(x => x.ReviewAchievements).HasColumnName("REVIEW_ACHIEVEMENTS");
                b.Property(x => x.ReviewLimitations).HasColumnName("REVIEW_LIMITATIONS");
                b.Property(x => x.ReviewConclusion).HasColumnName("REVIEW_CONCLUSION");
                b.Property(x => x.ScoreInWords).HasColumnName("SCORE_IN_WORDS");

                // Structural fields column mappings
                b.Property(x => x.NumChapters).HasColumnName("NUM_CHAPTERS");
                b.Property(x => x.NumPages).HasColumnName("NUM_PAGES");
                b.Property(x => x.NumTables).HasColumnName("NUM_TABLES");
                b.Property(x => x.NumFigures).HasColumnName("NUM_FIGURES");
                b.Property(x => x.NumReferences).HasColumnName("NUM_REFERENCES");
                b.Property(x => x.NumVietnameseReferences).HasColumnName("NUM_VN_REFERENCES");
                b.Property(x => x.NumForeignReferences).HasColumnName("NUM_FOREIGN_REFERENCES");

                // Configure CatalogTopic navigation
                b.HasOne(x => x.CatalogTopic).WithMany().HasForeignKey(x => x.CatalogTopicCode).HasPrincipalKey(x => x.CatalogTopicCode).IsRequired(false);
                b.HasOne(x => x.DefenseTerm).WithMany(x => x.Topics).HasForeignKey(x => x.DefenseTermId).OnDelete(DeleteBehavior.SetNull);
            });

            // ProgressMilestones
            modelBuilder.Entity<ProgressMilestone>(b =>
            {
                b.HasKey(x => x.MilestoneID);
                b.Property(x => x.MilestoneCode).HasMaxLength(60).IsRequired();
                b.HasIndex(x => x.MilestoneCode).IsUnique();
                b.HasOne(x => x.Topic).WithMany().HasForeignKey(x => x.TopicID).OnDelete(DeleteBehavior.Restrict);
                b.Property(x => x.TopicCode).HasMaxLength(60);
                b.Property(x => x.MilestoneTemplateCode).HasMaxLength(40);
                b.HasOne(x => x.MilestoneTemplate).WithMany(x => x.ProgressMilestones).HasForeignKey(x => x.MilestoneTemplateCode).HasPrincipalKey(x => x.MilestoneTemplateCode).OnDelete(DeleteBehavior.SetNull);
                b.Property(x => x.Ordinal);
                b.Property(x => x.State).HasMaxLength(50).HasDefaultValue("Chưa bắt đầu");
                b.Property(x => x.StartedAt);
                b.Property(x => x.CompletedAt1);
                b.Property(x => x.CompletedAt2);
                b.Property(x => x.CompletedAt3);
                b.Property(x => x.CompletedAt4);
                b.Property(x => x.CompletedAt5);
                b.Property(x => x.CreatedAt).HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.LastUpdated).HasDefaultValueSql("SYSTIMESTAMP");
            });

            modelBuilder.Entity<Cohort>(b =>
            {
                b.ToTable("COHORTS");
                b.HasKey(x => x.Id);
                b.Property(x => x.Id).HasColumnName("ID");
                b.Property(x => x.CohortCode).HasColumnName("COHORT_CODE").HasMaxLength(50).IsRequired();
                b.HasIndex(x => x.CohortCode).IsUnique();
                b.Property(x => x.CohortName).HasColumnName("COHORT_NAME").HasMaxLength(255).IsRequired();
                b.Property(x => x.StartYear).HasColumnName("START_YEAR").IsRequired();
                b.Property(x => x.EndYear).HasColumnName("END_YEAR").IsRequired();
                b.Property(x => x.Status).HasColumnName("STATUS").HasDefaultValue(1);
                b.Property(x => x.CreatedAt).HasColumnName("CREATED_AT").HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.UpdatedAt).HasColumnName("UPDATED_AT").HasDefaultValueSql("SYSTIMESTAMP");
            });

            // ProgressSubmissions
            modelBuilder.Entity<ProgressSubmission>(b =>
            {
                // Inform EF Core that triggers exist on this table so it avoids using a bare OUTPUT clause.
                // Update the trigger names below to match the actual triggers defined in the database.
                b.ToTable("PROGRESSSUBMISSIONS", tb =>
                {
                    tb.HasTrigger("TR_ProgressSubmissions_Insert");
                    tb.HasTrigger("TR_ProgressSubmissions_Update");
                    tb.HasTrigger("TR_ProgressSubmissions_Delete");
                });

                b.HasKey(x => x.SubmissionID);
                b.Property(x => x.SubmissionCode).HasMaxLength(60).IsRequired();
                b.HasIndex(x => x.SubmissionCode).IsUnique();
                b.HasOne(x => x.Milestone).WithMany(x => x.ProgressSubmissions).HasForeignKey(x => x.MilestoneID).OnDelete(DeleteBehavior.SetNull);
                b.Property(x => x.MilestoneCode).HasMaxLength(60);
                b.HasOne(x => x.StudentUser).WithMany().HasForeignKey(x => x.StudentUserID).OnDelete(DeleteBehavior.SetNull);
                b.Property(x => x.StudentUserCode).HasMaxLength(40);
                b.Property(x => x.StudentProfileCode).HasMaxLength(60);
                b.Property(x => x.Ordinal);
                b.Property(x => x.SubmittedAt).HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.AttemptNumber).HasDefaultValue(1);
                // File columns are stored in SubmissionFiles table; do not configure file columns on ProgressSubmission
                b.Property(x => x.LastUpdated).HasDefaultValueSql("SYSTIMESTAMP");
            });

            // MilestoneTemplates
            modelBuilder.Entity<MilestoneTemplate>(b =>
            {
                b.HasKey(x => x.MilestoneTemplateID);
                b.Property(x => x.MilestoneTemplateCode).HasMaxLength(40).IsRequired();
                b.HasIndex(x => x.MilestoneTemplateCode).IsUnique();
                b.Property(x => x.Name).HasMaxLength(200).IsRequired();
                b.Property(x => x.Description);
                b.Property(x => x.Ordinal).IsRequired();
                b.Property(x => x.Deadline);
                b.Property(x => x.CreatedAt).HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.LastUpdated);
            });

            // SubmissionFiles
            modelBuilder.Entity<SubmissionFile>(b =>
            {
                b.HasKey(x => x.FileID);
                b.HasOne(x => x.Submission).WithMany(x => x.SubmissionFiles).HasForeignKey(x => x.SubmissionID);
                b.Property(x => x.SubmissionCode).HasMaxLength(60);
                b.Property(x => x.FileURL).HasMaxLength(1024).IsRequired();
                b.Property(x => x.FileName).HasMaxLength(255);
                b.Property(x => x.MimeType).HasMaxLength(100);
                b.Property(x => x.UploadedAt).HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.UploadedByUserCode).HasMaxLength(40);
            });

            // Conversations
            modelBuilder.Entity<Conversation>(b =>
            {
                b.ToTable("CONVERSATIONS");
                b.HasKey(x => x.ConversationID);
                b.Property(x => x.ConversationCode).HasMaxLength(50).IsRequired();
                b.HasIndex(x => x.ConversationCode).IsUnique();
                b.Property(x => x.ConversationType).HasMaxLength(20).IsRequired();
                b.Property(x => x.Title).HasMaxLength(200);
                b.Property(x => x.CreatedByUserCode).HasMaxLength(40);
                b.Property(x => x.AvatarURL).HasMaxLength(500);
                b.Property(x => x.LastMessagePreview).HasMaxLength(500);
                b.Property(x => x.IsArchived).HasConversion<int>().HasDefaultValue(0);
                b.Property(x => x.CreatedAt).HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.LastUpdated);
                b.HasOne<User>().WithMany().HasForeignKey(x => x.CreatedByUserID).OnDelete(DeleteBehavior.Restrict);
            });

            // ConversationMembers
            modelBuilder.Entity<ConversationMember>(b =>
            {
                b.ToTable("CONVERSATIONMEMBERS");
                b.HasKey(x => x.MemberID);
                b.Property(x => x.ConversationCode).HasMaxLength(50);
                b.Property(x => x.UserCode).HasMaxLength(40);
                b.Property(x => x.MemberRole).HasMaxLength(20).HasDefaultValue("Member");
                b.Property(x => x.NickName).HasMaxLength(100);
                b.Property(x => x.UserCode).HasMaxLength(40).IsRequired();
                b.Property(x => x.IsMuted).HasConversion<int>().HasDefaultValue(0);
                b.Property(x => x.IsPinned).HasConversion<int>().HasDefaultValue(0);
                b.Property(x => x.UnreadCount).HasDefaultValue(0);
                b.Property(x => x.JoinedAt).HasDefaultValueSql("SYSTIMESTAMP");
                b.HasOne(x => x.Conversation).WithMany(x => x.Members).HasForeignKey(x => x.ConversationID).OnDelete(DeleteBehavior.Cascade);
                b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserID).OnDelete(DeleteBehavior.Cascade);
                b.HasIndex(x => new { x.ConversationID, x.UserCode }).IsUnique();
            });

            // Messages
            modelBuilder.Entity<Message>(b =>
            {
                b.ToTable("MESSAGES");
                b.HasKey(x => x.MessageID);
                b.Property(x => x.MessageCode).HasMaxLength(60).IsRequired();
                b.HasIndex(x => x.MessageCode).IsUnique();
                b.Property(x => x.ConversationCode).HasMaxLength(50);
                b.Property(x => x.SenderUserID).IsRequired();
                b.Property(x => x.SenderUserCode).HasMaxLength(40).IsRequired();
                b.Property(x => x.MessageType).HasMaxLength(20).HasDefaultValue("TEXT");
                b.Property(x => x.IsEdited).HasConversion<int>().HasDefaultValue(0);
                b.Property(x => x.IsDeleted).HasConversion<int>().HasDefaultValue(0);
                b.Property(x => x.DeletedForEveryone).HasConversion<int>().HasDefaultValue(0);
                b.Property(x => x.SentAt).HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.CreatedAt).HasDefaultValueSql("SYSTIMESTAMP");
                b.HasOne(x => x.Conversation).WithMany(x => x.Messages).HasForeignKey(x => x.ConversationID).OnDelete(DeleteBehavior.Cascade);
                b.HasOne(x => x.SenderUser).WithMany().HasForeignKey(x => x.SenderUserID).OnDelete(DeleteBehavior.Restrict);
                b.HasOne(x => x.ReplyToMessage).WithMany().HasForeignKey(x => x.ReplyToMessageID).OnDelete(DeleteBehavior.SetNull);
                b.HasIndex(x => new { x.ConversationID, x.SentAt });
            });

            // MessageAttachments
            modelBuilder.Entity<MessageAttachment>(b =>
            {
                b.ToTable("MESSAGEATTACHMENTS");
                b.HasKey(x => x.AttachmentID);
                b.Property(x => x.FileUrl).HasMaxLength(1024).IsRequired();
                b.Property(x => x.FileName).HasMaxLength(255);
                b.Property(x => x.MimeType).HasMaxLength(100);
                b.Property(x => x.ThumbnailURL).HasMaxLength(1000);
                b.Property(x => x.UploadedAt).HasDefaultValueSql("SYSTIMESTAMP");
                b.HasOne(x => x.Message).WithMany(x => x.Attachments).HasForeignKey(x => x.MessageID).OnDelete(DeleteBehavior.Cascade);
            });

            // MessageReactions
            modelBuilder.Entity<MessageReaction>(b =>
            {
                b.ToTable("MESSAGEREACTIONS");
                b.HasKey(x => x.ReactionID);
                b.Property(x => x.UserID).IsRequired();
                b.Property(x => x.UserCode).HasMaxLength(40).IsRequired();
                b.Property(x => x.ReactionType).HasMaxLength(20);
                b.Property(x => x.ReactedAt).HasDefaultValueSql("SYSTIMESTAMP");
                b.HasOne(x => x.Message).WithMany(x => x.Reactions).HasForeignKey(x => x.MessageID).OnDelete(DeleteBehavior.Cascade);
                b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserID).OnDelete(DeleteBehavior.Cascade);
                b.HasIndex(x => new { x.MessageID, x.UserCode, x.ReactionType }).IsUnique();
            });

            // MessageReadReceipts
            modelBuilder.Entity<MessageReadReceipt>(b =>
            {
                b.ToTable("MESSAGEREADRECEIPTS");
                b.HasKey(x => x.ReceiptID);
                b.Property(x => x.UserID).IsRequired();
                b.Property(x => x.UserCode).HasMaxLength(40).IsRequired();
                b.Property(x => x.ReadAt).HasDefaultValueSql("SYSTIMESTAMP");
                b.HasOne(x => x.Message).WithMany().HasForeignKey(x => x.MessageID).OnDelete(DeleteBehavior.Cascade);
                b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserID).OnDelete(DeleteBehavior.Cascade);
                b.HasIndex(x => new { x.MessageID, x.UserCode }).IsUnique();
            });

            // Committees
            modelBuilder.Entity<IdempotencyRecord>(b =>
            {
                var nullableBoolToNumberConverter = new ValueConverter<bool?, int?>(
                    value => !value.HasValue ? null : (value.Value ? 1 : 0),
                    value => !value.HasValue ? null : value.Value != 0);

                b.ToTable("IDEMPOTENCY_RECORDS");
                b.HasKey(x => x.IdempotencyRecordID);
                b.Property(x => x.IdempotencyRecordID).HasColumnName("IDEMPOTENCY_RECORD_ID");
                b.Property(x => x.Action).HasColumnName("ACTION").HasMaxLength(80).IsRequired();
                b.Property(x => x.PeriodID).HasColumnName("PERIOD_ID");
                b.Property(x => x.RequestKey).HasColumnName("REQUEST_KEY").HasMaxLength(200).IsRequired();
                b.Property(x => x.RequestHash).HasColumnName("REQUEST_HASH").HasMaxLength(128).IsRequired();
                b.Property(x => x.ResponsePayload).HasColumnName("RESPONSE_PAYLOAD").HasColumnType("CLOB");
                b.Property(x => x.ResponseStatusCode).HasColumnName("RESPONSE_STATUS_CODE");
                b.Property(x => x.ResponseSuccess)
                    .HasColumnName("RESPONSE_SUCCESS")
                    .HasColumnType("NUMBER(1)")
                    .HasConversion(nullableBoolToNumberConverter);
                b.Property(x => x.RecordStatus).HasColumnName("RECORD_STATUS").HasDefaultValue(IdempotencyRecordStatus.Processing);
                b.Property(x => x.CreatedAt).HasColumnName("CREATED_AT").HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.ExpiresAt).HasColumnName("EXPIRES_AT").IsRequired();
                b.Property(x => x.CompletedAt).HasColumnName("COMPLETED_AT");
                b.HasIndex(x => new { x.Action, x.PeriodID, x.RequestKey }).IsUnique();
                b.HasIndex(x => new { x.Action, x.PeriodID, x.RequestKey, x.RequestHash });
                b.HasIndex(x => x.ExpiresAt);
            });

            modelBuilder.Entity<CommitteeCodeReservation>(b =>
            {
                b.ToTable("COMMITTEECODERESERVATIONS");
                b.HasKey(x => x.CommitteeCodeReservationId);
                b.Property(x => x.PeriodId).IsRequired();
                b.Property(x => x.Year).IsRequired();
                b.Property(x => x.Sequence).IsRequired();
                b.Property(x => x.CommitteeCode).HasMaxLength(40).IsRequired();
                b.Property(x => x.Status).HasMaxLength(20).IsRequired();
                b.Property(x => x.RequestKey).HasMaxLength(200);
                b.Property(x => x.ReservedAt).HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.ExpiresAt).IsRequired();
                b.Property(x => x.CommittedAt);
                b.HasIndex(x => x.CommitteeCode).IsUnique();
                b.HasIndex(x => new { x.Year, x.Sequence }).IsUnique();
                b.HasIndex(x => x.ExpiresAt);
                b.HasIndex(x => new { x.PeriodId, x.RequestKey });
            });

            modelBuilder.Entity<Room>(b =>
            {
                b.ToTable("ROOMS");
                b.HasKey(x => x.RoomID);
                b.Property(x => x.RoomID).HasColumnName("ROOM_ID");
                b.Property(x => x.RoomCode).HasColumnName("ROOM_CODE").HasMaxLength(40).IsRequired();
                b.HasIndex(x => x.RoomCode).IsUnique();
                b.Property(x => x.Status).HasColumnName("ROOM_STATUS").HasMaxLength(50);
                b.Property(x => x.CreatedAt).HasColumnName("CREATED_AT").HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.LastUpdated).HasColumnName("LAST_UPDATED").HasDefaultValueSql("SYSTIMESTAMP");
            });

            modelBuilder.Entity<Committee>(b =>
            {
                b.ToTable("COMMITTEES", tb =>
                {
                    tb.HasTrigger("TR_Committees_Insert");
                    tb.HasTrigger("TR_Committees_Update");
                    tb.HasTrigger("TR_Committees_Delete");
                });
                b.HasKey(x => x.CommitteeID);
                b.Property(x => x.CommitteeCode).HasMaxLength(40).IsRequired();
                b.HasIndex(x => x.CommitteeCode).IsUnique();
                b.Ignore(x => x.RoomID);
                b.Ignore(x => x.RoomEntity);
                b.Property(x => x.Room).HasMaxLength(40);
                b.Property(x => x.Name).HasMaxLength(200);
                b.Property(x => x.Status).HasMaxLength(50);
                b.HasOne(x => x.DefenseTerm)
                    .WithMany(x => x.Committees)
                    .HasForeignKey(x => x.DefenseTermId)
                    .OnDelete(DeleteBehavior.Restrict);
                b.HasIndex(x => x.DefenseTermId);
                b.HasIndex(x => new { x.DefenseTermId, x.DefenseDate, x.Room });
                b.Property(x => x.CreatedAt).HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.LastUpdated).HasDefaultValueSql("SYSTIMESTAMP");
            });

            modelBuilder.Entity<CommitteeSession>(b =>
            {
                b.ToTable("COMMITTEESESSIONS");
                b.HasKey(x => x.CommitteeSessionID);
                b.Property(x => x.CommitteeCode).HasMaxLength(40).IsRequired();
                b.Property(x => x.SessionNumber).IsRequired();
                b.Property(x => x.TopicCount).HasDefaultValue(0);
                b.Property(x => x.CreatedAt).HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.LastUpdated).HasDefaultValueSql("SYSTIMESTAMP");
                b.HasOne(x => x.Committee)
                    .WithMany()
                    .HasForeignKey(x => x.CommitteeCode)
                    .HasPrincipalKey(x => x.CommitteeCode)
                    .OnDelete(DeleteBehavior.Cascade);
                b.HasIndex(x => new { x.CommitteeCode, x.SessionNumber }).IsUnique();
            });

            modelBuilder.Entity<CommitteeTag>(b =>
            {
                b.ToTable("COMMITTEETAGS", tb =>
                {
                    tb.HasTrigger("TR_CommitteeTags_Insert");
                    tb.HasTrigger("TR_CommitteeTags_Update");
                    tb.HasTrigger("TR_CommitteeTags_Delete");
                });
                b.HasKey(x => x.CommitteeTagID);
                b.Property(x => x.CommitteeID).IsRequired();
                b.Property(x => x.CommitteeCode).HasMaxLength(50).IsRequired();
                b.Property(x => x.TagID).IsRequired();
                b.Property(x => x.TagCode).HasMaxLength(50).IsRequired();
                b.Property(x => x.CreatedAt).HasDefaultValueSql("SYSTIMESTAMP");

                b.HasOne(x => x.Committee)
                    .WithMany(x => x.CommitteeTags)
                    .HasForeignKey(x => x.CommitteeID)
                    .OnDelete(DeleteBehavior.Cascade);

                b.HasOne(x => x.Tag)
                    .WithMany(x => x.CommitteeTags)
                    .HasForeignKey(x => x.TagID)
                    .OnDelete(DeleteBehavior.Cascade);

                b.HasIndex(x => new { x.CommitteeCode, x.TagID }).IsUnique();
            });

            // CommitteeMembers with new schema
            modelBuilder.Entity<CommitteeMember>(b =>
            {
                b.ToTable("COMMITTEEMEMBERS", tb =>
                {
                    tb.HasTrigger("TR_CommitteeMembers_Insert");
                    tb.HasTrigger("TR_CommitteeMembers_Update");
                    tb.HasTrigger("TR_CommitteeMembers_Delete");
                });
                b.HasKey(x => x.CommitteeMemberID);
                
                // Configure navigation properties with Code-based foreign keys
                b.HasOne(x => x.Committee).WithMany().HasForeignKey(x => x.CommitteeCode).HasPrincipalKey(x => x.CommitteeCode).OnDelete(DeleteBehavior.SetNull);
                b.HasOne(x => x.MemberUser).WithMany().HasForeignKey(x => x.MemberUserCode).HasPrincipalKey(x => x.UserCode).OnDelete(DeleteBehavior.SetNull);
                b.HasOne(x => x.MemberLecturerProfile).WithMany().HasForeignKey(x => x.MemberLecturerCode).HasPrincipalKey(x => x.LecturerCode).OnDelete(DeleteBehavior.SetNull);
                
                // Property configurations
                b.Property(x => x.CommitteeCode).HasMaxLength(40);
                b.Property(x => x.MemberLecturerCode).HasMaxLength(30);
                b.Property(x => x.MemberUserCode).HasMaxLength(40);
                b.Property(x => x.Role).HasMaxLength(100);
                b.Property(x => x.IsChair)
                    .HasConversion(
                        v => v.HasValue ? (v.Value ? 1 : 0) : (int?)null,
                        v => v.HasValue ? v.Value == 1 : (bool?)null)
                    .HasDefaultValue(false);
            });

            var sessionConverter = new ValueConverter<int?, string?>(
                v => FormatSessionValue(v),
                v => ParseSessionValue(v));

            // DefenseAssignments
            modelBuilder.Entity<DefenseAssignment>(b =>
            {
                b.ToTable("DEFENSEASSIGNMENTS", tb =>
                {
                    tb.HasTrigger("TR_DefenseAssignments_Insert");
                    tb.HasTrigger("TR_DefenseAssignments_Update");
                    tb.HasTrigger("TR_DefenseAssignments_Delete");
                });
                b.HasKey(x => x.AssignmentID);
                b.Property(x => x.AssignmentCode).HasMaxLength(60).IsRequired();
                b.HasIndex(x => x.AssignmentCode).IsUnique();
                b.HasOne(x => x.Topic).WithMany().HasForeignKey(x => x.TopicCode).HasPrincipalKey(x => x.TopicCode);
                b.HasOne(x => x.Committee)
                    .WithMany()
                    .HasForeignKey(x => x.CommitteeID)
                    .OnDelete(DeleteBehavior.SetNull);
                b.HasOne(x => x.DefenseTerm)
                    .WithMany(x => x.DefenseAssignments)
                    .HasForeignKey(x => x.DefenseTermId)
                    .OnDelete(DeleteBehavior.SetNull);
                b.HasIndex(x => x.CommitteeID);
                b.HasIndex(x => x.DefenseTermId);
                b.Property(x => x.CreatedAt).HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.LastUpdated).HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.Session)
                    .HasConversion(sessionConverter)
                    .HasMaxLength(20);
                b.Ignore(x => x.Shift);
                b.Property(x => x.OrderIndex);
                b.Ignore(x => x.StartTime);
                b.Ignore(x => x.EndTime);
                b.Ignore(x => x.AssignedBy);
                b.Ignore(x => x.AssignedAt);
                b.Ignore(x => x.Status);
            });

            // DefenseScores
            modelBuilder.Entity<DefenseScore>(b =>
            {
                b.HasKey(x => x.ScoreID);
                b.Property(x => x.ScoreCode).HasMaxLength(60).IsRequired();
                b.HasIndex(x => x.ScoreCode).IsUnique();
                
                // Configure only the essential navigation property
                b.HasOne(x => x.MemberLecturerUser).WithMany().HasForeignKey(x => x.MemberLecturerUserCode).HasPrincipalKey(x => x.UserCode).OnDelete(DeleteBehavior.SetNull);
                

                
                // Property configurations
                b.Property(x => x.AssignmentCode).HasMaxLength(60);
                b.Property(x => x.MemberLecturerCode).HasMaxLength(30);
                b.Property(x => x.MemberLecturerUserCode).HasMaxLength(40);
                b.Ignore(x => x.Role);
                b.Property(x => x.Score).HasColumnType("NUMBER(5,2)");
                b.Property(x => x.IsSubmitted).HasConversion<int>().HasDefaultValue(0);
                b.Property(x => x.RevisionRequired)
                    .HasColumnName("REVISION_REQUIRED")
                    .HasConversion<int>()
                    .HasDefaultValue(0);
                b.Property(x => x.RevisionReason)
                    .HasColumnName("REVISION_REASON")
                    .HasMaxLength(1000);
                b.Property(x => x.RevisionDeadlineDays)
                    .HasColumnName("REVISION_DEADLINE_DAYS");
                b.Property(x => x.CreatedAt).HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.LastUpdated).HasDefaultValueSql("SYSTIMESTAMP");
            });

            // DefenseTerms
            modelBuilder.Entity<DefenseTerm>(b =>
            {
                b.ToTable("DEFENSETERMS", tb =>
                {
                    tb.HasTrigger("TR_DEFENSETERMS_BI");
                });
                b.HasKey(x => x.DefenseTermId);
                b.Property(x => x.TermCode).HasMaxLength(50);
                b.Property(x => x.Name).HasMaxLength(200).IsRequired();
                b.Property(x => x.Description);
                b.Property(x => x.AcademicYear).HasMaxLength(20);
                b.Property(x => x.Semester).HasMaxLength(20);
                b.Property(x => x.StartDate);
                b.Property(x => x.EndDate);
                b.Property(x => x.ConfigJson);
                b.Property(x => x.Status).HasMaxLength(30).HasDefaultValue("Draft");
                b.Property(x => x.CreatedAt).HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.LastUpdated).HasDefaultValueSql("SYSTIMESTAMP");
            });

            // DefenseTermStudents
            modelBuilder.Entity<DefenseTermStudent>(b =>
            {
                b.ToTable("DEFENSETERMSTUDENTS", tb =>
                {
                    tb.HasTrigger("TR_DEFENSETERMSTUDENTS_BI");
                });
                b.HasKey(x => x.DefenseTermStudentID);
                b.Property(x => x.DefenseTermStudentID).HasDefaultValueSql("DEFENSETERMSTUDENTS_SEQ.NEXTVAL");
                b.Property(x => x.StudentCode).HasMaxLength(30).IsRequired();
                b.Property(x => x.UserCode).HasMaxLength(40).IsRequired();
                b.Property(x => x.CreatedAt).HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.LastUpdated).HasDefaultValueSql("SYSTIMESTAMP");

                b.HasOne(x => x.DefenseTerm)
                    .WithMany(x => x.DefenseTermStudents)
                    .HasForeignKey(x => x.DefenseTermId)
                    .OnDelete(DeleteBehavior.Cascade);

                b.HasOne(x => x.StudentProfile)
                    .WithMany()
                    .HasForeignKey(x => x.StudentProfileID)
                    .HasPrincipalKey(x => x.StudentProfileID)
                    .OnDelete(DeleteBehavior.Cascade);

                b.HasOne<StudentProfile>()
                    .WithMany()
                    .HasForeignKey(x => x.StudentCode)
                    .HasPrincipalKey(x => x.StudentCode)
                    .OnDelete(DeleteBehavior.Cascade);

                b.HasOne(x => x.StudentUser)
                    .WithMany()
                    .HasForeignKey(x => x.UserCode)
                    .HasPrincipalKey(x => x.UserCode)
                    .OnDelete(DeleteBehavior.Cascade);

                b.HasIndex(x => new { x.DefenseTermId, x.StudentProfileID }).IsUnique();
                b.HasIndex(x => new { x.DefenseTermId, x.StudentCode }).IsUnique();
                b.HasIndex(x => new { x.DefenseTermId, x.UserCode }).IsUnique();
            });

            // DefenseTermLecturers
            modelBuilder.Entity<DefenseTermLecturer>(b =>
            {
                b.ToTable("DEFENSETERMLECTURERS", tb =>
                {
                    tb.HasTrigger("TR_DEFENSETERMLECTURERS_BI");
                });
                b.HasKey(x => x.DefenseTermLecturerID);
                b.Property(x => x.DefenseTermLecturerID).HasDefaultValueSql("DEFENSETERMLECTURERS_SEQ.NEXTVAL");
                b.Property(x => x.LecturerCode).HasMaxLength(30).IsRequired();
                b.Property(x => x.UserCode).HasMaxLength(40).IsRequired();
                b.Property(x => x.IsPrimary).HasConversion<int>().HasDefaultValue(0);
                b.Property(x => x.CreatedAt).HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.LastUpdated).HasDefaultValueSql("SYSTIMESTAMP");

                b.HasOne(x => x.DefenseTerm)
                    .WithMany(x => x.DefenseTermLecturers)
                    .HasForeignKey(x => x.DefenseTermId)
                    .OnDelete(DeleteBehavior.Cascade);

                b.HasOne(x => x.LecturerProfile)
                    .WithMany()
                    .HasForeignKey(x => x.LecturerProfileID)
                    .HasPrincipalKey(x => x.LecturerProfileID)
                    .OnDelete(DeleteBehavior.Cascade);

                b.HasOne<LecturerProfile>()
                    .WithMany()
                    .HasForeignKey(x => x.LecturerCode)
                    .HasPrincipalKey(x => x.LecturerCode)
                    .OnDelete(DeleteBehavior.Cascade);

                b.HasOne(x => x.LecturerUser)
                    .WithMany()
                    .HasForeignKey(x => x.UserCode)
                    .HasPrincipalKey(x => x.UserCode)
                    .OnDelete(DeleteBehavior.Cascade);

                b.HasIndex(x => new { x.DefenseTermId, x.LecturerProfileID }).IsUnique();
                b.HasIndex(x => new { x.DefenseTermId, x.LecturerCode }).IsUnique();
                b.HasIndex(x => new { x.DefenseTermId, x.UserCode }).IsUnique();
            });

            // TopicRenameRequests
            modelBuilder.Entity<TopicRenameRequest>(b =>
            {
                b.ToTable("TOPIC_RENAME_REQUESTS", tb =>
                {
                    tb.HasTrigger("TRG_TOPIC_RENAME_REQUESTS_BIU");
                });
                b.HasKey(x => x.RequestId);
                b.Property(x => x.RequestId).HasDefaultValueSql("TOPIC_RENAME_REQUESTS_SEQ.NEXTVAL");
                b.Property(x => x.RequestCode).HasMaxLength(40).IsRequired();
                b.HasIndex(x => x.RequestCode).IsUnique();
                b.Property(x => x.TopicCode).HasMaxLength(40).IsRequired();
                b.Property(x => x.OldTitle).HasMaxLength(500).IsRequired();
                b.Property(x => x.NewTitle).HasMaxLength(500).IsRequired();
                b.Property(x => x.Status).HasMaxLength(20).IsRequired();
                b.Property(x => x.RequestedByUserCode).HasMaxLength(40).IsRequired();
                b.Property(x => x.RequestedByRole).HasMaxLength(20).IsRequired();
                b.Property(x => x.ReviewedByUserCode).HasMaxLength(40);
                b.Property(x => x.ReviewedByRole).HasMaxLength(20);
                b.Property(x => x.GeneratedFileUrl).HasMaxLength(500);
                b.Property(x => x.GeneratedFileName).HasMaxLength(255);
                b.Property(x => x.GeneratedFileHash).HasMaxLength(64);
                b.Property(x => x.RequestedAt).HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.CreatedAt).HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.LastUpdated).HasDefaultValueSql("SYSTIMESTAMP");

                b.HasOne(x => x.Topic).WithMany().HasForeignKey(x => x.TopicId).OnDelete(DeleteBehavior.SetNull);
                b.HasOne(x => x.RequestedByUser).WithMany().HasForeignKey(x => x.RequestedByUserId).OnDelete(DeleteBehavior.Restrict);
                b.HasOne(x => x.ReviewedByUser).WithMany().HasForeignKey(x => x.ReviewedByUserId).OnDelete(DeleteBehavior.SetNull);
            });

            // ChatSessions
            modelBuilder.Entity<ChatSession>(b =>
            {
                b.ToTable("CHAT_SESSIONS", tb => 
                {
                    tb.HasTrigger("TR_ChatSessions_BI");
                });
                b.HasKey(x => x.ChatSessionID);
                b.Property(x => x.ChatSessionID).HasColumnName("CHAT_SESSION_ID");
                b.Property(x => x.UserID).HasColumnName("USER_ID").IsRequired();
                b.Property(x => x.Title).HasColumnName("TITLE").HasMaxLength(255);
                b.Property(x => x.ModelName).HasColumnName("MODEL_NAME").HasMaxLength(50);
                b.Property(x => x.CreatedAt).HasColumnName("CREATED_AT").HasDefaultValueSql("SYSDATE");
                b.Property(x => x.IsArchived).HasColumnName("IS_ARCHIVED").HasDefaultValue(0);

                b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserID).OnDelete(DeleteBehavior.Cascade);
            });

            // ChatMessages
            modelBuilder.Entity<ChatMessage>(b =>
            {
                b.ToTable("CHAT_MESSAGES", tb =>
                {
                    tb.HasTrigger("TR_ChatMessages_BI");
                });
                b.HasKey(x => x.ChatMessageID);
                b.Property(x => x.ChatMessageID).HasColumnName("CHAT_MESSAGE_ID");
                b.Property(x => x.ChatSessionID).HasColumnName("CHAT_SESSION_ID").IsRequired();
                b.Property(x => x.Role).HasColumnName("ROLE").HasMaxLength(20).IsRequired();
                b.Property(x => x.Content).HasColumnName("CONTENT").HasColumnType("CLOB").IsRequired();
                b.Property(x => x.Feedback).HasColumnName("FEEDBACK").HasDefaultValue(0);
                b.Property(x => x.PromptTokens).HasColumnName("PROMPT_TOKENS").HasDefaultValue(0);
                b.Property(x => x.CompletionTokens).HasColumnName("COMPLETION_TOKENS").HasDefaultValue(0);
                b.Property(x => x.CreatedAt).HasColumnName("CREATED_AT").HasDefaultValueSql("SYSDATE");

                b.HasOne(x => x.Session).WithMany(x => x.Messages).HasForeignKey(x => x.ChatSessionID).OnDelete(DeleteBehavior.Cascade);
            });

            // TopicRenameRequestFiles
            modelBuilder.Entity<TopicRenameRequestFile>(b =>
            {
                b.ToTable("TOPIC_RENAME_REQUEST_FILES", tb =>
                {
                    tb.HasTrigger("TRG_TOPIC_RENAME_REQUEST_FILES_BIU");
                });
                b.HasKey(x => x.FileId);
                b.Property(x => x.FileId).HasDefaultValueSql("TOPIC_RENAME_REQUEST_FILES_SEQ.NEXTVAL");
                b.Property(x => x.FileCode).HasMaxLength(40).IsRequired();
                b.HasIndex(x => x.FileCode).IsUnique();
                b.Property(x => x.FileType).HasMaxLength(30).IsRequired();
                b.Property(x => x.FileName).HasMaxLength(255).IsRequired();
                b.Property(x => x.OriginalFileName).HasMaxLength(255);
                b.Property(x => x.FileUrl).HasMaxLength(500).IsRequired();
                b.Property(x => x.FilePath).HasMaxLength(500);
                b.Property(x => x.StorageProvider).HasMaxLength(20).IsRequired();
                b.Property(x => x.MimeType).HasMaxLength(100);
                b.Property(x => x.FileHash).HasMaxLength(64);
                b.Property(x => x.FileVersion).HasDefaultValue(1);
                b.Property(x => x.IsCurrent).HasConversion<int>().HasDefaultValue(1);
                b.Property(x => x.CreatedAt).HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.LastUpdated).HasDefaultValueSql("SYSTIMESTAMP");

                b.HasOne(x => x.Request).WithMany(x => x.Files).HasForeignKey(x => x.RequestId).OnDelete(DeleteBehavior.Cascade);
                b.HasOne(x => x.UploadedByUser).WithMany().HasForeignKey(x => x.UploadedByUserId).OnDelete(DeleteBehavior.SetNull);
                b.HasIndex(x => new { x.RequestId, x.IsCurrent });
            });

            // TopicTitleHistory
            modelBuilder.Entity<TopicTitleHistory>(b =>
            {
                b.ToTable("TOPIC_TITLE_HISTORY", tb =>
                {
                    tb.HasTrigger("TRG_TOPIC_TITLE_HISTORY_BIU");
                });
                b.HasKey(x => x.HistoryId);
                b.Property(x => x.HistoryId).HasDefaultValueSql("TOPIC_TITLE_HISTORY_SEQ.NEXTVAL");
                b.Property(x => x.HistoryCode).HasMaxLength(40).IsRequired();
                b.HasIndex(x => x.HistoryCode).IsUnique();
                b.Property(x => x.TopicCode).HasMaxLength(40).IsRequired();
                b.Property(x => x.RequestCode).HasMaxLength(40);
                b.Property(x => x.PreviousTitle).HasMaxLength(500).IsRequired();
                b.Property(x => x.NewTitle).HasMaxLength(500).IsRequired();
                b.Property(x => x.ChangeType).HasMaxLength(30).IsRequired();
                b.Property(x => x.ChangedByUserCode).HasMaxLength(40).IsRequired();
                b.Property(x => x.ChangedByRole).HasMaxLength(20).IsRequired();
                b.Property(x => x.ApprovedByUserCode).HasMaxLength(40);
                b.Property(x => x.ApprovedByRole).HasMaxLength(20);
                b.Property(x => x.EffectiveAt).HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.CreatedAt).HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.LastUpdated).HasDefaultValueSql("SYSTIMESTAMP");

                b.HasOne(x => x.Topic).WithMany().HasForeignKey(x => x.TopicId).OnDelete(DeleteBehavior.SetNull);
                b.HasOne(x => x.Request).WithMany(x => x.TitleHistories).HasForeignKey(x => x.RequestId).OnDelete(DeleteBehavior.SetNull);
                b.HasOne(x => x.ChangedByUser).WithMany().HasForeignKey(x => x.ChangedByUserId).OnDelete(DeleteBehavior.Restrict);
                b.HasOne(x => x.ApprovedByUser).WithMany().HasForeignKey(x => x.ApprovedByUserId).OnDelete(DeleteBehavior.SetNull);

                b.HasIndex(x => x.TopicId);
                b.HasIndex(x => x.TopicCode);
                b.HasIndex(x => x.RequestId);
                b.HasIndex(x => x.EffectiveAt);
            });

            // SyncAuditLogs
            modelBuilder.Entity<SyncAuditLog>(b =>
            {
                b.ToTable("SYNCAUDITLOGS");
                b.HasKey(x => x.SyncAuditLogId);
                b.Property(x => x.Action).HasMaxLength(150).IsRequired();
                b.Property(x => x.Result).HasMaxLength(50).IsRequired();
                b.Property(x => x.Records).HasMaxLength(4000).IsRequired();
                b.Property(x => x.Timestamp).HasDefaultValueSql("SYSTIMESTAMP");
            });

            // DefenseGroups
            modelBuilder.Entity<DefenseGroup>(b =>
            {
                b.ToTable("DEFENSEGROUPS");
                b.HasKey(x => x.DefenseGroupId);
                b.Property(x => x.TermId).IsRequired();
                b.Property(x => x.SlotId).HasMaxLength(80).IsRequired();
                b.Property(x => x.StudentCodesJson).IsRequired();
                b.Property(x => x.CreatedAt).HasDefaultValueSql("SYSTIMESTAMP");
                b.HasIndex(x => new { x.TermId, x.SlotId });
            });

            // ExportFiles
            modelBuilder.Entity<ExportFile>(b =>
            {
                b.ToTable("EXPORTFILES");
                b.HasKey(x => x.ExportFileId).HasName("EXPORTFILEID");
                b.Property(x => x.ExportFileId).HasColumnName("EXPORTFILEID");
                b.Property(x => x.FileCode).HasColumnName("FILECODE").HasMaxLength(40).IsRequired();
                b.HasIndex(x => x.FileCode).IsUnique();
                b.Property(x => x.TermId).HasColumnName("TERMID");
                b.Property(x => x.Status).HasColumnName("STATUS").HasMaxLength(30).HasDefaultValue("Running");
                b.Property(x => x.FileUrl).HasColumnName("FILEURL").HasMaxLength(500);
                b.Property(x => x.CreatedAt).HasColumnName("CREATEDAT").HasDefaultValueSql("SYSTIMESTAMP");
            });

            // EvaluationReviews
            modelBuilder.Entity<EvaluationReview>(b =>
            {
                b.ToTable("EVALUATION_REVIEWS");
                b.HasKey(x => x.Id);
                b.Property(x => x.Id).HasColumnName("REVIEWID");
                b.Property(x => x.AssignmentId).HasColumnName("ASSIGNMENTID");
                b.Property(x => x.LecturerId).HasColumnName("LECTURERPROFILEID");
                b.Property(x => x.ReviewType)
                    .HasColumnName("REVIEWTYPE")
                    .HasConversion<string>()
                    .HasMaxLength(20)
                    .IsRequired();
                b.Property(x => x.Criteria1Text).HasColumnName("CRITERIA_1_TEXT");
                b.Property(x => x.Criteria2Text).HasColumnName("CRITERIA_2_TEXT");
                b.Property(x => x.Criteria3Text).HasColumnName("CRITERIA_3_TEXT");
                b.Property(x => x.Criteria4Text).HasColumnName("CRITERIA_4_TEXT");
                b.Property(x => x.Limitations).HasColumnName("LIMITATIONS");
                b.Property(x => x.Suggestions).HasColumnName("SUGGESTIONS");
                b.Property(x => x.NumericScore).HasColumnName("NUMERICSCORE").HasColumnType("NUMBER(5,2)");
                b.Property(x => x.TextScore).HasColumnName("TEXTSCORE").HasMaxLength(100);
                b.Property(x => x.IsApproved).HasColumnName("IS_APPROVED").HasConversion<int>().HasDefaultValue(0);
                b.Property(x => x.CreatedAt).HasColumnName("CREATEDAT").HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.LastUpdated).HasColumnName("LASTUPDATED").HasDefaultValueSql("SYSTIMESTAMP");
                b.HasOne(x => x.Assignment).WithMany().HasForeignKey(x => x.AssignmentId).OnDelete(DeleteBehavior.Cascade);
                b.HasOne(x => x.Lecturer).WithMany().HasForeignKey(x => x.LecturerId).OnDelete(DeleteBehavior.Restrict);
            });

            // DefenseMinutes
            modelBuilder.Entity<DefenseMinute>(b =>
            {
                b.ToTable("DEFENSE_MINUTES");
                b.HasKey(x => x.Id);
                b.Property(x => x.Id).HasColumnName("MINUTEID");
                b.Property(x => x.AssignmentId).HasColumnName("ASSIGNMENTID");
                b.Property(x => x.SecretaryId).HasColumnName("SECRETARY_ID");
                b.Property(x => x.SummaryContent).HasColumnName("SUMMARYCONTENT");
                b.Property(x => x.ReviewerComments).HasColumnName("REVIEWERCOMMENTS");
                b.Property(x => x.QnaDetails).HasColumnName("QNA_DETAILS");
                b.Property(x => x.Strengths).HasColumnName("STRENGTHS");
                b.Property(x => x.Weaknesses).HasColumnName("WEAKNESSES");
                b.Property(x => x.Recommendations).HasColumnName("RECOMMENDATIONS");
                b.Property(x => x.CreatedAt).HasColumnName("CREATEDAT").HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.LastUpdated).HasColumnName("LASTUPDATED").HasDefaultValueSql("SYSTIMESTAMP");
                b.HasIndex(x => x.AssignmentId).IsUnique();
                b.HasOne(x => x.Assignment).WithMany().HasForeignKey(x => x.AssignmentId).OnDelete(DeleteBehavior.Cascade);
                b.HasOne(x => x.Secretary).WithMany().HasForeignKey(x => x.SecretaryId).OnDelete(DeleteBehavior.Restrict);
            });

            // DefenseResults
            modelBuilder.Entity<DefenseResult>(b =>
            {
                b.ToTable("DEFENSE_RESULTS");
                b.HasKey(x => x.Id);
                b.Property(x => x.Id).HasColumnName("RESULTID");
                b.Property(x => x.AssignmentId).HasColumnName("ASSIGNMENTID");
                b.Property(x => x.ScoreGvhd).HasColumnName("SCORE_GVHD").HasColumnType("NUMBER(5,2)");
                b.Property(x => x.ScoreCt).HasColumnName("SCORE_CT").HasColumnType("NUMBER(5,2)");
                b.Property(x => x.ScoreUvtk).HasColumnName("SCORE_UVTK").HasColumnType("NUMBER(5,2)");
                b.Property(x => x.ScoreUvpb).HasColumnName("SCORE_UVPB").HasColumnType("NUMBER(5,2)");
                b.Property(x => x.FinalScoreNumeric).HasColumnName("FINALSCORE_NUMERIC").HasColumnType("NUMBER(5,2)");
                b.Property(x => x.FinalScoreText).HasColumnName("FINALSCORE_TEXT").HasMaxLength(100);
                b.Property(x => x.IsPassed).HasColumnName("IS_PASSED").HasConversion<int?>();
                b.Property(x => x.IsLocked).HasColumnName("ISLOCKED").HasConversion<int>().HasDefaultValue(0);
                b.Property(x => x.CreatedAt).HasColumnName("CREATEDAT").HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.LastUpdated).HasColumnName("LASTUPDATED").HasDefaultValueSql("SYSTIMESTAMP");
                b.HasIndex(x => x.AssignmentId).IsUnique();
                b.HasOne(x => x.Assignment).WithMany().HasForeignKey(x => x.AssignmentId).OnDelete(DeleteBehavior.Cascade);
            });

            // DefenseRevisions
            modelBuilder.Entity<DefenseRevision>(b =>
            {
                b.ToTable("DEFENSE_REVISIONS");
                b.HasKey(x => x.Id);
                b.Property(x => x.Id).HasColumnName("REVISIONID");
                b.Property(x => x.AssignmentId).HasColumnName("ASSIGNMENTID");
                b.Property(x => x.RequiredRevisionContent).HasColumnName("REQUIRED_REVISION_CONTENT").HasColumnType("NCLOB");
                b.Property(x => x.RevisionReason).HasColumnName("REVISION_REASON").HasMaxLength(500);
                b.Property(x => x.SubmissionDeadline).HasColumnName("SUBMISSION_DEADLINE");
                b.Property(x => x.RevisedContent).HasColumnName("REVISEDCONTENT").HasColumnType("NCLOB");
                b.Property(x => x.RevisionFileUrl).HasColumnName("REVISIONFILEURL").HasMaxLength(500);
                b.Property(x => x.SubmissionCount).HasColumnName("SUBMISSION_COUNT").HasDefaultValue(1);
                b.Property(x => x.Status)
                    .HasColumnName("REVISION_STATUS")
                    .HasConversion<string>()
                    .HasMaxLength(50)
                    .HasDefaultValue(RevisionStatus.WaitingStudent);
                b.Property(x => x.SecretaryComment).HasColumnName("SECRETARY_COMMENT").HasColumnType("NCLOB");
                b.Property(x => x.SecretaryUserCode).HasColumnName("SECRETARY_USER_CODE").HasMaxLength(50);
                b.Property(x => x.SecretaryApprovedAt).HasColumnName("SECRETARY_APPROVED_AT");
                b.Property(x => x.IsGvhdApproved).HasColumnName("IS_GVHD_APPROVED").HasConversion<int>().HasDefaultValue(0);
                b.Property(x => x.IsUvtkApproved).HasColumnName("IS_UVTK_APPROVED").HasConversion<int>().HasDefaultValue(0);
                b.Property(x => x.IsCtApproved).HasColumnName("IS_CT_APPROVED").HasConversion<int>().HasDefaultValue(0);
                b.Property(x => x.FinalStatus)
                    .HasColumnName("FINALSTATUS")
                    .HasConversion<string?>()
                    .HasMaxLength(50);
                b.Property(x => x.CreatedAt).HasColumnName("CREATEDAT").HasDefaultValueSql("SYSTIMESTAMP");
                b.Property(x => x.LastUpdated).HasColumnName("LASTUPDATED").HasDefaultValueSql("SYSTIMESTAMP");
                b.HasIndex(x => x.AssignmentId).IsUnique();
                b.HasOne(x => x.Assignment).WithMany().HasForeignKey(x => x.AssignmentId).OnDelete(DeleteBehavior.Cascade);
            });

            // DefenseDocuments
            modelBuilder.Entity<DefenseDocument>(b =>
            {
                b.ToTable("DEFENSE_DOCUMENTS");
                b.HasKey(x => x.DocumentId);
                b.Property(x => x.DocumentId).HasColumnName("DOCUMENTID");
                b.Property(x => x.AssignmentId).HasColumnName("ASSIGNMENTID");
                b.Property(x => x.DocumentType).HasColumnName("DOCUMENTTYPE").HasMaxLength(50).IsRequired();
                b.Property(x => x.FileUrl).HasColumnName("FILEURL").HasMaxLength(500).IsRequired();
                b.Property(x => x.GeneratedAt).HasColumnName("GENERATEDAT").HasDefaultValueSql("SYSTIMESTAMP");
                b.HasOne(x => x.Assignment).WithMany().HasForeignKey(x => x.AssignmentId).OnDelete(DeleteBehavior.Cascade);
            });

            // Specialties - DELETED
            // LecturerSpecialties - DELETED
            // CatalogTopicSpecialties - DELETED

            // TopicLecturers (Many-to-Many)
            modelBuilder.Entity<TopicLecturer>(b =>
            {
                b.HasKey(x => new { x.TopicID, x.LecturerProfileID });
                // Topic navigation removed to prevent shadow properties
                // b.HasOne(x => x.Topic).WithMany().HasForeignKey(x => x.TopicID);
                b.HasOne(x => x.LecturerProfile).WithMany(x => x.TopicLecturers).HasForeignKey(x => x.LecturerProfileID);
                b.Property(x => x.IsPrimary).HasConversion<int>().HasDefaultValue(0);
                b.Property(x => x.CreatedAt).HasDefaultValueSql("SYSTIMESTAMP");
            });

            // Tags
            modelBuilder.Entity<Tag>(b =>
            {
                b.HasKey(x => x.TagID);
                b.Property(x => x.TagCode).HasMaxLength(40).IsRequired();
                b.HasIndex(x => x.TagCode).IsUnique();
                b.Property(x => x.TagName).HasMaxLength(100).IsRequired();
                b.Property(x => x.Description).HasMaxLength(500);
                b.Property(x => x.CreatedAt).HasDefaultValueSql("SYSTIMESTAMP");
            });

            // CatalogTopicTags (Many-to-Many)
            modelBuilder.Entity<CatalogTopicTag>(b =>
            {
                b.HasKey(x => new { x.CatalogTopicID, x.TagID });
                b.HasOne(x => x.CatalogTopic).WithMany(x => x.CatalogTopicTags).HasForeignKey(x => x.CatalogTopicID);
                b.HasOne(x => x.Tag).WithMany(x => x.CatalogTopicTags).HasForeignKey(x => x.TagID);
                b.Property(x => x.CreatedAt).HasDefaultValueSql("SYSTIMESTAMP");
            });

            // TopicTags - handles both CatalogTopic and Topic tags
            modelBuilder.Entity<TopicTag>(b =>
            {
                b.HasKey(x => x.TopicTagID);
                b.HasOne(x => x.CatalogTopic).WithMany().HasForeignKey(x => x.CatalogTopicCode).HasPrincipalKey(x => x.CatalogTopicCode).IsRequired(false);
                // Topic navigation removed to prevent shadow properties
                // b.HasOne(x => x.Topic).WithMany().HasForeignKey(x => x.TopicCode).HasPrincipalKey(x => x.TopicCode);
                b.Property(x => x.TagID).IsRequired();
                b.Property(x => x.TagCode).HasMaxLength(50);
                b.HasOne(x => x.Tag)
                    .WithMany(x => x.TopicTags)
                    .HasForeignKey(x => x.TagID)
                    .OnDelete(DeleteBehavior.Cascade);
                b.Property(x => x.CreatedAt).HasDefaultValueSql("SYSTIMESTAMP");
            });

            // LecturerTags
            modelBuilder.Entity<LecturerTag>(b =>
            {
                b.HasKey(x => x.LecturerTagID);
                // Use the explicit navigation collection on LecturerProfile to avoid EF creating a shadow FK (LecturerProfileID1)
                b.HasOne(x => x.LecturerProfile).WithMany(lp => lp.LecturerTags).HasForeignKey(x => x.LecturerProfileID).OnDelete(DeleteBehavior.Cascade);
                // Map Tag relationship explicitly to Tag.LecturerTags to avoid shadow FK creation
                b.HasOne(x => x.Tag).WithMany(t => t.LecturerTags).HasForeignKey(x => x.TagID).OnDelete(DeleteBehavior.Cascade);
                b.HasOne(x => x.AssignedByUser).WithMany().HasForeignKey(x => x.AssignedByUserCode).HasPrincipalKey(x => x.UserCode).OnDelete(DeleteBehavior.SetNull);

                b.Property(x => x.LecturerCode).HasMaxLength(40);
                b.Property(x => x.TagCode).HasMaxLength(40);
                b.Property(x => x.AssignedByUserCode).HasMaxLength(40);
                b.Property(x => x.AssignedAt).HasDefaultValueSql("SYSTIMESTAMP");

                // Unique constraint: one lecturer can only have one assignment of the same tag
                b.HasIndex(x => new { x.LecturerProfileID, x.TagID }).IsUnique();
            });

            // SystemActivityLog
            modelBuilder.Entity<SystemActivityLog>(b =>
            {
                b.ToTable("SYSTEMACTIVITYLOGS");
                b.HasKey(x => x.LogID);
                b.Property(x => x.EntityName).HasMaxLength(100);
                b.Property(x => x.EntityID).HasMaxLength(60);
                b.Property(x => x.ActionType).HasMaxLength(30).IsRequired();
                b.Property(x => x.UserCode).HasMaxLength(40);
                b.Property(x => x.UserRole).HasMaxLength(30);
                b.Property(x => x.IPAddress).HasMaxLength(45);
                b.Property(x => x.DeviceInfo).HasMaxLength(255);
                b.Property(x => x.Module).HasMaxLength(100);
                b.Property(x => x.Status).HasMaxLength(30);
                b.Property(x => x.RelatedRecordCode).HasMaxLength(60);
                b.Property(x => x.PerformedAt).HasDefaultValueSql("SYSTIMESTAMP");
                
                // Optional foreign key to User
                b.HasOne(x => x.User)
                    .WithMany()
                    .HasForeignKey(x => x.UserID)
                    .OnDelete(DeleteBehavior.SetNull);

                // Indexes for performance
                b.HasIndex(x => x.EntityName);
                b.HasIndex(x => x.ActionType);
                b.HasIndex(x => x.UserCode);
                b.HasIndex(x => x.PerformedAt);
                b.HasIndex(x => x.Module);
            });

            // Notifications
            modelBuilder.Entity<Notification>(b =>
            {
                b.ToTable("NOTIFICATIONS", tb =>
                {
                    tb.HasTrigger("TRG_NOTIFICATIONS_BI");
                });

                b.HasKey(x => x.NotificationID);

                b.Property(x => x.NotificationID).HasColumnName("NOTIFICATION_ID");
                b.Property(x => x.NotificationCode).HasColumnName("NOTIFICATION_CODE").HasMaxLength(60).IsRequired();
                b.HasIndex(x => x.NotificationCode).HasDatabaseName("UQ_NOTIFICATIONS_CODE").IsUnique();
                b.Property(x => x.NotifChannel).HasColumnName("NOTIF_CHANNEL").HasMaxLength(20).IsRequired();
                b.Property(x => x.NotifCategory).HasColumnName("NOTIF_CATEGORY").HasMaxLength(40).IsRequired();
                b.Property(x => x.NotifTitle).HasColumnName("NOTIF_TITLE").HasMaxLength(255).IsRequired();
                b.Property(x => x.NotifBody).HasColumnName("NOTIF_BODY").IsRequired();
                b.Property(x => x.NotifPriority).HasColumnName("NOTIF_PRIORITY").HasMaxLength(20).IsRequired();
                b.Property(x => x.ActionType).HasColumnName("ACTION_TYPE").HasMaxLength(30);
                b.Property(x => x.ActionUrl).HasColumnName("ACTION_URL").HasMaxLength(500);
                b.Property(x => x.ImageUrl).HasColumnName("IMAGE_URL").HasMaxLength(500);
                b.Property(x => x.RelatedEntityName).HasColumnName("RELATED_ENTITY_NAME").HasMaxLength(100);
                b.Property(x => x.RelatedEntityCode).HasColumnName("RELATED_ENTITY_CODE").HasMaxLength(60);
                b.Property(x => x.RelatedEntityID).HasColumnName("RELATED_ENTITY_ID");
                b.Property(x => x.TriggeredByUserID).HasColumnName("TRIGGERED_BY_USER_ID");
                b.Property(x => x.TriggeredByUserCode).HasColumnName("TRIGGERED_BY_USER_CODE").HasMaxLength(40);
                b.Property(x => x.IsGlobal).HasColumnName("IS_GLOBAL").HasDefaultValue(0).IsRequired();
                b.Property(x => x.ScheduleAt).HasColumnName("SCHEDULE_AT");
                b.Property(x => x.ExpiresAt).HasColumnName("EXPIRES_AT");
                b.Property(x => x.CreatedAt).HasColumnName("CREATED_AT").HasDefaultValueSql("SYSTIMESTAMP").IsRequired();
                b.Property(x => x.UpdatedAt).HasColumnName("UPDATED_AT");

                b.HasIndex(x => new { x.NotifCategory, x.CreatedAt }).HasDatabaseName("IX_NOTIFICATIONS_CATEGORY_CREATED_AT");
            });

            modelBuilder.Entity<NotificationRecipient>(b =>
            {
                b.ToTable("NOTIFICATION_RECIPIENTS", tb =>
                {
                    tb.HasTrigger("TRG_NOTIF_RECIPIENTS_BI");
                });

                b.HasKey(x => x.RecipientID);

                b.Property(x => x.RecipientID).HasColumnName("RECIPIENT_ID");
                b.Property(x => x.NotificationID).HasColumnName("NOTIFICATION_ID").IsRequired();
                b.Property(x => x.TargetUserID).HasColumnName("TARGET_USER_ID").IsRequired();
                b.Property(x => x.TargetUserCode).HasColumnName("TARGET_USER_CODE").HasMaxLength(40).IsRequired();
                b.Property(x => x.DeliveryState).HasColumnName("DELIVERY_STATE").HasMaxLength(20).HasDefaultValue("PENDING").IsRequired();
                b.Property(x => x.IsRead).HasColumnName("IS_READ").HasDefaultValue(0).IsRequired();
                b.Property(x => x.ReadAt).HasColumnName("READ_AT");
                b.Property(x => x.SeenAt).HasColumnName("SEEN_AT");
                b.Property(x => x.DismissedAt).HasColumnName("DISMISSED_AT");
                b.Property(x => x.DeliveredAt).HasColumnName("DELIVERED_AT");
                b.Property(x => x.ErrorMessage).HasColumnName("ERROR_MESSAGE").HasMaxLength(1000);
                b.Property(x => x.CreatedAt).HasColumnName("CREATED_AT").HasDefaultValueSql("SYSTIMESTAMP").IsRequired();
                b.Property(x => x.UpdatedAt).HasColumnName("UPDATED_AT");

                b.HasOne(x => x.Notification)
                    .WithMany(x => x.Recipients)
                    .HasForeignKey(x => x.NotificationID)
                    .HasConstraintName("FK_NOTIF_RECIPIENTS_NOTIFICATION")
                    .OnDelete(DeleteBehavior.Cascade);

                b.HasOne(x => x.TargetUser)
                    .WithMany()
                    .HasForeignKey(x => x.TargetUserID)
                    .OnDelete(DeleteBehavior.Cascade);

                b.HasIndex(x => new { x.NotificationID, x.TargetUserID }).HasDatabaseName("UQ_NOTIF_RECIPIENTS").IsUnique();
                b.HasIndex(x => new { x.TargetUserID, x.IsRead, x.CreatedAt }).HasDatabaseName("IX_NOTIF_RECIPIENTS_USER_UNREAD");
                b.HasIndex(x => new { x.TargetUserCode, x.IsRead, x.CreatedAt }).HasDatabaseName("IX_NOTIF_RECIPIENTS_USERCODE_UNREAD");
                b.HasIndex(x => x.DeliveryState).HasDatabaseName("IX_NOTIF_RECIPIENTS_STATE");
            });

            modelBuilder.Entity<NotificationPreference>(b =>
            {
                b.ToTable("NOTIFICATION_PREFERENCES", tb =>
                {
                    tb.HasTrigger("TRG_NOTIF_PREF_BI");
                });

                b.HasKey(x => x.PreferenceID);

                b.Property(x => x.PreferenceID).HasColumnName("PREFERENCE_ID");
                b.Property(x => x.TargetUserID).HasColumnName("TARGET_USER_ID").IsRequired();
                b.Property(x => x.TargetUserCode).HasColumnName("TARGET_USER_CODE").HasMaxLength(40).IsRequired();
                b.Property(x => x.NotifCategory).HasColumnName("NOTIF_CATEGORY").HasMaxLength(40).IsRequired();
                b.Property(x => x.InAppEnabled).HasColumnName("IN_APP_ENABLED").HasDefaultValue(1).IsRequired();
                b.Property(x => x.EmailEnabled).HasColumnName("EMAIL_ENABLED").HasDefaultValue(0).IsRequired();
                b.Property(x => x.PushEnabled).HasColumnName("PUSH_ENABLED").HasDefaultValue(0).IsRequired();
                b.Property(x => x.DigestMode).HasColumnName("DIGEST_MODE").HasMaxLength(20).HasDefaultValue("IMMEDIATE").IsRequired();
                b.Property(x => x.QuietFrom).HasColumnName("QUIET_FROM").HasMaxLength(5);
                b.Property(x => x.QuietTo).HasColumnName("QUIET_TO").HasMaxLength(5);
                b.Property(x => x.UpdatedAt).HasColumnName("UPDATED_AT");

                b.HasOne(x => x.TargetUser)
                    .WithMany()
                    .HasForeignKey(x => x.TargetUserID)
                    .OnDelete(DeleteBehavior.Cascade);

                b.HasIndex(x => new { x.TargetUserID, x.NotifCategory }).HasDatabaseName("UQ_NOTIF_PREF_USER_CATEGORY").IsUnique();
                b.HasIndex(x => x.TargetUserID).HasDatabaseName("IX_NOTIF_PREF_USER");
            });

            modelBuilder.Entity<NotificationOutbox>(b =>
            {
                b.ToTable("NOTIFICATION_OUTBOX", tb =>
                {
                    tb.HasTrigger("TRG_NOTIFICATION_OUTBOX_BI");
                });

                b.HasKey(x => x.OutboxID);

                b.Property(x => x.OutboxID).HasColumnName("OUTBOX_ID");
                b.Property(x => x.EventType).HasColumnName("EVENT_TYPE").HasMaxLength(50).IsRequired();
                b.Property(x => x.PayloadJson).HasColumnName("PAYLOAD_JSON").IsRequired();
                b.Property(x => x.OutboxStatus).HasColumnName("OUTBOX_STATUS").HasMaxLength(20).HasDefaultValue("PENDING").IsRequired();
                b.Property(x => x.RetryCount).HasColumnName("RETRY_COUNT").HasDefaultValue(0).IsRequired();
                b.Property(x => x.NextRetryAt).HasColumnName("NEXT_RETRY_AT");
                b.Property(x => x.LastError).HasColumnName("LAST_ERROR").HasMaxLength(1000);
                b.Property(x => x.CreatedAt).HasColumnName("CREATED_AT").HasDefaultValueSql("SYSTIMESTAMP").IsRequired();
                b.Property(x => x.ProcessedAt).HasColumnName("PROCESSED_AT");

                b.HasIndex(x => new { x.OutboxStatus, x.CreatedAt }).HasDatabaseName("IX_NOTIF_OUTBOX_STATUS_CREATED_AT");
            });

            modelBuilder.Entity<LecturerDashboardView>(b =>
            {
                b.HasNoKey();
                b.ToView("V_LECTURER_DASHBOARD");

                b.Property(x => x.LecturerProfileID).HasColumnName("LECTURERPROFILEID");
                b.Property(x => x.LecturerCode).HasColumnName("LECTURERCODE");
                b.Property(x => x.FullName).HasColumnName("FULLNAME");
                b.Property(x => x.DepartmentCode).HasColumnName("DEPARTMENTCODE");
                b.Property(x => x.Degree).HasColumnName("DEGREE");
                b.Property(x => x.GuideQuota).HasColumnName("GUIDEQUOTA");
                b.Property(x => x.DefenseQuota).HasColumnName("DEFENSEQUOTA");
                b.Property(x => x.Email).HasColumnName("EMAIL");
                b.Property(x => x.PhoneNumber).HasColumnName("PHONENUMBER");
                b.Property(x => x.ProfileImage).HasColumnName("PROFILEIMAGE");
                b.Property(x => x.CurrentGuidingCount).HasColumnName("CURRENTGUIDINGCOUNT");
            });

            // AI Chatbot - Sessions
            modelBuilder.Entity<ChatSession>(b =>
            {
                b.ToTable("CHAT_SESSIONS", tb => { tb.HasTrigger("TRG_CHAT_SESSIONS_BI"); });
                b.HasKey(x => x.ChatSessionID);
                b.Property(x => x.ChatSessionID).HasColumnName("CHAT_SESSION_ID");
                b.Property(x => x.UserID).HasColumnName("USER_ID");
                b.Property(x => x.Title).HasColumnName("TITLE").HasMaxLength(200);
                b.Property(x => x.ModelName).HasColumnName("MODEL_NAME").HasMaxLength(50);
                b.Property(x => x.IsArchived).HasColumnName("IS_ARCHIVED").HasDefaultValue(0);
                b.Property(x => x.CreatedAt).HasColumnName("CREATED_AT").HasDefaultValueSql("SYSTIMESTAMP");

                b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserID).OnDelete(DeleteBehavior.Cascade);
            });

            // AI Chatbot - Messages
            modelBuilder.Entity<ChatMessage>(b =>
            {
                b.ToTable("CHAT_MESSAGES", tb => { tb.HasTrigger("TRG_CHAT_MESSAGES_BI"); });
                b.HasKey(x => x.ChatMessageID);
                b.Property(x => x.ChatMessageID).HasColumnName("CHAT_MESSAGE_ID");
                b.Property(x => x.ChatSessionID).HasColumnName("CHAT_SESSION_ID");
                b.Property(x => x.Role).HasColumnName("ROLE").HasMaxLength(20).IsRequired();
                b.Property(x => x.Content).HasColumnName("CONTENT").IsRequired();
                b.Property(x => x.Feedback).HasColumnName("FEEDBACK").HasDefaultValue(0);
                b.Property(x => x.PromptTokens).HasColumnName("PROMPT_TOKENS").HasDefaultValue(0);
                b.Property(x => x.CompletionTokens).HasColumnName("COMPLETION_TOKENS").HasDefaultValue(0);
                b.Property(x => x.CreatedAt).HasColumnName("CREATED_AT").HasDefaultValueSql("SYSTIMESTAMP");

                b.HasOne(x => x.Session).WithMany(x => x.Messages).HasForeignKey(x => x.ChatSessionID).OnDelete(DeleteBehavior.Cascade);
            });

            // TopicWorkflowAudit
            modelBuilder.Entity<TopicWorkflowAudit>(b =>
            {
                b.ToTable("TOPIC_WORKFLOW_AUDITS");
                b.HasKey(x => x.AuditID);

                b.Property(x => x.AuditID).HasColumnName("AUDIT_ID");
                b.Property(x => x.AuditCode).HasColumnName("AUDIT_CODE").HasMaxLength(50).IsRequired();
                b.HasIndex(x => x.AuditCode).IsUnique();

                b.Property(x => x.ModuleName).HasColumnName("MODULE_NAME").HasMaxLength(50).IsRequired();
                b.Property(x => x.WorkflowName).HasColumnName("WORKFLOW_NAME").HasMaxLength(100).IsRequired();
                b.Property(x => x.ActionType).HasColumnName("ACTION_TYPE").HasMaxLength(30).IsRequired();
                b.Property(x => x.DecisionAction).HasColumnName("DECISION_ACTION").HasMaxLength(30);

                b.Property(x => x.TopicID).HasColumnName("TOPIC_ID");
                b.Property(x => x.TopicCode).HasColumnName("TOPIC_CODE").HasMaxLength(60);
                b.Property(x => x.EntityName).HasColumnName("ENTITY_NAME").HasMaxLength(100);
                b.Property(x => x.EntityID).HasColumnName("ENTITY_ID").HasMaxLength(60);
                b.Property(x => x.EntityCode).HasColumnName("ENTITY_CODE").HasMaxLength(60);

                b.Property(x => x.OldStatus).HasColumnName("OLD_STATUS").HasMaxLength(50);
                b.Property(x => x.NewStatus).HasColumnName("NEW_STATUS").HasMaxLength(50);
                b.Property(x => x.StatusCode).HasColumnName("STATUS_CODE").HasMaxLength(30);

                b.Property(x => x.ResubmitCountBefore).HasColumnName("RESUBMIT_COUNT_BEFORE");
                b.Property(x => x.ResubmitCountAfter).HasColumnName("RESUBMIT_COUNT_AFTER");

                b.Property(x => x.CommentText).HasColumnName("COMMENT_TEXT");
                b.Property(x => x.ErrorMessage).HasColumnName("ERROR_MESSAGE");
                b.Property(x => x.IsSuccess).HasColumnName("IS_SUCCESS").HasDefaultValue(1).IsRequired();

                b.Property(x => x.RequestPayload).HasColumnName("REQUEST_PAYLOAD");
                b.Property(x => x.ResponsePayload).HasColumnName("RESPONSE_PAYLOAD");

                b.Property(x => x.ChangedFields).HasColumnName("CHANGED_FIELDS");
                b.Property(x => x.TagsBefore).HasColumnName("TAGS_BEFORE");
                b.Property(x => x.TagsAfter).HasColumnName("TAGS_AFTER");
                b.Property(x => x.MilestoneBefore).HasColumnName("MILESTONE_BEFORE");
                b.Property(x => x.MilestoneAfter).HasColumnName("MILESTONE_AFTER");

                b.Property(x => x.ActorUserID).HasColumnName("ACTOR_USER_ID");
                b.Property(x => x.ActorUserCode).HasColumnName("ACTOR_USER_CODE").HasMaxLength(60);
                b.Property(x => x.ActorRole).HasColumnName("ACTOR_ROLE").HasMaxLength(40);
                b.Property(x => x.ReviewerUserID).HasColumnName("REVIEWER_USER_ID");
                b.Property(x => x.ReviewerUserCode).HasColumnName("REVIEWER_USER_CODE").HasMaxLength(60);

                b.Property(x => x.CorrelationID).HasColumnName("CORRELATION_ID").HasMaxLength(100);
                b.Property(x => x.IdempotencyKey).HasColumnName("IDEMPOTENCY_KEY").HasMaxLength(100);
                b.Property(x => x.RequestID).HasColumnName("REQUEST_ID").HasMaxLength(100);

                b.Property(x => x.IPAddress).HasColumnName("IP_ADDRESS").HasMaxLength(64);
                b.Property(x => x.UserAgent).HasColumnName("USER_AGENT").HasMaxLength(500);
                b.Property(x => x.DeviceInfo).HasColumnName("DEVICE_INFO").HasMaxLength(500);
                b.Property(x => x.CreatedAt).HasColumnName("CREATED_AT").HasDefaultValueSql("SYSTIMESTAMP");

                b.HasIndex(x => x.TopicID);
                b.HasIndex(x => x.TopicCode);
                b.HasIndex(x => x.ActionType);
                b.HasIndex(x => x.StatusCode);
                b.HasIndex(x => x.ActorUserCode);
                b.HasIndex(x => x.CreatedAt);
                b.HasIndex(x => x.CorrelationID);
            });

            ApplyOracleIdentifierNamingRules(modelBuilder);
        }

        private static void ApplyOracleIdentifierNamingRules(ModelBuilder modelBuilder)
        {
            var preserveExplicitMappingTables = new HashSet<string>(StringComparer.Ordinal)
            {
                "IDEMPOTENCY_RECORDS",
                "EVALUATION_REVIEWS",
                "DEFENSE_MINUTES",
                "DEFENSE_RESULTS",
                "DEFENSE_REVISIONS",
                "DEFENSE_DOCUMENTS",
                "NOTIFICATIONS",
                "NOTIFICATION_RECIPIENTS",
                "NOTIFICATION_PREFERENCES",
                "NOTIFICATION_OUTBOX",
                "TOPIC_WORKFLOW_AUDITS",
                "COHORTS",
                "ROOMS",
                "CLASSES",
                "CHAT_SESSIONS",
                "CHAT_MESSAGES"
            };

            var keepPascalCaseColumns = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal)
            {
                ["MILESTONETEMPLATES"] = new HashSet<string>(StringComparer.Ordinal) { "Ordinal" },
                ["DEFENSESCORES"] = new HashSet<string>(StringComparer.Ordinal) { "Comment" },
                ["Users"] = new HashSet<string>(StringComparer.Ordinal) { "Role" },
                ["TOPICS"] = new HashSet<string>(StringComparer.Ordinal) { "Type" },
                ["SYSTEMACTIVITYLOGS"] = new HashSet<string>(StringComparer.Ordinal) { "Comment" },
                ["PROGRESSMILESTONES"] = new HashSet<string>(StringComparer.Ordinal) { "Ordinal" },
                ["PROGRESSSUBMISSIONS"] = new HashSet<string>(StringComparer.Ordinal) { "Ordinal" }
            };

            foreach (var entityType in modelBuilder.Model.GetEntityTypes())
            {
                var tableName = entityType.GetTableName();
                if (string.IsNullOrWhiteSpace(tableName))
                {
                    continue;
                }

                var normalizedTableName = string.Equals(tableName, "Users", StringComparison.OrdinalIgnoreCase)
                    ? "Users"
                    : tableName.ToUpperInvariant();

                entityType.SetTableName(normalizedTableName);

                // Keep explicit column mappings for special tables using snake_case names.
                if (preserveExplicitMappingTables.Contains(normalizedTableName))
                {
                    continue;
                }

                foreach (var property in entityType.GetProperties())
                {
                    // Skip properties that have an explicit [Column] attribute mapping
                    if (property.PropertyInfo?.GetCustomAttribute<ColumnAttribute>() != null)
                    {
                        continue;
                    }

                    if (normalizedTableName == "DEFENSEASSIGNMENTS"
                        && string.Equals(property.Name, nameof(DefenseAssignment.Session), StringComparison.Ordinal))
                    {
                        property.SetColumnName("SHIFT");
                        continue;
                    }

                    var keepPascalCase = keepPascalCaseColumns.TryGetValue(normalizedTableName, out var columns)
                                        && columns.Contains(property.Name);

                    property.SetColumnName(keepPascalCase ? property.Name : property.Name.ToUpperInvariant());
                }
            }
        }

        private static string? FormatSessionValue(int? value)
        {
            if (!value.HasValue)
            {
                return null;
            }

            return value.Value == 2 ? "AFTERNOON" : "MORNING";
        }

        private static int? ParseSessionValue(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            var normalized = value.Trim().ToUpperInvariant();
            if (normalized.Contains("AFTERNOON", StringComparison.Ordinal)
                || normalized.Contains("CHIEU", StringComparison.Ordinal)
                || normalized == "PM")
            {
                return 2;
            }

            if (normalized.Contains("MORNING", StringComparison.Ordinal)
                || normalized.Contains("SANG", StringComparison.Ordinal)
                || normalized == "AM")
            {
                return 1;
            }

            var digits = new string(normalized.Where(char.IsDigit).ToArray());
            if (string.IsNullOrEmpty(digits))
            {
                return null;
            }

            return int.TryParse(digits, out var parsed) ? parsed : null;
        }

        /// <summary>
        /// Override SaveChangesAsync để tự động ghi log các thao tác INSERT/UPDATE/DELETE
        /// </summary>
        public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            var logs = new List<SystemActivityLog>();

            // Lấy thông tin người dùng hiện tại
            var userId = _currentUserService?.GetUserId();
            var userCode = _currentUserService?.GetUserCode();
            var userRole = _currentUserService?.GetUserRole();
            var ipAddress = _currentUserService?.GetIpAddress();
            var deviceInfo = _currentUserService?.GetDeviceInfo();
            var traceIdentifier = _httpContextAccessor?.HttpContext?.TraceIdentifier;
            var requestId = _httpContextAccessor?.HttpContext?.Request?.Headers["X-Request-ID"].FirstOrDefault();
            var idempotencyKey = _httpContextAccessor?.HttpContext?.Request?.Headers["Idempotency-Key"].FirstOrDefault();
            var requestPath = _httpContextAccessor?.HttpContext?.Request?.Path.Value;
            var requestMethod = _httpContextAccessor?.HttpContext?.Request?.Method;
            var userAgent = _httpContextAccessor?.HttpContext?.Request?.Headers["User-Agent"].FirstOrDefault();

            var actorTrace = new
            {
                UserId = userId,
                UserCode = userCode,
                UserRole = userRole,
                IPAddress = ipAddress,
                DeviceInfo = deviceInfo,
                TraceIdentifier = traceIdentifier,
                RequestId = requestId,
                IdempotencyKey = idempotencyKey,
                RequestPath = requestPath,
                RequestMethod = requestMethod,
                UserAgent = userAgent
            };

            // Lấy các entity đã thay đổi trước khi save
            var entries = ChangeTracker.Entries()
                .Where(e => e.State == EntityState.Added || 
                           e.State == EntityState.Modified || 
                           e.State == EntityState.Deleted)
                .Where(e => e.Entity.GetType() != typeof(SystemActivityLog)) // Không log chính bảng log
                .ToList();

            foreach (var entry in entries)
            {
                var entityName = entry.Entity.GetType().Name;
                var entityId = GetEntityId(entry);
                var module = GetModuleFromEntity(entityName);

                SystemActivityLog? log = null;

                switch (entry.State)
                {
                    case EntityState.Added:
                        // LOG INSERT - Ghi lại dữ liệu mới được tạo
                        log = new SystemActivityLog
                        {
                            EntityName = entityName,
                            EntityID = entityId,
                            ActionType = "CREATE",
                            ActionDescription = $"Tạo mới {GetFriendlyEntityName(entityName)}",
                            OldValue = null, // Không có dữ liệu cũ
                            NewValue = SerializeEntity(entry.CurrentValues.ToObject()), // Dữ liệu mới
                            Module = module,
                            Status = "PENDING" // Sẽ update thành SUCCESS sau khi save thành công
                        };
                        break;

                    case EntityState.Modified:
                        // LOG UPDATE - Ghi lại dữ liệu cũ và mới
                        var modifiedProperties = entry.Properties
                            .Where(p => p.IsModified)
                            .Select(p => p.Metadata.Name)
                            .ToList();

                        if (modifiedProperties.Any())
                        {
                            log = new SystemActivityLog
                            {
                                EntityName = entityName,
                                EntityID = entityId,
                                ActionType = "UPDATE",
                                ActionDescription = $"Cập nhật {GetFriendlyEntityName(entityName)} - Thay đổi: {string.Join(", ", modifiedProperties)}",
                                OldValue = SerializeEntity(entry.OriginalValues.ToObject()), // Snapshot đầy đủ trước thay đổi
                                NewValue = SerializeEntity(entry.CurrentValues.ToObject()), // Snapshot đầy đủ sau thay đổi
                                Module = module,
                                Status = "PENDING"
                            };
                        }
                        break;

                    case EntityState.Deleted:
                        // LOG DELETE - Ghi lại dữ liệu trước khi xóa
                        log = new SystemActivityLog
                        {
                            EntityName = entityName,
                            EntityID = entityId,
                            ActionType = "DELETE",
                            ActionDescription = $"Xóa {GetFriendlyEntityName(entityName)}",
                            OldValue = SerializeEntity(entry.OriginalValues.ToObject()), // Dữ liệu bị xóa
                            NewValue = null, // Không còn dữ liệu
                            Module = module,
                            Status = "PENDING"
                        };
                        break;
                }

                if (log != null)
                {
                    // Gắn thông tin người dùng
                    log.UserID = userId;
                    log.UserCode = userCode ?? "SYSTEM";
                    log.UserRole = userRole ?? "System";
                    log.IPAddress = ipAddress;
                    log.DeviceInfo = deviceInfo;
                    log.PerformedAt = DateTime.UtcNow;
                    log.Comment = JsonSerializer.Serialize(actorTrace);
                    log.RelatedRecordCode = !string.IsNullOrWhiteSpace(traceIdentifier)
                        ? traceIdentifier
                        : requestId;

                    logs.Add(log);
                }
            }

            // Thực hiện save changes
            int result;
            try
            {
                result = await base.SaveChangesAsync(cancellationToken);

                // Cập nhật status thành SUCCESS cho tất cả logs
                foreach (var log in logs)
                {
                    log.Status = "SUCCESS";
                }
            }
            catch (Exception ex)
            {
                // Cập nhật status thành FAILED nếu có lỗi
                foreach (var log in logs)
                {
                    log.Status = "FAILED";
                    log.Comment = $"Error: {ex.Message}";
                }
                
                // Re-throw exception sau khi đã log
                throw;
            }
            finally
            {
                // Thêm logs vào database (nếu có)
                if (logs.Any())
                {
                    await SystemActivityLogs.AddRangeAsync(logs, cancellationToken);
                    await base.SaveChangesAsync(cancellationToken);
                }
            }

            return result;
        }

        /// <summary>
        /// Lấy ID hoặc Code của entity để ghi log
        /// </summary>
        private string? GetEntityId(Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry entry)
        {
            var entity = entry.Entity;
            var type = entity.GetType();

            // Ưu tiên lấy các trường Code
            var codeProperty = type.GetProperty("TopicCode") ?? 
                             type.GetProperty("ConversationCode") ??
                             type.GetProperty("StudentCode") ?? 
                             type.GetProperty("LecturerCode") ??
                             type.GetProperty("UserCode") ??
                             type.GetProperty("DepartmentCode") ??
                             type.GetProperty("MilestoneCode") ??
                             type.GetProperty("SubmissionCode") ??
                             type.GetProperty("CommitteeCode") ??
                             type.GetProperty("TagCode");

            if (codeProperty != null)
            {
                return codeProperty.GetValue(entity)?.ToString();
            }

            // Fallback về ID
            var idProperty = type.GetProperty("TopicID") ?? 
                           type.GetProperty("ConversationID") ??
                           type.GetProperty("MessageID") ??
                           type.GetProperty("StudentProfileID") ?? 
                           type.GetProperty("LecturerProfileID") ??
                           type.GetProperty("UserID") ??
                           type.GetProperty("DepartmentID") ??
                           type.GetProperty("MilestoneID") ??
                           type.GetProperty("SubmissionID") ??
                           type.GetProperty("CommitteeID");

            return idProperty?.GetValue(entity)?.ToString();
        }

        /// <summary>
        /// Chuyển entity thành JSON string (loại bỏ navigation properties để tránh circular reference)
        /// </summary>
        private string? SerializeEntity(object? entity)
        {
            if (entity == null) return null;

            try
            {
                var options = new JsonSerializerOptions
                {
                    ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles,
                    WriteIndented = false,
                    MaxDepth = 3 // Giới hạn độ sâu để tránh circular reference
                };
                return JsonSerializer.Serialize(entity, options);
            }
            catch
            {
                return entity.ToString();
            }
        }

        /// <summary>
        /// Xác định module dựa trên tên entity
        /// </summary>
        private string GetModuleFromEntity(string entityName)
        {
            return entityName switch
            {
                "User" or "StudentProfile" or "LecturerProfile" => "User",
                "Topic" or "CatalogTopic" or "TopicLecturer" or "TopicTag" => "Topic",
                "ProgressMilestone" or "ProgressSubmission" or "MilestoneTemplate" => "Milestone",
                "Committee" or "CommitteeMember" or "CommitteeSession" or "CommitteeTag" => "Committee",
                "DefenseAssignment" or "DefenseScore" => "Defense",
                "SubmissionFile" => "Submission",
                "Conversation" or "ConversationMember" or "Message" or "MessageAttachment" or "MessageReaction" or "MessageReadReceipt" => "Chat",
                "Department" => "Department",
                "Tag" or "CatalogTopicTag" or "LecturerTag" => "Catalog",
                _ => "System"
            };
        }

        /// <summary>
        /// Chuyển tên entity sang tiếng Việt để dễ đọc
        /// </summary>
        private string GetFriendlyEntityName(string entityName)
        {
            return entityName switch
            {
                "User" => "người dùng",
                "StudentProfile" => "hồ sơ sinh viên",
                "LecturerProfile" => "hồ sơ giảng viên",
                "Topic" => "đề tài",
                "CatalogTopic" => "danh mục đề tài",
                "ProgressMilestone" => "tiến độ",
                "ProgressSubmission" => "bài nộp",
                "Committee" => "hội đồng",
                "CommitteeMember" => "thành viên hội đồng",
                "DefenseAssignment" => "phân công đồ án tốt nghiệp",
                "DefenseScore" => "điểm đồ án tốt nghiệp",
                "Conversation" => "cuộc trò chuyện",
                "ConversationMember" => "thành viên cuộc trò chuyện",
                "Message" => "tin nhắn",
                "MessageAttachment" => "tệp đính kèm tin nhắn",
                "MessageReaction" => "cảm xúc tin nhắn",
                "MessageReadReceipt" => "trạng thái đã đọc",
                "Department" => "khoa",
                "Tag" => "tag",
                _ => entityName.ToLower()
            };
        }
    }
}

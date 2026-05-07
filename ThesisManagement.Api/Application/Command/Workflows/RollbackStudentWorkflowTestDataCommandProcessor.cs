using Microsoft.EntityFrameworkCore;
using ThesisManagement.Api.Application.Common;
using ThesisManagement.Api.Data;
using ThesisManagement.Api.DTOs.Workflows.Query;
using ThesisManagement.Api.Models;
using ThesisManagement.Api.Services;

namespace ThesisManagement.Api.Application.Command.Workflows
{
    public interface IRollbackStudentWorkflowTestDataCommandProcessor
    {
        Task<OperationResult<TopicWorkflowRollbackResultDto>> ExecuteAsync(string? topicCode = null);
    }

    public class RollbackStudentWorkflowTestDataCommandProcessor : IRollbackStudentWorkflowTestDataCommandProcessor
    {
        private readonly ApplicationDbContext _db;
        private readonly ICurrentUserService _currentUserService;

        public RollbackStudentWorkflowTestDataCommandProcessor(
            ApplicationDbContext db,
            ICurrentUserService currentUserService)
        {
            _db = db;
            _currentUserService = currentUserService;
        }

        public async Task<OperationResult<TopicWorkflowRollbackResultDto>> ExecuteAsync(string? topicCode = null)
        {
            var actorUserCode = _currentUserService.GetUserCode();
            var actorUserId = _currentUserService.GetUserId();

            if (string.IsNullOrWhiteSpace(actorUserCode) && !actorUserId.HasValue)
                return OperationResult<TopicWorkflowRollbackResultDto>.Failed("Unauthorized", 401);

            var userRole = _currentUserService.GetUserRole();
            var isAdmin = userRole == "Admin" || userRole == "StudentService";

            IQueryable<Topic> query = _db.Topics;

            // Nếu không phải Admin, hoặc là Admin nhưng không truyền TopicCode (muốn xóa sạch của mình)
            // thì chỉ được phép tác động lên dữ liệu của chính mình.
            if (!isAdmin || string.IsNullOrWhiteSpace(topicCode))
            {
                query = query.Where(x =>
                    (!string.IsNullOrWhiteSpace(actorUserCode) && x.ProposerUserCode == actorUserCode) ||
                    (actorUserId.HasValue && x.ProposerUserID == actorUserId.Value));
            }

            if (!string.IsNullOrWhiteSpace(topicCode))
            {
                var normalizedTopicCode = topicCode.Trim();
                query = query.Where(x => EF.Functions.Like(x.TopicCode, normalizedTopicCode));
            }

            var topics = await query.ToListAsync();

            if (!string.IsNullOrWhiteSpace(topicCode) && topics.Count == 0)
            {
                return OperationResult<TopicWorkflowRollbackResultDto>.Failed("Topic not found or you don't have permission to rollback it", 404);
            }

            var topicIds = topics.Select(x => x.TopicID).ToList();
            var topicCodes = topics
                .Select(x => x.TopicCode)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            await using var tx = await _db.Database.BeginTransactionAsync();
            try
            {
                // 1. Progress & Submissions
                var progressMilestones = topicIds.Count == 0
                    ? new List<ProgressMilestone>()
                    : await _db.ProgressMilestones.Where(x => topicIds.Contains(x.TopicID)).ToListAsync();
                
                var milestoneIds = progressMilestones.Select(x => x.MilestoneID).ToList();
                var submissions = milestoneIds.Count == 0
                    ? new List<ProgressSubmission>()
                    : await _db.ProgressSubmissions.Where(x => x.MilestoneID.HasValue && milestoneIds.Contains(x.MilestoneID.Value)).ToListAsync();
                
                var submissionIds = submissions.Select(x => x.SubmissionID).ToList();
                var submissionFiles = submissionIds.Count == 0
                    ? new List<SubmissionFile>()
                    : await _db.SubmissionFiles.Where(x => submissionIds.Contains(x.SubmissionID)).ToListAsync();

                // 2. Workflow Audits
                var workflowAudits = topicIds.Count == 0
                    ? new List<TopicWorkflowAudit>()
                    : await _db.TopicWorkflowAudits.Where(x => x.TopicID.HasValue && topicIds.Contains(x.TopicID.Value)).ToListAsync();

                // 3. Rename Requests & History
                var renameRequests = topicIds.Count == 0
                    ? new List<TopicRenameRequest>()
                    : await _db.TopicRenameRequests.Where(x => x.TopicId.HasValue && topicIds.Contains(x.TopicId.Value)).ToListAsync();
                
                var renameRequestIds = renameRequests.Select(x => x.RequestId).ToList();
                var renameFiles = renameRequestIds.Count == 0
                    ? new List<TopicRenameRequestFile>()
                    : await _db.TopicRenameRequestFiles.Where(x => renameRequestIds.Contains(x.RequestId)).ToListAsync();

                var titleHistories = topicIds.Count == 0
                    ? new List<TopicTitleHistory>()
                    : await _db.TopicTitleHistories.Where(x => x.TopicId.HasValue && topicIds.Contains(x.TopicId.Value)).ToListAsync();

                // 4. Lecturers & Tags
                var topicLecturers = topicIds.Count == 0 && topicCodes.Count == 0
                    ? new List<TopicLecturer>()
                    : await _db.TopicLecturers
                        .Where(x =>
                            (topicIds.Count > 0 && topicIds.Contains(x.TopicID)) ||
                            (topicCodes.Count > 0 && x.TopicCode != null && topicCodes.Contains(x.TopicCode)))
                        .ToListAsync();

                var topicTags = topicCodes.Count == 0
                    ? new List<TopicTag>()
                    : await _db.TopicTags
                        .Where(x => x.TopicCode != null && topicCodes.Contains(x.TopicCode))
                        .ToListAsync();

                // 5. Conversations & Messages
                var directConversationCodes = topicCodes
                    .Select(code => BuildConversationCode("DIR", code))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                var directConversations = directConversationCodes.Count == 0
                    ? new List<Conversation>()
                    : await _db.Conversations
                        .Where(x => x.ConversationType == "Direct" && x.ConversationCode != null && directConversationCodes.Contains(x.ConversationCode))
                        .ToListAsync();

                var directConversationIds = directConversations.Select(x => x.ConversationID).ToList();
                
                var messages = directConversationIds.Count == 0
                    ? new List<Message>()
                    : await _db.Messages.Where(x => directConversationIds.Contains(x.ConversationID)).ToListAsync();

                var conversationMembers = directConversationIds.Count == 0
                    ? new List<ConversationMember>()
                    : await _db.ConversationMembers
                        .Where(x => directConversationIds.Contains(x.ConversationID))
                        .ToListAsync();

                // EXECUTE REMOVAL (Child to Parent order)
                if (workflowAudits.Count > 0) _db.TopicWorkflowAudits.RemoveRange(workflowAudits);
                if (submissionFiles.Count > 0) _db.SubmissionFiles.RemoveRange(submissionFiles);
                if (submissions.Count > 0) _db.ProgressSubmissions.RemoveRange(submissions);
                if (progressMilestones.Count > 0) _db.ProgressMilestones.RemoveRange(progressMilestones);
                
                if (renameFiles.Count > 0) _db.TopicRenameRequestFiles.RemoveRange(renameFiles);
                if (renameRequests.Count > 0) _db.TopicRenameRequests.RemoveRange(renameRequests);
                if (titleHistories.Count > 0) _db.TopicTitleHistories.RemoveRange(titleHistories);
                
                if (topicLecturers.Count > 0) _db.TopicLecturers.RemoveRange(topicLecturers);
                if (topicTags.Count > 0) _db.TopicTags.RemoveRange(topicTags);
                
                if (messages.Count > 0) _db.Messages.RemoveRange(messages);
                if (conversationMembers.Count > 0) _db.ConversationMembers.RemoveRange(conversationMembers);
                if (directConversations.Count > 0) _db.Conversations.RemoveRange(directConversations);
                
                if (topics.Count > 0) _db.Topics.RemoveRange(topics);

                await _db.SaveChangesAsync();
                await tx.CommitAsync();

                var result = new TopicWorkflowRollbackResultDto(
                    TopicsDeleted: topics.Count,
                    TopicTagsDeleted: topicTags.Count,
                    TopicLecturersDeleted: topicLecturers.Count,
                    ProgressMilestonesDeleted: progressMilestones.Count,
                    ConversationMembersDeleted: conversationMembers.Count,
                    DirectConversationsDeleted: directConversations.Count,
                    Message: string.IsNullOrWhiteSpace(topicCode)
                        ? "Rollback all test data completed"
                        : $"Rollback test data completed for topic '{topicCode.Trim()}'");

                return OperationResult<TopicWorkflowRollbackResultDto>.Succeeded(result);
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                return OperationResult<TopicWorkflowRollbackResultDto>.Failed($"Rollback failed: {ex.Message} {(ex.InnerException != null ? " | Inner: " + ex.InnerException.Message : "")}", 500);
            }
        }

        private static string BuildConversationCode(string prefix, string seed)
        {
            var normalized = seed.Trim().ToUpperInvariant().Replace(" ", "_");
            var raw = $"{prefix}-{normalized}";
            return raw.Length <= 50 ? raw : raw[..50];
        }
    }
}

using Microsoft.EntityFrameworkCore;
using Oracle.ManagedDataAccess.Client;
using System.Text.Json;
using ThesisManagement.Api.Data;
using ThesisManagement.Api.DTOs.Workflows.Query;
using ThesisManagement.Api.Models;
using ThesisManagement.Api.Services;

namespace ThesisManagement.Api.Application.Command.Workflows
{
    public interface ITopicWorkflowCommandSupport
    {
        Task<Topic?> ResolveTopicAsync(int? topicId, string? topicCode);
        Task SyncTopicTagsAsync(Topic topic, IEnumerable<int>? tagIds, IEnumerable<string>? tagCodes, bool useCatalogTopicTags);
        Task<string> SyncMilestoneForResubmitAsync(Topic topic, bool isFirstSubmit);
        Task<string> SyncMilestoneForDecisionAsync(Topic topic, string action);
        Task EnsurePrimaryTopicLecturerLinkAsync(Topic topic);
        Task CreateWorkflowAuditAsync(
            string actionType,
            string? decisionAction,
            Topic? topic,
            string? oldStatus,
            string? newStatus,
            string? statusCode,
            int? resubmitCountBefore,
            int? resubmitCountAfter,
            string? commentText,
            bool isSuccess,
            string? errorMessage,
            string? requestPayload,
            string? responsePayload,
            string? tagsBefore,
            string? tagsAfter,
            string? milestoneBefore,
            string? milestoneAfter,
            string correlationId,
            string? requestId,
            string? idempotencyKey,
            string? reviewerUserCode);
        Task TryCreateFailureAuditAsync(
            string actionType,
            string? decisionAction,
            Topic? topic,
            string? oldStatus,
            string? newStatus,
            string? statusCode,
            int? resubmitCountBefore,
            int? resubmitCountAfter,
            string? commentText,
            string? errorMessage,
            string? requestPayload,
            string? responsePayload,
            string? tagsBefore,
            string? tagsAfter,
            string? milestoneBefore,
            string? milestoneAfter,
            string correlationId,
            string? requestId,
            string? idempotencyKey,
            string? reviewerUserCode);
        bool IsAcceptedStatus(string? status);
        bool IsPrivilegedRole(string? role);
        string NormalizeStatusCode(string? status);
        string ToJson(object? value);
    }

    public class TopicWorkflowCommandSupport : ITopicWorkflowCommandSupport
    {
        private readonly ApplicationDbContext _db;
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUserService;

        public TopicWorkflowCommandSupport(ApplicationDbContext db, IUnitOfWork uow, ICurrentUserService currentUserService)
        {
            _db = db;
            _uow = uow;
            _currentUserService = currentUserService;
        }

        public async Task<Topic?> ResolveTopicAsync(int? topicId, string? topicCode)
        {
            if (topicId.HasValue && topicId.Value > 0)
                return await _uow.Topics.GetByIdAsync(topicId.Value);

            if (!string.IsNullOrWhiteSpace(topicCode))
                return await _uow.Topics.GetByCodeAsync(topicCode.Trim());

            return null;
        }

        public async Task SyncTopicTagsAsync(
            Topic topic,
            IEnumerable<int>? tagIds,
            IEnumerable<string>? tagCodes,
            bool useCatalogTopicTags)
        {
            var desiredTagIds = new HashSet<int>();

            if (tagIds != null)
            {
                foreach (var tagId in tagIds.Where(x => x > 0))
                    desiredTagIds.Add(tagId);
            }

            if (tagCodes != null)
            {
                var normalizedCodes = tagCodes
                    .Where(x => !string.IsNullOrWhiteSpace(x))
                    .Select(x => x.Trim())
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                if (normalizedCodes.Count > 0)
                {
                    var tagsByCode = await _uow.Tags.Query()
                        .Where(x => normalizedCodes.Contains(x.TagCode))
                        .Select(x => new { x.TagID, x.TagCode })
                        .ToListAsync();

                    foreach (var tag in tagsByCode)
                        desiredTagIds.Add(tag.TagID);
                }
            }

            if (useCatalogTopicTags && !string.IsNullOrWhiteSpace(topic.CatalogTopicCode))
            {
                var catalogTagIds = await _uow.CatalogTopicTags.Query()
                    .Where(x => x.CatalogTopicCode == topic.CatalogTopicCode)
                    .Select(x => x.TagID)
                    .Distinct()
                    .ToListAsync();

                foreach (var tagId in catalogTagIds)
                    desiredTagIds.Add(tagId);
            }

            var currentTopicTags = await _uow.TopicTags.Query()
                .Where(x => x.TopicCode == topic.TopicCode)
                .ToListAsync();

            var toRemove = currentTopicTags
                .Where(x => !desiredTagIds.Contains(x.TagID))
                .ToList();

            foreach (var item in toRemove)
                _uow.TopicTags.Remove(item);

            // Keep TOPICTAGS bound to TopicCode only.
            // Some Oracle trigger setups may react to non-null CatalogTopicCode and cause
            // unintended writes/conflicts on TOPICS unique constraints.
            foreach (var item in currentTopicTags)
            {
                if (!string.IsNullOrWhiteSpace(item.CatalogTopicCode))
                {
                    item.CatalogTopicCode = null;
                    _uow.TopicTags.Update(item);
                }
            }

            var existingTagIds = currentTopicTags.Select(x => x.TagID).ToHashSet();
            var toAddTagIds = desiredTagIds.Where(x => !existingTagIds.Contains(x)).ToList();

            if (toAddTagIds.Count > 0)
            {
                var tagMap = await _uow.Tags.Query()
                    .Where(x => toAddTagIds.Contains(x.TagID))
                    .Select(x => new { x.TagID, x.TagCode })
                    .ToListAsync();

                foreach (var tag in tagMap)
                {
                    await _uow.TopicTags.AddAsync(new TopicTag
                    {
                        TopicCode = topic.TopicCode,
                        CatalogTopicCode = null,
                        TagID = tag.TagID,
                        TagCode = tag.TagCode,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }

            await _uow.SaveChangesAsync();
        }

        public async Task<string> SyncMilestoneForResubmitAsync(Topic topic, bool isFirstSubmit)
        {
            var targetState = "Đang thực hiện";

            var milestone = await _uow.ProgressMilestones.Query()
                .Where(x => x.TopicID == topic.TopicID)
                .OrderByDescending(x => x.MilestoneID)
                .FirstOrDefaultAsync();

            if (milestone == null)
            {
                milestone = new ProgressMilestone
                {
                    MilestoneID = await GetNextProgressMilestoneIdAsync(),
                    MilestoneCode = await GenerateMilestoneCodeAsync(),
                    TopicID = topic.TopicID,
                    TopicCode = topic.TopicCode,
                    MilestoneTemplateCode = "MS_REG",
                    Ordinal = 1,
                    State = targetState,
                    CreatedAt = DateTime.UtcNow,
                    LastUpdated = DateTime.UtcNow
                };

                await AddProgressMilestoneWithRetryAsync(milestone);
                return milestone.State ?? targetState;
            }
            else
            {
                milestone.TopicCode = topic.TopicCode;
                milestone.MilestoneTemplateCode = "MS_REG";
                milestone.Ordinal = 1;
                milestone.State = targetState;
                milestone.StartedAt = null;
                milestone.CompletedAt1 = null;
                milestone.CompletedAt2 = null;
                milestone.CompletedAt3 = null;
                milestone.CompletedAt4 = null;
                milestone.CompletedAt5 = null;
                milestone.LastUpdated = DateTime.UtcNow;
                _uow.ProgressMilestones.Update(milestone);
            }

            await _uow.SaveChangesAsync();
            return milestone.State ?? targetState;
        }

        public async Task<string> SyncMilestoneForDecisionAsync(Topic topic, string action)
        {
            var milestone = await _uow.ProgressMilestones.Query()
                .Where(x => x.TopicID == topic.TopicID)
                .OrderByDescending(x => x.MilestoneID)
                .FirstOrDefaultAsync();

            var targetState = action switch
            {
                "approve" => "Đang thực hiện",
                "reject" => "Bị từ chối",
                "revision" => "Yêu cầu sửa đổi",
                _ => "Cập nhật"
            };

            if (milestone == null)
            {
                milestone = new ProgressMilestone
                {
                    MilestoneID = await GetNextProgressMilestoneIdAsync(),
                    MilestoneCode = await GenerateMilestoneCodeAsync(),
                    TopicID = topic.TopicID,
                    TopicCode = topic.TopicCode,
                    MilestoneTemplateCode = action == "approve" ? "MS_PROG1" : null,
                    Ordinal = action == "approve" ? 2 : null,
                    State = targetState,
                    CompletedAt1 = action == "approve" ? DateTime.UtcNow : null,
                    CreatedAt = DateTime.UtcNow,
                    LastUpdated = DateTime.UtcNow
                };

                await _uow.ProgressMilestones.AddAsync(milestone);
            }
            else
            {
                milestone.TopicCode = topic.TopicCode;
                if (action == "approve")
                {
                    milestone.MilestoneTemplateCode = "MS_PROG1";
                    milestone.Ordinal = 2;
                    milestone.CompletedAt1 = DateTime.UtcNow;
                }
                milestone.State = targetState;
                milestone.LastUpdated = DateTime.UtcNow;
                _uow.ProgressMilestones.Update(milestone);
            }

            return targetState;
        }

        private async Task<int> GetNextProgressMilestoneIdAsync()
        {
            var currentMax = await _uow.ProgressMilestones.Query()
                .Select(x => (int?)x.MilestoneID)
                .MaxAsync() ?? 0;

            return currentMax + 1;
        }

        private async Task AddProgressMilestoneWithRetryAsync(ProgressMilestone milestone)
        {
            const int maxAttempts = 3;

            for (var attempt = 1; attempt <= maxAttempts; attempt++)
            {
                await _uow.ProgressMilestones.AddAsync(milestone);
                try
                {
                    await _uow.SaveChangesAsync();
                    return;
                }
                catch (DbUpdateException ex) when (IsProgressMilestonePkViolation(ex) && attempt < maxAttempts)
                {
                    _db.Entry(milestone).State = EntityState.Detached;
                    milestone.MilestoneID = await GetNextProgressMilestoneIdAsync();
                }
            }
        }

        private static bool IsProgressMilestonePkViolation(DbUpdateException ex)
        {
            var oraEx = ex.InnerException as OracleException;
            if (oraEx == null)
                return false;

            return oraEx.Number == 1
                && (oraEx.Message?.Contains("PK_PROGRESSMILESTONES", StringComparison.OrdinalIgnoreCase) ?? false);
        }

        public async Task EnsurePrimaryTopicLecturerLinkAsync(Topic topic)
        {
            int? lecturerProfileId = topic.SupervisorLecturerProfileID;
            if (!lecturerProfileId.HasValue && !string.IsNullOrWhiteSpace(topic.SupervisorLecturerCode))
            {
                lecturerProfileId = await _uow.LecturerProfiles.Query()
                    .Where(x => x.LecturerCode == topic.SupervisorLecturerCode)
                    .Select(x => (int?)x.LecturerProfileID)
                    .FirstOrDefaultAsync();
            }

            if (!lecturerProfileId.HasValue)
                return;

            var exists = _uow.TopicLecturers.Query().Count(x =>
                x.TopicID == topic.TopicID && x.LecturerProfileID == lecturerProfileId.Value) > 0;
            if (exists)
                return;

            await _uow.TopicLecturers.AddAsync(new TopicLecturer
            {
                TopicID = topic.TopicID,
                TopicCode = topic.TopicCode,
                LecturerProfileID = lecturerProfileId.Value,
                LecturerCode = topic.SupervisorLecturerCode,
                IsPrimary = true,
                CreatedAt = DateTime.UtcNow
            });
        }

        public async Task CreateWorkflowAuditAsync(
            string actionType,
            string? decisionAction,
            Topic? topic,
            string? oldStatus,
            string? newStatus,
            string? statusCode,
            int? resubmitCountBefore,
            int? resubmitCountAfter,
            string? commentText,
            bool isSuccess,
            string? errorMessage,
            string? requestPayload,
            string? responsePayload,
            string? tagsBefore,
            string? tagsAfter,
            string? milestoneBefore,
            string? milestoneAfter,
            string correlationId,
            string? requestId,
            string? idempotencyKey,
            string? reviewerUserCode)
        {
            var actorUserId = _currentUserService.GetUserId();
            var actorUserCode = _currentUserService.GetUserCode();
            var actorRole = _currentUserService.GetUserRole();

            var audit = new TopicWorkflowAudit
            {
                AuditCode = null!,
                ActionType = actionType,
                DecisionAction = decisionAction,
                TopicID = topic?.TopicID,
                TopicCode = topic?.TopicCode,
                EntityName = "TOPIC",
                EntityID = topic?.TopicID.ToString(),
                EntityCode = topic?.TopicCode,
                OldStatus = oldStatus,
                NewStatus = newStatus,
                StatusCode = statusCode,
                ResubmitCountBefore = resubmitCountBefore,
                ResubmitCountAfter = resubmitCountAfter,
                CommentText = commentText,
                ErrorMessage = errorMessage,
                IsSuccess = isSuccess ? 1 : 0,
                RequestPayload = requestPayload,
                ResponsePayload = responsePayload,
                ChangedFields = ToJson(new { oldStatus, newStatus, resubmitCountBefore, resubmitCountAfter }),
                TagsBefore = tagsBefore,
                TagsAfter = tagsAfter,
                MilestoneBefore = milestoneBefore,
                MilestoneAfter = milestoneAfter,
                ActorUserID = actorUserId,
                ActorUserCode = actorUserCode,
                ActorRole = actorRole,
                ReviewerUserCode = reviewerUserCode,
                CorrelationID = correlationId,
                RequestID = requestId,
                IdempotencyKey = idempotencyKey,
                IPAddress = _currentUserService.GetIpAddress(),
                DeviceInfo = _currentUserService.GetDeviceInfo(),
                UserAgent = _currentUserService.GetDeviceInfo(),
                CreatedAt = DateTime.UtcNow
            };

            await _uow.TopicWorkflowAudits.AddAsync(audit);
            await _uow.SaveChangesAsync();
        }

        public async Task TryCreateFailureAuditAsync(
            string actionType,
            string? decisionAction,
            Topic? topic,
            string? oldStatus,
            string? newStatus,
            string? statusCode,
            int? resubmitCountBefore,
            int? resubmitCountAfter,
            string? commentText,
            string? errorMessage,
            string? requestPayload,
            string? responsePayload,
            string? tagsBefore,
            string? tagsAfter,
            string? milestoneBefore,
            string? milestoneAfter,
            string correlationId,
            string? requestId,
            string? idempotencyKey,
            string? reviewerUserCode)
        {
            try
            {
                await CreateWorkflowAuditAsync(
                    actionType,
                    decisionAction,
                    topic,
                    oldStatus,
                    newStatus,
                    statusCode,
                    resubmitCountBefore,
                    resubmitCountAfter,
                    commentText,
                    false,
                    errorMessage,
                    requestPayload,
                    responsePayload,
                    tagsBefore,
                    tagsAfter,
                    milestoneBefore,
                    milestoneAfter,
                    correlationId,
                    requestId,
                    idempotencyKey,
                    reviewerUserCode);
            }
            catch
            {
                // Swallow audit write errors to avoid masking original workflow failure.
            }
        }

        public bool IsAcceptedStatus(string? status)
        {
            if (string.IsNullOrWhiteSpace(status))
                return false;

            return string.Equals(status, "APPROVED", StringComparison.OrdinalIgnoreCase)
                   || string.Equals(status, "ACCEPTED", StringComparison.OrdinalIgnoreCase)
                   || string.Equals(status, "Đã duyệt", StringComparison.OrdinalIgnoreCase)
                   || string.Equals(status, "ĐÃ DUYỆT", StringComparison.OrdinalIgnoreCase);
        }

        public bool IsPrivilegedRole(string? role)
        {
            if (string.IsNullOrWhiteSpace(role))
                return false;

            return string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase)
                   || string.Equals(role, "StudentService", StringComparison.OrdinalIgnoreCase);
        }

        public string NormalizeStatusCode(string? status)
        {
            if (string.IsNullOrWhiteSpace(status))
                return "UNKNOWN";

            var normalized = status.Trim().ToLowerInvariant();
            return normalized switch
            {
                "đã duyệt" or "approved" or "accepted" => "APPROVED",
                "đang chờ" or "chờ duyệt" or "pending" => "PENDING",
                "từ chối" or "rejected" => "REJECTED",
                "cần sửa đổi" or "revision" => "REVISION_REQUIRED",
                _ => "UNKNOWN"
            };
        }

        public string ToJson(object? value)
        {
            return JsonSerializer.Serialize(value, new JsonSerializerOptions
            {
                WriteIndented = false
            });
        }

        private async Task<string> GenerateMilestoneCodeAsync()
        {
            var now = DateTime.UtcNow;
            var prefix = $"MS{now:yyMMdd}";

            var recentCodes = await _uow.ProgressMilestones.Query()
                .Where(x => x.MilestoneCode.StartsWith(prefix))
                .OrderByDescending(x => x.MilestoneCode)
                .Take(1)
                .Select(x => x.MilestoneCode)
                .ToListAsync();

            var sequence = 1;
            var lastCode = recentCodes.FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(lastCode) && lastCode.Length >= prefix.Length + 3)
            {
                var suffix = lastCode.Substring(prefix.Length, 3);
                if (int.TryParse(suffix, out var parsed))
                    sequence = parsed + 1;
            }

            return $"{prefix}{sequence:D3}";
        }
    }
}

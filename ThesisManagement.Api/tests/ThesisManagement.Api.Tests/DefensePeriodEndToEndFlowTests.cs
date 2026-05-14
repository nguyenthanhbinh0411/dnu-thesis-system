using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Options;
using Moq;
using ThesisManagement.Api.Application.Command.Notifications;
using ThesisManagement.Api.Application.Command.DefensePeriods;
using ThesisManagement.Api.Application.Command.DefensePeriods.Services;
using ThesisManagement.Api.Application.Common;
using ThesisManagement.Api.Application.Common.Constraints;
using ThesisManagement.Api.Application.Common.Heuristics;
using ThesisManagement.Api.Application.Common.Resilience;
using ThesisManagement.Api.Data;
using ThesisManagement.Api.DTOs.DefensePeriods;
using ThesisManagement.Api.Hubs;
using ThesisManagement.Api.Models;
using ThesisManagement.Api.Services;
using Xunit;

namespace ThesisManagement.Api.Tests;

public class DefensePeriodEndToEndFlowTests
{
    [Fact]
    public async Task EndToEndFlow_ShouldRunSyncGenerateFinalizePublishRollbackSuccessfully()
    {
        await using var db = CreateDbContext();
        var uow = new UnitOfWork(db);

        SeedPeriodAndMasterData(db);

        var (processor, notificationPublisher) = BuildProcessor(db, uow);

        var syncResult = await processor.SyncAsync(1, new SyncDefensePeriodRequestDto { RetryOnFailure = true, IdempotencyKey = "sync-e2e" }, actorUserId: 1001);
        Assert.True(syncResult.Success);
        Assert.NotNull(syncResult.Data);
        Assert.NotEmpty(syncResult.Data!.SnapshotVersion);
        Assert.True(syncResult.Data.Readiness.ContainsKey("hasEligibleTopics"));

        var updateConfigResult = await processor.UpdateConfigAsync(1, new UpdateDefensePeriodConfigDto
        {
            Rooms = new List<string> { "R101" },
            MorningStart = "07:30",
            AfternoonStart = "13:30",
            SoftMaxCapacity = 4
        }, actorUserId: 1001);
        Assert.True(updateConfigResult.Success);

        var lockCapabilitiesResult = await processor.LockLecturerCapabilitiesAsync(1, actorUserId: 1001);
        Assert.True(lockCapabilitiesResult.Success);

        var confirmConfigResult = await processor.ConfirmCouncilConfigAsync(1, new ConfirmCouncilConfigDto
        {
            TopicsPerSessionConfig = 3,
            MembersPerCouncilConfig = 3,
            Tags = new List<string>()
        }, actorUserId: 1001);
        Assert.True(confirmConfigResult.Success);

        var generateResult = await processor.GenerateCouncilsAsync(1, new GenerateCouncilsRequestDto
        {
            SelectedTopicCodes = new List<string> { "T001", "T002", "T003", "T004", "T005", "T006", "T007", "T008" },
            SelectedLecturerCodes = new List<string> { "L001", "L002", "L003", "L004" },
            SelectedRooms = new List<string> { "R101" },
            IdempotencyKey = "generate-e2e"
        }, actorUserId: 1001);

        Assert.True(generateResult.Success, generateResult.Message ?? "Generate failed");
        Assert.NotNull(generateResult.Data);
        Assert.NotEmpty(generateResult.Data!);
        var generatedCouncil = Assert.Single(generateResult.Data!);
        Assert.Equal("Ready", generatedCouncil.Status);
        Assert.True(string.IsNullOrWhiteSpace(generatedCouncil.Warning));

        var lockCouncilsResult = await processor.LockCouncilsAsync(1, actorUserId: 1001, idempotencyKey: "lock-councils-e2e");
        Assert.True(lockCouncilsResult.Success, lockCouncilsResult.Message ?? "Lock councils failed");

        var studentAssignment = generatedCouncil.Assignments.Single(x =>
            string.Equals(x.StudentCode, "S001", StringComparison.OrdinalIgnoreCase));
        var expectedStudentWeekday = ToVietnameseWeekdayLabel(
            studentAssignment.ScheduledAt ?? throw new InvalidOperationException("Missing student assignment date"));
        var expectedStudentTime = String.IsNullOrWhiteSpace(studentAssignment.StartTime)
            ? string.Empty
            : studentAssignment.StartTime;

        notificationPublisher.Verify(
            x => x.PublishAsync(It.Is<NotificationEventRequest>(request =>
                request.ActionType == "OPEN_DEFENSE_STUDENT"
                && request.ActionUrl == "/defense/periods/1/student"
                && request.TargetUserCodes.Any(code => string.Equals(code, "S001", StringComparison.OrdinalIgnoreCase))
                && request.NotifBody.Contains("Lịch đồ án tốt nghiệp của bạn")
                && request.NotifBody.Contains(generatedCouncil.CommitteeCode)
                && request.NotifBody.Contains(generatedCouncil.Room)
                && request.NotifBody.Contains(expectedStudentWeekday)
                && request.NotifBody.Contains(expectedStudentTime)
                && !request.NotifBody.Contains("Giảng viên hướng dẫn")
                && !request.NotifBody.Contains("Chủ tịch hội đồng"))),
            Times.AtLeastOnce);

        notificationPublisher.Verify(
            x => x.PublishAsync(It.Is<NotificationEventRequest>(request =>
                request.ActionType == "OPEN_DEFENSE_COMMITTEE"
                && request.ActionUrl == "/defense/periods/1/lecturer/committees"
                && request.TargetUserCodes.Any(code => string.Equals(code, "L001", StringComparison.OrdinalIgnoreCase))
                && request.NotifBody.Contains("Hội đồng của bạn")
                && request.NotifBody.Contains("Ngày:")
                && request.NotifBody.Contains("Vai trò:")
                && !request.NotifBody.Contains("Giảng viên hướng dẫn")
                && (
                    request.NotifBody.Contains("Chủ tịch hội đồng")
                    || request.NotifBody.Contains("Ủy viên thư ký hội đồng")
                    || request.NotifBody.Contains("Ủy viên phản biện hội đồng")
                    || request.NotifBody.Contains("Ủy viên hội đồng")
                ))),
            Times.AtLeastOnce);

        notificationPublisher.Verify(
            x => x.PublishAsync(It.Is<NotificationEventRequest>(request =>
                request.TargetUserCodes.Any(code => string.Equals(code, "SUP001", StringComparison.OrdinalIgnoreCase)))),
            Times.Never);

        notificationPublisher.Verify(
            x => x.PublishAsync(It.Is<NotificationEventRequest>(request =>
                request.TargetUserCodes.Any(code => string.Equals(code, "S009", StringComparison.OrdinalIgnoreCase)))),
            Times.Never);

        await SeedScoresForPublishAsync(db);

        var finalizeResult = await processor.FinalizeAsync(1, new FinalizeDefensePeriodDto
        {
            AllowFinalizeAfterWarning = true,
            IdempotencyKey = "finalize-e2e"
        }, actorUserId: 1001);
        Assert.True(finalizeResult.Success, finalizeResult.Message ?? "Finalize failed");

        var publishResult = await processor.PublishScoresAsync(1, actorUserId: 1001, idempotencyKey: "publish-e2e");
        Assert.True(publishResult.Success, publishResult.Message ?? "Publish failed");

        var rollbackResult = await processor.RollbackAsync(1, new RollbackDefensePeriodDto
        {
            Target = "ALL",
            Reason = "E2E rollback validation",
            ForceUnlockScores = true,
            IdempotencyKey = "rollback-e2e"
        }, actorUserId: 1001);

        Assert.True(rollbackResult.Success, rollbackResult.Message ?? "Rollback failed");
        Assert.NotNull(rollbackResult.Data);
        Assert.False(rollbackResult.Data!.FinalizedAfter);
        Assert.False(rollbackResult.Data.ScoresPublishedAfter);

        var term = await db.DefenseTerms.AsNoTracking().FirstAsync(x => x.DefenseTermId == 1);
        Assert.Equal("Preparing", term.Status);
    }

    private static ApplicationDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"e2e-defense-{Guid.NewGuid()}")
            .ConfigureWarnings(x => x.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new ApplicationDbContext(options);
    }

    private static (DefensePeriodCommandProcessor Processor, Mock<INotificationEventPublisher> NotificationPublisher) BuildProcessor(ApplicationDbContext db, IUnitOfWork uow)
    {
        var clients = new Mock<IHubClients>();
        var clientProxy = new Mock<IClientProxy>();
        clientProxy
            .Setup(x => x.SendCoreAsync(It.IsAny<string>(), It.IsAny<object?[]>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        clients.Setup(x => x.All).Returns(clientProxy.Object);

        var hub = new Mock<IHubContext<ChatHub>>();
        hub.Setup(x => x.Clients).Returns(clients.Object);

        var auditTrail = new Mock<IDefenseAuditTrailService>();
        auditTrail
            .Setup(x => x.WriteAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<object?>(), It.IsAny<object?>(), It.IsAny<object?>(), It.IsAny<int?>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var scoreWorkflow = new Mock<IDefenseScoreWorkflowService>();
        var revisionWorkflow = new Mock<IDefenseRevisionWorkflowService>();
        var notificationPublisher = new Mock<INotificationEventPublisher>();
        notificationPublisher
            .Setup(x => x.PublishAsync(It.IsAny<NotificationEventRequest>()))
            .Returns(Task.CompletedTask);

        var rules = new ICommitteeConstraintRule[]
        {
            new RoleRequirementRule(db),
            new LecturerOverlapRule(db),
            new UniqueStudentAssignmentRule(db),
            new SupervisorConflictRule(db)
        };

        var constraintService = new CommitteeConstraintService(rules);
        var heuristicService = new DefenseCommitteeHeuristicService(
            Options.Create(new DefenseAutoGenerateHeuristicOptions()));
        var resiliencePolicy = new DefenseResiliencePolicy(
            Options.Create(new DefenseResiliencePolicyOptions
            {
                MaxRetries = 0,
                BaseDelayMs = 1,
                OperationTimeoutMs = 5000,
                CircuitFailureThreshold = 10,
                CircuitBreakSeconds = 5
            }));

        var processor = new DefensePeriodCommandProcessor(
            db,
            uow,
            hub.Object,
            constraintService,
            heuristicService,
            scoreWorkflow.Object,
            revisionWorkflow.Object,
            auditTrail.Object,
            resiliencePolicy,
            notificationPublisher.Object);

        return (processor, notificationPublisher);
    }

    private static void SeedPeriodAndMasterData(ApplicationDbContext db)
    {
        var now = DateTime.UtcNow;

        db.DefenseTerms.Add(new DefenseTerm
        {
            DefenseTermId = 1,
            Name = "Term 1",
            StartDate = DateTime.UtcNow.Date,
            Status = "Preparing",
            CreatedAt = now,
            LastUpdated = now,
            ConfigJson = "{}"
        });

        db.Rooms.Add(new Room
        {
            RoomID = 1,
            RoomCode = "R101",
            Status = "Active",
            CreatedAt = now,
            LastUpdated = now
        });

        db.StudentProfiles.AddRange(
            new StudentProfile { StudentProfileID = 1, StudentCode = "S001", UserID = 1, FullName = "Student 1" },
            new StudentProfile { StudentProfileID = 2, StudentCode = "S002", UserID = 2, FullName = "Student 2" },
            new StudentProfile { StudentProfileID = 3, StudentCode = "S003", UserID = 3, FullName = "Student 3" },
            new StudentProfile { StudentProfileID = 4, StudentCode = "S004", UserID = 4, FullName = "Student 4" },
            new StudentProfile { StudentProfileID = 5, StudentCode = "S005", UserID = 5, FullName = "Student 5" },
            new StudentProfile { StudentProfileID = 6, StudentCode = "S006", UserID = 6, FullName = "Student 6" },
            new StudentProfile { StudentProfileID = 7, StudentCode = "S007", UserID = 7, FullName = "Student 7" },
            new StudentProfile { StudentProfileID = 8, StudentCode = "S008", UserID = 8, FullName = "Student 8" },
            new StudentProfile { StudentProfileID = 9, StudentCode = "S009", UserID = 9, FullName = "Student 9" });

        db.DefenseTermStudents.AddRange(
            new DefenseTermStudent { DefenseTermStudentID = 1, DefenseTermId = 1, StudentProfileID = 1, StudentCode = "S001", UserCode = "S001", CreatedAt = now, LastUpdated = now },
            new DefenseTermStudent { DefenseTermStudentID = 2, DefenseTermId = 1, StudentProfileID = 2, StudentCode = "S002", UserCode = "S002", CreatedAt = now, LastUpdated = now },
            new DefenseTermStudent { DefenseTermStudentID = 3, DefenseTermId = 1, StudentProfileID = 3, StudentCode = "S003", UserCode = "S003", CreatedAt = now, LastUpdated = now },
            new DefenseTermStudent { DefenseTermStudentID = 4, DefenseTermId = 1, StudentProfileID = 4, StudentCode = "S004", UserCode = "S004", CreatedAt = now, LastUpdated = now },
            new DefenseTermStudent { DefenseTermStudentID = 5, DefenseTermId = 1, StudentProfileID = 5, StudentCode = "S005", UserCode = "S005", CreatedAt = now, LastUpdated = now },
            new DefenseTermStudent { DefenseTermStudentID = 6, DefenseTermId = 1, StudentProfileID = 6, StudentCode = "S006", UserCode = "S006", CreatedAt = now, LastUpdated = now },
            new DefenseTermStudent { DefenseTermStudentID = 7, DefenseTermId = 1, StudentProfileID = 7, StudentCode = "S007", UserCode = "S007", CreatedAt = now, LastUpdated = now },
            new DefenseTermStudent { DefenseTermStudentID = 8, DefenseTermId = 1, StudentProfileID = 8, StudentCode = "S008", UserCode = "S008", CreatedAt = now, LastUpdated = now },
            new DefenseTermStudent { DefenseTermStudentID = 9, DefenseTermId = 1, StudentProfileID = 9, StudentCode = "S009", UserCode = "S009", CreatedAt = now, LastUpdated = now });

        db.LecturerProfiles.AddRange(
            new LecturerProfile { LecturerProfileID = 1, LecturerCode = "L001", FullName = "Lec 1" },
            new LecturerProfile { LecturerProfileID = 2, LecturerCode = "L002", FullName = "Lec 2" },
            new LecturerProfile { LecturerProfileID = 3, LecturerCode = "L003", FullName = "Lec 3" },
            new LecturerProfile { LecturerProfileID = 4, LecturerCode = "L004", FullName = "Lec 4" },
            new LecturerProfile { LecturerProfileID = 5, LecturerCode = "SUP001", FullName = "Supervisor 1", UserCode = "SUP001" });

        db.DefenseTermLecturers.AddRange(
            new DefenseTermLecturer { DefenseTermLecturerID = 1, DefenseTermId = 1, LecturerProfileID = 1, LecturerCode = "L001", UserCode = "L001", IsPrimary = true, CreatedAt = now, LastUpdated = now },
            new DefenseTermLecturer { DefenseTermLecturerID = 2, DefenseTermId = 1, LecturerProfileID = 2, LecturerCode = "L002", UserCode = "L002", IsPrimary = true, CreatedAt = now, LastUpdated = now },
            new DefenseTermLecturer { DefenseTermLecturerID = 3, DefenseTermId = 1, LecturerProfileID = 3, LecturerCode = "L003", UserCode = "L003", IsPrimary = true, CreatedAt = now, LastUpdated = now },
            new DefenseTermLecturer { DefenseTermLecturerID = 4, DefenseTermId = 1, LecturerProfileID = 4, LecturerCode = "L004", UserCode = "L004", IsPrimary = true, CreatedAt = now, LastUpdated = now },
            new DefenseTermLecturer { DefenseTermLecturerID = 5, DefenseTermId = 1, LecturerProfileID = 5, LecturerCode = "SUP001", UserCode = "SUP001", IsPrimary = false, CreatedAt = now, LastUpdated = now });

        db.Topics.AddRange(
            new Topic { TopicID = 1, TopicCode = "T001", Title = "Topic 1", Type = "Research", ProposerUserID = 1, ProposerStudentCode = "S001", SupervisorLecturerCode = "SUP001", DefenseTermId = 1, Status = "Eligible" },
            new Topic { TopicID = 2, TopicCode = "T002", Title = "Topic 2", Type = "Research", ProposerUserID = 2, ProposerStudentCode = "S002", SupervisorLecturerCode = "SUP002", DefenseTermId = 1, Status = "Eligible" },
            new Topic { TopicID = 3, TopicCode = "T003", Title = "Topic 3", Type = "Research", ProposerUserID = 3, ProposerStudentCode = "S003", SupervisorLecturerCode = "SUP003", DefenseTermId = 1, Status = "Eligible" },
            new Topic { TopicID = 4, TopicCode = "T004", Title = "Topic 4", Type = "Research", ProposerUserID = 4, ProposerStudentCode = "S004", SupervisorLecturerCode = "SUP004", DefenseTermId = 1, Status = "Eligible" },
            new Topic { TopicID = 5, TopicCode = "T005", Title = "Topic 5", Type = "Research", ProposerUserID = 5, ProposerStudentCode = "S005", SupervisorLecturerCode = "SUP005", DefenseTermId = 1, Status = "Eligible" },
            new Topic { TopicID = 6, TopicCode = "T006", Title = "Topic 6", Type = "Research", ProposerUserID = 6, ProposerStudentCode = "S006", SupervisorLecturerCode = "SUP006", DefenseTermId = 1, Status = "Eligible" },
            new Topic { TopicID = 7, TopicCode = "T007", Title = "Topic 7", Type = "Research", ProposerUserID = 7, ProposerStudentCode = "S007", SupervisorLecturerCode = "SUP007", DefenseTermId = 1, Status = "Eligible" },
            new Topic { TopicID = 8, TopicCode = "T008", Title = "Topic 8", Type = "Research", ProposerUserID = 8, ProposerStudentCode = "S008", SupervisorLecturerCode = "SUP008", DefenseTermId = 1, Status = "Eligible" });

        db.ProgressMilestones.AddRange(
            new ProgressMilestone { MilestoneID = 1, MilestoneCode = "MS-1", TopicID = 1, TopicCode = "T001", MilestoneTemplateCode = "MS_PROG1", State = "Eligible", CreatedAt = now, LastUpdated = now },
            new ProgressMilestone { MilestoneID = 2, MilestoneCode = "MS-2", TopicID = 2, TopicCode = "T002", MilestoneTemplateCode = "MS_PROG1", State = "Eligible", CreatedAt = now, LastUpdated = now },
            new ProgressMilestone { MilestoneID = 3, MilestoneCode = "MS-3", TopicID = 3, TopicCode = "T003", MilestoneTemplateCode = "MS_PROG1", State = "Eligible", CreatedAt = now, LastUpdated = now },
            new ProgressMilestone { MilestoneID = 4, MilestoneCode = "MS-4", TopicID = 4, TopicCode = "T004", MilestoneTemplateCode = "MS_PROG1", State = "Eligible", CreatedAt = now, LastUpdated = now },
            new ProgressMilestone { MilestoneID = 5, MilestoneCode = "MS-5", TopicID = 5, TopicCode = "T005", MilestoneTemplateCode = "MS_PROG1", State = "Eligible", CreatedAt = now, LastUpdated = now },
            new ProgressMilestone { MilestoneID = 6, MilestoneCode = "MS-6", TopicID = 6, TopicCode = "T006", MilestoneTemplateCode = "MS_PROG1", State = "Eligible", CreatedAt = now, LastUpdated = now },
            new ProgressMilestone { MilestoneID = 7, MilestoneCode = "MS-7", TopicID = 7, TopicCode = "T007", MilestoneTemplateCode = "MS_PROG1", State = "Eligible", CreatedAt = now, LastUpdated = now },
            new ProgressMilestone { MilestoneID = 8, MilestoneCode = "MS-8", TopicID = 8, TopicCode = "T008", MilestoneTemplateCode = "MS_PROG1", State = "Eligible", CreatedAt = now, LastUpdated = now });

        db.SaveChanges();
    }

    private static async Task SeedScoresForPublishAsync(ApplicationDbContext db)
    {
        var now = DateTime.UtcNow;
        var assignments = await db.DefenseAssignments.AsNoTracking().ToListAsync();
        var members = await db.CommitteeMembers.AsNoTracking().ToListAsync();

        foreach (var assignment in assignments)
        {
            var committeeMembers = members.Where(x => x.CommitteeID == assignment.CommitteeID).ToList();

            foreach (var member in committeeMembers.Where(x => x.Role == "CT" || x.Role == "UVTK" || x.Role == "UVPB"))
            {
                db.DefenseScores.Add(new DefenseScore
                {
                    ScoreCode = $"SC-{assignment.AssignmentID}-{member.Role}",
                    AssignmentID = assignment.AssignmentID,
                    AssignmentCode = assignment.AssignmentCode,
                    MemberLecturerCode = member.MemberLecturerCode,
                    MemberLecturerProfileID = member.MemberLecturerProfileID,
                    MemberLecturerUserID = member.MemberUserID,
                    MemberLecturerUserCode = member.MemberUserCode,
                    Role = member.Role,
                    Score = 7.5m,
                    IsSubmitted = true,
                    CreatedAt = now,
                    LastUpdated = now
                });
            }

            db.DefenseResults.Add(new DefenseResult
            {
                AssignmentId = assignment.AssignmentID,
                ScoreGvhd = 7.0m,
                IsLocked = false,
                CreatedAt = now,
                LastUpdated = now
            });
        }

        await db.SaveChangesAsync();
    }

    private static string ToVietnameseWeekdayLabel(DateTime date)
    {
        return date.DayOfWeek switch
        {
            DayOfWeek.Monday => "Thứ Hai",
            DayOfWeek.Tuesday => "Thứ Ba",
            DayOfWeek.Wednesday => "Thứ Tư",
            DayOfWeek.Thursday => "Thứ Năm",
            DayOfWeek.Friday => "Thứ Sáu",
            DayOfWeek.Saturday => "Thứ Bảy",
            DayOfWeek.Sunday => "Chủ nhật",
            _ => "Chưa xác định"
        };
    }
}

using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Options;
using Moq;
using ThesisManagement.Api.Application.Command.DefensePeriods.Services;
using ThesisManagement.Api.Application.Common;
using ThesisManagement.Api.Application.Common.Resilience;
using ThesisManagement.Api.Data;
using ThesisManagement.Api.DTOs.DefensePeriods;
using ThesisManagement.Api.Hubs;
using ThesisManagement.Api.Models;
using ThesisManagement.Api.Services;
using ThesisManagement.Api.Services.FileStorage;
using ThesisManagement.Api.Application.Command.Notifications;
using Xunit;

namespace ThesisManagement.Api.Tests;

public class PostDefenseWorkflowServiceTests
{
    [Fact]
    public async Task SubmitIndependentScore_ShouldCreateRevisionOnlyAfterLockSession()
    {
        await using var db = CreateDbContext();
        SeedMinimalDefenseData(db);

        var scoreService = BuildScoreService(db);

        await scoreService.SubmitIndependentScoreAsync(
            committeeId: 10,
            new LecturerScoreSubmitDto
            {
                AssignmentId = 101,
                Score = 8.5m,
                Comment = "Good",
                RevisionRequired = true,
                RevisionReason = "Bo sung chuong danh gia",
                RevisionDeadlineDays = 14
            },
            lecturerCode: "L001",
            actorUserId: 9001);

        (await db.DefenseRevisions.CountAsync(x => x.AssignmentId == 101)).Should().Be(0);

        await scoreService.LockSessionAsync(committeeId: 10, lecturerCode: "L001", actorUserId: 9001);

        var score = await db.DefenseScores.SingleAsync(x => x.AssignmentID == 101 && x.MemberLecturerCode == "L001");
        score.IsSubmitted.Should().BeTrue();
        score.RevisionRequired.Should().BeTrue();

        var result = await db.DefenseResults.SingleAsync(x => x.AssignmentId == 101);
        result.IsPassed.Should().BeTrue(); // Score 8.5 >= 5

        var revision = await db.DefenseRevisions.SingleAsync(x => x.AssignmentId == 101);
        revision.Status.Should().Be(RevisionStatus.WaitingStudent);
        revision.SubmissionCount.Should().Be(0);
        revision.RequiredRevisionContent.Should().Be("Bo sung chuong danh gia");
        revision.SubmissionDeadline.Should().NotBeNull();
        revision.SubmissionDeadline!.Value.Should().BeAfter(DateTime.UtcNow.AddDays(13));
    }

    [Fact]
    public async Task PostDefenseFlow_FromScoreLockToSecretaryApprove_ShouldTransitionCorrectly()
    {
        await using var db = CreateDbContext();
        SeedMinimalDefenseData(db);

        var scoreService = BuildScoreService(db);
        var revisionService = BuildRevisionService(db);

        await scoreService.SubmitIndependentScoreAsync(
            committeeId: 10,
            new LecturerScoreSubmitDto
            {
                AssignmentId = 101,
                Score = 7.5m,
                RevisionRequired = true,
                RevisionReason = "Cap nhat ket qua va tai lieu"
            },
            lecturerCode: "L001",
            actorUserId: 9001);

        await scoreService.LockSessionAsync(committeeId: 10, lecturerCode: "L001", actorUserId: 9001);

        var fileBytes = new byte[] { 1, 2, 3, 4 };
        await using var stream = new MemoryStream(fileBytes);
        var formFile = new FormFile(stream, 0, fileBytes.Length, "file", "revision.pdf");

        await revisionService.SubmitStudentRevisionAsync(
            new StudentRevisionSubmissionDto
            {
                AssignmentId = 101,
                RevisedContent = "Da chinh sua theo yeu cau",
                File = formFile
            },
            studentCode: "S001",
            actorUserId: 2001);

        var submitted = await db.DefenseRevisions.SingleAsync(x => x.AssignmentId == 101);
        submitted.Status.Should().Be(RevisionStatus.StudentSubmitted);
        submitted.SubmissionCount.Should().Be(1);
        submitted.RevisionFileUrl.Should().Be("/uploads/revisions/revision.pdf");

        await revisionService.ReviewBySecretaryAsync(
            submitted.Id,
            action: "APPROVE",
            comment: "Dat yeu cau",
            secretaryUserCode: "SEC001",
            actorUserId: 3001);

        var approved = await db.DefenseRevisions.SingleAsync(x => x.AssignmentId == 101);
        approved.Status.Should().Be(RevisionStatus.Approved);
        approved.SecretaryUserCode.Should().Be("SEC001");
        approved.SecretaryComment.Should().Be("Dat yeu cau");
        approved.SecretaryApprovedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task LockSession_ShouldDeleteRevisionWhenRevisionRequiredChangesFalse()
    {
        await using var db = CreateDbContext();
        SeedMinimalDefenseData(db);

        var scoreService = BuildScoreService(db);

        // First lock: with revision required
        await scoreService.SubmitIndependentScoreAsync(
            committeeId: 10,
            new LecturerScoreSubmitDto
            {
                AssignmentId = 101,
                Score = 8.5m,
                RevisionRequired = true,
                RevisionReason = "Lan 1 can chinh sua",
                RevisionDeadlineDays = 14
            },
            lecturerCode: "L001",
            actorUserId: 9001);

        await scoreService.LockSessionAsync(committeeId: 10, lecturerCode: "L001", actorUserId: 9001);

        (await db.DefenseRevisions.CountAsync(x => x.AssignmentId == 101)).Should().Be(1);

        // Reopen and submit without revision
        await scoreService.OpenSessionAsync(committeeId: 10, lecturerCode: "L001", actorUserId: 9001);

        await scoreService.SubmitIndependentScoreAsync(
            committeeId: 10,
            new LecturerScoreSubmitDto
            {
                AssignmentId = 101,
                Score = 8.5m,
                RevisionRequired = false  // Changed!
            },
            lecturerCode: "L001",
            actorUserId: 9001);

        // Lock again
        await scoreService.LockSessionAsync(committeeId: 10, lecturerCode: "L001", actorUserId: 9001);

        // Old revision should be deleted completely
        (await db.DefenseRevisions.CountAsync(x => x.AssignmentId == 101)).Should().Be(0);
    }

    private static ApplicationDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"post-defense-{Guid.NewGuid()}")
            .ConfigureWarnings(x => x.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new ApplicationDbContext(options);
    }

    private static void SeedMinimalDefenseData(ApplicationDbContext db)
    {
        var now = DateTime.UtcNow;

        db.Committees.Add(new Committee
        {
            CommitteeID = 10,
            CommitteeCode = "CMT-10",
            Status = "Ongoing",
            CreatedAt = now,
            LastUpdated = now
        });

        db.CommitteeMembers.Add(new CommitteeMember
        {
            CommitteeMemberID = 1,
            CommitteeID = 10,
            MemberLecturerCode = "L001",
            MemberUserCode = "L001",
            Role = "CT",
            CreatedAt = now,
            LastUpdated = now
        });

        db.CommitteeMembers.Add(new CommitteeMember
        {
            CommitteeMemberID = 2,
            CommitteeID = 10,
            MemberLecturerCode = "L002",
            MemberUserCode = "L002",
            Role = "UVTK",
            CreatedAt = now,
            LastUpdated = now
        });

        db.CommitteeMembers.Add(new CommitteeMember
        {
            CommitteeMemberID = 3,
            CommitteeID = 10,
            MemberLecturerCode = "L003",
            MemberUserCode = "L003",
            Role = "UVPB",
            CreatedAt = now,
            LastUpdated = now
        });

        db.Topics.Add(new Topic
        {
            TopicID = 1001,
            TopicCode = "TOP-001",
            Title = "Test Topic",
            Type = "Thesis",
            Status = "Approved",
            ProposerUserID = 2001,
            ProposerStudentCode = "S001",
            SupervisorLecturerCode = "SUP001",
            Score = 8.0m,
            DefenseTermId = 1,
            CreatedAt = now,
            LastUpdated = now
        });

        db.DefenseAssignments.Add(new DefenseAssignment
        {
            AssignmentID = 101,
            AssignmentCode = "ASG-101",
            TopicCode = "TOP-001",
            CommitteeID = 10,
            DefenseTermId = 1,
            Status = "Defending",
            CreatedAt = now,
            LastUpdated = now
        });

        db.DefenseScores.Add(new DefenseScore
        {
            ScoreID = 1,
            ScoreCode = "SC-0001",
            AssignmentID = 101,
            AssignmentCode = "ASG-101",
            MemberLecturerCode = "L001",
            MemberLecturerUserCode = "L001",
            Score = 0m,
            IsSubmitted = false,
            CreatedAt = now,
            LastUpdated = now
        });

        db.DefenseScores.Add(new DefenseScore
        {
            ScoreID = 2,
            ScoreCode = "SC-0002",
            AssignmentID = 101,
            AssignmentCode = "ASG-101",
            MemberLecturerCode = "L002",
            MemberLecturerUserCode = "L002",
            Score = 8.0m,
            IsSubmitted = true,
            CreatedAt = now,
            LastUpdated = now
        });

        db.DefenseScores.Add(new DefenseScore
        {
            ScoreID = 3,
            ScoreCode = "SC-0003",
            AssignmentID = 101,
            AssignmentCode = "ASG-101",
            MemberLecturerCode = "L003",
            MemberLecturerUserCode = "L003",
            Score = 7.5m,
            IsSubmitted = true,
            CreatedAt = now,
            LastUpdated = now
        });

        db.SaveChanges();
    }

    private static DefenseScoreWorkflowService BuildScoreService(ApplicationDbContext db)
    {
        var uow = new UnitOfWork(db);

        var clients = new Mock<IHubClients>();
        var proxy = new Mock<IClientProxy>();
        proxy.Setup(x => x.SendCoreAsync(It.IsAny<string>(), It.IsAny<object?[]>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        clients.Setup(x => x.All).Returns(proxy.Object);

        var hub = new Mock<IHubContext<ChatHub>>();
        hub.Setup(x => x.Clients).Returns(clients.Object);

        var audit = new Mock<IDefenseAuditTrailService>();
        audit.Setup(x => x.WriteAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<object?>(),
                It.IsAny<object?>(),
                It.IsAny<object?>(),
                It.IsAny<int?>(),
                It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var resilience = new DefenseResiliencePolicy(
            Options.Create(new DefenseResiliencePolicyOptions
            {
                MaxRetries = 0,
                BaseDelayMs = 1,
                OperationTimeoutMs = 5000,
                CircuitFailureThreshold = 10,
                CircuitBreakSeconds = 5
            }));

        return new DefenseScoreWorkflowService(db, uow, hub.Object, audit.Object, resilience);
    }

    private static DefenseRevisionWorkflowService BuildRevisionService(ApplicationDbContext db)
    {
        var uow = new UnitOfWork(db);

        var audit = new Mock<IDefenseAuditTrailService>();
        audit.Setup(x => x.WriteAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<object?>(),
                It.IsAny<object?>(),
                It.IsAny<object?>(),
                It.IsAny<int?>(),
                It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var storage = new Mock<IFileStorageService>();
        storage.SetupGet(x => x.MaxUploadSizeBytes).Returns(25_000_000);
        storage.Setup(x => x.UploadAsync(It.IsAny<IFormFile>(), "uploads/revisions", It.IsAny<CancellationToken>(), true))
            .ReturnsAsync(OperationResult<string>.Succeeded("/uploads/revisions/revision.pdf"));
        storage.Setup(x => x.DeleteAsync(It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(OperationResult<object?>.Succeeded(null));

        var notification = new Mock<INotificationEventPublisher>();
        notification.Setup(x => x.PublishAsync(It.IsAny<NotificationEventRequest>()))
            .Returns(Task.CompletedTask);

        return new DefenseRevisionWorkflowService(
            db,
            uow,
            audit.Object,
            storage.Object,
            notification.Object,
            Options.Create(new DefenseRevisionQuorumOptions()));
    }
}

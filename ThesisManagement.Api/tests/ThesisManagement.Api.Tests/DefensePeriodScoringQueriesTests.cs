using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using ThesisManagement.Api.Application.Common;
using ThesisManagement.Api.Application.Query.DefensePeriods;
using ThesisManagement.Api.Data;
using ThesisManagement.Api.Models;
using Xunit;

namespace ThesisManagement.Api.Tests;

public class DefensePeriodScoringQueriesTests
{
    [Fact]
    public async Task GetScoringMatrixAsync_ShouldReturnScopedAssignmentsWithComputedFields()
    {
        await using var db = CreateDbContext();
        SeedScoringScenario(db);
        var processor = new DefensePeriodQueryProcessor(db);

        var result = await processor.GetScoringMatrixAsync(periodId: 1);

        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.Should().HaveCount(2);

        var completed = result.Data.Single(x => x.AssignmentCode == "ASG-001");
        completed.CommitteeId.Should().Be(11);
        completed.RequiredCount.Should().Be(2);
        completed.SubmittedCount.Should().Be(2);
        completed.Status.Should().Be("WAITING_PUBLIC");
        completed.Variance.Should().Be(3m);
        completed.StudentCode.Should().Be("S001");
        completed.StudentName.Should().Be("Nguyen Van A");
        completed.DefenseDocuments.Should().ContainSingle();
        completed.DefenseDocuments.Single().DocumentType.Should().Be("REPORT");
        completed.DefenseDocuments.Single().FileUrl.Should().Be("/files/defense/T001-report.pdf");

        result.Data.Should().NotContain(x => x.AssignmentCode == "ASG-OUT");
    }

    [Fact]
    public async Task GetScoringMatrixAsync_ShouldAverageOnlyAvailableScores()
    {
        await using var db = CreateDbContext();
        SeedScoringScenario(db);

        var topic = db.Topics.Single(x => x.TopicCode == "T001");
        topic.Score = 9m;
        db.SaveChanges();

        var processor = new DefensePeriodQueryProcessor(db);

        var result = await processor.GetScoringMatrixAsync(periodId: 1, isForLecturer: true);

        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();

        var scored = result.Data!.Single(x => x.AssignmentCode == "ASG-001");
        scored.ScoreGvhd.Should().Be(9m);
        scored.ScoreCt.Should().Be(8m);
        scored.ScoreTk.Should().Be(5m);
        scored.ScorePb.Should().BeNull();
        scored.FinalScore.Should().Be(7.3m);
    }

    [Fact]
    public async Task GetScoringMatrixAsync_ShouldNotCalculateFinalScoreWithOnlyTwoComponentScores()
    {
        await using var db = CreateDbContext();
        SeedScoringScenario(db);

        var topic = db.Topics.Single(x => x.TopicCode == "T001");
        topic.Score = 9m;
        db.DefenseScores.RemoveRange(db.DefenseScores.Where(x => x.AssignmentID == 101 && x.MemberLecturerCode == "L002"));
        db.SaveChanges();

        var processor = new DefensePeriodQueryProcessor(db);

        var result = await processor.GetScoringMatrixAsync(periodId: 1, isForLecturer: true);

        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();

        var scored = result.Data!.Single(x => x.AssignmentCode == "ASG-001");
        scored.ScoreGvhd.Should().Be(9m);
        scored.ScoreCt.Should().Be(8m);
        scored.ScoreTk.Should().BeNull();
        scored.ScorePb.Should().BeNull();
        scored.FinalScore.Should().BeNull();
    }

    [Fact]
    public async Task GetScoringMatrixAsync_ShouldHideUnlockedScoresForAdmin()
    {
        await using var db = CreateDbContext();
        SeedScoringScenario(db);
        var processor = new DefensePeriodQueryProcessor(db);

        var result = await processor.GetScoringMatrixAsync(periodId: 1, isForLecturer: false);

        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();

        var scored = result.Data!.Single(x => x.AssignmentCode == "ASG-001");
        scored.ScoreGvhd.Should().BeNull();
        scored.ScoreCt.Should().BeNull();
        scored.ScoreTk.Should().BeNull();
        scored.ScorePb.Should().BeNull();
        scored.FinalScore.Should().BeNull();
    }

    [Fact]
    public async Task GetScoringProgressAsync_ShouldAggregateCommitteeProgress()
    {
        await using var db = CreateDbContext();
        SeedScoringScenario(db);
        var processor = new DefensePeriodQueryProcessor(db);

        var result = await processor.GetScoringProgressAsync(periodId: 1);

        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.Should().ContainSingle();

        var row = result.Data.Single();
        row.CommitteeId.Should().Be(11);
        row.TotalAssignments.Should().Be(2);
        row.CompletedAssignments.Should().Be(1);
        row.ProgressPercent.Should().Be(50m);
    }

    [Fact]
    public async Task GetScoringMatrixAsync_ShouldIncludeCommitteeMemberNames()
    {
        await using var db = CreateDbContext();
        SeedScoringScenario(db);
        var processor = new DefensePeriodQueryProcessor(db);

        var result = await processor.GetScoringMatrixAsync(periodId: 1);

        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();

        var row = result.Data!.Single(x => x.AssignmentCode == "ASG-001");
        row.CommitteeChairCode.Should().Be("L001");
        row.CommitteeChairName.Should().Be("Chu Tich Nguyen");
        row.Chair.Should().Be("L001");
        row.ChairName.Should().Be("Chu Tich Nguyen");
    }

    [Fact]
    public async Task GetScoringAlertsAsync_ShouldReturnVarianceAndIncompleteAlerts()
    {
        await using var db = CreateDbContext();
        SeedScoringScenario(db);
        var processor = new DefensePeriodQueryProcessor(db);

        var result = await processor.GetScoringAlertsAsync(periodId: 1);

        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.Should().HaveCount(2);

        result.Data.Should().ContainSingle(x =>
            x.Type == "VARIANCE" &&
            x.AssignmentCode == "ASG-001" &&
            x.AlertCode == DefenseUcErrorCodes.Scoring.VarianceAlert &&
            x.Threshold == 2.0m &&
            x.Value == 3m);

        result.Data.Should().ContainSingle(x =>
            x.Type == "INCOMPLETE" &&
            x.AssignmentCode == "ASG-002" &&
            x.AlertCode == DefenseUcErrorCodes.Scoring.IncompleteAlert &&
            x.Threshold == 2m &&
            x.Value == 1m);
    }

    private static ApplicationDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"scoring-tests-{Guid.NewGuid()}")
            .Options;

        return new ApplicationDbContext(options);
    }

    private static void SeedScoringScenario(ApplicationDbContext db)
    {
        var now = DateTime.UtcNow;

        db.DefenseTerms.Add(new DefenseTerm
        {
            DefenseTermId = 1,
            Name = "Term 1",
            StartDate = DateTime.UtcNow.Date,
            Status = "Draft",
            CreatedAt = DateTime.UtcNow,
            LastUpdated = DateTime.UtcNow,
            ConfigJson = "{\"CouncilIds\":[11]}"
        });

        db.Committees.AddRange(
            new Committee
            {
                CommitteeID = 11,
                CommitteeCode = "CMT-11",
                Name = "Council 11",
                Room = "R-101",
                Status = "Ready",
                CreatedAt = DateTime.UtcNow,
                LastUpdated = DateTime.UtcNow
            },
            new Committee
            {
                CommitteeID = 12,
                CommitteeCode = "CMT-12",
                Name = "Council 12",
                Room = "R-102",
                Status = "Ready",
                CreatedAt = DateTime.UtcNow,
                LastUpdated = DateTime.UtcNow
            });

        db.CommitteeMembers.AddRange(
            new CommitteeMember
            {
                CommitteeMemberID = 1,
                CommitteeID = 11,
                CommitteeCode = "CMT-11",
                MemberLecturerCode = "L001",
                Role = "CT"
            },
            new CommitteeMember
            {
                CommitteeMemberID = 2,
                CommitteeID = 11,
                CommitteeCode = "CMT-11",
                MemberLecturerCode = "L002",
                Role = "UVTK"
            });

        db.Topics.AddRange(
            new Topic
            {
                TopicID = 1,
                TopicCode = "T001",
                Title = "AI Topic",
                Type = "Research",
                ProposerUserID = 1,
                ProposerStudentCode = "S001",
                Status = "Eligible"
            },
            new Topic
            {
                TopicID = 2,
                TopicCode = "T002",
                Title = "ML Topic",
                Type = "Research",
                ProposerUserID = 2,
                ProposerStudentCode = "S002",
                Status = "Eligible"
            },
            new Topic
            {
                TopicID = 3,
                TopicCode = "T003",
                Title = "Out of scope",
                Type = "Research",
                ProposerUserID = 3,
                ProposerStudentCode = "S003",
                Status = "Eligible"
            });

        db.StudentProfiles.AddRange(
            new StudentProfile
            {
                StudentProfileID = 1,
                StudentCode = "S001",
                UserID = 1,
                FullName = "Nguyen Van A"
            },
            new StudentProfile
            {
                StudentProfileID = 2,
                StudentCode = "S002",
                UserID = 2,
                FullName = "Tran Thi B"
            },
            new StudentProfile
            {
                StudentProfileID = 3,
                StudentCode = "S003",
                UserID = 3,
                FullName = "Le Van C"
            });

        db.LecturerProfiles.AddRange(
            new LecturerProfile
            {
                LecturerProfileID = 1,
                LecturerCode = "L001",
                FullName = "Chu Tich Nguyen",
                Organization = "Faculty A"
            },
            new LecturerProfile
            {
                LecturerProfileID = 2,
                LecturerCode = "L002",
                FullName = "Thu Ky Tran",
                Organization = "Faculty B"
            });

        db.DefenseAssignments.AddRange(
            new DefenseAssignment
            {
                AssignmentID = 101,
                AssignmentCode = "ASG-001",
                CommitteeID = 11,
                CommitteeCode = "CMT-11",
                TopicCode = "T001",
                Session = 1,
                OrderIndex = 1,
                CreatedAt = DateTime.UtcNow,
                LastUpdated = DateTime.UtcNow
            },
            new DefenseAssignment
            {
                AssignmentID = 102,
                AssignmentCode = "ASG-002",
                CommitteeID = 11,
                CommitteeCode = "CMT-11",
                TopicCode = "T002",
                Session = 1,
                OrderIndex = 2,
                CreatedAt = DateTime.UtcNow,
                LastUpdated = DateTime.UtcNow
            },
            new DefenseAssignment
            {
                AssignmentID = 999,
                AssignmentCode = "ASG-OUT",
                CommitteeID = 12,
                CommitteeCode = "CMT-12",
                TopicCode = "T003",
                Session = 1,
                OrderIndex = 1,
                CreatedAt = DateTime.UtcNow,
                LastUpdated = DateTime.UtcNow
            });

        db.DefenseScores.AddRange(
            new DefenseScore
            {
                ScoreID = 1,
                ScoreCode = "SC-1",
                AssignmentID = 101,
                AssignmentCode = "ASG-001",
                MemberLecturerCode = "L001",
                Score = 8m,
                IsSubmitted = true
            },
            new DefenseScore
            {
                ScoreID = 2,
                ScoreCode = "SC-2",
                AssignmentID = 101,
                AssignmentCode = "ASG-001",
                MemberLecturerCode = "L002",
                Score = 5m,
                IsSubmitted = true
            },
            new DefenseScore
            {
                ScoreID = 3,
                ScoreCode = "SC-3",
                AssignmentID = 102,
                AssignmentCode = "ASG-002",
                MemberLecturerCode = "L001",
                Score = 7m,
                IsSubmitted = true
            },
            new DefenseScore
            {
                ScoreID = 4,
                ScoreCode = "SC-4",
                AssignmentID = 102,
                AssignmentCode = "ASG-002",
                MemberLecturerCode = "L002",
                Score = 0m,
                IsSubmitted = false
            });

        db.DefenseDocuments.AddRange(
            new DefenseDocument
            {
                DocumentId = 201,
                AssignmentId = 101,
                DocumentType = "REPORT",
                FileUrl = "/files/defense/T001-report.pdf",
                GeneratedAt = now.AddMinutes(-10)
            },
            new DefenseDocument
            {
                DocumentId = 202,
                AssignmentId = 102,
                DocumentType = "REPORT",
                FileUrl = "/files/defense/T002-report.pdf",
                GeneratedAt = now.AddMinutes(-9)
            });

        db.SaveChanges();
    }
}

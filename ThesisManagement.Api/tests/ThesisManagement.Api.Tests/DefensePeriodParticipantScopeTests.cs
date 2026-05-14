using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using ThesisManagement.Api.Application.Query.DefensePeriods;
using ThesisManagement.Api.Data;
using ThesisManagement.Api.Models;
using Xunit;

namespace ThesisManagement.Api.Tests;

public class DefensePeriodParticipantScopeTests
{
    [Fact]
    public async Task GetStudentsAsync_ShouldUseDefenseTermStudentsAsScope()
    {
        await using var db = CreateDbContext();
        SeedDefensePeriodParticipants(db);

        var processor = new DefensePeriodQueryProcessor(db);

        var result = await processor.GetStudentsAsync(1, eligibleOnly: false);

        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.Should().ContainSingle(x => x.StudentCode == "S001");
        result.Data!.Should().ContainSingle(x => x.StudentCode == "S002");
        result.Data!.Should().NotContain(x => x.StudentCode == "S999");
    }

    [Fact]
    public async Task GetLecturerCapabilitiesAsync_ShouldUseDefenseTermLecturersAsScope()
    {
        await using var db = CreateDbContext();
        SeedDefensePeriodParticipants(db);

        var processor = new DefensePeriodQueryProcessor(db);

        var result = await processor.GetLecturerCapabilitiesAsync(1);

        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.Should().ContainSingle(x => x.LecturerCode == "L001");
        result.Data!.Should().ContainSingle(x => x.LecturerCode == "L002");
        result.Data!.Should().NotContain(x => x.LecturerCode == "L999");
    }

    private static ApplicationDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"participant-scope-tests-{Guid.NewGuid()}")
            .Options;

        return new ApplicationDbContext(options);
    }

    private static void SeedDefensePeriodParticipants(ApplicationDbContext db)
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

        db.DefenseTermStudents.AddRange(
            new DefenseTermStudent
            {
                DefenseTermStudentID = 1,
                DefenseTermId = 1,
                StudentProfileID = 1,
                StudentCode = "S001",
                UserCode = "U001",
                CreatedAt = now,
                LastUpdated = now
            },
            new DefenseTermStudent
            {
                DefenseTermStudentID = 2,
                DefenseTermId = 1,
                StudentProfileID = 2,
                StudentCode = "S002",
                UserCode = "U002",
                CreatedAt = now,
                LastUpdated = now
            },
            new DefenseTermStudent
            {
                DefenseTermStudentID = 3,
                DefenseTermId = 2,
                StudentProfileID = 3,
                StudentCode = "S999",
                UserCode = "U999",
                CreatedAt = now,
                LastUpdated = now
            });

        db.DefenseTermLecturers.AddRange(
            new DefenseTermLecturer
            {
                DefenseTermLecturerID = 1,
                DefenseTermId = 1,
                LecturerProfileID = 1,
                LecturerCode = "L001",
                UserCode = "LU001",
                IsPrimary = true,
                CreatedAt = now,
                LastUpdated = now
            },
            new DefenseTermLecturer
            {
                DefenseTermLecturerID = 2,
                DefenseTermId = 1,
                LecturerProfileID = 2,
                LecturerCode = "L002",
                UserCode = "LU002",
                IsPrimary = false,
                CreatedAt = now,
                LastUpdated = now
            },
            new DefenseTermLecturer
            {
                DefenseTermLecturerID = 3,
                DefenseTermId = 2,
                LecturerProfileID = 3,
                LecturerCode = "L999",
                UserCode = "LU999",
                IsPrimary = true,
                CreatedAt = now,
                LastUpdated = now
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
                StudentCode = "S999",
                UserID = 3,
                FullName = "Out Of Period"
            });

        db.LecturerProfiles.AddRange(
            new LecturerProfile
            {
                LecturerProfileID = 1,
                LecturerCode = "L001",
                FullName = "Lecturer 1"
            },
            new LecturerProfile
            {
                LecturerProfileID = 2,
                LecturerCode = "L002",
                FullName = "Lecturer 2"
            },
            new LecturerProfile
            {
                LecturerProfileID = 3,
                LecturerCode = "L999",
                FullName = "Out Of Period Lecturer"
            });

        db.Topics.AddRange(
            new Topic
            {
                TopicID = 1,
                TopicCode = "T001",
                Title = "Topic 1",
                Type = "Research",
                ProposerUserID = 1,
                ProposerStudentCode = "S001",
                SupervisorLecturerCode = "L001",
                DefenseTermId = 1,
                Status = "Eligible"
            },
            new Topic
            {
                TopicID = 2,
                TopicCode = "T002",
                Title = "Topic 2",
                Type = "Research",
                ProposerUserID = 2,
                ProposerStudentCode = "S002",
                SupervisorLecturerCode = "L002",
                DefenseTermId = 1,
                Status = "Eligible"
            },
            new Topic
            {
                TopicID = 3,
                TopicCode = "T003",
                Title = "Topic Out",
                Type = "Research",
                ProposerUserID = 3,
                ProposerStudentCode = "S999",
                SupervisorLecturerCode = "L999",
                DefenseTermId = 2,
                Status = "Eligible"
            });

        db.ProgressMilestones.AddRange(
            new ProgressMilestone
            {
                MilestoneID = 1,
                MilestoneCode = "MS-1",
                TopicID = 1,
                TopicCode = "T001",
                MilestoneTemplateCode = "MS_PROG1",
                State = "Eligible",
                CreatedAt = now,
                LastUpdated = now
            },
            new ProgressMilestone
            {
                MilestoneID = 2,
                MilestoneCode = "MS-2",
                TopicID = 2,
                TopicCode = "T002",
                MilestoneTemplateCode = "MS_PROG1",
                State = "Eligible",
                CreatedAt = now,
                LastUpdated = now
            },
            new ProgressMilestone
            {
                MilestoneID = 3,
                MilestoneCode = "MS-3",
                TopicID = 3,
                TopicCode = "T003",
                MilestoneTemplateCode = "MS_PROG1",
                State = "Eligible",
                CreatedAt = now,
                LastUpdated = now
            });

        db.SaveChanges();
    }
}
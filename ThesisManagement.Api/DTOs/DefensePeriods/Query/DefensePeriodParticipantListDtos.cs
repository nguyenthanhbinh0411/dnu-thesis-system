using System.ComponentModel.DataAnnotations;

namespace ThesisManagement.Api.DTOs.DefensePeriods
{
    public class LecturerDefenseListItemDto
    {
        public int LecturerProfileID { get; set; }
        public string LecturerCode { get; set; } = string.Empty;
        public string? UserCode { get; set; }
        public string? DepartmentCode { get; set; }
        public string? Degree { get; set; }
        public int GuideQuota { get; set; }
        public int DefenseQuota { get; set; }
        public int CurrentGuidingCount { get; set; }
        public string? Gender { get; set; }
        public DateTime? DateOfBirth { get; set; }
        public string? Email { get; set; }
        public string? PhoneNumber { get; set; }
        public string? ProfileImage { get; set; }
        public string? Address { get; set; }
        public string? Notes { get; set; }
        public string? FullName { get; set; }
        public DateTime? CreatedAt { get; set; }
        public DateTime? LastUpdated { get; set; }

        public List<string> Tags { get; set; } = new();
        public List<string> TagCodes { get; set; } = new();

        public bool IsInCapabilityPool { get; set; }
        public bool IsSupervisor { get; set; }
        public bool IsCommitteeMember { get; set; }
        public int GuidedTopicCount { get; set; }
        public int CommitteeCount { get; set; }
        public List<string> CommitteeRoles { get; set; } = new();
        public List<string> Warnings { get; set; } = new();
    }

    public class StudentDefenseListItemDto
    {
        public int StudentProfileID { get; set; }
        public string StudentCode { get; set; } = string.Empty;
        public string? UserCode { get; set; }
        public string? DepartmentCode { get; set; }
        public string? ClassCode { get; set; }
        public string? FacultyCode { get; set; }
        public string? StudentImage { get; set; }
        public decimal? GPA { get; set; }
        public string? AcademicStanding { get; set; }
        public string? Gender { get; set; }
        public DateTime? DateOfBirth { get; set; }
        public string? PhoneNumber { get; set; }
        public string? StudentEmail { get; set; }
        public string? Address { get; set; }
        public int? EnrollmentYear { get; set; }
        public string? Status { get; set; }
        public int? GraduationYear { get; set; }
        public string? Notes { get; set; }
        public string? FullName { get; set; }
        public DateTime? CreatedAt { get; set; }
        public DateTime? LastUpdated { get; set; }

        public string? TopicCode { get; set; }
        public string TopicTitle { get; set; } = string.Empty;
        public string? TopicStatus { get; set; }
        public string? SupervisorCode { get; set; }
        public string SupervisorName { get; set; } = string.Empty;
        public List<string> TopicTags { get; set; } = new();

        public bool IsEligibleForDefense { get; set; }
        public bool IsAssignedToCouncil { get; set; }
        public int? CommitteeId { get; set; }
        public string? CommitteeCode { get; set; }
        public int? AssignmentId { get; set; }
        public string Source { get; set; } = string.Empty;
        public string? Error { get; set; }
    }

    public class LecturerDefenseBulkCreateRequestDto
    {
        [Range(1, int.MaxValue)]
        public int DefenseTermId { get; set; }

        public List<int> LecturerProfileIds { get; set; } = new();
        public List<string> LecturerCodes { get; set; } = new();

        public bool IsPrimary { get; set; }
    }

    public class StudentDefenseBulkCreateRequestDto
    {
        [Range(1, int.MaxValue)]
        public int DefenseTermId { get; set; }

        public List<int> StudentProfileIds { get; set; } = new();
        public List<string> StudentCodes { get; set; } = new();
    }

    public class DefenseParticipantBulkOperationItemDto
    {
        public string Key { get; set; } = string.Empty;
        public bool Success { get; set; }
        public int? Id { get; set; }
        public string? Message { get; set; }
    }

    public class DefenseParticipantBulkOperationResultDto
    {
        public int Total { get; set; }
        public int Succeeded { get; set; }
        public int Failed { get; set; }
        public List<DefenseParticipantBulkOperationItemDto> Items { get; set; } = new();
    }
}

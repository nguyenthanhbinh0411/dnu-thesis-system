using System.ComponentModel.DataAnnotations;

namespace ThesisManagement.Api.DTOs.DefensePeriods
{
    public class DefensePeriodCreateDto
    {
        public string? TermCode { get; set; }

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }
        public string? AcademicYear { get; set; }
        public string? Semester { get; set; }

        [Required]
        public DateTime StartDate { get; set; }

        public DateTime? EndDate { get; set; }

        [MaxLength(30)]
        public string? Status { get; set; }
    }

    public class DefensePeriodUpdateDto
    {
        public string? TermCode { get; set; }

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }
        public string? AcademicYear { get; set; }
        public string? Semester { get; set; }

        [Required]
        public DateTime StartDate { get; set; }

        public DateTime? EndDate { get; set; }

        [MaxLength(30)]
        public string? Status { get; set; }
    }

    public class DefensePeriodListItemDto
    {
        public int DefenseTermId { get; set; }
        public string? TermCode { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? AcademicYear { get; set; }
        public string? Semester { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime LastUpdated { get; set; }
    }

    public class DefensePeriodDetailDto
    {
        public int DefenseTermId { get; set; }
        public string? TermCode { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? AcademicYear { get; set; }
        public string? Semester { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime LastUpdated { get; set; }

        public int CouncilCount { get; set; }
        public int AssignmentCount { get; set; }
        public int ResultCount { get; set; }
        public int RevisionCount { get; set; }

        public DefensePeriodConfigDto? Config { get; set; }
        public DefensePeriodStateDto? State { get; set; }
    }

    public class DefensePeriodLifecycleRequestDto
    {
        [Required]
        public string Action { get; set; } = string.Empty;

        public string? IdempotencyKey { get; set; }
    }
}

using System.ComponentModel.DataAnnotations;

namespace ThesisManagement.Api.DTOs.DefensePeriods
{
    public class DefensePeriodParticipantsQueryDto
    {
        [Required]
        public string Kind { get; set; } = "student";

        // scope: read/write table DEFENSETERMSTUDENTS/DEFENSETERMLECTURERS
        // runtime: read participant projection currently used in setup/execution flow
        public string View { get; set; } = "scope";

        // For runtime view only.
        public string Source { get; set; } = "all";

        public string? Keyword { get; set; }

        [Range(1, 500)]
        public int Page { get; set; } = 1;

        [Range(1, 500)]
        public int Size { get; set; } = 50;

        // Lecturer scope filters.
        public bool? IsPrimary { get; set; }
    }

    public class DefensePeriodParticipantUpsertRequestDto
    {
        [Required]
        public string Kind { get; set; } = string.Empty;

        // null => create, has value => update
        public int? Id { get; set; }

        public DefensePeriodStudentScopeInputDto? Student { get; set; }
        public DefensePeriodLecturerScopeInputDto? Lecturer { get; set; }
    }

    public class DefensePeriodStudentScopeInputDto
    {
        public int? StudentProfileID { get; set; }
        public string? StudentCode { get; set; }
        public string? UserCode { get; set; }
    }

    public class DefensePeriodLecturerScopeInputDto
    {
        public int? LecturerProfileID { get; set; }
        public string? LecturerCode { get; set; }
        public string? UserCode { get; set; }
        public bool? IsPrimary { get; set; }
    }
}

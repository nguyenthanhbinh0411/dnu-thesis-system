using System.ComponentModel.DataAnnotations;

namespace ThesisManagement.Api.DTOs.DefensePeriods
{
    public class DefensePeriodOperationsSnapshotQueryDto
    {
        public int? CommitteeId { get; set; }

        public int? RevisionId { get; set; }

        public string? RevisionStatus { get; set; }

        public string? RevisionKeyword { get; set; }

        public bool? IsPassed { get; set; }
        public string? Template { get; set; }
        public List<string>? SelectedFields { get; set; }

        [Range(1, 200)]
        public int RevisionPage { get; set; } = 1;

        [Range(1, 200)]
        public int RevisionSize { get; set; } = 50;

        [Range(1, 500)]
        public int AuditSize { get; set; } = 100;
    }
}
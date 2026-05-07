namespace ThesisManagement.Api.DTOs.DefensePeriods;

/// <summary>
/// DTO for a single row in committee roster export
/// Represents a student assigned to a committee
/// </summary>
public class CommitteeRosterRowDto
{
    public int RowNumber { get; set; }
    
    public string? StudentCode { get; set; }
    
    public string? StudentFullName { get; set; }
    
    public string? AdvisorDisplay { get; set; }
    
    public string? CommitteeCode { get; set; }
    
    public string? ChairDisplay { get; set; }
    
    public string? ChairWorkplace { get; set; }
    
    public string? SecretaryDisplay { get; set; }
    
    public string? SecretaryWorkplace { get; set; }
    
    public string? ReviewerDisplay { get; set; }
    
    public string? ReviewerWorkplace { get; set; }
    
    public string? DefenseSession { get; set; }
    
    public string? DefenseDate { get; set; }
}

/// <summary>
/// DTO for committee roster export snapshot
/// Groups committees by ID and contains all required data
/// </summary>
public class CommitteeRosterExportSnapshotDto
{
    public List<CommitteeRosterRowDto> Rows { get; set; } = new();
    
    public int TotalCommittees { get; set; }
    
    public DateTime? ExportedAt { get; set; }
}

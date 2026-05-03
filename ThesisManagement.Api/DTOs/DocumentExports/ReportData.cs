namespace ThesisManagement.Api.DTOs.DocumentExports;

public sealed class ReportData
{
    public string? CommitteeCode { get; set; }

    public string? DefenseDate { get; set; }

    public string? DefenseDay { get; set; }

    public string? DefenseMonth { get; set; }

    public string? DefenseYear { get; set; }

    public string? MajorCode { get; set; }

    public string? MajorName { get; set; }

    public string? TopicTitle { get; set; }

    public string? FinalScoreNumber { get; set; }

    public string? FinalScoreText { get; set; }

    public string? MeetingEndTime { get; set; }

    public string? PresentMemberCount { get; set; }

    public string? AbsentMemberCount { get; set; }

    public string? ReviewerQuestions { get; set; }

    public string? StudentAnswers { get; set; }

    public string? Strengths { get; set; }

    public string? Weaknesses { get; set; }

    public string? Recommendations { get; set; }

    public string? ScoreCTNote { get; set; }

    public string? ScoreCTNumber { get; set; }

    public string? ScoreCTText { get; set; }

    public string? ScorePBNote { get; set; }

    public string? ScorePBNumber { get; set; }

    public string? ScorePBText { get; set; }

    public string? ScoreTKNote { get; set; }

    public string? ScoreTKNumber { get; set; }

    public string? ScoreTKText { get; set; }

    public string? ReviewerLimitations { get; set; }

    public string? ReviewerMethodologyReliability { get; set; }

    public string? ReviewerNovelty { get; set; }

    public string? ReviewerOverallConclusion { get; set; }

    public string? ReviewerResultsContent { get; set; }

    public string? ReviewerWorkplace { get; set; }

    public string? SecretarySignature { get; set; }

    public string? StudentCode { get; set; }

    public string? StudentFullName { get; set; }

    public string? ClassName { get; set; }

    public string? CourseName { get; set; }

    public string? ChairMemberDisplay { get; set; }

    public string? ReviewerMemberDisplay { get; set; }

    public string? SecretaryMemberDisplay { get; set; }

    public string? SupervisorDisplay { get; set; }

    public string? ReviewerDisplay { get; set; }

    public string? Chapter1Content { get; set; }

    public string? Chapter2Content { get; set; }

    public string? Chapter3Content { get; set; }

    public string? ChapterNContent { get; set; }

    public Student? Student { get; set; }

    public CommitteeMember? ChairMember { get; set; }

    public CommitteeMember? ReviewerMember { get; set; }

    public CommitteeMember? SecretaryMember { get; set; }

    public CommitteeMember? Supervisor { get; set; }

    public List<string> ChapterContents { get; } = new();

    public Dictionary<string, string?> AdditionalTokens { get; } = new(StringComparer.OrdinalIgnoreCase);
}

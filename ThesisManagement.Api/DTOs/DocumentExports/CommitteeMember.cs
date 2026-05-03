namespace ThesisManagement.Api.DTOs.DocumentExports;

public sealed class CommitteeMember
{
    public string? FullName { get; set; }

    public string? Degree { get; set; }

    public string? Title { get; set; }

    public string? Workplace { get; set; }

    public string? Role { get; set; }

    public string GetDisplayName()
    {
        var parts = new List<string>();

        if (!string.IsNullOrWhiteSpace(Degree))
        {
            parts.Add(Degree.Trim());
        }

        if (!string.IsNullOrWhiteSpace(Title))
        {
            parts.Add(Title.Trim());
        }

        if (!string.IsNullOrWhiteSpace(FullName))
        {
            parts.Add(FullName.Trim());
        }

        var displayName = string.Join(' ', parts);

        if (!string.IsNullOrWhiteSpace(Workplace))
        {
            displayName = string.IsNullOrWhiteSpace(displayName)
                ? Workplace.Trim()
                : $"{displayName} - {Workplace.Trim()}";
        }

        return displayName;
    }
}

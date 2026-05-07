using FluentAssertions;
using ThesisManagement.Api.DTOs.DocumentExports;
using Xunit;

namespace ThesisManagement.Api.Tests;

public class DocumentExportDisplayNameTests
{
    [Fact]
    public void GetDisplayName_ShouldIncludeDegreeTitleAndFullName_WithoutWorkplace()
    {
        var member = new CommitteeMember
        {
            Degree = "Tiến sĩ",
            Title = "PGS",
            FullName = "Vũ Đức Long",
            Workplace = "Trường Đại học Đại Nam"
        };

        member.GetDisplayName().Should().Be("Tiến sĩ PGS Vũ Đức Long");
    }

    [Fact]
    public void GetDisplayName_ShouldReturnFullName_WhenNoDegreeOrTitle()
    {
        var member = new CommitteeMember
        {
            FullName = "Trần Thị Bình",
            Workplace = "Trường Đại học Đại Nam"
        };

        member.GetDisplayName().Should().Be("Trần Thị Bình");
    }
}
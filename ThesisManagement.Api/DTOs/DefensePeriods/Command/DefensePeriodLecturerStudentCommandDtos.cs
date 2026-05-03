using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;

namespace ThesisManagement.Api.DTOs.DefensePeriods
{
    public class LecturerScoreSubmitDto
    {
        [Range(1, int.MaxValue)]
        public int AssignmentId { get; set; }

        public decimal Score { get; set; }

        public string? Comment { get; set; }
    }

    public class ReopenScoreRequestDto
    {
        [Range(1, int.MaxValue)]
        public int AssignmentId { get; set; }
        public string Reason { get; set; } = string.Empty;
    }

    public class StudentRevisionSubmissionDto
    {
        [Range(1, int.MaxValue)]
        public int AssignmentId { get; set; }
        public string? RevisedContent { get; set; }
        public IFormFile? File { get; set; }
    }

    public class RejectRevisionRequestDto
    {
        [Required]
        public string Reason { get; set; } = string.Empty;
    }

    public class UpdateLecturerMinutesDto
    {
        public int AssignmentId { get; set; }
        public string? SummaryContent { get; set; }
        public string? ReviewerComments { get; set; }
        public string? CommitteeMemberComments { get; set; }
        public string? QnaDetails { get; set; }
        public List<MinuteQuestionAnswerDto> QuestionAnswers { get; set; } = new();
        public string? Strengths { get; set; }
        public string? Weaknesses { get; set; }
        public string? Recommendations { get; set; }
        public List<MinuteChapterInputDto> ChapterContents { get; set; } = new();
        public string? CouncilDiscussionConclusion { get; set; }
        public string? ChairConclusion { get; set; }
        public ReviewerStructuredSectionsDto? ReviewerSections { get; set; }
    }

    public class MinuteChapterInputDto
    {
        public string ChapterTitle { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
    }

    public class MinuteQuestionAnswerDto
    {
        public string Question { get; set; } = string.Empty;
        public string Answer { get; set; } = string.Empty;
    }

    public class ReviewerStructuredSectionsDto
    {
        public string? Necessity { get; set; }
        public string? Novelty { get; set; }
        public string? MethodologyReliability { get; set; }
        public string? ResultsContent { get; set; }
        public string? Limitations { get; set; }
        public string? Suggestions { get; set; }
        public string? OverallConclusion { get; set; }
    }

    public class LecturerMinutesUpsertRequestDto
    {
        [Range(1, int.MaxValue)]
        public int CommitteeId { get; set; }

        [Required]
        public UpdateLecturerMinutesDto Data { get; set; } = new();
    }

    public class LecturerScoringActionRequestDto
    {
        [Required]
        public string Action { get; set; } = string.Empty;

        [Range(1, int.MaxValue)]
        public int CommitteeId { get; set; }

        public LecturerScoreSubmitDto? Score { get; set; }

        public ReopenScoreRequestDto? Reopen { get; set; }

        public string? IdempotencyKey { get; set; }
    }

    public class LecturerRevisionActionRequestDto
    {
        [Required]
        public string Action { get; set; } = string.Empty;

        [Range(1, int.MaxValue)]
        public int RevisionId { get; set; }

        public RejectRevisionRequestDto? Reject { get; set; }

        public string? IdempotencyKey { get; set; }
    }
}

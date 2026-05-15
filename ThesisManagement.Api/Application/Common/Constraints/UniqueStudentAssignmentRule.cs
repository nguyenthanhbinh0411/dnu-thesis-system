using Microsoft.EntityFrameworkCore;
using ThesisManagement.Api.Data;

namespace ThesisManagement.Api.Application.Common.Constraints
{
    public sealed class UniqueStudentAssignmentRule : ICommitteeConstraintRule
    {
        private readonly ApplicationDbContext _db;

        public UniqueStudentAssignmentRule(ApplicationDbContext db)
        {
            _db = db;
        }

        public string RuleKey => "UniqueStudentAssignment";

        public async Task ValidateAsync(CommitteeConstraintContext context, CancellationToken cancellationToken)
        {
            var normalizedTopicCodes = context.TopicCodes
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (normalizedTopicCodes.Count == 0)
            {
                return;
            }

            var currentTopics = await _db.Topics.AsNoTracking()
                .Where(x => normalizedTopicCodes.Contains(x.TopicCode) && x.ProposerStudentCode != null)
                .Select(x => new { x.TopicCode, x.ProposerStudentCode })
                .ToListAsync(cancellationToken);

            var studentCodes = currentTopics
                .Where(x => !string.IsNullOrWhiteSpace(x.ProposerStudentCode))
                .Select(x => x.ProposerStudentCode!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (studentCodes.Count == 0)
            {
                return;
            }

            var conflict = await _db.DefenseAssignments.AsNoTracking()
                .Where(x => x.CommitteeID.HasValue && x.CommitteeID != context.CommitteeId && x.TopicCode != null)
                .Join(_db.Topics.AsNoTracking(), a => a.TopicCode!, t => t.TopicCode, (a, t) => new { a.CommitteeID, a.TopicCode, t.ProposerStudentCode })
                .FirstOrDefaultAsync(x => x.ProposerStudentCode != null && studentCodes.Contains(x.ProposerStudentCode), cancellationToken);

            if (conflict != null)
            {
                throw new BusinessRuleException(
                    "Một sinh viên chỉ được có 1 assignment trong toàn kỳ đồ án tốt nghiệp.",
                    DefenseUcErrorCodes.Constraints.DuplicateStudentAssignment,
                    new { conflict.CommitteeID, conflict.TopicCode, conflict.ProposerStudentCode });
            }
        }
    }
}

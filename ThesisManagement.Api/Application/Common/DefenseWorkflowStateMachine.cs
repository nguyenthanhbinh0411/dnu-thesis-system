using ThesisManagement.Api.Models;

namespace ThesisManagement.Api.Application.Common
{
    public static class DefenseWorkflowStateMachine
    {
        private static readonly IReadOnlyDictionary<CommitteeStatus, IReadOnlyList<CommitteeStatus>> CommitteeTransitions =
            new Dictionary<CommitteeStatus, IReadOnlyList<CommitteeStatus>>
        {
            { CommitteeStatus.Draft, new[] { CommitteeStatus.Ready } },
            { CommitteeStatus.Ready, new[] { CommitteeStatus.Ongoing } },
            { CommitteeStatus.Ongoing, new[] { CommitteeStatus.Completed } },
            { CommitteeStatus.Completed, new[] { CommitteeStatus.Finalized } },
            { CommitteeStatus.Finalized, new[] { CommitteeStatus.Published } },
            { CommitteeStatus.Published, Array.Empty<CommitteeStatus>() }
        };

        private static readonly IReadOnlyDictionary<DefenseTermStatus, IReadOnlyList<DefenseTermStatus>> DefenseTermTransitions =
            new Dictionary<DefenseTermStatus, IReadOnlyList<DefenseTermStatus>>
        {
            { DefenseTermStatus.Draft, new[] { DefenseTermStatus.Registration } },
            { DefenseTermStatus.Registration, new[] { DefenseTermStatus.Assignment } },
            { DefenseTermStatus.Assignment, new[] { DefenseTermStatus.ProgressTracking } },
            { DefenseTermStatus.ProgressTracking, new[] { DefenseTermStatus.CommitteePreparation } },
            { DefenseTermStatus.CommitteePreparation, new[] { DefenseTermStatus.Running } },
            { DefenseTermStatus.Running, new[] { DefenseTermStatus.ScoringLocked } },
            { DefenseTermStatus.ScoringLocked, new[] { DefenseTermStatus.Finalization } },
            { DefenseTermStatus.Finalization, new[] { DefenseTermStatus.Published, DefenseTermStatus.Closed } },
            { DefenseTermStatus.Published, new[] { DefenseTermStatus.Closed, DefenseTermStatus.Archived } },
            { DefenseTermStatus.Closed, new[] { DefenseTermStatus.Archived } },
            { DefenseTermStatus.Archived, Array.Empty<DefenseTermStatus>() }
        };

        public static IReadOnlyDictionary<CommitteeStatus, IReadOnlyList<CommitteeStatus>> AllowedCommitteeTransitions => CommitteeTransitions;

        public static Dictionary<string, List<string>> GetCommitteeTransitionMap()
        {
            return CommitteeTransitions.ToDictionary(
                x => x.Key.ToString(),
                x => x.Value.Select(v => v.ToString()).ToList(),
                StringComparer.OrdinalIgnoreCase);
        }

        public static CommitteeStatus ParseCommitteeStatus(string? value)
        {
            if (Enum.TryParse<CommitteeStatus>(value, true, out var status))
            {
                return status;
            }

            return CommitteeStatus.Draft;
        }

        public static string ToValue(CommitteeStatus status) => status.ToString();
        public static string ToValue(DefenseTermStatus status) => status.ToString();

        public static void EnsureCommitteeTransition(CommitteeStatus from, CommitteeStatus to, string errorCode)
        {
            if (from == to)
            {
                return;
            }

            var isValid = CommitteeTransitions.TryGetValue(from, out var nextStates)
                && nextStates.Contains(to);

            if (!isValid)
            {
                throw new BusinessRuleException($"Không thể chuyển trạng thái hội đồng từ {from} sang {to}.", errorCode);
            }
        }

        public static void EnsurePeriodTransition(DefenseTermStatus from, DefenseTermStatus to, string errorCode)
        {
            if (from == to)
            {
                return;
            }

            var isValid = DefenseTermTransitions.TryGetValue(from, out var nextStates)
                && nextStates.Contains(to);

            if (!isValid)
            {
                throw new BusinessRuleException($"Không thể chuyển trạng thái đợt đồ án từ {from} sang {to}.", errorCode);
            }
        }

        public static DefenseTermStatus ParsePeriodStatus(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return DefenseTermStatus.Draft;
            }

            if (Enum.TryParse<DefenseTermStatus>(value, true, out var status))
            {
                return status;
            }

            // Legacy mappings or aliases
            var normalized = value.Trim().ToUpperInvariant();
            if (normalized == "FINALIZED") return DefenseTermStatus.Finalization;
            if (normalized == "ARCHIVED") return DefenseTermStatus.Archived;

            return DefenseTermStatus.Draft;
        }

        public static string ToValue(AssignmentStatus status) => status.ToString();

        public static AssignmentStatus ParseAssignmentStatus(string? value)
        {
            if (Enum.TryParse<AssignmentStatus>(value, true, out var status))
            {
                return status;
            }

            if (string.Equals(value, "Assigned", StringComparison.OrdinalIgnoreCase))
            {
                return AssignmentStatus.Pending;
            }

            return AssignmentStatus.Pending;
        }

        public static string ResolveScoreStatus(bool isSubmitted, bool isLocked)
        {
            if (isLocked)
            {
                return ScoreStatus.Locked.ToString();
            }

            return isSubmitted ? ScoreStatus.Submitted.ToString() : ScoreStatus.Draft.ToString();
        }
    }
}

namespace ThesisManagement.Api.Models
{
    public enum CommitteeStatus
    {
        Draft = 0,
        Ready = 1,
        Ongoing = 2,
        Completed = 3,
        Finalized = 4,
        Published = 5
    }

    public enum DefenseTermStatus
    {
        Draft = 0,
        Registration = 1,
        Assignment = 2,
        ProgressTracking = 3,
        CommitteePreparation = 4,
        Running = 5,
        ScoringLocked = 6,
        Finalization = 7,
        Published = 8,
        Closed = 9,
        Archived = 10
    }

    public enum AssignmentStatus
    {
        Pending = 0,
        Defending = 1,
        Graded = 2,
        RevisionRequired = 3,
        Approved = 4,
        Rejected = 5
    }

    public enum ScoreStatus
    {
        Draft = 0,
        Submitted = 1,
        Locked = 2
    }

    public enum RevisionStatus
    {
        NotRequired = 0,
        WaitingStudent = 1,
        StudentSubmitted = 2,
        Approved = 3,
        Rejected = 4,
        Expired = 5
    }
}

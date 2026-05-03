namespace ThesisManagement.Api.Application.Common
{
    public static class DefenseUcErrorCodes
    {
        public static class Council
        {
            public const string GenerateReplay = "UC2.GENERATE.REPLAY";
            public const string FinalizeReplay = "UC2.FINALIZE.REPLAY";
        }

        public static class Sync
        {
            public const string Replay = "UC1.SYNC.REPLAY";
            public const string Timeout = "UC1.SYNC.TIMEOUT";
            public const string Failed = "UC1.SYNC.FAILED";
            public const string Success = "UC1.SYNC.SUCCESS";
            public const string MissingStudentCode = "UC1.1.MISSING_STUDENT_CODE";
            public const string MissingSupervisorCode = "UC1.1.MISSING_SUPERVISOR_CODE";
            public const string InvalidTopicStatus = "UC1.1.INVALID_TOPIC_STATUS";
        }

        public static class AutoCode
        {
            public const string Success = "UC2.3.AUTO_CODE.SUCCESS";
            public const string Retry = "UC2.3.AUTO_CODE.RETRY";
            public const string ReservationFailed = "UC2.3.AUTO_CODE.RESERVATION_FAILED";
        }

        public static class Constraints
        {
            public const string LecturerTimeOverlap = "UC2.3.LECTURER_TIME_OVERLAP";
            public const string InvalidRequiredRoles = "UC2.3.INVALID_REQUIRED_ROLES";
            public const string LecturerSupervisorConflict = "UC2.3.LECTURER_SUPERVISOR_CONFLICT";
            public const string DuplicateStudentAssignment = "UC2.3.DUPLICATE_STUDENT_ASSIGNMENT";
        }

        public static class Scoring
        {
            public const string InvalidAction = "UC3.2.INVALID_ACTION";
            public const string InvalidScoreRequired = "UC3.2.INVALID_SCORE_REQUIRED";
            public const string InvalidScoreRange = "UC3.2.INVALID_SCORE_RANGE";
            public const string VarianceAlert = "UC3.3.VARIANCE_ALERT";
            public const string IncompleteAlert = "UC3.3.INCOMPLETE_SUBMISSION";
            public const string OpenSuccess = "UC3.4.OPEN.SUCCESS";
            public const string SubmitSuccess = "UC3.2.SUBMIT_SCORE.SUCCESS";
            public const string ReopenSuccess = "UC3.3.REOPEN_REQUEST.SUCCESS";
            public const string LockSuccess = "UC3.5.LOCK.SUCCESS";
        }

        public static class Minutes
        {
            public const string SaveSuccess = "UC3.1.MINUTE_SAVE.SUCCESS";
            public const string LecturerProfileNotFound = "UC3.1.LECTURER_PROFILE_NOT_FOUND";
        }

        public static class Revision
        {
            public const string RejectReasonRequired = "UC4.1.REJECT_REASON_REQUIRED";
            public const string AssignmentNotInPeriod = "UC4.1.ASSIGNMENT_NOT_IN_PERIOD";
            public const string SubmitSuccess = "UC4.1.REVISION_SUBMIT.SUCCESS";
            public const string ApproveSuccess = "UC4.1.REVISION_APPROVE.SUCCESS";
            public const string RejectSuccess = "UC4.1.REVISION_REJECT.SUCCESS";
        }

        public static class Publish
        {
            public const string Replay = "UC4.PUBLISH.REPLAY";
            public const string RollbackReplay = "UC4.ROLLBACK.REPLAY";
            public const string RollbackFailed = "UC4.ROLLBACK.FAILED";
        }

        public static class Idempotency
        {
            public const string KeyReusedDifferentPayload = "UCX.IDEMPOTENCY.KEY_REUSED_DIFFERENT_PAYLOAD";
            public const string RequestInProgress = "UCX.IDEMPOTENCY.REQUEST_IN_PROGRESS";
        }

        public static class Common
        {
            public const string BusinessRuleViolation = "UCX.BUSINESS_RULE_VIOLATION";
        }
    }
}
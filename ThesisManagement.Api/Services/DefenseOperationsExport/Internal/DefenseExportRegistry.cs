namespace ThesisManagement.Api.Services.DefenseOperationsExport.Internal
{
    using ThesisManagement.Api.DTOs.DefensePeriods;

    public enum ExportFieldGroup
    {
        Student,
        Topic,
        Supervisor,
        Committee,
        Score,
        Time,
        Audit,
        Document,
        System
    }

    public class ExportFieldDefinition
    {
        public string Key { get; }
        public string Label { get; }
        public ExportFieldGroup Group { get; }
        public Func<ScoringExportRawDto, object?> Resolver { get; }

        public ExportFieldDefinition(string key, string label, ExportFieldGroup group, Func<ScoringExportRawDto, object?> resolver)
        {
            Key = key;
            Label = label;
            Group = group;
            Resolver = resolver;
        }
    }

    public static class DefenseExportRules
    {
        public const decimal HighVarianceThreshold = 2.0m;
        public const decimal PassingScore = 5.0m;

        public static bool IsHighVariance(decimal? variance) => variance.HasValue && variance.Value >= HighVarianceThreshold;
        public static bool IsPassed(decimal? score) => score.HasValue && score.Value >= PassingScore;

        public static ScoringExportStatus BuildScoringStatus(ScoringMatrixRowDto row)
        {
            if (row.IsLocked) return ScoringExportStatus.Locked;
            if (row.FinalScore.HasValue) return ScoringExportStatus.Scored;
            if (row.SubmittedCount <= 0) return ScoringExportStatus.Waiting;
            return IsHighVariance(row.Variance) ? 
                ScoringExportStatus.Alert : 
                ScoringExportStatus.Scoring;
        }

        public static string? ResolveGrade(decimal? score)
        {
            if (!score.HasValue) return null;
            if (score >= 9.0m) return "EXCELLENT";
            if (score >= 8.0m) return "GOOD";
            if (score >= 7.0m) return "FAIR";
            if (score >= 5.0m) return "AVERAGE";
            return "FAILED";
        }

        public static string BuildPeriodStatusLabel(DefensePeriodStateDto state)
        {
            if (state.Finalized && state.ScoresPublished) return "PUBLISHED";
            if (state.Finalized) return "FINISHED";
            if (state.CouncilListLocked) return "COUNCIL_LOCKED";
            return state.CouncilConfigConfirmed ? "READY" : "DRAFT";
        }

        public static CouncilExportStatus NormalizeCouncilStatus(string? status)
        {
            var s = (status ?? string.Empty).Trim().ToUpperInvariant();
            return s switch
            {
                "PENDING" => CouncilExportStatus.Pending,
                "READY" => CouncilExportStatus.Ready,
                "ONGOING" => CouncilExportStatus.Ongoing,
                "LOCKED" => CouncilExportStatus.Locked,
                "COMPLETED" => CouncilExportStatus.Completed,
                "PUBLISHED" => CouncilExportStatus.Published,
                _ => CouncilExportStatus.Unknown
            };
        }

        public static bool IsActiveCouncil(CouncilExportStatus status)
        {
            return status is CouncilExportStatus.Ready 
                or CouncilExportStatus.Ongoing 
                or CouncilExportStatus.Locked 
                or CouncilExportStatus.Completed 
                or CouncilExportStatus.Published;
        }
    }

    public static class DefenseExportRegistry
    {
        private static readonly List<ExportFieldDefinition> Fields = new();
        private static readonly Dictionary<string, ExportFieldDefinition> FieldMap;

        static DefenseExportRegistry()
        {
            // Student Group
            Register("StudentCode", "MSSV", ExportFieldGroup.Student, s => s.StudentCode);
            Register("StudentName", "Họ tên", ExportFieldGroup.Student, s => s.StudentName);
            Register("ClassName", "Lớp", ExportFieldGroup.Student, s => s.ClassName ?? "-");
            Register("CohortCode", "Khóa", ExportFieldGroup.Student, s => s.CohortCode ?? "-");

            // Topic Group
            Register("TopicCode", "Mã đề tài", ExportFieldGroup.Topic, s => s.TopicCode);
            Register("TopicTitle", "Tên đề tài", ExportFieldGroup.Topic, s => s.TopicTitle);
            Register("TopicTags", "Tag chuyên môn", ExportFieldGroup.Topic, s => s.TopicTags ?? "-");
            Register("AssignmentCode", "Mã phân công", ExportFieldGroup.Topic, s => s.AssignmentCode ?? "-");
            Register("AssignmentId", "ID Phân công", ExportFieldGroup.Topic, s => s.AssignmentId);
            Register("TopicId", "ID Đề tài", ExportFieldGroup.Topic, s => s.TopicCode);

            // Supervisor Group
            Register("SupervisorLecturerName", "Tên GVHD", ExportFieldGroup.Supervisor, s => s.SupervisorLecturerName);
            Register("SupervisorLecturerCode", "Mã GVHD", ExportFieldGroup.Supervisor, s => s.SupervisorLecturerCode ?? "-");
            Register("SupervisorOrganization", "Đơn vị GVHD", ExportFieldGroup.Supervisor, s => s.SupervisorOrganization ?? "-");
            Register("ScoreGvhd", "Điểm GVHD", ExportFieldGroup.Supervisor, s => s.ScoreGvhd);
            Register("CommentGvhd", "Nhận xét GVHD", ExportFieldGroup.Supervisor, s => s.CommentGvhd ?? "-");
            Register("SupervisorLecturerId", "ID GVHD", ExportFieldGroup.Supervisor, s => s.SupervisorLecturerCode ?? "-");

            // Committee Group
            Register("CommitteeCode", "Mã hội đồng", ExportFieldGroup.Committee, s => s.CommitteeCode);
            Register("CommitteeId", "ID Hội đồng", ExportFieldGroup.Committee, s => s.CommitteeId);
            Register("CommitteeName", "Tên hội đồng", ExportFieldGroup.Committee, s => s.CommitteeName ?? "-");
            Register("CommitteeChairName", "Chủ tịch", ExportFieldGroup.Committee, s => s.CommitteeChairName);
            Register("CommitteeChairCode", "Mã Chủ tịch", ExportFieldGroup.Committee, s => s.CommitteeChairCode ?? "-");
            Register("CommitteeSecretaryName", "Thư ký", ExportFieldGroup.Committee, s => s.CommitteeSecretaryName);
            Register("CommitteeSecretaryCode", "Mã Thư ký", ExportFieldGroup.Committee, s => s.CommitteeSecretaryCode ?? "-");
            Register("CommitteeReviewerName", "Phản biện", ExportFieldGroup.Committee, s => s.CommitteeReviewerName);
            Register("CommitteeReviewerCode", "Mã Phản biện", ExportFieldGroup.Committee, s => s.CommitteeReviewerCode ?? "-");
            Register("Room", "Phòng", ExportFieldGroup.Committee, s => s.Room ?? "-");

            // Score Group
            Register("ScoreCt", "Điểm CT", ExportFieldGroup.Score, s => s.ScoreCt);
            Register("ScoreTk", "Điểm TK", ExportFieldGroup.Score, s => s.ScoreTk);
            Register("ScorePb", "Điểm PB", ExportFieldGroup.Score, s => s.ScorePb);
            Register("Score", "Điểm tổng", ExportFieldGroup.Score, s => s.FinalScore);
            Register("Grade", "Xếp loại", ExportFieldGroup.Score, s => DefenseExportRules.ResolveGrade(s.FinalScore));
            Register("Variance", "Độ lệch", ExportFieldGroup.Score, s => s.Variance);
            Register("CommentCt", "Nhận xét CT", ExportFieldGroup.Score, s => s.CommentCt);
            Register("CommentTk", "Nhận xét TK", ExportFieldGroup.Score, s => s.CommentTk);
            Register("CommentPb", "Nhận xét PB", ExportFieldGroup.Score, s => s.CommentPb);
            Register("IsPassed", "Kết quả", ExportFieldGroup.Score, s => DefenseExportRules.IsPassed(s.FinalScore) ? ResultExportStatus.Passed : ResultExportStatus.Failed);
            Register("FinalGrade", "Xếp loại (Text)", ExportFieldGroup.Score, s => DefenseExportRules.ResolveGrade(s.FinalScore));
            Register("FinalScore", "Điểm tổng (Text)", ExportFieldGroup.Score, s => s.FinalScore);
            Register("TopicSupervisorScore", "Điểm HD nguyên bản", ExportFieldGroup.Score, s => s.ScoreGvhd);
            Register("VarianceStatus", "Trạng thái lệch điểm", ExportFieldGroup.Score, s => DefenseExportRules.IsHighVariance(s.Variance));
            Register("ResultStatus", "Trạng thái kết quả", ExportFieldGroup.Score, s => DefenseExportRules.IsPassed(s.FinalScore) ? ResultExportStatus.Passed : ResultExportStatus.Failed);

            // Time Group
            Register("DefenseDate", "Ngày đồ án tốt nghiệp", ExportFieldGroup.Time, s => s.DefenseDate);
            Register("Session", "Buổi", ExportFieldGroup.Time, s => s.Session);
            Register("StartTime", "Giờ bắt đầu", ExportFieldGroup.Time, s => s.StartTime);
            Register("EndTime", "Giờ kết thúc", ExportFieldGroup.Time, s => s.EndTime);
            Register("DefenseSessionCode", "Mã ca", ExportFieldGroup.Time, s => s.Session);

            // Audit Group
            Register("Status", "Trạng thái", ExportFieldGroup.Audit, s => s.Status);
            Register("IsLocked", "Đã khóa", ExportFieldGroup.Audit, s => s.IsLocked);
            Register("SubmittedCount", "Đã nộp", ExportFieldGroup.Audit, s => s.SubmittedCount);
            Register("RequiredCount", "Cần nộp", ExportFieldGroup.Audit, s => s.RequiredCount);
            Register("RevisionReason", "Lý do nộp hậu", ExportFieldGroup.Audit, s => s.RevisionReason);
            Register("SubmissionDeadline", "Hạn nộp hậu", ExportFieldGroup.Audit, s => s.SubmissionDeadline);
            Register("SecretaryComment", "Nhận xét thư ký", ExportFieldGroup.Audit, s => s.SecretaryComment);

            // Document Group
            Register("DocumentCount", "Số tài liệu", ExportFieldGroup.Document, s => s.DocumentCount);

            FieldMap = Fields.ToDictionary(x => x.Key, x => x);
        }

        private static void Register(string key, string label, ExportFieldGroup group, Func<ScoringExportRawDto, object?> resolver)
        {
            Fields.Add(new ExportFieldDefinition(key, label, group, resolver));
        }

        public static string GetLabel(string key) => FieldMap.TryGetValue(key, out var f) ? f.Label : key;

        public static object? ResolveValue(ScoringExportRawDto row, string key)
        {
            if (FieldMap.TryGetValue(key, out var f))
            {
                return f.Resolver(row);
            }
            return null;
        }

        public static IEnumerable<string> GetAllKeys() => FieldMap.Keys;

        public static Dictionary<string, object?> Flatten(ScoringExportRawDto row, IEnumerable<string> keys)
        {
            return keys.ToDictionary(k => k, k => ResolveValue(row, k));
        }
    }

    public static class DefenseExportTemplates
    {
        public static readonly string[] Dashboard = { "StudentCode", "StudentName", "TopicTitle", "CommitteeCode", "Status", "Score" };
        public static readonly string[] ScoringMatrix = { "CommitteeCode", "StudentCode", "StudentName", "TopicTitle", "ScoreCt", "ScoreTk", "ScorePb", "ScoreGvhd", "Score", "Grade", "Variance" };
        public static readonly string[] PostDefense = { "StudentCode", "StudentName", "TopicTitle", "CommitteeCode", "RevisionReason", "SubmissionDeadline", "Status", "IsLocked" };
        public static readonly string[] Councils = { "CommitteeCode", "CommitteeChairName", "CommitteeSecretaryName", "CommitteeReviewerName", "Room" };
        public static readonly string[] Topics = { "TopicCode", "TopicTitle", "StudentName", "CommitteeCode", "Status" };
        public static readonly string[] OfficialTranscript = { "StudentCode", "StudentName", "TopicTitle", "CommitteeCode", "ScoreCt", "ScoreTk", "ScorePb", "ScoreGvhd", "Score", "Grade" };
        public static readonly string[] CouncilMinutes = { "StudentCode", "StudentName", "TopicTitle", "CommitteeChairName", "CommitteeSecretaryName", "CommitteeReviewerName", "ScoreCt", "ScoreTk", "ScorePb", "ScoreGvhd", "Grade", "Status" };
        public static readonly string[] Statistics = { "CommitteeCode", "StudentCode", "StudentName", "Score", "Grade", "Variance", "Status", "IsLocked" };
    }
}

using System.Data;
using Microsoft.EntityFrameworkCore;
using ThesisManagement.Api.Data;
using ThesisManagement.Api.Services;

namespace ThesisManagement.Api.Application.Query.Dashboards
{
    public interface IDashboardQueryProcessor
    {
        Task<IReadOnlyList<Dictionary<string, object?>>> GetLecturerOverviewAsync(string? lecturerCode);
        Task<IReadOnlyList<Dictionary<string, object?>>> GetLecturerReviewQueueAsync(string? lecturerCode, int limit);
        Task<IReadOnlyList<Dictionary<string, object?>>> GetLecturerScoringProgressAsync(string? lecturerCode, int limit);
        Task<IReadOnlyList<Dictionary<string, object?>>> GetLecturerDeadlineRiskAsync(string? lecturerCode, int limit);
        Task<IReadOnlyList<Dictionary<string, object?>>> GetLecturerDefenseScheduleAsync(string? lecturerCode, int limit);
        Task<IReadOnlyList<Dictionary<string, object?>>> GetLecturerCommitteesAsync(string? lecturerCode, int limit);
        Task<IReadOnlyList<Dictionary<string, object?>>> GetLecturerProgressStatusBreakdownAsync(string? lecturerCode);
        Task<IReadOnlyList<Dictionary<string, object?>>> GetLecturerOverdueTrendAsync(string? lecturerCode, int days);
        Task<IReadOnlyList<Dictionary<string, object?>>> GetLecturerTopicTypeBreakdownAsync(string? lecturerCode);
        Task<IReadOnlyList<Dictionary<string, object?>>> GetLecturerReviewStatusBreakdownAsync(string? lecturerCode);

        Task<IReadOnlyList<Dictionary<string, object?>>> GetStudentServiceOverviewAsync();
        Task<IReadOnlyList<Dictionary<string, object?>>> GetStudentServiceAtRiskAsync(int limit);
        Task<IReadOnlyList<Dictionary<string, object?>>> GetStudentServiceBacklogAsync();
        Task<IReadOnlyList<Dictionary<string, object?>>> GetStudentServiceDepartmentBreakdownAsync();

        Task<IReadOnlyList<Dictionary<string, object?>>> GetAdminOverviewAsync();
        Task<IReadOnlyList<Dictionary<string, object?>>> GetAdminPeriodFunnelAsync(int limit);
        Task<IReadOnlyList<Dictionary<string, object?>>> GetAdminCouncilCapacityAsync(int limit);
        Task<IReadOnlyList<Dictionary<string, object?>>> GetAdminScoreQualityAsync();
        Task<IReadOnlyList<Dictionary<string, object?>>> GetAdminSlaBottleneckAsync(int days);
        Task<IReadOnlyList<Dictionary<string, object?>>> GetAdminSecurityAuditAsync(int days, int limit);

        Task<IReadOnlyList<Dictionary<string, object?>>> GetDailyKpiByRoleAsync(string? roleName, int days);
        Task<IReadOnlyList<Dictionary<string, object?>>> GetPeriodSnapshotAsync(int days);
        Task<IReadOnlyList<Dictionary<string, object?>>> GetSlaBreachDailyAsync(int days);
        Task<IReadOnlyList<Dictionary<string, object?>>> GetLecturerWorkloadDailyAsync(string? lecturerCode, int days);
    }

    public class DashboardQueryProcessor : IDashboardQueryProcessor
    {
        private readonly ApplicationDbContext _db;
        private readonly ICurrentUserService _currentUserService;

        public DashboardQueryProcessor(ApplicationDbContext db, ICurrentUserService currentUserService)
        {
            _db = db;
            _currentUserService = currentUserService;
        }

        public async Task<IReadOnlyList<Dictionary<string, object?>>> GetLecturerOverviewAsync(string? lecturerCode)
        {
            var effectiveLecturerCode = await ResolveLecturerCodeAsync(lecturerCode);
            var sql = @"
                SELECT v.*, 
                       d.CURRENTGUIDINGCOUNT,
                       (SELECT COUNT(*) 
                        FROM DEFENSEASSIGNMENTS da 
                        JOIN COMMITTEEMEMBERS cm ON da.COMMITTEEID = cm.COMMITTEEID 
                        WHERE cm.MEMBERLECTURERCODE = v.LECTURERCODE) as CURRENT_DEFENSE_COUNT
                FROM VW_DASH_LECTURER_OVERVIEW v
                LEFT JOIN V_LECTURER_DASHBOARD d ON v.LECTURERCODE = d.LECTURERCODE";
            var parameters = new List<(string Name, object? Value)>();

            if (!string.IsNullOrWhiteSpace(effectiveLecturerCode))
            {
                sql += " WHERE v.LECTURERCODE = :P_LECTURER_CODE";
                parameters.Add(("P_LECTURER_CODE", effectiveLecturerCode));
            }

            sql += " ORDER BY v.LECTURERCODE";
            return await QueryRowsAsync(sql, parameters);
        }

        public async Task<IReadOnlyList<Dictionary<string, object?>>> GetLecturerReviewQueueAsync(string? lecturerCode, int limit)
        {
            var effectiveLecturerCode = await ResolveLecturerCodeAsync(lecturerCode);
            var innerSql = @"
                SELECT 
                    s.*,
                    st.FULLNAME as STUDENTFULLNAME,
                    st.STUDENTCODE,
                    t.TITLE as TOPICTITLE,
                    t.TOPICCODE,
                    mt.NAME as MILESTONENAME,
                    mt.NAME as CATEGORY,
                    s.LECTURERSTATE as STATUS,
                    s.LECTURERSTATE as STATE,
                    (CASE WHEN UPPER(s.LECTURERSTATE) = 'PENDING' 
                          THEN ROUND((SYSDATE - CAST(s.SUBMITTEDAT AS DATE)) * 24, 2) 
                          ELSE 0 END) as HOURS_WAITING_REVIEW
                FROM PROGRESSSUBMISSIONS s
                LEFT JOIN STUDENTPROFILES st ON s.STUDENTPROFILECODE = st.STUDENTCODE
                LEFT JOIN PROGRESSMILESTONES m ON s.MILESTONEID = m.MILESTONEID
                LEFT JOIN TOPICS t ON m.TOPICID = t.TOPICID
                LEFT JOIN MILESTONETEMPLATES mt ON m.MILESTONETEMPLATECODE = mt.MILESTONETEMPLATECODE";
            var parameters = new List<(string Name, object? Value)>();

            if (!string.IsNullOrWhiteSpace(effectiveLecturerCode))
            {
                innerSql += " WHERE s.LECTURERCODE = :P_LECTURER_CODE";
                parameters.Add(("P_LECTURER_CODE", effectiveLecturerCode));
            }

            innerSql += " ORDER BY (CASE WHEN UPPER(s.LECTURERSTATE) = 'PENDING' THEN 0 ELSE 1 END), s.SUBMITTEDAT DESC";
            parameters.Add(("P_LIMIT", ClampLimit(limit, 10)));

            var sql = $"SELECT * FROM ({innerSql}) WHERE ROWNUM <= :P_LIMIT";
            return await QueryRowsAsync(sql, parameters);
        }

        public async Task<IReadOnlyList<Dictionary<string, object?>>> GetLecturerScoringProgressAsync(string? lecturerCode, int limit)
        {
            var effectiveLecturerCode = await ResolveLecturerCodeAsync(lecturerCode);
            var innerSql = "SELECT * FROM VW_DASH_LECTURER_SCORING_PROGRESS";
            var parameters = new List<(string Name, object? Value)>();

            if (!string.IsNullOrWhiteSpace(effectiveLecturerCode))
            {
                innerSql += " WHERE LECTURERCODE = :P_LECTURER_CODE";
                parameters.Add(("P_LECTURER_CODE", effectiveLecturerCode));
            }

            innerSql += " ORDER BY PENDING_COUNT DESC, OVERDUE_COUNT DESC";
            parameters.Add(("P_LIMIT", ClampLimit(limit, 100)));

            var sql = $"SELECT * FROM ({innerSql}) WHERE ROWNUM <= :P_LIMIT";
            return await QueryRowsAsync(sql, parameters);
        }

        public async Task<IReadOnlyList<Dictionary<string, object?>>> GetLecturerDeadlineRiskAsync(string? lecturerCode, int limit)
        {
            var effectiveLecturerCode = await ResolveLecturerCodeAsync(lecturerCode);
            var innerSql = @"
                SELECT 
                    v.*, 
                    t.TITLE as TOPICTITLE, 
                    st.FULLNAME as STUDENTFULLNAME,
                    st.STUDENTCODE
                FROM VW_DASH_LECTURER_DEADLINE_RISK v
                LEFT JOIN TOPICS t ON v.TOPICCODE = t.TOPICCODE
                LEFT JOIN STUDENTPROFILES st ON t.PROPOSERSTUDENTCODE = st.STUDENTCODE";
            var parameters = new List<(string Name, object? Value)>();

            if (!string.IsNullOrWhiteSpace(effectiveLecturerCode))
            {
                innerSql += " WHERE v.LECTURERCODE = :P_LECTURER_CODE";
                parameters.Add(("P_LECTURER_CODE", effectiveLecturerCode));
            }

            innerSql += " ORDER BY CASE v.RISK_LEVEL WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END, v.HOURS_OVERDUE DESC";
            parameters.Add(("P_LIMIT", ClampLimit(limit, 100)));

            var sql = $"SELECT * FROM ({innerSql}) WHERE ROWNUM <= :P_LIMIT";
            return await QueryRowsAsync(sql, parameters);
        }

        public async Task<IReadOnlyList<Dictionary<string, object?>>> GetLecturerDefenseScheduleAsync(string? lecturerCode, int limit)
        {
            var effectiveLecturerCode = await ResolveLecturerCodeAsync(lecturerCode);
            var innerSql = @"
                SELECT 
                    c.NAME as COMMITTEENAME,
                    c.DEFENSEDATE,
                    c.ROOM as ROOMCODE,
                    t.TITLE as TOPICTITLE,
                    st.FULLNAME as STUDENTFULLNAME,
                    cm.ROLE as LECTURERROLE
                FROM COMMITTEEMEMBERS cm
                JOIN COMMITTEES c ON cm.COMMITTEEID = c.COMMITTEEID
                JOIN DEFENSEASSIGNMENTS da ON c.COMMITTEEID = da.COMMITTEEID
                JOIN TOPICS t ON da.TOPICID = t.TOPICID
                LEFT JOIN STUDENTPROFILES st ON t.PROPOSERSTUDENTCODE = st.STUDENTCODE";
            var parameters = new List<(string Name, object? Value)>();

            if (!string.IsNullOrWhiteSpace(effectiveLecturerCode))
            {
                innerSql += " WHERE cm.MEMBERLECTURERCODE = :P_LECTURER_CODE";
                parameters.Add(("P_LECTURER_CODE", effectiveLecturerCode));
            }

            innerSql += " ORDER BY c.DEFENSEDATE ASC";
            parameters.Add(("P_LIMIT", ClampLimit(limit, 100)));

            var sql = $"SELECT * FROM ({innerSql}) WHERE ROWNUM <= :P_LIMIT";
            return await QueryRowsAsync(sql, parameters);
        }

        public async Task<IReadOnlyList<Dictionary<string, object?>>> GetLecturerCommitteesAsync(string? lecturerCode, int limit)
        {
            var effectiveLecturerCode = await ResolveLecturerCodeAsync(lecturerCode);
            var innerSql = @"
                SELECT 
                    c.COMMITTEECODE,
                    c.NAME as COMMITTEENAME,
                    c.DEFENSEDATE,
                    cm.ROLE,
                    (SELECT COUNT(*) FROM DEFENSEASSIGNMENTS da WHERE da.COMMITTEEID = c.COMMITTEEID) as TOPIC_COUNT
                FROM COMMITTEEMEMBERS cm
                JOIN COMMITTEES c ON cm.COMMITTEEID = c.COMMITTEEID";
            var parameters = new List<(string Name, object? Value)>();

            if (!string.IsNullOrWhiteSpace(effectiveLecturerCode))
            {
                innerSql += " WHERE cm.MEMBERLECTURERCODE = :P_LECTURER_CODE";
                parameters.Add(("P_LECTURER_CODE", effectiveLecturerCode));
            }

            innerSql += " ORDER BY c.DEFENSEDATE DESC";
            parameters.Add(("P_LIMIT", ClampLimit(limit, 100)));

            var sql = $"SELECT * FROM ({innerSql}) WHERE ROWNUM <= :P_LIMIT";
            return await QueryRowsAsync(sql, parameters);
        }

        public Task<IReadOnlyList<Dictionary<string, object?>>> GetStudentServiceOverviewAsync()
            => QueryRowsAsync("SELECT * FROM VW_DASH_STUDENT_SERVICE_OVERVIEW", Array.Empty<(string Name, object? Value)>());

        public Task<IReadOnlyList<Dictionary<string, object?>>> GetStudentServiceAtRiskAsync(int limit)
            => QueryRowsAsync(
                "SELECT * FROM (SELECT * FROM VW_DASH_STUDENT_SERVICE_AT_RISK ORDER BY RISK_SCORE DESC, OVERDUE_REVIEW_COUNT DESC) WHERE ROWNUM <= :P_LIMIT",
                new[] { ("P_LIMIT", (object?)ClampLimit(limit, 200)) });

        public Task<IReadOnlyList<Dictionary<string, object?>>> GetStudentServiceBacklogAsync()
            => QueryRowsAsync("SELECT * FROM VW_DASH_STUDENT_SERVICE_BACKLOG ORDER BY MODULE_NAME", Array.Empty<(string Name, object? Value)>());

        public Task<IReadOnlyList<Dictionary<string, object?>>> GetStudentServiceDepartmentBreakdownAsync()
            => QueryRowsAsync(
                "SELECT * FROM VW_DASH_STUDENT_SERVICE_DEPARTMENT_BREAKDOWN ORDER BY DEPARTMENTCODE",
                Array.Empty<(string Name, object? Value)>());

        public Task<IReadOnlyList<Dictionary<string, object?>>> GetAdminOverviewAsync()
            => QueryRowsAsync("SELECT * FROM VW_DASH_ADMIN_OVERVIEW", Array.Empty<(string Name, object? Value)>());

        public Task<IReadOnlyList<Dictionary<string, object?>>> GetAdminPeriodFunnelAsync(int limit)
            => QueryRowsAsync(
                "SELECT * FROM (SELECT * FROM VW_DASH_ADMIN_PERIOD_FUNNEL ORDER BY STARTDATE DESC NULLS LAST, DEFENSETERMID DESC) WHERE ROWNUM <= :P_LIMIT",
                new[] { ("P_LIMIT", (object?)ClampLimit(limit, 200)) });

        public Task<IReadOnlyList<Dictionary<string, object?>>> GetAdminCouncilCapacityAsync(int limit)
            => QueryRowsAsync(
                "SELECT * FROM (SELECT * FROM VW_DASH_ADMIN_COUNCIL_CAPACITY ORDER BY LOAD_RATIO DESC NULLS LAST, ASSIGNMENT_COUNT DESC) WHERE ROWNUM <= :P_LIMIT",
                new[] { ("P_LIMIT", (object?)ClampLimit(limit, 200)) });

        public Task<IReadOnlyList<Dictionary<string, object?>>> GetAdminScoreQualityAsync()
            => QueryRowsAsync("SELECT * FROM VW_DASH_ADMIN_SCORE_QUALITY", Array.Empty<(string Name, object? Value)>());

        public Task<IReadOnlyList<Dictionary<string, object?>>> GetAdminSlaBottleneckAsync(int days)
            => QueryRowsAsync(
                "SELECT * FROM VW_DASH_ADMIN_SLA_BOTTLENECK WHERE METRIC_DATE >= (TRUNC(SYSDATE) - :P_DAYS) ORDER BY METRIC_DATE DESC, MODULE_NAME",
                new[] { ("P_DAYS", (object?)ClampDays(days)) });

        public Task<IReadOnlyList<Dictionary<string, object?>>> GetAdminSecurityAuditAsync(int days, int limit)
            => QueryRowsAsync(
                "SELECT * FROM (SELECT * FROM VW_DASH_ADMIN_SECURITY_AUDIT WHERE METRIC_DATE >= (TRUNC(SYSDATE) - :P_DAYS) ORDER BY METRIC_DATE DESC, FAILED_COUNT DESC) WHERE ROWNUM <= :P_LIMIT",
                new[]
                {
                    ("P_DAYS", (object?)ClampDays(days)),
                    ("P_LIMIT", (object?)ClampLimit(limit, 200))
                });

        public Task<IReadOnlyList<Dictionary<string, object?>>> GetDailyKpiByRoleAsync(string? roleName, int days)
        {
            var sql = "SELECT * FROM MV_DASH_DAILY_KPI_BY_ROLE WHERE SNAP_DATE >= (TRUNC(SYSDATE) - :P_DAYS)";
            var parameters = new List<(string Name, object? Value)> { ("P_DAYS", ClampDays(days)) };

            if (!string.IsNullOrWhiteSpace(roleName))
            {
                sql += " AND ROLE_NAME = :P_ROLE_NAME";
                parameters.Add(("P_ROLE_NAME", roleName.Trim().ToUpperInvariant()));
            }

            sql += " ORDER BY SNAP_DATE DESC, ROLE_NAME, KPI_NAME";
            return QueryRowsAsync(sql, parameters);
        }

        public Task<IReadOnlyList<Dictionary<string, object?>>> GetPeriodSnapshotAsync(int days)
            => QueryRowsAsync(
                "SELECT * FROM MV_DASH_PERIOD_SNAPSHOT WHERE SNAP_DATE >= (TRUNC(SYSDATE) - :P_DAYS) ORDER BY SNAP_DATE DESC, DEFENSETERMID DESC",
                new[] { ("P_DAYS", (object?)ClampDays(days)) });

        public Task<IReadOnlyList<Dictionary<string, object?>>> GetSlaBreachDailyAsync(int days)
            => QueryRowsAsync(
                "SELECT * FROM MV_DASH_SLA_BREACH_DAILY WHERE METRIC_DATE >= (TRUNC(SYSDATE) - :P_DAYS) ORDER BY METRIC_DATE DESC, MODULE_NAME",
                new[] { ("P_DAYS", (object?)ClampDays(days)) });

        public async Task<IReadOnlyList<Dictionary<string, object?>>> GetLecturerWorkloadDailyAsync(string? lecturerCode, int days)
        {
            var effectiveLecturerCode = await ResolveLecturerCodeAsync(lecturerCode);
            var sql = "SELECT * FROM MV_DASH_LECTURER_WORKLOAD_DAILY WHERE SNAP_DATE >= (TRUNC(SYSDATE) - :P_DAYS)";
            var parameters = new List<(string Name, object? Value)> { ("P_DAYS", ClampDays(days)) };

            if (!string.IsNullOrWhiteSpace(effectiveLecturerCode))
            {
                sql += " AND LECTURERCODE = :P_LECTURER_CODE";
                parameters.Add(("P_LECTURER_CODE", effectiveLecturerCode));
            }

            sql += " ORDER BY SNAP_DATE DESC, LECTURERCODE";
            return await QueryRowsAsync(sql, parameters);
        }

        public async Task<IReadOnlyList<Dictionary<string, object?>>> GetLecturerProgressStatusBreakdownAsync(string? lecturerCode)
        {
            var effectiveLecturerCode = await ResolveLecturerCodeAsync(lecturerCode);
            var sql = @"
                SELECT 
                    'NOT_SUBMITTED' as STATUS,
                    COUNT(DISTINCT m.MILESTONEID) as COUNT
                FROM PROGRESSMILESTONES m
                LEFT JOIN PROGRESSSUBMISSIONS s ON m.MILESTONEID = s.MILESTONEID
                WHERE s.MILESTONEID IS NULL";
            var parameters = new List<(string Name, object? Value)>();

            if (!string.IsNullOrWhiteSpace(effectiveLecturerCode))
            {
                sql += " AND m.TOPICID IN (SELECT TOPICID FROM TOPICS WHERE SUPERVISORLECTURERCODE = :P_LECTURER_CODE)";
                parameters.Add(("P_LECTURER_CODE", effectiveLecturerCode));
            }

            sql += @"
                UNION ALL
                SELECT 
                    'SUBMITTED' as STATUS,
                    COUNT(*) as COUNT
                FROM PROGRESSSUBMISSIONS s
                WHERE 1=1";

            if (!string.IsNullOrWhiteSpace(effectiveLecturerCode))
            {
                sql += " AND s.LECTURERCODE = :P_LECTURER_CODE";
                // Note: parameter already added above if needed
            }

            sql += @"
                UNION ALL
                SELECT 
                    CASE 
                        WHEN UPPER(s.LECTURERSTATE) = 'PENDING' THEN 'PENDING_REVIEW'
                        WHEN UPPER(s.LECTURERSTATE) = 'APPROVED' THEN 'APPROVED'
                        WHEN UPPER(s.LECTURERSTATE) = 'REJECTED' THEN 'REJECTED'
                        ELSE 'OTHER'
                    END as STATUS,
                    COUNT(*) as COUNT
                FROM PROGRESSSUBMISSIONS s
                WHERE 1=1";

            if (!string.IsNullOrWhiteSpace(effectiveLecturerCode))
            {
                sql += " AND s.LECTURERCODE = :P_LECTURER_CODE";
            }

            sql += @" GROUP BY CASE 
                        WHEN UPPER(s.LECTURERSTATE) = 'PENDING' THEN 'PENDING_REVIEW'
                        WHEN UPPER(s.LECTURERSTATE) = 'APPROVED' THEN 'APPROVED'
                        WHEN UPPER(s.LECTURERSTATE) = 'REJECTED' THEN 'REJECTED'
                        ELSE 'OTHER'
                    END";

            return await QueryRowsAsync(sql, parameters);
        }

        public async Task<IReadOnlyList<Dictionary<string, object?>>> GetLecturerOverdueTrendAsync(string? lecturerCode, int days)
        {
            var effectiveLecturerCode = await ResolveLecturerCodeAsync(lecturerCode);
            var sql = @"
                SELECT 
                    TRUNC(s.SUBMITTEDAT) AS ""DATE"",
                    SUM(CASE WHEN m.DEADLINE IS NOT NULL AND m.DEADLINE < s.SUBMITTEDAT THEN 1 ELSE 0 END) AS OVERDUE_COUNT,
                    COUNT(*) AS TOTAL_COUNT
                FROM PROGRESSSUBMISSIONS s
                LEFT JOIN PROGRESSMILESTONES m ON s.MILESTONEID = m.MILESTONEID
                WHERE s.SUBMITTEDAT >= (TRUNC(SYSDATE) - :P_DAYS)";
            var parameters = new List<(string Name, object? Value)> { ("P_DAYS", ClampDays(days)) };

            if (!string.IsNullOrWhiteSpace(effectiveLecturerCode))
            {
                sql += " AND s.LECTURERCODE = :P_LECTURER_CODE";
                parameters.Add(("P_LECTURER_CODE", effectiveLecturerCode));
            }

            sql += @" GROUP BY TRUNC(s.SUBMITTEDAT)
                ORDER BY TRUNC(s.SUBMITTEDAT) DESC";
            return await QueryRowsAsync(sql, parameters);
        }

        public async Task<IReadOnlyList<Dictionary<string, object?>>> GetLecturerTopicTypeBreakdownAsync(string? lecturerCode)
        {
            var effectiveLecturerCode = await ResolveLecturerCodeAsync(lecturerCode);
            var sql = @"
                SELECT 
                    t.""Type"" as TOPIC_TYPE,
                    t.STATUS as TOPIC_STATUS,
                    COUNT(*) as COUNT
                FROM TOPICS t
                WHERE 1=1";
            var parameters = new List<(string Name, object? Value)>();

            if (!string.IsNullOrWhiteSpace(effectiveLecturerCode))
            {
                sql += " AND t.SUPERVISORLECTURERCODE = :P_LECTURER_CODE";
                parameters.Add(("P_LECTURER_CODE", effectiveLecturerCode));
            }

            sql += @" GROUP BY t.""Type"", t.STATUS
                ORDER BY t.""Type"", t.STATUS";
            return await QueryRowsAsync(sql, parameters);
        }

        public async Task<IReadOnlyList<Dictionary<string, object?>>> GetLecturerReviewStatusBreakdownAsync(string? lecturerCode)
        {
            var effectiveLecturerCode = await ResolveLecturerCodeAsync(lecturerCode);
            var sql = @"
                SELECT 
                    CASE 
                        WHEN UPPER(s.LECTURERSTATE) = 'PENDING' THEN 'PENDING'
                        WHEN UPPER(s.LECTURERSTATE) = 'APPROVED' THEN 'APPROVED'
                        WHEN UPPER(s.LECTURERSTATE) = 'REJECTED' THEN 'REJECTED'
                        WHEN UPPER(s.LECTURERSTATE) = 'NEEDS_REVISION' OR UPPER(s.LECTURERSTATE) LIKE '%REVISION%' THEN 'NEEDS_REVISION'
                        ELSE 'OTHER'
                    END as REVIEW_STATUS,
                    COUNT(*) as COUNT,
                    ROUND(AVG(CASE WHEN s.SUBMITTEDAT IS NOT NULL THEN SYSDATE - CAST(s.SUBMITTEDAT AS DATE) ELSE NULL END), 2) as AVG_DAYS_WAITING
                FROM PROGRESSSUBMISSIONS s
                WHERE 1=1";
            var parameters = new List<(string Name, object? Value)>();

            if (!string.IsNullOrWhiteSpace(effectiveLecturerCode))
            {
                sql += " AND s.LECTURERCODE = :P_LECTURER_CODE";
                parameters.Add(("P_LECTURER_CODE", effectiveLecturerCode));
            }

            sql += @" GROUP BY CASE 
                        WHEN UPPER(s.LECTURERSTATE) = 'PENDING' THEN 'PENDING'
                        WHEN UPPER(s.LECTURERSTATE) = 'APPROVED' THEN 'APPROVED'
                        WHEN UPPER(s.LECTURERSTATE) = 'REJECTED' THEN 'REJECTED'
                        WHEN UPPER(s.LECTURERSTATE) = 'NEEDS_REVISION' OR UPPER(s.LECTURERSTATE) LIKE '%REVISION%' THEN 'NEEDS_REVISION'
                        ELSE 'OTHER'
                    END
                ORDER BY COUNT DESC";
            return await QueryRowsAsync(sql, parameters);
        }

        private async Task<string?> ResolveLecturerCodeAsync(string? lecturerCode)
        {
            if (!string.IsNullOrWhiteSpace(lecturerCode))
            {
                return lecturerCode.Trim();
            }

            var userCode = _currentUserService.GetUserCode();
            if (string.IsNullOrWhiteSpace(userCode))
            {
                return null;
            }

            var profile = await _db.LecturerProfiles
                .Where(x => x.UserCode == userCode || x.LecturerCode == userCode)
                .Select(x => x.LecturerCode)
                .FirstOrDefaultAsync();

            return string.IsNullOrWhiteSpace(profile) ? null : profile;
        }

        private async Task<IReadOnlyList<Dictionary<string, object?>>> QueryRowsAsync(
            string sql,
            IEnumerable<(string Name, object? Value)> parameters)
        {
            var rows = new List<Dictionary<string, object?>>();
            var conn = _db.Database.GetDbConnection();
            var shouldClose = conn.State != ConnectionState.Open;

            if (shouldClose)
            {
                await conn.OpenAsync();
            }

            try
            {
                await using var cmd = conn.CreateCommand();
                cmd.CommandText = sql;

                foreach (var (name, value) in parameters)
                {
                    var p = cmd.CreateParameter();
                    p.ParameterName = name;
                    p.Value = value ?? DBNull.Value;
                    cmd.Parameters.Add(p);
                }

                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    var row = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
                    for (var i = 0; i < reader.FieldCount; i++)
                    {
                        object? value = await reader.IsDBNullAsync(i) ? null : reader.GetValue(i);
                        if (value != null && value.GetType().Namespace?.StartsWith("Oracle.ManagedDataAccess.Types", StringComparison.Ordinal) == true)
                        {
                            value = value.ToString();
                        }

                        row[reader.GetName(i)] = value;
                    }

                    rows.Add(row);
                }
            }
            finally
            {
                if (shouldClose)
                {
                    await conn.CloseAsync();
                }
            }

            return rows;
        }

        private static int ClampLimit(int value, int fallback, int max = 1000)
        {
            if (value <= 0)
            {
                return fallback;
            }

            return Math.Min(value, max);
        }

        private static int ClampDays(int value)
        {
            if (value <= 0)
            {
                return 30;
            }

            return Math.Min(value, 3650);
        }
    }
}

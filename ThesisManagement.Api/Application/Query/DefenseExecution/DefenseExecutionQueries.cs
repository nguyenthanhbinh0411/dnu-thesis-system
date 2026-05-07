using ThesisManagement.Api.Application.Query.DefensePeriods;
using ThesisManagement.Api.DTOs;
using ThesisManagement.Api.DTOs.DefensePeriods;

namespace ThesisManagement.Api.Application.Query.DefenseExecution
{
    public interface IGetLecturerCommitteesQueryV2
    {
        Task<ApiResponse<object>> ExecuteAsync(string lecturerCode, int? periodId = null, CancellationToken cancellationToken = default);
    }

    public interface IGetLecturerMinutesQuery
    {
        Task<ApiResponse<List<LecturerCommitteeMinuteDto>>> ExecuteAsync(int committeeId, int? periodId = null, CancellationToken cancellationToken = default);
    }

    public interface IGetLecturerRevisionQueueQuery
    {
        Task<ApiResponse<List<object>>> ExecuteAsync(string lecturerCode, int? periodId = null, CancellationToken cancellationToken = default);
    }

    public interface IGetStudentDefenseInfoQueryV2
    {
        Task<ApiResponse<StudentDefenseInfoDtoV2>> ExecuteAsync(string studentCode, int? periodId = null, CancellationToken cancellationToken = default);
    }

    public interface IGetStudentNotificationsQuery
    {
        Task<ApiResponse<List<StudentNotificationDto>>> ExecuteAsync(string studentCode, int? periodId = null, CancellationToken cancellationToken = default);
    }

    public interface IGetStudentRevisionHistoryQuery
    {
        Task<ApiResponse<List<object>>> ExecuteAsync(string studentCode, int? periodId = null, CancellationToken cancellationToken = default);
    }

    public interface IGetDefenseOverviewAnalyticsQuery
    {
        Task<ApiResponse<AnalyticsOverviewDto>> ExecuteAsync(int periodId, CancellationToken cancellationToken = default);
    }

    public interface IGetDefenseByCouncilAnalyticsQuery
    {
        Task<ApiResponse<List<CouncilAnalyticsDto>>> ExecuteAsync(int periodId, CancellationToken cancellationToken = default);
    }

    public interface IGetDefenseDistributionAnalyticsQuery
    {
        Task<ApiResponse<AnalyticsDistributionDto>> ExecuteAsync(int periodId, CancellationToken cancellationToken = default);
    }

    public interface IGetScoringMatrixQuery
    {
        Task<ApiResponse<List<ScoringMatrixRowDto>>> ExecuteAsync(int periodId, int? committeeId = null, bool isForLecturer = false, CancellationToken cancellationToken = default);
    }

    public interface IGetScoringProgressQuery
    {
        Task<ApiResponse<List<ScoringProgressDto>>> ExecuteAsync(int periodId, int? committeeId = null, CancellationToken cancellationToken = default);
    }

    public interface IGetTopicFinalScoreProgressQuery
    {
        Task<ApiResponse<List<TopicFinalScoreProgressDto>>> ExecuteAsync(int periodId, int? committeeId = null, CancellationToken cancellationToken = default);
    }

    public interface IGetScoringAlertsQuery
    {
        Task<ApiResponse<List<ScoringAlertDto>>> ExecuteAsync(int periodId, int? committeeId = null, CancellationToken cancellationToken = default);
    }

    public interface IBuildDefenseReportQuery
    {
        Task<ApiResponse<(byte[] Content, string FileName, string ContentType)>> ExecuteAsync(int periodId, string reportType, string format, int? councilId, CancellationToken cancellationToken = default);
    }

    public interface IGetDefenseExportHistoryQuery
    {
        Task<ApiResponse<List<ExportHistoryDto>>> ExecuteAsync(int periodId, CancellationToken cancellationToken = default);
    }

    public interface IGetDefensePublishHistoryQuery
    {
        Task<ApiResponse<List<PublishHistoryDto>>> ExecuteAsync(int periodId, CancellationToken cancellationToken = default);
    }

    public class GetLecturerCommitteesQueryV2 : IGetLecturerCommitteesQueryV2
    {
        private readonly IDefensePeriodQueryProcessor _processor;
        public GetLecturerCommitteesQueryV2(IDefensePeriodQueryProcessor processor) => _processor = processor;
        public Task<ApiResponse<object>> ExecuteAsync(string lecturerCode, int? periodId = null, CancellationToken cancellationToken = default)
            => _processor.GetLecturerCommitteesAsync(lecturerCode, periodId, cancellationToken);
    }

    public class GetLecturerMinutesQuery : IGetLecturerMinutesQuery
    {
        private readonly IDefensePeriodQueryProcessor _processor;
        public GetLecturerMinutesQuery(IDefensePeriodQueryProcessor processor) => _processor = processor;
        public Task<ApiResponse<List<LecturerCommitteeMinuteDto>>> ExecuteAsync(int committeeId, int? periodId = null, CancellationToken cancellationToken = default)
            => _processor.GetLecturerMinutesAsync(committeeId, periodId, cancellationToken);
    }

    public class GetLecturerRevisionQueueQuery : IGetLecturerRevisionQueueQuery
    {
        private readonly IDefensePeriodQueryProcessor _processor;
        public GetLecturerRevisionQueueQuery(IDefensePeriodQueryProcessor processor) => _processor = processor;
        public Task<ApiResponse<List<object>>> ExecuteAsync(string lecturerCode, int? periodId = null, CancellationToken cancellationToken = default)
            => _processor.GetLecturerRevisionQueueAsync(lecturerCode, periodId, cancellationToken);
    }

    public class GetStudentDefenseInfoQueryV2 : IGetStudentDefenseInfoQueryV2
    {
        private readonly IDefensePeriodQueryProcessor _processor;
        public GetStudentDefenseInfoQueryV2(IDefensePeriodQueryProcessor processor) => _processor = processor;
        public Task<ApiResponse<StudentDefenseInfoDtoV2>> ExecuteAsync(string studentCode, int? periodId = null, CancellationToken cancellationToken = default)
            => _processor.GetStudentDefenseInfoAsync(studentCode, periodId, cancellationToken);
    }

    public class GetStudentNotificationsQuery : IGetStudentNotificationsQuery
    {
        private readonly IDefensePeriodQueryProcessor _processor;
        public GetStudentNotificationsQuery(IDefensePeriodQueryProcessor processor) => _processor = processor;
        public Task<ApiResponse<List<StudentNotificationDto>>> ExecuteAsync(string studentCode, int? periodId = null, CancellationToken cancellationToken = default)
            => _processor.GetStudentNotificationsAsync(studentCode, periodId, cancellationToken);
    }

    public class GetStudentRevisionHistoryQuery : IGetStudentRevisionHistoryQuery
    {
        private readonly IDefensePeriodQueryProcessor _processor;
        public GetStudentRevisionHistoryQuery(IDefensePeriodQueryProcessor processor) => _processor = processor;
        public Task<ApiResponse<List<object>>> ExecuteAsync(string studentCode, int? periodId = null, CancellationToken cancellationToken = default)
            => _processor.GetStudentRevisionHistoryAsync(studentCode, periodId, cancellationToken);
    }

    public class GetDefenseOverviewAnalyticsQuery : IGetDefenseOverviewAnalyticsQuery
    {
        private readonly IDefensePeriodQueryProcessor _processor;
        public GetDefenseOverviewAnalyticsQuery(IDefensePeriodQueryProcessor processor) => _processor = processor;
        public Task<ApiResponse<AnalyticsOverviewDto>> ExecuteAsync(int periodId, CancellationToken cancellationToken = default)
            => _processor.GetOverviewAsync(periodId, cancellationToken);
    }

    public class GetDefenseByCouncilAnalyticsQuery : IGetDefenseByCouncilAnalyticsQuery
    {
        private readonly IDefensePeriodQueryProcessor _processor;
        public GetDefenseByCouncilAnalyticsQuery(IDefensePeriodQueryProcessor processor) => _processor = processor;
        public Task<ApiResponse<List<CouncilAnalyticsDto>>> ExecuteAsync(int periodId, CancellationToken cancellationToken = default)
            => _processor.GetAnalyticsByCouncilAsync(periodId, cancellationToken);
    }

    public class GetDefenseDistributionAnalyticsQuery : IGetDefenseDistributionAnalyticsQuery
    {
        private readonly IDefensePeriodQueryProcessor _processor;
        public GetDefenseDistributionAnalyticsQuery(IDefensePeriodQueryProcessor processor) => _processor = processor;
        public Task<ApiResponse<AnalyticsDistributionDto>> ExecuteAsync(int periodId, CancellationToken cancellationToken = default)
            => _processor.GetDistributionAsync(periodId, cancellationToken);
    }

    public class GetScoringMatrixQuery : IGetScoringMatrixQuery
    {
        private readonly IDefensePeriodQueryProcessor _processor;
        public GetScoringMatrixQuery(IDefensePeriodQueryProcessor processor) => _processor = processor;
        public Task<ApiResponse<List<ScoringMatrixRowDto>>> ExecuteAsync(int periodId, int? committeeId = null, bool isForLecturer = false, CancellationToken cancellationToken = default)
            => _processor.GetScoringMatrixAsync(periodId, committeeId, isForLecturer, cancellationToken);
    }

    public class GetScoringProgressQuery : IGetScoringProgressQuery
    {
        private readonly IDefensePeriodQueryProcessor _processor;
        public GetScoringProgressQuery(IDefensePeriodQueryProcessor processor) => _processor = processor;
        public Task<ApiResponse<List<ScoringProgressDto>>> ExecuteAsync(int periodId, int? committeeId = null, CancellationToken cancellationToken = default)
            => _processor.GetScoringProgressAsync(periodId, committeeId, cancellationToken);
    }

    public class GetTopicFinalScoreProgressQuery : IGetTopicFinalScoreProgressQuery
    {
        private readonly IDefensePeriodQueryProcessor _processor;
        public GetTopicFinalScoreProgressQuery(IDefensePeriodQueryProcessor processor) => _processor = processor;
        public Task<ApiResponse<List<TopicFinalScoreProgressDto>>> ExecuteAsync(int periodId, int? committeeId = null, CancellationToken cancellationToken = default)
            => _processor.GetTopicFinalScoreProgressAsync(periodId, committeeId, cancellationToken);
    }

    public class GetScoringAlertsQuery : IGetScoringAlertsQuery
    {
        private readonly IDefensePeriodQueryProcessor _processor;
        public GetScoringAlertsQuery(IDefensePeriodQueryProcessor processor) => _processor = processor;
        public Task<ApiResponse<List<ScoringAlertDto>>> ExecuteAsync(int periodId, int? committeeId = null, CancellationToken cancellationToken = default)
            => _processor.GetScoringAlertsAsync(periodId, committeeId, cancellationToken);
    }

    public class BuildDefenseReportQuery : IBuildDefenseReportQuery
    {
        private readonly IDefensePeriodQueryProcessor _processor;
        public BuildDefenseReportQuery(IDefensePeriodQueryProcessor processor) => _processor = processor;
        public Task<ApiResponse<(byte[] Content, string FileName, string ContentType)>> ExecuteAsync(int periodId, string reportType, string format, int? councilId, CancellationToken cancellationToken = default)
            => _processor.BuildReportAsync(periodId, reportType, format, councilId, cancellationToken);
    }

    public class GetDefenseExportHistoryQuery : IGetDefenseExportHistoryQuery
    {
        private readonly IDefensePeriodQueryProcessor _processor;
        public GetDefenseExportHistoryQuery(IDefensePeriodQueryProcessor processor) => _processor = processor;
        public Task<ApiResponse<List<ExportHistoryDto>>> ExecuteAsync(int periodId, CancellationToken cancellationToken = default)
            => _processor.GetExportHistoryAsync(periodId, cancellationToken);
    }

    public class GetDefensePublishHistoryQuery : IGetDefensePublishHistoryQuery
    {
        private readonly IDefensePeriodQueryProcessor _processor;
        public GetDefensePublishHistoryQuery(IDefensePeriodQueryProcessor processor) => _processor = processor;
        public Task<ApiResponse<List<PublishHistoryDto>>> ExecuteAsync(int periodId, CancellationToken cancellationToken = default)
            => _processor.GetPublishHistoryAsync(periodId, cancellationToken);
    }
}

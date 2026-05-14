using Microsoft.AspNetCore.Http;
using ThesisManagement.Api.Application.Command.DefensePeriods;
using ThesisManagement.Api.DTOs;
using ThesisManagement.Api.DTOs.DefensePeriods;

namespace ThesisManagement.Api.Application.Command.DefenseExecution
{
    public interface IPublishDefensePeriodScoresCommand
    {
        Task<ApiResponse<bool>> ExecuteAsync(int periodId, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default);
    }

    public interface ISaveLecturerMinuteCommand
    {
        Task<ApiResponse<bool>> ExecuteAsync(int committeeId, UpdateLecturerMinutesDto request, string lecturerCode, int actorUserId, CancellationToken cancellationToken = default);
    }

    public interface ISubmitLecturerIndependentScoreCommand
    {
        Task<ApiResponse<bool>> ExecuteAsync(int committeeId, LecturerScoreSubmitDto request, string lecturerCode, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default);
    }

    public interface IOpenLecturerSessionCommand
    {
        Task<ApiResponse<bool>> ExecuteAsync(int committeeId, string lecturerCode, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default);
    }

    public interface ILockLecturerSessionCommand
    {
        Task<ApiResponse<bool>> ExecuteAsync(int committeeId, string lecturerCode, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default);
    }

    public interface IApproveRevisionByLecturerCommand
    {
        Task<ApiResponse<bool>> ExecuteAsync(int revisionId, string? reason, string lecturerCode, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default);
    }

    public interface IRejectRevisionByLecturerCommand
    {
        Task<ApiResponse<bool>> ExecuteAsync(int revisionId, RejectRevisionRequestDto request, string lecturerCode, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default);
    }

    public interface ISubmitStudentRevisionCommand
    {
        Task<ApiResponse<bool>> ExecuteAsync(StudentRevisionSubmissionDto request, string studentCode, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default);
    }

    public class PublishDefensePeriodScoresCommand : IPublishDefensePeriodScoresCommand
    {
        private readonly IDefensePeriodCommandProcessor _processor;
        public PublishDefensePeriodScoresCommand(IDefensePeriodCommandProcessor processor) => _processor = processor;
        public Task<ApiResponse<bool>> ExecuteAsync(int periodId, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default)
            => _processor.PublishScoresAsync(periodId, actorUserId, idempotencyKey, cancellationToken);
    }

    public class SaveLecturerMinuteCommand : ISaveLecturerMinuteCommand
    {
        private readonly IDefensePeriodCommandProcessor _processor;
        public SaveLecturerMinuteCommand(IDefensePeriodCommandProcessor processor) => _processor = processor;
        public Task<ApiResponse<bool>> ExecuteAsync(int committeeId, UpdateLecturerMinutesDto request, string lecturerCode, int actorUserId, CancellationToken cancellationToken = default)
            => _processor.SaveLecturerMinuteAsync(committeeId, request, lecturerCode, actorUserId, cancellationToken);
    }

    public class SubmitLecturerIndependentScoreCommand : ISubmitLecturerIndependentScoreCommand
    {
        private readonly IDefensePeriodCommandProcessor _processor;
        public SubmitLecturerIndependentScoreCommand(IDefensePeriodCommandProcessor processor) => _processor = processor;
        public Task<ApiResponse<bool>> ExecuteAsync(int committeeId, LecturerScoreSubmitDto request, string lecturerCode, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default)
            => _processor.SubmitIndependentScoreAsync(committeeId, request, lecturerCode, actorUserId, idempotencyKey, cancellationToken);
    }

    public class OpenLecturerSessionCommand : IOpenLecturerSessionCommand
    {
        private readonly IDefensePeriodCommandProcessor _processor;
        public OpenLecturerSessionCommand(IDefensePeriodCommandProcessor processor) => _processor = processor;
        public Task<ApiResponse<bool>> ExecuteAsync(int committeeId, string lecturerCode, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default)
            => _processor.OpenSessionAsync(committeeId, lecturerCode, actorUserId, idempotencyKey, cancellationToken);
    }

    public class LockLecturerSessionCommand : ILockLecturerSessionCommand
    {
        private readonly IDefensePeriodCommandProcessor _processor;
        public LockLecturerSessionCommand(IDefensePeriodCommandProcessor processor) => _processor = processor;
        public Task<ApiResponse<bool>> ExecuteAsync(int committeeId, string lecturerCode, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default)
            => _processor.LockSessionAsync(committeeId, lecturerCode, actorUserId, idempotencyKey, cancellationToken);
    }

    public class ApproveRevisionByLecturerCommand : IApproveRevisionByLecturerCommand
    {
        private readonly IDefensePeriodCommandProcessor _processor;
        public ApproveRevisionByLecturerCommand(IDefensePeriodCommandProcessor processor) => _processor = processor;
        public Task<ApiResponse<bool>> ExecuteAsync(int revisionId, string? reason, string lecturerCode, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default)
            => _processor.ApproveRevisionAsync(revisionId, reason, lecturerCode, actorUserId, idempotencyKey, cancellationToken);
    }

    public class RejectRevisionByLecturerCommand : IRejectRevisionByLecturerCommand
    {
        private readonly IDefensePeriodCommandProcessor _processor;
        public RejectRevisionByLecturerCommand(IDefensePeriodCommandProcessor processor) => _processor = processor;
        public Task<ApiResponse<bool>> ExecuteAsync(int revisionId, RejectRevisionRequestDto request, string lecturerCode, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default)
            => _processor.RejectRevisionAsync(revisionId, request.Reason, lecturerCode, actorUserId, idempotencyKey, cancellationToken);
    }

    public class SubmitStudentRevisionCommand : ISubmitStudentRevisionCommand
    {
        private readonly IDefensePeriodCommandProcessor _processor;
        public SubmitStudentRevisionCommand(IDefensePeriodCommandProcessor processor) => _processor = processor;
        public Task<ApiResponse<bool>> ExecuteAsync(StudentRevisionSubmissionDto request, string studentCode, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default)
            => _processor.SubmitStudentRevisionAsync(request, studentCode, actorUserId, idempotencyKey, cancellationToken);
    }
}

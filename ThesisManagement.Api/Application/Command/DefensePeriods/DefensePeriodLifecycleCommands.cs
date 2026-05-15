using ThesisManagement.Api.DTOs;
using ThesisManagement.Api.DTOs.DefensePeriods;

namespace ThesisManagement.Api.Application.Command.DefensePeriods
{
    public interface IStartDefensePeriodCommand
    {
        Task<ApiResponse<bool>> ExecuteAsync(int periodId, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default);
    }

    public interface IPauseDefensePeriodCommand
    {
        Task<ApiResponse<bool>> ExecuteAsync(int periodId, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default);
    }

    public interface IMoveNextDefensePeriodCommand
    {
        Task<ApiResponse<bool>> ExecuteAsync(int periodId, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default);
    }

    public interface IResumeDefensePeriodCommand
    {
        Task<ApiResponse<bool>> ExecuteAsync(int periodId, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default);
    }

    public interface ILockScoringDefensePeriodCommand
    {
        Task<ApiResponse<bool>> ExecuteAsync(int periodId, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default);
    }

    public interface ICloseDefensePeriodCommand
    {
        Task<ApiResponse<bool>> ExecuteAsync(int periodId, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default);
    }

    public class StartDefensePeriodCommand : IStartDefensePeriodCommand
    {
        private readonly IDefensePeriodCommandProcessor _processor;
        public StartDefensePeriodCommand(IDefensePeriodCommandProcessor processor) => _processor = processor;
        public Task<ApiResponse<bool>> ExecuteAsync(int periodId, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default)
            => _processor.StartAsync(periodId, actorUserId, idempotencyKey, cancellationToken);
    }

    public class PauseDefensePeriodCommand : IPauseDefensePeriodCommand
    {
        private readonly IDefensePeriodCommandProcessor _processor;
        public PauseDefensePeriodCommand(IDefensePeriodCommandProcessor processor) => _processor = processor;
        public Task<ApiResponse<bool>> ExecuteAsync(int periodId, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default)
            => _processor.PauseAsync(periodId, actorUserId, idempotencyKey, cancellationToken);
    }

    public class ResumeDefensePeriodCommand : IResumeDefensePeriodCommand
    {
        private readonly IDefensePeriodCommandProcessor _processor;
        public ResumeDefensePeriodCommand(IDefensePeriodCommandProcessor processor) => _processor = processor;
        public Task<ApiResponse<bool>> ExecuteAsync(int periodId, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default)
            => _processor.ResumeAsync(periodId, actorUserId, idempotencyKey, cancellationToken);
    }

    public class LockScoringDefensePeriodCommand : ILockScoringDefensePeriodCommand
    {
        private readonly IDefensePeriodCommandProcessor _processor;
        public LockScoringDefensePeriodCommand(IDefensePeriodCommandProcessor processor) => _processor = processor;
        public Task<ApiResponse<bool>> ExecuteAsync(int periodId, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default)
            => _processor.LockScoringAsync(periodId, actorUserId, idempotencyKey, cancellationToken);
    }

    public class CloseDefensePeriodCommand : ICloseDefensePeriodCommand
    {
        private readonly IDefensePeriodCommandProcessor _processor;
        public CloseDefensePeriodCommand(IDefensePeriodCommandProcessor processor) => _processor = processor;
        public Task<ApiResponse<bool>> ExecuteAsync(int periodId, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default)
            => _processor.CloseAsync(periodId, actorUserId, idempotencyKey, cancellationToken);
    }

    public class MoveNextDefensePeriodCommand : IMoveNextDefensePeriodCommand
    {
        private readonly IDefensePeriodCommandProcessor _processor;
        public MoveNextDefensePeriodCommand(IDefensePeriodCommandProcessor processor) => _processor = processor;
        public Task<ApiResponse<bool>> ExecuteAsync(int periodId, int actorUserId, string? idempotencyKey = null, CancellationToken cancellationToken = default)
            => _processor.MoveNextStepAsync(periodId, actorUserId, idempotencyKey, cancellationToken);
    }
}

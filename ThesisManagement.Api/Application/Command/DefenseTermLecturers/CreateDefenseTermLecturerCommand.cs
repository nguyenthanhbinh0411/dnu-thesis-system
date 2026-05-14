using AutoMapper;
using Microsoft.EntityFrameworkCore;
using ThesisManagement.Api.Application.Common;
using ThesisManagement.Api.Application.Validate.DefenseTermLecturers;
using ThesisManagement.Api.DTOs.DefenseTermLecturers.Command;
using ThesisManagement.Api.DTOs.DefenseTermLecturers.Query;
using ThesisManagement.Api.Models;
using ThesisManagement.Api.Services;

namespace ThesisManagement.Api.Application.Command.DefenseTermLecturers
{
    public interface ICreateDefenseTermLecturerCommand
    {
        Task<OperationResult<DefenseTermLecturerReadDto>> ExecuteAsync(DefenseTermLecturerCreateDto dto);
    }

    public class CreateDefenseTermLecturerCommand : ICreateDefenseTermLecturerCommand
    {
        private readonly IUnitOfWork _uow;
        private readonly IMapper _mapper;

        public CreateDefenseTermLecturerCommand(IUnitOfWork uow, IMapper mapper)
        {
            _uow = uow;
            _mapper = mapper;
        }

        public async Task<OperationResult<DefenseTermLecturerReadDto>> ExecuteAsync(DefenseTermLecturerCreateDto dto)
        {
            var validationError = DefenseTermLecturerCommandValidator.ValidateCreate(dto);
            if (!string.IsNullOrWhiteSpace(validationError))
                return OperationResult<DefenseTermLecturerReadDto>.Failed(validationError, 400);

            var defenseTerm = await _uow.DefenseTerms.GetByIdAsync(dto.DefenseTermId);
            if (defenseTerm == null)
                return OperationResult<DefenseTermLecturerReadDto>.Failed("DefenseTerm not found", 404);

            var lecturer = await ResolveLecturerProfileAsync(dto);
            if (lecturer == null)
                return OperationResult<DefenseTermLecturerReadDto>.Failed("Lecturer profile not found", 404);

            var userCode = await ResolveUserCodeAsync(dto.UserCode, lecturer);
            if (string.IsNullOrWhiteSpace(userCode))
                return OperationResult<DefenseTermLecturerReadDto>.Failed("Lecturer user code is required", 400);

            var duplicate = await _uow.DefenseTermLecturers.Query()
                .FirstOrDefaultAsync(x => x.DefenseTermId == dto.DefenseTermId && x.LecturerProfileID == lecturer.LecturerProfileID);
            if (duplicate != null)
                return OperationResult<DefenseTermLecturerReadDto>.Failed("This lecturer already exists in the defense term", 400);

            var createdAt = dto.CreatedAt ?? DateTime.UtcNow;
            var entity = new DefenseTermLecturer
            {
                DefenseTermId = dto.DefenseTermId,
                LecturerProfileID = lecturer.LecturerProfileID,
                LecturerCode = lecturer.LecturerCode,
                UserCode = userCode.Trim(),
                IsPrimary = dto.IsPrimary,
                CreatedAt = createdAt,
                LastUpdated = dto.LastUpdated ?? createdAt,
                DefenseTerm = defenseTerm,
                LecturerProfile = lecturer
            };

            await _uow.DefenseTermLecturers.AddAsync(entity);
            await _uow.SaveChangesAsync();
            return OperationResult<DefenseTermLecturerReadDto>.Succeeded(_mapper.Map<DefenseTermLecturerReadDto>(entity));
        }

        private async Task<LecturerProfile?> ResolveLecturerProfileAsync(DefenseTermLecturerCreateDto dto)
        {
            if (dto.LecturerProfileID.HasValue)
                return await _uow.LecturerProfiles.Query().FirstOrDefaultAsync(x => x.LecturerProfileID == dto.LecturerProfileID.Value);

            if (!string.IsNullOrWhiteSpace(dto.LecturerCode))
            {
                var lecturerCode = dto.LecturerCode.Trim();
                return await _uow.LecturerProfiles.Query().FirstOrDefaultAsync(x => x.LecturerCode == lecturerCode);
            }

            return null;
        }

        private async Task<string?> ResolveUserCodeAsync(string? requestedUserCode, LecturerProfile lecturer)
        {
            if (!string.IsNullOrWhiteSpace(requestedUserCode))
                return requestedUserCode.Trim();

            if (!string.IsNullOrWhiteSpace(lecturer.UserCode))
                return lecturer.UserCode.Trim();

            if (lecturer.UserID > 0)
            {
                var user = await _uow.Users.GetByIdAsync(lecturer.UserID);
                if (user != null && !string.IsNullOrWhiteSpace(user.UserCode))
                    return user.UserCode.Trim();
            }

            return null;
        }
    }
}
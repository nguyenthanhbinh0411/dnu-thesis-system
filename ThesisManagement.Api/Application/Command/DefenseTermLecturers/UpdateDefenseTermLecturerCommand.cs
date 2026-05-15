using AutoMapper;
using Microsoft.EntityFrameworkCore;
using ThesisManagement.Api.Application.Common;
using ThesisManagement.Api.DTOs.DefenseTermLecturers.Command;
using ThesisManagement.Api.DTOs.DefenseTermLecturers.Query;
using ThesisManagement.Api.Models;
using ThesisManagement.Api.Services;

namespace ThesisManagement.Api.Application.Command.DefenseTermLecturers
{
    public interface IUpdateDefenseTermLecturerCommand
    {
        Task<OperationResult<DefenseTermLecturerReadDto>> ExecuteAsync(int id, DefenseTermLecturerUpdateDto dto);
    }

    public class UpdateDefenseTermLecturerCommand : IUpdateDefenseTermLecturerCommand
    {
        private readonly IUnitOfWork _uow;
        private readonly IMapper _mapper;

        public UpdateDefenseTermLecturerCommand(IUnitOfWork uow, IMapper mapper)
        {
            _uow = uow;
            _mapper = mapper;
        }

        public async Task<OperationResult<DefenseTermLecturerReadDto>> ExecuteAsync(int id, DefenseTermLecturerUpdateDto dto)
        {
            var entity = await _uow.DefenseTermLecturers.GetByIdAsync(id);
            if (entity == null)
                return OperationResult<DefenseTermLecturerReadDto>.Failed("DefenseTermLecturer not found", 404);

            var defenseTermId = dto.DefenseTermId ?? entity.DefenseTermId;
            var defenseTerm = await _uow.DefenseTerms.GetByIdAsync(defenseTermId);
            if (defenseTerm == null)
                return OperationResult<DefenseTermLecturerReadDto>.Failed("DefenseTerm not found", 404);

            var lecturer = await ResolveLecturerProfileAsync(dto, entity);
            if (lecturer == null)
                return OperationResult<DefenseTermLecturerReadDto>.Failed("Lecturer profile not found", 404);

            var userCode = await ResolveUserCodeAsync(dto.UserCode, lecturer, entity.UserCode);
            if (string.IsNullOrWhiteSpace(userCode))
                return OperationResult<DefenseTermLecturerReadDto>.Failed("Lecturer user code is required", 400);

            var duplicate = await _uow.DefenseTermLecturers.Query()
                .FirstOrDefaultAsync(x => x.DefenseTermId == defenseTermId && x.LecturerProfileID == lecturer.LecturerProfileID && x.DefenseTermLecturerID != id);
            if (duplicate != null)
                return OperationResult<DefenseTermLecturerReadDto>.Failed("This lecturer already exists in the defense term", 400);

            entity.DefenseTermId = defenseTermId;
            entity.LecturerProfileID = lecturer.LecturerProfileID;
            entity.LecturerCode = lecturer.LecturerCode;
            entity.UserCode = userCode.Trim();
            entity.IsPrimary = dto.IsPrimary ?? entity.IsPrimary;
            entity.CreatedAt = dto.CreatedAt ?? entity.CreatedAt;
            entity.LastUpdated = dto.LastUpdated ?? DateTime.UtcNow;
            entity.LecturerProfile = lecturer;
            entity.DefenseTerm = defenseTerm;

            _uow.DefenseTermLecturers.Update(entity);
            await _uow.SaveChangesAsync();
            return OperationResult<DefenseTermLecturerReadDto>.Succeeded(_mapper.Map<DefenseTermLecturerReadDto>(entity));
        }

        private async Task<LecturerProfile?> ResolveLecturerProfileAsync(DefenseTermLecturerUpdateDto dto, DefenseTermLecturer entity)
        {
            if (dto.LecturerProfileID.HasValue)
                return await _uow.LecturerProfiles.Query().FirstOrDefaultAsync(x => x.LecturerProfileID == dto.LecturerProfileID.Value);

            if (!string.IsNullOrWhiteSpace(dto.LecturerCode))
            {
                var lecturerCode = dto.LecturerCode.Trim();
                return await _uow.LecturerProfiles.Query().FirstOrDefaultAsync(x => x.LecturerCode == lecturerCode);
            }

            return await _uow.LecturerProfiles.Query().FirstOrDefaultAsync(x => x.LecturerProfileID == entity.LecturerProfileID);
        }

        private async Task<string?> ResolveUserCodeAsync(string? requestedUserCode, LecturerProfile lecturer, string existingUserCode)
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

            return existingUserCode;
        }
    }
}
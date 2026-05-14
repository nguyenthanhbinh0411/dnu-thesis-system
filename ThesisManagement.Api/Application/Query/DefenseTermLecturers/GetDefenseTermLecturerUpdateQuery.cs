using ThesisManagement.Api.DTOs.DefenseTermLecturers.Command;
using ThesisManagement.Api.Services;

namespace ThesisManagement.Api.Application.Query.DefenseTermLecturers
{
    public interface IGetDefenseTermLecturerUpdateQuery
    {
        Task<DefenseTermLecturerUpdateDto?> ExecuteAsync(int id);
    }

    public class GetDefenseTermLecturerUpdateQuery : IGetDefenseTermLecturerUpdateQuery
    {
        private readonly IUnitOfWork _uow;

        public GetDefenseTermLecturerUpdateQuery(IUnitOfWork uow)
        {
            _uow = uow;
        }

        public async Task<DefenseTermLecturerUpdateDto?> ExecuteAsync(int id)
        {
            var item = await _uow.DefenseTermLecturers.GetByIdAsync(id);
            if (item == null) return null;

            return new DefenseTermLecturerUpdateDto(
                item.DefenseTermId,
                item.LecturerProfileID,
                item.LecturerCode,
                item.UserCode,
                item.IsPrimary,
                item.CreatedAt,
                item.LastUpdated);
        }
    }
}
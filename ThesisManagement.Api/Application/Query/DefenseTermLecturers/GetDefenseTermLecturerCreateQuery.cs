using ThesisManagement.Api.DTOs.DefenseTermLecturers.Command;

namespace ThesisManagement.Api.Application.Query.DefenseTermLecturers
{
    public interface IGetDefenseTermLecturerCreateQuery
    {
        DefenseTermLecturerCreateDto Execute();
    }

    public class GetDefenseTermLecturerCreateQuery : IGetDefenseTermLecturerCreateQuery
    {
        public DefenseTermLecturerCreateDto Execute()
            => new(
                DefenseTermId: 0,
                LecturerProfileID: null,
                LecturerCode: null,
                UserCode: null,
                IsPrimary: false,
                CreatedAt: DateTime.UtcNow,
                LastUpdated: DateTime.UtcNow);
    }
}
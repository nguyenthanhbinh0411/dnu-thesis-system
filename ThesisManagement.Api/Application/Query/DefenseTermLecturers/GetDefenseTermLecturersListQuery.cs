using AutoMapper;
using Microsoft.EntityFrameworkCore;
using ThesisManagement.Api.DTOs.DefenseTermLecturers.Query;
using ThesisManagement.Api.Helpers;
using ThesisManagement.Api.Services;

namespace ThesisManagement.Api.Application.Query.DefenseTermLecturers
{
    public interface IGetDefenseTermLecturersListQuery
    {
        Task<(IEnumerable<DefenseTermLecturerReadDto> Items, int TotalCount)> ExecuteAsync(DefenseTermLecturerFilter filter);
    }

    public class GetDefenseTermLecturersListQuery : IGetDefenseTermLecturersListQuery
    {
        private readonly IUnitOfWork _uow;
        private readonly IMapper _mapper;

        public GetDefenseTermLecturersListQuery(IUnitOfWork uow, IMapper mapper)
        {
            _uow = uow;
            _mapper = mapper;
        }

        public async Task<(IEnumerable<DefenseTermLecturerReadDto> Items, int TotalCount)> ExecuteAsync(DefenseTermLecturerFilter filter)
        {
            var result = await _uow.DefenseTermLecturers.GetPagedWithFilterAsync(filter.Page, filter.PageSize, filter, (query, f) => query.Include(x => x.LecturerProfile).ApplyFilter(f));
            return (result.Items.Select(x => _mapper.Map<DefenseTermLecturerReadDto>(x)), result.TotalCount);
        }
    }
}
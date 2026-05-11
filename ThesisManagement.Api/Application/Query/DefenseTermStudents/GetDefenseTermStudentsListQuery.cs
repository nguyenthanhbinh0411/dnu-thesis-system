using AutoMapper;
using Microsoft.EntityFrameworkCore;
using ThesisManagement.Api.DTOs.DefenseTermStudents.Query;
using ThesisManagement.Api.Helpers;
using ThesisManagement.Api.Services;

namespace ThesisManagement.Api.Application.Query.DefenseTermStudents
{
    public interface IGetDefenseTermStudentsListQuery
    {
        Task<(IEnumerable<DefenseTermStudentReadDto> Items, int TotalCount)> ExecuteAsync(DefenseTermStudentFilter filter);
    }

    public class GetDefenseTermStudentsListQuery : IGetDefenseTermStudentsListQuery
    {
        private readonly IUnitOfWork _uow;
        private readonly IMapper _mapper;

        public GetDefenseTermStudentsListQuery(IUnitOfWork uow, IMapper mapper)
        {
            _uow = uow;
            _mapper = mapper;
        }

        public async Task<(IEnumerable<DefenseTermStudentReadDto> Items, int TotalCount)> ExecuteAsync(DefenseTermStudentFilter filter)
        {
            var result = await _uow.DefenseTermStudents.GetPagedWithFilterAsync(filter.Page, filter.PageSize, filter, (query, f) => query.Include(x => x.StudentProfile).ApplyFilter(f));
            return (result.Items.Select(x => _mapper.Map<DefenseTermStudentReadDto>(x)), result.TotalCount);
        }
    }
}
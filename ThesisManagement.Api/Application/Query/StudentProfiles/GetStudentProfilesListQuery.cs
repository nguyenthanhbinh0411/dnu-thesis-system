using AutoMapper;
using Microsoft.EntityFrameworkCore;
using ThesisManagement.Api.DTOs.StudentProfiles.Query;
using ThesisManagement.Api.Helpers;
using ThesisManagement.Api.Services;

namespace ThesisManagement.Api.Application.Query.StudentProfiles
{
    public interface IGetStudentProfilesListQuery
    {
        Task<(IEnumerable<StudentProfileReadDto> Items, int TotalCount)> ExecuteAsync(StudentProfileFilter filter);
    }

    public class GetStudentProfilesListQuery : IGetStudentProfilesListQuery
    {
        private readonly IUnitOfWork _uow;
        private readonly IMapper _mapper;

        public GetStudentProfilesListQuery(IUnitOfWork uow, IMapper mapper)
        {
            _uow = uow;
            _mapper = mapper;
        }

        public async Task<(IEnumerable<StudentProfileReadDto> Items, int TotalCount)> ExecuteAsync(StudentProfileFilter filter)
        {
            var result = await _uow.StudentProfiles.GetPagedWithFilterAsync(filter.Page, filter.PageSize, filter,
                (query, f) => 
                {
                    var filteredQuery = query.ApplyFilter(f);
                    if (f.ExcludeDefenseTermId.HasValue)
                    {
                        var excludedStudentProfileIds = _uow.DefenseTermStudents.Query().AsNoTracking()
                            .Where(dts => dts.DefenseTermId == f.ExcludeDefenseTermId.Value)
                            .Select(dts => dts.StudentProfileID);
                        
                        filteredQuery = filteredQuery.Where(sp => !excludedStudentProfileIds.Contains(sp.StudentProfileID));
                    }
                    return filteredQuery;
                });

            return (result.Items.Select(x => _mapper.Map<StudentProfileReadDto>(x)), result.TotalCount);
        }
    }
}

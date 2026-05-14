using System.Linq;
using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using ThesisManagement.Api.DTOs;
using ThesisManagement.Api.DTOs.CatalogTopics.Query;
using ThesisManagement.Api.DTOs.CatalogTopicTags.Query;
using ThesisManagement.Api.DTOs.Cohorts.Query;
using ThesisManagement.Api.DTOs.CommitteeMembers.Query;
using ThesisManagement.Api.DTOs.DefenseAssignments.Query;
using ThesisManagement.Api.DTOs.DefenseTermLecturers.Query;
using ThesisManagement.Api.DTOs.DefenseTermStudents.Query;
using ThesisManagement.Api.DTOs.DefenseTerms.Query;
using ThesisManagement.Api.DTOs.Departments.Query;
using ThesisManagement.Api.DTOs.LecturerProfiles.Query;
using ThesisManagement.Api.DTOs.LecturerTags.Query;
using ThesisManagement.Api.DTOs.MilestoneTemplates.Query;
using ThesisManagement.Api.DTOs.ProgressMilestones.Query;
using ThesisManagement.Api.DTOs.ProgressSubmissions.Query;
using ThesisManagement.Api.DTOs.StudentProfiles.Query;
using ThesisManagement.Api.DTOs.SubmissionFiles.Query;
using ThesisManagement.Api.DTOs.Tags.Query;
using ThesisManagement.Api.DTOs.SystemActivityLogs.Query;
using ThesisManagement.Api.DTOs.TopicLecturers.Query;
using ThesisManagement.Api.DTOs.TopicTags.Query;
using ThesisManagement.Api.DTOs.Topics.Query;
using ThesisManagement.Api.DTOs.Users.Query;
using ThesisManagement.Api.Models;

namespace ThesisManagement.Api.Helpers
{
    public static class FilterExtensions
    {
        public static IQueryable<Department> ApplyFilter(this IQueryable<Department> query, DepartmentFilter filter)
        {
            if (!string.IsNullOrEmpty(filter.Search))
            {
                query = query.Where(x => x.Name.Contains(filter.Search) || 
                                        x.DepartmentCode.Contains(filter.Search) ||
                                        (x.Description != null && x.Description.Contains(filter.Search)));
            }

            if (!string.IsNullOrEmpty(filter.Name))
                query = query.Where(x => x.Name.Contains(filter.Name));

            if (!string.IsNullOrEmpty(filter.DepartmentCode))
                query = query.Where(x => x.DepartmentCode.Contains(filter.DepartmentCode));

            if (filter.FromDate.HasValue)
                query = query.Where(x => x.CreatedAt >= filter.FromDate.Value);

            if (filter.ToDate.HasValue)
                query = query.Where(x => x.CreatedAt <= filter.ToDate.Value);

            return ApplySorting(query, filter);
        }

        public static IQueryable<Cohort> ApplyFilter(this IQueryable<Cohort> query, CohortFilter filter)
        {
            if (!string.IsNullOrEmpty(filter.Search))
            {
                query = query.Where(x => x.CohortName.Contains(filter.Search) ||
                                        x.CohortCode.Contains(filter.Search));
            }

            if (!string.IsNullOrEmpty(filter.CohortCode))
                query = query.Where(x => x.CohortCode.Contains(filter.CohortCode));

            if (!string.IsNullOrEmpty(filter.CohortName))
                query = query.Where(x => x.CohortName.Contains(filter.CohortName));

            if (filter.Status.HasValue)
                query = query.Where(x => x.Status == filter.Status.Value);

            if (filter.MinStartYear.HasValue)
                query = query.Where(x => x.StartYear >= filter.MinStartYear.Value);

            if (filter.MaxStartYear.HasValue)
                query = query.Where(x => x.StartYear <= filter.MaxStartYear.Value);

            if (filter.MinEndYear.HasValue)
                query = query.Where(x => x.EndYear >= filter.MinEndYear.Value);

            if (filter.MaxEndYear.HasValue)
                query = query.Where(x => x.EndYear <= filter.MaxEndYear.Value);

            if (filter.FromDate.HasValue)
                query = query.Where(x => x.CreatedAt >= filter.FromDate.Value);

            if (filter.ToDate.HasValue)
                query = query.Where(x => x.CreatedAt <= filter.ToDate.Value);

            return ApplySorting(query, filter);
        }

        public static IQueryable<User> ApplyFilter(this IQueryable<User> query, UserFilter filter)
        {
            if (!string.IsNullOrEmpty(filter.Search))
            {
                query = query.Where(x => x.UserCode.Contains(filter.Search));
            }

            if (!string.IsNullOrEmpty(filter.Username))
                query = query.Where(x => x.UserCode.Contains(filter.Username));

            if (!string.IsNullOrEmpty(filter.Role))
                query = query.Where(x => x.Role == filter.Role);

            if (!string.IsNullOrEmpty(filter.UserCode))
                query = query.Where(x => x.UserCode.Contains(filter.UserCode));

            if (filter.FromDate.HasValue)
                query = query.Where(x => x.CreatedAt >= filter.FromDate.Value);

            if (filter.ToDate.HasValue)
                query = query.Where(x => x.CreatedAt <= filter.ToDate.Value);

            return ApplySorting(query, filter);
        }

        public static IQueryable<StudentProfile> ApplyFilter(this IQueryable<StudentProfile> query, StudentProfileFilter filter)
        {
            if (!string.IsNullOrEmpty(filter.Search))
            {
                query = query.Where(x => x.StudentCode.Contains(filter.Search) ||
                                        (x.ClassCode != null && x.ClassCode.Contains(filter.Search)) ||
                                        (x.FacultyCode != null && x.FacultyCode.Contains(filter.Search)));
            }

            if (!string.IsNullOrWhiteSpace(filter.UserCode))
                query = query.Where(x => x.UserCode == filter.UserCode);

            if (!string.IsNullOrWhiteSpace(filter.DepartmentCode))
                query = query.Where(x => x.DepartmentCode == filter.DepartmentCode);

            // Support filtering by multiple student codes
            if (filter.StudentCodes != null && filter.StudentCodes.Any())
            {
                var codes = new HashSet<string>(filter.StudentCodes.Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => s.Trim()), StringComparer.OrdinalIgnoreCase);
                if (codes.Count > 0)
                {
                    query = query.Where(x => codes.Contains(x.StudentCode));
                }
            }
            else if (!string.IsNullOrEmpty(filter.StudentCode))
            {
                query = query.Where(x => x.StudentCode.Contains(filter.StudentCode));
            }

            if (!string.IsNullOrEmpty(filter.ClassCode))
                query = query.Where(x => x.ClassCode != null && x.ClassCode.Contains(filter.ClassCode));

            if (!string.IsNullOrEmpty(filter.FacultyCode))
                query = query.Where(x => x.FacultyCode != null && x.FacultyCode.Contains(filter.FacultyCode));

            if (!string.IsNullOrEmpty(filter.Gender))
                query = query.Where(x => x.Gender == filter.Gender);

            if (filter.DateOfBirthFrom.HasValue)
                query = query.Where(x => x.DateOfBirth >= filter.DateOfBirthFrom.Value);

            if (filter.DateOfBirthTo.HasValue)
                query = query.Where(x => x.DateOfBirth <= filter.DateOfBirthTo.Value);

            if (!string.IsNullOrEmpty(filter.PhoneNumber))
                query = query.Where(x => x.PhoneNumber != null && x.PhoneNumber.Contains(filter.PhoneNumber));

            if (!string.IsNullOrEmpty(filter.StudentEmail))
                query = query.Where(x => x.StudentEmail != null && x.StudentEmail.Contains(filter.StudentEmail));

            if (!string.IsNullOrEmpty(filter.Address))
                query = query.Where(x => x.Address != null && x.Address.Contains(filter.Address));

            if (filter.MinEnrollmentYear.HasValue)
                query = query.Where(x => x.EnrollmentYear >= filter.MinEnrollmentYear.Value);

            if (filter.MaxEnrollmentYear.HasValue)
                query = query.Where(x => x.EnrollmentYear <= filter.MaxEnrollmentYear.Value);

            if (!string.IsNullOrEmpty(filter.Status))
                query = query.Where(x => x.Status == filter.Status);

            if (filter.MinGraduationYear.HasValue)
                query = query.Where(x => x.GraduationYear >= filter.MinGraduationYear.Value);

            if (filter.MaxGraduationYear.HasValue)
                query = query.Where(x => x.GraduationYear <= filter.MaxGraduationYear.Value);

            if (filter.MinGPA.HasValue)
                query = query.Where(x => x.GPA >= filter.MinGPA.Value);

            if (filter.MaxGPA.HasValue)
                query = query.Where(x => x.GPA <= filter.MaxGPA.Value);

            if (!string.IsNullOrEmpty(filter.AcademicStanding))
                query = query.Where(x => x.AcademicStanding == filter.AcademicStanding);

            if (filter.FromDate.HasValue)
                query = query.Where(x => x.CreatedAt >= filter.FromDate.Value);

            if (filter.ToDate.HasValue)
                query = query.Where(x => x.CreatedAt <= filter.ToDate.Value);

            return ApplySorting(query, filter);
        }

        public static IQueryable<LecturerProfile> ApplyFilter(this IQueryable<LecturerProfile> query, LecturerProfileFilter filter)
        {
            if (!string.IsNullOrEmpty(filter.Search))
            {
                query = query.Where(x => x.LecturerCode.Contains(filter.Search) ||
                                        (x.Degree != null && x.Degree.Contains(filter.Search)));
            }

            if (!string.IsNullOrWhiteSpace(filter.UserCode))
                query = query.Where(x => x.UserCode == filter.UserCode);

            if (!string.IsNullOrWhiteSpace(filter.DepartmentCode))
                query = query.Where(x => x.DepartmentCode == filter.DepartmentCode);

            // Support filtering by multiple lecturer codes
            if (filter.LecturerCodes != null && filter.LecturerCodes.Any())
            {
                var codes = new HashSet<string>(filter.LecturerCodes.Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => s.Trim()), StringComparer.OrdinalIgnoreCase);
                if (codes.Count > 0)
                {
                    query = query.Where(x => codes.Contains(x.LecturerCode));
                }
            }
            else if (!string.IsNullOrEmpty(filter.LecturerCode))
            {
                query = query.Where(x => x.LecturerCode.Contains(filter.LecturerCode));
            }

            if (!string.IsNullOrEmpty(filter.Degree))
                query = query.Where(x => x.Degree != null && x.Degree.Contains(filter.Degree));

            if (filter.MinGuideQuota.HasValue)
                query = query.Where(x => x.GuideQuota >= filter.MinGuideQuota.Value);

            if (filter.MaxGuideQuota.HasValue)
                query = query.Where(x => x.GuideQuota <= filter.MaxGuideQuota.Value);

            if (filter.MinDefenseQuota.HasValue)
                query = query.Where(x => x.DefenseQuota >= filter.MinDefenseQuota.Value);

            if (filter.MaxDefenseQuota.HasValue)
                query = query.Where(x => x.DefenseQuota <= filter.MaxDefenseQuota.Value);

            // Tags filtering - support multiple TagCodes
            var tagCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (filter.TagCodes != null)
            {
                foreach (var code in filter.TagCodes)
                {
                    if (!string.IsNullOrWhiteSpace(code))
                        tagCodes.Add(code.Trim());
                }
            }
            // Also support comma-separated Tags string parameter
            if (!string.IsNullOrEmpty(filter.Tags))
            {
                var tagValues = filter.Tags.Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries);
                foreach (var tag in tagValues)
                {
                    var value = tag.Trim();
                    if (!string.IsNullOrWhiteSpace(value))
                        tagCodes.Add(value);
                }
            }

            if (filter.FromDate.HasValue)
                query = query.Where(x => x.CreatedAt >= filter.FromDate.Value);

            if (filter.ToDate.HasValue)
                query = query.Where(x => x.CreatedAt <= filter.ToDate.Value);

            return ApplySorting(query, filter);
        }

        public static IQueryable<CatalogTopic> ApplyFilter(this IQueryable<CatalogTopic> query, CatalogTopicFilter filter)
        {
            if (!string.IsNullOrEmpty(filter.Search))
            {
                query = query.Where(x => x.Title.Contains(filter.Search) ||
                                        x.CatalogTopicCode.Contains(filter.Search) ||
                                        (x.Summary != null && x.Summary.Contains(filter.Search)));
            }

            if (!string.IsNullOrEmpty(filter.Title))
                query = query.Where(x => x.Title.Contains(filter.Title));

            if (!string.IsNullOrEmpty(filter.CatalogTopicCode))
                query = query.Where(x => x.CatalogTopicCode.Contains(filter.CatalogTopicCode));

            // Tags filtering now through relationship
            if (!string.IsNullOrEmpty(filter.Tags))
                query = query.Where(x => x.CatalogTopicTags!.Any(ct => ct.Tag!.TagName.Contains(filter.Tags)));

            // Filter by department - prefer Code-based filtering
            if (!string.IsNullOrEmpty(filter.DepartmentCode))
                query = query.Where(x => x.DepartmentCode == filter.DepartmentCode);

            if (!string.IsNullOrEmpty(filter.AssignedStatus))
                query = query.Where(x => x.AssignedStatus == filter.AssignedStatus);

            // Filter by owner lecturer
            if (!string.IsNullOrEmpty(filter.OwnerLecturerCode))
                query = query.Where(x => x.Department!.LecturerProfiles!.Any(lp => lp.LecturerCode == filter.OwnerLecturerCode));


            if (filter.FromDate.HasValue)
                query = query.Where(x => x.CreatedAt >= filter.FromDate.Value);

            if (filter.ToDate.HasValue)
                query = query.Where(x => x.CreatedAt <= filter.ToDate.Value);

            return ApplySorting(query, filter);
        }

        public static IQueryable<Topic> ApplyFilter(this IQueryable<Topic> query, TopicFilter filter)
        {
            if (!string.IsNullOrEmpty(filter.Search))
            {
                query = query.Where(x => x.Title.Contains(filter.Search) ||
                                        x.TopicCode.Contains(filter.Search) ||
                                        (x.Summary != null && x.Summary.Contains(filter.Search)) ||
                                        (x.ProposerUserCode != null && x.ProposerUserCode.Contains(filter.Search)) ||
                                        (x.ProposerStudentCode != null && x.ProposerStudentCode.Contains(filter.Search)) ||
                                        (x.SupervisorUserCode != null && x.SupervisorUserCode.Contains(filter.Search)) ||
                                        (x.SupervisorLecturerCode != null && x.SupervisorLecturerCode.Contains(filter.Search)) ||
                                        (x.DepartmentCode != null && x.DepartmentCode.Contains(filter.Search)));
            }

            if (!string.IsNullOrEmpty(filter.Title))
                query = query.Where(x => x.Title.Contains(filter.Title));

            if (!string.IsNullOrEmpty(filter.Summary))
                query = query.Where(x => x.Summary != null && x.Summary.Contains(filter.Summary));

            if (!string.IsNullOrEmpty(filter.TopicCode))
                query = query.Where(x => x.TopicCode.Contains(filter.TopicCode));

            // Tags filtering - support multiple TagCodes via join with TopicTag table
            var tagCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (filter.TagCodes != null)
            {
                foreach (var code in filter.TagCodes)
                {
                    if (!string.IsNullOrWhiteSpace(code))
                        tagCodes.Add(code.Trim());
                }
            }
            // Also support comma-separated Tags string parameter
            if (!string.IsNullOrEmpty(filter.Tags))
            {
                var tagValues = filter.Tags.Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries);
                foreach (var tag in tagValues)
                {
                    var value = tag.Trim();
                    if (!string.IsNullOrWhiteSpace(value))
                        tagCodes.Add(value);
                }
            }

            if (tagCodes.Count > 0)
            {
                var db = query.Provider.CreateQuery<Topic>(query.Expression).AsQueryable();
                // Note: TopicTag filtering requires database context access, which should be handled 
                // at the service/repository level by joining with TopicTag table before applying this filter.
                // For now, this is a placeholder for tag filtering when called from appropriate context.
            }

            if (!string.IsNullOrEmpty(filter.Type))
                query = query.Where(x => x.Type == filter.Type);

            if (!string.IsNullOrEmpty(filter.Status))
                query = query.Where(x => x.Status == filter.Status);

            if (!string.IsNullOrWhiteSpace(filter.ProposerUserCode))
                query = query.Where(x => x.ProposerUserCode == filter.ProposerUserCode);

            if (!string.IsNullOrWhiteSpace(filter.ProposerStudentCode))
                query = query.Where(x => x.ProposerStudentCode == filter.ProposerStudentCode);

            if (!string.IsNullOrWhiteSpace(filter.SupervisorUserCode))
                query = query.Where(x => x.SupervisorUserCode == filter.SupervisorUserCode);

            if (!string.IsNullOrWhiteSpace(filter.SupervisorLecturerCode))
                query = query.Where(x => x.SupervisorLecturerCode == filter.SupervisorLecturerCode);

            if (!string.IsNullOrWhiteSpace(filter.DepartmentCode))
                query = query.Where(x => x.DepartmentCode == filter.DepartmentCode);

            if (!string.IsNullOrWhiteSpace(filter.CatalogTopicCode))
                query = query.Where(x => x.CatalogTopicCode == filter.CatalogTopicCode);

            if (filter.DefenseTermId.HasValue)
                query = query.Where(x => x.DefenseTermId == filter.DefenseTermId.Value);

            if (filter.FromDate.HasValue)
                query = query.Where(x => x.CreatedAt >= filter.FromDate.Value);

            if (filter.ToDate.HasValue)
                query = query.Where(x => x.CreatedAt <= filter.ToDate.Value);

            return ApplySorting(query, filter);
        }

        public static IQueryable<ProgressMilestone> ApplyFilter(this IQueryable<ProgressMilestone> query, ProgressMilestoneFilter filter)
        {
            if (!string.IsNullOrEmpty(filter.Search))
            {
                query = query.Where(x => x.MilestoneCode.Contains(filter.Search) ||
                                        (x.TopicCode != null && x.TopicCode.Contains(filter.Search)));
            }

            if (filter.TopicID.HasValue)
                query = query.Where(x => x.TopicID == filter.TopicID.Value);

            if (!string.IsNullOrWhiteSpace(filter.TopicCode))
                query = query.Where(x => x.TopicCode == filter.TopicCode);

            if (filter.DefenseTermId.HasValue)
                query = query.Where(x => x.Topic != null && x.Topic.DefenseTermId == filter.DefenseTermId.Value);

            // Type field removed from ProgressMilestone - skip type-based filtering

            if (!string.IsNullOrEmpty(filter.MilestoneTemplateCode))
                query = query.Where(x => x.MilestoneTemplateCode == filter.MilestoneTemplateCode);

            if (!string.IsNullOrEmpty(filter.State))
                query = query.Where(x => x.State == filter.State);

            if (!string.IsNullOrEmpty(filter.MilestoneCode))
                query = query.Where(x => x.MilestoneCode.Contains(filter.MilestoneCode));

            if (filter.Deadline.HasValue)
                query = query.Where(x => x.Deadline.HasValue && x.Deadline.Value.Date == filter.Deadline.Value.Date);

            if (filter.MinOrdinal.HasValue)
                query = query.Where(x => x.Ordinal >= filter.MinOrdinal.Value);

            if (filter.MaxOrdinal.HasValue)
                query = query.Where(x => x.Ordinal <= filter.MaxOrdinal.Value);

            if (filter.StartedFrom.HasValue)
                query = query.Where(x => x.StartedAt >= filter.StartedFrom.Value);

            if (filter.StartedTo.HasValue)
                query = query.Where(x => x.StartedAt <= filter.StartedTo.Value);

            if (filter.CompletedFrom.HasValue)
                query = query.Where(x =>
                    (x.CompletedAt1.HasValue && x.CompletedAt1.Value >= filter.CompletedFrom.Value) ||
                    (x.CompletedAt2.HasValue && x.CompletedAt2.Value >= filter.CompletedFrom.Value) ||
                    (x.CompletedAt3.HasValue && x.CompletedAt3.Value >= filter.CompletedFrom.Value) ||
                    (x.CompletedAt4.HasValue && x.CompletedAt4.Value >= filter.CompletedFrom.Value) ||
                    (x.CompletedAt5.HasValue && x.CompletedAt5.Value >= filter.CompletedFrom.Value)
                );

            if (filter.CompletedTo.HasValue)
                query = query.Where(x =>
                    (x.CompletedAt1.HasValue && x.CompletedAt1.Value <= filter.CompletedTo.Value) ||
                    (x.CompletedAt2.HasValue && x.CompletedAt2.Value <= filter.CompletedTo.Value) ||
                    (x.CompletedAt3.HasValue && x.CompletedAt3.Value <= filter.CompletedTo.Value) ||
                    (x.CompletedAt4.HasValue && x.CompletedAt4.Value <= filter.CompletedTo.Value) ||
                    (x.CompletedAt5.HasValue && x.CompletedAt5.Value <= filter.CompletedTo.Value)
                );

            if (filter.FromDate.HasValue)
                query = query.Where(x => x.CreatedAt >= filter.FromDate.Value);

            if (filter.ToDate.HasValue)
                query = query.Where(x => x.CreatedAt <= filter.ToDate.Value);

            return ApplySorting(query, filter);
        }

        public static IQueryable<DefenseAssignment> ApplyFilter(this IQueryable<DefenseAssignment> query, DefenseAssignmentFilter filter)
        {
            if (!string.IsNullOrEmpty(filter.Search))
            {
                query = query.Where(x => x.AssignmentCode.Contains(filter.Search));
            }

            if (!string.IsNullOrWhiteSpace(filter.TopicCode))
                query = query.Where(x => x.TopicCode == filter.TopicCode);

            if (!string.IsNullOrWhiteSpace(filter.CommitteeCode))
                query = query.Where(x => x.CommitteeCode == filter.CommitteeCode);

            if (!string.IsNullOrEmpty(filter.AssignmentCode))
                query = query.Where(x => x.AssignmentCode.Contains(filter.AssignmentCode));

            if (filter.ScheduledAt.HasValue)
                query = query.Where(x => x.ScheduledAt.HasValue && x.ScheduledAt.Value.Date == filter.ScheduledAt.Value.Date);

            if (filter.FromDate.HasValue)
                query = query.Where(x => x.CreatedAt >= filter.FromDate.Value);

            if (filter.ToDate.HasValue)
                query = query.Where(x => x.CreatedAt <= filter.ToDate.Value);

            return ApplySorting(query, filter);
        }

        // Specialty filter removed - table deleted from database

        private static IQueryable<T> ApplySorting<T>(IQueryable<T> query, BaseFilter filter)
        {
            if (string.IsNullOrEmpty(filter.SortBy))
                return query;

            var parameter = Expression.Parameter(typeof(T), "x");
            var property = Expression.Property(parameter, filter.SortBy);
            var lambda = Expression.Lambda(property, parameter);

            string methodName = filter.SortDescending ? "OrderByDescending" : "OrderBy";
            
            var resultExpression = Expression.Call(
                typeof(Queryable),
                methodName,
                new Type[] { typeof(T), property.Type },
                query.Expression,
                Expression.Quote(lambda)
            );

            return query.Provider.CreateQuery<T>(resultExpression);
        }

        public static IQueryable<CommitteeMember> ApplyFilter(this IQueryable<CommitteeMember> query, CommitteeMemberFilter filter)
        {
            if (!string.IsNullOrEmpty(filter.Search))
            {
                query = query.Where(x => x.Role != null && x.Role.Contains(filter.Search));
            }

            if (!string.IsNullOrWhiteSpace(filter.CommitteeCode))
                query = query.Where(x => x.Committee!.CommitteeCode == filter.CommitteeCode);

            if (!string.IsNullOrWhiteSpace(filter.LecturerUserCode))
                query = query.Where(x => x.MemberUser!.UserCode == filter.LecturerUserCode);

            if (!string.IsNullOrWhiteSpace(filter.LecturerCode))
                query = query.Where(x => x.MemberLecturerProfile!.LecturerCode == filter.LecturerCode);

            if (!string.IsNullOrEmpty(filter.Role))
                query = query.Where(x => x.Role != null && x.Role.Contains(filter.Role));

            if (filter.FromDate.HasValue)
                query = query.Where(x => x.CreatedAt >= filter.FromDate.Value);

            if (filter.ToDate.HasValue)
                query = query.Where(x => x.CreatedAt <= filter.ToDate.Value);

            return ApplySorting(query, filter);
        }

        public static IQueryable<DefenseTerm> ApplyFilter(this IQueryable<DefenseTerm> query, DefenseTermFilter filter)
        {
            if (!string.IsNullOrWhiteSpace(filter.Search))
            {
                query = query.Where(x => x.Name.Contains(filter.Search) ||
                                         (x.Status != null && x.Status.Contains(filter.Search)) ||
                                         (x.ConfigJson != null && x.ConfigJson.Contains(filter.Search)));
            }

            if (!string.IsNullOrWhiteSpace(filter.Name))
                query = query.Where(x => x.Name.Contains(filter.Name));

            if (!string.IsNullOrWhiteSpace(filter.Status))
                query = query.Where(x => x.Status == filter.Status);

            if (filter.StartFromDate.HasValue)
                query = query.Where(x => x.StartDate >= filter.StartFromDate.Value);

            if (filter.StartToDate.HasValue)
                query = query.Where(x => x.StartDate <= filter.StartToDate.Value);

            if (filter.FromDate.HasValue)
                query = query.Where(x => x.CreatedAt >= filter.FromDate.Value);

            if (filter.ToDate.HasValue)
                query = query.Where(x => x.CreatedAt <= filter.ToDate.Value);

            return ApplySorting(query, filter);
        }

        public static IQueryable<DefenseTermStudent> ApplyFilter(this IQueryable<DefenseTermStudent> query, DefenseTermStudentFilter filter)
        {
            if (filter.DefenseTermId.HasValue)
                query = query.Where(x => x.DefenseTermId == filter.DefenseTermId.Value);

            if (filter.StudentProfileID.HasValue)
                query = query.Where(x => x.StudentProfileID == filter.StudentProfileID.Value);

            if (!string.IsNullOrWhiteSpace(filter.StudentCode))
                query = query.Where(x => x.StudentCode == filter.StudentCode);

            if (!string.IsNullOrWhiteSpace(filter.UserCode))
                query = query.Where(x => x.UserCode == filter.UserCode);

            if (filter.FromDate.HasValue)
                query = query.Where(x => x.CreatedAt >= filter.FromDate.Value);

            if (filter.ToDate.HasValue)
                query = query.Where(x => x.CreatedAt <= filter.ToDate.Value);

            return ApplySorting(query, filter);
        }

        public static IQueryable<DefenseTermLecturer> ApplyFilter(this IQueryable<DefenseTermLecturer> query, DefenseTermLecturerFilter filter)
        {
            if (filter.DefenseTermId.HasValue)
                query = query.Where(x => x.DefenseTermId == filter.DefenseTermId.Value);

            if (filter.LecturerProfileID.HasValue)
                query = query.Where(x => x.LecturerProfileID == filter.LecturerProfileID.Value);

            if (!string.IsNullOrWhiteSpace(filter.LecturerCode))
                query = query.Where(x => x.LecturerCode == filter.LecturerCode);

            if (!string.IsNullOrWhiteSpace(filter.UserCode))
                query = query.Where(x => x.UserCode == filter.UserCode);

            if (filter.IsPrimary.HasValue)
                query = query.Where(x => x.IsPrimary == filter.IsPrimary.Value);

            if (filter.FromDate.HasValue)
                query = query.Where(x => x.CreatedAt >= filter.FromDate.Value);

            if (filter.ToDate.HasValue)
                query = query.Where(x => x.CreatedAt <= filter.ToDate.Value);

            return ApplySorting(query, filter);
        }

        // LecturerSpecialty filter removed - table deleted from database

        public static IQueryable<TopicLecturer> ApplyFilter(this IQueryable<TopicLecturer> query, TopicLecturerFilter filter)
        {
            if (!string.IsNullOrWhiteSpace(filter.TopicCode))
                query = query.Where(x => x.TopicCode == filter.TopicCode);

            if (!string.IsNullOrWhiteSpace(filter.LecturerCode))
                query = query.Where(x => x.LecturerProfile!.LecturerCode == filter.LecturerCode);

            if (filter.IsPrimary.HasValue)
                query = query.Where(x => x.IsPrimary == filter.IsPrimary.Value);

            if (filter.FromDate.HasValue)
                query = query.Where(x => x.CreatedAt >= filter.FromDate.Value);

            if (filter.ToDate.HasValue)
                query = query.Where(x => x.CreatedAt <= filter.ToDate.Value);

            return ApplySorting(query, filter);
        }

        public static IQueryable<ProgressSubmission> ApplyFilter(this IQueryable<ProgressSubmission> query, ProgressSubmissionFilter filter)
        {
            if (!string.IsNullOrEmpty(filter.Search))
            {
                query = query.Where(x => x.SubmissionCode.Contains(filter.Search) ||
                                        (x.LecturerComment != null && x.LecturerComment.Contains(filter.Search)));
            }

            if (!string.IsNullOrEmpty(filter.SubmissionCode))
                query = query.Where(x => x.SubmissionCode.Contains(filter.SubmissionCode));

            if (filter.DefenseTermId.HasValue)
                query = query.Where(x => x.Milestone != null && x.Milestone.Topic != null && x.Milestone.Topic.DefenseTermId == filter.DefenseTermId.Value);

            if (filter.MilestoneID.HasValue)
                query = query.Where(x => x.MilestoneID == filter.MilestoneID.Value);

            if (!string.IsNullOrWhiteSpace(filter.MilestoneCode))
                query = query.Where(x => x.MilestoneCode == filter.MilestoneCode);

            if (filter.StudentUserID.HasValue)
                query = query.Where(x => x.StudentUserID == filter.StudentUserID.Value);

            if (!string.IsNullOrWhiteSpace(filter.StudentUserCode))
                query = query.Where(x => x.StudentUserCode == filter.StudentUserCode);

            if (filter.StudentProfileID.HasValue)
                query = query.Where(x => x.StudentProfileID == filter.StudentProfileID.Value);

            if (!string.IsNullOrWhiteSpace(filter.StudentProfileCode))
                query = query.Where(x => x.StudentProfileCode == filter.StudentProfileCode);

            if (filter.LecturerProfileID.HasValue)
                query = query.Where(x => x.LecturerProfileID == filter.LecturerProfileID.Value);

            if (!string.IsNullOrWhiteSpace(filter.LecturerCode))
                query = query.Where(x => x.LecturerCode == filter.LecturerCode);

            if (!string.IsNullOrEmpty(filter.LecturerState))
                query = query.Where(x => x.LecturerState == filter.LecturerState);

            if (filter.SubmittedFrom.HasValue)
                query = query.Where(x => x.SubmittedAt >= filter.SubmittedFrom.Value);

            if (filter.SubmittedTo.HasValue)
                query = query.Where(x => x.SubmittedAt <= filter.SubmittedTo.Value);

            if (filter.MinAttemptNumber.HasValue)
                query = query.Where(x => x.AttemptNumber >= filter.MinAttemptNumber.Value);

            if (filter.MaxAttemptNumber.HasValue)
                query = query.Where(x => x.AttemptNumber <= filter.MaxAttemptNumber.Value);

            // MimeType and file columns live in SubmissionFiles. If caller wants to filter by mime/file, use SubmissionFile endpoints.

            if (filter.FromDate.HasValue)
                query = query.Where(x => x.LastUpdated >= filter.FromDate.Value);

            if (filter.ToDate.HasValue)
                query = query.Where(x => x.LastUpdated <= filter.ToDate.Value);

            return ApplySorting(query, filter);
        }

        public static IQueryable<MilestoneTemplate> ApplyFilter(this IQueryable<MilestoneTemplate> query, MilestoneTemplateFilter filter)
        {
            if (!string.IsNullOrEmpty(filter.Search))
            {
                query = query.Where(x => x.MilestoneTemplateCode.Contains(filter.Search) ||
                                        x.Name.Contains(filter.Search));
            }

            if (!string.IsNullOrEmpty(filter.MilestoneTemplateCode))
                query = query.Where(x => x.MilestoneTemplateCode.Contains(filter.MilestoneTemplateCode));

            if (!string.IsNullOrEmpty(filter.Name))
                query = query.Where(x => x.Name.Contains(filter.Name));

            if (filter.MinOrdinal.HasValue)
                query = query.Where(x => x.Ordinal >= filter.MinOrdinal.Value);

            if (filter.MaxOrdinal.HasValue)
                query = query.Where(x => x.Ordinal <= filter.MaxOrdinal.Value);

            if (filter.CreatedFrom.HasValue)
                query = query.Where(x => x.CreatedAt >= filter.CreatedFrom.Value);

            if (filter.CreatedTo.HasValue)
                query = query.Where(x => x.CreatedAt <= filter.CreatedTo.Value);

            if (filter.FromDate.HasValue)
                query = query.Where(x => x.CreatedAt >= filter.FromDate.Value);

            if (filter.ToDate.HasValue)
                query = query.Where(x => x.CreatedAt <= filter.ToDate.Value);

            return ApplySorting(query, filter);
        }

        public static IQueryable<SubmissionFile> ApplyFilter(this IQueryable<SubmissionFile> query, SubmissionFileFilter filter)
        {
            if (!string.IsNullOrEmpty(filter.Search))
            {
                query = query.Where(x => x.FileURL.Contains(filter.Search) ||
                                        (x.FileName != null && x.FileName.Contains(filter.Search)));
            }

            if (filter.SubmissionID.HasValue)
                query = query.Where(x => x.SubmissionID == filter.SubmissionID.Value);

            if (!string.IsNullOrEmpty(filter.SubmissionCode))
                query = query.Where(x => x.SubmissionCode != null && x.SubmissionCode.Contains(filter.SubmissionCode));

            if (!string.IsNullOrEmpty(filter.FileName))
                query = query.Where(x => x.FileName != null && x.FileName.Contains(filter.FileName));

            if (!string.IsNullOrEmpty(filter.MimeType))
                query = query.Where(x => x.MimeType != null && x.MimeType.Contains(filter.MimeType));

            if (!string.IsNullOrEmpty(filter.UploadedByUserCode))
                query = query.Where(x => x.UploadedByUserCode != null && x.UploadedByUserCode.Contains(filter.UploadedByUserCode));

            if (filter.UploadedByUserID.HasValue)
                query = query.Where(x => x.UploadedByUserID == filter.UploadedByUserID.Value);

            if (filter.UploadedFrom.HasValue)
                query = query.Where(x => x.UploadedAt >= filter.UploadedFrom.Value);

            if (filter.UploadedTo.HasValue)
                query = query.Where(x => x.UploadedAt <= filter.UploadedTo.Value);

            if (filter.FromDate.HasValue)
                query = query.Where(x => x.UploadedAt >= filter.FromDate.Value);

            if (filter.ToDate.HasValue)
                query = query.Where(x => x.UploadedAt <= filter.ToDate.Value);

            return ApplySorting(query, filter);
        }

        public static IQueryable<LecturerTag> ApplyFilter(this IQueryable<LecturerTag> query, LecturerTagFilter filter)
        {
            if (filter.LecturerProfileID.HasValue)
                query = query.Where(x => x.LecturerProfileID == filter.LecturerProfileID.Value);

            if (!string.IsNullOrWhiteSpace(filter.LecturerCode))
                query = query.Where(x => x.LecturerCode == filter.LecturerCode);

            if (filter.TagID.HasValue)
                query = query.Where(x => x.TagID == filter.TagID.Value);

            // Support multiple TagCodes: either filter.TagCodes (collection) or comma-separated filter.TagCode
            var tagCodes = new List<string>();
            if (filter.TagCodes != null)
                tagCodes.AddRange(filter.TagCodes.Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => s.Trim()));
            if (!string.IsNullOrWhiteSpace(filter.TagCode))
            {
                // allow comma-separated values in TagCode for backward compatibility
                tagCodes.AddRange(filter.TagCode.Split(',').Select(s => s.Trim()).Where(s => !string.IsNullOrWhiteSpace(s)));
            }

            if (tagCodes.Any())
                query = query.Where(x => x.TagCode != null && tagCodes.Contains(x.TagCode));

            if (filter.AssignedByUserID.HasValue)
                query = query.Where(x => x.AssignedByUserID == filter.AssignedByUserID.Value);

            if (!string.IsNullOrWhiteSpace(filter.AssignedByUserCode))
                query = query.Where(x => x.AssignedByUserCode == filter.AssignedByUserCode);

            if (filter.AssignedFromDate.HasValue)
                query = query.Where(x => x.AssignedAt >= filter.AssignedFromDate.Value);

            if (filter.AssignedToDate.HasValue)
                query = query.Where(x => x.AssignedAt <= filter.AssignedToDate.Value);

            return ApplySorting(query, filter);
        }

        public static IQueryable<Tag> ApplyFilter(this IQueryable<Tag> query, TagFilter filter)
        {
            if (!string.IsNullOrWhiteSpace(filter.Search))
            {
                query = query.Where(x => x.TagName.Contains(filter.Search) ||
                                        x.TagCode.Contains(filter.Search) ||
                                        (x.Description != null && x.Description.Contains(filter.Search)));
            }

            if (!string.IsNullOrWhiteSpace(filter.TagCode))
                query = query.Where(x => x.TagCode.Contains(filter.TagCode));

            if (!string.IsNullOrWhiteSpace(filter.TagName))
                query = query.Where(x => x.TagName.Contains(filter.TagName));

            if (!string.IsNullOrWhiteSpace(filter.Description))
                query = query.Where(x => x.Description != null && x.Description.Contains(filter.Description));

            if (filter.FromDate.HasValue)
                query = query.Where(x => x.CreatedAt >= filter.FromDate.Value);

            if (filter.ToDate.HasValue)
                query = query.Where(x => x.CreatedAt <= filter.ToDate.Value);

            return ApplySorting(query, filter);
        }

        public static IQueryable<CatalogTopicTag> ApplyFilter(this IQueryable<CatalogTopicTag> query, CatalogTopicTagFilter filter)
        {
            if (filter.CatalogTopicID.HasValue)
                query = query.Where(x => x.CatalogTopicID == filter.CatalogTopicID.Value);

            if (filter.TagID.HasValue)
                query = query.Where(x => x.TagID == filter.TagID.Value);

            if (!string.IsNullOrWhiteSpace(filter.CatalogTopicCode))
                query = query.Where(x => x.CatalogTopicCode == filter.CatalogTopicCode);

            if (!string.IsNullOrWhiteSpace(filter.TagCode))
                query = query.Where(x => x.TagCode == filter.TagCode);

            if (filter.FromDate.HasValue)
                query = query.Where(x => x.CreatedAt >= filter.FromDate.Value);

            if (filter.ToDate.HasValue)
                query = query.Where(x => x.CreatedAt <= filter.ToDate.Value);

            return ApplySorting(query, filter);
        }

        public static IQueryable<TopicTag> ApplyFilter(this IQueryable<TopicTag> query, TopicTagFilter filter)
        {
            if (filter.TagID.HasValue)
                query = query.Where(x => x.TagID == filter.TagID.Value);

            if (!string.IsNullOrWhiteSpace(filter.TagCode))
                query = query.Where(x => x.TagCode == filter.TagCode);

            if (!string.IsNullOrWhiteSpace(filter.CatalogTopicCode))
                query = query.Where(x => x.CatalogTopicCode == filter.CatalogTopicCode);

            if (!string.IsNullOrWhiteSpace(filter.TopicCode))
                query = query.Where(x => x.TopicCode == filter.TopicCode);

            if (filter.FromDate.HasValue)
                query = query.Where(x => x.CreatedAt >= filter.FromDate.Value);

            if (filter.ToDate.HasValue)
                query = query.Where(x => x.CreatedAt <= filter.ToDate.Value);

            return ApplySorting(query, filter);
        }

        public static IQueryable<SystemActivityLog> ApplyFilter(this IQueryable<SystemActivityLog> query, SystemActivityLogFilter filter)
        {
            if (!string.IsNullOrEmpty(filter.Search))
            {
                query = query.Where(x => 
                    (x.EntityName != null && x.EntityName.Contains(filter.Search)) ||
                    (x.EntityID != null && x.EntityID.Contains(filter.Search)) ||
                    (x.ActionDescription != null && x.ActionDescription.Contains(filter.Search)) ||
                    (x.UserCode != null && x.UserCode.Contains(filter.Search)));
            }

            if (!string.IsNullOrEmpty(filter.EntityName))
                query = query.Where(x => x.EntityName == filter.EntityName);

            if (!string.IsNullOrEmpty(filter.EntityID))
                query = query.Where(x => x.EntityID == filter.EntityID);

            if (!string.IsNullOrEmpty(filter.ActionType))
                query = query.Where(x => x.ActionType == filter.ActionType);

            if (filter.UserID.HasValue)
                query = query.Where(x => x.UserID == filter.UserID.Value);

            if (!string.IsNullOrEmpty(filter.UserCode))
                query = query.Where(x => x.UserCode == filter.UserCode);

            if (!string.IsNullOrEmpty(filter.UserRole))
                query = query.Where(x => x.UserRole == filter.UserRole);

            if (!string.IsNullOrEmpty(filter.Module))
                query = query.Where(x => x.Module == filter.Module);

            if (!string.IsNullOrEmpty(filter.Status))
                query = query.Where(x => x.Status == filter.Status);

            if (!string.IsNullOrEmpty(filter.IPAddress))
                query = query.Where(x => x.IPAddress == filter.IPAddress);

            if (filter.PerformedFrom.HasValue)
                query = query.Where(x => x.PerformedAt >= filter.PerformedFrom.Value);

            if (filter.PerformedTo.HasValue)
                query = query.Where(x => x.PerformedAt <= filter.PerformedTo.Value);

            if (filter.FromDate.HasValue)
                query = query.Where(x => x.PerformedAt >= filter.FromDate.Value);

            if (filter.ToDate.HasValue)
                query = query.Where(x => x.PerformedAt <= filter.ToDate.Value);

            return ApplySorting(query, filter);
        }
    }
}
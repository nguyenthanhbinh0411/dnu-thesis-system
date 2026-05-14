using AutoMapper;
using ThesisManagement.Api.DTOs;
using ThesisManagement.Api.DTOs.CatalogTopics.Query;
using ThesisManagement.Api.DTOs.CatalogTopicTags.Query;
using ThesisManagement.Api.DTOs.Cohorts.Query;
using ThesisManagement.Api.DTOs.ConversationMembers.Query;
using ThesisManagement.Api.DTOs.Conversations.Query;
using ThesisManagement.Api.DTOs.DefenseTerms.Query;
using ThesisManagement.Api.DTOs.Departments.Query;
using ThesisManagement.Api.DTOs.LecturerProfiles.Query;
using ThesisManagement.Api.DTOs.LecturerTags.Query;
using ThesisManagement.Api.DTOs.MilestoneTemplates.Query;
using ThesisManagement.Api.DTOs.MessageAttachments.Query;
using ThesisManagement.Api.DTOs.MessageReadReceipts.Query;
using ThesisManagement.Api.DTOs.MessageReactions.Query;
using ThesisManagement.Api.DTOs.Messages.Query;
using ThesisManagement.Api.DTOs.ProgressMilestones.Query;
using ThesisManagement.Api.DTOs.ProgressSubmissions.Query;
using ThesisManagement.Api.DTOs.DefenseTermLecturers.Query;
using ThesisManagement.Api.DTOs.DefenseTermStudents.Query;
using ThesisManagement.Api.DTOs.TopicRenameRequests.Query;
using ThesisManagement.Api.DTOs.StudentProfiles.Query;
using ThesisManagement.Api.DTOs.SubmissionFiles.Query;
using ThesisManagement.Api.DTOs.SystemActivityLogs.Query;
using ThesisManagement.Api.DTOs.Tags.Query;
using ThesisManagement.Api.DTOs.TopicLecturers.Query;
using ThesisManagement.Api.DTOs.TopicTags.Query;
using ThesisManagement.Api.DTOs.Topics.Query;
using ThesisManagement.Api.DTOs.Users.Query;
using ThesisManagement.Api.DTOs.Revisions;
using ThesisManagement.Api.Models;

namespace ThesisManagement.Api.Mappings
{
    public class MappingProfile : Profile
    {
        public MappingProfile()
        {
            CreateMap<Department, DepartmentReadDto>();
            CreateMap<Cohort, CohortReadDto>();
            CreateMap<User, UserReadDto>();
            CreateMap<User, LoginResponseDto>();
            CreateMap<StudentProfile, StudentProfileReadDto>();
            CreateMap<LecturerProfile, LecturerProfileReadDto>();
            CreateMap<CatalogTopic, CatalogTopicReadDto>();
            CreateMap<Topic, TopicReadDto>()
                .ForMember(dest => dest.ProposerStudentProfileID, opt => opt.MapFrom(src => src.ProposerStudentProfileID))
                .ForMember(dest => dest.SupervisorLecturerProfileID, opt => opt.MapFrom(src => src.SupervisorLecturerProfileID))
                .ForMember(dest => dest.CatalogTopicID, opt => opt.MapFrom(src => src.CatalogTopicID))
                .ForMember(dest => dest.CatalogTopicCode, opt => opt.MapFrom(src => src.CatalogTopicCode))
                .ForMember(dest => dest.DepartmentID, opt => opt.MapFrom(src => src.DepartmentID))
                .ForMember(dest => dest.DepartmentCode, opt => opt.MapFrom(src => src.DepartmentCode))
                .ForMember(dest => dest.DefenseTermId, opt => opt.MapFrom(src => src.DefenseTermId));
            CreateMap<ProgressMilestone, ProgressMilestoneReadDto>()
                .ForMember(dest => dest.CompletedAt1, opt => opt.MapFrom(src => src.CompletedAt1))
                .ForMember(dest => dest.CompletedAt2, opt => opt.MapFrom(src => src.CompletedAt2))
                .ForMember(dest => dest.CompletedAt3, opt => opt.MapFrom(src => src.CompletedAt3))
                .ForMember(dest => dest.CompletedAt4, opt => opt.MapFrom(src => src.CompletedAt4))
                .ForMember(dest => dest.CompletedAt5, opt => opt.MapFrom(src => src.CompletedAt5));
            CreateMap<ProgressSubmission, ProgressSubmissionReadDto>();
            CreateMap<MilestoneTemplate, MilestoneTemplateReadDto>();
            CreateMap<SubmissionFile, SubmissionFileReadDto>();
            // TODO: CreateMap<Committee, CommitteeReadDto>();
            // TODO: CreateMap<CommitteeMember, CommitteeMemberReadDto>();
            // TODO: CreateMap<DefenseAssignment, DefenseAssignmentReadDto>();
            
            CreateMap<Tag, TagReadDto>();
            CreateMap<Conversation, ConversationReadDto>();
            CreateMap<ConversationMember, ConversationMemberReadDto>();
            CreateMap<Message, MessageReadDto>();
            CreateMap<MessageAttachment, MessageAttachmentReadDto>();
            CreateMap<MessageReaction, MessageReactionReadDto>();
            CreateMap<MessageReadReceipt, MessageReadReceiptReadDto>();
            CreateMap<DefenseTerm, DefenseTermReadDto>();
            CreateMap<DefenseTermStudent, DefenseTermStudentReadDto>()
                .ForMember(dest => dest.FullName, opt => opt.MapFrom(src => src.StudentProfile != null ? src.StudentProfile.FullName : null))
                .ForMember(dest => dest.ClassCode, opt => opt.MapFrom(src => src.StudentProfile != null ? src.StudentProfile.ClassCode : null))
                .ForMember(dest => dest.FacultyCode, opt => opt.MapFrom(src => src.StudentProfile != null ? src.StudentProfile.FacultyCode : null))
                .ForMember(dest => dest.DepartmentCode, opt => opt.MapFrom(src => src.StudentProfile != null ? src.StudentProfile.DepartmentCode : null))
                .ForMember(dest => dest.GPA, opt => opt.MapFrom(src => src.StudentProfile != null ? src.StudentProfile.GPA : null));
            CreateMap<DefenseTermLecturer, DefenseTermLecturerReadDto>()
                .ForMember(dest => dest.LecturerName, opt => opt.MapFrom(src => src.LecturerProfile != null ? src.LecturerProfile.FullName : null))
                .ForMember(dest => dest.FullName, opt => opt.MapFrom(src => src.LecturerProfile != null ? src.LecturerProfile.FullName : null))
                .ForMember(dest => dest.DepartmentCode, opt => opt.MapFrom(src => src.LecturerProfile != null ? src.LecturerProfile.DepartmentCode : null))
                .ForMember(dest => dest.Degree, opt => opt.MapFrom(src => src.LecturerProfile != null ? src.LecturerProfile.Degree : null));
            CreateMap<TopicRenameRequest, TopicRenameRequestReadDto>();
            CreateMap<TopicRenameRequestFile, TopicRenameRequestFileReadDto>();
            CreateMap<TopicTitleHistory, TopicTitleHistoryReadDto>();
            CreateMap<TopicLecturer, TopicLecturerReadDto>();
            CreateMap<LecturerTag, LecturerTagReadDto>();
            CreateMap<CatalogTopicTag, CatalogTopicTagReadDto>();
            CreateMap<TopicTag, TopicTagReadDto>();
            CreateMap<SystemActivityLog, SystemActivityLogReadDto>();
            
            // Post-Defense (Hậu Bảo Vệ) Mappings
            CreateMap<DefenseRevision, RevisionReadDto>()
                .ForMember(dest => dest.Status, opt => opt.MapFrom(src => src.Status.ToString()));
        }
    }
}

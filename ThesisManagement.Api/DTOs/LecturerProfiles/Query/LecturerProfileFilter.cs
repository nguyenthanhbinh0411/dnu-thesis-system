using System.Collections.Generic;

namespace ThesisManagement.Api.DTOs.LecturerProfiles.Query
{
    public class LecturerProfileFilter : BaseFilter
    {
        public IEnumerable<string>? LecturerCodes { get; set; }
        public string? UserCode { get; set; }
        public string? DepartmentCode { get; set; }
        public string? LecturerCode { get; set; }
        public string? Degree { get; set; }
        public int? MinGuideQuota { get; set; }
        public int? MaxGuideQuota { get; set; }
        public int? MinDefenseQuota { get; set; }
        public int? MaxDefenseQuota { get; set; }
        public IEnumerable<string>? TagCodes { get; set; }
        public string? Tags { get; set; }
        public int? ExcludeDefenseTermId { get; set; }
    }
}
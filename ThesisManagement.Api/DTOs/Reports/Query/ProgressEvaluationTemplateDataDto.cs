using System;

namespace ThesisManagement.Api.DTOs.Reports.Query
{
    public class ProgressEvaluationTemplateDataDto
    {
        public string? LecturerName { get; set; }
        public string? LecturerDegree { get; set; }
        public string? StudentName { get; set; }
        public string? StudentCode { get; set; }
        public string? ClassName { get; set; }
        public string? EnrollmentYear { get; set; }
        public string? MajorName { get; set; }
        public string? TopicTitle { get; set; }
        public string? ReviewQuality { get; set; }
        public string? ReviewAttitude { get; set; }
        public string? ReviewCapability { get; set; }
        public string? ReviewResultProcessing { get; set; }
        public string? ReviewAchievements { get; set; }
        public string? ReviewLimitations { get; set; }
        public string? ReviewConclusion { get; set; }
        public string? NumChapters { get; set; }
        public string? NumPages { get; set; }
        public string? NumTables { get; set; }
        public string? NumFigures { get; set; }
        public string? NumReferences { get; set; }
        public string? NumVnReferences { get; set; }
        public string? NumForeignReferences { get; set; }
        public string? ScoreNumber { get; set; }
        public string? ScoreInWords { get; set; }
        public string? Day { get; set; }
        public string? Month { get; set; }
        public string? Year { get; set; }
    }
}

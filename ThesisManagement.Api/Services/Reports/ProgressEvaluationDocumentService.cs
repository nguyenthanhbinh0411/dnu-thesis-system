using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using Microsoft.AspNetCore.Hosting;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ThesisManagement.Api.DTOs.Reports.Query;

namespace ThesisManagement.Api.Services.Reports
{
    public sealed class ProgressEvaluationDocumentService : IProgressEvaluationDocumentService
    {
        private const string TemplateFileName = "PHIẾU ĐÁNH GIÁ.docx";
        private readonly IWebHostEnvironment _environment;

        public ProgressEvaluationDocumentService(IWebHostEnvironment environment)
        {
            _environment = environment;
        }

        public async Task<byte[]> BuildEvaluationFormAsync(ProgressEvaluationTemplateDataDto data, CancellationToken cancellationToken = default)
        {
            var templatePath = Path.Combine(_environment.ContentRootPath, "Templates", TemplateFileName);
            if (!File.Exists(templatePath))
                throw new FileNotFoundException($"Template file not found: {templatePath}", templatePath);

            var templateBytes = await File.ReadAllBytesAsync(templatePath, cancellationToken);
            using var memory = new MemoryStream(templateBytes);
            using (var document = WordprocessingDocument.Open(memory, true))
            {
                var mainDocumentPart = document.MainDocumentPart ?? throw new InvalidOperationException("Template document is missing a main document part.");
                var mainDocument = mainDocumentPart.Document ?? throw new InvalidOperationException("Template document is missing the document body.");

                var replacements = new Dictionary<string, string?>
                {
                    ["{{LecturerName}}"] = data.LecturerName,
                    ["{{LecturerDegree}}"] = data.LecturerDegree,
                    ["{{StudentName}}"] = (data.StudentName ?? "") + " ", // Add space to prevent merging with "MSV:"
                    ["{{StudentCode}}"] = data.StudentCode,
                    ["{{ClassName}}"] = (data.ClassName ?? "") + " ", // Add space to prevent merging with "Khóa:"
                    ["{{EnrollmentYear}}"] = (data.EnrollmentYear ?? "") + " ", // Add space to prevent merging with "Ngành học:"
                    ["{{MajorName}}"] = data.MajorName,
                    ["{{TopicTitle}}"] = data.TopicTitle,
                    ["{{ReviewQuality}}"] = data.ReviewQuality,
                    ["{{ReviewAttitude}}"] = data.ReviewAttitude,
                    ["{{ReviewCapability}}"] = data.ReviewCapability,
                    ["{{ReviewResultProcessing}}"] = data.ReviewResultProcessing,
                    ["{{ReviewAchievements}}"] = data.ReviewAchievements,
                    ["{{ReviewLimitations}}"] = data.ReviewLimitations,
                    ["{{ReviewConclusion}}"] = data.ReviewConclusion,
                    ["{{NumChapters}}"] = data.NumChapters,
                    ["{{NumPages}}"] = data.NumPages,
                    ["{{NumTables}}"] = data.NumTables,
                    ["{{NumFigures}}"] = data.NumFigures,
                    ["{{NumReferences}}"] = data.NumReferences,
                    ["{{NumVnReferences}}"] = data.NumVnReferences,
                    ["{{NumForeignReferences}}"] = data.NumForeignReferences,
                    ["{{ScoreNumber}}"] = data.ScoreNumber,
                    ["{{ScoreInWords}}"] = data.ScoreInWords,
                    ["{{Day}}"] = data.Day,
                    ["{{Month}}"] = data.Month,
                    ["{{Year}}"] = data.Year
                };

                ReplaceText(mainDocument, replacements);

                foreach (var headerPart in mainDocumentPart.HeaderParts)
                    ReplaceText(headerPart.Header, replacements);

                foreach (var footerPart in mainDocumentPart.FooterParts)
                    ReplaceText(footerPart.Footer, replacements);

                mainDocument.Save();
            }

            return memory.ToArray();
        }

        private static void ReplaceText(OpenXmlPartRootElement? root, IReadOnlyDictionary<string, string?> replacements)
        {
            if (root == null)
                return;

            foreach (var paragraph in root.Descendants<Paragraph>())
            {
                var texts = paragraph.Descendants<Text>().ToList();
                if (texts.Count == 0)
                    continue;

                var value = string.Concat(texts.Select(x => x.Text));
                var replaced = value;

                foreach (var replacement in replacements)
                {
                    if (!replaced.Contains(replacement.Key, StringComparison.Ordinal))
                        continue;

                    var newValue = replacement.Value ?? string.Empty;
                    replaced = replaced.Replace(replacement.Key, newValue, StringComparison.Ordinal);

                    // Optimization: If we just inserted a non-empty value and there are dots following it, 
                    // try to trim some dots to prevent line jumping.
                    if (!string.IsNullOrEmpty(newValue) && newValue.Length > 5)
                    {
                        // Simple heuristic: if there are more than 5 dots after the replacement point, trim them
                        // This is tricky with string.Replace, so we just do a basic cleanup of long dot sequences
                        // if they exist in the resulting string.
                        if (replaced.Contains(".........."))
                        {
                            replaced = replaced.Replace("..........", "...", StringComparison.Ordinal);
                        }
                    }
                }

                if (!string.Equals(value, replaced, StringComparison.Ordinal))
                {
                    texts[0].Text = replaced;
                    for (var i = 1; i < texts.Count; i++)
                    {
                        texts[i].Text = string.Empty;
                    }
                }
            }
        }
    }
}

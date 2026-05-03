using System.Reflection;
using Aspose.Words;
using ThesisManagement.Api.DTOs.DocumentExports;
using Xceed.Words.NET;
using AsposeWordDocument = Aspose.Words.Document;

namespace ThesisManagement.Api.Services.DocumentExports;

public sealed class DocumentExportService : IDocumentExportService
{
    private static readonly IReadOnlyDictionary<DocumentExportType, string> TemplateNames = new Dictionary<DocumentExportType, string>
    {
        [DocumentExportType.BangDiem] = "BẢNG ĐIỂM GHI KẾT QUẢ BẢO VỆ.docx",
        [DocumentExportType.BienBan] = "BIÊN BẢN HỌP.docx",
        [DocumentExportType.NhanXet] = "NHẬN XÉT CỦA NGƯỜI PHẢN BIỆN.docx"
    };

    private readonly IWebHostEnvironment _environment;

    public DocumentExportService(IWebHostEnvironment environment)
    {
        _environment = environment;
    }

    public async Task<ExportFileResult> ExportWordAsync(DocumentExportType type, ReportData reportData, CancellationToken cancellationToken = default)
    {
        var templatePath = GetTemplatePath(type);

        using var templateStream = File.OpenRead(templatePath);
        using var document = DocX.Load(templateStream);

        var tokens = BuildTokenMap(reportData);
        ApplyTokenReplacements(document, tokens);

        var output = new MemoryStream();
        document.SaveAs(output);

        return await Task.FromResult(new ExportFileResult(output.ToArray(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document", BuildFileName(type, "docx")));
    }

    public async Task<ExportFileResult> ExportPdfAsync(DocumentExportType type, ReportData reportData, CancellationToken cancellationToken = default)
    {
        var wordExport = await ExportWordAsync(type, reportData, cancellationToken);

        using var input = new MemoryStream(wordExport.Content);
        var wordDocument = new AsposeWordDocument(input);
        var output = new MemoryStream();
        wordDocument.Save(output, SaveFormat.Pdf);

        return new ExportFileResult(output.ToArray(), "application/pdf", BuildFileName(type, "pdf"));
    }

    private static void ApplyTokenReplacements(DocX document, IReadOnlyDictionary<string, string?> tokenMap)
    {
        foreach (var token in tokenMap)
        {
            document.ReplaceText(token.Key, token.Value ?? string.Empty);
        }
    }

    private static Dictionary<string, string?> BuildTokenMap(ReportData reportData)
    {
        var tokens = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);

        foreach (var property in typeof(ReportData).GetProperties(BindingFlags.Public | BindingFlags.Instance))
        {
            if (property.PropertyType != typeof(string))
            {
                continue;
            }

            var value = property.GetValue(reportData) as string;
            if (!string.IsNullOrWhiteSpace(value))
            {
                tokens[$"{{{{{property.Name}}}}}"] = value;
            }
        }

        SetIfMissing(tokens, "StudentCode", reportData.Student?.StudentCode);
        SetIfMissing(tokens, "StudentFullName", reportData.Student?.FullName);
        SetIfMissing(tokens, "ClassName", reportData.Student?.ClassName);
        SetIfMissing(tokens, "CourseName", reportData.Student?.CourseName);
        SetIfMissing(tokens, "TopicTitle", reportData.Student?.TopicTitle ?? reportData.TopicTitle);
        SetIfMissing(tokens, "MajorName", reportData.Student?.MajorName ?? reportData.MajorName);

        SetIfMissing(tokens, "ChairMemberDisplay", reportData.ChairMemberDisplay ?? reportData.ChairMember?.GetDisplayName());
        SetIfMissing(tokens, "ReviewerMemberDisplay", reportData.ReviewerMemberDisplay ?? reportData.ReviewerMember?.GetDisplayName());
        SetIfMissing(tokens, "SecretaryMemberDisplay", reportData.SecretaryMemberDisplay ?? reportData.SecretaryMember?.GetDisplayName());
        SetIfMissing(tokens, "SupervisorDisplay", reportData.SupervisorDisplay ?? reportData.Supervisor?.GetDisplayName());
        SetIfMissing(tokens, "ReviewerDisplay", reportData.ReviewerDisplay ?? reportData.ReviewerMember?.GetDisplayName());

        SetIfMissing(tokens, "Chapter1Content", reportData.Chapter1Content);
        SetIfMissing(tokens, "Chapter2Content", reportData.Chapter2Content);
        SetIfMissing(tokens, "Chapter3Content", reportData.Chapter3Content);
        SetIfMissing(tokens, "ChapterNContent", reportData.ChapterNContent);

        var chapters = reportData.ChapterContents.Where(content => !string.IsNullOrWhiteSpace(content)).Select(content => content.Trim()).ToList();
        if (chapters.Count > 0)
        {
            SetIfMissing(tokens, "Chapter1Content", chapters.ElementAtOrDefault(0));
            SetIfMissing(tokens, "Chapter2Content", chapters.ElementAtOrDefault(1));
            SetIfMissing(tokens, "Chapter3Content", chapters.ElementAtOrDefault(2));

            if (chapters.Count > 3)
            {
                SetIfMissing(tokens, "ChapterNContent", string.Join(Environment.NewLine + Environment.NewLine, chapters.Skip(3)));
            }
        }

        foreach (var additionalToken in reportData.AdditionalTokens)
        {
            tokens[$"{{{{{additionalToken.Key}}}}}"] = additionalToken.Value;
        }

        return tokens;
    }

    private string GetTemplatePath(DocumentExportType type)
    {
        if (!TemplateNames.TryGetValue(type, out var fileName))
        {
            throw new ArgumentOutOfRangeException(nameof(type), type, "Unsupported export type.");
        }

        var templatePath = Path.Combine(_environment.ContentRootPath, "Templates", fileName);
        if (!File.Exists(templatePath))
        {
            throw new FileNotFoundException($"Template file was not found: {fileName}", templatePath);
        }

        return templatePath;
    }

    private static void SetIfMissing(IDictionary<string, string?> tokens, string tokenName, string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return;
        }

        var tokenKey = $"{{{{{tokenName}}}}}";
        if (!tokens.ContainsKey(tokenKey))
        {
            tokens[tokenKey] = value;
        }
    }

    private static string BuildFileName(DocumentExportType type, string extension)
    {
        var baseName = type switch
        {
            DocumentExportType.BangDiem => "bang-diem",
            DocumentExportType.BienBan => "bien-ban",
            DocumentExportType.NhanXet => "nhan-xet",
            _ => "export"
        };

        return $"{baseName}-{DateTime.UtcNow:yyyyMMdd-HHmmss}.{extension}";
    }
}

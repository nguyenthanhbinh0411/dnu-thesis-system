using System.Text;
using System.Text.Json;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Aspose.Words;
using Paragraph = DocumentFormat.OpenXml.Wordprocessing.Paragraph;
using ThesisManagement.Api.DTOs;
using ThesisManagement.Api.DTOs.DefensePeriods;
using ThesisManagement.Api.Models;
using ThesisManagement.Api.Services.DocumentExports;
using ExportCommitteeMember = ThesisManagement.Api.DTOs.DocumentExports.CommitteeMember;
using ExportReportData = ThesisManagement.Api.DTOs.DocumentExports.ReportData;
using ExportStudent = ThesisManagement.Api.DTOs.DocumentExports.Student;
using ExportType = ThesisManagement.Api.DTOs.DocumentExports.DocumentExportType;

namespace ThesisManagement.Api.Services.DefenseDocuments
{
    public sealed class DefenseTemplateExportService : IDefenseTemplateExportService
    {
        private const string FixedMajorName = "Công nghệ thông tin";
        private const string FixedMajorCode = "CNTT";
        private const string MeetingTemplateFileName = "BIÊN BẢN HỌP.docx";
        private const string ReviewerTemplateFileName = "NHẬN XÉT CỦA NGƯỜI PHẢN BIỆN.docx";
        private const string DocxMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        private const string PdfMime = "application/pdf";
        private const string ExtendedMarker = "[MINUTE_EXTENDED_JSON]";

        private readonly IUnitOfWork _uow;
        private readonly IWebHostEnvironment _environment;
        private readonly IDocumentExportService _documentExportService;

        public DefenseTemplateExportService(
            IUnitOfWork uow,
            IWebHostEnvironment environment,
            IDocumentExportService documentExportService)
        {
            _uow = uow;
            _environment = environment;
            _documentExportService = documentExportService;
        }

        public async Task<ApiResponse<(byte[] Content, string FileName, string ContentType)>> ExportMeetingMinutesAsync(
            int periodId,
            int committeeId,
            int assignmentId,
            CancellationToken cancellationToken = default)
        {
            var context = await BuildContextAsync(periodId, committeeId, assignmentId, cancellationToken);
            if (!context.Success)
            {
                return ApiResponse<(byte[] Content, string FileName, string ContentType)>.Fail(
                    context.Message,
                    context.StatusCode);
            }

            var data = context.Data!;
            var reportData = BuildReportData(data, ParseMinutePayload(data.Minute?.ReviewerComments));
            var export = await _documentExportService.ExportWordAsync(ExportType.BienBan, reportData, cancellationToken);
            return ApiResponse<(byte[] Content, string FileName, string ContentType)>.SuccessResponse((
                export.Content,
                export.FileName,
                export.ContentType));
        }

        public async Task<ApiResponse<(byte[] Content, string FileName, string ContentType)>> ExportReviewerCommentsAsync(
            int periodId,
            int committeeId,
            int assignmentId,
            CancellationToken cancellationToken = default)
        {
            var context = await BuildContextAsync(periodId, committeeId, assignmentId, cancellationToken);
            if (!context.Success)
            {
                return ApiResponse<(byte[] Content, string FileName, string ContentType)>.Fail(
                    context.Message,
                    context.StatusCode);
            }

            var data = context.Data!;
            var reportData = BuildReportData(data, ParseMinutePayload(data.Minute?.ReviewerComments));
            var export = await _documentExportService.ExportWordAsync(ExportType.NhanXet, reportData, cancellationToken);
            return ApiResponse<(byte[] Content, string FileName, string ContentType)>.SuccessResponse((
                export.Content,
                export.FileName,
                export.ContentType));
        }

        public async Task<ApiResponse<(byte[] Content, string FileName, string ContentType)>> ExportMeetingMinutesPdfAsync(
            int periodId,
            int committeeId,
            int assignmentId,
            CancellationToken cancellationToken = default)
        {
            var context = await BuildContextAsync(periodId, committeeId, assignmentId, cancellationToken);
            if (!context.Success)
            {
                return ApiResponse<(byte[] Content, string FileName, string ContentType)>.Fail(
                    context.Message,
                    context.StatusCode);
            }

            var data = context.Data!;
            var reportData = BuildReportData(data, ParseMinutePayload(data.Minute?.ReviewerComments));
            var export = await _documentExportService.ExportPdfAsync(ExportType.BienBan, reportData, cancellationToken);
            return ApiResponse<(byte[] Content, string FileName, string ContentType)>.SuccessResponse((
                export.Content,
                export.FileName,
                export.ContentType));
        }

        public async Task<ApiResponse<(byte[] Content, string FileName, string ContentType)>> ExportReviewerCommentsPdfAsync(
            int periodId,
            int committeeId,
            int assignmentId,
            CancellationToken cancellationToken = default)
        {
            var context = await BuildContextAsync(periodId, committeeId, assignmentId, cancellationToken);
            if (!context.Success)
            {
                return ApiResponse<(byte[] Content, string FileName, string ContentType)>.Fail(
                    context.Message,
                    context.StatusCode);
            }

            var data = context.Data!;
            var reportData = BuildReportData(data, ParseMinutePayload(data.Minute?.ReviewerComments));
            var export = await _documentExportService.ExportPdfAsync(ExportType.NhanXet, reportData, cancellationToken);
            return ApiResponse<(byte[] Content, string FileName, string ContentType)>.SuccessResponse((
                export.Content,
                export.FileName,
                export.ContentType));
        }

        private static ExportReportData BuildReportData(ExportContextData data, ParsedMinutePayload parsedMinute)
        {
            var defenseDate = data.Committee?.DefenseDate ?? data.Assignment?.ScheduledAt;
            var reviewer = ResolveReviewer(data.Members, data.MemberProfiles);
            var chair = ResolveMemberByRole(data.Members, data.MemberProfiles, "CT");
            var secretary = ResolveMemberByRole(data.Members, data.MemberProfiles, "UVTK");
            var reviewerMember = ResolveMemberByRole(data.Members, data.MemberProfiles, "UVPB");
            var committeeComments = FirstNonEmpty(parsedMinute.CommitteeMemberComments);

            var reviewerQuestions = parsedMinute.QuestionAnswers
                .Where(x => GetQuestionSource(x.Question) == "II.1")
                .Select((x, idx) => $"{idx + 1}. {StripQuestionSource(x.Question)}")
                .ToList();

            var studentAnswers = parsedMinute.QuestionAnswers
                .Where(x => !string.IsNullOrWhiteSpace(x.Answer))
                .Select((x, idx) => $"{idx + 1}. {x.Answer!.Trim()}")
                .ToList();

            var reportData = new ExportReportData
            {
                CommitteeCode = FirstNonEmpty(data.Assignment?.CommitteeCode, data.Committee?.CommitteeCode, data.Committee?.Name),
                DefenseDate = FormatDate(defenseDate),
                DefenseDay = defenseDate?.Day.ToString("00"),
                DefenseMonth = defenseDate?.Month.ToString("00"),
                DefenseYear = defenseDate?.Year.ToString(),
                MajorCode = FixedMajorCode,
                MajorName = FixedMajorName,
                TopicTitle = data.Topic?.Title,
                FinalScoreNumber = FormatScore(data.Result?.FinalScoreNumeric),
                FinalScoreText = data.Result?.FinalScoreText,
                MeetingEndTime = FormatTime(null, data.Assignment?.EndTime, data.Assignment?.ScheduledAt),
                PresentMemberCount = data.Members.Count.ToString(),
                AbsentMemberCount = "0",
                ReviewerQuestions = reviewerQuestions.Count > 0 ? string.Join(Environment.NewLine, reviewerQuestions) : committeeComments,
                StudentAnswers = studentAnswers.Count > 0 ? string.Join(Environment.NewLine, studentAnswers) : string.Empty,
                Strengths = data.Minute?.Strengths,
                Weaknesses = data.Minute?.Weaknesses,
                Recommendations = data.Minute?.Recommendations,
                ScoreCTNote = string.Empty,
                ScoreCTNumber = FormatScore(data.Result?.ScoreCt),
                ScoreCTText = data.Result?.FinalScoreText,
                ScorePBNote = string.Empty,
                ScorePBNumber = FormatScore(data.Result?.ScoreUvpb),
                ScorePBText = data.Result?.FinalScoreText,
                ScoreTKNote = string.Empty,
                ScoreTKNumber = FormatScore(data.Result?.ScoreUvtk),
                ScoreTKText = data.Result?.FinalScoreText,
                ReviewerLimitations = parsedMinute.ReviewerSections?.Limitations,
                ReviewerMethodologyReliability = parsedMinute.ReviewerSections?.MethodologyReliability,
                ReviewerNovelty = parsedMinute.ReviewerSections?.Novelty,
                ReviewerOverallConclusion = parsedMinute.ReviewerSections?.OverallConclusion,
                ReviewerResultsContent = parsedMinute.ReviewerSections?.ResultsContent,
                ReviewerWorkplace = FirstNonEmpty(reviewer?.Organization, ResolveDepartmentName(reviewer, data.TopicDepartment, data.StudentDepartment)),
                SecretarySignature = ResolveSecretaryDisplay(data.Members, data.MemberProfiles),
                StudentCode = data.Student?.StudentCode,
                StudentFullName = data.Student?.FullName,
                ClassName = FirstNonEmpty(data.StudentClass?.ClassName, data.StudentClass?.ClassCode),
                CourseName = FirstNonEmpty(data.StudentCohort?.CohortName, data.StudentCohort?.CohortCode, data.StudentClass?.CohortCode),
                ChairMemberDisplay = chair?.GetDisplayName(),
                ReviewerMemberDisplay = reviewerMember?.GetDisplayName(),
                SecretaryMemberDisplay = secretary?.GetDisplayName(),
                SupervisorDisplay = BuildLecturerDisplayName(data.SupervisorProfile, data.Topic?.SupervisorLecturerCode, data.Topic?.SupervisorUserCode),
                ReviewerDisplay = reviewerMember?.GetDisplayName(),
                Chapter1Content = parsedMinute.ChapterContents.ElementAtOrDefault(0)?.Content,
                Chapter2Content = parsedMinute.ChapterContents.ElementAtOrDefault(1)?.Content,
                Chapter3Content = parsedMinute.ChapterContents.ElementAtOrDefault(2)?.Content,
                ChapterNContent = parsedMinute.ChapterContents.Count > 3
                    ? string.Join(Environment.NewLine, parsedMinute.ChapterContents.Skip(3).Select(x => x.Content))
                    : null
            };

            reportData.Student = new ExportStudent
            {
                StudentCode = data.Student?.StudentCode,
                FullName = data.Student?.FullName,
                ClassName = FirstNonEmpty(data.StudentClass?.ClassName, data.StudentClass?.ClassCode),
                CourseName = FirstNonEmpty(data.StudentCohort?.CohortName, data.StudentCohort?.CohortCode, data.StudentClass?.CohortCode),
                TopicTitle = data.Topic?.Title,
                MajorName = reportData.MajorName
            };

            reportData.ChairMember = chair;
            reportData.ReviewerMember = reviewerMember;
            reportData.SecretaryMember = secretary;
            reportData.Supervisor = ResolveSupervisorMember(data.SupervisorProfile, data.Topic?.SupervisorLecturerCode, data.Topic?.SupervisorUserCode);

            foreach (var chapter in parsedMinute.ChapterContents)
            {
                if (!string.IsNullOrWhiteSpace(chapter.Content))
                {
                    reportData.ChapterContents.Add(chapter.Content.Trim());
                }
            }

            return reportData;
        }

        private static ExportCommitteeMember? ResolveMemberByRole(
            List<ThesisManagement.Api.Models.CommitteeMember> members,
            IReadOnlyDictionary<string, LecturerProfile> memberProfiles,
            string normalizedRole)
        {
            var member = members.FirstOrDefault(x => NormalizeCommitteeRole(x.Role) == normalizedRole);
            var profile = member == null ? null : TryGetMemberProfile(member, memberProfiles);
            if (profile == null)
            {
                return null;
            }

            return new ExportCommitteeMember
            {
                FullName = profile.FullName,
                Degree = profile.Degree,
                Workplace = profile.Organization,
                Role = normalizedRole
            };
        }

        private async Task<byte[]> BuildDocumentFromTemplateAsync(
            string templateFileName,
            IReadOnlyDictionary<string, string?> replacements,
            CancellationToken cancellationToken)
        {
            var templatePath = Path.Combine(_environment.ContentRootPath, "Templates", templateFileName);
            if (!File.Exists(templatePath))
            {
                throw new FileNotFoundException($"Template file not found: {templatePath}", templatePath);
            }

            var templateBytes = await File.ReadAllBytesAsync(templatePath, cancellationToken);
            using var memory = new MemoryStream(templateBytes);

            using (var document = WordprocessingDocument.Open(memory, true))
            {
                var mainDocumentPart = document.MainDocumentPart
                    ?? throw new InvalidOperationException("Template document is missing a main document part.");
                var mainDocument = mainDocumentPart.Document
                    ?? throw new InvalidOperationException("Template document is missing the document body.");

                ReplaceText(mainDocument, replacements);

                foreach (var headerPart in mainDocumentPart.HeaderParts)
                {
                    ReplaceText(headerPart.Header, replacements);
                }

                foreach (var footerPart in mainDocumentPart.FooterParts)
                {
                    ReplaceText(footerPart.Footer, replacements);
                }

                mainDocument.Save();
            }

            return memory.ToArray();
        }

        private static void ReplaceText(OpenXmlPartRootElement? root, IReadOnlyDictionary<string, string?> replacements)
        {
            if (root == null)
            {
                return;
            }

            foreach (var paragraph in root.Descendants<Paragraph>())
            {
                var texts = paragraph.Descendants<Text>().ToList();
                if (texts.Count == 0)
                {
                    continue;
                }

                var value = string.Concat(texts.Select(x => x.Text));
                var replaced = value;

                foreach (var replacement in replacements)
                {
                    if (!replaced.Contains(replacement.Key, StringComparison.Ordinal))
                    {
                        continue;
                    }

                    replaced = replaced.Replace(replacement.Key, replacement.Value ?? string.Empty, StringComparison.Ordinal);
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

        private static string BuildMeetingContent(ExportContextData data, ParsedMinutePayload parsedMinute)
        {
            var sb = new StringBuilder();

            sb.AppendLine("I. Tóm tắt nội dung đồ án");
            sb.AppendLine($"Hội đồng đã nghe tác giả trình bày tóm tắt nội dung đồ án bao gồm: {parsedMinute.ChapterContents.Count} chương. Cụ thể:");
            if (parsedMinute.ChapterContents.Count > 0)
            {
                var chapterLetters = new[] { "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l" };
                for (int i = 0; i < parsedMinute.ChapterContents.Count; i++)
                {
                    var chapter = parsedMinute.ChapterContents[i];
                    var letter = i < chapterLetters.Length ? chapterLetters[i] : "?";
                    sb.AppendLine($"{letter}) {chapter.ChapterTitle}: {chapter.Content}".Trim());
                }
            }

            if (!string.IsNullOrWhiteSpace(data.Minute?.SummaryContent))
            {
                sb.AppendLine(data.Minute.SummaryContent);
            }

            sb.AppendLine();
            sb.AppendLine("II. Ý kiến của các thành viên Hội đồng đánh giá tốt nghiệp");
            sb.AppendLine($"1. Uỷ viên phản biện: Đọc nhận xét (có bản nhận xét kèm theo) và đặt câu hỏi:\n{FirstNonEmpty(parsedMinute.PlainReviewerComments, string.Empty)}");
            sb.AppendLine($"2. Các thành viên Hội đồng nhận xét và đặt câu hỏi:\n{FirstNonEmpty(parsedMinute.CommitteeMemberComments, string.Empty)}");

            var reviewerQuestions = parsedMinute.QuestionAnswers
                .Where(x => GetQuestionSource(x.Question) == "II.1")
                .Select((x, idx) => $"- Câu {idx + 1}: {StripQuestionSource(x.Question)}")
                .ToList();
            var councilQuestions = parsedMinute.QuestionAnswers
                .Where(x => GetQuestionSource(x.Question) == "II.2")
                .Select((x, idx) => $"- Câu {idx + 1}: {StripQuestionSource(x.Question)}")
                .ToList();

            if (reviewerQuestions.Count > 0)
            {
                sb.AppendLine("   Câu hỏi từ phản biện:");
                foreach (var line in reviewerQuestions)
                {
                    sb.AppendLine(line);
                }
            }

            if (councilQuestions.Count > 0)
            {
                sb.AppendLine("   Câu hỏi từ các thành viên Hội đồng:");
                foreach (var line in councilQuestions)
                {
                    sb.AppendLine(line);
                }
            }

            sb.AppendLine();
            sb.AppendLine("III. Tác giả trả lời các câu hỏi đặt ra của Hội đồng");
            if (parsedMinute.QuestionAnswers.Count == 0)
            {
                sb.AppendLine(FirstNonEmpty(data.Minute?.QnaDetails, string.Empty));
            }
            else
            {
                foreach (var item in parsedMinute.QuestionAnswers)
                {
                    var question = StripQuestionSource(item.Question);
                    var answer = item.Answer ?? string.Empty;
                    sb.AppendLine($"- {question}: {answer}".Trim());
                }
            }

            sb.AppendLine();
            sb.AppendLine("IV. Đánh giá của Hội đồng (do Chủ tịch Hội đồng tổng hợp nhận xét)");
            sb.AppendLine($"a. Ưu điểm của đồ án\n{FirstNonEmpty(data.Minute?.Strengths, string.Empty)}");
            sb.AppendLine($"b. Thiếu sót, tồn tại\n{FirstNonEmpty(data.Minute?.Weaknesses, string.Empty)}");
            sb.AppendLine($"c. Các kiến nghị của Hội đồng\n{FirstNonEmpty(data.Minute?.Recommendations, string.Empty)}");

            sb.AppendLine();
            sb.AppendLine("V. Kết quả đánh giá");
            sb.AppendLine($"- Điểm GVHD: {FormatScore(data.Result?.ScoreGvhd)}");
            sb.AppendLine($"- Điểm Chủ tịch: {FormatScore(data.Result?.ScoreCt)}");
            sb.AppendLine($"- Điểm UV phản biện: {FormatScore(data.Result?.ScoreUvpb)}");
            sb.AppendLine($"- Điểm UV thư ký: {FormatScore(data.Result?.ScoreUvtk)}");
            sb.AppendLine($"- Điểm trung bình: {FormatScore(data.Result?.FinalScoreNumeric)} ({FirstNonEmpty(data.Result?.FinalScoreText, string.Empty)})");

            sb.AppendLine();
            sb.AppendLine("VI. Kết luận của Chủ tịch Hội đồng đánh giá tốt nghiệp");
            sb.AppendLine("- Hội đồng thống nhất đánh giá đồ án với kết quả:");
            sb.AppendLine($"+ Bằng số: {FormatScore(data.Result?.FinalScoreNumeric)} (điểm)");
            sb.AppendLine($"+ Bằng chữ: {FirstNonEmpty(data.Result?.FinalScoreText, string.Empty)} (điểm)");
            sb.AppendLine("Hội đồng đánh giá tốt nghiệp kết thúc vào hồi ........phút.........cùng ngày./.");
            sb.AppendLine(FirstNonEmpty(parsedMinute.ChairConclusion, string.Empty));

            return sb.ToString().Trim();
        }

        private static string FormatScore(decimal? score)
        {
            return score.HasValue ? score.Value.ToString("0.##") : string.Empty;
        }

        private static string FormatDate(DateTime? value)
        {
            return value.HasValue ? value.Value.ToString("dd/MM/yyyy") : string.Empty;
        }

        private static string FormatTime(TimeSpan? start, TimeSpan? end, DateTime? scheduledAt)
        {
            if (start.HasValue && end.HasValue)
            {
                return $"{start.Value:hh\\:mm} - {end.Value:hh\\:mm}";
            }

            if (start.HasValue)
            {
                return start.Value.ToString("hh\\:mm");
            }

            if (scheduledAt.HasValue)
            {
                return scheduledAt.Value.ToString("HH:mm");
            }

            return string.Empty;
        }

        private static string FirstNonEmpty(params string?[] values)
        {
            foreach (var value in values)
            {
                if (!string.IsNullOrWhiteSpace(value))
                {
                    return value.Trim();
                }
            }

            return string.Empty;
        }

        private static string SanitizeFileToken(string value)
        {
            var invalidChars = Path.GetInvalidFileNameChars();
            var chars = value.Select(ch => invalidChars.Contains(ch) ? '-' : ch).ToArray();
            return new string(chars).Trim();
        }

        private static string GetQuestionSource(string? question)
        {
            var normalized = (question ?? string.Empty).Trim();
            if (normalized.StartsWith("[II.1]", StringComparison.OrdinalIgnoreCase))
            {
                return "II.1";
            }

            if (normalized.StartsWith("[II.2]", StringComparison.OrdinalIgnoreCase))
            {
                return "II.2";
            }

            return string.Empty;
        }

        private static string StripQuestionSource(string? question)
        {
            var normalized = (question ?? string.Empty).Trim();
            if (normalized.StartsWith("[II.1]", StringComparison.OrdinalIgnoreCase) ||
                normalized.StartsWith("[II.2]", StringComparison.OrdinalIgnoreCase))
            {
                var end = normalized.IndexOf(']');
                if (end >= 0 && end + 1 < normalized.Length)
                {
                    return normalized[(end + 1)..].Trim();
                }
            }

            return normalized;
        }

        private async Task<ContextBuildResult> BuildContextAsync(
            int periodId,
            int committeeId,
            int assignmentId,
            CancellationToken cancellationToken)
        {
            if (periodId <= 0 || committeeId <= 0 || assignmentId <= 0)
            {
                return ContextBuildResult.Fail("Thiếu periodId/committeeId/assignmentId hợp lệ.", 400);
            }

            var assignment = await _uow.DefenseAssignments.Query().AsNoTracking()
                .FirstOrDefaultAsync(
                    x => x.AssignmentID == assignmentId && x.CommitteeID == committeeId && x.DefenseTermId == periodId,
                    cancellationToken);
            if (assignment == null)
            {
                return ContextBuildResult.Fail("Không tìm thấy assignment thuộc hội đồng/đợt đồ án tốt nghiệp đã chọn.", 404);
            }

            var committee = await _uow.Committees.Query().AsNoTracking()
                .FirstOrDefaultAsync(x => x.CommitteeID == committeeId, cancellationToken);

            var topic = await ResolveTopicAsync(assignment, cancellationToken);
            var student = topic != null ? await ResolveStudentProfileAsync(topic, cancellationToken) : null;
            var studentClass = await ResolveStudentClassAsync(student, cancellationToken);
            var studentCohort = await ResolveStudentCohortAsync(studentClass, cancellationToken);
            var studentDepartment = await ResolveStudentDepartmentAsync(student, cancellationToken);
            var topicDepartment = await ResolveTopicDepartmentAsync(topic, cancellationToken);
            var supervisorProfile = await ResolveSupervisorProfileAsync(topic, cancellationToken);

            var minute = await _uow.DefenseMinutes.Query().AsNoTracking()
                .FirstOrDefaultAsync(x => x.AssignmentId == assignmentId, cancellationToken);

            var result = await _uow.DefenseResults.Query().AsNoTracking()
                .FirstOrDefaultAsync(x => x.AssignmentId == assignmentId, cancellationToken);

            var members = await _uow.CommitteeMembers.Query().AsNoTracking()
                .Where(x => x.CommitteeID == committeeId)
                .OrderBy(x => x.CommitteeMemberID)
                .ToListAsync(cancellationToken);

            var memberCodes = members
                .Select(x => x.MemberLecturerCode)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x!.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var memberProfiles = memberCodes.Count == 0
                ? new Dictionary<string, LecturerProfile>(StringComparer.OrdinalIgnoreCase)
                : await _uow.LecturerProfiles.Query().AsNoTracking()
                    .Include(x => x.Department)
                    .Where(x => x.LecturerCode != null && memberCodes.Contains(x.LecturerCode))
                    .ToDictionaryAsync(x => x.LecturerCode, x => x, StringComparer.OrdinalIgnoreCase, cancellationToken);

            return ContextBuildResult.Ok(new ExportContextData
            {
                Assignment = assignment,
                Committee = committee,
                Topic = topic,
                Student = student,
                StudentClass = studentClass,
                StudentCohort = studentCohort,
                StudentDepartment = studentDepartment,
                TopicDepartment = topicDepartment,
                SupervisorProfile = supervisorProfile,
                Minute = minute,
                Result = result,
                Members = members,
                MemberProfiles = memberProfiles
            });
        }

        private async Task<Topic?> ResolveTopicAsync(DefenseAssignment assignment, CancellationToken cancellationToken)
        {
            if (assignment.TopicID.HasValue)
            {
                var byId = await _uow.Topics.Query().AsNoTracking()
                    .FirstOrDefaultAsync(x => x.TopicID == assignment.TopicID.Value, cancellationToken);
                if (byId != null)
                {
                    return byId;
                }
            }

            if (!string.IsNullOrWhiteSpace(assignment.TopicCode))
            {
                return await _uow.Topics.Query().AsNoTracking()
                    .FirstOrDefaultAsync(x => x.TopicCode == assignment.TopicCode, cancellationToken);
            }

            return null;
        }

        private async Task<StudentProfile?> ResolveStudentProfileAsync(Topic topic, CancellationToken cancellationToken)
        {
            if (topic.ProposerStudentProfileID.HasValue)
            {
                var byId = await _uow.StudentProfiles.Query().AsNoTracking()
                    .FirstOrDefaultAsync(x => x.StudentProfileID == topic.ProposerStudentProfileID.Value, cancellationToken);
                if (byId != null)
                {
                    return byId;
                }
            }

            if (!string.IsNullOrWhiteSpace(topic.ProposerStudentCode))
            {
                var studentCode = topic.ProposerStudentCode.Trim();
                return await _uow.StudentProfiles.Query().AsNoTracking()
                    .FirstOrDefaultAsync(x => x.StudentCode == studentCode, cancellationToken);
            }

            return null;
        }

        private async Task<Class?> ResolveStudentClassAsync(StudentProfile? student, CancellationToken cancellationToken)
        {
            if (student == null)
            {
                return null;
            }

            if (student.ClassID.HasValue)
            {
                var byId = await _uow.Classes.Query().AsNoTracking()
                    .FirstOrDefaultAsync(x => x.ClassID == student.ClassID.Value, cancellationToken);
                if (byId != null)
                {
                    return byId;
                }
            }

            if (!string.IsNullOrWhiteSpace(student.ClassCode))
            {
                var classCode = student.ClassCode.Trim();
                return await _uow.Classes.Query().AsNoTracking()
                    .FirstOrDefaultAsync(x => x.ClassCode == classCode, cancellationToken);
            }

            return null;
        }

        private async Task<Cohort?> ResolveStudentCohortAsync(Class? studentClass, CancellationToken cancellationToken)
        {
            if (studentClass == null || string.IsNullOrWhiteSpace(studentClass.CohortCode))
            {
                return null;
            }

            var cohortCode = studentClass.CohortCode.Trim();
            return await _uow.Cohorts.Query().AsNoTracking()
                .FirstOrDefaultAsync(x => x.CohortCode == cohortCode, cancellationToken);
        }

        private async Task<Department?> ResolveStudentDepartmentAsync(StudentProfile? student, CancellationToken cancellationToken)
        {
            if (student == null)
            {
                return null;
            }

            if (student.DepartmentID.HasValue)
            {
                var byId = await _uow.Departments.Query().AsNoTracking()
                    .FirstOrDefaultAsync(x => x.DepartmentID == student.DepartmentID.Value, cancellationToken);
                if (byId != null)
                {
                    return byId;
                }
            }

            if (!string.IsNullOrWhiteSpace(student.DepartmentCode))
            {
                var departmentCode = student.DepartmentCode.Trim();
                return await _uow.Departments.Query().AsNoTracking()
                    .FirstOrDefaultAsync(x => x.DepartmentCode == departmentCode, cancellationToken);
            }

            return null;
        }

        private async Task<Department?> ResolveTopicDepartmentAsync(Topic? topic, CancellationToken cancellationToken)
        {
            if (topic == null)
            {
                return null;
            }

            if (topic.DepartmentID.HasValue)
            {
                var byId = await _uow.Departments.Query().AsNoTracking()
                    .FirstOrDefaultAsync(x => x.DepartmentID == topic.DepartmentID.Value, cancellationToken);
                if (byId != null)
                {
                    return byId;
                }
            }

            if (!string.IsNullOrWhiteSpace(topic.DepartmentCode))
            {
                var departmentCode = topic.DepartmentCode.Trim();
                return await _uow.Departments.Query().AsNoTracking()
                    .FirstOrDefaultAsync(x => x.DepartmentCode == departmentCode, cancellationToken);
            }

            return null;
        }

        private async Task<LecturerProfile?> ResolveSupervisorProfileAsync(Topic? topic, CancellationToken cancellationToken)
        {
            if (topic == null || string.IsNullOrWhiteSpace(topic.SupervisorLecturerCode))
            {
                return null;
            }

            var supervisorCode = topic.SupervisorLecturerCode.Trim();
            return await _uow.LecturerProfiles.Query().AsNoTracking()
                .Include(x => x.Department)
                .FirstOrDefaultAsync(x => x.LecturerCode == supervisorCode, cancellationToken);
        }

        private static List<string> BuildMemberRows(
            List<CommitteeMember> members,
            IReadOnlyDictionary<string, LecturerProfile> memberProfiles)
        {
            var rows = new List<string>();
            var index = 1;

            foreach (var member in members)
            {
                var lecturer = TryGetMemberProfile(member, memberProfiles);
                var fullName = FirstNonEmpty(lecturer?.FullName, member.MemberLecturerCode, member.MemberUserCode);
                var degree = FirstNonEmpty(lecturer?.Degree);
                var displayName = string.IsNullOrWhiteSpace(degree) ? fullName : $"{degree} {fullName}".Trim();
                var roleLabel = ResolveRoleDisplay(member);
                rows.Add($"{index}. {displayName} - {roleLabel}".Trim());
                index++;
            }

            return rows;
        }

        private static string ResolveSecretaryDisplay(
            List<CommitteeMember> members,
            IReadOnlyDictionary<string, LecturerProfile> memberProfiles)
        {
            var secretary = members.FirstOrDefault(x => NormalizeCommitteeRole(x.Role) == "UVTK");
            if (secretary == null)
            {
                return string.Empty;
            }

            var lecturer = TryGetMemberProfile(secretary, memberProfiles);
            return BuildLecturerDisplayName(lecturer, secretary.MemberLecturerCode, secretary.MemberUserCode);
        }

        private static ExportCommitteeMember? ResolveSupervisorMember(
            LecturerProfile? supervisorProfile,
            string? supervisorLecturerCode,
            string? supervisorUserCode)
        {
            if (supervisorProfile == null && string.IsNullOrWhiteSpace(supervisorLecturerCode) && string.IsNullOrWhiteSpace(supervisorUserCode))
            {
                return null;
            }

            return new ExportCommitteeMember
            {
                FullName = supervisorProfile?.FullName ?? FirstNonEmpty(supervisorLecturerCode, supervisorUserCode),
                Degree = supervisorProfile?.Degree,
                Workplace = supervisorProfile?.Organization
            };
        }

        private static string BuildLecturerDisplayName(LecturerProfile? lecturer, params string?[] fallbacks)
        {
            var parts = new List<string>();

            if (!string.IsNullOrWhiteSpace(lecturer?.Degree))
            {
                parts.Add(lecturer!.Degree!.Trim());
            }

            if (!string.IsNullOrWhiteSpace(lecturer?.FullName))
            {
                parts.Add(lecturer!.FullName!.Trim());
            }

            var displayName = string.Join(' ', parts);
            if (!string.IsNullOrWhiteSpace(displayName))
            {
                return displayName;
            }

            return FirstNonEmpty(fallbacks);
        }

        private static LecturerProfile? ResolveReviewer(
            List<CommitteeMember> members,
            IReadOnlyDictionary<string, LecturerProfile> memberProfiles)
        {
            var reviewer = members.FirstOrDefault(x => NormalizeCommitteeRole(x.Role) == "UVPB");
            return reviewer == null ? null : TryGetMemberProfile(reviewer, memberProfiles);
        }

        private static LecturerProfile? TryGetMemberProfile(
            CommitteeMember member,
            IReadOnlyDictionary<string, LecturerProfile> memberProfiles)
        {
            if (!string.IsNullOrWhiteSpace(member.MemberLecturerCode) &&
                memberProfiles.TryGetValue(member.MemberLecturerCode.Trim(), out var profile))
            {
                return profile;
            }

            return null;
        }

        private static LecturerProfile? TryGetMemberProfile(
            string? lecturerCode,
            IReadOnlyDictionary<string, LecturerProfile> memberProfiles)
        {
            if (!string.IsNullOrWhiteSpace(lecturerCode) &&
                memberProfiles.TryGetValue(lecturerCode.Trim(), out var profile))
            {
                return profile;
            }

            return null;
        }

        private static string ResolveRoleDisplay(CommitteeMember member)
        {
            var normalized = NormalizeCommitteeRole(member.Role);
            return normalized switch
            {
                "CT" => "Chủ tịch",
                "UVPB" => "UV Phản biện",
                "UVTK" => "UV Thư ký",
                _ => FirstNonEmpty(member.Role, "Thành viên")
            };
        }

        private static string NormalizeCommitteeRole(string? role)
        {
            if (string.IsNullOrWhiteSpace(role))
            {
                return "UNKNOWN";
            }

            var upper = role.Trim().ToUpperInvariant();
            if (upper.Contains("CHU") || upper.Contains("CT") || upper.Contains("CHAIR"))
            {
                return "CT";
            }

            if (upper.Contains("UVTK") || upper.Contains("THU") || upper == "TK" || upper.Contains("SECRETARY"))
            {
                return "UVTK";
            }

            if (upper.Contains("UVPB") || upper.Contains("PHAN") || upper == "PB" || upper.Contains("REVIEWER"))
            {
                return "UVPB";
            }

            return "OTHER";
        }

        private static string ResolveDepartmentName(
            LecturerProfile? reviewer,
            Department? topicDepartment,
            Department? studentDepartment)
        {
            if (reviewer != null)
            {
                return FirstNonEmpty(reviewer.Department?.Name, reviewer.DepartmentCode, topicDepartment?.Name, studentDepartment?.Name);
            }

            return FirstNonEmpty(topicDepartment?.Name, studentDepartment?.Name);
        }

        private static ParsedMinutePayload ParseMinutePayload(string? rawReviewerComments)
        {
            var payload = new ParsedMinutePayload();
            if (string.IsNullOrWhiteSpace(rawReviewerComments))
            {
                return payload;
            }

            var text = rawReviewerComments.Trim();
            var markerIndex = text.IndexOf(ExtendedMarker, StringComparison.Ordinal);
            if (markerIndex < 0)
            {
                payload.PlainReviewerComments = text;
                return payload;
            }

            var plain = text[..markerIndex].TrimEnd();
            payload.PlainReviewerComments = string.IsNullOrWhiteSpace(plain) ? null : plain;

            var json = text[(markerIndex + ExtendedMarker.Length)..].Trim();
            if (string.IsNullOrWhiteSpace(json))
            {
                return payload;
            }

            try
            {
                var extended = JsonSerializer.Deserialize<MinuteExtendedPayload>(json);
                if (extended == null)
                {
                    return payload;
                }

                payload.ChapterContents = (extended.ChapterContents ?? new List<MinuteChapterInputDto>())
                    .Where(x => !string.IsNullOrWhiteSpace(x.ChapterTitle) || !string.IsNullOrWhiteSpace(x.Content))
                    .Select(x => new MinuteChapterInputDto
                    {
                        ChapterTitle = (x.ChapterTitle ?? string.Empty).Trim(),
                        Content = (x.Content ?? string.Empty).Trim()
                    })
                    .ToList();
                payload.CouncilDiscussionConclusion = extended.CouncilDiscussionConclusion;
                payload.ChairConclusion = extended.ChairConclusion;
                payload.CommitteeMemberComments = extended.CommitteeMemberComments;
                payload.QuestionAnswers = (extended.QuestionAnswers ?? new List<MinuteQuestionAnswerDto>())
                    .Where(x => !string.IsNullOrWhiteSpace(x.Question) || !string.IsNullOrWhiteSpace(x.Answer))
                    .Select(x => new MinuteQuestionAnswerDto
                    {
                        Question = (x.Question ?? string.Empty).Trim(),
                        Answer = (x.Answer ?? string.Empty).Trim()
                    })
                    .ToList();
                payload.ReviewerSections = extended.ReviewerSections;
            }
            catch
            {
                // Keep backward compatibility when old payload is malformed.
            }

            return payload;
        }

        private sealed class ExportContextData
        {
            public DefenseAssignment? Assignment { get; set; }
            public Committee? Committee { get; set; }
            public Topic? Topic { get; set; }
            public LecturerProfile? SupervisorProfile { get; set; }
            public StudentProfile? Student { get; set; }
            public Class? StudentClass { get; set; }
            public Cohort? StudentCohort { get; set; }
            public Department? StudentDepartment { get; set; }
            public Department? TopicDepartment { get; set; }
            public DefenseMinute? Minute { get; set; }
            public DefenseResult? Result { get; set; }
            public List<CommitteeMember> Members { get; set; } = new();
            public IReadOnlyDictionary<string, LecturerProfile> MemberProfiles { get; set; } =
                new Dictionary<string, LecturerProfile>(StringComparer.OrdinalIgnoreCase);
        }

        private sealed class ContextBuildResult
        {
            public bool Success { get; private set; }
            public string Message { get; private set; } = string.Empty;
            public int StatusCode { get; private set; }
            public ExportContextData? Data { get; private set; }

            public static ContextBuildResult Ok(ExportContextData data)
                => new() { Success = true, StatusCode = 200, Data = data };

            public static ContextBuildResult Fail(string message, int statusCode)
                => new() { Success = false, Message = message, StatusCode = statusCode };
        }

        private sealed class ParsedMinutePayload
        {
            public string? PlainReviewerComments { get; set; }
            public List<MinuteChapterInputDto> ChapterContents { get; set; } = new();
            public string? CouncilDiscussionConclusion { get; set; }
            public string? ChairConclusion { get; set; }
            public string? CommitteeMemberComments { get; set; }
            public List<MinuteQuestionAnswerDto> QuestionAnswers { get; set; } = new();
            public ReviewerStructuredSectionsDto? ReviewerSections { get; set; }
        }

        private sealed class MinuteExtendedPayload
        {
            public List<MinuteChapterInputDto>? ChapterContents { get; set; }
            public string? CouncilDiscussionConclusion { get; set; }
            public string? ChairConclusion { get; set; }
            public string? CommitteeMemberComments { get; set; }
            public List<MinuteQuestionAnswerDto>? QuestionAnswers { get; set; }
            public ReviewerStructuredSectionsDto? ReviewerSections { get; set; }
        }
    }
}

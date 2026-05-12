using System.Text;
using System.Text.RegularExpressions;
using DocumentFormat.OpenXml.Packaging;
using UglyToad.PdfPig;

namespace ThesisManagement.Api.Services.Reports
{
    public class ReportContentExtractor : IReportContentExtractor
    {
        private readonly IHttpClientFactory _httpClientFactory;

        public ReportContentExtractor(IHttpClientFactory httpClientFactory)
        {
            _httpClientFactory = httpClientFactory;
        }

        public async Task<string> ExtractTextAsync(string fileUrl, string? studentDescription = null, int maxChars = 100000)
        {
            if (string.IsNullOrWhiteSpace(fileUrl)) return string.Empty;

            try
            {
                var client = _httpClientFactory.CreateClient();
                var response = await client.GetAsync(fileUrl);
                
                if (!response.IsSuccessStatusCode)
                    return string.Empty;

                using var stream = await response.Content.ReadAsStreamAsync();
                using var ms = new MemoryStream();
                await stream.CopyToAsync(ms);
                ms.Position = 0;

                string fullText = string.Empty;

                // Determine file type and extract
                if (fileUrl.Contains(".pdf", StringComparison.OrdinalIgnoreCase))
                {
                    fullText = ExtractTextFromPdf(ms);
                }
                else
                {
                    // Default to Docx
                    fullText = ExtractTextFromDocx(ms);
                }

                if (string.IsNullOrWhiteSpace(fullText)) return string.Empty;

                // Apply Smart Extraction
                return SmartTargetedExtraction(fullText, studentDescription, maxChars);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error extracting text: {ex.Message}");
                return string.Empty;
            }
        }

        private string ExtractTextFromDocx(MemoryStream ms)
        {
            try
            {
                using var wordDoc = WordprocessingDocument.Open(ms, false);
                var body = wordDoc.MainDocumentPart?.Document.Body;
                return body?.InnerText ?? string.Empty;
            }
            catch { return string.Empty; }
        }

        private string ExtractTextFromPdf(MemoryStream ms)
        {
            try
            {
                var sb = new StringBuilder();
                using var pdf = PdfDocument.Open(ms);
                foreach (var page in pdf.GetPages())
                {
                    sb.AppendLine(page.Text);
                }
                return sb.ToString();
            }
            catch { return string.Empty; }
        }

        private string SmartTargetedExtraction(string rawText, string? description, int maxChars)
        {
            // 1. Cleanup raw text
            var text = rawText.Replace("\r", "\n");
            while (text.Contains("\n\n\n")) text = text.Replace("\n\n\n", "\n\n");

            // 2. Identify Chapter Headers
            // Regex for "CHƯƠNG 1", "CHƯƠNG I", "Chương 1", "1. ", etc.
            var chapterRegex = new Regex(@"(?i)(CHƯƠNG|Chapter)\s+([0-9IVX]+)", RegexOptions.Multiline);
            var matches = chapterRegex.Matches(text);

            if (matches.Count == 0)
            {
                // Fallback: Just skip the very beginning (preamble) if we can find "MỤC LỤC" or "GIỚI THIỆU"
                int startIndex = 0;
                var startKeywords = new[] { "MỤC LỤC", "GIỚI THIỆU", "CHƯƠNG", "1. " };
                foreach (var kw in startKeywords)
                {
                    int idx = text.IndexOf(kw, StringComparison.OrdinalIgnoreCase);
                    if (idx > 0 && idx < 10000) // Only skip if found within first 10k chars
                    {
                        startIndex = idx;
                        break;
                    }
                }
                
                string resultText = text.Substring(startIndex);
                return resultText.Length > maxChars ? resultText.Substring(0, maxChars) : resultText;
            }

            // 3. Find target chapters based on student description
            var targetChapterNumbers = ExtractChapterNumbers(description);
            
            var sb = new StringBuilder();
            sb.AppendLine("--- TRÍCH XUẤT THÔNG MINH (BỎ QUA LỜI MỞ ĐẦU) ---");

            if (targetChapterNumbers.Count == 0)
            {
                // If no specific chapter mentioned, start from first chapter found
                int firstChapterIndex = matches[0].Index;
                string relevantText = text.Substring(firstChapterIndex);
                if (relevantText.Length > maxChars) relevantText = relevantText.Substring(0, maxChars);
                sb.AppendLine(relevantText);
            }
            else
            {
                // Extract specific chapters
                foreach (var targetNum in targetChapterNumbers)
                {
                    // Find the match that corresponds to this chapter number
                    for (int i = 0; i < matches.Count; i++)
                    {
                        var m = matches[i];
                        string numStr = m.Groups[2].Value;
                        if (IsMatch(numStr, targetNum))
                        {
                            int start = m.Index;
                            int end = (i + 1 < matches.Count) ? matches[i + 1].Index : text.Length;
                            int length = end - start;

                            sb.AppendLine($"\n[NỘI DUNG {m.Value.ToUpper()}]");
                            
                            // If chapter is too long, we take a dense sample (Start and End of chapter)
                            if (length > 15000)
                            {
                                sb.AppendLine(text.Substring(start, 7000));
                                sb.AppendLine("... [Nội dung giữa chương được lược bỏ để tiết kiệm bộ nhớ] ...");
                                sb.AppendLine(text.Substring(end - 3000, 3000));
                            }
                            else
                            {
                                sb.AppendLine(text.Substring(start, length));
                            }
                            break;
                        }
                    }
                }
            }

            string finalResult = sb.ToString();
            return finalResult.Length > maxChars ? finalResult.Substring(0, maxChars) : finalResult;
        }

        private List<int> ExtractChapterNumbers(string? description)
        {
            var result = new List<int>();
            if (string.IsNullOrEmpty(description)) return result;

            var matches = Regex.Matches(description, @"(?i)(chương|mục)\s+([0-9]+)");
            foreach (Match m in matches)
            {
                if (int.TryParse(m.Groups[2].Value, out int num))
                {
                    if (!result.Contains(num)) result.Add(num);
                }
            }
            return result;
        }

        private bool IsMatch(string foundNum, int targetNum)
        {
            if (int.TryParse(foundNum, out int foundInt)) return foundInt == targetNum;
            
            // Handle Roman numerals
            string roman = targetNum switch
            {
                1 => "I", 2 => "II", 3 => "III", 4 => "IV", 5 => "V",
                _ => targetNum.ToString()
            };
            return foundNum.Equals(roman, StringComparison.OrdinalIgnoreCase);
        }
    }
}

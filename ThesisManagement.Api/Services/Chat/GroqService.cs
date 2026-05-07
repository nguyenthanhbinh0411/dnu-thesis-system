using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ThesisManagement.Api.DTOs.Chatbot;
using ThesisManagement.Api.Models;
using ThesisManagement.Api.Services;

namespace ThesisManagement.Api.Services.Chat;

public class GroqService : IGroqService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly IUnitOfWork _uow;
    private readonly string _apiKey;
    private readonly string _model;

    public GroqService(HttpClient httpClient, IConfiguration configuration, IUnitOfWork uow)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _uow = uow;
        _apiKey = _configuration["Groq:ApiKey"] ?? throw new ArgumentNullException("Groq:ApiKey");
        _model = _configuration["Groq:Model"] ?? "llama-3.3-70b-versatile";
        
        var baseUrl = _configuration["Groq:BaseUrl"] ?? "https://api.groq.com/openai/v1/";
        _httpClient.BaseAddress = new Uri(baseUrl);
        _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
    }

    public async Task<ChatResponse> GetChatCompletionAsync(string userMessage, int userId, int? chatSessionId = null)
    {
        ChatSession? session;
        
        // 1. Handle Session
        if (chatSessionId.HasValue)
        {
            session = await _uow.ChatSessions.GetByIdAsync(chatSessionId.Value);
            if (session == null || session.UserID != userId)
                throw new Exception("Phiên hội thoại không tồn tại.");
        }
        else
        {
            // First message of the user will be the title
            session = new ChatSession
            {
                UserID = userId,
                Title = userMessage.Length > 50 ? userMessage.Substring(0, 47) + "..." : userMessage,
                ModelName = _model,
                CreatedAt = DateTime.Now,
                IsArchived = 0
            };
            await _uow.ChatSessions.AddAsync(session);
            await _uow.SaveChangesAsync();
        }

        // 2. Fetch context (Student & Lecturers)
        var studentProfile = await _uow.StudentProfiles.Query()
            .Include(s => s.Department)
            .FirstOrDefaultAsync(s => s.UserID == userId);

        string studentContext = studentProfile != null 
            ? $"- Sinh viên: {studentProfile.FullName}\n- Khoa: {studentProfile.Department?.Name}\n- Mã SV: {studentProfile.StudentCode}"
            : "Không rõ thông tin sinh viên.";

        var lecturers = await _uow.LecturerProfiles.Query()
            .Where(l => l.CurrentGuidingCount < l.GuideQuota)
            .OrderBy(l => Guid.NewGuid()) // Randomize for variety
            .Take(10).ToListAsync();

        var lecturerContext = string.Join("\n", lecturers.Select(l => 
            $"- GV {l.FullName} ({l.Degree}): Chuyên môn [{l.Specialties}]. Hướng dẫn: {l.CurrentGuidingCount}/{l.GuideQuota}"));

        var allTags = await _uow.Tags.Query().Take(20).ToListAsync();
        var catalogTopics = await _uow.CatalogTopics.Query().OrderByDescending(t => t.CreatedAt).Take(15).ToListAsync();

        var systemPrompt = $@"
BẠN LÀ: 'DNU Academic Assistant' - Trợ lý Học thuật thông minh của Đại học Đại Nam.
PHONG CÁCH: Chuyên nghiệp, tận tâm, học thuật nhưng gần gũi. Luôn sử dụng Markdown để trình bày câu trả lời một cách khoa học và dễ đọc.

NHIỆM VỤ CỦA BẠN:
1. Tư vấn đề tài tốt nghiệp phù hợp với định hướng và năng lực sinh viên.
2. Kết nối sinh viên với Giảng viên hướng dẫn (GVHD) còn chỉ tiêu và phù hợp chuyên môn.
3. Giải đáp các thắc mắc về quy trình thực hiện khóa luận/đồ án tại DNU.
4. Tránh các đề tài trùng lặp với thư viện đề tài đã có.

DỮ LIỆU NGỮ CẢNH HIỆN TẠI:
[THÔNG TIN SINH VIÊN]
{studentContext}

[DANH SÁCH GIẢNG VIÊN ĐANG TRỐNG CHỖ]
{lecturerContext}

[THƯ VIỆN ĐỀ TÀI THAM KHẢO]
{string.Join("\n", catalogTopics.Select(t => $"- {t.Title} ({t.CatalogTopicCode})"))}

[TỪ KHÓA CÔNG NGHỆ PHỔ BIẾN]
{string.Join(", ", allTags.Select(t => t.TagName))}

CHỈ THỊ VỀ VĂN PHONG & ĐỊNH DẠNG (BẮT BUỘC):
# VAI TRÒ: 
Bạn là DNU Academic Assistant - Trợ lý học thuật tối cao của Trường Đại học Đại Nam. Nhiệm vụ của bạn là dẫn dắt sinh viên hoàn thành khóa luận một cách xuất sắc nhất.

# PHONG CÁCH PHẢN HỒI (BẮT BUỘC):
1. LUÔN LUÔN xưng hô thân thiện: 'Chào bạn', 'DNU hỗ trợ bạn', 'DNU tin rằng...'.
2. LUÔN LUÔN sử dụng EMOJI (biểu tượng cảm xúc phù hợp như mũ tốt nghiệp, robot, sách, ngôi sao, thầy giáo) để câu trả lời sinh động, không khô khan.
3. ĐỊNH DẠNG MARKDOWN CỨNG NHẮC:
   - Tiêu đề mục dùng ###.
   - Các từ khóa quan trọng phải in đậm.
   - Xuống dòng thật sự (double newline) giữa các đoạn văn. KHÔNG được viết dính văn bản.
   - KHÔNG được in ra các ký tự kỹ thuật như '\n' hay '\r'. Hãy thực hiện việc xuống dòng bằng phím Enter.

# QUY TẮC NỘI DUNG NÂNG CAO:
- Tư vấn đề tài: Tự sáng tạo đề tài mới dựa trên [TỪ KHÓA CÔNG NGHỆ] nếu không được yêu cầu xem thư viện. Mỗi đề tài phải có: 1. Tên đề tài, 2. Tech Stack gợi ý, 3. Cơ hội nghề nghiệp thực tế.
- Tính tương tác: Nếu sinh viên chưa có ý tưởng, hãy yêu cầu họ chia sẻ sở thích trước khi đưa ra gợi ý.
- Lộ trình: Khi sinh viên đã chọn được đề tài, hãy chủ động vẽ ra lộ trình 8 tuần thực hiện.
- Thẩm định: Đánh giá độ khó (1-10) cho mọi đề tài mà sinh viên tự đưa ra.
- Giảng viên: Ưu tiên gợi ý giảng viên từ danh sách [GIẢNG VIÊN ĐANG TRỐNG CHỖ].
- Chặn nội dung: Từ chối lịch sự mọi câu hỏi không liên quan đến học thuật/DNU.

Chúc bạn hỗ trợ sinh viên DNU thật tốt!
";

        // 1. Fetch chat history (last 10 messages)
        var chatHistory = await _uow.ChatMessages.Query()
            .Where(m => m.ChatSessionID == session!.ChatSessionID)
            .OrderByDescending(m => m.CreatedAt)
            .Take(10)
            .ToListAsync();
        
        chatHistory.Reverse(); // Reverse in memory to maintain chronological order

        var messages = new List<object> { new { role = "system", content = systemPrompt } };
        foreach (var msg in chatHistory)
        {
            messages.Add(new { role = msg.Role.ToLower(), content = msg.Content });
        }
        messages.Add(new { role = "user", content = userMessage });

        // 4. Call Groq API
        string assistantMessage = "";
        int promptTokens = 0;
        int completionTokens = 0;

        try 
        {
            var serializerOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
            var requestBody = new { model = _model, messages = messages };
            var content = new StringContent(JsonSerializer.Serialize(requestBody, serializerOptions), Encoding.UTF8, "application/json");
            
            var response = await _httpClient.PostAsync("chat/completions", content);
            var responseString = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                throw new Exception($"Groq API Error ({response.StatusCode}): {responseString}");
            }

            using var doc = JsonDocument.Parse(responseString);
            var root = doc.RootElement;
            assistantMessage = root.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString() ?? "";
            
            var usage = root.GetProperty("usage");
            promptTokens = usage.GetProperty("prompt_tokens").GetInt32();
            completionTokens = usage.GetProperty("completion_tokens").GetInt32();
        }
        catch (Exception ex)
        {
            throw new Exception($"Lỗi khi gọi Groq API: {ex.Message}");
        }

        // 5. Save to DB
        var userMsgEntity = new ChatMessage
        {
            ChatSessionID = session!.ChatSessionID,
            Role = "user",
            Content = userMessage,
            CreatedAt = DateTime.Now
        };
        
        var assistantMsgEntity = new ChatMessage
        {
            ChatSessionID = session!.ChatSessionID,
            Role = "assistant",
            Content = assistantMessage,
            PromptTokens = promptTokens,
            CompletionTokens = completionTokens,
            CreatedAt = DateTime.Now
        };

        await _uow.ChatMessages.AddAsync(userMsgEntity);
        await _uow.ChatMessages.AddAsync(assistantMsgEntity);
        await _uow.SaveChangesAsync();

        return new ChatResponse
        {
            Message = assistantMessage,
            ChatSessionID = session!.ChatSessionID
        };
    }
}

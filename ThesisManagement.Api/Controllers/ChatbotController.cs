using Microsoft.AspNetCore.Mvc;
using ThesisManagement.Api.DTOs.Chatbot;
using ThesisManagement.Api.Services.Chat;
using ThesisManagement.Api.DTOs;
using ThesisManagement.Api.Services;
using AutoMapper;
using Microsoft.EntityFrameworkCore;

namespace ThesisManagement.Api.Controllers;

public class ChatbotController : BaseApiController
{
    private readonly IGroqService _groqService;

    public ChatbotController(
        IUnitOfWork uow, 
        ICodeGenerator codeGen, 
        IMapper mapper,
        IGroqService groqService) : base(uow, codeGen, mapper)
    {
        _groqService = groqService;
    }

    [HttpGet("sessions")]
    public async Task<ActionResult<ApiResponse<List<ChatSessionDto>>>> GetSessions()
    {
        var userId = CurrentUserId;
        var sessions = await _uow.ChatSessions.Query()
            .Where(s => s.UserID == userId)
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new ChatSessionDto
            {
                ChatSessionID = s.ChatSessionID,
                Title = s.Title ?? "Không có tiêu đề",
                CreatedAt = s.CreatedAt
            })
            .ToListAsync();

        return FromResult(new ApiResponse<List<ChatSessionDto>>
        {
            Success = true,
            Data = sessions,
            Message = "Lấy danh sách phiên hội thoại thành công"
        });
    }

    [HttpGet("session/{sessionId}/messages")]
    public async Task<ActionResult<ApiResponse<List<ChatHistoryMessageDto>>>> GetMessages(int sessionId)
    {
        var userId = CurrentUserId;
        var session = await _uow.ChatSessions.GetByIdAsync(sessionId);
        if (session == null || session.UserID != userId)
            return FromResult(new ApiResponse<List<ChatHistoryMessageDto>> { Success = false, Message = "Không tìm thấy phiên hội thoại" });

        var messages = await _uow.ChatMessages.Query()
            .Where(m => m.ChatSessionID == sessionId)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new ChatHistoryMessageDto
            {
                ChatMessageID = m.ChatMessageID,
                Role = m.Role,
                Content = m.Content,
                Feedback = m.Feedback,
                CreatedAt = m.CreatedAt
            })
            .ToListAsync();

        return FromResult(new ApiResponse<List<ChatHistoryMessageDto>>
        {
            Success = true,
            Data = messages,
            Message = "Lấy lịch sử tin nhắn thành công"
        });
    }

    [HttpPost("suggest-topics")]
    public async Task<ActionResult<ApiResponse<ChatResponse>>> SuggestTopics([FromBody] ChatRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Message))
            {
                return FromResult(new ApiResponse<ChatResponse>
                {
                    Success = false,
                    Message = "Vui lòng nhập thông tin để chatbot gợi ý."
                });
            }

            var result = await _groqService.GetChatCompletionAsync(request.Message, CurrentUserId, request.ChatSessionID);
            
            return FromResult(new ApiResponse<ChatResponse>
            {
                Success = true,
                Data = result,
                Message = "Gợi ý đề tài thành công"
            });
        }
        catch (Exception ex)
        {
            return FromResult(new ApiResponse<ChatResponse>
            {
                Success = false,
                Message = "Lỗi khi kết nối với AI: " + ex.Message
            });
        }
    }

    [HttpPost("message/{messageId}/feedback")]
    public async Task<ActionResult<ApiResponse<bool>>> SendFeedback(long messageId, [FromBody] int feedback)
    {
        var message = await _uow.ChatMessages.GetByIdAsync(messageId);
        if (message == null)
            return FromResult(new ApiResponse<bool> { Success = false, Message = "Không tìm thấy tin nhắn" });

        // Verify session ownership
        var session = await _uow.ChatSessions.GetByIdAsync(message.ChatSessionID);
        if (session == null || session.UserID != CurrentUserId)
            return FromResult(new ApiResponse<bool> { Success = false, Message = "Bạn không có quyền thực hiện hành động này" });

        message.Feedback = feedback; // 1: Like, -1: Dislike, 0: None
        _uow.ChatMessages.Update(message);
        await _uow.SaveChangesAsync();

        return FromResult(new ApiResponse<bool>
        {
            Success = true,
            Data = true,
            Message = "Cảm ơn bạn đã gửi phản hồi!"
        });
    }
}

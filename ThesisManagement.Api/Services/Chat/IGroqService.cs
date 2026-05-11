using ThesisManagement.Api.DTOs.Chatbot;

namespace ThesisManagement.Api.Services.Chat;

public interface IGroqService
{
    Task<ChatResponse> GetChatCompletionAsync(string userMessage, int userId, int? chatSessionId = null);
    Task<string> GetRawCompletionAsync(string systemPrompt, string userMessage, bool useJsonMode = false);
}

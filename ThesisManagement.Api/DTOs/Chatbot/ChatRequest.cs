namespace ThesisManagement.Api.DTOs.Chatbot;

public class ChatRequest
{
    public string Message { get; set; } = string.Empty;
    public int? ChatSessionID { get; set; }
}

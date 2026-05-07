using System;

namespace ThesisManagement.Api.DTOs.Chatbot;

public class ChatHistoryMessageDto
{
    public long ChatMessageID { get; set; }
    public string Role { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public int Feedback { get; set; }
    public DateTime CreatedAt { get; set; }
}

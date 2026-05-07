using System;

namespace ThesisManagement.Api.DTOs.Chatbot;

public class ChatSessionDto
{
    public int ChatSessionID { get; set; }
    public string Title { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

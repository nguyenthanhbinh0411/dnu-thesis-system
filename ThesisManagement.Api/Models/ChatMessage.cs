using System;

namespace ThesisManagement.Api.Models
{
    public class ChatMessage
    {
        public long ChatMessageID { get; set; }
        public int ChatSessionID { get; set; }
        public string Role { get; set; } = null!;
        public string Content { get; set; } = null!;
        public int Feedback { get; set; }
        public int PromptTokens { get; set; }
        public int CompletionTokens { get; set; }
        public DateTime CreatedAt { get; set; }

        // Navigation
        public ChatSession? Session { get; set; }
    }
}

using System;
using System.Collections.Generic;

namespace ThesisManagement.Api.Models
{
    public class ChatSession
    {
        public int ChatSessionID { get; set; }
        public int UserID { get; set; }
        public string? Title { get; set; }
        public string? ModelName { get; set; }
        public DateTime CreatedAt { get; set; }
        public int IsArchived { get; set; } // Oracle NUMBER(1)

        // Navigation
        public User? User { get; set; }
        public ICollection<ChatMessage> Messages { get; set; } = new List<ChatMessage>();
    }
}

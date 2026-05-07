export interface ChatSession {
  chatSessionID: number;
  title: string;
  createdAt: string;
}

export interface ChatMessage {
  chatMessageID: number;
  role: string; // "User" | "Assistant"
  content: string;
  feedback: number;
  createdAt: string;
}

export interface ChatResponse {
  message: string;
  chatSessionID: number;
}

export interface AIMessage {
  id?: number;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  feedback?: number;
}

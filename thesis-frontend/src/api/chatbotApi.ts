import { fetchData } from "./fetchData";
import type { ApiResponse } from "../types/api";
import type { 
  ChatSession, 
  ChatMessage, 
  ChatResponse 
} from "../types/chatbot";

export const getSessions = async () => {
  return fetchData<ApiResponse<ChatSession[]>>("/Chatbot/sessions");
};

export const getMessages = async (sessionId: number) => {
  return fetchData<ApiResponse<ChatMessage[]>>(`/Chatbot/session/${sessionId}/messages`);
};

export const suggestTopics = async (message: string, chatSessionID?: number | null) => {
  return fetchData<ApiResponse<ChatResponse>>("/Chatbot/suggest-topics", {
    method: "POST",
    body: { message, chatSessionID },
  });
};

export const sendFeedback = async (messageId: number, feedback: number) => {
  return fetchData<ApiResponse<boolean>>(`/Chatbot/message/${messageId}/feedback`, {
    method: "POST",
    body: feedback.toString(), // Send as string to satisfy BodyInitCompatible
  });
};

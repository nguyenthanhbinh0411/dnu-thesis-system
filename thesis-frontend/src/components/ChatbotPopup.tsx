import React, { useState, useRef, useEffect } from "react";
import { 
  Send, X, Bot, Loader2, Sparkles, 
  MessageSquare, Plus, ChevronLeft, 
  ChevronRight, History, Trash2, 
  LogOut, Settings, User as UserIcon,
  ThumbsUp, ThumbsDown
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { 
  ChatSession, 
  ChatMessage, 
  AIMessage 
} from "../types/chatbot";
import { 
  suggestTopics, 
  getSessions, 
  getMessages, 
  sendFeedback
} from "../api/chatbotApi";
import { useAuth } from "../hooks/useAuth";
import { fetchData } from "../api/fetchData";
import { getAvatarUrl } from "../api/fetchData";
import type { ApiResponse } from "../types/api";
import type { StudentProfile } from "../types/studentProfile";

const ChatbotPopup: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  
  const auth = useAuth();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      loadSessions();
      loadStudentProfile();
    }
  }, [isOpen]);

  const loadStudentProfile = async () => {
    if (!auth.user?.userCode || studentProfile) return;
    try {
      const response = await fetchData<ApiResponse<StudentProfile[]>>(
        `/StudentProfiles/get-list?UserCode=${auth.user.userCode}`
      );
      if (response.success && response.data && response.data.length > 0) {
        setStudentProfile(response.data[0]);
      }
    } catch (err) {
      console.error("Failed to load student profile", err);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const loadSessions = async () => {
    try {
      const response = await getSessions();
      if (response.success && response.data) {
        setSessions(response.data);
      }
    } catch (err) {
      console.error("Failed to load chat sessions", err);
    }
  };

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setMessages([{
      role: "assistant",
      content: "Chào bạn! Tôi là trợ lý AI của DNU. Tôi có thể giúp gì cho đề tài tốt nghiệp của bạn?",
      timestamp: new Date()
    }]);
  };

  const selectSession = async (sessionId: number) => {
    if (currentSessionId === sessionId) return;
    
    setCurrentSessionId(sessionId);
    setIsLoading(true);
    try {
      const response = await getMessages(sessionId);
      if (response.success && response.data) {
        setMessages(response.data.map(m => ({
          id: m.chatMessageID,
          role: m.role.toLowerCase() as "user" | "assistant",
          content: m.content,
          feedback: m.feedback,
          timestamp: new Date(m.createdAt)
        })));
      }
    } catch (err) {
      console.error("Failed to load messages", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedback = async (messageId: number, feedbackValue: number) => {
    try {
      const response = await sendFeedback(messageId, feedbackValue);
      if (response.success) {
        setMessages(prev => prev.map(m => 
          m.id === messageId ? { ...m, feedback: feedbackValue } : m
        ));
      }
    } catch (err) {
      console.error("Failed to send feedback", err);
    }
  };

  const handleSend = async () => {
    if (!message.trim() || isLoading) return;

    const userMessage = message.trim();
    setMessage("");
    
    const newMessages: AIMessage[] = [
      ...messages,
      { role: "user", content: userMessage, timestamp: new Date() },
    ];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await suggestTopics(userMessage, currentSessionId);
      if (response.success && response.data) {
        const chatData = response.data;
        const isNewSession = !currentSessionId;
        
        if (isNewSession) {
          setCurrentSessionId(chatData.chatSessionID);
          // Wait 1 second for the DB to stabilize/persist before reloading history
          setTimeout(async () => {
            await loadSessions();
          }, 1000);
        }

        setMessages(prev => [
          ...prev,
          {
            role: "assistant",
            content: chatData.message,
            timestamp: new Date(),
          },
        ]);
      } else {
        throw new Error(response.message || "Failed to get response");
      }
    } catch (error) {
      console.error("Chatbot error:", error);
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: "Xin lỗi, đã có lỗi xảy ra khi kết nối với AI. Vui lòng thử lại sau.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] font-sans">
      {/* Floating Action Button */}
      {!isOpen && (
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg text-white"
        >
          <Bot size={28} />
        </motion.button>
      )}

      {/* ChatGPT-style Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="absolute bottom-0 right-0 w-[85vw] max-w-[1100px] h-[85vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex overflow-hidden"
          >
            {/* Sidebar (Chat History) */}
            <motion.div 
              animate={{ width: isSidebarOpen ? 280 : 0 }}
              className="bg-[#202123] text-white flex flex-col h-full overflow-hidden transition-all duration-300 border-r border-white/10"
            >
              <div className="p-4">
                <button 
                  onClick={handleNewChat}
                  className="w-full flex items-center gap-3 px-3 py-3 border border-white/20 rounded-lg hover:bg-white/5 transition-colors text-sm font-medium"
                >
                  <Plus size={16} />
                  Cuộc trò chuyện mới
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-2">
                <div className="text-[10px] font-bold text-gray-500 uppercase px-3 mt-4 mb-2 tracking-widest">Lịch sử hội thoại</div>
                {sessions.map((s) => (
                  <button
                    key={s.chatSessionID}
                    onClick={() => selectSession(s.chatSessionID)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-left transition-colors truncate group ${
                      currentSessionId === s.chatSessionID ? "bg-[#343541]" : "hover:bg-[#2A2B32]"
                    }`}
                  >
                    <MessageSquare size={16} className={`shrink-0 ${currentSessionId === s.chatSessionID ? "text-primary" : "text-gray-400"}`} />
                    <span className="truncate flex-1">{s.title}</span>
                  </button>
                ))}
              </div>

              <div className="p-4 border-t border-white/10 space-y-1">
                 <button className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/5 transition-colors text-sm text-gray-300">
                   <UserIcon size={16} />
                   Hồ sơ cá nhân
                 </button>
                 <button className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/5 transition-colors text-sm text-gray-300">
                   <Settings size={16} />
                   Cài đặt
                 </button>
              </div>
            </motion.div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col relative bg-[#343541]">
              {/* Header */}
              <div className="h-14 border-b border-white/10 flex items-center justify-between px-4 text-white bg-[#343541]/80 backdrop-blur-md z-10">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    title={isSidebarOpen ? "Đóng sidebar" : "Mở sidebar"}
                  >
                    <ChevronLeft className={`transition-transform duration-300 ${!isSidebarOpen ? "rotate-180" : ""}`} size={20} />
                  </button>
                  <div className="flex items-center gap-2 ml-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="font-semibold text-xs tracking-tight uppercase">DNU AI Assistant</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto custom-scrollbar scroll-smooth">
                {messages.length === 0 && !isLoading ? (
                   <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 text-center animate-fade-in">
                      <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-6 border border-white/10">
                        <Bot size={40} className="text-primary opacity-60" />
                      </div>
                      <h3 className="text-2xl font-black text-white mb-3">Tôi có thể giúp gì cho bạn?</h3>
                      <p className="max-w-sm text-sm text-gray-500 leading-relaxed">
                        Hỏi tôi về các xu hướng công nghệ, gợi ý đề tài tốt nghiệp hoặc tìm kiếm giảng viên hướng dẫn phù hợp.
                      </p>
                      <div className="grid grid-cols-2 gap-3 mt-10 w-full max-w-md">
                         {["Gợi ý đề tài AI", "Tìm giảng viên CNTT", "Mẫu đề cương", "Xu hướng Tech 2024"].map(hint => (
                            <button 
                              key={hint}
                              onClick={() => setMessage(hint)}
                              className="p-3 bg-white/5 border border-white/10 rounded-xl text-[11px] font-bold hover:bg-white/10 hover:border-white/20 transition-all text-gray-400 text-left"
                            >
                              "{hint}"
                            </button>
                         ))}
                      </div>
                   </div>
                ) : (
                  <div className="flex flex-col gap-6 p-6 md:p-10">
                    {messages.map((msg, index) => (
                      <div 
                        key={index} 
                        className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
                      >
                        <div className={`flex gap-4 max-w-[85%] md:max-w-[70%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                          {/* Avatar */}
                          <div className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center shadow-lg mt-1 overflow-hidden ${
                          msg.role === "assistant" ? "bg-primary text-white" : "bg-white/10 text-white border border-white/10"
                        }`}>
                          {msg.role === "assistant" ? (
                            <Bot size={20} />
                          ) : studentProfile?.studentImage ? (
                            <img 
                              src={getAvatarUrl(studentProfile.studentImage)} 
                              alt="Me" 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <UserIcon size={20} />
                          )}
                        </div>

                          {/* Bubble */}
                          <div className="flex flex-col gap-2">
                             <div className={`relative px-5 py-4 rounded-[24px] text-[15px] leading-relaxed shadow-xl ${
                               msg.role === "user" 
                                 ? "bg-[#40414f] text-white border border-white/10 rounded-tr-none" 
                                 : "bg-white/5 text-gray-100 border border-white/5 rounded-tl-none"
                             }`}>
                                 <div className="prose prose-invert prose-p:leading-relaxed prose-headings:font-black prose-headings:text-white prose-a:text-primary max-w-none chatbot-message-content">
                                    {msg.role === "assistant" ? (
                                      <ReactMarkdown 
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                          table: ({ ...props }) => (
                                            <div className="overflow-x-auto my-4 rounded-xl border border-white/10 bg-white/5">
                                              <table className="min-w-full divide-y divide-white/10 border-collapse" {...props} />
                                            </div>
                                          ),
                                          thead: ({ ...props }) => <thead className="bg-white/5" {...props} />,
                                          th: ({ ...props }) => <th className="px-4 py-3 font-black text-left text-[11px] uppercase tracking-widest text-slate-400" {...props} />,
                                          td: ({ ...props }) => <td className="px-4 py-3 border-t border-white/5 text-sm" {...props} />,
                                          p: ({ ...props }) => <p className="mb-4 last:mb-0 leading-relaxed" {...props} />,
                                          code: ({ ...props }) => <code className="bg-white/10 px-1.5 py-0.5 rounded text-[#F37021] font-mono text-sm border border-white/5" {...props} />,
                                          ul: ({ ...props }) => <ul className="list-disc pl-6 mb-4 space-y-2" {...props} />,
                                          ol: ({ ...props }) => <ol className="list-decimal pl-6 mb-4 space-y-2" {...props} />,
                                          li: ({ ...props }) => <li className="leading-relaxed" {...props} />,
                                          h3: ({ ...props }) => <h3 className="text-lg font-black text-white mt-6 mb-3 flex items-center gap-2" {...props} />,
                                        }}
                                      >
                                        {msg.content.replace(/\\n/g, '\n')}
                                      </ReactMarkdown>
                                    ) : (
                                      <p className="whitespace-pre-wrap">{msg.content}</p>
                                    )}
                                 </div>
                                
                                <div className={`text-[10px] mt-3 font-bold opacity-30 uppercase tracking-tighter ${msg.role === "user" ? "text-right" : "text-left"}`}>
                                   {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                                </div>
                             </div>

                             {/* Feedback Controls */}
                             {msg.role === "assistant" && msg.id && (
                               <div className="flex items-center gap-2 mt-1 px-1">
                                 <button 
                                   onClick={() => handleFeedback(msg.id!, msg.feedback === 1 ? 0 : 1)}
                                   className={`p-1.5 rounded-lg transition-all hover:scale-110 ${msg.feedback === 1 ? "bg-primary text-white" : "bg-white/5 text-gray-500 hover:text-gray-300"}`}
                                   title="Hài lòng"
                                 >
                                   <ThumbsUp size={12} />
                                 </button>
                                 <button 
                                   onClick={() => handleFeedback(msg.id!, msg.feedback === -1 ? 0 : -1)}
                                   className={`p-1.5 rounded-lg transition-all hover:scale-110 ${msg.feedback === -1 ? "bg-red-500 text-white" : "bg-white/5 text-gray-500 hover:text-gray-300"}`}
                                   title="Không hài lòng"
                                 >
                                   <ThumbsDown size={12} />
                                 </button>
                               </div>
                             )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {isLoading && (
                      <div className="flex justify-start animate-fade-in">
                        <div className="flex gap-4 items-start">
                          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-lg">
                            <Bot size={20} className="text-white" />
                          </div>
                          <div className="flex flex-col gap-2">
                            <div className="bg-white/5 border border-white/5 px-5 py-4 rounded-[24px] rounded-tl-none flex items-center gap-3">
                              <div className="flex gap-1">
                                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-gray-500 rounded-full" />
                                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-gray-500 rounded-full" />
                                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-gray-500 rounded-full" />
                              </div>
                              <span className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">AI đang suy nghĩ...</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} className="h-20" />
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#343541] via-[#343541] to-transparent pt-10">
                <div className="max-w-3xl mx-auto relative">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Nhập câu hỏi của bạn tại đây..."
                    className="w-full bg-[#40414f] border border-white/10 text-white rounded-2xl px-5 py-4 pr-16 focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-2xl resize-none max-h-48 custom-scrollbar transition-all placeholder:text-gray-500 font-medium"
                    rows={1}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!message.trim() || isLoading}
                    className={`absolute right-3 bottom-3 p-2.5 rounded-xl transition-all shadow-lg ${
                      !message.trim() || isLoading 
                        ? "bg-[#2A2B32] text-gray-600 cursor-not-allowed" 
                        : "bg-primary text-white hover:scale-105 active:scale-95"
                    }`}
                  >
                    {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                  </button>
                </div>
                <div className="flex items-center justify-center gap-4 mt-4">
                   <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">
                      © 2026 Đại học Đại Nam - Academic AI Helper
                   </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>
        {`
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.1);
          }
        `}
      </style>
    </div>
  );
};

export default ChatbotPopup;

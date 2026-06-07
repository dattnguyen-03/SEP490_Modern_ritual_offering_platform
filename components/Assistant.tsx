
import React, { useState, useEffect } from 'react';
import { aiChatService, SuggestedPackage } from '../services/aiChatService';
import { isAuthenticated } from '../services/auth';
import toast from '../services/toast';

type UiMessage = {
  role: 'user' | 'bot';
  text: string;
  suggestedPackages?: SuggestedPackage[];
};

const Assistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  const closeAssistant = async () => {
    if (sessionId) {
      await aiChatService.closeSession(sessionId);
    }
    setIsOpen(false);
    setSessionId(null);
    setMessages([]);
    setInput('');
  };

  // Initialize session when chat opens
  useEffect(() => {
    if (isOpen && !sessionId && !isInitializing) {
      if (!isAuthenticated()) {
        toast.error('Vui lòng đăng nhập để sử dụng trợ lý AI');
        setIsOpen(false);
        return;
      }

      const initSession = async () => {
        setIsInitializing(true);
        try {
          const session = await aiChatService.createSession();
          const id = session?.sessionId;
          if (id) {
            console.log('Assistant setting sessionId:', id);
            setSessionId(id);
          } else {
            console.error('aiChatService.createSession returned invalid ID:', id);
            throw new Error('Không nhận được ID phiên chat hợp lệ');
          }
        } catch (error: any) {
          console.error('Failed to create AI session:', error);
          toast.error(error.message || 'Không thể khởi tạo phiên chat AI');
          setIsOpen(false);
        } finally {
          setIsInitializing(false);
        }
      };
      initSession();
    }
  }, [isOpen, sessionId, isInitializing]);

  const handleSend = async () => {
    if (!input.trim() || !sessionId) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const result = await aiChatService.sendMessage(sessionId, userMsg);
      setMessages(prev => [...prev, {
        role: 'bot',
        text: result.assistantText || 'Mình đã nhận thông tin. Bạn có thể cho mình thêm chi tiết để tư vấn chính xác hơn nhé.',
        suggestedPackages: result.suggestedPackages,
      }]);
    } catch (error: any) {
      console.error('AI Chat Error:', error);
      setMessages(prev => [...prev, { role: 'bot', text: 'Xin lỗi, tôi đang gặp lỗi kết nối. Bạn vui lòng thử lại sau nhé!' }]);

      // If 401 occurs mid-session, reset it
      if (error.message?.includes('401') || error.message?.includes('đăng nhập')) {
        setSessionId(null);
        setIsOpen(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickQuestion = (text: string) => {
    setInput(text);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[60]">
      {isOpen ? (
        <div className="bg-white rounded-3xl shadow-2xl border border-gold/20 w-80 md:w-96 overflow-hidden flex flex-col h-[500px]">
          <div className="bg-primary p-5 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined">auto_awesome</span>
              <div>
                <p className="font-bold text-sm">Trợ lý Ritual</p>
                <p className="text-[10px] opacity-80 uppercase tracking-widest">Tư vấn tâm linh AI</p>
              </div>
            </div>
            <button onClick={() => { void closeAssistant(); }} className="hover:rotate-90 transition-transform">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-ritual-bg">
            {messages.length === 0 && !isInitializing && (
              <div className="text-center py-8">
                <p className="text-xs text-gray-400 mb-2">Chào bạn, tôi có thể giúp gì cho nghi lễ của gia đình mình?</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <button onClick={() => handleQuickQuestion("Cần chuẩn bị gì cho cúng thôi nôi?")} className="text-[10px] bg-white border border-gold/30 px-3 py-1.5 rounded-full hover:bg-gold/10 transition-colors">Cúng thôi nôi</button>
                  <button onClick={() => handleQuickQuestion("Cần chuẩn bị gì cho mâm cúng khai trương?")} className="text-[10px] bg-white border border-gold/30 px-3 py-1.5 rounded-full hover:bg-gold/10 transition-colors">Cúng khai trương</button>
                </div>
              </div>
            )}
            {isInitializing && (
              <div className="flex justify-center items-center h-full">
                <div className="text-center space-y-2">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Đang kết nối Trợ lý...</p>
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-primary text-white rounded-tr-none shadow-md' : 'bg-white border border-gold/20 rounded-tl-none shadow-sm'
                  }`}>
                  {typeof msg.text === 'string' ? msg.text : JSON.stringify(msg.text)}
                  {msg.role === 'bot' && Array.isArray(msg.suggestedPackages) && msg.suggestedPackages.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Gợi ý mâm cúng</p>
                      {msg.suggestedPackages.slice(0, 3).map((pkg) => (
                        <button
                          key={pkg.packageId}
                          type="button"
                          onClick={() => window.location.assign(`/package/${pkg.packageId}`)}
                          className="w-full text-left p-2 rounded-lg border border-gold/20 hover:border-primary/40 hover:bg-primary/5 transition-colors"
                        >
                          <p className="text-xs font-bold text-slate-800">{pkg.packageName}</p>
                          <p className="text-[11px] text-slate-600 line-clamp-2">{pkg.description}</p>
                          <p className="text-[11px] font-bold text-primary mt-1">Từ {Number(pkg.minVariantPrice || 0).toLocaleString('vi-VN')}đ</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gold/20 p-3 rounded-2xl rounded-tl-none animate-pulse shadow-sm">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-gold/40 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-gold/40 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-1.5 h-1.5 bg-gold/40 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="p-4 bg-white border-t border-gold/10 flex gap-2">
            <input
              disabled={isLoading || isInitializing}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              type="text"
              placeholder={isInitializing ? "Vui lòng chờ..." : "Hỏi về nghi lễ..."}
              className="flex-1 border-gold/20 rounded-xl px-4 py-2 text-sm focus:ring-primary focus:border-primary disabled:opacity-50"
            />
            <button
              disabled={isLoading || isInitializing}
              onClick={handleSend}
              className="bg-primary text-white p-2 rounded-xl hover:bg-[#600018] transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-primary text-white size-14 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-all border-4 border-white group relative"
        >
          <span className="material-symbols-outlined text-3xl">chat</span>
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-gold"></span>
          </span>
        </button>
      )}
    </div>
  );
};

export default Assistant;


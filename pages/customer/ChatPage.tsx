import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { vendorChatService, ChatSession, ChatMessage } from '../../services/vendorChatService';
import { vendorService } from '../../services/vendorService';
import { userService } from '../../services/userService';
import { getCurrentUser } from '../../services/auth';
import toast from '../../services/toast';

// ─── Avatar color pool ───────────────────────────────────────────────────────
const AVATAR_COLORS = [
  { bg: '#FAEEDA', text: '#854F0B' },
  { bg: '#E6F1FB', text: '#185FA5' },
  { bg: '#EAF3DE', text: '#3B6D11' },
  { bg: '#EEEDFE', text: '#534AB7' },
  { bg: '#FBEAF0', text: '#993556' },
  { bg: '#E1F5EE', text: '#0F6E56' },
];
function avatarColor(id: string) {
  let n = 0;
  for (let i = 0; i < id.length; i++) n += id.charCodeAt(i);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <circle cx="7" cy="7" r="4.5" /><line x1="10.5" y1="10.5" x2="14" y2="14" />
  </svg>
);
const SendIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="14" y1="2" x2="6" y2="10" /><polyline points="14,2 9,14 6,10 2,7" />
  </svg>
);
const AttachIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M13.5 8L8 13.5A4.5 4.5 0 012.5 8L8 2.5a3 3 0 014.2 4.2L7 12.3A1.5 1.5 0 015 10.2L9.8 5.4" />
  </svg>
);
const MoreIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
    <circle cx="4" cy="8" r="1.3" /><circle cx="8" cy="8" r="1.3" /><circle cx="12" cy="8" r="1.3" />
  </svg>
);
const InfoIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <circle cx="8" cy="8" r="6" /><line x1="8" y1="7" x2="8" y2="11" /><circle cx="8" cy="5" r="0.5" fill="currentColor" />
  </svg>
);
const EmptyIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
    <rect x="6" y="10" width="36" height="28" rx="6" /><path d="M16 20h16M16 26h10" />
  </svg>
);

// ─── Typing indicator ─────────────────────────────────────────────────────────
const TypingIndicator = () => (
  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
    <div style={styles.msgAvSmall}>...</div>
    <div style={{ ...styles.bubbleIn, padding: '10px 14px', display: 'flex', gap: 4, alignItems: 'center' }}>
      {[0, 0.2, 0.4].map((d, i) => (
        <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#A8A29E', display: 'inline-block', animation: `typingBounce 1.2s ${d}s infinite` }} />
      ))}
    </div>
  </div>
);

// ─── Styles object ────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  shell: {
    display: 'flex',
    height: 'calc(100vh - 190px)',
    minHeight: 520,
    borderRadius: 20,
    overflow: 'hidden',
    border: '0.5px solid rgba(0,0,0,0.08)',
    background: '#FFFFFF',
    fontFamily: "'Be Vietnam Pro', 'Segoe UI', sans-serif",
    boxShadow: '0 10px 40px -10px rgba(0,0,0,0.05)',
  },
  sidebar: {
    width: 300,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    borderRight: '0.5px solid rgba(0,0,0,0.08)',
    background: '#FFFFFF',
  },
  sbHead: {
    padding: '20px 20px 14px',
    borderBottom: '0.5px solid rgba(0,0,0,0.07)',
  },
  sbTitle: { fontSize: 16, fontWeight: 600, color: '#1C1917', letterSpacing: -0.3 },
  sbSub: { fontSize: 11, color: '#78716C', marginTop: 2 },
  sbSearchWrap: { position: 'relative', padding: '10px 14px 0' },
  sbSearchIcon: { position: 'absolute', left: 26, top: '50%', transform: 'translateY(-20%)', color: '#A8A29E' },
  sbSearchInput: {
    width: '100%', background: '#F5F5F4', border: '0.5px solid rgba(0,0,0,0.07)',
    borderRadius: 8, padding: '8px 12px 8px 34px', fontSize: 13,
    fontFamily: 'inherit', color: '#1C1917', outline: 'none',
  },
  sbList: { flex: 1, overflowY: 'auto', padding: 8 },
  chatItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
    transition: 'background 0.15s', marginBottom: 2,
  },
  chatItemActive: { background: '#292524' },
  ciInfo: { flex: 1, minWidth: 0 },
  ciName: { fontSize: 13, fontWeight: 500, color: '#1C1917', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  ciNameActive: { color: '#FAFAF9' },
  ciPreview: { fontSize: 12, color: '#78716C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 },
  ciPreviewActive: { color: 'rgba(250,250,249,0.5)' },
  ciMeta: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  ciTime: { fontSize: 11, color: '#A8A29E' },
  ciTimeActive: { color: 'rgba(250,250,249,0.4)' },
  ciBadge: {
    background: '#EF9F27', color: '#412402',
    fontSize: 10, fontWeight: 600, borderRadius: 10,
    padding: '1px 6px', minWidth: 18, textAlign: 'center',
  },
  main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#FAFAF9' },
  mainHead: {
    padding: '14px 24px', background: '#FFFFFF',
    borderBottom: '0.5px solid rgba(0,0,0,0.07)',
    display: 'flex', alignItems: 'center', gap: 12,
  },
  mhInfo: { flex: 1 },
  mhName: { fontSize: 15, fontWeight: 600, color: '#1C1917', letterSpacing: -0.2 },
  mhNameButton: {
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    textAlign: 'left',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  mhNameMenu: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    left: 0,
    minWidth: 160,
    background: '#FFFFFF',
    border: '0.5px solid rgba(0,0,0,0.08)',
    borderRadius: 12,
    boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
    padding: 6,
    zIndex: 20,
  },
  mhNameMenuItem: {
    width: '100%',
    border: 'none',
    background: 'transparent',
    padding: '10px 12px',
    borderRadius: 10,
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: 13,
    color: '#1C1917',
  },
  mhNameMenuItemHover: {
    background: '#F5F5F4',
  },
  mhStatus: { display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: '50%', background: '#22C55E', flexShrink: 0 },
  mhStatusText: { fontSize: 11, color: '#78716C' },
  mhActions: { display: 'flex', gap: 4 },
  iconBtn: {
    width: 32, height: 32, borderRadius: 8,
    border: '0.5px solid rgba(0,0,0,0.08)', background: '#FFFFFF',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: '#78716C',
  },
  messages: { flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 },
  dateSep: { textAlign: 'center', margin: '8px 0' },
  dateSepInner: {
    fontSize: 11, color: '#78716C', background: '#FAFAF9',
    padding: '2px 12px', borderRadius: 20, border: '0.5px solid rgba(0,0,0,0.07)',
    display: 'inline-block',
  },
  msgRowMe: { display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 8, width: '100%', marginBottom: 4 },
  msgRowThem: { display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start', gap: 8, width: '100%', marginBottom: 4 },
  msgAvSmall: {
    width: 28, height: 28, borderRadius: '50%', fontSize: 11, fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    background: '#FAEEDA', color: '#854F0B',
  },
  msgContentWrap: { display: 'flex', flexDirection: 'column', maxWidth: '75%', minWidth: 0 },
  bubbleMe: {
    width: 'fit-content', padding: '10px 16px',
    background: '#292524', color: '#FAFAF9',
    borderRadius: '16px 16px 4px 16px',
    fontSize: 14, lineHeight: 1.5,
    wordBreak: 'break-word',
    marginLeft: 'auto',
  },
  bubbleIn: {
    width: 'fit-content', padding: '10px 16px',
    background: '#FFFFFF', color: '#1C1917',
    border: '0.5px solid rgba(0,0,0,0.08)',
    borderRadius: '16px 16px 16px 4px',
    fontSize: 14, lineHeight: 1.5,
    wordBreak: 'break-word',
  },
  msgTimeMine: { fontSize: 10, color: 'rgba(250,250,249,0.45)', marginTop: 3, textAlign: 'right' as const },
  msgTimeIn: { fontSize: 10, color: '#A8A29E', marginTop: 3 },
  inputArea: { padding: '10px 16px', background: '#FFFFFF', borderTop: '0.5px solid rgba(0,0,0,0.07)' },
  inputRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#F5F5F4', borderRadius: 10,
    border: '0.5px solid rgba(0,0,0,0.07)',
    padding: '6px 8px 6px 6px',
  },
  inputEl: {
    flex: 1, background: 'transparent', border: 'none', outline: 'none',
    fontSize: 13.5, fontFamily: 'inherit', color: '#1C1917', padding: '0 4px',
  },
  sendBtn: {
    width: 34, height: 34, borderRadius: 8,
    background: '#292524', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  sendBtnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  attachBtn: {
    width: 30, height: 30, border: 'none', background: 'transparent',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#A8A29E', borderRadius: 6,
  },
  emptyState: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 12, color: '#D4CFC9',
  },
  emptyTitle: { fontSize: 15, fontWeight: 500, color: '#A8A29E' },
  emptyDesc: { fontSize: 13, color: '#C4BDB7', maxWidth: 260, textAlign: 'center' as const, lineHeight: 1.6 },
  loadingWrap: { minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' },
};

// ─── Avatar component ─────────────────────────────────────────────────────────
const Avatar: React.FC<{ id: string; name: string; src?: string | null; size?: number }> = ({ id, name, src, size = 36 }) => {
  const c = avatarColor(id || name);
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: c.bg, color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 600 }}>
      {src ? <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : name?.[0]?.toUpperCase()}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const ChatPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const initialSessionId = searchParams.get('sessionId');
  const initialVendorId = searchParams.get('vendorId');

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [namesMap, setNamesMap] = useState<Record<string, string>>({});
  const [avatarsMap, setAvatarsMap] = useState<Record<string, string>>({});
  const [shopMenuOpen, setShopMenuOpen] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const isVendor = location.pathname.startsWith('/vendor');
  const role: 'customer' | 'vendor' = isVendor ? 'vendor' : 'customer';

  // Resolve names
  useEffect(() => {
    const resolveNames = async () => {
      const newNames: Record<string, string> = { ...namesMap };
      const newAvatars: Record<string, string> = { ...avatarsMap };
      let changed = false;
      for (const session of sessions) {
        const targetId = isVendor ? session.customerId : session.vendorId;
        if (targetId && !newNames[targetId]) {
          try {
            if (isVendor) {
              const d = await userService.getUserById(targetId);
              newNames[targetId] = d?.fullName || `Khách hàng #${targetId.slice(-4)}`;
              if (d?.avatarUrl && !newAvatars[targetId]) {
                newAvatars[targetId] = d.avatarUrl;
              }
            } else {
              const d = await vendorService.getVendorCached(targetId);
              if (d?.shopName) newNames[targetId] = d.shopName;
              const vendorAvatar = d?.shopAvatarUrl || d?.avatarUrl || null;
              if (vendorAvatar && !newAvatars[targetId]) {
                newAvatars[targetId] = vendorAvatar;
              }
            }
            changed = true;
          } catch { /* silent */ }
        }
      }
      if (changed) {
        setNamesMap(newNames);
        setAvatarsMap(newAvatars);
      }
    };
    if (sessions.length > 0) resolveNames();
  }, [sessions, isVendor, namesMap, avatarsMap]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const data = await vendorChatService.getSessions(role);
        setSessions(data);
        if (initialSessionId) {
          const session = data.find(s => s.sessionId === initialSessionId);
          if (session) {
            handleSelectSession(session);
          } else {
            const details = await vendorChatService.getSessionDetails(initialSessionId);
            setActiveSession(details);
            setMessages(details.messages || []);
          }
        } else if (initialVendorId && !isVendor) {
          const existingSession = data.find(s => s.vendorId === initialVendorId);
          if (existingSession) {
            handleSelectSession(existingSession);
          } else {
            const createdSessionId = await vendorChatService.createSession(initialVendorId);
            const details = await vendorChatService.getSessionDetails(createdSessionId);
            setActiveSession(details);
            setMessages(details.messages || []);

            const refreshedSessions = await vendorChatService.getSessions(role);
            setSessions(refreshedSessions);
          }
        } else if (data.length > 0) {
          handleSelectSession(data[0]);
        }
      } catch (error: any) {
        if (!error.message?.includes('405')) toast.error('Không thể tải danh sách chat');
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [role, initialSessionId, initialVendorId, isVendor]);

  useEffect(() => {
    if (!activeSession) return;
    const interval = setInterval(async () => {
      try {
        const details = await vendorChatService.getSessionDetails(activeSession.sessionId);
        if (details.messages?.length !== messages.length) setMessages(details.messages || []);
      } catch { /* silent */ }
    }, 4000);
    return () => clearInterval(interval);
  }, [activeSession, messages.length]);

  const handleSelectSession = async (session: ChatSession) => {
    setActiveSession(session);
    setMessages(session.messages || []);
    try {
      const details = await vendorChatService.getSessionDetails(session.sessionId);
      setMessages(details.messages || []);
    } catch { /* silent */ }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim() || !activeSession || isSending) return;
    const text = newMessage.trim();
    setNewMessage('');
    setIsSending(true);
    try {
      const sentMsg = await vendorChatService.sendMessage(activeSession.sessionId, text);
      setMessages(prev => [...prev, sentMsg]);
    } catch {
      toast.error('Không thể gửi tin nhắn');
      setNewMessage(text);
    } finally {
      setIsSending(false);
    }
  };

  const getParty = (session: ChatSession | null) => {
    if (!session) return { name: 'Người dùng', id: '', avatar: null };
    const targetId = isVendor ? (session.customerId || '') : (session.vendorId || '');
    const fallback = isVendor
      ? `Khách hàng #${targetId.slice(-4) || '...'}`
      : `Cửa hàng #${targetId.slice(-4) || '...'}`;
    return {
      name: namesMap[targetId] || fallback,
      id: targetId,
      avatar: avatarsMap[targetId] || session.counterPartyAvatar,
    };
  };

  const filteredSessions = sessions.filter(s => {
    const party = getParty(s);
    return party.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Group messages by date
  const groupedMessages = messages.reduce<{ date: string; msgs: ChatMessage[] }[]>((acc, msg) => {
    const d = new Date(msg.timestamp).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const last = acc[acc.length - 1];
    if (last && last.date === d) last.msgs.push(msg);
    else acc.push({ date: d, msgs: [msg] });
    return acc;
  }, []);

  if (loading) {
    return (
      <div style={styles.loadingWrap}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #E7E5E4', borderTopColor: '#292524', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  const activeParty = getParty(activeSession);
  const canViewShop = !isVendor && Boolean(activeParty.id);
  const handleViewShop = () => {
    if (!activeParty.id) return;
    setShopMenuOpen(false);
    navigate(`/vendor/${encodeURIComponent(activeParty.id)}`);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;500;600&display=swap');
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes typingBounce { 0%,60%,100% { transform: translateY(0) } 30% { transform: translateY(-4px) } }
        .chat-sb-list::-webkit-scrollbar { width: 3px }
        .chat-sb-list::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 4px }
        .chat-msgs::-webkit-scrollbar { width: 3px }
        .chat-msgs::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.08); border-radius: 4px }
        .chat-item-row:hover { background: #F5F5F4 !important }
        .chat-item-row.active:hover { background: #292524 !important }
        .icon-btn-hover:hover { background: #F5F5F4 }
        .send-btn-hover:hover { opacity: 0.85 }
        .attach-btn-hover:hover { background: #F5F5F4; color: #1C1917 }
        .sb-search-input:focus { border-color: rgba(186,117,23,0.4) !important; background: #fff !important }
      `}</style>

      <div style={styles.shell}>

        {/* ── SIDEBAR ── */}
        <div style={styles.sidebar}>
          <div style={styles.sbHead}>
            <div style={styles.sbTitle}>Hội thoại</div>
            <div style={styles.sbSub}>Hỗ trợ khách hàng</div>
          </div>

          <div style={styles.sbSearchWrap}>
            <span style={styles.sbSearchIcon}><SearchIcon /></span>
            <input
              className="sb-search-input"
              style={styles.sbSearchInput}
              type="text"
              placeholder="Tìm kiếm..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="chat-sb-list" style={{ ...styles.sbList, marginTop: 8 }}>
            {filteredSessions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 16px', color: '#A8A29E', fontSize: 13 }}>
                Chưa có cuộc trò chuyện nào
              </div>
            ) : (
              filteredSessions.map(session => {
                const party = getParty(session);
                const isActive = activeSession?.sessionId === session.sessionId;
                const lastMsg = session.messages?.[session.messages.length - 1];
                const unread = 0; // wire up unread count from your API if available

                return (
                  <div
                    key={session.sessionId}
                    className={`chat-item-row${isActive ? ' active' : ''}`}
                    style={{ ...styles.chatItem, ...(isActive ? styles.chatItemActive : {}) }}
                    onClick={() => handleSelectSession(session)}
                  >
                    <Avatar id={party.id} name={party.name} src={party.avatar} size={38} />
                    <div style={styles.ciInfo}>
                      <div style={{ ...styles.ciName, ...(isActive ? styles.ciNameActive : {}) }}>
                        {party.name}
                      </div>
                      {lastMsg && (
                        <div style={{ ...styles.ciPreview, ...(isActive ? styles.ciPreviewActive : {}) }}>
                          {lastMsg.content}
                        </div>
                      )}
                    </div>
                    <div style={styles.ciMeta}>
                      <div style={{ ...styles.ciTime, ...(isActive ? styles.ciTimeActive : {}) }}>
                        {lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                      {unread > 0 && <div style={styles.ciBadge}>{unread}</div>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── MAIN ── */}
        <div style={styles.main}>
          {activeSession ? (
            <>
              {/* Header */}
              <div style={{ ...styles.mainHead, position: 'relative' }}>
                <Avatar id={activeParty.id} name={activeParty.name} src={activeParty.avatar} size={40} />
                <div style={styles.mhInfo}>
                  <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column' }}>
                    <button
                      type="button"
                      style={styles.mhNameButton}
                      onClick={() => {
                        if (canViewShop) {
                          handleViewShop();
                          return;
                        }
                        setShopMenuOpen((v) => !v);
                      }}
                      onBlur={() => setTimeout(() => setShopMenuOpen(false), 120)}
                      title={canViewShop ? 'Xem shop' : ''}
                    >
                      <div style={styles.mhName}>{activeParty.name}</div>
                      {canViewShop && <span style={{ fontSize: 10, color: '#A8A29E' }}>▾</span>}
                    </button>
                    {canViewShop && shopMenuOpen && (
                      <div style={styles.mhNameMenu}>
                        <button
                          type="button"
                          style={styles.mhNameMenuItem}
                          onMouseEnter={(e) => { (e.currentTarget.style.background = '#F5F5F4'); }}
                          onMouseLeave={(e) => { (e.currentTarget.style.background = 'transparent'); }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleViewShop();
                          }}
                        >
                          Xem shop
                        </button>
                      </div>
                    )}
                  </div>
                  <div style={styles.mhStatus}>
                    <div style={styles.statusDot} />
                    <span style={styles.mhStatusText}>Đang trực tuyến</span>
                  </div>
                </div>
                <div style={styles.mhActions}>
                  <button className="icon-btn-hover" style={styles.iconBtn}><InfoIcon /></button>
                  <button className="icon-btn-hover" style={styles.iconBtn}><MoreIcon /></button>
                </div>
              </div>

              {/* Messages */}
              <div ref={messagesContainerRef} className="chat-msgs" style={styles.messages}>
                {groupedMessages.map(({ date, msgs }) => (
                  <React.Fragment key={date}>
                    <div style={styles.dateSep}>
                      <span style={styles.dateSepInner}>{date}</span>
                    </div>
                    {msgs.map((msg, idx) => {
                      const isMine = msg.role?.toLowerCase() === role.toLowerCase();
                      return (
                        <div key={msg.messageId || idx} style={isMine ? styles.msgRowMe : styles.msgRowThem}>
                          {!isMine && (
                            <Avatar id={activeParty.id} name={activeParty.name} src={activeParty.avatar} size={28} />
                          )}
                          <div style={styles.msgContentWrap}>
                            <div style={isMine ? styles.bubbleMe : styles.bubbleIn}>
                              {msg.content}
                            </div>
                            <div style={isMine ? styles.msgTimeMine : styles.msgTimeIn}>
                              {new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}

                {isSending && <TypingIndicator />}
              </div>

              {/* Input */}
              <div style={styles.inputArea}>
                <form onSubmit={handleSendMessage} style={styles.inputRow}>
                  <button type="button" className="attach-btn-hover" style={styles.attachBtn}>
                    <AttachIcon />
                  </button>
                  <input
                    style={styles.inputEl}
                    type="text"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="Nhập tin nhắn..."
                  />
                  <button
                    type="submit"
                    className="send-btn-hover"
                    disabled={!newMessage.trim() || isSending}
                    style={{ ...styles.sendBtn, ...((!newMessage.trim() || isSending) ? styles.sendBtnDisabled : {}) }}
                  >
                    <SendIcon />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div style={styles.emptyState}>
              <EmptyIcon />
              <div style={styles.emptyTitle}>Chọn một cuộc trò chuyện</div>
              <div style={styles.emptyDesc}>Bắt đầu trao đổi để được tư vấn về các gói lễ cúng phù hợp nhất.</div>
            </div>
          )}
        </div>

      </div>
    </>
  );
};

export default ChatPage;
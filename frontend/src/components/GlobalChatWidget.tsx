import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore'; 
import { useSocket } from '../hooks/useSocket';
import api from '../api/axios';
import UserAvatar from './UserAvatar';
import { streamAIChat } from '../api/aiApi'; 

// --- INTERFACES ---
interface User { id: number; username: string; nickname?: string | null; avatar?: string | null; }
interface Message {
  id?: number | string; senderId?: number; senderName?: string; content: string;
  timestamp?: string; createdAt?: string; created_at?: string;
  sender?: { id: number; username: string; nickname?: string | null; avatar?: string; };
}
interface RoomMember { userId: number; user: User; }
interface Room { 
  id: number; 
  name: string | null; 
  type?: string; 
  members?: RoomMember[]; 
  updatedAt?: string; // 🟢 AJOUT : Pour savoir quelle conversation est la plus récente
}

const getDisplayName = (account?: { username?: string; nickname?: string | null } | null) => {
  if (!account || !account.username) return 'Visiteur';
  return account.nickname && account.nickname.trim() !== '' ? account.nickname : account.username;
};

export const GlobalChatWidget: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state: any) => state.user);
  const { socket, isConnected } = useSocket('/chat');
  
  const { isChatOpen, setIsChatOpen, activeRoom, setActiveRoom } = useChatStore();
  
  const [rooms, setRooms] = useState<Room[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiCooldown, setAiCooldown] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchRooms = async () => {
    try {
      const response = await api.get('/chat/channels');
      const fetchedRooms = response.data;
      
      const realAiRoom = fetchedRooms.find((r: Room) => r.name?.startsWith('ai-chat-'));
      
      if (!realAiRoom) {
        fetchedRooms.push({ id: -1, name: `ai-chat-${user.id}` });
      } else if (useChatStore.getState().activeRoom === -1) { 
        setActiveRoom(realAiRoom.id);
      }
      
      setRooms(fetchedRooms);
    } catch (err) {
      console.error("Erreur salons:", err);
    }
  };

  useEffect(() => {
    if (activeRoom !== null && user) {
      const roomExists = rooms.some(r => r.id === activeRoom);
      if (!roomExists) fetchRooms();
    }
  }, [activeRoom, user, rooms]);

  useEffect(() => {
    if (aiCooldown <= 0) return;
    const timer = setInterval(() => setAiCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [aiCooldown]);

  useEffect(() => {
    if (!user) {
      setIsChatOpen(false);
      return;
    }
    fetchRooms();
  }, [user]);

  useEffect(() => {
    const handleOpenChat = (e: CustomEvent<{ roomId: number }>) => {
      setIsChatOpen(true); 
      setActiveRoom(e.detail.roomId); 
    };
    window.addEventListener('open-chat-room', handleOpenChat as EventListener);
    return () => window.removeEventListener('open-chat-room', handleOpenChat as EventListener);
  }, []);
  
  useEffect(() => {
    if (!isConnected || !socket || !user) return;

    const handleGlobalUpdate = () => {
      fetchRooms();
    };

    socket.on('rooms_updated', handleGlobalUpdate);
    socket.on('receive_message', handleGlobalUpdate); 

    return () => {
      socket.off('rooms_updated', handleGlobalUpdate);
      socket.off('receive_message', handleGlobalUpdate);
    };
  }, [isConnected, socket, user]); 

  useEffect(() => {
    if (!isConnected || !socket || !user || activeRoom === null) {
      if (activeRoom === null) setMessages([]);
      return;
    }
    
    if (activeRoom === -1) {
      setMessages([{
        id: 'welcome-ai', senderId: 0, senderName: 'Assistant IA',
        content: "Bonjour ! Je suis votre assistant IA. Comment puis-je vous aider aujourd'hui ?"
      }]);
      return; 
    }

    const handleHistory = (hist: Message[]) => {
      if (Array.isArray(hist)) setMessages(hist);
    };
    
    const handleReceiveMessage = (msg: Message) => {
      setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
    };
    
    socket.on('load_history', handleHistory);
    socket.on('receive_message', handleReceiveMessage); 
    
    socket.emit('joinChannel', { channelId: activeRoom });
    
    return () => {
      socket.off('load_history', handleHistory);
      socket.off('receive_message', handleReceiveMessage);
    };
  }, [socket, activeRoom, isConnected, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatOpen, isAiLoading]);

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = chatInput.trim();
    if (!content || !isConnected || !socket || activeRoom === null) return;

    const currentRoom = rooms.find(r => r.id === activeRoom);
    const isAiRoom = currentRoom?.name?.startsWith('ai-chat-');

    setChatInput('');

    if (isAiRoom) {
      if (isAiLoading || aiCooldown > 0) return; 
      
      setMessages(prev => [...prev, { id: Date.now(), senderId: user.id, senderName: user.username, content: content }]);
      setIsAiLoading(true);

      try {
        await streamAIChat(
          content,
          (dataStr) => {
            try {
              const parsed = typeof dataStr === 'string' ? JSON.parse(dataStr) : dataStr;
              if (parsed.done) {
                setIsAiLoading(false); 
                if (parsed.result) {
                  setMessages((prev) => [...prev, { id: Date.now() + 1, senderId: 0, senderName: 'Assistant IA', content: parsed.result.reply }]);
                  if (parsed.result.action === 'NAVIGATE' && parsed.result.target) {
                    setTimeout(() => navigate(parsed.result.target), 1500);
                  }
                } else if (parsed.error) {
                  setMessages((prev) => [...prev, { id: Date.now()+1, senderId: 0, senderName: 'Assistant IA', content: parsed.error }]);
                }
              }
            } catch (err) {}
          },
          () => {
             setIsAiLoading(false);
             setAiCooldown(60);
          }
        );
      } catch (error) {
        setIsAiLoading(false);
        setMessages((prev) => [...prev, { id: Date.now()+1, senderId: 0, senderName: 'Assistant IA', content: "Impossible de joindre l'API." }]);
      }

    } else {
      socket.emit('send_message', { channelId: activeRoom, content: content });
    }
  };

  const getRoomDisplayInfo = (room?: Room) => {
    if (!room) return { name: 'Chargement...', icon: '⏳', targetUser: null };
    if (room.type === 'DIRECT' || room.name?.startsWith('dm_')) {
      const otherMember = room.members?.find(m => m.userId !== user?.id);
      if (otherMember?.user) {
        return { name: getDisplayName(otherMember.user), icon: '💬', targetUser: otherMember.user };
      }
      return { name: 'Message Privé', icon: '💬', targetUser: null };
    }
    if (room.name?.startsWith('ai-chat-')) return { name: 'Assistant IA', icon: '🤖', targetUser: null };
    return { name: room.name ? `# ${room.name}` : 'Salon inconnu', icon: '👥', targetUser: null };
  };

  if (!user) return null;

  // 🟢 NOUVEAU TRI : L'IA en haut, puis du plus récent au plus ancien
  const sortedRooms = [...rooms].sort((a, b) => {
    const isA_AI = a.name?.startsWith('ai-chat-');
    const isB_AI = b.name?.startsWith('ai-chat-');
    
    // 1. L'IA reste toujours accrochée tout en haut
    if (isA_AI && !isB_AI) return -1;
    if (!isA_AI && isB_AI) return 1;
    
    // 2. Tri par date de mise à jour (la plus récente d'abord)
    const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    
    return timeB - timeA;
  });

  const activeRoomInfo = activeRoom ? rooms.find(r => r.id === activeRoom) : null;
  const isCurrentRoomAi = activeRoomInfo?.name?.startsWith('ai-chat-');

  return (
    <div className="fixed bottom-6 right-6 z-[90] flex flex-col items-end">
      {isChatOpen && (
        <div className="w-[350px] sm:w-[400px] h-[500px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl mb-4 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
          
          <div className="bg-slate-800 p-3 border-b border-slate-700 flex justify-between items-center shadow-sm z-10">
            <div className="flex items-center gap-2">
              {activeRoom !== null && (
                <button onClick={() => setActiveRoom(null)} className="text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-700/50">←</button>
              )}
              {activeRoom !== null ? (() => {
                const roomInfo = getRoomDisplayInfo(activeRoomInfo || undefined);
                return (
                  <div className="flex items-center gap-2">
                    {roomInfo.targetUser ? (
                      <UserAvatar 
                        avatarUrl={roomInfo.targetUser.avatar} 
                        username={roomInfo.name} 
                        className="w-7 h-7 border border-slate-600 cursor-pointer" 
                        onClick={() => navigate(`/${roomInfo.targetUser.username}`)}
                      />
                    ) : (
                      <span className="text-lg">{roomInfo.icon}</span>
                    )}
                    <span 
                      className={`font-semibold text-sm ${roomInfo.targetUser ? 'cursor-pointer hover:underline' : ''}`}
                      onClick={() => roomInfo.targetUser && navigate(`/${roomInfo.targetUser.username}`)}
                    >
                      {roomInfo.name}
                    </span>
                  </div>
                );
              })() : (
                <span className="font-semibold text-sm">Discussions</span>
              )}
            </div>
            <button onClick={() => setIsChatOpen(false)} className="text-slate-400 hover:text-white px-2">✕</button>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden relative bg-slate-950">
            {!isConnected ? (
              <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">Connexion au serveur...</div>
            ) : activeRoom === null ? (
              <ul className="flex-1 overflow-y-auto">
                {sortedRooms.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-sm mt-10">Aucune discussion</div>
                ) : (
                  sortedRooms.map(room => {
                    const { name, icon, targetUser } = getRoomDisplayInfo(room);
                    return (
                      <li key={room.id} onClick={() => setActiveRoom(room.id)} className="p-4 border-b border-slate-800/50 hover:bg-slate-800 cursor-pointer flex items-center gap-3 transition-colors">
                        {targetUser ? (
                          <UserAvatar avatarUrl={targetUser.avatar} username={name} className="w-10 h-10 border border-slate-700" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-indigo-900/50 flex items-center justify-center text-indigo-400 text-xl border border-indigo-500/20">
                            {icon}
                          </div>
                        )}
                        <span className="font-medium text-sm text-slate-200">{name}</span>
                      </li>
                    );
                  })
                )}
              </ul>
            ) : (
              <>
                <div className="flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-3">
                  {messages.map((msg, index) => {
                    const isMe = msg.senderId === user.id || msg.sender?.id === user.id;
                    const senderName = msg.sender ? getDisplayName(msg.sender) : (msg.senderName || 'Utilisateur');
                    
                    return (
                      <div key={msg.id || index} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex gap-2 max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                          
                          {!isMe && (
                            <div className="flex-shrink-0 flex flex-col justify-end pb-1">
                              <UserAvatar 
                                avatarUrl={msg.sender?.avatar} 
                                username={senderName} 
                                className="w-7 h-7 text-xs border border-slate-700 shadow-sm cursor-pointer hover:ring-2 hover:ring-indigo-400" 
                                onClick={() => msg.sender?.username && navigate(`/${msg.sender.username}`)}
                              />
                            </div>
                          )}

                          <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            {!isMe && (
                              <span 
                                className="text-[10px] font-medium text-slate-500 mb-1 ml-1 cursor-pointer hover:underline" 
                                onClick={() => msg.sender?.username && navigate(`/${msg.sender.username}`)}
                              >
                                {senderName}
                              </span>
                            )}
                            
                            <div className={`p-2.5 rounded-2xl text-sm ${isMe ? 'bg-indigo-600 text-white rounded-br-sm shadow-md' : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-sm shadow-sm'}`}>
                              {msg.content}
                            </div>
                          </div>

                        </div>
                      </div>
                    );
                  })}
                  
                  {isAiLoading && (
                    <div className="flex w-full justify-start mt-2">
                      <div className="p-2.5 rounded-2xl text-sm bg-slate-800 text-slate-400 border border-slate-700 rounded-bl-sm shadow-sm italic animate-pulse">
                        L'IA réfléchit...
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
                
                <form onSubmit={handleSendChatMessage} className="p-3 bg-slate-900 border-t border-slate-800 flex gap-2">
                  <input 
                    type="text" 
                    value={chatInput} 
                    onChange={(e) => setChatInput(e.target.value)} 
                    placeholder={isCurrentRoomAi && aiCooldown > 0 ? `Attendez ${aiCooldown}s...` : "Écrire un message..."} 
                    disabled={isCurrentRoomAi && (isAiLoading || aiCooldown > 0)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50" 
                  />
                  <button 
                    type="submit" 
                    disabled={!chatInput.trim() || (isCurrentRoomAi && (isAiLoading || aiCooldown > 0))} 
                    className="bg-indigo-600 text-white w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-50 hover:bg-indigo-500"
                  >
                    ➤
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      <button 
        onClick={() => setIsChatOpen(!isChatOpen)}
        className={`w-14 h-14 rounded-full shadow-lg shadow-indigo-900/50 flex items-center justify-center text-2xl transition-transform hover:scale-105 ${isChatOpen ? 'bg-slate-700 text-white' : 'bg-indigo-600 text-white'}`}
      >
        {isChatOpen ? '✕' : '💬'}
      </button>
    </div>
  );
};
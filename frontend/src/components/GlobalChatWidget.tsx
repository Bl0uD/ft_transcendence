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
  updatedAt?: string; 
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

  // 🟢 NOUVEAU : État du Toggle (Local Ollama vs Gemini)
  const [aiProvider, setAiProvider] = useState<'ollama' | 'gemini'>('ollama');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchRooms = async () => {
    try {
      const response = await api.get('/chat/channels');
      const fetchedRooms = response.data;
      
      // 🟢 Récupération des DEUX salons IA
      const realAiRoom = fetchedRooms.find((r: Room) => r.name === `ai-chat-${user.id}`);
      const realGeminiRoom = fetchedRooms.find((r: Room) => r.name === `ai-gemini-chat-${user.id}`);
      
      if (!realAiRoom) fetchedRooms.push({ id: -1, name: `ai-chat-${user.id}` });
      if (!realGeminiRoom) fetchedRooms.push({ id: -2, name: `ai-gemini-chat-${user.id}` });
      
      const currentActive = useChatStore.getState().activeRoom;
      if (currentActive === -1 && realAiRoom) setActiveRoom(realAiRoom.id);
      if (currentActive === -2 && realGeminiRoom) setActiveRoom(realGeminiRoom.id);
      
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
    if (!user) { setIsChatOpen(false); return; }
    fetchRooms();
  }, [user]);

  useEffect(() => {
    const handleOpenChat = (e: CustomEvent<{ roomId: number }>) => { setIsChatOpen(true); setActiveRoom(e.detail.roomId); };
    window.addEventListener('open-chat-room', handleOpenChat as EventListener);
    return () => window.removeEventListener('open-chat-room', handleOpenChat as EventListener);
  }, []);
  
  useEffect(() => {
    if (!isConnected || !socket || !user) return;
    const handleGlobalUpdate = () => fetchRooms();
    socket.on('rooms_updated', handleGlobalUpdate);
    socket.on('receive_message', handleGlobalUpdate); 
    return () => { socket.off('rooms_updated', handleGlobalUpdate); socket.off('receive_message', handleGlobalUpdate); };
  }, [isConnected, socket, user]); 

  useEffect(() => {
    if (!isConnected || !socket || !user || activeRoom === null) {
      if (activeRoom === null) setMessages([]);
      return;
    }
    
    // 🟢 Gère les messages de bienvenue pour les deux IA
    if (activeRoom === -1 || activeRoom === -2) {
      const botName = activeRoom === -1 ? 'Assistant IA (Local)' : 'Gemini IA';
      setMessages([{
        id: 'welcome-ai', senderId: 0, senderName: botName,
        content: `Bonjour ! Je suis ${botName}. Comment puis-je vous aider aujourd'hui ?`
      }]);
      return; 
    }

    const handleHistory = (hist: Message[]) => { if (Array.isArray(hist)) setMessages(hist); };
    const handleReceiveMessage = (msg: Message) => { setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]); };
    
    socket.on('load_history', handleHistory);
    socket.on('receive_message', handleReceiveMessage); 
    
    socket.emit('joinChannel', { channelId: activeRoom });
    
    return () => { socket.off('load_history', handleHistory); socket.off('receive_message', handleReceiveMessage); };
  }, [socket, activeRoom, isConnected, user]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isChatOpen, isAiLoading]);

  // 🟢 NOUVEAU : Fonction pour basculer de salon quand on clique sur le Toggle
  const toggleAiProvider = () => {
    const newProvider = aiProvider === 'ollama' ? 'gemini' : 'ollama';
    setAiProvider(newProvider);
    
    const targetName = newProvider === 'ollama' ? `ai-chat-${user.id}` : `ai-gemini-chat-${user.id}`;
    const targetRoom = rooms.find(r => r.name === targetName);
    
    // On bascule sur le salon en base, ou sur le faux salon (-1, -2) si vierge
    setActiveRoom(targetRoom ? targetRoom.id : (newProvider === 'ollama' ? -1 : -2));
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = chatInput.trim();
    if (!content || !isConnected || !socket || activeRoom === null) return;

    const currentRoom = rooms.find(r => r.id === activeRoom);
    const isAiRoom = currentRoom?.name?.startsWith('ai-chat-') || currentRoom?.name?.startsWith('ai-gemini-chat-');

    setChatInput('');

    if (isAiRoom) {
      if (isAiLoading || aiCooldown > 0) return; 
      
      setMessages(prev => [...prev, { id: Date.now(), senderId: user.id, senderName: user.username, content: content }]);
      setIsAiLoading(true);

      try {
        await streamAIChat(
          content,
          aiProvider,
          (chunk) => {
            if (typeof chunk === 'string') {
              // GEMINI : flux de texte en continu
              setMessages(prev => {
                const newMsgs = [...prev];
                const lastIndex = newMsgs.length - 1;
                const lastMsg = newMsgs[lastIndex];
              
                if (lastMsg && lastMsg.senderId === 0 && lastMsg.id !== 'welcome-ai') { 
                  // 🟢 CORRECTION : On clone l'objet message pour éviter la mutation directe
                  newMsgs[lastIndex] = { ...lastMsg, content: lastMsg.content + chunk };
                } else { 
                  newMsgs.push({ 
                    id: Date.now() + 1, 
                    senderId: 0, 
                    senderName: aiProvider === 'gemini' ? 'Gemini IA' : 'Assistant IA', 
                    content: chunk 
                  }); 
                }
              return newMsgs;
            });
          } else {
              // 🟢 CORRECTION : On intercepte les erreurs (ex: Clé API manquante)
              if (chunk.error) {
                setMessages((prev) => [...prev, { id: Date.now()+1, senderId: 0, senderName: 'Système', content: chunk.error }]);
              } 
              // OLLAMA : Objet JSON structuré
              else if (chunk.done) {
                if (chunk.result) {
                  setMessages((prev) => [...prev, { id: Date.now() + 1, senderId: 0, senderName: 'Assistant IA', content: chunk.result.reply }]);
                  if (chunk.result.action === 'NAVIGATE' && chunk.result.target) {
                    setTimeout(() => navigate(chunk.result.target), 1500);
                  }
                }
              }
            }
          },
          () => { setAiCooldown(60); }
        );
        setIsAiLoading(false); 
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
      if (otherMember?.user) return { name: getDisplayName(otherMember.user), icon: '💬', targetUser: otherMember.user };
      return { name: 'Message Privé', icon: '💬', targetUser: null };
    }
    // 🟢 Nom d'affichage commun pour les deux IA dans la liste des salons
    if (room.name?.startsWith('ai-chat-') || room.name?.startsWith('ai-gemini-chat-')) {
      return { name: 'Assistant IA', icon: '🤖', targetUser: null };
    }
    return { name: room.name ? `# ${room.name}` : 'Salon inconnu', icon: '👥', targetUser: null };
  };

  if (!user) return null;

  // 🟢 NOUVEAU : On cache la conversation Gemini de la liste principale 
  // pour n'avoir qu'un seul onglet "Assistant IA" cliquable.
  const uniqueRooms = rooms.filter(room => !room.name?.startsWith('ai-gemini-chat-'));

  const sortedRooms = [...uniqueRooms].sort((a, b) => {
    const isA_AI = a.name?.startsWith('ai-chat-');
    const isB_AI = b.name?.startsWith('ai-chat-');
    if (isA_AI && !isB_AI) return -1;
    if (!isA_AI && isB_AI) return 1;
    
    const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return timeB - timeA;
  });

  const activeRoomInfo = activeRoom ? rooms.find(r => r.id === activeRoom) : null;
  const isCurrentRoomAi = activeRoomInfo?.name?.startsWith('ai-chat-') || activeRoomInfo?.name?.startsWith('ai-gemini-chat-');

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

                    {/* 🟢 LE BOUTON TOGGLE (SWITCH) S'AFFICHE ICI UNIQUEMENT DANS L'IA */}
                    {isCurrentRoomAi && (
                      <div className="flex items-center gap-2 ml-3 bg-slate-900/50 p-1 px-2 rounded-full border border-slate-700">
                        <span className={`text-[10px] font-bold uppercase transition-colors ${aiProvider === 'ollama' ? 'text-indigo-400' : 'text-slate-600'}`}>Local</span>
                        <button 
                          onClick={toggleAiProvider}
                          className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors focus:outline-none ${aiProvider === 'gemini' ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                        >
                          <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${aiProvider === 'gemini' ? 'translate-x-4' : 'translate-x-1'}`}/>
                        </button>
                        <span className={`text-[10px] font-bold uppercase transition-colors ${aiProvider === 'gemini' ? 'text-emerald-400' : 'text-slate-600'}`}>Gemini</span>
                      </div>
                    )}
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
                      <li key={room.id} onClick={() => {
                          // 🟢 Si on clique sur l'IA depuis la liste principale, 
                          // ça ouvre la room liée au toggle actuellement sélectionné !
                          if (room.name?.startsWith('ai-chat-')) {
                              const targetName = aiProvider === 'ollama' ? `ai-chat-${user.id}` : `ai-gemini-chat-${user.id}`;
                              const targetRoom = rooms.find(r => r.name === targetName);
                              setActiveRoom(targetRoom ? targetRoom.id : (aiProvider === 'ollama' ? -1 : -2));
                          } else {
                              setActiveRoom(room.id);
                          }
                      }} className="p-4 border-b border-slate-800/50 hover:bg-slate-800 cursor-pointer flex items-center gap-3 transition-colors">
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
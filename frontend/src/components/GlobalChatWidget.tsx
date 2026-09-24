import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore'; 
import { useSocket } from '../hooks/useSocket';
import api from '../api/axios';
import UserAvatar from './UserAvatar';
import { streamAIChat } from '../api/aiApi'; 
import { ChatIcon, RobotIcon, FriendsIcon } from './HeaderIcons';

// --- INTERFACES ---
interface User { id: number; username: string; nickname?: string | null; avatar?: string | null; }
interface Message {
  id?: number | string; senderId?: number; senderName?: string; content: string;
  timestamp?: string; createdAt?: string; created_at?: string;
  sender?: { id: number; username: string; nickname?: string | null; avatar?: string; };
  channelId?: number;
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

const processedMessageIds = new Set<string | number>();

export const GlobalChatWidget: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state: any) => state.user);
  const { socket, isConnected } = useSocket('/chat');
  
  const { isChatOpen, setIsChatOpen, activeRoom, setActiveRoom, unreadCounts, incrementUnread } = useChatStore();
  
  const [rooms, setRooms] = useState<Room[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiCooldown, setAiCooldown] = useState(0);

  // 🟢 NOUVEAU : État du Toggle (Local Ollama vs Gemini)
  const [aiProvider, setAiProvider] = useState<'ollama' | 'gemini'>('ollama');

  // 🟢 État agrandi pour desktop / ordinateur
  const [isExpanded, setIsExpanded] = useState(false);

  // 🟢 Ref pour scroller le conteneur interne sans déplacer la fenêtre/page
  const chatScrollRef = useRef<HTMLDivElement>(null);

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
    const handleGlobalReceiveMessage = (msg: Message) => {
      fetchRooms();
      
      // Prevent double counting if the backend sends the message twice (to room and to user's personal channel)
      if (msg.id && processedMessageIds.has(msg.id)) return;
      if (msg.id) processedMessageIds.add(msg.id);
      
      // Keep set size manageable
      if (processedMessageIds.size > 500) {
        const iterator = processedMessageIds.values();
        for (let i = 0; i < 100; i++) processedMessageIds.delete(iterator.next().value!);
      }

      if (msg.channelId && msg.senderId !== user.id && msg.sender?.id !== user.id) {
        incrementUnread(msg.channelId);
      }
    };
    socket.on('rooms_updated', handleGlobalUpdate);
    socket.on('receive_message', handleGlobalReceiveMessage); 
    return () => { socket.off('rooms_updated', handleGlobalUpdate); socket.off('receive_message', handleGlobalReceiveMessage); };
  }, [isConnected, socket, user, incrementUnread]); 

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

  // 🟢 On fait défiler uniquement le conteneur des messages pour éviter tout décalage du viewport ou disparition du haut
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isChatOpen, isAiLoading]);

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
    if (!room) return { name: 'Chargement...', icon: <span className="text-xl">⏳</span>, targetUser: null };
    if (room.type === 'DIRECT' || room.name?.startsWith('dm_')) {
      const otherMember = room.members?.find(m => m.userId !== user?.id);
      if (otherMember?.user) return { name: getDisplayName(otherMember.user), icon: <ChatIcon className="w-5 h-5 text-current" />, targetUser: otherMember.user };
      return { name: 'Message Privé', icon: <ChatIcon className="w-5 h-5 text-current" />, targetUser: null };
    }
    // 🟢 Nom d'affichage commun pour les deux IA dans la liste des salons
    if (room.name?.startsWith('ai-chat-') || room.name?.startsWith('ai-gemini-chat-')) {
      return { name: 'Assistant IA', icon: <RobotIcon className="w-6 h-6 text-current" />, targetUser: null };
    }
    return { name: room.name ? `# ${room.name}` : 'Salon inconnu', icon: <FriendsIcon className="w-5 h-5 text-current" />, targetUser: null };
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

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + (b as number), 0);

  return (
    <>
      {isChatOpen && (
        <div
          className={`fixed z-[95] bg-surface border-border shadow-2xl flex flex-col overflow-hidden transition-all duration-200
            inset-0 w-full h-[100dvh] rounded-none border-none
            inset-0 rounded-none border-none
            sm:inset-auto sm:bottom-24 sm:right-6 sm:border sm:rounded-2xl
            ${isExpanded 
              ? 'sm:w-[750px] lg:w-[850px] sm:h-[80vh] sm:max-h-[850px]' 
              : 'sm:w-[440px] md:w-[480px] sm:h-[580px] sm:max-h-[80vh]'
            }
          `}
        >
          {/* EN-TÊTE DE LA DISCUSSION */}
          <div className="bg-surface-hover px-3 py-3 sm:px-4 border-b border-border flex justify-between items-center shadow-sm z-10 gap-2 shrink-0 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {activeRoom !== null && (
                <button 
                  onClick={() => setActiveRoom(null)} 
                  className="text-text-muted hover:text-text-main px-2.5 py-1.5 rounded-lg bg-border/50 hover:bg-border shrink-0 text-sm font-medium transition-colors"
                  title="Retour aux discussions"
                >
                  ←
                </button>
              )}
              {activeRoom !== null ? (() => {
                const roomInfo = getRoomDisplayInfo(activeRoomInfo || undefined);
                return (
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {roomInfo.targetUser ? (
                      <UserAvatar 
                        avatarUrl={roomInfo.targetUser.avatar} 
                        username={roomInfo.name} 
                        className="w-8 h-8 border border-border-subtle cursor-pointer shrink-0" 
                        onClick={() => navigate(`/${roomInfo.targetUser.username}`)}
                      />
                    ) : (
                      <span className="text-xl shrink-0">{roomInfo.icon}</span>
                    )}
                    <span 
                      className={`font-semibold text-sm sm:text-base truncate max-w-[120px] sm:max-w-[200px] ${roomInfo.targetUser ? 'cursor-pointer hover:underline' : ''}`}
                      onClick={() => roomInfo.targetUser && navigate(`/${roomInfo.targetUser.username}`)}
                      title={roomInfo.name}
                    >
                      {roomInfo.name}
                    </span>

                    {/* 🟢 LE BOUTON TOGGLE (SWITCH) S'AFFICHE ICI UNIQUEMENT DANS L'IA */}
                    {isCurrentRoomAi && (
                      <div className="flex items-center gap-1.5 ml-auto sm:ml-2 bg-surface/70 p-1 px-2.5 rounded-full border border-border shrink-0">
                        <span className={`text-[10px] font-bold uppercase transition-colors ${aiProvider === 'ollama' ? 'text-primary' : 'text-text-muted'}`}>Local</span>
                        <button 
                          onClick={toggleAiProvider}
                          className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors focus:outline-none ${aiProvider === 'gemini' ? 'bg-emerald-500' : 'bg-primary-hover'}`}
                          title={`Basculer vers ${aiProvider === 'ollama' ? 'Gemini IA' : 'IA Locale (Ollama)'}`}
                        >
                          <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${aiProvider === 'gemini' ? 'translate-x-4' : 'translate-x-1'}`}/>
                        </button>
                        <span className={`text-[10px] font-bold uppercase transition-colors ${aiProvider === 'gemini' ? 'text-emerald-400' : 'text-text-muted'}`}>Gemini</span>
                      </div>
                    )}
                  </div>
                );
              })() : (
                <div className="flex items-center gap-2">
                  <span className="text-primary flex items-center justify-center bg-primary/10 w-8 h-8 rounded-lg"><ChatIcon className="w-5 h-5" /></span>
                  <span className="font-bold text-sm sm:text-base">Discussions</span>
                </div>
              )}
            </div>

            {/* BOUTONS D'ACTIONS EN-TÊTE : AGRANDIR (Desktop) + FERMER */}
            <div className="flex items-center gap-1 shrink-0">
              <button 
                type="button" 
                onClick={() => setIsExpanded(!isExpanded)}
                className="hidden sm:inline-flex text-text-muted hover:text-text-main p-1.5 rounded-lg hover:bg-border/50 text-sm transition-colors"
                title={isExpanded ? "Réduire la fenêtre" : "Agrandir la fenêtre"}
              >
                {isExpanded ? "🗗" : "⛶"}
              </button>
              <button 
                onClick={() => setIsChatOpen(false)} 
                className="text-text-muted hover:text-text-main p-1.5 rounded-lg hover:bg-border/50 text-base transition-colors"
                title="Fermer"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden relative bg-bg min-h-0">
            {!isConnected ? (
              <div className="flex-1 flex items-center justify-center text-text-muted text-sm">Connexion au serveur...</div>
            ) : activeRoom === null ? (
              <ul className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
                {sortedRooms.length === 0 ? (
                  <div className="p-8 text-center text-text-muted text-sm mt-10">Aucune discussion</div>
                ) : (
                  sortedRooms.map(room => {
                    const { name, icon, targetUser } = getRoomDisplayInfo(room);
                    const isAi = room.name?.startsWith('ai-chat-');
                    const unreadCount = isAi ? 0 : (unreadCounts[room.id] || 0);
                    
                    return (
                      <li key={room.id} onClick={() => {
                          if (isAi) {
                              const targetName = aiProvider === 'ollama' ? `ai-chat-${user.id}` : `ai-gemini-chat-${user.id}`;
                              const targetRoom = rooms.find(r => r.name === targetName);
                              setActiveRoom(targetRoom ? targetRoom.id : (aiProvider === 'ollama' ? -1 : -2));
                          } else {
                              setActiveRoom(room.id);
                          }
                      }} className="p-4 hover:bg-surface-hover/70 cursor-pointer flex items-center justify-between gap-3 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          {targetUser ? (
                            <UserAvatar avatarUrl={targetUser.avatar} username={name} className="w-10 h-10 border border-border shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xl border border-primary/20 shrink-0">
                              {icon}
                            </div>
                          )}
                          <span className={`text-sm truncate ${unreadCount > 0 ? 'text-text-main font-bold' : 'text-text-main font-medium'}`}>{name}</span>
                        </div>
                        {unreadCount > 0 && (
                          <div className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white shadow-sm shrink-0">
                            {unreadCount > 9 ? '9+' : unreadCount}
                          </div>
                        )}
                      </li>
                    );
                  })
                )}
              </ul>
            ) : (
              <>
                <div ref={chatScrollRef} className="flex-1 p-3 sm:p-4 overflow-y-auto custom-scrollbar flex flex-col gap-3 min-h-0">
                  {messages.map((msg, index) => {
                    const isMe = msg.senderId === user.id || msg.sender?.id === user.id;
                    const senderName = msg.sender ? getDisplayName(msg.sender) : (msg.senderName || 'Utilisateur');
                    
                    return (
                      <div key={msg.id || index} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex gap-2 max-w-[90%] sm:max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                          
                          {!isMe && (
                            <div className="flex-shrink-0 flex flex-col justify-end pb-1">
                              <UserAvatar 
                                avatarUrl={msg.sender?.avatar} 
                                username={senderName} 
                                className="w-7 h-7 text-xs border border-border shadow-sm cursor-pointer hover:ring-2 hover:ring-primary" 
                                onClick={() => msg.sender?.username && navigate(`/${msg.sender.username}`)}
                              />
                            </div>
                          )}

                          <div className={`flex flex-col min-w-0 ${isMe ? 'items-end' : 'items-start'}`}>
                            {!isMe && (
                              <span 
                                className="text-[10px] font-medium text-text-muted mb-1 ml-1 cursor-pointer hover:underline truncate max-w-[140px]" 
                                onClick={() => msg.sender?.username && navigate(`/${msg.sender.username}`)}
                              >
                                {senderName}
                              </span>
                            )}
                            
                            <div className={`p-3 rounded-2xl text-xs sm:text-sm break-words whitespace-pre-wrap leading-relaxed ${isMe ? 'bg-primary text-primary-content rounded-br-sm shadow-md' : 'bg-surface-hover text-text-main border border-border rounded-bl-sm shadow-sm'}`}>
                              {msg.content}
                            </div>
                          </div>

                        </div>
                      </div>
                    );
                  })}
                  
                  {isAiLoading && (
                    <div className="flex w-full justify-start mt-2">
                      <div className="p-3 rounded-2xl text-xs sm:text-sm bg-surface-hover text-text-muted border border-border rounded-bl-sm shadow-sm italic animate-pulse">
                        L'IA réfléchit...
                      </div>
                    </div>
                  )}
                </div>
                
                <form onSubmit={handleSendChatMessage} className="p-3 bg-surface border-t border-border flex gap-2 items-center shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3">
                  <input 
                    type="text" 
                    value={chatInput} 
                    onChange={(e) => setChatInput(e.target.value)} 
                    placeholder={isCurrentRoomAi && aiCooldown > 0 ? `Attendez ${aiCooldown}s...` : "Écrire un message..."} 
                    disabled={isCurrentRoomAi && (isAiLoading || aiCooldown > 0)}
                    className="flex-1 min-w-0 bg-bg border border-border rounded-full px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-primary disabled:opacity-50 text-text-main" 
                  />
                  <button 
                    type="submit" 
                    disabled={!chatInput.trim() || (isCurrentRoomAi && (isAiLoading || aiCooldown > 0))} 
                    className="bg-primary text-primary-content w-10 h-10 rounded-full flex items-center justify-center shrink-0 disabled:opacity-50 hover:bg-primary-hover transition-colors text-sm"
                  >
                    ➤
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* BOUTON FLOTTANT D'OUVERTURE (Caché sur mobile quand le chat est déjà ouvert en plein écran) */}
      <div className={`fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 sm:bottom-6 sm:right-6 z-[90] ${isChatOpen ? 'hidden sm:block' : 'block'}`}>
        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-lg shadow-primary/50 flex items-center justify-center transition-all hover:scale-105 ${isChatOpen ? 'bg-border text-text-main' : 'bg-primary text-primary-content'}`}
          title={isChatOpen ? "Fermer le chat" : "Ouvrir le chat"}
        >
          {isChatOpen ? <span className="text-xl sm:text-2xl">✕</span> : <ChatIcon className="w-6 h-6 sm:w-7 sm:h-7" />}
          {!isChatOpen && totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-bg">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
        </button>
      </div>
    </>
  );
};
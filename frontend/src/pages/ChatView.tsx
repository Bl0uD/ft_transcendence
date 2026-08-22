import React, { useEffect, useState, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useAuthStore } from '../store/authStore';
import api from '../api/axios';
// 🟢 NOUVEAU : Import de useSearchParams
import { useNavigate, useSearchParams } from 'react-router-dom';

interface Message {
  id?: number | string;
  senderId?: number;
  senderName?: string;
  content: string;
  timestamp?: string;
  createdAt?: string;
  created_at?: string;
  sender?: {
    id: number;
    username: string;
    avatar?: string;
  };
}

interface RoomMember {
  userId: number;
  user: {
    id: number;
    username: string;
    avatar?: string;
  };
}

interface Room {
  id: number;
  name: string | null;
  type?: string;
  members?: RoomMember[];
}

const MessageAvatar = ({ msg, onClick }: { msg: Message; onClick: (username?: string) => void }) => {
  const [hasError, setHasError] = useState(false);
  
  const senderName = msg.sender?.username || msg.senderName || (msg.senderId ? `Utilisateur #${msg.senderId}` : 'Utilisateur');
  const clickableUsername = msg.sender?.username || msg.senderName;

  if (!msg.sender?.avatar || hasError) {
    return (
      <div 
        onClick={() => onClick(clickableUsername)}
        className="w-7 h-7 rounded-full bg-slate-300 flex items-center justify-center text-xs text-slate-700 font-bold cursor-pointer hover:ring-2 hover:ring-blue-400 transition shrink-0"
      >
        {senderName.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={msg.sender.avatar}
      alt={`${senderName} avatar`}
      onError={() => setHasError(true)}
      onClick={() => onClick(clickableUsername)}
      className="w-7 h-7 rounded-full object-cover cursor-pointer hover:ring-2 hover:ring-blue-400 transition shrink-0"
    />
  );
};

export const ChatView: React.FC = () => {
  const user = useAuthStore((state: any) => state.user);
  const { socket, isConnected, authError } = useSocket();
  const navigate = useNavigate();
  // 🟢 NOUVEAU : Hook pour lire l'URL
  const [searchParams] = useSearchParams();

  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  
  const [activeRoom, setActiveRoom] = useState<number | null>(null);
  
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const myId = user?.id || user?.sub || user?.userId;

  const formatRoomName = (room?: Room) => {
    if (!room) return 'Chargement...';
    
    if (room.type === 'DIRECT' || (room.name && room.name.startsWith('dm_'))) {
      if (room.members && room.members.length > 0) {
        const otherMember = room.members.find(m => m.userId !== myId);
        if (otherMember?.user?.username) {
          return `💬 ${otherMember.user.username}`;
        }
      }
      return '💬 Message Privé';
    }
    
    if (room.name) {
      if (room.name.startsWith('ai-chat-')) return '🤖 Assistant IA';
      return `# ${room.name}`;
    }

    return 'Salon inconnu';
  };

  const handleUserClick = (username?: string) => {
    if (username) navigate(`/${username}`);
  };

  const fetchRooms = async () => {
    try {
      const response = await api.get<Room[]>('/chat/channels');
      setRooms(response.data);
      
      // 🔄 MODIFIÉ : On cherche l'ID passé en URL depuis le profil
      const roomFromUrl = searchParams.get('roomId');
      
      if (roomFromUrl) {
        setActiveRoom(Number(roomFromUrl));
      } else if (!activeRoom && response.data.length > 0) {
        setActiveRoom(response.data[0].id);
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des salons :", error);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [searchParams]); // On rajoute searchParams dans les dépendances pour rafraîchir si l'URL change

  useEffect(() => {
    if (!isConnected || !socket) return;

    const handleRoomsUpdated = () => fetchRooms();
    const handleHistory = (historyMessages: Message[]) => {
      if (Array.isArray(historyMessages)) setMessages(historyMessages);
    };
    const handleReceiveMessage = (incomingMessage: Message) => {
      setMessages((prev) => {
        if (incomingMessage.id && prev.some((m) => m.id === incomingMessage.id)) return prev;
        return [...prev, incomingMessage];
      });
    };
    const handleError = (err: string) => {
      console.error("Erreur Socket :", err);
    };

    socket.on('rooms_updated', handleRoomsUpdated);
    socket.on('load_history', handleHistory);
    socket.on('receive_message', handleReceiveMessage);
    socket.on('error', handleError);

    if (activeRoom !== null) {
      socket.emit('joinChannel', { channelId: activeRoom });
    }

    return () => {
      socket.off('rooms_updated', handleRoomsUpdated);
      socket.off('load_history', handleHistory);
      socket.off('receive_message', handleReceiveMessage);
      socket.off('error', handleError);
    };
  }, [socket, activeRoom, isConnected]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInput.trim() || !isConnected || isSending || !socket || activeRoom === null) return;

    setIsSending(true);
    
    socket.emit('send_message', {
      channelId: activeRoom,
      content: currentInput.trim(),
    });

    setCurrentInput('');
    setTimeout(() => setIsSending(false), 100);
  };

  const getSenderName = (msg: Message) => {
    return (
      msg.sender?.username || 
      msg.senderName ||
      (msg.senderId ? `Utilisateur #${msg.senderId}` : 'Utilisateur')
    );
  };

  const isMe = (msg: Message) => {
    const msgSenderId = msg.senderId || msg.sender?.id;
    return msgSenderId === myId;
  };

  const getFormattedTime = (msg: Message) => {
    const rawDate = msg.timestamp || msg.createdAt || msg.created_at;
    if (!rawDate) return '';
    const dateObj = new Date(rawDate);
    return !isNaN(dateObj.getTime())
      ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
  };

  const activeRoomObj = rooms.find(r => r.id === activeRoom);

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-white border-r flex flex-col h-screen">
        <div className="relative p-4">
          <button 
              onClick={() => navigate('/')}
              className="absolute top-4 left-4 text-slate-400 hover:text-black transition-colors focus:outline-none"
              aria-label="Back"
            >
              ← Retour
          </button>
        </div>
        <h2 className="p-4 font-bold text-lg border-b flex justify-between items-center mt-6">
          <span>Salons</span>
        </h2>

        <div className="p-2 border-b text-xs flex items-center justify-center bg-gray-50">
          {isConnected ? (
            <span className="text-green-600 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span> Connecté
            </span>
          ) : (
            <span className="text-red-500 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block animate-pulse"></span> Déconnecté
            </span>
          )}
        </div>

        <ul className="flex-1 overflow-y-auto">
          {rooms.map((room) => (
            <li
              key={room.id}
              className={`p-4 cursor-pointer transition ${
                activeRoom === room.id
                  ? 'bg-blue-50 border-l-4 border-blue-500 font-semibold text-blue-700'
                  : 'hover:bg-gray-50 text-gray-700'
              }`}
              onClick={() => setActiveRoom(room.id)}
            >
              {formatRoomName(room)}
            </li>
          ))}
          {rooms.length === 0 && (
            <div className="p-4 text-sm text-gray-400 text-center">Aucun salon disponible</div>
          )}
        </ul>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        {authError && (
          <div className="bg-red-100 text-red-700 p-2 text-center text-sm font-semibold border-b border-red-200">
            {authError}
          </div>
        )}

        <div className="p-3 bg-white border-b text-gray-700 font-semibold shadow-sm flex items-center justify-between">
          <span>{formatRoomName(activeRoomObj)}</span>
        </div>

        <div className="flex-1 p-4 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
              Aucun message dans ce salon.
            </div>
          ) : (
            messages.map((msg, index) => {
              const senderName = getSenderName(msg);
              const formattedTime = getFormattedTime(msg);
              const clickableUsername = msg.sender?.username || msg.senderName;

              return (
                <div
                  key={msg.id ? `msg-${msg.id}` : `idx-${index}`}
                  className={`mb-4 flex flex-col w-full ${isMe(msg) ? 'items-end' : 'items-start'}`}
                >
                  <div className={`flex items-center gap-2 mb-1 ${isMe(msg) ? 'flex-row-reverse' : ''}`}>
                    <MessageAvatar msg={msg} onClick={handleUserClick} />
                    
                    <span 
                      onClick={() => handleUserClick(clickableUsername)}
                      className="font-bold text-xs text-gray-700 cursor-pointer hover:underline"
                    >
                      {senderName}
                    </span>
                    {formattedTime && <span className="text-[10px] text-gray-400">{formattedTime}</span>}
                  </div>

                  <p
                    className={`p-3 rounded-2xl text-sm shadow-sm border max-w-xl break-words ${
                      isMe(msg)
                        ? 'bg-blue-600 text-white rounded-tr-none border-blue-600'
                        : 'bg-white text-gray-800 rounded-tl-none border-gray-200'
                    }`}
                  >
                    {msg.content}
                  </p>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-white border-t">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              disabled={!isConnected}
              placeholder={isConnected ? `Envoyer un message...` : "Connexion en cours..."}
              className="flex-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 text-sm"
            />
            <button
              type="submit"
              disabled={!isConnected || !currentInput.trim() || isSending}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50 text-sm font-medium"
            >
              Envoyer
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};
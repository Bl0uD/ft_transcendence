import React, { useEffect, useState, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';

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

export const ChatView: React.FC = () => {
  const { socket, isConnected, authError } = useSocket();

  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [activeRoom, setActiveRoom] = useState('general');
  
  // Anti-double-clic / Anti-double-submit
  const [isSending, setIsSending] = useState(false);

  // 1. Référence pour l'auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 2. Scroll automatique vers le bas à chaque nouveau message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isConnected || !socket) return;

    const handleHistory = (historyMessages: Message[]) => {
      if (!Array.isArray(historyMessages)) return;
      setMessages(historyMessages);
    };

    const handleReceiveMessage = (incomingMessage: Message) => {
      setMessages((prev) => {
        // 1. Vérification standard par ID
        if (incomingMessage.id && prev.some((m) => m.id === incomingMessage.id)) {
          return prev;
        }

        // 2. FILTRE DE SECOURS (Si le backend génère 2 IDs différents à la même milliseconde)
        const incomingTime = incomingMessage.createdAt || incomingMessage.timestamp || incomingMessage.created_at;
        const isDbDuplicate = prev.some((m) => {
          const mTime = m.createdAt || m.timestamp || m.created_at;
          const sameSender = m.senderId === incomingMessage.senderId || m.senderName === incomingMessage.senderName;
          
          return m.content === incomingMessage.content && sameSender && mTime === incomingTime;
        });

        if (isDbDuplicate) {
          console.warn('⚠️ Doublon backend détecté et bloqué sur le client:', incomingMessage);
          return prev;
        }

        return [...prev, incomingMessage];
      });
    };

    socket.on('load_history', handleHistory);
    socket.on('receive_message', handleReceiveMessage);

    if (activeRoom) {
      socket.emit('joinChannel', { roomId: activeRoom });
    }

    return () => {
      socket.off('load_history', handleHistory);
      socket.off('receive_message', handleReceiveMessage);
      if (activeRoom) {
        socket.emit('leave_room', { roomId: activeRoom });
      }
    };
  }, [socket, activeRoom, isConnected]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Empêche l'envoi si le champ est vide, déconnecté, OU déjà en cours d'envoi
    if (!currentInput.trim() || !isConnected || isSending) return;

    setIsSending(true);

    socket.emit('send_message', {
      roomId: activeRoom,
      content: currentInput.trim(),
    });

    setCurrentInput('');

    // Déverrouille l'envoi après un très court délai (100ms)
    setTimeout(() => {
      setIsSending(false);
    }, 100);
  };

  const getSenderName = (msg: Message) => {
    return (
      msg.senderName ||
      msg.sender?.username ||
      (msg.senderId ? `Utilisateur #${msg.senderId}` : 'Utilisateur')
    );
  };

  const getFormattedTime = (msg: Message) => {
    const rawDate = msg.timestamp || msg.createdAt || msg.created_at;
    if (!rawDate) return '';

    const dateObj = new Date(rawDate);
    return !isNaN(dateObj.getTime())
      ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-white border-r flex flex-col">
        <h2 className="p-4 font-bold text-lg border-b">Salons</h2>

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
          <li
            className={`p-4 cursor-pointer transition ${
              activeRoom === 'general'
                ? 'bg-blue-50 border-l-4 border-blue-500 font-semibold text-blue-700'
                : 'hover:bg-gray-50 text-gray-700'
            }`}
            onClick={() => setActiveRoom('general')}
          >
            # Général
          </li>
        </ul>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        {authError && (
          <div className="bg-red-100 text-red-700 p-2 text-center text-sm font-semibold border-b border-red-200">
            {authError}
          </div>
        )}

        <div className="flex-1 p-4 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
              Aucun message pour le moment.
            </div>
          ) : (
            messages.map((msg, index) => {
              const senderName = getSenderName(msg);
              const formattedTime = getFormattedTime(msg);

              return (
                <div key={msg.id ? `msg-${msg.id}` : `idx-${index}`} className="mb-4 flex flex-col items-start">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-bold text-sm text-gray-800">{senderName}</span>
                    {formattedTime && (
                      <span className="text-xs text-gray-400">{formattedTime}</span>
                    )}
                  </div>
                  <p className="bg-white p-3 rounded-lg shadow-sm border text-gray-700 max-w-xl break-words">
                    {msg.content}
                  </p>
                </div>
              );
            })
          )}

          {/* 3. Ancre invisible pour forcer le scroll en bas */}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-white border-t">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              disabled={!isConnected}
              placeholder={isConnected ? "Écrire un message..." : "Connexion en cours..."}
              className="flex-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
            <button
              type="submit"
              disabled={!isConnected || !currentInput.trim() || isSending}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Envoyer
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};
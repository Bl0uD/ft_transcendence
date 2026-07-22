import React, { useEffect, useState } from 'react';
import { useSocket } from '../../hooks/useSocket';

interface Message {
  id: number;
  senderId: number;
  senderName: string;
  content: string;
  timestamp: string;
}

export const ChatView: React.FC = () => {
  // Appel de notre hook personnalisé
  const { socket, isConnected, authError } = useSocket();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [activeRoom, setActiveRoom] = useState('general');

  // Gestion des salons et des messages
  useEffect(() => {
    // On ne rejoint la room que si le socket est bien connecté
    if (!isConnected) return;

    socket.emit('join_room', { room: activeRoom });

    const handleReceiveMessage = (incomingMessage: Message) => {
      setMessages((prev) => [...prev, incomingMessage]);
    };

    socket.on('receive_message', handleReceiveMessage);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.emit('leave_room', { room: activeRoom });
    };
  }, [socket, activeRoom, isConnected]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInput.trim() || !isConnected) return;

    socket.emit('send_message', {
      room: activeRoom,
      content: currentInput.trim(),
    });

    setCurrentInput('');
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar de navigation */}
      <aside className="w-64 bg-white border-r flex flex-col">
        <h2 className="p-4 font-bold text-lg border-b">Salons</h2>
        
        {/* Indicateur d'état issu du hook */}
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
            className={`p-4 cursor-pointer transition ${activeRoom === 'general' ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50'}`}
            onClick={() => setActiveRoom('general')}
          >
            # Général
          </li>
          {/* Ajoutez d'autres salons dynamiquement ici */}
        </ul>
      </aside>

      {/* Zone Principale du Chat */}
      <main className="flex-1 flex flex-col relative">
        
        {/* Bannière d'erreur issue du hook */}
        {authError && (
          <div className="absolute top-0 left-0 right-0 bg-red-100 text-red-700 p-2 text-center text-sm font-semibold z-10 shadow-sm">
            {authError}
          </div>
        )}

        <div className="flex-1 p-4 overflow-y-auto mt-8">
          {messages.map((msg, index) => (
            <div key={msg.id || index} className="mb-4">
              <span className="font-bold mr-2 text-gray-800">{msg.senderName}</span>
              <span className="text-xs text-gray-400">{new Date(msg.timestamp).toLocaleTimeString()}</span>
              <p className="mt-1 bg-white p-3 rounded-lg shadow-sm border inline-block text-gray-700">
                {msg.content}
              </p>
            </div>
          ))}
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
              disabled={!isConnected || !currentInput.trim()}
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
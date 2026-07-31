import React, { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { streamAIChat } from '../api/aiApi';
import { useAuthStore } from '../store/authStore';

interface Message {
  role: 'user' | 'ai';
  content: string;
}

export const AiChatView: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const user = useAuthStore((state) => state.user);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll instantané ('auto') pour supprimer les saccades pendant le streaming
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages, isLoading]);

  // Chargement de l'historique
  useEffect(() => {
    if (!user) return;
    api.get(`/chat/channels/ai-chat-${user.id}/messages`)
      .then((res) => setMessages(res.data))
      .catch((err) => console.error('Erreur historique IA', err));
  }, [user]);

  // Compteur Cooldown anti-spam
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || cooldown > 0) return;

    const userText = input;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userText }]);
    setIsLoading(true);

    try {
      setMessages((prev) => [...prev, { role: 'ai', content: '' }]);

      await streamAIChat(
        userText,
        (chunk) => {
          setIsLoading(false);
          // Mise à jour 100% immuable pour éviter de muter l'état existant
          setMessages((prev) => {
            if (prev.length === 0) return prev;
            const lastIndex = prev.length - 1;
            return prev.map((msg, idx) =>
              idx === lastIndex ? { ...msg, content: msg.content + chunk } : msg
            );
          });
        },
        () => {
          setCooldown(60);
        }
      );
    } catch (error) {
      console.error("Le stream a été interrompu :", error);
      setIsLoading(false);

      // Nettoyage si le message IA est resté vide lors d'une erreur
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.role === 'ai' && !lastMsg.content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Assistant IA</h1>

      <div className="flex-1 overflow-y-auto space-y-4 p-4 border rounded-lg bg-gray-900">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-3 rounded-lg max-w-[80%] whitespace-pre-wrap ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-100'}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && <div className="text-gray-400 italic">L'IA réfléchit...</div>}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="mt-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading || cooldown > 0}
          className="flex-1 p-2 border rounded bg-gray-800 text-white disabled:opacity-50"
          placeholder={cooldown > 0 ? `Rate limit atteint (${cooldown}s)...` : "Posez votre question..."}
        />
        <button type="submit" disabled={isLoading || cooldown > 0} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
          Envoyer
        </button>
      </form>
    </div>
  );
};
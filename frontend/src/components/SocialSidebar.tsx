import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useSocialStore } from '../store/socialStore';
import { useChatStore } from '../store/chatStore'; 
import { useSocket } from '../hooks/useSocket'; // 👈 Import du hook socket
import api from '../api/axios'; 

const getDisplayName = (account?: { username?: string; nickname?: string | null } | null) => {
  if (!account || !account.username) return 'Visiteur';
  return account.nickname && account.nickname.trim() !== '' ? account.nickname : account.username;
};

export default function SocialSidebar() {
  const navigate = useNavigate();
  const user = useAuthStore((state: any) => state.user);
  const { setIsChatOpen, setActiveRoom } = useChatStore(); 
  const { socket } = useSocket('/'); // 👈 Connexion au socket principal
  
  const [activeTab, setActiveTab] = useState<'friends' | 'pending' | 'blocked'>('friends');
  const [targetUsername, setTargetUsername] = useState('');

  const { 
    friends, pendingRequests, blockedUsers, friendsStatus,
    sendRequest, acceptRequest, unblockUser, initSocketListeners 
  } = useSocialStore();

  // 🟢 Initialisation des écouteurs de statut (pastilles vertes/grises) au montage
  useEffect(() => {
    if (socket) {
      initSocketListeners(socket);
    }
  }, [socket, initSocketListeners]);

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUsername.trim()) return;
    try {
      await sendRequest(targetUsername.trim());
      setTargetUsername('');
    } catch(e) {}
  };

  const handleSendMessage = async (targetUserId: number) => {
    try {
      const response = await api.post('/chat/channels/dm', { targetUserId });
      const channelId = response.data.id || response.data.channel?.id;
      if (channelId) {
        setActiveRoom(Number(channelId));
        setIsChatOpen(true);
      }
    } catch (err: any) {
      console.error("Erreur ouverture DM", err);
    }
  };

  if (!user) return null;

  return (
    <aside className="hidden lg:flex w-80 bg-slate-800 border-r border-slate-700 flex-col h-full z-10">
      <div className="p-5 border-b border-slate-700 sticky top-0">
        <h2 className="text-lg font-bold mb-4">👥 Social</h2>
        <form onSubmit={handleAddFriend} className="flex gap-2">
          <input type="text" placeholder="Ajouter un ami (username)..." value={targetUsername} onChange={(e) => setTargetUsername(e.target.value)} className="p-2 border border-slate-600 rounded bg-slate-900 flex-1 text-sm focus:outline-none" />
          <button type="submit" className="bg-blue-600 px-3 text-sm rounded hover:bg-blue-500">Ajouter</button>
        </form>
      </div>
      
      <div className="flex border-b border-slate-700 text-sm">
        <button onClick={() => setActiveTab('friends')} className={`flex-1 py-3 ${activeTab === 'friends' ? 'text-blue-400 border-b-2 border-blue-500' : 'text-slate-400'}`}>Amis</button>
        <button onClick={() => setActiveTab('pending')} className={`flex-1 py-3 ${activeTab === 'pending' ? 'text-blue-400 border-b-2 border-blue-500' : 'text-slate-400'}`}>Demandes <span className={pendingRequests.length > 0 ? "text-red-400 font-bold" : ""}>{pendingRequests.length > 0 && `(${pendingRequests.length})`}</span></button>
        <button onClick={() => setActiveTab('blocked')} className={`flex-1 py-3 ${activeTab === 'blocked' ? 'text-blue-400 border-b-2 border-blue-500' : 'text-slate-400'}`}>Bloqués</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
        {activeTab === 'friends' && friends.map(f => (
          <div key={f.id} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg border border-slate-700 hover:bg-slate-800 transition-colors">
            <div className="flex items-center gap-2">
              {/* 🟢 Pastille d'état connectée au store (Vert = Online, Gris = Offline) */}
              <div className={`w-2 h-2 rounded-full ${friendsStatus[f.id] === 'ONLINE' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-slate-500'}`} />
              <span className="cursor-pointer hover:underline font-medium" onClick={() => navigate(`/${f.username}`)}>{getDisplayName(f)}</span>
            </div>
            
            <button 
              onClick={() => handleSendMessage(f.id)} 
              className="text-xs text-indigo-300 hover:text-white bg-indigo-600/30 hover:bg-indigo-600 px-2 py-1 rounded transition-colors"
            >
              💬 Message
            </button>
          </div>
        ))}
        
        {activeTab === 'pending' && pendingRequests.map(r => (
          <div key={r.id} className="p-3 bg-slate-900/50 rounded-lg border border-slate-700 text-sm">
            <span className="font-semibold cursor-pointer text-indigo-300" onClick={() => navigate(`/${r.requester.username}`)}>{getDisplayName(r.requester)}</span> vous a ajouté.
            <button onClick={() => acceptRequest(r.id)} className="w-full mt-3 py-1.5 bg-emerald-600/90 hover:bg-emerald-500 rounded font-medium transition-colors">Accepter</button>
          </div>
        ))}
        
        {activeTab === 'blocked' && blockedUsers.map(u => (
          <div key={u.id} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg border border-slate-700">
            <span className="line-through text-slate-500">{getDisplayName(u)}</span>
            <button onClick={() => unblockUser(u.id)} className="text-xs text-slate-300 hover:text-white bg-slate-800 px-2 py-1 rounded">Débloquer</button>
          </div>
        ))}
      </div>
    </aside>
  );
}
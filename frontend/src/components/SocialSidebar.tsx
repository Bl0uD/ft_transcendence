import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useSocialStore } from '../store/socialStore';
import { useChatStore } from '../store/chatStore'; 
import { useSocket } from '../hooks/useSocket';
import { SocialIcon, SidebarIcon, ChatIcon } from './HeaderIcons';
import api from '../api/axios'; 

const getDisplayName = (account?: { username?: string; nickname?: string | null } | null) => {
  if (!account || !account.username) return 'Visiteur';
  return account.nickname && account.nickname.trim() !== '' ? account.nickname : account.username;
};

export default function SocialSidebar() {
  const navigate = useNavigate();
  const user = useAuthStore((state: any) => state.user);
  const { setIsChatOpen, setActiveRoom } = useChatStore(); 
  const { socket } = useSocket('/'); 
  
  const [activeTab, setActiveTab] = useState<'friends' | 'pending' | 'blocked'>('friends');
  const [targetUsername, setTargetUsername] = useState('');

  const { 
    friends, pendingRequests, blockedUsers, friendsStatus,
    isSocialDrawerOpen, setIsSocialDrawerOpen,
    isDesktopSidebarOpen, setIsDesktopSidebarOpen,
    sendRequest, acceptRequest, unblockUser, initSocketListeners 
  } = useSocialStore();
  const [suggestions, setSuggestions] = useState<any[]>([]);

  // Initialisation des écouteurs de statut (pastilles vertes/grises) au montage
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

  const FindSuggestions = async (value: string) => {
    const query = value.trim();   
    if (!query) {
      setSuggestions([]);
      return;
    }
    try {
      const response = await api.get(`/users/search/${query}`);
      const users = Array.isArray(response.data) ? response.data : [];
      setSuggestions(users);
      
    } catch (err) {
      console.error("Erreur lors de la recherche des utilisateurs :", err);
      setSuggestions([]);
    }
};

  const handleSendMessage = async (targetUserId: number) => {
    try {
      const response = await api.post('/chat/channels/dm', { targetUserId });
      const channelId = response.data.id || response.data.channel?.id;
      if (channelId) {
        setActiveRoom(Number(channelId));
        setIsChatOpen(true);
        setIsSocialDrawerOpen(false);
      }
    } catch (err: any) {
      console.error("Erreur ouverture DM", err);
    }
  };

  if (!user) return null;

  const sidebarContent = (
    <div className="flex flex-col h-full w-full">
      {/* EN-TÊTE : Titre + Bouton fermer + Formulaire ajout */}
      <div className="p-4 sm:p-5 border-b border-border bg-surface-hover z-10 shrink-0 pt-[max(1rem,env(safe-area-inset-top))] sm:pt-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <SocialIcon className="w-5 h-5 text-primary shrink-0" />
            <span>Social</span>
          </h2>
          <div className="flex items-center gap-1">
            {/* BOUTON FERMER SUR MOBILE */}
            <button 
              type="button"
              onClick={() => setIsSocialDrawerOpen(false)}
              className="lg:hidden p-1.5 text-text-muted hover:text-text-main rounded-lg hover:bg-surface text-lg leading-none transition-colors"
              title="Fermer"
            >
              ✕
            </button>

            {/* BOUTON MASQUER SUR ORDINATEUR */}
            <button
              type="button"
              onClick={() => setIsDesktopSidebarOpen(false)}
              className="hidden lg:flex p-1.5 text-text-muted hover:text-text-main rounded-lg hover:bg-surface transition-colors items-center justify-center"
              title="Masquer la barre latérale"
            >
              <SidebarIcon className="w-4 h-4 rotate-180" />
            </button>
          </div>
        </div>
        <form onSubmit={handleAddFriend} className="flex gap-2 relative">
          <input 
            type="text" 
            placeholder="Ajouter un ami..." 
            value={targetUsername} 
            onChange={(e) => {
              setTargetUsername(e.target.value);
              FindSuggestions(e.target.value);
            }}
            className="p-2 border border-border-subtle rounded-lg bg-surface flex-1 text-sm focus:outline-none focus:border-primary text-text-main" 
          />
          <button 
            type="submit" 
            className="bg-primary text-primary-content px-3.5 text-sm rounded-lg hover:bg-primary-hover font-semibold transition-colors shrink-0"
          >
            Ajouter
          </button>
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-[5.5rem] mt-1 z-20 rounded-lg border border-border bg-surface shadow-lg overflow-hidden">
              {suggestions.map(suggestion => (
                <button
                  key={suggestion.id}
                  type="button"
                  onClick={() => {
                    setTargetUsername(suggestion.username);
                    setSuggestions([]);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-text-main hover:bg-surface-hover"
                >
                  {getDisplayName(suggestion)}
                </button>
              ))}
            </div>
          )}
        </form>
      </div>
      
      {/* ONGLETS : Amis / Demandes / Bloqués */}
      <div className="p-2.5 border-b border-border bg-surface/40 shrink-0">
        <div className="flex bg-surface-hover/80 p-1 rounded-xl border border-border gap-1">
          <button 
            type="button"
            onClick={() => setActiveTab('friends')} 
            className={`flex-1 py-2 px-2 text-center rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'friends' 
                ? 'bg-primary text-primary-content shadow-sm' 
                : 'text-text-muted hover:text-text-main hover:bg-surface/50'
            }`}
          >
            Amis
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('pending')} 
            className={`flex-1 py-2 px-2 text-center rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1 ${
              activeTab === 'pending' 
                ? 'bg-primary text-primary-content shadow-sm' 
                : 'text-text-muted hover:text-text-main hover:bg-surface/50'
            }`}
          >
            <span>Demandes</span>
            {pendingRequests.length > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full leading-tight ${
                activeTab === 'pending' ? 'bg-primary-content text-primary' : 'bg-red-500 text-white'
              }`}>
                {pendingRequests.length}
              </span>
            )}
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('blocked')} 
            className={`flex-1 py-2 px-2 text-center rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'blocked' 
                ? 'bg-primary text-primary-content shadow-sm' 
                : 'text-text-muted hover:text-text-main hover:bg-surface/50'
            }`}
          >
            Bloqués
          </button>
        </div>
      </div>

      {/* CONTENU DE LA LISTE */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
        {activeTab === 'friends' && (
          friends.length === 0 ? (
            <p className="text-center text-text-muted text-sm py-6">Aucun ami pour le moment</p>
          ) : (
            friends.map(f => (
              <div key={f.id} className="flex justify-between items-center p-3 bg-surface/50 rounded-xl border border-border hover:bg-surface-hover transition-colors">
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <div className={`w-2.5 h-2.5 shrink-0 rounded-full ${friendsStatus[f.id] === 'ONLINE' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-text-muted'}`} />
                  <span 
                    className="cursor-pointer hover:underline font-medium text-sm truncate text-text-main" 
                    onClick={() => { setIsSocialDrawerOpen(false); navigate(`/${f.username}`); }}
                  >
                    {getDisplayName(f)}
                  </span>
                </div>
                
                <button 
                  onClick={() => handleSendMessage(f.id)} 
                  className="flex items-center gap-1.5 justify-center text-xs font-semibold text-primary-content bg-primary hover:bg-primary-hover px-2.5 py-1.5 rounded-lg transition-colors shrink-0 shadow-sm"
                >
                  <ChatIcon className="w-3.5 h-3.5" /> Message
                </button>
              </div>
            ))
          )
        )}
        
        {activeTab === 'pending' && (
          pendingRequests.length === 0 ? (
            <p className="text-center text-text-muted text-sm py-6">Aucune demande en attente</p>
          ) : (
            pendingRequests.map(r => (
              <div key={r.id} className="p-3 bg-surface/50 rounded-xl border border-border text-sm">
                <span 
                  className="font-semibold cursor-pointer text-primary hover:underline" 
                  onClick={() => { setIsSocialDrawerOpen(false); navigate(`/${r.requester.username}`); }}
                >
                  {getDisplayName(r.requester)}
                </span> vous a ajouté.
                <button 
                  onClick={() => acceptRequest(r.id)} 
                  className="w-full mt-3 py-1.5 bg-primary text-primary-content hover:bg-primary-hover rounded-lg font-semibold transition-colors text-xs sm:text-sm"
                >
                  Accepter
                </button>
              </div>
            ))
          )
        )}
        
        {activeTab === 'blocked' && (
          blockedUsers.length === 0 ? (
            <p className="text-center text-text-muted text-sm py-6">Aucun utilisateur bloqué</p>
          ) : (
            blockedUsers.map(u => (
              <div key={u.id} className="flex justify-between items-center p-3 bg-surface/50 rounded-xl border border-border">
                <span className="line-through text-text-muted text-sm truncate max-w-[140px]">{getDisplayName(u)}</span>
                <button 
                  onClick={() => unblockUser(u.id)} 
                  className="text-xs text-text-muted hover:text-text-main bg-surface hover:bg-surface-hover border border-border px-2.5 py-1 rounded-lg transition-colors shrink-0 font-medium"
                >
                  Débloquer
                </button>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* BOUTON CARRÉ FIXE SUR LE CÔTÉ GAUCHE POUR OUVRIR SUR ORDINATEUR QUAND MASQUÉ */}
      {!isDesktopSidebarOpen && (
        <button
          type="button"
          onClick={() => setIsDesktopSidebarOpen(true)}
          className="hidden lg:flex fixed left-3 top-20 z-30 w-10 h-10 bg-surface-hover hover:bg-surface border border-border rounded-xl shadow-md text-text-muted hover:text-text-main hover:border-primary/50 transition-all hover:scale-105 items-center justify-center cursor-pointer"
          title="Afficher la barre latérale"
        >
          <SidebarIcon className="w-5 h-5" />
          {pendingRequests.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
              {pendingRequests.length}
            </span>
          )}
        </button>
      )}

      {/* DESKTOP SIDEBAR */}
      {isDesktopSidebarOpen && (
        <aside className="hidden lg:flex w-80 bg-surface-hover border-r border-border flex-col h-full z-10 shrink-0 animate-in slide-in-from-left duration-200">
          {sidebarContent}
        </aside>
      )}

      {/* MOBILE / TABLET OVERLAY DRAWER */}
      {isSocialDrawerOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden flex">
          <div 
            className="fixed inset-0 bg-bg/70 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setIsSocialDrawerOpen(false)}
          />
          <aside className="relative w-80 max-w-[85vw] bg-surface-hover border-r border-border flex flex-col h-[100dvh] max-h-[100dvh] z-10 shadow-2xl animate-in slide-in-from-left duration-200 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
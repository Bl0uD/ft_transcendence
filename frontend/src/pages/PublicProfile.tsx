import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import { useSocket } from '../hooks/useSocket';
import UserAvatar from '../components/UserAvatar';
import TwoFactorSetup from '../components/TwoFactorSetup';

interface User { id: number; username: string; nickname?: string | null; avatar?: string | null; }
interface Comment { id: number; content: string; createdAt: string; user: User; }
interface Post {
  id: number; content: string; imageUrl: string | null; isPublic: boolean; createdAt: string;
  author: User; likes: { id: number }[]; comments: Comment[];
  _count: { likes: number; comments: number; };
}

// --- INTERFACES CHAT ---
interface Message {
  id?: number | string; senderId?: number; senderName?: string; content: string;
  timestamp?: string; createdAt?: string; created_at?: string;
  sender?: { id: number; username: string; nickname?: string | null; avatar?: string; };
}
interface RoomMember { userId: number; user: User; }
interface Room { id: number; name: string | null; type?: string; members?: RoomMember[]; }

const getDisplayName = (account?: { username?: string; nickname?: string | null } | null) => {
  if (!account || !account.username) return 'Utilisateur';
  return account.nickname && account.nickname.trim() !== '' ? account.nickname : account.username;
};

export default function PublicProfile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const currentUser = useAuthStore((state: any) => state.user);
  const updateUser = useAuthStore((state: any) => state.updateUser);
  const { socket, isConnected } = useSocket();
  
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [posts, setPosts] = useState<Post[]>([]);
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});
  const [openComments, setOpenComments] = useState<Record<number, boolean>>({});

  const isMyProfile = currentUser?.username === username;

  // --- ÉTATS CHAT FLOTTANT ---
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingUsername, setSettingUsername] = useState('');
  const [settingNickname, setSettingNickname] = useState('');
  const [settingEmail, setSettingEmail] = useState('');
  const [settingPassword, setSettingPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [settingStatus, setSettingStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error', message: string }>({ type: 'idle', message: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentUser) {
      setSettingUsername(currentUser.username || '');
      setSettingNickname(currentUser.nickname || '');
      setSettingEmail(currentUser.email || '');
      setPreviewUrl(currentUser.avatar || '');
    }
  }, [currentUser]);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl !== currentUser?.avatar && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, currentUser?.avatar]);

  // --- CHARGEMENT PROFIL & URL PARAMS (roomId) ---
  useEffect(() => {
    setLoading(true);
    setError('');
    
    api.get(`/users/public/${username}`)
      .then(async (res) => {
        setProfileData(res.data);
        try {
          const postsRes = await api.get(`/posts/user/${res.data.id}`);
          setPosts(postsRes.data);
        } catch (err) {
          console.error("Erreur chargement posts", err);
        }
      })
      .catch(() => {
        setError("Cet utilisateur n'existe pas.");
      })
      .finally(() => {
        setLoading(false);
      });

    const roomId = searchParams.get('roomId');
    if (roomId && currentUser) {
      setIsChatOpen(true);
      setActiveRoom(Number(roomId));
    }
  }, [username, searchParams, currentUser]);

  // --- LOGIQUE CHAT SOCKET ---
  const fetchRooms = async () => {
    try {
      const response = await api.get<Room[]>('/chat/channels');
      setRooms(response.data);
    } catch (err) { console.error("Erreur salons:", err); }
  };

  useEffect(() => {
    if (!isConnected || !socket || !currentUser) return;
    fetchRooms();

    const handleHistory = (hist: Message[]) => { if (Array.isArray(hist)) setMessages(hist); };
    const handleReceiveMessage = (msg: Message) => {
      setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
    };

    socket.on('rooms_updated', fetchRooms);
    socket.on('load_history', handleHistory);
    socket.on('receive_message', handleReceiveMessage);

    if (activeRoom !== null) {
      socket.emit('joinChannel', { channelId: activeRoom });
    }

    return () => {
      socket.off('rooms_updated', fetchRooms);
      socket.off('load_history', handleHistory);
      socket.off('receive_message', handleReceiveMessage);
    };
  }, [socket, activeRoom, isConnected, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatOpen]);

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !isConnected || !socket || activeRoom === null) return;
    socket.emit('send_message', { channelId: activeRoom, content: chatInput.trim() });
    setChatInput('');
  };

  const getRoomDisplayInfo = (room?: Room) => {
    if (!room) return { name: 'Chargement...', icon: '⏳', targetUser: null };
    
    if (room.type === 'DIRECT' || room.name?.startsWith('dm_')) {
      const otherMember = room.members?.find(m => m.userId !== currentUser?.id);
      if (otherMember?.user) {
        return {
          name: getDisplayName(otherMember.user),
          icon: '💬',
          targetUser: otherMember.user
        };
      }
      return { name: 'Message Privé', icon: '💬', targetUser: null };
    }
    
    if (room.name?.startsWith('ai-chat-')) return { name: 'Assistant IA', icon: '🤖', targetUser: null };
    
    return { name: room.name ? `# ${room.name}` : 'Salon inconnu', icon: '👥', targetUser: null };
  };

  // 🟢 FIX : Ouvre directement la bulle de chat sur la page actuelle au lieu de rediriger
  const handleSendMessage = async () => {
    if (!profileData?.id) return alert("ID utilisateur introuvable.");
    try {
      const response = await api.post('/chat/dms', { targetUserId: profileData.id });
      const channelId = response.data.id || response.data.channel?.id;
      if (!channelId) return alert("ID du salon introuvable.");
      
      setIsChatOpen(true);
      setActiveRoom(Number(channelId));
    } catch (err: any) {
      alert(`Erreur : ${err.response?.data?.message || err.message}`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) return setSettingStatus({ type: 'error', message: 'Fichier trop lourd (Max: 2MB).' });
      if (!file.type.startsWith('image/')) return setSettingStatus({ type: 'error', message: 'Image invalide.' });
      setAvatarFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setSettingStatus({ type: 'idle', message: '' });
    }
  };

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingStatus({ type: 'loading', message: 'Mise à jour en cours...' });
    try {
      const formData = new FormData();
      formData.append('username', settingUsername);
      if (settingNickname) formData.append('nickname', settingNickname);
      if (settingEmail) formData.append('email', settingEmail);
      if (settingPassword) formData.append('password', settingPassword);
      if (avatarFile) formData.append('avatar', avatarFile);

      const response = await api.put('/users/profile', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      
      setSettingStatus({ type: 'success', message: 'Profil mis à jour avec succès !' });
      updateUser(response.data);
      setProfileData((prev: any) => ({ ...prev, ...response.data }));
      setAvatarFile(null);
      setSettingPassword('');
      
      setTimeout(() => {
        setShowSettingsModal(false);
        setSettingStatus({ type: 'idle', message: '' });
        if (settingUsername !== username) navigate(`/${settingUsername}`, { replace: true });
      }, 1500);

    } catch (error: any) {
      setSettingStatus({ type: 'error', message: error.response?.data?.message || 'Erreur lors de la mise à jour.' });
    }
  };

  const toggleLike = async (postId: number) => {
    try {
      const res = await api.post(`/posts/${postId}/like`);
      const isLiked = res.data.liked;
      setPosts(posts.map(post => post.id === postId ? {
        ...post, likes: isLiked ? [{ id: currentUser.id }] : [], _count: { ...post._count, likes: isLiked ? post._count.likes + 1 : post._count.likes - 1 }
      } : post));
    } catch (err) {}
  };

  const submitComment = async (e: React.FormEvent, postId: number) => {
    e.preventDefault();
    const content = commentInputs[postId];
    if (!content?.trim()) return;
    try {
      const res = await api.post(`/posts/${postId}/comment`, { content });
      setPosts(posts.map(post => post.id === postId ? { ...post, comments: [...post.comments, res.data], _count: { ...post._count, comments: post._count.comments + 1 } } : post));
      setCommentInputs({ ...commentInputs, [postId]: '' });
    } catch (err) {}
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Chargement...</div>;
  if (error) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-red-500 font-semibold">{error}</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white relative">

      {/* ================= MODALE PARAMÈTRES ================= */}
      {showSettingsModal && isMyProfile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 p-8 rounded-3xl shadow-2xl">
            <button onClick={() => setShowSettingsModal(false)} className="absolute top-4 right-5 text-slate-400 hover:text-white transition-colors text-xl">✕</button>
            
            <h2 className="text-2xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Paramètres du Profil</h2>

            {settingStatus.message && (
              <div className={`p-3 mb-4 rounded-xl text-sm border ${settingStatus.type === 'error' ? 'bg-red-900/20 text-red-400 border-red-500/30' : 'bg-emerald-900/20 text-emerald-400 border-emerald-500/30'}`}>
                {settingStatus.message}
              </div>
            )}

            <form onSubmit={handleSettingsSubmit} className="space-y-5">
              <div className="flex flex-col items-center">
                <div className="relative w-28 h-28 mb-2 group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <UserAvatar avatarUrl={previewUrl} username={settingUsername} className="w-full h-full text-4xl shadow-md transition group-hover:opacity-75" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/50 rounded-full">
                    <span className="text-white text-xs px-2 py-1 bg-black/80 rounded">Modifier</span>
                  </div>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/jpeg, image/png, image/webp" className="hidden" />
                <p className="text-xs text-slate-500">JPG, PNG, WEBP (Max: 2MB)</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Nom d'utilisateur</label>
                <input type="text" value={settingUsername} onChange={(e) => setSettingUsername(e.target.value)} required minLength={3} maxLength={20} className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2 text-slate-200 focus:border-indigo-500 focus:outline-none" />
              </div>
              
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Surnom (Optionnel)</label>
                <input type="text" value={settingNickname} onChange={(e) => setSettingNickname(e.target.value)} maxLength={20} className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2 text-slate-200 focus:border-indigo-500 focus:outline-none" />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Email</label>
                <input type="email" value={settingEmail} onChange={(e) => setSettingEmail(e.target.value)} required className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2 text-slate-200 focus:border-indigo-500 focus:outline-none" />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Nouveau mot de passe (laisser vide sinon)</label>
                <div className="relative flex items-center">
                  <input type={showPassword ? 'text' : 'password'} value={settingPassword} onChange={(e) => setSettingPassword(e.target.value)} placeholder="••••••••" minLength={3} maxLength={20} className="w-full pr-10 rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2 text-slate-200 focus:border-indigo-500 focus:outline-none" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 text-slate-500 hover:text-slate-300">
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={settingStatus.type === 'loading'} className="w-full bg-indigo-600 text-white font-semibold py-2.5 px-4 rounded-xl hover:bg-indigo-500 transition disabled:opacity-50 mt-2">
                {settingStatus.type === 'loading' ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </form>
            
            <div className="mt-6 pt-6 border-t border-slate-800">
              <TwoFactorSetup />
            </div>
          </div>
        </div>
      )}

      {/* --- EN TÊTE DE LA PAGE (BARRE DE NAVIGATION MINIMALISTE) --- */}
      <nav className="p-4 flex items-center justify-between max-w-4xl mx-auto">
        <button onClick={() => navigate('/')} className="text-slate-400 hover:text-white transition flex items-center gap-2 text-sm font-medium">
          ← Retour à l'accueil
        </button>
      </nav>

      {/* --- CONTENU DU PROFIL --- */}
      <div className="max-w-3xl mx-auto p-4 flex flex-col gap-8 pb-20">
        
        {/* HEADER PROFIL */}
        <div className="bg-slate-900 rounded-2xl p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 border border-slate-800 shadow-lg">
          <UserAvatar 
            avatarUrl={profileData.avatar}
            username={getDisplayName(profileData)}
            className="w-32 h-32 text-5xl border-4 border-slate-800 shadow-xl"
          />
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-white">
              {getDisplayName(profileData)}
            </h1>
            <p className="text-lg text-indigo-400 font-medium">@{profileData.username}</p>
            <p className="text-sm mt-3 text-slate-400">Rejoint le {new Date(profileData.createdAt).toLocaleDateString()}</p>
          </div>
          
          <div className="flex flex-col gap-3 w-full sm:w-auto mt-4 sm:mt-0">
            {isMyProfile ? (
              <button onClick={() => setShowSettingsModal(true)} className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl font-medium transition-colors border border-slate-700 flex items-center justify-center gap-2">
                ⚙️ Paramètres
              </button>
            ) : (
              <button onClick={handleSendMessage} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-medium transition-colors shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2">
                💬 Message
              </button>
            )}
          </div>
        </div>

        {/* MUR DE POSTS DE L'UTILISATEUR */}
        <div className="flex flex-col gap-6">
          <h2 className="text-xl font-bold text-slate-200 border-b border-slate-800 pb-2">
            Publications de {getDisplayName(profileData)}
          </h2>

          {posts.length === 0 ? (
            <div className="text-center p-10 bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed">
              <span className="text-5xl mb-3 block opacity-50">🏜️</span>
              <p className="text-slate-500">Aucune publication à afficher.</p>
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="w-full bg-slate-900 rounded-2xl border border-slate-800 shadow-sm flex flex-col">
                <div className="p-5 flex items-center gap-4">
                  <UserAvatar 
                    avatarUrl={post.author.avatar} 
                    username={getDisplayName(post.author)} 
                    className="w-12 h-12 border border-slate-700"
                    onClick={() => navigate(`/${post.author.username}`)}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white cursor-pointer hover:underline" onClick={() => navigate(`/${post.author.username}`)}>
                        {getDisplayName(post.author)}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
                        {post.isPublic ? '🌐 Public' : '👥 Amis'}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">{new Date(post.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                {post.content && <div className="px-5 pb-4 text-slate-200 whitespace-pre-wrap leading-relaxed">{post.content}</div>}
                
                {post.imageUrl && (
                  <div className="w-full bg-slate-950 border-y border-slate-800 flex justify-center max-h-[500px]">
                    <img src={`/api${post.imageUrl}`} alt="Contenu" className="object-contain w-full h-full" />
                  </div>
                )}
                
                <div className="px-5 py-3 flex gap-8 border-t border-slate-800/50 bg-slate-900/50">
                  <button onClick={() => currentUser ? toggleLike(post.id) : null} className={`flex items-center gap-2 text-sm font-medium transition-colors ${post.likes.length > 0 ? 'text-pink-500 hover:text-pink-400' : 'text-slate-400 hover:text-slate-300'} ${!currentUser && 'cursor-not-allowed opacity-70'}`}>
                    {post.likes.length > 0 ? '❤️' : '🤍'} {post._count.likes}
                  </button>
                  <button onClick={() => setOpenComments({...openComments, [post.id]: !openComments[post.id]})} className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-slate-300 transition-colors">
                    💬 {post._count.comments} Réponses
                  </button>
                </div>

                {openComments[post.id] && (
                  <div className="bg-slate-950 p-5 border-t border-slate-800 rounded-b-2xl">
                    <div className="space-y-4 mb-5 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                      {post.comments.length === 0 ? (
                        <p className="text-slate-600 text-sm text-center italic">Aucune réponse pour le moment.</p>
                      ) : (
                        post.comments.map(c => (
                          <div key={c.id} className="flex gap-3 text-sm">
                            <UserAvatar avatarUrl={c.user.avatar} username={getDisplayName(c.user)} className="w-7 h-7 text-xs border border-slate-800" onClick={() => navigate(`/${c.user.username}`)} />
                            <div className="bg-slate-900 px-4 py-2.5 rounded-2xl rounded-tl-none border border-slate-800">
                              <span className="font-bold text-indigo-300 mr-2 cursor-pointer hover:underline" onClick={() => navigate(`/${c.user.username}`)}>
                                {getDisplayName(c.user)}
                              </span>
                              <span className="text-slate-300">{c.content}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    {currentUser ? (
                      <form onSubmit={(e) => submitComment(e, post.id)} className="flex gap-3 items-center">
                        <UserAvatar avatarUrl={currentUser.avatar} username={getDisplayName(currentUser)} className="w-8 h-8 text-sm" />
                        <input type="text" placeholder="Répondre..." value={commentInputs[post.id] || ''} onChange={(e) => setCommentInputs({...commentInputs, [post.id]: e.target.value})} className="flex-1 bg-slate-900 border border-slate-700 rounded-full px-5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                      </form>
                    ) : (
                      <p className="text-xs text-slate-500 text-center">Connectez-vous pour répondre.</p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

      </div>

      {/* ================= BULLE DE CHAT FLOTTANTE ================= */}
      {currentUser && (
        <div className="fixed bottom-6 right-6 z-[90] flex flex-col items-end">
          {isChatOpen && (
            <div className="w-[350px] sm:w-[400px] h-[500px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl mb-4 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
              
              {/* Header Chat */}
              <div className="bg-slate-800 p-3 border-b border-slate-700 flex justify-between items-center shadow-sm z-10">
                <div className="flex items-center gap-2">
                  {activeRoom && (
                    <button onClick={() => setActiveRoom(null)} className="text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-700/50">←</button>
                  )}
                  {activeRoom ? (() => {
                    const roomInfo = getRoomDisplayInfo(rooms.find(r => r.id === activeRoom));
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

              {/* Contenu Chat */}
              <div className="flex-1 flex flex-col overflow-hidden relative bg-slate-950">
                {!isConnected ? (
                  <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">Connexion au serveur...</div>
                ) : activeRoom === null ? (
                  <ul className="flex-1 overflow-y-auto">
                    {rooms.length === 0 ? (
                      <div className="p-4 text-center text-slate-500 text-sm mt-10">Aucune discussion</div>
                    ) : (
                      rooms.map(room => {
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
                        const isMe = msg.senderId === currentUser.id || msg.sender?.id === currentUser.id;
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
                      <div ref={messagesEndRef} />
                    </div>
                    
                    <form onSubmit={handleSendChatMessage} className="p-3 bg-slate-900 border-t border-slate-800 flex gap-2">
                      <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Écrire un message..." className="flex-1 bg-slate-950 border border-slate-700 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                      <button type="submit" disabled={!chatInput.trim()} className="bg-indigo-600 text-white w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-50 hover:bg-indigo-500">➤</button>
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
      )}

    </div>
  );
}
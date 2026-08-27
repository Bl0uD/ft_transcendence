import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useSocket } from '../hooks/useSocket';
import api from '../api/axios';
import TwoFactorVerify from '../components/TwoFactorVerify';
import UserAvatar from '../components/UserAvatar';

// --- INTERFACES GLOBALES ---
interface User { id: number; username: string; nickname?: string | null; avatar?: string | null; }
interface FriendRequest { id: number; status: string; createdAt: string; requester: User; }
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
  if (!account || !account.username) return 'Visiteur';
  return account.nickname && account.nickname.trim() !== '' ? account.nickname : account.username;
};

export default function HomeFeed() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // --- STORE & SOCKET ---
  const user = useAuthStore((state: any) => state.user);
  const logout = useAuthStore((state: any) => state.logout);
  const loginGlobal = useAuthStore((state: any) => state.login);
  const requires2FA = useAuthStore((state: any) => state.requires2FA);
  const { socket, isConnected } = useSocket();

  // --- ÉTATS MODALES AUTH ---
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [isRegLoading, setIsRegLoading] = useState(false);

  // --- ÉTATS SOCIAUX & FEED ---
  const [activeTab, setActiveTab] = useState<'friends' | 'pending' | 'blocked'>('friends');
  const [friends, setFriends] = useState<User[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<User[]>([]);
  const [targetUsername, setTargetUsername] = useState('');
  const [socialError, setSocialError] = useState<string | null>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostImage, setNewPostImage] = useState<File | null>(null);
  const [newPostPreview, setNewPostPreview] = useState<string | null>(null);
  const [isPublicPost, setIsPublicPost] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});
  const [openComments, setOpenComments] = useState<Record<number, boolean>>({});

  const userIdRef = useRef<number | null>(null);

  // --- ÉTATS CHAT INTEGRE ---
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- INIT & URL PARAMS ---
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      localStorage.setItem('access_token', token);
      api.get('/auth/profile', { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => {
          loginGlobal(res.data, token);
          navigate('/', { replace: true });
          setShowLoginModal(false); setShowRegisterModal(false);
        })
        .catch(() => { setShowLoginModal(true); setLoginError("Impossible de récupérer le profil 42."); });
    }

    const roomId = searchParams.get('roomId');
    if (roomId && user) {
      setIsChatOpen(true);
      setActiveRoom(Number(roomId));
      navigate('/', { replace: true });
    }
  }, [searchParams, navigate, loginGlobal, user]);

  // --- CHARGEMENT FEED & SOCIAL ---
  const loadData = async () => {
    try {
      setSocialError(null);
      const feedRes = await api.get<Post[]>('/posts/feed');
      setPosts(feedRes.data);

      if (user) {
        if (!userIdRef.current) userIdRef.current = user.id;
        const [friendsRes, pendingRes, blockedRes] = await Promise.all([
          api.get<User[]>('/friends'),
          api.get<FriendRequest[]>('/friends/requests/pending'),
          api.get<User[]>('/friends/blocked'),
        ]);
        setFriends(friendsRes.data);
        setPendingRequests(pendingRes.data);
        setBlockedUsers(blockedRes.data);
      }
    } catch (err) { console.error('Erreur chargement', err); }
  };

  useEffect(() => {
    loadData();
    if (socket) {
      socket.on('socialUpdate', (data: { userId: number }) => { if (data.userId === userIdRef.current) loadData(); });
      return () => { socket.off('socialUpdate'); };
    }
  }, [user, socket]);

  // --- LOGIQUE CHAT ---
  const fetchRooms = async () => {
    try {
      const response = await api.get<Room[]>('/chat/channels');
      setRooms(response.data);
    } catch (err) { console.error("Erreur salons:", err); }
  };

  useEffect(() => {
    if (!user) return;
    fetchRooms();
  }, [user]);

  useEffect(() => {
    if (!isConnected || !socket || !user || activeRoom === null) {
      if (activeRoom === null) setMessages([]);
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
    socket.on('rooms_updated', fetchRooms);

    socket.emit('joinChannel', { channelId: activeRoom });

    return () => {
      socket.off('load_history', handleHistory);
      socket.off('receive_message', handleReceiveMessage);
      socket.off('rooms_updated', fetchRooms);
    };
  }, [socket, activeRoom, isConnected, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatOpen]);

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const content = chatInput.trim();
    if (!content || !isConnected || !socket || activeRoom === null) return;

    socket.emit('send_message', {
      channelId: activeRoom,
      content: content,
    });

    setChatInput('');
  };

  const getRoomDisplayInfo = (room?: Room) => {
    if (!room) return { name: 'Chargement...', icon: '⏳', targetUser: null };
    
    if (room.type === 'DIRECT' || room.name?.startsWith('dm_')) {
      const otherMember = room.members?.find(m => m.userId !== user?.id);
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

  // --- ACTIONS AUTH & FEED ---
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsLoginLoading(true);
    try {
      const response = await api.post('/auth/login', { identifier, password });
      localStorage.setItem('access_token', response.data.access_token);
      loginGlobal(response.data.user, response.data.access_token);
      setShowLoginModal(false); setIdentifier(''); setPassword('');
    } catch (err: any) { setLoginError(err.response?.data?.message || 'Erreur'); } finally { setIsLoginLoading(false); }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsRegLoading(true);
    try {
      const response = await api.post('/auth/register', { email: regEmail, username: regUsername, password: regPassword });
      setRegSuccess(response.data.message || 'Succès !');
      setTimeout(() => {
        setShowRegisterModal(false); setShowLoginModal(true); setIdentifier(regUsername);
        setRegEmail(''); setRegUsername(''); setRegPassword(''); setRegSuccess('');
      }, 2000);
    } catch (err: any) { setRegError(err.response?.data?.message || 'Erreur'); } finally { setIsRegLoading(false); }
  };

  const submitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim() && !newPostImage) return;
    setIsPosting(true);
    try {
      const formData = new FormData();
      formData.append('content', newPostContent); formData.append('isPublic', isPublicPost.toString());
      if (newPostImage) formData.append('image', newPostImage);
      const res = await api.post('/posts', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setPosts([{...res.data, likes: [], comments: [], _count: { likes: 0, comments: 0 }}, ...posts]);
      setNewPostContent(''); setNewPostImage(null); setNewPostPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {} finally { setIsPosting(false); }
  };

  const toggleLike = async (postId: number) => {
    try {
      const res = await api.post(`/posts/${postId}/like`);
      setPosts(posts.map(post => post.id === postId ? {
        ...post, likes: res.data.liked ? [{ id: user.id }] : [], _count: { ...post._count, likes: res.data.liked ? post._count.likes + 1 : post._count.likes - 1 }
      } : post));
    } catch (err) {}
  };

  const submitComment = async (e: React.FormEvent, postId: number) => {
    e.preventDefault();
    if (!commentInputs[postId]?.trim()) return;
    try {
      const res = await api.post(`/posts/${postId}/comment`, { content: commentInputs[postId] });
      setPosts(posts.map(post => post.id === postId ? { ...post, comments: [...post.comments, res.data], _count: { ...post._count, comments: post._count.comments + 1 } } : post));
      setCommentInputs({ ...commentInputs, [postId]: '' });
    } catch (err) {}
  };

  const handleSocialAction = async (action: () => Promise<any>) => { try { await action(); loadData(); } catch (err) {} };

  return (
    <div className="flex h-screen bg-slate-900 text-white overflow-hidden relative">
      
      {/* ================= MODALES AUTHENTIFICATION ================= */}
      {showLoginModal && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="relative w-full max-w-md space-y-6 bg-slate-900/90 p-8 rounded-3xl border border-slate-700 shadow-2xl">
            <button onClick={() => setShowLoginModal(false)} className="absolute top-4 right-5 text-slate-400 hover:text-white transition-colors text-xl">✕</button>
            {requires2FA ? <TwoFactorVerify /> : (
              <>
                <div className="text-center"><h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Transcendence</h2></div>
                {loginError && <div className="p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl">{loginError}</div>}
                <form className="space-y-4" onSubmit={handleLoginSubmit}>
                  <input type="text" placeholder="Email / Username" required value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2 text-slate-200 focus:border-indigo-500 focus:outline-none" />
                  <input type="password" placeholder="Mot de passe" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2 text-slate-200 focus:border-indigo-500 focus:outline-none" />
                  <button type="submit" disabled={isLoginLoading} className="w-full bg-indigo-600 px-4 py-2.5 rounded-xl text-sm font-semibold">{isLoginLoading ? '...' : 'Se connecter'}</button>
                </form>

                <div className="relative my-4"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700"></div></div><div className="relative flex justify-center text-xs"><span className="bg-slate-900 px-3 text-slate-500">Ou</span></div></div>
                <button onClick={() => window.location.href = '/api/auth/42'} className="w-full flex justify-center items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 border border-slate-700 transition-colors">🔗 Se connecter avec 42</button>

                <div className="text-center text-sm text-slate-400 mt-4"><button type="button" onClick={() => {setShowLoginModal(false); setShowRegisterModal(true)}} className="text-indigo-400 hover:underline">Créer un compte</button></div>
              </>
            )}
          </div>
         </div>
      )}

      {showRegisterModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="relative w-full max-w-md space-y-6 bg-slate-900/90 p-8 rounded-3xl border border-slate-700 shadow-2xl">
            <button onClick={() => setShowRegisterModal(false)} className="absolute top-4 right-5 text-slate-400 hover:text-white transition-colors text-xl">✕</button>
            <div className="text-center"><h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">S'inscrire</h2></div>
            {regSuccess && <div className="p-3 text-sm text-emerald-400 bg-emerald-500/10 rounded-xl">{regSuccess} 🎉</div>}
            {regError && <div className="p-3 text-sm text-red-400 bg-red-500/10 rounded-xl">{regError}</div>}
            <form className="space-y-4" onSubmit={handleRegisterSubmit}>
              <input type="text" placeholder="Username" required value={regUsername} onChange={(e) => setRegUsername(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2 focus:border-indigo-500 focus:outline-none" />
              <input type="email" placeholder="Email" required value={regEmail} onChange={(e) => setRegEmail(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2 focus:border-indigo-500 focus:outline-none" />
              <input type="password" placeholder="Mot de passe" required value={regPassword} onChange={(e) => setRegPassword(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2 focus:border-indigo-500 focus:outline-none" />
              <button type="submit" disabled={isRegLoading} className="w-full bg-indigo-600 px-4 py-2.5 rounded-xl text-sm font-semibold">{isRegLoading ? '...' : "S'inscrire"}</button>
            </form>
            <div className="text-center text-sm text-slate-400 mt-4"><button onClick={() => {setShowRegisterModal(false); setShowLoginModal(true)}} className="text-indigo-400 hover:underline">Se connecter</button></div>
          </div>
        </div>
      )}

      {/* --- NAVBAR --- */}
      <nav className="fixed top-0 left-0 w-full h-16 bg-slate-800 border-b border-slate-700 z-50 flex items-center justify-between px-6 shadow-md">
        <div onClick={() => user && navigate(`/${user.username}`)} className="flex items-center gap-3 cursor-pointer hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors">
          <UserAvatar avatarUrl={user?.avatar} username={getDisplayName(user)} className="w-10 h-10 border border-slate-600" />
          <span className="font-semibold text-lg">{getDisplayName(user)}</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => user ? setIsChatOpen(!isChatOpen) : setShowLoginModal(true)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium transition-colors">💬 Chat</button>
          {user ? (
            <button onClick={() => { logout(); setShowLoginModal(false); setIsChatOpen(false); }} className="px-4 py-2 bg-red-600/90 hover:bg-red-500 rounded text-sm font-medium">Se déconnecter</button>
          ) : (
            <button onClick={() => setShowLoginModal(true)} className="px-4 py-2 bg-blue-600/90 hover:bg-blue-500 rounded text-sm font-medium">Se connecter</button>
          )}
        </div>
      </nav>

      {/* --- CONTENU --- */}
      <div className="flex w-full pt-16 h-full">

        {/* PANNEAU SOCIAL (À GAUCHE) */}
        {user ? (
          <aside className="hidden lg:flex w-80 bg-slate-800 border-r border-slate-700 flex-col h-full z-10">
            <div className="p-5 border-b border-slate-700 sticky top-0"><h2 className="text-lg font-bold mb-4">👥 Social</h2><form onSubmit={(e) => {e.preventDefault(); handleSocialAction(()=>api.post('/friends/request', { username: targetUsername.trim() })).then(()=>setTargetUsername(''))}} className="flex gap-2"><input type="text" placeholder="Ajouter un ami (username)..." value={targetUsername} onChange={(e) => setTargetUsername(e.target.value)} className="p-2 border border-slate-600 rounded bg-slate-900 flex-1 text-sm focus:outline-none" /><button type="submit" className="bg-blue-600 px-3 text-sm rounded">Ajouter</button></form></div>
            <div className="flex border-b border-slate-700 text-sm"><button onClick={() => setActiveTab('friends')} className={`flex-1 py-3 ${activeTab === 'friends' ? 'text-blue-400 border-b-2 border-blue-500' : 'text-slate-400'}`}>Amis</button><button onClick={() => setActiveTab('pending')} className={`flex-1 py-3 ${activeTab === 'pending' ? 'text-blue-400 border-b-2 border-blue-500' : 'text-slate-400'}`}>Demandes</button><button onClick={() => setActiveTab('blocked')} className={`flex-1 py-3 ${activeTab === 'blocked' ? 'text-blue-400 border-b-2 border-blue-500' : 'text-slate-400'}`}>Bloqués</button></div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {activeTab === 'friends' && friends.map(f => (<div key={f.id} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg border border-slate-700"><span className="cursor-pointer hover:underline" onClick={() => navigate(`/${f.username}`)}>{getDisplayName(f)}</span><div className="flex gap-2"><button onClick={() => handleSocialAction(()=>api.post('/friends/block', { targetUserId: f.id }))} className="text-xs text-yellow-500">Bloquer</button><button onClick={() => handleSocialAction(()=>api.delete(`/friends/${f.id}`))} className="text-xs text-red-400">Retirer</button></div></div>))}
              {activeTab === 'pending' && pendingRequests.map(r => (<div key={r.id} className="p-3 bg-slate-900/50 rounded-lg border border-slate-700 text-sm"><span className="font-semibold cursor-pointer" onClick={() => navigate(`/${r.requester.username}`)}>{getDisplayName(r.requester)}</span> vous a ajouté.<button onClick={() => handleSocialAction(()=>api.put('/friends/accept', { requestId: r.id }))} className="w-full mt-2 py-1 bg-green-600 rounded">Accepter</button></div>))}
              {activeTab === 'blocked' && blockedUsers.map(u => (<div key={u.id} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg border border-slate-700"><span className="line-through text-slate-500">{getDisplayName(u)}</span><button onClick={() => handleSocialAction(()=>api.delete(`/friends/block/${u.id}`)) } className="text-xs text-slate-300">Débloquer</button></div>))}
            </div>
          </aside>
        ) : (
          <aside className="hidden lg:flex w-80 bg-slate-800/50 border-r border-slate-700 flex-col h-full items-center justify-center p-6 text-center"><span className="text-5xl mb-4">👋</span><h3 className="font-bold mb-2">Rejoignez le réseau</h3><p className="text-slate-400 text-sm mb-4">Connectez-vous pour interagir.</p><button onClick={() => setShowLoginModal(true)} className="w-full py-2 bg-blue-600 rounded-lg mb-2">Se connecter</button><button onClick={() => setShowRegisterModal(true)} className="w-full py-2 bg-slate-700 rounded-lg">Créer un compte</button></aside>
        )}

        {/* CONTENU FEED */}
        <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="max-w-2xl mx-auto flex flex-col gap-6 pb-20">
            <h1 className="text-2xl font-bold text-slate-100">Fil d'actualité</h1>

            {/* CRÉATION POST */}
            {user && (
              <div className="w-full bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-sm">
                <form onSubmit={submitPost} className="flex flex-col gap-4">
                  <div className="flex gap-4">
                    <UserAvatar avatarUrl={user?.avatar} username={getDisplayName(user)} className="w-10 h-10 border border-slate-600" onClick={() => navigate(`/${user.username}`)} />
                    <textarea placeholder={`Quoi de neuf, ${getDisplayName(user)} ?`} value={newPostContent} onChange={(e) => setNewPostContent(e.target.value)} className="flex-1 bg-slate-900/50 rounded-lg py-3 px-4 border border-slate-700 focus:border-indigo-500 focus:outline-none resize-none min-h-[80px]" />
                  </div>
                  {newPostPreview && (
                    <div className="relative ml-14"><img src={newPostPreview} alt="Preview" className="rounded-lg max-h-60 object-contain bg-slate-900 border border-slate-700" /><button type="button" onClick={() => { setNewPostImage(null); setNewPostPreview(null); }} className="absolute top-2 right-2 bg-slate-800/80 p-1.5 rounded-full hover:bg-red-500">✕</button></div>
                  )}
                  <div className="flex justify-between items-center ml-14">
                    <div className="flex gap-4 items-center">
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="text-indigo-400 text-sm">📸 Image</button>
                      <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={(e) => {const f = e.target.files?.[0]; if(f){setNewPostImage(f); setNewPostPreview(URL.createObjectURL(f));}}} />
                      <select value={isPublicPost ? "public" : "friends"} onChange={(e) => setIsPublicPost(e.target.value === "public")} className="bg-slate-900 border border-slate-700 text-xs rounded p-1.5">
                        <option value="public">🌐 Public</option><option value="friends">👥 Amis uniquement</option>
                      </select>
                    </div>
                    <button type="submit" disabled={isPosting || (!newPostContent.trim() && !newPostImage)} className="bg-indigo-600 px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">Publier</button>
                  </div>
                </form>
              </div>
            )}

            {/* LISTE POSTS */}
            {posts.map((post) => (
              <div key={post.id} className="w-full bg-slate-800 rounded-xl border border-slate-700 shadow-sm flex flex-col">
                <div className="p-4 flex items-center gap-3">
                  <UserAvatar avatarUrl={post.author.avatar} username={getDisplayName(post.author)} className="w-10 h-10 border border-slate-600" onClick={() => navigate(`/${post.author.username}`)} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold cursor-pointer hover:underline" onClick={() => navigate(`/${post.author.username}`)}>{getDisplayName(post.author)}</span>
                      <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">{post.isPublic ? 'Public' : 'Amis'}</span>
                    </div>
                    <span className="text-xs text-slate-400">{new Date(post.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                {post.content && <div className="px-4 pb-3 whitespace-pre-wrap">{post.content}</div>}
                {post.imageUrl && <div className="w-full bg-slate-900 border-y border-slate-700 flex justify-center max-h-[500px]"><img src={`/api${post.imageUrl}`} alt="Content" className="object-contain w-full h-full" /></div>}
                
                <div className="px-4 py-3 flex gap-6 border-t border-slate-700/50">
                  <button onClick={() => user ? toggleLike(post.id) : setShowLoginModal(true)} className={`flex items-center gap-2 text-sm font-medium ${post.likes.length > 0 ? 'text-pink-500' : 'text-slate-400 hover:text-slate-200'}`}>
                    {post.likes.length > 0 ? '❤️' : '🤍'} {post._count.likes}
                  </button>
                  <button onClick={() => setOpenComments({...openComments, [post.id]: !openComments[post.id]})} className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
                    💬 {post._count.comments} Commentaires
                  </button>
                </div>

                {openComments[post.id] && (
                  <div className="bg-slate-900/50 p-4 border-t border-slate-700">
                    <div className="space-y-3 mb-4 max-h-60 overflow-y-auto pr-2">
                      {post.comments.map(c => (
                        <div key={c.id} className="flex gap-3 text-sm">
                          <UserAvatar avatarUrl={c.user.avatar} username={getDisplayName(c.user)} className="w-6 h-6 text-xs border border-slate-700" onClick={() => navigate(`/${c.user.username}`)} />
                          <div className="bg-slate-800 px-3 py-2 rounded-xl rounded-tl-none border border-slate-700">
                            <span className="font-semibold text-slate-300 mr-2 cursor-pointer hover:underline" onClick={() => navigate(`/${c.user.username}`)}>{getDisplayName(c.user)}</span>
                            <span className="text-slate-200">{c.content}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {user ? (
                      <form onSubmit={(e) => submitComment(e, post.id)} className="flex gap-2">
                        <UserAvatar avatarUrl={user?.avatar} username={getDisplayName(user)} className="w-8 h-8 text-sm border border-slate-700" />
                        <input type="text" placeholder="Ajouter un commentaire..." value={commentInputs[post.id] || ''} onChange={(e) => setCommentInputs({...commentInputs, [post.id]: e.target.value})} className="flex-1 bg-slate-800 border border-slate-600 rounded-full px-4 py-1.5 text-sm focus:outline-none focus:border-indigo-500" />
                      </form>
                    ) : (
                      <div className="text-center p-2"><button type="button" onClick={() => setShowLoginModal(true)} className="text-sm text-indigo-400 hover:underline">Se connecter pour commenter</button></div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </main>
      </div>

      {/* ================= BULLE DE CHAT FLOTTANTE ================= */}
      {user && (
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
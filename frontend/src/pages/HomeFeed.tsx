import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useSocialStore } from '../store/socialStore'; // 👈 On importe le nouveau store
import { useSocket } from '../hooks/useSocket';
import api from '../api/axios';
import TwoFactorVerify from '../components/TwoFactorVerify';
import UserAvatar from '../components/UserAvatar';

// --- INTERFACES LOCALES (Le reste est dans les stores) ---
interface Comment { id: number; content: string; createdAt: string; user: any; }
interface Post {
  id: number; content: string; imageUrl: string | null; isPublic: boolean; createdAt: string;
  author: any; likes: { id: number }[]; comments: Comment[];
  _count: { likes: number; comments: number; };
}

const getDisplayName = (account?: { username?: string; nickname?: string | null } | null) => {
  if (!account || !account.username) return 'Visiteur';
  return account.nickname && account.nickname.trim() !== '' ? account.nickname : account.username;
};

export default function HomeFeed() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // --- STORES & SOCKET ---
  const user = useAuthStore((state: any) => state.user);
  const logout = useAuthStore((state: any) => state.logout);
  const loginGlobal = useAuthStore((state: any) => state.login);
  const requires2FA = useAuthStore((state: any) => state.requires2FA);
  
  const { socket } = useSocket('/'); // 👈 Écoute le canal racine pour les notifs
  
  // 🟢 On récupère toute la donnée et les actions depuis le Social Store
  const { 
    friends, pendingRequests, blockedUsers, friendsStatus,
    fetchAllSocialData, sendRequest, acceptRequest, removeFriend, blockUser, unblockUser
  } = useSocialStore();

  // --- ÉTATS MODALES & FORMULAIRES ---
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

  // --- ÉTATS UI SOCIAUX & FEED ---
  const [activeTab, setActiveTab] = useState<'friends' | 'pending' | 'blocked'>('friends');
  const [targetUsername, setTargetUsername] = useState('');
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
  }, [searchParams, navigate, loginGlobal]);

  // --- CHARGEMENT FEED ---
  const loadFeed = async () => {
    try {
      const feedRes = await api.get<Post[]>('/posts/feed');
      setPosts(feedRes.data);
    } catch (err) { console.error('Erreur chargement feed', err); }
  };

  useEffect(() => {
    if (user) {
      if (!userIdRef.current) userIdRef.current = user.id;
      loadFeed();
      fetchAllSocialData(); // 👈 On charge le social depuis le store
    }
  }, [user, fetchAllSocialData]);

  // --- ÉCOUTE DES WEBSOCKETS SOCIAUX ---
  useEffect(() => {
    if (socket && user) {
      const handleSocialUpdate = (data: any) => {
        // Rafraîchir les données sociales globales si on est concerné
        if (!data || data.userId === userIdRef.current || data.targetId === userIdRef.current) {
          fetchAllSocialData();
        }
      };

      socket.on('socialUpdate', handleSocialUpdate);
      socket.on('friend_request_received', fetchAllSocialData);
      socket.on('friend_request_accepted', fetchAllSocialData);

      return () => {
        socket.off('socialUpdate', handleSocialUpdate);
        socket.off('friend_request_received', fetchAllSocialData);
        socket.off('friend_request_accepted', fetchAllSocialData);
      };
    }
  }, [socket, user, fetchAllSocialData]);

  // --- ACTIONS AUTH ---
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

  // --- ACTIONS FEED ---
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

  // --- ACTIONS SOCIALES WRAPPERS ---
  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUsername.trim()) return;
    try {
      await sendRequest(targetUsername.trim());
      setTargetUsername('');
    } catch(e) {}
  };

  return (
    <div className="flex h-screen bg-slate-900 text-white overflow-hidden relative">
      
      {/* MODALES AUTHENTIFICATION */}
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

      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 w-full h-16 bg-slate-800 border-b border-slate-700 z-50 flex items-center justify-between px-6 shadow-md">
        <div onClick={() => user && navigate(`/${user.username}`)} className="flex items-center gap-3 cursor-pointer hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors">
          <UserAvatar avatarUrl={user?.avatar} username={getDisplayName(user)} className="w-10 h-10 border border-slate-600" />
          <span className="font-semibold text-lg">{getDisplayName(user)}</span>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <button onClick={() => { logout(); setShowLoginModal(false); }} className="px-4 py-2 bg-red-600/90 hover:bg-red-500 rounded text-sm font-medium">Se déconnecter</button>
          ) : (
            <button onClick={() => setShowLoginModal(true)} className="px-4 py-2 bg-blue-600/90 hover:bg-blue-500 rounded text-sm font-medium">Se connecter</button>
          )}
        </div>
      </nav>

      {/* CONTENU */}
      <div className="flex w-full pt-16 h-full">

        {/* PANNEAU SOCIAL */}
        {user ? (
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
                <div key={f.id} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                  <div className="flex items-center gap-2">
                    {/* Indicateur de présence via friendsStatus */}
                    <div className={`w-2 h-2 rounded-full ${friendsStatus[f.id] === 'ONLINE' ? 'bg-green-500' : 'bg-slate-500'}`} />
                    <span className="cursor-pointer hover:underline font-medium" onClick={() => navigate(`/${f.username}`)}>{getDisplayName(f)}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => blockUser(f.id)} className="text-xs text-yellow-500 hover:text-yellow-400">Bloquer</button>
                    <button onClick={() => removeFriend(f.id)} className="text-xs text-red-400 hover:text-red-300">Retirer</button>
                  </div>
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
        ) : (
          <aside className="hidden lg:flex w-80 bg-slate-800/50 border-r border-slate-700 flex-col h-full items-center justify-center p-6 text-center">
            <span className="text-5xl mb-4">👋</span>
            <h3 className="font-bold mb-2">Rejoignez le réseau</h3>
            <p className="text-slate-400 text-sm mb-4">Connectez-vous pour interagir.</p>
            <button onClick={() => setShowLoginModal(true)} className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded-lg mb-2">Se connecter</button>
            <button onClick={() => setShowRegisterModal(true)} className="w-full py-2 bg-slate-700 hover:bg-slate-600 rounded-lg">Créer un compte</button>
          </aside>
        )}

        {/* FEED */}
        <main className="flex-1 overflow-y-auto p-6 scroll-smooth custom-scrollbar">
          <div className="max-w-2xl mx-auto flex flex-col gap-6 pb-20">
            <h1 className="text-2xl font-bold text-slate-100">Fil d'actualité</h1>

            {/* Créer un Post */}
            {user && (
              <div className="w-full bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-sm">
                <form onSubmit={submitPost} className="flex flex-col gap-4">
                  <div className="flex gap-4">
                    <UserAvatar avatarUrl={user?.avatar} username={getDisplayName(user)} className="w-10 h-10 border border-slate-600" onClick={() => navigate(`/${user.username}`)} />
                    <textarea placeholder={`Quoi de neuf, ${getDisplayName(user)} ?`} value={newPostContent} onChange={(e) => setNewPostContent(e.target.value)} className="flex-1 bg-slate-900/50 rounded-lg py-3 px-4 border border-slate-700 focus:border-indigo-500 focus:outline-none resize-none min-h-[80px]" />
                  </div>
                  {newPostPreview && (
                    <div className="relative ml-14">
                      <img src={newPostPreview} alt="Preview" className="rounded-lg max-h-60 object-contain bg-slate-900 border border-slate-700" />
                      <button type="button" onClick={() => { setNewPostImage(null); setNewPostPreview(null); }} className="absolute top-2 right-2 bg-slate-800/80 p-1.5 rounded-full hover:bg-red-500">✕</button>
                    </div>
                  )}
                  <div className="flex justify-between items-center ml-14">
                    <div className="flex gap-4 items-center">
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="text-indigo-400 text-sm font-medium">📸 Image</button>
                      <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={(e) => {const f = e.target.files?.[0]; if(f){setNewPostImage(f); setNewPostPreview(URL.createObjectURL(f));}}} />
                      <select value={isPublicPost ? "public" : "friends"} onChange={(e) => setIsPublicPost(e.target.value === "public")} className="bg-slate-900 border border-slate-700 text-xs rounded p-1.5 text-slate-200 outline-none">
                        <option value="public">🌐 Public</option>
                        <option value="friends">👥 Amis uniquement</option>
                      </select>
                    </div>
                    <button type="submit" disabled={isPosting || (!newPostContent.trim() && !newPostImage)} className="bg-indigo-600 hover:bg-indigo-500 px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">Publier</button>
                  </div>
                </form>
              </div>
            )}

            {/* Liste des Posts */}
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
                {post.imageUrl && (
                  <div className="w-full bg-slate-900 border-y border-slate-700 flex justify-center max-h-[500px]">
                    <img src={`/api${post.imageUrl}`} alt="Content" className="object-contain w-full h-full" />
                  </div>
                )}
                
                <div className="px-4 py-3 flex gap-6 border-t border-slate-700/50">
                  <button onClick={() => user ? toggleLike(post.id) : setShowLoginModal(true)} className={`flex items-center gap-2 text-sm font-medium transition-colors ${post.likes.length > 0 ? 'text-pink-500 hover:text-pink-400' : 'text-slate-400 hover:text-slate-200'}`}>
                    {post.likes.length > 0 ? '❤️' : '🤍'} {post._count.likes}
                  </button>
                  <button onClick={() => setOpenComments({...openComments, [post.id]: !openComments[post.id]})} className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
                    💬 {post._count.comments} Commentaires
                  </button>
                </div>

                {openComments[post.id] && (
                  <div className="bg-slate-900/50 p-4 border-t border-slate-700">
                    <div className="space-y-3 mb-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
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
      
    </div>
  );
}
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore'; 
import { useSocialStore } from '../store/socialStore'; 
import UserAvatar from '../components/UserAvatar';
import TwoFactorSetup from '../components/TwoFactorSetup';
import SocialSidebar from '../components/SocialSidebar'; 
import TopNavBar from '../components/TopNavBar';
import AuthModals from '../components/AuthModals'; // 👈 IMPORT DE LA MODALE

interface User { id: number; username: string; nickname?: string | null; avatar?: string | null; }
interface Comment { id: number; content: string; createdAt: string; user: User; }
interface Post {
  id: number; content: string; imageUrl: string | null; isPublic: boolean; createdAt: string;
  author: User; likes: { id: number }[]; comments: Comment[];
  _count: { likes: number; comments: number; };
}

const getDisplayName = (account?: { username?: string; nickname?: string | null } | null) => {
  if (!account || !account.username) return 'Utilisateur';
  return account.nickname && account.nickname.trim() !== '' ? account.nickname : account.username;
};

export default function PublicProfile() {
  const { username } = useParams();
  const navigate = useNavigate();
  
  const currentUser = useAuthStore((state: any) => state.user);
  const updateUser = useAuthStore((state: any) => state.updateUser);
  const { setIsChatOpen, setActiveRoom } = useChatStore(); 
  
  const { fetchAllSocialData, friends, blockedUsers, removeFriend, blockUser, unblockUser, sendRequest } = useSocialStore(); 
  
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [posts, setPosts] = useState<Post[]>([]);
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});
  const [openComments, setOpenComments] = useState<Record<number, boolean>>({});

  const isMyProfile = currentUser?.username === username;
  const isFriend = friends.some(f => f.id === profileData?.id);
  const isBlocked = blockedUsers.some(u => u.id === profileData?.id);
  const wasBlocked = useRef(isBlocked);

  const [showAuthModal, setShowAuthModal] = useState(false); // 👈 NOUVEL ÉTAT POUR LA MODALE
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  // Paramètres Profil
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
    if (currentUser) fetchAllSocialData();
  }, [currentUser, fetchAllSocialData]);

  useEffect(() => {
    if (currentUser) {
      setSettingUsername(currentUser.username || '');
      setSettingNickname(currentUser.nickname || '');
      setSettingEmail(currentUser.email || '');
      setPreviewUrl(currentUser.avatar || '');
    }
  }, [currentUser]);

  useEffect(() => {
    const fetchProfileAndPosts = async () => {
      setLoading(true);
      setError('');
      try {
        const profileRes = await api.get(`/users/public/${username}`);
        const userData = profileRes.data;
        setProfileData(userData); 

        const weBlockedThem = useSocialStore.getState().blockedUsers.some((u: any) => u.id === userData.id);

        try {
          const postsRes = await api.get(`/posts/user/${userData.id}`);
          setPosts(postsRes.data);
        } catch (postErr: any) {
          if (postErr.response?.status === 403) {
            if (weBlockedThem) {
              setPosts([]);
            } else {
              setError("Cet utilisateur n'existe pas ou est indisponible.");
            }
          } else {
            throw postErr; 
          }
        }
      } catch (err: any) {
        setError("Cet utilisateur n'existe pas ou est indisponible.");
      } finally {
        setLoading(false);
      }
    };

    fetchProfileAndPosts();
  }, [username]);

  useEffect(() => {
    if (wasBlocked.current && !isBlocked && profileData) {
      api.get(`/posts/user/${profileData.id}`)
         .then(res => setPosts(res.data))
         .catch(() => {});
    }
    wasBlocked.current = isBlocked;
  }, [isBlocked, profileData]);

  const handleSendMessage = async () => {
    if (!profileData?.id) return alert("ID utilisateur introuvable.");
    try {
      const response = await api.post('/chat/channels/dm', { targetUserId: profileData.id });
      const channelId = response.data.id || response.data.channel?.id;
      if (!channelId) return alert("ID du salon introuvable.");
      
      setActiveRoom(Number(channelId));
      setIsChatOpen(true);
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
  
  if (error) return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden relative">
      <AuthModals isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <TopNavBar onLoginClick={() => setShowAuthModal(true)} />
      <div className="flex w-full pt-16 h-full">
        {currentUser && <SocialSidebar />}
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="text-center p-10 bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed">
            <span className="text-5xl mb-3 block opacity-50">👻</span>
            <p className="text-slate-400 font-semibold">{error}</p>
          </div>
        </main>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden relative">

      {/* 🟢 INTÉGRATION DE LA MODALE */}
      <AuthModals isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

      {/* MODALE PARAMÈTRES (inchangée) */}
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
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/50 rounded-full"><span className="text-white text-xs px-2 py-1 bg-black/80 rounded">Modifier</span></div>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/jpeg, image/png, image/webp" className="hidden" />
                <p className="text-xs text-slate-500">JPG, PNG, WEBP (Max: 2MB)</p>
              </div>
              <div><label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Nom d'utilisateur</label><input type="text" value={settingUsername} onChange={(e) => setSettingUsername(e.target.value)} required minLength={3} maxLength={20} className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2 text-slate-200 focus:border-indigo-500 focus:outline-none" /></div>
              <div><label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Surnom (Optionnel)</label><input type="text" value={settingNickname} onChange={(e) => setSettingNickname(e.target.value)} maxLength={20} className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2 text-slate-200 focus:border-indigo-500 focus:outline-none" /></div>
              <div><label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Email</label><input type="email" value={settingEmail} onChange={(e) => setSettingEmail(e.target.value)} required className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2 text-slate-200 focus:border-indigo-500 focus:outline-none" /></div>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Nouveau mot de passe (laisser vide sinon)</label>
                <div className="relative flex items-center">
                  <input type={showPassword ? 'text' : 'password'} value={settingPassword} onChange={(e) => setSettingPassword(e.target.value)} placeholder="••••••••" minLength={3} maxLength={20} className="w-full pr-10 rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2 text-slate-200 focus:border-indigo-500 focus:outline-none" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 text-slate-500 hover:text-slate-300">{showPassword ? "🙈" : "👁️"}</button>
                </div>
              </div>
              <button type="submit" disabled={settingStatus.type === 'loading'} className="w-full bg-indigo-600 text-white font-semibold py-2.5 px-4 rounded-xl hover:bg-indigo-500 transition disabled:opacity-50 mt-2">{settingStatus.type === 'loading' ? 'Enregistrement...' : 'Enregistrer'}</button>
            </form>
            <div className="mt-6 pt-6 border-t border-slate-800"><TwoFactorSetup /></div>
          </div>
        </div>
      )}

      {/* NAVBAR GLOBALE */}
      <TopNavBar onLoginClick={() => setShowAuthModal(true)} />

      {/* STRUCTURE DE LA PAGE : SIDEBAR + CONTENU */}
      <div className="flex w-full pt-16 h-full">
        {currentUser && <SocialSidebar />}

        <main className="flex-1 overflow-y-auto p-6 scroll-smooth custom-scrollbar">
          <div className="max-w-3xl mx-auto flex flex-col gap-8 pb-20">
            
            <div className="bg-slate-900 rounded-2xl p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 border border-slate-800 shadow-lg mt-4">
              <UserAvatar avatarUrl={profileData?.avatar} username={getDisplayName(profileData)} className="w-32 h-32 text-5xl border-4 border-slate-800 shadow-xl" />
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-white">{getDisplayName(profileData)}</h1>
                <p className="text-lg text-indigo-400 font-medium">@{profileData?.username}</p>
                {profileData?.createdAt && <p className="text-sm mt-3 text-slate-400">Rejoint le {new Date(profileData.createdAt).toLocaleDateString()}</p>}
              </div>
              
              <div className="flex flex-wrap justify-center sm:justify-start gap-3 w-full sm:w-auto mt-4 sm:mt-0">
                {/* 🟢 GESTION DES BOUTONS SELON LE STATUT */}
                {!currentUser ? (
                  <>
                    <button onClick={() => setShowAuthModal(true)} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-medium transition-colors shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2">
                      💬 Message
                    </button>
                    <button onClick={() => setShowAuthModal(true)} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2">
                      ➕ Ajouter
                    </button>
                  </>
                ) : isMyProfile ? (
                  <button onClick={() => setShowSettingsModal(true)} className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl font-medium transition-colors border border-slate-700 flex items-center justify-center gap-2">
                    ⚙️ Paramètres
                  </button>
                ) : isBlocked ? (
                  <button onClick={() => unblockUser(profileData.id)} className="px-6 py-2.5 bg-slate-800 hover:bg-emerald-500/20 hover:text-emerald-400 text-slate-300 rounded-xl font-medium transition-colors border border-slate-700 flex items-center justify-center gap-2">
                    🔓 Débloquer
                  </button>
                ) : (
                  <>
                    <button onClick={handleSendMessage} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-medium transition-colors shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2">
                      💬 Message
                    </button>
                    {isFriend ? (
                      <button onClick={() => removeFriend(profileData.id)} className="px-4 py-2.5 bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-300 rounded-xl font-medium transition-colors border border-slate-700 flex items-center justify-center gap-2">
                        Retirer
                      </button>
                    ) : (
                      <button onClick={async () => { try { await sendRequest(profileData.username); alert("Demande d'ami envoyée !"); } catch (e: any) { alert(e.response?.data?.message || "Erreur."); } }} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2">
                        ➕ Ajouter
                      </button>
                    )}
                    <button onClick={() => blockUser(profileData.id)} className="px-4 py-2.5 bg-slate-800 hover:bg-yellow-500/20 hover:text-yellow-500 text-slate-300 rounded-xl font-medium transition-colors border border-slate-700 flex items-center justify-center gap-2">
                      Bloquer
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* MUR DE POSTS */}
            <div className="flex flex-col gap-6">
              <h2 className="text-xl font-bold text-slate-200 border-b border-slate-800 pb-2">
                Publications de {getDisplayName(profileData)}
              </h2>

              {isBlocked ? (
                <div className="text-center p-10 bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed">
                  <span className="text-5xl mb-3 block opacity-50">🚫</span>
                  <p className="text-slate-500">Vous avez bloqué cet utilisateur.</p>
                </div>
              ) : posts.length === 0 ? (
                <div className="text-center p-10 bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed">
                  <span className="text-5xl mb-3 block opacity-50">🏜️</span>
                  <p className="text-slate-500">Aucune publication à afficher.</p>
                </div>
              ) : (
                posts.map((post) => (
                  <div key={post.id} className="w-full bg-slate-900 rounded-2xl border border-slate-800 shadow-sm flex flex-col">
                    <div className="p-5 flex items-center gap-4">
                      <UserAvatar avatarUrl={post.author.avatar} username={getDisplayName(post.author)} className="w-12 h-12 border border-slate-700" onClick={() => navigate(`/${post.author.username}`)} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white cursor-pointer hover:underline" onClick={() => navigate(`/${post.author.username}`)}>{getDisplayName(post.author)}</span>
                          <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">{post.isPublic ? '🌐 Public' : '👥 Amis'}</span>
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
                      <button onClick={() => currentUser ? toggleLike(post.id) : setShowAuthModal(true)} className={`flex items-center gap-2 text-sm font-medium transition-colors ${post.likes.length > 0 ? 'text-pink-500 hover:text-pink-400' : 'text-slate-400 hover:text-slate-300'}`}>
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
                                  <span className="font-bold text-indigo-300 mr-2 cursor-pointer hover:underline" onClick={() => navigate(`/${c.user.username}`)}>{getDisplayName(c.user)}</span>
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
                          <div className="text-center p-2"><button type="button" onClick={() => setShowAuthModal(true)} className="text-sm text-indigo-400 hover:underline">Se connecter pour commenter</button></div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
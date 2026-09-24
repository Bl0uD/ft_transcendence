import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore'; 
import { useSocialStore } from '../store/socialStore';
import { useThemeStore } from '../store/themeStore'; 
import UserAvatar from '../components/UserAvatar';
import TwoFactorSetup from '../components/TwoFactorSetup';
import SocialSidebar from '../components/SocialSidebar'; 
import TopNavBar from '../components/TopNavBar';
import AuthModals from '../components/AuthModals';
import { GlobeIcon, FriendsIcon, LikeIcon, BubbleIcon, ChatIcon, ClosedEyeIcon, OpenedEyeIcon, ForbiddenIcon, UnknownIcon, SettingsIcon } from '../components/HeaderIcons';

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
  const { colorTheme, setColorTheme } = useThemeStore();
  const { username } = useParams();
  const navigate = useNavigate();
  
  const currentUser = useAuthStore((state: any) => state.user);
  const updateUser = useAuthStore((state: any) => state.updateUser);
  const { setIsChatOpen, setActiveRoom } = useChatStore(); 
  
  const { fetchAllSocialData, friends, blockedUsers, removeFriend, blockUser, unblockUser, sendRequest, isDesktopSidebarOpen } = useSocialStore(); 
  
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

  // NOUVEAU: Recharger les posts du profil plus souvent
  const isChatOpen = useChatStore((state) => state.isChatOpen);
  useEffect(() => {
    if (profileData && !isBlocked) {
      const loadPosts = () => {
        api.get(`/posts/user/${profileData.id}`)
           .then(res => setPosts(res.data))
           .catch(() => {});
      };
      
      if (!isChatOpen) loadPosts();
      
      const handleFocus = () => {
        if (document.visibilityState === 'visible') loadPosts();
      };
      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleFocus);
      return () => {
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('visibilitychange', handleFocus);
      };
    }
  }, [isChatOpen, profileData, isBlocked, currentUser]);

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

  if (loading) return <div className="min-h-screen bg-bg flex items-center justify-center text-text-main">Chargement...</div>;
  
  if (error) return (
    <div className="flex h-dvh bg-bg text-text-main overflow-hidden relative w-full max-w-full">
      <AuthModals isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <TopNavBar onLoginClick={() => setShowAuthModal(true)} />
      <div className="flex w-full max-w-full pt-16 h-full overflow-hidden">
        {currentUser && <SocialSidebar />}
        <main className="flex-1 min-w-0 flex items-center justify-center p-4 sm:p-6">
          <div className="text-center p-6 sm:p-10 bg-surface/50 rounded-2xl border border-border border-dashed max-w-sm">
            <UnknownIcon className="w-12 h-12 sm:w-16 sm:h-16 mb-3 mx-auto text-text-muted opacity-50" />
            <p className="text-text-muted text-sm sm:text-base font-semibold">{error}</p>
          </div>
        </main>
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh bg-bg text-text-main overflow-hidden relative w-full max-w-full">

      {/* 🟢 INTÉGRATION DE LA MODALE */}
      <AuthModals isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

      {/* MODALE PARAMÈTRES */}
      {showSettingsModal && isMyProfile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-bg/70 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto bg-surface border border-border p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-2xl custom-scrollbar">
            <button onClick={() => setShowSettingsModal(false)} className="absolute top-4 right-5 text-text-muted hover:text-text-main transition-colors text-xl">✕</button>
            <h2 className="text-xl sm:text-2xl font-bold mb-5 sm:mb-6 text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Paramètres du Profil</h2>
            {settingStatus.message && (
              <div className={`p-3 mb-4 rounded-xl text-xs sm:text-sm border font-medium transition-all ${settingStatus.type === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-primary/15 text-primary border-primary/40'}`}>
                {settingStatus.message}
              </div>
            )}
            <form onSubmit={handleSettingsSubmit} className="space-y-4 sm:space-y-5">
              <div className="flex flex-col items-center">
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 mb-2 group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <UserAvatar avatarUrl={previewUrl} username={settingUsername} className="w-full h-full text-3xl sm:text-4xl shadow-md transition group-hover:opacity-75" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/50 rounded-full"><span className="text-text-main text-xs px-2 py-1 bg-black/80 rounded">Modifier</span></div>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/jpeg, image/png, image/webp" className="hidden" />
                <p className="text-xs text-text-muted">JPG, PNG, WEBP (Max: 2MB)</p>
              </div>
              <div><label className="block text-xs font-semibold uppercase text-text-muted mb-1">Nom d'utilisateur</label><input type="text" value={settingUsername} onChange={(e) => setSettingUsername(e.target.value)} required minLength={3} maxLength={20} className="w-full rounded-xl border border-border bg-bg/50 px-3.5 py-2 text-sm text-text-main focus:border-primary focus:outline-none" /></div>
              <div><label className="block text-xs font-semibold uppercase text-text-muted mb-1">Surnom (Optionnel)</label><input type="text" value={settingNickname} onChange={(e) => setSettingNickname(e.target.value)} maxLength={20} className="w-full rounded-xl border border-border bg-bg/50 px-3.5 py-2 text-sm text-text-main focus:border-primary focus:outline-none" /></div>
              <div><label className="block text-xs font-semibold uppercase text-text-muted mb-1">Email</label><input type="email" value={settingEmail} onChange={(e) => setSettingEmail(e.target.value)} required className="w-full rounded-xl border border-border bg-bg/50 px-3.5 py-2 text-sm text-text-main focus:border-primary focus:outline-none" /></div>
              <div>
                <label className="block text-xs font-semibold uppercase text-text-muted mb-1">Nouveau mot de passe (laisser vide sinon)</label>
                <div className="relative flex items-center">
                  <input type={showPassword ? 'text' : 'password'} value={settingPassword} onChange={(e) => setSettingPassword(e.target.value)} placeholder="••••••••" minLength={3} maxLength={20} className="w-full pr-10 rounded-xl border border-border bg-bg/50 px-3.5 py-2 text-sm text-text-main focus:border-primary focus:outline-none" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 text-text-muted hover:text-text-muted">{showPassword ? <ClosedEyeIcon className="w-4 h-4" /> : <OpenedEyeIcon className="w-4 h-4" />}</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-text-muted mb-2">Thème de couleur</label>
                <div className="flex flex-wrap gap-3">
                  {[
                    { id: 'theme0', a: '#f8fafc', b: '#020617', name: 'Classique' },
                    { id: 'theme1', a: '#F8F7F4', b: '#0057FF', name: 'Signal Blue' },
                    { id: 'theme2', a: '#FFF275', b: '#3A0CA3', name: 'Butter Yellow' },
                    { id: 'theme3', a: '#B6FF2E', b: '#23262F', name: 'Lime Spark' },
                    { id: 'theme4', a: '#FF4696', b: '#1E1033', name: 'Dragonfruit' },
                    { id: 'theme5', a: '#F8E7C9', b: '#064E3B', name: 'Emerald Ink' },
                    { id: 'theme6', a: '#FFD6A5', b: '#6A00F4', name: 'Ultra Violet' }
                  ].map((t) => (
                    <button 
                      key={t.id} 
                      type="button" 
                      title={t.name}
                      onClick={() => setColorTheme(t.id)} 
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${colorTheme === t.id ? 'border-text-main scale-110 shadow-md' : 'border-transparent hover:scale-110'}`} 
                      style={{ background: `linear-gradient(135deg, ${t.a} 50%, ${t.b} 50%)` }} 
                    />
                  ))}
                </div>
              </div>
              <button type="submit" disabled={settingStatus.type === 'loading'} className="w-full bg-primary text-primary-content font-semibold py-2.5 px-4 rounded-xl hover:bg-primary-hover transition disabled:opacity-50 mt-2 text-sm">{settingStatus.type === 'loading' ? 'Enregistrement...' : 'Enregistrer'}</button>
            </form>
            <div className="mt-6 pt-6 border-t border-border"><TwoFactorSetup /></div>
          </div>
        </div>
      )}

      {/* NAVBAR GLOBALE */}
      <TopNavBar onLoginClick={() => setShowAuthModal(true)} />

      {/* STRUCTURE DE LA PAGE : SIDEBAR + CONTENU */}
      <div className="flex w-full max-w-full pt-16 h-full overflow-hidden">
        {currentUser && <SocialSidebar />}

        <main className={`flex-1 min-w-0 overflow-y-auto p-3 sm:p-6 scroll-smooth custom-scrollbar w-full max-w-full transition-all ${currentUser && !isDesktopSidebarOpen ? 'lg:pl-20' : ''}`}>
          <div className="max-w-3xl mx-auto flex flex-col gap-6 sm:gap-8 pb-20 w-full min-w-0">
            
            <div className="bg-surface rounded-2xl p-5 sm:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 border border-border shadow-lg mt-2 sm:mt-4">
              <UserAvatar avatarUrl={profileData?.avatar} username={getDisplayName(profileData)} className="w-24 h-24 sm:w-32 sm:h-32 text-4xl sm:text-5xl border-4 border-border shadow-xl shrink-0" />
              <div className="flex-1 text-center sm:text-left min-w-0">
                <h1 className="text-2xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-white break-words">{getDisplayName(profileData)}</h1>
                <p className="text-base sm:text-lg text-primary font-medium truncate">@{profileData?.username}</p>
                {profileData?.createdAt && <p className="text-xs sm:text-sm mt-2 sm:mt-3 text-text-muted">Rejoint le {new Date(profileData.createdAt).toLocaleDateString()}</p>}
              </div>
              
              <div className="flex flex-wrap justify-center sm:justify-start gap-2 sm:gap-3 w-full sm:w-auto mt-3 sm:mt-0">
                {/* 🟢 GESTION DES BOUTONS SELON LE STATUT */}
                {!currentUser ? (
                  <>
                    <button onClick={() => setShowAuthModal(true)} className="px-4 sm:px-5 py-2 sm:py-2.5 bg-primary text-primary-content hover:bg-primary-hover rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-sm flex items-center justify-center gap-2">
                      <ChatIcon className="w-4 h-4" /> Message
                    </button>
                    <button onClick={() => setShowAuthModal(true)} className="px-3.5 sm:px-4 py-2 sm:py-2.5 bg-surface hover:bg-surface-hover text-text-main border border-border rounded-xl text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-2">
                      ➕ Ajouter
                    </button>
                  </>
                ) : isMyProfile ? (
                  <button onClick={() => setShowSettingsModal(true)} className="px-5 sm:px-6 py-2 sm:py-2.5 bg-surface-hover hover:bg-border rounded-xl text-xs sm:text-sm font-medium transition-colors border border-border flex items-center justify-center gap-2">
                    <SettingsIcon className="w-5 h-5 inline mr-1" /> Paramètres
                  </button>
                ) : isBlocked ? (
                  <button onClick={() => unblockUser(profileData.id)} className="px-5 sm:px-6 py-2 sm:py-2.5 bg-surface-hover hover:bg-emerald-500/20 hover:text-emerald-400 text-text-muted rounded-xl text-xs sm:text-sm font-medium transition-colors border border-border flex items-center justify-center gap-2">
                    🔓 Débloquer
                  </button>
                ) : (
                  <>
                    <button onClick={handleSendMessage} className="px-4 sm:px-5 py-2 sm:py-2.5 bg-primary text-primary-content hover:bg-primary-hover rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-sm flex items-center justify-center gap-2">
                      <ChatIcon className="w-4 h-4" /> Message
                    </button>
                    {isFriend ? (
                      <button onClick={() => removeFriend(profileData.id)} className="px-3.5 sm:px-4 py-2 sm:py-2.5 bg-surface-hover hover:bg-red-500/20 hover:text-red-400 text-text-muted rounded-xl text-xs sm:text-sm font-medium transition-colors border border-border flex items-center justify-center gap-2">
                        Retirer
                      </button>
                    ) : (
                      <button onClick={async () => { try { await sendRequest(profileData.username); alert("Demande d'ami envoyée !"); } catch (e: any) { alert(e.response?.data?.message || "Erreur."); } }} className="px-3.5 sm:px-4 py-2 sm:py-2.5 bg-surface hover:bg-surface-hover text-text-main border border-border rounded-xl text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-2">
                        ➕ Ajouter
                      </button>
                    )}
                    <button onClick={() => blockUser(profileData.id)} className="px-3.5 sm:px-4 py-2 sm:py-2.5 bg-surface-hover hover:bg-yellow-500/20 hover:text-yellow-500 text-text-muted rounded-xl text-xs sm:text-sm font-medium transition-colors border border-border flex items-center justify-center gap-2">
                      Bloquer
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* MUR DE POSTS */}
            <div className="flex flex-col gap-4 sm:gap-6">
              <h2 className="text-lg sm:text-xl font-bold text-text-main border-b border-border pb-2">
                Publications de {getDisplayName(profileData)}
              </h2>

              {isBlocked ? (
                <div className="text-center p-8 sm:p-10 bg-surface/50 rounded-2xl border border-border border-dashed">
                  <ForbiddenIcon className="w-12 h-12 sm:w-16 sm:h-16 mb-3 mx-auto text-red-500/50" />
                  <p className="text-text-muted text-sm">Vous avez bloqué cet utilisateur.</p>
                </div>
              ) : posts.length === 0 ? (
                <div className="text-center p-8 sm:p-10 bg-surface/50 rounded-2xl border border-border border-dashed">
                  <span className="text-4xl sm:text-5xl mb-3 block opacity-50">🏜️</span>
                  <p className="text-text-muted text-sm">Aucune publication à afficher.</p>
                </div>
              ) : (
                posts.map((post) => (
                  <div key={post.id} className="w-full bg-surface rounded-2xl border border-border shadow-sm flex flex-col">
                    <div className="p-3 sm:p-5 flex items-center gap-3 sm:gap-4">
                      <UserAvatar avatarUrl={post.author.avatar} username={getDisplayName(post.author)} className="w-10 h-10 sm:w-12 sm:h-12 border border-border shrink-0" onClick={() => navigate(`/${post.author.username}`)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm sm:text-base text-text-main cursor-pointer hover:underline truncate" onClick={() => navigate(`/${post.author.username}`)}>{getDisplayName(post.author)}</span>
                          <span className="text-[10px] uppercase font-bold text-text-muted bg-surface-hover px-2 py-0.5 rounded-md border border-border">{post.isPublic ? <><GlobeIcon className="w-3.5 h-3.5 inline mr-1 -mt-0.5" /> Public</> : <><FriendsIcon className="w-3.5 h-3.5 inline mr-1 -mt-0.5" /> Amis</>}</span>
                        </div>
                        <span className="text-[11px] sm:text-xs text-text-muted">{new Date(post.createdAt).toLocaleString()}</span>
                      </div>
                    </div>

                    {post.content && <div className="px-3 sm:px-5 pb-3 sm:pb-4 text-text-main whitespace-pre-wrap leading-relaxed text-xs sm:text-sm break-words">{post.content}</div>}
                    
                    {post.imageUrl && (
                      <div className="w-full bg-surface/40 border-y border-border overflow-hidden flex items-center justify-center max-h-[550px]">
                        <img 
                          src={`/api${post.imageUrl}`} 
                          alt="Contenu du post" 
                          className="w-auto h-auto max-w-full max-h-[550px] object-contain mx-auto" 
                          loading="lazy"
                        />
                      </div>
                    )}
                    
                    <div className="px-3 sm:px-5 py-2.5 sm:py-3 flex gap-4 sm:gap-8 border-t border-border/50 bg-surface/50">
                      <button onClick={() => currentUser ? toggleLike(post.id) : setShowAuthModal(true)} className={`flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium transition-colors ${post.likes.length > 0 ? 'text-pink-500 hover:text-pink-400' : 'text-text-muted hover:text-text-muted'}`}>
                        {post.likes.length > 0 ? <LikeIcon className="w-4 h-4 fill-current" /> : <LikeIcon className="w-4 h-4" />} {post._count.likes}
                      </button>
                      <button onClick={() => setOpenComments({...openComments, [post.id]: !openComments[post.id]})} className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium text-text-muted hover:text-text-muted transition-colors">
                        <BubbleIcon className="w-4 h-4" /> {post._count.comments} Réponses
                      </button>
                    </div>

                    {openComments[post.id] && (
                      <div className="bg-bg p-3 sm:p-5 border-t border-border rounded-b-2xl">
                        <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-5 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                          {post.comments.length === 0 ? (
                            <p className="text-slate-600 text-xs sm:text-sm text-center italic py-2">Aucune réponse pour le moment.</p>
                          ) : (
                            post.comments.map(c => (
                              <div key={c.id} className="flex gap-2 sm:gap-3 text-xs sm:text-sm">
                                <UserAvatar avatarUrl={c.user.avatar} username={getDisplayName(c.user)} className="w-6 h-6 sm:w-7 sm:h-7 text-xs border border-border shrink-0" onClick={() => navigate(`/${c.user.username}`)} />
                                <div className="bg-surface px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl rounded-tl-none border border-border min-w-0 max-w-full">
                                  <span className="font-bold text-primary mr-2 cursor-pointer hover:underline" onClick={() => navigate(`/${c.user.username}`)}>{getDisplayName(c.user)}</span>
                                  <span className="text-text-muted break-words">{c.content}</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                        {currentUser ? (
                          <form onSubmit={(e) => submitComment(e, post.id)} className="flex gap-2 sm:gap-3 items-center">
                            <UserAvatar avatarUrl={currentUser.avatar} username={getDisplayName(currentUser)} className="w-7 h-7 sm:w-8 sm:h-8 text-xs shrink-0" />
                            <input type="text" placeholder="Répondre..." value={commentInputs[post.id] || ''} onChange={(e) => setCommentInputs({...commentInputs, [post.id]: e.target.value})} className="flex-1 bg-surface border border-border rounded-full px-4 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm text-text-main focus:outline-none focus:border-primary transition-colors" />
                            <button type="submit" disabled={!commentInputs[post.id]?.trim()} className="bg-primary text-primary-content w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 disabled:opacity-40 hover:bg-primary-hover text-xs">
                              ➤
                            </button>
                          </form>
                        ) : (
                          <div className="text-center p-2"><button type="button" onClick={() => setShowAuthModal(true)} className="text-xs sm:text-sm text-primary hover:underline">Se connecter pour commenter</button></div>
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
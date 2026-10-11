import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useSocialStore } from '../store/socialStore';
import { useChatStore } from '../store/chatStore';
import { useSocket } from '../hooks/useSocket';
import api from '../api/axios';
import UserAvatar from '../components/UserAvatar';
import SocialSidebar from '../components/SocialSidebar';
import TopNavBar from '../components/TopNavBar';
import AuthModals from '../components/AuthModals';
import { PhotoIcon, GlobeIcon, FriendsIcon, LikeIcon, BubbleIcon, OpenedEyeIcon, ClosedEyeIcon } from '../components/HeaderIcons';

interface Comment { id: number; content: string; createdAt: string; user: any; }
interface Post {
  id: number; content: string; imageUrl: string | null; isPublic: boolean;
  isHidden?: boolean; createdAt: string;
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
  const location = useLocation();
  
  const user = useAuthStore((state: any) => state.user);
  const requires2FA = useAuthStore((state: any) => state.requires2FA);
  const loginGlobal = useAuthStore((state: any) => state.login);

  const effectiveUser = requires2FA ? null : user;
  
  const { socket } = useSocket('/'); 
  const { fetchAllSocialData, blockedUsers, isDesktopSidebarOpen } = useSocialStore(); 
  const isChatOpen = useChatStore((state) => state.isChatOpen);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  const [posts, setPosts] = useState<Post[]>([]);
  const [uploadError, setUploadError] = useState('');
  const [menuOpenPostId, setMenuOpenPostId] = useState<number | null>(null);

  const deletePost = async (postId: number) => {
    if (!confirm("Voulez-vous vraiment supprimer cette publication ?")) return;
    try {
      await api.delete(`/posts/${postId}`);
      setPosts(posts.filter(p => p.id !== postId));
      setMenuOpenPostId(null);
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la suppression.");
    }
  };

  const updatePostVisibility = async (postId: number, isPublic: boolean, isHidden: boolean) => {
    try {
      const { data } = await api.patch(`/posts/${postId}/visibility`, { isPublic, isHidden });
      setPosts(posts.map(p => p.id === postId ? data : p));
      setMenuOpenPostId(null);
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la mise à jour.");
    }
  };

  const [newPostContent, setNewPostContent] = useState('');
  const [newPostImage, setNewPostImage] = useState<File | null>(null);
  const [newPostPreview, setNewPostPreview] = useState<string | null>(null);
  const [isPublicPost, setIsPublicPost] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});
  const [openComments, setOpenComments] = useState<Record<number, boolean>>({});

  const userIdRef = useRef<number | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      localStorage.setItem('access_token', token);
      
      // On nettoie l'URL pour ne pas boucler
      navigate('/', { replace: true });
      
      api.get('/auth/profile', { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => {
          loginGlobal(res.data, token);
        })
        .catch(() => { 
          setAuthView('login');
          setShowAuthModal(true);
        });
    }
  }, [searchParams, navigate, loginGlobal]);

  const loadFeed = async () => {
    if (useAuthStore.getState().requires2FA) return; 
    try {
      const feedRes = await api.get<Post[]>('/posts/feed');
      setPosts(feedRes.data);
    } catch (err) {}
  };

  useEffect(() => {
    loadFeed();
  }, [location.key, user]);

  useEffect(() => {
    if (!isChatOpen) {
      loadFeed();
    }
  }, [isChatOpen]);

  useEffect(() => {
    const handleFocus = () => {
      if (document.visibilityState === 'visible') loadFeed();
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  useEffect(() => {
    if (user) {
      if (!userIdRef.current) userIdRef.current = user.id;
      fetchAllSocialData();
    }
  }, [user, fetchAllSocialData]);

  useEffect(() => {
    if (socket && user) {
      const handleSocialUpdate = (data: any) => {
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

  const submitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim() && !newPostImage) return;
    setIsPosting(true);
    setUploadError(''); // Réinitialise l'erreur précédente

    try {
      const formData = new FormData();
      formData.append('content', newPostContent); 
      formData.append('isPublic', isPublicPost.toString());
      if (newPostImage) formData.append('image', newPostImage);
    
      const res = await api.post('/posts', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    
      setPosts([{...res.data, likes: [], comments: [], _count: { likes: 0, comments: 0 }}, ...posts]);
      setNewPostContent(''); 
      setNewPostImage(null); 
      setNewPostPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    
    } catch (err: any) {
      // Intercepte l'erreur 400 renvoyée par le MagicBytesValidationPipe
      if (err.response?.status === 400) {
        setUploadError(err.response.data.message || "Le fichier envoyé n'est pas une image valide.");
      } else {
        setUploadError("Une erreur est survenue lors de la publication.");
      }
    } finally { 
      setIsPosting(false); 
    }
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
    const content = commentInputs[postId];
    if (!content?.trim()) return;
    
    setCommentInputs(prev => ({ ...prev, [postId]: '' })); // Clear immediately
    
    try {
      const res = await api.post(`/posts/${postId}/comment`, { content });
      setPosts(posts.map(post => post.id === postId ? { ...post, comments: [...post.comments, res.data], _count: { ...post._count, comments: post._count.comments + 1 } } : post));
    } catch (err) {
      setCommentInputs(prev => ({ ...prev, [postId]: content })); // Restore on error
    }
  };

  const visiblePosts = posts.filter(post => 
    !blockedUsers.some(blocked => blocked.id === post.author.id)
  );

  return (
    <div className="flex h-dvh bg-surface text-text-main overflow-hidden relative w-full max-w-full">
      
      <AuthModals isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} initialView={authView} />

      <TopNavBar onLoginClick={() => { setAuthView('login'); setShowAuthModal(true); }} />

      <div className="flex w-full pt-16 h-full max-w-full overflow-hidden">
        {effectiveUser ? (
          <SocialSidebar />
        ) : (
          <aside className="hidden lg:flex w-80 bg-surface-hover/50 border-r border-border flex-col h-full items-center justify-center p-6 text-center shrink-0">
            <span className="text-5xl mb-4">👋</span>
            <h3 className="font-bold mb-2">Rejoignez le réseau</h3>
            <p className="text-text-muted text-sm mb-4">Connectez-vous pour interagir.</p>
            <button onClick={() => { setAuthView('login'); setShowAuthModal(true); }} className="w-full py-2 bg-primary text-primary-content hover:bg-primary-hover rounded-lg mb-2 font-semibold transition-colors shadow-sm">Se connecter</button>
            <button onClick={() => { setAuthView('register'); setShowAuthModal(true); }} className="w-full py-2 bg-surface hover:bg-surface-hover text-text-main border border-border rounded-lg font-medium transition-colors">Créer un compte</button>
          </aside>
        )}

        <main className={`flex-1 overflow-y-auto p-3 sm:p-6 scroll-smooth custom-scrollbar w-full max-w-full min-w-0 transition-all ${user && !isDesktopSidebarOpen ? 'lg:pl-20' : ''}`}>
          <div className="max-w-2xl mx-auto flex flex-col gap-4 sm:gap-6 pb-20 w-full max-w-full">
            <h1 className="text-xl sm:text-2xl font-bold text-text-main">Fil d'actualité</h1>

            {!effectiveUser && (
              <div className="lg:hidden bg-surface-hover/80 border border-border p-4 rounded-xl text-center shadow-sm">
                <span className="text-3xl mb-2 block">👋</span>
                <h3 className="font-bold text-sm mb-1">Rejoignez le réseau</h3>
                <p className="text-text-muted text-xs mb-3">Connectez-vous pour interagir avec les joueurs.</p>
                <div className="flex gap-2 justify-center">
                  <button onClick={() => { setAuthView('login'); setShowAuthModal(true); }} className="px-4 py-1.5 bg-primary text-primary-content hover:bg-primary-hover rounded-lg text-xs font-semibold transition-colors shadow-sm">Se connecter</button>
                  <button onClick={() => { setAuthView('register'); setShowAuthModal(true); }} className="px-4 py-1.5 bg-surface hover:bg-surface-hover text-text-main border border-border rounded-lg text-xs font-medium transition-colors">Créer un compte</button>
                </div>
              </div>
            )}

            {effectiveUser && (
              <div className="w-full bg-surface-hover p-4 sm:p-5 rounded-xl border border-border shadow-sm">
                <form onSubmit={submitPost} className="flex flex-col gap-3 sm:gap-4">
                  <div className="flex gap-3 sm:gap-4">
                    <UserAvatar avatarUrl={user?.avatar} username={getDisplayName(user)} className="w-9 h-9 sm:w-10 sm:h-10 border border-border-subtle shrink-0" onClick={() => navigate(`/user/${user.username}`)} />
                    <div className="flex-1 relative">
                      <textarea 
                        placeholder={`Quoi de neuf, ${getDisplayName(user)} ?`} 
                        value={newPostContent} 
                        maxLength={5000}
                        onChange={(e) => setNewPostContent(e.target.value)} 
                        className="w-full bg-surface/50 rounded-lg py-2.5 sm:py-3 px-3 sm:px-4 pb-6 border border-border focus:border-primary focus:outline-none resize-none min-h-[75px] text-xs sm:text-sm" 
                      />
                      <div className={`absolute bottom-2 right-2 text-[10px] font-medium pointer-events-none ${newPostContent.length >= 5000 ? 'text-red-500' : 'text-text-muted'}`}>
                        {newPostContent.length}/5000
                      </div>
                    </div>
                  </div>
                  {newPostPreview && (
                    <div className="relative ml-0 sm:ml-14">
                      <img src={newPostPreview} alt="Preview" className="rounded-lg max-h-48 sm:max-h-60 object-contain bg-surface border border-border" />
                      <button type="button" onClick={() => { setNewPostImage(null); setNewPostPreview(null); }} className="absolute top-2 right-2 bg-surface-hover/80 p-1.5 rounded-full hover:bg-red-500 text-xs">✕</button>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 ml-0 sm:ml-14">
                    <div className="flex gap-3 sm:gap-4 items-center justify-between sm:justify-start">
                      <button type="button" title="Ajouter une image" onClick={() => fileInputRef.current?.click()} className="text-primary flex items-center justify-center p-2 rounded-full hover:bg-primary/10 transition-colors"><PhotoIcon className="w-6 h-6 sm:w-7 sm:h-7" /></button>
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" ref={fileInputRef} onChange={(e) => {const f = e.target.files?.[0]; if(f){setNewPostImage(f); setNewPostPreview(URL.createObjectURL(f));}}} />
                      
                      <div className="relative flex items-center">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 -mt-[1.5px] text-text-muted pointer-events-none flex items-center justify-center">
                          {isPublicPost ? <GlobeIcon className="w-3.5 h-3.5" /> : <FriendsIcon className="w-3.5 h-3.5" />}
                        </span>
                        <select value={isPublicPost ? "public" : "friends"} onChange={(e) => setIsPublicPost(e.target.value === "public")} className="bg-surface border border-border text-xs rounded py-1.5 pl-7 pr-2 text-text-main outline-none appearance-none cursor-pointer">
                          <option value="public">Public</option>
                          <option value="friends">Amis uniquement</option>
                        </select>
                      </div>
                    </div>
					{uploadError && (
					<div className="p-3 text-xs sm:text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl">
						{uploadError}
					</div>
					)}
                    <button type="submit" disabled={isPosting || (!newPostContent.trim() && !newPostImage)} className="w-full sm:w-auto bg-primary text-primary-content hover:bg-primary-hover px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm">Publier</button>
                  </div>
                </form>
              </div>
            )}

            {visiblePosts.map((post) => (
              <div key={post.id} className={`w-full bg-surface-hover rounded-xl border border-border shadow-sm flex flex-col ${post.isHidden ? "opacity-60 saturate-50" : ""}`}>
                <div className="p-3 sm:p-4 flex items-center gap-3">
                  <UserAvatar avatarUrl={post.author.avatar} username={getDisplayName(post.author)} className="w-9 h-9 sm:w-10 sm:h-10 border border-border-subtle shrink-0" onClick={() => navigate(`/user/${post.author.username}`)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold font-rounded text-sm sm:text-base cursor-pointer hover:underline truncate" onClick={() => navigate(`/user/${post.author.username}`)}>{getDisplayName(post.author)}</span>
                      <span className="text-[10px] uppercase font-bold text-text-muted bg-surface px-2 py-0.5 rounded border border-border">{post.isPublic ? <><GlobeIcon className="w-3.5 h-3.5 inline mr-1 -mt-0.5" /> Public</> : <><FriendsIcon className="w-3.5 h-3.5 inline mr-1 -mt-0.5" /> Amis</>}</span>
                      {post.isHidden && <span className="text-[10px] uppercase font-bold text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20"><ClosedEyeIcon className="w-3.5 h-3.5 inline mr-1 -mt-0.5" /> Masqué</span>}
                    </div>
                    <span className="text-[11px] sm:text-xs text-text-muted">{new Date(post.createdAt).toLocaleString()}</span>
                  </div>

                  {post.author.id === user?.id && (
                    <div className="relative ml-auto self-start" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => setMenuOpenPostId(menuOpenPostId === post.id ? null : post.id)} className="p-1.5 text-text-muted hover:text-text-main rounded-lg hover:bg-surface transition-colors">
                        ⋮
                      </button>
                      {menuOpenPostId === post.id && (
                        <div className="absolute right-0 mt-1 w-48 bg-surface-hover border border-border rounded-lg shadow-xl z-20 py-1 overflow-hidden">
                          <button onClick={() => updatePostVisibility(post.id, !post.isPublic, post.isHidden || false)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface text-text-main flex items-center gap-2 font-medium">
                            {post.isPublic ? <FriendsIcon className="w-4 h-4"/> : <GlobeIcon className="w-4 h-4"/>} 
                            Passer en {post.isPublic ? 'Amis' : 'Public'}
                          </button>
                          <button onClick={() => updatePostVisibility(post.id, post.isPublic, !post.isHidden)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface text-text-main flex items-center gap-2 font-medium">
                            {post.isHidden ? <><OpenedEyeIcon className="w-4 h-4"/> Rendre visible</> : <><ClosedEyeIcon className="w-4 h-4"/> Masquer du profil</>}
                          </button>
                          <div className="h-px bg-border my-1"></div>
                          <button onClick={() => deletePost(post.id)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface text-red-500 flex items-center gap-2 font-medium">
                            <span className="font-bold text-lg leading-none mt-[-2px]">✕</span> Supprimer
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {post.content && <div className="px-3 sm:px-4 pb-3 whitespace-pre-wrap text-xs sm:text-sm break-words">{post.content}</div>}
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
                
                <div className="px-3 sm:px-4 py-2.5 sm:py-3 flex gap-4 sm:gap-6 border-t border-border/50">
                  <button onClick={() => { if (!user) { setAuthView('login'); setShowAuthModal(true); } else toggleLike(post.id); }} className={`flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium transition-colors ${post.likes.length > 0 ? 'text-pink-500 hover:text-pink-400' : 'text-text-muted hover:text-text-main'}`}>
                    {post.likes.length > 0 ? <LikeIcon className="w-4 h-4 fill-current" /> : <LikeIcon className="w-4 h-4" />} {post._count.likes}
                  </button>
                  <button onClick={() => setOpenComments({...openComments, [post.id]: !openComments[post.id]})} className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-text-muted hover:text-text-main transition-colors">
                    <BubbleIcon className="w-4 h-4" /> {post._count.comments} Commentaires
                  </button>
                </div>

                {openComments[post.id] && (
                  <div className="bg-surface/50 p-3 sm:p-4 border-t border-border">
                    <div className="space-y-3 mb-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                      {post.comments.length === 0 ? (
                        <p className="text-center text-xs text-text-muted py-2">Aucun commentaire pour le moment.</p>
                      ) : (
                        post.comments.map(c => (
                          <div key={c.id} className="flex gap-2 sm:gap-3 text-xs sm:text-sm">
                            <UserAvatar avatarUrl={c.user.avatar} username={getDisplayName(c.user)} className="w-6 h-6 text-xs border border-border shrink-0" onClick={() => navigate(`/user/${c.user.username}`)} />
                            <div className="bg-surface-hover px-3 py-2 rounded-xl rounded-tl-none border border-border min-w-0 max-w-full">
                              <span className="font-semibold text-text-muted mr-2 cursor-pointer hover:underline" onClick={() => navigate(`/user/${c.user.username}`)}>{getDisplayName(c.user)}</span>
                              <span className="text-text-main break-words">{c.content}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    {effectiveUser ? (
                      <form onSubmit={(e) => submitComment(e, post.id)} className="flex gap-2 items-center">
                        <UserAvatar avatarUrl={user?.avatar} username={getDisplayName(user)} className="w-7 h-7 sm:w-8 sm:h-8 text-xs border border-border shrink-0" />
                        <input type="text" placeholder="Ajouter un commentaire..." value={commentInputs[post.id] || ''} onChange={(e) => setCommentInputs({...commentInputs, [post.id]: e.target.value})} className="flex-1 min-w-0 bg-surface-hover border border-border-subtle rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm focus:outline-none focus:border-primary" />
                        <button type="submit" disabled={!commentInputs[post.id]?.trim()} className="bg-primary text-primary-content w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 disabled:opacity-40 hover:bg-primary-hover text-xs">
                          ➤
                        </button>
                      </form>
                    ) : (
                      <div className="text-center p-2"><button type="button" onClick={() => { setAuthView('login'); setShowAuthModal(true); }} className="text-xs sm:text-sm text-primary hover:underline">Se connecter pour commenter</button></div>
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
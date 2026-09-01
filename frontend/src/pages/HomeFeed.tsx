import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useSocialStore } from '../store/socialStore';
import { useSocket } from '../hooks/useSocket';
import api from '../api/axios';
import UserAvatar from '../components/UserAvatar';
import SocialSidebar from '../components/SocialSidebar';
import TopNavBar from '../components/TopNavBar';
import AuthModals from '../components/AuthModals';

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
  
  const user = useAuthStore((state: any) => state.user);
  const loginGlobal = useAuthStore((state: any) => state.login);
  
  const { socket } = useSocket('/'); 
  const { fetchAllSocialData, blockedUsers } = useSocialStore(); 

  const [showAuthModal, setShowAuthModal] = useState(false);
  // 🟢 NOUVEL ÉTAT : retient quelle vue on veut ouvrir
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

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

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      localStorage.setItem('access_token', token);
      api.get('/auth/profile', { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => {
          loginGlobal(res.data, token);
          navigate('/', { replace: true });
        })
        .catch(() => { 
          setAuthView('login'); 
          setShowAuthModal(true); 
        });
    }
  }, [searchParams, navigate, loginGlobal]);

  const loadFeed = async () => {
    try {
      const feedRes = await api.get<Post[]>('/posts/feed');
      setPosts(feedRes.data);
    } catch (err) {}
  };

  useEffect(() => {
    loadFeed();
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

  const visiblePosts = posts.filter(post => 
    !blockedUsers.some(blocked => blocked.id === post.author.id)
  );

  return (
    <div className="flex h-screen bg-slate-900 text-white overflow-hidden relative">
      
      {/* 🟢 INTÉGRATION DE LA MODALE AVEC LA PROP initialView */}
      <AuthModals isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} initialView={authView} />

      {/* 🟢 NAVBAR GLOBALE */}
      <TopNavBar onLoginClick={() => { setAuthView('login'); setShowAuthModal(true); }} />

      <div className="flex w-full pt-16 h-full">
        {/* SIDEBAR */}
        {user ? (
          <SocialSidebar />
        ) : (
          <aside className="hidden lg:flex w-80 bg-slate-800/50 border-r border-slate-700 flex-col h-full items-center justify-center p-6 text-center">
            <span className="text-5xl mb-4">👋</span>
            <h3 className="font-bold mb-2">Rejoignez le réseau</h3>
            <p className="text-slate-400 text-sm mb-4">Connectez-vous pour interagir.</p>
            {/* 🟢 BOUTONS QUI CHANGERONT LA VUE DE LA MODALE */}
            <button onClick={() => { setAuthView('login'); setShowAuthModal(true); }} className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded-lg mb-2">Se connecter</button>
            <button onClick={() => { setAuthView('register'); setShowAuthModal(true); }} className="w-full py-2 bg-slate-700 hover:bg-slate-600 rounded-lg">Créer un compte</button>
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
            {visiblePosts.map((post) => (
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
                  <button onClick={() => { if (!user) { setAuthView('login'); setShowAuthModal(true); } else toggleLike(post.id); }} className={`flex items-center gap-2 text-sm font-medium transition-colors ${post.likes.length > 0 ? 'text-pink-500 hover:text-pink-400' : 'text-slate-400 hover:text-slate-200'}`}>
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
                      <div className="text-center p-2"><button type="button" onClick={() => { setAuthView('login'); setShowAuthModal(true); }} className="text-sm text-indigo-400 hover:underline">Se connecter pour commenter</button></div>
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
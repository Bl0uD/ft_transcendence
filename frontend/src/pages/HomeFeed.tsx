import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../api/axios';
import { io } from 'socket.io-client';

const socket = io({ path: '/socket.io' });

// --- INTERFACES ---
interface User {
  id: number;
  username: string;
  avatar?: string | null;
}

interface FriendRequest {
  id: number;
  status: string;
  createdAt: string;
  requester: User;
}

interface Comment {
  id: number;
  content: string;
  createdAt: string;
  user: User;
}

interface Post {
  id: number;
  content: string;
  imageUrl: string | null;
  isPublic: boolean;
  createdAt: string;
  author: User;
  likes: { id: number }[];
  comments: Comment[];
  _count: {
    likes: number;
    comments: number;
  };
}

export default function HomeFeed() {
  const navigate = useNavigate();
  const user = useAuthStore((state: any) => state.user);
  const logout = useAuthStore((state: any) => state.logout);

  // --- ÉTATS SOCIAUX ---
  const [activeTab, setActiveTab] = useState<'friends' | 'pending' | 'blocked'>('friends');
  const [friends, setFriends] = useState<User[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<User[]>([]);
  const [targetUsername, setTargetUsername] = useState('');
  const [socialError, setSocialError] = useState<string | null>(null);

  // --- ÉTATS DU FEED ---
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

  // --- CHARGEMENT DES DONNÉES ---
  const loadData = async () => {
    try {
      setSocialError(null);
      
      if (!userIdRef.current) {
        if (user?.id) {
          userIdRef.current = user.id;
        } else {
          const profileRes = await api.get('/auth/profile');
          userIdRef.current = profileRes.data.userId || profileRes.data.sub || profileRes.data.id; 
        }
      }

      // On charge le feed et les données sociales en parallèle
      const [friendsRes, pendingRes, blockedRes, feedRes] = await Promise.all([
        api.get<User[]>('/friends'),
        api.get<FriendRequest[]>('/friends/requests/pending'),
        api.get<User[]>('/friends/blocked'),
        api.get<Post[]>('/posts/feed'),
      ]);
      
      setFriends(friendsRes.data);
      setPendingRequests(pendingRes.data);
      setBlockedUsers(blockedRes.data);
      setPosts(feedRes.data);
    } catch (err: any) {
      console.error('Erreur lors du chargement des données', err);
    }
  };

  useEffect(() => {
    loadData();

    socket.on('socialUpdate', (data: { userId: number }) => {
      if (data.userId === userIdRef.current) {
        loadData();
      }
    });

    return () => {
      socket.off('socialUpdate');
    };
  }, []);

  // --- LOGIQUE FEED ---
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewPostImage(file);
      setNewPostPreview(URL.createObjectURL(file));
    }
  };

  const submitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim() && !newPostImage) return;

    setIsPosting(true);
    try {
      const formData = new FormData();
      formData.append('content', newPostContent);
      formData.append('isPublic', isPublicPost.toString());
      if (newPostImage) {
        formData.append('image', newPostImage);
      }

      const res = await api.post('/posts', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // On s'assure que likes et comments sont toujours des tableaux
      const newPost = {
        ...res.data,
        likes: res.data.likes || [],
        comments: res.data.comments || [],
        _count: res.data._count || { likes: 0, comments: 0 }
      };

      // Ajouter le nouveau post au début de la liste
      setPosts([newPost, ...posts]);
      
      // Reset form
      setNewPostContent('');
      setNewPostImage(null);
      setNewPostPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error('Erreur de création de post', err);
    } finally {
      setIsPosting(false);
    }
  };

  const toggleLike = async (postId: number) => {
    try {
      const res = await api.post(`/posts/${postId}/like`);
      const isLiked = res.data.liked;
      
      setPosts(posts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            likes: isLiked ? [{ id: userIdRef.current! }] : [],
            _count: {
              ...post._count,
              likes: isLiked ? post._count.likes + 1 : post._count.likes - 1
            }
          };
        }
        return post;
      }));
    } catch (err) {
      console.error('Erreur like', err);
    }
  };

  const submitComment = async (e: React.FormEvent, postId: number) => {
    e.preventDefault();
    const content = commentInputs[postId];
    if (!content?.trim()) return;

    try {
      const res = await api.post(`/posts/${postId}/comment`, { content });
      
      setPosts(posts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            comments: [...post.comments, res.data],
            _count: { ...post._count, comments: post._count.comments + 1 }
          };
        }
        return post;
      }));

      // Vider l'input du commentaire spécifique
      setCommentInputs({ ...commentInputs, [postId]: '' });
    } catch (err) {
      console.error('Erreur commentaire', err);
    }
  };

  // --- LOGIQUE SOCIALE ---
  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUsername.trim()) return;
    try {
      setSocialError(null);
      await api.post('/friends/request', { username: targetUsername.trim() });
      setTargetUsername('');
      loadData();
    } catch (err: any) {
      const message = err.response?.data?.message || 'Erreur lors de l\'envoi';
      setSocialError(typeof message === 'string' ? message : JSON.stringify(message));
    }
  };

  const handleAcceptRequest = async (requestId: number) => {
    try { await api.put('/friends/accept', { requestId }); loadData(); } catch (err) {}
  };

  const handleBlockUser = async (targetUserId: number) => {
    try { await api.post('/friends/block', { targetUserId }); loadData(); } catch (err) {}
  };

  const handleRemoveOrUnblock = async (targetUserId: number, isBlocked: boolean) => {
    try {
      if (isBlocked) await api.delete(`/friends/block/${targetUserId}`);
      else await api.delete(`/friends/${targetUserId}`);
      loadData();
    } catch (err) {}
  };

  return (
    <div className="flex h-screen bg-slate-900 text-white overflow-hidden">
      
      {/* --- NAVBAR --- */}
      <nav className="fixed top-0 left-0 w-full h-16 bg-slate-800 border-b border-slate-700 z-50 flex items-center justify-between px-6 shadow-md">
        <div 
          onClick={() => navigate(`/${user?.username}`)}
          className="flex items-center gap-3 cursor-pointer hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
          title="Aller sur mon profil"
        >
          <img 
            src={user?.avatar || '/default-avatar.png'} 
            alt="Avatar" 
            className="w-10 h-10 rounded-full object-cover border border-slate-600 shadow-sm"
          />
          <span className="font-semibold text-lg">{user?.username}</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/chat')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium transition-colors flex items-center gap-2"
          >
            💬 Chat
          </button>
          <button 
            onClick={logout}
            className="px-4 py-2 bg-red-600/90 hover:bg-red-500 rounded text-sm font-medium transition-colors shadow-md"
          >
            Se déconnecter
          </button>
        </div>
      </nav>

      {/* --- CONTENU --- */}
      <div className="flex w-full pt-16 h-full">
        
        {/* --- ZONE DU FEED (CENTRE) --- */}
        <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="max-w-2xl mx-auto flex flex-col gap-6 pb-20">
            
            <h1 className="text-2xl font-bold text-slate-100">Fil d'actualité</h1>

            {/* CRÉATION DE POST */}
            <div className="w-full bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-sm">
              <form onSubmit={submitPost} className="flex flex-col gap-4">
                <div className="flex gap-4">
                  <img 
                    src={user?.avatar || '/default-avatar.png'} 
                    alt="Avatar" 
                    className="w-10 h-10 rounded-full object-cover border border-slate-600 cursor-pointer hover:opacity-80 transition-opacity" 
                    onClick={() => navigate(`/${user?.username}`)} 
                  />
                  <textarea 
                    placeholder={`Quoi de neuf, ${user?.username} ?`}
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    className="flex-1 bg-slate-900/50 rounded-lg py-3 px-4 text-slate-200 border border-slate-700 hover:border-slate-500 focus:border-indigo-500 focus:outline-none transition-colors resize-none min-h-[80px]"
                  />
                </div>
                
                {newPostPreview && (
                  <div className="relative ml-14">
                    <img src={newPostPreview} alt="Preview" className="rounded-lg max-h-60 object-contain bg-slate-900 border border-slate-700" />
                    <button 
                      type="button" 
                      onClick={() => { setNewPostImage(null); setNewPostPreview(null); if(fileInputRef.current) fileInputRef.current.value = ''; }}
                      className="absolute top-2 right-2 bg-slate-800/80 text-white rounded-full p-1.5 hover:bg-red-500 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                )}

                <div className="flex justify-between items-center ml-14">
                  <div className="flex gap-4 items-center">
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="text-indigo-400 hover:text-indigo-300 font-medium text-sm flex items-center gap-2 transition-colors">
                      📸 Ajouter une image
                    </button>
                    <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageChange} />
                    
                    <select 
                      value={isPublicPost ? "public" : "friends"} 
                      onChange={(e) => setIsPublicPost(e.target.value === "public")}
                      className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded p-1.5 focus:outline-none"
                    >
                      <option value="public">🌐 Public</option>
                      <option value="friends">👥 Amis uniquement</option>
                    </select>
                  </div>
                  
                  <button type="submit" disabled={isPosting || (!newPostContent.trim() && !newPostImage)} className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-indigo-500 disabled:opacity-50 transition-colors">
                    {isPosting ? 'Envoi...' : 'Publier'}
                  </button>
                </div>
              </form>
            </div>

            {/* LISTE DES POSTS */}
            {posts.length === 0 ? (
              <div className="text-center p-10 bg-slate-800/50 rounded-xl border border-slate-700/50">
                <span className="text-4xl mb-3 block">📭</span>
                <p className="text-slate-400">Aucun post à afficher pour le moment.</p>
              </div>
            ) : (
              posts.map((post) => (
                <div key={post.id} className="w-full bg-slate-800 rounded-xl border border-slate-700 shadow-sm overflow-hidden flex flex-col">
                  {/* Header Post */}
                  <div className="p-4 flex items-center gap-3">
                    <img 
                      src={post.author.avatar || '/default-avatar.png'} 
                      alt="Avatar" 
                      className="w-10 h-10 rounded-full object-cover border border-slate-600 cursor-pointer hover:opacity-80 transition-opacity" 
                      onClick={() => navigate(`/${post.author.username}`)}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span 
                          className="font-semibold text-white cursor-pointer hover:underline"
                          onClick={() => navigate(`/${post.author.username}`)}
                        >
                          {post.author.username}
                        </span>
                        <span className="text-xs text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-700">
                          {post.isPublic ? '🌐 Public' : '👥 Amis'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">{new Date(post.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Contenu textuel */}
                  {post.content && (
                    <div className="px-4 pb-3 text-slate-200 whitespace-pre-wrap">
                      {post.content}
                    </div>
                  )}

                  {/* Image éventuelle */}
                  {post.imageUrl && (
                  <div className="w-full bg-slate-900 border-y border-slate-700 flex justify-center max-h-[500px]">
                      <img src={`/api${post.imageUrl}`} alt="Post content" className="object-contain w-full h-full" />
                  </div>
                  )}

                  {/* Actions (Likes / Commentaires) */}
                  <div className="px-4 py-3 flex gap-6 border-t border-slate-700/50">
                    <button 
                      onClick={() => toggleLike(post.id)}
                      className={`flex items-center gap-2 text-sm font-medium transition-colors ${post.likes.length > 0 ? 'text-pink-500 hover:text-pink-400' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      {post.likes.length > 0 ? '❤️' : '🤍'} {post._count.likes}
                    </button>
                    <button 
                      onClick={() => setOpenComments({...openComments, [post.id]: !openComments[post.id]})}
                      className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      💬 {post._count.comments} Commentaires
                    </button>
                  </div>

                  {/* Zone de commentaires */}
                  {openComments[post.id] && (
                    <div className="bg-slate-900/50 p-4 border-t border-slate-700">
                      
                      {/* Liste des commentaires */}
                      <div className="space-y-3 mb-4 max-h-60 overflow-y-auto pr-2">
                        {post.comments.length === 0 ? (
                          <p className="text-slate-500 text-sm text-center">Soyez le premier à commenter !</p>
                        ) : (
                          post.comments.map(comment => (
                            <div key={comment.id} className="flex gap-3 text-sm">
                              <img 
                                src={comment.user.avatar || '/default-avatar.png'} 
                                className="w-6 h-6 rounded-full object-cover cursor-pointer hover:opacity-80" 
                                alt="avatar" 
                                onClick={() => navigate(`/${comment.user.username}`)}
                              />
                              <div className="bg-slate-800 px-3 py-2 rounded-xl rounded-tl-none border border-slate-700">
                                <span 
                                  className="font-semibold text-slate-300 mr-2 cursor-pointer hover:underline"
                                  onClick={() => navigate(`/${comment.user.username}`)}
                                >
                                  {comment.user.username}
                                </span>
                                <span className="text-slate-200">{comment.content}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Input commentaire */}
                      <form onSubmit={(e) => submitComment(e, post.id)} className="flex gap-2">
                        <img src={user?.avatar || '/default-avatar.png'} className="w-8 h-8 rounded-full object-cover" alt="avatar" />
                        <input 
                          type="text" 
                          placeholder="Ajouter un commentaire..." 
                          value={commentInputs[post.id] || ''}
                          onChange={(e) => setCommentInputs({...commentInputs, [post.id]: e.target.value})}
                          className="flex-1 bg-slate-800 border border-slate-600 rounded-full px-4 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                      </form>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </main>

        {/* --- PANNEAU SOCIAL (DROITE) --- */}
        <aside className="hidden lg:flex w-80 xl:w-96 bg-slate-800 border-l border-slate-700 flex-col h-full shadow-xl z-10">
          <div className="p-5 border-b border-slate-700 bg-slate-800/95 sticky top-0">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">👥 Social</h2>
            <form onSubmit={handleSendRequest} className="flex gap-2">
              <input
                type="text"
                placeholder="Ajouter un ami (pseudo)..."
                value={targetUsername}
                onChange={(e) => setTargetUsername(e.target.value)}
                className="p-2 border border-slate-600 rounded bg-slate-900 text-white flex-1 focus:outline-none focus:border-blue-500 text-sm"
              />
              <button type="submit" className="bg-blue-600 px-3 py-2 text-white rounded hover:bg-blue-500 transition text-sm font-medium">Ajouter</button>
            </form>
            {socialError && <p className="text-red-400 text-xs mt-2">{socialError}</p>}
          </div>

          <div className="flex border-b border-slate-700 text-sm bg-slate-800">
            <button onClick={() => setActiveTab('friends')} className={`flex-1 py-3 text-center transition-colors ${activeTab === 'friends' ? 'text-blue-400 border-b-2 border-blue-500 font-semibold' : 'text-slate-400 hover:text-slate-200'}`}>Amis ({friends.length})</button>
            <button onClick={() => setActiveTab('pending')} className={`flex-1 py-3 text-center transition-colors ${activeTab === 'pending' ? 'text-blue-400 border-b-2 border-blue-500 font-semibold' : 'text-slate-400 hover:text-slate-200'}`}>Demandes ({pendingRequests.length})</button>
            <button onClick={() => setActiveTab('blocked')} className={`flex-1 py-3 text-center transition-colors ${activeTab === 'blocked' ? 'text-blue-400 border-b-2 border-blue-500 font-semibold' : 'text-slate-400 hover:text-slate-200'}`}>Bloqués ({blockedUsers.length})</button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-900/20">
            {activeTab === 'friends' && (
              friends.length === 0 ? <p className="text-slate-500 text-center mt-4 text-sm">Aucun ami pour le moment.</p> : (
                friends.map((friend) => (
                  <div key={friend.id} className="flex justify-between items-center p-3 bg-slate-800 border border-slate-700 rounded-lg hover:border-slate-600 transition-colors">
                    <span 
                      className="text-slate-200 font-medium cursor-pointer hover:underline hover:text-indigo-400"
                      onClick={() => navigate(`/${friend.username}`)}
                    >
                      {friend.username}
                    </span>
                    <div className="flex gap-2">
                      <button onClick={() => handleBlockUser(friend.id)} className="px-2 py-1 bg-yellow-600/20 text-yellow-500 hover:bg-yellow-600 hover:text-white rounded text-xs transition-colors">Bloquer</button>
                      <button onClick={() => handleRemoveOrUnblock(friend.id, false)} className="px-2 py-1 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white rounded text-xs transition-colors">Retirer</button>
                    </div>
                  </div>
                ))
              )
            )}
            {activeTab === 'pending' && (
              pendingRequests.length === 0 ? <p className="text-slate-500 text-center mt-4 text-sm">Aucune demande en attente.</p> : (
                pendingRequests.map((req) => (
                  <div key={req.id} className="flex flex-col gap-2 p-3 bg-slate-800 border border-slate-700 rounded-lg">
                    <span className="text-slate-200 text-sm">
                      <span 
                        className="font-semibold text-white cursor-pointer hover:underline"
                        onClick={() => navigate(`/${req.requester.username}`)}
                      >
                        {req.requester.username}
                      </span> vous a envoyé une demande.
                    </span>
                    <button onClick={() => handleAcceptRequest(req.id)} className="w-full py-1.5 bg-green-600/90 hover:bg-green-500 text-white rounded text-sm font-medium transition-colors">Accepter</button>
                  </div>
                ))
              )
            )}
            {activeTab === 'blocked' && (
              blockedUsers.length === 0 ? <p className="text-slate-500 text-center mt-4 text-sm">Aucun utilisateur bloqué.</p> : (
                blockedUsers.map((user) => (
                  <div key={user.id} className="flex justify-between items-center p-3 bg-slate-800 border border-slate-700 rounded-lg">
                    <span className="text-slate-400 line-through">{user.username}</span>
                    <button onClick={() => handleRemoveOrUnblock(user.id, true)} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs transition-colors">Débloquer</button>
                  </div>
                ))
              )
            )}
          </div>
        </aside>

      </div>
    </div>
  );
}
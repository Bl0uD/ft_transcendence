// src/pages/Dashboard.tsx
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import React, { useState, useRef, useEffect } from 'react';
import axios from '../api/axios';
import api from '../api/axios';
import { io } from 'socket.io-client';
import TwoFactorSetup from '../components/TwoFactorSetup';

const socket = io({ path: '/socket.io' });

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

export default function Dashboard() {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const navigate = useNavigate();
  const user = useAuthStore((state: any) => state.user);
  const logout = useAuthStore((state: any) => state.logout);
  const updateUser = useAuthStore((state: any) => state.updateUser);
  
  const [username, setUsername] = useState(user?.username || '');
  const [nickname, setNickname] = useState(user?.nickname || ''); // 👈 FIX : Ajout du state nickname
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>(user?.avatar || '');
  
  const [status, setStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error', message: string }>({ type: 'idle', message: '' });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchroniser la preview et le nickname si le user change
  useEffect(() => {
    if (user?.avatar) {
      setPreviewUrl(user.avatar);
    }
    if (user?.nickname) {
      setNickname(user.nickname);
    }
  }, [user?.avatar, user?.nickname]);

  // Nettoyage de l'URL blob
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl !== user?.avatar && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, user?.avatar]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setStatus({ type: 'error', message: 'Le fichier dépasse la taille maximale (2MB).' });
        return;
      }
      if (!file.type.startsWith('image/')) {
        setStatus({ type: 'error', message: 'Veuillez sélectionner une image valide.' });
        return;
      }

      setAvatarFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setStatus({ type: 'idle', message: '' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: 'loading', message: 'Mise à jour en cours...' });

    try {
      const formData = new FormData();
      formData.append('username', username);

      // Le nickname est optionnel
      if (nickname) {
        formData.append('nickname', nickname);
      }

      if (email) {
        formData.append('email', email);
      }

      if (password) {
        formData.append('password', password);
      }

      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      const response = await axios.put('/users/profile', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        }
      });

      setStatus({ type: 'success', message: 'Profil mis à jour avec succès !' });
      
      updateUser(response.data);
      setAvatarFile(null);
      setPassword('');

    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'Une erreur est survenue lors de la mise à jour.';
      setStatus({ type: 'error', message: errorMsg });
    }
  };



// ** Gestion des onglets sociaux **//



  const [activeTab, setActiveTab] = useState<'friends' | 'pending' | 'blocked'>('friends');
  const [friends, setFriends] = useState<User[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<User[]>([]);
  
  const [targetUsername, setTargetUsername] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 🟢 3. On utilise une Ref pour stocker silencieusement l'ID de l'utilisateur connecté
  const userIdRef = useRef<number | null>(null);

  // Charger les données selon l'onglet
  const loadSocialData = async () => {
    try {
      setError(null);
      
      // Récupérer le profil si on n'a pas encore l'ID courant
      if (!userIdRef.current) {
        const profileRes = await api.get('/auth/profile');
        // Ajuste selon ce que renvoie ta route profile (userId, sub, ou id)
        userIdRef.current = profileRes.data.userId || profileRes.data.sub || profileRes.data.id; 
      }

      const [friendsRes, pendingRes, blockedRes] = await Promise.all([
        api.get<User[]>('/friends'),
        api.get<FriendRequest[]>('/friends/requests/pending'),
        api.get<User[]>('/friends/blocked'),
      ]);
      setFriends(friendsRes.data);
      setPendingRequests(pendingRes.data);
      setBlockedUsers(blockedRes.data);
    } catch (err: any) {
      console.error('Erreur lors du chargement des données sociales', err);
    }
  };

  useEffect(() => {
    loadSocialData();

    // 🟢 4. Écoute de l'événement WebSocket "socialUpdate"
    socket.on('socialUpdate', (data: { userId: number }) => {
	  console.log("🔥 SIGNAL REÇU DU BACKEND POUR L'ID :", data.userId);
      console.log("ID ACTUEL SUR CE NAVIGATEUR :", userIdRef.current);
      if (data.userId === userIdRef.current) {
		console.log("🔄 Rafraîchissement des données en cours...");
        loadSocialData();
      }
    });

    // Nettoyage lors du démontage du composant
    return () => {
      socket.off('socialUpdate');
    };
  }, []);

  // Envoyer une demande d'ami
  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUsername.trim()) return;

    try {
      setError(null);
      await api.post('/friends/request', { username: targetUsername.trim() });
      setTargetUsername('');
      alert('Demande d\'ami envoyée !');
      // Plus besoin d'appeler manuellement loadSocialData() ici, le WebSocket va s'en charger !
    } catch (err: any) {
      const message = err.response?.data?.message || err.response?.data || 'Erreur lors de l\'envoi';
      setError(typeof message === 'string' ? message : JSON.stringify(message));
    }
  };

  // Accepter une demande
  const handleAcceptRequest = async (requestId: number) => {
    try {
      await api.put('/friends/accept', { requestId });
      // Le rafraîchissement est géré par WebSocket
    } catch (err: any) {
      console.error('Erreur acceptation', err);
    }
  };

  // Bloquer un utilisateur
  const handleBlockUser = async (targetUserId: number) => {
    try {
      await api.post('/friends/block', { targetUserId });
    } catch (err: any) {
      console.error('Erreur blocage', err);
    }
  };

  // Supprimer un ami ou débloquer
  const handleRemoveOrUnblock = async (targetUserId: number, isBlocked: boolean) => {
    try {
      if (isBlocked) {
        await api.delete(`/friends/block/${targetUserId}`);
      } else {
        await api.delete(`/friends/${targetUserId}`);
      }
    } catch (err: any) {
      console.error('Erreur suppression/déblocage', err);
    }

// ** End of Gestion des onglets sociaux **//


  };

  return (
    <>
      <div className="flex h-screen flex-col items-center justify-center bg-slate-900 text-white gap-4">
        <h1 className="text-3xl font-bold">Bienvenue sur Transcendence 🏓</h1>
        {user && <p className="text-slate-400">Connecté en tant que : {user.username}</p>}
        
        <div className="flex gap-3 mt-2">
          <button 
            onClick={() => navigate('/chat')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium transition-colors flex items-center gap-2"
          >
            💬 Chat
          </button>
          <button 
            onClick={() => setIsProfileOpen(true)}
            className="fixed top-4 left-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition-colors"
          >
            Mon Profil
          </button>
        </div>
      </div>
      <div 
          onClick={() => setIsProfileOpen(false)}
          className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
            isProfileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          ></div>
      <div 
        className={`fixed top-0 left-0 h-full w-80 sm:w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isProfileOpen ? 'translate-x-0' : '-translate-x-full delay-200'
        }`}
      >
          <div className="min-h-screen max-h-full bg-slate-900 text-white flex flex-col items-center justify-center p-6 gap-6 overflow-y-auto">
            
            <button 
              onClick={() => setIsProfileOpen(false)}
              className="absolute top-4 left-4 text-slate-400 hover:text-white transition-colors focus:outline-none"
              aria-label="Back"
            >
              ← Retour
            </button>
            {user && (
              <div className="text-center">
                <h1 className="text-xl text-slate-300">
                  Connecté en tant que : <span className="font-semibold text-white">{user.username}</span> ({user.email})
                </h1>
                <p className="text-slate-400 text-sm mt-1">Welcome to Transcendence</p>
              </div>
            )}

            <div className="w-full max-w-md bg-slate-800 p-8 border border-slate-700 rounded-lg shadow-lg">
              <h2 className="text-2xl font-bold mb-6 text-white">Paramètres du Profil</h2>

              {status.message && (
                <div className={`p-3 mb-4 rounded text-sm ${status.type === 'error' ? 'bg-red-900/50 text-red-200 border border-red-700' : 'bg-green-900/50 text-green-200 border border-green-700'}`}>
                  {status.message}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                
                {/* Avatar Section */}
                <div className="flex flex-col items-center">
                  <div className="relative w-28 h-28 mb-3 group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <img 
                      src={previewUrl || '/default-avatar.png'} 
                      alt="Avatar de profil" 
                      className="w-full h-full object-cover rounded-full border-2 border-slate-600 shadow-md transition group-hover:opacity-75"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/40 rounded-full">
                      <span className="text-white text-xs px-2 py-1 bg-black/60 rounded">Modifier</span>
                    </div>
                  </div>
                  
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange} 
                    accept="image/jpeg, image/png, image/webp"
                    className="hidden" 
                  />
                  <p className="text-xs text-slate-400">Formats acceptés : JPG, PNG, WEBP (Max: 2MB)</p>
                </div>

                {/* Username Field */}
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-1">
                    New Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    minLength={3}
                    maxLength={20}
                  />
                </div>

                {/* Nickname Field (Optionnel) */}
                <div>
                  <label htmlFor="nickname" className="block text-sm font-medium text-slate-300 mb-1">
                    New Nickname (Optionnel)
                  </label>
                  <input
                    id="nickname"
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    maxLength={20}
                  />
                </div>

                {/* Email Field */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
                    New Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Password Field with Eye Toggle */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
                    New Password
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full p-2.5 pr-10 bg-slate-900 border border-slate-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      minLength={3}
                      maxLength={20}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 text-slate-400 hover:text-white transition-colors focus:outline-none"
                      aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12c1.274 4.057 5.065 7 9.542 7 4.477 0 8.268-2.943 9.542-7-1.274-4.057-5.065-7-9.542-7-4.477 0-8.268 2.943-9.542 7z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={status.type === 'loading'}
                  className="w-full bg-blue-600 text-white font-semibold py-2.5 px-4 rounded hover:bg-blue-500 transition disabled:opacity-50 mt-2"
                >
                  {status.type === 'loading' ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </button>
              </form>
              <TwoFactorSetup />
            </div>  
            <button 
              onClick={logout}
              className="px-6 py-2 bg-red-600 hover:bg-red-500 rounded text-sm font-medium transition-colors shadow-md"
            >
              Se déconnecter
            </button>
          </div>
      </div>
      <div 
      className={`fixed top-0 left-80 sm:left-96 h-full w-80 sm:w-96 bg-slate-900 shadow-2xl z-50 origin-left transform transition-transform duration-300 ease-out ${
        isProfileOpen ? 'scale-x-100 delay-200 ' : 'scale-x-0 pointer-events-none'
        }`}
      >
        <div className="max-w-4xl mx-auto p-6 overflow-y-auto">
            <h1 className="text-2xl font-bold mb-6 text-white">Gestion Sociale</h1>

            {/* Formulaire d'ajout par Pseudo */}
            <form onSubmit={handleSendRequest} className="mb-6 flex gap-2">
              <input
                type="text"
                placeholder="Nom d'utilisateur (ex: Marvin)..."
                value={targetUsername}
                onChange={(e) => setTargetUsername(e.target.value)}
                className="p-2 border border-gray-700 rounded bg-gray-800 text-white flex-1 focus:outline-none focus:border-blue-500"
              />
              <button type="submit" className="bg-blue-600 px-4 py-2 text-white rounded hover:bg-blue-700 transition">
                Ajouter
              </button>
            </form>
            {error && <p className="text-red-400 mb-4">{error}</p>}

            {/* Onglets */}
            <div className="flex border-b border-gray-700 mb-4">
              <button
                onClick={() => setActiveTab('friends')}
                className={`px-4 py-2 text-white border-b-2 ${activeTab === 'friends' ? 'border-blue-500 font-bold' : 'border-transparent'}`}
              >
                Amis ({friends.length})
              </button>
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-4 py-2 text-white border-b-2 ${activeTab === 'pending' ? 'border-blue-500 font-bold' : 'border-transparent'}`}
              >
                En attente ({pendingRequests.length})
              </button>
              <button
                onClick={() => setActiveTab('blocked')}
                className={`px-4 py-2 text-white border-b-2 ${activeTab === 'blocked' ? 'border-blue-500 font-bold' : 'border-transparent'}`}
              >
                Bloqués ({blockedUsers.length})
              </button>
            </div>

            {/* Onglet Amis */}
            {activeTab === 'friends' && (
              <div className="space-y-2">
                {friends.length === 0 ? <p className="text-gray-400">Aucun ami pour le moment.</p> : (
                  friends.map((friend) => (
                    <div key={friend.id} className="flex justify-between items-center p-3 bg-gray-800 rounded">
                      <span className="text-white">{friend.username}</span>
                      <div className="flex gap-2">
                        <button onClick={() => handleBlockUser(friend.id)} className="px-3 py-1 bg-yellow-600 text-white rounded text-sm">
                          Bloquer
                        </button>
                        <button onClick={() => handleRemoveOrUnblock(friend.id, false)} className="px-3 py-1 bg-red-600 text-white rounded text-sm">
                          Retirer
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Onglet En Attente */}
            {activeTab === 'pending' && (
              <div className="space-y-2">
                {pendingRequests.length === 0 ? <p className="text-gray-400">Aucune demande en attente.</p> : (
                  pendingRequests.map((req) => (
                    <div key={req.id} className="flex justify-between items-center p-3 bg-gray-800 rounded">
                      <span className="text-white">{req.requester.username} vous a envoyé une demande.</span>
                      <div className="flex gap-2">
                        <button onClick={() => handleAcceptRequest(req.id)} className="px-3 py-1 bg-green-600 text-white rounded text-sm">
                          Accepter
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Onglet Bloqués */}
            {activeTab === 'blocked' && (
              <div className="space-y-2">
                {blockedUsers.length === 0 ? <p className="text-gray-400">Aucun utilisateur bloqué.</p> : (
                  blockedUsers.map((user) => (
                    <div key={user.id} className="flex justify-between items-center p-3 bg-gray-800 rounded">
                      <span className="text-white">{user.username}</span>
                      <button onClick={() => handleRemoveOrUnblock(user.id, true)} className="px-3 py-1 bg-gray-600 text-white rounded text-sm">
                        Débloquer
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
      </div>
    </>
  );
}
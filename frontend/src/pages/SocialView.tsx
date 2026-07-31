import React, { useEffect, useState, useRef } from 'react';
import api from '../api/axios';
import { io } from 'socket.io-client'; // 🟢 1. Import de Socket.io

// 🟢 2. Connexion au serveur WebSocket (vérifie l'URL et le port selon ton backend)
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

export const SocialView: React.FC = () => {
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
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
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
  );
};
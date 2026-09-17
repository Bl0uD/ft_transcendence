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
    <div className="signal-page min-h-screen">
      <div className="max-w-4xl mx-auto p-6 md:p-10">
      <h1 className="font-display text-4xl font-extrabold tracking-tight mb-8 text-ink">Gestion sociale</h1>

      {/* Formulaire d'ajout par Pseudo */}
      <form onSubmit={handleSendRequest} className="signal-panel mb-6 p-4 flex gap-2">
        <input
          type="text"
          placeholder="Nom d'utilisateur (ex: Marvin)..."
          value={targetUsername}
          onChange={(e) => setTargetUsername(e.target.value)}
          className="signal-input p-3 flex-1"
        />
        <button type="submit" className="signal-button px-4 py-2">
          Ajouter
        </button>
      </form>
      {error && <p className="text-coral mb-4">{error}</p>}

      {/* Onglets */}
      <div className="flex border-b border-line mb-4">
        <button
          onClick={() => setActiveTab('friends')}
          className={`px-4 py-2 text-ink border-b-2 ${activeTab === 'friends' ? 'border-electric font-bold' : 'border-transparent'}`}
        >
          Amis ({friends.length})
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 text-ink border-b-2 ${activeTab === 'pending' ? 'border-electric font-bold' : 'border-transparent'}`}
        >
          En attente ({pendingRequests.length})
        </button>
        <button
          onClick={() => setActiveTab('blocked')}
          className={`px-4 py-2 text-ink border-b-2 ${activeTab === 'blocked' ? 'border-electric font-bold' : 'border-transparent'}`}
        >
          Bloqués ({blockedUsers.length})
        </button>
      </div>

      {/* Onglet Amis */}
      {activeTab === 'friends' && (
        <div className="space-y-2">
          {friends.length === 0 ? <p className="text-ink-soft">Aucun ami pour le moment.</p> : (
            friends.map((friend) => (
              <div key={friend.id} className="signal-panel flex justify-between items-center p-4 mb-2">
                <span className="text-ink font-semibold">{friend.username}</span>
                <div className="flex gap-2">
                  <button onClick={() => handleBlockUser(friend.id)} className="px-3 py-1 bg-acid text-ink rounded-control text-sm font-semibold">
                    Bloquer
                  </button>
                  <button onClick={() => handleRemoveOrUnblock(friend.id, false)} className="px-3 py-1 bg-coral text-white rounded-control text-sm font-semibold">
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
          {pendingRequests.length === 0 ? <p className="text-ink-soft">Aucune demande en attente.</p> : (
            pendingRequests.map((req) => (
              <div key={req.id} className="signal-panel flex justify-between items-center p-4 mb-2">
                <span className="text-ink font-semibold">{req.requester.username} vous a envoyé une demande.</span>
                <div className="flex gap-2">
                  <button onClick={() => handleAcceptRequest(req.id)} className="signal-button px-3 py-1 text-sm">
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
          {blockedUsers.length === 0 ? <p className="text-ink-soft">Aucun utilisateur bloqué.</p> : (
            blockedUsers.map((user) => (
              <div key={user.id} className="signal-panel flex justify-between items-center p-4 mb-2">
                <span className="text-ink font-semibold">{user.username}</span>
                <button onClick={() => handleRemoveOrUnblock(user.id, true)} className="px-3 py-1 bg-ink text-white rounded-control text-sm">
                  Débloquer
                </button>
              </div>
            ))
          )}
        </div>
      )}
      </div>
    </div>
  );
};

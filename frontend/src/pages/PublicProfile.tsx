import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';

export default function PublicProfile() {
  const { username } = useParams();
  const navigate = useNavigate();
  
  const currentUser = useAuthStore((state) => state.user);
  
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isMyProfile = currentUser?.username === username;

  useEffect(() => {
    api.get(`/users/public/${username}`)
      .then((res) => {
        setProfileData(res.data);
      })
      .catch(() => {
        setError("Cet utilisateur n'existe pas.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [username]);

  // 🟢 NOUVEAU : Fonction pour créer le DM et rediriger
  const handleSendMessage = async () => {
    console.log("Profil chargé :", profileData); // 🔍 Pour voir ce que contient vraiment profileData

    if (!profileData?.id) {
      alert("Erreur : L'ID de cet utilisateur n'est pas renvoyé par le backend !");
      return;
    }

    try {
      console.log("Envoi de la requête au backend pour l'utilisateur ID :", profileData.id);
      
      const response = await api.post('/chat/dms', { targetUserId: profileData.id });
      console.log("Réponse du backend :", response.data);

      const channelId = response.data.id || response.data.channel?.id;
      
      if (!channelId) {
        alert("Erreur : Le backend n'a pas renvoyé l'ID du salon.");
        return;
      }

      // Redirection si tout va bien
      navigate(`/chat?roomId=${channelId}`);
    } catch (err: any) {
      console.error("Erreur complète :", err.response || err);
      alert(`Erreur lors de la création du DM : ${err.response?.data?.message || err.message}`);
    }
  };

  if (loading) return <div className="text-white p-8 text-center">Chargement...</div>;
  if (error) return <div className="text-red-500 p-8 text-center">{error}</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-3xl mx-auto bg-slate-900 rounded-lg p-6 flex items-center gap-6 border border-slate-800">
        
        <img 
          src={profileData.avatar || '/default-avatar.png'} 
          alt="Avatar" 
          className="w-24 h-24 rounded-full object-cover border-2 border-indigo-500"
        />

        <div className="flex-1">
          <h1 className="text-3xl font-bold">{profileData.nickname || profileData.username}</h1>
          <p className="text-slate-400">@{profileData.username}</p>
          <p className="text-sm mt-2 text-slate-300">Membre depuis le {new Date(profileData.createdAt).toLocaleDateString()}</p>
        </div>

        {/* 🔄 MODIFIÉ : Affichage conditionnel des boutons */}
        {isMyProfile ? (
          <button 
            onClick={() => navigate('/settings')}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium transition-colors border border-slate-700"
          >
            ⚙️ Paramètres
          </button>
        ) : (
          <button 
            onClick={handleSendMessage}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium transition-colors shadow-sm"
          >
            💬 Envoyer un message
          </button>
        )}
      </div>

      {/* Reste de la page */}
    </div>
  );
}
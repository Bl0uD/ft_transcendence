import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';

export default function PublicProfile() {
  const { username } = useParams(); // Récupère le :username dans l'URL
  const navigate = useNavigate();
  
  // L'utilisateur actuellement connecté (peut être null si visiteur anonyme)
  const currentUser = useAuthStore((state) => state.user);
  
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 💡 C'est ici qu'on vérifie si le profil visité appartient à l'utilisateur connecté !
  const isMyProfile = currentUser?.username === username;

  useEffect(() => {
    // Requête au backend pour récupérer les infos publiques de l'utilisateur
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

  if (loading) return <div className="text-white p-8 text-center">Chargement...</div>;
  if (error) return <div className="text-red-500 p-8 text-center">{error}</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-3xl mx-auto bg-slate-900 rounded-lg p-6 flex items-center gap-6 border border-slate-800">
        
        {/* Avatar */}
        <img 
          src={profileData.avatar || '/default-avatar.png'} 
          alt="Avatar" 
          className="w-24 h-24 rounded-full object-cover border-2 border-indigo-500"
        />

        {/* Infos de l'utilisateur */}
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{profileData.nickname || profileData.username}</h1>
          <p className="text-slate-400">@{profileData.username}</p>
          <p className="text-sm mt-2 text-slate-300">Membre depuis le {new Date(profileData.createdAt).toLocaleDateString()}</p>
        </div>

        {/* ⚙️ BOUTON SETTINGS - Affiché UNIQUEMENT si c'est notre profil */}
        {isMyProfile && (
          <button 
            onClick={() => navigate('/settings')}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium transition-colors border border-slate-700"
          >
            ⚙️ Paramètres
          </button>
        )}
      </div>

      {/* Reste de la page : Historique de matchs, posts, etc. */}
    </div>
  );
}
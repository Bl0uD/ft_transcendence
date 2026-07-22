// src/pages/Dashboard.tsx
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-slate-900 text-white gap-4">
      <h1 className="text-3xl font-bold">Bienvenue sur Transcendence 🏓</h1>
      {user && <p className="text-slate-400">Connecté en tant que : {user.username}</p>}
      
      <div className="flex gap-3 mt-2">
        <button 
          onClick={() => navigate('/profile')}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition-colors"
        >
          Mon Profil
        </button>
        <button 
          onClick={logout}
          className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded text-sm font-medium transition-colors"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
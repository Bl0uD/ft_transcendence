import { useAuthStore } from '../store/authStore';

export default function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-slate-900 text-white gap-4">
      <h1 className="text-3xl font-bold">Bienvenue sur Transcendence 🏓</h1>
      {user && <p className="text-slate-400">Connecté en tant que : {user.username}</p>}
      <button 
        onClick={logout}
        className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded text-sm font-medium transition-colors"
      >
        Se déconnecter
      </button>
    </div>
  );
}
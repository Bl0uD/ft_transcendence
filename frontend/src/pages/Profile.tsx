import { useAuthStore } from '../store/authStore';

export default function Profile() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-slate-900 text-white gap-4">
      {user && <h1 className="text-slate-400">Connecté en tant que : {user.username} avec l'email {user.email}, Welcome to Transcendence 🏓</h1>}
      <button 
        onClick={logout}
        className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded text-sm font-medium transition-colors"
      >
        Se déconnecter
      </button>
    </div>
  );
}
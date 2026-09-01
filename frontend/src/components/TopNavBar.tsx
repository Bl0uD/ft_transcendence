import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import UserAvatar from './UserAvatar';

const getDisplayName = (account?: { username?: string; nickname?: string | null } | null) => {
  if (!account || !account.username) return 'Visiteur';
  return account.nickname && account.nickname.trim() !== '' ? account.nickname : account.username;
};

interface TopNavBarProps {
  onLoginClick?: () => void;
}

export default function TopNavBar({ onLoginClick }: TopNavBarProps) {
  const navigate = useNavigate();
  const user = useAuthStore((state: any) => state.user);
  const logout = useAuthStore((state: any) => state.logout);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/${searchQuery.trim()}`);
      setSearchQuery('');
    }
  };

  return (
    <nav className="fixed top-0 left-0 w-full h-16 bg-slate-800 border-b border-slate-700 z-50 flex items-center justify-between px-6 shadow-md">
      
      {/* GAUCHE : Logo + Accueil */}
      <div className="flex items-center gap-6">
        <button 
          onClick={() => navigate('/')} 
          className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 hover:opacity-80 transition-opacity"
        >
          Transcendence
        </button>

        {/* BARRE DE RECHERCHE */}
        <form onSubmit={handleSearch} className="hidden sm:flex items-center">
          <div className="relative">
            <input
              type="text"
              placeholder="Chercher un pseudo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded-full py-1.5 pl-4 pr-10 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 w-64 transition-all"
            />
            <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-400">
              🔍
            </button>
          </div>
        </form>
      </div>

      {/* DROITE : Profil & Actions */}
      <div className="flex items-center gap-4">
        {user ? (
          <>
            <div 
              onClick={() => navigate(`/${user.username}`)} 
              className="flex items-center gap-3 cursor-pointer hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              <UserAvatar avatarUrl={user?.avatar} username={getDisplayName(user)} className="w-9 h-9 border border-slate-600" />
              <span className="font-semibold text-sm hidden sm:block">{getDisplayName(user)}</span>
            </div>
            <button 
              onClick={() => { logout(); navigate('/'); }} 
              className="px-4 py-2 bg-red-600/90 hover:bg-red-500 rounded-md text-sm font-medium transition-colors"
            >
              Se déconnecter
            </button>
          </>
        ) : (
          <button 
            onClick={onLoginClick} 
            className="px-4 py-2 bg-blue-600/90 hover:bg-blue-500 rounded-md text-sm font-medium transition-colors"
          >
            Se connecter
          </button>
        )}
      </div>
    </nav>
  );
}
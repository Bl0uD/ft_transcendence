import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useSocialStore } from '../store/socialStore';
import { useThemeStore } from '../store/themeStore';
import UserAvatar from './UserAvatar';
import { SearchIcon, DarkIcon, LightIcon, SidebarIcon } from './HeaderIcons';

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
  const { pendingRequests, isSocialDrawerOpen, setIsSocialDrawerOpen } = useSocialStore();
  const { mode, setMode } = useThemeStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileSearch, setShowMobileSearch] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/${searchQuery.trim()}`);
      setSearchQuery('');
      setShowMobileSearch(false);
    }
  };

  return (
    <nav className="fixed top-0 left-0 w-full max-w-full h-16 bg-surface-hover border-b border-border z-50 flex items-center justify-between px-3 sm:px-6 shadow-md">
      
      {/* GAUCHE : Social Mobile + Logo + Accueil */}
      <div className="flex items-center gap-2 sm:gap-6 min-w-0">
        {/* BOUTON SOCIAL MOBILE (Affiché uniquement pour utilisateur connecté) */}
        {user && (
          <button
            type="button"
            onClick={() => setIsSocialDrawerOpen(!isSocialDrawerOpen)}
            className="relative lg:hidden p-2 text-text-muted hover:text-text-main bg-bg/50 hover:bg-surface rounded-lg text-sm transition-colors flex items-center justify-center"
            title="Volet Social"
          >
            <SidebarIcon className="w-4 h-4" />
            {pendingRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                {pendingRequests.length}
              </span>
            )}
          </button>
        )}

        <button 
          onClick={() => navigate('/')} 
          className="text-lg sm:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary hover:opacity-80 transition-opacity truncate"
        >
          Transcendence
        </button>

        {/* BARRE DE RECHERCHE DESKTOP */}
        <form onSubmit={handleSearch} className="hidden sm:flex items-center">
          <div className="relative">
            <input
              type="text"
              placeholder="Chercher un pseudo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-surface border border-border-subtle rounded-full py-1.5 pl-4 pr-10 text-sm text-text-main focus:outline-none focus:border-primary w-48 md:w-64 transition-all"
            />
            <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary transition-colors flex items-center justify-center">
              <SearchIcon className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {/* DROITE : Actions, Recherche Mobile, Profil */}
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        
        {/* BOUTON THEME SOMBRE/CLAIR */}
        <button
          onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
          className="p-2 text-text-muted hover:text-text-main bg-bg/50 hover:bg-surface rounded-lg text-sm transition-colors flex items-center justify-center"
          title={mode === 'dark' ? 'Passer au mode clair' : 'Passer au mode sombre'}
        >
          {mode === 'dark' ? <LightIcon className="w-4 h-4" /> : <DarkIcon className="w-4 h-4" />}
        </button>

        {/* BOUTON RECHERCHE MOBILE */}
        <button
          type="button"
          onClick={() => setShowMobileSearch(!showMobileSearch)}
          className="sm:hidden p-2 text-text-muted hover:text-text-main bg-bg/50 hover:bg-surface rounded-lg text-sm transition-colors flex items-center justify-center"
          title="Rechercher"
        >
          <SearchIcon className="w-4 h-4" />
        </button>

        {user ? (
          <>
            <div 
              onClick={() => navigate(`/${user.username}`)} 
              className="flex items-center gap-2 cursor-pointer hover:bg-surface px-2 sm:px-3 py-1.5 rounded-lg transition-colors"
            >
              <UserAvatar avatarUrl={user?.avatar} username={getDisplayName(user)} className="w-8 h-8 sm:w-9 sm:h-9 border border-border-subtle" />
              <span className="font-semibold text-sm hidden md:block max-w-[120px] truncate">{getDisplayName(user)}</span>
            </div>
            <button 
              onClick={() => { logout(); navigate('/'); }} 
              className="px-2.5 py-1.5 sm:px-4 sm:py-2 bg-red-600/90 hover:bg-red-500 rounded-md text-xs sm:text-sm font-medium transition-colors text-white"
            >
              <span className="hidden sm:inline">Se déconnecter</span>
              <span className="sm:hidden">Quitter</span>
            </button>
          </>
        ) : (
          <button 
            onClick={onLoginClick} 
            className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-primary text-primary-content hover:bg-primary-hover rounded-lg text-xs sm:text-sm font-semibold transition-colors shadow-sm"
          >
            Se connecter
          </button>
        )}
      </div>

      {/* CHAMP DE RECHERCHE DÉROULANT SUR MOBILE */}
      {showMobileSearch && (
        <div className="absolute top-16 left-0 w-full bg-surface-hover/95 border-b border-border p-3 shadow-xl backdrop-blur-md sm:hidden animate-in slide-in-from-top-2">
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <input
              type="text"
              autoFocus
              placeholder="Chercher un pseudo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-surface border border-border-subtle rounded-full py-2 px-4 text-sm text-text-main focus:outline-none focus:border-primary"
            />
            <button type="submit" className="px-4 py-2 bg-primary hover:bg-primary-hover rounded-full text-xs font-semibold text-primary-content">
              Aller
            </button>
            <button 
              type="button" 
              onClick={() => setShowMobileSearch(false)}
              className="p-2 text-text-muted hover:text-text-main text-sm"
            >
              ✕
            </button>
          </form>
        </div>
      )}
    </nav>
  );
}
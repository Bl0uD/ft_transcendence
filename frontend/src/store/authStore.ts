import { create } from 'zustand';

// 1. On définit la structure de nos données (TypeScript)
interface User {
  id: number;
  username: string;
  email: string;
  avatarUrl?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  login: (userData: User) => void;
  logout: () => void;
}

// 2. On crée le store global
export const useAuthStore = create<AuthState>((set) => ({
  // On vérifie au démarrage si un token existe déjà dans le localStorage
  isAuthenticated: !!localStorage.getItem('access_token'),
  user: null,

  // Action appelée lors d'une connexion réussie
  login: (userData) => set({ isAuthenticated: true, user: userData }),

  // Action appelée lors de la déconnexion
  logout: () => {
    localStorage.removeItem('access_token');
    set({ isAuthenticated: false, user: null });
  },
}));
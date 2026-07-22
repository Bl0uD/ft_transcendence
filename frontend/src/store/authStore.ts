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
  token: string | null;
  user: User | null;
  login: (userData: User, token: string) => void;
  logout: () => void;
  updateUser: (updatedData: Partial<User>) => void;
  refreshToken: () => Promise<string | null>;
}

// 2. On crée le store global (on ajoute `get` en deuxième paramètre)
export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: !!localStorage.getItem('access_token'),
  token: localStorage.getItem('access_token'),
  user: null,

  // Action appelée lors d'une connexion réussie
  login: (userData, token) => {
    localStorage.setItem('access_token', token);
    set({ isAuthenticated: true, user: userData, token });
  }, // <-- VIRGULE AJOUTÉE ICI

  // Action appelée lors de la déconnexion
  logout: () => {
    localStorage.removeItem('access_token');
    set({ isAuthenticated: false, user: null, token: null });
  },

  // Action appelée après un PUT /api/users/profile réussi
  updateUser: (updatedData) => set((state) => ({
    user: state.user ? { ...state.user, ...updatedData } : null
  })),

  // Action pour rafraîchir le token
  refreshToken: async () => {
    try {
      console.warn("Refresh token non implémenté. Déconnexion forcée.");
      get().logout();
      return null;
    } catch (error) {
      get().logout();
      return null;
    }
  }
}));
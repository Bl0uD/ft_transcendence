import { create } from 'zustand';

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
  requires2FA: boolean; // <-- AJOUT
  
  login: (userData: User, token: string) => void;
  logout: () => void;
  updateUser: (updatedData: Partial<User>) => void;
  refreshToken: () => Promise<string | null>;
  setRequires2FA: (status: boolean) => void; // <-- AJOUT
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: !!localStorage.getItem('access_token'),
  token: localStorage.getItem('access_token'),
  user: null,
  requires2FA: false, // <-- INITIALISATION

  login: (userData, token) => {
    localStorage.setItem('access_token', token);
    set({ isAuthenticated: true, user: userData, token, requires2FA: false }); // Reset 2FA au login
  },

  logout: () => {
    localStorage.removeItem('access_token');
    set({ isAuthenticated: false, user: null, token: null, requires2FA: false }); // Reset 2FA au logout
  },

  updateUser: (updatedData) => set((state) => ({
    user: state.user ? { ...state.user, ...updatedData } : null
  })),

  // <-- AJOUT : Permet à Axios de déclencher l'interface 2FA
  setRequires2FA: (status) => set({ requires2FA: status }),

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
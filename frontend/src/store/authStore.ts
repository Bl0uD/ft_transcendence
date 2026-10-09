import { create } from 'zustand';

interface User {
  id: number;
  username: string;
  email: string;
  avatarUrl?: string;
  isTwoFactorEnabled?: boolean;
}

interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  user: User | null;
  requires2FA: boolean;
  
  login: (userData: User | null, token: string, is2faVerified?: boolean) => void;
  logout: () => void;
  updateUser: (updatedData: Partial<User>) => void;
  refreshToken: () => Promise<string | null>;
  setRequires2FA: (status: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: !!localStorage.getItem('access_token'),
  token: localStorage.getItem('access_token'),
  user: null,
  requires2FA: false,

  login: (userData, token, is2faVerified = false) => {
    localStorage.setItem('access_token', token);
    
    const finalUser = userData || get().user;
    let needs2FA = !!finalUser?.isTwoFactorEnabled; 
    
    if (is2faVerified) {
      needs2FA = false;
    } else {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.isTwoFactorAuthenticated === true) {
          needs2FA = false;
        }
      } catch (e) {
        console.error("Erreur de décodage JWT", e);
      }
    }

    set({ 
      isAuthenticated: true, 
      user: finalUser, 
      token, 
      requires2FA: needs2FA 
    });
  },

  logout: () => {
    localStorage.removeItem('access_token');
    set({ isAuthenticated: false, user: null, token: null, requires2FA: false });
  },

  updateUser: (updatedData) => set((state) => ({
    user: state.user ? { ...state.user, ...updatedData } : null
  })),

  setRequires2FA: (status) => set({ requires2FA: status }),

  refreshToken: async () => {
    get().logout();
    return null;
  }
}));
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
  mode: 'light' | 'dark';
  colorTheme: string;
  setMode: (mode: 'light' | 'dark') => void;
  setColorTheme: (theme: string) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'dark',
      colorTheme: 'theme0', // Default
      setMode: (mode) => set({ mode }),
      setColorTheme: (colorTheme) => set({ colorTheme }),
    }),
    {
      name: 'theme-storage',
    }
  )
);


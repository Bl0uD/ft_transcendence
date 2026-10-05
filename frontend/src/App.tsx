// src/App.tsx
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import HomeFeed from './pages/HomeFeed';
import PublicProfile from './pages/PublicProfile';
import OAuthCallback from './pages/OAuthCallback'; // Ajouté car présent dans ton dossier

import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';
import api from './api/axios'; 

function App() {
  const { isAuthenticated, requires2FA, user, login, logout } = useAuthStore();
  const { mode, colorTheme } = useThemeStore();

  // Gestion du thème
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.setAttribute('data-color', colorTheme);
  }, [mode, colorTheme]);

  // Hydratation de la session (Vérification silencieuse au rafraîchissement)
  useEffect(() => {
    const fetchProfile = async () => {
      const currentToken = localStorage.getItem('access_token');
      
      if (!currentToken) {
        if (isAuthenticated) logout();
        return;
      }

      if (isAuthenticated && !user && !requires2FA) {
        try {
          const response = await api.get('/auth/profile');
          login(response.data, currentToken); 
        } catch (error: any) {
          if (error.response?.status === 401) {
            const msg = error.response?.data?.message;
            
            // 🚀 Si le backend signale un blocage 2FA, on ne fait rien.
            // L'intercepteur axios.ts s'occupe déjà de passer l'état requires2FA à true.
            if (msg === '2FA validation required' || msg === '2FA requise') {
              return; 
            }
            
            // Pour toute autre erreur 401 (token expiré ou corrompu), on nettoie la session.
            localStorage.removeItem('access_token');
            logout();
          }
        }
      }
    };
    fetchProfile();
  }, [isAuthenticated, requires2FA, user, login, logout]);

  return (
	<BrowserRouter>
	<Routes>
		<Route path="/" element={<HomeFeed />} />
		<Route path="/:username" element={<PublicProfile />} />
		<Route path="*" element={<Navigate to="/" replace />} />
	</Routes>
	</BrowserRouter>
  );
}

export default App;
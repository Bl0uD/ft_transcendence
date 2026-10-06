import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomeFeed from './pages/HomeFeed';
import PublicProfile from './pages/PublicProfile';
import { GlobalChatWidget } from './components/GlobalChatWidget';

import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';
import api from './api/axios'; 

function App() {
  const { isAuthenticated, requires2FA, user, login, logout } = useAuthStore();
  const { mode, colorTheme } = useThemeStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.setAttribute('data-color', colorTheme);
  }, [mode, colorTheme]);

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
            
            if (msg === '2FA validation required' || msg === '2FA requise') {
              return; 
            }
            
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
      <GlobalChatWidget />
    </BrowserRouter>
  );
}

export default App;
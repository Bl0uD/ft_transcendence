import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';

import HomeFeed from './pages/HomeFeed';
import PublicProfile from './pages/PublicProfile';
import { AiChatView } from './pages/AiChatView'; 

import { useAuthStore } from './store/authStore';
import api from './api/axios'; 

const ProtectedRoute = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <Outlet /> : <Navigate to="/" replace />;
};

function App() {
  const { isAuthenticated, user, login, logout } = useAuthStore();

  useEffect(() => {
    const fetchProfile = async () => {
      const currentToken = localStorage.getItem('access_token'); // 🟢 Vérifie directement le storage
      
      if (!currentToken) {
        if (isAuthenticated) logout(); // Force la déconnexion propre si incohérent
        return;
      }

      if (isAuthenticated && !user) {
        try {
          const response = await api.get('/auth/profile');
          login(response.data, currentToken); 
        } catch (error: any) {
          if (error.response?.status === 401) {
            localStorage.removeItem('access_token');
            logout();
          }
        }
      }
    };
    fetchProfile();
  }, [isAuthenticated, user, login, logout]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeFeed />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/register" element={<Navigate to="/" replace />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/ai" element={<AiChatView />} />
        </Route>

        <Route path="/:username" element={<PublicProfile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
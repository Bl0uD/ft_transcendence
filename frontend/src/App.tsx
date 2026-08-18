import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';

// Import des pages existantes
import Login from './pages/Login';
import Settings from './pages/Settings'; 
import Register from './pages/Register';
import { ChatView } from './pages/ChatView';
import { AiChatView } from './pages/AiChatView'; 
import { SocialView } from './pages/SocialView'; 

// Nouveaux imports pour l'architecture sociale
import HomeFeed from './pages/HomeFeed';
import PublicProfile from './pages/PublicProfile';

import { useAuthStore } from './store/authStore';
import api from './api/axios'; 

// Composant Interne de Protection de Route
const ProtectedRoute = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

function App() {
  const { isAuthenticated, user, login, logout } = useAuthStore();

  // HYDRATATION DU STORE AU REFRESH
  useEffect(() => {
    const fetchProfile = async () => {
      const currentToken = useAuthStore.getState().token;

      console.log("État actuel -> isAuthenticated:", isAuthenticated, "user:", user, "token présent:", !!currentToken);

      if (isAuthenticated && !user && currentToken) {
        try {
          const response = await api.get('/auth/profile');
          console.log("Profil récupéré avec succès :", response.data);
          login(response.data, currentToken); 
        } catch (error: any) {
          console.error("Session invalide ou expirée :", error);
          logout();
        }
      }
    };

    fetchProfile();
  }, [isAuthenticated, user, login, logout]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Page d'accueil (Réseau social public/semi-public) */}
        <Route path="/" element={<HomeFeed />} />

        {/* Routes d'Authentification */}
        <Route 
          path="/login" 
          element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} 
        />
        <Route path="/register" element={<Register />} />

        {/* Routes Protégées */}
        <Route element={<ProtectedRoute />}>
          <Route path="/settings" element={<Settings />} /> 
          <Route path="/chat" element={<ChatView />} />
          <Route path="/ai" element={<AiChatView />} />
          <Route path="/social" element={<SocialView />} />
        </Route>

        {/* Profil Public dynamique (DOIT IMPÉRATIVEMENT ÊTRE À LA FIN) */}
        <Route path="/:username" element={<PublicProfile />} />

        {/* Redirection intelligente des routes inconnues */}
        <Route 
          path="*" 
          element={<Navigate to="/" replace />} 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
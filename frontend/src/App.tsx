import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Register from './pages/Register';
import { useAuthStore } from './store/authStore';
import api from './api/axios'; 

// 🛡️ Composant Interne de Protection de Route
const ProtectedRoute = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

function App() {
  const { isAuthenticated, user, login, logout } = useAuthStore();

  // 🔄 HYDRATATION DU STORE AU REFRESH (Version 100% simulée sans appel API pour bloquer la boucle)
  useEffect(() => {
    if (isAuthenticated && !user) {
      // On commente temporairement le bloc try/catch et l'appel API pour éviter de déclencher l'intercepteur Axios
      /*
      try {
        const response = await api.get('/auth/profile');
        login(response.data); 
      } catch (error) {
        ...
      }
      */

      // On applique directement le faux profil pour calmer React et Zustand instantanément
      console.warn("Mode simulation actif : injection directe de l'utilisateur.");
      const mockUser = { id: 1, username: "jdupuis", email: "jdupuis@gmail.com" };
      login(mockUser);
    }
  }, [isAuthenticated, user, login]);

  return (
    <BrowserRouter>
      <Routes>
        {/* 🔓 Routes Publiques */}
        <Route 
          path="/login" 
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} 
        />
        <Route path="/register" element={<Register />} />

        {/* 🔒 Routes Protégées */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        {/* 🔄 Redirection intelligente des routes inconnues */}
        <Route 
          path="*" 
          element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
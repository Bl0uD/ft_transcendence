import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';

// Composant temporaire pour la page d'accueil sécurisée (Dashboard)
const DashboardPlaceholder = () => (
  <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
    <h1 className="text-3xl font-bold">Bienvenue sur Transcendence 🏓 (Connexion Réussie)</h1>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Routes d'authentification */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Route principale de l'application (Dashboard) */}
        <Route path="/dashboard" element={<DashboardPlaceholder />} />

        {/* Redirection automatique des routes inconnues ou de la racine */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
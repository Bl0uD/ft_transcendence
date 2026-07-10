import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Si l'utilisateur n'est pas connecté, on le redirige gentiment vers le login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Si connecté, on affiche les composants enfants (le Dashboard, etc.)
  return <Outlet />;
}
import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function LoginSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // J'utilise loginGlobal en supposant que tu peux lui passer juste le token si l'user est récupéré plus tard, 
  // ou tu peux créer une fonction setToken dans ton authStore.
  const loginGlobal = useAuthStore((state) => state.login); 

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (token) {
      localStorage.setItem('access_token', token);
      // Optionnel : si ton store a besoin de l'objet user complet, tu devras peut-être faire un appel /api/users/me ici
      // Pour l'instant, on simule l'état connecté pour déclencher la redirection
      loginGlobal({} as any, token); 
      navigate('/dashboard', { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  }, [searchParams, navigate, loginGlobal]);

  return (
    <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-100">
      <p className="text-lg animate-pulse">Authentification 42 en cours...</p>
    </div>
  );
}
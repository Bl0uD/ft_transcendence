import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import TwoFactorVerify from '../components/TwoFactorVerify';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams(); 
  
  const loginGlobal = useAuthStore((state) => state.login);
  // AJOUT : On récupère l'état requires2FA depuis le store
  const requires2FA = useAuthStore((state) => state.requires2FA); 

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // INTERCEPTION DU TOKEN 42
  useEffect(() => {
    const token = searchParams.get('token');

    if (token) {
      localStorage.setItem('access_token', token);
      
      api.get('/auth/profile', {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then((res) => {
        loginGlobal(res.data, token);
        navigate('/', { replace: true });
      })
      .catch(() => {
        // Si le profil nécessite une 2FA, l'intercepteur Axios va l'attraper ici
        // et passer requires2FA à true automatiquement.
        setError("Impossible de récupérer le profil utilisateur 42.");
      });
    }
  }, [searchParams, navigate, loginGlobal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login', { email, password });
      localStorage.setItem('access_token', response.data.access_token);
      loginGlobal(response.data.user, response.data.access_token);
      navigate('/');
    } catch (err: any) {
      setError(
        err.response?.data?.message || 
        'Une erreur est survenue lors de la connexion.'
      );
    } finally {
      setLoading(false);
    }
  }; 

  const handle42Login = () => {
    window.location.href = '/api/auth/42';
  };

  // --- AJOUT : BASCULE SUR L'ÉCRAN 2FA ---
  // Si le store indique que la 2FA est requise, on masque le formulaire 
  // de login et on affiche uniquement le composant de vérification.
  if (requires2FA) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <TwoFactorVerify />
      </div>
    );
  }

  // --- FORMULAIRE CLASSIQUE ---
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 sm:px-6 lg:px-8 text-slate-100">
      <div className="w-full max-w-md space-y-8 bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-xl">
        
        {/* Header */}
        <div className="text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Transcendence
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Connectez-vous pour accéder au réseau
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400 text-center">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label htmlFor="email-address" className="block text-sm font-medium text-slate-300 mb-1">
                Adresse email
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
                Mot de passe
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Connexion en cours...' : 'Se connecter'}
            </button>
          </div>
        </form>

        {/* Bouton 42 */}
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-slate-900 px-2 text-slate-400">Ou</span>
            </div>
          </div>
          <div className="mt-6">
            <button
              onClick={handle42Login}
              className="w-full flex justify-center items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 border border-slate-700 transition-colors"
            >
              Se connecter avec 42
            </button>
          </div>
        </div>

        <div className="text-center text-sm">
          <p className="text-slate-400">
            Pas encore de compte ?{' '}
            <Link to="/register" className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
              Créer un compte
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
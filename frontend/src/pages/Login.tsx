import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import TwoFactorVerify from '../components/TwoFactorVerify';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams(); 
  
  const loginGlobal = useAuthStore((state) => state.login);
  const requires2FA = useAuthStore((state) => state.requires2FA); 

  const [identifier, setIdentifier] = useState('');
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
        setError("Impossible de récupérer le profil utilisateur 42.");
      });
    }
  }, [searchParams, navigate, loginGlobal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login', { identifier, password });
      localStorage.setItem('access_token', response.data.access_token);
      loginGlobal(response.data.user, response.data.access_token);
      navigate('/');
    } catch (err: any) {
      // On s'assure que l'erreur s'affiche proprement et on arrête le chargement
      setError(
        err.response?.data?.message || 
        'Identifiants incorrects. Veuillez réessayer.'
      );
    } finally {
      setLoading(false);
    }
  }; 

  const handle42Login = () => {
    window.location.href = '/api/auth/42';
  };

  // --- BASCULE SUR L'ÉCRAN 2FA ---
  if (requires2FA) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <TwoFactorVerify />
      </div>
    );
  }

  // --- FORMULAIRE CLASSIQUE ---
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-12 sm:px-6 lg:px-8 text-slate-100 font-sans">
      
      {/* Effets de lueur en arrière-plan (Glow effects) */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none"></div>

      {/* Conteneur principal (Glassmorphism) */}
      <div className="relative z-10 w-full max-w-md space-y-8 bg-slate-900/60 backdrop-blur-xl p-10 rounded-3xl border border-white/10 shadow-2xl">
        
        {/* Header */}
        <div className="text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 sm:text-4xl">
            Transcendence
          </h2>
          <p className="mt-3 text-sm text-slate-400">
            Initialisation de la connexion au réseau
          </p>
        </div>

        {/* Message d'erreur avec un léger effet pulse/shake s'il apparaît */}
        {error && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300 flex items-center gap-3 rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0 text-red-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p>{error}</p>
          </div>
        )}

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-5">
            {/* Champ Identifiant */}
            <div className="group">
              <label htmlFor="identifier" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 transition-colors group-focus-within:text-indigo-400">
                Email ou Username
              </label>
              <input
                id="identifier"
                name="identifier"
                type="text" 
                autoComplete="username"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)} 
                className="w-full rounded-xl border border-slate-700/50 bg-slate-950/50 px-4 py-3 text-slate-200 placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all sm:text-sm"
                placeholder="you@example.com"
              />
            </div>

            {/* Champ Mot de passe */}
            <div className="group">
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 transition-colors group-focus-within:text-indigo-400">
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
                className="w-full rounded-xl border border-slate-700/50 bg-slate-950/50 px-4 py-3 text-slate-200 placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all sm:text-sm"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3 text-sm font-semibold text-white hover:from-indigo-400 hover:to-purple-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Authentification...
                </>
              ) : (
                'Se connecter'
              )}
            </button>
          </div>
        </form>

        {/* Séparateur */}
        <div className="mt-8">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700/50"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-widest">
              <span className="bg-slate-900/60 px-3 text-slate-500">Ou</span>
            </div>
          </div>
          
          {/* Bouton 42 */}
          <div className="mt-6">
            <button
              onClick={handle42Login}
              type="button"
              className="w-full flex justify-center items-center gap-3 rounded-xl bg-slate-800/50 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700/50 border border-slate-700 transition-all hover:border-slate-500 group"
            >
              <svg width="24" height="24" viewBox="0 0 800 800" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white group-hover:scale-110 transition-transform">
                <path d="M465.176 348.653H549.95V425.263H465.176V348.653Z" fill="currentColor"/>
                <path d="M465.176 195.452H549.95V272.062H465.176V195.452Z" fill="currentColor"/>
                <path d="M549.95 272.062H634.723V348.653H549.95V272.062Z" fill="currentColor"/>
                <path d="M210.875 348.653H295.649V425.263H210.875V348.653Z" fill="currentColor"/>
                <path d="M126.101 272.062H210.875V348.653H126.101V272.062Z" fill="currentColor"/>
                <path d="M295.649 195.452H380.423V272.062H295.649V195.452Z" fill="currentColor"/>
                <path d="M295.649 425.263H380.423V501.874H295.649V425.263Z" fill="currentColor"/>
                <path d="M295.649 272.062H380.423V348.653H295.649V272.062Z" fill="currentColor"/>
                <path d="M465.176 425.263H549.95V501.874H465.176V425.263Z" fill="currentColor"/>
                <path d="M380.423 348.653H465.176V425.263H380.423V348.653Z" fill="currentColor"/>
                <path d="M380.423 501.874H465.176V578.484H380.423V501.874Z" fill="currentColor"/>
              </svg>
              Se connecter avec 42
            </button>
          </div>
        </div>

        <div className="text-center text-sm pt-4">
          <p className="text-slate-400">
            Nouvel élève ?{' '}
            <Link to="/register" className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
              Créer un compte
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import TwoFactorVerify from './TwoFactorVerify';

interface AuthModalsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModals({ isOpen, onClose }: AuthModalsProps) {
  // Détermine si on affiche la connexion ou l'inscription
  const [isLoginView, setIsLoginView] = useState(true);

  const loginGlobal = useAuthStore((state: any) => state.login);
  const requires2FA = useAuthStore((state: any) => state.requires2FA);

  // --- ÉTATS CONNEXION ---
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  // --- ÉTATS INSCRIPTION ---
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [isRegLoading, setIsRegLoading] = useState(false);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsLoginLoading(true);
    try {
      const response = await api.post('/auth/login', { identifier, password });
      localStorage.setItem('access_token', response.data.access_token);
      loginGlobal(response.data.user, response.data.access_token);
      onClose(); // On ferme la modale !
      setIdentifier(''); setPassword('');
    } catch (err: any) { 
      setLoginError(err.response?.data?.message || 'Erreur'); 
    } finally { 
      setIsLoginLoading(false); 
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsRegLoading(true);
    try {
      const response = await api.post('/auth/register', { email: regEmail, username: regUsername, password: regPassword });
      setRegSuccess(response.data.message || 'Succès !');
      setTimeout(() => {
        setIsLoginView(true); // On bascule sur la connexion
        setIdentifier(regUsername);
        setRegEmail(''); setRegUsername(''); setRegPassword(''); setRegSuccess('');
      }, 2000);
    } catch (err: any) { 
      setRegError(err.response?.data?.message || 'Erreur'); 
    } finally { 
      setIsRegLoading(false); 
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md space-y-6 bg-slate-900/90 p-8 rounded-3xl border border-slate-700 shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-5 text-slate-400 hover:text-white transition-colors text-xl">✕</button>
        
        {isLoginView ? (
          /* ================= VUE CONNEXION ================= */
          requires2FA ? <TwoFactorVerify /> : (
            <>
              <div className="text-center"><h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Transcendence</h2></div>
              {loginError && <div className="p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl">{loginError}</div>}
              <form className="space-y-4" onSubmit={handleLoginSubmit}>
                <input type="text" placeholder="Email / Username" required value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2 text-slate-200 focus:border-indigo-500 focus:outline-none" />
                <input type="password" placeholder="Mot de passe" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2 text-slate-200 focus:border-indigo-500 focus:outline-none" />
                <button type="submit" disabled={isLoginLoading} className="w-full bg-indigo-600 px-4 py-2.5 rounded-xl text-sm font-semibold">{isLoginLoading ? '...' : 'Se connecter'}</button>
              </form>

              <div className="relative my-4"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700"></div></div><div className="relative flex justify-center text-xs"><span className="bg-slate-900 px-3 text-slate-500">Ou</span></div></div>
              <button onClick={() => window.location.href = '/api/auth/42'} className="w-full flex justify-center items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 border border-slate-700 transition-colors">🔗 Se connecter avec 42</button>

              <div className="text-center text-sm text-slate-400 mt-4">
                <button type="button" onClick={() => setIsLoginView(false)} className="text-indigo-400 hover:underline">Créer un compte</button>
              </div>
            </>
          )
        ) : (
          /* ================= VUE INSCRIPTION ================= */
          <>
            <div className="text-center"><h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">S'inscrire</h2></div>
            {regSuccess && <div className="p-3 text-sm text-emerald-400 bg-emerald-500/10 rounded-xl">{regSuccess} 🎉</div>}
            {regError && <div className="p-3 text-sm text-red-400 bg-red-500/10 rounded-xl">{regError}</div>}
            <form className="space-y-4" onSubmit={handleRegisterSubmit}>
              <input type="text" placeholder="Username" required value={regUsername} onChange={(e) => setRegUsername(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2 focus:border-indigo-500 focus:outline-none" />
              <input type="email" placeholder="Email" required value={regEmail} onChange={(e) => setRegEmail(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2 focus:border-indigo-500 focus:outline-none" />
              <input type="password" placeholder="Mot de passe" required value={regPassword} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-2 focus:border-indigo-500 focus:outline-none" />
              <button type="submit" disabled={isRegLoading} className="w-full bg-indigo-600 px-4 py-2.5 rounded-xl text-sm font-semibold">{isRegLoading ? '...' : "S'inscrire"}</button>
            </form>
            <div className="text-center text-sm text-slate-400 mt-4">
              <button onClick={() => setIsLoginView(true)} className="text-indigo-400 hover:underline">Se connecter</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import TwoFactorVerify from './TwoFactorVerify';

interface AuthModalsProps {
  isOpen: boolean;
  onClose: () => void;
  initialView?: 'login' | 'register'; 
}

export default function AuthModals({ isOpen, onClose, initialView = 'login' }: AuthModalsProps) {
  const [isLoginView, setIsLoginView] = useState(initialView === 'login');
  
  const { login: loginGlobal, requires2FA, logout } = useAuthStore();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [isRegLoading, setIsRegLoading] = useState(false);

  useEffect(() => {
    if (isOpen) setIsLoginView(initialView === 'login');
  }, [isOpen, initialView]);

  const handleClose = () => {
    if (requires2FA) {
      logout(); 
    }
    onClose();
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsLoginLoading(true);
    try {
      const response = await api.post('/auth/login', { identifier, password });
      localStorage.setItem('access_token', response.data.access_token);
      loginGlobal(response.data.user, response.data.access_token);
      
      if (!response.data.user.isTwoFactorEnabled) {
        onClose();
      }
      
      setIdentifier(''); setPassword('');
    } catch (err: any) { 
      setLoginError(err.response?.data?.message || 'Erreur'); 
    } finally { 
      setIsLoginLoading(false); 
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setIsRegLoading(true);
    setRegError('');
    
    try {
      await api.post('/auth/register', { 
        email: regEmail, 
        username: regUsername, 
        password: regPassword 
      });
      
      setRegSuccess('Succès ! Connexion en cours...');

      const loginResponse = await api.post('/auth/login', { 
        identifier: regUsername, 
        password: regPassword 
      });

      localStorage.setItem('access_token', loginResponse.data.access_token);
      loginGlobal(loginResponse.data.user, loginResponse.data.access_token);
      
      setRegEmail(''); 
      setRegUsername(''); 
      setRegPassword(''); 
      setRegSuccess('');

      if (!loginResponse.data.user.isTwoFactorEnabled) {
        onClose();
      }

    } catch (err: any) { 
      setRegError(err.response?.data?.message || 'Erreur lors de l\'inscription ou de la connexion'); 
    } finally { 
      setIsRegLoading(false); 
    }
  };

  // 🚀 LA LIGNE MAGIQUE QUI RÉSOUT TOUT TON PROBLÈME EST ICI :
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-bg/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto space-y-5 sm:space-y-6 bg-surface/95 p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-border shadow-2xl custom-scrollbar">
        <button onClick={handleClose} className="absolute top-4 right-5 text-text-muted hover:text-text-main transition-colors text-xl">✕</button>
        
        {isLoginView ? (
          requires2FA ? <TwoFactorVerify onClose={onClose} /> : (
            <>
              <div className="text-center"><h2 className="text-2xl sm:text-3xl font-extrabold text-primary">Transcendence</h2></div>
              {loginError && <div className="p-3 text-xs sm:text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl">{loginError}</div>}
              <form className="space-y-4" onSubmit={handleLoginSubmit}>
                <input type="text" placeholder="Email / Username" required value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="w-full rounded-xl border border-border bg-bg/50 px-3.5 sm:px-4 py-2 sm:py-2.5 text-sm text-text-main focus:border-primary focus:outline-none" />
                <input type="password" placeholder="Mot de passe" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-border bg-bg/50 px-3.5 sm:px-4 py-2 sm:py-2.5 text-sm text-text-main focus:border-primary focus:outline-none" />
                <button type="submit" disabled={isLoginLoading} className="w-full bg-primary text-primary-content px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50 shadow-sm">{isLoginLoading ? '...' : 'Se connecter'}</button>
              </form>

              <div className="relative my-4"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div><div className="relative flex justify-center text-xs"><span className="bg-surface px-3 text-text-muted">Ou</span></div></div>
              <button onClick={() => window.location.href = '/api/auth/42'} className="w-full flex justify-center items-center gap-2 rounded-xl bg-surface-hover px-4 py-2.5 text-sm font-semibold text-text-main hover:bg-border border border-border transition-colors">🔗 Se connecter avec 42</button>

              <div className="text-center text-xs sm:text-sm text-text-muted mt-4">
                <button type="button" onClick={() => setIsLoginView(false)} className="text-primary hover:underline">Créer un compte</button>
              </div>
            </>
          )
        ) : (
          <>
            <div className="text-center"><h2 className="text-2xl sm:text-3xl font-extrabold text-primary">S'inscrire</h2></div>
            {regSuccess && <div className="p-3 text-xs sm:text-sm text-primary bg-primary/10 border border-primary/30 rounded-xl">{regSuccess} 🎉</div>}
            {regError && <div className="p-3 text-xs sm:text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl">{regError}</div>}
            <form className="space-y-4" onSubmit={handleRegisterSubmit}>
              <input type="text" placeholder="Username" required value={regUsername} onChange={(e) => setRegUsername(e.target.value)} className="w-full rounded-xl border border-border bg-bg/50 px-3.5 sm:px-4 py-2 sm:py-2.5 text-sm focus:border-primary focus:outline-none" />
              <input type="email" placeholder="Email" required value={regEmail} onChange={(e) => setRegEmail(e.target.value)} className="w-full rounded-xl border border-border bg-bg/50 px-3.5 sm:px-4 py-2 sm:py-2.5 text-sm focus:border-primary focus:outline-none" />
              <input type="password" placeholder="Mot de passe" required value={regPassword} onChange={(e) => setRegPassword(e.target.value)} className="w-full rounded-xl border border-border bg-bg/50 px-3.5 sm:px-4 py-2 sm:py-2.5 text-sm focus:border-primary focus:outline-none" />
              <button type="submit" disabled={isRegLoading} className="w-full bg-primary text-primary-content px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50 shadow-sm">{isRegLoading ? '...' : "S'inscrire"}</button>
            </form>
            <div className="text-center text-xs sm:text-sm text-text-muted mt-4">
              <button onClick={() => setIsLoginView(true)} className="text-primary hover:underline">Se connecter</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
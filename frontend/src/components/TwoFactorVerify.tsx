import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';

interface TwoFactorVerifyProps {
  onClose?: () => void; // 🟢 On ajoute la prop onClose
}

export default function TwoFactorVerify({ onClose }: TwoFactorVerifyProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  const { login, setRequires2FA } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/2fa/authenticate', { 
        twoFactorCode: code 
      });

      login(response.data.user, response.data.access_token);
      
      // 🟢 On ferme la modale si la fonction est fournie
      if (onClose) {
        onClose();
      } else {
        navigate('/'); // Fallback au cas où
      }
      
    } catch (err: any) {
      setError(err.response?.data?.message || 'Code invalide. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    // 🟢 On retire les bordures/fonds (bg-surface, border, shadow) car la modale parent s'en charge déjà !
    <div className="w-full space-y-6 text-text-main">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-text-main">Double Authentification</h2>
        <p className="mt-2 text-sm text-text-muted">
          Entrez le code à 6 chiffres généré par votre application (Google Authenticator, Authy...)
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400 text-center">
          {error}
        </div>
      )}

      <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
        <div>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="w-full rounded-lg border border-border bg-bg/50 px-3 sm:px-4 py-3 text-text-main placeholder-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-center tracking-[0.25em] sm:tracking-[0.5em] text-xl sm:text-2xl font-mono"
            placeholder="000000"
          />
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-content hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            {loading ? 'Vérification...' : 'Valider'}
          </button>
          
          <button
            type="button"
            onClick={() => setRequires2FA(false)}
            className="text-sm text-text-muted hover:text-text-main transition-colors"
          >
            Annuler et retourner à la connexion
          </button>
        </div>
      </form>
    </div>
  );
}
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';

export default function TwoFactorVerify() {
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
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Code invalide. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-8 bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-xl mx-auto mt-12 text-slate-100">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">Double Authentification</h2>
        <p className="mt-2 text-sm text-slate-400">
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
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-center tracking-[0.5em] text-2xl font-mono"
            placeholder="000000"
          />
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Vérification...' : 'Valider'}
          </button>
          
          <button
            type="button"
            onClick={() => setRequires2FA(false)}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Annuler et retourner à la connexion
          </button>
        </div>
      </form>
    </div>
  );
}
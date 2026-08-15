import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';

export default function TwoFactorSetup() {
  const [step, setStep] = useState<'idle' | 'setup'>('idle');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
const handleGenerate = async () => {
    try {
      setError('');
      const response = await api.get('/auth/2fa/generate'); // C'est bien un GET !
      
      // On cible directement "response.data.qrCode" d'après ta console
      setQrCodeUrl(response.data.qrCode); 
      setStep('setup');
    } catch (err: any) {
      const backendMessage = err.response?.data?.message || err.message;
      setError(`Erreur : ${backendMessage}`);
    }
  };

  const handleEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      
      const response = await api.post('/auth/2fa/turn-on', { 
        twoFactorCode: code 
      });
      
      setSuccess("La double authentification est activée avec succès !");
      setStep('idle');
    } catch (err: any) {
      const backendMessage = err.response?.data?.message || err.message;
      setError(`Erreur : ${backendMessage}`);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mt-6">
      <h3 className="text-lg font-bold text-white mb-2">Sécurité (2FA)</h3>
      
      {success && <p className="text-green-400 text-sm mb-4">{success}</p>}
      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {step === 'idle' && (
        <div>
          <p className="text-slate-400 text-sm mb-4">
            Protégez votre compte en activant l'authentification à double facteur.
          </p>
          <button 
            onClick={handleGenerate}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Configurer la 2FA
          </button>
        </div>
      )}

      {step === 'setup' && (
        <div className="flex flex-col items-center">
          <p className="text-slate-300 text-sm mb-4 text-center">
            1. Scannez ce QR Code avec une application comme Google Authenticator.
          </p>
          
          <div className="bg-white p-4 rounded-xl mb-6">
            <img 
              src={qrCodeUrl} 
              alt="QR Code pour la 2FA" 
              className="w-[150px] h-[150px] object-contain"
            />
          </div>

          <form onSubmit={handleEnable} className="w-full max-w-xs flex flex-col gap-3">
            <p className="text-slate-300 text-sm text-center">
              2. Entrez le code généré pour confirmer :
            </p>
            <input
              type="text"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-white text-center tracking-widest font-mono focus:border-indigo-500 focus:outline-none"
            />
            <div className="flex gap-2">
              <button 
                type="submit"
                disabled={code.length !== 6}
                className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Activer
              </button>
              <button 
                type="button"
                onClick={() => setStep('idle')}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
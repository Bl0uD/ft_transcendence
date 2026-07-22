import React, { useState, useRef, useEffect } from 'react';
import axios from '../api/axios';
import { useAuthStore } from '../store/authStore';

export default function Profile() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const updateUser = useAuthStore((state) => state.updateUser);
  
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  
  // 👈 FIX : Déclaration du state manquant pour la visibilité du mot de passe
  const [showPassword, setShowPassword] = useState(false);
  
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>(user?.avatar || '');
  
  const [status, setStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error', message: string }>({ type: 'idle', message: '' });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchroniser la preview si le user change
  useEffect(() => {
    if (user?.avatar) {
      setPreviewUrl(user.avatar);
    }
  }, [user?.avatar]);

  // Nettoyage de l'URL blob
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl !== user?.avatar && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, user?.avatar]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setStatus({ type: 'error', message: 'Le fichier dépasse la taille maximale (2MB).' });
        return;
      }
      if (!file.type.startsWith('image/')) {
        setStatus({ type: 'error', message: 'Veuillez sélectionner une image valide.' });
        return;
      }

      setAvatarFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setStatus({ type: 'idle', message: '' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: 'loading', message: 'Mise à jour en cours...' });

    try {
      const formData = new FormData();
      formData.append('username', username);

      if (email) {
        formData.append('email', email);
      }

      if (password) {
        formData.append('password', password);
      }

      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      const response = await axios.put('/users/profile', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        }
      });

      setStatus({ type: 'success', message: 'Profil mis à jour avec succès !' });
      
      updateUser(response.data);
      setAvatarFile(null);
      setPassword('');

    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'Une erreur est survenue lors de la mise à jour.';
      setStatus({ type: 'error', message: errorMsg });
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 gap-6">
      
      {user && (
        <div className="text-center">
          <h1 className="text-xl text-slate-300">
            Connecté en tant que : <span className="font-semibold text-white">{user.username}</span> ({user.email})
          </h1>
          <p className="text-slate-400 text-sm mt-1">Welcome to Transcendence</p>
        </div>
      )}

      <div className="w-full max-w-md bg-slate-800 p-8 border border-slate-700 rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold mb-6 text-white">Paramètres du Profil</h2>

        {status.message && (
          <div className={`p-3 mb-4 rounded text-sm ${status.type === 'error' ? 'bg-red-900/50 text-red-200 border border-red-700' : 'bg-green-900/50 text-green-200 border border-green-700'}`}>
            {status.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Avatar Section */}
          <div className="flex flex-col items-center">
            <div className="relative w-28 h-28 mb-3 group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <img 
                src={previewUrl || '/default-avatar.png'} 
                alt="Avatar de profil" 
                className="w-full h-full object-cover rounded-full border-2 border-slate-600 shadow-md transition group-hover:opacity-75"
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/40 rounded-full">
                <span className="text-white text-xs px-2 py-1 bg-black/60 rounded">Modifier</span>
              </div>
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange} 
              accept="image/jpeg, image/png, image/webp"
              className="hidden" 
            />
            <p className="text-xs text-slate-400">Formats acceptés : JPG, PNG, WEBP (Max: 2MB)</p>
          </div>

          {/* Username Field */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-1">
              New Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              minLength={3}
              maxLength={20}
            />
          </div>

          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
              New Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Password Field with Eye Toggle */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
              New Password
            </label>
            <div className="relative flex items-center">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full p-2.5 pr-10 bg-slate-900 border border-slate-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                minLength={3}
                maxLength={20}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-slate-400 hover:text-white transition-colors focus:outline-none"
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12c1.274 4.057 5.065 7 9.542 7 4.477 0 8.268-2.943 9.542-7-1.274-4.057-5.065-7-9.542-7-4.477 0-8.268 2.943-9.542 7z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={status.type === 'loading'}
            className="w-full bg-blue-600 text-white font-semibold py-2.5 px-4 rounded hover:bg-blue-500 transition disabled:opacity-50 mt-2"
          >
            {status.type === 'loading' ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </button>
        </form>
      </div>

      <button 
        onClick={logout}
        className="px-6 py-2 bg-red-600 hover:bg-red-500 rounded text-sm font-medium transition-colors shadow-md"
      >
        Se déconnecter
      </button>

    </div>
  );
}
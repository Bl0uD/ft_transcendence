import axios from 'axios';
import { useAuthStore } from '../store/authStore'; // <-- AJOUT POUR LA 2FA

// Création de l'instance alignée sur ton proxy Caddy
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * 1. INTERCEPTEUR DE REQUÊTE
 */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * 2. INTERCEPTEUR DE RÉPONSE
 */
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Si le Backend renvoie une erreur 401
    if (error.response && error.response.status === 401) {
      const message = error.response.data?.message;

      // <-- AJOUT SEMAINE 5 : Gestion spécifique de la 2FA
      if (message === "2FA validation required") {
        console.warn('🟡 2FA requise. Bascule vers le formulaire OTP.');
        useAuthStore.getState().setRequires2FA(true);
      } else {
        // Vrai 401 (Token expiré, invalide, ou absent sur route protégée)
        console.warn('🔴 Session expirée ou invalide. Redirection vers le login.');
        
        // Sécurité : Nettoyage du localStorage (faute de frappe 'acccess_token' corrigée)
        localStorage.removeItem('access_token');
        
        // Redirection brutale mais efficace vers la page de login
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
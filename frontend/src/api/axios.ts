import axios from 'axios';

// Création de l'instance alignée sur ton proxy Caddy
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * 1. INTERCEPTEUR DE REQUÊTE
 * S'exécute AVANT que la requête ne parte vers NestJS
 */
api.interceptors.request.use(
  (config) => {
    // Récupération du token stocké lors du login
    const token = localStorage.getItem('access_token');
    
    // Si le token existe, on l'ajoute dans les headers HTTP
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    // Gestion des erreurs d'envoi
    return Promise.reject(error);
  }
);

/**
 * 2. INTERCEPTEUR DE RÉPONSE
 * S'exécute Dès que le Backend renvoie un résultat (Succès ou Erreur)
 */
api.interceptors.response.use(
  (response) => {
    // Si la requête est un succès (2xx), on laisse passer la réponse normalement
    return response;
  },
  (error) => {
    // Si le Backend renvoie une erreur 401 (Token expiré, invalide, ou absent sur route protégée)
    if (error.response && error.response.status === 401) {
      console.warn('🔴 Session expirée ou invalide. Redirection vers le login.');
      
      // Sécurité : Nettoyage du localStorage pour éviter les boucles d'erreur
      localStorage.removeItem('acccess_token');
      
      // Redirection brutale mais efficace vers la page de login
      window.location.href = '/login';
    }
    
    // On propage l'erreur pour que le composant (ex: Login.tsx) puisse l'afficher si besoin
    return Promise.reject(error);
  }
);

export default api;
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const message = error.response.data?.message;
      const requestUrl = error.config?.url || '';

      if (message === "2FA validation required" || message === "2FA requise") {
        console.warn('🟡 2FA requise. Bascule vers le formulaire OTP.');
        useAuthStore.getState().setRequires2FA(true);
      } 
      else if (
        !requestUrl.includes('/auth/login') && 
        !requestUrl.includes('/auth/register') &&
        !requestUrl.includes('/auth/2fa/authenticate') && 
        !requestUrl.includes('/auth/2fa/turn-on')
      ) {
        console.warn('🔴 Session expirée ou invalide. Déconnexion.');
        useAuthStore.getState().logout(); 
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
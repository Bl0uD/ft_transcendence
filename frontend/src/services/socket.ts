import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore'; // Adaptez le chemin vers votre store Zustand

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    const token = useAuthStore.getState().token;
    
    // Initialisation vers le namespace /chat (via Caddy)
    socket = io('/chat', {
      auth: { token },
      autoConnect: false, // Prévient la connexion avant que le composant Chat ne soit monté
      transports: ['websocket'], // Force WebSocket pour éviter le polling initial
	  reconnection: true,             // Tente de se reconnecter automatiquement
      reconnectionAttempts: 5,        // Nombre d'essais en cas de coupure réseau
      reconnectionDelay: 1000,        // Attente initiale (1s)
    });
  }
  return socket;
};

// Permet de mettre à jour le token avant de retenter une connexion
export const updateSocketToken = (newToken: string) => {
  if (socket) {
    socket.auth = { token: newToken };
  }
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
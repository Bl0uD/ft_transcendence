import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Socket } from 'socket.io-client';
import { getSocket, updateSocketToken } from '../services/socket';
import { useAuthStore } from '../store/useAuthStore';

interface UseSocketReturn {
  socket: Socket;
  isConnected: boolean;
  authError: string | null;
}

export const useSocket = (): UseSocketReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Méthodes issues de votre store Zustand
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  
  // Récupération du singleton
  const socket = getSocket();

  useEffect(() => {
    const handleConnect = () => {
      setIsConnected(true);
      setAuthError(null);
    };

    const handleConnectError = async (err: Error) => {
      setIsConnected(false);

      if (err.message.includes('Unauthorized') || err.message.includes('jwt expired')) {
        try {
          const newToken = await refreshToken();
          
          if (newToken) {
            updateSocketToken(newToken);
            socket.connect(); // Relance la connexion avec le nouveau token
          } else {
            logout();
            navigate('/login');
          }
        } catch (refreshErr) {
          logout();
          navigate('/login');
        }
      } else {
        setAuthError("Connexion au serveur de messagerie perdue.");
      }
    };

    const handleDisconnect = (reason: Socket.DisconnectReason) => {
      setIsConnected(false);
      if (reason === 'io server disconnect') {
        socket.connect();
      }
    };

    // 1. Souscription aux événements système
    socket.on('connect', handleConnect);
    socket.on('connect_error', handleConnectError);
    socket.on('disconnect', handleDisconnect);

    // 2. Initialisation : connecter si ce n'est pas déjà fait
    if (!socket.connected) {
      socket.connect();
    } else {
      setIsConnected(true); // Gère le cas où le socket est déjà connecté avant le montage
    }

    // 3. Nettoyage strict (Sécurité mémoire)
    return () => {
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleConnectError);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket, refreshToken, logout, navigate]);

  return { socket, isConnected, authError };
};
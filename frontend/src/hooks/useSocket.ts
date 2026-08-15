import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Socket } from 'socket.io-client';
import { getSocket, updateSocketToken } from '../services/socket';
import { useAuthStore } from '../store/authStore';
import { useSocialStore } from '../store/socialStore'; // <-- AJOUT

interface UseSocketReturn {
  socket: Socket;
  isConnected: boolean;
  authError: string | null;
}

export const useSocket = (): UseSocketReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const refreshToken = useAuthStore((state) => state.refreshToken);
  const logout = useAuthStore((state) => state.logout);
  const updateFriendStatus = useSocialStore((state) => state.updateFriendStatus); // <-- AJOUT
  const navigate = useNavigate();
  
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
            socket.connect(); 
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

    // <-- AJOUT SEMAINE 5 : Gestion de la présence
    const handleUserConnected = (data: { userId: number, status: 'ONLINE' }) => {
      updateFriendStatus(data.userId, data.status);
    };

    const handleUserDisconnected = (data: { userId: number, status: 'OFFLINE' }) => {
      updateFriendStatus(data.userId, data.status);
    };

    // 1. Souscription aux événements système
    socket.on('connect', handleConnect);
    socket.on('connect_error', handleConnectError);
    socket.on('disconnect', handleDisconnect);
    
    // Souscription aux événements de présence
    socket.on('user_connected', handleUserConnected);
    socket.on('user_disconnected', handleUserDisconnected);

    // 2. Initialisation : connecter si ce n'est pas déjà fait
    if (!socket.connected) {
      socket.connect();
    } else {
      setIsConnected(true); 
    }

    // 3. Nettoyage strict (Sécurité mémoire)
    return () => {
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleConnectError);
      socket.off('disconnect', handleDisconnect);
      
      // Nettoyage de la présence
      socket.off('user_connected', handleUserConnected);
      socket.off('user_disconnected', handleUserDisconnected);
    };
  }, [socket, refreshToken, logout, navigate, updateFriendStatus]); // <-- MAJ des dépendances

  return { socket, isConnected, authError };
};
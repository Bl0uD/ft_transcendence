import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client'; // 👈 Import de 'io' pour gérer les instances localement
import { useAuthStore } from '../store/authStore';
import { useSocialStore } from '../store/socialStore';

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  authError: string | null;
}

// 🟢 SÉCURITÉ : Cache global pour éviter d'ouvrir 50 connexions pour le même namespace
const socketCache: Record<string, Socket> = {};

export const useSocket = (namespace: string = '/'): UseSocketReturn => {
  const [socket, setSocket] = useState<Socket | null>(socketCache[namespace] || null);
  const [isConnected, setIsConnected] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const refreshToken = useAuthStore((state: any) => state.refreshToken);
  const logout = useAuthStore((state: any) => state.logout);
  const updateFriendStatus = useSocialStore((state: any) => state.updateFriendStatus);
  const navigate = useNavigate();
  
  const token = localStorage.getItem('access_token');

  useEffect(() => {
    // Si l'utilisateur n'est pas authentifié, on coupe et on nettoie ce namespace
    if (!token) {
      if (socketCache[namespace]) {
        socketCache[namespace].disconnect();
        delete socketCache[namespace];
      }
      setSocket(null);
      setIsConnected(false);
      return;
    }

    // 1. Initialisation : créer le socket s'il n'existe pas encore pour ce namespace
    if (!socketCache[namespace]) {
      socketCache[namespace] = io(namespace, {
        auth: { token },
        path: '/socket.io', // ⚠️ Ajuste ici si tu avais une config spéciale pour ton Nginx
        transports: ['websocket'],
      });
    }

    const currentSocket = socketCache[namespace];
    setSocket(currentSocket);

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
            currentSocket.auth = { token: newToken };
            currentSocket.connect(); 
          } else {
            logout();
            navigate('/');
          }
        } catch (refreshErr) {
          logout();
          navigate('/');
        }
      } else {
        setAuthError(`Connexion au serveur ${namespace} perdue.`);
      }
    };

    const handleDisconnect = (reason: Socket.DisconnectReason) => {
      setIsConnected(false);
      if (reason === 'io server disconnect') {
        currentSocket.connect();
      }
    };

    const handleUserConnected = (data: { userId: number, status: 'ONLINE' }) => {
      if (updateFriendStatus) updateFriendStatus(data.userId, data.status);
    };

    const handleUserDisconnected = (data: { userId: number, status: 'OFFLINE' }) => {
      if (updateFriendStatus) updateFriendStatus(data.userId, data.status);
    };

    // 2. Souscription aux événements système
    currentSocket.on('connect', handleConnect);
    currentSocket.on('connect_error', handleConnectError);
    currentSocket.on('disconnect', handleDisconnect);
    
    // On n'écoute la présence en ligne que sur le socket global ('/')
    if (namespace === '/') {
      currentSocket.on('user_connected', handleUserConnected);
      currentSocket.on('user_disconnected', handleUserDisconnected);
    }

    if (!currentSocket.connected) {
      currentSocket.connect();
    } else {
      setIsConnected(true); 
    }

    // 3. Nettoyage strict au démontage
    return () => {
      currentSocket.off('connect', handleConnect);
      currentSocket.off('connect_error', handleConnectError);
      currentSocket.off('disconnect', handleDisconnect);
      
      if (namespace === '/') {
        currentSocket.off('user_connected', handleUserConnected);
        currentSocket.off('user_disconnected', handleUserDisconnected);
      }
    };
  }, [namespace, token, refreshToken, logout, navigate, updateFriendStatus]);

  return { socket, isConnected, authError };
};
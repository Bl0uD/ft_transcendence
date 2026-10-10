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

const socketCache: Record<string, Socket> = {};

export const useSocket = (namespace: string = '/'): UseSocketReturn => {
  const [socket, setSocket] = useState<Socket | null>(socketCache[namespace] || null);
  const [isConnected, setIsConnected] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const refreshToken = useAuthStore((state: any) => state.refreshToken);
  const logout = useAuthStore((state: any) => state.logout);
  const requires2FA = useAuthStore((state: any) => state.requires2FA);
  const updateFriendStatus = useSocialStore((state: any) => state.updateFriendStatus);
  const navigate = useNavigate();
  
  const token = localStorage.getItem('access_token');

  useEffect(() => {
    // Si l'utilisateur n'est pas authentifié ou doit passer la 2FA, on coupe et on nettoie ce namespace
    if (!token || requires2FA) {
      if (socketCache[namespace]) {
        socketCache[namespace].disconnect();
        delete socketCache[namespace];
      }
      setSocket(null);
      setIsConnected(false);
      return;
    }

    if (!socketCache[namespace]) {
      socketCache[namespace] = io(namespace, {
        auth: { token },
        path: '/socket.io',
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
      // On ne reconnecte plus aveuglément si c'est une déconnexion serveur (ça peut être une 403)
      // Socket.io le gère si on le laisse faire, ou bien on écoute auth_error
      if (reason === 'io server disconnect' && !authError) {
        currentSocket.connect();
      }
    };

    const handleAuthError = async (err: { message: string }) => {
      setIsConnected(false);
      if (err.message.includes('2FA validation required') || err.message.includes('jwt expired') || err.message.includes('Aucun jeton')) {
         // Si c'est juste la 2FA on attend. Sinon on déconnecte
         if (!err.message.includes('2FA')) {
             logout();
             navigate('/');
         }
      }
    };

    const handleUserConnected = (data: { userId: number, status: 'ONLINE' }) => {
      if (updateFriendStatus) updateFriendStatus(data.userId, data.status);
    };

    const handleUserDisconnected = (data: { userId: number, status: 'OFFLINE' }) => {
      if (updateFriendStatus) updateFriendStatus(data.userId, data.status);
    };

    currentSocket.on('connect', handleConnect);
    currentSocket.on('connect_error', handleConnectError);
    currentSocket.on('disconnect', handleDisconnect);
    currentSocket.on('auth_error', handleAuthError);
    
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

    return () => {
      currentSocket.off('connect', handleConnect);
      currentSocket.off('connect_error', handleConnectError);
      currentSocket.off('disconnect', handleDisconnect);
      currentSocket.off('auth_error', handleAuthError);
      
      if (namespace === '/') {
        currentSocket.off('user_connected', handleUserConnected);
        currentSocket.off('user_disconnected', handleUserDisconnected);
      }
    };
  }, [namespace, token, requires2FA, refreshToken, logout, navigate, updateFriendStatus]);

  return { socket, isConnected, authError };
};
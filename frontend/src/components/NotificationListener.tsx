import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useSocket } from '../hooks/useSocket';

interface NotificationPayload {
  type?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  actionUrl?: string;
}

export const NotificationListener = () => {
  const { socket } = useSocket('/');
  const [permission, setPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  );

  const requestPermission = async () => {
    if (!('Notification' in window)) return;
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
    } catch (e) {
      console.error('Erreur lors de la demande de permission:', e);
    }
  };

  useEffect(() => {
    // Si la permission est 'default', on propose à l'utilisateur de l'activer
    if (permission === 'default' && 'Notification' in window) {
      toast('Activer les notifications natives ?', {
        action: {
          label: 'Activer',
          onClick: requestPermission,
        },
        duration: Infinity, // On laisse le temps de cliquer car c'est important sur iOS
      });
    }
  }, [permission]);

  useEffect(() => {
    if (!socket) return;

    const handleNotification = (data: NotificationPayload) => {
      const type = data.type || 'info';
      const title = data.title || 'Notification';

      // 1. Notification in-app (Toast visuel)
      const toastFn = (toast[type] || toast) as (msg: string, opts?: any) => void;
      toastFn(data.message, {
        description: data.title,
        duration: 4000,
      });

      // 2. Notification native (iOS PWA, Android, Desktop)
      if ('Notification' in window && Notification.permission === 'granted') {
        // Optionnel : ne notifier nativement que si l'app est en arrière-plan
        // if (!document.hidden) return;

        navigator.serviceWorker?.ready.then(registration => {
          // Utiliser le Service Worker (Obligatoire pour iOS)
          registration.showNotification(title, {
            body: data.message,
            icon: '/favicon.svg',
          });
        }).catch(() => {
          // Fallback navigateur desktop
          try {
            new Notification(title, {
              body: data.message,
              icon: '/favicon.svg',
            });
          } catch (e) {
            console.error('Notification system fallback failed', e);
          }
        });
      }
    };

    socket.on('notification', handleNotification);

    return () => {
      socket.off('notification', handleNotification);
    };
  }, [socket]);

  return null;
};

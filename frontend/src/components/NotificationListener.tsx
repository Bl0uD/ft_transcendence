import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useSocket } from '../hooks/useSocket';

export interface NotificationPayload {
  type?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  actionUrl?: string;
}

// Fonction utilitaire pour déclencher une notification système depuis n'importe où
export const triggerSystemNotification = (data: NotificationPayload) => {
  const type = data.type || 'info';
  const title = data.title || 'Notification';

  // 1. In-app toast
  const toastFn = (toast[type] || toast) as (msg: string, opts?: any) => void;
  toastFn(data.message, {
    description: data.title,
    duration: 4000,
  });

  // 2. System notification
  if ('Notification' in window && Notification.permission === 'granted') {
    navigator.serviceWorker?.ready.then(registration => {
      registration.showNotification(title, {
        body: data.message,
        icon: '/favicon.svg',
      });
    }).catch(() => {
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

export const NotificationListener = () => {
  const { socket: mainSocket } = useSocket('/');
  const { socket: chatSocket } = useSocket('/chat');
  
  const [permission, setPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  );

  const requestPermission = async () => {
    if (!('Notification' in window)) return;
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm === 'granted') {
        toast.success('Notifications activées avec succès !');
      }
    } catch (e) {
      console.error('Erreur lors de la demande de permission:', e);
    }
  };

  useEffect(() => {
    if (permission === 'default' && 'Notification' in window) {
      toast('Activer les notifications natives ?', {
        action: {
          label: 'Activer',
          onClick: requestPermission,
        },
        duration: Infinity, 
      });
    }
  }, [permission]);

  useEffect(() => {
    const handleNotification = (data: NotificationPayload) => {
      triggerSystemNotification(data);
    };

    if (mainSocket) {
      mainSocket.on('notification', handleNotification);
    }
    if (chatSocket) {
      chatSocket.on('notification', handleNotification);
    }

    return () => {
      if (mainSocket) mainSocket.off('notification', handleNotification);
      if (chatSocket) chatSocket.off('notification', handleNotification);
    };
  }, [mainSocket, chatSocket]);

  return null;
};


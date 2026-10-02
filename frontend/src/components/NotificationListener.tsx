import { useEffect } from 'react';
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

  useEffect(() => {
    if (!socket) return;

    const handleNotification = (data: NotificationPayload) => {
      const type = data.type || 'info';
      const toastFn = (toast[type] || toast) as (msg: string, opts?: any) => void;

      toastFn(data.message, {
        description: data.title,
        duration: 4000,
      });
    };

    socket.on('notification', handleNotification);

    return () => {
      socket.off('notification', handleNotification);
    };
  }, [socket]);

  return null;
};

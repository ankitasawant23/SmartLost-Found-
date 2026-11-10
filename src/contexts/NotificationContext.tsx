import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';

import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';

import { getToken, onMessage } from 'firebase/messaging';
import { db, messagingPromise } from '../lib/firebase';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt?: any;
  link?: string;
}

interface NotificationContextType {
  requestPermission: () => Promise<void>;
  token: string | null;
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  requestPermission: async () => {},
  token: null,
  notifications: [],
  unreadCount: 0,
  markAsRead: async () => {},
  markAllAsRead: async () => {},
});

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const { user } = useAuth();

  const unreadCount = notifications.filter(
    (notification) => !notification.read
  ).length;

  const requestPermission = useCallback(async (): Promise<void> => {
    try {
      if (!('Notification' in window)) {
        console.warn('This browser does not support notifications.');
        return;
      }

      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        return;
      }

      const vapidKey = import.meta.env.VITE_VAPID_KEY;

      if (!vapidKey) {
        console.warn('VITE_VAPID_KEY is missing from .env.');
        return;
      }

      const messaging = await messagingPromise;

      if (!messaging) {
        console.warn('Firebase Messaging is not supported in this browser.');
        return;
      }

      const fcmToken = await getToken(messaging, { vapidKey });

      if (fcmToken) {
        setToken(fcmToken);

        // Token storage can be implemented separately.
        console.log('FCM token obtained successfully.');
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setToken(null);
      return;
    }

    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const notificationData: AppNotification[] = snapshot.docs.map(
          (notificationDoc) => {
            const data = notificationDoc.data();

            return {
              id: notificationDoc.id,
              userId: data.userId,
              title: data.title || 'Notification',
              message: data.message || '',
              read: data.read === true,
              createdAt: data.createdAt,
              link: typeof data.link === 'string' ? data.link : undefined,
            };
          }
        );

        setNotifications(notificationData);
      },
      (error) => {
        console.error('Error loading notifications:', error);
        toast.error('Could not load notifications.');
      }
    );

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    void requestPermission();
  }, [user, requestPermission]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const setupForegroundNotifications = async () => {
      try {
        const messaging = await messagingPromise;

        if (!messaging) return;

        unsubscribe = onMessage(messaging, (payload) => {
          toast.success(
            payload.notification?.title || 'New notification'
          );
        });
      } catch (error) {
        console.error(
          'Error setting up foreground notifications:',
          error
        );
      }
    };

    void setupForegroundNotifications();

    return () => {
      unsubscribe?.();
    };
  }, []);

  const markAsRead = async (notificationId: string) => {
if (!user) return;

const notification = notifications.find(
(item) => item.id === notificationId
);

if (!notification || notification.read) return;

try {
await updateDoc(doc(db, 'notifications', notificationId), {
read: true,
});
} catch (error) {
console.error('Error marking notification as read:', error);
toast.error('Could not mark notification as read.');
throw error;
}
};

const markAllAsRead = async () => {
if (!user) return;

const unreadNotifications = notifications.filter(
(notification) => !notification.read
);

try {
await Promise.all(
unreadNotifications.map((notification) =>
updateDoc(doc(db, 'notifications', notification.id), {
read: true,
})
)
);


if (unreadNotifications.length > 0) {
  toast.success('All notifications marked as read.');
}

} catch (error) {
console.error('Error marking all notifications as read:', error);
toast.error('Could not update all notifications.');
throw error;
}
};

  return (
    <NotificationContext.Provider
      value={{
        requestPermission,
        token,
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
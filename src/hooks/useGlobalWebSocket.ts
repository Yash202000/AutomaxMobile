import { useEffect, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import { t } from 'i18next';
import { baseURL } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CustomAlert } from '../components/CustomAlert';

const getWsUrl = () => {
  return baseURL
    .replace(/\/api\/v\d+\/?$/, '')
    .replace(/^https:/, 'wss:')
    .replace(/^http:/, 'ws:')
    .replace(/\/$/, '');
};
export const useGlobalWebSocket = () => {
  const { user, isAuthenticated, refreshUser } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      if (wsRef.current) {
        wsRef.current.close(1000, 'User logged out');
        wsRef.current = null;
      }
      return;
    }

    let isMounted = true;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    const connect = async () => {
      if (
        wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING
      ) {
        return;
      }

      const token = await SecureStore.getItemAsync('authToken');
      if (!token || !isMounted) return;

      const wsHost = getWsUrl();
      if (!wsHost) return;

      const params = new URLSearchParams({
        channel: 'global',
        user_id: user.id,
        token,
      });

      const fullUrl = `${wsHost}/api/v1/ws/broadcast?${params.toString()}`;
      const ws = new WebSocket(fullUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttempts = 0;
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;

        try {
          const message = JSON.parse(event.data as string);
          if (message.type === 'permissions_changed') {
            refreshUser()
              .then(() => {
                if (!isMounted) return;
                CustomAlert.alert(
                  t('common.permissionsUpdatedTitle'),
                  t('common.permissionsUpdatedMessage')
                );
              })
              .catch(() => {
                // Ignore — the app will pick up the latest permissions on next load/refresh
              });
          }
        } catch {
          // Ignore malformed / unrelated broadcast messages
        }
      };

      ws.onclose = (event) => {
        wsRef.current = null;

        const isExpectedClosure = event.code === 1000 || event.code === 1001;
        if (isExpectedClosure || !isMounted) return;

        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts += 1;
          const delay = Math.min(1000 * 2 ** reconnectAttempts, 30000);
          reconnectTimeout = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        // onclose fires next and handles reconnection
      };
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Unmounting');
        wsRef.current = null;
      }
    };
  }, [isAuthenticated, user?.id, refreshUser]);
};

export default useGlobalWebSocket;

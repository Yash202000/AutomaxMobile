import { loadKffNotifications } from '@/src/components/kff/kffNotificationStore';

/**
 * KFF Dispatcher push / inbox tap: an INCIDENT notification opens the KFF
 * incident detail (data.id = incident id, as in the inbox `meta`), anything
 * else opens the notification inbox. Also refreshes the inbox so the bell
 * badge and list reflect the new notification.
 */
export function handleKffNotification(data: any, navigation: any) {
  loadKffNotifications('refresh');
  if (data?.type === 'INCIDENT' && data?.id) {
    navigation.push({ pathname: '/(tabs)/kff-incident-detail', params: { id: String(data.id) } });
  } else {
    navigation.push('/(tabs)/kff-incident-alerts');
  }
}

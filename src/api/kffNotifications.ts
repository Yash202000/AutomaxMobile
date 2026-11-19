import { loadKffSession } from '../services/kffSession';
import apiClient from './client';

export { markNotificationAsRead as markKffNotificationRead } from './notifications';

// KFF Dispatcher notification inbox: incidents dispatched to the logged-in
// user. `received_by` is the user_id returned by passcode login (saved in the
// KFF session).

export interface KffNotificationPage {
  items: any[];
  page: number;
  totalPages: number;
}

export const fetchKffNotifications = async (
  page = 1,
  limit = 15,
): Promise<{ success: true; data: KffNotificationPage } | { success: false; error: string }> => {
  const userId = (await loadKffSession())?.userId;
  if (!userId) return { success: true, data: { items: [], page: 1, totalPages: 0 } };
  try {
    const response = await apiClient.get('/notifications', {
      params: { page, limit, channel: 'notification', category: 'inbox', received_by: userId },
    });
    if (!response.data?.success) return { success: false, error: 'Invalid response from server' };
    return {
      success: true,
      data: {
        items: response.data.data || [],
        page: response.data.page || page,
        totalPages: response.data.total_pages || 1,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Request failed',
    };
  }
};

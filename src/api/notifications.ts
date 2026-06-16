import apiClient, { baseURL } from './client';

interface PaginationInfo {
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
}

interface NotificationListResponse {
    success: boolean;
    data: any[];
    pagination: PaginationInfo;
    error?: string;
}

/**
 * Get notifications with optional filters
 * @param params Filters for notifications (end_date, status, channel, category, direction, page, limit)
 */
export const getNotifications = async (params: Record<string, any> = {}): Promise<NotificationListResponse> => {
    try {
        const queryParams = {
            page: params.page || 1,
            limit: params.limit || 20,
            ...params,
        };

        const response = await apiClient.get('/notifications', { params: queryParams });

        if (response.data && response.data.success) {
            return {
                success: true,
                data: response.data.data || [],
                pagination: {
                    page: response.data.page || 1,
                    limit: response.data.limit || 20,
                    total_items: response.data.total_items || 0,
                    total_pages: response.data.total_pages || 0,
                },
            };
        }

        return {
            success: false,
            data: [],
            pagination: { page: 1, limit: 20, total_items: 0, total_pages: 0 },
            error: 'Invalid response from server'
        };
    } catch (error: any) {
        return {
            success: false,
            data: [],
            pagination: { page: 1, limit: 20, total_items: 0, total_pages: 0 },
            error: error.response?.data?.message || error.message
        };
    }
};

export const markNotificationAsRead = async (id: string, isRead: boolean = true): Promise<{ success: boolean; error?: string }> => {
    try {
        const response = await apiClient.patch(`/notifications/${id}/read`, { is_read: isRead });
        if (response.data && response.data.success) {
            return { success: true };
        }
        return { success: false, error: 'Invalid response from server' };
    } catch (error: any) {
        return {
            success: false,
            error: error.response?.data?.message || error.message
        };
    }
};

export const registerToken = async (payload: { device_token: string, device_type: string, user_id: string }) => {
    try {
        console.log("[API] Registering token at:", baseURL + '/fcm/register');
        const response = await apiClient.post('/fcm/register', payload);
        if (response.status >= 200 && response.status < 300) {
            console.log("[API] Token registered successfully:", response.data);
            return { success: true, data: response.data.message };
        }
        console.log("[API] Token registration failed with status:", response.status);
        return { success: false, error: 'Invalid response from server' };
    } catch (error: any) {
        console.log("[API] Token registration failed with error:", error.message);
        if (error.response) {
            console.log("[API] Error response data:", error.response.data);
        }
        return { success: false, error: error.response?.data?.message || error.message };
    }
};

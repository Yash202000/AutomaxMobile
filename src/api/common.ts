import apiClient from './client';

export interface AppSettings {
    app_name?: string;
    app_tagline?: string;
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
    accent_color?: string;
    default_language?: string;
    supported_languages?: string[];
    // Not yet returned by the backend — being added separately. Read
    // defensively (optional chaining) until it actually ships.
    auth_setting?: {
        totp_enabled?: boolean;
    };
    [key: string]: unknown;
}

export const getSettings = async () => {
    try {
        const url = `/settings`;
        const response = await apiClient.get(url);
        if (response.data && response.data.success) {
            return { success: true, data: response.data.data as AppSettings };
        }
        return { success: false, error: 'Invalid response from server' };
    } catch (error: any) {
        return { success: false, error: error.response?.data?.message || error.message };
    }
};
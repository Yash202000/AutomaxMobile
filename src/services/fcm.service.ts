import {
    AuthorizationStatus,
    getMessaging,
    getToken,
    onTokenRefresh as onTokenRefreshModular,
    requestPermission
} from '@react-native-firebase/messaging';
import { PermissionsAndroid } from 'react-native';

class FCMService {
    async init(): Promise<string | null> {
        try {
            await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
            const messaging = getMessaging();
            const authStatus = await requestPermission(messaging);
            const enabled =
                authStatus === AuthorizationStatus.AUTHORIZED ||
                authStatus === AuthorizationStatus.PROVISIONAL;

            if (!enabled) {
                console.warn('[FCM] Permission denied');
                return null;
            }

            const token = await getToken(messaging);
            return token;
        } catch (error) {
            console.warn('[FCM] Failed to get token:', error);
            return null;
        }
    }

    onTokenRefresh(callback: (token: string) => void) {
        try {
            return onTokenRefreshModular(getMessaging(), callback);
        } catch (error) {
            console.warn('[FCM] Failed to subscribe to token refresh:', error);
            return () => {}; // no-op unsubscribe
        }
    }
}

export default new FCMService();
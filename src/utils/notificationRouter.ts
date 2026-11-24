import { handleKffNotification } from './kffNotificationRouter';
import { isKffDispatcher } from './kff';

export function handleNotification(data: any, navigation: any) {
    // KFF Dispatcher has its own screens; Automax routing below is unchanged.
    if (isKffDispatcher()) return handleKffNotification(data, navigation);
    if (data?.type) {
        switch (data.type) {
            case "INCIDENT":
                navigation.push(`/incident-details?id=${data.id}`);
                break;
            case "REQUEST":
                navigation.push(`/request-details?id=${data.id}`);
                break;
            case "COMPLAINT":
                navigation.push(`/complaint-details?id=${data.id}`);
                break;
            case "QUERY":
                navigation.push(`/query-details?id=${data.id}`);
                break;
            default:
                navigation.push('/(tabs)/explore');
                break;
        }
    } else {
        navigation.push('/my-incidents');
    }
}
import notifee, { AndroidImportance } from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import 'expo-router/entry';

messaging().setBackgroundMessageHandler(async remoteMessage => {
    console.log('Background message:', remoteMessage);

    // If it's a data-only message, we might want to show a notification manually
    if (remoteMessage.data && !remoteMessage.notification) {
        const title = remoteMessage.data.subject as string || remoteMessage.data.title as string || 'New Notification';
        const body = remoteMessage.data.body as string || '';

        await notifee.displayNotification({
            title: title,
            body: body,
            android: {
                channelId: 'default',
                importance: AndroidImportance.HIGH,
                pressAction: {
                    id: 'default',
                },
            },
            data: remoteMessage.data,
        });
    }
});
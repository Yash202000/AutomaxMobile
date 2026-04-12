import { handleNotification } from "@/src/utils/notificationRouter";
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    getInitialNotification,
    getMessaging,
    onMessage,
    onNotificationOpenedApp
} from '@react-native-firebase/messaging';
import { useEffect } from "react";

export function useFCM(navigation: any) {

    useEffect(() => {
        const messaging = getMessaging();
        // foreground
        const unsubscribeOnMessage = onMessage(messaging, async remoteMessage => {
            console.log("Foreground:", remoteMessage);

            const enabled = await AsyncStorage.getItem('notificationsEnabled');
            if (enabled === 'false') {
                console.log("[FCM] Notifications are disabled, skipping foreground display.");
                return;
            }

            const title = remoteMessage.notification?.title || remoteMessage.data?.subject as string || remoteMessage.data?.title as string || 'New Notification';
            const body = remoteMessage.notification?.body || remoteMessage.data?.body as string || '';

            if (remoteMessage.notification || remoteMessage.data) {
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


        const unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }) => {
            if (type === EventType.PRESS && detail.notification?.data) {
                handleNotification(detail.notification.data, navigation);
            }
        });


        const unsubscribeOpened = onNotificationOpenedApp(messaging, remoteMessage => {
            if (remoteMessage?.data) {
                handleNotification(remoteMessage.data, navigation);
            }
        });


        // Cold-start: app opened from a killed state via notification.
        // Delay navigation so auth state and the router both finish loading first.
        getInitialNotification(messaging)
            .then(remoteMessage => {
                if (remoteMessage?.data) {
                    setTimeout(() => {
                        handleNotification(remoteMessage.data, navigation);
                    }, 1000);
                }
            });

        return () => {
            unsubscribeOnMessage();
            unsubscribeOpened();
            unsubscribeNotifee();
        };

    }, [navigation]);
}
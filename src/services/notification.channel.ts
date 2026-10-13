import { Platform } from 'react-native';

export async function createChannel() {
    // Notification channels only exist on Android. Notifee is required lazily so a
    // build/runtime without its native module (Expo Go, web, stale dev client)
    // doesn't throw `new NativeEventEmitter() requires a non-null argument` at import.
    if (Platform.OS !== 'android') return;

    try {
        const { default: notifee, AndroidImportance } = require('@notifee/react-native');
        await notifee.createChannel({
            id: 'default',
            name: 'Default Channel',
            importance: AndroidImportance.HIGH,
            sound: 'default'
        });
    } catch (error) {
        console.warn('[Notifee] Failed to create channel:', error);
    }
}

import notifee, { AndroidImportance } from '@notifee/react-native';

export async function createChannel() {
    await notifee.createChannel({
        id: 'default',
        name: 'Default Channel',
        importance: AndroidImportance.HIGH,
    });
}
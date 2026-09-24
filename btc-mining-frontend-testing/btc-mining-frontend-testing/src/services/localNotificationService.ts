
import notifee, {
    TriggerType,
    AndroidImportance,
    AuthorizationStatus,
    AndroidNotificationSetting,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';

// Use Notifee on both platforms for permission check so iOS reflects actual system status
// (Firebase messaging().hasPermission() can be out of sync when user turns notifications off in Settings).

class LocalNotificationService {
    private channelId: string = 'mining-reminders';

    constructor() { 
        this.createChannel();
    }

    async createChannel() {
        if (Platform.OS === 'android') {
            await notifee.createChannel({
                id: this.channelId,
                name: 'Mining Reminders',
                importance: AndroidImportance.HIGH,
                sound: 'default',
                vibration: true,
            });
        }
    }

    async requestPermission(): Promise<boolean> {
        const settings = await notifee.requestPermission();
        return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
    }

    /**
     * Platform-aware check: are notifications allowed?
     * On Android uses Notifee (Firebase hasPermission is unreliable).
     * On iOS uses Firebase messaging.
     */
    async isNotificationPermissionGranted(): Promise<boolean> {
        if (Platform.OS === 'android') {
            const settings = await notifee.getNotificationSettings();
            return settings.authorizationStatus === AuthorizationStatus.AUTHORIZED;
        }
        const authStatus = await messaging().hasPermission();
        return (
            authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
            authStatus === messaging.AuthorizationStatus.PROVISIONAL
        );
    }

    /**
     * Platform-aware request: ask for notification permission.
     * Returns true if granted after request.
     */
    async requestNotificationPermissionForMining(): Promise<boolean> {
        if (Platform.OS === 'android') {
            const settings = await notifee.requestPermission();
            return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
        }
        const newStatus = await messaging().requestPermission();
        return (
            newStatus === messaging.AuthorizationStatus.AUTHORIZED ||
            newStatus === messaging.AuthorizationStatus.PROVISIONAL
        );
    }

    /**
     * Schedule a notification for the next 12:00 PM (Noon).
     *
     * Mining itself still resets at midnight (unchanged, see HomeScreen's own
     * midnight refresh logic) -- this notification is deliberately delayed
     * to fire at noon instead of pinging users at midnight.
     */
    async scheduleMiningResetNotification() {
        const hasPermission = await this.requestPermission();
        if (!hasPermission) {
            console.log('Notification permission denied');
            return;
        }

        // Android 12+: exact alarm permission must be enabled for TIMESTAMP triggers.
        if (Platform.OS === 'android') {
            try {
                const settings = await notifee.getNotificationSettings();
                if (settings.android?.alarm !== AndroidNotificationSetting.ENABLED) {
                    console.log('[Notifee] Exact alarm permission is disabled. Opening alarm permission settings.');
                    // This opens: Alarms & reminders settings screen for your app.
                    await notifee.openAlarmPermissionSettings();
                    return;
                }
            } catch (e) {
                console.warn('[Notifee] Failed to check/open alarm permission settings:', e);
                // Continue anyway; worst-case scheduling may fail on some devices.
            }
        }

        // Cancel any existing mining reminders to avoid duplicates
        await notifee.cancelNotification('mining-reset-reminder');

        // Calculate the next upcoming noon (today's if it hasn't passed yet, else tomorrow's).
        const now = new Date();
        const nextNoon = new Date(now);
        nextNoon.setHours(12, 0, 0, 0);

        if (nextNoon.getTime() <= now.getTime()) {
            nextNoon.setDate(nextNoon.getDate() + 1);
        }

        console.log('Scheduling mining reset notification for:', nextNoon.toLocaleString());

        // Create a time-based trigger
        const trigger: any = {
            type: TriggerType.TIMESTAMP,
            timestamp: nextNoon.getTime(),
            // Use AlarmManager so it can still fire when app is killed.
            // `allowWhileIdle` improves reliability under Doze / idle modes.
            alarmManager: Platform.OS === 'android' ? { allowWhileIdle: true } : undefined,
        };

        // Create a trigger notification
        await notifee.createTriggerNotification(
            {
                id: 'mining-reset-reminder',
                title: '⛏️ Mining Reset Alert',
                body: 'Your mining session has reset! Tap here to reactivate mining and keep earning.',
                android: {
                    channelId: this.channelId,
                    pressAction: {
                        id: 'default',
                    },
                    sound: 'default',
                    smallIcon: 'ic_launcher', // Ensure this icon exists or use default
                },
                ios: {
                    sound: 'default',
                },
            },
            trigger,
        );
    }

    async cancelMiningResetNotification() {
        await notifee.cancelNotification('mining-reset-reminder');
    }
}

export const localNotificationService = new LocalNotificationService();

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { groqService } from './groqService';

// Configure how notifications behave when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const notificationService = {
  async registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF3366',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        return false;
      }
      token = (await Notifications.getExpoPushTokenAsync()).data;
    } else {
      console.log('Must use physical device for Push Notifications');
    }

    return token;
  },

  // Schedules personalized daily local notifications (Morning 10 AM, Evening 8 PM)
  async scheduleDailyReminder(user) {
    if (!user) return;
    const hasPermission = await this.registerForPushNotificationsAsync();
    if (!hasPermission) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const lastGenDate = await AsyncStorage.getItem('notifications_last_gen_date');

    // Only hit Groq AI once a day to save tokens
    if (lastGenDate === todayStr) {
      console.log('[Notifications] AI notifications already scheduled for today.');
      return;
    }

    console.log('[Notifications] Generating new personalized notifications via Groq...');
    const messages = await groqService.generateDailyNotifications(user.displayName);

    // Clear any existing scheduled notifications
    await Notifications.cancelAllScheduledNotificationsAsync();

    // 1. Morning Notification (10:00 AM)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Morning Vibe Check",
        body: messages.morning,
        sound: true,
      },
      trigger: { hour: 10, minute: 0, repeats: true },
    });

    // 2. Evening Notification (8:00 PM)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Daily Sync Reminder",
        body: messages.evening,
        sound: true,
      },
      trigger: { hour: 20, minute: 0, repeats: true },
    });

    await AsyncStorage.setItem('notifications_last_gen_date', todayStr);
    console.log(`[Notifications] Scheduled Morning (10 AM) and Evening (8 PM) reminders for ${user.displayName}`);
  },
  
  async cancelAllReminders() {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.removeItem('notifications_last_gen_date'); // clear cache so next toggle on regenerates
    console.log('[Notifications] All reminders canceled.');
  },

  async testNotification(user) {
    const hasPermission = await this.registerForPushNotificationsAsync();
    if (!hasPermission || !user) return;

    console.log('[Notifications] Testing AI generation for', user.displayName);
    const messages = await groqService.generateDailyNotifications(user.displayName);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Test: Evening Vibe",
        body: messages.evening,
        sound: true,
      },
      trigger: null, // trigger immediately
    });
    console.log('[Notifications] Test AI notification triggered immediately.');
  }
};

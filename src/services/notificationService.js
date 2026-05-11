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

    try {
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
        // In EAS builds, projectId must be passed to getExpoPushTokenAsync
        // We use the ID from app.config.js / constants
        token = (await Notifications.getExpoPushTokenAsync({
          projectId: '41e11ca8-ecb6-48dd-8965-df244cb423d5' 
        })).data;
      } else {
        console.log('Must use physical device for Push Notifications');
      }
    } catch (e) {
      console.error('Error registering for push notifications:', e);
      return false;
    }

    return token;
  },

  // Schedules personalized daily local notifications (Morning 10 AM, Evening 8 PM)
  async scheduleDailyReminder(user) {
    if (!user) return;
    
    try {
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
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Morning Vibe Check",
            body: messages.morning,
            sound: true,
          },
          trigger: { type: 'daily', hour: 10, minute: 0 },
        });
      } catch (e) {
        console.warn('[Notifications] Failed to schedule morning:', e?.message);
      }

      // 2. Evening Notification (8:00 PM)
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Daily Sync Reminder",
            body: messages.evening,
            sound: true,
          },
          trigger: { type: 'daily', hour: 20, minute: 0 },
        });
      } catch (e) {
        console.warn('[Notifications] Failed to schedule evening:', e?.message);
      }

      await AsyncStorage.setItem('notifications_last_gen_date', todayStr);
      console.log(`[Notifications] Scheduled Morning (10 AM) and Evening (8 PM) reminders for ${user.displayName}`);
    } catch (e) {
      console.error('[Notifications] scheduleDailyReminder failed:', e?.message);
    }
  },
  
  async cancelAllReminders() {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.removeItem('notifications_last_gen_date'); // clear cache so next toggle on regenerates
    console.log('[Notifications] All reminders canceled.');
  },

  async testNotification(user) {
    const hasPermission = await this.registerForPushNotificationsAsync();
    if (!hasPermission || !user) return;

    console.log('[Notifications] Sending personalized AI notification to', user.displayName);
    const messages = await groqService.generateDailyNotifications(user.displayName);
    
    const hour = new Date().getHours();
    const isMorning = hour < 17; // Before 5 PM is morning/afternoon vibe
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: isMorning ? "BeatWrap: Morning Vibe" : "BeatWrap: Evening Vibe",
        body: isMorning ? messages.morning : messages.evening,
        sound: true,
      },
      trigger: null, // trigger immediately
    });
    console.log(`[Notifications] AI notification (${isMorning ? 'Morning' : 'Evening'}) sent.`);
  }
};

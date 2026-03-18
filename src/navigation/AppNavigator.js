import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Platform, Keyboard, Animated, PanResponder, Dimensions,
} from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../utils/constants';
import HomeScreen from '../screens/HomeScreen';
import MoodScreen from '../screens/MoodScreen';
import StatsScreen from '../screens/StatsScreen';
import FriendsScreen from '../screens/FriendsScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LoginScreen from '../screens/LoginScreen';

const Stack = createNativeStackNavigator();
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_TABS = 5;

const linking = {
  prefixes: ['beatwrap://', 'com.beatwrap.app://'],
  config: {
    screens: {
      MainTabs: {
        screens: {
          Friends: { path: 'add/:inviteUserId' },
        },
      },
      Profile: 'profile',
    },
  },
};

const TABS = [
  { name: 'Home',     icon: '🎵' },
  { name: 'Mood',     icon: '🎭' },
  { name: 'Stats',    icon: '📊' },
  { name: 'Friends',  icon: '👥' },
  { name: 'Messages', icon: '💬' },
];

const SCREENS = [HomeScreen, MoodScreen, StatsScreen, FriendsScreen, MessagesScreen];

// Minimum swipe distance to trigger a page change
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
// Minimum swipe velocity to trigger a page change
const SWIPE_VELOCITY = 0.3;

function MainTabs({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // translateX drives the whole strip of screens
  const translateX = useRef(new Animated.Value(0)).current;
  const currentIndex = useRef(0);
  const tabAnim = useRef(new Animated.Value(1)).current;

  // ── Keyboard listener ────────────────────────────────────────────
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'android' ? 'keyboardDidShow' : 'keyboardWillShow',
      () => {
        setKeyboardVisible(true);
        Animated.timing(tabAnim, { toValue: 0, duration: 100, useNativeDriver: false }).start();
      }
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'android' ? 'keyboardDidHide' : 'keyboardWillHide',
      () => {
        setKeyboardVisible(false);
        Animated.timing(tabAnim, { toValue: 1, duration: 150, useNativeDriver: false }).start();
      }
    );
    return () => { show.remove(); hide.remove(); };
  }, []);

  // ── Animate to a specific page ───────────────────────────────────
  const goToPage = useCallback((index) => {
    const clampedIndex = Math.max(0, Math.min(NUM_TABS - 1, index));
    currentIndex.current = clampedIndex;
    setActiveIndex(clampedIndex);
    Animated.spring(translateX, {
      toValue: -clampedIndex * SCREEN_WIDTH,
      useNativeDriver: true,
      tension: 68,
      friction: 12,
    }).start();
  }, [translateX]);

  // ── Pan responder for swipe gestures ────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      // Only capture horizontal swipes, and don't steal if keyboard is open
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const { dx, dy } = gestureState;
        // Must be more horizontal than vertical, and a meaningful distance
        return Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > 10;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        const { dx, dy } = gestureState;
        return Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > 15;
      },
      onPanResponderGrant: () => {
        // Stop any ongoing animation and set offset to current value
        translateX.stopAnimation((val) => {
          translateX.setOffset(val);
          translateX.setValue(0);
        });
      },
      onPanResponderMove: (_, gestureState) => {
        const { dx } = gestureState;
        const idx = currentIndex.current;
        // Resist at edges
        const atLeftEdge = idx === 0 && dx > 0;
        const atRightEdge = idx === NUM_TABS - 1 && dx < 0;
        const resistance = (atLeftEdge || atRightEdge) ? 0.2 : 1;
        translateX.setValue(dx * resistance);
      },
      onPanResponderRelease: (_, gestureState) => {
        translateX.flattenOffset();
        const { dx, vx } = gestureState;
        const idx = currentIndex.current;

        let nextIndex = idx;
        if (dx < -SWIPE_THRESHOLD || vx < -SWIPE_VELOCITY) {
          nextIndex = Math.min(idx + 1, NUM_TABS - 1);
        } else if (dx > SWIPE_THRESHOLD || vx > SWIPE_VELOCITY) {
          nextIndex = Math.max(idx - 1, 0);
        }

        goToPage(nextIndex);
      },
      onPanResponderTerminate: () => {
        translateX.flattenOffset();
        goToPage(currentIndex.current);
      },
    })
  ).current;

  const bottomPad = Math.max(insets.bottom, 8);
  const tabBarMaxHeight = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 72 + bottomPad],
  });

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* ── Swipeable screen strip ── */}
      <View style={{ flex: 1, overflow: 'hidden' }} {...panResponder.panHandlers}>
        <Animated.View
          style={{
            flexDirection: 'row',
            width: SCREEN_WIDTH * NUM_TABS,
            flex: 1,
            transform: [{ translateX }],
          }}
        >
          {SCREENS.map((ScreenComponent, i) => (
            <View key={i} style={{ width: SCREEN_WIDTH, flex: 1 }}>
              <ScreenComponent navigation={navigation} route={route} />
            </View>
          ))}
        </Animated.View>
      </View>

      {/* ── Keyboard-aware animated tab bar ── */}
      <Animated.View style={{ maxHeight: tabBarMaxHeight, overflow: 'hidden' }}>
        <View style={[styles.tabBar, { paddingBottom: bottomPad }]}>
          {TABS.map((tab, index) => {
            const isFocused = activeIndex === index;
            return (
              <TouchableOpacity
                key={tab.name}
                style={styles.tabItem}
                onPress={() => goToPage(index)}
                activeOpacity={0.7}
              >
                <View style={styles.tabIndicatorRow}>
                  {isFocused && <View style={styles.tabActiveDot} />}
                </View>
                <View style={[styles.tabIconWrap, isFocused && styles.tabIconWrapActive]}>
                  <Text style={styles.tabIcon}>{tab.icon}</Text>
                </View>
                <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
                  {tab.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

const NAV_THEME = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0A0A0F',
    card: '#0A0A0F',
    border: 'transparent',
    notification: COLORS.accent,
  },
};

export default function AppNavigator() {
  return (
    <NavigationContainer linking={linking} theme={NAV_THEME}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ animation: 'fade' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0A0A0F',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
  },
  tabIndicatorRow: {
    height: 2,
    width: '60%',
    alignItems: 'center',
    marginBottom: 4,
  },
  tabActiveDot: {
    width: '100%',
    height: 2,
    borderRadius: 1,
    backgroundColor: COLORS.accent,
  },
  tabIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  tabIconWrapActive: {
    backgroundColor: COLORS.accentSoft,
  },
  tabIcon: { fontSize: 18 },
  tabLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: COLORS.accent,
    fontWeight: '700',
  },
});
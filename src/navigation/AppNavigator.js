import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Platform, Keyboard, Animated, PanResponder, Dimensions,
} from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../utils/constants';
import HomeScreen    from '../screens/HomeScreen';
import MoodScreen    from '../screens/MoodScreen';
import StatsScreen   from '../screens/StatsScreen';
import FriendsScreen from '../screens/FriendsScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LoginScreen   from '../screens/LoginScreen';

const Stack = createNativeStackNavigator();
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_TABS = 5;

const linking = {
  prefixes: ['beatwrap://', 'com.beatwrap.app://'],
  config: {
    screens: {
      MainTabs: { screens: { Friends: { path: 'add/:inviteUserId' } } },
      Profile: 'profile',
    },
  },
};

const TABS = [
  { name: 'Home',     icon: '🎵', label: 'Home'     },
  { name: 'Mood',     icon: '🎭', label: 'Mood'     },
  { name: 'Stats',    icon: '📊', label: 'Stats'    },
  { name: 'Friends',  icon: '👥', label: 'Friends'  },
  { name: 'Messages', icon: '💬', label: 'Messages' },
];

const SCREENS = [HomeScreen, MoodScreen, StatsScreen, FriendsScreen, MessagesScreen];

const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const SWIPE_VELOCITY  = 0.3;

function MainTabs({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex]     = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const translateX   = useRef(new Animated.Value(0)).current;
  const currentIndex = useRef(0);
  const tabAnim      = useRef(new Animated.Value(1)).current;
  // Pill position for tab indicator
  const pillX = useRef(new Animated.Value(0)).current;

  const TAB_W = SCREEN_WIDTH / NUM_TABS;

  // ── Keyboard listener ────────────────────────────────────────────────────
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

  // ── Navigate to a page — SINGLE source of truth ─────────────────────────
  const goToPage = useCallback((index) => {
    const i = Math.max(0, Math.min(NUM_TABS - 1, index));
    // Update ref FIRST so pan responder always has the correct value
    currentIndex.current = i;
    setActiveIndex(i);

    Animated.parallel([
      Animated.spring(translateX, {
        toValue: -i * SCREEN_WIDTH,
        useNativeDriver: true,
        tension: 68,
        friction: 12,
      }),
      Animated.spring(pillX, {
        toValue: i * TAB_W,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
    ]).start();
  }, [translateX, pillX, TAB_W]);

  // ── Pan responder ────────────────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > Math.abs(g.dy) * 1.5 && Math.abs(g.dx) > 10,
      onMoveShouldSetPanResponderCapture: (_, g) =>
        Math.abs(g.dx) > Math.abs(g.dy) * 1.5 && Math.abs(g.dx) > 15,
      onPanResponderGrant: () => {
        translateX.stopAnimation(val => {
          translateX.setOffset(val);
          translateX.setValue(0);
        });
      },
      onPanResponderMove: (_, g) => {
        const idx = currentIndex.current;
        const atLeft  = idx === 0            && g.dx > 0;
        const atRight = idx === NUM_TABS - 1 && g.dx < 0;
        translateX.setValue(g.dx * (atLeft || atRight ? 0.2 : 1));
      },
      onPanResponderRelease: (_, g) => {
        translateX.flattenOffset();
        const idx = currentIndex.current;
        let next = idx;
        if      (g.dx < -SWIPE_THRESHOLD || g.vx < -SWIPE_VELOCITY) next = Math.min(idx + 1, NUM_TABS - 1);
        else if (g.dx >  SWIPE_THRESHOLD || g.vx >  SWIPE_VELOCITY) next = Math.max(idx - 1, 0);
        goToPage(next);
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
    outputRange: [0, 68 + bottomPad],
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
      {/* ── Swipeable screen strip ── */}
      <View style={{ flex: 1, overflow: 'hidden' }} {...panResponder.panHandlers}>
        <Animated.View style={{
          flexDirection: 'row',
          width: SCREEN_WIDTH * NUM_TABS,
          flex: 1,
          transform: [{ translateX }],
        }}>
          {SCREENS.map((ScreenComponent, i) => (
            <View key={i} style={{ width: SCREEN_WIDTH, flex: 1 }}>
              <ScreenComponent navigation={navigation} route={route} />
            </View>
          ))}
        </Animated.View>
      </View>

      {/* ── Tab bar ── */}
      <Animated.View style={{ maxHeight: tabBarMaxHeight, overflow: 'hidden' }}>
        <View style={[styles.tabBar, { paddingBottom: bottomPad }]}>
          {/* Animated pill indicator */}
          <Animated.View
            style={[
              styles.tabPill,
              { transform: [{ translateX: pillX }], width: TAB_W },
            ]}
            pointerEvents="none"
          >
            <LinearGradient
              colors={['#FF336622', '#8B5CF611']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {TABS.map((tab, index) => {
            const isFocused = activeIndex === index;
            return (
              <TouchableOpacity
                key={tab.name}
                style={styles.tabItem}
                onPress={() => goToPage(index)}
                activeOpacity={0.7}
              >
                {/* Top accent line */}
                <View style={[styles.tabTopLine, isFocused && styles.tabTopLineActive]} />
                <Text style={[styles.tabIcon, isFocused && styles.tabIconActive]}>
                  {tab.icon}
                </Text>
                <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
                  {tab.label}
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
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="Login"   component={LoginScreen}   options={{ animation: 'fade' }} />
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
    paddingTop: 4,
    position: 'relative',
  },
  // Sliding pill background (absolute, behind tabs)
  tabPill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 0,
    overflow: 'hidden',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 2,
    zIndex: 1,
  },
  tabTopLine: {
    height: 2,
    width: '50%',
    borderRadius: 1,
    backgroundColor: 'transparent',
    marginBottom: 5,
  },
  tabTopLineActive: {
    backgroundColor: COLORS.accent,
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 2,
    opacity: 0.45,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 9,
    color: '#505070',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: COLORS.accent,
    fontWeight: '700',
  },
});
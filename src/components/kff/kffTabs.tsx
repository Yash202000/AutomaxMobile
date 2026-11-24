import { Ionicons } from '@expo/vector-icons';
import {
  BottomTabBarHeightCallbackContext,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useContext, useEffect, useState } from 'react';
import {
  I18nManager,
  Keyboard,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { KFF_COLORS } from './kffTheme';

const BAR_HEIGHT = 74;
const BAR_PADDING = 7;
const SIDE_MARGIN = 16;
const INACTIVE_COLOR = '#3B4266';
const ACTIVE_GRADIENT = ['#5B83FF', '#2F5BF5'] as const;
const FADE_GRADIENT = ['rgba(244,246,252,0)', KFF_COLORS.background] as const;

// KFF Dispatcher bottom bar: a floating white rounded bar; the active tab is
// a blue pill (white icon + label) that slides between tabs. Used only when
// isKffDispatcher() is true (`tabBar` in app/(tabs)/_layout.tsx) — the other
// clients keep the default bar.
//
// - Tabs hidden with `href: null` (expo-router sets display: 'none') are skipped.
// - Floats above the device's bottom inset (Android buttons / gesture bar,
//   iOS home indicator); its full height is reported so useBottomTabBarHeight()
//   keeps screen content clear of it.
// - Hidden while the Android keyboard is open (it would ride up on it).
// - Works in RTL: the tab order and the sliding pill follow the layout.
export const KffTabBar = ({ state, descriptors, navigation, insets }: BottomTabBarProps) => {
  const onHeightChange = useContext(BottomTabBarHeightCallbackContext);
  const [barWidth, setBarWidth] = useState(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const routes = state.routes.filter((route) => {
    const itemStyle = StyleSheet.flatten(descriptors[route.key].options.tabBarItemStyle);
    return itemStyle?.display !== 'none';
  });
  const focusedKey = state.routes[state.index]?.key;
  const activeIndex = routes.findIndex((route) => route.key === focusedKey);
  const focusedOptions = descriptors[focusedKey]?.options;
  const focusedBarStyle = StyleSheet.flatten(focusedOptions?.tabBarStyle) as { display?: string } | undefined;
  const hidden = keyboardOpen || focusedBarStyle?.display === 'none';

  // Sliding active pill.
  const itemWidth = routes.length ? (barWidth - BAR_PADDING * 2) / routes.length : 0;
  const pillX = useSharedValue(0);
  const pillVisible = useSharedValue(0);
  useEffect(() => {
    if (!itemWidth) return;
    const x = (I18nManager.isRTL ? -1 : 1) * Math.max(activeIndex, 0) * itemWidth;
    // First placement jumps; later tab changes slide.
    pillX.value = pillVisible.value ? withTiming(x, { duration: 260 }) : x;
    pillVisible.value = activeIndex >= 0 ? 1 : 0;
  }, [activeIndex, itemWidth, pillX, pillVisible]);
  const pillStyle = useAnimatedStyle(() => ({
    opacity: pillVisible.value,
    transform: [{ translateX: pillX.value }],
  }));

  const bottomOffset = insets.bottom > 0 ? insets.bottom + 6 : 14;

  const onLayout = (e: LayoutChangeEvent) => onHeightChange?.(e.nativeEvent.layout.height);
  useEffect(() => {
    if (hidden) onHeightChange?.(0);
  }, [hidden, onHeightChange]);

  if (hidden) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { paddingBottom: bottomOffset }]}
      onLayout={onLayout}
    >
      {/* Fades page content out under the floating bar and the system bar. */}
      <LinearGradient
        pointerEvents="none"
        colors={FADE_GRADIENT}
        locations={[0, 0.45]}
        style={styles.fade}
      />
      <View style={styles.bar} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
        {itemWidth > 0 && (
          <Animated.View style={[styles.pill, { width: itemWidth }, pillStyle]}>
            <LinearGradient
              colors={ACTIVE_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        )}

        {routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = index === activeIndex;
          const color = focused ? KFF_COLORS.white : INACTIVE_COLOR;
          const label = typeof options.title === 'string' ? options.title : route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              style={styles.item}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              onPressIn={() => {
                if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            >
              {options.tabBarIcon?.({ focused, color, size: 26 })}
              <Text
                style={[styles.label, { color }, focused && styles.labelActive]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

export const renderKffTabBar = (props: BottomTabBarProps) => <KffTabBar {...props} />;

type TabIconProps = { color: string; focused: boolean };

export const KffProfileTabIcon = ({ color, focused }: TabIconProps) => (
  <Ionicons name={focused ? 'person' : 'person-outline'} size={25} color={color} />
);

// White (active) / navy (inactive) artwork.
export const KffIncidentsTabIcon = ({ focused }: TabIconProps) => (
  <Image
    source={
      focused
        ? require('@/assets/images/kff/my-incidents-active.svg')
        : require('@/assets/images/kff/my-incidents-inactive.svg')
    }
    style={styles.incidentsIcon}
    contentFit="contain"
  />
);

export const KffSettingsTabIcon = ({ color, focused }: TabIconProps) => (
  <Ionicons name={focused ? 'settings' : 'settings-outline'} size={25} color={color} />
);

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: SIDE_MARGIN,
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -16,
    bottom: 0,
  },
  bar: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
    padding: BAR_PADDING,
    borderRadius: BAR_HEIGHT / 2,
    backgroundColor: KFF_COLORS.white,
    borderWidth: 1,
    borderColor: '#EEF1F8',
    ...Platform.select({
      ios: {
        shadowColor: KFF_COLORS.navy,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.14,
        shadowRadius: 18,
      },
      android: { elevation: 14 },
    }),
  },
  pill: {
    position: 'absolute',
    top: BAR_PADDING,
    bottom: BAR_PADDING,
    start: BAR_PADDING,
    borderRadius: (BAR_HEIGHT - BAR_PADDING * 2) / 2,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: KFF_COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    maxWidth: '100%',
  },
  labelActive: {
    fontWeight: '700',
  },
  incidentsIcon: {
    width: 34,
    height: 28,
  },
});

import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { Image } from 'expo-image';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';

import { KFF_COLORS } from './kffTheme';

// Bottom tab bar look for the KFF Dispatcher client (blue bar, white active
// items, navy inactive items). Spread over the default screenOptions in
// app/(tabs)/_layout.tsx only when isKffDispatcher() is true.
export const getKffTabScreenOptions = (
  tabBarHeight: number,
): BottomTabNavigationOptions => ({
  tabBarActiveTintColor: KFF_COLORS.white,
  tabBarInactiveTintColor: KFF_COLORS.navy,
  tabBarStyle: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: tabBarHeight + 6,
    backgroundColor: KFF_COLORS.primary,
    paddingBottom: 8,
    paddingTop: 8,
    paddingHorizontal: 8,
    borderWidth: 0,
    borderTopWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: KFF_COLORS.primary,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
      android: { elevation: 12 },
    }),
  },
  tabBarLabelStyle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
});

type TabIconProps = { color: string; focused: boolean };

export const KffProfileTabIcon = ({ color, focused }: TabIconProps) => (
  <Ionicons
    name={focused ? 'person-circle' : 'person-circle-outline'}
    size={32}
    color={color}
  />
);

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

// Same settings glyph as the default tab bar, tinted for the KFF blue bar.
export const KffSettingsTabIcon = ({ color, focused }: TabIconProps) => (
  <Ionicons name={focused ? 'settings' : 'settings-outline'} size={28} color={color} />
);

const styles = StyleSheet.create({
  incidentsIcon: {
    width: 40,
    height: 34,
  },
});

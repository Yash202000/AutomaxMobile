import { Tabs } from 'expo-router';
import React from 'react';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePermissions } from '@/src/hooks/usePermissions';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { canViewAllIncidents, canViewAllRequests, canViewAllComplaints, canViewAllQueries } = usePermissions();

  // Calculate tab bar height with safe area
  const tabBarHeight = 60 + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingBottom: insets.bottom > 0 ? insets.bottom : 5,
          height: tabBarHeight,
        },
        tabBarLabelStyle: {
          fontSize: 10,
        },
      }}>
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <FontAwesome size={22} name="th-large" color={color} />,
        }}
      />
      <Tabs.Screen
        name="incident"
        options={{
          title: 'Incident',
          tabBarIcon: ({ color }) => <Ionicons size={22} name="alert-circle" color={color} />,
          href: canViewAllIncidents() ? '/(tabs)/incident' : null,
        }}
      />
      <Tabs.Screen
        name="request"
        options={{
          title: 'Request',
          tabBarIcon: ({ color }) => <Ionicons size={22} name="document-text" color={color} />,
          href: canViewAllRequests() ? '/(tabs)/request' : null,
        }}
      />
      <Tabs.Screen
        name="complaint"
        options={{
          title: 'Complaint',
          tabBarIcon: ({ color }) => <Ionicons size={22} name="chatbubble-ellipses" color={color} />,
          href: canViewAllComplaints() ? '/(tabs)/complaint' : null,
        }}
      />
      <Tabs.Screen
        name="query"
        options={{
          title: 'Query',
          tabBarIcon: ({ color }) => <Ionicons size={22} name="help-circle" color={color} />,
          href: canViewAllQueries() ? '/(tabs)/query' : null,
        }}
      />
      <Tabs.Screen
        name="setting"
        options={{
          title: 'Setting',
          tabBarIcon: ({ color }) => <FontAwesome size={22} name="gear" color={color} />,
        }}
      />
    </Tabs>
  );
}

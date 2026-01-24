import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { HapticTab } from "@/components/haptic-tab";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { usePermissions } from "@/src/hooks/usePermissions";

const TAB_BAR_HEIGHT = 60;
const ICON_SIZE = 22;

export default function TabLayout() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const {
    canViewAllIncidents,
    canViewAllRequests,
    canViewAllComplaints,
    canViewAllQueries,
  } = usePermissions();

  const tabBarHeight = TAB_BAR_HEIGHT + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        tabBarInactiveTintColor: "#9E9E9E",
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 8,
          height: tabBarHeight,
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: "#E0E0E0",
          ...Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.08,
              shadowRadius: 8,
            },
            android: {
              elevation: 8,
            },
          }),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="explore"
        options={{
          title: t("tabs.dashboard"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              size={ICON_SIZE}
              name={focused ? "grid" : "grid-outline"}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="incident"
        options={{
          title: t("tabs.incident"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              size={ICON_SIZE}
              name={focused ? "alert-circle" : "alert-circle-outline"}
              color={color}
            />
          ),
          href: canViewAllIncidents() ? "/(tabs)/incident" : null,
        }}
      />
      <Tabs.Screen
        name="request"
        options={{
          title: t("tabs.request"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              size={ICON_SIZE}
              name={focused ? "document-text" : "document-text-outline"}
              color={color}
            />
          ),
          href: canViewAllRequests() ? "/(tabs)/request" : null,
        }}
      />
      <Tabs.Screen
        name="complaint"
        options={{
          title: t("tabs.complaint"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              size={ICON_SIZE}
              name={focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"}
              color={color}
            />
          ),
          href: canViewAllComplaints() ? "/(tabs)/complaint" : null,
        }}
      />
      <Tabs.Screen
        name="query"
        options={{
          title: t("tabs.query"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              size={ICON_SIZE}
              name={focused ? "help-circle" : "help-circle-outline"}
              color={color}
            />
          ),
          href: canViewAllQueries() ? "/(tabs)/query" : null,
        }}
      />
      <Tabs.Screen
        name="setting"
        options={{
          title: t("tabs.settings"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              size={ICON_SIZE}
              name={focused ? "settings" : "settings-outline"}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

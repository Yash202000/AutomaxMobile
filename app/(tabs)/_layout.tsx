import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  getKffTabScreenOptions,
  KffIncidentsTabIcon,
  KffProfileTabIcon,
  KffSettingsTabIcon,
} from "@/src/components/kff/kffTabs";
import { useAuth } from "@/src/context/AuthContext";
import { usePermissions } from "@/src/hooks/usePermissions";
import { isKffDispatcher } from "@/src/utils/kff";

const TAB_BAR_HEIGHT = 70;
const ICON_SIZE = 26;

export default function TabLayout() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const {
    canViewIncidents,
    canViewAllIncidents,
    canCreateIncidents,
    canViewRequests,
    canViewAllRequests,
    canCreateRequests,
    canViewComplaints,
    canViewAllComplaints,
    canCreateComplaints,
    canViewQueries,
    canViewAllQueries,
    canCreateQueries,
  } = usePermissions();

  const { user } = useAuth();

  const isViewerApp = process.env.EXPO_PUBLIC_VIEWER_APP === 'true';
  const viewerRoles = (process.env.EXPO_PUBLIC_VIEWER_APP_ROLES || '').split(',');
  const isViewerRole = user?.roles?.some(role => viewerRoles.includes(role.code)) ?? false;
  const isViewerMode = isViewerApp && isViewerRole;

  // KFF Dispatcher client: only Profile / My Incidents / Settings are shown.
  const isKff = isKffDispatcher();

  const tabBarHeight =
    TAB_BAR_HEIGHT + (insets.bottom > 0 ? insets.bottom - 10 : 0);

  return (
    <Tabs
      backBehavior={isViewerMode ? 'none' : isKff ? 'history' : 'firstRoute'}
      screenOptions={{
        tabBarActiveTintColor: "#2EC4B6",
        tabBarInactiveTintColor: "#94A3B8",
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: tabBarHeight,
          backgroundColor: "#FFFFFF",
          paddingBottom: 8,
          paddingTop: 8,
          paddingHorizontal: 8,
          borderWidth: 0,
          borderTopWidth: 0,
          ...Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.15,
              shadowRadius: 20,
            },
            android: {
              elevation: 12,
            },
          }),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          marginTop: 4,
          letterSpacing: 0.2,
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
        ...(isKff ? getKffTabScreenOptions(tabBarHeight) : {}),
      }}
    >
      <Tabs.Screen
        name="explore"
        options={{
          title: t("tabs.dashboard"),
          tabBarIcon: ({ color, focused }) => (
            <View
              style={[
                styles.iconContainer,
                focused && styles.activeIconContainer,
              ]}
            >
              <Ionicons
                size={focused ? 28 : 24}
                name={focused ? "grid" : "grid-outline"}
                color={focused ? "#FFFFFF" : color}
              />
            </View>
          ),
          href: isViewerMode || isKff ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="incident"
        options={{
          title: t("tabs.incident"),
          tabBarIcon: ({ color, focused }) => (
            <View
              style={[
                styles.iconContainer,
                focused && styles.activeIconContainer,
              ]}
            >
              <Ionicons
                size={focused ? 28 : 24}
                name={focused ? "alert-circle" : "alert-circle-outline"}
                color={focused ? "#FFFFFF" : color}
              />
            </View>
          ),
          href:
            !isKff && (isViewerMode || canViewIncidents() || canViewAllIncidents() || canCreateIncidents())
              ? "/(tabs)/incident"
              : null,
        }}
      />
      <Tabs.Screen
        name="request"
        options={{
          title: t("tabs.request"),
          tabBarIcon: ({ color, focused }) => (
            <View
              style={[
                styles.iconContainer,
                focused && styles.activeIconContainer,
              ]}
            >
              <Ionicons
                size={focused ? 28 : 24}
                name={focused ? "document-text" : "document-text-outline"}
                color={focused ? "#FFFFFF" : color}
              />
            </View>
          ),
          href:
            !isKff && !isViewerMode && (canViewRequests() || canViewAllRequests() || canCreateRequests())
              ? "/(tabs)/request"
              : null,
        }}
      />
      <Tabs.Screen
        name="complaint"
        options={{
          title: t("tabs.complaint"),
          tabBarIcon: ({ color, focused }) => (
            <View
              style={[
                styles.iconContainer,
                focused && styles.activeIconContainer,
              ]}
            >
              <Ionicons
                size={focused ? 28 : 24}
                name={
                  focused
                    ? "chatbubble-ellipses"
                    : "chatbubble-ellipses-outline"
                }
                color={focused ? "#FFFFFF" : color}
              />
            </View>
          ),
          href:
            !isKff && !isViewerMode && (canViewComplaints() || canViewAllComplaints() || canCreateComplaints())
              ? "/(tabs)/complaint"
              : null,
        }}
      />
      <Tabs.Screen
        name="query"
        options={{
          title: t("tabs.query"),
          tabBarIcon: ({ color, focused }) => (
            <View
              style={[
                styles.iconContainer,
                focused && styles.activeIconContainer,
              ]}
            >
              <Ionicons
                size={focused ? 28 : 24}
                name={focused ? "help-circle" : "help-circle-outline"}
                color={focused ? "#FFFFFF" : color}
              />
            </View>
          ),
          href:
            !isKff && !isViewerMode && (canViewQueries() || canViewAllQueries() || canCreateQueries())
              ? "/(tabs)/query"
              : null,
        }}
      />
      {/* KFF Dispatcher tabs — hidden (href: null) for every other client */}
      <Tabs.Screen
        name="kff-profile"
        options={{
          title: t("kff.tabs.profile"),
          tabBarIcon: KffProfileTabIcon,
          href: isKff ? "/(tabs)/kff-profile" : null,
        }}
      />
      <Tabs.Screen
        name="kff-incidents"
        options={{
          title: t("kff.tabs.myIncidents"),
          tabBarIcon: KffIncidentsTabIcon,
          href: isKff ? "/(tabs)/kff-incidents" : null,
        }}
      />
      <Tabs.Screen
        name="kff-incident-alerts"
        options={{
          title: t("kff.alerts.title"),
          href: null,
        }}
      />
      <Tabs.Screen
        name="kff-incident-detail"
        options={{
          title: t("kff.detail.title"),
          href: null,
        }}
      />
      <Tabs.Screen
        name="setting"
        options={{
          title: t("tabs.settings"),
          tabBarIcon: isKff ? KffSettingsTabIcon : ({ color, focused }) => (
            <View
              style={[
                styles.iconContainer,
                focused && styles.activeIconContainer,
              ]}
            >
              <Ionicons
                size={focused ? 28 : 24}
                name={focused ? "settings" : "settings-outline"}
                color={focused ? "#FFFFFF" : color}
              />
            </View>
          ),
          href: "/(tabs)/setting",
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 40,
    height: 38,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 0,
    marginBottom: 2,
  },
  activeIconContainer: {
    backgroundColor: "#2EC4B6",
    shadowColor: "#2EC4B6",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
});

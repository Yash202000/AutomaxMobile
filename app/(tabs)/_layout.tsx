import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { usePermissions } from "@/src/hooks/usePermissions";

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

  const tabBarHeight =
    TAB_BAR_HEIGHT + (insets.bottom > 0 ? insets.bottom - 10 : 0);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#2EC4B6",
        tabBarInactiveTintColor: "#94A3B8",
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          position: "absolute",
          bottom: insets.bottom > 0 ? insets.bottom - 10 : 16,
          left: 16,
          right: 16,
          height: 70,
          backgroundColor: "#FFFFFF",
          borderRadius: 24,
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
            canViewIncidents() || canViewAllIncidents() || canCreateIncidents()
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
            canViewRequests() || canViewAllRequests() || canCreateRequests()
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
            canViewComplaints() ||
            canViewAllComplaints() ||
            canCreateComplaints()
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
            canViewQueries() || canViewAllQueries() || canCreateQueries()
              ? "/(tabs)/query"
              : null,
        }}
      />
      <Tabs.Screen
        name="setting"
        options={{
          title: t("tabs.settings"),
          tabBarIcon: ({ color, focused }) => (
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

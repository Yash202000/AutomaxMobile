import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

/**
 * Shown when a ticket can no longer be viewed (403/404), e.g. after a status
 * update moved it out of the current user's scope. Always offers a way out.
 */
export const AccessDeniedState = () => {
  const { t } = useTranslation();
  const router = useRouter();

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)" as any);
    }
  };

  return (
    <View style={styles.container}>
      <Ionicons name="lock-closed-outline" size={64} color="#9CA3AF" />
      <Text style={styles.title}>
        {t("details.noAccessTitle", "No longer available")}
      </Text>
      <Text style={styles.message}>
        {t(
          "details.noAccessMessage",
          "This item is no longer accessible to you. It may have been reassigned or moved after the last update. Your changes were saved successfully.",
        )}
      </Text>
      <TouchableOpacity style={styles.button} onPress={goBack}>
        <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        <Text style={styles.buttonText}>
          {t("details.backToList", "Back to list")}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: "#F9FAFB",
  },
  title: { fontSize: 20, fontWeight: "700", color: "#111827", marginTop: 16 },
  message: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2EC4B6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
});

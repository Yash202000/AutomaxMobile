import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import usePermissions from "@/src/hooks/usePermissions";

// Shown over an OSM map when Google Maps was configured but could not be used.
// Only super admins see it; other users just get the OSM map.
export function MapFallbackNotice({ reason }: { reason: string | null }) {
  const { t } = useTranslation();
  const { isSuperAdmin } = usePermissions();
  if (!isSuperAdmin || !reason) return null;
  return (
    <View style={styles.container} pointerEvents="none">
      <Text style={styles.title}>
        {t("map.googleUnavailable", "Google Maps unavailable — showing OpenStreetMap")}
      </Text>
      <Text style={styles.reason} numberOfLines={2}>
        {reason}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 8,
    left: 8,
    maxWidth: "70%",
    backgroundColor: "rgba(255, 247, 237, 0.95)",
    borderColor: "#FDBA74",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  title: { fontSize: 11, fontWeight: "600", color: "#9A3412", textAlign: "left" },
  reason: { fontSize: 10, color: "#C2410C", textAlign: "left" },
});

import React from "react";
import { StyleSheet, View } from "react-native";
import { Skeleton } from "./Skeleton";

/** Skeleton shaped like the ticket list cards shared by the incident/request/complaint/query screens. */
export const TicketCardSkeleton: React.FC = () => (
  <View style={styles.card}>
    <View style={styles.bar} />
    <View style={styles.content}>
      <View style={styles.header}>
        <Skeleton width={90} height={16} />
        <Skeleton width={60} height={20} borderRadius={6} />
      </View>
      <Skeleton width={110} height={12} style={{ marginTop: 8 }} />
      <Skeleton width="70%" height={14} style={{ marginTop: 10 }} />
      <Skeleton width="90%" height={14} style={{ marginTop: 10 }} />
      <Skeleton width="60%" height={14} style={{ marginTop: 8 }} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    marginBottom: 12,
    flexDirection: "row",
    overflow: "hidden",
  },
  bar: {
    width: 4,
    backgroundColor: "#E2E8F0",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});

import KffAppBar from "@/src/components/kff/KffAppBar";
import { KffTicketIcon } from "@/src/components/kff/KffBadges";
import KffBackground from "@/src/components/kff/KffBackground";
import { formatKffDateTime, formatKffRelativeTime } from "@/src/components/kff/kffDateUtils";
import { useKffIncidents } from "@/src/components/kff/kffIncidentStore";
import type { KffIncident } from "@/src/components/kff/kffTypes";
import { KFF_COLORS } from "@/src/components/kff/kffTheme";
import { KFF_HOME_ROUTE } from "@/src/utils/kff";
import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useRouter } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";

// KFF Dispatcher — incoming incident notifications (opened from the bell).
// Reads kffIncidentStore: the list and the bell badge share the same store, so
// accepting / rejecting (or a new notification via addKffIncomingIncident)
// updates both live. Empty until a real notification feed is wired in.

const AlertCard = ({ incident }: { incident: KffIncident }) => {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() =>
        router.navigate({ pathname: "/(tabs)/kff-incident-detail", params: { id: incident.id } })
      }
    >
      <View style={styles.cardHeader}>
        <KffTicketIcon />
        <View style={styles.cardHeaderText}>
          <View style={styles.ticketRow}>
            <Text style={styles.ticketNumber}>{incident.ticketNumber}</Text>
            <View style={styles.newDot} />
            <Text style={styles.timeAgo}>{formatKffRelativeTime(incident.createdAt, t)}</Text>
          </View>
          <View style={styles.datePill}>
            <Text style={styles.datePillText}>
              {formatKffDateTime(incident.createdAt, i18n.language)}
            </Text>
          </View>
        </View>
        <Ionicons
          name={t("common.icons.chevronForward") as any}
          size={20}
          color={KFF_COLORS.textMuted}
        />
      </View>

      <View style={styles.separator} />

      <View style={styles.inlineRow}>
        <Text style={styles.label}>{t("kff.detail.classification")}</Text>
        <Text style={[styles.value, styles.inlineValue]} numberOfLines={2}>
          {incident.title}
        </Text>
      </View>
      <Text style={[styles.label, styles.destinationLabel]}>{t("kff.detail.destination")}</Text>
      <Text style={styles.value}>{incident.to}</Text>
    </TouchableOpacity>
  );
};

const KffIncidentAlertsScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const { incoming } = useKffIncidents();

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.navigate(KFF_HOME_ROUTE);
  };

  return (
    <KffBackground>
      <KffAppBar title={t("kff.alerts.title")} onBack={handleBack} />

      <View style={[styles.panel, { marginBottom: tabBarHeight + 12 }]}>
        <FlatList
          data={incoming}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <AlertCard incident={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            incoming.length > 0 ? (
              <Text style={styles.listHeader}>
                {t("kff.alerts.count", { count: incoming.length })}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons name="notifications-off-outline" size={36} color={KFF_COLORS.primary} />
              </View>
              <Text style={styles.emptyTitle}>{t("kff.alerts.empty")}</Text>
              <Text style={styles.emptySubtitle}>{t("kff.alerts.emptyDesc")}</Text>
            </View>
          }
        />
      </View>
    </KffBackground>
  );
};

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    marginHorizontal: 12,
    marginTop: 14,
    backgroundColor: KFF_COLORS.white,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: KFF_COLORS.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  listContent: {
    padding: 14,
    flexGrow: 1,
  },
  listHeader: {
    fontSize: 13,
    fontWeight: "600",
    color: KFF_COLORS.textSecondary,
    marginBottom: 10,
    marginLeft: 4,
    textAlign: "left",
  },
  card: {
    backgroundColor: KFF_COLORS.white,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#EEF0F6",
    shadowColor: KFF_COLORS.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  cardHeaderText: {
    flex: 1,
    alignItems: "flex-start",
    gap: 6,
  },
  ticketRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ticketNumber: {
    fontSize: 17,
    fontWeight: "700",
    color: KFF_COLORS.primary,
    textDecorationLine: "underline",
  },
  newDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: KFF_COLORS.accepted,
  },
  timeAgo: {
    fontSize: 12,
    color: KFF_COLORS.textMuted,
  },
  datePill: {
    borderWidth: 1.5,
    borderColor: KFF_COLORS.primary,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  datePillText: {
    fontSize: 12,
    fontWeight: "500",
    color: KFF_COLORS.primary,
  },
  separator: {
    height: 1,
    backgroundColor: "#E3E5EC",
    marginVertical: 14,
  },
  inlineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: KFF_COLORS.primary,
    textAlign: "left",
  },
  destinationLabel: {
    marginTop: 10,
    marginBottom: 3,
  },
  value: {
    fontSize: 14,
    lineHeight: 20,
    color: KFF_COLORS.textSecondary,
    textAlign: "left",
  },
  inlineValue: {
    flex: 1,
    fontWeight: "600",
    color: KFF_COLORS.text,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: KFF_COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: KFF_COLORS.navy,
    textAlign: "center",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: KFF_COLORS.textSecondary,
    textAlign: "center",
  },
});

export default KffIncidentAlertsScreen;

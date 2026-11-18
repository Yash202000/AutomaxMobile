import KffAppBar from "@/src/components/kff/KffAppBar";
import { KffCriticalityPill, KffStateBadge, KffTicketIcon } from "@/src/components/kff/KffBadges";
import KffBackground from "@/src/components/kff/KffBackground";
import KffCalendarStrip from "@/src/components/kff/KffCalendarStrip";
import { formatKffDateTime, formatKffRelativeTime, startOfDay } from "@/src/components/kff/kffDateUtils";
import KffRouteTimeline from "@/src/components/kff/KffRouteTimeline";
import { KFF_COLORS } from "@/src/components/kff/kffTheme";
import { KFF_STATUSES, KffIncident, KffListStatus } from "@/src/components/kff/kffTypes";
import { useKffMyIncidents } from "@/src/components/kff/useKffMyIncidents";
import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// KFF Dispatcher — My Incidents tab.
// Incidents assigned to the logged-in user on the selected day, from the
// Automax incidents API (see src/components/kff/kffIncidentApi.ts).

const KffIncidentCard = ({ incident }: { incident: KffIncident }) => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [callerExpanded, setCallerExpanded] = useState(false);

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() =>
        router.navigate({ pathname: "/(tabs)/kff-incident-detail", params: { id: incident.id } })
      }
    >
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <KffTicketIcon size={44} />
          <View style={styles.cardHeaderText}>
            <Text style={styles.ticketNumber}>{incident.ticketNumber}</Text>
            <Text style={styles.cardDate}>
              {formatKffDateTime(incident.createdAt, i18n.language)}
            </Text>
          </View>
          <KffStateBadge state={incident.state} />
        </View>

        <Text style={styles.cardTitle}>{incident.title}</Text>
        <View style={styles.metaRow}>
          <KffCriticalityPill level={incident.criticality} />
          <View style={styles.timeAgo}>
            <Ionicons name="time-outline" size={14} color={KFF_COLORS.textMuted} />
            <Text style={styles.timeAgoText}>
              {formatKffRelativeTime(incident.handledAt ?? incident.createdAt, t)}
            </Text>
          </View>
        </View>

        <View style={styles.separator} />

        <KffRouteTimeline destination={incident.to} currentLocation={incident.from} compact />

        {!!incident.description && (
          <>
            <Text style={styles.sectionLabel}>{t("kff.description")}</Text>
            <Text style={styles.descriptionText}>{incident.description}</Text>
          </>
        )}
      </View>

      <TouchableOpacity
        style={styles.callerBar}
        activeOpacity={0.8}
        onPress={() => setCallerExpanded((v) => !v)}
      >
        <View style={styles.callerHeader}>
          <Ionicons name="call-outline" size={16} color={KFF_COLORS.primary} />
          <Text style={styles.callerTitle}>{t("kff.callerDetails")}</Text>
          <Ionicons
            name={callerExpanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={KFF_COLORS.navy}
          />
        </View>
        {callerExpanded && (
          <View style={styles.callerContent}>
            <Text style={styles.callerText}>{incident.caller.name || t("common.na")}</Text>
            {!!incident.caller.phone && (
              <Text style={styles.callerText}>{"‎" + incident.caller.phone}</Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const parseStatus = (value?: string): KffListStatus | undefined =>
  KFF_STATUSES.includes(value as KffListStatus) ? (value as KffListStatus) : undefined;

const KffIncidentsScreen = () => {
  const { t } = useTranslation();
  const tabBarHeight = useBottomTabBarHeight();
  const params = useLocalSearchParams<{ status?: string; date?: string; ts?: string }>();

  const [activeStatus, setActiveStatus] = useState<KffListStatus>(
    parseStatus(params.status) ?? "accepted",
  );
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));

  // Profile cards / Accept navigate here with ?status=&date=&ts= — tab screens
  // stay mounted, so sync on every navigation (ts changes each time).
  useEffect(() => {
    const status = parseStatus(params.status);
    if (status) setActiveStatus(status);
    if (params.date) {
      const d = new Date(params.date);
      if (!isNaN(d.getTime())) setSelectedDate(startOfDay(d));
    }
  }, [params.status, params.date, params.ts]);

  const {
    incidents: dayIncidents,
    counts,
    loading,
    refreshing,
    error,
    refresh,
  } = useKffMyIncidents();
  const incidents = useMemo(
    () => dayIncidents.filter((i) => i.status === activeStatus),
    [dayIncidents, activeStatus],
  );

  return (
    <KffBackground>
      <KffAppBar title={t("kff.tabs.myIncidents")} />

      <FlatList
        data={incidents}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <KffIncidentCard incident={item} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: tabBarHeight + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={KFF_COLORS.primary}
            colors={[KFF_COLORS.primary]}
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <View style={styles.segmentBar}>
              {KFF_STATUSES.map((status) => {
                const active = status === activeStatus;
                return (
                  <TouchableOpacity
                    key={status}
                    style={[styles.segment, active && styles.segmentActive]}
                    activeOpacity={0.8}
                    onPress={() => setActiveStatus(status)}
                  >
                    <Text
                      style={[styles.segmentText, active && styles.segmentTextActive]}
                      numberOfLines={1}
                    >
                      {t(`kff.status.${status}`)}
                    </Text>
                    <View style={[styles.segmentCount, active && styles.segmentCountActive]}>
                      <Text
                        style={[styles.segmentCountText, active && styles.segmentCountTextActive]}
                      >
                        {counts[status]}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <KffCalendarStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color={KFF_COLORS.primary} />
            </View>
          ) : error ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons name="cloud-offline-outline" size={36} color={KFF_COLORS.primary} />
              </View>
              <Text style={styles.emptyTitle}>{t("kff.loadFailed")}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={refresh} activeOpacity={0.85}>
                <Text style={styles.retryText}>{t("common.retry")}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons name="file-tray-outline" size={36} color={KFF_COLORS.primary} />
              </View>
              <Text style={styles.emptyTitle}>
                {t("kff.noIncidents", { status: t(`kff.status.${activeStatus}`) })}
              </Text>
              <Text style={styles.emptySubtitle}>{t("kff.noIncidentsDesc")}</Text>
            </View>
          )
        }
      />
    </KffBackground>
  );
};

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    flexGrow: 1,
  },
  listHeader: {
    gap: 14,
    marginBottom: 16,
  },
  segmentBar: {
    flexDirection: "row",
    backgroundColor: KFF_COLORS.primary,
    borderRadius: 20,
    padding: 6,
    gap: 6,
    shadowColor: KFF_COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 15,
  },
  segmentActive: {
    backgroundColor: KFF_COLORS.white,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.75)",
  },
  segmentTextActive: {
    color: KFF_COLORS.primary,
  },
  segmentCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  segmentCountActive: {
    backgroundColor: KFF_COLORS.primarySoft,
  },
  segmentCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: KFF_COLORS.white,
  },
  segmentCountTextActive: {
    color: KFF_COLORS.primary,
  },
  card: {
    backgroundColor: KFF_COLORS.card,
    borderRadius: 22,
    marginBottom: 14,
    overflow: "hidden",
    shadowColor: KFF_COLORS.navy,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardBody: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardHeaderText: {
    flex: 1,
  },
  ticketNumber: {
    fontSize: 17,
    fontWeight: "700",
    color: KFF_COLORS.text,
    textAlign: "left",
  },
  cardDate: {
    fontSize: 12,
    color: KFF_COLORS.textMuted,
    marginTop: 2,
    textAlign: "left",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: KFF_COLORS.navy,
    marginTop: 14,
    textAlign: "left",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  timeAgo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeAgoText: {
    fontSize: 12,
    color: KFF_COLORS.textMuted,
  },
  separator: {
    height: 1,
    backgroundColor: "#EEF0F6",
    marginVertical: 14,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: KFF_COLORS.primary,
    textAlign: "left",
    marginTop: 14,
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
    color: KFF_COLORS.text,
    textAlign: "left",
  },
  callerBar: {
    backgroundColor: KFF_COLORS.primarySoft,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  callerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  callerTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: KFF_COLORS.navy,
    textAlign: "left",
  },
  callerContent: {
    marginTop: 8,
    paddingLeft: 24,
    gap: 4,
  },
  callerText: {
    fontSize: 14,
    color: KFF_COLORS.text,
    textAlign: "left",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
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
  retryButton: {
    marginTop: 8,
    backgroundColor: KFF_COLORS.primary,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 28,
  },
  retryText: {
    color: KFF_COLORS.white,
    fontSize: 14,
    fontWeight: "700",
  },
});

export default KffIncidentsScreen;

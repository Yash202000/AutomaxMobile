import KffAppBar from "@/src/components/kff/KffAppBar";
import { KffTicketIcon } from "@/src/components/kff/KffBadges";
import KffBackground from "@/src/components/kff/KffBackground";
import { formatKffDateTime, formatKffRelativeTime } from "@/src/components/kff/kffDateUtils";
import {
  isUnreadKffNotification,
  loadKffNotifications,
  markKffNotificationAsRead,
  useKffNotifications,
} from "@/src/components/kff/kffNotificationStore";
import { KFF_COLORS } from "@/src/components/kff/kffTheme";
import { useKffOpenableIncidents } from "@/src/components/kff/useKffOpenableIncidents";
import { KFF_HOME_ROUTE } from "@/src/utils/kff";
import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback } from "react";
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

// KFF Dispatcher — notification inbox of the unit (opened from the bell):
// GET /notifications with received_by = unit id. Unread ones carry a small dot
// (top corner). A card opens the incident it refers to (meta.id) and marks the
// notification read — while that incident still waits for Accept / Reject.
// Once it has moved on (Dispatched or later) the card is greyed out and can't
// be tapped, read or not (see useKffOpenableIncidents). Waiting incidents show
// their current state (e.g. "Waiting for dispatch") as a tag.

const NotificationCard = ({
  item,
  canOpen,
  waitingState,
}: {
  item: any;
  canOpen: boolean;
  waitingState?: any;
}) => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const unread = isUnreadKffNotification(item);
  const incidentId = item?.meta?.id;
  const greyed = !!incidentId && !canOpen;
  const isAr = i18n.language === "ar";
  const subject = (isAr && item.subject_ar) || item.subject;
  const body = (isAr && item.body_ar) || item.body;
  const waitingLabel = waitingState
    ? (isAr && waitingState.name_ar) || waitingState.name || t("kff.alerts.awaitingResponse")
    : "";

  const handlePress = () => {
    markKffNotificationAsRead(item.id);
    if (incidentId) {
      router.navigate({ pathname: "/(tabs)/kff-incident-detail", params: { id: String(incidentId) } });
    }
  };

  return (
    <TouchableOpacity
      style={[styles.card, greyed && styles.cardGreyed]}
      activeOpacity={0.85}
      onPress={handlePress}
      disabled={!incidentId || greyed}
    >
      {unread && <View style={styles.unreadDot} />}
      <View style={styles.cardHeader}>
        <KffTicketIcon />
        <View style={styles.cardHeaderText}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, greyed && styles.textGreyed]} numberOfLines={2}>
              {subject || t("kff.alerts.newIncident")}
            </Text>
          </View>
          <Text style={styles.timeAgo}>{formatKffRelativeTime(item.created_at, t)}</Text>
          {!!waitingLabel && !greyed && (
            <View style={styles.stateTag}>
              <Ionicons name="hourglass-outline" size={12} color={KFF_COLORS.assigned} />
              <Text style={styles.stateTagText} numberOfLines={1}>
                {waitingLabel}
              </Text>
            </View>
          )}
          <View style={[styles.datePill, greyed && styles.datePillGreyed]}>
            <Text style={[styles.datePillText, greyed && styles.textGreyed]}>{formatKffDateTime(item.created_at, i18n.language)}</Text>
          </View>
        </View>
        {!!incidentId && !greyed && (
          <Ionicons
            name={t("common.icons.chevronForward") as any}
            size={20}
            color={KFF_COLORS.textMuted}
          />
        )}
      </View>

      {!!body && (
        <>
          <View style={styles.separator} />
          <Text style={[styles.body, greyed && styles.textGreyed]} numberOfLines={4}>
            {body}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const KffIncidentAlertsScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const { items, loaded, loading, refreshing, error, page, totalPages } = useKffNotifications();
  const unreadCount = items.filter(isUnreadKffNotification).length;
  const { canOpen, waitingState, recheck } = useKffOpenableIncidents(
    items.map((item: any) => String(item?.meta?.id ?? "")),
  );

  const reload = useCallback(() => {
    recheck();
    loadKffNotifications("refresh");
  }, [recheck]);

  // Fresh inbox (and incident states) every time the screen is opened.
  useFocusEffect(reload);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.navigate(KFF_HOME_ROUTE);
  };

  const showSpinner = !loaded && loading;

  return (
    <KffBackground>
      <KffAppBar title={t("kff.alerts.title")} onBack={handleBack} />

      <View style={[styles.panel, { marginBottom: tabBarHeight + 12 }]}>
        {showSpinner ? (
          <ActivityIndicator style={styles.loader} size="large" color={KFF_COLORS.primary} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <NotificationCard
                item={item}
                canOpen={canOpen(item?.meta?.id)}
                waitingState={waitingState(item?.meta?.id)}
              />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={reload}
                colors={[KFF_COLORS.primary]}
                tintColor={KFF_COLORS.primary}
              />
            }
            onEndReached={() => loadKffNotifications("more")}
            onEndReachedThreshold={0.4}
            ListHeaderComponent={
              unreadCount > 0 ? (
                <Text style={styles.listHeader}>{t("kff.alerts.count", { count: unreadCount })}</Text>
              ) : null
            }
            ListFooterComponent={
              loading && page < totalPages && items.length > 0 ? (
                <ActivityIndicator style={styles.footerLoader} color={KFF_COLORS.primary} />
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIcon}>
                  <Ionicons
                    name={error ? "cloud-offline-outline" : "notifications-off-outline"}
                    size={36}
                    color={KFF_COLORS.primary}
                  />
                </View>
                <Text style={styles.emptyTitle}>
                  {error ? t("kff.alerts.loadFailed") : t("kff.alerts.empty")}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {error ? t("kff.alerts.pullToRetry") : t("kff.alerts.emptyDesc")}
                </Text>
              </View>
            }
          />
        )}
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
  cardGreyed: {
    backgroundColor: "#F3F4F7",
    shadowOpacity: 0,
    elevation: 0,
  },
  textGreyed: {
    color: KFF_COLORS.textMuted,
  },
  datePillGreyed: {
    borderColor: KFF_COLORS.divider,
  },
  // Unread marker in the card's top corner (flips with RTL).
  unreadDot: {
    position: "absolute",
    top: 12,
    end: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: KFF_COLORS.primary,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: "700",
    color: KFF_COLORS.text,
    textAlign: "left",
  },
  stateTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "100%",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "#FCF4DD",
  },
  stateTagText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "700",
    color: "#9A6F05",
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
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: KFF_COLORS.text,
    textAlign: "left",
  },
  loader: {
    flex: 1,
  },
  footerLoader: {
    marginVertical: 12,
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

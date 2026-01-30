import {
  getComplaintStats,
  getIncidentStats,
  getQueryStats,
  getRequestStats,
} from "@/src/api/incidents";
import { useAuth } from "@/src/context/AuthContext";
import { usePermissions } from "@/src/hooks/usePermissions";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  ImageBackground,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface StateDetail {
  id: string;
  name: string;
  count: number;
}

interface Stats {
  total: number;
  by_state_details?: StateDetail[];
}

// Color constants
const COLORS = {
  primary: "#1A237E",
  background: "#F5F7FA",
  white: "#FFFFFF",
  text: {
    primary: "#1A1A2E",
    secondary: "#64748B",
    muted: "#94A3B8",
  },
  incident: { bg: "#ECFDF5", icon: "#059669", bar: "#10B981" },
  request: { bg: "#F3E8FF", icon: "#9333EA", bar: "#A855F7" },
  complaint: { bg: "#FEF2F2", icon: "#DC2626", bar: "#EF4444" },
  query: { bg: "#EFF6FF", icon: "#2563EB", bar: "#3B82F6" },
  assigned: { bg: "#DBEAFE", icon: "#1D4ED8" },
  created: { bg: "#FEF3C7", icon: "#D97706" },
};

const DashboardScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const {
    canTransitionIncidents,
    canCreateIncidents,
    canViewIncidents,
    canViewAllIncidents,
    canViewRequests,
    canViewAllRequests,
    canViewComplaints,
    canViewAllComplaints,
    canViewQueries,
    canViewAllQueries,
  } = usePermissions();

  const [incidentStats, setIncidentStats] = useState<Stats | null>(null);
  const [requestStats, setRequestStats] = useState<Stats | null>(null);
  const [complaintStats, setComplaintStats] = useState<Stats | null>(null);
  const [queryStats, setQueryStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const [incidentRes, requestRes, complaintRes, queryRes] =
          await Promise.all([
            getIncidentStats(),
            getRequestStats(),
            getComplaintStats(),
            getQueryStats(),
          ]);

        if (incidentRes.success) setIncidentStats(incidentRes.data);
        if (requestRes.success) setRequestStats(requestRes.data);
        if (complaintRes.success) setComplaintStats(complaintRes.data);
        if (queryRes.success) setQueryStats(queryRes.data);

        if (
          !incidentRes.success &&
          !requestRes.success &&
          !complaintRes.success &&
          !queryRes.success
        ) {
          setError(t("errors.fetchStatsFailed"));
        }
      } catch {
        setError(t("errors.fetchStatsFailed"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [t],
  );

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [fetchStats]),
  );

  const onRefresh = useCallback(() => {
    fetchStats(true);
  }, [fetchStats]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("dashboard.greeting.morning");
    if (hour < 17) return t("dashboard.greeting.afternoon");
    return t("dashboard.greeting.evening");
  };

  const getUserName = () => {
    if (user?.first_name) return user.first_name;
    if (user?.username) return user.username;
    return "";
  };

  const renderHeader = () => (
    <ImageBackground
      source={require("@/assets/images/background.png")}
      style={styles.header}
    >
      <View style={styles.headerContent}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.userName}>{getUserName()}</Text>
        </View>
        <TouchableOpacity style={styles.notificationButton}>
          <Ionicons name="notifications-outline" size={24} color="white" />
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );

  const renderSummaryCard = (
    type: "incident" | "request" | "complaint" | "query",
    stats: Stats | null,
    canView: boolean,
  ) => {
    if (!canView) return null;

    const config = {
      incident: {
        icon: "alert-circle" as const,
        label: t("dashboard.stats.incidents"),
        colors: COLORS.incident,
      },
      request: {
        icon: "document-text" as const,
        label: t("dashboard.stats.requests"),
        colors: COLORS.request,
      },
      complaint: {
        icon: "chatbubble-ellipses" as const,
        label: t("dashboard.stats.complaints"),
        colors: COLORS.complaint,
      },
      query: {
        icon: "help-circle" as const,
        label: t("dashboard.stats.queries"),
        colors: COLORS.query,
      },
    };

    const { icon, label, colors } = config[type];

    return (
      <View style={[styles.summaryCard, { backgroundColor: colors.bg }]}>
        <View
          style={[styles.summaryIconContainer, { backgroundColor: colors.bg }]}
        >
          <Ionicons name={icon} size={24} color={colors.icon} />
        </View>
        <Text style={styles.summaryCardNumber}>{stats?.total || 0}</Text>
        <Text style={styles.summaryCardLabel}>{label}</Text>
      </View>
    );
  };

  const renderMyIncidentsSection = () => {
    if (!canViewIncidents()) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("dashboard.myIncidents")}</Text>
        <View style={styles.myIncidentsContainer}>
          {canTransitionIncidents() && (
            <TouchableOpacity
              style={styles.myIncidentCard}
              onPress={() =>
                router.push({
                  pathname: "/my-incidents",
                  params: { type: "assigned" },
                })
              }
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.myIncidentIconContainer,
                  { backgroundColor: COLORS.assigned.bg },
                ]}
              >
                <Ionicons
                  name="checkbox-outline"
                  size={22}
                  color={COLORS.assigned.icon}
                />
              </View>
              <Text style={styles.myIncidentText}>
                {t("dashboard.assignedToMe")}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={COLORS.text.muted}
              />
            </TouchableOpacity>
          )}

          {canCreateIncidents() && (
            <TouchableOpacity
              style={styles.myIncidentCard}
              onPress={() =>
                router.push({
                  pathname: "/my-incidents",
                  params: { type: "created" },
                })
              }
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.myIncidentIconContainer,
                  { backgroundColor: COLORS.created.bg },
                ]}
              >
                <Ionicons
                  name="create-outline"
                  size={22}
                  color={COLORS.created.icon}
                />
              </View>
              <Text style={styles.myIncidentText}>
                {t("dashboard.createdByMe")}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={COLORS.text.muted}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderStatusSection = (
    type: "incident" | "request" | "complaint" | "query",
    stats: Stats | null,
    canView: boolean,
    tabPath: string,
  ) => {
    if (!canView) return null;

    const config = {
      incident: {
        title: t("dashboard.incidentsByStatus"),
        emptyText: t("dashboard.noIncidents"),
        barColor: COLORS.incident.bar,
      },
      request: {
        title: t("dashboard.requestsByStatus"),
        emptyText: t("dashboard.noRequests"),
        barColor: COLORS.request.bar,
      },
      complaint: {
        title: t("dashboard.complaintsByStatus"),
        emptyText: t("dashboard.noComplaints"),
        barColor: COLORS.complaint.bar,
      },
      query: {
        title: t("dashboard.queriesByStatus"),
        emptyText: t("dashboard.noQueries"),
        barColor: COLORS.query.bar,
      },
    };

    const { title, emptyText, barColor } = config[type];
    const stateDetails = stats?.by_state_details || [];

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {stateDetails.length > 0 ? (
          stateDetails.map((stateDetail) => (
            <TouchableOpacity
              style={styles.statusCard}
              key={`${type}-${stateDetail.id}`}
              onPress={() =>
                router.push({
                  pathname: tabPath as any,
                  params: {
                    state_id: stateDetail.id,
                    state_name: stateDetail.name,
                  },
                })
              }
              activeOpacity={0.7}
            >
              <View style={[styles.statusBar, { backgroundColor: barColor }]} />
              <View style={styles.statusContent}>
                <Text style={styles.statusName}>{stateDetail.name}</Text>
                <Text style={styles.statusCount}>{stateDetail.count}</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={COLORS.text.muted}
              />
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons
              name="folder-open-outline"
              size={32}
              color={COLORS.text.muted}
            />
            <Text style={styles.emptyText}>{emptyText}</Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t("common.loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        {renderHeader()}
        <View style={styles.errorContainer}>
          <Ionicons
            name="cloud-offline-outline"
            size={64}
            color={COLORS.text.muted}
          />
          <Text style={styles.errorTitle}>{t("errors.oops")}</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchStats()}
          >
            <Ionicons name="refresh" size={20} color={COLORS.white} />
            <Text style={styles.retryButtonText}>{t("common.retry")}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {renderHeader()}
      <View style={styles.contentWrapper}>
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
        >
        {/* Summary Cards */}
        <View style={styles.summaryCardsContainer}>
          {renderSummaryCard("incident", incidentStats, canViewAllIncidents())}
          {renderSummaryCard("request", requestStats, canViewAllRequests())}
          {renderSummaryCard(
            "complaint",
            complaintStats,
            canViewAllComplaints(),
          )}
          {renderSummaryCard("query", queryStats, canViewAllQueries())}
        </View>

        {/* My Incidents */}
        {renderMyIncidentsSection()}

        {/* Status Sections */}
        {renderStatusSection(
          "incident",
          incidentStats,
          canViewIncidents(),
          "/(tabs)/incident",
        )}
        {renderStatusSection(
          "request",
          requestStats,
          canViewRequests(),
          "/(tabs)/request",
        )}
        {renderStatusSection(
          "complaint",
          complaintStats,
          canViewComplaints(),
          "/(tabs)/complaint",
        )}
        {renderStatusSection(
          "query",
          queryStats,
          canViewQueries(),
          "/(tabs)/query",
        )}

        <View style={styles.bottomPadding} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greeting: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 14,
    fontWeight: "500",
  },
  userName: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 4,
  },
  headerButtons: {
    flexDirection: "row",
    gap: 12,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  contentWrapper: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -16,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -16,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.text.secondary,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -16,
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.text.primary,
    marginTop: 16,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.text.secondary,
    textAlign: "center",
    marginTop: 8,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
  summaryCardsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  summaryCard: {
    width: "48%",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  summaryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  summaryCardNumber: {
    fontSize: 32,
    fontWeight: "bold",
    color: COLORS.text.primary,
    marginTop: 12,
  },
  summaryCardLabel: {
    fontSize: 13,
    color: COLORS.text.secondary,
    marginTop: 4,
    fontWeight: "500",
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text.primary,
    marginBottom: 12,
  },
  myIncidentsContainer: {
    gap: 10,
  },
  myIncidentCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  myIncidentIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  myIncidentText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text.primary,
  },
  statusCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  statusBar: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 14,
  },
  statusContent: {
    flex: 1,
  },
  statusName: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginBottom: 4,
  },
  statusCount: {
    fontSize: 22,
    fontWeight: "bold",
    color: COLORS.text.primary,
  },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 32,
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.text.muted,
    marginTop: 12,
  },
  bottomPadding: {
    height: 24,
  },
});

export default DashboardScreen;

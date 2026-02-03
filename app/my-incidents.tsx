import {
  getMyAssignedIncidents,
  getMyReportedIncidents,
} from "@/src/api/incidents";
import { getProfile } from "@/src/api/user";
import { usePermissions } from "@/src/hooks/usePermissions";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

const priorityMap: Record<number, { key: string; color: string }> = {
  1: { key: "critical", color: "#E74C3C" },
  2: { key: "high", color: "#E67E22" },
  3: { key: "medium", color: "#F1C40F" },
  4: { key: "low", color: "#3498DB" },
  5: { key: "veryLow", color: "#2ECC71" },
};

interface Incident {
  id: string;
  incident_number: string;
  title: string;
  priority: number;
  created_at: string;
  due_date?: string;
  sla_breached?: boolean;
  current_state?: { name: string; color?: string };
  location?: { name: string };
  assignee?: { first_name?: string; username: string };
  department?: { name: string };
}

interface PaginationInfo {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
}

const IncidentCard = ({
  incident,
  isAssigned,
  ticketType,
}: {
  incident: Incident;
  isAssigned: boolean;
  ticketType: "incident" | "request" | "complaint" | "query";
}) => {
  const router = useRouter();
  const { t } = useTranslation();
  const priority = priorityMap[incident.priority] || {
    key: "unknown",
    color: "#95A5A6",
  };
  const priorityText = t(`priorities.${priority.key}`);

  // Determine the correct detail page based on ticket type
  const getDetailRoute = () => {
    switch (ticketType) {
      case "incident":
        return `/incident-details?id=${incident.id}`;
      case "request":
        return `/request-details?id=${incident.id}`;
      case "complaint":
        return `/complaint-details?id=${incident.id}`;
      case "query":
        return `/query-details?id=${incident.id}`;
      default:
        return `/incident-details?id=${incident.id}`;
    }
  };

  return (
    <TouchableOpacity
      style={styles.incidentCard}
      onPress={() => router.push(getDetailRoute())}
    >
      <View
        style={[
          styles.incidentPriorityBar,
          { backgroundColor: priority.color },
        ]}
      />
      <View style={styles.incidentCardContent}>
        <View style={styles.incidentCardHeader}>
          <View style={styles.incidentIdContainer}>
            <View
              style={[styles.incidentDot, { backgroundColor: priority.color }]}
            />
            <Text style={styles.incidentId}>{incident.incident_number}</Text>
          </View>
          <View style={styles.tagsRow}>
            {incident.sla_breached && (
              <View style={styles.slaBreachedBadge}>
                <Ionicons name="warning" size={10} color="#FFF" />
                <Text style={styles.slaBreachedText}>SLA</Text>
              </View>
            )}
            <Text
              style={[styles.incidentTag, { backgroundColor: priority.color }]}
            >
              {priorityText}
            </Text>
          </View>
        </View>
        <Text style={styles.incidentTitle} numberOfLines={2}>
          {incident.title}
        </Text>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: incident.current_state?.color
                  ? `${incident.current_state.color}20`
                  : "#E3F2FD",
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: incident.current_state?.color || "#1976D2" },
              ]}
            >
              {incident.current_state?.name || "N/A"}
            </Text>
          </View>
          {incident.due_date && (
            <View style={styles.dueDateContainer}>
              <Ionicons name="calendar-outline" size={12} color="#666" />
              <Text style={styles.dueDateText}>
                {new Date(incident.due_date).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.metaRow}>
          {isAssigned
            ? incident.department && (
                <View style={styles.metaItem}>
                  <Ionicons name="business-outline" size={14} color="#666" />
                  <Text style={styles.metaText}>
                    {incident.department.name}
                  </Text>
                </View>
              )
            : incident.assignee && (
                <View style={styles.metaItem}>
                  <Ionicons name="person-outline" size={14} color="#666" />
                  <Text style={styles.metaText}>
                    {incident.assignee.first_name || incident.assignee.username}
                  </Text>
                </View>
              )}
          {incident.location && (
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={14} color="#666" />
              <Text style={styles.metaText}>{incident.location.name}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const MyIncidentsScreen = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { type: initialType } = useLocalSearchParams<{ type?: string }>();
  const [activeTab, setActiveTab] = useState<"assigned" | "created">(
    initialType === "created" ? "created" : "assigned",
  );
  const [ticketType, setTicketType] = useState<"incident" | "request" | "complaint" | "query">("incident");
  const { canCreateIncidents, canUpdateIncidents } = usePermissions();

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState<{
    email?: string;
    username?: string;
    id?: string;
  } | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total_items: 0,
    total_pages: 0,
  });

  const isLoadingMore = useRef(false);

  // Fetch current user info
  useEffect(() => {
    const fetchUser = async () => {
      const response = await getProfile();
      if (response.success) {
        setCurrentUser(response.data);
      }
    };
    fetchUser();
  }, []);

  const fetchIncidents = async (page = 1, append = false) => {
    if (page === 1) {
      setLoading(true);
      setError("");
    }

    const fetchFn =
      activeTab === "assigned"
        ? getMyAssignedIncidents
        : getMyReportedIncidents;
    const response = await fetchFn(page, 20);

    if (response.success) {
      // Filter by selected ticket type
      const prefixMap = {
        incident: 'INC',
        request: 'REQ',
        complaint: 'COMP',
        query: 'QUERY'
      };
      const prefix = prefixMap[ticketType];
      const filteredData = (response.data || []).filter((item: any) => {
        const itemNumber = item.incident_number || item.number || '';
        return itemNumber.startsWith(prefix) || itemNumber.startsWith(`${prefix}-`);
      });

      if (append) {
        setIncidents((prev) => [...prev, ...filteredData]);
      } else {
        setIncidents(filteredData);
      }
      setPagination({
        ...response.pagination,
        total_items: filteredData.length,
        total_pages: Math.ceil(filteredData.length / 20),
      });
    } else {
      setError(response.error || t('myIncidents.fetchFailed'));
      if (!append) {
        Alert.alert(t('common.error'), response.error || t('myIncidents.fetchFailed'));
      }
    }

    setLoading(false);
    setLoadingMore(false);
    setRefreshing(false);
    isLoadingMore.current = false;
  };

  const handleLoadMore = () => {
    if (isLoadingMore.current || loadingMore || loading) return;
    if (pagination.page >= pagination.total_pages) return;

    isLoadingMore.current = true;
    setLoadingMore(true);
    fetchIncidents(pagination.page + 1, true);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchIncidents(1, false);
  };

  useEffect(() => {
    fetchIncidents(1, false);
  }, [activeTab, ticketType]);

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#1A237E" />
        <Text style={styles.footerLoaderText}>{t('myIncidents.loadingMore')}</Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;

    // Get the translation key based on ticket type and tab
    const getTitleKey = () => {
      if (activeTab === "assigned") {
        if (ticketType === "incident") return 'myIncidents.noAssignedIncidents';
        if (ticketType === "request") return 'myIncidents.noAssignedRequests';
        if (ticketType === "complaint") return 'myIncidents.noAssignedComplaints';
        return 'myIncidents.noAssignedQueries';
      } else {
        if (ticketType === "incident") return 'myIncidents.noCreatedIncidents';
        if (ticketType === "request") return 'myIncidents.noCreatedRequests';
        if (ticketType === "complaint") return 'myIncidents.noCreatedComplaints';
        return 'myIncidents.noCreatedQueries';
      }
    };

    // Get the ticket type name for description
    const ticketTypeName = ticketType === "incident" ? t('tabs.incident').toLowerCase() :
                           ticketType === "request" ? t('tabs.request').toLowerCase() :
                           ticketType === "complaint" ? t('tabs.complaint').toLowerCase() :
                           t('tabs.query').toLowerCase();

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <Ionicons
            name={
              activeTab === "assigned" ? "checkbox-outline" : "create-outline"
            }
            size={48}
            color="#1A237E"
          />
        </View>
        <Text style={styles.emptyTitle}>
          {t(getTitleKey())}
        </Text>
        <Text style={styles.emptySubtitle}>
          {activeTab === "assigned"
            ? t('myIncidents.noAssignedDesc', { type: ticketTypeName })
            : t('myIncidents.noCreatedDesc', { type: ticketTypeName })}
        </Text>
      </View>
    );
  };

  const renderHeader = () => {
    const ticketTypeLabel = ticketType === "incident" ? t('tabs.incident').toLowerCase() :
                           ticketType === "request" ? t('tabs.request').toLowerCase() :
                           ticketType === "complaint" ? t('tabs.complaint').toLowerCase() :
                           t('tabs.query').toLowerCase();

    const statusLabel = activeTab === "assigned" ? t('myIncidents.assigned') : t('myIncidents.created');

    return (
      <View style={styles.listHeader}>
        <Text style={styles.incidentsFoundText}>
          {pagination.total_items} {statusLabel} {ticketTypeLabel}
        </Text>
        {pagination.total_pages > 1 && (
          <Text style={styles.paginationText}>
            {t('myIncidents.page')} {pagination.page} {t('myIncidents.of')} {pagination.total_pages}
          </Text>
        )}
      </View>
    );
  };

  // Stats summary
  const openCount = incidents.filter(
    (i) =>
      i.current_state?.name?.toLowerCase() !== "closed" &&
      i.current_state?.name?.toLowerCase() !== "resolved",
  ).length;
  const breachedCount = incidents.filter((i) => i.sla_breached).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ImageBackground
        source={require("@/assets/images/background.png")}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{t('myIncidents.title')}</Text>
          {currentUser && (
            <Text style={styles.headerSubtitle}>
              {t('myIncidents.loggedInAs')} {currentUser.email}
            </Text>
          )}
        </View>
        {canCreateIncidents() && (
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => router.push("/add-incident")}
          >
            <FontAwesome name="plus" size={20} color="white" />
          </TouchableOpacity>
        )}
      </ImageBackground>

      <View style={styles.contentContainer}>
        {/* Main Tabs - Assigned vs Created */}
        <View style={styles.tabContainer}>
          {canUpdateIncidents() && (
            <TouchableOpacity
              style={[styles.tab, activeTab === "assigned" && styles.activeTab]}
              onPress={() => setActiveTab("assigned")}
            >
              <Ionicons
                name="checkbox-outline"
                size={18}
                color={activeTab === "assigned" ? "#1A237E" : "#666"}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "assigned" && styles.activeTabText,
                ]}
              >
                {t('myIncidents.assignedToMe')}
              </Text>
            </TouchableOpacity>
          )}
          {canCreateIncidents() && (
            <TouchableOpacity
              style={[styles.tab, activeTab === "created" && styles.activeTab]}
              onPress={() => setActiveTab("created")}
            >
              <Ionicons
                name="create-outline"
                size={18}
                color={activeTab === "created" ? "#1A237E" : "#666"}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "created" && styles.activeTabText,
                ]}
              >
                {t('myIncidents.createdByMe')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Ticket Type Tabs */}
        <View style={styles.ticketTypeContainer}>
          <TouchableOpacity
            style={[styles.ticketTypeTab, ticketType === "incident" && styles.activeTicketTypeTab]}
            onPress={() => setTicketType("incident")}
          >
            <Text style={[styles.ticketTypeText, ticketType === "incident" && styles.activeTicketTypeText]}>
              {t('tabs.incident')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ticketTypeTab, ticketType === "request" && styles.activeTicketTypeTab]}
            onPress={() => setTicketType("request")}
          >
            <Text style={[styles.ticketTypeText, ticketType === "request" && styles.activeTicketTypeText]}>
              {t('tabs.request')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ticketTypeTab, ticketType === "complaint" && styles.activeTicketTypeTab]}
            onPress={() => setTicketType("complaint")}
          >
            <Text style={[styles.ticketTypeText, ticketType === "complaint" && styles.activeTicketTypeText]}>
              {t('tabs.complaint')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ticketTypeTab, ticketType === "query" && styles.activeTicketTypeTab]}
            onPress={() => setTicketType("query")}
          >
            <Text style={[styles.ticketTypeText, ticketType === "query" && styles.activeTicketTypeText]}>
              {t('tabs.query')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Quick Stats */}
        {!loading && incidents.length > 0 && (
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{pagination.total_items}</Text>
              <Text style={styles.statLabel}>{t('myIncidents.total')}</Text>
            </View>
            <View style={styles.statDivider} />

            {canCreateIncidents() && (
              <>
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, { color: "#F1C40F" }]}>
                    {openCount}
                  </Text>
                  <Text style={styles.statLabel}>{t('myIncidents.open')}</Text>
                </View>
                <View style={styles.statDivider} />
              </>
            )}
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: "#E74C3C" }]}>
                {breachedCount}
              </Text>
              <Text style={styles.statLabel}>{t('myIncidents.slaBreached')}</Text>
            </View>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <View style={styles.loaderCard}>
              <ActivityIndicator size="large" color="#1A237E" />
              <Text style={styles.loadingText}>{t('myIncidents.loadingTickets')}</Text>
            </View>
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => fetchIncidents(1, false)}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={incidents}
            renderItem={({ item }) => (
              <IncidentCard
                incident={item}
                isAssigned={activeTab === "assigned"}
                ticketType={ticketType}
              />
            )}
            keyExtractor={(item) => item.id}
            style={styles.flatList}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={incidents.length > 0 ? renderHeader : null}
            ListFooterComponent={renderFooter}
            ListEmptyComponent={renderEmpty}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#1A237E",
  },
  contentContainer: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  flatList: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    padding: 20,
  },
  loaderCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
  },
  loadingText: {
    marginTop: 16,
    color: "#1A237E",
    fontSize: 16,
    fontWeight: "500",
  },
  errorText: {
    color: "red",
    fontSize: 16,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: "#1A237E",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "white",
    fontWeight: "600",
  },
  header: {
    paddingHorizontal: 15,
    paddingTop: 40,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    padding: 5,
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 10,
  },
  headerTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    marginTop: 2,
  },
  headerIcon: {
    padding: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 5,
    gap: 10,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "white",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  activeTab: {
    backgroundColor: "#E3F2FD",
    borderWidth: 1,
    borderColor: "#1A237E",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
  },
  activeTabText: {
    color: "#1A237E",
  },
  ticketTypeContainer: {
    flexDirection: "row",
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 15,
    paddingVertical: 10,
    gap: 8,
  },
  ticketTypeTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "white",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  activeTicketTypeTab: {
    backgroundColor: "#2EC4B6",
  },
  ticketTypeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#666",
  },
  activeTicketTypeText: {
    color: "white",
  },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "white",
    marginHorizontal: 15,
    marginTop: 10,
    borderRadius: 10,
    padding: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1A237E",
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: "#E0E0E0",
    marginVertical: 5,
  },
  listContent: {
    padding: 15,
    paddingBottom: 30,
    backgroundColor: "#F5F5F5",
    flexGrow: 1,
  },
  listHeader: {
    marginBottom: 15,
  },
  incidentsFoundText: {
    fontSize: 14,
    color: "#666",
  },
  paginationText: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  incidentCard: {
    backgroundColor: "white",
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    overflow: "hidden",
  },
  incidentPriorityBar: {
    width: 5,
  },
  incidentCardContent: {
    flex: 1,
    padding: 15,
  },
  incidentCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  incidentIdContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  incidentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  incidentId: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1A237E",
  },
  tagsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  slaBreachedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E74C3C",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 3,
  },
  slaBreachedText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
  incidentTag: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  incidentTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    marginBottom: 10,
    lineHeight: 20,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  dueDateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dueDateText: {
    fontSize: 12,
    color: "#666",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: "#666",
  },
  footerLoader: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
  },
  footerLoaderText: {
    marginLeft: 10,
    color: "#666",
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 30,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#E3F2FD",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2EC4B6",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  createButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default MyIncidentsScreen;

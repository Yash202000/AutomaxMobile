import { getIncidents, getIncidentStats } from "@/src/api/incidents";
import { CustomAlert } from "@/src/components/CustomAlert";
import { useAuth } from "@/src/context/AuthContext";
import { usePermissions } from "@/src/hooks/usePermissions";
import i18n from "@/src/i18n";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  ImageBackground,
  Platform,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const SHARE_LIMIT = 12;

const COLORS = {
  primary: "#1A237E",
  accent: "#2EC4B6",
  background: "#F5F7FA",
  white: "#FFFFFF",
  text: {
    primary: "#1A1A2E",
    secondary: "#64748B",
    muted: "#94A3B8",
  },
  incident: "#10B981",
  priority: {
    critical: "#DC2626",
    high: "#EA580C",
    medium: "#F59E0B",
    low: "#3B82F6",
    veryLow: "#22C55E",
  },
};

const priorityConfig: Record<number, { key: string; color: string }> = {
  1: { key: "critical", color: COLORS.priority.critical },
  2: { key: "high", color: COLORS.priority.high },
  3: { key: "medium", color: COLORS.priority.medium },
  4: { key: "low", color: COLORS.priority.low },
  5: { key: "veryLow", color: COLORS.priority.veryLow },
};

const slaStatusConfig: Record<string, { key: string; color: string }> = {
  on_track: { key: "onTrack", color: "#22C55E" },
  at_risk: { key: "atRisk", color: "#F59E0B" },
  breached: { key: "breached", color: "#DC2626" },
};

const severityConfig: Record<number, { key: string; color: string }> = {
  1: { key: "critical", color: "#E74C3C" },
  2: { key: "major", color: "#E67E22" },
  3: { key: "moderate", color: "#F1C40F" },
  4: { key: "minor", color: "#3498DB" },
  5: { key: "cosmetic", color: "#2ECC71" },
};

const getSources = (t: any) => [
  { value: "web", label: t("incidents.sources.web") },
  { value: "mobile", label: t("incidents.sources.mobile") },
  { value: "email", label: t("incidents.sources.email") },
  { value: "phone", label: t("incidents.sources.phone") },
  { value: "walk_in", label: t("incidents.sources.walk_in") },
  { value: "api", label: t("incidents.sources.api") },
  { value: "social_media", label: t("incidents.sources.social_media") },
  { value: "940_system", label: t("incidents.sources.940_system") },
  { value: "940_manual", label: t("incidents.sources.940_manual") },
  { value: "field", label: t("incidents.sources.field") },
  { value: "manual", label: t("incidents.sources.manual") },
  { value: "viusional", label: t("incidents.sources.viusional") },
  { value: "other", label: t("incidents.sources.other") },
];

interface Incident {
  id: string;
  incident_number: string;
  title: string;
  priority: number;
  created_at: string;
  current_state?: { name: string };
  location?: { name: string };
  lookup_values?: Array<{
    category: { code: string; name: string };
    code: string;
    name: string;
    name_ar: string;
    color: string;
  }>;
  transition_history?: Array<any>;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
}

const IncidentCard = ({
  incident,
  isSelected,
  selectionMode,
  onSelect,
  onLongPress,
}: {
  incident: Incident;
  isSelected?: boolean;
  selectionMode?: boolean;
  onSelect?: () => void;
  onLongPress?: () => void;
}) => {
  const router = useRouter();
  const { t } = useTranslation();

  // Extract priority from lookup_values if available
  const priorityLookup = incident.lookup_values?.find(
    (lv) => lv.category.code === "PRIORITY",
  );

  // Use lookup value color and name if available, otherwise fallback to old config
  let config = priorityConfig[incident.priority] || {
    key: "unknown",
    color: "#94A3B8",
  };
  let priorityText = t(`priorities.${config.key}`, config.key);

  if (priorityLookup) {
    config = {
      key: priorityLookup.code.toLowerCase(),
      color: priorityLookup.color,
    };
    priorityText =
      i18n.language === "en" ? priorityLookup.name : priorityLookup.name_ar;
  }
  const latestTransition = incident.transition_history?.reduce(
    (latest, current): any => {
      if (!latest) return current;

      const currentTime = new Date(current.transitioned_at).getTime();
      const latestTime = new Date(latest.transitioned_at).getTime();

      return currentTime > latestTime ? current : latest;
    },
    undefined,
  );

  const performer = latestTransition?.performed_by;

  const displayName =
    performer?.first_name || performer?.last_name
      ? [performer?.first_name, performer?.last_name].filter(Boolean).join(" ")
      : performer?.username;

  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.cardSelected]}
      onPress={() => {
        if (selectionMode && onSelect) {
          onSelect();
        } else {
          router.push(`/incident-details?id=${incident.id}`);
        }
      }}
      onLongPress={() => {
        if (onLongPress) {
          onLongPress();
        }
      }}
      activeOpacity={0.7}
    >
      {selectionMode && (
        <View style={styles.checkboxContainer}>
          <Ionicons
            name={isSelected ? "checkmark-circle" : "ellipse-outline"}
            size={24}
            color={isSelected ? COLORS.accent : COLORS.text.muted}
          />
        </View>
      )}
      {
        selectionMode ? <></> : <View style={[styles.cardBar, { backgroundColor: config.color }]} />
      }
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.idContainer}>
            <View style={[styles.dot, { backgroundColor: config.color }]} />
            <Text style={styles.idText}>{incident.incident_number}</Text>
          </View>
          <View
            style={[styles.priorityBadge, { backgroundColor: config.color }]}
          >
            <Text style={styles.priorityText}>{priorityText}</Text>
          </View>
        </View>
        <Text style={styles.dateTime}>
          {new Date(incident.created_at).toLocaleString()}
        </Text>
        {latestTransition?.transition && (
          <Text
            style={[
              styles.rejectText,
              ...(latestTransition?.transition?.code !== "reject"
                ? [
                  {
                    backgroundColor: "rgba(38, 102, 220, 0.1)",
                    color: "#2666DC",
                  },
                ]
                : []),
            ]}
          >
            {latestTransition?.transition?.name} {t("details.by")} {displayName}
          </Text>
        )}
        <Text style={styles.statusText}>
          {t("incidents.status")}:{" "}
          {incident.current_state?.name || t("common.na")}
        </Text>
        <View style={styles.detailRow}>
          <Ionicons
            name="alert-circle"
            size={16}
            color={COLORS.incident}
            style={styles.detailIcon}
          />
          <Text style={styles.detailText} numberOfLines={1}>
            {incident.title}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons
            name="location"
            size={16}
            color={COLORS.priority.low}
            style={styles.detailIcon}
          />
          <Text style={styles.detailText}>
            {incident.location?.name || t("common.noData")}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const IncidentsScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { canCreateIncidents, canViewAllIncidents, canShareIncidents } = usePermissions();
  const { user } = useAuth();
  let {
    state_id,
    state_name,
    priority,
    severity,
    assignee_id,
    assignee_name,
    department_id,
    department_name,
    classification_ids,
    classification_names,
    location_ids,
    location_names,
    source,
    start_date,
    end_date,
  } = useLocalSearchParams<{
    state_id?: string;
    state_name?: string;
    priority?: string;
    severity?: string;
    assignee_id?: string;
    assignee_name?: string;
    department_id?: string;
    department_name?: string;
    classification_ids?: string;
    classification_names?: string;
    location_ids?: string;
    location_names?: string;
    source?: string;
    start_date?: string;
    end_date?: string;
  }>();

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total_items: 0,
    total_pages: 0,
  });
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<TextInput>(null);
  const isLoadingMore = useRef(false);

  // Multi-selection states & operations
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const insets = useSafeAreaInsets();

  const toggleSelectIncident = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleLongPressIncident = (id: string) => {
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedIds(new Set([id]));
    }
  };

  const handleSelectAllToggle = () => {
    if (selectedIds.size === incidents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(incidents.map((inc) => inc.id)));
    }
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleShareSelected = async () => {
    if (selectedIds.size === 0) return;

    const selectedIncidents = incidents.filter((inc) => selectedIds.has(inc.id));

    const doShare = async (incidentsToShare: typeof selectedIncidents) => {
      let shareText = `📋 *${t("incidents.title")} Summary*:\n\n`;
      incidentsToShare.forEach((inc, index) => {
        const priorityLookup = inc.lookup_values?.find(
          (lv) => lv.category.code === "PRIORITY",
        );
        let priorityVal = t(`priorities.${priorityConfig[inc.priority]?.key || "unknown"}`);
        if (priorityLookup) {
          priorityVal =
            i18n.language === "en" ? priorityLookup.name : priorityLookup.name_ar;
        }

        shareText += `${index + 1}. *${inc.incident_number}* - ${inc.title}\n`;
        shareText += `   ${t("incidents.classification")} : ${inc.classification.name || t("common.na")}\n`;
        shareText += `   ${t("incidents.location")} : ${inc.location?.name || t("common.na")}\n`;
        shareText += `   ${t("incidents.description")} : ${inc.description || t("common.na")}\n`;
        shareText += `   ${t("incidents.status")} : ${inc.current_state?.name || t("common.na")}\n`;
        shareText += `   ${t("filter.priority")} : ${priorityVal}\n`;
        shareText += `   ${t("incidents.reporter")} : ${(inc.reporter?.first_name + " " + inc.reporter?.last_name) || t("common.na")}\n`;
        shareText += `   ${t("addIncident.reporterPhone")} : ${inc.reporter?.phone || inc?.reporter_phone || t("common.na")}\n`;
        shareText += `   ${t("incidents.createdAt")} : ${new Date(inc.created_at).toLocaleString()}\n\n`;
        shareText += "------------------------------------------\n\n";
      });

      try {
        await Share.share({ message: shareText });
      } catch (err) {
        console.error("Error sharing incidents:", err);
      }
    };

    if (selectedIncidents.length > SHARE_LIMIT) {
      CustomAlert.alert(
        t("incidents.shareLimitTitle", "Share Limit Reached"),
        t(
          "incidents.shareLimitMessage",
          `You can share up to ${SHARE_LIMIT} incidents at a time. Only the first ${SHARE_LIMIT} will be shared.`,
          { limit: SHARE_LIMIT },
        ),
        [
          {
            text: t("common.cancel"),
            style: "cancel",
          },
          {
            text: t("common.share", "Share"),
            onPress: () => doShare(selectedIncidents.slice(0, SHARE_LIMIT)),
          },
        ],
      );
    } else {
      await doShare(selectedIncidents);
    }
  };

  // Don't apply default status filter - show ALL incidents unless explicitly filtered
  const activeStateId = state_id;
  const activeStateName = state_name;

  const buildParams = (page: number) => {
    const params: Record<string, any> = { page, limit: 20 };
    if (activeStateId) params.current_state_id = activeStateId.split(",");
    if (priority) params.priority = priority.split(",").map((p) => parseInt(p));
    if (severity) params.severity = severity.split(",").map((s) => parseInt(s));
    if (assignee_id) params.assignee_id = assignee_id.split(",");
    if (department_id) params.department_id = department_id.split(",");
    if (classification_ids)
      params.classification_id = classification_ids.split(",");
    if (location_ids) params.location_id = location_ids.split(",");
    if (source) params.source = source.split(",");
    if (start_date) params.start_date = start_date;
    if (end_date) params.end_date = end_date;
    if (searchQuery.trim().length >= 3) params.search = searchQuery.trim();
    return params;
  };

  const fetchIncidents = async (page = 1, append = false) => {
    // If search has 1-2 chars, show empty state immediately — don't fetch
    const trimmedSearch = searchQuery.trim();
    if (trimmedSearch.length > 0 && trimmedSearch.length < 3) {
      setIncidents([]);
      setPagination({ page: 1, limit: 20, total_items: 0, total_pages: 0 });
      setLoading(false);
      setRefreshing(false);
      isLoadingMore.current = false;
      return;
    }

    if (page === 1) setLoading(true);
    setError("");
    try {
      let params = buildParams(page);
      if (!params?.current_state_id || params?.current_state_id.length === 0) {
        const statsResponse = await getIncidentStats();
        if (statsResponse.success) {
          params.current_state_id = statsResponse.data.workflow_stats[0].by_state_details.map(
            (s: any) => s.id,
          );
          state_id = params.current_state_id.join(",");
        }
      }
      if (!canViewAllIncidents()) {
        params.assignee_id = user?.id;
      }
      const response = await getIncidents(params);
      if (response.success) {
        setIncidents(
          append ? (prev) => [...prev, ...response.data] : response.data,
        );
        setPagination(response.pagination);
      } else {
        setError(response.error || t("errors.fetchFailed"));
      }
    } catch (err: any) {
      if (!err?.isLogoutCancel) {
        console.log(err);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
      isLoadingMore.current = false;
    }
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

  useFocusEffect(
    useCallback(() => {
      exitSelectionMode();
      fetchIncidents(1, false);
    }, [
      activeStateId,
      priority,
      severity,
      assignee_id,
      department_id,
      classification_ids,
      location_ids,
      source,
      start_date,
      end_date,
      searchQuery,
    ]),
  );

  const handleSearchToggle = () => {
    setShowSearch(!showSearch);
    if (!showSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setSearchQuery("");
    }
  };

  const handleSearchSubmit = () => {
    fetchIncidents(1, false);
  };

  const clearFilter = () => router.replace("/(tabs)/incident");

  const hasManualFilters =
    state_id ||
    priority ||
    severity ||
    assignee_id ||
    department_id ||
    classification_ids ||
    location_ids ||
    source ||
    start_date ||
    end_date;
  const headerTitle = activeStateName || t("incidents.title");
  const activeFilterCount = [
    state_id,
    priority,
    severity,
    assignee_id,
    department_id,
    classification_ids,
    location_ids,
    source,
    start_date,
    end_date,
  ].filter(Boolean).length;

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={COLORS.primary} />
        <Text style={styles.footerLoaderText}>
          {t("incidents.loadingMore")}
        </Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    const trimmedSearch = searchQuery.trim();
    const isShortSearch = trimmedSearch.length > 0 && trimmedSearch.length < 3;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name={isShortSearch ? "search-outline" : "document-text-outline"}
          size={64}
          color={COLORS.text.muted}
        />
        <Text style={styles.emptyTitle}>
          {isShortSearch
            ? t("search.minCharsTitle")
            : t("incidents.noIncidents")}
        </Text>
        <Text style={styles.emptySubtitle}>
          {isShortSearch
            ? t("search.minCharsDesc")
            : hasManualFilters
              ? t("incidents.adjustFilters")
              : t("incidents.noIncidentsDesc")}
        </Text>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.listHeader}>
      <Text style={styles.foundText}>
        {hasManualFilters
          ? t("incidents.incidentsFound", { count: pagination.total_items }) +
          ` (${activeFilterCount} ${t("filter.title").toLowerCase()})`
          : `${pagination.total_items} ${activeStateName || ""} ${pagination.total_items !== 1 ? t("tabs.incident").toLowerCase() : t("tabs.incident").toLowerCase().slice(0, -1)}`}
      </Text>
      {pagination.total_pages > 1 && (
        <Text style={styles.paginationText}>
          {t("incidents.page", {
            current: pagination.page,
            total: pagination.total_pages,
          })}
        </Text>
      )}
    </View>
  );

  const FilterBadges = () => {
    if (!hasManualFilters) return null;
    const badges = [
      state_id && {
        key: "status",
        label: t("filter.status"),
        value:
          state_id.split(",").length > 1
            ? `${state_id.split(",").length} ${t("filter.selected")}`
            : state_name || state_id,
      },
      priority && {
        key: "priority",
        label: t("filter.priority"),
        value:
          priority.split(",").length > 1
            ? `${priority.split(",").length} ${t("filter.selected")}`
            : t(`priorities.${priorityConfig[parseInt(priority)]?.key}`),
      },
      severity && {
        key: "severity",
        label: t("filter.severity"),
        value:
          severity.split(",").length > 1
            ? `${severity.split(",").length} ${t("filter.selected")}`
            : t(`severities.${severityConfig[parseInt(severity)]?.key}`),
      },
      assignee_id && {
        key: "assignee",
        label: t("filter.assignee"),
        value:
          assignee_id.split(",").length > 1
            ? `${assignee_id.split(",").length} ${t("filter.selected")}`
            : assignee_name || assignee_id,
      },
      department_id && {
        key: "dept",
        label: t("filter.department"),
        value:
          department_id.split(",").length > 1
            ? `${department_id.split(",").length} ${t("filter.selected")}`
            : department_name || department_id,
      },
      classification_ids && {
        key: "class",
        label: t("filter.classification"),
        value:
          classification_ids.split(",").length > 1
            ? `${classification_ids.split(",").length} ${t("filter.selected")}`
            : classification_names?.split(",")[0] || classification_ids,
      },
      location_ids && {
        key: "loc",
        label: t("filter.location"),
        value:
          location_ids.split(",").length > 1
            ? `${location_ids.split(",").length} ${t("filter.selected")}`
            : location_names?.split(",")[0] || location_ids,
      },
      source && {
        key: "source",
        label: t("filter.source"),
        value:
          source.split(",").length > 1
            ? `${source.split(",").length} ${t("filter.selected")}`
            : getSources(t).find((s) => s.value === source)?.label || source,
      },
    ].filter(Boolean) as { key: string; label: string; value: string }[];

    return (
      <View style={styles.filterBadgeContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterBadgeScroll}
          data={badges}
          renderItem={({ item }) => (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeLabel}>{item.label}:</Text>
              <Text style={styles.filterBadgeValue}>{item.value}</Text>
            </View>
          )}
          keyExtractor={(item) => item.key}
        />
        <TouchableOpacity onPress={clearFilter} style={[styles.clearAllButton, { flexDirection: i18n.language === "en" ? "row" : "row-reverse" }]}>
          <Ionicons
            name="close-circle"
            size={18}
            color={COLORS.priority.critical}
          />
          <Text style={styles.clearAllText}>
            {t("filter.clearAll")} ({activeFilterCount})
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ImageBackground
        source={require("@/assets/images/background.png")}
        style={styles.header}
      >
        {selectionMode ? (
          <View style={styles.selectionHeaderContainer}>
            <View style={styles.selectionHeaderLeft}>
              <TouchableOpacity onPress={exitSelectionMode} style={styles.selectionHeaderClose}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
              <Text style={styles.selectionHeaderTitle}>
                {selectedIds.size} {t("filter.selected")}
              </Text>
            </View>
            <TouchableOpacity onPress={handleSelectAllToggle} style={styles.selectAllHeaderButton}>
              <Text style={styles.selectAllHeaderText}>
                {selectedIds.size === incidents.length
                  ? t("common.deselectAll", "Deselect All")
                  : t("common.selectAll", "Select All")}
              </Text>
            </TouchableOpacity>
          </View>
        ) : showSearch ? (
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Ionicons
                name="search"
                size={20}
                color="#666"
                style={styles.searchIcon}
              />
              <TextInput
                ref={searchInputRef}
                style={[styles.searchInput, { textAlign: i18n.language === 'ar' ? 'right' : 'left' }]}
                placeholder={t("search.placeholder")}
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearchSubmit}
                returnKeyType="search"
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={styles.searchCancelButton}
              onPress={handleSearchToggle}
            >
              <Text style={styles.searchCancelText}>{t("common.cancel")}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.headerTitleContainer}>
              <Text
                style={styles.headerTitle}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {headerTitle}
              </Text>
            </View>
            <View style={styles.headerIcons}>
              {canShareIncidents() && (
                <TouchableOpacity
                  style={styles.headerIcon}
                  onPress={() => {
                    setSelectionMode(true);
                    setSelectedIds(new Set());
                  }}
                >
                  <Ionicons name="share-social-outline" size={22} color="white" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.headerIcon}
                onPress={() =>
                  router.push({
                    pathname: "/map-view",
                    params: {
                      type: "incident",
                      state_id,
                      priority,
                      severity,
                      assignee_id,
                      department_id,
                      classification_ids,
                      location_ids,
                      source,
                      start_date,
                      end_date,
                      search: searchQuery,
                    },
                  })
                }
              >
                <Ionicons name="map-outline" size={22} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerIcon}
                onPress={handleSearchToggle}
              >
                <Ionicons name="search-outline" size={24} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.headerIcon,
                  hasManualFilters && styles.filterIconActive,
                ]}
                onPress={() =>
                  router.push({
                    pathname: "/filter",
                    params: {
                      state_id,
                      state_name,
                      priority,
                      severity,
                      assignee_id,
                      assignee_name,
                      department_id,
                      department_name,
                      classification_ids,
                      classification_names,
                      location_ids,
                      location_names,
                      source,
                      start_date,
                      end_date,
                    },
                  })
                }
              >
                <Ionicons name="filter" size={22} color="white" />
                {hasManualFilters && <View style={styles.filterDot} />}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ImageBackground>

      <FilterBadges />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {t("incidents.loadingIncidents")}
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons
            name="cloud-offline-outline"
            size={64}
            color={COLORS.text.muted}
          />
          <Text style={styles.errorTitle}>{t("errors.oops")}</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchIncidents(1, false)}
          >
            <Ionicons name="refresh" size={20} color={COLORS.white} />
            <Text style={styles.retryButtonText}>{t("common.retry")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={incidents}
          renderItem={({ item }) => (
            <IncidentCard
              incident={item}
              isSelected={selectedIds.has(item.id)}
              selectionMode={selectionMode}
              onSelect={() => toggleSelectIncident(item.id)}
              onLongPress={() => handleLongPressIncident(item.id)}
            />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          showsVerticalScrollIndicator={false}
        />
      )}

      {canCreateIncidents() && !selectionMode && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push("/add-incident")}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="white" />
        </TouchableOpacity>
      )}

      {selectionMode && (
        <View style={[styles.floatingActionBar, { bottom: insets.bottom + 70 }]}>
          <View style={styles.actionBarLeft}>
            <Text style={styles.actionBarCountText}>
              {selectedIds.size} {t("filter.selected")}
            </Text>
          </View>
          <View style={styles.actionBarRight}>
            {canShareIncidents() && (
              <TouchableOpacity
                onPress={handleShareSelected}
                disabled={selectedIds.size === 0}
                style={[
                  styles.actionBarButton,
                  styles.shareActionButton,
                  selectedIds.size === 0 && styles.actionBarButtonDisabled,
                ]}
              >
                <Ionicons name="share-social-outline" size={20} color="white" style={{ marginRight: 6 }} />
                <Text style={styles.actionBarButtonText}>{t("common.share", "Share")}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={exitSelectionMode} style={[styles.actionBarButton, styles.cancelActionButton]}>
              <Text style={styles.actionBarButtonTextCancel}>{t("common.cancel")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.primary },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
    paddingHorizontal: 40,
  },
  loadingText: { marginTop: 12, color: COLORS.text.secondary, fontSize: 14 },
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
  retryButtonText: { color: COLORS.white, fontSize: 16, fontWeight: "600" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitleContainer: { flex: 1 },
  headerTitle: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
    maxWidth: 200,
  },
  headerIcons: { flexDirection: "row", gap: 12 },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  filterBadgeContainer: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  filterBadgeScroll: { flex: 1 },
  filterBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  filterBadgeLabel: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginRight: 4,
  },
  filterBadgeValue: { fontSize: 12, fontWeight: "bold", color: COLORS.primary },
  clearAllButton: {
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  clearAllText: {
    fontSize: 12,
    color: COLORS.priority.critical,
    fontWeight: "600",
  },
  filterIconActive: { position: "relative" },
  filterDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
    backgroundColor: COLORS.background,
    flexGrow: 1,
  },
  listHeader: { marginBottom: 16 },
  foundText: { fontSize: 15, color: COLORS.text.secondary, fontWeight: "500" },
  paginationText: { fontSize: 12, color: COLORS.text.muted, marginTop: 4 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    marginBottom: 12,
    flexDirection: "row",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  cardBar: { width: 4, borderTopLeftRadius: 14, borderBottomLeftRadius: 14 },
  cardContent: { flex: 1, padding: 16 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  idContainer: { flexDirection: "row", alignItems: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  idText: { fontSize: 16, fontWeight: "bold", color: COLORS.text.primary },
  priorityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  priorityText: { color: "white", fontSize: 11, fontWeight: "bold" },
  dateTime: { fontSize: 12, color: COLORS.text.muted, marginBottom: 8 },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text.primary,
    marginBottom: 10,
  },
  detailRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  detailIcon: { marginRight: 8 },
  detailText: { fontSize: 14, color: COLORS.text.secondary, flex: 1 },
  fab: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.accent,
    justifyContent: "center",
    alignItems: "center",
    bottom: 120,
    right: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
    }),
  },
  footerLoader: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
  },
  footerLoaderText: {
    marginLeft: 10,
    color: COLORS.text.secondary,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.text.primary,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginTop: 8,
    textAlign: "center",
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },
  searchCancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  searchCancelText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
  rejectText: {
    color: "red",
    fontWeight: "600",
    marginBottom: 4,
    backgroundColor: "rgba(220, 38, 38, 0.1)",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  floatingActionBar: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "rgba(26, 35, 126, 0.95)",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  actionBarLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionBarCountText: {
    color: "white",
    fontSize: 15,
    fontWeight: "bold",
  },
  actionBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionBarButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  shareActionButton: {
    backgroundColor: COLORS.accent,
  },
  actionBarButtonDisabled: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    opacity: 0.5,
  },
  cancelActionButton: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  actionBarButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
  },
  actionBarButtonTextCancel: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },
  checkboxContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: 16,
  },
  cardSelected: {
    backgroundColor: "#F0FDFA",
    borderColor: COLORS.accent,
    borderWidth: 1,
  },
  selectionHeaderContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  selectionHeaderClose: {
    padding: 4,
  },
  selectionHeaderTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  selectAllHeaderButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 8,
  },
  selectAllHeaderText: {
    color: "white",
    fontSize: 13,
    fontWeight: "600",
  },
});

export default IncidentsScreen;

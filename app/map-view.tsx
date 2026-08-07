import { getComplaintStats, getIncidentById, getIncidentMarkers, getIncidentStats, getQueryStats, getRequestStats, IncidentMapMarker } from "@/src/api/incidents";
import { useAuth } from "@/src/context/AuthContext";
import usePermissions from "@/src/hooks/usePermissions";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  I18nManager,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

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
  error: "#DC2626",
};

const MapViewScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    type, state_id, priority, severity, assignee_id, department_id,
    classification_ids, location_ids, source, start_date, end_date, search,
  } = useLocalSearchParams<{
    type?: string; state_id?: string; priority?: string; severity?: string;
    assignee_id?: string; department_id?: string; classification_ids?: string;
    location_ids?: string; source?: string; start_date?: string; end_date?: string;
    search?: string;
  }>();
  const recordType = type || "incident";
  const webViewRef = useRef<WebView>(null);
  const insets = useSafeAreaInsets();

  const [markers, setMarkers] = useState<IncidentMapMarker[]>([]);
  const [totalMatching, setTotalMatching] = useState(0);
  const [capped, setCapped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  // Detail sheet shown when a marker is tapped — fetched on demand, never
  // pre-loaded, so the bulk marker payload stays tiny.
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);

  const { canViewAllIncidents, canViewAllRequests, canViewAllComplaints, canViewAllQueries } = usePermissions();
  const { user } = useAuth();

  const mapHTML = useMemo(() => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
  <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>

  <style>
    body { margin: 0; padding: 0; }
    #map { width: 100%; height: 100vh; }
    .custom-marker {
      width: 26px;
      height: 26px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 2px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .custom-marker::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 8px;
      height: 8px;
      background: white;
      border-radius: 50%;
      transform: translate(-50%, -50%);
    }
    .marker-cluster-small { background-color: rgba(46, 196, 182, 0.6); }
    .marker-cluster-small div { background-color: rgba(46, 196, 182, 0.9); color: white; font-weight: bold; }
    .marker-cluster-medium { background-color: rgba(46, 196, 182, 0.6); }
    .marker-cluster-medium div { background-color: rgba(46, 196, 182, 0.9); color: white; font-weight: bold; }
    .marker-cluster-large { background-color: rgba(46, 196, 182, 0.6); }
    .marker-cluster-large div { background-color: rgba(46, 196, 182, 0.9); color: white; font-weight: bold; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const map = L.map('map', { preferCanvas: true }).setView([24.7136, 46.6753], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    // chunkedLoading spreads adding thousands of markers across animation
    // frames instead of blocking the JS thread in one long synchronous call.
    const markerClusterGroup = L.markerClusterGroup({
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      chunkedLoading: true,
      chunkProgress: function (processed, total, elapsed) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'markersProgress',
          processed: processed,
          total: total,
        }));
      }
    });
    map.addLayer(markerClusterGroup);

    window.updateMarkers = function(markerData) {
      markerClusterGroup.clearLayers();

      if (!markerData || markerData.length === 0) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'markersRendered' }));
        return;
      }

      const newMarkers = markerData.map(function (m) {
        const markerHtml = '<div class="custom-marker" style="background-color: ' + (m.color || '#2EC4B6') + ';"></div>';
        const icon = L.divIcon({
          html: markerHtml,
          className: 'custom-div-icon',
          iconSize: [26, 26],
          iconAnchor: [13, 26],
        });
        const marker = L.marker([m.lat, m.lng], { icon: icon });
        marker.on('click', function () {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'markerClicked', id: m.id }));
        });
        return marker;
      });

      markerClusterGroup.on('chunkend', function onChunkEnd() {
        markerClusterGroup.off('chunkend', onChunkEnd);
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'markersRendered' }));
        map.fitBounds(markerClusterGroup.getBounds().pad(0.1));
      });

      markerClusterGroup.addLayers(newMarkers);
    };

    map.whenReady(function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));
    });
  </script>
</body>
</html>
`
    , []);

  useEffect(() => {
    fetchMarkers();
  }, []);

  useEffect(() => {
    if (mapReady) {
      updateMapMarkers(markers);
    }
  }, [mapReady, markers]);

  const buildFilterParams = () => {
    const params: Record<string, any> = {};
    if (state_id) params.current_state_id = state_id.split(',');
    if (priority) params.priority = priority.split(',').map(p => parseInt(p));
    if (severity) params.severity = severity.split(',').map(s => parseInt(s));
    if (assignee_id) params.assignee_id = assignee_id.split(',');
    if (department_id) params.department_id = department_id.split(',');
    if (classification_ids) params.classification_id = classification_ids.split(',');
    if (location_ids) params.location_id = location_ids.split(',');
    if (source) params.source = source.split(',');
    if (start_date) params.start_date = start_date;
    if (end_date) params.end_date = end_date;
    if (search && search.trim().length >= 3) params.search = search.trim();
    return params;
  };

  const fetchMarkers = async () => {
    setLoading(true);
    try {
      const statsFunction = recordType === "request" ? getRequestStats :
        recordType === "complaint" ? getComplaintStats :
          recordType === "query" ? getQueryStats : getIncidentStats;

      let filterParams = buildFilterParams();
      filterParams.record_type = recordType;

      // Handle default states if no state_id is provided — matches the same
      // default-state behavior as the list tabs, for consistency.
      if (!filterParams.current_state_id || filterParams.current_state_id.length === 0) {
        const statsResponse = await statsFunction();
        if (statsResponse.success) {
          filterParams.current_state_id = statsResponse.data.workflow_stats?.[0].by_state_details?.map((s: any) => s.id) || [];
        }
      }

      const isViewerApp = process.env.EXPO_PUBLIC_VIEWER_APP === "true";
      const viewerRoles = process.env.EXPO_PUBLIC_VIEWER_APP_ROLES?.split(",") || [];
      const isViewerRole = user?.roles?.some(role => viewerRoles.includes(role.code)) ?? false;
      const isViewerMode = isViewerApp && isViewerRole;

      if (!canViewAllIncidents() && recordType === 'incident' && !isViewerMode) {
        filterParams.my_record = user?.id;
      }
      if (!canViewAllRequests() && recordType === 'request') {
        filterParams.my_record = user?.id;
      }
      if (!canViewAllComplaints() && recordType === 'complaint') {
        filterParams.my_record = user?.id;
      }
      if (!canViewAllQueries() && recordType === 'query') {
        filterParams.my_record = user?.id;
      }

      const response = await getIncidentMarkers(filterParams);
      if (response.success) {
        setMarkers(response.data);
        setTotalMatching(response.totalMatching);
        setCapped(response.capped);
      }
    } catch (error) {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const updateMapMarkers = (markerList: IncidentMapMarker[]) => {
    const markersData = markerList.map((m) => ({
      id: m.id,
      lat: m.latitude,
      lng: m.longitude,
      color: m.state_color || COLORS.accent,
    }));

    const markersJson = JSON.stringify(markersData);
    webViewRef.current?.injectJavaScript(`
      updateMarkers(${markersJson});
      true;
    `);
  };

  const mapSource = useMemo(() => ({ html: mapHTML, baseUrl: 'https://localhost/' }), [mapHTML]);

  const openMarkerDetail = async (id: string) => {
    setDetailVisible(true);
    setDetailLoading(true);
    setDetailError(null);
    setSelectedIncident(null);
    try {
      const res = await getIncidentById(id);
      if (res.success) {
        setSelectedIncident(res.data);
      } else {
        setDetailError(res.error || t('common.error'));
      }
    } catch (err: any) {
      setDetailError(err.message || t('common.error'));
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailVisible(false);
    setSelectedIncident(null);
    setDetailError(null);
  };

  const viewFullDetails = () => {
    if (!selectedIncident) return;
    const detailsPage =
      recordType === "request" ? "/request-details" :
        recordType === "complaint" ? "/complaint-details" :
          recordType === "query" ? "/query-details" : "/incident-details";
    closeDetail();
    router.push(`${detailsPage}?id=${selectedIncident.id}`);
  };

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === "mapReady") {
        setMapReady(true);
      } else if (data.type === "markerClicked") {
        openMarkerDetail(data.id);
      }
      // 'markersProgress' / 'markersRendered' are informational only — the
      // WebView already shows its own render state, nothing to mirror here.
    } catch (error) {
      console.error("❌ [MapView OSM] Error handling message:", error);
    }
  };

  const selectedPriorityName = selectedIncident?.lookup_values?.find(
    (x: any) => x.category?.code === 'PRIORITY',
  );
  const selectedStateName = I18nManager.isRTL && selectedIncident?.current_state?.name_ar
    ? selectedIncident.current_state.name_ar
    : selectedIncident?.current_state?.name;

  return (
    <View style={[styles.container]} >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name={t('common.icons.arrowBack') as any} size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {recordType === "request"
            ? t("map.requests", "Requests Map")
            : recordType === "complaint"
              ? t("map.complaints", "Complaints Map")
              : recordType === "query"
                ? t("map.queries", "Queries Map")
                : t("map.incidents", "Incidents Map")}
        </Text>
        <TouchableOpacity
          onPress={fetchMarkers}
          style={styles.refreshButton}
        >
          <Ionicons name="refresh" size={24} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {loading && !mapReady ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t("common.loading")}</Text>
        </View>
      ) : (
        <>
          <WebView
            ref={webViewRef}
            source={mapSource}
            style={styles.map}
            onMessage={handleMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={false}
            originWhitelist={['*']}
            mixedContentMode="compatibility"
          />

          {/* Info Badge */}
          <View style={[styles.infoBadge, { right: I18nManager.isRTL ? "auto" : 16, left: I18nManager.isRTL ? 16 : "auto" }]}>
            <Ionicons name="location" size={20} color={COLORS.accent} />
            <Text style={styles.infoBadgeText}>
              {markers.length}{capped ? `/${totalMatching}` : ""}{" "}
              {recordType === "request"
                ? t("map.requestsOnMap", "requests on map")
                : recordType === "complaint"
                  ? t("map.complaintsOnMap", "complaints on map")
                  : recordType === "query"
                    ? t("map.queriesOnMap", "queries on map")
                    : t("map.incidentsOnMap", "incidents on map")}
            </Text>
          </View>

          {/* Capped notice — never silently drop markers without saying so */}
          {capped && (
            <View style={[styles.cappedBadge, { right: I18nManager.isRTL ? "auto" : 16, left: I18nManager.isRTL ? 16 : "auto" }]}>
              <Ionicons name="information-circle" size={16} color={COLORS.white} />
              <Text style={styles.cappedBadgeText}>
                {t('map.cappedNotice', 'Showing first {{shown}} of {{total}} — narrow your filters to see the rest', {
                  shown: markers.length,
                  total: totalMatching,
                })}
              </Text>
            </View>
          )}

          {/* Loading overlay for refresh */}
          {loading && mapReady && (
            <View style={styles.refreshOverlay}>
              <ActivityIndicator size="small" color={COLORS.white} />
            </View>
          )}
        </>
      )}

      {/* Marker detail sheet — fetched on demand when a marker is tapped */}
      <Modal
        visible={detailVisible}
        transparent
        animationType="slide"
        onRequestClose={closeDetail}
      >
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={closeDetail}>
          <TouchableOpacity activeOpacity={1} style={[styles.sheet, { paddingBottom: insets.bottom || 16 }]}>
            {detailLoading ? (
              <View style={styles.sheetLoading}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.loadingText}>{t('common.loading')}</Text>
              </View>
            ) : detailError ? (
              <View style={styles.sheetLoading}>
                <Text style={styles.sheetError}>{detailError}</Text>
              </View>
            ) : selectedIncident ? (
              <>
                <Text style={styles.sheetNumber}>{selectedIncident.incident_number}</Text>
                <Text style={styles.sheetTitle} numberOfLines={2}>{selectedIncident.title}</Text>
                <View style={styles.sheetRow}>
                  <Text style={styles.sheetLabel}>{t('incidents.status')}</Text>
                  <Text style={styles.sheetValue}>{selectedStateName || t('common.unknown')}</Text>
                </View>
                <View style={styles.sheetRow}>
                  <Text style={styles.sheetLabel}>{t('incidents.priority')}</Text>
                  <Text style={styles.sheetValue}>
                    {(I18nManager.isRTL ? selectedPriorityName?.name_ar : selectedPriorityName?.name) || t('common.unknown')}
                  </Text>
                </View>
                <TouchableOpacity style={styles.viewDetailsButton} onPress={viewFullDetails}>
                  <Text style={styles.viewDetailsButtonText}>{t('common.viewDetails')}</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "bold",
    flex: 1,
    textAlign: "center",
  },
  refreshButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.text.secondary,
    fontSize: 14,
  },
  map: {
    flex: 1,
  },
  infoBadge: {
    position: "absolute",
    top: 115,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    gap: 6,
  },
  infoBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.text.primary,
    textAlign: "left"
  },
  cappedBadge: {
    position: "absolute",
    top: 160,
    maxWidth: "70%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(26, 35, 126, 0.92)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    gap: 6,
  },
  cappedBadgeText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "500",
    color: COLORS.white,
  },
  refreshOverlay: {
    position: "absolute",
    top: 190,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: 160,
  },
  sheetLoading: {
    minHeight: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetError: {
    color: COLORS.error,
    fontSize: 14,
    textAlign: "center",
  },
  sheetNumber: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text.primary,
    marginBottom: 12,
  },
  sheetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF0F4",
  },
  sheetLabel: {
    fontSize: 13,
    color: COLORS.text.secondary,
  },
  sheetValue: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text.primary,
  },
  viewDetailsButton: {
    marginTop: 16,
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  viewDetailsButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "700",
  },
});

export default MapViewScreen;

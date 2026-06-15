import { getComplaints, getComplaintStats, getIncidents, getIncidentStats, getQueries, getQueryStats, getRequests, getRequestStats } from "@/src/api/incidents";
import { useAuth } from "@/src/context/AuthContext";
import usePermissions from "@/src/hooks/usePermissions";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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

interface IncidentMarker {
  id: string;
  incident_number: string;
  title: string;
  latitude: number;
  longitude: number;
  priority?: number;
  current_state?: { name: string };
  lookup_values?: any[];
}

const MAP_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body { margin: 0; padding: 0; }
    #map { width: 100%; height: 100vh; }
    .custom-marker {
      width: 30px;
      height: 30px;
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
      width: 10px;
      height: 10px;
      background: white;
      border-radius: 50%;
      transform: translate(-50%, -50%);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const map = L.map('map').setView([24.7136, 46.6753], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    let markers = [];

    window.updateMarkers = function(incidentsData) {
      markers.forEach(marker => map.removeLayer(marker));
      markers = [];

      if (!incidentsData || incidentsData.length === 0) {
        return;
      }

      incidentsData.forEach(incident => {
        const priorityLookup = incident?.lookup_values?.find(x => x.category && x.category.code === 'PRIORITY');
        const p = priorityLookup?.name || 'N/A';
        const color = priorityLookup?.color || '#2EC4B6';
        const markerHtml = '<div class="custom-marker" style="background-color: ' + color + ';"></div>';
        const customIcon = L.divIcon({
          html: markerHtml,
          className: 'custom-div-icon',
          iconSize: [30, 30],
          iconAnchor: [15, 30],
          popupAnchor: [0, -30]
        });

        const marker = L.marker([incident.lat, incident.lng], { icon: customIcon })
          .addTo(map)
          .bindPopup(\`
            <div style="min-width: 200px;">
              <strong style="color: #1A237E; font-size: 14px;">\${incident.number}</strong><br/>
              <span style="font-size: 13px; font-weight: 600;">\${incident.title}</span><br/>
              <span style="font-size: 12px; color: #64748B;">Status: \${incident.state}</span><br/>
              <span style="font-size: 12px; color: #64748B;">Priority: \${p}</span><br/>
              <button onclick="handleMarkerClick('\${incident.id}')" style="
                margin-top: 8px;
                padding: 6px 12px;
                background: #2EC4B6;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 600;
              ">View Details</button>
            </div>
          \`);

        markers.push(marker);
      });

      if (markers.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
      }
    };

    window.handleMarkerClick = function(incidentId) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'markerClicked',
        id: incidentId
      }));
    };

    map.whenReady(function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'mapReady'
      }));
    });
  </script>
</body>
</html>
`;

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

  const [incidents, setIncidents] = useState<IncidentMarker[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const { canViewAllIncidents, canViewAllRequests, canViewAllComplaints, canViewAllQueries } = usePermissions();
  const { user } = useAuth();

  useEffect(() => {
    fetchIncidentsWithLocation();
  }, []);

  useEffect(() => {
    if (mapReady && incidents.length > 0) {
      updateMapMarkers(incidents);
    }
  }, [mapReady, incidents]);

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

  const fetchIncidentsWithLocation = async () => {
    setLoading(true);
    try {
      const fetchFunction = recordType === "request" ? getRequests :
        recordType === "complaint" ? getComplaints :
          recordType === "query" ? getQueries : getIncidents;

      const statsFunction = recordType === "request" ? getRequestStats :
        recordType === "complaint" ? getComplaintStats :
          recordType === "query" ? getQueryStats : getIncidentStats;

      let filterParams = buildFilterParams();

      // Handle default states if no state_id is provided
      if (!filterParams.current_state_id || filterParams.current_state_id.length === 0) {
        const statsResponse = await statsFunction();
        if (statsResponse.success) {
          filterParams.current_state_id = statsResponse.data.workflow_stats[0].by_state_details?.map((s: any) => s.id) || []
        }
      }

      if (!canViewAllIncidents() && recordType === 'incident') {
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

      // First fetch to get total count
      const countResponse = await fetchFunction({ page: 1, limit: 1, ...filterParams });
      const total = countResponse.success ? (countResponse.pagination?.total_items ?? 0) : 0;
      setTotalCount(total);

      // Backend caps limit at 100, so fetch all pages and aggregate
      const PAGE_SIZE = 100;
      const totalPages = Math.ceil(total / PAGE_SIZE);

      const allData: any[] = [];
      for (let page = 1; page <= totalPages; page++) {
        const response = await fetchFunction({
          page,
          limit: PAGE_SIZE,
          ...filterParams,
        });
        if (response.success && response.data) {
          allData.push(...response.data);
        }
      }

      const incidentsWithLocation = allData.filter(
        (inc: any) =>
          inc.latitude !== null &&
          inc.latitude !== undefined &&
          inc.longitude !== null &&
          inc.longitude !== undefined &&
          !isNaN(inc.latitude) &&
          !isNaN(inc.longitude),
      );
      setIncidents(incidentsWithLocation);
    } catch (error) {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const updateMapMarkers = (incidentList: IncidentMarker[]) => {
    const markersData = incidentList.map((inc) => ({
      id: inc.id,
      lat: parseFloat(String(inc.latitude)),
      lng: parseFloat(String(inc.longitude)),
      title: inc.title,
      number: inc.incident_number,
      priority: inc.priority || 0,
      state: inc.current_state?.name || "N/A",
      lookup_values: inc.lookup_values,
    }));

    const markersJson = JSON.stringify(markersData);
    webViewRef.current?.injectJavaScript(`
      updateMarkers(${markersJson});
      true;
    `);
  };

  const mapSource = useMemo(() => ({ html: MAP_HTML, baseUrl: 'https://localhost/' }), []);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === "mapReady") {
        setMapReady(true);
      } else if (data.type === "markerClicked") {
        const detailsPage =
          recordType === "request" ? "/request-details" :
            recordType === "complaint" ? "/complaint-details" :
              recordType === "query" ? "/query-details" : "/incident-details";
        router.push(`${detailsPage}?id=${data.id}`);
      }
    } catch (error) {
      console.error("❌ [MapView OSM] Error handling message:", error);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
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
          onPress={fetchIncidentsWithLocation}
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
          <View style={styles.infoBadge}>
            <Ionicons name="location" size={20} color={COLORS.accent} />
            <Text style={styles.infoBadgeText}>
              {incidents.length}{totalCount > incidents.length ? `/${totalCount}` : ""}{" "}
              {recordType === "request"
                ? t("map.requestsOnMap", "requests on map")
                : recordType === "complaint"
                  ? t("map.complaintsOnMap", "complaints on map")
                  : recordType === "query"
                    ? t("map.queriesOnMap", "queries on map")
                    : t("map.incidentsOnMap", "incidents on map")}
            </Text>
          </View>

          {/* Loading overlay for refresh */}
          {loading && mapReady && (
            <View style={styles.refreshOverlay}>
              <ActivityIndicator size="small" color={COLORS.white} />
            </View>
          )}
        </>
      )}
    </SafeAreaView>
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
    top: 100,
    right: 16,
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
});

export default MapViewScreen;

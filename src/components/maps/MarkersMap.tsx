import { IncidentMapMarker } from "@/src/api/incidents";
import { useMapProvider } from "@/src/utils/mapProvider";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import Supercluster from "supercluster";
import { WebView } from "react-native-webview";
import { MapFallbackNotice } from "./MapFallbackNotice";
import { MapZoomControls } from "./MapZoomControls";
import { NativeGoogleMap } from "./NativeGoogleMap";

interface MarkersMapProps {
  markers: IncidentMapMarker[];
  defaultColor: string;
  onMarkerPress: (id: string) => void;
  /** Fired once the map itself has loaded (not necessarily the markers). */
  onReady?: () => void;
}

const DEFAULT_REGION: Region = {
  latitude: 24.7136,
  longitude: 46.6753,
  latitudeDelta: 12,
  longitudeDelta: 12,
};

const OSM_HTML = `
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

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
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
`;

// ── Google (native) ──────────────────────────────────────────────────────────

interface PointProps {
  id: string;
  color: string;
}

// Shape of the properties supercluster adds to the clusters it returns.
interface ClusterProps {
  cluster: true;
  cluster_id: number;
  point_count: number;
}

const regionToZoom = (region: Region) =>
  Math.min(
    20,
    Math.max(0, Math.round(Math.log2(360 / Math.max(region.longitudeDelta, 1e-6)))),
  );

const regionToBbox = (region: Region): [number, number, number, number] => [
  Math.max(-180, region.longitude - region.longitudeDelta / 2),
  Math.max(-90, region.latitude - region.latitudeDelta / 2),
  Math.min(180, region.longitude + region.longitudeDelta / 2),
  Math.min(90, region.latitude + region.latitudeDelta / 2),
];

// Custom-view markers are rasterised once; tracking view changes forever makes
// the map janky with many markers, so stop after the first frames.
const PinMarker = memo(function PinMarker({
  id,
  latitude,
  longitude,
  color,
  count,
  onPress,
}: {
  id: string;
  latitude: number;
  longitude: number;
  color: string;
  count?: number;
  onPress: () => void;
}) {
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setTracks(false), 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Marker
      identifier={id}
      coordinate={{ latitude, longitude }}
      onPress={onPress}
      tracksViewChanges={tracks}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      {count ? (
        <View style={styles.cluster}>
          <Text style={styles.clusterText}>{count}</Text>
        </View>
      ) : (
        <View style={[styles.pin, { backgroundColor: color }]} />
      )}
    </Marker>
  );
});

function GoogleMarkersMap({ markers, defaultColor, onMarkerPress, onReady }: MarkersMapProps) {
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  // The map's real zoom level. Deriving it from the region's longitudeDelta
  // ignores the screen width and is ~0.6 of a level off, which made clusters
  // look like they were already expanded.
  const [zoom, setZoom] = useState<number | null>(null);
  const fittedRef = useRef(false);

  const index = useMemo(() => {
    const sc = new Supercluster<PointProps>({ radius: 60, maxZoom: 17 });
    sc.load(
      markers.map((m) => ({
        type: "Feature" as const,
        properties: { id: m.id, color: m.state_color || defaultColor },
        geometry: {
          type: "Point" as const,
          coordinates: [m.longitude, m.latitude],
        },
      })),
    );
    return sc;
  }, [markers, defaultColor]);

  const clusters = useMemo(
    () => index.getClusters(regionToBbox(region), zoom ?? regionToZoom(region)),
    [index, region, zoom],
  );

  // Show everything once the markers arrive (same as the OSM map's fitBounds).
  const fitAll = useCallback(() => {
    if (markers.length === 0) return;
    mapRef.current?.fitToCoordinates(
      markers.map((m) => ({ latitude: m.latitude, longitude: m.longitude })),
      { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: false },
    );
  }, [markers]);

  useEffect(() => {
    fittedRef.current = false;
  }, [markers]);

  const handleMapLoaded = () => {
    onReady?.();
    if (!fittedRef.current) {
      fittedRef.current = true;
      fitAll();
    }
  };

  // Markers can arrive after the map has already loaded.
  useEffect(() => {
    if (!fittedRef.current && markers.length > 0) {
      fittedRef.current = true;
      fitAll();
    }
  }, [markers, fitAll]);

  const handleRegionChangeComplete = useCallback(async (next: Region) => {
    setRegion(next);
    try {
      const camera = await mapRef.current?.getCamera();
      if (camera?.zoom != null) setZoom(Math.floor(camera.zoom));
    } catch {
      // keep the estimate derived from the region
    }
  }, []);

  // Zoom to fit everything inside the tapped cluster (like Leaflet's
  // zoomToBoundsOnClick). A cluster whose points share one location can't be
  // fitted, so just zoom in close on it.
  const handleClusterPress = (clusterId: number, latitude: number, longitude: number) => {
    const leaves = index.getLeaves(clusterId, Infinity);
    const coordinates = leaves.map((leaf) => ({
      latitude: leaf.geometry.coordinates[1],
      longitude: leaf.geometry.coordinates[0],
    }));
    const spread = coordinates.some(
      (c) => Math.abs(c.latitude - latitude) > 1e-5 || Math.abs(c.longitude - longitude) > 1e-5,
    );
    if (spread) {
      mapRef.current?.fitToCoordinates(coordinates, {
        edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
        animated: true,
      });
    } else {
      mapRef.current?.animateCamera({ center: { latitude, longitude }, zoom: 18 }, { duration: 300 });
    }
  };

  return (
    <View style={styles.map}>
    <NativeGoogleMap
      ref={mapRef}
      style={styles.map}
      initialRegion={DEFAULT_REGION}
      onMapLoaded={handleMapLoaded}
      onRegionChangeComplete={handleRegionChangeComplete}
      toolbarEnabled={false}
      zoomControlEnabled={false}
    >
      {clusters.map((feature) => {
        const [longitude, latitude] = feature.geometry.coordinates;
        const props = feature.properties as PointProps | ClusterProps;
        if ("cluster" in props && props.cluster) {
          return (
            <PinMarker
              key={`c-${props.cluster_id}-${props.point_count}`}
              id={`c-${props.cluster_id}`}
              latitude={latitude}
              longitude={longitude}
              color={defaultColor}
              count={props.point_count}
              onPress={() => handleClusterPress(props.cluster_id, latitude, longitude)}
            />
          );
        }
        const point = props as PointProps;
        return (
          <PinMarker
            key={point.id}
            id={point.id}
            latitude={latitude}
            longitude={longitude}
            color={point.color}
            onPress={() => onMarkerPress(point.id)}
          />
        );
      })}
    </NativeGoogleMap>
    <MapZoomControls mapRef={mapRef} />
    </View>
  );
}

// ── OSM (Leaflet in a WebView) ───────────────────────────────────────────────

function OsmMarkersMap({
  markers,
  defaultColor,
  onMarkerPress,
  onReady,
  googleError,
}: MarkersMapProps & { googleError: string | null }) {
  const webViewRef = useRef<WebView>(null);
  const [mapReady, setMapReady] = useState(false);
  const source = useMemo(() => ({ html: OSM_HTML, baseUrl: "https://localhost/" }), []);

  useEffect(() => {
    if (!mapReady) return;
    const data = markers.map((m) => ({
      id: m.id,
      lat: m.latitude,
      lng: m.longitude,
      color: m.state_color || defaultColor,
    }));
    webViewRef.current?.injectJavaScript(`
      updateMarkers(${JSON.stringify(data)});
      true;
    `);
  }, [mapReady, markers, defaultColor]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === "mapReady") {
        setMapReady(true);
        onReady?.();
      } else if (data.type === "markerClicked") {
        onMarkerPress(data.id);
      }
      // 'markersProgress' / 'markersRendered' are informational only — the
      // WebView already shows its own render state, nothing to mirror here.
    } catch (error) {
      console.error("❌ [MapView OSM] Error handling message:", error);
    }
  };

  return (
    <>
      <WebView
        ref={webViewRef}
        source={source}
        style={styles.map}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        originWhitelist={["*"]}
        mixedContentMode="compatibility"
      />
      <MapFallbackNotice reason={googleError} />
    </>
  );
}

/**
 * Map with many clustered, state-coloured markers (the incidents/requests/
 * complaints/queries map screen). Native Google Maps (clustered with
 * supercluster) when a key is configured, otherwise Leaflet + OSM.
 */
export function MarkersMap(props: MarkersMapProps) {
  const { provider, googleError } = useMapProvider();
  if (provider === "google") return <GoogleMarkersMap {...props} />;
  return <OsmMarkersMap {...props} googleError={googleError} />;
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  pin: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
  },
  cluster: {
    minWidth: 38,
    height: 38,
    paddingHorizontal: 6,
    borderRadius: 19,
    backgroundColor: "rgba(46, 196, 182, 0.92)",
    borderWidth: 3,
    borderColor: "rgba(46, 196, 182, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  clusterText: { color: "#FFFFFF", fontWeight: "bold", fontSize: 13 },
});

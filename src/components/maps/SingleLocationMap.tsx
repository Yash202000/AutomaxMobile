import React, { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { StyleSheet } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { WebView } from "react-native-webview";
import { useMapProvider } from "@/src/utils/mapProvider";
import { MapFallbackNotice } from "./MapFallbackNotice";
import { NativeGoogleMap } from "./NativeGoogleMap";

export interface SingleLocationMapHandle {
  zoomIn: () => void;
  zoomOut: () => void;
}

interface SingleLocationMapProps {
  latitude: number;
  longitude: number;
  title: string;
  address: string;
  markerColor: string;
}

const INITIAL_ZOOM = 15;
const MIN_ZOOM = 1;
const MAX_ZOOM = 19;

// Embeds untrusted strings in the page's <script> safely.
const toJsLiteral = (value: unknown) =>
  JSON.stringify(value).replace(/</g, "\\u003c");

const buildOsmHtml = ({
  latitude,
  longitude,
  title,
  address,
  markerColor,
}: SingleLocationMapProps) => `
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
      background-color: ${markerColor};
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
    const lat = ${Number(latitude)};
    const lng = ${Number(longitude)};
    const map = L.map('map').setView([lat, lng], ${INITIAL_ZOOM});

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    const customIcon = L.divIcon({
      html: '<div class="custom-marker"></div>',
      className: 'custom-div-icon',
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -30]
    });

    const popup = document.createElement('div');
    popup.style.minWidth = '150px';
    const heading = document.createElement('strong');
    heading.style.fontSize = '13px';
    heading.textContent = ${toJsLiteral(title)};
    const sub = document.createElement('span');
    sub.style.fontSize = '11px';
    sub.style.color = '#64748B';
    sub.textContent = ${toJsLiteral(address)};
    popup.appendChild(heading);
    popup.appendChild(document.createElement('br'));
    popup.appendChild(sub);

    L.marker([lat, lng], { icon: customIcon }).addTo(map).bindPopup(popup);

    map.whenReady(function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));
    });
  </script>
</body>
</html>
`;

/**
 * Read-only map with one marker, used by the incident/query detail screens.
 * Native Google Maps when a key is configured, otherwise Leaflet + OSM in a
 * WebView. Zoom is driven by the parent through the imperative handle.
 */
export const SingleLocationMap = forwardRef<
  SingleLocationMapHandle,
  SingleLocationMapProps
>(function SingleLocationMap(props, ref) {
  const { latitude, longitude, title, address, markerColor } = props;
  const { provider, googleError } = useMapProvider();
  const webViewRef = useRef<WebView>(null);
  const mapRef = useRef<MapView>(null);
  const zoomRef = useRef(INITIAL_ZOOM);

  const html = useMemo(
    () => buildOsmHtml({ latitude, longitude, title, address, markerColor }),
    [latitude, longitude, title, address, markerColor],
  );
  const source = useMemo(() => ({ html, baseUrl: "https://localhost/" }), [html]);

  useImperativeHandle(ref, () => {
    const zoomTo = async (delta: number) => {
      if (provider === "google") {
        const camera = await mapRef.current?.getCamera();
        if (!camera) return;
        const next = Math.min(Math.max((camera.zoom ?? INITIAL_ZOOM) + delta, MIN_ZOOM), MAX_ZOOM);
        mapRef.current?.animateCamera({ zoom: next }, { duration: 200 });
        return;
      }
      zoomRef.current = Math.min(Math.max(zoomRef.current + delta, MIN_ZOOM), MAX_ZOOM);
      webViewRef.current?.injectJavaScript(`map.setZoom(${zoomRef.current}); true;`);
    };
    return { zoomIn: () => zoomTo(1), zoomOut: () => zoomTo(-1) };
  }, [provider]);

  if (provider === "google") {
    return (
      <NativeGoogleMap
        ref={mapRef}
        style={styles.map}
        initialCamera={{
          center: { latitude, longitude },
          zoom: INITIAL_ZOOM,
          heading: 0,
          pitch: 0,
        }}
        zoomControlEnabled={false}
        toolbarEnabled={false}
        mapType="standard"
      >
        <Marker
          coordinate={{ latitude, longitude }}
          pinColor={markerColor}
          title={title}
          description={address}
        />
      </NativeGoogleMap>
    );
  }

  return (
    <>
      <WebView
        ref={webViewRef}
        source={source}
        style={styles.map}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        originWhitelist={["*"]}
        mixedContentMode="compatibility"
      />
      <MapFallbackNotice reason={googleError} />
    </>
  );
});

const styles = StyleSheet.create({
  map: { width: "100%", height: "100%" },
});

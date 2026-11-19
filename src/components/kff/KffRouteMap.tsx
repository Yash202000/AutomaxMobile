import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

import { KFF_COLORS } from './kffTheme';

// KFF Dispatcher incident map: Leaflet + OpenStreetMap in a WebView (no Google
// Maps). Shows the incident (red pin) and, once known, the unit's current
// position (blue dot) with a dashed line between them, framed to fit both.

export interface KffRouteMapHandle {
  zoomIn: () => void;
  zoomOut: () => void;
}

interface KffRouteMapProps {
  destination: { latitude: number; longitude: number; title: string; address: string };
  current?: { latitude: number; longitude: number; label: string } | null;
  /** Lets the map take touches (full-screen view); the preview stays static. */
  interactive?: boolean;
}

const toJs = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

const buildHtml = (destination: KffRouteMapProps['destination'], interactive: boolean) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; }
    .pin { width: 28px; height: 28px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg);
      background: ${KFF_COLORS.danger}; border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,.3); }
    .pin::after { content: ''; position: absolute; top: 50%; left: 50%; width: 9px; height: 9px;
      background: #fff; border-radius: 50%; transform: translate(-50%, -50%); }
    .me { width: 18px; height: 18px; border-radius: 50%; background: ${KFF_COLORS.primary};
      border: 3px solid #fff; box-shadow: 0 0 0 6px rgba(77,119,255,.25); }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const dest = [${Number(destination.latitude)}, ${Number(destination.longitude)}];
    const map = L.map('map', {
      zoomControl: false,
      attributionControl: true,
      dragging: ${interactive},
      touchZoom: ${interactive},
      doubleClickZoom: ${interactive},
      scrollWheelZoom: false,
    }).setView(dest, 15);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 19
    }).addTo(map);

    const popup = (title, sub) => {
      const box = document.createElement('div');
      const h = document.createElement('strong'); h.textContent = title; box.appendChild(h);
      if (sub) { box.appendChild(document.createElement('br'));
        const s = document.createElement('span'); s.style.color = '#64748B'; s.textContent = sub; box.appendChild(s); }
      return box;
    };

    L.marker(dest, { icon: L.divIcon({ html: '<div class="pin"></div>', className: '', iconSize: [28, 28], iconAnchor: [14, 28] }) })
      .addTo(map).bindPopup(popup(${toJs(destination.title)}, ${toJs(destination.address)}));

    let me = null, line = null;
    window.setCurrent = function (lat, lng, label) {
      const pos = [lat, lng];
      if (me) { me.setLatLng(pos); me.setPopupContent(popup(label, '')); }
      else me = L.marker(pos, { icon: L.divIcon({ html: '<div class="me"></div>', className: '', iconSize: [18, 18], iconAnchor: [9, 9] }) })
        .addTo(map).bindPopup(popup(label, ''));
      if (line) line.setLatLngs([pos, dest]);
      else line = L.polyline([pos, dest], { color: '${KFF_COLORS.primary}', weight: 3, dashArray: '6 8' }).addTo(map);
      map.fitBounds(L.latLngBounds([pos, dest]), { padding: [40, 40], maxZoom: 16 });
    };

    map.whenReady(function () {
      window.ReactNativeWebView.postMessage('ready');
    });
  </script>
</body>
</html>
`;

const KffRouteMap = forwardRef<KffRouteMapHandle, KffRouteMapProps>(
  ({ destination, current, interactive = false }, ref) => {
    const webViewRef = useRef<WebView>(null);
    const [ready, setReady] = useState(false);

    const { latitude, longitude, title, address } = destination;
    const html = useMemo(
      () => buildHtml({ latitude, longitude, title, address }, interactive),
      [latitude, longitude, title, address, interactive],
    );

    // A new page means the current-location marker must be sent again.
    useEffect(() => setReady(false), [html]);

    useEffect(() => {
      if (!ready || !current) return;
      webViewRef.current?.injectJavaScript(
        `window.setCurrent(${Number(current.latitude)}, ${Number(current.longitude)}, ${toJs(current.label)}); true;`,
      );
    }, [ready, current]);

    useImperativeHandle(ref, () => ({
      zoomIn: () => webViewRef.current?.injectJavaScript('map.zoomIn(); true;'),
      zoomOut: () => webViewRef.current?.injectJavaScript('map.zoomOut(); true;'),
    }));

    return (
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={styles.map}
        originWhitelist={['*']}
        javaScriptEnabled
        scrollEnabled={false}
        onMessage={(event) => {
          if (event.nativeEvent.data === 'ready') setReady(true);
        }}
      />
    );
  },
);

KffRouteMap.displayName = 'KffRouteMap';

const styles = StyleSheet.create({
  map: {
    flex: 1,
    backgroundColor: KFF_COLORS.background,
  },
});

export default KffRouteMap;

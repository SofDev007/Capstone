import React, { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 };

function buildMapHtml({ lat, lng, routeLine, busNumber, routeName, tracking }) {
  const center = {
    latitude: typeof lat === 'number' ? lat : DEFAULT_CENTER.lat,
    longitude: typeof lng === 'number' ? lng : DEFAULT_CENTER.lng,
  };
  const driverColor = tracking ? '#16a34a' : '#2563eb';
  const popupTitle = busNumber ? `Bus ${busNumber}` : 'Driver';
  const popupRoute = routeName || 'Assigned route';

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body { height: 100%; width: 100%; margin: 0; padding: 0; }
      #map { height: 100%; width: 100%; min-height: 240px; background: #e2e8f0; }
      .leaflet-container { background: #e2e8f0; font: 12px/1.4 sans-serif; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      const center = ${JSON.stringify(center)};
      const routeLine = ${JSON.stringify(routeLine)};
      const driverColor = ${JSON.stringify(driverColor)};
      const popupTitle = ${JSON.stringify(popupTitle)};
      const popupRoute = ${JSON.stringify(popupRoute)};

      const map = L.map('map', { zoomControl: true }).setView([center.latitude, center.longitude], 14);

      const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        subdomains: ['a', 'b', 'c'],
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      });
      tileLayer.addTo(map);

      const driverIcon = L.divIcon({
        className: 'driver-pin',
        html: '<div style="width:20px;height:20px;border-radius:50%;background:' + driverColor + ';border:3px solid #111827;box-shadow:0 2px 8px rgba(0,0,0,0.35);"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      let marker = L.marker([center.latitude, center.longitude], { icon: driverIcon })
        .addTo(map)
        .bindPopup('<b>' + popupTitle + '</b><br/>' + popupRoute + '<br/>Your current position');

      if (routeLine.length > 1) {
        L.polyline(routeLine, { color: '#2563eb', weight: 4, opacity: 0.85 }).addTo(map);
        const bounds = L.latLngBounds(routeLine);
        bounds.extend([center.latitude, center.longitude]);
        map.fitBounds(bounds, { padding: [28, 28] });
      }

      window.updateDriverMarker = function(lat, lng, color) {
        if (!marker) return;
        marker.setLatLng([lat, lng]);
        if (color) {
          const icon = L.divIcon({
            className: 'driver-pin',
            html: '<div style="width:20px;height:20px;border-radius:50%;background:' + color + ';border:3px solid #111827;box-shadow:0 2px 8px rgba(0,0,0,0.35);"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });
          marker.setIcon(icon);
        }
        map.panTo([lat, lng], { animate: true });
      };

      setTimeout(function() { map.invalidateSize(); }, 300);
      setTimeout(function() { map.invalidateSize(); }, 1000);
    </script>
  </body>
</html>`;
}

export default function DriverMap({
  currentLocation,
  routeCoordinates = [],
  busNumber = '',
  routeName = '',
  tracking = false,
}) {
  const webRef = useRef(null);

  const routeLine = useMemo(
    () =>
      (routeCoordinates || [])
        .filter((c) => typeof c?.lat === 'number' && typeof c?.lng === 'number')
        .map((c) => [c.lat, c.lng]),
    [routeCoordinates]
  );

  const mapHtml = useMemo(
    () =>
      buildMapHtml({
        lat: currentLocation?.lat ?? DEFAULT_CENTER.lat,
        lng: currentLocation?.lng ?? DEFAULT_CENTER.lng,
        routeLine,
        busNumber,
        routeName,
        tracking,
      }),
    [routeLine, busNumber, routeName, tracking]
  );

  useEffect(() => {
    const lat = currentLocation?.lat;
    const lng = currentLocation?.lng;
    if (typeof lat !== 'number' || typeof lng !== 'number') return;

    const color = tracking ? '#16a34a' : '#2563eb';
    webRef.current?.injectJavaScript(
      `window.updateDriverMarker && window.updateDriverMarker(${lat}, ${lng}, '${color}'); true;`
    );
  }, [currentLocation?.lat, currentLocation?.lng, tracking]);

  return (
    <View style={styles.wrap}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html: mapHtml }}
        style={styles.map}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        allowsInlineMediaPlayback
        setSupportMultipleWindows={false}
        cacheEnabled
        androidLayerType="hardware"
        startInLoadingState
        onLoadEnd={() => {
          const lat = currentLocation?.lat ?? DEFAULT_CENTER.lat;
          const lng = currentLocation?.lng ?? DEFAULT_CENTER.lng;
          const color = tracking ? '#16a34a' : '#2563eb';
          webRef.current?.injectJavaScript(
            `window.updateDriverMarker && window.updateDriverMarker(${lat}, ${lng}, '${color}'); true;`
          );
        }}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.loadingText}>Loading map...</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: Platform.OS === 'android' ? 280 : 260,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#e2e8f0',
  },
  map: { flex: 1, backgroundColor: 'transparent' },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eef2f7',
  },
  loadingText: { marginTop: 6, color: '#475569', fontSize: 12 },
});

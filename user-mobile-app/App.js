import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI, publicAPI, SOCKET_URL } from './utils/api';
import { translations } from './utils/translations';
import AdBanner from './components/AdBanner';
import LanguageSwitcher from './components/LanguageSwitcher';

const DEFAULT_REGION = {
  latitude: 28.6139,
  longitude: 77.209,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeBus = (bus) => {
  const lat = toNumber(bus?.currentLocation?.lat);
  const lng = toNumber(bus?.currentLocation?.lng);
  return {
    ...bus,
    currentLocation: {
      ...(bus.currentLocation || {}),
      lat,
      lng,
    },
  };
};

export default function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
  });
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState('');
  const [buses, setBuses] = useState([]);
  const [selectedBusId, setSelectedBusId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [language, setLanguage] = useState('en');
  const socketRef = useRef(null);
  const mapRef = useRef(null);

  const t = translations[language] || translations.en;

  useEffect(() => {
    loadLanguage();
    checkUserSession();
    const safetyTimer = setTimeout(() => {
      setAuthLoading(false);
      setLoading(false);
    }, 15000);
    return () => clearTimeout(safetyTimer);
  }, []);

  const loadLanguage = async () => {
    try {
      const saved = await AsyncStorage.getItem('appLanguage');
      if (saved === 'en' || saved === 'pa') setLanguage(saved);
    } catch (err) {
      // keep default English
    }
  };

  const changeLanguage = async (code) => {
    setLanguage(code);
    await AsyncStorage.setItem('appLanguage', code);
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchBuses(selectedRoute);
  }, [selectedRoute, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('location-update', ({ busId, location }) => {
      setBuses((prev) =>
        prev.map((bus) =>
          bus._id === String(busId)
            ? normalizeBus({ ...bus, currentLocation: location })
            : bus
        )
      );
    });

    socket.on('trip-started', () => fetchBuses(selectedRoute, true));
    socket.on('trip-ended', () => fetchBuses(selectedRoute, true));
    socket.on('breakdown-alert', () => fetchBuses(selectedRoute, true));

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [selectedRoute, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!socketRef.current) return;
    buses.forEach((bus) => socketRef.current.emit('subscribe', bus._id));
  }, [buses, isAuthenticated]);

  const checkUserSession = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        setAuthLoading(false);
        return;
      }

      await authAPI.me();
      setIsAuthenticated(true);
    } catch (err) {
      await AsyncStorage.multiRemove(['userToken', 'userData']);
      setIsAuthenticated(false);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || authLoading) return;
    bootstrap();
  }, [isAuthenticated, authLoading]);

  const bootstrap = async () => {
    try {
      setLoading(true);
      setError('');
      const routesResponse = await publicAPI.getRoutes();
      setRoutes(routesResponse.data || []);
      await fetchBuses('', true);
    } catch (err) {
      setError(t.failedLoadData);
      setLoading(false);
    }
  };

  const handleAuth = async () => {
    const email = authForm.email.trim().toLowerCase();
    const password = authForm.password.trim();
    const name = authForm.name.trim();
    const phone = authForm.phone.trim();

    if (!email || !password) {
      Alert.alert('Validation', t.validationRequired);
      return;
    }
    if (authMode === 'register' && !name) {
      Alert.alert('Validation', t.validationName);
      return;
    }

    try {
      setAuthSubmitting(true);
      const response =
        authMode === 'register'
          ? await authAPI.register({ name, email, phone, password })
          : await authAPI.login({ email, password });

      await AsyncStorage.setItem('userToken', response.data.token);
      await AsyncStorage.setItem('userData', JSON.stringify(response.data.user));
      setIsAuthenticated(true);
      setError('');
      await bootstrap();
    } catch (err) {
      Alert.alert(t.authFailed, err?.response?.data?.message || t.tryAgain);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['userToken', 'userData']);
    setIsAuthenticated(false);
    setBuses([]);
    setRoutes([]);
    setSelectedRoute('');
    setSelectedBusId('');
  };

  const fetchBuses = async (route = '', silent = false) => {
    try {
      if (!silent) setRefreshing(true);
      const busResponse = await publicAPI.getActiveBuses(route);
      const busData = (busResponse.data || []).map(normalizeBus);
      setBuses(busData);
      const currentExists = selectedBusId && busData.some((bus) => bus._id === selectedBusId);
      if (!currentExists) {
        setSelectedBusId(busData[0]?._id || '');
      }
    } catch (err) {
      setError(t.failedFetchBuses);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  const selectedBus = useMemo(
    () => buses.find((bus) => bus._id === selectedBusId),
    [buses, selectedBusId]
  );

  const mapRegion = useMemo(() => {
    const priorityBus = selectedBus || buses.find(
      (bus) =>
        typeof bus.currentLocation?.lat === 'number' &&
        typeof bus.currentLocation?.lng === 'number'
    );
    if (!priorityBus) return DEFAULT_REGION;
    return {
      latitude: priorityBus.currentLocation.lat,
      longitude: priorityBus.currentLocation.lng,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  }, [buses, selectedBus]);

  const mapHtml = useMemo(() => {
    const markers = buses
      .filter(
        (bus) =>
          typeof bus.currentLocation?.lat === 'number' &&
          typeof bus.currentLocation?.lng === 'number'
      )
      .map((bus) => ({
        id: bus._id,
        busNumber: bus.busNumber,
        route: bus.route,
        status: bus.status,
        lat: bus.currentLocation.lat,
        lng: bus.currentLocation.lng,
      }));

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map { height: 100%; margin: 0; padding: 0; }
      body { background: #f1f5f9; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      const region = ${JSON.stringify(mapRegion)};
      const selectedBusId = ${JSON.stringify(selectedBusId)};
      const markers = ${JSON.stringify(markers)};

      const map = L.map('map').setView([region.latitude, region.longitude], 13);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      if (markers.length) {
        const bounds = [];
        markers.forEach((bus) => {
          const isSelected = bus.id === selectedBusId;
          const color = bus.status === 'breakdown' ? '#dc2626' : '#2563eb';
          const icon = L.divIcon({
            className: 'bus-pin',
            html: '<div style="width:18px;height:18px;border-radius:50%;background:' + color + ';border:3px solid ' + (isSelected ? '#111827' : '#fff') + ';box-shadow:0 2px 8px rgba(0,0,0,0.35);"></div>',
            iconSize: [18, 18],
            iconAnchor: [9, 9]
          });
          L.marker([bus.lat, bus.lng], { icon })
            .addTo(map)
            .bindPopup('<b>Bus ' + bus.busNumber + '</b><br/>' + bus.route + '<br/>Status: ' + bus.status);
          bounds.push([bus.lat, bus.lng]);
        });
        if (bounds.length === 1) {
          map.setView(bounds[0], 14);
        } else if (bounds.length > 1) {
          map.fitBounds(bounds, { padding: [24, 24] });
        }
      }
    </script>
  </body>
</html>`;
  }, [buses, mapRegion, selectedBusId]);

  if (authLoading || (isAuthenticated && loading)) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.subtle}>{t.loading}</Text>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.authWrap}
        >
          <ScrollView contentContainerStyle={styles.authScroll}>
            <AdBanner sponsoredLabel={t.sponsored} />
            <View style={styles.authCard}>
              <LanguageSwitcher language={language} onChange={changeLanguage} label={t.language} />
              <Text style={styles.title}>{t.appTitle}</Text>
              <Text style={styles.subtitle}>{t.authSubtitle}</Text>

              <View style={styles.authTabs}>
                <TouchableOpacity
                  style={[styles.authTab, authMode === 'login' && styles.authTabActive]}
                  onPress={() => setAuthMode('login')}
                >
                  <Text style={[styles.authTabText, authMode === 'login' && styles.authTabTextActive]}>
                    {t.login}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.authTab, authMode === 'register' && styles.authTabActive]}
                  onPress={() => setAuthMode('register')}
                >
                  <Text style={[styles.authTabText, authMode === 'register' && styles.authTabTextActive]}>
                    {t.register}
                  </Text>
                </TouchableOpacity>
              </View>

              {authMode === 'register' && (
                <TextInput
                  style={styles.input}
                  placeholder={t.fullName}
                  value={authForm.name}
                  onChangeText={(text) => setAuthForm((p) => ({ ...p, name: text }))}
                />
              )}

              <TextInput
                style={styles.input}
                placeholder={t.email}
                keyboardType="email-address"
                autoCapitalize="none"
                value={authForm.email}
                onChangeText={(text) => setAuthForm((p) => ({ ...p, email: text }))}
              />

              {authMode === 'register' && (
                <TextInput
                  style={styles.input}
                  placeholder={t.phone}
                  keyboardType="phone-pad"
                  value={authForm.phone}
                  onChangeText={(text) => setAuthForm((p) => ({ ...p, phone: text }))}
                />
              )}

              <TextInput
                style={styles.input}
                placeholder={t.password}
                secureTextEntry
                value={authForm.password}
                onChangeText={(text) => setAuthForm((p) => ({ ...p, password: text }))}
              />

              <TouchableOpacity style={styles.authButton} onPress={handleAuth} disabled={authSubmitting}>
                {authSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.authButtonText}>
                    {authMode === 'login' ? t.login : t.createAccount}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      <AdBanner sponsoredLabel={t.sponsored} />

      <View style={styles.headerCard}>
        <View style={styles.headerMain}>
          <Text style={styles.title}>{t.appTitle}</Text>
          <Text style={styles.subtitle}>{t.mainSubtitle}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutBtnText}>{t.logout}</Text>
        </TouchableOpacity>
      </View>

      <LanguageSwitcher language={language} onChange={changeLanguage} label={t.language} />

      <View style={styles.routeRow}>
        <TouchableOpacity
          style={[styles.routeChip, !selectedRoute && styles.routeChipActive]}
          onPress={() => setSelectedRoute('')}
        >
          <Text style={[styles.routeChipText, !selectedRoute && styles.routeChipTextActive]}>{t.all}</Text>
        </TouchableOpacity>
        <FlatList
          horizontal
          data={routes}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.routeList}
          renderItem={({ item }) => {
            const active = selectedRoute === item;
            return (
              <TouchableOpacity
                style={[styles.routeChip, active && styles.routeChipActive]}
                onPress={() => setSelectedRoute(item)}
              >
                <Text style={[styles.routeChipText, active && styles.routeChipTextActive]}>{item}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <View style={styles.mapCard}>
        <WebView
          originWhitelist={['*']}
          source={{ html: mapHtml }}
          style={styles.map}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={styles.webMapLoading}>
              <ActivityIndicator size="small" color="#2563eb" />
              <Text style={styles.webMapLoadingText}>{t.loadingMap}</Text>
            </View>
          )}
        />
      </View>

      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>{t.activeBuses} ({buses.length})</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => fetchBuses(selectedRoute)}>
          <Text style={styles.refreshText}>{refreshing ? t.refreshing : t.refresh}</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={buses}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.busList}
        renderItem={({ item }) => {
          const active = item._id === selectedBusId;
          return (
            <TouchableOpacity
              style={[styles.busCard, active && styles.busCardActive]}
              onPress={() => setSelectedBusId(item._id)}
            >
              <Text style={styles.busTitle}>Bus {item.busNumber}</Text>
              <Text style={styles.busMeta}>{item.route}</Text>
              <Text style={styles.busMeta}>{t.status}: {item.status}</Text>
              <Text style={styles.busMeta}>
                {t.coordinates}: {item.currentLocation?.lat ?? 'N/A'}, {item.currentLocation?.lng ?? 'N/A'}
              </Text>
              {typeof item.currentLocation?.lat === 'number' && typeof item.currentLocation?.lng === 'number' ? (
                <TouchableOpacity
                  style={styles.mapsBtn}
                  onPress={() => {
                    const { lat, lng } = item.currentLocation;
                    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
                    Linking.openURL(url);
                  }}
                >
                  <Text style={styles.mapsBtnText}>{t.openInMaps}</Text>
                </TouchableOpacity>
              ) : null}
              <Text style={styles.busMeta}>
                {t.updated}: {item.currentLocation?.timestamp ? new Date(item.currentLocation.timestamp).toLocaleTimeString() : 'N/A'}
              </Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={styles.subtle}>{t.noActiveBuses}</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingHorizontal: 14 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  headerMain: { flex: 1, paddingRight: 8 },
  headerCard: {
    backgroundColor: '#ffffff',
    marginTop: 8,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoutBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  logoutBtnText: {
    color: '#b91c1c',
    fontWeight: '700',
    fontSize: 12,
  },
  authWrap: { flex: 1 },
  authScroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: 30 },
  authCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
  },
  authTabs: { flexDirection: 'row', marginTop: 14, marginBottom: 12, backgroundColor: '#e2e8f0', borderRadius: 12 },
  authTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  authTabActive: { backgroundColor: '#2563eb' },
  authTabText: { color: '#334155', fontWeight: '700' },
  authTabTextActive: { color: '#fff' },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
    backgroundColor: '#fff',
  },
  authButton: {
    marginTop: 14,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  authButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  title: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  subtitle: { marginTop: 3, fontSize: 14, color: '#475569' },
  routeRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center' },
  routeList: { paddingHorizontal: 6, gap: 8 },
  routeChip: {
    backgroundColor: '#e2e8f0',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  routeChipActive: { backgroundColor: '#2563eb' },
  routeChipText: { color: '#1e293b', fontSize: 13, fontWeight: '600' },
  routeChipTextActive: { color: '#ffffff' },
  mapCard: {
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    height: 260,
  },
  map: { flex: 1 },
  webMapLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#eef2f7' },
  webMapLoadingText: { marginTop: 6, color: '#475569', fontSize: 12 },
  panelHeader: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  panelTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  refreshBtn: { backgroundColor: '#dbeafe', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  refreshText: { color: '#1d4ed8', fontWeight: '700', fontSize: 12 },
  busList: { paddingBottom: 24, paddingTop: 8 },
  busCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  busCardActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  busTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  busMeta: { marginTop: 2, fontSize: 13, color: '#334155' },
  mapsBtn: {
    marginTop: 8,
    backgroundColor: '#dbeafe',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  mapsBtnText: { color: '#1d4ed8', fontWeight: '700', fontSize: 12 },
  subtle: { marginTop: 8, color: '#64748b', fontSize: 14 },
  error: { marginTop: 8, color: '#dc2626', fontWeight: '600' },
});

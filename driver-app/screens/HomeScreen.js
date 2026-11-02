import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import DriverMap from '../components/DriverMap';
import { tripAPI } from '../utils/api';
import { clearAuth, getAuth } from '../utils/auth';
import {
  startLocationTracking,
  stopLocationTracking,
  getCurrentLocation,
  getLocationForUpdate,
} from '../utils/location';
import { locationAPI } from '../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function HomeScreen({ setIsAuthenticated, navigation }) {
  const [activeTrip, setActiveTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tripLoading, setTripLoading] = useState(false);
  const [locationTracking, setLocationTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [user, setUser] = useState(null);
  const locationIntervalRef = useRef(null);
  const activeTripRef = useRef(null);
  const locationBusyRef = useRef(false);

  useEffect(() => {
    activeTripRef.current = activeTrip;
  }, [activeTrip]);

  useEffect(() => {
    loadUserData();
    checkActiveTrip();
    const safetyTimer = setTimeout(() => setLoading(false), 15000);
    return () => clearTimeout(safetyTimer);
  }, []);

  useEffect(() => {
    if (activeTrip && locationTracking) {
      startSendingLocation();
    } else {
      stopSendingLocation();
    }

    return () => {
      stopSendingLocation();
    };
  }, [activeTrip, locationTracking]);

  const loadUserData = async () => {
    const { user } = await getAuth();
    setUser(user);
  };

  const checkActiveTrip = async () => {
    let activeTripData = null;
    try {
      const response = await tripAPI.getActive();
      activeTripData = response.data;
      if (activeTripData) {
        setActiveTrip(activeTripData);
        await AsyncStorage.setItem('activeTripId', activeTripData._id);
        setLocationTracking(true);
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        await AsyncStorage.removeItem('activeTripId');
        await clearAuth();
        setIsAuthenticated(false);
        return;
      }
      if (error?.message === 'Network Error') {
        console.error(
          'Network Error: start backend (cd backend && npm run dev) or set USE_LOCAL_BACKEND=false in utils/api.js for cloud API.'
        );
      } else {
        console.error('Error checking active trip:', error);
      }
    } finally {
      setLoading(false);
    }

    // Do not block loading screen on GPS permission (fixes stuck "Loading...")
    if (activeTripData) {
      getCurrentLocation()
        .then((location) => setCurrentLocation(location))
        .catch(() => {});
    }
  };

  const handleStartTrip = async () => {
    try {
      setTripLoading(true);
      const location = await getCurrentLocation();
      const response = await tripAPI.start({
        lat: location.lat,
        lng: location.lng,
      });

      setActiveTrip(response.data);
      await AsyncStorage.setItem('activeTripId', response.data._id);
      setCurrentLocation(location);
      setLocationTracking(true);
      await startLocationTracking();

      Alert.alert('Success', 'Trip started successfully');
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to start trip');
    } finally {
      setTripLoading(false);
    }
  };

  const handleEndTrip = async () => {
    if (!activeTrip) return;

    Alert.alert(
      'End Trip',
      'Are you sure you want to end this trip?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Trip',
          style: 'destructive',
          onPress: async () => {
            try {
              setTripLoading(true);
              const location = await getCurrentLocation();
              await tripAPI.end(activeTrip._id, {
                lat: location.lat,
                lng: location.lng,
              });

              await stopLocationTracking();
              setActiveTrip(null);
              setLocationTracking(false);
              await AsyncStorage.removeItem('activeTripId');
              stopSendingLocation();

              Alert.alert('Success', 'Trip ended successfully');
            } catch (error) {
              Alert.alert('Error', error.response?.data?.message || 'Failed to end trip');
            } finally {
              setTripLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleReportBreakdown = () => {
    if (!activeTrip) return;

    Alert.prompt(
      'Report Breakdown',
      'Please describe the issue:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          onPress: async (reason) => {
            if (!reason) {
              Alert.alert('Error', 'Please provide a reason');
              return;
            }

            try {
              await tripAPI.reportBreakdown(activeTrip._id, reason);
              Alert.alert('Success', 'Breakdown reported successfully');
            } catch (error) {
              Alert.alert('Error', error.response?.data?.message || 'Failed to report breakdown');
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const sendLocationTick = async () => {
    const trip = activeTripRef.current;
    if (!trip || locationBusyRef.current) return;

    locationBusyRef.current = true;
    try {
      const location = await getLocationForUpdate();
      setCurrentLocation(location);
      await locationAPI.send(location, trip._id, 0, 0);
    } catch (error) {
      if (error?.response?.status === 401) {
        await AsyncStorage.removeItem('activeTripId');
        await clearAuth();
        setIsAuthenticated(false);
        return;
      }
      const msg = String(error?.message || '');
      if (msg.includes('timeout') || msg.includes('Location') || msg.includes('Network')) {
        return;
      }
      console.warn('Location update issue:', msg);
    } finally {
      locationBusyRef.current = false;
    }
  };

  const startSendingLocation = () => {
    sendLocationTick();
    locationIntervalRef.current = setInterval(sendLocationTick, 10000);
  };

  const stopSendingLocation = () => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await stopLocationTracking();
            stopSendingLocation();
            await clearAuth();
            setIsAuthenticated(false);
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Welcome, {user?.name || 'Driver'}</Text>
          <Text style={styles.headerSubtitle}>
            {activeTrip
              ? `Trip Active - Bus ${activeTrip.bus?.busNumber}`
              : 'No active trip'}
          </Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Map View */}
        <View style={styles.mapContainer}>
          <DriverMap
            currentLocation={currentLocation}
            routeCoordinates={activeTrip?.bus?.routeCoordinates || []}
            busNumber={activeTrip?.bus?.busNumber || ''}
            routeName={activeTrip?.bus?.route || ''}
            tracking={locationTracking}
          />
        </View>

        {/* Trip Info */}
        {activeTrip && (
          <View style={styles.tripInfo}>
            <Text style={styles.tripInfoTitle}>Trip Information</Text>
            <View style={styles.tripInfoRow}>
              <Text style={styles.tripInfoLabel}>Bus:</Text>
              <Text style={styles.tripInfoValue}>
                {activeTrip.bus?.busNumber} - {activeTrip.bus?.route}
              </Text>
            </View>
            <View style={styles.tripInfoRow}>
              <Text style={styles.tripInfoLabel}>Started:</Text>
              <Text style={styles.tripInfoValue}>
                {new Date(activeTrip.startTime).toLocaleString()}
              </Text>
            </View>
            {locationTracking && (
              <View style={styles.tripInfoRow}>
                <Text style={styles.tripInfoLabel}>Status:</Text>
                <Text style={[styles.tripInfoValue, styles.statusActive]}>
                  Tracking Active
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          {!activeTrip ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.startButton]}
              onPress={handleStartTrip}
              disabled={tripLoading}
            >
              {tripLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.actionButtonText}>Start Trip</Text>
              )}
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.endButton]}
                onPress={handleEndTrip}
                disabled={tripLoading}
              >
                {tripLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.actionButtonText}>End Trip</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.breakdownButton]}
                onPress={handleReportBreakdown}
              >
                <Text style={styles.actionButtonText}>Report Breakdown</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  logoutButton: {
    padding: 8,
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  mapContainer: {
    height: 300,
    margin: 15,
  },
  tripInfo: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  tripInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  tripInfoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  tripInfoLabel: {
    fontSize: 14,
    color: '#666',
    width: 80,
  },
  tripInfoValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  statusActive: {
    color: '#10b981',
    fontWeight: '600',
  },
  actions: {
    padding: 15,
    gap: 10,
  },
  actionButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  startButton: {
    backgroundColor: '#10b981',
  },
  endButton: {
    backgroundColor: '#ef4444',
  },
  breakdownButton: {
    backgroundColor: '#f59e0b',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});


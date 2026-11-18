// GPS tracking during a trip: background task, foreground sending, and the offline queue.
// Must be imported at app start (from the root layout) so the background task is defined.
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

export const TASK = 'bus-location-task';
const TRIP_KEY = 'activeTripId';
const QUEUE_KEY = 'locationQueue';
const QUEUE_MAX = 500;

export const fromLocation = (loc) => ({
  lat: loc.coords.latitude,
  lng: loc.coords.longitude,
  // m/s from the GPS chip; null when the phone doesn't know (-1/null), which is NOT the same as stopped.
  speed: loc.coords.speed >= 0 ? loc.coords.speed : null,
  heading: Math.max(0, loc.coords.heading || 0),
  timestamp: new Date(loc.timestamp || Date.now()).toISOString()
});

// ---------- Offline queue ----------

let flushing = false;

async function readQueue() {
  try {
    return JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) || '[]');
  } catch {
    return [];
  }
}

export async function enqueue(point) {
  const queue = await readQueue();
  queue.push(point);
  // Keep the newest points if the phone is offline for a very long time.
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-QUEUE_MAX)));
}

export async function queueSize() {
  return (await readQueue()).length;
}

/** Send queued points (oldest first) once we're back online. */
export async function flushQueue(tripId) {
  if (flushing || !tripId) return;
  flushing = true;
  try {
    const queue = await readQueue();
    if (!queue.length) return;
    await api.post('/locations/batch', { tripId, points: queue });
    // Points added while sending stay queued.
    const after = await readQueue();
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(after.slice(queue.length)));
  } catch (error) {
    if (!error.offline) await AsyncStorage.removeItem(QUEUE_KEY); // trip ended or rejected: drop
  } finally {
    flushing = false;
  }
}

export const clearQueue = () => AsyncStorage.removeItem(QUEUE_KEY);

/** Send one live point. Offline -> queued. Returns the server's live view of the bus. */
export async function sendPoint(tripId, point) {
  try {
    const res = await api.post('/locations', {
      tripId,
      coordinates: { lat: point.lat, lng: point.lng },
      speed: point.speed,
      heading: point.heading,
      timestamp: point.timestamp // when the fix was taken: the server measures speed with it
    });
    flushQueue(tripId);
    return res.bus;
  } catch (error) {
    if (error.offline) await enqueue(point);
    throw error;
  }
}

// ---------- Background task ----------

TaskManager.defineTask(TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  const tripId = await AsyncStorage.getItem(TRIP_KEY);
  if (!tripId) return;
  for (const loc of data.locations) {
    await sendPoint(tripId, fromLocation(loc)).catch(() => {});
  }
});

export const setActiveTrip = (tripId) => (tripId ? AsyncStorage.setItem(TRIP_KEY, tripId) : AsyncStorage.removeItem(TRIP_KEY));

export const isBackgroundTracking = () => Location.hasStartedLocationUpdatesAsync(TASK).catch(() => false);

/**
 * Best-effort background tracking. Without "Allow all the time" it fails, and the foreground
 * loop keeps sending while the app is open.
 */
export async function startBackgroundTracking({ title, body }) {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') throw new Error('foreground-denied');
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') throw new Error('background-denied');
  if (await isBackgroundTracking()) return;
  await Location.startLocationUpdatesAsync(TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 5000,
    distanceInterval: 10,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    activityType: Location.ActivityType.AutomotiveNavigation,
    foregroundService: { notificationTitle: title, notificationBody: body, notificationColor: '#16213E' }
  });
}

export async function stopBackgroundTracking() {
  if (await isBackgroundTracking()) await Location.stopLocationUpdatesAsync(TASK).catch(() => {});
}

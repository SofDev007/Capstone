import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Backend URL setup:
 * - Android emulator + local backend: http://10.0.2.2:5000/api
 * - iOS simulator + local backend: http://localhost:5000/api
 * - Production / cloud: https://transport-backend-xtva.onrender.com/api
 *
 * Set USE_LOCAL_BACKEND to false to use Render cloud API.
 */
const USE_LOCAL_BACKEND = false;

const REMOTE_API = 'https://transport-backend-xtva.onrender.com/api';
const LOCAL_ANDROID_API = 'http://10.0.2.2:5000/api';
const LOCAL_IOS_API = 'http://localhost:5000/api';

function getApiBaseUrl() {
  if (!USE_LOCAL_BACKEND) return REMOTE_API;
  if (Platform.OS === 'android') return LOCAL_ANDROID_API;
  if (Platform.OS === 'ios') return LOCAL_IOS_API;
  return REMOTE_API;
}

export const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  login: (email, password) => api.post('/auth/driver/login', { email, password }),
};

export const tripAPI = {
  start: (startLocation) => api.post('/trips/start', { startLocation }),
  end: (tripId, endLocation) => api.post(`/trips/${tripId}/end`, { endLocation }),
  getActive: () => api.get('/trips/driver/active'),
  reportBreakdown: (tripId, reason) => api.post(`/trips/${tripId}/breakdown`, { reason }),
};

export const locationAPI = {
  send: (coordinates, tripId, speed, heading) =>
    api.post('/locations', {
      coordinates,
      tripId,
      speed: speed || 0,
      heading: heading || 0,
    }),
};

export default api;

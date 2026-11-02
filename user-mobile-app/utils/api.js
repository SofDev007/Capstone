import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://transport-backend-xtva.onrender.com/api';
const SOCKET_URL = 'https://transport-backend-xtva.onrender.com';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('userToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const publicAPI = {
  getRoutes: () => api.get('/public/routes'),
  getActiveBuses: (route) =>
    api.get('/public/buses/active', {
      params: route ? { route } : {},
    }),
};

export const authAPI = {
  register: (payload) => api.post('/auth/user/register', payload),
  login: (payload) => api.post('/auth/user/login', payload),
  me: () => api.get('/auth/user/me')
};

export { SOCKET_URL };

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  login: (email, password) => api.post('/auth/admin/login', { email, password }),
  createDefaultAdmin: () => api.post('/auth/admin/create-default'),
};

// Buses
export const busAPI = {
  getAll: () => api.get('/buses'),
  getById: (id) => api.get(`/buses/${id}`),
  create: (data) => api.post('/buses', data),
  update: (id, data) => api.put(`/buses/${id}`, data),
  delete: (id) => api.delete(`/buses/${id}`),
  assignDriver: (busId, driverId) => api.post(`/buses/${busId}/assign-driver`, { driverId }),
  getActive: () => api.get('/buses/active/all'),
};

// Drivers
export const driverAPI = {
  getAll: () => api.get('/drivers'),
  getById: (id) => api.get(`/drivers/${id}`),
  create: (data) => api.post('/drivers', data),
  update: (id, data) => api.put(`/drivers/${id}`, data),
  delete: (id) => api.delete(`/drivers/${id}`),
};

// Trips
export const tripAPI = {
  getAll: (params) => api.get('/trips', { params }),
  getById: (id) => api.get(`/trips/${id}`),
  getActive: () => api.get('/trips/active/all'),
};

// Locations
export const locationAPI = {
  getByTrip: (tripId, limit = 1000) => api.get(`/locations/trip/${tripId}`, { params: { limit } }),
  getByBus: (busId, limit = 100) => api.get(`/locations/bus/${busId}`, { params: { limit } }),
};

export default api;


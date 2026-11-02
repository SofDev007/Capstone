import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://transport-backend-xtva.onrender.com/api';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://transport-backend-xtva.onrender.com';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const publicAPI = {
  getRoutes: () => api.get('/public/routes'),
  getActiveBuses: (route) =>
    api.get('/public/buses/active', {
      params: route ? { route } : {}
    })
};

export { SOCKET_URL };

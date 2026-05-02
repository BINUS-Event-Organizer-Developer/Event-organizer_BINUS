// src/services/api.js
import axios from 'axios';

const API_URL = 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(
  (config) => {
    const userString = sessionStorage.getItem('user');
    if (userString) {
      try {
        const userData = JSON.parse(userString);
        const token = userData?.accessToken;
        if (token) {
          config.headers['Authorization'] = `Bearer ${token}`;
          console.log('Token attached to request:', token.substring(0, 20) + '...');
        }
      } catch (error) {
        console.error('Error parsing user data from sessionStorage:', error);
        sessionStorage.removeItem('user'); // Hapus data yang corrupt
      }
    }
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for consistent error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Standardize error response structure
    if (error.response?.data) {
      return Promise.reject(error.response.data);
    }
    return Promise.reject({
      message: error.message || 'Network error occurred',
      status: 'error'
    });
  }
);

export default apiClient;
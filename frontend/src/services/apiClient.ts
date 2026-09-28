import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send session cookies
});

// Add interceptors here if needed (e.g. error handling, logging)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Professional error handling logging
    console.error('API Service Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default apiClient;

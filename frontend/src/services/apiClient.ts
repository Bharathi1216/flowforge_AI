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
    const requestUrl = error.config?.url as string | undefined;
    const isSessionProbe = requestUrl?.endsWith('/auth/me');
    if (!isSessionProbe) {
      console.error('API Service Error:', error.response?.data || error.message);
    }
    const errorDetail = error.response?.data?.detail;
    const isUnauthenticatedGuest = isSessionProbe && (error.response?.status === 401 && errorDetail === 'Not authenticated');
    const isAuthExpired = !isUnauthenticatedGuest && (
      error.response?.status === 401 || 
      (typeof errorDetail === 'string' && errorDetail.toLowerCase().includes('expired'))
    );

    if (isAuthExpired && !requestUrl?.endsWith('/auth/logout')) {
      window.dispatchEvent(new CustomEvent('flowforge:auth-expired', {
        detail: typeof errorDetail === 'string' ? errorDetail : 'GitHub authorization has expired'
      }));
    }
    return Promise.reject(error);
  }
);

export default apiClient;

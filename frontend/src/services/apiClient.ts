import axios from 'axios';
let requestScope = 0;
export function resetRequestScope() {
  requestScope += 1;
}

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 140_000,
  withCredentials: true, // Send session cookies
});

apiClient.interceptors.request.use((config) => {
  config.headers.set('X-FlowForge-Session', String(requestScope));
  return config;
});
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url as string | undefined;
    const isSessionProbe = requestUrl?.endsWith('/auth/me');
    if (!isSessionProbe) {
      console.error('API Service Error:', error.response?.data || error.message);
    }
    const errorDetail = error.response?.data?.detail;
    const isUnauthenticatedGuest =
      isSessionProbe && error.response?.status === 401 && errorDetail === 'Not authenticated';
    const isAuthExpired =
      !isUnauthenticatedGuest &&
      (error.response?.status === 401 ||
        (typeof errorDetail === 'string' && errorDetail.toLowerCase().includes('expired')));

    const belongsToCurrentSession =
      error.config?.headers?.['X-FlowForge-Session'] === String(requestScope);
    if (belongsToCurrentSession && isAuthExpired && !requestUrl?.endsWith('/auth/logout')) {
      window.dispatchEvent(
        new CustomEvent('flowforge:auth-expired', {
          detail:
            typeof errorDetail === 'string' ? errorDetail : 'GitHub authorization has expired',
        }),
      );
    }
    return Promise.reject(error);
  },
);

export default apiClient;

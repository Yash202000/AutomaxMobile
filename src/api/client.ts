import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

export const baseURL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.31.107:8080/api/v1';

const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Flag to prevent multiple refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

// Flag to prevent interceptor from running during logout
let isLoggingOut = false;

export const setLoggingOut = (value: boolean) => {
  isLoggingOut = value;
};

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const redirectToLogin = async () => {
  await SecureStore.deleteItemAsync('authToken');
  await SecureStore.deleteItemAsync('refreshToken');
  await SecureStore.deleteItemAsync('user');
  router.replace('/login');
};

// Interceptor to add the token to requests
apiClient.interceptors.request.use(
  async (config) => {
    // If logging out, reject all requests except the logout request itself
    if (isLoggingOut && !config.url?.includes('/auth/logout')) {
      const error = new Error('Request cancelled - logging out');
      (error as any).isLogoutCancel = true;
      return Promise.reject(error);
    }

    const token = await SecureStore.getItemAsync('authToken');

    // If no token and not a public endpoint, reject the request
    const publicEndpoints = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/logout'];
    const isPublicEndpoint = publicEndpoints.some(endpoint => config.url?.includes(endpoint));

    if (!token && !isPublicEndpoint) {
      const error = new Error('No auth token available');
      (error as any).isNoToken = true;
      return Promise.reject(error);
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor to handle 401 unauthorized responses with token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If no config or error is not 401 or request already retried, reject
    if (!originalRequest || error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // If we're logging out, don't try to refresh - just reject
    if (isLoggingOut) {
      return Promise.reject(error);
    }

    // If this is the logout request failing, don't try to refresh
    if (originalRequest.url?.includes('/auth/logout')) {
      return Promise.reject(error);
    }

    // If this is the refresh token request itself failing, redirect to login
    if (originalRequest.url?.includes('/auth/refresh')) {
      await redirectToLogin();
      return Promise.reject(error);
    }

    // If already refreshing, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        })
        .catch((err) => {
          return Promise.reject(err);
        });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken = await SecureStore.getItemAsync('refreshToken');

    if (!refreshToken) {
      isRefreshing = false;
      await redirectToLogin();
      return Promise.reject(error);
    }

    try {
      const response = await axios.post(`${baseURL}/auth/refresh`, {
        refresh_token: refreshToken,
      });

      const { token, refresh_token } = response.data.data;

      await SecureStore.setItemAsync('authToken', token);
      if (refresh_token) {
        await SecureStore.setItemAsync('refreshToken', refresh_token);
      }

      originalRequest.headers.Authorization = `Bearer ${token}`;

      processQueue(null, token);

      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      await redirectToLogin();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default apiClient;

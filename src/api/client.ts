import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { crashLogger } from '@/src/utils/crashLogger';

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
    // Log request interceptor errors (except expected ones)
    if (!isLoggingOut && !(error as any).isLogoutCancel && !(error as any).isNoToken) {
      crashLogger.logError(
        error,
        {
          type: 'RequestInterceptorError',
          context: 'Error in API request interceptor',
          errorMessage: error.message,
        }
      ).catch(() => {});
    }
    return Promise.reject(error);
  }
);

// Interceptor to handle 401 unauthorized responses with token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Log ALL API errors (except during logout or specific cancellation scenarios)
    const shouldLogError =
      !isLoggingOut &&
      !(error as any).isLogoutCancel &&
      !(error as any).isNoToken &&
      // Don't log 401s as errors since they're handled by token refresh
      error.response?.status !== 401;

    if (shouldLogError) {
      const errorDetails: Record<string, any> = {
        method: originalRequest?.method?.toUpperCase(),
        url: originalRequest?.url,
        baseURL: originalRequest?.baseURL,
        status: error.response?.status,
        statusText: error.response?.statusText,
        errorMessage: error.message,
      };

      // Add response data if available
      if (error.response?.data) {
        errorDetails.responseData = typeof error.response.data === 'string'
          ? error.response.data
          : JSON.stringify(error.response.data).substring(0, 500); // Limit size
      }

      // Add request data if available (limit size to avoid huge logs)
      if (originalRequest?.data) {
        try {
          const dataStr = typeof originalRequest.data === 'string'
            ? originalRequest.data
            : JSON.stringify(originalRequest.data);
          errorDetails.requestData = dataStr.substring(0, 500); // Limit to 500 chars
        } catch (e) {
          errorDetails.requestData = 'Unable to stringify request data';
        }
      }

      // Log based on error type
      if (!error.response) {
        // Network error (no response from server)
        crashLogger.logError(
          new Error(`Network Error: ${error.message}`),
          {
            type: 'NetworkError',
            ...errorDetails,
            context: 'Failed to reach server - check internet connection',
          }
        ).catch(() => {});
      } else if (error.response.status >= 500) {
        // Server error (5xx)
        crashLogger.logError(
          new Error(`Server Error: ${error.response.status} - ${error.response.statusText}`),
          {
            type: 'ServerError',
            ...errorDetails,
            context: 'Server returned 5xx error',
          }
        ).catch(() => {});
      } else if (error.response.status >= 400 && error.response.status < 500) {
        // Client error (4xx) - log as warning since these are often expected
        crashLogger.logWarning(
          `Client Error: ${error.response.status} - ${error.response.statusText}`,
          {
            type: 'ClientError',
            ...errorDetails,
            context: 'Client request error (4xx)',
          }
        ).catch(() => {});
      }
    }

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

      // Log missing refresh token
      crashLogger.logWarning(
        'No refresh token available - redirecting to login',
        {
          type: 'MissingRefreshToken',
          context: 'User session expired or refresh token was deleted',
        }
      ).catch(() => {});

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
    } catch (refreshError: any) {
      // Log token refresh failure
      crashLogger.logWarning(
        'Token refresh failed - user will be redirected to login',
        {
          type: 'TokenRefreshError',
          errorMessage: refreshError?.message,
          status: refreshError?.response?.status,
          context: 'Refresh token expired or invalid',
        }
      ).catch(() => {});

      processQueue(refreshError, null);
      await redirectToLogin();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default apiClient;

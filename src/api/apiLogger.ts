import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';

// Dev-only API Inspector feed. With EXPO_PUBLIC_DEBUG_API_LOGS=true (dev builds
// only, never release) every axios request/response is posted to the API
// Inspector running on the dev machine (`npm run api-inspector`, then open
// http://localhost:9091) — a browser network tab with "Copy as cURL".
// Nothing is printed to the console. When the inspector isn't running the post
// fails silently and retries are paused for 15 s.

export const isApiLoggingEnabled = (): boolean =>
  __DEV__ && process.env.EXPO_PUBLIC_DEBUG_API_LOGS === 'true';

type TimedConfig = InternalAxiosRequestConfig & { __startedAt?: number; __inspectorId?: string };

// Same machine as Metro: hostUri is "<host>:<metro port>". Over USB that host is
// localhost, which the inspector maps to the Mac with `adb reverse`.
const INSPECTOR_PORT = 9091;
const inspectorHost = (Constants.expoConfig?.hostUri ?? 'localhost').split(':')[0] || 'localhost';
const INSPECTOR_URL = `http://${inspectorHost}:${INSPECTOR_PORT}/events`;
let inspectorSeq = 0;
let inspectorDown = 0;

const toPlain = (data: unknown) => {
  if (typeof FormData !== 'undefined' && data instanceof FormData) return '[FormData]';
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }
  return data;
};

const headersOf = (headers: unknown): Record<string, string> => {
  const raw = (headers as { toJSON?: () => unknown })?.toJSON?.() ?? headers ?? {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>)
      .filter(([, value]) => value !== undefined && value !== null && typeof value !== 'object')
      .map(([key, value]) => [key, String(value)]),
  );
};

const fullUrl = (config?: InternalAxiosRequestConfig) => {
  if (!config) return '';
  const url = config.url ?? '';
  return /^https?:\/\//i.test(url) ? url : `${config.baseURL ?? ''}${url}`;
};

const sendToInspector = (event: Record<string, unknown>) => {
  if (Date.now() < inspectorDown) return;
  fetch(INSPECTOR_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  }).catch(() => {
    inspectorDown = Date.now() + 15000;
  });
};

/** Call before the app's own interceptors are added (see ./client.ts). */
export const attachApiLogger = (client: AxiosInstance) => {
  if (!isApiLoggingEnabled()) return;

  // Request interceptors run last-added-first, so registering this first means
  // it sees the final URL, headers and body after the auth interceptor.
  client.interceptors.request.use((config: TimedConfig) => {
    config.__startedAt = Date.now();
    config.__inspectorId = `${config.__startedAt}-${++inspectorSeq}`;
    sendToInspector({
      id: config.__inspectorId,
      startedAt: config.__startedAt,
      method: config.method?.toUpperCase(),
      url: fullUrl(config) + (config.params ? `?${new URLSearchParams(config.params).toString()}` : ''),
      requestHeaders: headersOf(config.headers),
      requestBody: toPlain(config.data),
    });
    return config;
  });

  client.interceptors.response.use(
    (response) => {
      const config = response.config as TimedConfig;
      if (config.__inspectorId) {
        sendToInspector({
          id: config.__inspectorId,
          status: response.status,
          durationMs: config.__startedAt ? Date.now() - config.__startedAt : undefined,
          responseHeaders: headersOf(response.headers),
          responseBody: toPlain(response.data),
        });
      }
      return response;
    },
    (error: AxiosError) => {
      const config = error.config as TimedConfig | undefined;
      if (config?.__inspectorId) {
        sendToInspector({
          id: config.__inspectorId,
          status: error.response?.status,
          durationMs: config.__startedAt ? Date.now() - config.__startedAt : undefined,
          error: error.message,
          responseHeaders: headersOf(error.response?.headers),
          responseBody: toPlain(error.response?.data),
        });
      }
      return Promise.reject(error);
    },
  );
};

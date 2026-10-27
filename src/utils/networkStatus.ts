const PROBE_TIMEOUT_MS = 6000;

// Independent, always-available hosts so an API-side problem (slow root path,
// pinning, server down) is never reported as "no internet".
const PROBE_URLS = [
  "https://www.gstatic.com/generate_204",
  "https://captive.apple.com",
];

let alertVisible = false;
const listeners = new Set<() => void>();

const setAlertVisible = (value: boolean) => {
  if (alertVisible === value) return;
  alertVisible = value;
  listeners.forEach((l) => l());
};

export const subscribeNoInternet = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getNoInternetVisible = () => alertVisible;

const probe = async (url: string): Promise<boolean> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    // Any HTTP response (even 4xx/5xx) proves the device has connectivity.
    // Cache-bust + no-cache: iOS would otherwise answer from its HTTP cache
    // while offline, making a dead connection look alive.
    const sep = url.includes("?") ? "&" : "?";
    await fetch(`${url}${sep}_=${Date.now()}`, {
      method: "GET",
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};

/** Online if ANY probe target (API origin or a public host) answers. */
export const checkConnectivity = async (): Promise<boolean> => {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  const urls = [...PROBE_URLS];
  if (apiUrl) urls.unshift(apiUrl.replace(/^(https?:\/\/[^/]+).*$/, "$1"));
  return new Promise((resolve) => {
    let pending = urls.length;
    urls.forEach((u) =>
      probe(u).then((ok) => {
        if (ok) resolve(true);
        else if (--pending === 0) resolve(false);
      }),
    );
  });
};

/** Shows the "check your internet connection" overlay (see NoInternetOverlay). */
export const showNoInternetAlert = () => setAlertVisible(true);

/** Hides the overlay, e.g. once connectivity is restored. */
export const hideNoInternetAlert = () => setAlertVisible(false);

let lastNetworkErrorProbe = 0;

/**
 * Called by the API client when a request fails without any server response.
 * Confirms with a probe first so a flaky single request doesn't show the popup.
 */
export const handleRequestNetworkError = async () => {
  const now = Date.now();
  if (alertVisible || now - lastNetworkErrorProbe < 3000) return;
  lastNetworkErrorProbe = now;
  if (!(await checkConnectivity())) showNoInternetAlert();
  else hideNoInternetAlert();
};

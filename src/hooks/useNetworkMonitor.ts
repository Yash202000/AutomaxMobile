import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import {
  checkConnectivity,
  hideNoInternetAlert,
  showNoInternetAlert,
} from "../utils/networkStatus";

const POLL_INTERVAL_MS = 5000;

/** Shows the no-internet popup when connectivity is lost while the app is open. */
export const useNetworkMonitor = () => {
  const wasOnline = useRef(true);
  const failures = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (AppState.currentState !== "active") return;
      const online = await checkConnectivity();
      if (cancelled) return;
      if (online) {
        failures.current = 0;
        hideNoInternetAlert();
        wasOnline.current = true;
        return;
      }
      // Require two consecutive failed checks to avoid false alarms.
      failures.current += 1;
      if (failures.current >= 2 && wasOnline.current) {
        wasOnline.current = false;
        showNoInternetAlert();
      }
    };

    void check();
    const timer = setInterval(check, POLL_INTERVAL_MS);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void check();
    });
    return () => {
      cancelled = true;
      clearInterval(timer);
      sub.remove();
    };
  }, []);
};

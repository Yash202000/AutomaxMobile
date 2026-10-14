import i18n from "@/src/i18n";
import { CustomAlert } from "@/src/components/CustomAlert";
import {
  addSslPinningErrorListener,
  initializeSslPinning,
} from "react-native-ssl-public-key-pinning";

/**
 * Certificate (public key) pinning.
 *
 * Every request made through React Native's networking stack (axios / fetch)
 * is validated natively (OkHttp on Android, TrustKit on iOS): the TLS
 * handshake only succeeds when the server's certificate chain contains a
 * public key whose SHA-256 SPKI hash matches one of the pins configured here.
 * A man-in-the-middle presenting any other certificate — even one signed by a
 * CA trusted by the device — is rejected before any data is sent.
 *
 * Configuration (build-time env):
 *   EXPO_PUBLIC_SSL_PINNING_ENABLED  "true" | "false" (default: true in release
 *                                    builds, false in __DEV__)
 *   EXPO_PUBLIC_SSL_PINS             comma-separated base64 SHA-256 SPKI hashes
 *                                    (use at least two: current + backup key)
 *
 * Generate a pin from the server:
 *   openssl s_client -servername HOST -connect HOST:443 </dev/null 2>/dev/null \
 *     | openssl x509 -pubkey -noout | openssl pkey -pubin -outform der \
 *     | openssl dgst -sha256 -binary | openssl enc -base64
 *
 * Note: only JS networking is pinned. Native-side downloads (e.g.
 * expo-file-system, WebViews, map tiles) are not covered.
 */

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "";

const pins = (process.env.EXPO_PUBLIC_SSL_PINS ?? "")
  .split(",")
  .map((p) => p.trim().replace(/^sha256\//, ""))
  .filter(Boolean);

const enabledFlag = process.env.EXPO_PUBLIC_SSL_PINNING_ENABLED;
const enabled = enabledFlag ? enabledFlag === "true" : !__DEV__;

let ready: Promise<void> | null = null;
let lastAlertAt = 0;

// Many requests usually fail together when a pin mismatches; show one popup.
const showPinningAlert = (kind: "blocked" | "config") => {
  const now = Date.now();
  if (now - lastAlertAt < 10000) return;
  lastAlertAt = now;
  CustomAlert.alert(
    i18n.t(kind === "blocked" ? "certificatePinning.title" : "certificatePinning.configTitle"),
    i18n.t(kind === "blocked" ? "certificatePinning.message" : "certificatePinning.configMessage"),
  );
};
let listenerAdded = false;

const hostFromUrl = (url: string): string | null => {
  const match = /^https:\/\/([^/:?#]+)/i.exec(url);
  return match ? match[1] : null;
};

const setup = async (): Promise<void> => {
  if (!enabled) return;

  const host = hostFromUrl(apiUrl);
  if (!host) {
    // Plain-http / unparsable API URL: nothing to pin (local development).
    console.warn("[SSL pinning] API URL is not https — pinning skipped");
    return;
  }
  if (pins.length === 0) {
    // Fail closed: a release build with pinning on but no pins is misconfigured.
    showPinningAlert("config");
    throw new Error("SSL pinning is enabled but EXPO_PUBLIC_SSL_PINS is empty");
  }

  if (!listenerAdded) {
    listenerAdded = true;
    addSslPinningErrorListener((error) => {
      console.warn("[SSL pinning] connection blocked:", error.serverHostname);
      showPinningAlert("blocked");
    });
  }

  await initializeSslPinning({
    [host]: { includeSubdomains: false, publicKeyHashes: pins },
  });
};

/**
 * Initialises pinning once. Resolves when it is active; rejects (and keeps
 * rejecting, so requests fail closed) if configuration is invalid.
 */
export const ensureCertificatePinning = (): Promise<void> => {
  if (!ready) ready = setup();
  return ready;
};

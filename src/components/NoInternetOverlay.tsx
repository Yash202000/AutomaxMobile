import { Ionicons } from "@expo/vector-icons";
import React, { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FullWindowOverlay } from "react-native-screens";
import {
  checkConnectivity,
  getNoInternetVisible,
  hideNoInternetAlert,
  subscribeNoInternet,
} from "../utils/networkStatus";

/**
 * In-app (non-Modal) overlay so it can be hidden programmatically when the
 * connection returns, which a native Alert cannot do.
 */
export default function NoInternetOverlay() {
  const { t } = useTranslation();
  const visible = useSyncExternalStore(
    subscribeNoInternet,
    getNoInternetVisible,
  );

  if (!visible) return null;

  const onRetry = async () => {
    if (await checkConnectivity()) hideNoInternetAlert();
  };

  const Wrapper = Platform.OS === "ios" ? FullWindowOverlay : React.Fragment;

  return (
    <Wrapper>
      <View style={styles.overlay} pointerEvents="auto">
        <View style={styles.box}>
          <Ionicons name="cloud-offline-outline" size={36} color="#E74C3C" />
          <Text style={styles.title}>{t("network.noInternetTitle")}</Text>
          <Text style={styles.message}>{t("network.noInternetMessage")}</Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.button, styles.cancel]}
              onPress={hideNoInternetAlert}
            >
              <Text style={styles.cancelText}>{t("common.ok")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={onRetry}>
              <Text style={styles.buttonText}>
                {t("common.retry", "Retry")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
    elevation: 9999,
  },
  box: {
    width: "85%",
    backgroundColor: "white",
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
  },
  title: { fontSize: 18, fontWeight: "bold", color: "#333", marginTop: 10 },
  message: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 16,
    lineHeight: 22,
  },
  row: { flexDirection: "row", gap: 10 },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#2EC4B6",
    minWidth: 90,
    alignItems: "center",
  },
  buttonText: { color: "white", fontSize: 16, fontWeight: "600" },
  cancel: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#CCC",
  },
  cancelText: { color: "#666", fontSize: 16, fontWeight: "600" },
});

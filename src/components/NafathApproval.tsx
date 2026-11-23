import {
  nafathApi,
  nafathErrorOf,
  NAFATH_ERROR,
  type NafathApproved,
  type NafathPending,
} from "@/src/api/nafath";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  I18nManager,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export interface NafathFailure {
  code?: string;
  message?: string;
  network: boolean;
}

interface NafathApprovalProps {
  initial: NafathPending;
  onApproved: (auth: NafathApproved) => Promise<void> | void;
  onFailed: (failure: NafathFailure) => void;
  onCancel: () => void;
}

const formatTime = (seconds: number) => {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// Shows the number to pick in the Nafath app and polls the backend until the
// person approves it. The backend issues a new number every few seconds; the
// countdowns are local and re-synced from each poll.
export const NafathApproval: React.FC<NafathApprovalProps> = ({
  initial,
  onApproved,
  onFailed,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [pending, setPending] = useState(initial);
  const [syncedAt, setSyncedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [approving, setApproving] = useState(false);
  const done = useRef(false);
  const callbacks = useRef({ onApproved, onFailed });
  useEffect(() => {
    callbacks.current = { onApproved, onFailed };
  });

  const fail = (failure: NafathFailure) => {
    if (done.current) return;
    done.current = true;
    callbacks.current.onFailed(failure);
  };

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const response = await nafathApi.status(initial.challenge_id);
        if (cancelled || done.current) return;
        const data = response.data;
        if (!response.success || !data) {
          fail({ code: response.error_code, message: response.error, network: false });
          return;
        }
        if (data.status === "approved") {
          done.current = true;
          setApproving(true);
          try {
            await callbacks.current.onApproved(data);
          } catch (err: any) {
            done.current = false;
            fail({ message: err?.message, network: false });
          }
          return;
        }
        setPending(data);
        setSyncedAt(Date.now());
        timer = setTimeout(poll, data.poll_interval * 1000);
      } catch (err: unknown) {
        if (!cancelled) fail(nafathErrorOf(err));
      }
    };

    timer = setTimeout(poll, initial.poll_interval * 1000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [initial.challenge_id, initial.poll_interval]);

  const elapsed = Math.floor((now - syncedAt) / 1000);
  const rotateIn = Math.max(0, pending.rotate_in - elapsed);
  const expiresIn = Math.max(0, pending.expires_in - elapsed);

  // The request ran out locally before the backend said so.
  useEffect(() => {
    if (expiresIn === 0 && !approving) {
      void nafathApi.cancel(initial.challenge_id).catch(() => undefined);
      fail({ code: NAFATH_ERROR.timeout, network: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresIn, approving]);

  const cancel = () => {
    if (done.current) return;
    done.current = true;
    void nafathApi.cancel(initial.challenge_id).catch(() => undefined);
    onCancel();
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={cancel}
        disabled={approving}
        style={styles.backRow}
        accessibilityRole="button"
      >
        <Ionicons
          name={I18nManager.isRTL ? "arrow-forward" : "arrow-back"}
          size={18}
          color="#555"
        />
        <Text style={styles.backText}>
          {t("auth.backToLogin", "Back to Login")}
        </Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Ionicons name="phone-portrait-outline" size={32} color="#2EC4B6" />
        <Text style={styles.title}>
          {t("auth.nafathOpenApp", "Open the Nafath app")}
        </Text>
        <Text style={styles.subtitle}>
          {t(
            "auth.nafathPickNumber",
            "Open the Nafath app and select this number",
          )}
        </Text>
      </View>

      <View
        style={styles.numberCircle}
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={t("auth.nafathNumberLabel", {
          number: pending.random,
          defaultValue: "Number to choose in Nafath: {{number}}",
        })}
      >
        <Text style={styles.numberText}>{pending.random}</Text>
      </View>

      <View style={styles.statusBlock}>
        {approving ? (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color="#20B2A3" />
            <Text style={[styles.statusText, styles.approvedText]}>
              {t("auth.nafathApproved", "Approved. Signing you in…")}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color="#2EC4B6" />
              <Text style={styles.statusText}>
                {t("auth.nafathWaiting", "Waiting for your approval…")}
              </Text>
            </View>
            <Text style={styles.timerText}>
              {t("auth.nafathExpiresIn", {
                time: formatTime(expiresIn),
                defaultValue: "Request expires in {{time}}",
              })}
            </Text>
            <Text style={styles.hintText}>
              {t("auth.nafathNewNumberIn", {
                seconds: rotateIn,
                defaultValue: "A new number will appear in {{seconds}} s",
              })}
            </Text>
          </>
        )}
      </View>

      <TouchableOpacity
        onPress={cancel}
        disabled={approving}
        style={[styles.cancelButton, approving && styles.disabled]}
        accessibilityRole="button"
      >
        <Text style={styles.cancelText}>
          {t("auth.nafathCancel", "Cancel")}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 20,
    marginBottom: 8,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  backText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#555",
  },
  header: {
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1A1A1A",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    paddingHorizontal: 12,
  },
  numberCircle: {
    alignSelf: "center",
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 4,
    borderColor: "#2EC4B6",
    backgroundColor: "#E8F8F6",
    alignItems: "center",
    justifyContent: "center",
  },
  numberText: {
    fontSize: 48,
    fontWeight: "700",
    color: "#159A8D",
    fontVariant: ["tabular-nums"],
    writingDirection: "ltr",
  },
  statusBlock: {
    alignItems: "center",
    gap: 6,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    color: "#555",
  },
  approvedText: {
    color: "#159A8D",
    fontWeight: "600",
  },
  timerText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    fontVariant: ["tabular-nums"],
  },
  hintText: {
    fontSize: 12,
    color: "#888",
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  cancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#444",
  },
  disabled: {
    opacity: 0.5,
  },
});

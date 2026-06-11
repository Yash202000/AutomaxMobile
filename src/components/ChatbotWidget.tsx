import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

const CHATBOT_URL =
  "https://livechat.discretal.com/preview/70975c26-55b2-41b6-9481-5f4dd2de54f5?workflow_id=86";
const VOICE_AGENT_URL = "https://livechat.discretal.com/va/epm-940-workflow-voice-agent";

const TAB_BAR_HEIGHT = 70;

type Tab = "chat" | "voice";

export const ChatbotWidget: React.FC = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("chat");

  // Position FAB above the floating tab bar
  const fabBottom =
    TAB_BAR_HEIGHT + (insets.bottom > 0 ? insets.bottom - 10 : 16) + 16;

  return (
    <>
      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, { bottom: fabBottom }]}
        onPress={() => setVisible(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="chatbubble-ellipses" size={26} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Chat Modal */}
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle={Platform.OS === "ios" ? "pageSheet" : "overFullScreen"}
        onRequestClose={() => setVisible(false)}
        statusBarTranslucent={Platform.OS === "android"}
      >
        {/* Use insets measured outside the Modal — reliable on Android edge-to-edge */}
        <View style={[styles.modalRoot, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <Ionicons name="chatbubble-ellipses" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.headerTitle}>{t('common.aiAssistant', 'AI Assistant')}</Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setVisible(false)}
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, activeTab === "chat" && styles.activeTab]}
              onPress={() => setActiveTab("chat")}
            >
              <Ionicons
                name="chatbubble-outline"
                size={15}
                color={activeTab === "chat" ? "#2EC4B6" : "#94A3B8"}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "chat" && styles.activeTabText,
                ]}
              >
                Chat Assistant
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === "voice" && styles.activeTab]}
              onPress={() => setActiveTab("voice")}
            >
              <Ionicons
                name="mic-outline"
                size={15}
                color={activeTab === "voice" ? "#2EC4B6" : "#94A3B8"}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "voice" && styles.activeTabText,
                ]}
              >
                Voice Agent
              </Text>
            </TouchableOpacity>
          </View>

          {/* WebViews — both mounted, only one visible via zIndex */}
          <View style={styles.webviewWrapper}>
            <View
              style={[
                StyleSheet.absoluteFill,
                { zIndex: activeTab === "chat" ? 1 : 0 },
              ]}
            >
              <WebView
                source={{ uri: CHATBOT_URL }}
                style={styles.webview}
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled
              />
            </View>
            <View
              style={[
                StyleSheet.absoluteFill,
                { zIndex: activeTab === "voice" ? 1 : 0 },
              ]}
            >
              <WebView
                source={{ uri: VOICE_AGENT_URL }}
                style={styles.webview}
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  /* ── FAB ── */
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2EC4B6",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
    ...Platform.select({
      ios: {
        shadowColor: "#2EC4B6",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.45,
        shadowRadius: 14,
      },
      android: {
        elevation: 10,
      },
    }),
  },

  /* ── Modal ── */
  modalRoot: {
    flex: 1,
    backgroundColor: "#1A237E", // header colour fills status-bar gap on Android
  },

  /* ── Header ── */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#1A237E",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },

  /* ── Tabs ── */
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: "#2EC4B6",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#94A3B8",
  },
  activeTabText: {
    color: "#2EC4B6",
  },

  /* ── WebView ── */
  webviewWrapper: {
    flex: 1,
    position: "relative",
  },
  webview: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
});

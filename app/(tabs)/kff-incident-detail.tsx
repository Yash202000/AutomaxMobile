import KffAppBar from "@/src/components/kff/KffAppBar";
import { KffCriticalityPill, KffStateBadge, KffTicketIcon } from "@/src/components/kff/KffBadges";
import KffBackground from "@/src/components/kff/KffBackground";
import { formatKffDateTime } from "@/src/components/kff/kffDateUtils";
import {
  fetchKffIncidentById,
  getCachedKffIncidentRaw,
  mapApiIncidentToKff,
} from "@/src/components/kff/kffIncidentApi";
import {
  acceptKffIncident,
  findKffIncident,
  rejectKffIncident,
  useKffIncidents,
} from "@/src/components/kff/kffIncidentStore";
import KffRouteTimeline from "@/src/components/kff/KffRouteTimeline";
import { KFF_COLORS } from "@/src/components/kff/kffTheme";
import { CustomAlert } from "@/src/components/CustomAlert";
import {
  SingleLocationMap,
  SingleLocationMapHandle,
} from "@/src/components/maps/SingleLocationMap";
import { KFF_HOME_ROUTE } from "@/src/utils/kff";
import { openMapsDirections } from "@/src/utils/openMapsDirections";
import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// KFF Dispatcher — incident detail (opened from the bell list or My Incidents).
// Always loaded from the Automax incident details API (getIncidentById via
// kffIncidentApi.ts). An incident still waiting in the bell list keeps its
// 'new' status so Accept / Reject are shown.

const ADD_ICON = require("@/assets/images/kff/add.svg");

const KffIncidentDetailScreen = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const incidentsState = useKffIncidents();
  const localIncident = id ? findKffIncident(incidentsState, id) : undefined;

  // Render the row cached from the My Incidents list straight away, then
  // replace it with the full record from the details API.
  const [remoteRaw, setRemoteRaw] = useState<any>(() =>
    id ? getCachedKffIncidentRaw(id) : undefined,
  );
  const [remoteLoading, setRemoteLoading] = useState(true);
  const [remoteError, setRemoteError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    if (!id) {
      setRemoteLoading(false);
      return;
    }
    let cancelled = false;
    setRemoteRaw(getCachedKffIncidentRaw(id));
    setRemoteLoading(true);
    setRemoteError(false);
    fetchKffIncidentById(id).then((response) => {
      if (cancelled) return;
      if (response.success && response.data) setRemoteRaw(response.data);
      else setRemoteError(response.status !== 404);
      setRemoteLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  const remoteIncident = useMemo(
    () => (remoteRaw ? mapApiIncidentToKff(remoteRaw, i18n.language) : undefined),
    [remoteRaw, i18n.language],
  );
  // Still pending in the bell list → keep 'new' so Accept / Reject show.
  const incident =
    remoteIncident && localIncident?.status === "new"
      ? { ...remoteIncident, status: "new" as const, state: "new" as const }
      : remoteIncident ?? localIncident;

  const [mapExpanded, setMapExpanded] = useState(false);
  const fullMapRef = useRef<SingleLocationMapHandle>(null);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.navigate(KFF_HOME_ROUTE);
  };

  if (!incident) {
    return (
      <KffBackground>
        <KffAppBar title={t("kff.detail.title")} onBack={handleBack} />
        <View style={styles.notFound}>
          {remoteLoading ? (
            <ActivityIndicator size="large" color={KFF_COLORS.primary} />
          ) : (
            <>
              <Ionicons
                name={remoteError ? "cloud-offline-outline" : "document-text-outline"}
                size={40}
                color={KFF_COLORS.primary}
              />
              <Text style={styles.notFoundText}>
                {remoteError ? t("kff.detail.loadFailed") : t("kff.detail.notFound")}
              </Text>
              {remoteError && (
                <TouchableOpacity
                  style={styles.retryButton}
                  activeOpacity={0.85}
                  onPress={() => setReloadKey((k) => k + 1)}
                >
                  <Text style={styles.retryText}>{t("common.retry")}</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </KffBackground>
    );
  }

  const isNew = incident.status === "new";
  const { latitude, longitude } = incident;
  const hasLocation = latitude !== undefined && longitude !== undefined;

  const handleDirections = () => {
    const onError = () =>
      CustomAlert.alert(t("common.error"), t("kff.detail.directionsFailed"));
    if (!hasLocation) return onError();
    openMapsDirections(latitude, longitude, onError);
  };

  const handleAccept = () => {
    acceptKffIncident(incident.id);
    router.navigate({
      pathname: "/(tabs)/kff-incidents",
      params: { status: "accepted", date: new Date().toISOString(), ts: String(Date.now()) },
    });
  };

  // TODO: wire up once the KFF attachment/comment endpoints exist (no-op for now).
  const handleAddAttachments = () => {};
  const handleAddComments = () => {};

  const handleReject = () => {
    CustomAlert.alert(t("kff.detail.reject"), t("kff.detail.rejectConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("kff.detail.reject"),
        style: "destructive",
        onPress: () => {
          rejectKffIncident(incident.id);
          router.navigate("/(tabs)/kff-incident-alerts");
        },
      },
    ]);
  };

  return (
    <KffBackground>
      <KffAppBar title={incident.ticketNumber} onBack={handleBack} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Ticket header: directions tile + ticket card */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.directionsTile}
            activeOpacity={0.8}
            onPress={handleDirections}
            accessibilityLabel={t("kff.detail.directions")}
          >
            <Ionicons name="navigate-circle" size={40} color={KFF_COLORS.primary} />
            <Text style={styles.directionsText}>{t("kff.detail.directions")}</Text>
          </TouchableOpacity>

          <View style={styles.ticketCard}>
            <KffTicketIcon size={56} />
            <View style={styles.ticketInfo}>
              <Text style={styles.ticketNumber}>{incident.ticketNumber}</Text>
              {isNew ? (
                <Text style={styles.ticketState}>{t("kff.state.new")}</Text>
              ) : (
                <KffStateBadge state={incident.state} />
              )}
              <View style={styles.pillSpacing}>
                <KffCriticalityPill level={incident.criticality} />
              </View>
            </View>
          </View>
        </View>

        {/* Details */}
        <View style={styles.card}>
          <Text style={styles.classification}>{incident.title}</Text>
          <Text style={styles.caption}>{t("kff.detail.classification")}</Text>
          <Text style={styles.receivedAt}>
            {formatKffDateTime(incident.createdAt, i18n.language)}
          </Text>

          <View style={styles.separator} />

          <KffRouteTimeline destination={incident.to} currentLocation={incident.from} />

          {!!incident.description && (
            <>
              <Text style={styles.sectionLabel}>{t("kff.description")}</Text>
              <Text style={styles.description}>{incident.description}</Text>
            </>
          )}

          {isNew ? (
            <View style={styles.actions}>
              <TouchableOpacity style={styles.acceptButton} activeOpacity={0.85} onPress={handleAccept}>
                <Text style={styles.acceptText}>{t("kff.detail.accept")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectButton} onPress={handleReject} hitSlop={8}>
                <Text style={styles.rejectText}>{t("kff.detail.reject")}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            incident.handledAt && (
              <View style={styles.handledNote}>
                <Ionicons name="checkmark-done" size={16} color={KFF_COLORS.textSecondary} />
                <Text style={styles.handledText}>
                  {t(`kff.detail.handled.${incident.status}`, {
                    date: formatKffDateTime(incident.handledAt, i18n.language),
                  })}
                </Text>
              </View>
            )
          )}
        </View>

        {/* Follow-up actions on an incident the unit is working (My Incidents) */}
        {incident.status === "accepted" && (
          <View style={styles.followUpPanel}>
            <TouchableOpacity style={styles.followUpButton} activeOpacity={0.85} onPress={handleAddAttachments}>
              <Image source={ADD_ICON} style={styles.followUpIcon} contentFit="contain" />
              <Text style={styles.followUpText}>{t("kff.detail.addAttachments")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.followUpButton} activeOpacity={0.85} onPress={handleAddComments}>
              <Image source={ADD_ICON} style={styles.followUpIcon} contentFit="contain" />
              <Text style={styles.followUpText}>{t("kff.detail.addComments")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Map preview */}
        {hasLocation && (
          <View style={styles.mapCard}>
            <SingleLocationMap
              latitude={latitude}
              longitude={longitude}
              title={incident.title}
              address={incident.to}
              markerColor={KFF_COLORS.danger}
            />
            <TouchableOpacity
              style={styles.expandButton}
              onPress={() => setMapExpanded(true)}
              accessibilityLabel={t("kff.detail.expandMap")}
            >
              <Ionicons name="expand-outline" size={22} color={KFF_COLORS.navy} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Full-screen map */}
      <Modal visible={mapExpanded && hasLocation} animationType="slide" onRequestClose={() => setMapExpanded(false)}>
        <View style={styles.fullMap}>
          <SingleLocationMap
            ref={fullMapRef}
            latitude={latitude ?? 0}
            longitude={longitude ?? 0}
            title={incident.title}
            address={incident.to}
            markerColor={KFF_COLORS.danger}
          />
          <TouchableOpacity
            style={[styles.closeMapButton, { top: insets.top + 12 }]}
            onPress={() => setMapExpanded(false)}
          >
            <Ionicons name="close" size={24} color={KFF_COLORS.navy} />
          </TouchableOpacity>
          <View style={[styles.zoomControls, { bottom: insets.bottom + 24 }]}>
            <TouchableOpacity style={styles.zoomButton} onPress={() => fullMapRef.current?.zoomIn()}>
              <Ionicons name="add" size={22} color={KFF_COLORS.navy} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.zoomButton} onPress={() => fullMapRef.current?.zoomOut()}>
              <Ionicons name="remove" size={22} color={KFF_COLORS.navy} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.fullMapDirections, { bottom: insets.bottom + 24 }]}
            onPress={handleDirections}
          >
            <Ionicons name="navigate" size={18} color={KFF_COLORS.white} />
            <Text style={styles.fullMapDirectionsText}>{t("kff.detail.directions")}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </KffBackground>
  );
};

const CARD_SHADOW = {
  shadowColor: KFF_COLORS.navy,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 4,
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 12,
  },
  directionsTile: {
    width: 78,
    backgroundColor: KFF_COLORS.white,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    ...CARD_SHADOW,
  },
  directionsText: {
    fontSize: 11,
    fontWeight: "600",
    color: KFF_COLORS.primary,
  },
  ticketCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: KFF_COLORS.white,
    borderRadius: 20,
    padding: 14,
    ...CARD_SHADOW,
  },
  ticketInfo: {
    flex: 1,
    alignItems: "flex-start",
    gap: 2,
  },
  ticketNumber: {
    fontSize: 20,
    fontWeight: "800",
    color: KFF_COLORS.text,
  },
  ticketState: {
    fontSize: 14,
    color: KFF_COLORS.textSecondary,
  },
  pillSpacing: {
    marginTop: 6,
  },
  card: {
    backgroundColor: KFF_COLORS.white,
    borderRadius: 22,
    padding: 18,
    ...CARD_SHADOW,
  },
  classification: {
    fontSize: 22,
    fontWeight: "800",
    color: KFF_COLORS.navy,
    textAlign: "left",
  },
  caption: {
    fontSize: 15,
    color: KFF_COLORS.textMuted,
    marginTop: 2,
    textAlign: "left",
  },
  receivedAt: {
    fontSize: 12,
    color: KFF_COLORS.textMuted,
    marginTop: 6,
    textAlign: "left",
  },
  separator: {
    height: 1,
    backgroundColor: "#E3E5EC",
    marginVertical: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: KFF_COLORS.primary,
    marginTop: 18,
    marginBottom: 4,
    textAlign: "left",
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: KFF_COLORS.text,
    textAlign: "left",
  },
  actions: {
    marginTop: 22,
    alignItems: "center",
    gap: 6,
  },
  acceptButton: {
    alignSelf: "stretch",
    backgroundColor: KFF_COLORS.primary,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: KFF_COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  acceptText: {
    color: KFF_COLORS.white,
    fontSize: 18,
    fontWeight: "700",
  },
  rejectButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  rejectText: {
    color: KFF_COLORS.text,
    fontSize: 17,
    fontWeight: "700",
  },
  handledNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 18,
    backgroundColor: KFF_COLORS.background,
    borderRadius: 12,
    padding: 10,
  },
  handledText: {
    flex: 1,
    fontSize: 13,
    color: KFF_COLORS.textSecondary,
    textAlign: "left",
  },
  followUpPanel: {
    backgroundColor: KFF_COLORS.primarySoft,
    borderRadius: 22,
    padding: 16,
    gap: 14,
  },
  followUpButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: KFF_COLORS.white,
    borderRadius: 30,
    paddingVertical: 14,
    ...CARD_SHADOW,
  },
  followUpIcon: {
    width: 26,
    height: 26,
  },
  followUpText: {
    fontSize: 17,
    fontWeight: "600",
    color: KFF_COLORS.navy,
  },
  mapCard: {
    height: 200,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: KFF_COLORS.white,
    ...CARD_SHADOW,
  },
  expandButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: KFF_COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    ...CARD_SHADOW,
  },
  fullMap: {
    flex: 1,
    backgroundColor: KFF_COLORS.background,
  },
  closeMapButton: {
    position: "absolute",
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: KFF_COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    ...CARD_SHADOW,
  },
  zoomControls: {
    position: "absolute",
    right: 16,
    gap: 8,
  },
  zoomButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: KFF_COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    ...CARD_SHADOW,
  },
  fullMapDirections: {
    position: "absolute",
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: KFF_COLORS.primary,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 18,
    ...CARD_SHADOW,
  },
  fullMapDirectionsText: {
    color: KFF_COLORS.white,
    fontSize: 15,
    fontWeight: "700",
  },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  notFoundText: {
    fontSize: 15,
    color: KFF_COLORS.textSecondary,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: KFF_COLORS.primary,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 28,
  },
  retryText: {
    color: KFF_COLORS.white,
    fontSize: 14,
    fontWeight: "700",
  },
});

export default KffIncidentDetailScreen;

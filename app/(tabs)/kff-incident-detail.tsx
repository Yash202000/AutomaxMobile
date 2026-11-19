import KffAppBar from "@/src/components/kff/KffAppBar";
import { KffCriticalityPill, KffStateBadge, KffTicketIcon } from "@/src/components/kff/KffBadges";
import KffBackground from "@/src/components/kff/KffBackground";
import { formatKffDateTime } from "@/src/components/kff/kffDateUtils";
import {
  mapApiIncidentToKff,
  mapKffIncidentInfo,
  toTransitionIncidentParam,
} from "@/src/components/kff/kffIncidentMapper";
import { useKffIncidentDetail } from "@/src/components/kff/useKffIncidentDetail";
import KffReasonModal from "@/src/components/kff/KffReasonModal";
import { executeKffTransition } from "@/src/api/kffIncidents";
import { openKffDirections } from "@/src/utils/kffDirections";
import {
  acceptKffIncident,
  findKffIncident,
  rejectKffIncident,
  useKffIncidents,
} from "@/src/components/kff/kffIncidentStore";
import KffRouteTimeline from "@/src/components/kff/KffRouteTimeline";
import { KFF_COLORS, KFF_SHADOWS } from "@/src/components/kff/kffTheme";
import { CustomAlert } from "@/src/components/CustomAlert";
import KffRouteMap, { KffRouteMapHandle } from "@/src/components/kff/KffRouteMap";
import { useKffCurrentLocation } from "@/src/components/kff/useKffCurrentLocation";
import { KFF_HOME_ROUTE } from "@/src/utils/kff";
import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// KFF Dispatcher — incident detail (opened from the bell list or My Incidents).
// Loaded from the incidents API (useKffIncidentDetail). An incident still
// waiting in the bell list keeps its 'new' status so Accept / Reject show.

const ADD_ICON = require("@/assets/images/kff/add.svg");

// Workflow transition helpers (Automax available-transitions payload).
const isRejectTransition = (tr: any) =>
  tr?.is_rejection === true || /reject/i.test(`${tr?.code ?? ""} ${tr?.name ?? ""}`);
const isStartTransition = (tr: any) =>
  /start|en.?route/i.test(`${tr?.code ?? ""} ${tr?.name ?? ""} ${tr?.to_state?.name ?? ""}`);
/** Inputs the KFF screen can't collect itself → use the update-status form. */
const needsTransitionForm = (item: any) => {
  const tr = item?.transition ?? {};
  const mandatory = (item?.requirements ?? []).filter((req: any) => req?.is_mandatory);
  return (
    !!tr.manual_select_user ||
    !!tr.auto_detect_department ||
    !!tr.require_assignee ||
    !!tr.is_final_close ||
    !!tr.to_state?.is_partial_close ||
    (tr.field_changes?.length ?? 0) > 0 ||
    mandatory.some((req: any) => !(req.requirement_type === "comment" && isRejectTransition(tr)))
  );
};

const KffIncidentDetailScreen = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const incidentsState = useKffIncidents();
  const localIncident = id ? findKffIncident(incidentsState, id) : undefined;

  const {
    raw: remoteRaw,
    loading: remoteLoading,
    error: remoteError,
    transitions,
    transitionsLoading,
    reload,
  } = useKffIncidentDetail(id);

  const remoteIncident = useMemo(
    () => (remoteRaw ? mapApiIncidentToKff(remoteRaw, i18n.language) : undefined),
    [remoteRaw, i18n.language],
  );
  // Still pending in the bell list → keep 'new' so Accept / Reject show.
  const incident =
    remoteIncident && localIncident?.status === "new"
      ? { ...remoteIncident, status: "new" as const, state: "new" as const }
      : remoteIncident ?? localIncident;

  const [runningTransitionId, setRunningTransitionId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const fullMapRef = useRef<KffRouteMapHandle>(null);

  // Unit's own position (device GPS) for "Current Location" and the map.
  const { location: myLocation, text: currentLocationText } = useKffCurrentLocation();
  const currentMarker = useMemo(
    () =>
      myLocation
        ? { latitude: myLocation.latitude, longitude: myLocation.longitude, label: t("kff.detail.currentLocation") }
        : null,
    [myLocation, t],
  );

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
                  onPress={reload}
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
    openKffDirections({ latitude, longitude }, myLocation).catch(onError);
  };

  const info = remoteRaw ? mapKffIncidentInfo(remoteRaw, i18n.language) : undefined;
  const transitionLabel = (tr: any): string => (i18n.language === "ar" && tr?.name_ar) || tr?.name || "";
  const isDefaultLocation = info?.location.trim().toLowerCase() === "default";

  const handleCall = () => {
    if (!info?.callerPhone) return;
    Linking.openURL(`tel:${info.callerPhone.replace(/[^\d+]/g, "")}`).catch(() =>
      CustomAlert.alert(t("common.error"), t("kff.detail.callFailed")),
    );
  };

  // Runs a transition on its own; a reject first asks for a reason (sent as the
  // comment), Start also opens Google Maps directions to the incident.
  // Transitions that need extra input (users, fields, attachments, feedback…)
  // fall back to the Automax update-status form with that transition chosen.
  const runTransition = async (item: any, reason?: string) => {
    const tr = item.transition;
    setRunningTransitionId(tr.id);
    const result = await executeKffTransition(String(remoteRaw.id), {
      transitionId: tr.id,
      comment: reason,
      version: remoteRaw.version,
    });
    setRunningTransitionId(null);
    if (!result.success) {
      CustomAlert.alert(t("common.error"), result.error || t("kff.detail.transitionFailed"));
      return;
    }
    setRejectTarget(null);
    reload();
    if (isStartTransition(tr)) handleDirections();
  };

  const handleTransition = (item: any) => {
    const tr = item.transition;
    if (!remoteRaw || runningTransitionId) return;
    if (item.can_execute === false) {
      CustomAlert.alert(t("common.notAllowed", "Not allowed"), item.reason || t("kff.detail.transitionFailed"));
      return;
    }
    if (isDefaultLocation) {
      CustomAlert.alert(
        t("common.notAllowed", "Not allowed"),
        t(
          "incidents.defaultLocationTransitionBlocked",
          "Transition is not allowed while the incident location is Default. Incident location should be updated first.",
        ),
      );
      return;
    }
    if (needsTransitionForm(item)) {
      router.push({
        pathname: "/update-status",
        params: {
          id: String(remoteRaw.id),
          type: "incident",
          transitions: JSON.stringify(transitions),
          incident: JSON.stringify(toTransitionIncidentParam(remoteRaw)),
          transitionId: tr.id,
        },
      });
      return;
    }
    if (isRejectTransition(tr)) {
      setRejectTarget(item);
      return;
    }
    CustomAlert.alert(transitionLabel(tr), t("kff.detail.transitionConfirm", { action: transitionLabel(tr) }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: transitionLabel(tr), onPress: () => runTransition(item) },
    ]);
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
        {/* Ticket header (full width) */}
        <View style={styles.ticketCard}>
          <KffTicketIcon size={56} />
          <View style={styles.ticketInfo}>
            <Text style={styles.ticketNumber} numberOfLines={1} adjustsFontSizeToFit>
              {incident.ticketNumber}
            </Text>
            <View style={styles.badgeRow}>
              {isNew ? (
                <Text style={styles.ticketState}>{t("kff.state.new")}</Text>
              ) : (
                <KffStateBadge state={incident.state} />
              )}
              <KffCriticalityPill level={incident.criticality} />
            </View>
          </View>
        </View>

        {/* Workflow transitions: centred buttons, blue — reject in red */}
        {!isNew && (transitionsLoading || transitions.length > 0) && (
          <View style={styles.card}>
            <Text style={[styles.cardTitle, styles.centeredTitle]}>{t("kff.detail.actions")}</Text>
            {transitionsLoading && transitions.length === 0 ? (
              <ActivityIndicator style={styles.actionsLoader} color={KFF_COLORS.primary} />
            ) : (
              <View style={styles.transitionList}>
                {transitions.map((item: any) => {
                  const tr = item?.transition;
                  if (!tr?.id) return null;
                  const running = runningTransitionId === tr.id;
                  const blocked = isDefaultLocation || item.can_execute === false;
                  return (
                    <TouchableOpacity
                      key={tr.id}
                      style={[
                        styles.transitionButton,
                        isRejectTransition(tr) && styles.transitionReject,
                        (blocked || (!!runningTransitionId && !running)) && styles.transitionDisabled,
                      ]}
                      activeOpacity={0.85}
                      disabled={!!runningTransitionId}
                      onPress={() => handleTransition(item)}
                    >
                      {running ? (
                        <ActivityIndicator color={KFF_COLORS.white} />
                      ) : (
                        <Text style={styles.transitionText} numberOfLines={2}>
                          {transitionLabel(tr)}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Details */}
        <View style={styles.card}>
          <Text style={styles.classification}>{incident.title}</Text>
          <Text style={styles.caption}>{t("kff.detail.classification")}</Text>
          <Text style={styles.receivedAt}>
            {formatKffDateTime(incident.createdAt, i18n.language)}
          </Text>

          <View style={styles.separator} />

          <KffRouteTimeline
            destination={incident.to}
            currentLocation={currentLocationText}
          />

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

        {/* Location + caller details from the incident record */}
        {info && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("kff.detail.info")}</Text>
            <InfoRow icon="business-outline" label={t("kff.detail.location")} value={info.location} />
            <InfoRow icon="location-outline" label={t("kff.detail.address")} value={info.address} />
            <InfoRow icon="person-outline" label={t("kff.detail.callerName")} value={info.callerName} />
            {!!info.callerPhone && (
              <View style={styles.infoRow}>
                <Ionicons name="call-outline" size={20} color={KFF_COLORS.primary} />
                <View style={styles.infoText}>
                  <Text style={styles.infoLabel}>{t("kff.detail.callerNumber")}</Text>
                  <Text style={styles.infoValue} selectable>
                    {"\u200E" + info.callerPhone}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.callButton}
                  onPress={handleCall}
                  accessibilityLabel={t("kff.detail.call")}
                >
                  <Ionicons name="call" size={18} color={KFF_COLORS.white} />
                </TouchableOpacity>
              </View>
            )}
            <InfoRow icon="mail-outline" label={t("kff.detail.callerEmail")} value={info.callerEmail} />
            <InfoRow icon="people-outline" label={t("kff.detail.department")} value={info.department} />
            <InfoRow icon="person-circle-outline" label={t("kff.detail.assignedTo")} value={info.assignee} />
          </View>
        )}

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
            <KffRouteMap
              destination={{ latitude, longitude, title: incident.title, address: incident.to }}
              current={currentMarker}
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

      <KffReasonModal
        visible={!!rejectTarget}
        title={rejectTarget ? transitionLabel(rejectTarget.transition) : ""}
        submitLabel={rejectTarget ? transitionLabel(rejectTarget.transition) : ""}
        submitting={!!runningTransitionId}
        onCancel={() => setRejectTarget(null)}
        onSubmit={(reason) => rejectTarget && runTransition(rejectTarget, reason)}
      />

      {/* Full-screen map */}
      <Modal visible={mapExpanded && hasLocation} animationType="slide" onRequestClose={() => setMapExpanded(false)}>
        <View style={styles.fullMap}>
          <KffRouteMap
            ref={fullMapRef}
            destination={{
              latitude: latitude ?? 0,
              longitude: longitude ?? 0,
              title: incident.title,
              address: incident.to,
            }}
            current={currentMarker}
            interactive
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

// One label/value line in the incident information card (hidden when empty).
const InfoRow = ({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
}) =>
  value ? (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={20} color={KFF_COLORS.primary} />
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} selectable>
          {value}
        </Text>
      </View>
    </View>
  ) : null;

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 14,
  },
  ticketCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: KFF_COLORS.white,
    borderRadius: 20,
    padding: 14,
    ...KFF_SHADOWS.card,
  },
  ticketInfo: {
    flex: 1,
    alignItems: "flex-start",
    gap: 8,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  ticketNumber: {
    fontSize: 22,
    fontWeight: "800",
    color: KFF_COLORS.text,
  },
  ticketState: {
    fontSize: 14,
    color: KFF_COLORS.textSecondary,
  },
  centeredTitle: {
    textAlign: "center",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: KFF_COLORS.navy,
    marginBottom: 12,
    textAlign: "left",
  },
  actionsLoader: {
    marginVertical: 8,
  },
  transitionList: {
    alignItems: "center",
    gap: 10,
  },
  transitionButton: {
    width: "80%",
    minHeight: 50,
    borderRadius: 25,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: KFF_COLORS.primary,
    shadowColor: KFF_COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  transitionReject: {
    backgroundColor: KFF_COLORS.danger,
    shadowColor: KFF_COLORS.danger,
  },
  transitionDisabled: {
    opacity: 0.5,
  },
  transitionText: {
    fontSize: 16,
    fontWeight: "700",
    color: KFF_COLORS.white,
    textAlign: "center",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  infoText: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: KFF_COLORS.textMuted,
    textAlign: "left",
  },
  infoValue: {
    fontSize: 15,
    color: KFF_COLORS.text,
    marginTop: 2,
    textAlign: "left",
  },
  callButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: KFF_COLORS.accepted,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: KFF_COLORS.white,
    borderRadius: 22,
    padding: 18,
    ...KFF_SHADOWS.card,
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
    ...KFF_SHADOWS.card,
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
    ...KFF_SHADOWS.card,
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
    ...KFF_SHADOWS.card,
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
    ...KFF_SHADOWS.card,
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
    ...KFF_SHADOWS.card,
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
    ...KFF_SHADOWS.card,
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

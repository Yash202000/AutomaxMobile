import KffAppBar from "@/src/components/kff/KffAppBar";
import KffBackground from "@/src/components/kff/KffBackground";
import KffCalendarStrip from "@/src/components/kff/KffCalendarStrip";
import { isSameDay, startOfDay } from "@/src/components/kff/kffDateUtils";
import { KFF_COLORS, KFF_SHADOWS } from "@/src/components/kff/kffTheme";
import { KffListStatus } from "@/src/components/kff/kffTypes";
import { useKffMyIncidents } from "@/src/components/kff/useKffMyIncidents";
import { useKffUnitProfile } from "@/src/components/kff/useKffUnitProfile";
import { useAuth } from "@/src/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

// KFF Dispatcher — Profile tab.
// Activity counts come from the incidents API; the unit card and details from
// the unit-user lookup + dispatch resource (useKffUnitProfile). The unit
// status is read-only for now (no status picker).

/** Shown while loading or when the API has no value. */
const NO_VALUE = "—";

/** Dot colour for the dispatch resource status (e.g. "available"). */
const unitStatusColor = (status: string) => {
  const s = status.toLowerCase();
  if (/avail|online|free|idle/.test(s)) return KFF_COLORS.online;
  if (/busy|assign|dispatch|enroute|en.route|on.?scene|engaged/.test(s)) return KFF_COLORS.busy;
  if (/off|unavail|out.of.service|inactive/.test(s)) return KFF_COLORS.offline;
  return KFF_COLORS.textMuted;
};

/** "out_of_service" → "Out Of Service". */
const humanize = (value: string) =>
  value.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const ACTIVITY_CARDS: {
  status: KffListStatus;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}[] = [
  { status: "accepted", icon: "arrow-redo", color: KFF_COLORS.accepted },
  { status: "completed", icon: "thumbs-up", color: KFF_COLORS.completed },
  { status: "rejected", icon: "close-circle-outline", color: KFF_COLORS.rejected },
];

const getGreetingKey = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "dashboard.greeting.morning";
  if (hour < 17) return "dashboard.greeting.afternoon";
  return "dashboard.greeting.evening";
};

const KffProfileScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const { user } = useAuth();

  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));

  const { counts, countsLoading } = useKffMyIncidents(selectedDate);
  const { uniqueId, unit } = useKffUnitProfile();
  const unitStatus = unit?.status || "";
  const isToday = isSameDay(selectedDate, new Date());

  const driverName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username || "";

  const openIncidents = (status: KffListStatus) => {
    router.navigate({
      pathname: "/(tabs)/kff-incidents",
      params: { status, date: selectedDate.toISOString(), ts: String(Date.now()) },
    });
  };

  const unitDetails: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }[] = [
    { icon: "car-sport-outline", label: t("kff.profile.vehicleType"), value: unit?.name || NO_VALUE },
    { icon: "card-outline", label: t("kff.profile.plateNumber"), value: unit?.plateNumber || NO_VALUE },
    { icon: "location-outline", label: t("kff.profile.location"), value: unit?.locationName || NO_VALUE },
  ];

  return (
    <KffBackground>
      <KffAppBar subtitle={t(getGreetingKey())} title={driverName} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Unit card */}
        <View style={styles.card}>
          <View style={styles.unitTop}>
            <View style={styles.avatarRing}>
              <View style={styles.avatarCircle}>
                <Ionicons name="car-sport" size={46} color={KFF_COLORS.primary} />
              </View>
            </View>
            <View style={styles.unitInfo}>
              <Text style={styles.unitLabel}>{t("kff.profile.unitNo")}</Text>
              <Text style={styles.unitNumber} numberOfLines={1} adjustsFontSizeToFit>
                {uniqueId || NO_VALUE}
              </Text>
            </View>
          </View>

          <View style={styles.unitDivider} />

          <View style={styles.unitBottom}>
            <View style={styles.unitCol}>
              <Text style={styles.colLabel}>{t("kff.profile.unitStatus")}</Text>
              {/* Read-only for now: the status picker is hidden. */}
              <View style={styles.statusPill}>
                <View style={[styles.statusDot, { backgroundColor: unitStatusColor(unitStatus) }]} />
                <Text style={styles.statusText}>
                  {unitStatus
                    ? t(`kff.resourceStatus.${unitStatus.toLowerCase()}`, { defaultValue: humanize(unitStatus) })
                    : NO_VALUE}
                </Text>
              </View>
            </View>
            <View style={styles.colDivider} />
            <View style={styles.unitCol}>
              <Text style={styles.colLabel}>{t("kff.profile.tetraRadioAlarm")}</Text>
              <View style={styles.alarmTile}>
                <Ionicons name="notifications" size={22} color={KFF_COLORS.primary} />
              </View>
            </View>
          </View>
        </View>

        {/* Calendar */}
        <KffCalendarStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} />

        {/* Activities */}
        <View>
          <Text style={styles.sectionTitle}>
            {isToday ? t("kff.profile.todayActivities") : t("kff.profile.activities")}
          </Text>
          <View style={styles.activityRow}>
            {ACTIVITY_CARDS.map((card) => (
              <TouchableOpacity
                key={card.status}
                style={[styles.activityCard, { backgroundColor: card.color }]}
                activeOpacity={0.85}
                onPress={() => openIncidents(card.status)}
              >
                <View style={styles.activityIcon}>
                  <Ionicons name={card.icon} size={22} color={KFF_COLORS.white} />
                </View>
                <Text style={styles.activityCount}>
                  {countsLoading ? "–" : counts[card.status]}
                </Text>
                <Text style={styles.activityLabel} numberOfLines={1}>
                  {t(`kff.status.${card.status}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Unit details */}
        <View>
          <Text style={styles.sectionTitle}>{t("kff.profile.unitDetails")}</Text>
          <View style={styles.card}>
            {unitDetails.map((row, index) => (
              <View
                key={row.label}
                style={[styles.detailRow, index > 0 && styles.detailRowBorder]}
              >
                <View style={styles.detailIcon}>
                  <Ionicons name={row.icon} size={20} color={KFF_COLORS.primary} />
                </View>
                <View style={styles.detailText}>
                  <Text style={styles.detailLabel}>{row.label}</Text>
                  <Text style={styles.detailValue}>{row.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

    </KffBackground>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 18,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 22,
    padding: 16,
    ...KFF_SHADOWS.soft,
  },
  unitTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 5,
    borderColor: KFF_COLORS.primaryRing,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "#FBEFE7",
    alignItems: "center",
    justifyContent: "center",
  },
  unitInfo: {
    flex: 1,
    alignItems: "flex-start",
  },
  unitLabel: {
    fontSize: 13,
    color: KFF_COLORS.textSecondary,
  },
  unitNumber: {
    fontSize: 26,
    fontWeight: "800",
    color: KFF_COLORS.navy,
    letterSpacing: 0.5,
  },
  unitDivider: {
    height: 1,
    backgroundColor: "#EEF0F6",
    marginVertical: 14,
  },
  unitBottom: {
    flexDirection: "row",
    alignItems: "center",
  },
  unitCol: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  colDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: "#EEF0F6",
  },
  colLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: KFF_COLORS.text,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E9EBF2",
    borderRadius: 22,
    paddingVertical: 5,
    paddingLeft: 12,
    paddingRight: 5,
    gap: 6,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "500",
    color: KFF_COLORS.text,
  },
  alarmTile: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: KFF_COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: KFF_COLORS.navy,
    marginBottom: 10,
    textAlign: "left",
  },
  activityRow: {
    flexDirection: "row",
    gap: 10,
  },
  activityCard: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  activityIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  activityCount: {
    marginTop: 12,
    fontSize: 26,
    fontWeight: "800",
    color: KFF_COLORS.white,
  },
  activityLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.92)",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 10,
  },
  detailRowBorder: {
    borderTopWidth: 1,
    borderTopColor: "#EEF0F6",
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: KFF_COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  detailText: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 13,
    color: KFF_COLORS.textSecondary,
    textAlign: "left",
  },
  detailValue: {
    fontSize: 15,
    fontWeight: "700",
    color: KFF_COLORS.navy,
    textAlign: "left",
    marginTop: 2,
  },
});

export default KffProfileScreen;

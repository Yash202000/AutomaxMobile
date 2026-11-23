import React from "react";
import { StyleSheet, View } from "react-native";
import { LayoutLoader } from "./LayoutLoader";
import { Skeleton } from "./Skeleton";

const InfoRowSkeleton: React.FC = () => (
  <View style={styles.infoRow}>
    <Skeleton width={100} height={14} />
    <Skeleton width={70} height={14} />
  </View>
);

const SectionCardSkeleton: React.FC<{ rows: number }> = ({ rows }) => (
  <View style={styles.card}>
    <View style={styles.sectionHeader}>
      <Skeleton width={20} height={20} borderRadius={10} />
      <Skeleton width={130} height={16} />
    </View>
    {Array.from({ length: rows }).map((_, i) => (
      <InfoRowSkeleton key={i} />
    ))}
  </View>
);

interface DetailScreenSkeletonProps {
  /** One entry per section card, value is how many info rows it shows. */
  sections?: number[];
}

/** Layout loader for ticket detail screens (incident/request/complaint/query details). */
export const DetailScreenSkeleton: React.FC<DetailScreenSkeletonProps> = ({
  sections = [3, 2],
}) => (
  <LayoutLoader scrollable style={styles.root} contentStyle={styles.content}>
    <View style={styles.titleCard}>
      <View style={styles.titleHeader}>
        <Skeleton width={80} height={12} />
        <Skeleton width={60} height={20} borderRadius={6} />
      </View>
      <Skeleton width="80%" height={18} style={{ marginTop: 10 }} />
      <Skeleton width={100} height={14} style={{ marginTop: 14 }} />
    </View>

    {sections.map((rows, i) => (
      <SectionCardSkeleton key={i} rows={rows} />
    ))}
  </LayoutLoader>
);

const styles = StyleSheet.create({
  root: {
    backgroundColor: "#F5F7FA",
  },
  content: {
    paddingHorizontal: 0,
    paddingTop: 10,
  },
  titleCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
  },
  titleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
});

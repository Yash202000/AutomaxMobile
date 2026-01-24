import {
  getComplaintStats,
  getIncidentStats,
  getQueryStats,
  getRequestStats,
} from "@/src/api/incidents";
import { usePermissions } from "@/src/hooks/usePermissions";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const DashboardScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    canCreateIncidents,
    canViewIncidents,

    canViewAllIncidents,
    canViewRequests,
    canViewAllRequests,
    canViewComplaints,
    canViewAllComplaints,
    canViewQueries,
    canViewAllQueries,
  } = usePermissions();
  const [incidentStats, setIncidentStats] = useState(null);
  const [requestStats, setRequestStats] = useState(null);
  const [complaintStats, setComplaintStats] = useState(null);
  const [queryStats, setQueryStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [errorStats, setErrorStats] = useState("");

  useEffect(() => {
    const fetchStats = async () => {
      setLoadingStats(true);
      try {
        const [incidentRes, requestRes, complaintRes, queryRes] =
          await Promise.all([
            getIncidentStats(),
            getRequestStats(),
            getComplaintStats(),
            getQueryStats(),
          ]);

        if (incidentRes.success) setIncidentStats(incidentRes.data);
        if (requestRes.success) setRequestStats(requestRes.data);
        if (complaintRes.success) setComplaintStats(complaintRes.data);
        if (queryRes.success) setQueryStats(queryRes.data);

        if (
          !incidentRes.success &&
          !requestRes.success &&
          !complaintRes.success &&
          !queryRes.success
        ) {
          setErrorStats("Failed to fetch statistics");
          Alert.alert("Error", "Failed to fetch statistics.");
        }
      } catch (error) {
        setErrorStats("Failed to fetch statistics");
        Alert.alert("Error", "Failed to fetch statistics.");
      }
      setLoadingStats(false);
    };
    fetchStats();
  }, []);

  if (loadingStats) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ImageBackground
          source={require("@/assets/images/background.png")}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>{t("dashboard.title")}</Text>
          <TouchableOpacity>
            <FontAwesome name="bell" size={24} color="white" />
          </TouchableOpacity>
        </ImageBackground>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1A237E" />
          <Text>{t("common.loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorStats) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ImageBackground
          source={require("@/assets/images/background.png")}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>{t("dashboard.title")}</Text>
          <TouchableOpacity>
            <FontAwesome name="bell" size={24} color="white" />
          </TouchableOpacity>
        </ImageBackground>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorStats}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <ImageBackground
          source={require("@/assets/images/background.png")}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>{t("dashboard.title")}</Text>
          <TouchableOpacity>
            <FontAwesome name="bell" size={24} color="white" />
          </TouchableOpacity>
        </ImageBackground>

        {/* Main Content */}
        <ScrollView style={styles.content}>
          {/* Summary Cards */}
          <View style={styles.summaryCardsContainer}>
            {canViewAllIncidents() && (
              <View
                style={[styles.summaryCard, { backgroundColor: "#E8F5E9" }]}
              >
                <Ionicons name="alert-circle" size={24} color="#2E7D32" />
                <Text style={styles.summaryCardNumber}>
                  {incidentStats?.total || 0}
                </Text>
                <Text style={styles.summaryCardLabel}>Incidents</Text>
              </View>
            )}
            {canViewAllRequests() && (
              <View
                style={[styles.summaryCard, { backgroundColor: "#F3E8FF" }]}
              >
                <Ionicons name="document-text" size={24} color="#9B59B6" />
                <Text style={styles.summaryCardNumber}>
                  {requestStats?.total || 0}
                </Text>
                <Text style={styles.summaryCardLabel}>Requests</Text>
              </View>
            )}
            {canViewAllComplaints() && (
              <View
                style={[styles.summaryCard, { backgroundColor: "#FDEAEA" }]}
              >
                <Ionicons
                  name="chatbubble-ellipses"
                  size={24}
                  color="#E74C3C"
                />
                <Text style={styles.summaryCardNumber}>
                  {complaintStats?.total || 0}
                </Text>
                <Text style={styles.summaryCardLabel}>Complaints</Text>
              </View>
            )}
            {canViewAllQueries() && (
              <View
                style={[styles.summaryCard, { backgroundColor: "#E3F2FD" }]}
              >
                <Ionicons name="help-circle" size={24} color="#3498DB" />
                <Text style={styles.summaryCardNumber}>
                  {queryStats?.total || 0}
                </Text>
                <Text style={styles.summaryCardLabel}>Queries</Text>
              </View>
            )}
          </View>

          {/* My Incidents Section */}
          {canViewIncidents() && (
            <>
              <Text style={styles.sectionTitle}>
                {t("dashboard.myIncidents")}
              </Text>
              <View style={styles.myIncidentsContainer}>
                <TouchableOpacity
                  style={styles.myIncidentCard}
                  onPress={() =>
                    router.push({
                      pathname: "/my-incidents",
                      params: { type: "assigned" },
                    })
                  }
                >
                  <View
                    style={[
                      styles.myIncidentIconContainer,
                      { backgroundColor: "#E3F2FD" },
                    ]}
                  >
                    <Ionicons
                      name="checkbox-outline"
                      size={24}
                      color="#1976D2"
                    />
                  </View>
                  <Text style={styles.myIncidentText}>
                    {t("dashboard.assignedToMe")}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="#999" />
                </TouchableOpacity>
                {canCreateIncidents() && (
                  <TouchableOpacity
                    style={styles.myIncidentCard}
                    onPress={() =>
                      router.push({
                        pathname: "/my-incidents",
                        params: { type: "created" },
                      })
                    }
                  >
                    <View
                      style={[
                        styles.myIncidentIconContainer,
                        { backgroundColor: "#FFF3E0" },
                      ]}
                    >
                      <Ionicons
                        name="create-outline"
                        size={24}
                        color="#F57C00"
                      />
                    </View>
                    <Text style={styles.myIncidentText}>
                      {t("dashboard.createdByMe")}
                    </Text>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}

          {/* Incidents by Status */}
          {canViewIncidents() && (
            <>
              <Text style={styles.sectionTitle}>
                {t("dashboard.incidentsByStatus")}
              </Text>
              {incidentStats?.by_state_details &&
              incidentStats.by_state_details.length > 0 ? (
                incidentStats.by_state_details.map((stateDetail) => (
                  <TouchableOpacity
                    style={styles.detailsCard}
                    key={`incident-${stateDetail.id}`}
                    onPress={() =>
                      router.push({
                        pathname: "/(tabs)/incident",
                        params: {
                          state_id: stateDetail.id,
                          state_name: stateDetail.name,
                        },
                      })
                    }
                  >
                    <View
                      style={[
                        styles.detailsCardBar,
                        { backgroundColor: "#2E7D32" },
                      ]}
                    />
                    <View style={styles.detailsCardContent}>
                      <Text style={styles.detailsCardTitle}>
                        {stateDetail.name}
                      </Text>
                      <Text style={styles.detailsCardNumber}>
                        {stateDetail.count}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.detailsCard}>
                  <View style={styles.detailsCardContent}>
                    <Text style={styles.detailsCardTitle}>No incidents</Text>
                  </View>
                </View>
              )}
            </>
          )}

          {/* Requests by Status */}
          {canViewRequests() && (
            <>
              <Text style={styles.sectionTitle}>Requests by Status</Text>
              {requestStats?.by_state_details &&
              requestStats.by_state_details.length > 0 ? (
                requestStats.by_state_details.map((stateDetail) => (
                  <TouchableOpacity
                    style={styles.detailsCard}
                    key={`request-${stateDetail.id}`}
                    onPress={() =>
                      router.push({
                        pathname: "/(tabs)/request",
                        params: {
                          state_id: stateDetail.id,
                          state_name: stateDetail.name,
                        },
                      })
                    }
                  >
                    <View
                      style={[
                        styles.detailsCardBar,
                        { backgroundColor: "#9B59B6" },
                      ]}
                    />
                    <View style={styles.detailsCardContent}>
                      <Text style={styles.detailsCardTitle}>
                        {stateDetail.name}
                      </Text>
                      <Text style={styles.detailsCardNumber}>
                        {stateDetail.count}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.detailsCard}>
                  <View style={styles.detailsCardContent}>
                    <Text style={styles.detailsCardTitle}>No requests</Text>
                  </View>
                </View>
              )}
            </>
          )}

          {/* Complaints by Status */}
          {canViewComplaints() && (
            <>
              <Text style={styles.sectionTitle}>Complaints by Status</Text>
              {complaintStats?.by_state_details &&
              complaintStats.by_state_details.length > 0 ? (
                complaintStats.by_state_details.map((stateDetail) => (
                  <TouchableOpacity
                    style={styles.detailsCard}
                    key={`complaint-${stateDetail.id}`}
                    onPress={() =>
                      router.push({
                        pathname: "/(tabs)/complaint",
                        params: {
                          state_id: stateDetail.id,
                          state_name: stateDetail.name,
                        },
                      })
                    }
                  >
                    <View
                      style={[
                        styles.detailsCardBar,
                        { backgroundColor: "#E74C3C" },
                      ]}
                    />
                    <View style={styles.detailsCardContent}>
                      <Text style={styles.detailsCardTitle}>
                        {stateDetail.name}
                      </Text>
                      <Text style={styles.detailsCardNumber}>
                        {stateDetail.count}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.detailsCard}>
                  <View style={styles.detailsCardContent}>
                    <Text style={styles.detailsCardTitle}>No complaints</Text>
                  </View>
                </View>
              )}
            </>
          )}

          {/* Queries by Status */}
          {canViewQueries() && (
            <>
              <Text style={styles.sectionTitle}>Queries by Status</Text>
              {queryStats?.by_state_details &&
              queryStats.by_state_details.length > 0 ? (
                queryStats.by_state_details.map((stateDetail) => (
                  <TouchableOpacity
                    style={styles.detailsCard}
                    key={`query-${stateDetail.id}`}
                    onPress={() =>
                      router.push({
                        pathname: "/(tabs)/query",
                        params: {
                          state_id: stateDetail.id,
                          state_name: stateDetail.name,
                        },
                      })
                    }
                  >
                    <View
                      style={[
                        styles.detailsCardBar,
                        { backgroundColor: "#3498DB" },
                      ]}
                    />
                    <View style={styles.detailsCardContent}>
                      <Text style={styles.detailsCardTitle}>
                        {stateDetail.name}
                      </Text>
                      <Text style={styles.detailsCardNumber}>
                        {stateDetail.count}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.detailsCard}>
                  <View style={styles.detailsCardContent}>
                    <Text style={styles.detailsCardTitle}>No queries</Text>
                  </View>
                </View>
              )}
            </>
          )}

          {/* Bottom padding */}
          <View style={{ height: 20 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#1A237E", // Reverted to original
  },
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5", // Reverted to original
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    padding: 20,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
  },
  content: {
    padding: 20,
  },
  summaryCardsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  summaryCard: {
    width: "48%",
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryCardNumber: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginTop: 8,
  },
  summaryCardLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    color: "#666",
  },
  cardBody: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  totalIncidents: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  totalIncidentsNumber: {
    fontSize: 36,
    fontWeight: "bold",
  },
  totalIncidentsChange: {
    fontSize: 16,
    color: "green",
    marginLeft: 10,
    marginBottom: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  myIncidentsContainer: {
    marginBottom: 20,
    gap: 10,
  },
  myIncidentCard: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  myIncidentIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  myIncidentText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  detailsCard: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 20,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  detailsCardBar: {
    width: 4,
    height: "100%",
    backgroundColor: "#3498DB",
    borderRadius: 2,
    marginRight: 15,
  },
  detailsCardContent: {
    flex: 1,
  },
  detailsCardTitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 5,
  },
  detailsCardNumber: {
    fontSize: 24,
    fontWeight: "bold",
  },
  detailsCardChangePositive: {
    color: "green",
    fontWeight: "bold",
  },
  detailsCardChangeNegative: {
    color: "red",
    fontWeight: "bold",
  },
});

export default DashboardScreen;

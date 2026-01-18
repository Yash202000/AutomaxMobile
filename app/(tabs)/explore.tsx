import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ImageBackground, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getIncidentStats } from '@/src/api/incidents';

const DashboardScreen = () => {
    const { t } = useTranslation();
    const router = useRouter();
    const [incidentStats, setIncidentStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(true);
    const [errorStats, setErrorStats] = useState('');

    useEffect(() => {
        const fetchStats = async () => {
            setLoadingStats(true);
            const response = await getIncidentStats();
            if (response.success) {
                setIncidentStats(response.data);
            } else {
                setErrorStats(response.error);
                Alert.alert('Error', 'Failed to fetch incident statistics.');
            }
            setLoadingStats(false);
        };
        fetchStats();
    }, []);

    if (loadingStats) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <ImageBackground source={require('@/assets/images/background.png')} style={styles.header}>
                    <Text style={styles.headerTitle}>{t('dashboard.title')}</Text>
                    <TouchableOpacity>
                        <FontAwesome name="bell" size={24} color="white" />
                    </TouchableOpacity>
                </ImageBackground>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#1A237E" />
                    <Text>{t('common.loading')}</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (errorStats) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <ImageBackground source={require('@/assets/images/background.png')} style={styles.header}>
                    <Text style={styles.headerTitle}>{t('dashboard.title')}</Text>
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
        <ImageBackground source={require('@/assets/images/background.png')} style={styles.header}>
          <Text style={styles.headerTitle}>{t('dashboard.title')}</Text>
          <TouchableOpacity>
            <FontAwesome name="bell" size={24} color="white" />
          </TouchableOpacity>
        </ImageBackground>

        {/* Main Content */}
        <ScrollView style={styles.content}>
          {/* Total Incidents Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('dashboard.totalIncidents')}</Text>
            <View style={styles.cardBody}>
              <View style={styles.totalIncidents}>
                <Text style={styles.totalIncidentsNumber}>{incidentStats?.total || 0}</Text>
              </View>
              <Ionicons name="stats-chart" size={32} color="#1A237E" />
            </View>
          </View>

          {/* My Incidents Section */}
          <Text style={styles.sectionTitle}>{t('dashboard.myIncidents')}</Text>
          <View style={styles.myIncidentsContainer}>
            <TouchableOpacity
              style={styles.myIncidentCard}
              onPress={() => router.push({ pathname: '/my-incidents', params: { type: 'assigned' } })}
            >
              <View style={[styles.myIncidentIconContainer, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="checkbox-outline" size={24} color="#1976D2" />
              </View>
              <Text style={styles.myIncidentText}>{t('dashboard.assignedToMe')}</Text>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.myIncidentCard}
              onPress={() => router.push({ pathname: '/my-incidents', params: { type: 'created' } })}
            >
              <View style={[styles.myIncidentIconContainer, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="create-outline" size={24} color="#F57C00" />
              </View>
              <Text style={styles.myIncidentText}>{t('dashboard.createdByMe')}</Text>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
          </View>

          {/* Incidents Details Section */}
          <Text style={styles.sectionTitle}>{t('dashboard.incidentsByStatus')}</Text>

          {/* Use by_state_details if available, otherwise fallback to by_state */}
          {incidentStats?.by_state_details && incidentStats.by_state_details.length > 0 ? (
            incidentStats.by_state_details.map((stateDetail) => (
              <TouchableOpacity
                style={styles.detailsCard}
                key={stateDetail.id}
                onPress={() => router.push({
                  pathname: '/(tabs)/incident',
                  params: { state_id: stateDetail.id, state_name: stateDetail.name }
                })}
              >
                <View style={[styles.detailsCardBar, { backgroundColor: '#FF6F00' }]} />
                <View style={styles.detailsCardContent}>
                  <Text style={styles.detailsCardTitle}>{stateDetail.name}</Text>
                  <Text style={styles.detailsCardNumber}>{stateDetail.count}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
            ))
          ) : incidentStats?.by_state && Object.keys(incidentStats.by_state).length > 0 ? (
            // Fallback to by_state (non-clickable since we don't have IDs)
            Object.entries(incidentStats.by_state).map(([status, count]) => (
              <View style={styles.detailsCard} key={status}>
                <View style={[styles.detailsCardBar, { backgroundColor: '#FF6F00' }]} />
                <View style={styles.detailsCardContent}>
                  <Text style={styles.detailsCardTitle}>{status}</Text>
                  <Text style={styles.detailsCardNumber}>{String(count)}</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.detailsCard}>
              <View style={styles.detailsCardContent}>
                <Text style={styles.detailsCardTitle}>No states available</Text>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1A237E', // Reverted to original
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5', // Reverted to original
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 20,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    padding: 20,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    color: '#666',
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  totalIncidents: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  totalIncidentsNumber: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  totalIncidentsChange: {
    fontSize: 16,
    color: 'green',
    marginLeft: 10,
    marginBottom: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  myIncidentsContainer: {
    marginBottom: 20,
    gap: 10,
  },
  myIncidentCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  myIncidentIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  myIncidentText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  detailsCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  detailsCardBar: {
    width: 4,
    height: '100%',
    backgroundColor: '#3498DB',
    borderRadius: 2,
    marginRight: 15,
  },
  detailsCardContent: {
    flex: 1,
  },
  detailsCardTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  detailsCardNumber: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  detailsCardChangePositive: {
    color: 'green',
    fontWeight: 'bold',
  },
  detailsCardChangeNegative: {
    color: 'red',
    fontWeight: 'bold',
  },
});

export default DashboardScreen;

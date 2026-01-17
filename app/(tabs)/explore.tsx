import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ImageBackground, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import { getIncidentStats } from '@/src/api/incidents';

const DashboardScreen = () => {
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
                    <Text style={styles.headerTitle}>Dashboard!</Text>
                    <TouchableOpacity>
                        <FontAwesome name="bell" size={24} color="white" />
                    </TouchableOpacity>
                </ImageBackground>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#1A237E" />
                    <Text>Loading statistics...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (errorStats) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <ImageBackground source={require('@/assets/images/background.png')} style={styles.header}>
                    <Text style={styles.headerTitle}>Dashboard!</Text>
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
          <Text style={styles.headerTitle}>Dashboard!</Text>
          <TouchableOpacity>
            <FontAwesome name="bell" size={24} color="white" />
          </TouchableOpacity>
        </ImageBackground>

        {/* Main Content */}
        <ScrollView style={styles.content}>
          {/* Total Incidents Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Total Incidents</Text>
            <View style={styles.cardBody}>
              <View style={styles.totalIncidents}>
                <Text style={styles.totalIncidentsNumber}>{incidentStats?.total || 0}</Text>
                {/* <Text style={styles.totalIncidentsChange}>(+23)</Text> */}
              </View>
              <Ionicons name="stats-chart" size={32} color="#1A237E" />
            </View>
          </View>

          {/* Incidents Details Section */}
          <Text style={styles.sectionTitle}>Incidents by Status</Text>

          {incidentStats?.by_state && Object.entries(incidentStats.by_state).map(([status, count]) => (
            <View style={styles.detailsCard} key={status}>
              <View style={[styles.detailsCardBar, { backgroundColor: '#FF6F00' }]} />
              <View style={styles.detailsCardContent}>
                <Text style={styles.detailsCardTitle}>{status}</Text>
                <Text style={styles.detailsCardNumber}>{count}</Text>
              </View>
              {/* <Text style={styles.detailsCardChangeNegative}>(-10) ▼</Text> */}
            </View>
          ))}
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

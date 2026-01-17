import { getIncidents } from '@/src/api/incidents';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ImageBackground, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const priorityMap = {
    1: { text: 'Critical', color: '#E74C3C' },
    2: { text: 'High', color: '#E67E22' },
    3: { text: 'Medium', color: '#F1C40F' },
    4: { text: 'Low', color: '#3498DB' },
    5: { text: 'Very Low', color: '#2ECC71' },
};

const IncidentCard = ({ incident, isLast = false }) => {
  const router = useRouter();
  const priority = priorityMap[incident.priority] || { text: 'Unknown', color: '#95A5A6' };

  return (
    <TouchableOpacity
      style={[styles.incidentCard, isLast && { marginBottom: 100 }]}
      onPress={() => router.push(`/incident-details?id=${incident.id}`)}
    >
      <View style={[styles.incidentPriorityBar, { backgroundColor: priority.color }]} />
      <View style={styles.incidentCardContent}>
        <View style={styles.incidentCardHeader}>
          <View style={styles.incidentIdContainer}>
            <View style={[styles.incidentDot, { backgroundColor: priority.color }]} />
            <Text style={styles.incidentId}>{incident.incident_number}</Text>
          </View>
          <Text style={[styles.incidentTag, { backgroundColor: priority.color }]}>
            {priority.text}
          </Text>
        </View>
        <Text style={styles.incidentDateTime}>{new Date(incident.created_at).toLocaleString()}</Text>
        <Text style={styles.incidentStatus}>Status: {incident.current_state?.name || 'N/A'}</Text>
        <View style={styles.incidentDetailRow}>
          <Ionicons name="alert-circle" size={16} color="#E74C3C" style={{ marginRight: 5 }} />
          <Text style={styles.incidentDetailText}>{incident.title}</Text>
        </View>
        <View style={styles.incidentDetailRow}>
          <Ionicons name="location-sharp" size={16} color="#3498DB" style={{ marginRight: 5 }} />
          <Text style={styles.incidentDetailText}>{incident.location?.name || 'No location'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const IncidentsScreen = () => {
  const router = useRouter();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState(null);

  const fetchIncidents = async () => {
    setLoading(true);
    const response = await getIncidents();
    if (response.success) {
      setIncidents(response.data);
      setPagination(response.pagination);
    } else {
      setError(response.error);
      Alert.alert('Error', 'Failed to fetch incidents.');
    }
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchIncidents();
    }, [])
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ImageBackground source={require('@/assets/images/background.png')} style={styles.header}>
        <TouchableOpacity style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>All Incidents</Text>
          <Ionicons name="chevron-down" size={20} color="white" />
        </TouchableOpacity>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="location-outline" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="search-outline" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon} onPress={() => router.push('/filter')}>
            <FontAwesome name="filter" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </ImageBackground>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView}>
          <View style={styles.content}>
            <Text style={styles.incidentsFoundText}>{`${pagination?.total || 0} Incidents found`}</Text>
            {incidents.map((incident, index) => (
              <IncidentCard key={incident.id} incident={incident} isLast={index === incidents.length - 1} />
            ))}
          </View>
        </ScrollView>
      )}

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={() => router.push('/add-incident')}>
        <FontAwesome name="plus" size={24} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1A237E',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  errorText: {
    color: 'red',
    fontSize: 16,
  },
  header: {
    paddingHorizontal: 15,
    paddingTop: 40, // Consistent with explore.tsx
    paddingBottom: 20, // Consistent with explore.tsx
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 5,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 10,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginRight: 5,
  },
  headerIcons: {
    flexDirection: 'row',
  },
  headerIcon: {
    marginLeft: 15,
    padding: 5,
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    padding: 15,
  },
  incidentsFoundText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
  },
  incidentCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  incidentPriorityBar: {
    width: 5,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },
  incidentCardContent: {
    flex: 1,
    padding: 15,
  },
  incidentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  incidentIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  incidentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  incidentId: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  incidentTag: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  incidentDateTime: {
    fontSize: 12,
    color: '#999',
    marginBottom: 10,
  },
  incidentStatus: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  incidentDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  incidentDetailText: {
    fontSize: 14,
    color: '#555',
    flexShrink: 1,
  },
  fab: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2EC4B6',
    justifyContent: 'center',
    alignItems: 'center',
    bottom: 90,
    right: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
});

export default IncidentsScreen;

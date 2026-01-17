import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome, Ionicons } from '@expo/vector-icons';

const FilterOption = ({ label, isDate = false }) => (
  <TouchableOpacity style={styles.option}>
    <Text style={styles.optionLabel}>{label}</Text>
    <FontAwesome name={isDate ? 'calendar' : 'chevron-down'} size={16} color="#666" />
  </TouchableOpacity>
);

const FilterScreen = () => {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Filter</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close-circle" size={28} color="#E74C3C" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.optionsContainer}>
        <FilterOption label="Status" />
        <FilterOption label="Location" />
        <FilterOption label="Classification" />
        <FilterOption label="From Date" isDate />
        <FilterOption label="To Date" isDate />
        <FilterOption label="Priority" />
        <FilterOption label="Incident Source" />
        <FilterOption label="Department" />
        <FilterOption label="Assignee" />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.resetButton}>
          <Text style={styles.resetButtonText}>Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterButton}>
          <Text style={styles.filterButtonText}>FILTER</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  optionsContainer: {
    flex: 1,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  optionLabel: {
    fontSize: 16,
    color: '#333',
  },
  footer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    paddingTop: 15,
  },
  resetButton: {
    flex: 1,
    padding: 15,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  filterButton: {
    flex: 1,
    backgroundColor: '#2EC4B6',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  filterButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
});

export default FilterScreen;

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator, Alert, ImageBackground } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { logout } from '@/src/api/auth';
import { getProfile } from '@/src/api/user';

const SettingsOption = ({ label, hasDropdown = false, value, onPress }) => (
  <TouchableOpacity style={styles.option} onPress={onPress}>
    <Text style={styles.optionLabel}>{label}</Text>
    <View style={styles.optionValueContainer}>
      {value && <Text style={styles.optionValue}>{value}</Text>}
      <FontAwesome name={hasDropdown ? 'chevron-down' : 'chevron-right'} size={16} color="#999" />
    </View>
  </TouchableOpacity>
);

const SettingsScreen = () => {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useFocusEffect(
      useCallback(() => {
        const fetchProfile = async () => {
          setLoading(true);
          const response = await getProfile();
          if (response.success) {
            setUser(response.data);
          } else {
            Alert.alert('Error', 'Failed to fetch profile.');
          }
          setLoading(false);
        };
        fetchProfile();
      }, [])
    );

    const handleLogout = async () => {
        await logout();
        router.replace('/login');
    };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ImageBackground source={require('@/assets/images/background.png')} style={styles.header}>
        <Text style={styles.headerTitle}>Setting</Text>
      </ImageBackground>
      <ScrollView style={styles.container}>
        {/* User Profile */}
        {loading ? (
          <ActivityIndicator style={styles.profileCard} />
        ) : (
          <TouchableOpacity style={styles.profileCard} onPress={() => router.push('/edit-profile')}>
            <View>
              <Text style={styles.profileName}>{user ? `${user.first_name} ${user.last_name}` : 'User'}</Text>
              <Text style={styles.profileEmail}>{user?.email || 'No email'}</Text>
            </View>
            <FontAwesome name="chevron-right" size={16} color="#999" />
          </TouchableOpacity>
        )}

        {/* Options */}
        <SettingsOption label="Change Password" onPress={() => router.push('/change-password')} />
        <SettingsOption label="Change Language" hasDropdown value="English" />

        {/* Log Buttons */}
        <View style={styles.logButtonsContainer}>
          <TouchableOpacity style={styles.logButton}>
            <Text style={styles.logButtonText}>Share logs</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logButton}>
            <Text style={styles.logButtonText}>Delete logs</Text>
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.versionText}>V.3.01</Text>
      </ScrollView>
    </SafeAreaView>
  );
};



const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1A237E', // Reverted to original
  },
  header: {
    paddingTop: 40, // Consistent with explore.tsx
    paddingBottom: 20, // Consistent with explore.tsx
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  profileCard: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
  },
  option: {
    backgroundColor: 'white',
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 1, // To create the separator effect
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionLabel: {
    fontSize: 16,
  },
  optionValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionValue: {
    marginRight: 10,
    fontSize: 16,
    color: '#666',
  },
  logButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    margin: 20,
  },
  logButton: {
    backgroundColor: 'white',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
  },
  logButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333'
  },
  logoutButton: {
    backgroundColor: 'white',
    padding: 20,
    marginHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E74C3C',
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E74C3C',
  },
  versionText: {
    textAlign: 'center',
    margin: 20,
    color: '#999',
  },
});

export default SettingsScreen;


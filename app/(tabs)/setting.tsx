import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator, Alert, ImageBackground, Modal, I18nManager } from 'react-native';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Updates from 'expo-updates';
import { logout } from '@/src/api/auth';
import { getProfile } from '@/src/api/user';
import { setLanguage, supportedLanguages, getCurrentLanguage } from '@/src/i18n';

const SettingsOption = ({ label, hasDropdown = false, value, onPress, icon }: {
  label: string;
  hasDropdown?: boolean;
  value?: string;
  onPress?: () => void;
  icon?: string;
}) => (
  <TouchableOpacity style={styles.option} onPress={onPress}>
    <View style={styles.optionLeft}>
      {icon && <Ionicons name={icon as any} size={20} color="#1A237E" style={styles.optionIcon} />}
      <Text style={styles.optionLabel}>{label}</Text>
    </View>
    <View style={styles.optionValueContainer}>
      {value && <Text style={styles.optionValue}>{value}</Text>}
      <FontAwesome name={hasDropdown ? 'chevron-down' : 'chevron-right'} size={16} color="#999" />
    </View>
  </TouchableOpacity>
);

const SettingsScreen = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [currentLang, setCurrentLang] = useState(getCurrentLanguage());

  useFocusEffect(
    useCallback(() => {
      const fetchProfile = async () => {
        setLoading(true);
        const response = await getProfile();
        if (response.success) {
          setUser(response.data);
        } else {
          Alert.alert(t('common.error'), t('errors.unknownError'));
        }
        setLoading(false);
      };
      fetchProfile();
      setCurrentLang(getCurrentLanguage());
    }, [])
  );

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const handleLanguageChange = async (langCode: string) => {
    if (langCode === currentLang) {
      setLanguageModalVisible(false);
      return;
    }

    setLanguageModalVisible(false);

    try {
      await setLanguage(langCode);
      setCurrentLang(langCode);

      // Always prompt for restart when changing language (RTL changes require restart)
      Alert.alert(
        langCode === 'ar' ? 'نجاح' : 'Success',
        langCode === 'ar'
          ? 'تم تغيير اللغة. سيتم إعادة تشغيل التطبيق لتطبيق التغييرات.'
          : 'Language changed. The app will restart to apply changes.',
        [
          {
            text: langCode === 'ar' ? 'موافق' : 'OK',
            onPress: async () => {
              try {
                await Updates.reloadAsync();
              } catch {
                // If Updates.reloadAsync fails, just notify user to restart manually
                Alert.alert(
                  langCode === 'ar' ? 'إعادة التشغيل مطلوبة' : 'Restart Required',
                  langCode === 'ar'
                    ? 'يرجى إغلاق التطبيق وإعادة فتحه لتطبيق تغييرات اللغة.'
                    : 'Please close and reopen the app to apply language changes.'
                );
              }
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert(t('common.error'), t('errors.unknownError'));
    }
  };

  const getCurrentLanguageName = () => {
    const lang = supportedLanguages.find(l => l.code === currentLang);
    return lang?.nativeName || 'English';
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ImageBackground source={require('@/assets/images/background.png')} style={styles.header}>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
      </ImageBackground>
      <ScrollView style={styles.container}>
        {/* User Profile */}
        {loading ? (
          <ActivityIndicator style={styles.profileCard} />
        ) : (
          <TouchableOpacity style={styles.profileCard} onPress={() => router.push('/edit-profile')}>
            <View style={styles.profileInfo}>
              <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>
                  {user?.first_name?.[0] || user?.username?.[0] || 'U'}
                </Text>
              </View>
              <View>
                <Text style={styles.profileName}>
                  {user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username : 'User'}
                </Text>
                <Text style={styles.profileEmail}>{user?.email || 'No email'}</Text>
              </View>
            </View>
            <FontAwesome name="chevron-right" size={16} color="#999" />
          </TouchableOpacity>
        )}

        {/* Options Section */}
        <Text style={styles.sectionTitle}>{t('settings.profile')}</Text>
        <View style={styles.optionsContainer}>
          <SettingsOption
            label={t('settings.editProfile')}
            icon="person-outline"
            onPress={() => router.push('/edit-profile')}
          />
          <SettingsOption
            label={t('settings.changePassword')}
            icon="lock-closed-outline"
            onPress={() => router.push('/change-password')}
          />
        </View>

        <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
        <View style={styles.optionsContainer}>
          <SettingsOption
            label={t('settings.changeLanguage')}
            icon="language-outline"
            value={getCurrentLanguageName()}
            hasDropdown
            onPress={() => setLanguageModalVisible(true)}
          />
        </View>

        {/* Log Buttons */}
        <View style={styles.logButtonsContainer}>
          <TouchableOpacity style={styles.logButton}>
            <Ionicons name="share-outline" size={20} color="#1A237E" />
            <Text style={styles.logButtonText}>{t('settings.shareLogs')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logButton}>
            <Ionicons name="trash-outline" size={20} color="#E74C3C" />
            <Text style={[styles.logButtonText, { color: '#E74C3C' }]}>{t('settings.deleteLogs')}</Text>
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#E74C3C" />
          <Text style={styles.logoutButtonText}>{t('auth.logout')}</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.versionText}>{t('settings.version')} 3.01</Text>
      </ScrollView>

      {/* Language Selection Modal */}
      <Modal
        visible={languageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setLanguageModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('settings.changeLanguage')}</Text>
            {supportedLanguages.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.languageOption,
                  currentLang === lang.code && styles.languageOptionSelected
                ]}
                onPress={() => handleLanguageChange(lang.code)}
              >
                <View style={styles.languageInfo}>
                  <Text style={[
                    styles.languageName,
                    currentLang === lang.code && styles.languageNameSelected
                  ]}>
                    {lang.nativeName}
                  </Text>
                  <Text style={styles.languageNameEn}>{lang.name}</Text>
                </View>
                {currentLang === lang.code && (
                  <Ionicons name="checkmark-circle" size={24} color="#1A237E" />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setLanguageModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1A237E',
  },
  header: {
    paddingTop: 40,
    paddingBottom: 20,
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
    marginBottom: 10,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1A237E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  optionsContainer: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  option: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionIcon: {
    marginRight: 12,
  },
  optionLabel: {
    fontSize: 16,
    color: '#333',
  },
  optionValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionValue: {
    marginRight: 10,
    fontSize: 14,
    color: '#666',
  },
  logButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 30,
    gap: 15,
  },
  logButton: {
    flex: 1,
    backgroundColor: 'white',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  logButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A237E',
  },
  logoutButton: {
    backgroundColor: 'white',
    padding: 16,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E74C3C',
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E74C3C',
  },
  versionText: {
    textAlign: 'center',
    marginVertical: 30,
    color: '#999',
    fontSize: 14,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: '#F5F5F5',
  },
  languageOptionSelected: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#1A237E',
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  languageNameSelected: {
    color: '#1A237E',
  },
  languageNameEn: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  modalCancelButton: {
    marginTop: 10,
    padding: 14,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
});

export default SettingsScreen;

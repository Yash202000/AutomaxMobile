import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, ImageBackground, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Updates from 'expo-updates';
import { getProfile } from '@/src/api/user';
import { useAuth } from '@/src/context/AuthContext';
import { setLanguage, supportedLanguages, getCurrentLanguage } from '@/src/i18n';

const COLORS = {
  primary: '#2EC4B6',
  secondary: '#1A237E',
  background: '#F5F5F5',
  card: '#FFFFFF',
  text: '#333333',
  textSecondary: '#666666',
  textMuted: '#999999',
  border: '#F0F0F0',
  error: '#E74C3C',
  white: '#FFFFFF',
};

const SettingsOption = ({ label, hasDropdown = false, value, onPress, icon }: {
  label: string;
  hasDropdown?: boolean;
  value?: string;
  onPress?: () => void;
  icon?: string;
}) => (
  <TouchableOpacity style={styles.option} onPress={onPress}>
    <View style={styles.optionLeft}>
      {icon && <Ionicons name={icon as any} size={20} color={COLORS.secondary} style={styles.optionIcon} />}
      <Text style={styles.optionLabel}>{label}</Text>
    </View>
    <View style={styles.optionValueContainer}>
      {value && <Text style={styles.optionValue}>{value}</Text>}
      <Ionicons name={hasDropdown ? 'chevron-down' : 'chevron-forward'} size={18} color={COLORS.textMuted} />
    </View>
  </TouchableOpacity>
);

const SettingsScreen = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { logout } = useAuth();
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
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
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
            <Ionicons name="share-outline" size={20} color={COLORS.secondary} />
            <Text style={styles.logButtonText}>{t('settings.shareLogs')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logButton}>
            <Ionicons name="trash-outline" size={20} color={COLORS.error} />
            <Text style={[styles.logButtonText, { color: COLORS.error }]}>{t('settings.deleteLogs')}</Text>
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
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
                  <Ionicons name="checkmark-circle" size={24} color={COLORS.secondary} />
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
    backgroundColor: COLORS.secondary,
  },
  header: {
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: 'bold',
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  profileCard: {
    backgroundColor: COLORS.card,
    padding: 20,
    margin: 20,
    marginBottom: 10,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: 'bold',
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  profileEmail: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  optionsContainer: {
    backgroundColor: COLORS.card,
    marginHorizontal: 20,
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  option: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
    color: COLORS.text,
  },
  optionValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionValue: {
    marginRight: 10,
    fontSize: 14,
    color: COLORS.textSecondary,
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
    backgroundColor: COLORS.card,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  logButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  logoutButton: {
    backgroundColor: COLORS.card,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.error,
  },
  versionText: {
    textAlign: 'center',
    marginVertical: 30,
    color: COLORS.textMuted,
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
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
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
    backgroundColor: COLORS.background,
  },
  languageOptionSelected: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: COLORS.secondary,
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  languageNameSelected: {
    color: COLORS.secondary,
  },
  languageNameEn: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  modalCancelButton: {
    marginTop: 10,
    padding: 14,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
});

export default SettingsScreen;

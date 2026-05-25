import { getProfile } from '@/src/api/user';
import { useAuth } from '@/src/context/AuthContext';
import { getCurrentLanguage, setLanguage, supportedLanguages } from '@/src/i18n';
import { crashLogger } from '@/src/utils/crashLogger';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as Updates from 'expo-updates';
import { t } from 'i18next';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, ImageBackground, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CustomAlert } from '@/src/components/CustomAlert';


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
      <Ionicons name={hasDropdown ? 'chevron-down' : t('common.icons.chevronForward') as any} size={18} color={COLORS.textMuted} />
    </View>
  </TouchableOpacity>
);

const SettingsToggle = ({ label, description, value, onValueChange, icon }: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  icon?: string;
}) => (
  <View style={styles.option}>
    <View style={[styles.optionLeft, { flex: 1 }]}>
      {icon && <Ionicons name={icon as any} size={20} color={COLORS.secondary} style={styles.optionIcon} />}
      <View>
        <Text style={styles.optionLabel}>{label}</Text>
        {description && <Text style={styles.optionDescription}>{description}</Text>}
      </View>
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: '#D1D1D1', true: COLORS.primary }}
      thumbColor={Platform.OS === 'ios' ? undefined : '#FFFFFF'}
    />
  </View>
);

const SettingsScreen = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { logout } = useAuth();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [currentLang, setCurrentLang] = useState(getCurrentLanguage());
  const [logFileSize, setLogFileSize] = useState<string>('0 KB');
  const [hasLogs, setHasLogs] = useState(false);
  const [sharingLogs, setSharingLogs] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const loadLogInfo = useCallback(async () => {
    try {
      const size = await crashLogger.getLogFileSize();
      const logsExist = await crashLogger.hasLogs();
      setLogFileSize(size);
      setHasLogs(logsExist);
    } catch (error) {
      console.error('Failed to load log info:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const fetchProfile = async () => {
        setLoading(true);
        const response = await getProfile();
        if (response.success) {
          setUser(response.data);
        } else {
          CustomAlert.alert(t('common.error'), t('errors.unknownError'));
        }
        setLoading(false);
      };

      const loadNotificationSettings = async () => {
        try {
          const value = await AsyncStorage.getItem('notificationsEnabled');
          if (value !== null) {
            setNotificationsEnabled(value === 'true');
          }
        } catch (error) {
          console.error('Failed to load notification settings:', error);
        }
      };

      fetchProfile();
      loadNotificationSettings();
      setCurrentLang(getCurrentLanguage());
      loadLogInfo();
    }, [loadLogInfo])
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

      // Use native Alert (not CustomAlert/Modal) — on iOS, calling reloadAsync()
      // while a React Native Modal is still animating silently aborts the reload,
      // so RTL never gets applied. Native Alert has no such conflict.
      Alert.alert(
        t('settings.langChangeTitle'),
        t('settings.langChangeMessage'),
        [
          {
            text: t('common.ok'),
            onPress: () => {
              // On iOS, wait for the native alert to fully dismiss before reloading.
              setTimeout(async () => {
                try {
                  await Updates.reloadAsync();
                } catch {
                  Alert.alert(
                    t('settings.restartRequired'),
                    t('settings.restartMessage')
                  );
                }
              }, Platform.OS === 'ios' ? 500 : 0);
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

  const handleShareLogs = async () => {
    if (!hasLogs) {
      CustomAlert.alert(t('settings.logs.noLogs'), t('settings.logs.noLogsDescription'));
      return;
    }

    setSharingLogs(true);

    try {
      const logFileUri = await crashLogger.getLogFileUri();

      if (!logFileUri) {
        CustomAlert.alert(t('common.error'), t('settings.logs.failedToShare'));
        setSharingLogs(false);
        return;
      }

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        CustomAlert.alert(
          t('common.error'),
          t('settings.logs.sharingNotAvailable')
        );
        setSharingLogs(false);
        return;
      }

      // Share the log file
      await Sharing.shareAsync(logFileUri, {
        mimeType: 'text/plain',
        dialogTitle: 'Share App Logs',
        UTI: 'public.plain-text',
      });

      setSharingLogs(false);
    } catch (error) {
      console.error('Failed to share logs:', error);
      CustomAlert.alert(
        t('common.error'),
        t('settings.logs.failedToShare')
      );
      setSharingLogs(false);
    }
  };

  const handleDeleteLogs = async () => {
    if (!hasLogs) {
      CustomAlert.alert(t('settings.logs.noLogs'), t('settings.logs.noLogsDescription'));
      return;
    }

    CustomAlert.alert(
      t('settings.logs.deleteConfirmTitle'),
      t('settings.logs.deleteConfirmMessage'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await crashLogger.clearLogs();
              if (success) {
                CustomAlert.alert(t('common.success'), t('settings.logs.logsDeleted'));
                await loadLogInfo();
              } else {
                CustomAlert.alert(t('common.error'), t('settings.logs.failedToDelete'));
              }
            } catch (error) {
              console.error('Failed to delete logs:', error);
              CustomAlert.alert(t('common.error'), t('settings.logs.failedToDelete'));
            }
          },
        },
      ]
    );
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
                  {user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username : t('common.user', 'User')}
                </Text>
                <Text style={styles.profileEmail}>{user?.email || t('profile.noEmail')}</Text>
              </View>
            </View>
            <Ionicons name={t('common.icons.chevronForward') as any} size={18} color={COLORS.textMuted} />
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

        <Text style={styles.sectionTitle}>{t('notifications.title')}</Text>
        <View style={styles.optionsContainer}>
          <SettingsToggle
            label={t('notifications.toggle')}
            description={t('notifications.toggleDescription')}
            icon="notifications-outline"
            value={notificationsEnabled}
            onValueChange={async (value) => {
              setNotificationsEnabled(value);
              try {
                await AsyncStorage.setItem('notificationsEnabled', value.toString());
              } catch (error) {
                console.error('Failed to save notification settings:', error);
              }
            }}
          />
        </View>

        {/* Log Buttons */}
        <Text style={styles.sectionTitle}>{t('settings.diagnostics')}</Text>
        <View style={styles.logInfoContainer}>
          <View style={styles.logInfoRow}>
            <Ionicons name="document-text-outline" size={18} color={COLORS.textSecondary} />
            <Text style={styles.logInfoLabel}>{t('settings.logs.fileSize')}</Text>
            <Text style={styles.logInfoValue}>{logFileSize}</Text>
          </View>
          <View style={styles.logInfoRow}>
            <Ionicons name="albums-outline" size={18} color={COLORS.textSecondary} />
            <Text style={styles.logInfoLabel}>{t('settings.logs.status')}</Text>
            <Text style={[styles.logInfoValue, { color: hasLogs ? COLORS.primary : COLORS.textMuted }]}>
              {hasLogs ? t('settings.logs.available') : t('settings.logs.empty')}
            </Text>
          </View>
        </View>
        <View style={styles.logButtonsContainer}>
          <TouchableOpacity
            style={[styles.logButton, (!hasLogs || sharingLogs) && styles.logButtonDisabled]}
            onPress={handleShareLogs}
            disabled={!hasLogs || sharingLogs}
          >
            {sharingLogs ? (
              <ActivityIndicator size="small" color={COLORS.secondary} />
            ) : (
              <Ionicons name="share-outline" size={20} color={hasLogs ? COLORS.secondary : COLORS.textMuted} />
            )}
            <Text style={[styles.logButtonText, (!hasLogs || sharingLogs) && styles.logButtonTextDisabled]}>
              {t('settings.shareLogs')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.logButton, !hasLogs && styles.logButtonDisabled]}
            onPress={handleDeleteLogs}
            disabled={!hasLogs}
          >
            <Ionicons name="trash-outline" size={20} color={hasLogs ? COLORS.error : COLORS.textMuted} />
            <Text style={[styles.logButtonText, { color: hasLogs ? COLORS.error : COLORS.textMuted }]}>
              {t('settings.deleteLogs')}
            </Text>
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
    </SafeAreaView >
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
  optionDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
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
  logInfoContainer: {
    backgroundColor: COLORS.card,
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 12,
    padding: 16,
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
  logInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  logInfoLabel: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 12,
  },
  logInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  logButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 20,
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
  logButtonDisabled: {
    opacity: 0.5,
  },
  logButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  logButtonTextDisabled: {
    color: COLORS.textMuted,
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

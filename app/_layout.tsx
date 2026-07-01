import '@/src/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFCM } from '@/hooks/use-FCM';
import { registerToken } from '@/src/api/notifications';
import { CustomAlertComponent } from '@/src/components/CustomAlert';
import ErrorBoundary from '@/src/components/ErrorBoundary';
import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import i18n from '@/src/i18n';
import FCMService from '@/src/services/fcm.service';
import { createChannel } from '@/src/services/notification.channel';
import { crashLogger, setupGlobalErrorHandlers } from '@/src/utils/crashLogger';
import { Ionicons } from '@expo/vector-icons';
import { t } from 'i18next';




function BiometricLockScreen({
  onSuccess,
  onLogout,
}: {
  onSuccess: () => void;
  onLogout: () => void;
}) {
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const triggerAuth = async () => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    setAuthError('');

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const enrolledLevel = await LocalAuthentication.getEnrolledLevelAsync();

      // EnrolledLevel.NONE === 0. This means no biometric and no passcode/PIN is set.
      if (enrolledLevel === LocalAuthentication.SecurityLevel.NONE) {
        console.log('No authentication method is configured on this device. Bypassing lock.');
        onSuccess();
        return;
      }

      if (!hasHardware || !isEnrolled) {
        console.log('Biometrics not fully supported or enrolled, falling back to passcode');
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: i18n.language === 'ar' ? 'قم بتأكيد هويتك للمتابعة' : 'Confirm your identity to continue',
        fallbackLabel: i18n.language === 'ar' ? 'استخدام رمز المرور' : 'Use Passcode',
        cancelLabel: i18n.language === 'ar' ? 'إلغاء' : 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        onSuccess();
      } else {
        setAuthError(
          result.warning || (i18n.language === 'ar' ? 'فشلت عملية التحقق. يرجى المحاولة مرة أخرى.' : 'Authentication failed. Please try again.')
        );
      }
    } catch (err) {
      console.error('Biometric authentication error:', err);
      setAuthError(
        i18n.language === 'ar' ? 'حدث خطأ أثناء التحقق.' : 'An error occurred during authentication.'
      );
    } finally {
      setIsAuthenticating(false);
    }
  };

  useEffect(() => {
    triggerAuth();
  }, []);

  const isAr = i18n.language === 'ar';

  return (
    <View style={[StyleSheet.absoluteFill, styles.lockContainer]}>
      <LinearGradient
        colors={['#1A237E', '#0D1B2A']}
        style={styles.lockGradient}
      >
        <View style={styles.lockCircle1} />
        <View style={styles.lockCircle2} />

        <View style={styles.lockContent}>
          <View style={styles.lockIconContainer}>
            <Ionicons name="lock-closed" size={48} color="#2EC4B6" />
          </View>

          <Text style={styles.lockTitle}>
            {isAr ? 'التطبيق مقفل' : 'App Locked'}
          </Text>

          <Text style={styles.lockSubtitle}>
            {isAr
              ? 'يرجى تأكيد الهوية باستخدام البصمة أو رمز مرور الهاتف للمتابعة'
              : 'Please confirm your identity using biometrics or your phone passcode to continue'}
          </Text>

          {authError ? (
            <View style={styles.lockErrorContainer}>
              <Ionicons name="alert-circle" size={18} color="#E74C3C" />
              <Text style={styles.lockErrorText}>{authError}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.unlockButton}
            onPress={triggerAuth}
            disabled={isAuthenticating}
          >
            <Ionicons name="finger-print" size={24} color="white" style={{ marginRight: isAr ? 0 : 8, marginLeft: isAr ? 8 : 0 }} />
            <Text style={styles.unlockButtonText}>
              {isAuthenticating
                ? (isAr ? 'جاري التحقق...' : 'Verifying...')
                : (isAr ? 'إلغاء القفل' : 'Unlock App')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.lockLogoutButton}
            onPress={onLogout}
          >
            <Ionicons name="log-out-outline" size={20} color="#94A3B8" style={{ marginRight: isAr ? 0 : 8, marginLeft: isAr ? 8 : 0 }} />
            <Text style={styles.lockLogoutText}>
              {isAr ? 'تسجيل الخروج' : 'Sign Out'}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, isLoading, user, isLoggingOut, requiresBiometric, setRequiresBiometric, logout } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  useFCM(router);

  useEffect(() => {
    if (isLoading || isLoggingOut) return;

    const authScreens = ['login', 'forgot-password', 'otp', 'reset-password'];
    const inAuthGroup = authScreens.includes(segments[0] as string);

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login if not authenticated and not in auth group
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup && segments[0] !== 'otp') {
      // Redirect to tabs if authenticated and in auth group (except OTP)
      const isViewerApp = process.env.EXPO_PUBLIC_VIEWER_APP === 'true';
      const viewerRoles = (process.env.EXPO_PUBLIC_VIEWER_APP_ROLES || '').split(',');
      const isViewerRole = user?.roles?.some(role => viewerRoles.includes(role.code)) ?? false;
      const isViewerMode = isViewerApp && isViewerRole;

      if (isViewerMode) {
        router.replace('/(tabs)/incident');
      } else {
        router.replace('/(tabs)/explore');
      }
    }
  }, [isAuthenticated, isLoading, segments, isLoggingOut, user]);

  useEffect(() => {
    createChannel();
  }, []);

  // Register FCM token with backend only after the user is authenticated
  useEffect(() => {
    if (!isAuthenticated || isLoggingOut) return;
    const setup = async () => {
      // Check if notifications are enabled
      const enabled = await AsyncStorage.getItem('notificationsEnabled');
      if (enabled === 'false') {
        console.log("[FCM] Notifications are disabled, skipping registration.");
        return;
      }

      const token = await FCMService.init();
      if (!token) return;
      const p = {
        device_token: token,
        device_type: Platform.OS.toLowerCase(),
        user_id: user?.id || ''
      }
      console.log("[FCM] Registering token with payload:", p);
      const result = await registerToken(p);
      console.log("[FCM] Token registration result:", result);

      // Listen for token refresh
      const unsubscribeTokenRefresh = FCMService.onTokenRefresh((newToken) => {
        registerToken({
          device_token: newToken,
          device_type: Platform.OS.toLowerCase(),
          user_id: user?.id || ''
        });
      });

      return () => {
        unsubscribeTokenRefresh();
      };
    };

    const cleanup = setup().catch(err => console.warn('[FCM] Token setup failed:', err));
    return () => {
      cleanup.then(unsub => unsub && unsub());
    };
  }, [isAuthenticated, user?.id, isLoggingOut]);


  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: i18n.language === 'ar' ? 0 : 4, marginRight: i18n.language === 'ar' ? 4 : 0 }}>
            <Ionicons
              name={t('common.icons.chevronBack') as any}
              size={28}
              color="#333"
            />
          </TouchableOpacity>
        ),
        headerBackVisible: false,
        headerTitleAlign: 'center'
      }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ title: '' }} />
        <Stack.Screen name="otp" options={{ title: '' }} />
        <Stack.Screen name="reset-password" options={{ title: '' }} />
        <Stack.Screen name="incident-details" options={{ headerShown: false }} />
        <Stack.Screen name="add-incident" options={{ headerShown: false }} />
        <Stack.Screen name="my-incidents" options={{ headerShown: false }} />
        <Stack.Screen name="map-view" options={{ headerShown: false }} />
        <Stack.Screen name="request-details" options={{ headerShown: false }} />
        <Stack.Screen name="add-request" options={{ headerShown: false }} />
        <Stack.Screen name="complaint-details" options={{ headerShown: false }} />
        <Stack.Screen name="add-complaint" options={{ headerShown: false }} />
        <Stack.Screen name="query-details" options={{ headerShown: false }} />
        <Stack.Screen name="add-query" options={{ headerShown: false }} />
        <Stack.Screen name="edit-profile" options={{ title: t('settings.editProfile'), headerTitle: '' }} />
        <Stack.Screen name="change-password" options={{ title: t('settings.changePassword') }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="filter" options={{ presentation: 'transparentModal', headerShown: false }} />
        <Stack.Screen name="complaint-filter" options={{ presentation: 'transparentModal', headerShown: false }} />
        <Stack.Screen name="request-filter" options={{ presentation: 'transparentModal', headerShown: false }} />
        <Stack.Screen name="query-filter" options={{ presentation: 'transparentModal', headerShown: false }} />
        <Stack.Screen name="update-status" options={{ presentation: 'transparentModal', headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: t('common.modal', 'Modal') }} />
      </Stack>
      {(isLoading || isLoggingOut) && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colorScheme === 'dark' ? '#000' : '#FFF', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }]}>
          <ActivityIndicator size="large" color="#2EC4B6" />
        </View>
      )}
      {isAuthenticated && requiresBiometric && (
        <BiometricLockScreen
          onSuccess={() => setRequiresBiometric(false)}
          onLogout={() => logout()}
        />
      )}
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Initialize crash logger and global error handlers
    const initializeCrashLogger = async () => {
      try {
        await crashLogger.initialize();
        setupGlobalErrorHandlers();
      } catch (error) {
        console.error('[App] Failed to initialize crash logger:', error);
      }
    };

    initializeCrashLogger();
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
      <CustomAlertComponent />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  lockContainer: {
    zIndex: 2000,
    backgroundColor: '#0D1B2A',
  },
  lockGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  lockCircle1: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(46, 196, 182, 0.08)',
  },
  lockCircle2: {
    position: 'absolute',
    bottom: -150,
    left: -150,
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: 'rgba(46, 196, 182, 0.04)',
  },
  lockContent: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  lockIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(46, 196, 182, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(46, 196, 182, 0.2)',
  },
  lockTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: 'white',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  lockSubtitle: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    fontWeight: '500',
  },
  lockErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(231, 76, 60, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 24,
    width: '100%',
  },
  lockErrorText: {
    color: '#E74C3C',
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '600',
    flex: 1,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2EC4B6',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: '100%',
    marginBottom: 20,
    shadowColor: '#2EC4B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  unlockButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  lockLogoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  lockLogoutText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
});

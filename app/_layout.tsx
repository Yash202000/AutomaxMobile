import '@/src/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFCM } from '@/hooks/use-FCM';
import { registerToken } from '@/src/api/notifications';
import ErrorBoundary from '@/src/components/ErrorBoundary';
import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import FCMService from '@/src/services/fcm.service';
import { createChannel } from '@/src/services/notification.channel';
import { crashLogger, setupGlobalErrorHandlers } from '@/src/utils/crashLogger';
import { t } from 'i18next';




function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, isLoading, user, isLoggingOut } = useAuth();
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
      router.replace('/(tabs)/explore');
    }
  }, [isAuthenticated, isLoading, segments, isLoggingOut]);

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
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false, headerBackTitle: ' ' }} />
        <Stack.Screen name="login" options={{ headerShown: false, headerBackTitle: ' ' }} />
        <Stack.Screen name="forgot-password" options={{ title: t('forgotPassword.title'), headerBackTitle: ' ' }} />
        <Stack.Screen name="otp" options={{ title: t('auth.verifyOTP'), headerBackTitle: ' ' }} />
        <Stack.Screen name="reset-password" options={{ title: t('resetPassword.title'), headerBackTitle: '' }} />
        <Stack.Screen name="incident-details" options={{ headerShown: false, headerBackTitle: ' ' }} />
        <Stack.Screen name="add-incident" options={{ headerShown: false, headerBackTitle: ' ' }} />
        <Stack.Screen name="my-incidents" options={{ headerShown: false, headerBackTitle: ' ' }} />
        <Stack.Screen name="map-view" options={{ headerShown: false, headerBackTitle: ' ' }} />
        <Stack.Screen name="request-details" options={{ headerShown: false, headerBackTitle: ' ' }} />
        <Stack.Screen name="add-request" options={{ headerShown: false, headerBackTitle: ' ' }} />
        <Stack.Screen name="complaint-details" options={{ headerShown: false, headerBackTitle: ' ' }} />
        <Stack.Screen name="add-complaint" options={{ headerShown: false, headerBackTitle: ' ' }} />
        <Stack.Screen name="query-details" options={{ headerShown: false, headerBackTitle: ' ' }} />
        <Stack.Screen name="add-query" options={{ headerShown: false, headerBackTitle: ' ' }} />
        <Stack.Screen name="edit-profile" options={{ title: t('settings.editProfile'), headerBackTitle: ' ' }} />
        <Stack.Screen name="change-password" options={{ title: t('settings.changePassword'), headerBackTitle: ' ' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false, headerBackTitle: ' ' }} />
        <Stack.Screen name="filter" options={{ presentation: 'transparentModal', headerShown: false, headerBackTitle: ' ' }} />
        <Stack.Screen name="complaint-filter" options={{ presentation: 'transparentModal', headerShown: false, headerBackTitle: ' ' }} />
        <Stack.Screen name="request-filter" options={{ presentation: 'transparentModal', headerShown: false, headerBackTitle: ' ' }} />
        <Stack.Screen name="query-filter" options={{ presentation: 'transparentModal', headerShown: false, headerBackTitle: ' ' }} />
        <Stack.Screen name="update-status" options={{ presentation: 'transparentModal', headerShown: false, headerBackTitle: ' ' }} />
        <Stack.Screen name="notifications" options={{ headerShown: false, headerBackTitle: ' ' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: t('common.modal', 'Modal'), headerBackTitle: ' ' }} />
      </Stack>
      {(isLoading || isLoggingOut) && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colorScheme === 'dark' ? '#000' : '#FFF', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }]}>
          <ActivityIndicator size="large" color="#2EC4B6" />
        </View>
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
    </ErrorBoundary>
  );
}

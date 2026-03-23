import '@/src/i18n';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFCM } from '@/hooks/use-FCM';
import { registerToken } from '@/src/api/notifications';
import ErrorBoundary from '@/src/components/ErrorBoundary';
import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import FCMService from '@/src/services/fcm.service';
import { createChannel } from '@/src/services/notification.channel';
import { crashLogger, setupGlobalErrorHandlers } from '@/src/utils/crashLogger';




function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, isLoading, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  useFCM(router);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'forgot-password' || segments[0] === 'otp';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login if not authenticated and not in auth group
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup && segments[0] !== 'otp') {
      // Redirect to tabs if authenticated and in auth group (except OTP)
      router.replace('/(tabs)/explore');
    }
  }, [isAuthenticated, isLoading, segments]);

  useEffect(() => {
    createChannel();
  }, []);

  // Register FCM token with backend only after the user is authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    const setup = async () => {
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
  }, [isAuthenticated, user?.id]);


  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2EC4B6" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ title: 'Forgot Password?' }} />
        <Stack.Screen name="otp" options={{ title: 'Verification' }} />
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
        <Stack.Screen name="edit-profile" options={{ title: 'Edit Profile' }} />
        <Stack.Screen name="change-password" options={{ title: 'Change Password' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="filter" options={{ presentation: 'transparentModal', headerShown: false }} />
        <Stack.Screen name="complaint-filter" options={{ presentation: 'transparentModal', headerShown: false }} />
        <Stack.Screen name="request-filter" options={{ presentation: 'transparentModal', headerShown: false }} />
        <Stack.Screen name="query-filter" options={{ presentation: 'transparentModal', headerShown: false }} />
        <Stack.Screen name="update-status" options={{ presentation: 'transparentModal', headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
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

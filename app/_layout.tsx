import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useSegments, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';
import '@/src/i18n';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import ErrorBoundary from '@/src/components/ErrorBoundary';
import { crashLogger, setupGlobalErrorHandlers } from '@/src/utils/crashLogger';

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

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
        <Stack.Screen name="edit-profile" options={{ title: 'Edit Profile' }} />
        <Stack.Screen name="change-password" options={{ title: 'Change Password' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="filter" options={{ presentation: 'transparentModal', headerShown: false }} />
        <Stack.Screen name="update-status" options={{ presentation: 'transparentModal', headerShown: false }} />
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
        console.log('[App] Crash logger initialized');
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

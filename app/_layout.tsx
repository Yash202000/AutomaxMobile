import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '@/src/i18n';

import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();

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

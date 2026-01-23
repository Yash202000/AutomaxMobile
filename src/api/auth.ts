import apiClient, { setLoggingOut } from './client';
import * as SecureStore from 'expo-secure-store';

export const login = async (email: string, password: string) => {
  try {
    const response = await apiClient.post('/auth/login', {
      email,
      password,
    });

    if (response.data && response.data.success) {
      const { token, refresh_token, user } = response.data.data;
      await SecureStore.setItemAsync('authToken', token);
      if (refresh_token) {
        await SecureStore.setItemAsync('refreshToken', refresh_token);
      }
      return { success: true, user };
    }
    return { success: false, error: 'Invalid response from server' };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

export const logout = async () => {
  // Set flag to prevent 401 interceptor from running during logout
  setLoggingOut(true);

  try {
    // Call logout endpoint FIRST while we still have the token
    await apiClient.post('/auth/logout');
  } catch (error) {
    // Ignore server errors - we'll clear tokens anyway
  }

  // Clear local tokens AFTER the API call
  await SecureStore.deleteItemAsync('authToken');
  await SecureStore.deleteItemAsync('refreshToken');

  setLoggingOut(false);
};

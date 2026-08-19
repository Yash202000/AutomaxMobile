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

export const ldapLogin = async (username: string, password: string) => {
  try {
    const response = await apiClient.post('/ldap/login', {
      username,
      password,
    });
    if (response.data && response.data.success) {
      const { token, refresh_token } = response.data.data;
      return { success: true, token, refresh_token };
    }
    return { success: false, error: response.data?.message || 'Invalid response from server' };
  } catch (error: any) {
    return {
      success: false,
      error:
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message,
    };
  }
};

export const sendOtp = async (
  phone: string,
  channel: 'sms' | 'whatsapp' = 'sms',
  type: 'employee' | 'citizen' = 'employee'
): Promise<{ success: true; session_id: string } | { success: false; error: string }> => {
  try {
    const response = await apiClient.post('/otp/send', { phone, channel, type });
    if (response.data && response.data.session_id) {
      return { success: true, session_id: response.data.session_id as string };
    }
    return { success: false, error: 'Invalid response from server' };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || error.response?.data?.message || error.message };
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

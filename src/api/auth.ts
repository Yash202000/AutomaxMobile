import apiClient from './client';
import * as SecureStore from 'expo-secure-store';

export const login = async (email, password) => {
  try {
    const response = await apiClient.post('/auth/login', {
      email,
      password,
    });

    if (response.data && response.data.success) {
      const { token, user } = response.data.data;
      await SecureStore.setItemAsync('authToken', token);
      // Optionally, you could store the user object in a state management library
      return { success: true, user };
    }
    return { success: false, error: 'Invalid response from server' };
  } catch (error) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

export const logout = async () => {
  try {
    // We can call the logout endpoint, but the main goal is to remove the token locally
    await SecureStore.deleteItemAsync('authToken');
    // We don't necessarily need to wait for the server response
    apiClient.post('/auth/logout'); 
  } catch (error) {
    // Even if logout fails, the token is removed locally
    console.error('Logout error:', error);
  }
};

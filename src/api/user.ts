import apiClient from './client';

export const getProfile = async () => {
  try {
    const response = await apiClient.get('/users/me');
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: 'Invalid response from server' };
  } catch (error) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

export const updateProfile = async (profileData) => {
    try {
        const response = await apiClient.put('/users/me', profileData);
        if (response.data && response.data.success) {
            return { success: true, data: response.data.data };
        }
        return { success: false, error: 'Invalid response from server' };
    } catch (error) {
        return { success: false, error: error.response?.data?.message || error.message };
    }
};

export const changePassword = async (passwordData) => {
    try {
        const response = await apiClient.put('/users/me/password', passwordData);
        if (response.data && response.data.success) {
            return { success: true, data: response.data.data };
        }
        return { success: false, error: 'Invalid response from server' };
    } catch (error) {
        return { success: false, error: error.response?.data?.message || error.message };
    }
};

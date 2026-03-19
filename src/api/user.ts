import apiClient from './client';

const extractError = (error: any): string => {
  const data = error.response?.data;
  if (!data) return error.message;
  // Singular error string (utils.ErrorResponse format)
  if (data.error) return data.error;
  // Validation errors: map[string]string object (ValidateStruct format)
  if (data.errors && typeof data.errors === 'object') {
    const first = Object.values(data.errors)[0];
    if (first) return String(first);
  }
  return error.message;
};

export const getProfile = async () => {
  try {
    const response = await apiClient.get('/users/me');
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: 'Invalid response from server' };
  } catch (error) {
    return { success: false, error: extractError(error) };
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
        return { success: false, error: extractError(error) };
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
        return { success: false, error: extractError(error) };
    }
};

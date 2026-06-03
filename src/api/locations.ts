import apiClient from './client';

export const getLocations = async () => {
  try {
    const response = await apiClient.get('/admin/locations');
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: 'Invalid response from server' };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

export const getLocationsTree = async () => {
  try {
    const response = await apiClient.get('/admin/locations/tree');
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: response.data?.message || 'Invalid response from server' };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

export const createLocation = async (payload: {
  name: string;
  type: string;
  parent_id?: string;
}) => {
  try {
    const response = await apiClient.post('/admin/locations', payload);
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: response.data?.message || 'Failed to create location' };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

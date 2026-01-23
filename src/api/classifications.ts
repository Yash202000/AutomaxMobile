import apiClient from './client';

export const getClassifications = async () => {
  try {
    const response = await apiClient.get('/admin/classifications');
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: 'Invalid response from server' };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

export const getClassificationsTree = async (type?: 'incident' | 'request' | 'all') => {
  try {
    const url = type ? `/admin/classifications/tree?type=${type}` : '/admin/classifications/tree';
    const response = await apiClient.get(url);
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: response.data?.message || 'Invalid response from server' };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

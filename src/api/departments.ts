import apiClient from './client';

export const getDepartments = async () => {
  try {
    const response = await apiClient.get('/admin/departments');
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: 'Invalid response from server' };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

export const getDepartmentsTree = async () => {
  try {
    const response = await apiClient.get('/admin/departments/tree');
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: response.data?.message || 'Invalid response from server' };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

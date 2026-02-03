import apiClient from './client';

export interface LookupValue {
  id: string;
  category_id: string;
  code: string;
  name: string;
  name_ar?: string;
  description?: string;
  sort_order?: number;
  color?: string;
  is_default?: boolean;
  is_active: boolean;
}

export interface LookupCategory {
  id: string;
  code: string;
  name: string;
  name_ar?: string;
  description?: string;
  is_system: boolean;
  is_active: boolean;
  add_to_incident_form?: boolean;
  values_count: number;
  values?: LookupValue[];
  created_at: string;
  updated_at: string;
}

export const getLookupCategories = async () => {
  try {
    const response = await apiClient.get('/admin/lookups/categories');
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: 'Invalid response from server' };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

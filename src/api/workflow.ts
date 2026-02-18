import apiClient from './client';

export type RecordType = 'incident' | 'request' | 'complaint' | 'query';

export const getWorkflows = async (activeOnly = true, recordType?: RecordType) => {
  try {
    const params = new URLSearchParams();
    if (activeOnly) {
      params.append('active_only', 'true');
    }
    if (recordType) {
      params.append('record_type', recordType);
    }
    const queryString = params.toString();
    const url = queryString ? `/admin/workflows?${queryString}` : '/admin/workflows';
    const response = await apiClient.get(url);
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: 'Invalid response from server' };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

export const matchWorkflow = async (criteria: {
  classification_id?: string;
  location_id?: string;
  source?: string;
  priority?: number;
}) => {
  try {
    const response = await apiClient.post('/admin/workflows/match', criteria);
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: 'Invalid response from server' };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

export const getWorkflowStates = async (workflowId: string) => {
  try {
    const response = await apiClient.get(`/admin/workflows/${workflowId}/states`);
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: 'Invalid response from server' };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

// Get all unique states from all workflows
export const getAllStates = async () => {
  try {
    const response = await getWorkflows();
    if (response.success && response.data) {
      const allStates: any[] = [];
      const seenNames = new Set<string>();

      for (const workflow of response.data) {
        if (workflow.states) {
          for (const state of workflow.states) {
            if (!seenNames.has(state.name)) {
              seenNames.add(state.name);
              allStates.push(state);
            }
          }
        }
      }

      return { success: true, data: allStates };
    }
    return { success: false, error: response.error || 'Failed to get workflows' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

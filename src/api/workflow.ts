import apiClient from './client';

export const getWorkflows = async (activeOnly = true) => {
  try {
    const url = activeOnly ? '/admin/workflows?active_only=true' : '/admin/workflows';
    const response = await apiClient.get(url);
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

import apiClient from './client';

interface PaginationInfo {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
}

interface IncidentListResponse {
  success: boolean;
  data: any[];
  pagination: PaginationInfo;
  error?: string;
}

export const getIncidents = async (params: Record<string, any> = {}): Promise<IncidentListResponse> => {
  try {
    // Set default pagination if not provided
    const queryParams = {
      page: params.page || 1,
      limit: params.limit || 20,
      ...params,
    };

    const response = await apiClient.get('/incidents', { params: queryParams });
    if (response.data && response.data.success) {
      return {
        success: true,
        data: response.data.data,
        pagination: {
          page: response.data.page,
          limit: response.data.limit,
          total_items: response.data.total_items,
          total_pages: response.data.total_pages,
        },
      };
    }
    return { success: false, data: [], pagination: { page: 1, limit: 20, total_items: 0, total_pages: 0 }, error: 'Invalid response from server' };
  } catch (error: any) {
    return { success: false, data: [], pagination: { page: 1, limit: 20, total_items: 0, total_pages: 0 }, error: error.response?.data?.message || error.message };
  }
};

export const getIncidentById = async (id: string) => {
  try {
    const response = await apiClient.get(`/incidents/${id}`);
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: 'Invalid response from server' };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

export const createIncident = async (incidentData: any) => {
  try {
    const response = await apiClient.post('/incidents', incidentData);
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: 'Invalid response from server' };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

export const getAvailableTransitions = async (id: string) => {
  try {
    const response = await apiClient.get(`/incidents/${id}/available-transitions`);
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: 'Invalid response from server' };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

export const executeTransition = async (id: string, transitionData: any) => {
  try {
    const response = await apiClient.post(`/incidents/${id}/transition`, transitionData);
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: 'Invalid response from server' };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

export const getAttachments = async (incidentId: string) => {
  try {
    const response = await apiClient.get(`/incidents/${incidentId}/attachments`);
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: 'Invalid response from server' };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

export const getComments = async (incidentId: string) => {
  try {
    const response = await apiClient.get(`/incidents/${incidentId}/comments`);
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: 'Invalid response from server' };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

export const addComment = async (incidentId: string, content: string, isInternal = false) => {
  try {
    const response = await apiClient.post(`/incidents/${incidentId}/comments`, { content, is_internal: isInternal });
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: 'Invalid response from server' };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

export const getIncidentStats = async (params = {}) => {
  try {
    const response = await apiClient.get('/incidents/stats', { params });
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: 'Invalid response from server' };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

// Get matching users for a transition based on criteria
export const getMatchingUsers = async (matchCriteria: any) => {
  try {
    const response = await apiClient.post('/admin/users/match', matchCriteria);
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: 'Invalid response from server' };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

// Upload attachment to an incident
export const uploadAttachment = async (incidentId: string, file: any) => {
  try {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);

    const response = await apiClient.post(`/incidents/${incidentId}/attachments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: 'Invalid response from server' };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

// Upload multiple attachments to an incident
export const uploadMultipleAttachments = async (incidentId: string, files: any[]) => {
  const results: any[] = [];
  const errors: any[] = [];

  for (const file of files) {
    const result = await uploadAttachment(incidentId, file);
    if (result.success) {
      results.push(result.data);
    } else {
      errors.push({ file: file.name, error: result.error });
    }
  }

  return {
    success: errors.length === 0,
    data: results,
    errors: errors.length > 0 ? errors : undefined,
    partialSuccess: results.length > 0 && errors.length > 0,
  };
};

// Get incidents assigned to current user
export const getMyAssignedIncidents = async (page = 1, limit = 20): Promise<IncidentListResponse> => {
  try {
    const response = await apiClient.get(`/incidents/my-assigned?page=${page}&limit=${limit}`);
    if (response.data && response.data.success) {
      return {
        success: true,
        data: response.data.data || [],
        pagination: {
          page: response.data.page || 1,
          limit: response.data.limit || 20,
          total_items: response.data.total_items || 0,
          total_pages: response.data.total_pages || 0,
        },
      };
    }
    return { success: false, data: [], pagination: { page: 1, limit: 20, total_items: 0, total_pages: 0 }, error: 'Invalid response from server' };
  } catch (error: any) {
    return { success: false, data: [], pagination: { page: 1, limit: 20, total_items: 0, total_pages: 0 }, error: error.response?.data?.message || error.message };
  }
};

// Get incidents created/reported by current user
export const getMyReportedIncidents = async (page = 1, limit = 20): Promise<IncidentListResponse> => {
  try {
    const response = await apiClient.get(`/incidents/my-reported?page=${page}&limit=${limit}`);
    if (response.data && response.data.success) {
      return {
        success: true,
        data: response.data.data,
        pagination: {
          page: response.data.page,
          limit: response.data.limit,
          total_items: response.data.total_items,
          total_pages: response.data.total_pages,
        },
      };
    }
    return { success: false, data: [], pagination: { page: 1, limit: 20, total_items: 0, total_pages: 0 }, error: 'Invalid response from server' };
  } catch (error: any) {
    return { success: false, data: [], pagination: { page: 1, limit: 20, total_items: 0, total_pages: 0 }, error: error.response?.data?.message || error.message };
  }
};

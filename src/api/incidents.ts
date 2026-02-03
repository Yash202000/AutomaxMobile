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
      record_type: 'incident',
      ...params,
    };

    const response = await apiClient.get('/incidents', { params: queryParams });
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
    return { success: false, error: response.data?.error || 'Invalid response from server' };
  } catch (error: any) {
    const errorData = error.response?.data;
    return {
      success: false,
      error: errorData?.error || errorData?.message || error.message,
      details: errorData?.details
    };
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
    const response = await apiClient.get('/incidents/stats', { params: { ...params, record_type: 'incident' } });
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
    // Get ALL assigned tickets (incidents, requests, complaints, queries)
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

// Get tickets created/reported by current user (all types)
export const getMyReportedIncidents = async (page = 1, limit = 20): Promise<IncidentListResponse> => {
  try {
    // Get ALL created tickets (incidents, requests, complaints, queries)
    const response = await apiClient.get(`/incidents/my-reported?page=${page}&limit=${limit}`);
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

// ==================== REQUESTS ====================

export const getRequests = async (params: Record<string, any> = {}): Promise<IncidentListResponse> => {
  try {
    const queryParams = {
      page: params.page || 1,
      limit: params.limit || 20,
      record_type: 'request',
      ...params,
    };

    const response = await apiClient.get('/incidents', { params: queryParams });
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

export const getRequestStats = async (params = {}) => {
  try {
    const response = await apiClient.get('/incidents/stats', { params: { ...params, record_type: 'request' } });
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: 'Invalid response from server' };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

export const createRequest = async (requestData: any) => {
  try {
    const response = await apiClient.post('/incidents', { ...requestData, record_type: 'request' });
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: response.data?.error || 'Invalid response from server' };
  } catch (error: any) {
    const errorData = error.response?.data;
    return {
      success: false,
      error: errorData?.error || errorData?.message || error.message,
      details: errorData?.details // validation error details
    };
  }
};

// ==================== COMPLAINTS ====================

export const getComplaints = async (params: Record<string, any> = {}): Promise<IncidentListResponse> => {
  try {
    const queryParams = {
      page: params.page || 1,
      limit: params.limit || 20,
      record_type: 'complaint',
      ...params,
    };

    const response = await apiClient.get('/incidents', { params: queryParams });
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

export const getComplaintStats = async (params = {}) => {
  try {
    const response = await apiClient.get('/incidents/stats', { params: { ...params, record_type: 'complaint' } });
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: 'Invalid response from server' };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

export const createComplaint = async (complaintData: any) => {
  try {
    const response = await apiClient.post('/incidents', { ...complaintData, record_type: 'complaint' });
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: response.data?.error || 'Invalid response from server' };
  } catch (error: any) {
    const errorData = error.response?.data;
    return {
      success: false,
      error: errorData?.error || errorData?.message || error.message,
      details: errorData?.details
    };
  }
};

// Upload attachment to a complaint
export const uploadComplaintAttachment = async (complaintId: string, file: any) => {
  try {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);

    const response = await apiClient.post(`/complaints/${complaintId}/attachments`, formData, {
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

// Upload multiple attachments to a complaint
export const uploadMultipleComplaintAttachments = async (complaintId: string, files: any[]) => {
  const results: any[] = [];
  const errors: any[] = [];

  for (const file of files) {
    const result = await uploadComplaintAttachment(complaintId, file);
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
  };
};

// ==================== QUERIES ====================

export const getQueries = async (params: Record<string, any> = {}): Promise<IncidentListResponse> => {
  try {
    const queryParams = {
      page: params.page || 1,
      limit: params.limit || 20,
      record_type: 'query',
      ...params,
    };

    const response = await apiClient.get('/incidents', { params: queryParams });
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

export const getQueryStats = async (params = {}) => {
  try {
    const response = await apiClient.get('/incidents/stats', { params: { ...params, record_type: 'query' } });
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: 'Invalid response from server' };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

export const createQuery = async (queryData: any) => {
  try {
    const response = await apiClient.post('/incidents', { ...queryData, record_type: 'query' });
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: response.data?.error || 'Invalid response from server' };
  } catch (error: any) {
    const errorData = error.response?.data;
    return {
      success: false,
      error: errorData?.error || errorData?.message || error.message,
      details: errorData?.details
    };
  }
};

export const downloadIncidentReport = async (id: string, format: 'pdf' | 'json' | 'txt' = 'pdf') => {
  try {
    const response = await apiClient.get(`/incidents/${id}/report`, {
      params: { format },
      responseType: 'blob',
    });
    return { success: true, data: response.data };
  } catch (error: any) {
    return { success: false, data: null, error: error.response?.data?.message || error.message };
  }
};

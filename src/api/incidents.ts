import apiClient from './client';

export const getIncidents = async (params = {}) => {
  try {
    const response = await apiClient.get('/incidents', { params });
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data, pagination: response.data.pagination };
    }
    return { success: false, error: 'Invalid response from server' };
  } catch (error) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

export const getIncidentById = async (id) => {
    console.log('Fetching incident with ID:', id); // Debugging log
    try {
        const response = await apiClient.get(`/incidents/${id}`);
        if (response.data && response.data.success) {
            return { success: true, data: response.data.data };
        }
        return { success: false, error: 'Invalid response from server' };
    } catch (error) {
        return { success: false, error: error.response?.data?.message || error.message };
    }
};

export const createIncident = async (incidentData) => {

    try {

        const response = await apiClient.post('/incidents', incidentData);

        if (response.data && response.data.success) {

            return { success: true, data: response.data.data };

        }

        return { success: false, error: 'Invalid response from server' };

    } catch (error) {

        return { success: false, error: error.response?.data?.message || error.message };

    }

};



export const getAvailableTransitions = async (id) => {



    try {



        const response = await apiClient.get(`/incidents/${id}/available-transitions`);



        if (response.data && response.data.success) {



            return { success: true, data: response.data.data };



        }



        return { success: false, error: 'Invalid response from server' };



    } catch (error) {



        return { success: false, error: error.response?.data?.message || error.message };



    }



};







export const executeTransition = async (id, transitionData) => {



    try {



        const response = await apiClient.post(`/incidents/${id}/transition`, transitionData);



        if (response.data && response.data.success) {



            return { success: true, data: response.data.data };



        }



        return { success: false, error: 'Invalid response from server' };



    } catch (error) {



        return { success: false, error: error.response?.data?.message || error.message };



    }



};

export const getAttachments = async (incidentId) => {
    try {
        const response = await apiClient.get(`/incidents/${incidentId}/attachments`);
        if (response.data && response.data.success) {
            return { success: true, data: response.data.data };
        }
        return { success: false, error: 'Invalid response from server' };
    } catch (error) {
        return { success: false, error: error.response?.data?.message || error.message };
    }
};

export const getComments = async (incidentId) => {
    try {
        const response = await apiClient.get(`/incidents/${incidentId}/comments`);
        if (response.data && response.data.success) {
            return { success: true, data: response.data.data };
        }
        return { success: false, error: 'Invalid response from server' };
    } catch (error) {
        return { success: false, error: error.response?.data?.message || error.message };
    }
};

export const addComment = async (incidentId, content, isInternal = false) => {
    try {
        const response = await apiClient.post(`/incidents/${incidentId}/comments`, { content, is_internal: isInternal });
        if (response.data && response.data.success) {
            return { success: true, data: response.data.data };
        }
        return { success: false, error: 'Invalid response from server' };
    } catch (error) {
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
  } catch (error) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
};





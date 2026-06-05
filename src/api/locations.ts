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
  link_default_department?: boolean;
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

export const gisLocation = async (payload: {
  lat: number;
  lng: number;
}) => {
  try {
    const response = await apiClient.post('/gis/identify', { x: payload.lat, y: payload.lng });
    if (response.data) {
      const findAttribute = (prop: string) => {
        const mapProp: any = {
          Plan_Data: "PLAN_NO",
          Street_Naming: "STREET_FULLNAME",
          District_Boundary: "DISTRICT_NAME",
          Municipality_Boundary: "MUNICIPALITY_NAME",
        }
        return response.data.results?.find((item: any) => item.layerName === prop)?.attributes[mapProp[prop]] || '';
      }
      const stdLoc = {
        plan_no: findAttribute("Plan_Data"),
        street_fullname: findAttribute("Street_Naming"),
        district_name: findAttribute("District_Boundary"),
        municipality_name: findAttribute("Municipality_Boundary"),
        isInsideBoundary: response.data.results?.length > 0 || false
      }
      return { success: true, data: stdLoc };
    }
    return { success: false, error: response.data?.message || 'Failed to get location' };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
};


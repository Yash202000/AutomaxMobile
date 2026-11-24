import apiClient from './client';

// KFF Dispatcher unit (dispatch resource) the logged-in user drives.
//   getKffUnitResource  GET /dispatch/resources/{unitId}

export interface KffUnitResource {
  id: string;
  /** Vehicle type, e.g. "BUS". */
  name: string;
  /** Dispatch status, e.g. "available". */
  status: string;
  plateNumber: string;
  locationName: string;
}

const errorMessage = (error: any): string =>
  error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Request failed';

export const getKffUnitResource = async (
  unitId: string,
): Promise<{ success: true; data: KffUnitResource } | { success: false; error: string }> => {
  try {
    const response = await apiClient.get(`/dispatch/resources/${encodeURIComponent(unitId)}`);
    const data = response.data?.data;
    if (!response.data?.success || !data) {
      return { success: false, error: response.data?.message || 'Invalid response from server' };
    }
    return {
      success: true,
      data: {
        id: String(data.id ?? unitId),
        name: data.name ?? '',
        status: data.status ?? '',
        plateNumber: data.plate_number ?? '',
        locationName: data.location_name ?? '',
      },
    };
  } catch (error: any) {
    return { success: false, error: errorMessage(error) };
  }
};

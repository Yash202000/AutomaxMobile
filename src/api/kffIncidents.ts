import { getKffUnitId } from '../services/kffSession';
import apiClient from './client';

// KFF Dispatcher incident calls. Same Automax endpoints, but every call carries
// the logged-in unit's id (saved at passcode login): `unit_id` in the body for
// POSTs, as a query parameter for GETs. Called directly rather than through
// src/api/incidents.ts because those helpers don't forward extra fields.

const errorMessage = (error: any): string =>
  error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Request failed';

const unitParam = async (): Promise<{ unit_id?: string }> => {
  const unitId = await getKffUnitId();
  return unitId ? { unit_id: unitId } : {};
};

// Raw API rows by id — lets the detail screen render instantly from the list
// while it refetches the full record.
const rawCache = new Map<string, any>();
export const getCachedKffIncidentRaw = (id: string) => rawCache.get(id);

/**
 * My Incidents for the unit: POST /incidents/search. No date filter yet, so
 * the selected calendar day doesn't narrow the results.
 */
export const fetchKffMyIncidents = async (): Promise<
  { success: true; data: any[] } | { success: false; error?: string }
> => {
  try {
    const response = await apiClient.post('/incidents/search', {
      page: 1,
      limit: 10,
      record_type: 'incident',
      ...(await unitParam()),
    });
    if (!response.data?.success) return { success: false, error: 'Invalid response from server' };
    const rows: any[] = response.data.data || [];
    rows.forEach((row) => row?.id && rawCache.set(String(row.id), row));
    return { success: true, data: rows };
  } catch (error: any) {
    return { success: false, error: errorMessage(error) };
  }
};

/** GET /incidents/{id}. `status` is set on HTTP errors (404 = not found). */
export const fetchKffIncidentById = async (
  id: string,
): Promise<{ success: boolean; data?: any; error?: string; status?: number }> => {
  try {
    const response = await apiClient.get(`/incidents/${id}`, { params: await unitParam() });
    if (!response.data?.success) return { success: false, error: 'Invalid response from server' };
    rawCache.set(id, response.data.data);
    return { success: true, data: response.data.data };
  } catch (error: any) {
    return { success: false, error: errorMessage(error), status: error?.response?.status };
  }
};

/** GET /incidents/{id}/available-transitions — the workflow buttons. */
export const fetchKffTransitions = async (id: string): Promise<any[]> => {
  try {
    const response = await apiClient.get(`/incidents/${id}/available-transitions`, {
      params: await unitParam(),
    });
    return response.data?.success && Array.isArray(response.data.data) ? response.data.data : [];
  } catch {
    return [];
  }
};

/**
 * POST /incidents/{id}/transition. `comment` carries the reason for reject
 * transitions.
 */
export const executeKffTransition = async (
  incidentId: string,
  { transitionId, comment, version }: { transitionId: string; comment?: string; version?: number },
): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await apiClient.post(`/incidents/${incidentId}/transition`, {
      transition_id: transitionId,
      comment: comment?.trim() || undefined,
      version: version || 1,
      ...(await unitParam()),
    });
    return response.data?.success ? { success: true } : { success: false, error: 'Invalid response from server' };
  } catch (error: any) {
    return { success: false, error: errorMessage(error) };
  }
};

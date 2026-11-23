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

export interface KffIncidentSearch {
  /** Workflow state ids to list (the My Incidents tab); omitted = every state. */
  stateIds?: string[];
  /** Local calendar day, YYYY-MM-DD — sent as both start and end date. */
  day?: string;
  page?: number;
  limit?: number;
}

/** My Incidents for the unit: POST /incidents/search, filtered by state and day. */
export const fetchKffMyIncidents = async ({
  stateIds,
  day,
  page = 1,
  limit = 10,
}: KffIncidentSearch = {}): Promise<
  { success: true; data: any[]; total: number } | { success: false; error?: string }
> => {
  try {
    const response = await apiClient.post('/incidents/search', {
      page,
      limit,
      record_type: 'incident',
      // State filter switched off for now — every tab gets the day's incidents.
      // ...(stateIds?.length ? { current_state_id: stateIds } : {}),
      ...(day ? { start_date_str: day, end_date_str: day } : {}),
      ...(await unitParam()),
    });
    if (!response.data?.success) return { success: false, error: 'Invalid response from server' };
    const rows: any[] = response.data.data || [];
    rows.forEach((row) => row?.id && rawCache.set(String(row.id), row));
    return { success: true, data: rows, total: response.data.total_items ?? rows.length };
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

/** POST /incidents/{id}/comments. */
export const addKffComment = async (
  incidentId: string,
  content: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await apiClient.post(`/incidents/${incidentId}/comments`, {
      content: content.trim(),
      is_internal: false,
      ...(await unitParam()),
    });
    return response.data?.success ? { success: true } : { success: false, error: 'Invalid response from server' };
  } catch (error: any) {
    return { success: false, error: errorMessage(error) };
  }
};

export interface KffUploadFile {
  uri: string;
  name: string;
  type: string;
}

/** POST /incidents/{id}/attachments (multipart, one file per call). */
export const uploadKffAttachment = async (
  incidentId: string,
  file: KffUploadFile,
  version?: number,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const formData = new FormData();
    formData.append('file', { uri: file.uri, name: file.name, type: file.type } as any);
    const response = await apiClient.post(`/incidents/${incidentId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: { ...(version ? { version } : {}), ...(await unitParam()) },
    });
    return response.data?.success ? { success: true } : { success: false, error: 'Invalid response from server' };
  } catch (error: any) {
    return { success: false, error: errorMessage(error) };
  }
};

import { executeTransition, getIncidentById, getIncidents } from './incidents';

// KFF Dispatcher incident calls. For now they reuse the Automax incidents API;
// swap the bodies here when KFF-specific endpoints land.

// Raw API rows by id — lets the detail screen render instantly from the list
// while it refetches the full record.
const rawCache = new Map<string, any>();
export const getCachedKffIncidentRaw = (id: string) => rawCache.get(id);

/**
 * My Incidents. TEMP: plain incident search with no assignee / date filters —
 * body is exactly {"page":1,"limit":10,"record_type":"incident"}, so the
 * selected calendar day does not filter the results yet.
 */
export const fetchKffMyIncidents = async (): Promise<
  { success: true; data: any[] } | { success: false; error?: string }
> => {
  const response = await getIncidents({ page: 1, limit: 10, record_type: 'incident' });
  if (!response.success) return { success: false, error: response.error };

  response.data.forEach((row) => row?.id && rawCache.set(String(row.id), row));
  return { success: true, data: response.data };
};

export const fetchKffIncidentById = async (id: string) => {
  const response = await getIncidentById(id);
  if (response.success && response.data) rawCache.set(id, response.data);
  return response;
};

/**
 * Runs a workflow transition (Automax endpoint for now). `comment` carries the
 * reason for reject transitions.
 */
export const executeKffTransition = (
  incidentId: string,
  { transitionId, comment, version }: { transitionId: string; comment?: string; version?: number },
) =>
  executeTransition(incidentId, {
    transition_id: transitionId,
    comment: comment?.trim() || undefined,
    version: version || 1,
  });

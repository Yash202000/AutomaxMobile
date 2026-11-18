import { getIncidentById, getIncidents } from '@/src/api/incidents';

import type { KffCriticality, KffIncident, KffIncidentState, KffListStatus } from './kffTypes';

// ---------------------------------------------------------------------------
// KFF Dispatcher ↔ Automax incidents API.
// For now KFF reuses the Automax incident search (getIncidents) with a plain
// {"page":1,"limit":10,"record_type":"incident"} body (no assignee / date
// filter — see fetchKffMyIncidents). There are no KFF-specific state codes yet, so
// the Accepted / Completed / Rejected split is derived from the workflow
// state's code/name (see mapStatus). Swap this file when the KFF APIs land.
// ---------------------------------------------------------------------------

// Raw API rows by id — lets the detail screen render instantly from the list
// while it refetches the full record.
const rawCache = new Map<string, any>();
export const getCachedKffIncidentRaw = (id: string) => rawCache.get(id);

const PRIORITY_TO_CRITICALITY: Record<number, KffCriticality> = {
  1: 'critical',
  2: 'high',
  3: 'medium',
  4: 'low',
  5: 'low',
};

const mapCriticality = (raw: any): KffCriticality => {
  const lookup = raw.lookup_values?.find((lv: any) => lv?.category?.code === 'PRIORITY');
  const code = String(lookup?.code ?? '').toLowerCase();
  if (code.includes('critical')) return 'critical';
  if (code.includes('high')) return 'high';
  if (code.includes('medium')) return 'medium';
  if (code.includes('low')) return 'low';
  return PRIORITY_TO_CRITICALITY[parseInt(String(raw.priority), 10)] ?? 'medium';
};

const mapStatus = (raw: any): { status: KffListStatus; state: KffIncidentState } => {
  const s = raw.current_state ?? {};
  const text = `${s.code ?? ''} ${s.name ?? ''}`.toLowerCase();
  if (/reject|cancel/.test(text)) return { status: 'rejected', state: 'rejected' };
  if (/complet|resolv|clos|done|finish/.test(text) || s.state_type === 'terminal') {
    return { status: 'completed', state: 'completed' };
  }
  if (/progress|enroute|en route|on.?site|arriv|start/.test(text)) {
    return { status: 'accepted', state: 'inProgress' };
  }
  return { status: 'accepted', state: 'assigned' };
};

const pickLocalized = (obj: any, language: string): string =>
  (language === 'ar' && obj?.name_ar) || obj?.name || '';

const toNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n !== 0 ? n : undefined;
};

export const mapApiIncidentToKff = (raw: any, language: string): KffIncident => {
  const reporterFullName = [raw.reporter?.first_name, raw.reporter?.last_name]
    .filter(Boolean)
    .join(' ');
  const destination =
    [raw.address, raw.city].filter(Boolean).join(', ') ||
    raw.location?.address ||
    pickLocalized(raw.location, language);

  return {
    id: String(raw.id),
    ticketNumber: raw.incident_number || '',
    title: pickLocalized(raw.classification, language) || raw.title || '',
    criticality: mapCriticality(raw),
    ...mapStatus(raw),
    createdAt: new Date(raw.created_at),
    from: '',
    to: destination,
    latitude: toNumber(raw.latitude),
    longitude: toNumber(raw.longitude),
    description: raw.description || raw.title || '',
    caller: {
      name: raw.reporter_name || reporterFullName || raw.reporter?.username || '',
      phone: raw.reporter_phone || raw.reporter?.phone || '',
    },
  };
};

/**
 * TEMP (KFF only): plain incident search with no assignee / date filters —
 * request body is exactly {"page":1,"limit":10,"record_type":"incident"}.
 * The selected calendar day does not filter the results for now.
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

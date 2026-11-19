import type { KffCriticality, KffIncident, KffIncidentState, KffListStatus } from './kffTypes';

// Automax incident record → KFF Dispatcher view models. There are no
// KFF-specific state codes yet, so Accepted / Completed / Rejected is derived
// from the workflow state's code/name (see mapStatus).

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

const personName = (person: any): string =>
  [person?.first_name, person?.last_name].filter(Boolean).join(' ') || person?.username || '';

const callerName = (raw: any) => raw?.reporter_name || personName(raw?.reporter);
const callerPhone = (raw: any) => raw?.reporter_phone || raw?.reporter?.phone || '';

const toNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n !== 0 ? n : undefined;
};

export const mapApiIncidentToKff = (raw: any, language: string): KffIncident => ({
  id: String(raw.id),
  ticketNumber: raw.incident_number || '',
  title: pickLocalized(raw.classification, language) || raw.title || '',
  criticality: mapCriticality(raw),
  ...mapStatus(raw),
  createdAt: new Date(raw.created_at),
  to:
    [raw.address, raw.city].filter(Boolean).join(', ') ||
    raw.location?.address ||
    pickLocalized(raw.location, language),
  latitude: toNumber(raw.latitude),
  longitude: toNumber(raw.longitude),
  description: raw.description || raw.title || '',
  caller: { name: callerName(raw), phone: callerPhone(raw) },
});

/** Key incident fields for the KFF detail screen ('' when missing). */
export const mapKffIncidentInfo = (raw: any, language: string) => ({
  location: pickLocalized(raw?.location, language),
  address: [raw?.address, raw?.city].filter(Boolean).join(', '),
  callerName: callerName(raw),
  callerPhone: callerPhone(raw),
  callerEmail: raw?.reporter_email || raw?.reporter?.email || '',
  department: pickLocalized(raw?.department, language),
  assignee: personName(raw?.assignee),
});

/** Subset of the record the Automax update-status modal needs. */
export const toTransitionIncidentParam = (raw: any) => ({
  id: raw.id,
  classification_id: raw.classification_id || raw.classification?.id,
  location_id: raw.location_id || raw.location?.id,
  department_id: raw.department_id || raw.department?.id,
  assignee_id: raw.assignee_id || raw.assignee?.id,
  version: raw.version,
});

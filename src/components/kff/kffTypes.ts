// Shared KFF Dispatcher types (API mapping lives in kffIncidentMapper.ts).

/** My Incidents tab an incident is listed under. */
export type KffListStatus = 'accepted' | 'completed' | 'rejected';
export type KffIncidentState = 'assigned' | 'inProgress' | 'completed' | 'rejected';
export type KffCriticality = 'low' | 'medium' | 'high' | 'critical';
export type KffUnitStatus = 'online' | 'busy' | 'offline';

export const KFF_STATUSES: KffListStatus[] = ['accepted', 'completed', 'rejected'];
export const KFF_UNIT_STATUSES: KffUnitStatus[] = ['online', 'busy', 'offline'];

export interface KffIncident {
  id: string;
  ticketNumber: string;
  /** Classification, e.g. "Vehicle Breakdown". */
  title: string;
  criticality: KffCriticality;
  status: KffListStatus;
  state: KffIncidentState;
  createdAt: Date;
  /** Destination (incident location). */
  to: string;
  /** Undefined when the incident has no coordinates. */
  latitude?: number;
  longitude?: number;
  description: string;
  caller: { name: string; phone: string };
}

/**
 * Workflow state names each My Incidents tab lists. Their ids are looked up
 * from the workflow every time the list loads (ids differ per server) and
 * sent as `current_state_id` on POST /incidents/search.
 */
export const KFF_STATUS_STATE_NAMES: Record<KffListStatus, string[]> = {
  accepted: ['Dispatched'],
  completed: ['Completed'],
  rejected: ['Rejected'],
};

/** The KFF dispatch workflow (falls back to the server's default incident workflow). */
export const KFF_WORKFLOW_ID = '7cc3c22b-2fd1-45e0-8471-e41daa21d4cd';

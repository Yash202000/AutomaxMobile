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
 * Workflow state ids each My Incidents tab lists (`current_state_id` on
 * POST /incidents/search) — states of the KFF dispatch workflow.
 */
export const KFF_STATUS_STATE_IDS: Record<KffListStatus, string[]> = {
  accepted: ['db89d003-c9ab-4c41-b26e-27918b307028'], // Start
  completed: ['1996d3ae-44ef-4ff5-bbbf-1861a13fa887'],
  rejected: ['f0580b09-2cfc-4a43-8560-defbe2d96421'],
};

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

export const countByStatus = (incidents: KffIncident[]): Record<KffListStatus, number> =>
  incidents.reduce(
    (acc, incident) => {
      acc[incident.status] += 1;
      return acc;
    },
    { accepted: 0, completed: 0, rejected: 0 } as Record<KffListStatus, number>,
  );

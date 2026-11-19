// Shared KFF Dispatcher types (API mapping lives in kffIncidentMapper.ts).

/** 'new' = incoming notification the driver hasn't accepted/rejected yet. */
export type KffIncidentStatus = 'new' | 'accepted' | 'completed' | 'rejected';
export type KffListStatus = Exclude<KffIncidentStatus, 'new'>;
export type KffIncidentState = 'new' | 'assigned' | 'inProgress' | 'completed' | 'rejected';
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
  status: KffIncidentStatus;
  state: KffIncidentState;
  createdAt: Date;
  /** When the driver accepted / rejected it (incoming incidents only). */
  handledAt?: Date;
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
      if (incident.status !== 'new') acc[incident.status] += 1;
      return acc;
    },
    { accepted: 0, completed: 0, rejected: 0 } as Record<KffListStatus, number>,
  );

import { useSyncExternalStore } from 'react';

import type { KffIncident } from './kffTypes';

// ---------------------------------------------------------------------------
// KFF incident store (module-level, listener based — same pattern as
// src/utils/networkStatus.ts, so no provider is needed in the shared layouts).
//
// incoming: incidents the driver has been notified about (bell list + badge).
// handled:  incidents the driver accepted / rejected from the bell list.
//
// The bell count and notification list read it through useKffIncidents().
// My Incidents itself comes from the incidents API (useKffMyIncidents.ts).
// When the real push / WebSocket feed is ready, call addKffIncomingIncident()
// from that handler and the badge + list update in real time.
// ---------------------------------------------------------------------------

export interface KffIncidentsState {
  incoming: KffIncident[];
  handled: KffIncident[];
}

const createInitialState = (): KffIncidentsState => ({
  incoming: [],
  handled: [],
});

let state: KffIncidentsState = createInitialState();
const listeners = new Set<() => void>();

const setState = (next: KffIncidentsState) => {
  state = next;
  listeners.forEach((listener) => listener());
};

const subscribeKffIncidents = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getKffIncidentsState = () => state;

export const useKffIncidents = () =>
  useSyncExternalStore(subscribeKffIncidents, getKffIncidentsState, getKffIncidentsState);

/** Hook point for push / WebSocket notifications about a new incident. */
export const addKffIncomingIncident = (incident: KffIncident) => {
  if (state.incoming.some((i) => i.id === incident.id)) return;
  setState({ ...state, incoming: [incident, ...state.incoming] });
};

const moveToHandled = (id: string, status: 'accepted' | 'rejected') => {
  const incident = state.incoming.find((i) => i.id === id);
  if (!incident) return;
  setState({
    incoming: state.incoming.filter((i) => i.id !== id),
    handled: [
      {
        ...incident,
        status,
        state: status === 'accepted' ? 'assigned' : 'rejected',
        handledAt: new Date(),
      },
      ...state.handled,
    ],
  });
};

export const acceptKffIncident = (id: string) => moveToHandled(id, 'accepted');
export const rejectKffIncident = (id: string) => moveToHandled(id, 'rejected');

/** Clears the session (called on logout). */
export const resetKffIncidents = () => setState(createInitialState());

/** Looks up an incoming / handled bell-list incident by id. */
export const findKffIncident = (current: KffIncidentsState, id: string) =>
  current.incoming.find((i) => i.id === id) ?? current.handled.find((i) => i.id === id);

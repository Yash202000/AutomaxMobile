import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchKffTransitionsResult } from '@/src/api/kffIncidents';

import { KFF_STATUS_STATE_NAMES } from './kffTypes';

// Accept leads to "Dispatched", Reject to "Rejected" (see KFF_STATUS_STATE_NAMES).
const RESPONSE_STATES = [...KFF_STATUS_STATE_NAMES.accepted, ...KFF_STATUS_STATE_NAMES.rejected].map(
  (name) => name.toLowerCase(),
);

/**
 * The Accept / Reject transition while the incident still offers one to this
 * unit (its `from_state` is the incident's current state), else undefined.
 */
const findResponseTransition = (transitions: any[]) =>
  transitions
    .map((item) => item?.transition ?? item)
    .find((transition) => {
      const toState = String(transition?.to_state?.name ?? '').trim().toLowerCase();
      return RESPONSE_STATES.includes(toState) || /accept|reject/i.test(String(transition?.name ?? ''));
    });

/** Per incident: can it still be opened, and its current (waiting) state. */
export interface KffNotificationIncident {
  awaiting: boolean;
  /** Workflow state ({ name, name_ar }) while awaiting Accept / Reject. */
  state?: any;
}

/**
 * Which notification incidents can still be opened: only those waiting for the
 * unit's Accept / Reject. Once the incident has moved on (Dispatched or later)
 * the notification is greyed out. Unknown (not checked yet, or the check
 * failed) stays openable. `recheck()` re-asks for every incident, e.g. when
 * the inbox is reopened or pulled to refresh. `waitingState` gives the state
 * to label the card with while it still waits.
 */
export const useKffOpenableIncidents = (incidentIds: string[]) => {
  const [openable, setOpenable] = useState<Record<string, KffNotificationIncident>>({});
  const checked = useRef(new Set<string>());
  const [round, setRound] = useState(0);

  const idsKey = Array.from(new Set(incidentIds.filter(Boolean))).join(',');

  useEffect(() => {
    const done = checked.current;
    const pending = idsKey.split(',').filter((id) => id && !done.has(id));
    if (pending.length === 0) return;
    pending.forEach((id) => done.add(id));
    let cancelled = false;
    let finished = false;

    Promise.all(
      pending.map(async (id) => {
        const result = await fetchKffTransitionsResult(id);
        if (!result.success) return [id, undefined] as const;
        const transition = findResponseTransition(result.data);
        return [id, { awaiting: !!transition, state: transition?.from_state }] as const;
      }),
    ).then((entries) => {
      finished = true;
      if (cancelled) return;
      setOpenable((prev) => {
        const next = { ...prev };
        entries.forEach(([id, value]) => {
          if (value === undefined) {
            delete next[id];
            done.delete(id); // retry on the next recheck
          } else {
            next[id] = value;
          }
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
      // Unfinished checks are dropped, so ask again next time.
      if (!finished) pending.forEach((id) => done.delete(id));
    };
  }, [idsKey, round]);

  const recheck = useCallback(() => {
    checked.current.clear();
    setRound((n) => n + 1);
  }, []);

  const canOpen = useCallback(
    (incidentId?: string) => !!incidentId && openable[incidentId]?.awaiting !== false,
    [openable],
  );
  const waitingState = useCallback(
    (incidentId?: string) => (incidentId ? openable[incidentId]?.state : undefined),
    [openable],
  );

  return { canOpen, waitingState, recheck };
};

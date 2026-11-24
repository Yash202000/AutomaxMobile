import { resolveKffStateIds } from '@/src/api/kffIncidents';

import { KFF_STATUS_STATE_NAMES, KFF_WORKFLOW_ID, KffListStatus } from './kffTypes';

export type KffStateIds = Record<KffListStatus, string[]>;

// Workflow state ids for the My Incidents tabs, looked up once per app
// session: on first use after login or after a cold start (module memory is
// fresh), then reused. Cleared on logout; a failed lookup isn't cached.
let lookup: Promise<KffStateIds | null> | null = null;

export const getKffStateIds = (): Promise<KffStateIds | null> => {
  if (!lookup) {
    lookup = resolveKffStateIds(KFF_WORKFLOW_ID, KFF_STATUS_STATE_NAMES).then((ids) => {
      if (!ids) lookup = null; // retry next time
      return ids;
    });
  }
  return lookup;
};

export const resetKffStateIds = () => {
  lookup = null;
};

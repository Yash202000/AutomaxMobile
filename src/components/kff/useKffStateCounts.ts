import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { fetchKffStateCounts } from '@/src/api/kffIncidents';

import { toKffDateParam } from './kffDateUtils';
import { KFF_STATUS_STATE_NAMES, KFF_STATUSES, KFF_WORKFLOW_ID, KffListStatus } from './kffTypes';

const NO_COUNTS: Record<KffListStatus, number> = { accepted: 0, completed: 0, rejected: 0 };

/**
 * Accepted / Completed / Rejected totals for the Profile cards from
 * GET /incidents/stats/v2 `by_state` (summed over each tab's state names)
 * for the selected day. Refetches when the day changes or the screen gains
 * focus.
 */
export const useKffStateCounts = (date: Date) => {
  const day = toKffDateParam(date);
  const [counts, setCounts] = useState(NO_COUNTS);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      fetchKffStateCounts(KFF_WORKFLOW_ID, day).then((result) => {
        if (!active) return;
        if (result.success && result.data) {
          const byState = Object.fromEntries(
            Object.entries(result.data).map(([name, count]) => [name.trim().toLowerCase(), Number(count) || 0]),
          );
          const next = { ...NO_COUNTS };
          KFF_STATUSES.forEach((status) => {
            next[status] = KFF_STATUS_STATE_NAMES[status].reduce(
              (sum, name) => sum + (byState[name.trim().toLowerCase()] ?? 0),
              0,
            );
          });
          setCounts(next);
        }
        setLoading(false);
      });
      return () => {
        active = false;
      };
    }, [day]),
  );

  return { counts, loading };
};

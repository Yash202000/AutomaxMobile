import { useAuth } from '@/src/context/AuthContext';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchKffMyIncidents } from '@/src/api/kffIncidents';

import { toKffDateParam } from './kffDateUtils';
import { mapApiIncidentToKff } from './kffIncidentMapper';
import { KFF_STATUSES, KffIncident, KffListStatus } from './kffTypes';
import { getKffStateIds } from './kffWorkflowStates';

const NO_COUNTS: Record<KffListStatus, number> = { accepted: 0, completed: 0, rejected: 0 };
const STATES_UNAVAILABLE = 'Workflow states unavailable';

/**
 * My Incidents for the selected day and tab. Each tab is its own server
 * search: `current_state_id` = the tab's workflow states (looked up once per
 * session, see kffWorkflowStates.ts) + the day. Switching tab or day calls the
 * API for exactly that list; the tab badges come from `total_items`.
 * Refetches when the screen gains focus (tab screens stay mounted).
 */
export const useKffMyIncidents = (date: Date, status: KffListStatus) => {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const userId = user?.id;
  const day = toKffDateParam(date);

  const [rows, setRows] = useState<any[]>([]);
  const [counts, setCounts] = useState(NO_COUNTS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRequest = useRef(0);
  const countsRequest = useRef(0);

  // New tab or day: show the loader rather than the previous list.
  useEffect(() => {
    setRows([]);
    setError(null);
    setLoading(true);
  }, [day, status]);

  const loadList = useCallback(async () => {
    if (!userId) return;
    const id = ++listRequest.current; // newer requests supersede older ones
    const stateIds = (await getKffStateIds())?.[status];
    const response = stateIds?.length
      ? await fetchKffMyIncidents({ day, stateIds })
      : ({ success: false, error: STATES_UNAVAILABLE } as const);
    if (id !== listRequest.current) return;
    if (response.success) {
      setRows(response.data);
      setCounts((prev) => ({ ...prev, [status]: response.total }));
      setError(null);
    } else {
      setError(response.error || 'error');
    }
    setLoading(false);
  }, [userId, day, status]);

  const loadCounts = useCallback(async () => {
    if (!userId) return;
    const id = ++countsRequest.current;
    const stateIds = await getKffStateIds();
    const results = await Promise.all(
      KFF_STATUSES.map((s) =>
        stateIds?.[s]?.length
          ? fetchKffMyIncidents({ day, stateIds: stateIds[s], limit: 1 })
          : Promise.resolve({ success: true as const, data: [], total: 0 }),
      ),
    );
    if (id !== countsRequest.current) return;
    setCounts((prev) => {
      const next = { ...prev };
      results.forEach((result, i) => {
        if (result.success) next[KFF_STATUSES[i]] = result.total;
      });
      return next;
    });
  }, [userId, day]);

  // Focus / day change: badges for all tabs. Tab switch: that tab's list only.
  useFocusEffect(
    useCallback(() => {
      loadCounts();
    }, [loadCounts]),
  );
  useFocusEffect(
    useCallback(() => {
      loadList();
    }, [loadList]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadList(), loadCounts()]);
    setRefreshing(false);
  }, [loadList, loadCounts]);

  const incidents = useMemo<KffIncident[]>(
    () =>
      rows.map((row) => ({
        ...mapApiIncidentToKff(row, i18n.language),
        // The tab the row was fetched for wins over the name-based state guess.
        status,
      })),
    [rows, i18n.language, status],
  );

  return { incidents, counts, loading, refreshing, error, refresh };
};

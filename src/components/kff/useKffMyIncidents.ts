import { useAuth } from '@/src/context/AuthContext';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchKffMyIncidents } from '@/src/api/kffIncidents';

import { toKffDateParam } from './kffDateUtils';
import { mapApiIncidentToKff } from './kffIncidentMapper';
import { KFF_STATUS_STATE_IDS, KFF_STATUSES, KffIncident, KffListStatus } from './kffTypes';

const NO_COUNTS: Record<KffListStatus, number> = { accepted: 0, completed: 0, rejected: 0 };

/**
 * My Incidents for the selected day. Each tab is its own server search
 * (`current_state_id` + date), so switching tab or day calls the API for
 * exactly that list. Counts for all three tabs (badges, Profile cards) come
 * from `total_items`. Everything refetches when the screen gains focus — tab
 * screens stay mounted. Without `status` only the counts are loaded.
 */
export const useKffMyIncidents = (date: Date, status?: KffListStatus) => {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const userId = user?.id;
  const day = toKffDateParam(date);

  const [rows, setRows] = useState<any[]>([]);
  const [counts, setCounts] = useState(NO_COUNTS);
  const [loading, setLoading] = useState(true);
  const [countsLoading, setCountsLoading] = useState(true);
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
    if (!userId || !status) return;
    const id = ++listRequest.current; // newer requests supersede older ones
    const response = await fetchKffMyIncidents({ day, stateIds: KFF_STATUS_STATE_IDS[status] });
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
    const results = await Promise.all(
      KFF_STATUSES.map((s) =>
        fetchKffMyIncidents({ day, stateIds: KFF_STATUS_STATE_IDS[s], limit: 1 }),
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
    setCountsLoading(false);
  }, [userId, day]);

  useFocusEffect(
    useCallback(() => {
      loadList();
    }, [loadList]),
  );
  useFocusEffect(
    useCallback(() => {
      loadCounts();
    }, [loadCounts]),
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
        ...(status ? { status } : {}),
      })),
    [rows, i18n.language, status],
  );

  return { incidents, counts, loading, countsLoading, refreshing, error, refresh };
};

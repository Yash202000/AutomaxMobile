import { useAuth } from '@/src/context/AuthContext';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchKffMyIncidents, mapApiIncidentToKff } from './kffIncidentApi';
import { countByStatus } from './kffTypes';

/**
 * My Incidents from the incidents API. Refetches whenever the screen gains
 * focus (tab screens stay mounted), so the Profile counts and the My Incidents
 * list stay in step.
 */
export const useKffMyIncidents = () => {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const userId = user?.id;

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(
    async (mode: 'auto' | 'refresh') => {
      if (!userId) return;
      const id = ++requestId.current;
      if (mode === 'refresh') setRefreshing(true);

      const response = await fetchKffMyIncidents();
      if (id !== requestId.current) return; // a newer request superseded this one

      if (response.success) {
        setRows(response.data);
        setError(null);
      } else {
        setError(response.error || 'error');
      }
      setLoading(false);
      setRefreshing(false);
    },
    [userId],
  );

  useFocusEffect(
    useCallback(() => {
      load('auto');
    }, [load]),
  );

  const refresh = useCallback(() => load('refresh'), [load]);

  const incidents = useMemo(
    () => rows.map((row) => mapApiIncidentToKff(row, i18n.language)),
    [rows, i18n.language],
  );
  const counts = useMemo(() => countByStatus(incidents), [incidents]);

  return { incidents, counts, loading, refreshing, error, refresh };
};

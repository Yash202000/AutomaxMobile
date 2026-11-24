import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  fetchKffIncidentById,
  fetchKffTransitions,
  getCachedKffIncidentRaw,
} from '@/src/api/kffIncidents';

/**
 * Incident record + the workflow transitions the user can run, for the KFF
 * detail screen. Starts from the row cached by the My Incidents list, then
 * refetches on every focus so the state is current after the update-status
 * modal closes.
 */
export const useKffIncidentDetail = (id?: string) => {
  const [raw, setRaw] = useState<any>(() => (id ? getCachedKffIncidentRaw(id) : undefined));
  const [loading, setLoading] = useState(true);
  // null = ok; '' = generic failure; otherwise the server's message (e.g. 403).
  const [error, setError] = useState<string | null>(null);
  const [transitions, setTransitions] = useState<any[]>([]);
  const [transitionsLoading, setTransitionsLoading] = useState(false);
  const requestId = useRef(0);

  // Tab screens stay mounted: reset when a different incident is opened.
  useEffect(() => {
    setRaw(id ? getCachedKffIncidentRaw(id) : undefined);
    setTransitions([]);
  }, [id]);

  const load = useCallback(() => {
    const current = ++requestId.current; // newer requests supersede older ones
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setTransitionsLoading(true);
    // Details first; transitions only once the record itself loaded.
    (async () => {
      const response = await fetchKffIncidentById(id);
      if (current !== requestId.current) return;
      if (!response.success || !response.data) {
        if (response.status === 403) setError(response.error || '');
        else if (response.status !== 404) setError('');
        setTransitions([]);
        setLoading(false);
        setTransitionsLoading(false);
        return;
      }
      setRaw(response.data);
      setLoading(false);
      const items = await fetchKffTransitions(id);
      if (current !== requestId.current) return;
      setTransitions(items);
      setTransitionsLoading(false);
    })();
  }, [id]);

  useFocusEffect(load);

  return { raw, loading, error, transitions, transitionsLoading, reload: load };
};

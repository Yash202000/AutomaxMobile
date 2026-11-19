import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getAvailableTransitions } from '@/src/api/incidents';
import { fetchKffIncidentById, getCachedKffIncidentRaw } from '@/src/api/kffIncidents';

/**
 * Incident record + the workflow transitions the user can run, for the KFF
 * detail screen. Starts from the row cached by the My Incidents list, then
 * refetches on every focus so the state is current after the update-status
 * modal closes.
 */
export const useKffIncidentDetail = (id?: string) => {
  const [raw, setRaw] = useState<any>(() => (id ? getCachedKffIncidentRaw(id) : undefined));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
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
    setError(false);
    setTransitionsLoading(true);
    fetchKffIncidentById(id).then((response) => {
      if (current !== requestId.current) return;
      if (response.success && response.data) setRaw(response.data);
      else setError(response.status !== 404);
      setLoading(false);
    });
    getAvailableTransitions(id).then((response) => {
      if (current !== requestId.current) return;
      setTransitions(response.success && Array.isArray(response.data) ? response.data : []);
      setTransitionsLoading(false);
    });
  }, [id]);

  useFocusEffect(load);

  return { raw, loading, error, transitions, transitionsLoading, reload: load };
};

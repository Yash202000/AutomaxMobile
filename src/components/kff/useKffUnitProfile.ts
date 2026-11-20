import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { getKffUnitUsers } from '@/src/api/kffAuth';
import { getKffUnitResource, KffUnitResource } from '@/src/api/kffUnit';
import { loadKffSession } from '@/src/services/kffSession';

/**
 * Profile tab unit card: first the unit-user lookup
 * (GET /auth/unit/{deviceUniqueId}/user → uniqueId, unitId), then the unit
 * itself (GET /dispatch/resources/{unitId} → type, status, plate, location).
 * Refetched on every focus so a status change on the server shows up.
 */
export const useKffUnitProfile = () => {
  const [uniqueId, setUniqueId] = useState('');
  const [unit, setUnit] = useState<KffUnitResource | null>(null);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  const load = useCallback(() => {
    const current = ++requestId.current; // newer requests supersede older ones
    (async () => {
      const session = await loadKffSession();
      // The lookup path takes the device unique id, the same value the login
      // screen uses (falls back to the unit id if no device id was saved).
      const lookupId = session?.uniqueId || session?.unitId || '';
      if (!lookupId) {
        if (current === requestId.current) setLoading(false);
        return;
      }
      setLoading(true);

      const users = await getKffUnitUsers(lookupId);
      if (current !== requestId.current) return;
      const me = users.success
        ? users.data.find((u) => u.id === session?.userId) ?? users.data[0]
        : undefined;
      setUniqueId(me?.uniqueId || session?.uniqueId || '');

      const unitId = me?.unitId || session?.unitId;
      if (!unitId) {
        setLoading(false);
        return;
      }
      const resource = await getKffUnitResource(unitId);
      if (current !== requestId.current) return;
      if (resource.success) setUnit(resource.data);
      setLoading(false);
    })();
  }, []);

  useFocusEffect(load);

  return { uniqueId, unit, loading, reload: load };
};

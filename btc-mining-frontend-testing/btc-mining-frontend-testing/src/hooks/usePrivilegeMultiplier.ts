import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { get_data_uri, getMobileSecurityHeaders } from '../config/api';

/**
 * Effective Super Privilege multiplier for a user (1 = no active boost).
 * Refetches on every screen focus, same cadence as other per-screen data.
 * Non-critical — silently keeps the previous value on any fetch failure.
 */
export function usePrivilegeMultiplier(userId?: string | null): number {
  const [multiplier, setMultiplier] = useState(1);

  const fetchMultiplier = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${get_data_uri('PRIVILEGES')}/${userId}`, {
        headers: getMobileSecurityHeaders(),
      });
      const data = await res.json();
      if (data?.success && typeof data.effective_multiplier === 'number') {
        setMultiplier(data.effective_multiplier);
      }
    } catch {
      // Non-critical — leave multiplier at its previous value.
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      fetchMultiplier();
    }, [fetchMultiplier])
  );

  return multiplier;
}

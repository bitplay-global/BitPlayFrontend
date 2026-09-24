
import { get_data_uri } from '../config/api';

/**
 * Start or update mining session on backend
 *
 * @param userId - User ID
 * @param hashPower - Current hashpower
 * @param adsWatched - Number of ads watched
 * @param startTime - Mining start time (timestamp in ms)
 */
export const syncMiningSession = async (
  userId: string,
  hashPower: number,
  adsWatched: number,
  startTime: number
): Promise<void> => {
  try {
    const url = get_data_uri('MINING_SESSION_START');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        hash_power: hashPower,
        ads_watched: adsWatched,
        start_time: startTime,
      }),
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Mining session synced to backend:', data.session);
    } else {
      console.warn('⚠️ Failed to sync mining session:', data.message);
    }
  } catch (error: any) {
    console.error('❌ Error syncing mining session:', error.message);
    // Don't throw - this is a background sync, shouldn't break app
  }
};

/**
 * Update mining session when ads watched changes
 *
 *
 * @param userId - User ID
 * @param hashPower - Current hashpower
 * @param adsWatched - Number of ads watched
 */
export const updateMiningSession = async (
  userId: string,
  hashPower: number,
  adsWatched: number
): Promise<void> => {
  try {
    const url = get_data_uri('MINING_SESSION_UPDATE');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        hash_power: hashPower,
        ads_watched: adsWatched,
      }),
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Mining session updated:', data.session);
    } else {
      console.warn('⚠️ Failed to update mining session:', data.message);
    }
  } catch (error: any) {
    console.error('❌ Error updating mining session:', error.message);
  }
};

/**
 * Stop mining session on backend
 *
 * REASONING:
 * - Called when mining session expires or user stops manually
 * - Prevents duplicate expiry notifications
 * - Keeps backend state in sync
 *
 * @param userId - User ID
 */
export const stopMiningSession = async (userId: string): Promise<void> => {
  try {
    const url = get_data_uri('MINING_SESSION_STOP');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
      }),
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Mining session stopped on backend');
    } else {
      console.warn('⚠️ Failed to stop mining session:', data.message);
    }
  } catch (error: any) {
    console.error('❌ Error stopping mining session:', error.message);
  }
};

/**
 * Get mining session status from backend
 *
 * REASONING:
 * - Useful for debugging and verifying sync
 * - Can be used to restore state if local storage is lost
 *
 * @param userId - User ID
 * @returns Mining session data or null
 */
export const getMiningSessionStatus = async (
  userId: string
): Promise<any | null> => {
  try {
    const url = `${get_data_uri('MINING_SESSION_STATUS')}/${userId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (data.success) {
      return data.session;
    }

    return null;
  } catch (error: any) {
    console.error('❌ Error getting mining session status:', error.message);
    return null;
  }
};

export default {
  syncMiningSession,
  updateMiningSession,
  stopMiningSession,
  getMiningSessionStatus,
};

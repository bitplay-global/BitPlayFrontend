/**
 * Shared shape/key/version for the Home-screen local cache used to render
 * real content immediately on app open (last-known balance/hashpower/mining
 * state) instead of blocking behind a full-screen spinner while the network
 * fetch is in flight. See src/screens/HomeScreen.tsx for where this is read
 * and written, and src/stores/HashPowerStore.tsx which also seeds from it
 * (hashPower/purchasedHashpowerGh live in that separate context, not in
 * HomeScreen's own state).
 *
 * Bump HOME_CACHE_VERSION and update isValidHomeCache whenever this shape
 * changes in a backwards-incompatible way, so an old cached blob from a
 * previous app version is discarded instead of feeding stale/wrong-shaped
 * data into a calculation.
 */

export const HOME_CACHE_VERSION = 1;

export type HomeCacheLossTracking = {
  cumulativeLoss: number;
  dailyLossOffset: number;
  dailyAdsWatched: number;
  dailyAdsRequired: number;
  hasLossData: boolean;
};

export type HomeCacheShape = {
  version: typeof HOME_CACHE_VERSION;
  cachedAtMs: number;
  btcBalance: number;
  btcReferralBalance: number;
  userBalance: number;
  userBalanceBTC: number;
  totalHistoricalBTC: number;
  previousDayEarnings: number;
  localHashPower: number;
  hashPower: number;
  purchasedHashpowerGh: number;
  isMiningEnabled: boolean;
  startTime: number | null;
  stockGameBonus: number;
  adsWatched: number;
  threeGhAdsWatched: number;
  streakDays: number;
  streakBonusGh: number;
  userReferrals: number;
  recentActivity: any[];
  privilegeMultiplier: number;
  dailyRewardClaimed: boolean;
  dailyProgress: {
    videosWatchedToday: number;
    dailyTarget: number;
    remaining: number;
    isComplete: boolean;
    hasActiveSubscription: boolean;
    requirementActive: boolean;
  } | null;
  lossTracking: HomeCacheLossTracking | null;
};

export const getHomeCacheKey = (userId: string) => `home_cache_${userId}`;

/** Type guard + version gate — treat anything from an older/incompatible
 * cache shape as absent rather than risk feeding it into state. */
export function isValidHomeCache(value: unknown): value is HomeCacheShape {
  return (
    !!value &&
    typeof value === "object" &&
    (value as any).version === HOME_CACHE_VERSION
  );
}

import { Platform } from 'react-native';

/**
 * "Super Privileges" — one-time-purchase (renewable annually), stacking
 * multipliers on the special ad-watch track's per-claim reward.
 * Store side: Android = Consumable one-time product, iOS = Non-Renewing
 * Subscription. Both are "products only" in RevenueCat (no Offering), so
 * they're fetched directly via Purchases.getProducts(), not getOfferings().
 *
 * Keep `tier` and `multiplier` in sync with the backend's TIER_CATALOG in
 * routes/api_routes/privileges.js.
 */
/** Base Super Ad Miner reward per claim (Gh/s), before any privilege multiplier.
 *  Must match BASE_HASHPOWER_PER_AD in HomeScreen.tsx / user-mining-handles.js.
 *
 *  NOTE: this is the RAW per-ad reward. The privilege multiplier is applied
 *  SERVER-side -- clients POST this raw value as the increment and read the
 *  multiplied result back as `effective_hashpower`. Never multiply it locally
 *  before sending, or the bonus gets applied twice. */
export const BASE_HASHPOWER_PER_AD = 5.5;

/**
 * Max claims/day on the Super Ad Miner ad-watch track — must match the
 * backend's cap on `rewarded_ads_watched`.
 *
 * Lives here rather than in one screen because two screens now share this
 * single daily counter: HomeScreen's "+100% Claim" video card and the
 * Super Privileges store's "Watch Ads" button. They must never disagree
 * about the cap, or one would let the user past a limit the other enforces.
 */
export const MAX_VIDEO_CLAIMS_PER_TRACK_PER_DAY = 60;

/**
 * Super Privileges "Watch Ads" allowance — videos per day, per purchased plan.
 *
 * This is DELIBERATELY separate from MAX_VIDEO_CLAIMS_PER_TRACK_PER_DAY above.
 * That 60 is the Super Ad Miner track shared with HomeScreen; this 50 is the
 * privilege holder's own daily allowance and is counted independently, so
 * watching on Home does not eat into it (and vice versa).
 */
export const PRIVILEGE_ADS_PER_DAY = 50;

export type PrivilegeTier = '5000pct' | '10000pct';

export type PrivilegeTierConfig = {
  tier: PrivilegeTier;
  multiplier: number; // factor added to the base 1x, e.g. 50 for +5000%
  label: string; // display label, e.g. "+5000%"
  productId: string; // platform-specific store identifier
  /**
   * Flat Gh/s credited per video watched from the Super Privileges screen.
   *
   * Deliberately a fixed number rather than BASE_HASHPOWER_PER_AD * multiplier:
   * the plans are now sold as a daily total (ghPerAd x PRIVILEGE_ADS_PER_DAY),
   * which the old 5.5-times-multiplier arithmetic does not produce.
   *   +5000%  -> 10 x 50 =  500 Gh/s/day
   *   +10000% -> 20 x 50 = 1000 Gh/s/day
   */
  ghPerAd: number;
};

export const PRIVILEGE_TIERS: PrivilegeTierConfig[] = [
  {
    tier: '5000pct',
    multiplier: 50,
    label: '+5000%',
    ghPerAd: 10,
    // Android: RevenueCat has this registered as just the base product ID (no
    // ":purchase-option-id" suffix) — confirmed from the RevenueCat Products
    // dashboard. Each product only has one purchase option, so the base ID
    // alone is enough for getProducts() to resolve it.
    productId: Platform.select({
      android: 'bitplay.super_privilege_5000pct',
      ios: 'com.bitplaypro.bitplaypro.super_privilegeplan_5000pct',
    })!,
  },
  {
    tier: '10000pct',
    multiplier: 100,
    label: '+10000%',
    ghPerAd: 20,
    productId: Platform.select({
      android: 'bitplay.super_privilege_10000pct',
      ios: 'com.bitplaypro.bitplaypro.super_privilegeplan_10000pct',
    })!,
  },
];

export const PRIVILEGE_PRODUCT_IDS = PRIVILEGE_TIERS.map(t => t.productId);

export function getTierByProductId(productId: string): PrivilegeTierConfig | undefined {
  return PRIVILEGE_TIERS.find(t => t.productId === productId);
}

/** Gh/s a plan yields per day if every allowed video is watched. */
export function dailyGhForTier(tier: PrivilegeTierConfig): number {
  return tier.ghPerAd * PRIVILEGE_ADS_PER_DAY;
}

/** 1 Th/s = 1000 Gh/s — same convention Store.tsx uses when converting plans. */
export const GH_PER_TH = 1000;

/**
 * Formats a Gh/s figure for display, promoting to Th/s once it reaches a whole
 * terahash. The +10000% plan yields 1000 Gh/s/day, which reads better as
 * "1 Th/s" than "1000 Gh/s".
 *
 * Returns the value and unit separately so callers can style them differently
 * (the summary card renders the unit in a smaller, dimmer style).
 */
export function formatHashrate(gh: number): { value: string; unit: string } {
  if (gh >= GH_PER_TH) {
    const th = gh / GH_PER_TH;
    // Trim a trailing ".0" so 1000 -> "1", but keep 1500 -> "1.5".
    return { value: Number.isInteger(th) ? String(th) : th.toFixed(1), unit: 'Th/s' };
  }
  return { value: Number.isInteger(gh) ? String(gh) : gh.toFixed(2), unit: 'Gh/s' };
}

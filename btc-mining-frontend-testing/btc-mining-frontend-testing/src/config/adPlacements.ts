/**
 * Which ad formats the app is currently allowed to show.
 *
 * Banners are off: the AdMob report showed the top and bottom slots earning
 * essentially nothing, so they were costing screen space and layout complexity
 * for no revenue. Rewarded video -- which users opt into for a reward, and
 * which is where the revenue actually is -- is unaffected.
 *
 * This is a switch rather than a deletion so banners can come back by flipping
 * one flag, whether that is a better unit, a mediated one, or a different
 * placement worth testing.
 */
export const BANNER_ADS_ENABLED = false;

// There is deliberately no rewarded switch here. Rewarded video is where the
// revenue is, and a flag that could turn it off by accident is a liability.

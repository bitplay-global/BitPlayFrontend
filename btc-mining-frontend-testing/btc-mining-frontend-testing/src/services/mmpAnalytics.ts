import { NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MMP,
  adaptKeyValueStore,
  createNativeBridge,
} from '@mmp/react-native';

/**
 * MMP (self-hosted mobile measurement platform) — runs alongside Apptrove,
 * not instead of it. See apptroveAnalytics.ts for the existing tracker;
 * these mirror the same call sites so both receive the same events, on the
 * theory that a newer platform earns trust by matching a known-good one
 * before anything is removed.
 *
 * `initialize()` sends the install event itself (exactly once) and owns
 * `login`/`signup`/`consent_update` as reserved event names -- track()
 * rejects them, which is why the mirrors below use non-colliding names
 * ("user_login", "account_signup") rather than the same strings Apptrove
 * uses for its own (unrelated) event IDs.
 */
const MMP_API_KEY = 'mmp_live_bHO3HI7zvAzG_gPxDGvTd8v2Btr5RaF0N7vo1N8NjBDCD8l2OuQmokY3';
const MMP_ENDPOINT = 'https://mmp.adaptsmedia.info';

let initialized = false;

/** Call once at app startup, alongside Apptrove/RevenueCat init. Never throws. */
export async function initializeMmp(): Promise<void> {
  if (initialized) return;
  try {
    await MMP.initialize(
      { apiKey: MMP_API_KEY, endpoint: MMP_ENDPOINT },
      {
        storage: adaptKeyValueStore(AsyncStorage),
        // Android: install referrer + GAID, if the app's own Play Services /
        // installreferrer deps are present (both are compileOnly in the SDK
        // -- see libs/mmp-react-native/README.md). iOS: IDFA, gated on ATT
        // exactly like Apptrove's waitForATTUserAuthorization elsewhere in
        // App.tsx. Native module wiring is unverified beyond the SDK's own
        // simulator/CI checks -- see "Verification status" in that README --
        // so treat first-run device logs as the real test.
        native: createNativeBridge(NativeModules.MmpNative),
      },
    );
    initialized = true;
  } catch (err) {
    if (__DEV__) console.warn('[MMP] initialize failed:', err);
  }
}

function safeTrack(name: string, options: Parameters<typeof MMP.track>[1] = {}): void {
  MMP.track(name, options).catch((err) => {
    if (__DEV__) console.warn(`[MMP] track "${name}" failed:`, err);
  });
}

/** Converts a decimal fiat price ("9.99") to integer minor units (999). */
function toMinorUnits(price: number): number {
  return Math.round(price * 100);
}

export function setMmpUserId(userId: string | null): void {
  MMP.setUserId(userId).catch(() => {});
}

/** Mirrors trackSignupCompleted. "signup" itself is reserved -- see file header. */
export function trackMmpSignupCompleted(userId: string, method: string = 'email'): void {
  setMmpUserId(userId);
  safeTrack('account_signup', { properties: { method } });
}

/** Mirrors trackLogin. "login" itself is reserved -- see file header. */
export function trackMmpLogin(userId: string, method: string = 'email'): void {
  setMmpUserId(userId);
  safeTrack('user_login', { properties: { method } });
}

/** Mirrors trackPurchase. */
export function trackMmpPurchase(
  planName: string,
  productIdentifier: string,
  price: number,
  currency: string,
): void {
  safeTrack('purchase', {
    properties: { plan_name: planName, product_identifier: productIdentifier },
    revenueMinor: toMinorUnits(price),
    currency,
  });
}

/** Mirrors trackCheckoutStarted. */
export function trackMmpCheckoutStarted(
  planName: string,
  price: number,
  currency: string = 'USD',
): void {
  safeTrack('checkout_started', {
    properties: { plan_name: planName },
    revenueMinor: toMinorUnits(price),
    currency,
  });
}

/** Mirrors trackMiningStarted. */
export function trackMmpMiningStarted(hashPower: number, userId: string): void {
  safeTrack('mining_started', { properties: { hash_power: hashPower, user_id: userId } });
}

/**
 * Mirrors trackWithdrawalRequested. Not sent as revenueMinor/currency: that
 * field is fiat minor-units by contract (LIMITS/TrackOptions in types.ts),
 * and a BTC amount doesn't have a "minor unit" in that sense -- forcing it
 * through would either truncate satoshis or misrepresent the currency.
 * Carried as a plain property instead.
 */
export function trackMmpWithdrawalRequested(
  method: string,
  amountBtc: string | number,
  userId: string,
): void {
  const amount = typeof amountBtc === 'number' ? amountBtc : parseFloat(amountBtc) || 0;
  safeTrack('withdrawal_requested', {
    properties: { method, amount_btc: amount, user_id: userId },
  });
}

/** Mirrors trackAdFailedToLoad. */
export function trackMmpAdFailedToLoad(adUnitId: string, errorMessage: string): void {
  safeTrack('ad_failed_to_load', { properties: { ad_unit_id: adUnitId, error: errorMessage } });
}

/** Mirrors trackNotificationClicked. */
export function trackMmpNotificationClicked(notificationId: string, title: string = ''): void {
  safeTrack('notification_clicked', { properties: { notification_id: notificationId, title } });
}

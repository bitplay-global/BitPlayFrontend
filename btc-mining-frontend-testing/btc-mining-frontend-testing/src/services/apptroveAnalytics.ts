import { ApptroveSDK, ApptroveEvent } from 'react-native-apptrove';

/**
 * Apptrove analytics — deliberately limited to the events that are actually
 * used in reporting. Everything else was removed rather than left firing,
 * because unused events add noise to the dashboard without informing any
 * decision.
 *
 * The events that remain:
 *
 *   Install               ApptroveSDK.fireInstall() in App.tsx (SDK-level
 *                         attribution, not a tracked event -- not defined here)
 *   first_open            trackFirstOpen
 *   Sign-Up               trackSignupCompleted
 *   Login                 trackLogin
 *   Purchase              trackPurchase
 *   mining_started        trackMiningStarted
 *   ad_failed_to_load     trackAdFailedToLoad
 *   notification_clicked  trackNotificationClicked
 *   Checkout Started      trackCheckoutStarted
 *   withdrawal_requested  trackWithdrawalRequested
 *
 * The SDK (Trackier-based) takes SHORT ALPHANUMERIC IDs, never event names.
 * Custom IDs come from Apptrove Dashboard -> Events -> ID column; predefined
 * catalog IDs are the same across accounts.
 */
const EVENTS = {
  // Predefined catalog IDs
  LOGIN: 'o91gt1Q0PK',
  SIGNUP: '8ASKXJ1vWO',
  CHECKOUT_STARTED: '34mjlWJaHL',

  // Custom, dashboard-assigned IDs
  FIRST_OPEN: 'IyaWj0QKSR',
  NOTIFICATION_CLICKED: '2IWxZ7gNQq',
  MINING_STARTED: 'BtBEVKSX3z',
  WITHDRAWAL_REQUESTED: 'P2TiRqB0DL',
  AD_FAILED_TO_LOAD: '98eXaGdP5G',
} as const;

function safeTrack(event: ApptroveEvent): void {
  try {
    ApptroveSDK.trackEvent(event);
  } catch (err) {
    if (__DEV__) {
      console.warn(`[Apptrove] trackEvent failed for "${event.eventId}":`, err);
    }
  }
}

/** first_open — fired on every cold start; Apptrove deduplicates server-side. */
export function trackFirstOpen(platform: string): void {
  const event = new ApptroveEvent(EVENTS.FIRST_OPEN);
  event.param1 = platform;
  safeTrack(event);
}

/** Sign-Up — fired once the account is created. */
export function trackSignupCompleted(userId: string, method: string = 'email'): void {
  const event = new ApptroveEvent(EVENTS.SIGNUP);
  event.param1 = userId;
  event.param2 = method;
  safeTrack(event);
}

/** Login — fired on a successful sign-in. */
export function trackLogin(userId: string, method: string = 'email'): void {
  const event = new ApptroveEvent(EVENTS.LOGIN);
  event.param1 = userId;
  event.param2 = method;
  safeTrack(event);
}

/**
 * Purchase — the SDK's native PURCHASE constant, so it lands in the dashboard's
 * revenue reporting rather than as a custom event.
 */
export function trackPurchase(
  planName: string,
  productIdentifier: string,
  price: number,
  currency: string,
): void {
  const event = new ApptroveEvent(ApptroveEvent.PURCHASE);
  event.param1 = planName;
  event.param2 = productIdentifier;
  event.revenue = price;
  event.currency = currency;
  safeTrack(event);
}

/** Checkout Started — fired when the user commits to buying a plan. */
export function trackCheckoutStarted(
  planName: string,
  price: number,
  currency: string = 'USD',
): void {
  const event = new ApptroveEvent(EVENTS.CHECKOUT_STARTED);
  event.param1 = planName;
  event.revenue = price;
  event.currency = currency;
  safeTrack(event);
}

/** mining_started — fired when a mining session begins. */
export function trackMiningStarted(hashPower: number, userId: string): void {
  const event = new ApptroveEvent(EVENTS.MINING_STARTED);
  event.param1 = String(hashPower);
  event.param2 = userId;
  safeTrack(event);
}

/**
 * withdrawal_requested — fired when a withdrawal is submitted.
 * Argument order matches the existing call sites in WithdrawalScreenNew.
 */
export function trackWithdrawalRequested(
  method: string,
  amountBtc: string | number,
  userId: string,
): void {
  const amount = typeof amountBtc === 'number' ? amountBtc : parseFloat(amountBtc) || 0;
  const event = new ApptroveEvent(EVENTS.WITHDRAWAL_REQUESTED);
  event.param1 = method;
  event.param2 = userId;
  event.revenue = amount;
  event.currency = 'BTC';
  safeTrack(event);
}

/** ad_failed_to_load — fired from googleAds.ts, so it covers every ad slot. */
export function trackAdFailedToLoad(adUnitId: string, errorMessage: string): void {
  const event = new ApptroveEvent(EVENTS.AD_FAILED_TO_LOAD);
  event.param1 = adUnitId;
  event.param2 = errorMessage;
  safeTrack(event);
}

/** notification_clicked — fired when a push notification is opened. */
export function trackNotificationClicked(notificationId: string, title: string = ''): void {
  const event = new ApptroveEvent(EVENTS.NOTIFICATION_CLICKED);
  event.param1 = notificationId;
  event.param2 = title;
  safeTrack(event);
}

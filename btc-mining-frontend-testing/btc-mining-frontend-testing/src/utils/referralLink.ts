import { Linking } from 'react-native';
import { saveToStorage, getFromStorage, removeFromStorage } from '../config/storage';

/**
 * Referral codes arriving by link.
 *
 * The invite QR and share message carry `?ref=<code>`, but nothing read it:
 * the invitee had to retype the code into an optional field at signup, which
 * is where most of the funnel was being lost.
 *
 * A code captured from a link is held here until the signup form can use it,
 * because the link usually opens the app well before the user reaches signup.
 *
 * NOTE: this only covers a link opened by an ALREADY INSTALLED app. Attributing
 * someone who taps the link, installs from the store, and opens the app for the
 * first time is deferred deep linking, which needs either the Apptrove/Trackier
 * deep-link feature or verified app links (assetlinks.json / AASA hosted on
 * bitplaypro.com).
 */
const PENDING_REFERRAL_KEY = 'pendingReferralCode';

/** Pulls `ref` out of a URL. Accepts the https link and the bitplaypro:// scheme. */
export function parseReferralFromUrl(url?: string | null): string | null {
  if (!url) return null;
  const match = url.match(/[?&]ref=([^&#\s]+)/i);
  if (!match) return null;
  try {
    const code = decodeURIComponent(match[1]).trim();
    // Codes are 6 alphanumerics; anything else is not one of ours.
    return /^[A-Za-z0-9]{4,12}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}

export function setPendingReferralCode(code: string) {
  saveToStorage(PENDING_REFERRAL_KEY, code);
}

export function getPendingReferralCode(): string | null {
  return getFromStorage(PENDING_REFERRAL_KEY) ?? null;
}

export function clearPendingReferralCode() {
  removeFromStorage(PENDING_REFERRAL_KEY);
}

/**
 * Starts listening for referral links. Handles both the URL the app was cold-
 * started with and any arriving while it runs. Returns an unsubscribe function.
 */
export function startReferralLinkCapture(): () => void {
  const capture = (url?: string | null) => {
    const code = parseReferralFromUrl(url);
    if (code) setPendingReferralCode(code);
  };

  Linking.getInitialURL().then(capture).catch(() => {});
  const sub = Linking.addEventListener('url', ({ url }) => capture(url));
  return () => sub.remove();
}

/**
 * Update prompt.
 * - First choice: the policy set in the admin dashboard (Settings -> app version
 *   policy; backend GET /api/app-version-policy, helpers/versionPolicy.js):
 *   latest / force-below versions per platform, optional or forced, its own
 *   title, message and button.
 * - When that policy is off or unreachable: the store's latest version, from
 *   iTunes Lookup (iOS) or the Play Store page (Android), as before.
 */

import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { SERVER_BASE_URL } from '../config/api';

// App store identifiers (match android/app/build.gradle and ios project)
const ANDROID_PACKAGE_ID = 'com.bitplay.app';
const IOS_BUNDLE_ID = 'com.bitplaypro.bitplaypro';

/** Compare two version strings (e.g. "1.0.18" vs "1.0.19"). Returns: 1 if a > b, -1 if a < b, 0 if equal. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => v.split('.').map(Number);
  const partsA = parse(a);
  const partsB = parse(b);
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const na = partsA[i] ?? 0;
    const nb = partsB[i] ?? 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}


/** Get current app version from the device. */
export async function getCurrentVersion(): Promise<string> {
  return DeviceInfo.getVersion();
}

/** Get latest version from App Store using iTunes Lookup API (no auth required). */
async function getLatestVersionIOS(): Promise<string | null> {
  try {
    const url = `https://itunes.apple.com/lookup?bundleId=${IOS_BUNDLE_ID}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    console.log("res", res)
    if (!res.ok) return null;
    const data = await res.json();
    console.log("data", data)
    const results = data?.results;
    console.log("results", results)
    if (!Array.isArray(results) || results.length === 0) return null;
    const version = results[0].version;
    return typeof version === 'string' ? version : null;
  } catch {
    return null;
  }
}

/** Get latest version from Play Store by parsing the store page HTML. */
async function getLatestVersionAndroid(): Promise<string | null> {
  try {
    const url = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_ID}&hl=en`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
        'Accept': 'text/html',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Pattern that often appears in Play Store page for version
    const match = html.match(/\[\[\["(\d+\.\d+(?:\.\d+)?(?:\.\d+)?)"\]\]\]/);
    if (match?.[1]) return match[1];
    // Fallback: look for softwareVersion or similar
    const alt = html.match(/"softwareVersion"\s*:\s*"([^"]+)"/);
    if (alt?.[1]) return alt[1];
    return null;
  } catch {
    return null;
  }
}

/** Get store URL to open for updating the app. */
export function getStoreUrl(): string {
  if (Platform.OS === 'android') {
    return `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_ID}`;
  }
  // iOS: iTunes lookup returns trackViewUrl; we use generic app store search as fallback
  return `https://apps.apple.com/app/id?mt=8`; // will replace id when we have it
}

/** Get iOS App Store URL with numeric app id (from iTunes lookup). */
async function getIosStoreUrl(): Promise<string> {
  try {
    const url = `https://itunes.apple.com/lookup?bundleId=${IOS_BUNDLE_ID}`;
    const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
    if (!res.ok) return `https://apps.apple.com/app/id?mt=8`;
    const data = await res.json();
    const trackId = data?.results?.[0]?.trackId;
    const trackViewUrl = data?.results?.[0]?.trackViewUrl;
    if (typeof trackViewUrl === 'string' && trackViewUrl.startsWith('http')) return trackViewUrl;
    if (trackId != null) return `https://apps.apple.com/app/id${trackId}?mt=8`;
  } catch {
    // ignore
  }
  return `https://apps.apple.com/app/id?mt=8`;
}

export type ForceUpdateResult = {
  /** True when a prompt should be shown (optional or forced). */
  forceUpdate: boolean;
  currentVersion: string;
  latestVersion: string | null;
  storeUrl: string;
  /** False when the user must update: no "Later", no tap-outside to close. */
  dismissible?: boolean;
  title?: string;
  message?: string;
  buttonText?: string;
};

type PlatformPolicy = {
  mode?: string;
  latestVersion?: string;
  minSupportedVersion?: string;
  forceUpdateBelowVersion?: string;
  storeUrl?: string;
  dismissible?: boolean;
};
type VersionPolicy = PlatformPolicy & {
  enabled?: boolean;
  title?: string;
  message?: string;
  buttonText?: string;
  android?: PlatformPolicy;
  ios?: PlatformPolicy;
};

async function fetchVersionPolicy(): Promise<VersionPolicy | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${SERVER_BASE_URL}/api/app-version-policy`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as VersionPolicy;
  } catch {
    return null;
  }
}

/**
 * What the dashboard policy says for this install, or null to fall back to
 * the store check. Platform settings win over the general ones.
 */
export function evaluatePolicy(
  policy: VersionPolicy | null,
  current: string,
  platform: 'ios' | 'android',
  fallbackStoreUrl: string,
): ForceUpdateResult | null {
  if (!policy?.enabled) return null;
  const p: PlatformPolicy = policy[platform] || {};
  const pick = (k: keyof PlatformPolicy): string => {
    const own = p[k];
    if (typeof own === 'string' && own.trim()) return own.trim();
    const general = policy[k];
    return typeof general === 'string' ? general.trim() : '';
  };
  const mode = pick('mode') || 'optional';
  const latest = pick('latestVersion');
  const forceBelow = pick('forceUpdateBelowVersion') || pick('minSupportedVersion');
  const below = (v: string) => !!v && compareVersions(current, v) < 0;

  const forced = below(forceBelow) || (mode === 'force' && below(latest));
  const prompt = mode !== 'none' && (forced || below(latest));
  const dismissible = !forced && (typeof p.dismissible === 'boolean' ? p.dismissible : policy.dismissible !== false);
  return {
    forceUpdate: prompt,
    currentVersion: current,
    latestVersion: latest || null,
    storeUrl: pick('storeUrl') || fallbackStoreUrl,
    dismissible,
    title: policy.title || undefined,
    message: policy.message || undefined,
    buttonText: policy.buttonText || undefined,
  };
}

/**
 * Check if the user needs to force update.
 * Returns forceUpdate: true when latest store version is greater than current app version.
 */
export async function checkForceUpdate(): Promise<ForceUpdateResult> {
  const current = await getCurrentVersion();
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const fallbackStoreUrl = platform === 'ios' ? await getIosStoreUrl() : getStoreUrl();

  const fromPolicy = evaluatePolicy(await fetchVersionPolicy(), current, platform, fallbackStoreUrl);
  if (fromPolicy) return fromPolicy;

  const latest = platform === 'ios' ? await getLatestVersionIOS() : await getLatestVersionAndroid();
  const forceUpdate =
    latest != null && latest !== '' && compareVersions(latest, current) > 0;

  return {
    forceUpdate,
    currentVersion: current,
    latestVersion: latest,
    storeUrl: fallbackStoreUrl,
    dismissible: true,
  };
}

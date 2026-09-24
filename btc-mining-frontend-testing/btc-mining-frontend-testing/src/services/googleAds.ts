import mobileAds, { MaxAdContentRating } from 'react-native-google-mobile-ads';
import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
} from 'react-native-google-mobile-ads';
import { useEffect, useState, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { DEFAULT_ADMOB_REWARDED_ID } from './adUnitDefaults';
import { useAdConfig } from '../providers/AdConfigProvider';
import {
  trackAdFailedToLoad,
} from './apptroveAnalytics';
import { trackMmpAdFailedToLoad } from './mmpAnalytics';

export type RewardedVideoOptions = {
  /** AdMob rewarded from API (`rewardedVideoId`), else {@link DEFAULT_ADMOB_REWARDED_ID}. */
  primaryUnitId?: string | null;
  /**
   * Second demand source tried when the primary fails, defaulting to the
   * config's `gamRewardedVideoId`. Pass null to opt a call site out.
   */
  fallbackUnitId?: string | null;
};

/**
 * Google's public sample publisher. Ad units under it serve test ads to
 * everyone and earn nothing, and showing them in a production build is an
 * AdMob policy risk -- so they are dropped from the waterfall outside __DEV__.
 *
 * This is not hypothetical: the production ad config currently returns
 * `ca-app-pub-3940256099942544/5224354917` as gamRewardedVideoId. Without this
 * guard, adding the fallback would have started serving test ads to real users.
 */
const GOOGLE_SAMPLE_PUBLISHER = 'ca-app-pub-3940256099942544';
/** Google's sample Ad Manager network. */
const GOOGLE_SAMPLE_GAM_NETWORK = '/6499/';

export function isGoogleSampleAdUnit(unitId: string): boolean {
  return unitId.includes(GOOGLE_SAMPLE_PUBLISHER) || unitId.startsWith(GOOGLE_SAMPLE_GAM_NETWORK);
}

const warnedSampleUnits = new Set<string>();

/** The units to try, in order, with sample units filtered out of release builds. */
function buildWaterfall(primary: string, fallback?: string | null): string[] {
  const candidates = [primary, fallback ?? ''].filter(Boolean) as string[];
  const usable = candidates.filter(unitId => {
    if (__DEV__ || !isGoogleSampleAdUnit(unitId)) return true;
    if (!warnedSampleUnits.has(unitId)) {
      warnedSampleUnits.add(unitId);
      console.warn(
        `[Ads] Ignoring ad unit ${unitId}: it belongs to Google's sample publisher, ` +
        'which serves test ads and earns nothing. Fix the ad config on the server.',
      );
    }
    return false;
  });
  // Never end up with nothing to request.
  return usable.length > 0 ? Array.from(new Set(usable)) : [primary];
}

const initializeGoogleAds = async () => {
  await mobileAds().setRequestConfiguration({
    maxAdContentRating: MaxAdContentRating.PG,
  });
  await mobileAds().initialize();
};

/**
 * Backoff between load retries after a failed request, in ms. Repeats the last
 * value indefinitely.
 *
 * A rewarded request failing with `no-fill` is routine on a real device once a
 * user has watched a few ads -- fill is never guaranteed. Before this, a single
 * failure was terminal: ERROR left the ad unloaded and nothing retried, so the
 * button said "still loading" until the app was killed and the hook remounted.
 */
const RETRY_BACKOFF_MS = [2_000, 5_000, 15_000, 30_000, 60_000];

/** If a load neither succeeds nor errors within this, rebuild the request. */
const LOAD_WATCHDOG_MS = 45_000;

/**
 * Google documents rewarded/interstitial ads as expiring roughly 1 hour after
 * they finish loading -- calling show() past that point fails silently at the
 * native layer (fires AdEventType.ERROR, no impression). A slot can easily
 * sit "loaded" that long: it's shared across every screen that wants the
 * unit and only rebuilds when a subscriber actually calls show() or the app
 * backgrounds/foregrounds, so a user who loads Home and doesn't tap "watch
 * ad" for a while would otherwise hit an ad that looks ready but isn't.
 * Refresh a bit ahead of the real expiry as a safety margin.
 */
const AD_FRESHNESS_MS = 50 * 60 * 1000;

type Subscriber = {
  onReward?: (amount: number, type: string) => void;
  onClosed?: () => void;
  notify: () => void;
};

/**
 * One in-flight rewarded ad per ad unit, shared by every screen asking for it.
 *
 * Each `useRewardedVideoAd` call used to own a private RewardedAd, so a single
 * game screen fired two identical requests (claim + retry) and Home fired
 * three. Measured on a device: four requests for the same unit inside one
 * second. Beyond the waste, it makes thin inventory look worse than it is --
 * two requests competing for the same scarce fill, where one cached ad would
 * have served whichever button the user actually pressed.
 *
 * Rewards and close events are routed ONLY to the subscriber that called
 * show() (the `presenter`), so sharing an instance never crosses the claim and
 * retry callbacks over.
 */
type AdSlot = {
  /** Identity of the slot: the primary unit id. */
  unitId: string;
  /** Units to try in order; index resets to 0 after a successful load. */
  units: string[];
  unitIndex: number;
  ad: RewardedAd | null;
  loaded: boolean;
  /** When the current `ad` fired LOADED, for the expiry check in show(). */
  loadedAt: number | null;
  loading: boolean;
  retry: number;
  /** Bumped on every rebuild so a stale instance's events are ignored. */
  generation: number;
  timers: Set<ReturnType<typeof setTimeout>>;
  unsubs: Array<() => void>;
  subs: Set<Subscriber>;
  presenter: Subscriber | null;
};

const slots = new Map<string, AdSlot>();

function getSlot(unitId: string, fallbackUnitId?: string | null): AdSlot {
  let slot = slots.get(unitId);
  if (!slot) {
    slot = {
      unitId, units: buildWaterfall(unitId, fallbackUnitId), unitIndex: 0,
      ad: null, loaded: false, loadedAt: null, loading: true, retry: 0, generation: 0,
      timers: new Set(), unsubs: [], subs: new Set(), presenter: null,
    };
    slots.set(unitId, slot);
  } else if (fallbackUnitId !== undefined) {
    // The config arrives asynchronously, so the fallback may only show up on a
    // later render than the one that created the slot.
    const units = buildWaterfall(unitId, fallbackUnitId);
    if (units.join('|') !== slot.units.join('|')) {
      slot.units = units;
      slot.unitIndex = Math.min(slot.unitIndex, units.length - 1);
    }
  }
  return slot;
}

function notify(slot: AdSlot) {
  slot.subs.forEach(sub => sub.notify());
}

function clearTimers(slot: AdSlot) {
  slot.timers.forEach(clearTimeout);
  slot.timers.clear();
}

function schedule(slot: AdSlot, fn: () => void, ms: number) {
  const timer = setTimeout(() => {
    slot.timers.delete(timer);
    fn();
  }, ms);
  slot.timers.add(timer);
}

function detach(slot: AdSlot) {
  slot.unsubs.forEach(u => { try { u(); } catch { /* already gone */ } });
  slot.unsubs = [];
  slot.ad = null;
}

/** Builds a fresh RewardedAd for the slot and requests an ad. */
function build(slot: AdSlot) {
  // Nothing on screen wants this unit; don't churn in the background.
  if (slot.subs.size === 0) return;

  // Never rebuild underneath an ad the user is currently watching. detach()
  // strips the listeners off that live instance, so EARNED_REWARD and CLOSED
  // never arrive: the user watches the whole ad and is credited nothing, and
  // `presenter` is left set forever, which makes every later show() bail out
  // too -- the button goes dead until the app is restarted.
  //
  // Both the load watchdog and a second show() tap used to land here mid-ad.
  // The CLOSED handler queues the next load, so skipping now costs nothing.
  if (slot.presenter) return;

  clearTimers(slot);
  detach(slot);

  const generation = ++slot.generation;
  const isStale = () => slot.generation !== generation;

  const requestedUnit = slot.units[slot.unitIndex] ?? slot.unitId;
  const ad = RewardedAd.createForAdRequest(requestedUnit);
  slot.ad = ad;
  slot.loaded = false;
  slot.loading = true;
  notify(slot);

  slot.unsubs = [
    ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      if (isStale()) return;
      slot.retry = 0;
      // Next request starts from the top of the waterfall again, so the
      // primary unit always gets first refusal.
      slot.unitIndex = 0;
      slot.loaded = true;
      slot.loadedAt = Date.now();
      slot.loading = false;
      // The watchdog exists to catch a request that never resolves. This one
      // resolved, so disarm it -- left armed it fires 45s later regardless,
      // which is typically in the middle of the ad it just loaded.
      clearTimers(slot);
      notify(slot);
    }),
    ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, reward => {
      if (isStale()) return;
      slot.presenter?.onReward?.(reward.amount, reward.type);
    }),
    ad.addAdEventListener(AdEventType.CLOSED, () => {
      if (isStale()) return;
      const presenter = slot.presenter;
      slot.presenter = null;
      slot.loaded = false;
      slot.loadedAt = null;
      slot.loading = true;
      notify(slot);
      presenter?.onClosed?.();
      // Don't rebuild synchronously: the ad's native Activity is still tearing
      // down and control is still returning to MainActivity. Doing it
      // immediately is a known trigger for the Activity transition getting
      // stuck (app appears frozen, close/back stop responding) on some Android
      // devices. A short delay lets the transition finish first.
      schedule(slot, () => build(slot), 500);
    }),
    ad.addAdEventListener(AdEventType.ERROR, error => {
      if (isStale()) return;
      // This fires for a show()-time failure (e.g. the ad expired while
      // sitting loaded -- Google docs it at ~1hr) exactly the same as a
      // load-time failure; the SDK doesn't distinguish them. Previously
      // `presenter` was only ever cleared on CLOSED, so a show-time error
      // left it stuck set: show() then treats the slot as "already showing"
      // forever and just silently rebuilds instead of ever showing an ad
      // again, for the rest of that screen's mount -- a user hitting this
      // would see the button do nothing on every subsequent tap. Tell
      // whoever was presenting (if anyone) that this attempt is over so
      // their loading state clears instead of spinning forever, then treat
      // it exactly like CLOSED for presenter bookkeeping.
      const presenter = slot.presenter;
      slot.presenter = null;
      slot.loaded = false;
      slot.loadedAt = null;
      slot.loading = false;
      notify(slot);
      presenter?.onClosed?.();
      trackAdFailedToLoad(requestedUnit, String((error as any)?.code ?? 'unknown'));
      trackMmpAdFailedToLoad(requestedUnit, String((error as any)?.code ?? 'unknown'));

      // Another demand source left to try: go straight to it. A no-fill on one
      // unit says nothing about the next.
      if (slot.unitIndex < slot.units.length - 1) {
        slot.unitIndex += 1;
        schedule(slot, () => build(slot), 300);
        return;
      }

      // Whole waterfall failed. Back off and start again from the top. Fill
      // often returns on its own a little later, and the alternative is a
      // button that never works again this session.
      slot.unitIndex = 0;
      const delay = RETRY_BACKOFF_MS[Math.min(slot.retry, RETRY_BACKOFF_MS.length - 1)];
      slot.retry += 1;
      schedule(slot, () => build(slot), delay);
    }),
  ];

  // Belt and braces: if the request neither loads nor errors, rebuild.
  schedule(slot, () => { if (!isStale()) build(slot); }, LOAD_WATCHDOG_MS);

  ad.load();
}

// Coming back to the foreground is the other natural moment to try again --
// and it is what users do by hand when the button stops working.
let appStateBound = false;
function bindAppState() {
  if (appStateBound) return;
  appStateBound = true;
  AppState.addEventListener('change', state => {
    if (state !== 'active') return;
    slots.forEach(slot => {
      if (slot.subs.size === 0 || slot.loaded || slot.presenter) return;
      slot.retry = 0;
      build(slot);
    });
  });
}

export function useRewardedVideoAd(
  onReward?: (amount: number, type: string) => void,
  options?: RewardedVideoOptions,
  onAdClosed?: () => void,
) {
  const admobId =
    (options?.primaryUnitId && options.primaryUnitId.trim()) ||
    DEFAULT_ADMOB_REWARDED_ID;

  // Read the fallback from config here rather than at each call site: there are
  // 17 of them and they all pass the same ids, so threading it through by hand
  // would only create chances to miss one.
  const { ads } = useAdConfig();
  const fallbackId =
    options?.fallbackUnitId !== undefined
      ? options.fallbackUnitId
      : ads?.gamRewardedVideoId ?? null;

  const [, forceRender] = useState(0);
  const onRewardRef = useRef(onReward);
  onRewardRef.current = onReward;
  const onAdClosedRef = useRef(onAdClosed);
  onAdClosedRef.current = onAdClosed;
  const subRef = useRef<Subscriber | null>(null);

  useEffect(() => {
    bindAppState();
    const slot = getSlot(admobId, fallbackId);
    const sub: Subscriber = {
      onReward: (amount, type) => onRewardRef.current?.(amount, type),
      onClosed: () => onAdClosedRef.current?.(),
      notify: () => forceRender(n => n + 1),
    };
    subRef.current = sub;
    slot.subs.add(sub);

    // First subscriber for this unit starts the request; later ones join the
    // one already in flight (or use the ad it already produced).
    if (!slot.ad) build(slot);

    return () => {
      slot.subs.delete(sub);
      if (slot.presenter === sub) slot.presenter = null;
      subRef.current = null;
      if (slot.subs.size === 0) {
        clearTimers(slot);
        detach(slot);
        slot.loaded = false;
        slot.loadedAt = null;
        slot.loading = true;
        slot.retry = 0;
        // Back to the top of the waterfall. Without this, a screen that had
        // failed over to the fallback would resume there next time it mounted,
        // and the primary (higher value) unit would stop being asked at all.
        slot.unitIndex = 0;
      }
    };
  }, [admobId, fallbackId]);

  const slot = getSlot(admobId, fallbackId);

  const show = useCallback(() => {
    const current = getSlot(admobId, fallbackId);
    const sub = subRef.current;
    if (!sub) return;
    const stale = current.loadedAt != null && Date.now() - current.loadedAt > AD_FRESHNESS_MS;
    if (!current.loaded || !current.ad || current.presenter || stale) {
      // Not ready (or the loaded ad has been sitting long enough it may have
      // expired server-side): make sure something is actually in flight
      // rather than leaving the user with a button that silently does
      // nothing, or attempting a show() likely to fail with no impression.
      current.retry = 0;
      build(current);
      return;
    }
    current.presenter = sub;
    current.loading = true;
    current.ad.show();
    notify(current);
  }, [admobId, fallbackId]);

  return { show, loading: slot.loading, loaded: slot.loaded };
}

/** @deprecated Use `useRewardedVideoAd` */
export const showRewardedAd = useRewardedVideoAd;

export { initializeGoogleAds };

/** @deprecated Use API `homeBannerId` + `DEFAULT_ADMOB_BANNER_ID` from `adUnitDefaults` */
export { DEFAULT_ADMOB_BANNER_ID as HOMEBANNER_AD_UNIT_ID } from './adUnitDefaults';

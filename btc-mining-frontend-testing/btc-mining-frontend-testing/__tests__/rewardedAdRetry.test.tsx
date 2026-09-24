/**
 * Regression test for the "ads stop loading after a few plays" report.
 *
 * A rewarded request failing with no-fill used to be terminal: ERROR left the
 * hook unloaded and nothing retried, so the button apologised until the app was
 * killed. These tests drive the real hook against a fake ad SDK.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.useFakeTimers();

// Only Platform and AppState are reached from this code path.
let appStateHandler: ((s: string) => void) | null = null;
jest.mock('react-native', () => ({
  Platform: { OS: 'android', select: (o: any) => o.android },
  AppState: {
    addEventListener: (_: string, fn: (s: string) => void) => {
      appStateHandler = fn;
      return { remove: () => { appStateHandler = null; } };
    },
  },
}));

// ---- fake ad SDK -------------------------------------------------------
type Handler = (arg?: any) => void;
const instances: any[] = [];

jest.mock('react-native-google-mobile-ads', () => {
  const RewardedAdEventType = { LOADED: 'rewarded_loaded', EARNED_REWARD: 'rewarded_earned_reward' };
  const AdEventType = { CLOSED: 'closed', ERROR: 'error', OPENED: 'opened', CLICKED: 'clicked' };
  class FakeRewardedAd {
    handlers: Record<string, Handler[]> = {};
    loadCount = 0;
    shown = 0;
    __unit = '';
    static createForAdRequest(unitId: string) {
      const i = new FakeRewardedAd();
      i.__unit = unitId;
      instances.push(i);
      return i;
    }
    addAdEventListener(type: string, fn: Handler) {
      (this.handlers[type] ||= []).push(fn);
      return () => { this.handlers[type] = (this.handlers[type] || []).filter(h => h !== fn); };
    }
    load() { this.loadCount += 1; }
    show() { this.shown += 1; }
    emit(type: string, arg?: any) { (this.handlers[type] || []).forEach(h => h(arg)); }
  }
  return {
    __esModule: true,
    default: () => ({ setRequestConfiguration: jest.fn(), initialize: jest.fn() }),
    MaxAdContentRating: { PG: 'PG' },
    RewardedAd: FakeRewardedAd,
    RewardedAdEventType,
    AdEventType,
    BannerAdSize: {},
  };
});

jest.mock('../src/services/apptroveAnalytics', () => ({ trackAdFailedToLoad: jest.fn() }));
let mockAdConfig: any = { gamRewardedVideoId: null };
jest.mock('../src/providers/AdConfigProvider', () => ({ useAdConfig: () => ({ ads: mockAdConfig }) }));
// googleAds.ts used to import navigationRef from App; mock it so this suite
// can also run against the pre-fix version of the hook.
jest.mock('../App', () => ({ navigationRef: { getCurrentRoute: () => ({ name: 'Test' }) } }), { virtual: true });

import { useRewardedVideoAd } from '../src/services/googleAds';

const latest = () => instances[instances.length - 1];
let state: any = {};
function Harness({ onReward, onClosed }: any) {
  state = useRewardedVideoAd(onReward, { primaryUnitId: 'unit-1' }, onClosed);
  return null;
}
let tree: renderer.ReactTestRenderer | null = null;
const mount = (props: any = {}) => { tree = renderer.create(<Harness {...props} />); return tree; };

beforeEach(() => { instances.length = 0; jest.clearAllTimers(); mockAdConfig = { gamRewardedVideoId: null }; });
// Without this, a test's outstanding retry timers keep firing during the NEXT
// test's advanceTimersByTime and spawn instances it never asked for.
afterEach(() => { act(() => { tree?.unmount(); }); tree = null; jest.clearAllTimers(); });

test('a failed request is retried with backoff instead of parking forever', () => {
  act(() => { mount(); });
  expect(instances).toHaveLength(1);
  expect(latest().loadCount).toBe(1);

  // no-fill
  act(() => { latest().emit('error', { code: 'no-fill' }); });
  expect(state.loaded).toBe(false);

  // nothing yet...
  act(() => { jest.advanceTimersByTime(1_500); });
  expect(instances).toHaveLength(1);

  // ...then a retry lands
  act(() => { jest.advanceTimersByTime(1_000); });
  expect(instances.length).toBeGreaterThan(1);
  expect(latest().loadCount).toBe(1);
});

test('backoff grows across repeated failures and the ad still recovers', () => {
  act(() => { mount(); });
  const delays = [2_000, 5_000, 15_000, 30_000];
  let seen = instances.length;
  for (const delay of delays) {
    act(() => { latest().emit('error', { code: 'no-fill' }); });
    // Exactly on the boundary, so no surplus accumulates across iterations.
    act(() => { jest.advanceTimersByTime(delay - 1); });
    expect(instances).toHaveLength(seen);          // not yet
    act(() => { jest.advanceTimersByTime(1); });
    expect(instances.length).toBe(seen + 1);       // retried
    seen = instances.length;
  }
  // fill returns
  act(() => { latest().emit('rewarded_loaded'); });
  expect(state.loaded).toBe(true);
});

test('backoff resets after a success, so the next failure retries quickly again', () => {
  act(() => { mount(); });
  act(() => { latest().emit('error', { code: 'no-fill' }); });
  act(() => { jest.advanceTimersByTime(2_000); });
  act(() => { latest().emit('rewarded_loaded'); });
  expect(state.loaded).toBe(true);

  const before = instances.length;
  act(() => { latest().emit('error', { code: 'no-fill' }); });
  act(() => { jest.advanceTimersByTime(2_100); });
  expect(instances.length).toBe(before + 1);
});

test('closing an ad queues the next one', () => {
  act(() => { mount(); });
  act(() => { latest().emit('rewarded_loaded'); });
  act(() => { state.show(); });
  expect(latest().shown).toBe(1);

  const before = instances.length;
  act(() => { latest().emit('closed'); });
  expect(instances.length).toBe(before);           // deliberately not immediate
  act(() => { jest.advanceTimersByTime(600); });
  expect(instances.length).toBe(before + 1);
});

test('four ads in a row keep working', () => {
  act(() => { mount(); });
  for (let i = 0; i < 4; i++) {
    act(() => { latest().emit('rewarded_loaded'); });
    expect(state.loaded).toBe(true);
    act(() => { state.show(); });
    expect(latest().shown).toBe(1);
    act(() => { latest().emit('closed'); });
    act(() => { jest.advanceTimersByTime(600); });
  }
});

test('pressing the button while unloaded starts a request rather than doing nothing', () => {
  act(() => { mount(); });
  act(() => { latest().emit('error', { code: 'no-fill' }); });
  const before = instances.length;
  act(() => { state.show(); });
  expect(instances.length).toBe(before + 1);
  expect(latest().loadCount).toBe(1);
});

test('a request that never resolves is rebuilt by the watchdog', () => {
  act(() => { mount(); });
  const before = instances.length;
  act(() => { jest.advanceTimersByTime(46_000); });
  expect(instances.length).toBe(before + 1);
});

test('returning to the foreground retries immediately', () => {
  act(() => { mount(); });
  act(() => { latest().emit('error', { code: 'no-fill' }); });
  const before = instances.length;
  act(() => { appStateHandler && appStateHandler('active'); });
  expect(instances.length).toBe(before + 1);
});

test('unmounting stops all retries', () => {
  act(() => { mount(); });
  act(() => { latest().emit('error', { code: 'no-fill' }); });
  act(() => { tree!.unmount(); tree = null; });
  const after = instances.length;
  act(() => { jest.advanceTimersByTime(120_000); });
  expect(instances.length).toBe(after);
});

// ---- one request per unit, shared across screens -----------------------

/** Two hooks on one screen, as every game has: a claim ad and a retry ad.
 *  Separate components so one can unmount while the other stays. */
let claimState: any = {};
let retryState: any = {};
function ClaimChild({ onReward, onClosed }: any) {
  claimState = useRewardedVideoAd(onReward, { primaryUnitId: 'unit-1' }, onClosed);
  return null;
}
function RetryChild({ onReward, onClosed }: any) {
  retryState = useRewardedVideoAd(onReward, { primaryUnitId: 'unit-1' }, onClosed);
  return null;
}
function TwoHarness({ claimReward, claimClosed, retryReward, retryClosed, withRetry = true }: any) {
  return (
    <>
      <ClaimChild onReward={claimReward} onClosed={claimClosed} />
      {withRetry ? <RetryChild onReward={retryReward} onClosed={retryClosed} /> : null}
    </>
  );
}

test('two hooks on the same unit share ONE request, not two', () => {
  act(() => { tree = renderer.create(<TwoHarness />); });
  expect(instances).toHaveLength(1);
});

test('a shared ad is visible as loaded to both hooks', () => {
  act(() => { tree = renderer.create(<TwoHarness />); });
  act(() => { latest().emit('rewarded_loaded'); });
  expect(claimState.loaded).toBe(true);
  expect(retryState.loaded).toBe(true);
});

test('the reward goes ONLY to the button that was pressed', () => {
  const claimReward = jest.fn();
  const retryReward = jest.fn();
  act(() => { tree = renderer.create(<TwoHarness claimReward={claimReward} retryReward={retryReward} />); });
  act(() => { latest().emit('rewarded_loaded'); });

  act(() => { claimState.show(); });
  act(() => { latest().emit('rewarded_earned_reward', { amount: 1, type: 'coins' }); });
  expect(claimReward).toHaveBeenCalledTimes(1);
  expect(retryReward).not.toHaveBeenCalled();
});

test('the close callback goes ONLY to the button that was pressed', () => {
  const claimClosed = jest.fn();
  const retryClosed = jest.fn();
  act(() => { tree = renderer.create(<TwoHarness claimClosed={claimClosed} retryClosed={retryClosed} />); });
  act(() => { latest().emit('rewarded_loaded'); });

  act(() => { retryState.show(); });
  act(() => { latest().emit('closed'); });
  expect(retryClosed).toHaveBeenCalledTimes(1);
  expect(claimClosed).not.toHaveBeenCalled();
});

test('a second ad is fetched once the shared one has been used', () => {
  act(() => { tree = renderer.create(<TwoHarness />); });
  act(() => { latest().emit('rewarded_loaded'); });
  const before = instances.length;
  act(() => { claimState.show(); });
  act(() => { latest().emit('closed'); });
  act(() => { jest.advanceTimersByTime(600); });
  expect(instances.length).toBe(before + 1);
  expect(claimState.loaded).toBe(false);
});

test('one hook unmounting does not cancel the ad the other is using', () => {
  act(() => { tree = renderer.create(<TwoHarness />); });
  act(() => { latest().emit('rewarded_loaded'); });
  const shared = latest();
  const before = instances.length;

  act(() => { tree!.update(<TwoHarness withRetry={false} />); }); // retry hook goes away
  expect(instances.length).toBe(before);     // no new request needed
  expect(claimState.loaded).toBe(true);      // the cached ad survives

  act(() => { claimState.show(); });
  expect(shared.shown).toBe(1);
});

test('the last hook unmounting releases the ad instead of churning', () => {
  act(() => { tree = renderer.create(<TwoHarness />); });
  act(() => { latest().emit('error', { code: 'no-fill' }); });
  act(() => { tree!.unmount(); tree = null; });
  const after = instances.length;
  act(() => { jest.advanceTimersByTime(300_000); });
  expect(instances.length).toBe(after);      // nothing requested in the background
});

// ---- waterfall to a second demand source -------------------------------

const unitOf = (i: number) => (instances[i] as any).__unit;

test('a failing primary falls straight through to the fallback unit', () => {
  mockAdConfig = { gamRewardedVideoId: 'gam-unit' };
  act(() => { mount(); });
  expect(unitOf(0)).toBe('unit-1');

  act(() => { latest().emit('error', { code: 'no-fill' }); });
  // Straight to the next source -- a no-fill on one unit says nothing about
  // the next -- so this is the short hop, not the 2s backoff.
  act(() => { jest.advanceTimersByTime(350); });
  expect(instances).toHaveLength(2);
  expect(unitOf(1)).toBe('gam-unit');
});

test('when the whole waterfall fails it backs off and restarts at the primary', () => {
  mockAdConfig = { gamRewardedVideoId: 'gam-unit' };
  act(() => { mount(); });
  act(() => { latest().emit('error', { code: 'no-fill' }); });
  act(() => { jest.advanceTimersByTime(350); });
  act(() => { latest().emit('error', { code: 'no-fill' }); });   // fallback fails too

  act(() => { jest.advanceTimersByTime(1_900); });
  expect(instances).toHaveLength(2);                              // backing off now
  act(() => { jest.advanceTimersByTime(200); });
  expect(instances).toHaveLength(3);
  expect(unitOf(2)).toBe('unit-1');                               // back to the top
});

test('after a success the next request starts at the primary again', () => {
  mockAdConfig = { gamRewardedVideoId: 'gam-unit' };
  act(() => { mount(); });
  act(() => { latest().emit('error', { code: 'no-fill' }); });
  act(() => { jest.advanceTimersByTime(350); });
  act(() => { latest().emit('rewarded_loaded'); });               // fallback filled
  act(() => { state.show(); });
  act(() => { latest().emit('closed'); });
  act(() => { jest.advanceTimersByTime(600); });
  expect(unitOf(instances.length - 1)).toBe('unit-1');
});

test("Google's sample units are refused in a release build", () => {
  const dev = (global as any).__DEV__;
  (global as any).__DEV__ = false;
  mockAdConfig = { gamRewardedVideoId: 'ca-app-pub-3940256099942544/5224354917' };
  try {
    act(() => { mount(); });
    act(() => { latest().emit('error', { code: 'no-fill' }); });
    // No second source to hop to, so it must be the 2s backoff, not the 300ms hop.
    act(() => { jest.advanceTimersByTime(350); });
    expect(instances).toHaveLength(1);
    act(() => { jest.advanceTimersByTime(1_700); });
    expect(unitOf(1)).toBe('unit-1');
  } finally {
    (global as any).__DEV__ = dev;
  }
});

test('sample units are still allowed in development', () => {
  const dev = (global as any).__DEV__;
  (global as any).__DEV__ = true;
  mockAdConfig = { gamRewardedVideoId: 'ca-app-pub-3940256099942544/5224354917' };
  try {
    act(() => { mount(); });
    act(() => { latest().emit('error', { code: 'no-fill' }); });
    act(() => { jest.advanceTimersByTime(350); });
    expect(unitOf(1)).toBe('ca-app-pub-3940256099942544/5224354917');
  } finally {
    (global as any).__DEV__ = dev;
  }
});

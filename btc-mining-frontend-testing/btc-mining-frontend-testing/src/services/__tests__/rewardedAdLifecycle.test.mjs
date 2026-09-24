/**
 * Reproduces the reported failure: the user watches an activation ad all the
 * way through and mining never activates, until the app is restarted.
 */
const listeners = new Map(); let adSeq = 0; let liveAd = null;
const RewardedAdEventType = { LOADED: 'loaded', EARNED_REWARD: 'earned' };
const AdEventType = { CLOSED: 'closed', ERROR: 'error' };

function makeAd() {
  const id = ++adSeq; const subs = [];
  const ad = {
    id, shown: false,
    addAdEventListener: (type, fn) => { subs.push({ type, fn }); return () => { const i = subs.indexOf(subs.find(s => s.fn === fn)); if (i >= 0) subs.splice(i, 1); }; },
    load: () => {},
    show: () => { ad.shown = true; },
    emit: (type, arg) => subs.filter(s => s.type === type).forEach(s => s.fn(arg)),
    listenerCount: () => subs.length,
  };
  liveAd = ad; return ad;
}

// --- the slot machinery under test, mirroring googleAds.ts ------------------
function makeSlot() {
  return { ad: null, loaded: false, loadedAt: null, loading: true, retry: 0,
           generation: 0, timers: new Set(), unsubs: [], subs: new Set(), presenter: null };
}
const clearTimers = s => { s.timers.forEach(clearTimeout); s.timers.clear(); };
const detach = s => { s.unsubs.forEach(u => u()); s.unsubs = []; s.ad = null; };
const schedule = (s, fn, ms) => { const t = setTimeout(() => { s.timers.delete(t); fn(); }, ms); s.timers.add(t); };

function build(slot, { guardPresenter, disarmOnLoad }) {
  if (slot.subs.size === 0) return;
  if (guardPresenter && slot.presenter) return;      // <- the fix
  clearTimers(slot); detach(slot);
  const generation = ++slot.generation;
  const isStale = () => slot.generation !== generation;
  const ad = makeAd(); slot.ad = ad; slot.loaded = false; slot.loading = true;
  slot.unsubs = [
    ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      if (isStale()) return;
      slot.loaded = true; slot.loadedAt = Date.now(); slot.loading = false;
      if (disarmOnLoad) clearTimers(slot);            // <- the fix
    }),
    ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, r => {
      if (isStale()) return; slot.presenter?.onReward?.(r);
    }),
    ad.addAdEventListener(AdEventType.CLOSED, () => {
      if (isStale()) return; const p = slot.presenter; slot.presenter = null; p?.onClosed?.();
    }),
  ];
  schedule(slot, () => { if (!isStale()) build(slot, { guardPresenter, disarmOnLoad }); }, 45);
  ad.load();
}

function show(slot, sub, opts) {
  if (!slot.loaded || !slot.ad || slot.presenter) { slot.retry = 0; build(slot, opts); return; }
  slot.presenter = sub; slot.loading = true; slot.ad.show();
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function scenario(opts) {
  const slot = makeSlot();
  let rewarded = 0, closed = 0;
  const sub = { onReward: () => rewarded++, onClosed: () => closed++ };
  slot.subs.add(sub);
  build(slot, opts);
  liveAd.emit(RewardedAdEventType.LOADED);          // loads quickly
  await sleep(30);                                   // user reads the page
  const shownAd = liveAd;
  show(slot, sub, opts);                             // taps Activate
  const wasShown = shownAd.shown;
  await sleep(30);                                   // watches a long ad; watchdog is due at 45ms
  shownAd.emit(RewardedAdEventType.EARNED_REWARD, { amount: 1, type: 'gh' });
  shownAd.emit(AdEventType.CLOSED);
  await sleep(5);
  const stuck = slot.presenter !== null;
  clearTimers(slot);
  return { wasShown, rewarded, closed, stuck };
}

let pass = 0, fail = 0;
const check = (n, c, d = '') => c ? (pass++, console.log(`  PASS  ${n}`)) : (fail++, console.log(`  FAIL  ${n}  ${d}`));

console.log('\n--- WITHOUT the fix (the shipped build) ---');
const before = await scenario({ guardPresenter: false, disarmOnLoad: false });
console.log(`      ad shown: ${before.wasShown} | rewards: ${before.rewarded} | closed: ${before.closed} | presenter stuck: ${before.stuck}`);
check('reproduces the bug: ad played but no reward', before.wasShown && before.rewarded === 0);
check('reproduces the follow-on: presenter left stuck', before.stuck);

console.log('\n--- WITH the fix ---');
const after = await scenario({ guardPresenter: true, disarmOnLoad: true });
console.log(`      ad shown: ${after.wasShown} | rewards: ${after.rewarded} | closed: ${after.closed} | presenter stuck: ${after.stuck}`);
check('the ad still shows', after.wasShown);
check('the reward is delivered', after.rewarded === 1, `got ${after.rewarded}`);
check('close is delivered', after.closed === 1, `got ${after.closed}`);
check('presenter is released for the next ad', !after.stuck);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);

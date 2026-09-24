import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import GameScreenWrapper from '../components/GameScreenWrapper';
import { useGameReward } from '../hooks/useGameReward';
import { ClaimedBanner, LosePanel, MiningLockCard, WinPanel } from '../components/games/GameOutcome';
import { getBtcUsdPriceCached } from '../services/btcPriceService';

/** Max payout -- consumed by GameZoneScreen's "Up to X GH/s" label. */
export const WIN_REWARD_GH = 5;

const OPTION_COUNT = 4;
/** Decoys sit this far either side of the real price -- close enough to be a
 *  real guess, far enough that the right answer is not obvious. */
const DECOY_SPREAD = 0.018;

const GH_WEIGHTS = [
  { gh: 1, weight: 18 }, { gh: 2, weight: 12 }, { gh: 3, weight: 8 },
  { gh: 4, weight: 5 }, { gh: 5, weight: 3 },
];
function pickGh(): number {
  const total = GH_WEIGHTS.reduce((s, w) => s + w.weight, 0);
  let r = Math.random() * total;
  for (const w of GH_WEIGHTS) { r -= w.weight; if (r <= 0) return w.gh; }
  return 1;
}

const fmt = (n: number) =>
  `$${Math.round(n).toLocaleString('en-US')}`;

/** Real price plus three decoys, shuffled. */
function buildOptions(real: number): number[] {
  const opts = [real];
  while (opts.length < OPTION_COUNT) {
    const dir = Math.random() < 0.5 ? -1 : 1;
    const mag = (0.004 + Math.random() * DECOY_SPREAD) * dir;
    const cand = Math.round(real * (1 + mag));
    // Keep decoys visually distinct so two options never round to the same label.
    if (!opts.some(o => Math.abs(o - cand) < Math.max(50, real * 0.002))) opts.push(cand);
  }
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [opts[i], opts[j]] = [opts[j], opts[i]];
  }
  return opts;
}

type Phase = 'loading' | 'playing' | 'win' | 'lose' | 'error';

export default function GuessBtcPriceScreen() {
  const navigation = useNavigation();

  const [phase, setPhase] = useState<Phase>('loading');
  const [real, setReal] = useState(0);
  const [options, setOptions] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [wonGh, setWonGh] = useState(0);

  // The price fetch is async, so a resolve after navigating away would set
  // state on an unmounted component. Guarded with a mounted flag.
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const loadRound = useCallback(async () => {
    setPhase('loading');
    setPicked(null);
    setWonGh(0);
    try {
      // Short TTL so a fresh round is a genuinely fresh price rather than a
      // cached one the player may already have seen.
      const price = await getBtcUsdPriceCached(15_000);
      if (!mounted.current) return;
      if (!price || !Number.isFinite(price) || price <= 0) { setPhase('error'); return; }
      setReal(price);
      setOptions(buildOptions(price));
      setPhase('playing');
    } catch {
      if (mounted.current) setPhase('error');
    }
  }, []);

  const newRound = useCallback(() => { void loadRound(); }, [loadRound]);
  const reward = useGameReward({ onNewRound: newRound, gameName: 'Guess the Price' });

  useEffect(() => { void loadRound(); }, [loadRound]);

  const choose = (value: number) => {
    if (phase !== 'playing') return;
    setPicked(value);
    if (value === real) {
      const gh = pickGh();
      setWonGh(gh);
      reward.setPendingWin(gh);
      setPhase('win');
    } else {
      setPhase('lose');
    }
  };

  // Deliberately NOT showing a partial price. An earlier version masked only
  // the last three digits ("$78,???"), but decoys sit ~1.8% away and routinely
  // cross a thousands boundary, so the visible prefix matched exactly one
  // option and gave the answer away.

  return (
    <GameScreenWrapper
      title="Guess the Price"
      iconName="bitcoin"
      iconColor="#F7931A"
      gradientColors={['#120C04', '#1C1206', '#241708']}
      scrollable
    >
      <Text style={s.subtitle}>Which is the real live BTC price?</Text>

      {reward.isMiningActive === false ? (
        <MiningLockCard gameName="Guess the Price" onPress={() => navigation.goBack()} />
      ) : (
        <>
          {reward.claimedBanner ? <ClaimedBanner text={reward.claimedBanner} /> : null}

          <View style={s.hintCard}>
            <Icon name="bitcoin" size={26} color="#F7931A" />
            <View style={s.hintTextWrap}>
              <Text style={s.hintLabel}>LIVE BTC / USD</Text>
              <Text style={s.hintValue}>
                {phase === 'loading' ? 'Fetching…' : phase === 'playing' ? 'Hidden' : fmt(real)}
              </Text>
            </View>
            {phase === 'playing' && <Icon name="lock-outline" size={20} color="#A8894F" />}
          </View>

          {phase === 'loading' && (
            <View style={s.loadingWrap}>
              <ActivityIndicator color="#F7931A" />
              <Text style={s.loadingTxt}>Getting the latest price…</Text>
            </View>
          )}

          {phase === 'error' && (
            <View style={s.errorCard}>
              <Icon name="wifi-off" size={28} color="#F87171" />
              <Text style={s.errorTitle}>Couldn't fetch the price</Text>
              <Text style={s.errorBody}>Check your connection and try again.</Text>
              <TouchableOpacity style={s.retryBtn} onPress={() => void loadRound()}>
                <Text style={s.retryTxt}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {phase === 'playing' && (
            <View style={s.options}>
              {options.map(o => (
                <TouchableOpacity key={o} style={s.option} activeOpacity={0.85} onPress={() => choose(o)}>
                  <Text style={s.optionTxt}>{fmt(o)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {phase === 'win' && (
            <WinPanel
              title={`Correct — ${fmt(real)}!`}
              gh={wonGh}
              crediting={reward.crediting}
              adLoading={reward.claimAdLoading}
              adLoaded={reward.claimAdLoaded}
              onClaim={reward.openClaimAd}
            />
          )}

          {phase === 'lose' && (
            <LosePanel
              title="Not Quite!"
              body={`You picked ${picked != null ? fmt(picked) : '—'} · the real price is ${fmt(real)}. Watch a short video to try again.`}
              adLoading={reward.retryAdLoading}
              adLoaded={reward.retryAdLoaded}
              onRetry={reward.openRetryAd}
            />
          )}

          <Text style={s.footer}>Uses the real BTC price · 1-5 GH/s per correct answer</Text>
        </>
      )}
    </GameScreenWrapper>
  );
}

const s = StyleSheet.create({
  subtitle: { textAlign: 'center', fontSize: 15, fontWeight: '700', color: '#F8FAFC', marginTop: 4, marginBottom: 16 },
  hintCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%',
    backgroundColor: 'rgba(247,147,26,0.08)', borderWidth: 1, borderColor: 'rgba(247,147,26,0.32)',
    borderRadius: 16, padding: 14, marginBottom: 18,
  },
  hintTextWrap: { flex: 1 },
  hintLabel: { color: '#A8894F', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  hintValue: { color: '#F8FAFC', fontSize: 22, fontWeight: '900', marginTop: 2 },
  loadingWrap: { alignItems: 'center', gap: 10, paddingVertical: 28 },
  loadingTxt: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  options: { width: '100%', gap: 10 },
  option: {
    minHeight: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1B1408', borderWidth: 1.5, borderColor: 'rgba(247,147,26,0.35)',
  },
  optionTxt: { color: '#F8FAFC', fontSize: 19, fontWeight: '800' },
  errorCard: {
    width: '100%', alignItems: 'center', gap: 8, padding: 22, borderRadius: 18,
    backgroundColor: 'rgba(248,113,113,0.08)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)',
  },
  errorTitle: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  errorBody: { color: '#CBD5E1', fontSize: 13, textAlign: 'center' },
  retryBtn: { marginTop: 6, backgroundColor: '#F87171', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 24 },
  retryTxt: { color: '#450A0A', fontSize: 14, fontWeight: '900' },
  footer: { marginTop: 16, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.45)' },
});

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import GameScreenWrapper from '../components/GameScreenWrapper';
import { useGameReward } from '../hooks/useGameReward';
import { ClaimedBanner, LosePanel, MiningLockCard, WinPanel } from '../components/games/GameOutcome';

/** Max payout -- consumed by GameZoneScreen's "Up to X GH/s" label. */
export const WIN_REWARD_GH = 5;

const TICK_MS = 80;
/** Compounding growth per tick. 1.2%/80ms reaches ~2x in 6s and ~5x in 13.5s,
 *  which keeps a full-payout run tense but never a test of patience. */
const GROWTH = 0.012;

/**
 * Where the round crashes, drawn ONCE when the round starts.
 *
 * Deliberately a fixed weighted table rather than a per-tick "does it crash
 * now?" roll: the payout curve is then a property of this config that can be
 * reasoned about and tuned, instead of an emergent one.
 */
const CRASH_BANDS: { min: number; max: number; weight: number }[] = [
  { min: 1.05, max: 1.5, weight: 22 },
  { min: 1.5, max: 2.5, weight: 30 },
  { min: 2.5, max: 4.0, weight: 26 },
  { min: 4.0, max: 6.0, weight: 15 },
  { min: 6.0, max: 12.0, weight: 7 },
];

function pickCrashPoint(): number {
  const total = CRASH_BANDS.reduce((sum, b) => sum + b.weight, 0);
  let roll = Math.random() * total;
  for (const b of CRASH_BANDS) {
    roll -= b.weight;
    if (roll <= 0) return b.min + Math.random() * (b.max - b.min);
  }
  return CRASH_BANDS[0].min;
}

/** 1.xx pays 1 GH/s, 5.00 and above pays the full 5. */
function ghForMultiplier(m: number): number {
  return Math.min(WIN_REWARD_GH, Math.max(1, Math.floor(m)));
}

type Phase = 'ready' | 'running' | 'cashed' | 'crashed';

export default function CrashCashOutScreen() {
  const navigation = useNavigation();

  const [multiplier, setMultiplier] = useState(1);
  const [phase, setPhase] = useState<Phase>('ready');
  const [wonGh, setWonGh] = useState(0);
  const [crashedAt, setCrashedAt] = useState(0);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // The multiplier and crash point live in refs as well as state: the interval
  // closure would otherwise compare a stale multiplier against the crash point
  // and either overshoot it or crash a tick early.
  const multRef = useRef(1);
  const crashRef = useRef(0);

  const stopTick = () => { if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; } };
  useEffect(() => stopTick, []);

  const newRound = useCallback(() => {
    stopTick();
    multRef.current = 1;
    crashRef.current = 0;
    setMultiplier(1);
    setPhase('ready');
    setWonGh(0);
    setCrashedAt(0);
  }, []);

  const reward = useGameReward({ onNewRound: newRound, gameName: 'Crash Cash-Out' });

  const start = () => {
    if (phase !== 'ready') return;
    multRef.current = 1;
    crashRef.current = pickCrashPoint();
    setMultiplier(1);
    setPhase('running');
    stopTick();
    tickRef.current = setInterval(() => {
      const next = multRef.current * (1 + GROWTH);
      if (next >= crashRef.current) {
        stopTick();
        multRef.current = crashRef.current;
        setMultiplier(crashRef.current);
        setCrashedAt(crashRef.current);
        setPhase('crashed');
        return;
      }
      multRef.current = next;
      setMultiplier(next);
    }, TICK_MS);
  };

  const cashOut = () => {
    if (phase !== 'running') return;
    stopTick();
    const m = multRef.current;
    const gh = ghForMultiplier(m);
    setMultiplier(m);
    setWonGh(gh);
    reward.setPendingWin(gh);
    setPhase('cashed');
  };

  const live = phase === 'running';

  return (
    <GameScreenWrapper
      title="Crash Cash-Out"
      iconName="chart-line-variant"
      iconColor="#22C55E"
      gradientColors={['#04120B', '#071C12', '#0A2318']}
      scrollable
    >
      <Text style={s.subtitle}>Cash out before the line crashes</Text>

      {reward.isMiningActive === false ? (
        <MiningLockCard gameName="Crash Cash-Out" onPress={() => navigation.goBack()} />
      ) : (
        <>
          {reward.claimedBanner ? <ClaimedBanner text={reward.claimedBanner} /> : null}

          <View style={s.hud}>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>STATUS</Text>
              <Text style={s.hudVal}>{live ? 'LIVE' : phase === 'ready' ? 'READY' : phase === 'cashed' ? 'CASHED' : 'CRASHED'}</Text>
            </View>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>WORTH</Text>
              <Text style={s.hudVal}>{phase === 'crashed' ? '—' : `${ghForMultiplier(multiplier)} GH`}</Text>
            </View>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>BEST</Text>
              <Text style={s.hudVal}>5 GH</Text>
            </View>
          </View>

          {phase !== 'cashed' && phase !== 'crashed' && (
            <View style={[s.stage, live && s.stageLive]}>
              <Icon name={live ? 'trending-up' : 'chart-line-variant'} size={34} color={live ? '#4ADE80' : '#3F6B52'} />
              <Text style={[s.mult, live && s.multLive]}>{multiplier.toFixed(2)}x</Text>
              <Text style={s.stageHint}>
                {live ? `Worth ${ghForMultiplier(multiplier)} GH/s right now` : 'Every run pays at least 1 GH/s'}
              </Text>
            </View>
          )}

          {phase === 'ready' && (
            <TouchableOpacity style={s.startBtn} activeOpacity={0.88} onPress={start}>
              <Icon name="play" size={20} color="#04120B" />
              <Text style={s.startTxt}>Start Round</Text>
            </TouchableOpacity>
          )}

          {live && (
            <TouchableOpacity style={s.cashBtn} activeOpacity={0.85} onPress={cashOut}>
              <Icon name="cash-fast" size={20} color="#04120B" />
              <Text style={s.cashTxt}>Cash Out at {multiplier.toFixed(2)}x</Text>
            </TouchableOpacity>
          )}

          {phase === 'cashed' && (
            <WinPanel
              title={`Cashed out at ${multiplier.toFixed(2)}x — +${wonGh} GH/s!`}
              gh={wonGh}
              crediting={reward.crediting}
              adLoading={reward.claimAdLoading}
              adLoaded={reward.claimAdLoaded}
              onClaim={reward.openClaimAd}
            />
          )}

          {phase === 'crashed' && (
            <LosePanel
              title={`Crashed at ${crashedAt.toFixed(2)}x`}
              body="You held on a moment too long. Watch a short video to run it again."
              adLoading={reward.retryAdLoading}
              adLoaded={reward.retryAdLoaded}
              onRetry={reward.openRetryAd}
            />
          )}

          <Text style={s.footer}>1.00x pays 1 GH/s · 5.00x and above pays the full 5 GH/s</Text>
        </>
      )}
    </GameScreenWrapper>
  );
}

const s = StyleSheet.create({
  subtitle: { textAlign: 'center', fontSize: 15, fontWeight: '700', color: '#F8FAFC', marginTop: 4, marginBottom: 14 },
  hud: { flexDirection: 'row', gap: 8, marginBottom: 16, width: '100%' },
  hudChip: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingVertical: 8, alignItems: 'center' },
  hudLabel: { color: '#64748B', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  hudVal: { color: '#F8FAFC', fontSize: 17, fontWeight: '900', marginTop: 2 },
  stage: {
    width: '100%', minHeight: 190, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#07160F', borderWidth: 2, borderColor: 'rgba(255,255,255,0.10)', marginBottom: 16,
  },
  stageLive: {
    borderColor: '#4ADE80',
    shadowColor: '#22C55E', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 18, elevation: 8,
  },
  mult: { color: '#64748B', fontSize: 46, fontWeight: '900' },
  multLive: { color: '#4ADE80' },
  stageHint: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '700' },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 54, width: '100%', borderRadius: 16, backgroundColor: '#4ADE80',
    shadowColor: '#22C55E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  startTxt: { color: '#04120B', fontSize: 16, fontWeight: '900' },
  cashBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 58, width: '100%', borderRadius: 16, backgroundColor: '#FBBF24',
    shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 7,
  },
  cashTxt: { color: '#04120B', fontSize: 16, fontWeight: '900' },
  footer: { marginTop: 16, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.45)' },
});

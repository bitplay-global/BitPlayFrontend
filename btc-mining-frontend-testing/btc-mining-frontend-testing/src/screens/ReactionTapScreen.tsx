import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import GameScreenWrapper from '../components/GameScreenWrapper';
import { useGameReward } from '../hooks/useGameReward';
import { ClaimedBanner, LosePanel, MiningLockCard, WinPanel } from '../components/games/GameOutcome';

/** Max payout -- consumed by GameZoneScreen's "Up to X GH/s" label. */
export const WIN_REWARD_GH = 5;

const MIN_WAIT_MS = 1500;
const MAX_WAIT_MS = 4500;

/** Faster reactions pay more. Anything slower than the last rung still wins 1. */
const TIERS: { maxMs: number; gh: number }[] = [
  { maxMs: 260, gh: 5 },
  { maxMs: 340, gh: 4 },
  { maxMs: 430, gh: 3 },
  { maxMs: 560, gh: 2 },
];
function ghForMs(ms: number): number {
  for (const t of TIERS) if (ms <= t.maxMs) return t.gh;
  return 1;
}

type Phase = 'idle' | 'waiting' | 'go' | 'win' | 'tooSoon';

export default function ReactionTapScreen() {
  const navigation = useNavigation();

  const [phase, setPhase] = useState<Phase>('idle');
  const [ms, setMs] = useState(0);
  const [wonGh, setWonGh] = useState(0);

  const goTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goAtRef = useRef(0);

  const clearGoTimer = () => {
    if (goTimer.current) { clearTimeout(goTimer.current); goTimer.current = null; }
  };
  // The single most likely crash in a timer-driven game: a pending timeout
  // firing after the user navigates away and setting state on an unmounted
  // component. Cleared unconditionally here.
  useEffect(() => clearGoTimer, []);

  const newRound = useCallback(() => {
    clearGoTimer();
    setPhase('idle');
    setMs(0);
    setWonGh(0);
  }, []);

  const reward = useGameReward({ onNewRound: newRound, gameName: 'Reaction Tap' });

  const start = () => {
    if (phase !== 'idle') return;
    setPhase('waiting');
    const wait = MIN_WAIT_MS + Math.random() * (MAX_WAIT_MS - MIN_WAIT_MS);
    goTimer.current = setTimeout(() => {
      goAtRef.current = Date.now();
      setPhase('go');
    }, wait);
  };

  const onPadPress = () => {
    if (phase === 'waiting') {
      // Jumped the gun.
      clearGoTimer();
      setPhase('tooSoon');
      return;
    }
    if (phase === 'go') {
      const elapsed = Date.now() - goAtRef.current;
      const gh = ghForMs(elapsed);
      setMs(elapsed);
      setWonGh(gh);
      reward.setPendingWin(gh);
      setPhase('win');
    }
  };
  useEffect(() => { if (phase === 'idle') reward.resetReward(); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const padStyle =
    phase === 'go' ? s.padGo : phase === 'waiting' ? s.padWait : s.padIdle;
  const padLabel =
    phase === 'go' ? 'TAP!' : phase === 'waiting' ? 'Wait for green…' : 'Tap Start below';

  return (
    <GameScreenWrapper
      title="Reaction Tap"
      iconName="lightning-bolt"
      iconColor="#4ADE80"
      gradientColors={['#050D0A', '#07160F', '#0A1F16']}
      scrollable
    >
      <Text style={s.subtitle}>Tap the moment the pad turns green</Text>

      {reward.isMiningActive === false ? (
        <MiningLockCard gameName="Reaction Tap" onPress={() => navigation.goBack()} />
      ) : (
        <>
          {reward.claimedBanner ? <ClaimedBanner text={reward.claimedBanner} /> : null}

          <TouchableOpacity
            style={[s.pad, padStyle]}
            activeOpacity={phase === 'go' || phase === 'waiting' ? 0.9 : 1}
            onPress={onPadPress}
            disabled={phase !== 'waiting' && phase !== 'go'}
          >
            <Icon
              name={phase === 'go' ? 'gesture-tap' : phase === 'waiting' ? 'timer-sand' : 'lightning-bolt'}
              size={44}
              color={phase === 'go' ? '#052E16' : '#94A3B8'}
            />
            <Text style={[s.padTxt, phase === 'go' && s.padTxtGo]}>{padLabel}</Text>
          </TouchableOpacity>

          {phase === 'idle' && (
            <TouchableOpacity style={s.startBtn} activeOpacity={0.88} onPress={start}>
              <Icon name="play" size={20} color="#052E16" />
              <Text style={s.startTxt}>Start</Text>
            </TouchableOpacity>
          )}

          {phase === 'win' && (
            <WinPanel
              title={`${ms} ms — +${wonGh} GH/s!`}
              gh={wonGh}
              crediting={reward.crediting}
              adLoading={reward.claimAdLoading}
              adLoaded={reward.claimAdLoaded}
              onClaim={reward.openClaimAd}
            />
          )}

          {phase === 'tooSoon' && (
            <LosePanel
              title="Too Soon!"
              body="You tapped before the pad turned green. Watch a short video to try again."
              adLoading={reward.retryAdLoading}
              adLoaded={reward.retryAdLoaded}
              onRetry={reward.openRetryAd}
            />
          )}

          <Text style={s.footer}>Under 260 ms pays the full 5 GH/s</Text>
        </>
      )}
    </GameScreenWrapper>
  );
}

const s = StyleSheet.create({
  subtitle: { textAlign: 'center', fontSize: 15, fontWeight: '700', color: '#F8FAFC', marginTop: 4, marginBottom: 20 },
  pad: {
    width: '100%', minHeight: 190, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 2, marginBottom: 18,
  },
  padIdle: { backgroundColor: '#0E1A16', borderColor: 'rgba(255,255,255,0.10)' },
  padWait: { backgroundColor: '#1A1508', borderColor: 'rgba(251,191,36,0.45)' },
  padGo: {
    backgroundColor: '#4ADE80', borderColor: '#86EFAC',
    shadowColor: '#4ADE80', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55, shadowRadius: 18, elevation: 8,
  },
  padTxt: { color: '#94A3B8', fontSize: 16, fontWeight: '800' },
  padTxtGo: { color: '#052E16', fontSize: 26, fontWeight: '900' },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 54, width: '100%', borderRadius: 16, backgroundColor: '#4ADE80',
    shadowColor: '#4ADE80', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  startTxt: { color: '#052E16', fontSize: 16, fontWeight: '900' },
  footer: { marginTop: 16, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.45)' },
});

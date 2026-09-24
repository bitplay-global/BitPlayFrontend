import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import GameScreenWrapper from '../components/GameScreenWrapper';
import { useGameReward } from '../hooks/useGameReward';
import { ClaimedBanner, MiningLockCard, WinPanel } from '../components/games/GameOutcome';

/** Max payout -- consumed by GameZoneScreen's "Up to X GH/s" label. */
export const WIN_REWARD_GH = 5;

const ROUND_SECONDS = 5;
/** Taps needed for each rung. Everyone scores something, so there is no loss state. */
const TIERS: { taps: number; gh: number }[] = [
  { taps: 55, gh: 5 },
  { taps: 45, gh: 4 },
  { taps: 35, gh: 3 },
  { taps: 25, gh: 2 },
];
function ghForTaps(n: number): number {
  for (const t of TIERS) if (n >= t.taps) return t.gh;
  return 1;
}

type Phase = 'ready' | 'running' | 'done';

export default function SpeedTapScreen() {
  const navigation = useNavigation();

  const [taps, setTaps] = useState(0);
  const [seconds, setSeconds] = useState(ROUND_SECONDS);
  const [phase, setPhase] = useState<Phase>('ready');
  const [wonGh, setWonGh] = useState(0);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Counting in a ref as well as state: at high tap rates the interval's
  // closure would otherwise read a stale count when the round ends.
  const tapsRef = useRef(0);
  const stopTick = () => { if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; } };
  useEffect(() => stopTick, []);

  const newRound = useCallback(() => {
    stopTick();
    tapsRef.current = 0;
    setTaps(0);
    setSeconds(ROUND_SECONDS);
    setPhase('ready');
    setWonGh(0);
  }, []);

  const reward = useGameReward({ onNewRound: newRound, gameName: 'Speed Tap' });

  const start = () => {
    if (phase !== 'ready') return;
    tapsRef.current = 0;
    setTaps(0);
    setSeconds(ROUND_SECONDS);
    setPhase('running');
    stopTick();
    tickRef.current = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          stopTick();
          const gh = ghForTaps(tapsRef.current);
          setWonGh(gh);
          reward.setPendingWin(gh);
          setPhase('done');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const onTap = () => {
    if (phase !== 'running') return;
    tapsRef.current += 1;
    setTaps(tapsRef.current);
  };

  return (
    <GameScreenWrapper
      title="Speed Tap"
      iconName="gesture-double-tap"
      iconColor="#FBBF24"
      gradientColors={['#0F0A05', '#1A1206', '#221708']}
      scrollable
    >
      <Text style={s.subtitle}>Tap as fast as you can for {ROUND_SECONDS} seconds</Text>

      {reward.isMiningActive === false ? (
        <MiningLockCard gameName="Speed Tap" onPress={() => navigation.goBack()} />
      ) : (
        <>
          {reward.claimedBanner ? <ClaimedBanner text={reward.claimedBanner} /> : null}

          <View style={s.hud}>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>TIME</Text>
              <Text style={[s.hudVal, phase === 'running' && seconds <= 2 && s.hudDanger]}>{seconds}s</Text>
            </View>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>TAPS</Text>
              <Text style={s.hudVal}>{taps}</Text>
            </View>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>WORTH</Text>
              <Text style={s.hudVal}>{taps === 0 ? '—' : `${ghForTaps(taps)} GH`}</Text>
            </View>
          </View>

          {phase !== 'done' && (
            <TouchableOpacity
              style={[s.pad, phase === 'running' && s.padLive]}
              activeOpacity={phase === 'running' ? 0.75 : 1}
              onPress={onTap}
              disabled={phase !== 'running'}
            >
              <Icon
                name={phase === 'running' ? 'gesture-double-tap' : 'timer-outline'}
                size={46}
                color={phase === 'running' ? '#1C1917' : '#64748B'}
              />
              <Text style={[s.padTxt, phase === 'running' && s.padTxtLive]}>
                {phase === 'running' ? `${taps}` : 'Press Start'}
              </Text>
            </TouchableOpacity>
          )}

          {phase === 'ready' && (
            <TouchableOpacity style={s.startBtn} activeOpacity={0.88} onPress={start}>
              <Icon name="play" size={20} color="#1C1917" />
              <Text style={s.startTxt}>Start</Text>
            </TouchableOpacity>
          )}

          {phase === 'done' && (
            <WinPanel
              title={`${taps} taps — +${wonGh} GH/s!`}
              gh={wonGh}
              crediting={reward.crediting}
              adLoading={reward.claimAdLoading}
              adLoaded={reward.claimAdLoaded}
              onClaim={reward.openClaimAd}
            />
          )}

          <Text style={s.footer}>55+ taps pays the full 5 GH/s · every run pays something</Text>
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
  hudDanger: { color: '#F87171' },
  pad: {
    width: '100%', minHeight: 190, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#16110A', borderWidth: 2, borderColor: 'rgba(255,255,255,0.10)', marginBottom: 16,
  },
  padLive: {
    backgroundColor: '#FBBF24', borderColor: '#FDE68A',
    shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55, shadowRadius: 18, elevation: 8,
  },
  padTxt: { color: '#64748B', fontSize: 16, fontWeight: '800' },
  padTxtLive: { color: '#1C1917', fontSize: 44, fontWeight: '900' },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 54, width: '100%', borderRadius: 16, backgroundColor: '#FBBF24',
    shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  startTxt: { color: '#1C1917', fontSize: 16, fontWeight: '900' },
  footer: { marginTop: 16, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.45)' },
});

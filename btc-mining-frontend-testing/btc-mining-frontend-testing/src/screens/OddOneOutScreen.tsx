import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import GameScreenWrapper from '../components/GameScreenWrapper';
import { useGameReward } from '../hooks/useGameReward';
import { ClaimedBanner, LosePanel, MiningLockCard, WinPanel } from '../components/games/GameOutcome';

/** Max payout -- consumed by GameZoneScreen's "Up to X GH/s" label. */
export const WIN_REWARD_GH = 5;

const GRID = 3;                 // 3x3
const TILES = GRID * GRID;
const ROUND_SECONDS = 10;
/** Rounds survived -> reward. Reaching the last rung pays the full 5. */
const GH_BY_STREAK = [1, 2, 3, 4, 5];
const MAX_STREAK = GH_BY_STREAK.length;

// Grid sizing in real pixels (GameScreenWrapper adds 12px padding each side),
// so tiles are exactly square and fill the row on any device.
const GAP = 10;
const MAX_W = 330;
const GRID_W = Math.min(Dimensions.get('window').width - 24, MAX_W);
const TILE = Math.floor((GRID_W - GAP * (GRID - 1)) / GRID);

/** Base hue per round, with the odd tile a shrinking lightness step away. */
function buildRound(streak: number) {
  const hue = Math.floor(Math.random() * 360);
  const baseL = 52;
  // Starts obvious (14%) and tightens to 5% by the final round.
  const delta = 14 - streak * 2.2;
  return {
    odd: Math.floor(Math.random() * TILES),
    base: `hsl(${hue}, 65%, ${baseL}%)`,
    oddColor: `hsl(${hue}, 65%, ${baseL + Math.max(4.5, delta)}%)`,
  };
}

type Phase = 'playing' | 'win' | 'lose';

export default function OddOneOutScreen() {
  const navigation = useNavigation();

  const [streak, setStreak] = useState(0);
  const [round, setRound] = useState(() => buildRound(0));
  const [seconds, setSeconds] = useState(ROUND_SECONDS);
  const [phase, setPhase] = useState<Phase>('playing');
  const [wonGh, setWonGh] = useState(0);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTick = () => { if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; } };
  useEffect(() => stopTick, []);

  const newRound = useCallback(() => {
    stopTick();
    setStreak(0);
    setRound(buildRound(0));
    setSeconds(ROUND_SECONDS);
    setPhase('playing');
    setWonGh(0);
  }, []);

  const reward = useGameReward({ onNewRound: newRound, gameName: 'Odd One Out' });

  // One 1s interval, torn down whenever the round stops being playable.
  useEffect(() => {
    if (phase !== 'playing') { stopTick(); return; }
    stopTick();
    tickRef.current = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) { stopTick(); setPhase('lose'); return 0; }
        return prev - 1;
      });
    }, 1000);
    return stopTick;
  }, [phase, streak]);

  const onTile = (i: number) => {
    if (phase !== 'playing') return;
    if (i !== round.odd) { stopTick(); setPhase('lose'); return; }

    const next = streak + 1;
    if (next >= MAX_STREAK) {
      stopTick();
      const gh = GH_BY_STREAK[MAX_STREAK - 1];
      setWonGh(gh);
      reward.setPendingWin(gh);
      setStreak(next);
      setPhase('win');
      return;
    }
    setStreak(next);
    setRound(buildRound(next));
    setSeconds(ROUND_SECONDS);
  };

  const cashOut = () => {
    if (phase !== 'playing' || streak === 0) return;
    stopTick();
    const gh = GH_BY_STREAK[streak - 1];
    setWonGh(gh);
    reward.setPendingWin(gh);
    setPhase('win');
  };

  return (
    <GameScreenWrapper
      title="Odd One Out"
      iconName="palette-outline"
      iconColor="#A78BFA"
      gradientColors={['#0A0716', '#110B22', '#170F2B']}
      scrollable
    >
      <Text style={s.subtitle}>Tap the tile with a different shade</Text>

      {reward.isMiningActive === false ? (
        <MiningLockCard gameName="Odd One Out" onPress={() => navigation.goBack()} />
      ) : (
        <>
          {reward.claimedBanner ? <ClaimedBanner text={reward.claimedBanner} /> : null}

          <View style={s.hud}>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>TIME</Text>
              <Text style={[s.hudVal, seconds <= 3 && s.hudDanger]}>{seconds}s</Text>
            </View>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>ROUND</Text>
              <Text style={s.hudVal}>{Math.min(streak + 1, MAX_STREAK)}/{MAX_STREAK}</Text>
            </View>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>WORTH</Text>
              <Text style={s.hudVal}>{streak === 0 ? '—' : `${GH_BY_STREAK[streak - 1]} GH`}</Text>
            </View>
          </View>

          {phase === 'playing' && (
            <>
              <View style={[s.grid, { width: GRID_W }]}>
                {Array.from({ length: TILES }, (_, i) => (
                  <TouchableOpacity
                    key={i}
                    activeOpacity={0.9}
                    onPress={() => onTile(i)}
                    style={[
                      s.tile,
                      { width: TILE, height: TILE, backgroundColor: i === round.odd ? round.oddColor : round.base },
                    ]}
                  />
                ))}
              </View>

              <TouchableOpacity
                style={[s.cashBtn, streak === 0 && s.cashBtnOff]}
                onPress={cashOut}
                disabled={streak === 0}
              >
                <Text style={[s.cashTxt, streak === 0 && s.cashTxtOff]}>
                  {streak === 0 ? 'Clear a round to bank' : `Bank ${GH_BY_STREAK[streak - 1]} GH/s`}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {phase === 'win' && (
            <WinPanel
              title={`Banked +${wonGh} GH/s!`}
              gh={wonGh}
              crediting={reward.crediting}
              adLoading={reward.claimAdLoading}
              adLoaded={reward.claimAdLoaded}
              onClaim={reward.openClaimAd}
            />
          )}

          {phase === 'lose' && (
            <LosePanel
              title={seconds === 0 ? "Time's Up!" : 'Wrong Tile!'}
              adLoading={reward.retryAdLoading}
              adLoaded={reward.retryAdLoaded}
              onRetry={reward.openRetryAd}
            />
          )}

          <Text style={s.footer}>Each round is harder · bank any time or clear all {MAX_STREAK} for 5 GH/s</Text>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, alignSelf: 'center', justifyContent: 'center', marginBottom: 18 },
  tile: { borderRadius: 12 },
  cashBtn: {
    minHeight: 48, width: '100%', borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#A78BFA',
  },
  cashBtnOff: { backgroundColor: 'rgba(255,255,255,0.06)' },
  cashTxt: { color: '#1E1B4B', fontSize: 15, fontWeight: '900' },
  cashTxtOff: { color: '#64748B', fontWeight: '700' },
  footer: { marginTop: 16, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 16 },
});

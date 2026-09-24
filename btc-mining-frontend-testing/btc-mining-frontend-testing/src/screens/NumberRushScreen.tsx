import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import GameScreenWrapper from '../components/GameScreenWrapper';
import { useGameReward } from '../hooks/useGameReward';
import { ClaimedBanner, LosePanel, MiningLockCard, WinPanel } from '../components/games/GameOutcome';

/** Max payout -- consumed by GameZoneScreen's "Up to X GH/s" label. */
export const WIN_REWARD_GH = 5;

const COUNT = 12;               // tap 1 -> 12
const COLS = 3;
const ROUND_SECONDS = 20;

/** Finish faster, earn more. Seconds REMAINING when the last tile is tapped. */
function ghForRemaining(sec: number): number {
  if (sec >= 12) return 5;
  if (sec >= 9) return 4;
  if (sec >= 6) return 3;
  if (sec >= 3) return 2;
  return 1;
}

const GAP = 10;
const MAX_W = 330;
const GRID_W = Math.min(Dimensions.get('window').width - 24, MAX_W);
const TILE = Math.floor((GRID_W - GAP * (COLS - 1)) / COLS);

function shuffled(): number[] {
  const a = Array.from({ length: COUNT }, (_, i) => i + 1);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Phase = 'playing' | 'win' | 'lose';

export default function NumberRushScreen() {
  const navigation = useNavigation();

  const [tiles, setTiles] = useState<number[]>(() => shuffled());
  const [next, setNext] = useState(1);
  const [seconds, setSeconds] = useState(ROUND_SECONDS);
  const [phase, setPhase] = useState<Phase>('playing');
  const [wonGh, setWonGh] = useState(0);
  const [wrongTile, setWrongTile] = useState<number | null>(null);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flashRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopTimers = () => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    if (flashRef.current) { clearTimeout(flashRef.current); flashRef.current = null; }
  };
  useEffect(() => stopTimers, []);

  const newRound = useCallback(() => {
    stopTimers();
    setTiles(shuffled());
    setNext(1);
    setSeconds(ROUND_SECONDS);
    setPhase('playing');
    setWonGh(0);
    setWrongTile(null);
  }, []);

  const reward = useGameReward({ onNewRound: newRound, gameName: 'Number Rush' });

  useEffect(() => {
    if (phase !== 'playing') { stopTimers(); return; }
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
          setPhase('lose');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; } };
  }, [phase]);

  const onTile = (n: number) => {
    if (phase !== 'playing' || n < next) return;
    if (n !== next) {
      // Wrong order: flash it red briefly rather than ending the run.
      setWrongTile(n);
      if (flashRef.current) clearTimeout(flashRef.current);
      flashRef.current = setTimeout(() => setWrongTile(null), 300);
      return;
    }
    if (n === COUNT) {
      stopTimers();
      const gh = ghForRemaining(seconds);
      setWonGh(gh);
      reward.setPendingWin(gh);
      setNext(n + 1);
      setPhase('win');
      return;
    }
    setNext(n + 1);
  };

  return (
    <GameScreenWrapper
      title="Number Rush"
      iconName="numeric"
      iconColor="#22D3EE"
      gradientColors={['#04101A', '#06192A', '#082238']}
      scrollable
    >
      <Text style={s.subtitle}>
        Tap <Text style={s.accent}>1</Text> to <Text style={s.accent}>{COUNT}</Text> in order
      </Text>

      {reward.isMiningActive === false ? (
        <MiningLockCard gameName="Number Rush" onPress={() => navigation.goBack()} />
      ) : (
        <>
          {reward.claimedBanner ? <ClaimedBanner text={reward.claimedBanner} /> : null}

          <View style={s.hud}>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>TIME</Text>
              <Text style={[s.hudVal, seconds <= 5 && s.hudDanger]}>{seconds}s</Text>
            </View>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>NEXT</Text>
              <Text style={s.hudVal}>{next > COUNT ? '✓' : next}</Text>
            </View>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>LEFT</Text>
              <Text style={s.hudVal}>{Math.max(0, COUNT - next + 1)}</Text>
            </View>
          </View>

          {phase === 'playing' && (
            <View style={[s.grid, { width: GRID_W }]}>
              {tiles.map(n => {
                const done = n < next;
                const wrong = wrongTile === n;
                return (
                  <TouchableOpacity
                    key={n}
                    activeOpacity={0.85}
                    disabled={done}
                    onPress={() => onTile(n)}
                    style={[s.tile, { width: TILE, height: TILE }, done && s.tileDone, wrong && s.tileWrong]}
                  >
                    <Text style={[s.tileTxt, done && s.tileTxtDone, wrong && s.tileTxtWrong]}>{n}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {phase === 'win' && (
            <WinPanel
              title={`Cleared with ${seconds}s left — +${wonGh} GH/s!`}
              gh={wonGh}
              crediting={reward.crediting}
              adLoading={reward.claimAdLoading}
              adLoaded={reward.claimAdLoaded}
              onClaim={reward.openClaimAd}
            />
          )}

          {phase === 'lose' && (
            <LosePanel
              title="Time's Up!"
              body={`You reached ${next - 1} of ${COUNT}. Watch a short video to try again.`}
              adLoading={reward.retryAdLoading}
              adLoaded={reward.retryAdLoaded}
              onRetry={reward.openRetryAd}
            />
          )}

          <Text style={s.footer}>Finish with 12s+ to spare for the full 5 GH/s</Text>
        </>
      )}
    </GameScreenWrapper>
  );
}

const s = StyleSheet.create({
  subtitle: { textAlign: 'center', fontSize: 15, fontWeight: '700', color: '#F8FAFC', marginTop: 4, marginBottom: 14 },
  accent: { color: '#22D3EE', fontWeight: '900' },
  hud: { flexDirection: 'row', gap: 8, marginBottom: 16, width: '100%' },
  hudChip: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingVertical: 8, alignItems: 'center' },
  hudLabel: { color: '#64748B', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  hudVal: { color: '#F8FAFC', fontSize: 17, fontWeight: '900', marginTop: 2 },
  hudDanger: { color: '#F87171' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, alignSelf: 'center', justifyContent: 'center', marginBottom: 8 },
  tile: {
    borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0D1B2A', borderWidth: 1.5, borderColor: 'rgba(34,211,238,0.35)',
  },
  tileDone: { backgroundColor: 'rgba(34,211,238,0.12)', borderColor: 'rgba(34,211,238,0.15)' },
  tileWrong: { backgroundColor: '#2A0E12', borderColor: 'rgba(248,113,113,0.7)' },
  tileTxt: { color: '#F8FAFC', fontSize: 22, fontWeight: '900' },
  tileTxtDone: { color: 'rgba(148,163,184,0.5)' },
  tileTxtWrong: { color: '#F87171' },
  footer: { marginTop: 16, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.45)' },
});

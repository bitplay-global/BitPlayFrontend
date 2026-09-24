import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import GameScreenWrapper from '../components/GameScreenWrapper';
import { useGameReward } from '../hooks/useGameReward';
import { ClaimedBanner, MiningLockCard, WinPanel } from '../components/games/GameOutcome';

/** Max payout -- consumed by GameZoneScreen's "Up to X GH/s" label. */
export const WIN_REWARD_GH = 5;

const GRID = 3;
const CELLS = GRID * GRID;
const ROUND_SECONDS = 15;
/** How long a block stays up. Shrinks as the score climbs. */
const SHOW_MS_START = 1000;
const SHOW_MS_MIN = 480;

const TIERS: { hits: number; gh: number }[] = [
  { hits: 16, gh: 5 },
  { hits: 12, gh: 4 },
  { hits: 8, gh: 3 },
  { hits: 4, gh: 2 },
];
function ghForHits(n: number): number {
  for (const t of TIERS) if (n >= t.hits) return t.gh;
  return 1;
}

const GAP = 10;
const MAX_W = 320;
const GRID_W = Math.min(Dimensions.get('window').width - 24, MAX_W);
const CELL = Math.floor((GRID_W - GAP * (GRID - 1)) / GRID);

type Phase = 'ready' | 'running' | 'done';

export default function WhackABlockScreen() {
  const navigation = useNavigation();

  const [active, setActive] = useState<number | null>(null);
  const [hits, setHits] = useState(0);
  const [seconds, setSeconds] = useState(ROUND_SECONDS);
  const [phase, setPhase] = useState<Phase>('ready');
  const [wonGh, setWonGh] = useState(0);

  // Two independent timers: a 1s countdown and a spawn/hide cycle. Both live in
  // refs and are cleared together, because either firing after the screen
  // unmounts would set state on a dead component.
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spawnRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hitsRef = useRef(0);
  const runningRef = useRef(false);

  const stopAll = useCallback(() => {
    runningRef.current = false;
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    if (spawnRef.current) { clearTimeout(spawnRef.current); spawnRef.current = null; }
  }, []);
  useEffect(() => stopAll, [stopAll]);

  const newRound = useCallback(() => {
    stopAll();
    hitsRef.current = 0;
    setHits(0);
    setActive(null);
    setSeconds(ROUND_SECONDS);
    setPhase('ready');
    setWonGh(0);
  }, [stopAll]);

  const reward = useGameReward({ onNewRound: newRound, gameName: 'Whack-a-Block' });

  /** Self-rescheduling spawn loop -- one pending timeout at a time, never a
   *  frame loop, and it stops as soon as runningRef flips false. */
  const scheduleSpawn = useCallback(() => {
    if (!runningRef.current) return;
    const showMs = Math.max(SHOW_MS_MIN, SHOW_MS_START - hitsRef.current * 30);
    setActive(Math.floor(Math.random() * CELLS));
    spawnRef.current = setTimeout(() => {
      setActive(null);
      spawnRef.current = setTimeout(scheduleSpawn, 220);
    }, showMs);
  }, []);

  const start = () => {
    if (phase !== 'ready') return;
    hitsRef.current = 0;
    setHits(0);
    setSeconds(ROUND_SECONDS);
    setPhase('running');
    runningRef.current = true;
    scheduleSpawn();

    tickRef.current = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          stopAll();
          setActive(null);
          const gh = ghForHits(hitsRef.current);
          setWonGh(gh);
          reward.setPendingWin(gh);
          setPhase('done');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const onCell = (i: number) => {
    if (phase !== 'running' || i !== active) return;
    hitsRef.current += 1;
    setHits(hitsRef.current);
    setActive(null);
    if (spawnRef.current) clearTimeout(spawnRef.current);
    spawnRef.current = setTimeout(scheduleSpawn, 160);
  };

  return (
    <GameScreenWrapper
      title="Whack-a-Block"
      iconName="hammer"
      iconColor="#F472B6"
      gradientColors={['#0F0616', '#180A22', '#1F0E2B']}
      scrollable
    >
      <Text style={s.subtitle}>Hit the blocks before they vanish</Text>

      {reward.isMiningActive === false ? (
        <MiningLockCard gameName="Whack-a-Block" onPress={() => navigation.goBack()} />
      ) : (
        <>
          {reward.claimedBanner ? <ClaimedBanner text={reward.claimedBanner} /> : null}

          <View style={s.hud}>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>TIME</Text>
              <Text style={[s.hudVal, phase === 'running' && seconds <= 4 && s.hudDanger]}>{seconds}s</Text>
            </View>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>HITS</Text>
              <Text style={s.hudVal}>{hits}</Text>
            </View>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>WORTH</Text>
              <Text style={s.hudVal}>{hits === 0 ? '—' : `${ghForHits(hits)} GH`}</Text>
            </View>
          </View>

          {phase !== 'done' && (
            <View style={[s.grid, { width: GRID_W }]}>
              {Array.from({ length: CELLS }, (_, i) => {
                const lit = active === i && phase === 'running';
                return (
                  <TouchableOpacity
                    key={i}
                    activeOpacity={0.8}
                    disabled={phase !== 'running'}
                    onPress={() => onCell(i)}
                    style={[s.cell, { width: CELL, height: CELL }, lit && s.cellLit]}
                  >
                    {lit && <Icon name="cube" size={34} color="#3B0A25" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {phase === 'ready' && (
            <TouchableOpacity style={s.startBtn} activeOpacity={0.88} onPress={start}>
              <Icon name="play" size={20} color="#3B0A25" />
              <Text style={s.startTxt}>Start</Text>
            </TouchableOpacity>
          )}

          {phase === 'done' && (
            <WinPanel
              title={`${hits} hits — +${wonGh} GH/s!`}
              gh={wonGh}
              crediting={reward.crediting}
              adLoading={reward.claimAdLoading}
              adLoaded={reward.claimAdLoaded}
              onClaim={reward.openClaimAd}
            />
          )}

          <Text style={s.footer}>Blocks speed up as you score · 16+ hits pays the full 5 GH/s</Text>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, alignSelf: 'center', justifyContent: 'center', marginBottom: 16 },
  cell: {
    borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#150A1E', borderWidth: 1.5, borderColor: 'rgba(244,114,182,0.22)',
  },
  cellLit: {
    backgroundColor: '#F472B6', borderColor: '#F9A8D4',
    shadowColor: '#F472B6', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55, shadowRadius: 14, elevation: 7,
  },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 54, width: '100%', borderRadius: 16, backgroundColor: '#F472B6',
    shadowColor: '#F472B6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  startTxt: { color: '#3B0A25', fontSize: 16, fontWeight: '900' },
  footer: { marginTop: 16, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.45)' },
});

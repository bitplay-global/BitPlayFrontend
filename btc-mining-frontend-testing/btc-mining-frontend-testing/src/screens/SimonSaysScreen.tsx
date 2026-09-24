import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import GameScreenWrapper from '../components/GameScreenWrapper';
import { useGameReward } from '../hooks/useGameReward';
import { ClaimedBanner, LosePanel, MiningLockCard, WinPanel } from '../components/games/GameOutcome';

/** Max payout -- consumed by GameZoneScreen's "Up to X GH/s" label. */
export const WIN_REWARD_GH = 5;

const PADS = [
  { key: 0, on: '#4ADE80', off: '#14351F' },
  { key: 1, on: '#F87171', off: '#3A1418' },
  { key: 2, on: '#38BDF8', off: '#0E2A3C' },
  { key: 3, on: '#FBBF24', off: '#3A2C0C' },
];

/** Sequence length per level; clearing the last level pays the full 5. */
const GH_BY_LEVEL = [1, 2, 3, 4, 5];
const MAX_LEVEL = GH_BY_LEVEL.length;
const START_LEN = 2;

const FLASH_ON_MS = 420;
const FLASH_GAP_MS = 220;

type Phase = 'idle' | 'showing' | 'input' | 'win' | 'lose';

export default function SimonSaysScreen() {
  const navigation = useNavigation();

  const [level, setLevel] = useState(0);
  const [sequence, setSequence] = useState<number[]>([]);
  const [inputIdx, setInputIdx] = useState(0);
  const [lit, setLit] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [wonGh, setWonGh] = useState(0);

  // EVERY timeout scheduled during playback is tracked here. Simon's playback
  // schedules 2 timers per step, so without this a mid-sequence unmount would
  // leave several pending callbacks all setting state on a dead component.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clearTimers, []);

  const newRound = useCallback(() => {
    clearTimers();
    setLevel(0);
    setSequence([]);
    setInputIdx(0);
    setLit(null);
    setPhase('idle');
    setWonGh(0);
  }, []);

  const reward = useGameReward({ onNewRound: newRound, gameName: 'Simon Says' });

  const playSequence = useCallback((seq: number[]) => {
    clearTimers();
    setPhase('showing');
    setLit(null);
    seq.forEach((pad, i) => {
      const at = i * (FLASH_ON_MS + FLASH_GAP_MS);
      timers.current.push(setTimeout(() => setLit(pad), at));
      timers.current.push(setTimeout(() => setLit(null), at + FLASH_ON_MS));
    });
    timers.current.push(setTimeout(() => {
      setInputIdx(0);
      setPhase('input');
    }, seq.length * (FLASH_ON_MS + FLASH_GAP_MS)));
  }, []);

  const startLevel = (lvl: number) => {
    const len = START_LEN + lvl;
    const seq = Array.from({ length: len }, () => Math.floor(Math.random() * PADS.length));
    setSequence(seq);
    setLevel(lvl);
    playSequence(seq);
  };

  const onPad = (pad: number) => {
    if (phase !== 'input') return;
    if (pad !== sequence[inputIdx]) {
      clearTimers();
      setPhase('lose');
      return;
    }
    // Brief confirm flash on a correct press.
    setLit(pad);
    timers.current.push(setTimeout(() => setLit(null), 160));

    const nextIdx = inputIdx + 1;
    if (nextIdx < sequence.length) { setInputIdx(nextIdx); return; }

    // Sequence complete.
    const nextLevel = level + 1;
    if (nextLevel >= MAX_LEVEL) {
      clearTimers();
      const gh = GH_BY_LEVEL[MAX_LEVEL - 1];
      setWonGh(gh);
      reward.setPendingWin(gh);
      setPhase('win');
      return;
    }
    timers.current.push(setTimeout(() => startLevel(nextLevel), 620));
  };

  const cashOut = () => {
    if (phase !== 'input' || level === 0) return;
    clearTimers();
    const gh = GH_BY_LEVEL[level - 1];
    setWonGh(gh);
    reward.setPendingWin(gh);
    setPhase('win');
  };

  const statusText =
    phase === 'showing' ? 'Watch the sequence…'
    : phase === 'input' ? `Repeat it — ${inputIdx}/${sequence.length}`
    : phase === 'idle' ? 'Press Start to begin'
    : '';

  return (
    <GameScreenWrapper
      title="Simon Says"
      iconName="music-note-eighth"
      iconColor="#4ADE80"
      gradientColors={['#060A18', '#0A1024', '#0E1730']}
      scrollable
    >
      <Text style={s.subtitle}>Repeat the flashing sequence</Text>

      {reward.isMiningActive === false ? (
        <MiningLockCard gameName="Simon Says" onPress={() => navigation.goBack()} />
      ) : (
        <>
          {reward.claimedBanner ? <ClaimedBanner text={reward.claimedBanner} /> : null}

          <View style={s.hud}>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>LEVEL</Text>
              <Text style={s.hudVal}>{Math.min(level + 1, MAX_LEVEL)}/{MAX_LEVEL}</Text>
            </View>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>LENGTH</Text>
              <Text style={s.hudVal}>{sequence.length || '—'}</Text>
            </View>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>WORTH</Text>
              <Text style={s.hudVal}>{level === 0 ? '—' : `${GH_BY_LEVEL[level - 1]} GH`}</Text>
            </View>
          </View>

          {(phase === 'idle' || phase === 'showing' || phase === 'input') && (
            <>
              <Text style={s.status}>{statusText}</Text>

              <View style={s.pads}>
                {PADS.map(p => (
                  <TouchableOpacity
                    key={p.key}
                    activeOpacity={0.9}
                    disabled={phase !== 'input'}
                    onPress={() => onPad(p.key)}
                    style={[
                      s.pad,
                      { backgroundColor: lit === p.key ? p.on : p.off },
                      lit === p.key && { shadowColor: p.on, shadowOpacity: 0.6, shadowRadius: 16, elevation: 8 },
                    ]}
                  />
                ))}
              </View>

              {phase === 'idle' && (
                <TouchableOpacity style={s.startBtn} activeOpacity={0.88} onPress={() => startLevel(0)}>
                  <Text style={s.startTxt}>Start</Text>
                </TouchableOpacity>
              )}

              {phase === 'input' && level > 0 && (
                <TouchableOpacity style={s.cashBtn} onPress={cashOut}>
                  <Text style={s.cashTxt}>Bank {GH_BY_LEVEL[level - 1]} GH/s</Text>
                </TouchableOpacity>
              )}
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
              title="Wrong Sequence!"
              adLoading={reward.retryAdLoading}
              adLoaded={reward.retryAdLoaded}
              onRetry={reward.openRetryAd}
            />
          )}

          <Text style={s.footer}>Bank any time · clear all {MAX_LEVEL} levels for 5 GH/s</Text>
        </>
      )}
    </GameScreenWrapper>
  );
}

const s = StyleSheet.create({
  subtitle: { textAlign: 'center', fontSize: 15, fontWeight: '700', color: '#F8FAFC', marginTop: 2, marginBottom: 10 },
  hud: { flexDirection: 'row', gap: 8, marginBottom: 12, width: '100%' },
  hudChip: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingVertical: 8, alignItems: 'center' },
  hudLabel: { color: '#64748B', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  hudVal: { color: '#F8FAFC', fontSize: 17, fontWeight: '900', marginTop: 2 },
  status: { color: '#94A3B8', fontSize: 13, fontWeight: '700', marginBottom: 10 },
  // Sized so the pad grid AND the Start/Bank button fit above the bottom ad on
  // a small (320dp) screen without needing a scroll to reach the controls.
  pads: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    width: 226, alignSelf: 'center', justifyContent: 'center', marginBottom: 16,
  },
  pad: { width: 108, height: 108, borderRadius: 16, shadowOffset: { width: 0, height: 0 } },
  startBtn: {
    minHeight: 52, width: '100%', borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#4ADE80',
    shadowColor: '#4ADE80', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  startTxt: { color: '#052E16', fontSize: 16, fontWeight: '900' },
  cashBtn: {
    minHeight: 46, width: '100%', borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(74,222,128,0.14)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.45)',
  },
  cashTxt: { color: '#4ADE80', fontSize: 14, fontWeight: '800' },
  footer: { marginTop: 16, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.45)' },
});

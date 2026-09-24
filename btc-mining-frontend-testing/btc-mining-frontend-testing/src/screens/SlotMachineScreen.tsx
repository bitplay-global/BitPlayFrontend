import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import GameScreenWrapper from '../components/GameScreenWrapper';
import { useGameReward } from '../hooks/useGameReward';
import { ClaimedBanner, LosePanel, MiningLockCard, WinPanel } from '../components/games/GameOutcome';

/** Max payout -- consumed by GameZoneScreen's "Up to X GH/s" label. */
export const WIN_REWARD_GH = 5;

type Symbol = { key: string; icon: string; color: string; three: number; two: number };

/** Rarer symbols pay more. `three` = all-match payout, `two` = any-pair payout. */
const SYMBOLS: Symbol[] = [
  { key: 'coin',    icon: 'bitcoin',           color: '#F7931A', three: 5, two: 2 },
  { key: 'gem',     icon: 'diamond-stone',     color: '#38BDF8', three: 4, two: 2 },
  { key: 'bolt',    icon: 'lightning-bolt',    color: '#FBBF24', three: 3, two: 1 },
  { key: 'star',    icon: 'star',              color: '#A78BFA', three: 2, two: 1 },
  { key: 'clover',  icon: 'clover',            color: '#4ADE80', three: 2, two: 1 },
];

const REELS = 3;
const ROW_H = 96;
/** Symbols scrolled past before a reel settles -- purely cosmetic length. */
const SPIN_ROWS = 12;
const BASE_SPIN_MS = 900;
const REEL_STAGGER_MS = 260;

function randomIdx() { return Math.floor(Math.random() * SYMBOLS.length); }

/** Payout for a finished set of three reel results. */
function evaluate(idx: number[]): number {
  const [a, b, c] = idx;
  if (a === b && b === c) return SYMBOLS[a].three;
  if (a === b || b === c || a === c) {
    const pairIdx = a === b ? a : b === c ? b : a;
    return SYMBOLS[pairIdx].two;
  }
  return 0;
}

type Phase = 'ready' | 'spinning' | 'win' | 'lose';

export default function SlotMachineScreen() {
  const navigation = useNavigation();

  const [result, setResult] = useState<number[]>([0, 1, 2]);
  const [phase, setPhase] = useState<Phase>('ready');
  const [wonGh, setWonGh] = useState(0);

  // One Animated.Value per reel, driven natively (transform only).
  const offsets = useRef([...Array(REELS)].map(() => new Animated.Value(0))).current;
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const stopAll = () => {
    if (settleTimer.current) { clearTimeout(settleTimer.current); settleTimer.current = null; }
    if (animRef.current) { animRef.current.stop(); animRef.current = null; }
  };
  useEffect(() => stopAll, []);

  const newRound = useCallback(() => {
    stopAll();
    offsets.forEach(o => o.setValue(0));
    setPhase('ready');
    setWonGh(0);
  }, [offsets]);

  const reward = useGameReward({ onNewRound: newRound, gameName: 'Slot Machine' });

  const spin = () => {
    if (phase !== 'ready') return;
    setPhase('spinning');

    const final = [randomIdx(), randomIdx(), randomIdx()];

    // Each reel scrolls the same distance but over a longer duration, which is
    // what produces the staggered left-to-right stop.
    const anims = offsets.map((o, i) => {
      o.setValue(0);
      return Animated.timing(o, {
        toValue: SPIN_ROWS,
        duration: BASE_SPIN_MS + i * REEL_STAGGER_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
    });
    animRef.current = Animated.parallel(anims);
    animRef.current.start();

    const total = BASE_SPIN_MS + (REELS - 1) * REEL_STAGGER_MS;
    settleTimer.current = setTimeout(() => {
      setResult(final);
      offsets.forEach(o => o.setValue(0));
      const gh = evaluate(final);
      if (gh > 0) {
        setWonGh(gh);
        reward.setPendingWin(gh);
        setPhase('win');
      } else {
        setPhase('lose');
      }
    }, total);
  };

  const isSpinning = phase === 'spinning';

  return (
    <GameScreenWrapper
      title="Slot Machine"
      iconName="slot-machine"
      iconColor="#F472B6"
      gradientColors={['#0F0616', '#180A22', '#1F0E2B']}
      scrollable
    >
      <Text style={s.subtitle}>Match symbols to win GH/s</Text>

      {reward.isMiningActive === false ? (
        <MiningLockCard gameName="Slot Machine" onPress={() => navigation.goBack()} />
      ) : (
        <>
          {reward.claimedBanner ? <ClaimedBanner text={reward.claimedBanner} /> : null}

          <View style={s.machine}>
            {offsets.map((o, i) => {
              const sym = SYMBOLS[result[i]];
              // While spinning, slide the reel column; the blur of motion is
              // implied by the fast translate rather than a real blur filter.
              const translateY = o.interpolate({
                inputRange: [0, SPIN_ROWS],
                outputRange: [0, -SPIN_ROWS * ROW_H],
              });
              return (
                <View key={i} style={s.reel}>
                  <Animated.View style={{ transform: [{ translateY }] }}>
                    {isSpinning
                      ? [...Array(SPIN_ROWS + 1)].map((_, r) => {
                          const rs = SYMBOLS[(i + r) % SYMBOLS.length];
                          return (
                            <View key={r} style={s.cell}>
                              <Icon name={rs.icon} size={40} color={rs.color} />
                            </View>
                          );
                        })
                      : (
                        <View style={s.cell}>
                          <Icon name={sym.icon} size={44} color={sym.color} />
                        </View>
                      )}
                  </Animated.View>
                </View>
              );
            })}
          </View>

          {phase === 'ready' && (
            <TouchableOpacity style={s.spinBtn} activeOpacity={0.88} onPress={spin}>
              <Icon name="slot-machine-outline" size={22} color="#3B0A25" />
              <Text style={s.spinTxt}>Spin</Text>
            </TouchableOpacity>
          )}

          {isSpinning && <Text style={s.spinningTxt}>Spinning…</Text>}

          {phase === 'win' && (
            <WinPanel
              title={`${result[0] === result[1] && result[1] === result[2] ? 'Triple Match' : 'Pair Match'} — +${wonGh} GH/s!`}
              gh={wonGh}
              crediting={reward.crediting}
              adLoading={reward.claimAdLoading}
              adLoaded={reward.claimAdLoaded}
              onClaim={reward.openClaimAd}
            />
          )}

          {phase === 'lose' && (
            <LosePanel
              title="No Match!"
              adLoading={reward.retryAdLoading}
              adLoaded={reward.retryAdLoaded}
              onRetry={reward.openRetryAd}
            />
          )}

          <Text style={s.footer}>Any pair pays · three Bitcoins pays the full 5 GH/s</Text>
        </>
      )}
    </GameScreenWrapper>
  );
}

const s = StyleSheet.create({
  subtitle: { textAlign: 'center', fontSize: 15, fontWeight: '700', color: '#F8FAFC', marginTop: 4, marginBottom: 18 },
  machine: {
    flexDirection: 'row', gap: 10, padding: 12, borderRadius: 20, marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5, borderColor: 'rgba(244,114,182,0.35)',
  },
  reel: {
    width: 84, height: ROW_H, borderRadius: 14, overflow: 'hidden',
    backgroundColor: '#150A1E', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  cell: { width: 84, height: ROW_H, alignItems: 'center', justifyContent: 'center' },
  spinBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    minHeight: 54, width: '100%', borderRadius: 16, backgroundColor: '#F472B6', marginBottom: 12,
    shadowColor: '#F472B6', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 14, elevation: 7,
  },
  spinTxt: { color: '#3B0A25', fontSize: 16, fontWeight: '900' },
  spinningTxt: { color: '#94A3B8', fontSize: 14, fontWeight: '700', marginBottom: 12 },
  footer: { marginTop: 16, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.45)' },
});

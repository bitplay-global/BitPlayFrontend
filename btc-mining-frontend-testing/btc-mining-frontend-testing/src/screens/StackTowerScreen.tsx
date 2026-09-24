import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import GameScreenWrapper from '../components/GameScreenWrapper';
import { useGameReward } from '../hooks/useGameReward';
import { ClaimedBanner, LosePanel, MiningLockCard, WinPanel } from '../components/games/GameOutcome';

/** Max payout -- consumed by GameZoneScreen's "Up to X GH/s" label. */
export const WIN_REWARD_GH = 5;

const BOARD_W = Math.min(Dimensions.get('window').width - 24, 320);
const ROW_H = 26;
const BASE_W = 150;
/** Blocks stacked -> reward. Clearing the last rung pays the full 5. */
const GH_BY_LEVEL = [1, 2, 3, 4, 5];
const MAX_LEVEL = GH_BY_LEVEL.length;
const SLIDE_MS_START = 1300;
const SLIDE_MS_MIN = 700;

type Block = { width: number; left: number };
type Phase = 'ready' | 'sliding' | 'win' | 'lose';

export default function StackTowerScreen() {
  const navigation = useNavigation();

  const [stack, setStack] = useState<Block[]>([{ width: BASE_W, left: (BOARD_W - BASE_W) / 2 }]);
  const [phase, setPhase] = useState<Phase>('ready');
  const [wonGh, setWonGh] = useState(0);

  const slide = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);
  // The animated value is read at the moment of the tap, so its live position
  // is tracked here via a listener -- Animated values cannot be read directly
  // while driven natively.
  const posRef = useRef(0);
  const listenerRef = useRef<string | null>(null);

  const stopLoop = useCallback(() => {
    if (loopRef.current) { loopRef.current.stop(); loopRef.current = null; }
    if (listenerRef.current) { slide.removeListener(listenerRef.current); listenerRef.current = null; }
  }, [slide]);
  useEffect(() => stopLoop, [stopLoop]);

  const newRound = useCallback(() => {
    stopLoop();
    slide.setValue(0);
    setStack([{ width: BASE_W, left: (BOARD_W - BASE_W) / 2 }]);
    setPhase('ready');
    setWonGh(0);
  }, [slide, stopLoop]);

  const reward = useGameReward({ onNewRound: newRound, gameName: 'Stack Tower' });

  const top = stack[stack.length - 1];
  const level = stack.length - 1;

  const startSlide = useCallback((width: number) => {
    stopLoop();
    const travel = BOARD_W - width;
    const dur = Math.max(SLIDE_MS_MIN, SLIDE_MS_START - level * 110);
    slide.setValue(0);
    // Position must be tracked on the JS side to evaluate the drop, so this one
    // animation deliberately runs without the native driver. It is a single
    // interpolated value, not a per-frame JS loop.
    listenerRef.current = slide.addListener(({ value }) => { posRef.current = value * travel; });
    loopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(slide, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(slide, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      ]),
    );
    loopRef.current.start();
  }, [level, slide, stopLoop]);

  const start = () => {
    if (phase !== 'ready') return;
    setPhase('sliding');
    startSlide(top.width);
  };

  const drop = () => {
    if (phase !== 'sliding') return;
    const movingLeft = posRef.current;
    const overlapLeft = Math.max(movingLeft, top.left);
    const overlapRight = Math.min(movingLeft + top.width, top.left + top.width);
    const overlap = overlapRight - overlapLeft;

    stopLoop();

    if (overlap <= 8) { setPhase('lose'); return; }

    const placed: Block = { width: overlap, left: overlapLeft };
    const nextStack = [...stack, placed];
    setStack(nextStack);

    const nextLevel = nextStack.length - 1;
    if (nextLevel >= MAX_LEVEL) {
      const gh = GH_BY_LEVEL[MAX_LEVEL - 1];
      setWonGh(gh);
      reward.setPendingWin(gh);
      setPhase('win');
      return;
    }
    startSlide(overlap);
  };

  const bank = () => {
    if (phase !== 'sliding' || level === 0) return;
    stopLoop();
    const gh = GH_BY_LEVEL[level - 1];
    setWonGh(gh);
    reward.setPendingWin(gh);
    setPhase('win');
  };

  const travel = BOARD_W - top.width;
  const movingLeft = slide.interpolate({ inputRange: [0, 1], outputRange: [0, travel] });

  return (
    <GameScreenWrapper
      title="Stack Tower"
      iconName="layers-triple-outline"
      iconColor="#22D3EE"
      gradientColors={['#04101A', '#06192A', '#082238']}
      scrollable
    >
      <Text style={s.subtitle}>Tap to drop — keep it aligned</Text>

      {reward.isMiningActive === false ? (
        <MiningLockCard gameName="Stack Tower" onPress={() => navigation.goBack()} />
      ) : (
        <>
          {reward.claimedBanner ? <ClaimedBanner text={reward.claimedBanner} /> : null}

          <View style={s.hud}>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>HEIGHT</Text>
              <Text style={s.hudVal}>{Math.min(level + 1, MAX_LEVEL)}/{MAX_LEVEL}</Text>
            </View>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>WIDTH</Text>
              <Text style={s.hudVal}>{Math.round(top.width)}</Text>
            </View>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>WORTH</Text>
              <Text style={s.hudVal}>{level === 0 ? '—' : `${GH_BY_LEVEL[level - 1]} GH`}</Text>
            </View>
          </View>

          {(phase === 'ready' || phase === 'sliding') && (
            <>
              <TouchableOpacity
                activeOpacity={phase === 'sliding' ? 0.9 : 1}
                onPress={drop}
                disabled={phase !== 'sliding'}
                style={[s.board, { width: BOARD_W }]}
              >
                {phase === 'sliding' && (
                  <Animated.View style={[s.moving, { width: top.width, left: movingLeft }]} />
                )}
                <View style={s.stackWrap}>
                  {[...stack].reverse().map((b, i) => (
                    <View
                      key={i}
                      style={[s.block, { width: b.width, marginLeft: b.left, opacity: 1 - i * 0.12 }]}
                    />
                  ))}
                </View>
              </TouchableOpacity>

              {phase === 'ready' && (
                <TouchableOpacity style={s.startBtn} activeOpacity={0.88} onPress={start}>
                  <Icon name="play" size={20} color="#04222E" />
                  <Text style={s.startTxt}>Start</Text>
                </TouchableOpacity>
              )}

              {phase === 'sliding' && level > 0 && (
                <TouchableOpacity style={s.bankBtn} onPress={bank}>
                  <Text style={s.bankTxt}>Bank {GH_BY_LEVEL[level - 1]} GH/s</Text>
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
              title="Missed the Stack!"
              adLoading={reward.retryAdLoading}
              adLoaded={reward.retryAdLoaded}
              onRetry={reward.openRetryAd}
            />
          )}

          <Text style={s.footer}>Each block narrows to the overlap · bank any time</Text>
        </>
      )}
    </GameScreenWrapper>
  );
}

const s = StyleSheet.create({
  subtitle: { textAlign: 'center', fontSize: 15, fontWeight: '700', color: '#F8FAFC', marginTop: 4, marginBottom: 14 },
  hud: { flexDirection: 'row', gap: 8, marginBottom: 14, width: '100%' },
  hudChip: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingVertical: 8, alignItems: 'center' },
  hudLabel: { color: '#64748B', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  hudVal: { color: '#F8FAFC', fontSize: 16, fontWeight: '900', marginTop: 2 },
  board: {
    height: ROW_H * (MAX_LEVEL + 2) + 40, borderRadius: 16, marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1.5, borderColor: 'rgba(34,211,238,0.25)',
    justifyContent: 'flex-end', overflow: 'hidden', paddingTop: 8,
  },
  moving: {
    position: 'absolute', top: 8, height: ROW_H, borderRadius: 6,
    backgroundColor: '#22D3EE',
    shadowColor: '#22D3EE', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 5,
  },
  stackWrap: { paddingBottom: 8 },
  block: { height: ROW_H, borderRadius: 6, backgroundColor: '#0EA5E9', marginBottom: 2 },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 54, width: '100%', borderRadius: 16, backgroundColor: '#22D3EE',
    shadowColor: '#22D3EE', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  startTxt: { color: '#04222E', fontSize: 16, fontWeight: '900' },
  bankBtn: {
    minHeight: 46, width: '100%', borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(34,211,238,0.14)', borderWidth: 1, borderColor: 'rgba(34,211,238,0.45)',
  },
  bankTxt: { color: '#22D3EE', fontSize: 14, fontWeight: '800' },
  footer: { marginTop: 16, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.45)' },
});

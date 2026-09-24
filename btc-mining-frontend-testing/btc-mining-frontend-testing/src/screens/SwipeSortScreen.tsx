import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, PanResponder, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import GameScreenWrapper from '../components/GameScreenWrapper';
import { useGameReward } from '../hooks/useGameReward';
import { ClaimedBanner, MiningLockCard, WinPanel } from '../components/games/GameOutcome';

/** Max payout -- consumed by GameZoneScreen's "Up to X GH/s" label. */
export const WIN_REWARD_GH = 5;

const ROUND_SECONDS = 25;
const CARDS_PER_ROUND = 15;
const SWIPE_THRESHOLD = 90;
const SCREEN_W = Dimensions.get('window').width;

const REAL_COINS = [
  'Bitcoin', 'Ethereum', 'Solana', 'Cardano', 'Dogecoin', 'Polkadot', 'Litecoin',
  'Chainlink', 'Avalanche', 'Polygon', 'Stellar', 'Monero', 'Tether', 'Uniswap',
  'Cosmos', 'Algorand', 'Filecoin', 'Aave', 'Shiba Inu', 'Tron',
];

/** Invented names, deliberately plausible enough that the card has to be read. */
const FAKE_COINS = [
  'Zylocoin', 'Trexon', 'Vantum', 'Norium', 'Bitwave', 'Cryptix', 'Orbix',
  'Zephra', 'Marvix', 'Delvo', 'Solvex', 'Aurex', 'Pyrion', 'Kwantel',
  'Nexoria', 'Veltra', 'Ombrix', 'Zandor',
];

const CARD_COLORS = ['#F59E0B', '#38BDF8', '#A78BFA', '#4ADE80', '#F472B6', '#22D3EE'];

/** Correct answers -> reward. Everyone scores something, so there is no loss state. */
const TIERS: { correct: number; gh: number }[] = [
  { correct: 15, gh: 5 },
  { correct: 13, gh: 4 },
  { correct: 11, gh: 3 },
  { correct: 8, gh: 2 },
];
function ghForCorrect(n: number): number {
  for (const t of TIERS) if (n >= t.correct) return t.gh;
  return 1;
}

type Card = { name: string; real: boolean; color: string };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Even-ish split so neither direction can simply be spammed. */
function dealDeck(): Card[] {
  const realCount = Math.round(CARDS_PER_ROUND / 2);
  const cards: Card[] = [
    ...shuffle(REAL_COINS).slice(0, realCount).map(name => ({ name, real: true, color: '' })),
    ...shuffle(FAKE_COINS).slice(0, CARDS_PER_ROUND - realCount).map(name => ({ name, real: false, color: '' })),
  ];
  return shuffle(cards).map((c, i) => ({ ...c, color: CARD_COLORS[i % CARD_COLORS.length] }));
}

type Phase = 'ready' | 'running' | 'done';

export default function SwipeSortScreen() {
  const navigation = useNavigation();

  const [deck, setDeck] = useState<Card[]>(dealDeck);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [seconds, setSeconds] = useState(ROUND_SECONDS);
  const [phase, setPhase] = useState<Phase>('ready');
  const [wonGh, setWonGh] = useState(0);

  const pan = useRef(new Animated.ValueXY()).current;
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // The gesture handler is created once, so everything it reads must be a ref:
  // a captured `phase`/`index` from the first render would freeze the game.
  const phaseRef = useRef<Phase>('ready');
  const indexRef = useRef(0);
  const correctRef = useRef(0);
  const deckRef = useRef<Card[]>(deck);
  const animatingRef = useRef(false);
  const secondsRef = useRef(ROUND_SECONDS);

  const stopTick = useCallback(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  }, []);
  useEffect(() => () => { stopTick(); pan.stopAnimation(); }, [pan, stopTick]);

  const newRound = useCallback(() => {
    stopTick();
    const fresh = dealDeck();
    deckRef.current = fresh;
    indexRef.current = 0;
    correctRef.current = 0;
    phaseRef.current = 'ready';
    animatingRef.current = false;
    pan.setValue({ x: 0, y: 0 });
    secondsRef.current = ROUND_SECONDS;
    setDeck(fresh);
    setIndex(0);
    setCorrect(0);
    setSeconds(ROUND_SECONDS);
    setPhase('ready');
    setWonGh(0);
  }, [pan, stopTick]);

  const reward = useGameReward({ onNewRound: newRound, gameName: 'Swipe Sort' });

  const finish = useCallback(() => {
    stopTick();
    phaseRef.current = 'done';
    animatingRef.current = false;
    pan.setValue({ x: 0, y: 0 });
    const gh = ghForCorrect(correctRef.current);
    setWonGh(gh);
    reward.setPendingWin(gh);
    setPhase('done');
  }, [pan, reward, stopTick]);

  const finishRef = useRef<() => void>(() => {});
  useEffect(() => { finishRef.current = finish; }, [finish]);

  /** Scores the current card and slides it off in `dir`, then deals the next. */
  const resolve = useCallback((saidReal: boolean, dir: 1 | -1) => {
    if (phaseRef.current !== 'running' || animatingRef.current) return;
    const card = deckRef.current[indexRef.current];
    if (!card) return;
    animatingRef.current = true;

    if (saidReal === card.real) {
      correctRef.current += 1;
      setCorrect(correctRef.current);
    }

    Animated.timing(pan, {
      toValue: { x: dir * (SCREEN_W + 120), y: 0 },
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      pan.setValue({ x: 0, y: 0 });
      animatingRef.current = false;
      const next = indexRef.current + 1;
      if (next >= CARDS_PER_ROUND) { finishRef.current(); return; }
      indexRef.current = next;
      setIndex(next);
    });
  }, [pan]);

  const resolveRef = useRef(resolve);
  useEffect(() => { resolveRef.current = resolve; }, [resolve]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, g) =>
          phaseRef.current === 'running' && !animatingRef.current && Math.abs(g.dx) > 6,
        onPanResponderMove: (_evt, g) => { pan.setValue({ x: g.dx, y: 0 }); },
        onPanResponderRelease: (_evt, g) => {
          if (g.dx > SWIPE_THRESHOLD) { resolveRef.current(true, 1); return; }
          if (g.dx < -SWIPE_THRESHOLD) { resolveRef.current(false, -1); return; }
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true, bounciness: 6 }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true, bounciness: 6 }).start();
        },
      }),
    [pan],
  );

  const start = () => {
    if (phase !== 'ready') return;
    const fresh = dealDeck();
    deckRef.current = fresh;
    indexRef.current = 0;
    correctRef.current = 0;
    phaseRef.current = 'running';
    setDeck(fresh);
    setIndex(0);
    setCorrect(0);
    secondsRef.current = ROUND_SECONDS;
    setSeconds(ROUND_SECONDS);
    setPhase('running');
    stopTick();
    // Countdown in a ref, pure updater: ending the round from inside a state
    // updater can fire the finish path twice if React re-runs it.
    tickRef.current = setInterval(() => {
      secondsRef.current -= 1;
      setSeconds(Math.max(0, secondsRef.current));
      if (secondsRef.current <= 0) finishRef.current();
    }, 1000);
  };

  const card = deck[index];
  const live = phase === 'running';
  const rotate = pan.x.interpolate({
    inputRange: [-SCREEN_W, 0, SCREEN_W],
    outputRange: ['-14deg', '0deg', '14deg'],
  });
  const realOpacity = pan.x.interpolate({ inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' });
  const fakeOpacity = pan.x.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <GameScreenWrapper
      title="Swipe Sort"
      iconName="gesture-swipe-horizontal"
      iconColor="#F59E0B"
      gradientColors={['#120A02', '#1C1006', '#25160A']}
      scrollable
    >
      <Text style={s.subtitle}>Swipe right for a real coin, left for a fake one</Text>

      {reward.isMiningActive === false ? (
        <MiningLockCard gameName="Swipe Sort" onPress={() => navigation.goBack()} />
      ) : (
        <>
          {reward.claimedBanner ? <ClaimedBanner text={reward.claimedBanner} /> : null}

          <View style={s.hud}>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>TIME</Text>
              <Text style={[s.hudVal, live && seconds <= 5 && s.hudDanger]}>{seconds}s</Text>
            </View>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>CARD</Text>
              <Text style={s.hudVal}>{Math.min(index + 1, CARDS_PER_ROUND)}/{CARDS_PER_ROUND}</Text>
            </View>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>CORRECT</Text>
              <Text style={s.hudVal}>{correct}</Text>
            </View>
          </View>

          {phase !== 'done' && (
            <View style={s.stage}>
              {live && card ? (
                <Animated.View
                  {...responder.panHandlers}
                  style={[s.card, { transform: [{ translateX: pan.x }, { rotate }] }]}
                >
                  <Animated.View style={[s.stamp, s.stampReal, { opacity: realOpacity }]}>
                    <Text style={s.stampRealTxt}>REAL</Text>
                  </Animated.View>
                  <Animated.View style={[s.stamp, s.stampFake, { opacity: fakeOpacity }]}>
                    <Text style={s.stampFakeTxt}>FAKE</Text>
                  </Animated.View>

                  <View style={[s.avatar, { borderColor: card.color }]}>
                    <Text style={[s.avatarTxt, { color: card.color }]}>{card.name.charAt(0)}</Text>
                  </View>
                  <Text style={s.cardName}>{card.name}</Text>
                  <Text style={s.cardHint}>Real cryptocurrency?</Text>
                </Animated.View>
              ) : (
                <View style={s.idle}>
                  <Icon name="gesture-swipe-horizontal" size={40} color="#F59E0B" />
                  <Text style={s.idleTxt}>{CARDS_PER_ROUND} coins · {ROUND_SECONDS} seconds</Text>
                </View>
              )}
            </View>
          )}

          {phase === 'ready' && (
            <TouchableOpacity style={s.startBtn} activeOpacity={0.88} onPress={start}>
              <Icon name="play" size={20} color="#120A02" />
              <Text style={s.startTxt}>Start</Text>
            </TouchableOpacity>
          )}

          {live && (
            <View style={s.answers}>
              <TouchableOpacity style={[s.ansBtn, s.ansFake]} activeOpacity={0.85} onPress={() => resolve(false, -1)}>
                <Icon name="arrow-left-bold" size={20} color="#FFF" />
                <Text style={s.ansFakeTxt}>Fake</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.ansBtn, s.ansReal]} activeOpacity={0.85} onPress={() => resolve(true, 1)}>
                <Text style={s.ansRealTxt}>Real</Text>
                <Icon name="arrow-right-bold" size={20} color="#120A02" />
              </TouchableOpacity>
            </View>
          )}

          {phase === 'done' && (
            <WinPanel
              title={`${correct}/${CARDS_PER_ROUND} correct — +${wonGh} GH/s!`}
              gh={wonGh}
              crediting={reward.crediting}
              adLoading={reward.claimAdLoading}
              adLoaded={reward.claimAdLoaded}
              onClaim={reward.openClaimAd}
            />
          )}

          <Text style={s.footer}>All {CARDS_PER_ROUND} correct pays the full 5 GH/s · every run pays something</Text>
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
  stage: { width: '100%', minHeight: 230, alignItems: 'center', justifyContent: 'center', marginBottom: 16, overflow: 'hidden' },
  card: {
    width: '100%', minHeight: 220, borderRadius: 22, alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#1B1006', borderWidth: 2, borderColor: 'rgba(245,158,11,0.35)', paddingVertical: 24,
  },
  avatar: {
    width: 68, height: 68, borderRadius: 34, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)',
  },
  avatarTxt: { fontSize: 30, fontWeight: '900' },
  cardName: { color: '#F8FAFC', fontSize: 24, fontWeight: '900', textAlign: 'center', paddingHorizontal: 16 },
  cardHint: { color: 'rgba(255,255,255,0.45)', fontSize: 12.5, fontWeight: '700' },
  stamp: { position: 'absolute', top: 16, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, borderWidth: 2 },
  stampReal: { left: 16, borderColor: '#4ADE80', backgroundColor: 'rgba(34,197,94,0.15)' },
  stampFake: { right: 16, borderColor: '#F87171', backgroundColor: 'rgba(239,68,68,0.15)' },
  stampRealTxt: { color: '#4ADE80', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
  stampFakeTxt: { color: '#F87171', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
  idle: {
    width: '100%', minHeight: 220, borderRadius: 22, alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#1B1006', borderWidth: 2, borderColor: 'rgba(255,255,255,0.10)',
  },
  idleTxt: { color: 'rgba(255,255,255,0.5)', fontSize: 12.5, fontWeight: '700' },
  answers: { flexDirection: 'row', gap: 12, width: '100%' },
  ansBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 58, borderRadius: 16,
  },
  ansFake: {
    backgroundColor: '#B91C1C',
    shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  ansReal: {
    backgroundColor: '#4ADE80',
    shadowColor: '#22C55E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  ansFakeTxt: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  ansRealTxt: { color: '#120A02', fontSize: 16, fontWeight: '900' },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 54, width: '100%', borderRadius: 16, backgroundColor: '#F59E0B',
    shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  startTxt: { color: '#120A02', fontSize: 16, fontWeight: '900' },
  footer: { marginTop: 16, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.45)' },
});

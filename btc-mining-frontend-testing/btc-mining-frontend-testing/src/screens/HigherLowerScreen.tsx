import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import GameScreenWrapper from '../components/GameScreenWrapper';
import { useGameReward } from '../hooks/useGameReward';
import { ClaimedBanner, LosePanel, MiningLockCard, WinPanel } from '../components/games/GameOutcome';

/** Max payout -- consumed by GameZoneScreen's "Up to X GH/s" label. */
export const WIN_REWARD_GH = 5;

const SUITS = ['♠', '♥', '♦', '♣'] as const;
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'] as const;

type Card = { rank: string; value: number; suit: string; red: boolean };

function drawCard(): Card {
  const i = Math.floor(Math.random() * RANKS.length);
  const suitIdx = Math.floor(Math.random() * SUITS.length);
  const suit = SUITS[suitIdx];
  return { rank: RANKS[i], value: i + 2, suit, red: suit === '♥' || suit === '♦' };
}

/** Same weighted skew the other games use: small wins common, 5 GH/s rare. */
const GH_WEIGHTS = [
  { gh: 1, weight: 20 }, { gh: 2, weight: 12 }, { gh: 3, weight: 7 },
  { gh: 4, weight: 4 }, { gh: 5, weight: 2 },
];
function pickGh(): number {
  const total = GH_WEIGHTS.reduce((s, w) => s + w.weight, 0);
  let r = Math.random() * total;
  for (const w of GH_WEIGHTS) { r -= w.weight; if (r <= 0) return w.gh; }
  return 1;
}

type Phase = 'ready' | 'revealed_win' | 'revealed_lose';

const CardFace: React.FC<{ card: Card | null; faceDown?: boolean }> = ({ card, faceDown }) => {
  const pop = useRef(new Animated.Value(0.85)).current;
  useEffect(() => {
    pop.setValue(0.85);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 9 }).start();
  }, [card, faceDown, pop]);

  return (
    <Animated.View style={[s.card, faceDown && s.cardBack, { transform: [{ scale: pop }] }]}>
      {faceDown || !card ? (
        <Icon name="help" size={34} color="rgba(255,255,255,0.35)" />
      ) : (
        <>
          <Text style={[s.cardRank, card.red && s.cardRed]}>{card.rank}</Text>
          <Text style={[s.cardSuit, card.red && s.cardRed]}>{card.suit}</Text>
        </>
      )}
    </Animated.View>
  );
};

export default function HigherLowerScreen() {
  const navigation = useNavigation();

  const [current, setCurrent] = useState<Card>(() => drawCard());
  const [next, setNext] = useState<Card | null>(null);
  const [phase, setPhase] = useState<Phase>('ready');
  const [wonGh, setWonGh] = useState(0);

  const newRound = useCallback(() => {
    setCurrent(drawCard());
    setNext(null);
    setPhase('ready');
    setWonGh(0);
  }, []);

  const reward = useGameReward({ onNewRound: newRound, gameName: 'Higher or Lower' });

  const guess = (choice: 'higher' | 'lower') => {
    if (phase !== 'ready') return;
    // Redraw on an exact tie so a guess is never unwinnable by definition.
    let drawn = drawCard();
    while (drawn.value === current.value) drawn = drawCard();
    setNext(drawn);

    const isHigher = drawn.value > current.value;
    const won = (choice === 'higher') === isHigher;
    if (won) {
      const gh = pickGh();
      setWonGh(gh);
      reward.setPendingWin(gh);
      setPhase('revealed_win');
    } else {
      setPhase('revealed_lose');
    }
  };
  useEffect(() => { if (phase === 'ready') reward.resetReward(); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <GameScreenWrapper
      title="Higher or Lower"
      iconName="cards-playing-outline"
      iconColor="#38BDF8"
      gradientColors={['#060A18', '#0A1024', '#0E1A33']}
      scrollable
    >
      <Text style={s.subtitle}>Will the next card be higher or lower?</Text>

      {reward.isMiningActive === false ? (
        <MiningLockCard gameName="Higher or Lower" onPress={() => navigation.goBack()} />
      ) : (
        <>
          {reward.claimedBanner ? <ClaimedBanner text={reward.claimedBanner} /> : null}

          <View style={s.row}>
            <View style={s.slot}>
              <Text style={s.slotLabel}>CURRENT</Text>
              <CardFace card={current} />
            </View>
            <Icon name="arrow-right" size={22} color="rgba(255,255,255,0.3)" />
            <View style={s.slot}>
              <Text style={s.slotLabel}>NEXT</Text>
              <CardFace card={next} faceDown={phase === 'ready'} />
            </View>
          </View>

          {phase === 'ready' && (
            <View style={s.choices}>
              <TouchableOpacity style={[s.choice, s.choiceUp]} onPress={() => guess('higher')} activeOpacity={0.85}>
                <Icon name="arrow-up-bold" size={22} color="#052E16" />
                <Text style={s.choiceTxtDark}>Higher</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.choice, s.choiceDown]} onPress={() => guess('lower')} activeOpacity={0.85}>
                <Icon name="arrow-down-bold" size={22} color="#FFF" />
                <Text style={s.choiceTxtLight}>Lower</Text>
              </TouchableOpacity>
            </View>
          )}

          {phase === 'revealed_win' && (
            <WinPanel
              title={`You Won +${wonGh} GH/s!`}
              gh={wonGh}
              crediting={reward.crediting}
              adLoading={reward.claimAdLoading}
              adLoaded={reward.claimAdLoaded}
              onClaim={reward.openClaimAd}
            />
          )}

          {phase === 'revealed_lose' && (
            <LosePanel
              title="Not This Time!"
              adLoading={reward.retryAdLoading}
              adLoaded={reward.retryAdLoaded}
              onRetry={reward.openRetryAd}
            />
          )}

          <Text style={s.footer}>1-5 GH/s per win · watch a video to redeem</Text>
        </>
      )}
    </GameScreenWrapper>
  );
}

const s = StyleSheet.create({
  subtitle: { textAlign: 'center', fontSize: 15, fontWeight: '700', color: '#F8FAFC', marginTop: 4, marginBottom: 18 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 20 },
  slot: { alignItems: 'center', gap: 6 },
  slotLabel: { color: '#64748B', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  card: {
    width: 96, height: 132, borderRadius: 16, backgroundColor: '#F8FAFC',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(56,189,248,0.5)',
    shadowColor: '#38BDF8', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45, shadowRadius: 14, elevation: 6,
  },
  cardBack: {
    backgroundColor: '#131C2E', borderColor: 'rgba(255,255,255,0.14)',
    shadowOpacity: 0, elevation: 0,
  },
  cardRank: { fontSize: 32, fontWeight: '900', color: '#0F172A' },
  cardSuit: { fontSize: 22, color: '#0F172A', marginTop: 2 },
  cardRed: { color: '#DC2626' },
  choices: { flexDirection: 'row', gap: 12, width: '100%', marginBottom: 16 },
  choice: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, borderRadius: 14 },
  choiceUp: {
    backgroundColor: '#4ADE80',
    shadowColor: '#4ADE80', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  choiceDown: {
    backgroundColor: '#6366F1',
    shadowColor: '#6366F1', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  choiceTxtDark: { color: '#052E16', fontSize: 16, fontWeight: '900' },
  choiceTxtLight: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  footer: { marginTop: 16, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.45)' },
});

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import GameScreenWrapper from '../components/GameScreenWrapper';
import { useGameReward } from '../hooks/useGameReward';
import { ClaimedBanner, LosePanel, MiningLockCard, WinPanel } from '../components/games/GameOutcome';

/** Max payout -- consumed by GameZoneScreen's "Up to X GH/s" label. */
export const WIN_REWARD_GH = 5;

const CHEST_COUNT = 3;
/** One of the three is empty, so a pick is a 2-in-3 win. */
const EMPTY_COUNT = 1;
const REVEAL_ALL_DELAY_MS = 550;

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

type Chest = { key: string; empty: boolean; gh: number };

function dealChests(): Chest[] {
  const emptyIdx = new Set<number>();
  while (emptyIdx.size < EMPTY_COUNT) emptyIdx.add(Math.floor(Math.random() * CHEST_COUNT));
  return Array.from({ length: CHEST_COUNT }, (_, i) =>
    emptyIdx.has(i)
      ? { key: `c${i}`, empty: true, gh: 0 }
      : { key: `c${i}`, empty: false, gh: pickGh() },
  );
}

type Phase = 'ready' | 'revealing' | 'win' | 'lose';

const ChestView: React.FC<{
  chest: Chest; revealed: boolean; picked: boolean; disabled: boolean; onPress: () => void;
}> = ({ chest, revealed, picked, disabled, onPress }) => {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!revealed) return;
    scale.setValue(0.75);
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 11 }).start();
  }, [revealed, scale]);

  return (
    <TouchableOpacity
      style={[s.chest, revealed && (chest.empty ? s.chestEmpty : s.chestFull), picked && s.chestPicked]}
      activeOpacity={0.85}
      disabled={disabled}
      onPress={onPress}
    >
      <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
        {revealed ? (
          chest.empty ? (
            <>
              <Icon name="package-variant" size={34} color="#F87171" />
              <Text style={s.chestEmptyTxt}>Empty</Text>
            </>
          ) : (
            <>
              <Icon name="treasure-chest" size={34} color="#FBBF24" />
              <Text style={s.chestGhTxt}>+{chest.gh}</Text>
            </>
          )
        ) : (
          <Icon name="treasure-chest" size={34} color="rgba(255,255,255,0.35)" />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

export default function TreasureChestScreen() {
  const navigation = useNavigation();

  const [chests, setChests] = useState<Chest[]>(() => dealChests());
  const [phase, setPhase] = useState<Phase>('ready');
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [wonGh, setWonGh] = useState(0);

  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (revealTimer.current) clearTimeout(revealTimer.current); }, []);

  const newRound = useCallback(() => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    setChests(dealChests());
    setPhase('ready');
    setPickedIndex(null);
    setRevealed(new Set());
    setWonGh(0);
  }, []);

  const reward = useGameReward({ onNewRound: newRound, gameName: 'Treasure Chests' });

  const pick = (index: number) => {
    if (phase !== 'ready') return;
    const chest = chests[index];
    setPhase('revealing');
    setPickedIndex(index);
    setRevealed(new Set([index]));

    revealTimer.current = setTimeout(() => {
      setRevealed(new Set(chests.map((_, i) => i)));
      if (!chest.empty) {
        setWonGh(chest.gh);
        reward.setPendingWin(chest.gh);
        setPhase('win');
      } else {
        setPhase('lose');
      }
    }, REVEAL_ALL_DELAY_MS);
  };
  useEffect(() => { if (phase === 'ready') reward.resetReward(); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <GameScreenWrapper
      title="Treasure Chests"
      iconName="treasure-chest"
      iconColor="#FBBF24"
      gradientColors={['#0C0A05', '#181206', '#20180A']}
      scrollable
    >
      <Text style={s.subtitle}>Pick a chest — one of them is empty!</Text>

      {reward.isMiningActive === false ? (
        <MiningLockCard gameName="Treasure Chests" onPress={() => navigation.goBack()} />
      ) : (
        <>
          {reward.claimedBanner ? <ClaimedBanner text={reward.claimedBanner} /> : null}

          <View style={s.row}>
            {chests.map((c, i) => (
              <ChestView
                key={c.key}
                chest={c}
                revealed={revealed.has(i)}
                picked={pickedIndex === i}
                disabled={phase !== 'ready'}
                onPress={() => pick(i)}
              />
            ))}
          </View>

          {phase === 'win' && (
            <WinPanel
              title={`You Found +${wonGh} GH/s!`}
              gh={wonGh}
              crediting={reward.crediting}
              adLoading={reward.claimAdLoading}
              adLoaded={reward.claimAdLoaded}
              onClaim={reward.openClaimAd}
            />
          )}

          {phase === 'lose' && (
            <LosePanel
              title="Empty Chest!"
              adLoading={reward.retryAdLoading}
              adLoaded={reward.retryAdLoaded}
              onRetry={reward.openRetryAd}
            />
          )}

          <Text style={s.footer}>3 chests · 1 empty · up to 5 GH/s per win</Text>
        </>
      )}
    </GameScreenWrapper>
  );
}

const s = StyleSheet.create({
  subtitle: { textAlign: 'center', fontSize: 15, fontWeight: '700', color: '#F8FAFC', marginTop: 4, marginBottom: 22 },
  row: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginBottom: 22, width: '100%' },
  chest: {
    flex: 1, aspectRatio: 0.85, maxWidth: 112, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#15110A', borderWidth: 1.5, borderColor: 'rgba(251,191,36,0.22)',
  },
  chestFull: {
    borderColor: 'rgba(251,191,36,0.6)', backgroundColor: '#1E1608', borderWidth: 2,
    shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 5,
  },
  chestEmpty: {
    borderColor: 'rgba(248,113,113,0.55)', backgroundColor: '#1C0E0E', borderWidth: 2,
    shadowColor: '#F87171', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 5,
  },
  chestPicked: { borderWidth: 2.5 },
  chestGhTxt: { color: '#FBBF24', fontWeight: '900', fontSize: 14, marginTop: 4 },
  chestEmptyTxt: { color: '#F87171', fontWeight: '800', fontSize: 12, marginTop: 4 },
  footer: { marginTop: 16, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.45)' },
});

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import GameScreenWrapper from '../components/GameScreenWrapper';
import { useGameReward } from '../hooks/useGameReward';
import { ClaimedBanner, LosePanel, MiningLockCard, WinPanel } from '../components/games/GameOutcome';

/** Max payout -- consumed by GameZoneScreen's "Up to X GH/s" label. */
export const WIN_REWARD_GH = 5;

type Move = 'rock' | 'paper' | 'scissors';
// Deliberately NOT three hand icons: MaterialCommunityIcons' hand glyphs are
// near-identical at this size, so a played move was unreadable. A solid disc,
// a sheet and shears are unmistakable at a glance.
const MOVES: { key: Move; label: string; icon: string }[] = [
  { key: 'rock', label: 'Rock', icon: 'checkbox-blank-circle' },
  { key: 'paper', label: 'Paper', icon: 'file-outline' },
  { key: 'scissors', label: 'Scissors', icon: 'content-cut' },
];
const BEATS: Record<Move, Move> = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

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

type Phase = 'ready' | 'win' | 'lose' | 'draw';

export default function RockPaperScissorsScreen() {
  const navigation = useNavigation();

  const [playerMove, setPlayerMove] = useState<Move | null>(null);
  const [houseMove, setHouseMove] = useState<Move | null>(null);
  const [phase, setPhase] = useState<Phase>('ready');
  const [wonGh, setWonGh] = useState(0);

  const pop = useRef(new Animated.Value(1)).current;

  const newRound = useCallback(() => {
    setPlayerMove(null);
    setHouseMove(null);
    setPhase('ready');
    setWonGh(0);
  }, []);

  const reward = useGameReward({ onNewRound: newRound, gameName: 'Rock Paper Scissors' });

  const play = (move: Move) => {
    if (phase !== 'ready') return;
    const house = MOVES[Math.floor(Math.random() * MOVES.length)].key;
    setPlayerMove(move);
    setHouseMove(house);

    pop.setValue(0.8);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 10 }).start();

    if (move === house) {
      setPhase('draw');
    } else if (BEATS[move] === house) {
      const gh = pickGh();
      setWonGh(gh);
      reward.setPendingWin(gh);
      setPhase('win');
    } else {
      setPhase('lose');
    }
  };
  useEffect(() => { if (phase === 'ready') reward.resetReward(); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const iconFor = (m: Move | null) => MOVES.find(x => x.key === m)?.icon ?? 'help';

  return (
    <GameScreenWrapper
      title="Rock Paper Scissors"
      iconName="hand-front-right"
      iconColor="#F472B6"
      gradientColors={['#0A0716', '#140B22', '#1B0E2B']}
      scrollable
    >
      <Text style={s.subtitle}>Beat the house to win GH/s</Text>

      {reward.isMiningActive === false ? (
        <MiningLockCard gameName="Rock Paper Scissors" onPress={() => navigation.goBack()} />
      ) : (
        <>
          {reward.claimedBanner ? <ClaimedBanner text={reward.claimedBanner} /> : null}

          <View style={s.arena}>
            <View style={s.side}>
              <Text style={s.sideLabel}>YOU</Text>
              <Animated.View style={[s.disc, s.discYou, { transform: [{ scale: pop }] }]}>
                <Icon name={iconFor(playerMove)} size={38} color="#22D3EE" />
              </Animated.View>
            </View>
            <Text style={s.vs}>VS</Text>
            <View style={s.side}>
              <Text style={s.sideLabel}>HOUSE</Text>
              <Animated.View style={[s.disc, s.discHouse, { transform: [{ scale: pop }] }]}>
                <Icon name={iconFor(houseMove)} size={38} color="#F472B6" />
              </Animated.View>
            </View>
          </View>

          {phase === 'ready' && (
            <View style={s.moves}>
              {MOVES.map(m => (
                <TouchableOpacity key={m.key} style={s.moveBtn} activeOpacity={0.85} onPress={() => play(m.key)}>
                  <Icon name={m.icon} size={26} color="#F8FAFC" />
                  <Text style={s.moveTxt}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {phase === 'win' && (
            <WinPanel
              title={`You Won +${wonGh} GH/s!`}
              gh={wonGh}
              crediting={reward.crediting}
              adLoading={reward.claimAdLoading}
              adLoaded={reward.claimAdLoaded}
              onClaim={reward.openClaimAd}
            />
          )}

          {phase === 'lose' && (
            <LosePanel
              title="House Wins!"
              adLoading={reward.retryAdLoading}
              adLoaded={reward.retryAdLoaded}
              onRetry={reward.openRetryAd}
            />
          )}

          {phase === 'draw' && (
            <LosePanel
              title="It's a Draw!"
              body="No reward this round. Watch a short video to play again."
              adLoading={reward.retryAdLoading}
              adLoaded={reward.retryAdLoaded}
              onRetry={reward.openRetryAd}
            />
          )}

          <Text style={s.footer}>1-5 GH/s per win · watch a video to play again</Text>
        </>
      )}
    </GameScreenWrapper>
  );
}

const s = StyleSheet.create({
  subtitle: { textAlign: 'center', fontSize: 15, fontWeight: '700', color: '#F8FAFC', marginTop: 4, marginBottom: 18 },
  arena: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 22 },
  side: { alignItems: 'center', gap: 6 },
  sideLabel: { color: '#64748B', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  disc: {
    width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#12101F', borderWidth: 2,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 14, elevation: 6,
  },
  discYou: { borderColor: 'rgba(34,211,238,0.6)', shadowColor: '#22D3EE' },
  discHouse: { borderColor: 'rgba(244,114,182,0.6)', shadowColor: '#F472B6' },
  vs: { color: '#64748B', fontSize: 13, fontWeight: '900' },
  moves: { flexDirection: 'row', gap: 10, width: '100%', marginBottom: 16 },
  moveBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 84, borderRadius: 16, backgroundColor: '#17132A',
    borderWidth: 1.5, borderColor: 'rgba(167,139,250,0.3)',
  },
  moveTxt: { color: '#F8FAFC', fontSize: 13, fontWeight: '700' },
  footer: { marginTop: 16, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.45)' },
});

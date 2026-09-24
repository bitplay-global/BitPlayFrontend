import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import GameScreenWrapper from '../components/GameScreenWrapper';
import { useGameReward } from '../hooks/useGameReward';
import { ClaimedBanner, LosePanel, MiningLockCard, WinPanel } from '../components/games/GameOutcome';

/** Max payout -- consumed by GameZoneScreen's "Up to X GH/s" label. */
export const WIN_REWARD_GH = 5;

/** Beat this to win. 2d6 > 7 is a ~41.7% win rate, in line with the other games. */
const TARGET = 7;
const ROLL_MS = 700;

const DICE_ICONS = ['dice-1', 'dice-2', 'dice-3', 'dice-4', 'dice-5', 'dice-6'];

/** Higher totals pay more; the top rung is deliberately rare. */
function ghForTotal(total: number): number {
  if (total >= 12) return 5;
  if (total >= 11) return 4;
  if (total >= 10) return 3;
  if (total >= 9) return 2;
  return 1;
}

type Phase = 'ready' | 'rolling' | 'win' | 'lose';

export default function LuckyDiceScreen() {
  const navigation = useNavigation();

  const [dice, setDice] = useState<[number, number]>([0, 0]);
  const [phase, setPhase] = useState<Phase>('ready');
  const [wonGh, setWonGh] = useState(0);

  const spin = useRef(new Animated.Value(0)).current;
  const rollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Both timers must be cleared on unmount -- a fire after navigating away
  // would set state on an unmounted component.
  useEffect(() => () => {
    if (rollTimer.current) clearTimeout(rollTimer.current);
    if (tickTimer.current) clearInterval(tickTimer.current);
  }, []);

  const newRound = useCallback(() => {
    if (rollTimer.current) clearTimeout(rollTimer.current);
    if (tickTimer.current) clearInterval(tickTimer.current);
    setDice([0, 0]);
    setPhase('ready');
    setWonGh(0);
  }, []);

  const reward = useGameReward({ onNewRound: newRound, gameName: 'Lucky Dice' });

  const roll = () => {
    if (phase !== 'ready') return;
    setPhase('rolling');

    spin.setValue(0);
    Animated.timing(spin, {
      toValue: 1, duration: ROLL_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();

    // Cosmetic tumble: a slow-ish interval, cleared as soon as the roll lands.
    tickTimer.current = setInterval(() => {
      setDice([Math.floor(Math.random() * 6), Math.floor(Math.random() * 6)]);
    }, 80);

    rollTimer.current = setTimeout(() => {
      if (tickTimer.current) { clearInterval(tickTimer.current); tickTimer.current = null; }
      const a = Math.floor(Math.random() * 6);
      const b = Math.floor(Math.random() * 6);
      setDice([a, b]);
      const total = a + b + 2;
      if (total > TARGET) {
        const gh = ghForTotal(total);
        setWonGh(gh);
        reward.setPendingWin(gh);
        setPhase('win');
      } else {
        setPhase('lose');
      }
    }, ROLL_MS);
  };
  useEffect(() => { if (phase === 'ready') reward.resetReward(); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const total = dice[0] + dice[1] + 2;
  const showTotal = phase === 'win' || phase === 'lose';

  return (
    <GameScreenWrapper
      title="Lucky Dice"
      iconName="dice-multiple"
      iconColor="#FBBF24"
      gradientColors={['#0F0A05', '#1A1206', '#221708']}
      scrollable
    >
      <Text style={s.subtitle}>
        Roll higher than <Text style={s.target}>{TARGET}</Text> to win
      </Text>

      {reward.isMiningActive === false ? (
        <MiningLockCard gameName="Lucky Dice" onPress={() => navigation.goBack()} />
      ) : (
        <>
          {reward.claimedBanner ? <ClaimedBanner text={reward.claimedBanner} /> : null}

          <View style={s.diceRow}>
            {dice.map((d, i) => (
              <Animated.View key={i} style={[s.die, { transform: [{ rotate }] }]}>
                <Icon name={DICE_ICONS[d]} size={54} color="#FBBF24" />
              </Animated.View>
            ))}
          </View>

          <View style={s.totalWrap}>
            <Text style={s.totalLabel}>TOTAL</Text>
            <Text style={[s.totalValue, showTotal && total > TARGET && s.totalWin, showTotal && total <= TARGET && s.totalLose]}>
              {phase === 'ready' ? '—' : total}
            </Text>
          </View>

          {phase === 'ready' && (
            <TouchableOpacity style={s.rollBtn} activeOpacity={0.88} onPress={roll}>
              <Icon name="dice-multiple" size={22} color="#1C1917" />
              <Text style={s.rollTxt}>Roll Dice</Text>
            </TouchableOpacity>
          )}

          {phase === 'rolling' && <Text style={s.rollingTxt}>Rolling…</Text>}

          {phase === 'win' && (
            <WinPanel
              title={`Rolled ${total} — +${wonGh} GH/s!`}
              gh={wonGh}
              crediting={reward.crediting}
              adLoading={reward.claimAdLoading}
              adLoaded={reward.claimAdLoaded}
              onClaim={reward.openClaimAd}
            />
          )}

          {phase === 'lose' && (
            <LosePanel
              title={`Rolled ${total} — Too Low!`}
              body={`You needed more than ${TARGET}. Watch a short video to roll again.`}
              adLoading={reward.retryAdLoading}
              adLoaded={reward.retryAdLoaded}
              onRetry={reward.openRetryAd}
            />
          )}

          <Text style={s.footer}>Higher totals pay more · 12 pays the full 5 GH/s</Text>
        </>
      )}
    </GameScreenWrapper>
  );
}

const s = StyleSheet.create({
  subtitle: { textAlign: 'center', fontSize: 15, fontWeight: '700', color: '#F8FAFC', marginTop: 4, marginBottom: 20 },
  target: { color: '#FBBF24', fontWeight: '900' },
  diceRow: { flexDirection: 'row', gap: 16, justifyContent: 'center', marginBottom: 16 },
  die: {
    width: 92, height: 92, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#16110A', borderWidth: 2, borderColor: 'rgba(251,191,36,0.55)',
    shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 14, elevation: 6,
  },
  totalWrap: {
    alignItems: 'center', marginBottom: 20, paddingVertical: 10, paddingHorizontal: 28,
    borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  totalLabel: { color: '#64748B', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  totalValue: { color: '#F8FAFC', fontSize: 34, fontWeight: '900', marginTop: 2 },
  totalWin: { color: '#4ADE80' },
  totalLose: { color: '#F87171' },
  rollBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    minHeight: 54, width: '100%', borderRadius: 16, backgroundColor: '#FBBF24', marginBottom: 12,
    shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 14, elevation: 7,
  },
  rollTxt: { color: '#1C1917', fontSize: 16, fontWeight: '900' },
  rollingTxt: { color: '#94A3B8', fontSize: 14, fontWeight: '700', marginBottom: 12 },
  footer: { marginTop: 16, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.45)' },
});

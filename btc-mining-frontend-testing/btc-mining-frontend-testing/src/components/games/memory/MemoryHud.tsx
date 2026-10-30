import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { TimerRing } from './TimerRing';
import { MM } from './theme';

type Props = {
  width: number;
  timer: number;
  total: number;
  memorize: boolean;
  active: boolean;
  won: boolean;
  matches: number;
  totalPairs: number;
  round: number;
  combo: number;
  rewardGh: number;
};

/** Timer ring | pairs progress + live status | round + prize. */
export function MemoryHud({ width, timer, total, memorize, active, won, matches, totalPairs, round, combo, rewardGh }: Props) {
  const running = active && !memorize;

  // Status line: icon, copy, colour.
  let status: { icon: string; text: string; color: string };
  if (memorize) status = { icon: 'eye-outline', text: 'Memorize the cards!', color: MM.gold };
  else if (!active) status = won ? { icon: 'trophy', text: 'All pairs found!', color: MM.green } : { icon: 'timer-sand-complete', text: "Time's up", color: MM.red };
  else if (combo >= 2) status = { icon: 'fire', text: `${combo}x combo — keep going!`, color: '#FB923C' };
  else status = { icon: 'cards-outline', text: 'Find the matching pairs', color: MM.muted };

  // Gentle breathing on the memorize prompt.
  const breathe = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!memorize) { breathe.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 0.45, duration: 380, useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 1, duration: 380, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [memorize]);

  return (
    <LinearGradient
      colors={['rgba(30,41,82,0.85)', 'rgba(15,23,42,0.85)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[s.wrap, { width }]}
    >
      <TimerRing seconds={timer} total={total} running={running} />

      <View style={s.mid}>
        <View style={s.pairsRow}>
          <Text style={s.label}>PAIRS</Text>
          <Text style={s.pairsVal}>
            {matches}<Text style={s.pairsOf}>/{totalPairs}</Text>
          </Text>
        </View>
        <View style={s.pips}>
          {Array.from({ length: totalPairs }).map((_, i) => (
            <View key={i} style={[s.pip, i < matches && s.pipOn]} />
          ))}
        </View>
        <Animated.View style={[s.statusRow, { opacity: breathe }]}>
          <MaterialCommunityIcons name={status.icon} size={13} color={status.color} />
          <Text style={[s.status, { color: status.color }]} numberOfLines={1}>{status.text}</Text>
        </Animated.View>
      </View>

      <View style={s.right}>
        <Text style={s.label}>ROUND</Text>
        <Text style={s.roundVal}>{round}</Text>
        <View style={s.prize}>
          <MaterialCommunityIcons name="lightning-bolt" size={11} color={MM.gold} />
          <Text style={s.prizeTxt}>+{rewardGh} GH/s</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(165,180,252,0.16)',
    marginBottom: 10,
  },
  mid: { flex: 1, minWidth: 0 },
  pairsRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  label: { color: MM.dim, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  pairsVal: { color: MM.text, fontSize: 16, fontWeight: '900' },
  pairsOf: { color: MM.dim, fontSize: 12, fontWeight: '800' },
  pips: { flexDirection: 'row', gap: 3, marginTop: 5 },
  pip: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.09)' },
  pipOn: { backgroundColor: MM.green, boxShadow: '0 0 6px 0 rgba(74,222,128,0.7)' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  status: { fontSize: 11.5, fontWeight: '700', flexShrink: 1 },
  right: { alignItems: 'center', minWidth: 58 },
  roundVal: { color: MM.text, fontSize: 18, fontWeight: '900', lineHeight: 22 },
  prize: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.35)',
  },
  prizeTxt: { color: MM.gold, fontSize: 9.5, fontWeight: '800' },
});

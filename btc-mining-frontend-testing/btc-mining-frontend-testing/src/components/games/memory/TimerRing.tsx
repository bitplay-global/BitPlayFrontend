import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withSequence, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { MM, timerColorFor } from './theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  seconds: number;
  total: number;
  /** True while the clock is ticking (not during memorize / after the round). */
  running: boolean;
  size?: number;
};

/**
 * Circular countdown. The ring sweeps continuously on the UI thread: on each
 * one-second tick it animates linearly toward the *next* second, so it never
 * stutters and React only re-renders once a second.
 */
export function TimerRing({ seconds, total, running, size = 58 }: Props) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = timerColorFor(seconds);
  const low = running && seconds <= 10;

  const progress = useSharedValue(seconds / total);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (running && seconds > 0) {
      progress.value = withTiming(Math.max(0, (seconds - 1) / total), { duration: 1000, easing: Easing.linear });
    } else {
      progress.value = withTiming(seconds / total, { duration: 250 });
    }
    if (low) {
      pulse.value = withSequence(withTiming(1.1, { duration: 120 }), withTiming(1, { duration: 260 }));
    }
  }, [seconds, running, total, low]);

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - progress.value) }));
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <Animated.View style={[{ width: size, height: size }, pulseStyle]}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="rgba(5,9,20,0.6)" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c} ${c}`}
          animatedProps={ringProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, s.center]}>
        <Text style={[s.value, { color }]}>{seconds}</Text>
        <Text style={s.unit}>SEC</Text>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 18, fontWeight: '900', lineHeight: 20 },
  unit: { color: MM.dim, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
});

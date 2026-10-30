import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { IS_SMALL, T, formatClock, formatSignedUsd, formatUsd } from './theme';

/* ─────────────────────────── Live price ─────────────────────────── */

/**
 * Big price that flashes green / red on every up / down tick. The colour is
 * driven on the UI thread (no extra React state per tick).
 */
export const LivePrice = React.memo(function LivePrice({
  price,
  size,
}: {
  price: number;
  size: number;
}) {
  const flash = useSharedValue(0);
  const prev = useRef(price);

  useEffect(() => {
    const p = prev.current;
    prev.current = price;
    if (!(p > 0) || price === p) return;
    flash.value = withSequence(
      withTiming(price > p ? 1 : -1, { duration: 90 }),
      withTiming(0, { duration: 650 }),
    );
  }, [price, flash]);

  const style = useAnimatedStyle(() => ({
    color: interpolateColor(flash.value, [-1, 0, 1], [T.down, T.text, T.up]),
  }));

  return (
    <Animated.Text
      style={[styles.livePrice, { fontSize: size, lineHeight: size * 1.18 }, style]}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {price > 0 ? `$${formatUsd(price)}` : '$ —'}
    </Animated.Text>
  );
});

/* ─────────────────────────── UP / DOWN button ─────────────────────────── */

export function DirectionButton({
  direction,
  onPress,
  disabled,
}: {
  direction: 'up' | 'down';
  onPress: () => void;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const isUp = direction === 'up';
  const colors = isUp ? ['#34D399', T.up, T.upDeep] : ['#F87171', T.down, T.downDeep];

  return (
    <Animated.View style={[styles.dirWrap, anim, disabled && styles.dirDisabled]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => {
          scale.value = withTiming(0.95, { duration: 90 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 12, stiffness: 260 });
        }}
        style={styles.dirPressable}
        accessibilityRole="button"
        accessibilityLabel={isUp ? 'Predict price goes up' : 'Predict price goes down'}
      >
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.dirGradient}
        >
          <View style={styles.dirInner}>
            <View style={styles.dirIconCircle}>
              <Icon name={isUp ? 'trending-up' : 'trending-down'} size={IS_SMALL ? 20 : 24} color="#FFF" />
            </View>
            <View style={styles.dirTextCol}>
              <Text style={styles.dirLabel}>{isUp ? 'UP' : 'DOWN'}</Text>
              <Text style={styles.dirSub} numberOfLines={1}>
                {isUp ? 'Price goes higher' : 'Price goes lower'}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

/* ─────────────────────────── Countdown ring ─────────────────────────── */

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Circular countdown. The arc animates on the UI thread from the remaining
 * fraction to zero; the seconds label comes from the parent's existing clock.
 */
export function CountdownRing({
  endTime,
  durationMs,
  secondsLeft,
  color,
  size,
}: {
  endTime: number;
  durationMs: number;
  secondsLeft: number;
  color: string;
  size: number;
}) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const progress = useSharedValue(1);

  useEffect(() => {
    const remaining = Math.max(0, endTime - Date.now());
    progress.value = Math.min(1, remaining / durationMs);
    progress.value = withTiming(0, { duration: remaining, easing: Easing.linear });
  }, [endTime, durationMs, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circ * (1 - progress.value),
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circ} ${circ}`}
          animatedProps={animatedProps}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.ringCenter]}>
        <Text style={[styles.ringSecs, { fontSize: size * 0.3 }]}>{secondsLeft}</Text>
        <Text style={styles.ringUnit}>SEC</Text>
      </View>
    </View>
  );
}

/* ─────────────────────────── Pulsing badge (e.g. LIVE) ─────────────────────────── */

export function LiveBadge({ live }: { live: boolean }) {
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = withRepeat(withSequence(withTiming(0.25, { duration: 700 }), withTiming(1, { duration: 700 })), -1);
  }, [o]);
  const dot = useAnimatedStyle(() => ({ opacity: o.value }));
  const c = live ? T.up : T.gold;
  return (
    <View style={[styles.liveBadge, { borderColor: live ? 'rgba(34,197,94,0.35)' : 'rgba(251,191,36,0.35)' }]}>
      <Animated.View style={[styles.liveDot, { backgroundColor: c }, dot]} />
      <Text style={[styles.liveText, { color: c }]}>{live ? 'LIVE' : 'SYNCING'}</Text>
    </View>
  );
}

/* ─────────────────────────── Stat tile ─────────────────────────── */

export function StatTile({
  icon,
  iconColor,
  value,
  label,
  valueColor,
}: {
  icon: string;
  iconColor: string;
  value: string;
  label: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.statTile}>
      <View style={styles.statTop}>
        <Icon name={icon} size={14} color={iconColor} />
        <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

/* ─────────────────────────── History row ─────────────────────────── */

export function TradeHistoryRow({
  direction,
  entryPrice,
  exitPrice,
  earnedAt,
  won,
  claimed,
  reward,
  onClaim,
}: {
  direction: 'up' | 'down';
  entryPrice: number;
  exitPrice: number;
  earnedAt: number;
  won: boolean;
  claimed?: boolean;
  reward: number;
  onClaim: () => void;
}) {
  const move = exitPrice - entryPrice;
  const isUp = direction === 'up';
  return (
    <View style={styles.hRow}>
      <View style={[styles.hChip, { backgroundColor: won ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)' }]}>
        <Text style={[styles.hChipText, { color: won ? T.up : T.down }]}>{won ? 'W' : 'L'}</Text>
      </View>
      <View style={styles.hMid}>
        <View style={styles.hTitleRow}>
          <Icon name={isUp ? 'arrow-up-bold' : 'arrow-down-bold'} size={12} color={isUp ? T.up : T.down} />
          <Text style={styles.hTitle} numberOfLines={1}>
            {isUp ? 'UP' : 'DOWN'}
          </Text>
          <Text
            style={[styles.hMove, { color: move > 0 ? T.up : move < 0 ? T.down : T.textDim }]}
            numberOfLines={1}
          >
            {formatSignedUsd(move)}
          </Text>
          <Text style={styles.hTime} numberOfLines={1}>· {formatClock(earnedAt)}</Text>
        </View>
        <Text style={styles.hSub} numberOfLines={1}>
          ${formatUsd(entryPrice)} → ${formatUsd(exitPrice)}
        </Text>
      </View>
      <View style={styles.hRight}>
        {won ? (
          claimed ? (
            <>
              <Text style={styles.hWin}>+{reward} GH/s</Text>
              <Text style={styles.hClaimed}>CLAIMED</Text>
            </>
          ) : (
            <TouchableOpacity style={styles.hClaimBtn} onPress={onClaim} activeOpacity={0.8}>
              <Icon name="play-circle" size={12} color="#1C1407" />
              <Text style={styles.hClaimText}>Claim {reward}</Text>
            </TouchableOpacity>
          )
        ) : (
          <Text style={styles.hLost}>LOST</Text>
        )}
      </View>
    </View>
  );
}

/* ─────────────────────────── Pulsing icon (modals) ─────────────────────────── */

export function PulsingIcon({ children, glow }: { children: React.ReactNode; glow: string }) {
  const s = useSharedValue(1);
  useEffect(() => {
    s.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 650, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 650, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [s]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.15 + (s.value - 1) * 3,
    transform: [{ scale: 0.9 + (s.value - 1) * 4 }],
  }));
  return (
    <View style={styles.pulseIconWrap}>
      <Animated.View style={[styles.pulseGlow, { backgroundColor: glow }, glowStyle]} />
      <Animated.View style={iconStyle}>{children}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  livePrice: {
    color: T.text,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },

  dirWrap: {
    flex: 1,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  dirDisabled: { opacity: 0.4 },
  dirPressable: { borderRadius: 16, overflow: 'hidden' },
  dirGradient: { width: '100%', borderRadius: 16 },
  dirInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: IS_SMALL ? 11 : 14,
    paddingHorizontal: IS_SMALL ? 10 : 14,
    minHeight: IS_SMALL ? 58 : 66,
  },
  dirIconCircle: {
    width: IS_SMALL ? 34 : 40,
    height: IS_SMALL ? 34 : 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: IS_SMALL ? 8 : 10,
  },
  dirTextCol: { flex: 1, minWidth: 0 },
  dirLabel: { color: '#FFF', fontSize: IS_SMALL ? 18 : 21, fontWeight: '900', letterSpacing: 0.5 },
  dirSub: { color: 'rgba(255,255,255,0.85)', fontSize: IS_SMALL ? 10 : 11, fontWeight: '600', marginTop: 1 },

  ringCenter: { alignItems: 'center', justifyContent: 'center' },
  ringSecs: { color: T.text, fontWeight: '900', fontVariant: ['tabular-nums'] },
  ringUnit: { color: T.textDim, fontSize: 9, fontWeight: '800', letterSpacing: 1, marginTop: -2 },

  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  liveText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },

  statTile: {
    flex: 1,
    backgroundColor: T.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.border,
    paddingVertical: 10,
    paddingHorizontal: 10,
    minWidth: 0,
  },
  statTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  statLabel: { color: T.textDim, fontSize: 10, fontWeight: '700', marginLeft: 4, flexShrink: 1 },
  statValue: { color: T.text, fontSize: IS_SMALL ? 15 : 17, fontWeight: '900' },

  hRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  hChip: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  hChipText: { fontSize: 13, fontWeight: '900' },
  hMid: { flex: 1, minWidth: 0, paddingRight: 8 },
  hTitleRow: { flexDirection: 'row', alignItems: 'center' },
  hTitle: { color: T.text, fontSize: 12, fontWeight: '800', marginLeft: 3 },
  hMove: { fontSize: 11, fontWeight: '800', marginLeft: 6, fontVariant: ['tabular-nums'] },
  hTime: { color: T.textMuted, fontSize: 10, fontWeight: '600', marginLeft: 6 },
  hSub: { color: T.textDim, fontSize: 11, marginTop: 2, fontVariant: ['tabular-nums'] },
  hRight: { alignItems: 'flex-end', flexShrink: 0 },
  hWin: { color: T.up, fontSize: 12, fontWeight: '900' },
  hClaimed: { color: T.textMuted, fontSize: 9, fontWeight: '800', marginTop: 1, letterSpacing: 0.5 },
  hClaimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.gold,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 9,
    gap: 4,
  },
  hClaimText: { color: '#1C1407', fontSize: 11, fontWeight: '900' },
  hLost: { color: T.down, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  pulseIconWrap: {
    width: 92,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  pulseGlow: {
    position: 'absolute',
    width: 92,
    height: 92,
    borderRadius: 46,
  },
});

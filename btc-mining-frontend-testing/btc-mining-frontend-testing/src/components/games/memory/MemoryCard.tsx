import React, { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { FALLBACK_TOKEN_STYLE, MM, TOKEN_STYLES } from './theme';

type Props = {
  tokenKey: string;
  label: string;
  faceUp: boolean;
  matched: boolean;
  /** Part of a just-revealed pair that does not match -> shake + red flash. */
  wrong: boolean;
  disabled: boolean;
  onPress: () => void;
  size: number;
  index: number;
  /** Changes every round; re-runs the deal-in animation. */
  dealKey: number;
};

const PERSPECTIVE = 900;

/** Diagonal lattice for the card back, drawn as a single path. */
function latticePath(size: number) {
  const step = Math.max(10, Math.round(size / 6));
  let d = '';
  for (let o = -size; o <= size; o += step) {
    d += `M${o} 0L${o + size} ${size}`;
    d += `M${o + size} 0L${o} ${size}`;
  }
  return d;
}

const CardBack = memo(({ size, radius }: { size: number; radius: number }) => {
  const d = useMemo(() => latticePath(size), [size]);
  const emblem = Math.round(size * 0.44);
  return (
    <LinearGradient colors={['#1f2a5c', '#0b1026']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: radius }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Path d={d} stroke="rgba(165,180,252,0.10)" strokeWidth={1} />
      </Svg>
      <View style={[st.backInset, { borderRadius: radius - 3 }]} />
      <LinearGradient colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)']} style={[st.shine, { borderTopLeftRadius: radius, borderTopRightRadius: radius }]} />
      <View style={st.center}>
        <View style={[st.emblem, { width: emblem, height: emblem, borderRadius: emblem / 2 }]}>
          <MaterialCommunityIcons name="bitcoin" size={Math.round(emblem * 0.62)} color={MM.gold} />
        </View>
      </View>
    </LinearGradient>
  );
});

const CardFront = memo(({ tokenKey, label, size, radius, matched }: { tokenKey: string; label: string; size: number; radius: number; matched: boolean }) => {
  const t = TOKEN_STYLES[tokenKey] ?? FALLBACK_TOKEN_STYLE;
  const coin = Math.round(size * 0.5);
  const labelSize = Math.max(9, Math.round(size * 0.135));
  return (
    <LinearGradient colors={t.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, st.frontFill, { borderRadius: radius, borderColor: t.ring }]}>
      <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']} style={[st.shine, { borderTopLeftRadius: radius, borderTopRightRadius: radius }]} />
      <View style={[st.coin, { width: coin, height: coin, borderRadius: coin / 2 }]}>
        <MaterialCommunityIcons name={t.icon} size={Math.round(coin * 0.66)} color="#fff" />
      </View>
      <Text style={[st.label, { fontSize: labelSize, marginTop: Math.round(size * 0.05) }]} numberOfLines={1}>{label}</Text>
      {matched && (
        <View style={st.check}>
          <MaterialCommunityIcons name="check-bold" size={10} color="#052e16" />
        </View>
      )}
    </LinearGradient>
  );
});

function MemoryCardImpl({ tokenKey, label, faceUp, matched, wrong, disabled, onPress, size, index, dealKey }: Props) {
  const radius = Math.round(size * 0.16);
  const flip = useRef(new Animated.Value(faceUp ? 1 : 0)).current;
  const deal = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const press = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const wrongFlash = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  // Deal-in: staggered rise + fade at the start of every round.
  useEffect(() => {
    deal.setValue(0);
    Animated.timing(deal, { toValue: 1, duration: 360, delay: index * 28, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }).start();
  }, [dealKey]);

  // 3D flip.
  useEffect(() => {
    Animated.timing(flip, { toValue: faceUp ? 1 : 0, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [faceUp]);

  // Matched: pop + bright glow that settles to a soft halo.
  useEffect(() => {
    if (matched) {
      Animated.parallel([
        Animated.sequence([
          Animated.spring(pop, { toValue: 1.12, useNativeDriver: true, speed: 30, bounciness: 14 }),
          Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 8 }),
        ]),
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 180, useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0.4, duration: 650, delay: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
      ]).start();
    } else {
      glow.setValue(0);
      pop.setValue(1);
    }
  }, [matched]);

  // Mismatch: wait for the flip to land, then shake + red flash.
  useEffect(() => {
    if (!wrong) return;
    const anim = Animated.sequence([
      Animated.delay(240),
      Animated.parallel([
        Animated.sequence([
          Animated.timing(shake, { toValue: 1, duration: 45, useNativeDriver: true }),
          Animated.timing(shake, { toValue: -1, duration: 70, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 0.7, duration: 60, useNativeDriver: true }),
          Animated.timing(shake, { toValue: -0.4, duration: 55, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 0, duration: 45, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(wrongFlash, { toValue: 1, duration: 90, useNativeDriver: true }),
          Animated.timing(wrongFlash, { toValue: 0, duration: 260, delay: 60, useNativeDriver: true }),
        ]),
      ]),
    ]);
    anim.start();
    return () => anim.stop();
  }, [wrong]);

  const backRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const frontRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ['-180deg', '0deg'] });
  // Hard switch at 90deg as well as backfaceVisibility -- Android does not
  // always honour backfaceVisibility on rotated views.
  const backOpacity = flip.interpolate({ inputRange: [0, 0.5, 0.501, 1], outputRange: [1, 1, 0, 0] });
  const frontOpacity = flip.interpolate({ inputRange: [0, 0.5, 0.501, 1], outputRange: [0, 0, 1, 1] });
  const dealScale = deal.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const dealY = deal.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });
  const shakeX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] });

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => Animated.spring(press, { toValue: 0.93, useNativeDriver: true, speed: 40, bounciness: 0 }).start()}
      onPressOut={() => Animated.spring(press, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }).start()}
      style={{ width: size, height: size }}
    >
      <Animated.View style={{ flex: 1, opacity: deal, transform: [{ translateY: dealY }, { scale: dealScale }, { translateX: shakeX }, { scale: pop }, { scale: press }] }}>
        {/* Matched halo (sits outside the rotating faces). */}
        <Animated.View pointerEvents="none" style={[st.halo, { borderRadius: radius + 3, opacity: glow }]} />
        <Animated.View style={[st.face, { borderRadius: radius, opacity: backOpacity, transform: [{ perspective: PERSPECTIVE }, { rotateY: backRotate }] }]}>
          <CardBack size={size} radius={radius} />
        </Animated.View>
        <Animated.View style={[st.face, { borderRadius: radius, opacity: frontOpacity, transform: [{ perspective: PERSPECTIVE }, { rotateY: frontRotate }] }]}>
          <CardFront tokenKey={tokenKey} label={label} size={size} radius={radius} matched={matched} />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[st.wrong, { borderRadius: radius, opacity: wrongFlash }]} />
      </Animated.View>
    </Pressable>
  );
}

export const MemoryCard = memo(MemoryCardImpl);

const st = StyleSheet.create({
  face: { ...StyleSheet.absoluteFillObject, backfaceVisibility: 'hidden', overflow: 'hidden' },
  frontFill: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  shine: { position: 'absolute', top: 0, left: 0, right: 0, height: '48%' },
  backInset: { ...StyleSheet.absoluteFillObject, margin: 3, borderWidth: 1, borderColor: 'rgba(24,212,242,0.22)' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  emblem: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderWidth: 1.5,
    borderColor: 'rgba(251,191,36,0.55)',
    boxShadow: '0 0 10px 0 rgba(251,191,36,0.35)',
  },
  coin: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  label: {
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  check: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: MM.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderWidth: 2,
    borderColor: MM.green,
    boxShadow: '0 0 14px 2px rgba(74,222,128,0.75)',
  },
  wrong: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2.5,
    borderColor: MM.red,
    backgroundColor: 'rgba(248,113,113,0.18)',
  },
});

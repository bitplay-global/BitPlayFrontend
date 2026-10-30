import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const TIERS: { colors: [string, string]; word: string }[] = [
  { colors: ['#18D4F2', '#0e7490'], word: 'COMBO!' },
  { colors: ['#FBBF24', '#d97706'], word: 'HOT STREAK!' },
  { colors: ['#a855f7', '#7c3aed'], word: 'ON FIRE!' },
];

/** Floating "2x COMBO!" pop over the board for consecutive matches. */
export function ComboToast({ combo }: { combo: number }) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (combo < 2) return;
    v.setValue(0);
    const anim = Animated.sequence([
      Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 14 }),
      Animated.delay(520),
      Animated.timing(v, { toValue: 2, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [combo]);

  if (combo < 2) return null;
  const tier = TIERS[Math.min(TIERS.length - 1, combo - 2)];
  const scale = v.interpolate({ inputRange: [0, 1, 2], outputRange: [0.5, 1, 0.9] });
  const opacity = v.interpolate({ inputRange: [0, 0.3, 1, 2], outputRange: [0, 1, 1, 0] });
  const translateY = v.interpolate({ inputRange: [0, 1, 2], outputRange: [16, 0, -22] });

  return (
    <Animated.View pointerEvents="none" style={[s.wrap, { opacity, transform: [{ translateY }, { scale }] }]}>
      <LinearGradient colors={tier.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.pill}>
        <MaterialCommunityIcons name="fire" size={16} color="#fff" />
        <Text style={s.txt}>{combo}x {tier.word}</Text>
      </LinearGradient>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', top: '42%', left: 0, right: 0, alignItems: 'center', zIndex: 20, elevation: 20 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    boxShadow: '0 4px 18px 0 rgba(0,0,0,0.45)',
  },
  txt: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.8, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
});

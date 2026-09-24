import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

interface ScoreBoxProps {
  label: string;
  value: string | number;
  accent?: string[];
  animate?: boolean;
}

export function ScoreBox({ label, value, accent = ['#0ea5e9', '#6366f1'], animate = false }: ScoreBoxProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const prev = useRef(value);

  useEffect(() => {
    if (animate && value !== prev.current) {
      prev.current = value;
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.25, duration: 90, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 90, useNativeDriver: true }),
      ]).start();
    }
  }, [value]);

  return (
    <LinearGradient colors={accent} style={s.scoreBox} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <Text style={s.scoreLabel}>{label}</Text>
      <Animated.Text style={[s.scoreVal, { transform: [{ scale }] }]}>{value}</Animated.Text>
    </LinearGradient>
  );
}

interface StatusBadgeProps {
  text: string;
  color?: string;
  bg?: string;
}

export function StatusBadge({ text, color = '#f8fafc', bg = 'rgba(255,255,255,0.12)' }: StatusBadgeProps) {
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      <Text style={[s.badgeText, { color }]}>{text}</Text>
    </View>
  );
}

interface HUDRowProps { children: React.ReactNode }
export function HUDRow({ children }: HUDRowProps) {
  return <View style={s.hudRow}>{children}</View>;
}

const s = StyleSheet.create({
  scoreBox: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
    minWidth: 80,
  },
  scoreLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 1.2, textTransform: 'uppercase' },
  scoreVal: { fontSize: 26, fontWeight: '800', color: '#fff', marginTop: 2 },
  badge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 12,
  },
  badgeText: { fontSize: 15, fontWeight: '700' },
  hudRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 16, paddingHorizontal: 16 },
});

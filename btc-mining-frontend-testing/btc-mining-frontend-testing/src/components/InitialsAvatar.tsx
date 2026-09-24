import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

type Props = {
  /** User's display name — first letter is used. Falls back to "U" when empty. */
  name?: string | null;
  size?: number;
  style?: ViewStyle;
};

/** Circular avatar showing the user's first initial on a brand gradient — replaces photo upload. */
export default function InitialsAvatar({ name, size = 90, style }: Props) {
  const initial = (name?.trim()?.[0] ?? 'U').toUpperCase();

  return (
    <LinearGradient
      colors={['#22D3EE', '#A78BFA']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    >
      <Text style={[styles.letter, { fontSize: size * 0.42 }]}>{initial}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    color: '#fff',
    fontWeight: '700',
  },
});

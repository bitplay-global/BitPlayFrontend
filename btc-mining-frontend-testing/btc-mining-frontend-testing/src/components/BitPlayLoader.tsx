import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

type Size = 'sm' | 'md' | 'lg';

interface Props {
  size?: Size;
  label?: string;
  color?: string;
}

const SIZE_MAP = { sm: 20, md: 32, lg: 44 };

const BitPlayLoader: React.FC<Props> = ({
  size = 'md',
  label,
  color = '#22D3EE',
}) => {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, []);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const sz = SIZE_MAP[size];

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[
          styles.ring,
          {
            width: sz,
            height: sz,
            borderRadius: sz / 2,
            borderTopColor: color,
            transform: [{ rotate }],
          },
        ]}
      />
      {label ? <Text style={[styles.label, { color: '#94A3B8' }]}>{label}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  ring: {
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.12)',
    borderTopColor: '#22D3EE',
  },
  label: {
    marginTop: 12,
    fontSize: 13,
    letterSpacing: 0.4,
  },
});

export default BitPlayLoader;

import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const COUNT = 16;

/**
 * Gold BTC coins that burst out from the centre and fall away. One Animated
 * value drives every coin (native driver), replayed whenever `trigger` changes.
 */
export function CoinBurst({ trigger, radius = 130 }: { trigger: unknown; radius?: number }) {
  const t = useRef(new Animated.Value(0)).current;

  const coins = useMemo(() => Array.from({ length: COUNT }).map((_, i) => {
    const angle = (i / COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const dist = radius * (0.55 + Math.random() * 0.45);
    return {
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      size: 14 + Math.round(Math.random() * 8),
      spin: (Math.random() > 0.5 ? 1 : -1) * (180 + Math.round(Math.random() * 360)),
    };
  }), [radius, trigger]);

  useEffect(() => {
    t.setValue(0);
    const anim = Animated.timing(t, { toValue: 1, duration: 1300, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [trigger]);

  return (
    <View pointerEvents="none" style={s.layer}>
      {coins.map((c, i) => {
        const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [0, c.dx] });
        // Fly out, then drop a little as if under gravity.
        const translateY = t.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, c.dy * 0.9, c.dy + 36] });
        const opacity = t.interpolate({ inputRange: [0, 0.08, 0.65, 1], outputRange: [0, 1, 1, 0] });
        const scale = t.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.3, 1.1, 0.8] });
        const rotate = t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${c.spin}deg`] });
        return (
          <Animated.View
            key={i}
            style={[s.coin, {
              width: c.size, height: c.size, borderRadius: c.size / 2,
              marginLeft: -c.size / 2, marginTop: -c.size / 2,
              opacity, transform: [{ translateX }, { translateY }, { rotate }, { scale }],
            }]}
          >
            <MaterialCommunityIcons name="bitcoin" size={Math.round(c.size * 0.72)} color="#92400E" />
          </Animated.View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  coin: {
    position: 'absolute',
    left: '50%',
    top: '38%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FBBF24',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
  },
});

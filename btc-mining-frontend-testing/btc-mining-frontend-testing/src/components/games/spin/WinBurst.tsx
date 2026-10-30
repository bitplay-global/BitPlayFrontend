import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

type Props = {
  /** Diameter of the area the particles fly across. */
  size: number;
  /** Increment to fire a new burst (0 = never fired). */
  trigger: number;
};

const COUNT = 18;

type Particle = {
  angle: number;
  dist: number;
  spin: number;
  icon: string;
  color: string;
  iconSize: number;
  delay: number;
};

/** Deterministic pseudo-random so particles don't jump between renders. */
function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/**
 * Coin / sparkle burst played over the wheel on a win. One Animated.Value
 * drives every particle on the native driver.
 */
const WinBurst: React.FC<Props> = ({ size, trigger }) => {
  const progress = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;

  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: COUNT }, (_, i) => {
        const kind = i % 3;
        return {
          angle: (i / COUNT) * Math.PI * 2 + rand(i) * 0.35,
          dist: size * (0.32 + rand(i + 7) * 0.24),
          spin: (rand(i + 3) - 0.5) * 540,
          icon: kind === 0 ? 'bitcoin' : kind === 1 ? 'star-four-points' : 'circle',
          color: kind === 0 ? '#FBBF24' : kind === 1 ? '#FEF3C7' : i % 2 ? '#18D4F2' : '#A78BFA',
          iconSize: kind === 0 ? 22 : kind === 1 ? 16 : 8,
          delay: 0.01 + rand(i + 11) * 0.15,
        };
      }),
    [size],
  );

  useEffect(() => {
    if (!trigger) return;
    progress.setValue(0);
    flash.setValue(0);
    Animated.parallel([
      Animated.timing(progress, {
        toValue: 1,
        duration: 1300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(flash, { toValue: 1, duration: 140, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: 520, useNativeDriver: true }),
      ]),
    ]).start();
  }, [trigger, progress, flash]);

  if (!trigger) return null;

  const flashScale = flash.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.15] });

  return (
    <View pointerEvents="none" style={[styles.wrap, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.flash,
          {
            width: size * 0.7,
            height: size * 0.7,
            borderRadius: size * 0.35,
            opacity: flash,
            transform: [{ scale: flashScale }],
          },
        ]}
      />
      {particles.map((p, i) => {
        const start = p.delay;
        const tx = progress.interpolate({
          inputRange: [0, start, 1],
          outputRange: [0, 0, Math.cos(p.angle) * p.dist],
        });
        const ty = progress.interpolate({
          inputRange: [0, start, 1],
          // a little gravity: particles fall back slightly at the end
          outputRange: [0, 0, Math.sin(p.angle) * p.dist + size * 0.08],
        });
        const opacity = progress.interpolate({
          inputRange: [0, start, start + 0.05, 0.7, 1],
          outputRange: [0, 0, 1, 1, 0],
        });
        const scale = progress.interpolate({
          inputRange: [0, start, start + 0.15, 1],
          outputRange: [0.2, 0.2, 1.25, 0.8],
        });
        const rotate = progress.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${p.spin}deg`],
        });
        return (
          <Animated.View
            key={i}
            style={[styles.particle, { opacity, transform: [{ translateX: tx }, { translateY: ty }, { scale }, { rotate }] }]}>
            <Icon name={p.icon} size={p.iconSize} color={p.color} />
          </Animated.View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
    elevation: 40,
  },
  flash: {
    position: 'absolute',
    backgroundColor: 'rgba(253,230,138,0.35)',
    borderWidth: 2,
    borderColor: 'rgba(251,191,36,0.7)',
  },
  particle: {
    position: 'absolute',
  },
});

export default WinBurst;

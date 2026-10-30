import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient as SvgLinearGradient,
  Path,
  Polygon,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

/** Minimal slice shape the wheel needs (SpinAndWinScreen's SLICES satisfy it). */
export type SpinWheelSlice = {
  key: string;
  kind: 'gh' | 'try_again' | 'double';
  gh: number;
  line1: string;
  line2: string;
};

export type SpinWheelPhase = 'idle' | 'spinning' | 'won_pending' | 'lost';

/** Distinct palette per slice position: [light, dark, label accent]. */
const SLICE_PALETTE: Array<[string, string, string]> = [
  ['#8B5CF6', '#4C1D95', '#EDE9FE'], // purple
  ['#1E293B', '#0B1120', '#94A3B8'], // navy (try again)
  ['#22D3EE', '#0E7490', '#ECFEFF'], // cyan
  ['#273449', '#0F172A', '#94A3B8'], // slate (try again)
  ['#C026D3', '#701A75', '#FAE8FF'], // magenta
  ['#FCD34D', '#B45309', '#FFFBEB'], // gold (2x)
];

const BULB_COUNT = 18;

function polar(cx: number, cy: number, r: number, degCwFromTop: number) {
  const rad = (degCwFromTop * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function wedge(cx: number, cy: number, r: number, start: number, end: number) {
  const p0 = polar(cx, cy, r, start);
  const p1 = polar(cx, cy, r, end);
  let delta = end - start;
  if (delta < 0) delta += 360;
  const large = delta > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y} Z`;
}

type Props = {
  size: number;
  slices: SpinWheelSlice[];
  /** Rotation in degrees (driven by the screen; native driver). */
  spinAnim: Animated.Value;
  phase: SpinWheelPhase;
  winnerIndex: number | null;
  /** Centre hub (the SPIN button) rendered above the disk. */
  children?: React.ReactNode;
};

/**
 * Casino-style wheel: static gold rim with chasing bulbs, rotating disk,
 * pegs at slice borders and a pointer that ticks as each peg passes.
 * All motion runs on the native driver; no per-frame state.
 */
const SpinWheel: React.FC<Props> = ({ size, slices, spinAnim, phase, winnerIndex, children }) => {
  const n = slices.length;
  const seg = 360 / n;
  const c = size / 2;
  const rimW = Math.max(14, Math.round(size * 0.075));
  const diskR = c - rimW;
  const sliceR = diskR - 1;
  const bulbR = c - rimW / 2;
  const bulbSize = Math.max(3, rimW * 0.24);
  const settled = phase === 'won_pending' || phase === 'lost';

  // ── Bulb chase ────────────────────────────────────────────────────────────
  const chase = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    chase.stopAnimation();
    chase.setValue(0);
    const step =
      phase === 'spinning' ? 110 : phase === 'won_pending' ? 220 : phase === 'lost' ? 1400 : 900;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(chase, { toValue: 1, duration: step, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(chase, { toValue: 0, duration: step, easing: Easing.linear, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [phase, chase]);

  const dimLow = phase === 'lost' ? 0.15 : 0.22;
  const groupA = chase.interpolate({ inputRange: [0, 1], outputRange: [1, dimLow] });
  // On a win both groups blink together; otherwise they alternate (chase).
  const groupB =
    phase === 'won_pending'
      ? groupA
      : chase.interpolate({ inputRange: [0, 1], outputRange: [dimLow, 1] });

  // ── Pointer tick (peg passes the top when rotation % seg === seg / 2) ─────
  const pointerRotate = useMemo(() => {
    const mod = Animated.modulo(spinAnim, seg);
    return mod.interpolate({
      inputRange: [0, seg / 2 - 8, seg / 2, seg / 2 + 3, seg],
      outputRange: ['0deg', '0deg', '-24deg', '0deg', '0deg'],
      extrapolate: 'clamp',
    });
  }, [spinAnim, seg]);

  const rotate = useMemo(
    () =>
      spinAnim.interpolate({
        inputRange: [0, 2_000_000],
        outputRange: ['0deg', '2000000deg'],
        extrapolate: 'extend',
      }),
    [spinAnim],
  );

  // ── Winner glow ───────────────────────────────────────────────────────────
  const winGlow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (phase !== 'won_pending') {
      winGlow.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(winGlow, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(winGlow, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [phase, winGlow]);

  const bulbs = useMemo(
    () =>
      Array.from({ length: BULB_COUNT }, (_, i) => ({
        i,
        ...polar(c, c, bulbR, (i * 360) / BULB_COUNT + 360 / BULB_COUNT / 2),
      })),
    [c, bulbR],
  );

  const renderBulbs = (even: boolean) => (
    <Svg width={size} height={size}>
      {bulbs
        .filter(b => (b.i % 2 === 0) === even)
        .map(b => (
          <G key={b.i}>
            <Circle cx={b.x} cy={b.y} r={bulbSize * 2.1} fill="rgba(254,240,138,0.22)" />
            <Circle cx={b.x} cy={b.y} r={bulbSize} fill="#FEF9C3" />
          </G>
        ))}
    </Svg>
  );

  const pointerW = Math.round(size * 0.12);
  const pointerH = Math.round(pointerW * 1.35);

  return (
    <View style={{ width: size, height: size }}>
      {/* Static rim + bulb sockets */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id="rimGold" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FDE68A" />
            <Stop offset="0.35" stopColor="#F59E0B" />
            <Stop offset="0.55" stopColor="#FEF3C7" />
            <Stop offset="0.8" stopColor="#B45309" />
            <Stop offset="1" stopColor="#FBBF24" />
          </SvgLinearGradient>
        </Defs>
        <Circle cx={c} cy={c} r={c - 1} fill="#120A24" />
        <Circle cx={c} cy={c} r={c - rimW / 2} fill="none" stroke="url(#rimGold)" strokeWidth={rimW - 2} />
        <Circle cx={c} cy={c} r={c - 1.5} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
        <Circle cx={c} cy={c} r={diskR + 0.5} fill="none" stroke="#78350F" strokeWidth={2} />
        {bulbs.map(b => (
          <Circle key={b.i} cx={b.x} cy={b.y} r={bulbSize * 1.15} fill="#713F12" />
        ))}
      </Svg>

      {/* Chasing lights (two alternating groups) */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: groupA }]}>
        {renderBulbs(true)}
      </Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: groupB }]}>
        {renderBulbs(false)}
      </Animated.View>

      {/* Rotating disk */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}>
        <Svg width={size} height={size}>
          <Defs>
            {SLICE_PALETTE.map(([light, dark], i) => (
              <RadialGradient key={i} id={`slice${i}`} cx={c} cy={c} r={sliceR} fx={c} fy={c} gradientUnits="userSpaceOnUse">
                <Stop offset="0.25" stopColor={dark} />
                <Stop offset="1" stopColor={light} />
              </RadialGradient>
            ))}
            <RadialGradient id="diskShade" cx={c} cy={c} r={sliceR} gradientUnits="userSpaceOnUse">
              <Stop offset="0.6" stopColor="#000" stopOpacity="0" />
              <Stop offset="1" stopColor="#000" stopOpacity="0.35" />
            </RadialGradient>
          </Defs>
          {slices.map((slice, i) => {
            const start = i * seg - seg / 2;
            const end = i * seg + seg / 2;
            const palette = SLICE_PALETTE[i % SLICE_PALETTE.length];
            const isWinner = settled && winnerIndex === i;
            const dimmed = settled && winnerIndex !== null && winnerIndex !== i;
            const isTry = slice.kind === 'try_again';
            const isDouble = slice.kind === 'double';
            const labelR = sliceR * 0.64;
            const big = isTry ? 'TRY' : isDouble ? '2×' : slice.line1;
            const small = isTry ? 'AGAIN' : isDouble ? `${slice.gh} GH/s` : 'GH/s';
            const bigSize = isTry ? sliceR * 0.115 : sliceR * 0.2;
            const smallSize = isTry ? sliceR * 0.085 : sliceR * 0.075;
            const coinR = sliceR * 0.045;
            const bigBase = bigSize * 0.35;
            const smallBase = bigBase + smallSize + 3;
            return (
              <G key={slice.key}>
                <Path
                  d={wedge(c, c, sliceR, start, end)}
                  fill={`url(#slice${i % SLICE_PALETTE.length})`}
                  stroke="rgba(254,243,199,0.55)"
                  strokeWidth={1.5}
                />
                {dimmed ? <Path d={wedge(c, c, sliceR, start, end)} fill="rgba(2,6,23,0.55)" /> : null}
                {isWinner && phase === 'lost' ? (
                  <Path d={wedge(c, c, sliceR, start, end)} fill="none" stroke="#F87171" strokeWidth={3} />
                ) : null}
                <G transform={`translate(${c},${c}) rotate(${i * seg}) translate(0, ${-labelR})`}>
                  {!isTry ? (
                    <Circle cx={0} cy={-bigSize * 0.65 - coinR - 4} r={coinR} fill="#FBBF24" stroke="#FEF3C7" strokeWidth={1} />
                  ) : null}
                  <SvgText
                    x={0}
                    y={bigBase}
                    fill={isDouble ? '#451A03' : '#FFFFFF'}
                    fontSize={bigSize}
                    fontWeight="900"
                    textAnchor="middle"
                    stroke={isDouble ? 'none' : 'rgba(0,0,0,0.35)'}
                    strokeWidth={isDouble ? 0 : 0.6}>
                    {big}
                  </SvgText>
                  <SvgText
                    x={0}
                    y={smallBase}
                    fill={isDouble ? '#78350F' : palette[2]}
                    fontSize={smallSize}
                    fontWeight="800"
                    textAnchor="middle"
                    letterSpacing={0.5}>
                    {small}
                  </SvgText>
                </G>
              </G>
            );
          })}
          <Circle cx={c} cy={c} r={sliceR} fill="url(#diskShade)" />
          {/* Pegs on slice borders */}
          {slices.map((_, i) => {
            const p = polar(c, c, sliceR - 5, i * seg - seg / 2);
            return <Circle key={`peg${i}`} cx={p.x} cy={p.y} r={3.2} fill="#FEF3C7" stroke="#B45309" strokeWidth={1} />;
          })}
        </Svg>
      </Animated.View>

      {/* Winner glow ring (static, above the stopped wheel) */}
      {phase === 'won_pending' ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: winGlow }]}>
          <Svg width={size} height={size}>
            <Circle cx={c} cy={c} r={diskR - 2} fill="none" stroke="#FBBF24" strokeWidth={4} strokeOpacity={0.9} />
            <Circle cx={c} cy={c} r={c - 2} fill="none" stroke="#FDE68A" strokeWidth={3} strokeOpacity={0.6} />
          </Svg>
        </Animated.View>
      ) : null}

      {/* Hub */}
      <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.center]}>
        {children}
      </View>

      {/* Pointer (pivot at its top) */}
      <View pointerEvents="none" style={[styles.pointerWrap, { top: -pointerH * 0.28, width: pointerW, left: c - pointerW / 2 }]}>
        <Animated.View
          style={{
            width: pointerW,
            height: pointerH,
            transform: [
              { translateY: -pointerH / 2 + pointerW / 2 },
              { rotate: pointerRotate },
              { translateY: pointerH / 2 - pointerW / 2 },
            ],
          }}>
          <Svg width={pointerW} height={pointerH}>
            <Defs>
              <SvgLinearGradient id="ptr" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#FDE68A" />
                <Stop offset="0.5" stopColor="#F59E0B" />
                <Stop offset="1" stopColor="#B45309" />
              </SvgLinearGradient>
            </Defs>
            <Polygon
              points={`${pointerW * 0.1},${pointerW * 0.5} ${pointerW * 0.9},${pointerW * 0.5} ${pointerW / 2},${pointerH - 1}`}
              fill="url(#ptr)"
              stroke="#FEF3C7"
              strokeWidth={1.2}
            />
            <Circle cx={pointerW / 2} cy={pointerW / 2} r={pointerW / 2 - 1.5} fill="url(#ptr)" stroke="#FEF3C7" strokeWidth={1.5} />
            <Circle cx={pointerW / 2} cy={pointerW / 2} r={pointerW * 0.17} fill="#7C2D12" />
            <Circle cx={pointerW / 2 - pointerW * 0.05} cy={pointerW / 2 - pointerW * 0.05} r={pointerW * 0.06} fill="#FFF7ED" />
          </Svg>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  pointerWrap: { position: 'absolute', zIndex: 30, elevation: 30, alignItems: 'center' },
});

export default SpinWheel;

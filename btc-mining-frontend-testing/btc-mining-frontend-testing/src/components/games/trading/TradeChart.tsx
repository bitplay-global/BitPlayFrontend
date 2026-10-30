import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Line, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { LineChart } from 'react-native-wagmi-charts';
import BitPlayLoader from '../../BitPlayLoader';
import type { LinePoint } from '../../../hooks/useBinanceMarkets';
import { T } from './theme';

/** Width of the right-hand price axis. */
const AXIS_W = 66;
/** Keeps the live dot (last point) fully inside the plot instead of half-clipped. */
const DOT_INSET = 10;
const GUTTER = 12;
/** wagmi's LineChart subtracts this from `height` for its x-axis labels. */
const WAGMI_RESERVED_H = 40;
/** Never zoom in tighter than this (USD), so normal noise doesn't look like a crash. */
const MIN_SPAN = 24;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
function r2(n: number) {
  return Math.round(n * 100) / 100;
}
function niceStep(span: number) {
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
  for (const s of steps) if (span / s <= 5) return s;
  return 10000;
}
function axisLabel(p: number) {
  return p >= 1000 ? p.toFixed(0) : p.toFixed(2);
}

/** Soft, endlessly repeating ring around the live price point. */
const PulseRing = React.memo(function PulseRing({ color }: { color: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );
  }, [t]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - t.value),
    transform: [{ scale: 0.4 + t.value * 1.6 }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.pulse, { backgroundColor: color }, style]}
    />
  );
});

type Props = {
  points: LinePoint[];
  width: number;
  height: number;
  /** Right edge of the visible time window (updated on a slow clock, not per tick). */
  nowMs: number;
  windowMs: number;
  /** Latest price, used as the live marker and as a fallback series. */
  lastPrice: number;
  entryPrice: number | null;
  exitPrice: number | null;
  /** Line / fill colour (cyan idle, green/red while a trade is winning/losing). */
  color: string;
};

export const GameLineChart = React.memo(function GameLineChart({
  points,
  width,
  height,
  nowMs,
  windowMs,
  lastPrice,
  entryPrice,
  exitPrice,
  color,
}: Props) {
  const plotW = width - AXIS_W;
  const lineW = plotW - DOT_INSET;

  const chartData = useMemo<LinePoint[]>(() => {
    const tLeft = nowMs - windowMs;
    // No upper bound: `nowMs` ticks slowly, ticks newer than it must still show.
    let data = points.filter((p) => p.timestamp >= tLeft);
    // Device clock skewed against Binance's timestamps (or the REST history
    // is older than the window): show the latest points rather than a loader
    // that never goes away.
    if (data.length < 2 && points.length >= 2) data = points.slice(-120);
    data.sort((a, b) => a.timestamp - b.timestamp);
    if (data.length === 0 && lastPrice > 0) {
      data = [{ timestamp: nowMs - 1000, value: lastPrice }];
    }
    if (data.length === 1) {
      data = [{ timestamp: data[0].timestamp - 1, value: data[0].value }, data[0]];
    }
    return data;
  }, [points, nowMs, windowMs, lastPrice]);

  const domain = useMemo<[number, number]>(() => {
    if (!chartData.length) return [0, 1];
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of chartData) {
      if (p.value < lo) lo = p.value;
      if (p.value > hi) hi = p.value;
    }
    if (lastPrice > 0) {
      lo = Math.min(lo, lastPrice);
      hi = Math.max(hi, lastPrice);
    }
    if (entryPrice != null) {
      lo = Math.min(lo, entryPrice);
      hi = Math.max(hi, entryPrice);
    }
    const mid = (lo + hi) / 2;
    const span = Math.max(MIN_SPAN, (hi - lo) * 1.25);
    // Snap to $5 so the axis doesn't jitter on every tick.
    return [Math.floor((mid - span / 2) / 5) * 5, Math.ceil((mid + span / 2) / 5) * 5];
  }, [chartData, lastPrice, entryPrice]);

  const [yMin, yMax] = domain;

  const valueToY = (v: number) => {
    const norm = (v - yMin) / (yMax - yMin || 1);
    return GUTTER + (1 - norm) * (height - 2 * GUTTER);
  };

  const ticks = useMemo(() => {
    const step = niceStep(yMax - yMin);
    const out: number[] = [];
    for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) out.push(v);
    return out;
  }, [yMin, yMax]);

  if (!chartData.length) {
    return (
      <View style={[styles.frame, styles.loading, { width, height }]}>
        <BitPlayLoader size="lg" label="Loading live price…" color={T.cyan} />
      </View>
    );
  }

  const lastIdx = chartData.length - 1;
  const liveValue = lastPrice > 0 ? lastPrice : chartData[lastIdx].value;
  const liveY = clamp(r2(valueToY(chartData[lastIdx].value)), 0, height);
  const badgeY = clamp(r2(valueToY(liveValue)) - 10, 2, height - 22);

  const renderMarker = (price: number, c: string, fill: string, tag: string) => {
    const y = r2(valueToY(price));
    const by = clamp(y - 9, 2, height - 20);
    return (
      <>
        <Line x1={0} y1={y} x2={plotW} y2={y} stroke={c} strokeWidth={1.2} strokeDasharray="5 4" />
        <Rect x={6} y={clamp(y - 17, 0, height - 14)} width={40} height={13} rx={3} fill={fill} />
        <SvgText x={26} y={clamp(y - 17, 0, height - 14) + 9.5} fill={c} fontSize={8} fontWeight="800" textAnchor="middle">
          {tag}
        </SvgText>
        <Rect x={plotW + 2} y={by} width={AXIS_W - 4} height={18} rx={4} fill={fill} />
        <SvgText x={plotW + AXIS_W / 2} y={by + 12.5} fill={c} fontSize={9.5} fontWeight="800" textAnchor="middle">
          {axisLabel(price)}
        </SvgText>
      </>
    );
  };

  return (
    <View style={[styles.frame, { width, height }]}>
      {/* Grid behind the line */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        {ticks.map((tick) => {
          const y = r2(valueToY(tick));
          if (y < 4 || y > height - 4) return null;
          return (
            <Line
              key={`g${tick}`}
              x1={0}
              y1={y}
              x2={plotW}
              y2={y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
              strokeDasharray="2 4"
            />
          );
        })}
        <Line x1={plotW} y1={0} x2={plotW} y2={height} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
      </Svg>

      <View style={{ width: lineW, height, overflow: 'hidden' }}>
        <LineChart.Provider data={chartData} yRange={{ min: yMin, max: yMax }}>
          <LineChart width={lineW} height={height + WAGMI_RESERVED_H} yGutter={GUTTER}>
            <LineChart.Path color={color} width={2}>
              <LineChart.Gradient color={color}>
                <Stop offset="0%" stopColor={color} stopOpacity={0.32} />
                <Stop offset="55%" stopColor={color} stopOpacity={0.08} />
                <Stop offset="100%" stopColor={color} stopOpacity={0} />
              </LineChart.Gradient>
              <LineChart.Dot at={lastIdx} color={color} size={3.5} />
            </LineChart.Path>
          </LineChart>
        </LineChart.Provider>
      </View>

      {/* Live point pulse */}
      <View
        pointerEvents="none"
        style={[styles.pulseAnchor, { left: lineW - 12, top: liveY - 12 }]}
      >
        <PulseRing color={color} />
      </View>

      {/* Axis labels and markers on top */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        {ticks.map((tick) => {
          const y = r2(valueToY(tick));
          if (y < 8 || y > height - 8) return null;
          if (Math.abs(y - (badgeY + 10)) < 14) return null; // hidden under the live badge
          return (
            <SvgText
              key={`l${tick}`}
              x={plotW + AXIS_W / 2}
              y={y + 3.5}
              fill="rgba(255,255,255,0.38)"
              fontSize={9}
              fontWeight="600"
              textAnchor="middle"
            >
              {axisLabel(tick)}
            </SvgText>
          );
        })}

        {/* Live price guide + badge */}
        <Line
          x1={lineW}
          y1={r2(valueToY(liveValue))}
          x2={plotW}
          y2={r2(valueToY(liveValue))}
          stroke={color}
          strokeWidth={1}
          strokeDasharray="2 3"
        />

        {entryPrice != null && renderMarker(entryPrice, T.gold, 'rgba(251,191,36,0.18)', 'ENTRY')}
        {exitPrice != null && renderMarker(exitPrice, T.cyan, 'rgba(24,212,242,0.18)', 'EXIT')}

        <Rect x={plotW + 2} y={badgeY} width={AXIS_W - 4} height={20} rx={5} fill={color} />
        <SvgText
          x={plotW + AXIS_W / 2}
          y={badgeY + 13.5}
          fill="#0B0F17"
          fontSize={10}
          fontWeight="900"
          textAnchor="middle"
        >
          {liveValue >= 1000 ? liveValue.toFixed(1) : liveValue.toFixed(2)}
        </SvgText>
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  loading: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseAnchor: {
    position: 'absolute',
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
});

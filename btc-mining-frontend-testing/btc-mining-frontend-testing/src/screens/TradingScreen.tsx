import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import BitPlayLoader from '../components/BitPlayLoader';
import { BANNER_ADS_ENABLED } from '../config/adPlacements';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Image,
  Linking,
  StatusBar,
  ScrollView,
  Platform,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { useHashPower } from '../stores/HashPowerStore';
import { get_data_uri } from '../config/api';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Icon5 from 'react-native-vector-icons/FontAwesome5';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Line, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { LineChart } from 'react-native-wagmi-charts';

import { useRewardedVideoAd } from '../services/googleAds';
import { DEFAULT_ADMOB_BANNER_ID } from '../services/adUnitDefaults';
import { BannerAdWithGamFallback } from '../components/ads/BannerAdWithGamFallback';
import { BannerAdSize } from 'react-native-google-mobile-ads';
import { useAdConfig } from '../providers/AdConfigProvider';
import { useBinanceMarkets, LinePoint } from '../hooks/useBinanceMarkets';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const IS_SMALL_DEVICE = SCREEN_W < 380;
const PAD = IS_SMALL_DEVICE ? 12 : 16;

const UP_COLOR = '#39FF9D';
const DOWN_COLOR = '#FF4D8D';
const GOLD = '#FFD93D';
const CYAN = '#2EE8FF';
export const WIN_GH_REWARD = 5;
const CHART_VIEW_WINDOW_MS = 2 * 60 * 1000;
const CHART_LINE_COLOR = '#FFFFFF';
const PRICE_LABEL_W = 70;

function clampNum(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function roundCoord(n: number) {
  return Math.round(n * 100) / 100;
}

type Direction = 'up' | 'down';

type ActiveTrade = {
  entryPrice: number;
  direction: Direction;
  startTime: number;
  endTime: number;
  durationLabel: string;
};

type RewardHistoryItem = {
  id: string;
  earnedAt: number;
  points: number;
  miningGh: number;
  entryPrice: number;
  exitPrice: number;
  direction: Direction;
  durationLabel: string;
  won: boolean;
  claimed?: boolean;
};

function formatUsd(n: number) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString();
}

function formatCountdown(ms: number) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const hrs = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const mins = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const secs = String(totalSec % 60).padStart(2, '0');
  return { hrs, mins, secs };
}

function generatePriceTicks(lo: number, hi: number, _maxTicks: number): number[] {
  const range = hi - lo;
  if (range <= 0 || !Number.isFinite(range)) return [];
  const step = 2;
  const ticks: number[] = [];
  const start = Math.ceil(lo / step) * step;
  for (let v = start; v <= hi; v += step) {
    ticks.push(v);
  }
  return ticks;
}

function formatPriceLabel(price: number): string {
  if (price >= 1000) return price.toFixed(2);
  if (price >= 1) return price.toFixed(3);
  return price.toFixed(5);
}

const WAGMI_GUTTER = 8;
const WAGMI_RESERVED_H = 40;

const GameLineChart = React.memo(function GameLineChart({
  points,
  width: totalWidth,
  height,
  domain,
  nowMs,
  windowMs,
  entryPrice,
  exitPrice,
  lastPrice: chartLastPrice,
}: {
  points: LinePoint[];
  width: number;
  height: number;
  domain: [number, number];
  nowMs: number;
  windowMs: number;
  entryPrice: number | null;
  exitPrice: number | null;
  lastPrice?: number;
}) {
  const chartW = totalWidth - PRICE_LABEL_W;
  const [yMin, yMax] = domain;
  const priceTicks = useMemo(() => generatePriceTicks(yMin, yMax, 14), [yMin, yMax]);
  const verticalLineCount = 8;

  const chartData = useMemo(() => {
    const tLeft = nowMs - windowMs;
    return points
      .filter((p) => p.timestamp >= tLeft && p.timestamp <= nowMs)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [points, nowMs, windowMs]);

  const valueToY = useCallback(
    (value: number) => {
      const drawH = height;
      const norm = (value - yMin) / (yMax - yMin || 1);
      return WAGMI_GUTTER + (1 - norm) * (drawH - 2 * WAGMI_GUTTER);
    },
    [height, yMin, yMax]
  );

  if (!chartData.length) {
    return (
      <View style={[styles.chartFrame, styles.chartLoadingBox, { width: totalWidth, height }]}>
        <BitPlayLoader size="lg" label="Loading chart data…" color={CYAN} />
      </View>
    );
  }

  const lastIdx = chartData.length - 1;

  return (
    <View style={[styles.chartFrame, { width: totalWidth, height }]}>
      {/* Wagmi chart */}
      <View style={{ width: chartW, height, overflow: 'hidden' }}>
        <LineChart.Provider data={chartData} yRange={{ min: yMin, max: yMax }}>
          <LineChart
            width={chartW}
            height={height + WAGMI_RESERVED_H}
            yGutter={WAGMI_GUTTER}
          >
            <LineChart.Path color={CHART_LINE_COLOR} width={1.8}>
              <LineChart.Gradient color={CHART_LINE_COLOR}>
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.18} />
                <Stop offset="40%" stopColor="#FFFFFF" stopOpacity={0.08} />
                <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
              </LineChart.Gradient>
              <LineChart.Dot
                at={lastIdx}
                color={CYAN}
                size={4}
                hasOuterDot
                outerDotProps={{ fill: CYAN, opacity: 0.2 }}
                outerSize={12}
              />
            </LineChart.Path>
          </LineChart>
        </LineChart.Provider>
      </View>

      {/* SVG overlay for grid, labels, entry/exit lines */}
      <Svg
        width={totalWidth}
        height={height}
        style={{ position: 'absolute', left: 0, top: 0 }}
        pointerEvents="none"
      >
        {/* Horizontal grid lines */}
        {priceTicks.map((tick, i) => {
          const y = roundCoord(valueToY(tick));
          if (y < 2 || y > height - 2) return null;
          return (
            <Line
              key={`hg-${i}`}
              x1={0}
              y1={y}
              x2={chartW}
              y2={y}
              stroke="rgba(255,255,255,0.10)"
              strokeWidth={0.5}
            />
          );
        })}

        {/* Vertical grid lines */}
        {Array.from({ length: verticalLineCount }).map((_, i) => {
          const x = roundCoord(((i + 1) / (verticalLineCount + 1)) * chartW);
          return (
            <Line
              key={`vg-${i}`}
              x1={x}
              y1={0}
              x2={x}
              y2={height}
              stroke="rgba(255,255,255,0.10)"
              strokeWidth={0.5}
            />
          );
        })}

        {/* Price label separator */}
        <Line
          x1={chartW}
          y1={0}
          x2={chartW}
          y2={height}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={0.5}
        />

        {/* Entry price line */}
        {entryPrice != null && (() => {
          const y = roundCoord(valueToY(entryPrice));
          return (
            <>
              <Line
                x1={0} y1={y} x2={chartW} y2={y}
                stroke={GOLD} strokeWidth={1} strokeDasharray="6 4"
              />
              <Rect
                x={chartW + 2}
                y={clampNum(y - 9, 2, height - 20)}
                width={PRICE_LABEL_W - 4}
                height={18}
                rx={3} ry={3}
                fill="rgba(255,217,61,0.25)"
              />
              <SvgText
                x={chartW + 6}
                y={clampNum(y - 9, 2, height - 20) + 13}
                fill={GOLD} fontSize={9} fontWeight="700"
              >
                {formatPriceLabel(entryPrice)}
              </SvgText>
            </>
          );
        })()}

        {/* Exit price line */}
        {exitPrice != null && (() => {
          const y = roundCoord(valueToY(exitPrice));
          return (
            <>
              <Line
                x1={0} y1={y} x2={chartW} y2={y}
                stroke={CYAN} strokeWidth={1} strokeDasharray="4 4" opacity={0.85}
              />
              <Rect
                x={chartW + 2}
                y={clampNum(y - 9, 2, height - 20)}
                width={PRICE_LABEL_W - 4}
                height={18}
                rx={3} ry={3}
                fill="rgba(46,232,255,0.25)"
              />
              <SvgText
                x={chartW + 6}
                y={clampNum(y - 9, 2, height - 20) + 13}
                fill={CYAN} fontSize={9} fontWeight="700"
              >
                {formatPriceLabel(exitPrice)}
              </SvgText>
            </>
          );
        })()}

        {/* Right-side price labels */}
        {priceTicks.map((tick, i) => {
          const y = roundCoord(valueToY(tick));
          if (y < 8 || y > height - 8) return null;
          return (
            <SvgText
              key={`pl-${i}`}
              x={chartW + 6}
              y={y + 4}
              fill="rgba(255,255,255,0.5)"
              fontSize={9}
              fontWeight="500"
            >
              {formatPriceLabel(tick)}
            </SvgText>
          );
        })}

        {/* Live price badge */}
        {chartLastPrice != null && chartLastPrice > 0 && (() => {
          const y = roundCoord(valueToY(chartLastPrice));
          if (y < 0 || y > height) return null;
          return (
            <>
              <Line
                x1={chartW - 6} y1={y} x2={chartW} y2={y}
                stroke={CYAN} strokeWidth={2}
              />
              <Rect
                x={chartW + 1}
                y={clampNum(y - 10, 2, height - 22)}
                width={PRICE_LABEL_W - 3}
                height={20}
                rx={4} ry={4}
                fill="rgba(46,232,255,0.2)"
                stroke={CYAN}
                strokeWidth={1}
              />
              <SvgText
                x={chartW + 5}
                y={clampNum(y - 10, 2, height - 22) + 14}
                fill={CYAN} fontSize={10} fontWeight="800"
              >
                {formatPriceLabel(chartLastPrice)}
              </SvgText>
            </>
          );
        })()}
      </Svg>
    </View>
  );
});

export default function TradingScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { ads } = useAdConfig();
  const { user } = useAuth();
  const { linePoints, lastPrice, lastPriceRef, connected, lineDomain } =
    useBinanceMarkets();

  const { isMiningActive: storeMiningActive } = useHashPower();
  const [isMiningActive, setIsMiningActive] = useState<boolean | null>(storeMiningActive);

  // Keep in sync if user starts/stops mining while this screen is open
  useEffect(() => {
    setIsMiningActive(storeMiningActive);
  }, [storeMiningActive]);

  useFocusEffect(
    useCallback(() => {
      // Apply local state immediately so overlay shows without waiting for API
      setIsMiningActive(storeMiningActive);
      if (!user?.id) return;
      fetch(`${get_data_uri('USERMININGDETAILS')}/${user.id}`)
        .then(r => r.json())
        .catch(() => null)
        .then(data => {
          if (data?.mining_details != null) {
            setIsMiningActive(!!data.mining_details.mining_isactive);
          }
        });
    }, [user?.id]),
  );

  const [activeTrade, setActiveTrade] = useState<ActiveTrade | null>(null);
  const [lineMarkers, setLineMarkers] = useState<{
    entry: number;
    exit: number;
  } | null>(null);
  const [floatingPnl, setFloatingPnl] = useState<number | null>(null);
  const [winModal, setWinModal] = useState<{
    miningGh: number;
    exitPrice: number;
    entryPrice: number;
    direction: Direction;
  } | null>(null);
  const [loseModal, setLoseModal] = useState<{
    exitPrice: number;
    entryPrice: number;
    direction: Direction;
  } | null>(null);
  const [bannerError, setBannerError] = useState(false);

  // A single failed request shouldn't permanently switch to the house ad —
  // retry AdMob periodically so we recover once it starts filling again.
  useEffect(() => {
    if (!bannerError) return;
    const timer = setTimeout(() => setBannerError(false), 60000);
    return () => clearTimeout(timer);
  }, [bannerError]);
  const [rewardHistory, setRewardHistory] = useState<RewardHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [, bumpRender] = useState(0);
  const [displayPrice, setDisplayPrice] = useState(0);

  const [stockGameBonus, setStockGameBonus] = useState(0);

  const endTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTradeRef = useRef<ActiveTrade | null>(null);
  const pendingRewardAdShowRef = useRef(false);
  const pendingClaimIdRef = useRef<string | null>(null);
  const pendingLoseAdWatchRef = useRef(false);
  const loseAdCompletedRef = useRef(false);
  const pendingSavePromiseRef = useRef<Promise<void>>(Promise.resolve());

  const chartW = SCREEN_W - PAD * 2;
  const chartH = IS_SMALL_DEVICE
    ? Math.min(SCREEN_H * 0.35, 280)
    : Math.min(SCREEN_H * 0.40, 360);

  const entryPrice = activeTrade?.entryPrice ?? lineMarkers?.entry ?? null;
  const exitPrice = lineMarkers?.exit ?? null;

  const priceReady = displayPrice > 0;

  const [, setChartClock] = useState(0);
  const chartNowMs = Date.now();

  const tRChart = chartNowMs;
  const tLChart = tRChart - CHART_VIEW_WINDOW_MS;
  const windowVals = linePoints
    .filter((p) => p.timestamp >= tLChart && p.timestamp <= tRChart)
    .map((p) => p.value);
  const chartPriceDomain: [number, number] = (() => {
    const curPrice = lastPrice ?? displayPrice ?? (windowVals.length ? windowVals[windowVals.length - 1] : null);
    if (curPrice == null || !Number.isFinite(curPrice)) return lineDomain;
    const half = 20;
    return [curPrice - half, curPrice + half];
  })();

  const sessionOpen = useMemo(() => {
    if (linePoints.length === 0) return displayPrice || lastPrice;
    return linePoints[0].value;
  }, [linePoints, displayPrice, lastPrice]);

  const vsSession =
    priceReady && Number.isFinite(sessionOpen)
      ? displayPrice - sessionOpen
      : 0;

  const loadTradingData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`${get_data_uri('TRADING_HISTORY')}/${user.id}`);
      const data = await res.json();
      if (data.success) {
        setStockGameBonus(data.stockGameBonus || 0);
        const mapped: RewardHistoryItem[] = (data.history || []).map((t: any) => ({
          id: t.tradeId,
          earnedAt: t.earnedAt,
          points: t.points || 0,
          miningGh: t.miningGh || 0,
          entryPrice: t.entryPrice,
          exitPrice: t.exitPrice,
          direction: t.direction,
          durationLabel: t.durationLabel || '1 Min',
          won: t.won,
          claimed: t.claimed || false,
        }));
        setRewardHistory(mapped);
      }
    } catch (e) {
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadTradingData();
    }, [loadTradingData])
  );

  const clearTimers = useCallback(() => {
    if (endTimeoutRef.current) {
      clearTimeout(endTimeoutRef.current);
      endTimeoutRef.current = null;
    }
  }, []);

  const appendRewardHistory = useCallback(
    async (item: RewardHistoryItem) => {
      setRewardHistory((prev) => [item, ...prev].slice(0, 25));
      if (user?.id) {
        try {
          await fetch(get_data_uri('TRADING_HISTORY'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: user.id,
              trade: {
                tradeId: item.id,
                earnedAt: item.earnedAt,
                points: item.points,
                miningGh: item.miningGh,
                entryPrice: item.entryPrice,
                exitPrice: item.exitPrice,
                direction: item.direction,
                durationLabel: item.durationLabel,
                won: item.won,
                claimed: item.claimed || false,
              },
            }),
          });
        } catch (e) {
        }
      }
    },
    [user?.id]
  );

  const finalizeTrade = useCallback((trade: ActiveTrade, exit: number) => {
    const { entryPrice: e, direction } = trade;
    const win =
      direction === 'up' ? exit > e : direction === 'down' ? exit < e : false;

    const historyId = `${trade.startTime}-${Date.now()}`;
    const historyItem: RewardHistoryItem = {
      id: historyId,
      earnedAt: Date.now(),
      points: win ? Math.abs(exit - e) : 0,
      miningGh: win ? WIN_GH_REWARD : 0,
      entryPrice: e,
      exitPrice: exit,
      direction,
      durationLabel: trade.durationLabel,
      won: win,
      claimed: false,
    };

    const savePromise = appendRewardHistory(historyItem);
    pendingSavePromiseRef.current = savePromise;

    if (win) {
      setWinModal({ miningGh: WIN_GH_REWARD, exitPrice: exit, entryPrice: e, direction });
      pendingClaimIdRef.current = historyId;
    } else {
      setLoseModal({ exitPrice: exit, entryPrice: e, direction });
    }
    setActiveTrade(null);
    setLineMarkers(null);
    setFloatingPnl(null);
  }, [appendRewardHistory]);

  const claimTradeReward = useCallback(
    async (tradeId: string) => {
      setRewardHistory((prev) =>
        prev.map((h) => (h.id === tradeId ? { ...h, claimed: true } : h))
      );
      setStockGameBonus((prev) => prev + WIN_GH_REWARD);
      if (user?.id) {
        try {
          await pendingSavePromiseRef.current;
          const attemptClaim = async (retries = 2): Promise<void> => {
            const res = await fetch(get_data_uri('TRADING_CLAIM'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_id: user.id, tradeId }),
            });
            const data = await res.json();
            if (data.success) {
              setStockGameBonus(data.stockGameBonus);
            } else if (retries > 0) {
              await new Promise((r) => setTimeout(r, 1000));
              return attemptClaim(retries - 1);
            }
          };
          await attemptClaim();
        } catch (e) {
        }
      }
    },
    [user?.id]
  );

  const onRewardEarned = useCallback((_amount: number, _type: string) => {
    pendingRewardAdShowRef.current = false;
    
    if (pendingLoseAdWatchRef.current) {
      loseAdCompletedRef.current = true;
      return;
    }

    const claimId = pendingClaimIdRef.current;
    if (claimId) {
      claimTradeReward(claimId);
      pendingClaimIdRef.current = null;
    }
  }, [claimTradeReward]);

  const onAdClosed = useCallback(() => {
    setWinModal(null);
    if (pendingLoseAdWatchRef.current) {
      pendingLoseAdWatchRef.current = false;
      if (loseAdCompletedRef.current) {
        loseAdCompletedRef.current = false;
        setLoseModal(null);
      } else {
        Alert.alert("Ad not completed", "Please watch the full video to try again.");
      }
    }
  }, []);

  const { show: showRewardAd, loaded: rewardLoaded, loading: rewardAdLoading } =
    useRewardedVideoAd(
      onRewardEarned,
      { primaryUnitId: ads.rewardedVideoId },
      onAdClosed,
    );

  useFocusEffect(
    useCallback(() => {
      const id = setInterval(() => {
        const p = lastPriceRef.current;
        if (Number.isFinite(p) && p > 0) setDisplayPrice(p);
      }, 72);
      return () => clearInterval(id);
    }, [lastPriceRef])
  );

  useFocusEffect(
    useCallback(() => {
      const id = setInterval(() => setChartClock((c) => c + 1), 500);
      return () => clearInterval(id);
    }, [])
  );

  useEffect(() => {
    if (lastPrice > 0) setDisplayPrice(lastPrice);
  }, [lastPrice]);

  useEffect(() => {
    setHistoryLoading(true);
    loadTradingData().finally(() => setHistoryLoading(false));
  }, [loadTradingData]);

  useEffect(() => {
    if (!rewardLoaded || !pendingRewardAdShowRef.current) return;
    pendingRewardAdShowRef.current = false;
    showRewardAd();
  }, [rewardLoaded, showRewardAd]);

  const startTrade = useCallback(
    (direction: Direction) => {
      if (isMiningActive === false) {
        Alert.alert(
          'Mining Not Active',
          'You need to start mining before you can play BTC Trading. Go back to the home screen and activate mining first.',
          [{ text: 'OK' }],
        );
        return;
      }
      if (activeTradeRef.current) return;
      const entry = lastPriceRef.current || displayPrice || lastPrice;
      if (!entry || entry <= 0) return;
      const now = Date.now();
      const ms = 60_000;
      const end = now + ms;
      setLineMarkers(null);
      const trade: ActiveTrade = {
        entryPrice: entry,
        direction,
        startTime: now,
        endTime: end,
        durationLabel: '1 Min',
      };
      activeTradeRef.current = trade;
      setActiveTrade(trade);
      endTimeoutRef.current = setTimeout(() => {
        const exit = lastPriceRef.current ?? lastPrice;
        clearTimers();
        const t = activeTradeRef.current;
        activeTradeRef.current = null;
        if (t) finalizeTrade(t, exit);
        else setActiveTrade(null);
      }, ms);
    },
    [
      finalizeTrade,
      lastPrice,
      displayPrice,
      clearTimers,
      lastPriceRef,
    ]
  );

  useEffect(() => {
    if (!activeTrade) return;
    const id = setInterval(() => {
      bumpRender((t) => t + 1);
      const cur = lastPriceRef.current;
      const tr = activeTradeRef.current;
      if (!cur || !tr) return;
      const { entryPrice: e, direction } = tr;
      setFloatingPnl(direction === 'up' ? cur - e : e - cur);
    }, 400);
    return () => clearInterval(id);
  }, [activeTrade, lastPriceRef]);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const tradeActive = activeTrade != null;
  const disabled = tradeActive;

  const countdownMs = !activeTrade
    ? 0
    : Math.max(0, activeTrade.endTime - Date.now());
  const countdown = formatCountdown(countdownMs);

  const isCurrentlyCorrect = useMemo(() => {
    if (!activeTrade || !displayPrice) return false;
    if (activeTrade.direction === 'up') return displayPrice > activeTrade.entryPrice;
    return displayPrice < activeTrade.entryPrice;
  }, [activeTrade, displayPrice]);

  const handleClaim = useCallback(() => {
    if (rewardLoaded) {
      pendingRewardAdShowRef.current = false;
      showRewardAd();
      return;
    }
    pendingRewardAdShowRef.current = true;
    showRewardAd();
  }, [rewardLoaded, showRewardAd]);

  const handleClaimFromHistory = useCallback(
    (itemId: string) => {
      pendingClaimIdRef.current = itemId;
      if (rewardLoaded) {
        showRewardAd();
      } else {
        pendingRewardAdShowRef.current = true;
        showRewardAd();
      }
    },
    [rewardLoaded, showRewardAd]
  );

  const closeRewardModal = useCallback(() => {
    pendingRewardAdShowRef.current = false;
    pendingClaimIdRef.current = null;
    setWinModal(null);
  }, []);

  const closeLoseModal = useCallback(() => {
    if (rewardLoaded) {
      pendingLoseAdWatchRef.current = true;
      showRewardAd();
    } else {
      // If ad not loaded, we can't really force it, but we can show an alert or just wait.
      // But per "mandatory" request, we'll try to show it if possible.
      Alert.alert("Ad Loading", "Please wait a moment for the video to load.");
    }
  }, [rewardLoaded, showRewardAd]);

  const up = priceReady && vsSession >= 0;

  return (
    <View style={styles.flex1}>
      <StatusBar barStyle="light-content" />
      <View style={styles.flex1}>
        {isMiningActive === false && (
          <View style={styles.miningLockOverlay} pointerEvents="box-none">
            <View style={styles.miningLockCard}>
              <Icon name="pickaxe" size={36} color="#FBBF24" />
              <Text style={styles.miningLockTitle}>Mining Not Active</Text>
              <Text style={styles.miningLockBody}>
                Start mining on the home screen to unlock BTC Trading.
              </Text>
              <TouchableOpacity style={styles.miningLockBtn} onPress={() => navigation.goBack()}>
                <Text style={styles.miningLockBtnText}>Start Mining</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: Platform.OS === 'ios' ? insets.top : insets.top + 8 }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={14}
          >
            <Icon name="arrow-left" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>BTC Trading</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Top banner ad — same placement as GameZoneScreen: directly below
            the header and outside the ScrollView, so it renders reliably and
            never scrolls away. */}
        {BANNER_ADS_ENABLED && (
          <View style={styles.bannerTop}>
            <BannerAdWithGamFallback
              primaryUnitId={ads.homeBannerId ?? DEFAULT_ADMOB_BANNER_ID}
              size={BannerAdSize.ADAPTIVE_BANNER}
            />
          </View>
        )}

        {!tradeActive ? (
          /* ─── IDLE STATE: Main question screen ─── */
          <ScrollView
            style={styles.flex1}
            contentContainerStyle={styles.idleContent}
            showsVerticalScrollIndicator={false}
            bounces={Platform.OS === 'ios'}
          >
            <Text style={styles.questionText}>
              Will Bitcoin price go up or down{'\n'}in next one Minute?
            </Text>

            <View style={styles.priceRow}>
              <Icon5 name="bitcoin" size={32} color="#F7931A" />
              <Text style={styles.priceText}>
                {priceReady ? `$${formatUsd(displayPrice)}` : 'Loading...'}
              </Text>
            </View>


            {/* Chart section */}
            <View style={styles.chartSection}>
              <GameLineChart
                points={linePoints}
                width={chartW}
                height={chartH}
                domain={chartPriceDomain}
                nowMs={chartNowMs}
                windowMs={CHART_VIEW_WINDOW_MS}
                entryPrice={entryPrice}
                exitPrice={exitPrice}
                lastPrice={displayPrice}
              />
            </View>

            {/* UP/DOWN buttons */}
            <View style={styles.directionBtnRow}>
              <TouchableOpacity
                style={styles.downButton}
                onPress={() => startTrade('down')}
                disabled={disabled || !priceReady}
                activeOpacity={0.85}
              >
                <Icon name="menu-down" size={22} color="#FFF" />
                <Text style={styles.dirBtnText}>Going Down</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.upButton}
                onPress={() => startTrade('up')}
                disabled={disabled || !priceReady}
                activeOpacity={0.85}
              >
                <Icon name="menu-up" size={22} color="#FFF" />
                <Text style={styles.dirBtnText}>Going Up</Text>
              </TouchableOpacity>
            </View>

            {/* Mining Power Bonus card */}
            {stockGameBonus > 0 && (
              <View style={styles.bonusCard}>
                <View style={styles.bonusRow}>
                  <Icon name="pickaxe" size={18} color={CYAN} />
                  <Text style={styles.bonusLabel}>Mining Power Bonus</Text>
                </View>
                <Text style={styles.bonusValue}>+{stockGameBonus.toFixed(1)} GH/s</Text>
                <Text style={styles.bonusReset}>Resets at 12:00 AM</Text>
              </View>
            )}

            {/* Reward History */}
            <View style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <Icon name="history" size={16} color={GOLD} />
                <Text style={styles.historyTitle}>Reward History</Text>
              </View>
              {historyLoading ? (
                <Text style={styles.historyEmpty}>Loading history…</Text>
              ) : rewardHistory.length === 0 ? (
                <Text style={styles.historyEmpty}>No trades yet. Make your first prediction!</Text>
              ) : (
                rewardHistory.slice(0, 8).map((item) => (
                  <View key={item.id} style={styles.historyRow}>
                    <View style={styles.historyRowLeft}>
                      <Text style={styles.historyRowMain} numberOfLines={1}>
                        {item.direction.toUpperCase()} • {item.durationLabel}
                      </Text>
                      <Text style={styles.historyRowSub} numberOfLines={1}>
                        ${formatUsd(item.entryPrice)} → ${formatUsd(item.exitPrice)}
                      </Text>
                    </View>
                    <View style={styles.historyRowRight}>
                      {item.won ? (
                        item.claimed ? (
                          <>
                            <Text style={styles.historyWin}>+{WIN_GH_REWARD} GH/s</Text>
                            <Text style={styles.historyClaimedLabel}>CLAIMED</Text>
                          </>
                        ) : (
                          <TouchableOpacity
                            style={styles.historyClaimBtn}
                            onPress={() => handleClaimFromHistory(item.id)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.historyClaimBtnText}>Claim {WIN_GH_REWARD} GH/s</Text>
                          </TouchableOpacity>
                        )
                      ) : (
                        <Text style={styles.historyLost}>LOST</Text>
                      )}
                      <Text style={styles.historyTime}>{formatTime(item.earnedAt)}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            <View style={{ height: 80 }} />
          </ScrollView>
        ) : (
          /* ─── ACTIVE TRADE STATE ─── */
          <ScrollView
            style={styles.flex1}
            contentContainerStyle={styles.activeContent}
            showsVerticalScrollIndicator={false}
            bounces={Platform.OS === 'ios'}
          >
            {/* Countdown timer */}
            <View style={styles.countdownSection}>
              <Image
                source={require('../assets/images/bitcoin.png')}
                style={styles.activeTradeImage}
                resizeMode="contain"
              />
              <View style={styles.timerRow}>
                <View style={styles.timerBox}>
                  <Text style={styles.timerDigit}>{countdown.hrs}</Text>
                </View>
                <Text style={styles.timerColon}>:</Text>
                <View style={styles.timerBox}>
                  <Text style={styles.timerDigit}>{countdown.mins}</Text>
                </View>
                <Text style={styles.timerColon}>:</Text>
                <View style={styles.timerBox}>
                  <Text style={styles.timerDigit}>{countdown.secs}</Text>
                </View>
              </View>
            </View>

            {/* Direction text */}
            <Text style={styles.directionLabel}>
              You said Bitcoin is going{' '}
              <Text style={{ color: activeTrade.direction === 'up' ? UP_COLOR : DOWN_COLOR }}>
                {activeTrade.direction === 'up' ? 'up' : 'down'}
              </Text>
            </Text>

            {/* Forecast status banner */}
            <View
              style={[
                styles.statusBanner,
                isCurrentlyCorrect ? styles.statusCorrect : styles.statusIncorrect,
              ]}
            >
              <Icon
                name={isCurrentlyCorrect ? 'check-circle' : 'close-circle'}
                size={22}
                color="#FFF"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.statusText}>
                {isCurrentlyCorrect
                  ? 'Your forecast is currently correct'
                  : 'Your forecast is currently incorrect'}
              </Text>
            </View>

            {/* Stats row */}
            {/* <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{WIN_GH_REWARD}</Text>
                <Text style={styles.statLabel}>GH/s to win</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{activeTrade.durationLabel}</Text>
                <Text style={styles.statLabel}>Duration</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {activeTrade.direction === 'up' ? '▲' : '▼'}
                </Text>
                <Text style={styles.statLabel}>Direction</Text>
              </View>
            </View> */}

            {/* Prices comparison */}
            <View style={styles.pricesCompare}>
              <View style={styles.priceCompareItem}>
                <Text style={[styles.priceCompareValue, { color: isCurrentlyCorrect ? UP_COLOR : DOWN_COLOR }]}>
                  ${formatUsd(displayPrice)}
                </Text>
                <Text style={styles.priceCompareLabel}>Current Price</Text>
              </View>
              <View style={styles.priceCompareItem}>
                <Text style={[styles.priceCompareValue, { color: GOLD }]}>
                  ${formatUsd(activeTrade.entryPrice)}
                </Text>
                <Text style={styles.priceCompareLabel}>Price at Forecast</Text>
              </View>
            </View>

            {/* Chart */}
            <View style={styles.chartSection}>
              <GameLineChart
                points={linePoints}
                width={chartW}
                height={chartH}
                domain={chartPriceDomain}
                nowMs={chartNowMs}
                windowMs={CHART_VIEW_WINDOW_MS}
                entryPrice={entryPrice}
                exitPrice={exitPrice}
                lastPrice={displayPrice}
              />
            </View>

            <View style={{ height: 80 }} />
          </ScrollView>
        )}

        {/* Banner ad - covers safe area like HomeScreen */}
        <View style={[styles.bannerWrapper, { paddingBottom: insets.bottom }]}>
          <View style={styles.bannerContainer}>
            {bannerError ? (
              <TouchableOpacity
                onPress={() => Linking.openURL('https://thecaphevietnam.com/')}
              >
                <Image
                  source={require('../assets/images/addbanner.png')}
                  style={{ width: SCREEN_W, height: 60, resizeMode: 'stretch' }}
                />
              </TouchableOpacity>
            ) : (
              <BannerAdWithGamFallback
                primaryUnitId={ads.homeBannerId ?? DEFAULT_ADMOB_BANNER_ID}
                size={BannerAdSize.ADAPTIVE_BANNER}
                onAllFailed={() => setBannerError(true)}
              />
            )}
          </View>
        </View>
      </View>

      {/* ─── WIN MODAL ─── */}
      <Modal
        visible={winModal != null}
        transparent
        animationType="fade"
        statusBarTranslucent={Platform.OS === 'android'}
        onRequestClose={closeRewardModal}
        presentationStyle="overFullScreen"
      >
        <View style={styles.modalRoot}>
          <ScrollView
            contentContainerStyle={styles.modalScrollInner}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <LinearGradient
              colors={['#064E3B', '#065F46']}
              style={styles.resultCard}
            >
              <View style={styles.resultIconCircle}>
                <Icon name="trophy" size={48} color={GOLD} />
              </View>

              <Text style={styles.resultTitle}>You Won!</Text>
              <Text style={styles.resultSub}>Your prediction was correct</Text>

              <View style={styles.resultRewardBox}>
                <Icon name="pickaxe" size={20} color={CYAN} />
                <Text style={styles.resultRewardText}>
                  +{WIN_GH_REWARD} GH/s Mining Power
                </Text>
              </View>

              <View style={styles.resultPriceRow}>
                <View style={styles.resultPriceItem}>
                  <Text style={styles.resultPriceLabel}>Entry Price</Text>
                  <Text style={styles.resultPriceValue}>
                    ${winModal ? formatUsd(winModal.entryPrice) : '—'}
                  </Text>
                </View>
                <Icon name="arrow-right" size={20} color="rgba(255,255,255,0.4)" />
                <View style={styles.resultPriceItem}>
                  <Text style={styles.resultPriceLabel}>Exit Price</Text>
                  <Text style={[styles.resultPriceValue, { color: UP_COLOR }]}>
                    ${winModal ? formatUsd(winModal.exitPrice) : '—'}
                  </Text>
                </View>
              </View>

              <Text style={styles.resultNote}>
                Added to your mining · resets at 12:00 AM
              </Text>

              <Text style={styles.modalAdHint}>
                Watch a clip to claim your reward
              </Text>

              <Pressable
                style={({ pressed }) => [
                  styles.lootBtn,
                  pressed && styles.lootBtnPressed,
                ]}
                onPress={handleClaim}
              >
                {rewardAdLoading && !rewardLoaded ? (
                  <View style={styles.lootBtnRow}>
                    <ActivityIndicator color="#0A1628" size="small" />
                    <Text style={[styles.lootBtnTxt, styles.lootBtnTxtPad]}>
                      Loading video…
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.lootBtnTxt}>CLAIM {WIN_GH_REWARD} GH/s</Text>
                )}
              </Pressable>

              <TouchableOpacity onPress={closeRewardModal} hitSlop={12}>
                <Text style={styles.skipTxt}>Skip</Text>
              </TouchableOpacity>
            </LinearGradient>
          </ScrollView>
        </View>
      </Modal>

      {/* ─── LOSE MODAL ─── */}
      <Modal
        visible={loseModal != null}
        transparent
        animationType="fade"
        statusBarTranslucent={Platform.OS === 'android'}
        onRequestClose={closeLoseModal}
        presentationStyle="overFullScreen"
      >
        <View style={styles.modalRoot}>
          <View style={styles.modalScrollInner}>
            <LinearGradient
              colors={['#7F1D1D', '#991B1B']}
              style={styles.resultCard}
            >

              <View style={[styles.resultIconCircle, { backgroundColor: 'rgba(239,68,68,0.2)' }]}>
                <Icon name="close-circle" size={48} color="#EF4444" />
              </View>

              <Text style={styles.resultTitle}>You Lost!</Text>
              <Text style={styles.resultSub}>
                Your prediction was{' '}
                {loseModal?.direction === 'up' ? 'UP' : 'DOWN'} but the price went{' '}
                {loseModal?.direction === 'up' ? 'DOWN' : 'UP'}
              </Text>

              <View style={styles.resultPriceRow}>
                <View style={styles.resultPriceItem}>
                  <Text style={styles.resultPriceLabel}>Entry Price</Text>
                  <Text style={styles.resultPriceValue}>
                    ${loseModal ? formatUsd(loseModal.entryPrice) : '—'}
                  </Text>
                </View>
                <Icon name="arrow-right" size={20} color="rgba(255,255,255,0.4)" />
                <View style={styles.resultPriceItem}>
                  <Text style={styles.resultPriceLabel}>Exit Price</Text>
                  <Text style={[styles.resultPriceValue, { color: DOWN_COLOR }]}>
                    ${loseModal ? formatUsd(loseModal.exitPrice) : '—'}
                  </Text>
                </View>
              </View>

              <Text style={styles.resultNote}>
                Better luck next time! Try a different strategy.
              </Text>

              <Pressable
                style={({ pressed }) => [
                  styles.tryAgainBtn,
                  pressed && { opacity: 0.85 },
                  (rewardAdLoading && !rewardLoaded) && { opacity: 0.6 }
                ]}
                onPress={closeLoseModal}
                disabled={rewardAdLoading && !rewardLoaded}
              >
                {rewardAdLoading && !rewardLoaded ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.tryAgainBtnTxt}>WATCH AD TO TRY AGAIN</Text>
                )}
              </Pressable>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1, backgroundColor: '#111827' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#1F2937',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    flex: 1,
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },

  /* ─── IDLE STATE ─── */
  idleContent: {
    flexGrow: 1,
    paddingHorizontal: PAD,
    paddingTop: 24,
    alignItems: 'center',
  },
  // Sized down from 22/26 so the headline fits on two lines instead of the
  // three the old manual line breaks forced.
  questionText: {
    color: '#FFF',
    fontSize: IS_SMALL_DEVICE ? 17 : 20,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: IS_SMALL_DEVICE ? 24 : 28,
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  priceText: {
    color: '#FFF',
    fontSize: IS_SMALL_DEVICE ? 28 : 34,
    fontWeight: '900',
  },
  minerImage: {
    width: SCREEN_W * 0.5,
    height: SCREEN_W * 0.5,
    marginBottom: 8,
    opacity: 0.9,
  },

  directionBtnRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginTop: 16,
    marginBottom: 16,
  },
  downButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 6,
  },
  upButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4ADE80',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 6,
  },
  dirBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },

  /* ─── ACTIVE TRADE STATE ─── */
  activeContent: {
    flexGrow: 1,
    paddingHorizontal: PAD,
    paddingTop: 12,
    alignItems: 'center',
  },
  countdownSection: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  activeTradeImage: {
    width: SCREEN_W * 0.1,
    height: SCREEN_W * 0.15,
    // marginBottom: 12,
    opacity: 0.85,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timerBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 50,
    alignItems: 'center',
  },
  timerDigit: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  timerColon: {
    color: '#9CA3AF',
    fontSize: 24,
    fontWeight: '900',
    marginHorizontal: 2,
  },
  directionLabel: {
    color: '#4ADE80',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 10,
    textAlign: 'center',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    width: '100%',
    marginBottom: 16,
  },
  statusCorrect: {
    backgroundColor: '#059669',
  },
  statusIncorrect: {
    backgroundColor: '#DC2626',
  },
  statusText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    width: '100%',
    paddingVertical: 12,
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  pricesCompare: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginBottom: 16,
  },
  priceCompareItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  priceCompareValue: {
    fontSize: IS_SMALL_DEVICE ? 18 : 22,
    fontWeight: '900',
    marginBottom: 4,
  },
  priceCompareLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
  },

  /* ─── CHART ─── */
  chartSection: {
    width: '100%',
    marginTop: 4,
    marginBottom: 8,
  },
  chartFrame: {
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#0A0F1A',
  },
  chartLoadingBox: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartLoading: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
    marginTop: 10,
  },

  /* ─── TIME SLOT MODAL ─── */
  /* ─── BONUS & HISTORY ─── */
  bonusCard: {
    width: '100%',
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(46,232,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(46,232,255,0.25)',
    alignItems: 'center',
  },
  bonusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  bonusLabel: {
    color: CYAN,
    fontSize: 13,
    fontWeight: '700',
  },
  bonusValue: {
    color: '#FFF',
    fontSize: IS_SMALL_DEVICE ? 18 : 22,
    fontWeight: '900',
    letterSpacing: 1,
  },
  bonusReset: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
  historyCard: {
    width: '100%',
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,217,61,0.22)',
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyTitle: {
    color: '#FFF6D8',
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 6,
  },
  historyEmpty: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    paddingVertical: 8,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  historyRowLeft: {
    flex: 1,
    paddingRight: 10,
  },
  historyRowRight: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  historyRowMain: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  historyRowSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    marginTop: 2,
  },
  historyWin: {
    color: UP_COLOR,
    fontSize: 12,
    fontWeight: '800',
  },
  historyClaimedLabel: {
    color: UP_COLOR,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  historyClaimBtn: {
    backgroundColor: GOLD,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  historyClaimBtnText: {
    color: '#1A0A2E',
    fontSize: 11,
    fontWeight: '800',
  },
  historyLost: {
    color: DOWN_COLOR,
    fontSize: 12,
    fontWeight: '800',
  },
  historyTime: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    marginTop: 1,
  },

  /* ─── BANNER ─── */
  bannerWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1F2937',
    paddingHorizontal: 0,
    alignItems: 'center',
  },
  bannerContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Mirrors GameZoneScreen's bannerTop.
  bannerTop: {
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(11,17,29,0.4)',
  },

  /* ─── WIN / LOSE MODALS ─── */
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
  },
  modalScrollInner: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },

  resultCard: {
    borderRadius: 22,
    padding: Platform.OS === 'ios' ? 0 : 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    maxWidth: 400,
    width: '100%',
    alignItems: 'center',
  },
  resultIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,217,61,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    marginTop: Platform.OS === 'ios' ? 20 : 0,
  },
  resultTitle: {
    color: '#FFF',
    fontSize: IS_SMALL_DEVICE ? 28 : 34,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 4,
  },
  resultSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  resultRewardBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(46,232,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(46,232,255,0.3)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  resultRewardText: {
    color: CYAN,
    fontSize: 16,
    fontWeight: '800',
  },
  resultPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  resultPriceItem: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  resultPriceLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  resultPriceValue: {
    color: '#FFF',
    fontSize: IS_SMALL_DEVICE ? 16 : 18,
    fontWeight: '900',
  },
  resultNote: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalAdHint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 14,
  },
  lootBtn: {
    backgroundColor: GOLD,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    width: Platform.OS === 'ios' ? '90%' : '100%',
  },
  lootBtnPressed: { opacity: 0.88 },
  lootBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lootBtnTxt: { color: '#1A0A2E', fontSize: 16, fontWeight: '900' },
  lootBtnTxtPad: { marginLeft: 10 },
  tryAgainBtn: {
    backgroundColor: '#FFF',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    width: Platform.OS === 'ios' ? '90%' : '100%',
    marginBottom: Platform.OS === 'ios' ? 20 : 4,
  },
  tryAgainBtnTxt: {
    color: '#991B1B',
    fontSize: 16,
    fontWeight: '900',
  },
  skipTxt: {
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    marginTop: 14,
    marginBottom: Platform.OS === 'ios' ? 20 : 0,
    fontSize: 14,
    paddingVertical: 4,
  },
  miningLockOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    backgroundColor: 'rgba(5,2,14,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  miningLockCard: {
    backgroundColor: 'rgba(15,10,30,0.97)',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(251,191,36,0.45)',
    padding: 28,
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  miningLockTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 4,
  },
  miningLockBody: {
    fontSize: 14,
    color: '#C4B5FD',
    textAlign: 'center',
    lineHeight: 20,
  },
  miningLockBtn: {
    marginTop: 8,
    backgroundColor: '#FBBF24',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  miningLockBtnText: {
    color: '#1C1917',
    fontSize: 14,
    fontWeight: '900',
  },
});

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BANNER_ADS_ENABLED } from '../config/adPlacements';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Image,
  Linking,
  StatusBar,
  ScrollView,
  Platform,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useFreeRetries } from '../hooks/useFreeRetries';
import { useAuth } from '../auth/AuthProvider';
import { useHashPower } from '../stores/HashPowerStore';
import { get_data_uri } from '../config/api';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Icon5 from 'react-native-vector-icons/FontAwesome5';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { useRewardedVideoAd } from '../services/googleAds';
import { DEFAULT_ADMOB_BANNER_ID } from '../services/adUnitDefaults';
import { BannerAdWithGamFallback } from '../components/ads/BannerAdWithGamFallback';
import { BannerAdSize } from 'react-native-google-mobile-ads';
import { useAdConfig } from '../providers/AdConfigProvider';
import { useBinanceMarkets } from '../hooks/useBinanceMarkets';
import { GameLineChart } from '../components/games/trading/TradeChart';
import {
  CountdownRing,
  DirectionButton,
  LiveBadge,
  LivePrice,
  PulsingIcon,
  StatTile,
  TradeHistoryRow,
} from '../components/games/trading/TradeWidgets';
import {
  T,
  SCREEN_W,
  SCREEN_H,
  IS_SMALL,
  PAD,
  formatUsd,
  formatSignedUsd,
} from '../components/games/trading/theme';

export const WIN_GH_REWARD = 5;
/** Length of one prediction round. */
const TRADE_DURATION_MS = 60_000;
const TRADE_SECONDS = TRADE_DURATION_MS / 1000;
const CHART_VIEW_WINDOW_MS = 2 * 60 * 1000;

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

const CHART_W = SCREEN_W - PAD * 2 - 2; // card border
const CHART_H = IS_SMALL
  ? Math.round(Math.max(150, Math.min(SCREEN_H * 0.26, 200)))
  : Math.round(Math.max(190, Math.min(SCREEN_H * 0.28, 280)));

export default function TradingScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { ads } = useAdConfig();
  const { user } = useAuth();
  const { linePoints, lastPrice, lastPriceRef, connected } =
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

  const entryPrice = activeTrade?.entryPrice ?? lineMarkers?.entry ?? null;
  const exitPrice = lineMarkers?.exit ?? null;

  const priceReady = displayPrice > 0;

  // Right edge of the chart's time window. Advanced on a slow (500 ms) clock
  // so the chart isn't re-filtered on every price tick.
  const [chartNowMs, setChartNowMs] = useState(() => Date.now());

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
              await new Promise<void>((r) => setTimeout(() => r(), 1000));
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

  // A lost trade retries for free a few times before one needs a video
  // (services/gameRetryCredits.ts). Any fully watched video starts it again.
  const freeRetry = useFreeRetries('BTC Trading');

  const onRewardEarned = useCallback((_amount: number, _type: string) => {
    pendingRewardAdShowRef.current = false;
    freeRetry.reset();

    if (pendingLoseAdWatchRef.current) {
      loseAdCompletedRef.current = true;
      return;
    }

    const claimId = pendingClaimIdRef.current;
    if (claimId) {
      claimTradeReward(claimId);
      pendingClaimIdRef.current = null;
    }
  }, [claimTradeReward, freeRetry]);

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
      setChartNowMs(Date.now());
      const id = setInterval(() => setChartNowMs(Date.now()), 500);
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
  }, [rewardLoaded, showRewardAd, freeRetry]);

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
      const ms = TRADE_DURATION_MS;
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
      isMiningActive,
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
  const secondsLeft = Math.max(0, Math.ceil(countdownMs / 1000));

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
    if (freeRetry.tryFree()) {
      setLoseModal(null);
      return;
    }
    if (rewardLoaded) {
      pendingLoseAdWatchRef.current = true;
      showRewardAd();
    } else {
      // If ad not loaded, we can't really force it, but we can show an alert or just wait.
      // But per "mandatory" request, we'll try to show it if possible.
      Alert.alert("Ad Loading", "Please wait a moment for the video to load.");
    }
  }, [rewardLoaded, showRewardAd]);

  const tradeStats = useMemo(() => {
    const total = rewardHistory.length;
    const wins = rewardHistory.filter((h) => h.won).length;
    return { total, wins, rate: total ? Math.round((wins / total) * 100) : null };
  }, [rewardHistory]);

  /* ─── derived view values ─── */
  const up = priceReady && vsSession >= 0;
  const sessionPct =
    priceReady && sessionOpen > 0 ? (vsSession / sessionOpen) * 100 : 0;
  const trendColor = up ? T.up : T.down;

  const livePnl = activeTrade
    ? floatingPnl ??
      (priceReady
        ? (activeTrade.direction === 'up' ? 1 : -1) * (displayPrice - activeTrade.entryPrice)
        : 0)
    : 0;
  const tradeColor = isCurrentlyCorrect ? T.up : T.down;
  const chartColor = tradeActive ? tradeColor : T.cyan;
  const pnlColor = livePnl > 0 ? T.up : livePnl < 0 ? T.down : T.textDim;

  const loseMove = loseModal ? loseModal.exitPrice - loseModal.entryPrice : 0;
  const loseRetryBusy = freeRetry.left === 0 && rewardAdLoading && !rewardLoaded;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={styles.flex1}>
        {isMiningActive === false && (
          <View style={styles.miningLockOverlay} pointerEvents="box-none">
            <View style={styles.miningLockCard}>
              <View style={styles.miningLockIcon}>
                <Icon name="pickaxe" size={32} color={T.gold} />
              </View>
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
            <Icon name="arrow-left" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.topBarTitleCol}>
            <Text style={styles.topBarTitle}>BTC Trading</Text>
            <Text style={styles.topBarSub}>Predict · Win GH/s</Text>
          </View>
          <View style={styles.topBarRight}>
            <LiveBadge live={connected} />
          </View>
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

        <ScrollView
          style={styles.flex1}
          contentContainerStyle={[styles.content, { paddingBottom: 96 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          bounces={Platform.OS === 'ios'}
        >
          {/* ─── Market card: price header + chart ─── */}
          <View style={styles.marketCard}>
            <View style={styles.marketHeader}>
              <View style={styles.coinIcon}>
                <Icon5 name="bitcoin" size={IS_SMALL ? 18 : 20} color={T.btc} />
              </View>
              <View style={styles.coinNameCol}>
                <Text style={styles.coinName}>Bitcoin</Text>
                <Text style={styles.coinPair}>BTC / USDT</Text>
              </View>
              {priceReady && (
                <View
                  style={[
                    styles.changeChip,
                    { backgroundColor: up ? 'rgba(34,197,94,0.14)' : 'rgba(239,68,68,0.14)' },
                  ]}
                >
                  <Icon name={up ? 'menu-up' : 'menu-down'} size={18} color={trendColor} />
                  <Text style={[styles.changeChipText, { color: trendColor }]}>
                    {Math.abs(sessionPct).toFixed(3)}%
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.priceBlock}>
              {priceReady ? (
                <LivePrice price={displayPrice} size={IS_SMALL ? 30 : 36} />
              ) : (
                <View style={styles.priceSkeletonRow}>
                  <ActivityIndicator color={T.cyan} size="small" />
                  <Text style={styles.priceSkeletonText}>Fetching live price…</Text>
                </View>
              )}
              {priceReady && (
                <Text style={styles.priceSub}>
                  <Text style={{ color: trendColor, fontWeight: '800' }}>
                    {formatSignedUsd(vsSession)}
                  </Text>
                  {'  this session'}
                </Text>
              )}
            </View>

            <GameLineChart
              points={linePoints}
              width={CHART_W}
              height={CHART_H}
              nowMs={chartNowMs}
              windowMs={CHART_VIEW_WINDOW_MS}
              lastPrice={displayPrice}
              entryPrice={entryPrice}
              exitPrice={exitPrice}
              color={chartColor}
            />
            <View style={styles.chartFooter}>
              <Text style={styles.chartFooterText}>Last 2 min</Text>
              <Text style={styles.chartFooterText}>Binance · real-time</Text>
            </View>
          </View>

          {!tradeActive ? (
            /* ─── IDLE: make a prediction ─── */
            <>
              <View style={styles.howRow}>
                <View style={styles.howIcon}>
                  <Icon name="lightning-bolt" size={14} color={T.gold} />
                </View>
                <Text style={styles.howText}>
                  Will BTC go <Text style={{ color: T.up, fontWeight: '900' }}>UP</Text> or{' '}
                  <Text style={{ color: T.down, fontWeight: '900' }}>DOWN</Text> in the next{' '}
                  {TRADE_SECONDS}s? Call it right to win{' '}
                  <Text style={{ color: T.gold, fontWeight: '900' }}>+{WIN_GH_REWARD} GH/s</Text>
                </Text>
              </View>

              <View style={styles.directionBtnRow}>
                <DirectionButton
                  direction="down"
                  onPress={() => startTrade('down')}
                  disabled={disabled || !priceReady}
                />
                <DirectionButton
                  direction="up"
                  onPress={() => startTrade('up')}
                  disabled={disabled || !priceReady}
                />
              </View>
              {!priceReady && (
                <Text style={styles.waitingText}>Buttons unlock as soon as the live price arrives</Text>
              )}
            </>
          ) : (
            /* ─── ACTIVE TRADE ─── */
            <View
              style={[
                styles.tradeCard,
                { borderColor: isCurrentlyCorrect ? 'rgba(34,197,94,0.45)' : 'rgba(239,68,68,0.45)' },
              ]}
            >
              <View style={styles.tradeTop}>
                <CountdownRing
                  endTime={activeTrade.endTime}
                  durationMs={TRADE_DURATION_MS}
                  secondsLeft={secondsLeft}
                  color={tradeColor}
                  size={IS_SMALL ? 74 : 86}
                />
                <View style={styles.tradeInfo}>
                  <View style={styles.tradeChipsRow}>
                    <View
                      style={[
                        styles.calledChip,
                        {
                          backgroundColor:
                            activeTrade.direction === 'up' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                        },
                      ]}
                    >
                      <Icon
                        name={activeTrade.direction === 'up' ? 'arrow-up-bold' : 'arrow-down-bold'}
                        size={12}
                        color={activeTrade.direction === 'up' ? T.up : T.down}
                      />
                      <Text
                        style={[
                          styles.calledChipText,
                          { color: activeTrade.direction === 'up' ? T.up : T.down },
                        ]}
                      >
                        YOU CALLED {activeTrade.direction === 'up' ? 'UP' : 'DOWN'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.pnlLabel}>Live P&L</Text>
                  <Text style={[styles.pnlValue, { color: pnlColor }]} numberOfLines={1} adjustsFontSizeToFit>
                    {formatSignedUsd(livePnl)}
                  </Text>
                  <Text style={styles.entryText} numberOfLines={1}>
                    Entry <Text style={{ color: T.gold, fontWeight: '800' }}>${formatUsd(activeTrade.entryPrice)}</Text>
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.statusBar,
                  { backgroundColor: isCurrentlyCorrect ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)' },
                ]}
              >
                <Icon
                  name={isCurrentlyCorrect ? 'check-circle' : 'alert-circle'}
                  size={16}
                  color={tradeColor}
                />
                <Text style={[styles.statusText, { color: tradeColor }]} numberOfLines={2}>
                  {isCurrentlyCorrect
                    ? `Winning — hold on for +${WIN_GH_REWARD} GH/s`
                    : `Losing — needs to close ${activeTrade.direction === 'up' ? 'above' : 'below'} entry`}
                </Text>
              </View>
            </View>
          )}

          {/* ─── Stats ─── */}
          <View style={styles.statsRow}>
            <StatTile
              icon="pickaxe"
              iconColor={T.cyan}
              label="Today's bonus"
              value={`+${stockGameBonus.toFixed(1)} GH/s`}
              valueColor={stockGameBonus > 0 ? T.cyan : undefined}
            />
            <StatTile
              icon="percent"
              iconColor={T.gold}
              label="Win rate"
              value={tradeStats.rate == null ? '—' : `${tradeStats.rate}%`}
            />
            <StatTile
              icon="swap-vertical"
              iconColor={T.textDim}
              label="Trades"
              value={`${tradeStats.wins}W · ${tradeStats.total - tradeStats.wins}L`}
            />
          </View>
          <Text style={styles.resetNote}>Bonus mining power resets at 12:00 AM</Text>

          {/* ─── Recent trades ─── */}
          <View style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <Icon name="history" size={16} color={T.gold} />
              <Text style={styles.historyTitle}>Recent trades</Text>
            </View>
            {historyLoading ? (
              <View style={styles.historyEmptyBox}>
                <ActivityIndicator color={T.textDim} size="small" />
              </View>
            ) : rewardHistory.length === 0 ? (
              <View style={styles.historyEmptyBox}>
                <Icon name="chart-areaspline" size={26} color={T.textMuted} />
                <Text style={styles.historyEmpty}>No trades yet. Make your first prediction!</Text>
              </View>
            ) : (
              rewardHistory.slice(0, 8).map((item) => (
                <TradeHistoryRow
                  key={item.id}
                  direction={item.direction}
                  entryPrice={item.entryPrice}
                  exitPrice={item.exitPrice}
                  earnedAt={item.earnedAt}
                  won={item.won}
                  claimed={item.claimed}
                  reward={WIN_GH_REWARD}
                  onClaim={() => handleClaimFromHistory(item.id)}
                />
              ))
            )}
          </View>
        </ScrollView>

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
            <View style={[styles.resultCard, { borderColor: 'rgba(34,197,94,0.4)' }]}>
              <LinearGradient
                colors={['rgba(34,197,94,0.28)', 'rgba(17,24,39,0)']}
                style={styles.resultGlow}
                pointerEvents="none"
              />
              <View style={styles.resultInner}>
                <PulsingIcon glow="rgba(251,191,36,0.45)">
                  <View style={[styles.resultIconCircle, { borderColor: 'rgba(251,191,36,0.5)' }]}>
                    <Icon name="trophy" size={42} color={T.gold} />
                  </View>
                </PulsingIcon>

                <Text style={[styles.resultKicker, { color: T.up }]}>PREDICTION CORRECT</Text>
                <Text style={styles.resultTitle}>You Won!</Text>

                <View style={styles.rewardPill}>
                  <Icon name="pickaxe" size={20} color={T.gold} />
                  <Text style={styles.rewardPillText}>+{WIN_GH_REWARD} GH/s</Text>
                </View>
                <Text style={styles.resultSub}>Mining power boost</Text>

                <View style={styles.resultPriceBox}>
                  <View style={styles.resultPriceItem}>
                    <Text style={styles.resultPriceLabel}>Entry</Text>
                    <Text style={styles.resultPriceValue} numberOfLines={1} adjustsFontSizeToFit>
                      ${winModal ? formatUsd(winModal.entryPrice) : '—'}
                    </Text>
                  </View>
                  <View style={styles.resultArrow}>
                    <Icon
                      name={winModal?.direction === 'down' ? 'arrow-bottom-right' : 'arrow-top-right'}
                      size={18}
                      color={T.up}
                    />
                  </View>
                  <View style={styles.resultPriceItem}>
                    <Text style={styles.resultPriceLabel}>Exit</Text>
                    <Text style={[styles.resultPriceValue, { color: T.up }]} numberOfLines={1} adjustsFontSizeToFit>
                      ${winModal ? formatUsd(winModal.exitPrice) : '—'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.modalAdHint}>
                  Watch a clip to claim your reward · resets at 12:00 AM
                </Text>

                <Pressable
                  style={({ pressed }) => [styles.ctaOuter, pressed && styles.ctaPressed]}
                  onPress={handleClaim}
                >
                  <LinearGradient
                    colors={['#FDE68A', T.gold, '#F59E0B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.ctaGradient}
                  >
                    <View style={styles.ctaInner}>
                      {rewardAdLoading && !rewardLoaded ? (
                        <>
                          <ActivityIndicator color="#1C1407" size="small" />
                          <Text style={[styles.ctaTextDark, styles.ctaTextPad]}>Loading video…</Text>
                        </>
                      ) : (
                        <>
                          <Icon name="play-circle" size={20} color="#1C1407" />
                          <Text style={[styles.ctaTextDark, styles.ctaTextPad]}>
                            CLAIM {WIN_GH_REWARD} GH/s
                          </Text>
                        </>
                      )}
                    </View>
                  </LinearGradient>
                </Pressable>

                <TouchableOpacity onPress={closeRewardModal} hitSlop={12}>
                  <Text style={styles.skipTxt}>Skip</Text>
                </TouchableOpacity>
              </View>
            </View>
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
          <ScrollView
            contentContainerStyle={styles.modalScrollInner}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={[styles.resultCard, { borderColor: 'rgba(239,68,68,0.35)' }]}>
              <LinearGradient
                colors={['rgba(239,68,68,0.2)', 'rgba(17,24,39,0)']}
                style={styles.resultGlow}
                pointerEvents="none"
              />
              <View style={styles.resultInner}>
                <PulsingIcon glow="rgba(239,68,68,0.35)">
                  <View style={[styles.resultIconCircle, { borderColor: 'rgba(239,68,68,0.45)' }]}>
                    <Icon name="arm-flex" size={40} color="#FCA5A5" />
                  </View>
                </PulsingIcon>

                <Text style={[styles.resultKicker, { color: T.down }]}>NOT THIS TIME</Text>
                <Text style={styles.resultTitle}>So close!</Text>
                <Text style={styles.resultSubWide}>
                  You called{' '}
                  <Text style={{ color: loseModal?.direction === 'up' ? T.up : T.down, fontWeight: '900' }}>
                    {loseModal?.direction === 'up' ? 'UP' : 'DOWN'}
                  </Text>
                  {loseMove === 0
                    ? ', but the price ended flat.'
                    : `, but the price moved ${loseMove > 0 ? 'UP' : 'DOWN'} $${formatUsd(Math.abs(loseMove))}.`}
                </Text>

                <View style={styles.resultPriceBox}>
                  <View style={styles.resultPriceItem}>
                    <Text style={styles.resultPriceLabel}>Entry</Text>
                    <Text style={styles.resultPriceValue} numberOfLines={1} adjustsFontSizeToFit>
                      ${loseModal ? formatUsd(loseModal.entryPrice) : '—'}
                    </Text>
                  </View>
                  <View style={styles.resultArrow}>
                    <Icon
                      name={loseMove > 0 ? 'arrow-top-right' : loseMove < 0 ? 'arrow-bottom-right' : 'arrow-right'}
                      size={18}
                      color={T.textDim}
                    />
                  </View>
                  <View style={styles.resultPriceItem}>
                    <Text style={styles.resultPriceLabel}>Exit</Text>
                    <Text style={[styles.resultPriceValue, { color: T.down }]} numberOfLines={1} adjustsFontSizeToFit>
                      ${loseModal ? formatUsd(loseModal.exitPrice) : '—'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.resultNote}>
                  Every round is a fresh {TRADE_SECONDS}-second chance. Your next call could be the winner!
                </Text>

                <Pressable
                  style={({ pressed }) => [
                    styles.retryBtn,
                    pressed && styles.ctaPressed,
                    loseRetryBusy && { opacity: 0.6 },
                  ]}
                  onPress={closeLoseModal}
                  disabled={loseRetryBusy}
                >
                  {loseRetryBusy ? (
                    <ActivityIndicator color="#0B0F17" size="small" />
                  ) : (
                    <View style={styles.ctaInnerRow}>
                      <Icon
                        name={freeRetry.left > 0 ? 'refresh' : 'play-circle'}
                        size={19}
                        color="#0B0F17"
                      />
                      <Text style={[styles.ctaTextDark, styles.ctaTextPad]}>
                        {freeRetry.left > 0 ? `TRY AGAIN (${freeRetry.left} FREE)` : 'WATCH AD TO TRY AGAIN'}
                      </Text>
                    </View>
                  )}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  flex1: { flex: 1, backgroundColor: T.bg },

  /* ─── TOP BAR ─── */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: T.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.borderStrong,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.surface2,
  },
  topBarTitleCol: { flex: 1, marginLeft: 12 },
  topBarTitle: { color: T.text, fontSize: 17, fontWeight: '900' },
  topBarSub: { color: T.textDim, fontSize: 11, fontWeight: '600', marginTop: 1 },
  topBarRight: { marginLeft: 8 },

  content: {
    flexGrow: 1,
    paddingHorizontal: PAD,
    paddingTop: IS_SMALL ? 10 : 14,
  },

  /* ─── MARKET CARD ─── */
  marketCard: {
    backgroundColor: T.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: T.border,
    overflow: 'hidden',
  },
  marketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  coinIcon: {
    width: IS_SMALL ? 32 : 36,
    height: IS_SMALL ? 32 : 36,
    borderRadius: 18,
    backgroundColor: 'rgba(247,147,26,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinNameCol: { flex: 1, marginLeft: 10 },
  coinName: { color: T.text, fontSize: 14, fontWeight: '800' },
  coinPair: { color: T.textDim, fontSize: 11, fontWeight: '600', marginTop: 1 },
  changeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingLeft: 2,
    paddingRight: 8,
    paddingVertical: 3,
  },
  changeChipText: { fontSize: 12, fontWeight: '900', fontVariant: ['tabular-nums'] },
  priceBlock: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 6,
    minHeight: IS_SMALL ? 58 : 66,
    justifyContent: 'center',
  },
  priceSkeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priceSkeletonText: { color: T.textDim, fontSize: 14, fontWeight: '700' },
  priceSub: { color: T.textMuted, fontSize: 12, fontWeight: '600', marginTop: 1 },
  chartFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.border,
  },
  chartFooterText: { color: T.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

  /* ─── IDLE ─── */
  howRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: IS_SMALL ? 10 : 14,
    paddingHorizontal: 12,
    paddingVertical: IS_SMALL ? 8 : 10,
    backgroundColor: 'rgba(251,191,36,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.18)',
    borderRadius: 12,
  },
  howIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(251,191,36,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  howText: { flex: 1, color: '#D1D5DB', fontSize: IS_SMALL ? 12 : 13, fontWeight: '600', lineHeight: IS_SMALL ? 17 : 19 },
  directionBtnRow: {
    flexDirection: 'row',
    gap: IS_SMALL ? 10 : 12,
    marginTop: IS_SMALL ? 10 : 14,
  },
  waitingText: {
    color: T.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },

  /* ─── ACTIVE TRADE ─── */
  tradeCard: {
    marginTop: IS_SMALL ? 10 : 14,
    backgroundColor: T.surface,
    borderRadius: 18,
    borderWidth: 1,
    padding: IS_SMALL ? 12 : 14,
  },
  tradeTop: { flexDirection: 'row', alignItems: 'center' },
  tradeInfo: { flex: 1, marginLeft: IS_SMALL ? 12 : 16, minWidth: 0 },
  tradeChipsRow: { flexDirection: 'row' },
  calledChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 3,
  },
  calledChipText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  pnlLabel: { color: T.textDim, fontSize: 11, fontWeight: '700', marginTop: 6 },
  pnlValue: {
    fontSize: IS_SMALL ? 24 : 28,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  entryText: { color: T.textDim, fontSize: 12, fontWeight: '600', marginTop: 1 },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 12,
    gap: 8,
  },
  statusText: { flex: 1, fontSize: 12, fontWeight: '800' },

  /* ─── STATS & HISTORY ─── */
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: IS_SMALL ? 12 : 16,
  },
  resetNote: {
    color: T.textMuted,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  historyCard: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
    borderRadius: 16,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyTitle: {
    color: T.text,
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 6,
  },
  historyEmptyBox: {
    alignItems: 'center',
    paddingVertical: 18,
    gap: 6,
  },
  historyEmpty: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },

  /* ─── BANNER ─── */
  bannerWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: T.surface,
    paddingHorizontal: 0,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.border,
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
    backgroundColor: 'rgba(3,6,12,0.82)',
  },
  modalScrollInner: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  resultCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    borderWidth: 1,
    backgroundColor: T.surface,
    overflow: 'hidden',
  },
  resultGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  resultInner: {
    alignItems: 'center',
    paddingHorizontal: IS_SMALL ? 18 : 24,
    paddingTop: IS_SMALL ? 20 : 26,
    paddingBottom: IS_SMALL ? 16 : 20,
  },
  resultIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
    backgroundColor: T.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultKicker: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 4,
  },
  resultTitle: {
    color: T.text,
    fontSize: IS_SMALL ? 26 : 30,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 10,
  },
  rewardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.4)',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  rewardPillText: {
    color: T.gold,
    fontSize: IS_SMALL ? 26 : 30,
    fontWeight: '900',
  },
  resultSub: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 16,
  },
  resultSubWide: {
    color: '#D1D5DB',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
  },
  resultPriceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: T.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.border,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 14,
  },
  resultPriceItem: { flex: 1, alignItems: 'center', minWidth: 0 },
  resultArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: T.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
  },
  resultPriceLabel: {
    color: T.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  resultPriceValue: {
    color: T.text,
    fontSize: IS_SMALL ? 15 : 17,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  resultNote: {
    color: T.textDim,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 16,
  },
  modalAdHint: {
    color: T.textDim,
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 12,
  },
  // Gradient carries only the width; padding lives on the inner View (iOS
  // renders a padded LinearGradient shorter than its label).
  ctaOuter: { width: '100%', borderRadius: 14, overflow: 'hidden' },
  ctaGradient: { width: '100%' },
  ctaInner: {
    minHeight: 52,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaInnerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  ctaPressed: { opacity: 0.85 },
  ctaTextDark: { color: '#1C1407', fontSize: 15, fontWeight: '900', letterSpacing: 0.4 },
  ctaTextPad: { marginLeft: 8 },
  retryBtn: {
    width: '100%',
    minHeight: 52,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: T.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipTxt: {
    color: T.textMuted,
    textAlign: 'center',
    marginTop: 14,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 4,
  },

  /* ─── MINING LOCK ─── */
  miningLockOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    backgroundColor: 'rgba(5,8,14,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  miningLockCard: {
    backgroundColor: T.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.4)',
    padding: 26,
    alignItems: 'center',
    gap: 10,
    width: '100%',
    maxWidth: 400,
  },
  miningLockIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(251,191,36,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miningLockTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: T.text,
    textAlign: 'center',
    marginTop: 4,
  },
  miningLockBody: {
    fontSize: 14,
    color: T.textDim,
    textAlign: 'center',
    lineHeight: 20,
  },
  miningLockBtn: {
    marginTop: 8,
    backgroundColor: T.gold,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  miningLockBtnText: {
    color: '#1C1917',
    fontSize: 14,
    fontWeight: '900',
  },
});

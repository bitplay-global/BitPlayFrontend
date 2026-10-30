import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  ScrollView,
  Dimensions,
  StatusBar,
  Animated,
  Easing,
  Alert,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import { luckyRoll, noteWin, isLuckyRound } from '../services/gameRetryCredits';
import { useFreeRetries } from '../hooks/useFreeRetries';
import GameRulesNote from '../components/GameRulesNote';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import SpinWheel from '../components/games/spin/SpinWheel';
import WinBurst from '../components/games/spin/WinBurst';
import { RootStackParamList } from '../components/types';
import { useHashPower } from '../stores/HashPowerStore';
import { useAuth } from '../auth/AuthProvider';
import { useRewardedVideoAd } from '../services/googleAds';
import { useAdConfig } from '../providers/AdConfigProvider';
import { get_data_uri } from '../config/api';
import { capFreeUserTotalMiningPowerGh } from '../utils/miningPowerCap';
import { usePrivilegeMultiplier } from '../hooks/usePrivilegeMultiplier';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BannerAdWithGamFallback } from '../components/ads/BannerAdWithGamFallback';
import { BannerAdSize } from 'react-native-google-mobile-ads';
import { DEFAULT_ADMOB_BANNER_ID } from '../services/adUnitDefaults';

const { width } = Dimensions.get('window');

type SpinHistoryItem = {
  id: string;
  ts: number;
  sliceKey: string;
  label: string;
  gh: number;
  status: 'lose' | 'won_pending' | 'claimed';
};

async function getSpinHistoryForUser(userId: string): Promise<SpinHistoryItem[]> {
  try {
    const res = await fetch(`${get_data_uri('SPIN_HISTORY')}/${userId}`);
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success || !Array.isArray(data.history)) return [];
    return data.history.map((item: any) => ({
      id: String(item.spinId ?? item.id ?? ''),
      ts: Number(item.ts ?? Date.now()),
      sliceKey: String(item.sliceKey ?? ''),
      label: String(item.label ?? 'Spin'),
      gh: Number(item.gh ?? 0),
      status: item.status === 'claimed' ? 'claimed' : item.status === 'lose' ? 'lose' : 'won_pending',
    }));
  } catch {
    return [];
  }
}

async function appendSpinHistoryForUser(userId: string, item: SpinHistoryItem): Promise<void> {
  try {
    await fetch(get_data_uri('SPIN_HISTORY'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        item: {
          spinId: item.id,
          ts: item.ts,
          sliceKey: item.sliceKey,
          label: item.label,
          gh: item.gh,
          status: item.status,
        },
      }),
    });
  } catch {
    // non-blocking
  }
}

async function markSpinHistoryClaimedForUser(userId: string, id: string): Promise<void> {
  try {
    await fetch(get_data_uri('SPIN_HISTORY_CLAIM'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, spinId: id }),
    });
  } catch {
    // non-blocking
  }
}

type ClaimHashpowerResult = { effectiveHp: number; purchasedPh: number };

async function postClaimedHashpowerIncrement(
  userId: string,
  incrementGh: number
): Promise<ClaimHashpowerResult | null> {
  const offset = new Date().getTimezoneOffset();
  const timezone =
    typeof Intl !== 'undefined' && Intl.DateTimeFormat?.().resolvedOptions?.()?.timeZone
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : undefined;

  const body: Record<string, unknown> = {
    user_id: userId,
    hashpower: incrementGh,
    offset,
    game: 'Spin & Win', // counts for the game streak and leaderboard
  };
  if (timezone) {
    body.timezone = timezone;
  }

  const res = await fetch(get_data_uri('USERMININGDETAILS'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success || !data.mining_details) {
    return null;
  }
  const details = data.mining_details;
  const effectiveHp = parseFloat(String(details.effective_hashpower ?? details.hashpower ?? '0'));
  const purchasedPh = parseFloat(String(details.purchasedHashpower ?? '0'));
  if (Number.isNaN(effectiveHp)) {
    return null;
  }
  return { effectiveHp, purchasedPh: Number.isNaN(purchasedPh) ? 0 : purchasedPh };
}


type SliceKind = 'gh' | 'try_again' | 'double';

type WheelSlice = {
  key: string;
  kind: SliceKind;
  /** Gh/s credited when claimed (double slice uses marketing 2× on 10 base). */
  gh: number;
  /** Short label on wheel */
  line1: string;
  line2: string;
  weight: number;
  fill: string;
  fillAlt: string;
};

/** Six slices — two “Try again” for higher miss rate; 2× awards 1 Gh/s. */
export const SLICES: WheelSlice[] = [
  { key: '5', kind: 'gh', gh: 5, line1: '5', line2: 'GH', weight: 14, fill: '#2A1548', fillAlt: '#321A55' },
  { key: 't1', kind: 'try_again', gh: 0, line1: 'TRY', line2: 'AGAIN', weight: 26, fill: '#352050', fillAlt: '#3D2558' },
  { key: '10', kind: 'gh', gh: 5, line1: '5', line2: 'GH', weight: 12, fill: '#2A1548', fillAlt: '#321A55' },
  { key: 't2', kind: 'try_again', gh: 0, line1: 'TRY', line2: 'AGAIN', weight: 22, fill: '#352050', fillAlt: '#3D2558' },
  { key: '25', kind: 'gh', gh: 3, line1: '3', line2: 'GH', weight: 5, fill: '#2A1548', fillAlt: '#321A55' },
  {
    key: '2x',
    kind: 'double',
    gh: 1,
    line1: '1',
    line2: 'GH',
    weight: 2,
    fill: '#4A3010',
    fillAlt: '#5C3A12',
  },
];

/** Legend colours, in slice order (match SpinWheel's palette). */
const LEGEND_COLORS = ['#8B5CF6', '#22D3EE', '#C026D3', '#FBBF24'];

type Phase = 'idle' | 'spinning' | 'won_pending' | 'lost';

function pickWeightedIndex(): number {
  const total = SLICES.reduce((s, z) => s + z.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < SLICES.length; i++) {
    r -= SLICES[i].weight;
    if (r <= 0) return i;
  }
  return SLICES.length - 1;
}


function isSameLocalDay(ts: number, now: Date): boolean {
  const d = new Date(ts);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

type Nav = StackNavigationProp<RootStackParamList, 'SpinAndWin'>;

const SpinAndWinScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { hashPower, addHashPower, setHashPower, purchasedHashpowerGh, setPurchasedHashpowerGh, isMiningActive: storeMiningActive } = useHashPower();
  const { ads } = useAdConfig();
  const privilegeMultiplier = usePrivilegeMultiplier(user?.id);

  const displayMiningPowerGh = useMemo(
    () => capFreeUserTotalMiningPowerGh(hashPower, purchasedHashpowerGh, privilegeMultiplier > 1),
    [hashPower, purchasedHashpowerGh, privilegeMultiplier],
  );

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

  const [phase, setPhase] = useState<Phase>('idle');
  const [banner, setBanner] = useState<string | null>(null);
  const [wonGh, setWonGh] = useState<number | null>(null);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const [rewardPill, setRewardPill] = useState<string>('Spin to win');
  const [rewardAmountLine, setRewardAmountLine] = useState<string>('—');
  const [spinHistory, setSpinHistory] = useState<SpinHistoryItem[]>([]);
  const [bannerAdError, setBannerAdError] = useState(false);

  // A single failed request shouldn't permanently switch to the house ad —
  // retry AdMob periodically so we recover once it starts filling again.
  useEffect(() => {
    if (!bannerAdError) return;
    const timer = setTimeout(() => setBannerAdError(false), 60000);
    return () => clearTimeout(timer);
  }, [bannerAdError]);

  const spinAnim = useRef(new Animated.Value(0)).current;
  const rotationRef = useRef(0);
  const pendingWinGh = useRef<number | null>(null);
  const pendingHistoryId = useRef<string | null>(null);
  const lastGrantedGh = useRef(-1);
  const retryEarnedRef = useRef(false);

  const resultScale = useRef(new Animated.Value(0.94)).current;
  const hubPulse = useRef(new Animated.Value(0)).current;
  const amountScale = useRef(new Animated.Value(0.3)).current;
  const [burstKey, setBurstKey] = useState(0);

  const n = SLICES.length;
  const segmentAngle = 360 / n;
  const wheelSize = Math.min(width - 48, 340);
  const hubSize = Math.round(wheelSize * 0.3);

  const refreshSpinHistory = useCallback(async () => {
    if (!user?.id) {
      setSpinHistory([]);
      return;
    }
    const rows = await getSpinHistoryForUser(user.id);
    setSpinHistory(rows);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void refreshSpinHistory();
    }, [refreshSpinHistory]),
  );

  const onClaimAdReward = useCallback(
    async (_amount: number, _type: string) => {
      const gh = pendingWinGh.current;
      if (gh == null) return;
      if (!user?.id) return;
      pendingWinGh.current = null;
      lastGrantedGh.current = gh;
      const historyId = pendingHistoryId.current;

      try {
        const result = await postClaimedHashpowerIncrement(user.id, gh);
        if (result != null) {
          setPurchasedHashpowerGh(result.purchasedPh);
          setHashPower(result.effectiveHp);
        } else {
          addHashPower(gh);
        }
      } catch {
        addHashPower(gh);
      }

      if (historyId) {
        await markSpinHistoryClaimedForUser(user.id, historyId);
        setSpinHistory(prev =>
          prev.map(entry => (entry.id === historyId ? { ...entry, status: 'claimed' } : entry)),
        );
      }
    },
    [user?.id, addHashPower, setHashPower, setPurchasedHashpowerGh],
  );

  // Losses retry for free a few times before one needs a video (services/gameRetryCredits.ts).
  const freeRetry = useFreeRetries('Spin & Win');

  const onClaimAdClosed = useCallback(() => {
    const g = lastGrantedGh.current;
    if (g >= 0) freeRetry.reset();
    setPhase('idle');
    setWonGh(null);
    setWinnerIndex(null);
    setRewardPill('Spin to win');
    setRewardAmountLine('—');
    setBanner(g >= 0 ? `+${g} Gh/s is now in your mining power.` : null);
    pendingHistoryId.current = null;
    lastGrantedGh.current = -1;
  }, [freeRetry]);

  const {
    show: showClaimAd,
    loading: claimAdLoading,
    loaded: claimAdLoaded,
  } = useRewardedVideoAd(onClaimAdReward, { primaryUnitId: ads.rewardedVideoId }, onClaimAdClosed);

  const onRetryAdReward = useCallback(() => {
    retryEarnedRef.current = true;
    freeRetry.reset();
  }, [freeRetry]);

  const onRetryAdClosed = useCallback(() => {
    if (retryEarnedRef.current) {
      retryEarnedRef.current = false;
      setPhase('idle');
      setWinnerIndex(null);
      setRewardPill('Spin to win');
      setRewardAmountLine('—');
      setBanner(isLuckyRound('Spin & Win') ? 'Video complete — lucky spin, better odds!' : 'Video complete — spin again!');
    } else {
      Alert.alert('Ad not completed', 'Please watch the full video to spin again.');
    }
  }, []);

  const {
    show: showRetryAd,
    loading: retryAdLoading,
    loaded: retryAdLoaded,
  } = useRewardedVideoAd(onRetryAdReward, { primaryUnitId: ads.rewardedVideoId }, onRetryAdClosed);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(hubPulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(hubPulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [hubPulse]);

  useEffect(() => {
    if (phase === 'won_pending' || phase === 'lost') {
      resultScale.setValue(0.9);
      Animated.spring(resultScale, {
        toValue: 1,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }).start();
    }
    if (phase === 'won_pending') {
      amountScale.setValue(0.3);
      Animated.spring(amountScale, {
        toValue: 1,
        friction: 4,
        tension: 70,
        useNativeDriver: true,
      }).start();
      setBurstKey(k => k + 1);
    }
  }, [phase, resultScale, amountScale]);

  // Breathing glow only while the SPIN button is ready.
  const hubScale = hubPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, phase === 'idle' ? 1.06 : 1],
  });
  const hubGlowOpacity = hubPulse.interpolate({
    inputRange: [0, 1],
    outputRange: phase === 'idle' ? [0.25, 0.75] : [0.15, 0.15],
  });

  const updateRewardCard = (idx: number, gh: number | null, kind: 'win' | 'lose' | 'idle') => {
    if (kind === 'idle') {
      setRewardPill('Spin to win');
      setRewardAmountLine('—');
      return;
    }
    if (kind === 'lose') {
      setRewardPill('No prize');
      setRewardAmountLine('Try again');
      return;
    }
    const slice = SLICES[idx];
    if (slice.kind === 'double') {
      setRewardPill('2× Reward (1 Gh)');
    } else {
      setRewardPill(`${slice.gh} Gh × 1`);
    }
    setRewardAmountLine(gh != null ? `+${gh} Gh/s (pending)` : '—');
  };

  const runSpin = () => {
    if (isMiningActive === false) {
      Alert.alert(
        'Mining Not Active',
        'You need to start mining before you can play Spin and Win. Go back to the home screen and activate mining first.',
        [{ text: 'OK' }],
      );
      return;
    }
    if (phase !== 'idle') return;

    const winnerIdx = luckyRoll('Spin & Win', pickWeightedIndex, i => SLICES[i].kind === 'try_again');
    const centerPhi = winnerIdx * segmentAngle;
    const fullTurns = 7;
    const currentVisual = rotationRef.current % 360;
    const targetVisual = (360 - centerPhi) % 360;
    const delta = (targetVisual - currentVisual + 360) % 360;
    const target = rotationRef.current + fullTurns * 360 + delta;

    setPhase('spinning');
    setBanner(null);
    setWonGh(null);
    setWinnerIndex(null);
    pendingHistoryId.current = null;
    updateRewardCard(0, null, 'idle');

    spinAnim.stopAnimation();
    spinAnim.setValue(rotationRef.current);

    // Short wind-back, then a long spin that eases into a slow, tense crawl.
    Animated.sequence([
      Animated.timing(spinAnim, {
        toValue: rotationRef.current - 10,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(spinAnim, {
        toValue: target,
        duration: 5200,
        easing: Easing.bezier(0.2, 0.75, 0.12, 1),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      rotationRef.current = target % 360000;
      spinAnim.setValue(rotationRef.current);

      if (!finished) {
        setPhase('idle');
        return;
      }

      setWinnerIndex(winnerIdx);
      const slice = SLICES[winnerIdx];
      const historyId = `${Date.now()}_${slice.key}`;

      if (slice.kind === 'try_again') {
        setPhase('lost');
        updateRewardCard(winnerIdx, null, 'lose');
        const historyRow: SpinHistoryItem = {
          id: historyId,
          ts: Date.now(),
          sliceKey: slice.key,
          label: 'Try Again',
          gh: 0,
          status: 'lose',
        };
        setSpinHistory(prev => [historyRow, ...prev].slice(0, 100));
        if (user?.id) {
          void appendSpinHistoryForUser(user.id, historyRow);
        }
      } else {
        pendingWinGh.current = slice.gh;
        noteWin('Spin & Win');
        pendingHistoryId.current = historyId;
        setWonGh(slice.gh);
        setPhase('won_pending');
        updateRewardCard(winnerIdx, slice.gh, 'win');
        const historyRow: SpinHistoryItem = {
          id: historyId,
          ts: Date.now(),
          sliceKey: slice.key,
          label: slice.kind === 'double' ? '2× Reward' : `${slice.gh} GH`,
          gh: slice.gh,
          status: 'won_pending',
        };
        setSpinHistory(prev => [historyRow, ...prev].slice(0, 100));
        if (user?.id) {
          void appendSpinHistoryForUser(user.id, historyRow);
        }
      }
    });
  };

  const openClaimAd = () => {
    if (pendingWinGh.current == null && wonGh == null) return;
    if (!claimAdLoaded) {
      // Kick a fresh request instead of only apologising -- a failed load
      // otherwise leaves this button permanently useless.
      showClaimAd();
      Alert.alert('Almost ready', 'The reward video is still loading. Try again in a few seconds.');
      return;
    }
    showClaimAd();
  };

  const openRetryAd = () => {
    if (freeRetry.tryFree()) {
      setPhase('idle');
      setWinnerIndex(null);
      setRewardPill('Spin to win');
      setRewardAmountLine('—');
      setBanner(isLuckyRound('Spin & Win') ? 'Lucky spin — better odds this time!' : null);
      return;
    }
    if (!retryAdLoaded) {
      // Kick a fresh request instead of only apologising -- a failed load
      // otherwise leaves this button permanently useless.
      showRetryAd();
      Alert.alert('Almost ready', 'The video is still loading. Try again in a few seconds.');
      return;
    }
    showRetryAd();
  };

  const canSpin = phase === 'idle';
  const showOutcomeCard = phase === 'won_pending';
  const totalClaimedFromSpinner = useMemo(
    () => spinHistory.filter(item => item.status === 'claimed').reduce((sum, item) => sum + item.gh, 0),
    [spinHistory],
  );
  const todayStats = useMemo(() => {
    const now = new Date();
    const today = spinHistory.filter(item => isSameLocalDay(item.ts, now));
    return { spins: today.length, wins: today.filter(item => item.status !== 'lose').length };
  }, [spinHistory]);
  const isLuckyBanner = banner != null && /lucky/i.test(banner);

  /** RN SafeAreaView is unreliable for top inset on some Android builds; combine inset + status bar height. */
  const scrollPaddingTop =
    Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight ?? 0) + 10 : 0;

  /** Space so last content clears the fixed bottom banner (~adaptive banner + safe area). */
  const scrollBottomPad = 88 + insets.bottom;

  const stageSize = wheelSize + 28;

  return (
    <LinearGradient colors={['#050914', '#0A0F1C', '#0f172a']} style={styles.root} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safe}>
        {/* Top Banner Ad */}
        <BannerAdWithGamFallback
          primaryUnitId={ads.homeBannerId ?? DEFAULT_ADMOB_BANNER_ID}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        />
        <View style={styles.screenBody}>
          {isMiningActive === false && (
            <View style={styles.miningLockOverlay} pointerEvents="box-none">
              <View style={styles.miningLockCard}>
                <View style={styles.miningLockIcon}>
                  <Icon name="pickaxe" size={30} color="#FBBF24" />
                </View>
                <Text style={styles.miningLockTitle}>Mining Not Active</Text>
                <Text style={styles.miningLockBody}>
                  Start mining on the home screen to unlock Spin and Win.
                </Text>
                <TouchableOpacity style={styles.miningLockBtn} onPress={() => navigation.goBack()}>
                  <Text style={styles.miningLockBtnText}>Start Mining</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scroll,
              scrollPaddingTop > 0 && { paddingTop: scrollPaddingTop },
              { paddingBottom: scrollBottomPad },
            ]}
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled">
            {/* Header */}
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn} hitSlop={10}>
                <Icon name="close" size={22} color="#F8FAFC" />
              </TouchableOpacity>
              <View style={styles.headerCenter}>
                <Text style={styles.headerEyebrow}>BITPLAY ARCADE</Text>
                <Text style={styles.headerTitle}>
                  Spin <Text style={styles.headerTitleAccent}>&</Text> Win
                </Text>
              </View>
              <View style={styles.headerSpacer} />
            </View>
            <Text style={styles.tagline}>Spin the wheel and boost your mining power</Text>

            {/* Stats strip */}
            <View style={styles.statsRow}>
              <StatTile icon="rotate-right" color="#18D4F2" label="Spins today" value={String(todayStats.spins)} />
              <StatTile icon="trophy-variant" color="#FBBF24" label="Wins today" value={String(todayStats.wins)} />
              <StatTile icon="lightning-bolt" color="#4ADE80" label="Claimed GH/s" value={`+${totalClaimedFromSpinner}`} />
            </View>

            {/* Current prize display */}
            <View style={styles.prizeBar}>
              <View style={styles.prizeCoin}>
                <Icon name="bitcoin" size={22} color="#FBBF24" />
              </View>
              <View style={styles.prizeTextCol}>
                <Text style={styles.addedLabel}>Added to mining power</Text>
                <Text style={styles.rewardBig} numberOfLines={1} adjustsFontSizeToFit>
                  {rewardAmountLine}
                </Text>
              </View>
              <LinearGradient colors={['#FBBF24', '#D97706']} style={styles.rewardPill}>
                <View style={styles.rewardPillInner}>
                  <Text style={styles.rewardPillText} numberOfLines={1}>
                    {rewardPill}
                  </Text>
                </View>
              </LinearGradient>
            </View>

            {banner ? (
              <View style={[styles.banner, isLuckyBanner && styles.bannerLucky]}>
                <Icon
                  name={isLuckyBanner ? 'clover' : 'check-circle'}
                  size={18}
                  color={isLuckyBanner ? '#FBBF24' : '#4ADE80'}
                />
                <Text style={[styles.bannerText, isLuckyBanner && styles.bannerTextLucky]}>{banner}</Text>
              </View>
            ) : null}

            {/* Wheel stage */}
            <View style={[styles.stage, { height: stageSize }]}>
              <Svg width={stageSize} height={stageSize} style={styles.stageGlow}>
                <Defs>
                  <RadialGradient id="stageGlow" cx="50%" cy="50%" r="50%">
                    <Stop offset="0.55" stopColor="#7c3aed" stopOpacity="0.45" />
                    <Stop offset="0.8" stopColor="#18D4F2" stopOpacity="0.12" />
                    <Stop offset="1" stopColor="#050914" stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                <Circle cx={stageSize / 2} cy={stageSize / 2} r={stageSize / 2} fill="url(#stageGlow)" />
              </Svg>

              <SpinWheel size={wheelSize} slices={SLICES} spinAnim={spinAnim} phase={phase} winnerIndex={winnerIndex}>
                <Animated.View
                  pointerEvents="box-none"
                  style={[styles.hubWrap, { width: hubSize, height: hubSize, transform: [{ scale: hubScale }] }]}>
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.hubGlow,
                      {
                        width: hubSize * 1.4,
                        height: hubSize * 1.4,
                        borderRadius: hubSize * 0.7,
                        opacity: hubGlowOpacity,
                      },
                    ]}
                  />
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={runSpin}
                    disabled={!canSpin}
                    accessibilityRole="button"
                    accessibilityLabel="Spin the wheel"
                    style={[styles.hubTouchable, { borderRadius: hubSize / 2 }, !canSpin && styles.hubTouchableDisabled]}>
                    <LinearGradient
                      colors={['#FEF3C7', '#F59E0B', '#B45309']}
                      start={{ x: 0.2, y: 0 }}
                      end={{ x: 0.8, y: 1 }}
                      style={[StyleSheet.absoluteFill, { borderRadius: hubSize / 2 }]}
                    />
                    <View style={[styles.hubCore, { borderRadius: hubSize / 2 }]}>
                      <LinearGradient
                        colors={['#1E1B4B', '#0A0F1C']}
                        style={[StyleSheet.absoluteFill, { borderRadius: hubSize / 2 }]}
                      />
                      {phase === 'spinning' ? (
                        <ActivityIndicator color="#18D4F2" />
                      ) : (
                        <>
                          <Text style={styles.hubSpinText}>SPIN</Text>
                          <Text style={styles.hubSubText}>{canSpin ? 'TAP' : '•••'}</Text>
                        </>
                      )}
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              </SpinWheel>

              <WinBurst size={wheelSize * 1.1} trigger={burstKey} />
            </View>

            {phase === 'idle' || phase === 'spinning' ? (
              <Text style={styles.stageHint}>
                {phase === 'spinning' ? 'Good luck…' : 'Tap SPIN to try your luck'}
              </Text>
            ) : null}

            {showOutcomeCard ? (
              <Animated.View style={[styles.outcomeCard, styles.outcomeCardWin, { transform: [{ scale: resultScale }] }]}>
                <LinearGradient colors={['#3B2A06', '#1A1030', '#0A0F1C']} style={styles.outcomeGradient}>
                  <View style={styles.outcomeInner}>
                    <View style={styles.eyebrowRow}>
                      <Icon name="trophy-variant" size={16} color="#FBBF24" />
                      <Text style={styles.winEyebrow}>YOU WON</Text>
                      <Icon name="trophy-variant" size={16} color="#FBBF24" />
                    </View>
                    <Animated.View style={[styles.winAmountRow, { transform: [{ scale: amountScale }] }]}>
                      <Text style={styles.winAmount}>+{wonGh}</Text>
                      <Text style={styles.winUnit}>GH/s</Text>
                    </Animated.View>
                    <Text style={styles.outcomeBody}>Watch the video to add it to your mining power.</Text>
                    <TouchableOpacity style={styles.adBtn} onPress={openClaimAd} disabled={claimAdLoading && !claimAdLoaded}>
                      <LinearGradient colors={['#FDE68A', '#FBBF24', '#D97706']} style={styles.adBtnGrad}>
                        <View style={styles.adBtnInner}>
                          {claimAdLoading && !claimAdLoaded ? (
                            <ActivityIndicator color="#1C1917" />
                          ) : (
                            <>
                              <Icon name="play-circle" size={22} color="#1C1917" />
                              <Text style={styles.adBtnTextDark}>Watch & claim</Text>
                            </>
                          )}
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </Animated.View>
            ) : null}

            {phase === 'lost' ? (
              <Animated.View style={[styles.outcomeCard, styles.outcomeCardLose, { transform: [{ scale: resultScale }] }]}>
                <LinearGradient colors={['#2A1022', '#140B24', '#0A0F1C']} style={styles.outcomeGradient}>
                  <View style={styles.outcomeInner}>
                    <View style={styles.loseIcon}>
                      <Icon name="emoticon-sad-outline" size={26} color="#F87171" />
                    </View>
                    <Text style={styles.loseEyebrow}>SO CLOSE!</Text>
                    <Text style={styles.outcomeTitle}>Try Again!</Text>
                    <Text style={styles.outcomeBody}>{freeRetry.left > 0 ? `Try again for free — ${freeRetry.left} free ${freeRetry.left === 1 ? 'retry' : 'retries'} left before a short video.` : 'Watch a short video to spin again.'}</Text>
                    <TouchableOpacity style={styles.adBtn} onPress={openRetryAd} disabled={freeRetry.left === 0 && retryAdLoading && !retryAdLoaded}>
                      <LinearGradient
                        colors={freeRetry.left > 0 ? ['#8B5CF6', '#6D28D9'] : ['#EF4444', '#B91C1C']}
                        style={styles.adBtnGrad}>
                        <View style={styles.adBtnInner}>
                          {freeRetry.left === 0 && retryAdLoading && !retryAdLoaded ? (
                            <ActivityIndicator color="#FFF" />
                          ) : (
                            <>
                              <Icon name={freeRetry.left > 0 ? 'refresh' : 'play-circle'} size={22} color="#FFF" />
                              <Text style={styles.adBtnTextLight}>{freeRetry.left > 0 ? 'Spin Again' : 'Watch & Spin Again'}</Text>
                            </>
                          )}
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </Animated.View>
            ) : null}

            {/* Prize legend */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Icon name="gift-outline" size={18} color="#18D4F2" />
                <Text style={styles.cardTitle}>Prizes on the wheel</Text>
              </View>
              <View style={styles.legendWrap}>
                {SLICES.filter(s => s.kind !== 'try_again').map((s, i) => (
                  <View key={s.key} style={styles.legendChip}>
                    <View style={[styles.legendDot, { backgroundColor: LEGEND_COLORS[i % LEGEND_COLORS.length] }]} />
                    <Text style={styles.legendText}>{s.kind === 'double' ? `2× · ${s.gh} GH/s` : `${s.gh} GH/s`}</Text>
                  </View>
                ))}
                <View style={styles.legendChip}>
                  <View style={[styles.legendDot, styles.legendDotMuted]} />
                  <Text style={[styles.legendText, styles.legendTextMuted]}>Try again</Text>
                </View>
              </View>
            </View>

            {/* History */}
            <View style={styles.card}>
              <View style={styles.historyHeaderRow}>
                <View style={styles.cardHeaderRow}>
                  <Icon name="history" size={18} color="#18D4F2" />
                  <Text style={styles.cardTitle}>Spin History</Text>
                </View>
                <View style={styles.claimedBadge}>
                  <Text style={styles.claimedBadgeText} numberOfLines={1}>
                    Claimed total: +{totalClaimedFromSpinner} Gh/s
                  </Text>
                </View>
              </View>
              {spinHistory.length === 0 ? (
                <View style={styles.historyEmptyWrap}>
                  <Icon name="ticket-percent" size={28} color="#334155" />
                  <Text style={styles.historyEmpty}>No spins yet. Your results will show up here.</Text>
                </View>
              ) : (
                spinHistory.slice(0, 20).map((item, idx, arr) => {
                  const isLost = item.status === 'lose';
                  const isClaimed = item.status === 'claimed';
                  const tone = isClaimed ? '#4ADE80' : isLost ? '#F87171' : '#F59E0B';
                  return (
                    <View key={item.id} style={[styles.historyRow, idx === arr.length - 1 && styles.historyRowLast]}>
                      <View style={[styles.historyIcon, { backgroundColor: `${tone}1F`, borderColor: `${tone}55` }]}>
                        <Icon
                          name={isClaimed ? 'check' : isLost ? 'close' : 'clock-outline'}
                          size={16}
                          color={tone}
                        />
                      </View>
                      <View style={styles.historyLeft}>
                        <Text style={styles.historyLabel} numberOfLines={1}>{item.label}</Text>
                        <Text style={styles.historyDate} numberOfLines={1}>{new Date(item.ts).toLocaleString()}</Text>
                      </View>
                      <View style={styles.historyRight}>
                        <Text style={[styles.historyAmount, isLost && styles.historyAmountLost]}>+{item.gh} Gh/s</Text>
                        <Text style={[styles.historyStatus, { color: tone }]}>
                          {isClaimed ? 'Claimed' : isLost ? 'Lost' : 'Pending'}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            <Text style={styles.footerHint}>Win: 5 Gh/s (×2 slots) · 3 Gh/s · 2× reward (1 Gh/s) · Try again</Text>
            <GameRulesNote game="Spin & Win" prizes="5 GH/s, 3 GH/s, 2× reward (1 GH/s) or Try again" />
          </ScrollView>

          <View style={[styles.bannerWrapper, { paddingBottom: insets.bottom }]}>
            <View style={styles.bannerContainer}>
              {bannerAdError ? (
                <TouchableOpacity onPress={() => Linking.openURL('https://thecaphevietnam.com/')}>
                  <Image
                    source={require('../assets/images/addbanner.png')}
                    style={{ width, height: 60, resizeMode: 'stretch' }}
                  />
                </TouchableOpacity>
              ) : (
                <BannerAdWithGamFallback
                  primaryUnitId={ads.homeBannerId ?? DEFAULT_ADMOB_BANNER_ID}
                  size={BannerAdSize.ADAPTIVE_BANNER}
                  onAllFailed={() => setBannerAdError(true)}
                />
              )}
            </View>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const StatTile: React.FC<{ icon: string; color: string; label: string; value: string }> = ({
  icon,
  color,
  label,
  value,
}) => (
  <View style={styles.statTile}>
    <View style={[styles.statIcon, { backgroundColor: `${color}1A` }]}>
      <Icon name={icon} size={16} color={color} />
    </View>
    <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
      {value}
    </Text>
    <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>
      {label}
    </Text>
  </View>
);

const CARD_BG = 'rgba(15,23,42,0.78)';
const CARD_BORDER = 'rgba(148,163,184,0.14)';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050914' },
  safe: { flex: 1 },
  screenBody: {
    flex: 1,
    position: 'relative',
  },
  scrollView: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 18,
    paddingBottom: 36,
  },
  bannerWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#050914',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148,163,184,0.18)',
    paddingHorizontal: 0,
    alignItems: 'center',
  },
  bannerContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { width: 40 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#18D4F2',
    letterSpacing: 2.5,
  },
  headerTitle: {
    marginTop: 2,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(124,58,237,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  headerTitleAccent: { color: '#FBBF24' },
  tagline: {
    marginTop: 4,
    marginBottom: 14,
    textAlign: 'center',
    fontSize: 13,
    color: '#94A3B8',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statTile: {
    flex: 1,
    minWidth: 0,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  statLabel: {
    marginTop: 2,
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },

  // Prize bar
  prizeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(10,15,28,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.35)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  prizeCoin: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prizeTextCol: {
    flex: 1,
    minWidth: 0,
  },
  addedLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  rewardBig: {
    marginTop: 1,
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  rewardPill: {
    borderRadius: 999,
    overflow: 'hidden',
    flexShrink: 0,
    maxWidth: '48%',
  },
  /** Padding on LinearGradient breaks iOS pill sizing; inner View owns insets. */
  rewardPillInner: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardPillText: {
    color: '#1C1917',
    fontSize: 12,
    fontWeight: '900',
  },

  // Banner
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.35)',
  },
  bannerLucky: {
    backgroundColor: 'rgba(251,191,36,0.1)',
    borderColor: 'rgba(251,191,36,0.45)',
  },
  bannerText: { flex: 1, color: '#DCFCE7', fontSize: 13, fontWeight: '600' },
  bannerTextLucky: { color: '#FEF3C7' },

  // Wheel stage
  stage: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  stageGlow: {
    position: 'absolute',
  },
  hubWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  hubGlow: {
    position: 'absolute',
    backgroundColor: 'rgba(24,212,242,0.22)',
    borderWidth: 2,
    borderColor: 'rgba(24,212,242,0.55)',
  },
  hubTouchable: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
  },
  hubTouchableDisabled: {
    opacity: 0.6,
  },
  hubCore: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: 5,
    bottom: 5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(24,212,242,0.45)',
  },
  hubSpinText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FDE68A',
    letterSpacing: 2,
    textShadowColor: 'rgba(245,158,11,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  hubSubText: {
    marginTop: 1,
    fontSize: 9,
    fontWeight: '800',
    color: '#18D4F2',
    letterSpacing: 2,
  },
  stageHint: {
    marginTop: 4,
    marginBottom: 6,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.3,
  },

  // Outcome cards
  outcomeCard: {
    marginTop: 8,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1.5,
    alignSelf: 'stretch',
  },
  outcomeCardWin: { borderColor: 'rgba(251,191,36,0.7)' },
  outcomeCardLose: { borderColor: 'rgba(248,113,113,0.35)' },
  /** Padding on LinearGradient breaks iOS layout; keep gradient full-width and pad inner View. */
  outcomeGradient: {
    width: '100%',
    alignSelf: 'stretch',
  },
  outcomeInner: {
    paddingHorizontal: 18,
    paddingVertical: 18,
    alignItems: 'center',
    width: '100%',
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  winEyebrow: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FBBF24',
    letterSpacing: 3,
  },
  winAmountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 4,
  },
  winAmount: {
    fontSize: 46,
    fontWeight: '900',
    color: '#FEF3C7',
    letterSpacing: -1,
    textShadowColor: 'rgba(245,158,11,0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  winUnit: {
    marginLeft: 6,
    marginBottom: 9,
    fontSize: 18,
    fontWeight: '900',
    color: '#FBBF24',
  },
  loseIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  loseEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    color: '#F87171',
    letterSpacing: 2.5,
    marginBottom: 2,
  },
  outcomeTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFF',
    textAlign: 'center',
  },
  outcomeBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#CBD5E1',
    textAlign: 'center',
    marginBottom: 16,
  },
  adBtn: {
    alignSelf: 'stretch',
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  /** Gradient layer only — padding/layout on LinearGradient breaks iOS sizing. */
  adBtnGrad: {
    width: '100%',
    alignSelf: 'stretch',
  },
  adBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 50,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  adBtnTextDark: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1C1917',
  },
  adBtnTextLight: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },

  // Cards (legend + history)
  card: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: CARD_BG,
    padding: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
  },
  legendWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendDotMuted: { backgroundColor: '#334155' },
  legendText: { color: '#E2E8F0', fontSize: 12, fontWeight: '700' },
  legendTextMuted: { color: '#94A3B8' },
  footerHint: {
    marginTop: 18,
    textAlign: 'center',
    fontSize: 11,
    color: 'rgba(148,163,184,0.7)',
    lineHeight: 16,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  claimedBadge: {
    backgroundColor: 'rgba(74,222,128,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.35)',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    flexShrink: 1,
  },
  claimedBadgeText: {
    color: '#bbf7d0',
    fontSize: 11,
    fontWeight: '700',
  },
  historyEmptyWrap: {
    alignItems: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  historyEmpty: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.18)',
  },
  historyRowLast: {
    borderBottomWidth: 0,
  },
  historyIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  historyLeft: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },
  historyLabel: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  historyDate: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  historyRight: {
    alignItems: 'flex-end',
  },
  historyAmount: {
    color: '#FDE68A',
    fontSize: 13,
    fontWeight: '800',
  },
  historyAmountLost: {
    color: '#64748B',
  },
  historyStatus: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
  },

  // Mining lock
  miningLockOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    backgroundColor: 'rgba(5,9,20,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  miningLockCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(251,191,36,0.45)',
    padding: 26,
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  miningLockIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(251,191,36,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
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
    color: '#CBD5E1',
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

export default SpinAndWinScreen;

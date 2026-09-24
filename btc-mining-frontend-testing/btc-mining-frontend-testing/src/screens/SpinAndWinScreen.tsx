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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, G, Text as SvgText, Rect } from 'react-native-svg';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
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

async function incrementDailyVideoForUser(userId: string): Promise<void> {
  try {
    await fetch(`${get_data_uri('USERMININGDETAILS')}/increment-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: userId }),
    });
  } catch {
    /* non-blocking */
  }
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

const HIGHLIGHT = '#8B5CF6';
const SLICE_STROKE = 'rgba(251,191,36,0.15)';


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


function pointOnWheel(cx: number, cy: number, r: number, phiCwFromTopDeg: number) {
  const rad = (phiCwFromTopDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.sin(rad),
    y: cy - r * Math.cos(rad),
  };
}

function slicePath(cx: number, cy: number, r: number, startPhi: number, endPhi: number): string {
  const p0 = pointOnWheel(cx, cy, r, startPhi);
  const p1 = pointOnWheel(cx, cy, r, endPhi);
  let delta = endPhi - startPhi;
  if (delta < 0) delta += 360;
  const largeArc = delta > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${p0.x} ${p0.y} A ${r} ${r} 0 ${largeArc} 1 ${p1.x} ${p1.y} Z`;
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

  const n = SLICES.length;
  const segmentAngle = 360 / n;
  const wheelSize = Math.min(width - 36, 360);
  const cx = wheelSize / 2;
  const cy = wheelSize / 2;
  const r = wheelSize / 2 - 6;
  const hubSize = Math.round(wheelSize * 0.36);

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

      await incrementDailyVideoForUser(user.id);
      if (historyId) {
        await markSpinHistoryClaimedForUser(user.id, historyId);
        setSpinHistory(prev =>
          prev.map(entry => (entry.id === historyId ? { ...entry, status: 'claimed' } : entry)),
        );
      }
    },
    [user?.id, addHashPower, setHashPower, setPurchasedHashpowerGh],
  );

  const onClaimAdClosed = useCallback(() => {
    const g = lastGrantedGh.current;
    setPhase('idle');
    setWonGh(null);
    setWinnerIndex(null);
    setRewardPill('Spin to win');
    setRewardAmountLine('—');
    setBanner(g >= 0 ? `+${g} Gh/s is now in your mining power.` : null);
    pendingHistoryId.current = null;
    lastGrantedGh.current = -1;
  }, []);

  const {
    show: showClaimAd,
    loading: claimAdLoading,
    loaded: claimAdLoaded,
  } = useRewardedVideoAd(onClaimAdReward, { primaryUnitId: ads.rewardedVideoId }, onClaimAdClosed);

  const onRetryAdReward = useCallback(() => {
    retryEarnedRef.current = true;
  }, []);

  const onRetryAdClosed = useCallback(() => {
    if (retryEarnedRef.current) {
      retryEarnedRef.current = false;
      setPhase('idle');
      setWinnerIndex(null);
      setRewardPill('Spin to win');
      setRewardAmountLine('—');
      setBanner('Video complete — spin again!');
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
        Animated.timing(hubPulse, { toValue: 1, duration: 4600, useNativeDriver: true }),
        Animated.timing(hubPulse, { toValue: 0, duration: 4600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [hubPulse]);

  useEffect(() => {
    if (phase === 'won_pending' || phase === 'lost') {
      resultScale.setValue(0.94);
      Animated.spring(resultScale, {
        toValue: 1,
        friction: 8,
        tension: 88,
        useNativeDriver: true,
      }).start();
    }
  }, [phase, resultScale]);

  const spinInterpolate = useMemo(() => {
    const maxDeg = 2_000_000;
    return spinAnim.interpolate({
      inputRange: [0, maxDeg],
      outputRange: ['0deg', `${maxDeg}deg`],
      extrapolate: 'extend',
    });
  }, [spinAnim]);

  const hubScale = hubPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04],
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

    const winnerIdx = pickWeightedIndex();
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

    Animated.timing(spinAnim, {
      toValue: target,
      duration: 4800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
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

  /** RN SafeAreaView is unreliable for top inset on some Android builds; combine inset + status bar height. */
  const scrollPaddingTop =
    Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight ?? 0) + 10 : 0;

  /** Space so last content clears the fixed bottom banner (~adaptive banner + safe area). */
  const scrollBottomPad = 88 + insets.bottom;

  return (
    <LinearGradient colors={['#14082A', '#241043', '#1A0B32']} style={styles.root} start={{ x: 0.2, y: 0 }} end={{ x: 0.9, y: 1 }}>
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
                <Icon name="pickaxe" size={36} color="#FBBF24" />
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
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn} hitSlop={10}>
                <Icon name="close" size={22} color="#F8FAFC" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Spin and Win!</Text>
              <View style={styles.headerSpacer} />
            </View>

            <Text style={styles.multiplyTitle}>Multiply your earnings!</Text>

            <View style={styles.rewardCard}>
              <LinearGradient colors={['#FBBF24', '#D97706']} style={styles.rewardPill}>
                <View style={styles.rewardPillInner}>
                  <Text style={styles.rewardPillText}>{rewardPill}</Text>
                </View>
              </LinearGradient>
              <View style={styles.rewardCardInner}>
                <View style={styles.coinArtWrap}>
                  <Icon name="circle-multiple" size={48} color="#E5E7EB" />
                  <View style={styles.coinAccent}>
                    <Icon name="star-four-points" size={22} color="#FBBF24" />
                  </View>
                </View>
                <View style={styles.rewardTextCol}>
                  <Text style={styles.addedLabel}>Added to mining power</Text>
                  <Text style={styles.rewardBig}>{rewardAmountLine}</Text>
                </View>
              </View>
            </View>

            {/* <View style={styles.hpRow}>
            <Icon name="lightning-bolt" size={18} color="#FBBF24" />
            <Text style={styles.hpRowText}>
              Live mining power:{' '}
              <Text style={styles.hpRowBold}>{displayMiningPowerGh.toFixed(1)} Gh/s</Text>
            </Text>
          </View> */}

            {banner ? (
              <View style={styles.banner}>
                <Icon name="check-circle" size={18} color="#4ADE80" />
                <Text style={styles.bannerText}>{banner}</Text>
              </View>
            ) : null}

            <View style={[styles.wheelOuter, { width: wheelSize, height: wheelSize }]} pointerEvents="box-none">
              <View style={styles.pointerStack} pointerEvents="none">
                <View style={styles.pointerArc} />
                <View style={styles.pointerTriangle} />
              </View>

              <Animated.View
                pointerEvents="none"
                style={[styles.wheelRotate, { transform: [{ rotate: spinInterpolate }] }]}>
                <Svg width={wheelSize} height={wheelSize}>
                  <G>
                    {SLICES.map((slice, i) => {
                      const start = i * segmentAngle - segmentAngle / 2;
                      const end = i * segmentAngle + segmentAngle / 2;
                      const mid = i * segmentAngle;
                      const rim = -r * 0.52;
                      const pillW = 54;
                      const pillH = 40;
                      const fill =
                        winnerIndex === i && (phase === 'won_pending' || phase === 'lost')
                          ? slice.kind === 'try_again'
                            ? '#5B4A6E'
                            : HIGHLIGHT
                          : i % 2 === 0
                            ? slice.fill
                            : slice.fillAlt;
                      return (
                        <G key={slice.key}>
                          <Path d={slicePath(cx, cy, r, start, end)} fill={fill} stroke={SLICE_STROKE} strokeWidth={1} />
                          <G transform={`translate(${cx},${cy}) rotate(${mid}) translate(0, ${rim})`}>
                            <Rect
                              x={-pillW / 2}
                              y={-pillH / 2}
                              width={pillW}
                              height={pillH}
                              rx={11}
                              fill="rgba(0,0,0,0.42)"
                              stroke="rgba(251,191,36,0.4)"
                              strokeWidth={1}
                            />
                            <SvgText
                              x={0}
                              y={slice.kind === 'try_again' ? -7 : -6}
                              fill="#FEFCE8"
                              fontSize={slice.kind === 'try_again' ? 9 : 13}
                              fontWeight="800"
                              textAnchor="middle"
                              alignmentBaseline="middle">
                              {slice.line1}
                            </SvgText>
                            <SvgText
                              x={0}
                              y={slice.kind === 'try_again' ? 9 : 10}
                              fill="#E9D5FF"
                              fontSize={slice.kind === 'try_again' ? 8 : 10}
                              fontWeight="700"
                              textAnchor="middle"
                              alignmentBaseline="middle">
                              {slice.line2}
                            </SvgText>
                          </G>
                        </G>
                      );
                    })}
                  </G>
                </Svg>
              </Animated.View>

              <Animated.View
                pointerEvents="box-none"
                style={[styles.hubTouchableWrap, { width: hubSize, height: hubSize, transform: [{ scale: hubScale }] }]}>
                <TouchableOpacity
                  activeOpacity={0.92}
                  onPress={runSpin}
                  disabled={!canSpin}
                  style={[styles.hubTouchable, !canSpin && styles.hubTouchableDisabled]}>
                  <LinearGradient colors={['#FDE68A', '#F59E0B', '#B45309']} style={styles.hubGrad}>
                    {phase === 'spinning' ? (
                      <ActivityIndicator color="#422006" />
                    ) : (
                      <Text style={styles.hubSpinText}>SPIN</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            </View>

            {showOutcomeCard ? (
              <Animated.View style={[styles.outcomeCard, { transform: [{ scale: resultScale }] }]}>
                <LinearGradient colors={['#2D1B4E', '#1A0F2E']} style={styles.outcomeGradient}>
                  <View style={styles.outcomeInner}>
                    <Text style={styles.outcomeTitle}>You won +{wonGh} Gh/s</Text>
                    <Text style={styles.outcomeBody}>Watch the video to add it to your mining power.</Text>
                    <TouchableOpacity style={styles.adBtn} onPress={openClaimAd} disabled={claimAdLoading && !claimAdLoaded}>
                      <LinearGradient colors={['#FBBF24', '#D97706']} style={styles.adBtnGrad}>
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
              <Animated.View style={[styles.outcomeCard, { transform: [{ scale: resultScale }] }]}>
                <LinearGradient colors={['#2D1020', '#1A0A18']} style={styles.outcomeGradient}>
                  <View style={styles.outcomeInner}>
                    <Icon name="refresh-circle" size={36} color="#F87171" style={{ marginBottom: 6 }} />
                    <Text style={styles.outcomeTitle}>Try Again!</Text>
                    <Text style={styles.outcomeBody}>Watch a short video to spin again.</Text>
                    <TouchableOpacity style={styles.adBtn} onPress={openRetryAd} disabled={retryAdLoading && !retryAdLoaded}>
                      <LinearGradient colors={['#EF4444', '#B91C1C']} style={styles.adBtnGrad}>
                        <View style={styles.adBtnInner}>
                          {retryAdLoading && !retryAdLoaded ? (
                            <ActivityIndicator color="#FFF" />
                          ) : (
                            <>
                              <Icon name="play-circle" size={22} color="#FFF" />
                              <Text style={styles.adBtnTextLight}>Watch & Spin Again</Text>
                            </>
                          )}
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </Animated.View>
            ) : null}

            <View style={styles.historyCard}>
              <View style={styles.historyHeaderRow}>
                <Text style={styles.historyTitle}>Spin History</Text>
                <View style={styles.claimedBadge}>
                  <Text style={styles.claimedBadgeText}>Claimed total: +{totalClaimedFromSpinner} Gh/s</Text>
                </View>
              </View>
              {spinHistory.length === 0 ? (
                <Text style={styles.historyEmpty}>No spins yet.</Text>
              ) : (
                spinHistory.slice(0, 20).map(item => (
                  <View key={item.id} style={styles.historyRow}>
                    <View style={styles.historyLeft}>
                      <Text style={styles.historyLabel}>{item.label}</Text>
                      <Text style={styles.historyDate}>{new Date(item.ts).toLocaleString()}</Text>
                    </View>
                    <View style={styles.historyRight}>
                      <Text style={styles.historyAmount}>+{item.gh} Gh/s</Text>
                      <Text
                        style={[
                          styles.historyStatus,
                          item.status === 'claimed'
                            ? styles.historyStatusClaimed
                            : item.status === 'lose'
                              ? styles.historyStatusLost
                              : styles.historyStatusPending,
                        ]}>
                        {item.status === 'claimed' ? 'Claimed' : item.status === 'lose' ? 'Lost' : 'Pending'}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            <Text style={styles.footerHint}>Win: 5 Gh/s (×2 slots) · 3 Gh/s · 2× reward (1 Gh/s) · Try again</Text>
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

const styles = StyleSheet.create({
  root: { flex: 1 },
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
    backgroundColor: '#241043',
    paddingHorizontal: 0,
    alignItems: 'center',
  },
  bannerContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 6,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { width: 44 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  multiplyTitle: {
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  rewardCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(251,191,36,0.55)',
    backgroundColor: 'rgba(15,8,30,0.75)',
    marginBottom: 14,
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 14,
  },
  rewardPill: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    borderRadius: 999,
    overflow: 'hidden',
  },
  /** Padding on LinearGradient breaks iOS pill sizing; inner View owns insets. */
  rewardPillInner: {
    paddingVertical: 6,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardPillText: {
    color: '#1C1917',
    fontSize: 12,
    fontWeight: '900',
  },
  rewardCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  coinArtWrap: {
    width: 72,
    height: 72,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinAccent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardTextCol: {
    flex: 1,
  },
  addedLabel: {
    fontSize: 13,
    color: '#C4B5FD',
    fontWeight: '600',
  },
  rewardBig: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  hpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  hpRowText: {
    flex: 1,
    fontSize: 13,
    color: '#DDD6FE',
  },
  hpRowBold: {
    fontWeight: '900',
    color: '#FEF3C7',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.35)',
  },
  bannerText: { flex: 1, color: '#DCFCE7', fontSize: 13 },
  wheelOuter: {
    position: 'relative',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pointerStack: {
    position: 'absolute',
    top: 4,
    zIndex: 20,
    alignItems: 'center',
  },
  pointerArc: {
    width: 44,
    height: 22,
    borderTopLeftRadius: 44,
    borderTopRightRadius: 44,
    backgroundColor: 'rgba(251,191,36,0.35)',
    borderWidth: 2,
    borderColor: '#FBBF24',
    borderBottomWidth: 0,
    marginBottom: -2,
  },
  pointerTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 16,
    borderRightWidth: 16,
    borderTopWidth: 24,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FBBF24',
  },
  wheelRotate: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubTouchableWrap: {
    position: 'absolute',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 25,
    elevation: 20,
  },
  hubTouchable: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
  },
  hubTouchableDisabled: {
    opacity: 0.45,
  },
  hubGrad: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  hubSpinText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#422006',
    letterSpacing: 3,
  },
  outcomeCard: {
    marginTop: 0,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.25)',
    alignSelf: 'stretch',
  },
  /** Padding on LinearGradient breaks iOS layout; keep gradient full-width and pad inner View. */
  outcomeGradient: {
    width: '100%',
    alignSelf: 'stretch',
  },
  outcomeInner: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
    width: '100%',
  },
  outcomeTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFF',
    textAlign: 'center',
  },
  outcomeBody: {
    marginTop: 8,
    fontSize: 14,
    color: '#C4B5FD',
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
    minHeight: 48,
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
  footerHint: {
    marginTop: 18,
    textAlign: 'center',
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 16,
  },
  historyCard: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.22)',
    backgroundColor: 'rgba(20,14,36,0.7)',
    padding: 14,
    gap: 10,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  historyTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  claimedBadge: {
    backgroundColor: 'rgba(74,222,128,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.35)',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  claimedBadgeText: {
    color: '#bbf7d0',
    fontSize: 12,
    fontWeight: '700',
  },
  historyEmpty: {
    color: '#c4b5fd',
    fontSize: 13,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  historyLeft: {
    flex: 1,
    paddingRight: 10,
  },
  historyLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  historyDate: {
    color: '#a78bfa',
    fontSize: 11,
    marginTop: 2,
  },
  historyRight: {
    alignItems: 'flex-end',
  },
  historyAmount: {
    color: '#fde68a',
    fontSize: 13,
    fontWeight: '800',
  },
  historyStatus: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
  },
  historyStatusClaimed: {
    color: '#4ade80',
  },
  historyStatusPending: {
    color: '#f59e0b',
  },
  historyStatusLost: {
    color: '#f87171',
  },
  miningLockOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    backgroundColor: 'rgba(10,4,22,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  miningLockCard: {
    backgroundColor: 'rgba(30,14,54,0.97)',
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

export default SpinAndWinScreen;

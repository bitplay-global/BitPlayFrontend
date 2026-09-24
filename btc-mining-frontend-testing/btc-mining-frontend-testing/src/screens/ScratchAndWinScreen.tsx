import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Alert, ActivityIndicator,
  PanResponder, Dimensions, GestureResponderEvent,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Defs, Mask, Rect, Path } from 'react-native-svg';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { RootStackParamList } from '../components/types';
import { useHashPower } from '../stores/HashPowerStore';
import { useAuth } from '../auth/AuthProvider';
import { useRewardedVideoAd } from '../services/googleAds';
import { useAdConfig } from '../providers/AdConfigProvider';
import { get_data_uri } from '../config/api';
import GameScreenWrapper from '../components/GameScreenWrapper';

type Nav = StackNavigationProp<RootStackParamList, 'ScratchAndWin'>;

export interface ScratchOutcome {
  key: string;
  /** Gh/s credited when redeemed. 0 == "Better Luck Next Time". */
  gh: number;
  label: string;
  weight: number;
}

/**
 * ~55% loss rate, skewed toward small wins with rare 4-5 GH/s -- same weighted
 * shape/philosophy as SpinAndWinScreen's SLICES, tuned to this game's own scale.
 */
export const SCRATCH_OUTCOMES: ScratchOutcome[] = [
  { key: 'lose', gh: 0, label: 'Better Luck Next Time', weight: 55 },
  { key: 'gh1', gh: 1, label: '1 GH/s', weight: 20 },
  { key: 'gh2', gh: 2, label: '2 GH/s', weight: 12 },
  { key: 'gh3', gh: 3, label: '3 GH/s', weight: 7 },
  { key: 'gh4', gh: 4, label: '4 GH/s', weight: 4 },
  { key: 'gh5', gh: 5, label: '5 GH/s', weight: 2 },
];

/** Max possible payout -- consumed by GameZoneScreen for its "Up to X GH/s" label. */
export const WIN_REWARD_GH = Math.max(...SCRATCH_OUTCOMES.filter(o => o.gh > 0).map(o => o.gh));

function pickWeightedOutcome(): ScratchOutcome {
  const total = SCRATCH_OUTCOMES.reduce((s, o) => s + o.weight, 0);
  let r = Math.random() * total;
  for (const outcome of SCRATCH_OUTCOMES) {
    r -= outcome.weight;
    if (r <= 0) return outcome;
  }
  return SCRATCH_OUTCOMES[SCRATCH_OUTCOMES.length - 1];
}

type Phase = 'ready' | 'revealed_win' | 'revealed_lose';

const CARD_W = Math.min(Dimensions.get('window').width - 64, 320);
const CARD_H = 180;
const STROKE_WIDTH = 46;
/** Cumulative scratch-stroke length (px) before the rest of the foil auto-fades away. */
const REVEAL_THRESHOLD = CARD_W * 2.4;

export default function ScratchAndWinScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const {
    addHashPower,
    isMiningActive: storeMiningActive,
  } = useHashPower();
  const { ads } = useAdConfig();

  // Same mining-active gate SpinAndWinScreen uses: local mirror of the store
  // value (so the lock shows without waiting on the network) plus a
  // focus-time refresh against the authoritative backend value.
  const [isMiningActive, setIsMiningActive] = useState<boolean | null>(storeMiningActive);
  useEffect(() => { setIsMiningActive(storeMiningActive); }, [storeMiningActive]);
  useFocusEffect(
    useCallback(() => {
      setIsMiningActive(storeMiningActive);
      if (!user?.id) return;
      fetch(`${get_data_uri('USERMININGDETAILS')}/${user.id}`)
        .then(r => r.json())
        .catch(() => null)
        .then(data => {
          if (data?.mining_details != null) setIsMiningActive(!!data.mining_details.mining_isactive);
        });
    }, [user?.id, storeMiningActive]),
  );

  const [phase, setPhase] = useState<Phase>('ready');
  const [currentOutcome, setCurrentOutcome] = useState<ScratchOutcome>(() => pickWeightedOutcome());
  const [paths, setPaths] = useState<string[]>([]);
  const [crediting, setCrediting] = useState(false);
  const [claimedBanner, setClaimedBanner] = useState<string | null>(null);

  // Guard: the winning amount pending ad-claim. Nulled only once the reward
  // actually fires (EARNED_REWARD), never on a skip -- so a skipped claim ad
  // never grants anything but also never silently discards a still-valid win.
  const pendingWinGh = useRef<number | null>(null);
  const claimEarnedRef = useRef(false);
  const retryEarnedRef = useRef(false);
  const scratchedLenRef = useRef(0);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const revealingRef = useRef(false);
  const foilOpacity = useRef(new Animated.Value(1)).current;

  // PanResponder.create() only runs once (below), so its callbacks close over
  // whatever `phase`/`currentOutcome` were on that first render. Mirror both
  // into refs the responder reads instead, so it always sees the live value.
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  const currentOutcomeRef = useRef(currentOutcome);
  useEffect(() => { currentOutcomeRef.current = currentOutcome; }, [currentOutcome]);

  const dealNewCard = useCallback(() => {
    setCurrentOutcome(pickWeightedOutcome());
    setPhase('ready');
    setPaths([]);
    scratchedLenRef.current = 0;
    lastPointRef.current = null;
    revealingRef.current = false;
    pendingWinGh.current = null;
    foilOpacity.setValue(1);
    setClaimedBanner(null);
  }, [foilOpacity]);

  const revealCard = useCallback((outcome: ScratchOutcome) => {
    // Guard against re-entry: once past the threshold, every further scratch
    // move would otherwise re-trigger this (phase doesn't flip until the fade
    // finishes, so phaseRef.current === 'ready' stays true throughout it).
    if (revealingRef.current) return;
    revealingRef.current = true;
    // Let the foil actually finish fading before swapping `phase` -- flipping
    // phase immediately would unmount the foil View mid-animation (it's only
    // rendered while phase === 'ready'), cutting the fade off abruptly.
    Animated.timing(foilOpacity, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => {
      if (outcome.gh > 0) {
        pendingWinGh.current = outcome.gh;
        setPhase('revealed_win');
      } else {
        setPhase('revealed_lose');
      }
    });
  }, [foilOpacity]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => phaseRef.current === 'ready',
      onMoveShouldSetPanResponder: () => phaseRef.current === 'ready',
      onPanResponderGrant: (e: GestureResponderEvent) => {
        const { locationX, locationY } = e.nativeEvent;
        lastPointRef.current = { x: locationX, y: locationY };
        setPaths(prev => [...prev, `M ${locationX} ${locationY}`]);
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        if (phaseRef.current !== 'ready') return;
        const { locationX, locationY } = e.nativeEvent;
        const last = lastPointRef.current;
        if (last) {
          const dx = locationX - last.x;
          const dy = locationY - last.y;
          scratchedLenRef.current += Math.sqrt(dx * dx + dy * dy);
        }
        lastPointRef.current = { x: locationX, y: locationY };
        setPaths(prev => {
          if (prev.length === 0) return prev;
          const next = prev.slice();
          next[next.length - 1] = `${next[next.length - 1]} L ${locationX} ${locationY}`;
          return next;
        });
        if (scratchedLenRef.current >= REVEAL_THRESHOLD) {
          revealCard(currentOutcomeRef.current);
        }
      },
      onPanResponderRelease: () => { lastPointRef.current = null; },
      onPanResponderTerminate: () => { lastPointRef.current = null; },
    }),
  ).current;

  // --- Win claim: watch ad -> credit GH/s (never before, never twice) ---
  const onClaimAdReward = useCallback(async () => {
    claimEarnedRef.current = true;
    const gh = pendingWinGh.current;
    if (gh == null || !user?.id) return;
    pendingWinGh.current = null; // guard against a double EARNED_REWARD fire
    setCrediting(true);
    // Credit the shared HashPowerStore immediately, client-side -- the same
    // addHashPower() call Store.tsx's purchase flow uses ("Update hashPower
    // store so HomeScreen also reflects the change instantly"). The backend
    // POST below is a best-effort server-side record of the reward; its
    // response is intentionally never used to overwrite hashPower here, since
    // a read-after-write that hasn't caught up yet would otherwise show a
    // stale pre-increment number back on Home.
    addHashPower(gh);
    try {
      await fetch(get_data_uri('USERMININGDETAILS'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, hashpower: gh, offset: new Date().getTimezoneOffset() }),
      });
    } catch {
      // Local credit above already stands; the backend record is best-effort.
    }
    setCrediting(false);
    setClaimedBanner(`+${gh} GH/s is now in your mining power.`);
  }, [user?.id, addHashPower]);

  const onClaimAdClosed = useCallback(() => {
    if (claimEarnedRef.current) {
      claimEarnedRef.current = false;
      dealNewCard();
    } else {
      Alert.alert('Ad not completed', 'Please watch the full video to redeem your reward.');
    }
  }, [dealNewCard]);

  const {
    show: showClaimAd, loading: claimAdLoading, loaded: claimAdLoaded,
  } = useRewardedVideoAd(onClaimAdReward, { primaryUnitId: ads.rewardedVideoId }, onClaimAdClosed);

  // --- Loss retry: watch ad -> unlock a new scratch attempt (no free retry) ---
  const onRetryAdReward = useCallback(() => { retryEarnedRef.current = true; }, []);
  const onRetryAdClosed = useCallback(() => {
    if (retryEarnedRef.current) {
      retryEarnedRef.current = false;
      dealNewCard();
    } else {
      Alert.alert('Ad not completed', 'Please watch the full video to try again.');
    }
  }, [dealNewCard]);

  const {
    show: showRetryAd, loading: retryAdLoading, loaded: retryAdLoaded,
  } = useRewardedVideoAd(onRetryAdReward, { primaryUnitId: ads.rewardedVideoId }, onRetryAdClosed);

  const openClaimAd = () => {
    if (pendingWinGh.current == null) return;
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

  return (
    <GameScreenWrapper title="Scratch & Win" iconName="ticket-confirmation-outline" iconColor="#22C55E" scrollable>
      <Text style={s.subtitle}>Scratch the card to reveal your reward!</Text>

      {isMiningActive === false ? (
        <View style={s.lockCard}>
          <Icon name="pickaxe" size={32} color="#FBBF24" />
          <Text style={s.lockTitle}>Mining Not Active</Text>
          <Text style={s.lockBody}>Start mining on the home screen to unlock Scratch and Win.</Text>
          <TouchableOpacity style={s.lockBtn} onPress={() => navigation.goBack()}>
            <Text style={s.lockBtnText}>Start Mining</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {claimedBanner ? (
            <View style={s.banner}>
              <Icon name="check-circle" size={18} color="#4ADE80" />
              <Text style={s.bannerText}>{claimedBanner}</Text>
            </View>
          ) : null}

          <View style={[s.cardWrap, { width: CARD_W, height: CARD_H }]}>
            {/* Result layer -- always in the tree, only visible where the foil above it is scratched away. */}
            <LinearGradient
              colors={currentOutcome.gh > 0 ? ['#2D1B4E', '#1A0F2E'] : ['#2D1020', '#1A0A18']}
              style={s.resultLayer}
            >
              {currentOutcome.gh > 0 ? (
                <>
                  <Icon name="cash-multiple" size={38} color="#FBBF24" />
                  <Text style={s.resultAmount}>+{currentOutcome.gh} GH/s</Text>
                </>
              ) : (
                <>
                  <Icon name="emoticon-sad-outline" size={38} color="#F87171" />
                  <Text style={s.resultLose}>Better Luck{'\n'}Next Time</Text>
                </>
              )}
            </LinearGradient>

            {/* Foil layer -- an SVG rect masked by the scratch path, fading out once enough is scratched. */}
            {phase === 'ready' && (
              <Animated.View
                style={[StyleSheet.absoluteFill, { opacity: foilOpacity }]}
                {...panResponder.panHandlers}
              >
                <Svg width={CARD_W} height={CARD_H}>
                  <Defs>
                    <Mask id="scratchMask">
                      <Rect x={0} y={0} width={CARD_W} height={CARD_H} fill="white" />
                      {paths.map((d, i) => (
                        <Path
                          key={i}
                          d={d}
                          stroke="black"
                          strokeWidth={STROKE_WIDTH}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                        />
                      ))}
                    </Mask>
                  </Defs>
                  <Rect x={0} y={0} width={CARD_W} height={CARD_H} rx={18} fill="#94A3B8" mask="url(#scratchMask)" />
                </Svg>
                <View style={s.foilHint} pointerEvents="none">
                  <Icon name="hand-back-right-outline" size={22} color="rgba(255,255,255,0.55)" />
                  <Text style={s.foilHintText}>Scratch here</Text>
                </View>
              </Animated.View>
            )}
          </View>

          {phase === 'revealed_win' && (
            <View style={s.outcomeCard}>
              <LinearGradient colors={['#2D1B4E', '#1A0F2E']} style={s.outcomeGradient}>
                <View style={s.outcomeInner}>
                  <Text style={s.outcomeTitle}>You Won +{currentOutcome.gh} GH/s!</Text>
                  <Text style={s.outcomeBody}>Watch the video to add it to your mining power.</Text>
                  <TouchableOpacity style={s.adBtn} onPress={openClaimAd} disabled={crediting}>
                    <LinearGradient colors={['#FBBF24', '#D97706']} style={s.adBtnGrad}>
                      <View style={s.adBtnInner}>
                        {crediting || (claimAdLoading && !claimAdLoaded) ? (
                          <ActivityIndicator color="#1C1917" />
                        ) : (
                          <>
                            <Icon name="play-circle" size={22} color="#1C1917" />
                            <Text style={s.adBtnTextDark}>Watch Ad & Redeem</Text>
                          </>
                        )}
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </View>
          )}

          {phase === 'revealed_lose' && (
            <View style={s.outcomeCard}>
              <LinearGradient colors={['#2D1020', '#1A0A18']} style={s.outcomeGradient}>
                <View style={s.outcomeInner}>
                  <Icon name="refresh-circle" size={32} color="#F87171" style={{ marginBottom: 6 }} />
                  <Text style={s.outcomeTitle}>Better Luck Next Time!</Text>
                  <Text style={s.outcomeBody}>Watch a short video to try again.</Text>
                  <TouchableOpacity style={s.adBtn} onPress={openRetryAd} disabled={retryAdLoading && !retryAdLoaded}>
                    <LinearGradient colors={['#EF4444', '#B91C1C']} style={s.adBtnGrad}>
                      <View style={s.adBtnInner}>
                        {retryAdLoading && !retryAdLoaded ? (
                          <ActivityIndicator color="#FFF" />
                        ) : (
                          <>
                            <Icon name="play-circle" size={22} color="#FFF" />
                            <Text style={s.adBtnTextLight}>Watch Ad & Try Again</Text>
                          </>
                        )}
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </View>
          )}

          <Text style={s.footerHint}>1-5 GH/s per win · watch a video to redeem or try again</Text>
        </>
      )}
    </GameScreenWrapper>
  );
}

const s = StyleSheet.create({
  subtitle: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 4,
    marginBottom: 16,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.35)',
    width: '100%',
  },
  bannerText: { flex: 1, color: '#DCFCE7', fontSize: 13 },
  cardWrap: {
    alignSelf: 'center',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 18,
  },
  resultLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  resultAmount: { fontSize: 26, fontWeight: '900', color: '#FFFFFF' },
  resultLose: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  foilHint: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 6 },
  foilHintText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '700' },
  outcomeCard: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.25)',
  },
  outcomeGradient: { width: '100%' },
  outcomeInner: { paddingHorizontal: 20, paddingVertical: 20, alignItems: 'center', width: '100%' },
  outcomeTitle: { fontSize: 20, fontWeight: '900', color: '#FFF', textAlign: 'center' },
  outcomeBody: { marginTop: 8, fontSize: 14, color: '#C4B5FD', textAlign: 'center', marginBottom: 16 },
  adBtn: { alignSelf: 'stretch', width: '100%', borderRadius: 14, overflow: 'hidden' },
  adBtnGrad: { width: '100%' },
  adBtnInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    minHeight: 48, paddingVertical: 14, paddingHorizontal: 16,
  },
  adBtnTextDark: { fontSize: 16, fontWeight: '900', color: '#1C1917' },
  adBtnTextLight: { fontSize: 16, fontWeight: '800', color: '#fff' },
  footerHint: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 16,
  },
  lockCard: {
    backgroundColor: 'rgba(30,14,54,0.97)',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(251,191,36,0.45)',
    padding: 28,
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  lockTitle: { fontSize: 18, fontWeight: '900', color: '#FFFFFF', textAlign: 'center' },
  lockBody: { fontSize: 14, color: '#C4B5FD', textAlign: 'center', lineHeight: 20 },
  lockBtn: {
    marginTop: 4, backgroundColor: '#FBBF24', borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center',
  },
  lockBtnText: { color: '#1C1917', fontSize: 14, fontWeight: '900' },
});

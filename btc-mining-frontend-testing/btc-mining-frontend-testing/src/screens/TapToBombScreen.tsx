import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Alert, ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { RootStackParamList } from '../components/types';
import { useHashPower } from '../stores/HashPowerStore';
import { useAuth } from '../auth/AuthProvider';
import { useRewardedVideoAd } from '../services/googleAds';
import { useAdConfig } from '../providers/AdConfigProvider';
import { get_data_uri } from '../config/api';
import GameScreenWrapper from '../components/GameScreenWrapper';

type Nav = StackNavigationProp<RootStackParamList, 'TapToBomb'>;

type TileKind = 'safe' | 'bomb';
interface Tile {
  key: string;
  kind: TileKind;
  /** Gh/s hidden under this tile. Only meaningful when kind === 'safe'. */
  gh: number;
}

const GRID_SIZE = 9;
const BOMB_COUNT = 2;

/** Max possible payout -- consumed by GameZoneScreen for its "Up to X GH/s" label. */
export const WIN_REWARD_GH = 5;

// Same weighted-random shape/skew as ScratchAndWinScreen's SCRATCH_OUTCOMES,
// applied only to whichever tile the player actually taps -- the other 8
// tiles get an identity too (for the reveal-the-board flavor moment), but
// only the tapped tile's identity ever affects game state or crediting.
const GH_WEIGHTS: { gh: number; weight: number }[] = [
  { gh: 1, weight: 20 },
  { gh: 2, weight: 12 },
  { gh: 3, weight: 7 },
  { gh: 4, weight: 4 },
  { gh: 5, weight: 2 },
];

function pickWeightedGh(): number {
  const total = GH_WEIGHTS.reduce((s, w) => s + w.weight, 0);
  let r = Math.random() * total;
  for (const w of GH_WEIGHTS) {
    r -= w.weight;
    if (r <= 0) return w.gh;
  }
  return GH_WEIGHTS[GH_WEIGHTS.length - 1].gh;
}

function dealBoard(): Tile[] {
  const bombIdx = new Set<number>();
  while (bombIdx.size < BOMB_COUNT) {
    bombIdx.add(Math.floor(Math.random() * GRID_SIZE));
  }
  return Array.from({ length: GRID_SIZE }, (_, i) =>
    bombIdx.has(i)
      ? { key: `t${i}`, kind: 'bomb' as const, gh: 0 }
      : { key: `t${i}`, kind: 'safe' as const, gh: pickWeightedGh() },
  );
}

type Phase = 'ready' | 'revealing' | 'revealed_win' | 'revealed_lose';

/** Delay between the tapped tile flipping and the rest of the board flipping -- pure flavor. */
const REVEAL_ALL_DELAY_MS = 550;

// ---- Grid sizing ----
// Tiles used to be `width: '30%'` inside a grid capped at maxWidth 320. On a
// normal ~412dp phone that stranded the whole board in the middle of the
// screen at roughly 96dp per tile, with wide empty margins either side -- the
// "tap options are too small" symptom. Sizing in real pixels off the actual
// available width instead makes the board fill the screen properly on every
// device, while GRID_MAX_W keeps it from becoming absurd on tablets.
const GRID_GAP = 12;
const GRID_MAX_W = 420;
/** GameScreenWrapper's contentInner adds paddingHorizontal: 12 on each side. */
const WRAPPER_H_PADDING = 24;
const GRID_W = Math.min(Dimensions.get('window').width - WRAPPER_H_PADDING, GRID_MAX_W);
const TILE_SIZE = Math.floor((GRID_W - GRID_GAP * 2) / 3);
/** Icon/label scale with the tile so a bigger board doesn't look sparse. */
const TILE_ICON_SIZE = Math.round(TILE_SIZE * 0.34);
const TILE_GH_FONT_SIZE = Math.max(14, Math.round(TILE_SIZE * 0.17));

/** A single grid tile: pop-in scale on reveal, plus a quick press-down scale for tactile feedback. */
function TileView({
  tile, revealed, tapped, disabled, onPress,
}: { tile: Tile; revealed: boolean; tapped: boolean; disabled: boolean; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!revealed) return;
    scale.setValue(0.7);
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }).start();
  }, [revealed, scale]);

  const onPressIn = () => {
    if (disabled) return;
    Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  };
  const onPressOut = () => {
    if (disabled) return;
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  };

  return (
    <TouchableOpacity
      style={[s.tile, revealed && (tile.kind === 'bomb' ? s.tileBomb : s.tileSafe), tapped && s.tileTapped]}
      activeOpacity={0.85}
      disabled={disabled}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <Animated.View style={[s.tileInner, { transform: [{ scale }] }]}>
        {revealed ? (
          tile.kind === 'bomb' ? (
            <Icon name="bomb" size={TILE_ICON_SIZE} color={BOMB_ACCENT} />
          ) : (
            <>
              <Icon name="ticket-confirmation" size={Math.round(TILE_ICON_SIZE * 0.72)} color={GOLD_ACCENT} />
              <Text style={s.tileGhText}>+{tile.gh}</Text>
            </>
          )
        ) : (
          <Icon name="help" size={Math.round(TILE_ICON_SIZE * 0.82)} color="rgba(255,255,255,0.3)" />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ---- BitPlayPro palette for this screen (per the redesign brief) ----
const BG_GRADIENT: [string, string, string] = ['#060A18', '#0A1024', '#101735'];
const SURFACE = '#101827';
const SURFACE_ELEVATED = '#151F30';
const TEXT_PRIMARY = '#F5F7FA';
const TEXT_SECONDARY = '#8E9BB0';
const CYAN_ACCENT = '#18D5F2';
const GOLD_ACCENT = '#FFC400';
const BOMB_ACCENT = '#FF3D6E';
const PURPLE_ACCENT = '#8B5CF6';

export default function TapToBombScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const {
    addHashPower,
    isMiningActive: storeMiningActive,
  } = useHashPower();
  const { ads } = useAdConfig();

  // Same mining-active gate ScratchAndWinScreen/SpinAndWinScreen use.
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
  const [board, setBoard] = useState<Tile[]>(() => dealBoard());
  const [tappedIndex, setTappedIndex] = useState<number | null>(null);
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set());
  const [crediting, setCrediting] = useState(false);
  const [claimedBanner, setClaimedBanner] = useState<string | null>(null);

  // Guard: the winning amount pending ad-claim. Nulled only once the reward
  // actually fires (EARNED_REWARD), never on a skip -- so a skipped claim ad
  // never grants anything but also never silently discards a still-valid win.
  const pendingWinGh = useRef<number | null>(null);
  const claimEarnedRef = useRef(false);
  const retryEarnedRef = useRef(false);
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
  }, []);

  const dealNewBoard = useCallback(() => {
    if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    setBoard(dealBoard());
    setPhase('ready');
    setTappedIndex(null);
    setRevealedIndices(new Set());
    pendingWinGh.current = null;
    setClaimedBanner(null);
  }, []);

  const onTapTile = (index: number) => {
    if (phase !== 'ready') return;
    const tile = board[index];
    setPhase('revealing');
    setTappedIndex(index);
    setRevealedIndices(new Set([index]));

    revealTimeoutRef.current = setTimeout(() => {
      setRevealedIndices(new Set(board.map((_, i) => i)));
      if (tile.kind === 'safe') {
        pendingWinGh.current = tile.gh;
        setPhase('revealed_win');
      } else {
        setPhase('revealed_lose');
      }
    }, REVEAL_ALL_DELAY_MS);
  };

  // --- Win claim: watch ad -> credit GH/s (never before, never twice) ---
  const onClaimAdReward = useCallback(async () => {
    claimEarnedRef.current = true;
    const gh = pendingWinGh.current;
    if (gh == null || !user?.id) return;
    pendingWinGh.current = null; // guard against a double EARNED_REWARD fire
    setCrediting(true);
    // Credit the shared HashPowerStore immediately, client-side -- same call
    // Store.tsx's purchase flow uses ("Update hashPower store so HomeScreen
    // also reflects the change instantly"). The backend POST below is a
    // best-effort server-side record of the reward; its response is never
    // used to overwrite hashPower here.
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
      dealNewBoard();
    } else {
      Alert.alert('Ad not completed', 'Please watch the full video to redeem your reward.');
    }
  }, [dealNewBoard]);

  const {
    show: showClaimAd, loading: claimAdLoading, loaded: claimAdLoaded,
  } = useRewardedVideoAd(onClaimAdReward, { primaryUnitId: ads.rewardedVideoId }, onClaimAdClosed);

  // --- Loss retry: watch ad -> unlock a new board (no free retry) ---
  const onRetryAdReward = useCallback(() => { retryEarnedRef.current = true; }, []);
  const onRetryAdClosed = useCallback(() => {
    if (retryEarnedRef.current) {
      retryEarnedRef.current = false;
      dealNewBoard();
    } else {
      Alert.alert('Ad not completed', 'Please watch the full video to try again.');
    }
  }, [dealNewBoard]);

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

  const winningTileGh = tappedIndex != null ? board[tappedIndex].gh : 0;

  return (
    <GameScreenWrapper title="Tap to Bomb" iconName="bomb" iconColor={BOMB_ACCENT} gradientColors={BG_GRADIENT} scrollable>
      <Text style={s.subtitle}>
        Tap a tile — dodge the bombs, bank the <Text style={s.subtitleAccent}>GH/s</Text>!
      </Text>

      {isMiningActive === false ? (
        <View style={s.lockCard}>
          <Icon name="pickaxe" size={32} color={GOLD_ACCENT} />
          <Text style={s.lockTitle}>Mining Not Active</Text>
          <Text style={s.lockBody}>Start mining on the home screen to unlock Tap to Bomb.</Text>
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

          <View style={s.grid}>
            {board.map((tile, i) => (
              <TileView
                key={tile.key}
                tile={tile}
                revealed={revealedIndices.has(i)}
                tapped={tappedIndex === i}
                disabled={phase !== 'ready'}
                onPress={() => onTapTile(i)}
              />
            ))}
          </View>

          {phase === 'revealed_win' && (
            <View style={[s.outcomeCard, s.outcomeCardWin]}>
              <LinearGradient colors={['#161A34', '#0D1024']} style={s.outcomeGradient}>
                <View style={s.outcomeInner}>
                  <View style={s.outcomeHeaderRow}>
                    <View style={s.outcomeTextCol}>
                      <Text style={s.outcomeTitle}>
                        You Won <Text style={s.outcomeTitleAccent}>+{winningTileGh} GH/s</Text>!
                      </Text>
                      <Text style={s.outcomeBody}>Watch the video to add it to your mining power.</Text>
                    </View>
                    <View style={s.rewardArtBadge}>
                      <Icon name="lightning-bolt-circle" size={44} color={CYAN_ACCENT} />
                    </View>
                  </View>
                  <TouchableOpacity style={s.adBtn} onPress={openClaimAd} disabled={crediting} activeOpacity={0.88}>
                    <View style={s.adBtnGold}>
                      {crediting || (claimAdLoading && !claimAdLoaded) ? (
                        <ActivityIndicator color="#1C1917" />
                      ) : (
                        <>
                          <Icon name="play-circle" size={22} color="#1C1917" />
                          <Text style={s.adBtnTextDark}>Watch Ad & Redeem</Text>
                        </>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </View>
          )}

          {phase === 'revealed_lose' && (
            <View style={[s.outcomeCard, s.outcomeCardLose]}>
              <LinearGradient colors={['#1E1424', '#0D0A18']} style={s.outcomeGradient}>
                <View style={s.outcomeInner}>
                  <View style={s.bombIconBadge}>
                    <Icon name="bomb" size={30} color={BOMB_ACCENT} />
                  </View>
                  <Text style={s.outcomeTitle}>Boom! Better Luck Next Time!</Text>
                  <Text style={s.outcomeBody}>Watch a short video to try again.</Text>
                  <TouchableOpacity style={s.adBtn} onPress={openRetryAd} disabled={retryAdLoading && !retryAdLoaded} activeOpacity={0.88}>
                    <View style={s.adBtnBomb}>
                      {retryAdLoading && !retryAdLoaded ? (
                        <ActivityIndicator color="#FFF" />
                      ) : (
                        <>
                          <Icon name="play-circle" size={22} color="#FFF" />
                          <Text style={s.adBtnTextLight}>Watch Ad & Try Again</Text>
                        </>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </View>
          )}

          <Text style={s.footerHint}>3x3 grid · 2 hidden bombs · up to 5 GH/s per win</Text>
        </>
      )}
    </GameScreenWrapper>
  );
}

const s = StyleSheet.create({
  subtitle: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginTop: 4,
    marginBottom: 24,
    lineHeight: 21,
  },
  subtitleAccent: { color: CYAN_ACCENT, fontWeight: '700' },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.3)',
    width: '100%',
  },
  bannerText: { flex: 1, color: '#DCFCE7', fontSize: 13 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: GRID_W,
    alignSelf: 'center',
    gap: GRID_GAP,
    justifyContent: 'center',
    marginBottom: 24,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 18,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tileInner: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  tileSafe: {
    backgroundColor: SURFACE_ELEVATED,
    borderColor: 'rgba(255,196,0,0.45)',
    borderWidth: 1.5,
    shadowColor: GOLD_ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  tileBomb: {
    backgroundColor: SURFACE_ELEVATED,
    borderColor: 'rgba(255,61,110,0.5)',
    borderWidth: 1.5,
    shadowColor: BOMB_ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  tileTapped: { borderWidth: 2 },
  tileGhText: { color: GOLD_ACCENT, fontWeight: '800', fontSize: TILE_GH_FONT_SIZE },

  outcomeCard: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 22,
    elevation: 6,
  },
  outcomeCardWin: {
    borderColor: PURPLE_ACCENT + '4D',
    shadowColor: CYAN_ACCENT,
    shadowOpacity: 0.22,
  },
  outcomeCardLose: {
    borderColor: 'rgba(255,61,110,0.3)',
    shadowColor: BOMB_ACCENT,
    shadowOpacity: 0.22,
  },
  outcomeGradient: { width: '100%' },
  outcomeInner: { paddingHorizontal: 20, paddingVertical: 22, alignItems: 'center', width: '100%' },
  outcomeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
    gap: 14,
  },
  outcomeTextCol: { flex: 1 },
  rewardArtBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(24,213,242,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(24,213,242,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bombIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: 'rgba(255,61,110,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,61,110,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  outcomeTitle: { fontSize: 19, fontWeight: '800', color: TEXT_PRIMARY, textAlign: 'left', lineHeight: 25 },
  outcomeTitleAccent: { color: CYAN_ACCENT, fontWeight: '900' },
  outcomeBody: { marginTop: 6, fontSize: 13.5, color: TEXT_SECONDARY, textAlign: 'left', lineHeight: 19 },
  adBtn: { alignSelf: 'stretch', width: '100%', borderRadius: 16, overflow: 'hidden' },
  adBtnGold: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    minHeight: 50, paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: GOLD_ACCENT,
    shadowColor: GOLD_ACCENT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  adBtnBomb: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    minHeight: 50, paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: BOMB_ACCENT,
    shadowColor: BOMB_ACCENT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  adBtnTextDark: { fontSize: 16, fontWeight: '800', color: '#1C1917' },
  adBtnTextLight: { fontSize: 16, fontWeight: '800', color: '#fff' },
  footerHint: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 11,
    color: TEXT_SECONDARY,
    lineHeight: 16,
  },
  lockCard: {
    backgroundColor: SURFACE_ELEVATED,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,196,0,0.35)',
    padding: 28,
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  lockTitle: { fontSize: 18, fontWeight: '800', color: TEXT_PRIMARY, textAlign: 'center' },
  lockBody: { fontSize: 14, color: TEXT_SECONDARY, textAlign: 'center', lineHeight: 20 },
  lockBtn: {
    marginTop: 4, backgroundColor: GOLD_ACCENT, borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center',
  },
  lockBtnText: { color: '#1C1917', fontSize: 14, fontWeight: '800' },
});

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Image, Alert,
  ActivityIndicator, StatusBar, Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../components/types';
import { useHashPower } from '../stores/HashPowerStore';
import { useAuth } from '../auth/AuthProvider';
import { get_data_uri } from '../config/api';
import { useRewardedVideoAd } from '../services/googleAds';
import { useAdConfig } from '../providers/AdConfigProvider';
import { BannerAdWithGamFallback } from '../components/ads/BannerAdWithGamFallback';
import { BannerAdSize } from 'react-native-google-mobile-ads';
import { DEFAULT_ADMOB_BANNER_ID } from '../services/adUnitDefaults';
import GameScreenWrapper from '../components/GameScreenWrapper';

type Nav = StackNavigationProp<RootStackParamList, 'MemoryCardMatch'>;

type TokenItem = { key: string; label: string; bg: string; border: string; image: any };
type Card = { id: string; tokenKey: string; label: string; bg: string; border: string; image: any; isFlipped: boolean; isMatched: boolean };

export const WIN_REWARD_GH = 5;
const MEMORIZE_MS = 1500;
const ROUND_TIME = 45;

// ---- Grid sizing ----
// Cards were `width: '22%'` with `aspectRatio: 0.8`, which made every card
// 1.25x taller than it was wide (0.8 = width/height) -- the uneven card shape.
// Sizing in real pixels off the available width instead gives exactly square
// cards that fill the row on any device, with GRID_MAX_W keeping them sane on
// tablets.
const GRID_COLS = 4;
const GRID_GAP = 8;
const GRID_MAX_W = 420;
/** GameScreenWrapper's contentInner adds paddingHorizontal: 12 on each side. */
const WRAPPER_H_PADDING = 24;
const GRID_W = Math.min(Dimensions.get('window').width - WRAPPER_H_PADDING, GRID_MAX_W);
const CARD_SIZE = Math.floor((GRID_W - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS);

const TOKENS: TokenItem[] = [
  { key: 'btc', label: 'BTC', bg: '#E85B4F', border: '#FCA5A5', image: require('../assets/images/flip/BTC.png') },
  { key: 'eth', label: 'ETH', bg: '#5E4AA8', border: '#C4B5FD', image: require('../assets/images/flip/ETH.png') },
  { key: 'ltc', label: 'LTC', bg: '#1F4E5E', border: '#7DD3FC', image: require('../assets/images/flip/LTC.png') },
  { key: 'usd', label: 'USD', bg: '#2F8A63', border: '#86EFAC', image: require('../assets/images/flip/USD.png') },
  { key: 'eur', label: 'EUR', bg: '#2F67B6', border: '#93C5FD', image: require('../assets/images/flip/EUR.png') },
  { key: 'gbp', label: 'GBP', bg: '#3B4FA0', border: '#A5B4FC', image: require('../assets/images/flip/GBP.png') },
  { key: 'inr', label: 'INR', bg: '#B52B7A', border: '#F9A8D4', image: require('../assets/images/flip/INR.png') },
  { key: 'doge', label: 'DOGE', bg: '#E4C148', border: '#FDE68A', image: require('../assets/images/flip/DOGE.png') },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function buildDeck(): Card[] {
  return shuffle(TOKENS.flatMap(t => [
    { id: `${t.key}_1`, tokenKey: t.key, label: t.label, bg: t.bg, border: t.border, image: t.image, isFlipped: false, isMatched: false },
    { id: `${t.key}_2`, tokenKey: t.key, label: t.label, bg: t.bg, border: t.border, image: t.image, isFlipped: false, isMatched: false },
  ]));
}

const CardView: React.FC<{ card: Card; disabled: boolean; onPress: () => void }> = ({ card, disabled, onPress }) => {
  const showFront = card.isFlipped || card.isMatched;
  const flipAnim = useRef(new Animated.Value(showFront ? 1 : 0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(flipAnim, { toValue: showFront ? 1 : 0, duration: 280, useNativeDriver: true }).start();
  }, [showFront]);

  useEffect(() => {
    if (card.isMatched) {
      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.15, useNativeDriver: true, bounciness: 20 }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
      ]).start();
    }
  }, [card.isMatched]);

  const frontRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '0deg'] });
  const backRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <TouchableOpacity style={s.cardTouch} activeOpacity={0.85} onPress={onPress} disabled={disabled}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }], flex: 1 }}>
        <View style={s.cardScene}>
          <Animated.View style={[s.cardFace, s.cardBack, { transform: [{ rotateY: backRotate }] }]}>
            <LinearGradient colors={['#1e3a5f', '#0f172a']} style={s.cardBackGrad}>
              <Text style={s.cardBackIcon}>₿</Text>
            </LinearGradient>
          </Animated.View>
          <Animated.View style={[s.cardFace, s.cardFront, { backgroundColor: card.bg, borderColor: card.border, transform: [{ rotateY: frontRotate }] }]}>
            {card.isMatched && <View style={s.matchGlow} />}
            <Image source={card.image} style={s.cardImg} resizeMode="contain" />
          </Animated.View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

export default function MemoryCardMatchScreen() {
  const { user } = useAuth();
  const { addHashPower, setHashPower, setPurchasedHashpowerGh } = useHashPower();
  const { ads } = useAdConfig();

  const [cards, setCards] = useState<Card[]>(() => buildDeck().map(c => ({ ...c, isFlipped: true })));
  const [selected, setSelected] = useState<string[]>([]);
  const [timer, setTimer] = useState(ROUND_TIME);
  const [active, setActive] = useState(true);
  const [checking, setChecking] = useState(false);
  const [memorize, setMemorize] = useState(true);
  const [won, setWon] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [round, setRound] = useState(1);
  const [matches, setMatches] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const memRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const playAgainEarned = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
    };
  }, []);

  const clearTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  const clearMem = () => { if (memRef.current) { clearTimeout(memRef.current); memRef.current = null; } };

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setInterval(() => setTimer(t => t <= 1 ? (clearTimer(), 0) : t - 1), 1000);
  }, []);

  const startRound = useCallback(() => {
    clearTimer(); clearMem();
    const deck = buildDeck();
    setCards(deck.map(c => ({ ...c, isFlipped: true })));
    setSelected([]); setTimer(ROUND_TIME); setActive(true);
    setChecking(false); setMemorize(true); setWon(false); setClaimed(false); setMatches(0);
    memRef.current = setTimeout(() => {
      setCards(prev => prev.map(c => ({ ...c, isFlipped: false })));
      setMemorize(false);
      startTimer();
    }, MEMORIZE_MS);
  }, [startTimer]);

  useEffect(() => { startRound(); return () => { clearTimer(); clearMem(); }; }, []);

  useEffect(() => {
    if (!active || memorize) return;
    if (timer === 0) { clearTimer(); setActive(false); setWon(false); }
  }, [timer, active, memorize]);

  useEffect(() => {
    const matchedCount = cards.filter(c => c.isMatched).length;
    setMatches(matchedCount / 2);
    if (!active || memorize) return;
    if (matchedCount === cards.length) {
      clearTimer(); setActive(false); setWon(timer > 0);
    }
  }, [cards]);

  const onCard = (id: string) => {
    if (!active || memorize || checking || selected.length >= 2) return;
    const card = cards.find(c => c.id === id);
    if (!card || card.isMatched || card.isFlipped) return;
    const newCards = cards.map(c => c.id === id ? { ...c, isFlipped: true } : c);
    const newSel = [...selected, id];
    setCards(newCards); setSelected(newSel);
    if (newSel.length === 2) {
      setChecking(true);
      const [a, b] = newSel;
      const ca = newCards.find(c => c.id === a);
      const cb = newCards.find(c => c.id === b);
      const isMatch = ca?.tokenKey === cb?.tokenKey;
      if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
      flipTimeoutRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;
        setCards(prev => prev.map(c => {
          if (c.id !== a && c.id !== b) return c;
          return isMatch ? { ...c, isMatched: true, isFlipped: true } : { ...c, isFlipped: false };
        }));
        setSelected([]); setChecking(false);
      }, 600);
    }
  };

  const claimReward = async () => {
    if (!won || claimed || claiming) return;
    setClaiming(true);
    try {
      // `user.userId` is never set anywhere in the app, so this always sent
      // user_id: undefined -- JSON.stringify drops the key entirely and the
      // backend recorded nothing. The local addHashPower fallback below is why
      // it looked like it worked. Every other game uses `user.id` (see
      // useGameReward), which is the Mongo _id.
      const res = await fetch(get_data_uri('USERMININGDETAILS'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id, hashpower: WIN_REWARD_GH, offset: new Date().getTimezoneOffset() }),
      });
      const data = await res.json().catch(() => null);
      if (data?.success && data?.mining_details) {
        setHashPower(parseFloat(String(data.mining_details.effective_hashpower ?? 0)));
        setPurchasedHashpowerGh(parseFloat(String(data.mining_details.purchasedHashpower ?? 0)));
      } else { addHashPower(WIN_REWARD_GH); }
    } catch { addHashPower(WIN_REWARD_GH); }
    setClaimed(true); setClaiming(false);
  };

  const onRewardEarned = useCallback(() => { void claimReward(); }, [won, claimed]);
  const { show: showClaim, loaded: claimLoaded } = useRewardedVideoAd(onRewardEarned, { primaryUnitId: ads.rewardedVideoId });

  const onPlayAgainEarned = useCallback(() => { playAgainEarned.current = true; }, []);
  const onPlayAgainClosed = useCallback(() => {
    if (playAgainEarned.current) { playAgainEarned.current = false; setRound(r => r + 1); startRound(); }
    else Alert.alert('Ad Incomplete', 'Watch the full ad to play again.');
  }, [startRound]);
  const { show: showPlayAgain, loaded: playAgainLoaded } = useRewardedVideoAd(onPlayAgainEarned, { primaryUnitId: ads.rewardedVideoId }, onPlayAgainClosed);

  const timerColor = timer <= 10 ? '#ef4444' : timer <= 20 ? '#f59e0b' : '#22d3ee';
  const timerPct = timer / ROUND_TIME;

  return (
    <GameScreenWrapper title="Memory Match" iconName="cards" iconColor="#818cf8" scrollable>
      {/* Timer bar */}
      <View style={s.timerBar}>
        <View style={[s.timerFill, { width: `${timerPct * 100}%`, backgroundColor: timerColor }]} />
      </View>

      {/* HUD */}
      <View style={s.hud}>
        <View style={s.hudChip}>
          <Text style={s.hudLabel}>TIME</Text>
          <Text style={[s.hudVal, { color: timerColor }]}>{timer}s</Text>
        </View>
        <View style={s.hudChip}>
          <Text style={s.hudLabel}>PAIRS</Text>
          <Text style={s.hudVal}>{matches}/8</Text>
        </View>
        <View style={s.hudChip}>
          <Text style={s.hudLabel}>ROUND</Text>
          <Text style={s.hudVal}>{round}</Text>
        </View>
      </View>

      {memorize && (
        <View style={s.memBanner}>
          <Text style={s.memText}>👀 Memorize the cards!</Text>
        </View>
      )}

      {/* Card grid */}
      <View style={s.grid}>
        {cards.map(card => (
          <CardView key={card.id} card={card} onPress={() => onCard(card.id)}
            disabled={!active || memorize || checking || card.isFlipped || card.isMatched} />
        ))}
      </View>

      {/* Game over */}
      {!active && (
        <LinearGradient colors={won ? ['rgba(34,197,94,0.15)', 'rgba(16,185,129,0.05)'] : ['rgba(239,68,68,0.15)', 'rgba(220,38,38,0.05)']} style={s.gameOver}>
          <Text style={s.goEmoji}>{won ? '🎉' : '⏰'}</Text>
          <Text style={s.goTitle}>{won ? 'You Won!' : 'Time\'s Up!'}</Text>
          <Text style={s.goSub}>{won ? `Matched all 8 pairs! Claim +${WIN_REWARD_GH} GH/s` : 'Match all 8 pairs before time runs out'}</Text>
          {won && !claimed && (
            <TouchableOpacity style={s.claimBtn} onPress={() => claimLoaded ? showClaim() : Alert.alert('Loading', 'Ad loading, try again.')} disabled={claiming}>
              <LinearGradient colors={['#fbbf24', '#d97706']} style={s.claimGrad}>
                {claiming ? <ActivityIndicator color="#000" /> : <Text style={s.claimTxt}>▶ Watch Ad → Earn +{WIN_REWARD_GH} GH/s</Text>}
              </LinearGradient>
            </TouchableOpacity>
          )}
          {claimed && <View style={s.claimedBadge}><Text style={s.claimedTxt}>✓ +{WIN_REWARD_GH} GH/s Added!</Text></View>}
          {/* Replaying costs an ad, with no free path.
              Previously this row also had a "Play Free" button, and the
              Watch-Ad button silently fell back to restarting for free
              whenever the ad had not loaded yet -- either one let a player
              keep playing indefinitely without ever seeing an ad. An
              unloaded ad now says so instead of granting a free round. */}
          <View style={s.retryRow}>
            <TouchableOpacity
              style={s.retryBtn}
              onPress={() => {
                // showPlayAgain() either shows the ad or, when it is not ready,
                // starts a fresh request -- so this never becomes a dead button.
                showPlayAgain();
                if (!playAgainLoaded) {
                  Alert.alert('Almost ready', 'The video is still loading. Try again in a few seconds.');
                }
              }}
            >
              <Text style={s.retryTxt} numberOfLines={1}>▶ Watch Ad → Play Again</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      )}
    </GameScreenWrapper>
  );
}

const s = StyleSheet.create({
  timerBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, marginBottom: 12, overflow: 'hidden' },
  timerFill: { height: 4, borderRadius: 2 },
  hud: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  hudChip: { flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 10, alignItems: 'center' },
  hudLabel: { color: '#64748b', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  hudVal: { color: '#f8fafc', fontSize: 18, fontWeight: '800', marginTop: 2 },
  memBanner: { backgroundColor: 'rgba(251,191,36,0.15)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.4)', borderRadius: 12, padding: 10, marginBottom: 12, alignItems: 'center' },
  memText: { color: '#fbbf24', fontSize: 14, fontWeight: '700' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: GRID_W,
    alignSelf: 'center',
    gap: GRID_GAP,
    justifyContent: 'center',
  },
  // Square: equal width and height, no aspectRatio skew.
  cardTouch: { width: CARD_SIZE, height: CARD_SIZE },
  cardScene: { flex: 1, position: 'relative' },
  cardFace: { ...StyleSheet.absoluteFillObject, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, backfaceVisibility: 'hidden' },
  cardBack: { backgroundColor: '#1e3a5f', borderColor: '#2d4f7c', overflow: 'hidden' },
  cardBackGrad: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  cardBackIcon: { color: '#fbbf24', fontSize: 22, fontWeight: '900' },
  cardFront: { paddingHorizontal: 4 },
  matchGlow: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(74,222,128,0.2)', borderRadius: 10 },
  cardImg: { width: '90%', height: '90%' },
  // width:'100%' so the panel matches the grid's width instead of stretching
  // to whatever the centered parent allows; trimmed padding/margins keep the
  // whole panel (including its buttons) on screen on shorter devices.
  gameOver: {
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
    marginTop: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  goEmoji: { fontSize: 40, marginBottom: 6 },
  goTitle: { color: '#f8fafc', fontSize: 22, fontWeight: '900', marginBottom: 6 },
  goSub: { color: '#94a3b8', fontSize: 13, textAlign: 'center', marginBottom: 16 },
  claimBtn: { borderRadius: 14, overflow: 'hidden', width: '100%', marginBottom: 10 },
  claimGrad: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  claimTxt: { color: '#000', fontSize: 15, fontWeight: '900' },
  claimedBadge: { backgroundColor: 'rgba(74,222,128,0.2)', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(74,222,128,0.5)' },
  claimedTxt: { color: '#4ade80', fontSize: 16, fontWeight: '800' },
  // Stacked, not side-by-side. At flex:1 each, "▶ Watch Ad → Play Again" was
  // far too long for a half-width button -- it wrapped to two lines, made the
  // two buttons different heights, and got visibly clipped. Full-width rows
  // fit the label on one line on every device and match the single-column CTA
  // shape the other game screens use.
  retryRow: { width: '100%' },
  retryBtn: { backgroundColor: 'rgba(99,102,241,0.2)', borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(99,102,241,0.4)' },
  retryTxt: { color: '#a5b4fc', fontSize: 14, fontWeight: '700' },
});

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useHashPower } from '../stores/HashPowerStore';
import { useAuth } from '../auth/AuthProvider';
import { get_data_uri } from '../config/api';
import { useRewardedVideoAd } from '../services/googleAds';
import { useFreeRetries } from '../hooks/useFreeRetries';
import { noteWin } from '../services/gameRetryCredits';
import { useAdConfig } from '../providers/AdConfigProvider';
import GameScreenWrapper from '../components/GameScreenWrapper';
import { MemoryCard } from '../components/games/memory/MemoryCard';
import { MemoryHud } from '../components/games/memory/MemoryHud';
import { ComboToast } from '../components/games/memory/ComboToast';
import { MemoryResultPanel } from '../components/games/memory/MemoryResultPanel';
import { BOARD_PAD, useMemoryGridLayout } from '../components/games/memory/theme';

type TokenItem = { key: string; label: string };
type Card = { id: string; tokenKey: string; label: string; isFlipped: boolean; isMatched: boolean };

export const WIN_REWARD_GH = 5;
const MEMORIZE_MS = 1500;
const ROUND_TIME = 45;

// Grid sizing lives in components/games/memory/theme.ts (useMemoryGridLayout):
// exactly square cards sized in real pixels from the window, capped for
// tablets and for short phones so HUD + board fit on one screen.

// Card faces (icon + colours) are keyed by `key` in TOKEN_STYLES (theme.ts).
const TOKENS: TokenItem[] = [
  { key: 'btc', label: 'BTC' },
  { key: 'eth', label: 'ETH' },
  { key: 'ltc', label: 'LTC' },
  { key: 'usd', label: 'USD' },
  { key: 'eur', label: 'EUR' },
  { key: 'gbp', label: 'GBP' },
  { key: 'inr', label: 'INR' },
  { key: 'doge', label: 'DOGE' },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function buildDeck(): Card[] {
  return shuffle(TOKENS.flatMap(t => [
    { id: `${t.key}_1`, tokenKey: t.key, label: t.label, isFlipped: false, isMatched: false },
    { id: `${t.key}_2`, tokenKey: t.key, label: t.label, isFlipped: false, isMatched: false },
  ]));
}

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
  // Presentation-only state (combo feedback, mismatch shake). None of it
  // feeds back into the game rules.
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [wrongPair, setWrongPair] = useState<string[]>([]);
  const layout = useMemoryGridLayout();

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
    setCombo(0); setBestCombo(0); setWrongPair([]);
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
      if (timer > 0) noteWin('Memory Match');
    }
  }, [cards]);

  useEffect(() => { if (combo > bestCombo) setBestCombo(combo); }, [combo]);

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
      if (!isMatch) setWrongPair([a, b]);
      if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
      flipTimeoutRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;
        setCards(prev => prev.map(c => {
          if (c.id !== a && c.id !== b) return c;
          return isMatch ? { ...c, isMatched: true, isFlipped: true } : { ...c, isFlipped: false };
        }));
        setSelected([]); setChecking(false);
        setCombo(c => isMatch ? c + 1 : 0);
        setWrongPair([]);
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
        body: JSON.stringify({ user_id: user?.id, hashpower: WIN_REWARD_GH, offset: new Date().getTimezoneOffset(), game: 'Memory Match' }),
      });
      const data = await res.json().catch(() => null);
      if (data?.success && data?.mining_details) {
        setHashPower(parseFloat(String(data.mining_details.effective_hashpower ?? 0)));
        setPurchasedHashpowerGh(parseFloat(String(data.mining_details.purchasedHashpower ?? 0)));
      } else { addHashPower(WIN_REWARD_GH); }
    } catch { addHashPower(WIN_REWARD_GH); }
    setClaimed(true); setClaiming(false);
  };

  // A lost round (time up) replays for free a few times before one needs a
  // video (services/gameRetryCredits.ts); replaying after a win still costs one.
  const freeRetry = useFreeRetries('Memory Match');

  const onRewardEarned = useCallback(() => { freeRetry.reset(); void claimReward(); }, [won, claimed, freeRetry]);
  const { show: showClaim, loaded: claimLoaded } = useRewardedVideoAd(onRewardEarned, { primaryUnitId: ads.rewardedVideoId });

  const onPlayAgainEarned = useCallback(() => { playAgainEarned.current = true; freeRetry.reset(); }, [freeRetry]);
  const onPlayAgainClosed = useCallback(() => {
    if (playAgainEarned.current) { playAgainEarned.current = false; setRound(r => r + 1); startRound(); }
    else Alert.alert('Ad Incomplete', 'Watch the full ad to play again.');
  }, [startRound]);
  const { show: showPlayAgain, loaded: playAgainLoaded } = useRewardedVideoAd(onPlayAgainEarned, { primaryUnitId: ads.rewardedVideoId }, onPlayAgainClosed);

  const replayFree = !won && freeRetry.left > 0;

  return (
    <GameScreenWrapper title="Memory Match" iconName="cards" iconColor="#818cf8" scrollable>
      <MemoryHud
        width={layout.boardW}
        timer={timer}
        total={ROUND_TIME}
        memorize={memorize}
        active={active}
        won={won}
        matches={matches}
        totalPairs={TOKENS.length}
        round={round}
        combo={combo}
        rewardGh={WIN_REWARD_GH}
      />

      {/* Board */}
      <View style={[s.board, { width: layout.boardW }]}>
        <LinearGradient
          colors={['rgba(30,27,75,0.75)', 'rgba(5,9,20,0.85)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[StyleSheet.absoluteFill, s.boardBg]}
        />
        <View style={[s.grid, { width: layout.gridW, gap: layout.gap }]}>
          {cards.map((card, i) => (
            <MemoryCard
              key={card.id}
              tokenKey={card.tokenKey}
              label={card.label}
              faceUp={card.isFlipped || card.isMatched}
              matched={card.isMatched}
              wrong={wrongPair.includes(card.id)}
              size={layout.cardSize}
              index={i}
              dealKey={round}
              onPress={() => onCard(card.id)}
              disabled={!active || memorize || checking || card.isFlipped || card.isMatched}
            />
          ))}
        </View>

        <ComboToast combo={combo} />

        {/* Game over -- covers the board so the whole panel (and its
            buttons) is always on screen, even on short devices. */}
        {!active && (
          <MemoryResultPanel
            won={won}
            claimed={claimed}
            claiming={claiming}
            matches={matches}
            totalPairs={TOKENS.length}
            timeUsed={ROUND_TIME - timer}
            bestCombo={bestCombo}
            rewardGh={WIN_REWARD_GH}
            compact={layout.compact}
            claimLabel={`▶ Watch Ad → Earn +${WIN_REWARD_GH} GH/s`}
            claimedLabel={`+${WIN_REWARD_GH} GH/s Added!`}
            onClaim={() => claimLoaded ? showClaim() : Alert.alert('Loading', 'Ad loading, try again.')}
            // Replaying after a WIN always costs a video; after a LOSS it is
            // free while free retries are left (useFreeRetries).
            // There is deliberately no other free path: previously a "Play
            // Free" button existed, and the Watch-Ad button silently fell back
            // to restarting for free whenever the ad had not loaded yet --
            // either one let a player keep playing indefinitely without ever
            // seeing an ad. An unloaded ad now says so instead of granting a
            // free round.
            replayFree={replayFree}
            replayLabel={replayFree ? `↻ Play Again (${freeRetry.left} free)` : '▶ Watch Ad → Play Again'}
            onReplay={() => {
              if (!won && freeRetry.tryFree()) { setRound(r => r + 1); startRound(); return; }
              // showPlayAgain() either shows the ad or, when it is not ready,
              // starts a fresh request -- so this never becomes a dead button.
              showPlayAgain();
              if (!playAgainLoaded) {
                Alert.alert('Almost ready', 'The video is still loading. Try again in a few seconds.');
              }
            }}
          />
        )}
      </View>
    </GameScreenWrapper>
  );
}

const s = StyleSheet.create({
  board: {
    alignSelf: 'center',
    padding: BOARD_PAD,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(165,180,252,0.14)',
    boxShadow: '0 10px 30px 0 rgba(0,0,0,0.45)',
  },
  boardBg: { borderRadius: 20 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'center',
  },
});

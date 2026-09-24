import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import GameScreenWrapper from '../components/GameScreenWrapper';
import { useGameReward } from '../hooks/useGameReward';
import { ClaimedBanner, LosePanel, MiningLockCard, WinPanel } from '../components/games/GameOutcome';

/** Max payout -- consumed by GameZoneScreen's "Up to X GH/s" label. */
export const WIN_REWARD_GH = 5;

const ROUND_SECONDS = 30;

/** Hardcoded so the game needs no assets and no network. */
const WORDS: { word: string; hint: string }[] = [
  { word: 'BITCOIN', hint: 'The original cryptocurrency' },
  { word: 'WALLET', hint: 'Where you keep your coins' },
  { word: 'MINING', hint: 'Earning coins with hashpower' },
  { word: 'BLOCK', hint: 'A batch of transactions' },
  { word: 'LEDGER', hint: 'The permanent record' },
  { word: 'TOKEN', hint: 'A digital asset' },
  { word: 'HASHRATE', hint: 'Mining speed' },
  { word: 'SATOSHI', hint: "Bitcoin's smallest unit" },
  { word: 'NETWORK', hint: 'Connected nodes' },
  { word: 'REWARD', hint: 'What you earn here' },
  { word: 'DIGITAL', hint: 'Not physical' },
  { word: 'TRADING', hint: 'Buying and selling' },
];

/** Longer words pay more. */
function ghForWord(len: number): number {
  if (len >= 8) return 5;
  if (len >= 7) return 4;
  if (len >= 6) return 3;
  if (len >= 5) return 2;
  return 1;
}

type Letter = { id: string; ch: string; used: boolean };

function scramble(word: string): Letter[] {
  const chars = word.split('').map((ch, i) => ({ id: `${ch}${i}`, ch, used: false }));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  // A scramble that happens to equal the answer would be a free win.
  if (chars.map(c => c.ch).join('') === word && word.length > 1) return scramble(word);
  return chars;
}

type Phase = 'playing' | 'win' | 'lose';

export default function WordScrambleScreen() {
  const navigation = useNavigation();

  const [entry, setEntry] = useState(() => WORDS[Math.floor(Math.random() * WORDS.length)]);
  const [letters, setLetters] = useState<Letter[]>(() => scramble(entry.word));
  const [built, setBuilt] = useState<Letter[]>([]);
  const [seconds, setSeconds] = useState(ROUND_SECONDS);
  const [phase, setPhase] = useState<Phase>('playing');
  const [wonGh, setWonGh] = useState(0);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTick = () => { if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; } };
  useEffect(() => stopTick, []);

  const newRound = useCallback(() => {
    stopTick();
    const next = WORDS[Math.floor(Math.random() * WORDS.length)];
    setEntry(next);
    setLetters(scramble(next.word));
    setBuilt([]);
    setSeconds(ROUND_SECONDS);
    setPhase('playing');
    setWonGh(0);
  }, []);

  const reward = useGameReward({ onNewRound: newRound, gameName: 'Word Scramble' });

  useEffect(() => {
    if (phase !== 'playing') { stopTick(); return; }
    stopTick();
    tickRef.current = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) { stopTick(); setPhase('lose'); return 0; }
        return prev - 1;
      });
    }, 1000);
    return stopTick;
  }, [phase]);

  const pick = (l: Letter) => {
    if (phase !== 'playing' || l.used) return;
    const nextBuilt = [...built, l];
    setLetters(prev => prev.map(x => (x.id === l.id ? { ...x, used: true } : x)));
    setBuilt(nextBuilt);

    if (nextBuilt.length === entry.word.length) {
      const guess = nextBuilt.map(x => x.ch).join('');
      stopTick();
      if (guess === entry.word) {
        const gh = ghForWord(entry.word.length);
        setWonGh(gh);
        reward.setPendingWin(gh);
        setPhase('win');
      } else {
        setPhase('lose');
      }
    }
  };

  const undo = () => {
    if (phase !== 'playing' || built.length === 0) return;
    const last = built[built.length - 1];
    setBuilt(prev => prev.slice(0, -1));
    setLetters(prev => prev.map(x => (x.id === last.id ? { ...x, used: false } : x)));
  };

  return (
    <GameScreenWrapper
      title="Word Scramble"
      iconName="format-letter-case"
      iconColor="#38BDF8"
      gradientColors={['#04101A', '#06192A', '#082238']}
      scrollable
    >
      <Text style={s.subtitle}>Unscramble the crypto word</Text>

      {reward.isMiningActive === false ? (
        <MiningLockCard gameName="Word Scramble" onPress={() => navigation.goBack()} />
      ) : (
        <>
          {reward.claimedBanner ? <ClaimedBanner text={reward.claimedBanner} /> : null}

          <View style={s.hud}>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>TIME</Text>
              <Text style={[s.hudVal, seconds <= 8 && s.hudDanger]}>{seconds}s</Text>
            </View>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>LETTERS</Text>
              <Text style={s.hudVal}>{entry.word.length}</Text>
            </View>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>WORTH</Text>
              <Text style={s.hudVal}>{ghForWord(entry.word.length)} GH</Text>
            </View>
          </View>

          {phase === 'playing' && (
            <>
              <Text style={s.hint}>{entry.hint}</Text>

              <View style={s.slots}>
                {Array.from({ length: entry.word.length }, (_, i) => (
                  <View key={i} style={[s.slot, built[i] && s.slotFilled]}>
                    <Text style={s.slotTxt}>{built[i]?.ch ?? ''}</Text>
                  </View>
                ))}
              </View>

              <View style={s.tiles}>
                {letters.map(l => (
                  <TouchableOpacity
                    key={l.id}
                    activeOpacity={0.85}
                    disabled={l.used}
                    onPress={() => pick(l)}
                    style={[s.tile, l.used && s.tileUsed]}
                  >
                    <Text style={[s.tileTxt, l.used && s.tileTxtUsed]}>{l.ch}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[s.undoBtn, built.length === 0 && s.undoOff]}
                onPress={undo}
                disabled={built.length === 0}
              >
                <Icon name="backspace-outline" size={18} color={built.length === 0 ? '#64748B' : '#38BDF8'} />
                <Text style={[s.undoTxt, built.length === 0 && s.undoTxtOff]}>Undo</Text>
              </TouchableOpacity>
            </>
          )}

          {phase === 'win' && (
            <WinPanel
              title={`${entry.word} — +${wonGh} GH/s!`}
              gh={wonGh}
              crediting={reward.crediting}
              adLoading={reward.claimAdLoading}
              adLoaded={reward.claimAdLoaded}
              onClaim={reward.openClaimAd}
            />
          )}

          {phase === 'lose' && (
            <LosePanel
              title={seconds === 0 ? "Time's Up!" : 'Not the Word!'}
              body={`The answer was ${entry.word}. Watch a short video to try again.`}
              adLoading={reward.retryAdLoading}
              adLoaded={reward.retryAdLoaded}
              onRetry={reward.openRetryAd}
            />
          )}

          <Text style={s.footer}>Longer words pay more · 8+ letters pays the full 5 GH/s</Text>
        </>
      )}
    </GameScreenWrapper>
  );
}

const s = StyleSheet.create({
  subtitle: { textAlign: 'center', fontSize: 15, fontWeight: '700', color: '#F8FAFC', marginTop: 4, marginBottom: 14 },
  hud: { flexDirection: 'row', gap: 8, marginBottom: 14, width: '100%' },
  hudChip: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingVertical: 8, alignItems: 'center' },
  hudLabel: { color: '#64748B', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  hudVal: { color: '#F8FAFC', fontSize: 16, fontWeight: '900', marginTop: 2 },
  hudDanger: { color: '#F87171' },
  hint: { color: '#94A3B8', fontSize: 13, fontStyle: 'italic', marginBottom: 14, textAlign: 'center' },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 18 },
  slot: {
    width: 34, height: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    borderBottomWidth: 2.5, borderBottomColor: 'rgba(56,189,248,0.4)',
  },
  slotFilled: { backgroundColor: 'rgba(56,189,248,0.12)' },
  slotTxt: { color: '#F8FAFC', fontSize: 20, fontWeight: '900' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 16 },
  tile: {
    width: 46, height: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0D1B2A', borderWidth: 1.5, borderColor: 'rgba(56,189,248,0.4)',
  },
  tileUsed: { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' },
  tileTxt: { color: '#F8FAFC', fontSize: 20, fontWeight: '900' },
  tileTxtUsed: { color: 'rgba(148,163,184,0.25)' },
  undoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 22, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(56,189,248,0.4)',
  },
  undoOff: { borderColor: 'rgba(255,255,255,0.10)' },
  undoTxt: { color: '#38BDF8', fontSize: 13, fontWeight: '800' },
  undoTxtOff: { color: '#64748B' },
  footer: { marginTop: 16, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.45)' },
});

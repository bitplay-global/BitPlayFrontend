import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import GameScreenWrapper from '../components/GameScreenWrapper';
import { useGameReward } from '../hooks/useGameReward';
import { ClaimedBanner, MiningLockCard, WinPanel } from '../components/games/GameOutcome';

/** Max payout -- consumed by GameZoneScreen's "Up to X GH/s" label. */
export const WIN_REWARD_GH = 5;

const ROUND_SECONDS = 20;
const PROMPTS = 12;

const PALETTE: { word: string; hex: string }[] = [
  { word: 'RED', hex: '#F87171' },
  { word: 'GREEN', hex: '#4ADE80' },
  { word: 'BLUE', hex: '#60A5FA' },
  { word: 'YELLOW', hex: '#FBBF24' },
  { word: 'PURPLE', hex: '#C084FC' },
  { word: 'ORANGE', hex: '#FB923C' },
];

/** Correct answers -> reward. Everyone scores something, so there is no loss state. */
const TIERS: { correct: number; gh: number }[] = [
  { correct: 12, gh: 5 },
  { correct: 10, gh: 4 },
  { correct: 8, gh: 3 },
  { correct: 6, gh: 2 },
];
function ghForCorrect(n: number): number {
  for (const t of TIERS) if (n >= t.correct) return t.gh;
  return 1;
}

type Prompt = { word: string; hex: string; matches: boolean };

/** Roughly half the prompts match, so neither answer can be spammed. */
function makePrompt(): Prompt {
  const word = PALETTE[Math.floor(Math.random() * PALETTE.length)];
  if (Math.random() < 0.5) return { word: word.word, hex: word.hex, matches: true };
  const others = PALETTE.filter(p => p.word !== word.word);
  const ink = others[Math.floor(Math.random() * others.length)];
  return { word: word.word, hex: ink.hex, matches: false };
}

type Phase = 'ready' | 'running' | 'done';

export default function ColorClashScreen() {
  const navigation = useNavigation();

  const [prompt, setPrompt] = useState<Prompt>(makePrompt);
  const [answered, setAnswered] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [seconds, setSeconds] = useState(ROUND_SECONDS);
  const [phase, setPhase] = useState<Phase>('ready');
  const [flash, setFlash] = useState<'right' | 'wrong' | null>(null);
  const [wonGh, setWonGh] = useState(0);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flashRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Counters mirrored in refs: the countdown's closure ends the round and needs
  // the live score, not the value captured when the interval was created.
  const correctRef = useRef(0);
  const answeredRef = useRef(0);
  const secondsRef = useRef(ROUND_SECONDS);

  const stopAll = useCallback(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    if (flashRef.current) { clearTimeout(flashRef.current); flashRef.current = null; }
  }, []);
  useEffect(() => stopAll, [stopAll]);

  const newRound = useCallback(() => {
    stopAll();
    correctRef.current = 0;
    answeredRef.current = 0;
    setCorrect(0);
    setAnswered(0);
    secondsRef.current = ROUND_SECONDS;
    setSeconds(ROUND_SECONDS);
    setPrompt(makePrompt());
    setFlash(null);
    setPhase('ready');
    setWonGh(0);
  }, [stopAll]);

  const reward = useGameReward({ onNewRound: newRound, gameName: 'Color Clash' });

  const finish = useCallback(() => {
    stopAll();
    const gh = ghForCorrect(correctRef.current);
    setWonGh(gh);
    reward.setPendingWin(gh);
    setFlash(null);
    setPhase('done');
  }, [reward, stopAll]);

  const finishRef = useRef<() => void>(() => {});
  useEffect(() => { finishRef.current = finish; }, [finish]);

  const start = () => {
    if (phase !== 'ready') return;
    correctRef.current = 0;
    answeredRef.current = 0;
    setCorrect(0);
    setAnswered(0);
    secondsRef.current = ROUND_SECONDS;
    setSeconds(ROUND_SECONDS);
    setPrompt(makePrompt());
    setPhase('running');
    stopAll();
    // The countdown lives in a ref and the updater stays pure: React may run a
    // state updater more than once, and ending the round from inside one fires
    // the finish path twice.
    tickRef.current = setInterval(() => {
      secondsRef.current -= 1;
      setSeconds(Math.max(0, secondsRef.current));
      if (secondsRef.current <= 0) finishRef.current();
    }, 1000);
  };

  const answer = (saidMatch: boolean) => {
    if (phase !== 'running') return;
    const right = saidMatch === prompt.matches;
    answeredRef.current += 1;
    setAnswered(answeredRef.current);
    if (right) {
      correctRef.current += 1;
      setCorrect(correctRef.current);
    }
    setFlash(right ? 'right' : 'wrong');
    if (flashRef.current) clearTimeout(flashRef.current);
    flashRef.current = setTimeout(() => setFlash(null), 180);

    if (answeredRef.current >= PROMPTS) { finish(); return; }
    setPrompt(makePrompt());
  };

  const live = phase === 'running';

  return (
    <GameScreenWrapper
      title="Color Clash"
      iconName="palette-swatch-outline"
      iconColor="#A78BFA"
      gradientColors={['#0B0616', '#150A24', '#1D0E31']}
      scrollable
    >
      <Text style={s.subtitle}>Does the word match the colour it is written in?</Text>

      {reward.isMiningActive === false ? (
        <MiningLockCard gameName="Color Clash" onPress={() => navigation.goBack()} />
      ) : (
        <>
          {reward.claimedBanner ? <ClaimedBanner text={reward.claimedBanner} /> : null}

          <View style={s.hud}>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>TIME</Text>
              <Text style={[s.hudVal, live && seconds <= 5 && s.hudDanger]}>{seconds}s</Text>
            </View>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>DONE</Text>
              <Text style={s.hudVal}>{answered}/{PROMPTS}</Text>
            </View>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>CORRECT</Text>
              <Text style={s.hudVal}>{correct}</Text>
            </View>
          </View>

          {phase !== 'done' && (
            <View
              style={[
                s.stage,
                live && s.stageLive,
                flash === 'right' && s.stageRight,
                flash === 'wrong' && s.stageWrong,
              ]}
            >
              {live ? (
                <Text style={[s.word, { color: prompt.hex }]}>{prompt.word}</Text>
              ) : (
                <>
                  <Icon name="invert-colors" size={40} color="#A78BFA" />
                  <Text style={s.stageHint}>Read the colour, not the word</Text>
                </>
              )}
            </View>
          )}

          {phase === 'ready' && (
            <TouchableOpacity style={s.startBtn} activeOpacity={0.88} onPress={start}>
              <Icon name="play" size={20} color="#0B0616" />
              <Text style={s.startTxt}>Start</Text>
            </TouchableOpacity>
          )}

          {live && (
            <View style={s.answers}>
              <TouchableOpacity style={[s.ansBtn, s.ansYes]} activeOpacity={0.85} onPress={() => answer(true)}>
                <Icon name="check-bold" size={22} color="#04120B" />
                <Text style={s.ansYesTxt}>Match</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.ansBtn, s.ansNo]} activeOpacity={0.85} onPress={() => answer(false)}>
                <Icon name="close-thick" size={22} color="#FFF" />
                <Text style={s.ansNoTxt}>No Match</Text>
              </TouchableOpacity>
            </View>
          )}

          {phase === 'done' && (
            <WinPanel
              title={`${correct}/${PROMPTS} correct — +${wonGh} GH/s!`}
              gh={wonGh}
              crediting={reward.crediting}
              adLoading={reward.claimAdLoading}
              adLoaded={reward.claimAdLoaded}
              onClaim={reward.openClaimAd}
            />
          )}

          <Text style={s.footer}>All {PROMPTS} correct pays the full 5 GH/s · every run pays something</Text>
        </>
      )}
    </GameScreenWrapper>
  );
}

const s = StyleSheet.create({
  subtitle: { textAlign: 'center', fontSize: 15, fontWeight: '700', color: '#F8FAFC', marginTop: 4, marginBottom: 14 },
  hud: { flexDirection: 'row', gap: 8, marginBottom: 16, width: '100%' },
  hudChip: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingVertical: 8, alignItems: 'center' },
  hudLabel: { color: '#64748B', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  hudVal: { color: '#F8FAFC', fontSize: 17, fontWeight: '900', marginTop: 2 },
  hudDanger: { color: '#F87171' },
  stage: {
    width: '100%', minHeight: 190, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#120823', borderWidth: 2, borderColor: 'rgba(255,255,255,0.10)', marginBottom: 16,
  },
  stageLive: { borderColor: 'rgba(167,139,250,0.55)' },
  stageRight: { borderColor: '#4ADE80' },
  stageWrong: { borderColor: '#F87171' },
  word: { fontSize: 46, fontWeight: '900', letterSpacing: 2 },
  stageHint: { color: 'rgba(255,255,255,0.5)', fontSize: 12.5, fontWeight: '700' },
  answers: { flexDirection: 'row', gap: 12, width: '100%' },
  ansBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 58, borderRadius: 16,
  },
  ansYes: {
    backgroundColor: '#4ADE80',
    shadowColor: '#22C55E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  ansNo: {
    backgroundColor: '#B91C1C',
    shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  ansYesTxt: { color: '#04120B', fontSize: 16, fontWeight: '900' },
  ansNoTxt: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 54, width: '100%', borderRadius: 16, backgroundColor: '#A78BFA',
    shadowColor: '#A78BFA', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  startTxt: { color: '#0B0616', fontSize: 16, fontWeight: '900' },
  footer: { marginTop: 16, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.45)' },
});

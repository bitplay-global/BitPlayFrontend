import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import GameScreenWrapper from '../components/GameScreenWrapper';
import { useGameReward } from '../hooks/useGameReward';
import { ClaimedBanner, LosePanel, MiningLockCard, WinPanel } from '../components/games/GameOutcome';

/** Max payout -- consumed by GameZoneScreen's "Up to X GH/s" label. */
export const WIN_REWARD_GH = 5;

const ROUND_SECONDS = 12;
/** Correct answers in a row -> reward. Clearing the last rung pays the full 5. */
const GH_BY_STREAK = [1, 2, 3, 4, 5];
const MAX_STREAK = GH_BY_STREAK.length;

type Problem = { text: string; answer: number; options: number[] };

/** Difficulty climbs with the streak so later questions are worth the payout. */
function buildProblem(streak: number): Problem {
  const hard = streak >= 3;
  const ops = hard ? ['+', '-', '×'] : ['+', '-'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  const range = hard ? 12 : 20;

  let a: number, b: number, answer: number;
  if (op === '×') {
    a = 2 + Math.floor(Math.random() * range);
    b = 2 + Math.floor(Math.random() * 9);
    answer = a * b;
  } else if (op === '+') {
    a = 5 + Math.floor(Math.random() * (range * 2));
    b = 5 + Math.floor(Math.random() * (range * 2));
    answer = a + b;
  } else {
    a = 20 + Math.floor(Math.random() * (range * 2));
    b = 1 + Math.floor(Math.random() * 19);
    answer = a - b;               // kept positive so answers stay natural
  }

  const options = new Set<number>([answer]);
  while (options.size < 4) {
    const drift = Math.max(1, Math.round(answer * 0.12));
    const cand = answer + (Math.floor(Math.random() * (drift * 2 + 1)) - drift) + (Math.random() < 0.4 ? 1 : 0);
    if (cand !== answer && cand > 0) options.add(cand);
  }
  const shuffled = [...options];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return { text: `${a} ${op} ${b}`, answer, options: shuffled };
}

type Phase = 'playing' | 'win' | 'lose';

export default function MathBlitzScreen() {
  const navigation = useNavigation();

  const [streak, setStreak] = useState(0);
  const [problem, setProblem] = useState<Problem>(() => buildProblem(0));
  const [seconds, setSeconds] = useState(ROUND_SECONDS);
  const [phase, setPhase] = useState<Phase>('playing');
  const [wonGh, setWonGh] = useState(0);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTick = () => { if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; } };
  useEffect(() => stopTick, []);

  const newRound = useCallback(() => {
    stopTick();
    setStreak(0);
    setProblem(buildProblem(0));
    setSeconds(ROUND_SECONDS);
    setPhase('playing');
    setWonGh(0);
  }, []);

  const reward = useGameReward({ onNewRound: newRound, gameName: 'Math Blitz' });

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
  }, [phase, streak]);

  const answer = (v: number) => {
    if (phase !== 'playing') return;
    if (v !== problem.answer) { stopTick(); setPhase('lose'); return; }

    const next = streak + 1;
    if (next >= MAX_STREAK) {
      stopTick();
      const gh = GH_BY_STREAK[MAX_STREAK - 1];
      setWonGh(gh);
      reward.setPendingWin(gh);
      setStreak(next);
      setPhase('win');
      return;
    }
    setStreak(next);
    setProblem(buildProblem(next));
    setSeconds(ROUND_SECONDS);
  };

  const bank = () => {
    if (phase !== 'playing' || streak === 0) return;
    stopTick();
    const gh = GH_BY_STREAK[streak - 1];
    setWonGh(gh);
    reward.setPendingWin(gh);
    setPhase('win');
  };

  return (
    <GameScreenWrapper
      title="Math Blitz"
      iconName="calculator-variant-outline"
      iconColor="#4ADE80"
      gradientColors={['#050D0A', '#07160F', '#0A1F16']}
      scrollable
    >
      <Text style={s.subtitle}>Answer before the clock runs out</Text>

      {reward.isMiningActive === false ? (
        <MiningLockCard gameName="Math Blitz" onPress={() => navigation.goBack()} />
      ) : (
        <>
          {reward.claimedBanner ? <ClaimedBanner text={reward.claimedBanner} /> : null}

          <View style={s.hud}>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>TIME</Text>
              <Text style={[s.hudVal, seconds <= 4 && s.hudDanger]}>{seconds}s</Text>
            </View>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>STREAK</Text>
              <Text style={s.hudVal}>{Math.min(streak + 1, MAX_STREAK)}/{MAX_STREAK}</Text>
            </View>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>WORTH</Text>
              <Text style={s.hudVal}>{streak === 0 ? '—' : `${GH_BY_STREAK[streak - 1]} GH`}</Text>
            </View>
          </View>

          {phase === 'playing' && (
            <>
              <View style={s.problemCard}>
                <Text style={s.problemTxt}>{problem.text}</Text>
                <Text style={s.problemEq}>= ?</Text>
              </View>

              <View style={s.options}>
                {problem.options.map(o => (
                  <TouchableOpacity key={o} style={s.option} activeOpacity={0.85} onPress={() => answer(o)}>
                    <Text style={s.optionTxt}>{o}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[s.bankBtn, streak === 0 && s.bankOff]}
                onPress={bank}
                disabled={streak === 0}
              >
                <Text style={[s.bankTxt, streak === 0 && s.bankTxtOff]}>
                  {streak === 0 ? 'Answer one to bank' : `Bank ${GH_BY_STREAK[streak - 1]} GH/s`}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {phase === 'win' && (
            <WinPanel
              title={`Banked +${wonGh} GH/s!`}
              gh={wonGh}
              crediting={reward.crediting}
              adLoading={reward.claimAdLoading}
              adLoaded={reward.claimAdLoaded}
              onClaim={reward.openClaimAd}
            />
          )}

          {phase === 'lose' && (
            <LosePanel
              title={seconds === 0 ? "Time's Up!" : 'Wrong Answer!'}
              body={`${problem.text} = ${problem.answer}. Watch a short video to try again.`}
              adLoading={reward.retryAdLoading}
              adLoaded={reward.retryAdLoaded}
              onRetry={reward.openRetryAd}
            />
          )}

          <Text style={s.footer}>Questions get harder · bank any time or clear all {MAX_STREAK}</Text>
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
  hudVal: { color: '#F8FAFC', fontSize: 16, fontWeight: '900', marginTop: 2 },
  hudDanger: { color: '#F87171' },
  problemCard: {
    width: '100%', alignItems: 'center', paddingVertical: 22, borderRadius: 18, marginBottom: 18,
    backgroundColor: 'rgba(74,222,128,0.07)', borderWidth: 1.5, borderColor: 'rgba(74,222,128,0.3)',
  },
  problemTxt: { color: '#F8FAFC', fontSize: 36, fontWeight: '900', letterSpacing: 1 },
  problemEq: { color: '#4ADE80', fontSize: 16, fontWeight: '800', marginTop: 4 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: '100%', marginBottom: 16 },
  option: {
    width: '47%', minHeight: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0C1A12', borderWidth: 1.5, borderColor: 'rgba(74,222,128,0.35)',
  },
  optionTxt: { color: '#F8FAFC', fontSize: 22, fontWeight: '900' },
  bankBtn: {
    minHeight: 48, width: '100%', borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#4ADE80',
  },
  bankOff: { backgroundColor: 'rgba(255,255,255,0.06)' },
  bankTxt: { color: '#052E16', fontSize: 15, fontWeight: '900' },
  bankTxtOff: { color: '#64748B', fontWeight: '700' },
  footer: { marginTop: 16, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.45)' },
});

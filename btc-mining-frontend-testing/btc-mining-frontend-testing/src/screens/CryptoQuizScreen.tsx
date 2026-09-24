import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import GameScreenWrapper from '../components/GameScreenWrapper';
import { useGameReward } from '../hooks/useGameReward';
import { ClaimedBanner, LosePanel, MiningLockCard, WinPanel } from '../components/games/GameOutcome';

/** Max payout -- consumed by GameZoneScreen's "Up to X GH/s" label. */
export const WIN_REWARD_GH = 5;

const QUESTIONS_PER_ROUND = 4;
const SECONDS_PER_QUESTION = 10;
/** How long the right/wrong colouring stays up before the next question. */
const FEEDBACK_MS = 850;

/**
 * Question bank. The FIRST option is always the correct one; options are
 * shuffled at deal time, so the answer's position is never predictable.
 *
 * Kept as plain data so questions can be added without touching game logic.
 */
const BANK: { q: string; options: string[] }[] = [
  { q: 'How many bitcoins will ever exist?', options: ['21 million', '100 million', '1 billion', '50 million'] },
  { q: 'Who published the Bitcoin white paper?', options: ['Satoshi Nakamoto', 'Vitalik Buterin', 'Charlie Lee', 'Hal Finney'] },
  { q: 'What is the smallest unit of Bitcoin called?', options: ['A satoshi', 'A wei', 'A gwei', 'A bit'] },
  { q: 'Roughly how often does Bitcoin produce a new block?', options: ['Every 10 minutes', 'Every 10 seconds', 'Every hour', 'Once a day'] },
  { q: 'What is the event that cuts the block reward in half?', options: ['The halving', 'The fork', 'The burn', 'The airdrop'] },
  { q: 'Which network made smart contracts widely popular?', options: ['Ethereum', 'Litecoin', 'Dogecoin', 'Monero'] },
  { q: 'What does the slang "HODL" tell you to do?', options: ['Keep holding instead of selling', 'Sell at the first profit', 'Trade every day', 'Move coins to an exchange'] },
  { q: 'What does a crypto wallet actually store?', options: ['Your private keys', 'Your coins as files', 'Your password history', 'Your transaction fees'] },
  { q: 'What is a private key for?', options: ['Proving you own your coins', 'Receiving payments only', 'Speeding up transfers', 'Lowering network fees'] },
  { q: 'Which consensus mechanism does Bitcoin use?', options: ['Proof of Work', 'Proof of Stake', 'Proof of Authority', 'Proof of History'] },
  { q: 'Ethereum switched in 2022 to which mechanism?', options: ['Proof of Stake', 'Proof of Work', 'Proof of Burn', 'Proof of Space'] },
  { q: 'What is a stablecoin designed to do?', options: ['Track a steady asset like the US dollar', 'Rise in value every year', 'Pay the highest mining reward', 'Replace all other coins'] },
  { q: 'What are unconfirmed transactions waiting in called?', options: ['The mempool', 'The blockchain', 'The wallet', 'The cold store'] },
  { q: 'What does an NFT represent?', options: ['Ownership of a unique digital item', 'A coin pegged to gold', 'A mining contract', 'A type of exchange fee'] },
  { q: 'On Ethereum, what is "gas"?', options: ['The fee paid for a transaction', 'The speed of a block', 'A staking reward', 'A wallet backup'] },
  { q: 'What year was the Bitcoin white paper published?', options: ['2008', '2010', '2013', '2005'] },
  { q: 'What is the ticker symbol for Ethereum?', options: ['ETH', 'ETC', 'ETR', 'ETM'] },
  { q: 'What does "DeFi" stand for?', options: ['Decentralized finance', 'Deferred finance', 'Defined finance', 'Digital fiat'] },
  { q: 'What happens during a blockchain "fork"?', options: ['The chain splits into two versions', 'All coins are burned', 'Mining stops permanently', 'Fees are refunded'] },
  { q: 'What is a "cold wallet"?', options: ['A wallet kept offline', 'A wallet with no balance', 'An exchange account', 'A shared wallet'] },
  { q: 'What does a seed phrase let you do?', options: ['Restore your wallet', 'Mine faster', 'Cancel a transaction', 'Lower your fees'] },
  { q: 'What was the block reward in Bitcoin’s first years?', options: ['50 BTC', '21 BTC', '100 BTC', '6.25 BTC'] },
  { q: 'What did the 2024 halving cut the block reward to?', options: ['3.125 BTC', '6.25 BTC', '12.5 BTC', '1.5625 BTC'] },
  { q: 'What does "KYC" stand for?', options: ['Know Your Customer', 'Keep Your Coins', 'Key Yield Contract', 'Known Yield Curve'] },
  { q: 'What is a "bull market"?', options: ['A market with rising prices', 'A market with falling prices', 'A market that is closed', 'A market with no trades'] },
  { q: 'What is a crypto "whale"?', options: ['Someone holding a very large amount', 'A failed transaction', 'A type of mining rig', 'An exchange outage'] },
  { q: 'What does mining actually do for the network?', options: ['Validates transactions and secures it', 'Prints new wallets', 'Sets the coin price', 'Stores user passwords'] },
  { q: 'Which of these is a layer-2 network for Ethereum?', options: ['Arbitrum', 'Cardano', 'Solana', 'Monero'] },
];

/** Correct answers -> reward. Two right still pays; below that is a loss. */
function ghForScore(correct: number): number {
  if (correct >= 4) return 5;
  if (correct === 3) return 3;
  if (correct === 2) return 1;
  return 0;
}

type Dealt = { q: string; options: string[]; answer: string };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function dealQuestions(): Dealt[] {
  return shuffle(BANK)
    .slice(0, QUESTIONS_PER_ROUND)
    .map(item => ({ q: item.q, answer: item.options[0], options: shuffle(item.options) }));
}

type Phase = 'ready' | 'running' | 'done';

export default function CryptoQuizScreen() {
  const navigation = useNavigation();

  const [deck, setDeck] = useState<Dealt[]>(dealQuestions);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [seconds, setSeconds] = useState(SECONDS_PER_QUESTION);
  const [phase, setPhase] = useState<Phase>('ready');
  const [picked, setPicked] = useState<string | null>(null);
  const [wonGh, setWonGh] = useState(0);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Score and position are mirrored in refs so the timer's closure -- which is
  // created once per question -- always advances from the current values.
  const correctRef = useRef(0);
  const indexRef = useRef(0);
  const secondsRef = useRef(SECONDS_PER_QUESTION);
  // Mirrors `picked` so a second touch delivered in the same frame -- which
  // still sees picked === null in its closure -- cannot answer twice.
  const pickedRef = useRef<string | null>(null);

  const stopAll = useCallback(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    if (nextRef.current) { clearTimeout(nextRef.current); nextRef.current = null; }
  }, []);
  useEffect(() => stopAll, [stopAll]);

  const newRound = useCallback(() => {
    stopAll();
    correctRef.current = 0;
    indexRef.current = 0;
    setDeck(dealQuestions());
    setIndex(0);
    setCorrect(0);
    secondsRef.current = SECONDS_PER_QUESTION;
    pickedRef.current = null;
    setSeconds(SECONDS_PER_QUESTION);
    setPicked(null);
    setPhase('ready');
    setWonGh(0);
  }, [stopAll]);

  const reward = useGameReward({ onNewRound: newRound, gameName: 'Crypto Quiz' });

  const finish = useCallback(() => {
    stopAll();
    const gh = ghForScore(correctRef.current);
    setWonGh(gh);
    if (gh > 0) reward.setPendingWin(gh);
    setPhase('done');
  }, [reward, stopAll]);

  // `advance` is re-created whenever the reward object changes, but the timer
  // must always call the CURRENT one. Holding it in a ref keeps the interval
  // callback stable while still reaching the latest closure.
  const advanceRef = useRef<() => void>(() => {});

  /**
   * Starts (or restarts) the countdown for whichever question is showing.
   *
   * The expiry is decided OUTSIDE the setSeconds updater deliberately. React
   * may invoke an updater more than once, and an updater that also schedules
   * the "move to the next question" timeout was doing exactly that -- a single
   * answer skipped the following question as a phantom timeout. Updaters here
   * stay pure; the countdown itself lives in secondsRef.
   */
  const runTimer = useCallback(() => {
    stopAll();
    secondsRef.current = SECONDS_PER_QUESTION;
    setSeconds(SECONDS_PER_QUESTION);
    const startedOn = indexRef.current;
    tickRef.current = setInterval(() => {
      secondsRef.current -= 1;
      setSeconds(Math.max(0, secondsRef.current));
      if (secondsRef.current > 0) return;
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      // An interval left over from an earlier question must never answer this one.
      if (indexRef.current !== startedOn || pickedRef.current != null) return;
      pickedRef.current = '__timeout__';
      setPicked('__timeout__');
      nextRef.current = setTimeout(() => advanceRef.current(), FEEDBACK_MS);
    }, 1000);
  }, [stopAll]);

  const advance = useCallback(() => {
    const next = indexRef.current + 1;
    if (next >= QUESTIONS_PER_ROUND) { finish(); return; }
    indexRef.current = next;
    setIndex(next);
    pickedRef.current = null;
    setPicked(null);
    runTimer();
  }, [finish, runTimer]);
  useEffect(() => { advanceRef.current = advance; }, [advance]);

  const start = () => {
    if (phase !== 'ready') return;
    correctRef.current = 0;
    indexRef.current = 0;
    setCorrect(0);
    setIndex(0);
    pickedRef.current = null;
    setPicked(null);
    setPhase('running');
    runTimer();
  };

  const onPick = (option: string) => {
    if (phase !== 'running' || pickedRef.current != null) return;
    stopAll();
    pickedRef.current = option;
    setPicked(option);
    if (option === deck[indexRef.current].answer) {
      correctRef.current += 1;
      setCorrect(correctRef.current);
    }
    nextRef.current = setTimeout(() => advanceRef.current(), FEEDBACK_MS);
  };

  const current = deck[index];

  return (
    <GameScreenWrapper
      title="Crypto Quiz"
      iconName="help-circle-outline"
      iconColor="#38BDF8"
      gradientColors={['#040D17', '#07182A', '#0A2038']}
      scrollable
    >
      <Text style={s.subtitle}>Answer {QUESTIONS_PER_ROUND} questions before the clock runs out</Text>

      {reward.isMiningActive === false ? (
        <MiningLockCard gameName="Crypto Quiz" onPress={() => navigation.goBack()} />
      ) : (
        <>
          {reward.claimedBanner ? <ClaimedBanner text={reward.claimedBanner} /> : null}

          <View style={s.hud}>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>TIME</Text>
              <Text style={[s.hudVal, phase === 'running' && seconds <= 3 && s.hudDanger]}>{seconds}s</Text>
            </View>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>QUESTION</Text>
              <Text style={s.hudVal}>{Math.min(index + 1, QUESTIONS_PER_ROUND)}/{QUESTIONS_PER_ROUND}</Text>
            </View>
            <View style={s.hudChip}>
              <Text style={s.hudLabel}>CORRECT</Text>
              <Text style={s.hudVal}>{correct}</Text>
            </View>
          </View>

          {phase === 'ready' && (
            <>
              <View style={s.stage}>
                <Icon name="head-question-outline" size={40} color="#38BDF8" />
                <Text style={s.stageTitle}>How well do you know crypto?</Text>
                <Text style={s.stageBody}>
                  4 right pays 5 GH/s · 3 pays 3 GH/s · 2 pays 1 GH/s
                </Text>
              </View>
              <TouchableOpacity style={s.startBtn} activeOpacity={0.88} onPress={start}>
                <Icon name="play" size={20} color="#040D17" />
                <Text style={s.startTxt}>Start Quiz</Text>
              </TouchableOpacity>
            </>
          )}

          {phase === 'running' && current && (
            <>
              <View style={s.qCard}>
                <Text style={s.qText}>{current.q}</Text>
              </View>
              {current.options.map(opt => {
                const isAnswer = opt === current.answer;
                const revealed = picked != null;
                return (
                  <TouchableOpacity
                    key={opt}
                    activeOpacity={0.85}
                    disabled={revealed}
                    onPress={() => onPick(opt)}
                    style={[
                      s.opt,
                      revealed && isAnswer && s.optRight,
                      revealed && !isAnswer && picked === opt && s.optWrong,
                    ]}
                  >
                    <Text style={[s.optTxt, revealed && isAnswer && s.optTxtRight]}>{opt}</Text>
                    {revealed && isAnswer && <Icon name="check-bold" size={18} color="#4ADE80" />}
                    {revealed && !isAnswer && picked === opt && <Icon name="close-thick" size={18} color="#F87171" />}
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {phase === 'done' && wonGh > 0 && (
            <WinPanel
              title={`${correct}/${QUESTIONS_PER_ROUND} correct — +${wonGh} GH/s!`}
              gh={wonGh}
              crediting={reward.crediting}
              adLoading={reward.claimAdLoading}
              adLoaded={reward.claimAdLoaded}
              onClaim={reward.openClaimAd}
            />
          )}

          {phase === 'done' && wonGh === 0 && (
            <LosePanel
              title={`Only ${correct}/${QUESTIONS_PER_ROUND} correct`}
              body="You need at least 2 right to earn. Watch a short video for a fresh set of questions."
              adLoading={reward.retryAdLoading}
              adLoaded={reward.retryAdLoaded}
              onRetry={reward.openRetryAd}
            />
          )}

          <Text style={s.footer}>{SECONDS_PER_QUESTION} seconds per question · questions change every round</Text>
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
    width: '100%', minHeight: 170, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 20, backgroundColor: '#07131F',
    borderWidth: 2, borderColor: 'rgba(56,189,248,0.25)', marginBottom: 16,
  },
  stageTitle: { color: '#F8FAFC', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  stageBody: { color: 'rgba(255,255,255,0.55)', fontSize: 12.5, fontWeight: '600', textAlign: 'center' },
  qCard: {
    width: '100%', borderRadius: 16, padding: 18, marginBottom: 12,
    backgroundColor: '#07131F', borderWidth: 1.5, borderColor: 'rgba(56,189,248,0.30)',
  },
  qText: { color: '#F8FAFC', fontSize: 16.5, fontWeight: '800', lineHeight: 23, textAlign: 'center' },
  opt: {
    width: '100%', minHeight: 52, borderRadius: 14, marginBottom: 10,
    paddingVertical: 12, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.10)',
  },
  optRight: { backgroundColor: 'rgba(34,197,94,0.14)', borderColor: '#4ADE80' },
  optWrong: { backgroundColor: 'rgba(239,68,68,0.14)', borderColor: '#F87171' },
  optTxt: { flex: 1, color: '#E2E8F0', fontSize: 14.5, fontWeight: '700' },
  optTxtRight: { color: '#DCFCE7' },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 54, width: '100%', borderRadius: 16, backgroundColor: '#38BDF8',
    shadowColor: '#38BDF8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  startTxt: { color: '#040D17', fontSize: 16, fontWeight: '900' },
  footer: { marginTop: 16, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.45)' },
});

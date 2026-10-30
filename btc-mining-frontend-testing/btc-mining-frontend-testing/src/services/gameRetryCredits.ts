import { getObjectFromStorage, saveObjectToStorage } from '../config/storage';

/**
 * Free retries after a lost game round.
 *
 * A loss used to require a rewarded video before every new attempt. Now the
 * first losses are free: with FREE_GAME_RETRIES = 2, losses 1 and 2 retry at
 * once and loss 3 asks for a video, after which the count starts again. A
 * video watched to claim a win also starts it again. Wins are unchanged: a
 * win is still redeemed by watching a video.
 *
 * Counted per game and kept in storage, so leaving and reopening a game does
 * not reset it. Nothing is credited on a loss, so a free retry costs no GH/s;
 * the backend's own per-day game limits still apply to wins.
 *
 * The number can be changed from the backend without an app release
 * (ads config `gameFreeRetries`, read by AdConfigProvider).
 */
export const FREE_GAME_RETRIES = 2;

const KEY = 'gameRetryCredits:v1';

type Counts = Record<string, number>; // game -> losses retried for free since the last video

function load(): Counts {
  const v = getObjectFromStorage(KEY);
  return v && typeof v === 'object' ? (v as Counts) : {};
}

function normalise(free: number | null | undefined): number {
  return typeof free === 'number' && Number.isFinite(free) && free >= 0 ? Math.floor(free) : FREE_GAME_RETRIES;
}

/** Free retries this game has left before the next loss needs a video. */
export function freeRetriesLeft(game: string, free?: number | null): number {
  return Math.max(0, normalise(free) - (load()[game] || 0));
}

/** Uses one free retry if any is left. Returns true when it did. */
export function takeFreeRetry(game: string, free?: number | null): boolean {
  if (freeRetriesLeft(game, free) <= 0) return false;
  const counts = load();
  counts[game] = (counts[game] || 0) + 1;
  saveObjectToStorage(KEY, counts);
  return true;
}

// --- Lucky round ---------------------------------------------------------
// After LUCKY_AFTER_LOSSES losses in a row in a chance game, the next round
// has better odds: a losing roll is rolled once more (a 55% loss chance
// becomes about 30%). Prize amounts never change, and the backend's game
// limits still apply. Counted per game; a win clears it.

export const LUCKY_AFTER_LOSSES = 2;
/** Games whose odds a lucky round improves (they call luckyRoll / isLuckyRound). */
export const LUCKY_GAMES = new Set(['Spin & Win', 'Scratch & Win', 'Lucky Dice', 'Slot Machine', 'Rock Paper Scissors', 'Tap to Bomb']);
const LOSS_KEY = 'gameLossStreak:v1';

function lossCounts(): Counts {
  const v = getObjectFromStorage(LOSS_KEY);
  return v && typeof v === 'object' ? (v as Counts) : {};
}

/** A round in this game was lost. */
export function noteLoss(game: string): void {
  const c = lossCounts();
  c[game] = Math.min((c[game] || 0) + 1, 99);
  saveObjectToStorage(LOSS_KEY, c);
}

/** A round in this game was won: the loss run ends. */
export function noteWin(game: string): void {
  const c = lossCounts();
  if (!c[game]) return;
  delete c[game];
  saveObjectToStorage(LOSS_KEY, c);
}

/** True when the next round in this game is a lucky round. */
export function isLuckyRound(game: string): boolean {
  return (lossCounts()[game] || 0) >= LUCKY_AFTER_LOSSES;
}

/**
 * Rolls an outcome; on a lucky round a losing outcome is rolled once more.
 * `roll` must be the game's normal random roll, `isLoss` its loss test.
 */
export function luckyRoll<T>(game: string, roll: () => T, isLoss: (t: T) => boolean): T {
  const first = roll();
  return isLoss(first) && isLuckyRound(game) ? roll() : first;
}

/** A video was watched in this game: the free retries start again. */
export function resetFreeRetries(game: string): void {
  const counts = load();
  if (!counts[game]) return;
  delete counts[game];
  saveObjectToStorage(KEY, counts);
}

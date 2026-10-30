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

/** A video was watched in this game: the free retries start again. */
export function resetFreeRetries(game: string): void {
  const counts = load();
  if (!counts[game]) return;
  delete counts[game];
  saveObjectToStorage(KEY, counts);
}

import { useCallback, useEffect, useState } from 'react';
import { useAdConfig } from '../providers/AdConfigProvider';
import { freeRetriesLeft, resetFreeRetries, noteLoss, noteWin } from '../services/gameRetryCredits';

/**
 * Free retries after a loss, for the games that run their own retry video
 * instead of useGameReward (which does the same internally). See
 * services/gameRetryCredits.ts for the rule.
 */
export function useFreeRetries(game: string) {
  const { ads } = useAdConfig();
  const free = ads.gameFreeRetries;
  const [left, setLeft] = useState(() => freeRetriesLeft(game, free));
  const refresh = useCallback(() => setLeft(freeRetriesLeft(game, free)), [game, free]);
  useEffect(() => { refresh(); }, [refresh]);

  /**
   * Retrying is always free (AdMob rewarded-ads policy, "user choice": a video
   * may never be the only way to keep playing). Records the loss for the
   * lucky round and always returns true: start the new round now, no video.
   */
  const tryFree = useCallback(() => {
    noteLoss(game);
    return true;
  }, [game]);

  /** Call after any fully watched video in this game. */
  const reset = useCallback(() => {
    resetFreeRetries(game);
    refresh();
  }, [game, refresh]);

  /** Call when a round is won (ends the loss run for the lucky round). */
  const won = useCallback(() => noteWin(game), [game]);

  // Unlimited: no game ever falls back to a required video.
  void left;
  return { left: Number.POSITIVE_INFINITY, tryFree, reset, won };
}

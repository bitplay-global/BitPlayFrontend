import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../auth/AuthProvider';
import { useHashPower } from '../stores/HashPowerStore';
import { useAdConfig } from '../providers/AdConfigProvider';
import { useRewardedVideoAd } from '../services/googleAds';
import { get_data_uri } from '../config/api';

/**
 * The ad-gated reward flow every mini-game shares.
 *
 * Extracted because four games were about to repeat the same ~80 lines. The
 * rules encoded here are the ones that are easy to get subtly wrong:
 *
 *  - A reward is credited ONLY on EARNED_REWARD (a full watch). `onAdClosed`
 *    fires on every close, so the earned flag is set in the reward callback and
 *    consumed on close -- a skipped ad grants nothing.
 *  - `pendingWinGh` is nulled only once the reward actually fires, so a skipped
 *    claim ad neither pays out nor silently discards a still-valid win.
 *  - Credit goes to HashPowerStore immediately so Home reflects it at once; the
 *    backend POST is a best-effort record and its response is deliberately NOT
 *    used to overwrite hashPower (a read-after-write that hasn't caught up
 *    would clobber the optimistic credit back down).
 */
export function useGameReward({
  onNewRound,
  gameName,
}: {
  /** Called after a successful claim or a successful ad-gated retry. Must be stable. */
  onNewRound: () => void;
  /** Used only in the "still loading" copy. */
  gameName?: string;
}) {
  const { user } = useAuth();
  const { addHashPower, isMiningActive: storeMiningActive } = useHashPower();
  const { ads } = useAdConfig();

  // Local mirror of the store value so the lock shows without waiting on the
  // network, refreshed against the authoritative backend value on focus.
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

  const [crediting, setCrediting] = useState(false);
  const [claimedBanner, setClaimedBanner] = useState<string | null>(null);

  const pendingWinGh = useRef<number | null>(null);
  const claimEarnedRef = useRef(false);
  const retryEarnedRef = useRef(false);

  /** Arm a win so the claim button can redeem it. */
  const setPendingWin = useCallback((gh: number) => { pendingWinGh.current = gh; }, []);
  /** Clear reward state when the game deals a fresh round. */
  const resetReward = useCallback(() => {
    pendingWinGh.current = null;
    setClaimedBanner(null);
  }, []);

  const onClaimAdReward = useCallback(async () => {
    claimEarnedRef.current = true;
    const gh = pendingWinGh.current;
    if (gh == null || !user?.id) return;
    pendingWinGh.current = null; // guard against a double EARNED_REWARD fire
    setCrediting(true);
    addHashPower(gh);
    try {
      await fetch(get_data_uri('USERMININGDETAILS'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          hashpower: gh,
          offset: new Date().getTimezoneOffset(),
        }),
      });
    } catch {
      // Local credit already stands; the backend record is best-effort.
    }
    setCrediting(false);
    setClaimedBanner(`+${gh} GH/s is now in your mining power.`);
  }, [user?.id, addHashPower]);

  const onClaimAdClosed = useCallback(() => {
    if (claimEarnedRef.current) {
      claimEarnedRef.current = false;
      onNewRound();
    } else {
      Alert.alert('Ad not completed', 'Please watch the full video to redeem your reward.');
    }
  }, [onNewRound]);

  const {
    show: showClaimAd, loading: claimAdLoading, loaded: claimAdLoaded,
  } = useRewardedVideoAd(onClaimAdReward, { primaryUnitId: ads.rewardedVideoId }, onClaimAdClosed);

  const onRetryAdReward = useCallback(() => { retryEarnedRef.current = true; }, []);
  const onRetryAdClosed = useCallback(() => {
    if (retryEarnedRef.current) {
      retryEarnedRef.current = false;
      onNewRound();
    } else {
      Alert.alert('Ad not completed', 'Please watch the full video to try again.');
    }
  }, [onNewRound]);

  const {
    show: showRetryAd, loading: retryAdLoading, loaded: retryAdLoaded,
  } = useRewardedVideoAd(onRetryAdReward, { primaryUnitId: ads.rewardedVideoId }, onRetryAdClosed);

  // When the ad is not ready, still call show(): it kicks off a fresh request
  // rather than leaving the user with a button that only ever apologises. That
  // was how a single failed request became permanent -- nothing retried, and
  // this early return meant nothing ever asked it to.
  const openClaimAd = useCallback(() => {
    if (pendingWinGh.current == null) return;
    if (!claimAdLoaded) {
      showClaimAd();
      Alert.alert('Almost ready', 'The reward video is still loading. Try again in a few seconds.');
      return;
    }
    showClaimAd();
  }, [claimAdLoaded, showClaimAd]);

  const openRetryAd = useCallback(() => {
    if (!retryAdLoaded) {
      showRetryAd();
      Alert.alert('Almost ready', 'The video is still loading. Try again in a few seconds.');
      return;
    }
    showRetryAd();
  }, [retryAdLoaded, showRetryAd]);

  return {
    isMiningActive,
    crediting,
    claimedBanner,
    setPendingWin,
    resetReward,
    openClaimAd, claimAdLoading, claimAdLoaded,
    openRetryAd, retryAdLoading, retryAdLoaded,
  };
}

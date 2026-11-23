import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useRewardedVideoAd } from '../services/googleAds';
import { useAdConfig } from '../providers/AdConfigProvider';
import { useHashPower } from '../stores/HashPowerStore';
import { useAuth } from '../auth/AuthProvider';
import { GAME_AD_REWARD_GH, grantGameAdReward } from '../utils/hashpowerReward';

/**
 * Shared rewarded-ad hook for all mini-games.
 *
 * - Earn ad: user watches a full ad → receives GAME_AD_REWARD_GH (5) GH/s
 * - Retry ad: user watches a full ad → onReset() is called so game restarts
 *
 * If the ad isn't loaded yet when the user taps, we queue the request and
 * auto-show it the moment it finishes loading — no blocking Alert.
 */
export function useGameAds(onReset: () => void) {
  const { user } = useAuth();
  const { addHashPower, setHashPower } = useHashPower();
  const { ads } = useAdConfig();
  const [ghEarned, setGhEarned] = useState(0);

  // Pending-show flags: set when user taps before ad is ready
  const pendingEarnRef = useRef(false);
  const pendingRetryRef = useRef(false);

  // --- Earn ad (grants 5 GH/s) ---
  const earnedRef = useRef(false);

  const onEarnReward = useCallback(async () => {
    earnedRef.current = true;
    const uid = user?.userId ? String(user.userId) : user?.id ? String(user.id) : '';
    if (uid) {
      const newHp = await grantGameAdReward(uid);
      if (newHp > 0) {
        setHashPower(newHp);
      } else {
        addHashPower(GAME_AD_REWARD_GH);
      }
    } else {
      addHashPower(GAME_AD_REWARD_GH);
    }
    setGhEarned(g => g + GAME_AD_REWARD_GH);
  }, [user, addHashPower, setHashPower]);

  const onEarnClosed = useCallback(() => {
    earnedRef.current = false;
  }, []);

  const { show: showEarnAd, loaded: earnAdLoaded, loading: earnAdLoading } =
    useRewardedVideoAd(onEarnReward, { primaryUnitId: ads.rewardedVideoId }, onEarnClosed);


  // --- Retry ad (resets game) ---
  const retryEarnedRef = useRef(false);

  const onRetryReward = useCallback(() => {
    retryEarnedRef.current = true;
  }, []);

  const onRetryClosed = useCallback(() => {
    if (retryEarnedRef.current) {
      retryEarnedRef.current = false;
      onReset();
    }
  }, [onReset]);

  const { show: showRetryAd, loaded: retryAdLoaded, loading: retryAdLoading } =
    useRewardedVideoAd(onRetryReward, { primaryUnitId: ads.rewardedVideoId }, onRetryClosed);


  const handleShowEarnAd = useCallback(() => {
    // Never queue an ad to pop up later: it may only show right after the
    // user's own tap (AdMob "user choice"). Not ready = request one; the user
    // taps again when it is.
    if (!earnAdLoaded) { showEarnAd(); Alert.alert('Almost ready', 'The video is still loading. Try again in a few seconds.'); return; }
    showEarnAd();
  }, [earnAdLoaded, showEarnAd]);

  const handleShowRetryAd = useCallback(() => {
    if (!retryAdLoaded) { showRetryAd(); Alert.alert('Almost ready', 'The video is still loading. Try again in a few seconds.'); return; }
    showRetryAd();
  }, [retryAdLoaded, showRetryAd]);

  return {
    showEarnAd: handleShowEarnAd,
    earnAdLoaded,
    earnAdLoading,
    earnAdPending: pendingEarnRef,
    showRetryAd: handleShowRetryAd,
    retryAdLoaded,
    retryAdLoading,
    retryAdPending: pendingRetryRef,
    ghEarned,
    rewardGh: GAME_AD_REWARD_GH,
  };
}

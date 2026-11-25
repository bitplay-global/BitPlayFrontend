import { Alert } from 'react-native';

/**
 * Asks before a rewarded video plays, for entry points whose button does not
 * itself say "watch ad" (AdMob rewarded-ads policy: the ad may only be served
 * after the user affirmatively and unambiguously opts in, with the reward
 * disclosed first). "No thanks" changes nothing.
 */
export function confirmRewardedAd(reward: string, onWatch: () => void) {
  Alert.alert(
    'Watch a short video?',
    `Watch a short video ad to get ${reward}. This is optional.`,
    [
      { text: 'No thanks', style: 'cancel' },
      { text: 'Watch video', onPress: onWatch },
    ],
    { cancelable: true },
  );
}

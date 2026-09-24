import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BANNER_ADS_ENABLED } from '../config/adPlacements';
import BitPlayLoader from '../components/BitPlayLoader';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Platform,
  Alert,
  Animated,
  Easing,
  Modal,
  Image,
  Linking,
  Dimensions,
  AppState,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Icon5 from 'react-native-vector-icons/FontAwesome5';
import { useAuth } from '../auth/AuthProvider';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../components/types';

import { useRewardedVideoAd } from '../services/googleAds';
import { DEFAULT_ADMOB_BANNER_ID } from '../services/adUnitDefaults';
import { BannerAdWithGamFallback } from '../components/ads/BannerAdWithGamFallback';
import { BannerAdSize } from 'react-native-google-mobile-ads';
import { API_ENDPOINTS, get_data_uri, getMobileSecurityHeaders } from '../config/api';
import LottieView from 'lottie-react-native';
import miningCardAnimation from '../assets/animations/mining-card.json';
import { useHashPower } from "../stores/HashPowerStore";
import messaging from '@react-native-firebase/messaging';
import axios from 'axios';
import RNFS from 'react-native-fs';
import { HelpCircle, MessageCircle } from "lucide-react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import InviteFriendsModal from '../components/InviteFriendsModal';
import SocialMediaLinks from '../components/SocialMediaLinks';
import Purchases, { PurchasesPackage, PurchasesOfferings } from 'react-native-purchases';
import { localNotificationService } from '../services/localNotificationService';
import NetInfo from "@react-native-community/netinfo";
import { getBtcUsdPriceCached } from '../services/btcPriceService';
import {
  formatMiningLocalTimeForApi,
  isSameLocalDay,
  secondsUntilLocalMidnight,
} from '../utils/miningTime';
import {
  capFreeUserTotalMiningPowerGh,
  MAX_FREE_USER_TOTAL_HASHPOWER_GH,
} from '../utils/miningPowerCap';
import OdometerCounter from '../components/OdometerCounter';
import { useAdConfig } from '../providers/AdConfigProvider';
import {
  trackMiningStarted,
} from '../services/apptroveAnalytics';
import { trackMmpMiningStarted } from '../services/mmpAnalytics';
import { ApptroveSDK } from 'react-native-apptrove';
import { getObjectFromStorage, saveObjectToStorage } from '../config/storage';
import { getHomeCacheKey, isValidHomeCache, HomeCacheShape, HOME_CACHE_VERSION } from '../config/homeCache';
// Shared with SuperPrivilegesScreen's "Watch Ads" button, which feeds this same
// daily `rewarded_ads_watched` counter -- both must enforce the same cap.
import { MAX_VIDEO_CLAIMS_PER_TRACK_PER_DAY } from '../config/superPrivileges';

const BASE_HASHPOWER_PER_AD = 5.5;
const FIRST_MINING_START_HASHPOWER = 25;
const DAILY_REWARD_HASHPOWER = 25;
/** Max claims/day on the Super Ad Miner track — must match backend MAX_SUPER_AD_MINER_CLAIMS_PER_DAY. */
const MAX_SUPER_AD_MINER_CLAIMS_PER_DAY = 30;
const BTC_PER_HASHPOWER_PER_SEC = 0.0000000000000070;
const MAX_MINING_DURATION = 24 * 60 * 60 * 1000;
// const MAX_MINING_DURATION = 60 * 1000;

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Page'>;

interface GradientButtonProps {
  icon?: string;
  text: string;
  fullWidth?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}

interface GradientButtonProp {
  text: string;
  fullWidth?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  enabled?: boolean;
  styleProps?: object;
  gradientStyleProps?: object;
}

interface FAQItem {
  _id: string;
  name: string;
  message: string;
}

interface MiningPlan {
  _id: string;
  name: string;
  hashrate: number;
  unit: string;
  duration: number;
  maintenance_cost: number;
  plan_cost: number;
  revenueCatPackage?: PurchasesPackage;
}

interface BalanceDecimal {
  $numberDecimal: string;
}

interface BalanceObject {
  BTC: number | BalanceDecimal;
}

interface BalanceHistory {
  _id: string;
  date: string;
  balances: BalanceObject;
}

const GradientButtonB: React.FC<GradientButtonProps> = React.memo(({ icon, text, onPress }) => (
  <TouchableOpacity
    style={{ flex: 1, borderRadius: 40, overflow: "hidden" }}
    activeOpacity={0.8}
    onPress={onPress}
  >
    <LinearGradient
      colors={['#18D4F2', '#C084FC']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.gradientButton}
    >
      {icon && <Icon name={icon} size={18} color="#F5F7FA" style={styles.buttonIcon} />}
      <Text style={styles.buttonText}>{text}</Text>
    </LinearGradient>
  </TouchableOpacity>
));

const GradientButton: React.FC<GradientButtonProp> = React.memo(({ text, onPress, enabled = true, styleProps = {}, gradientStyleProps = {} }) => (
  <TouchableOpacity
    style={{ flex: 1, borderRadius: 2, overflow: "hidden", ...styleProps }}
    activeOpacity={enabled ? 0.8 : 1}
    onPress={enabled ? onPress : undefined}
    disabled={!enabled}
  >
    {enabled ? (
      <LinearGradient
        colors={['#18D4F2', '#C084FC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ ...styles.gradientClaimButton, ...gradientStyleProps }}
      >
        <Text style={styles.buttonText}>{text}</Text>
      </LinearGradient>
    ) : (
      <View
        style={[
          styles.gradientClaimButton,
          { backgroundColor: '#7E8CA3', justifyContent: 'center', alignItems: 'center' } // gray tone
        ]}
      >
        <Text style={[styles.buttonText, { color: '#F5F7FA' }]}>{text}</Text>
      </View>
    )}
  </TouchableOpacity>
));

const useCountdown = (initialSeconds: number) => {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);

  // Reset when new initialSeconds arrives
  useEffect(() => {
    setTimeLeft(initialSeconds);
  }, [initialSeconds]);

  // Tick down each second
  useEffect(() => {
    if (timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft]);

  // Format to HH:MM:SS
  const formatTime = (s: number) => {
    const hrs = String(Math.floor(s / 3600)).padStart(2, "0");
    const mins = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const secs = String(s % 60).padStart(2, "0");
    return `${hrs}:${mins}:${secs}`;
  };

  return {
    formatted: formatTime(timeLeft),
    seconds: timeLeft,
  };
};

/**
 * Smoothly animates a number whenever `target` changes (counter-style).
 * Uses JS-driven `Animated.Value` and a listener to update the displayed value.
 */
// BtcBalanceCounter replaced by OdometerCounter component
// Keeping this comment to preserve line history if needed, but logic is moved.

const Page: React.FC = () => {
  const { user } = useAuth();
  const { ads } = useAdConfig();

  // Last-known snapshot from the previous successful load, read once
  // synchronously on mount (lazy initializer, no re-read on re-render).
  // Lets the real layout render immediately with real numbers instead of
  // blocking behind a full-screen spinner -- see the fetch effect further
  // down for where this gets refreshed and re-persisted in the background.
  // Discarded (treated as absent) if its version doesn't match the current
  // shape, so an old app version's cache can never feed stale-shaped data
  // into a calculation.
  const [cachedHome] = useState<HomeCacheShape | null>(() => {
    if (!user?.id) return null;
    const raw = getObjectFromStorage(getHomeCacheKey(user.id));
    return isValidHomeCache(raw) ? raw : null;
  });
  const [hasCache] = useState(() => cachedHome != null);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [bannerAdError, setBannerAdError] = useState(false);

  // A single failed request shouldn't permanently switch to the house ad —
  // retry AdMob periodically so we recover once it starts filling again.
  useEffect(() => {
    if (!bannerAdError) return;
    const timer = setTimeout(() => setBannerAdError(false), 60000);
    return () => clearTimeout(timer);
  }, [bannerAdError]);

  // Start as false so we don't assume notifications are on until we've checked.
  // Otherwise users with notifications off can start mining without ever seeing the alert.
  const [isNotificationEnabled, setIsNotificationEnabled] = useState(false);
  const hasShownNotificationPromptThisSession = useRef(false);

  // Check notification permission on mount and when app comes to foreground.
  // Show "turn on notifications" popup when permission is off (first open of day or after app was removed from recent).
  useEffect(() => {
    const checkNotificationPermission = async () => {
      try {
        const enabled = await localNotificationService.isNotificationPermissionGranted();
        setIsNotificationEnabled(enabled);

        if (!enabled && !hasShownNotificationPromptThisSession.current) {
          hasShownNotificationPromptThisSession.current = true;
          const requested = await localNotificationService.requestNotificationPermissionForMining();
          setIsNotificationEnabled(requested);
          if (!requested) {
            Alert.alert(
              'Enable Notifications',
              'Get notified when your mining session ends! Enable notifications for the best experience.',
              [
                { text: 'Not Now', style: 'cancel' },
                {
                  text: 'Settings',
                  onPress: () => {
                    Linking.openSettings();
                  },
                },
              ]
            );
          }
        }
      } catch (e) {
        setIsNotificationEnabled(false);
      }
    };

    checkNotificationPermission();

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        checkNotificationPermission();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // ...existing code...
  const [localHashPower, setLocalHashPower] = useState(cachedHome?.localHashPower ?? 0);
  const [btcBalance, setBtcBalance] = useState(cachedHome?.btcBalance ?? 0); // Current session mining
  const [btcReferralBalance, setBtcRefBalance] = useState(cachedHome?.btcReferralBalance ?? 0);
  const [userBalance, setUserWalletBalance] = useState(cachedHome?.userBalance ?? 0);
  const [userBalanceBTC, setUserBTCWalletBalance] = useState(cachedHome?.userBalanceBTC ?? 0); // Past accumulated mining (BTC_DEPOSIT)
  const [totalHistoricalBTC, setTotalHistoricalBTC] = useState(cachedHome?.totalHistoricalBTC ?? 0); // Sum from Balance History
  const [showBalanceHint, setShowBalanceHint] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowBalanceHint(false), 7000);
    return () => clearTimeout(timer);
  }, []);

  const { hashPower, setHashPower, addHashPower, resetHashPower, purchasedHashpowerGh, setPurchasedHashpowerGh, setIsMiningActive } =
    useHashPower();
  const [adsWatched, setAdsWatched] = useState(cachedHome?.adsWatched ?? 0);
  const [threeGhAdsWatched, setThreeGhAdsWatched] = useState(cachedHome?.threeGhAdsWatched ?? 0);
  // Effective multiplier from active Super Privileges (1 = no boost). Only applies
  // to the special/threeGh ad-watch track — see AdMultiplierPrivilege on the backend.
  const [privilegeMultiplier, setPrivilegeMultiplier] = useState(cachedHome?.privilegeMultiplier ?? 1);
  const [startTime, setStartTime] = useState<number | null>(cachedHome?.startTime ?? null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [isMiningEnabled, setIsMiningEnabled] = useState(cachedHome?.isMiningEnabled ?? false);
  const miningActivatedLocallyRef = useRef(false);
  const shouldClaimDailyRewardRef = useRef(false);
  const [isMiningActivationPending, setIsMiningActivationPending] = useState(false);
  const [serverTimeRemaining, setServerTimeRemaining] = useState(0);
  const [stockGameBonus, setStockGameBonus] = useState(cachedHome?.stockGameBonus ?? 0);

  // Fixed 3 games — BTC Trading, Spin and Win, Memory Match
  const DEFAULT_FEATURED: Array<{ name: string; route: string; hint: string; iconImage: any }> = [
    {
      name: 'BTC Trading',
      route: 'TradingScreen',
      hint: 'Predict price · +10\nGH/s',
      iconImage: require('../assets/images/icon_btc_trading.png'),
    },
    {
      name: 'Spin and Win',
      route: 'SpinAndWin',
      hint: 'Wheel · Gh/s &\nvideos',
      iconImage: require('../assets/images/icon_spin_win.png'),
    },
    {
      name: 'Memory Match',
      route: 'MemoryCardMatch',
      hint: '30 sec · Claim +10\nGH/s',
      iconImage: require('../assets/images/icon_memory_match.png'),
    },
  ];
  const [featuredGames] = useState(DEFAULT_FEATURED);

  //  console.log("isMiningActivationPending: ", isMiningActivationPending);
  //  console.log("isMiningEnabled: ", isMiningEnabled);
  //  console.log("btcBalance: ", btcBalance);
  //  console.log("btcReferralBalance: ", btcReferralBalance);
  //  console.log("userBalance: ", userBalance);
  //  console.log("userBalanceBTC: ", userBalanceBTC);
  //  console.log("totalHistoricalBTC: ", totalHistoricalBTC);
  //  console.log("hashPower: ", hashPower);
  //  console.log("adsWatched: ", adsWatched);
  //  console.log("threeGhAdsWatched: ", threeGhAdsWatched);
  //  console.log("startTime: ", startTime);
  //  console.log("endTime: ", endTime);


  const navigation = useNavigation<HomeScreenNavigationProp>();

  // Send mining-stopped notification when reset happens at 00:00
  const sendMiningStoppedNotification = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    try {
      const miningStoppedUri = get_data_uri('MINING_STOPPED');

      const response = await fetch(miningStoppedUri, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id
        }),
      });

      const contentType = response.headers.get('content-type');
      let data;

      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
      }
    } catch (error) {
    }
  }, [user]);

  // Set when an activation could not be confirmed with the server; cleared once
  // it lands. Persisted so it survives the app being killed mid-activation.
  const ACTIVATION_PENDING_KEY = 'mining:activation_pending';

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const balanceRef = useRef(btcBalance);
  const miningAnimationRef = useRef<LottieView>(null);
  const startTimeRef = useRef<number | null>(startTime);
  const totalMiningPowerRef = useRef(0);

  // Switching accounts must not reuse another user's "local activation" flags or stale refs,
  // or we skip server sync and show wrong hashpower (e.g. ~5 Gh/s from the previous session).
  useEffect(() => {
    miningActivatedLocallyRef.current = false;
    shouldClaimDailyRewardRef.current = false;
    setIsMiningActivationPending(false);
    hasShownNotificationPromptThisSession.current = false;
  }, [user?.id]);

  // Sync mining active state to global store so game screens can check locally
  // NOTE: thumbAnim (native driver) and trackAnim (non-native, colors) run separately
  // to avoid the "mixing native and non-native animated nodes in parallel" crash.
  useEffect(() => {
    setIsMiningActive(isMiningEnabled);
    Animated.spring(thumbAnim, {
      toValue: isMiningEnabled ? 1 : 0,
      useNativeDriver: true,
      bounciness: 6,
      speed: 14,
    }).start();
    // trackAnim removed — it was non-native and the value was never used in JSX
  }, [isMiningEnabled]);

  // Keep the ref in sync so other effects (balance sync) read latest value
  useEffect(() => {
    balanceRef.current = btcBalance;
  }, [btcBalance]);

  // Persist current session mined BTC into Balance.BTC so the backend
  // uses the locally-computed value (source of truth) for history settlement.
  const syncBtcSessionBalance = useCallback(async () => {
    if (!user?.id) return;
    try {
      await fetch(get_data_uri("SET_WALLET_BALANCE"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          asset: "BTC",
          amount: balanceRef.current,
        }),
      });
    } catch (err) {
    }
  }, [user?.id]);

  // Periodic sync every 30 seconds
  useEffect(() => {
    if (!user?.id) return;
    const syncInterval = setInterval(() => {
      if (isMiningEnabled && balanceRef.current > 0) {
        syncBtcSessionBalance();
      }
    }, 30000);
    return () => clearInterval(syncInterval);
  }, [user?.id, isMiningEnabled, syncBtcSessionBalance]);

  // Hard refresh at local midnight — use setTimeout targeting exact midnight instead of
  // a 1-second polling interval (saves 86 400 ticks/day while keeping the same behaviour).
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const scheduleNextMidnight = () => {
      const now = new Date();
      const msUntilMidnight =
        new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
      timeoutId = setTimeout(async () => {
        if (cancelled) return;
        const st = startTimeRef.current;
        const tp = totalMiningPowerRef.current;
        if (st && st > 0 && tp > 0) {
          const elapsedSec = Math.max(0, (Date.now() - st) / 1000);
          const cappedSec = Math.min(elapsedSec, MAX_MINING_DURATION / 1000);
          const definitiveValue = tp * BTC_PER_HASHPOWER_PER_SEC * cappedSec;
          balanceRef.current = Math.max(balanceRef.current, definitiveValue);
        }
        await syncBtcSessionBalance();
        miningActivatedLocallyRef.current = false;
        sendMiningStoppedNotification();
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      }, msUntilMidnight + 500);
    };

    scheduleNextMidnight();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [navigation, sendMiningStoppedNotification, syncBtcSessionBalance]);

  // Sync mined BTC when app goes to background to minimize unsync'd gap
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        if (isMiningEnabled && balanceRef.current > 0) {
          syncBtcSessionBalance();
        }
      }
    });
    return () => subscription.remove();
  }, [isMiningEnabled, syncBtcSessionBalance]);

  // Finish an activation whose confirmation never reached the server -- the ad
  // was watched, so the user is owed it. Runs when the app returns to the
  // foreground (network back) and once on mount (covers a kill mid-activation).
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const finishPendingActivation = async () => {
      try {
        if ((await AsyncStorage.getItem(ACTIVATION_PENDING_KEY)) !== '1') return;
        if (cancelled) return;
        await logToFile('Retrying activation that never reached the server');
        const ok = await syncUserData(0, undefined, true);
        if (ok && !cancelled) {
          await AsyncStorage.removeItem(ACTIVATION_PENDING_KEY);
          setIsMiningEnabled(true);
          miningActivatedLocallyRef.current = true;
        }
      } catch {
        // Left pending on purpose: the next foreground tries again.
      }
    };

    finishPendingActivation();
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') finishPendingActivation();
    });
    return () => { cancelled = true; subscription.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const [recentActivity, setRecentActivity] = useState<any[]>(cachedHome?.recentActivity ?? []);
  const [isLoading, setIsLoading] = useState(true);
  const [effectiveHashPower, setEffectiveHashPower] = useState(0);

  const [streakDays, setStreakDays] = useState(cachedHome?.streakDays ?? 0);
  const [streakBonusGh, setStreakBonusGh] = useState(cachedHome?.streakBonusGh ?? 0);

  const STREAK_TIERS = [
    { minDays: 0, bonusGh: 5 },
    { minDays: 8, bonusGh: 10 },
    { minDays: 15, bonusGh: 15 },
    { minDays: 22, bonusGh: 20 },
    { minDays: 29, bonusGh: 25 },
  ];
  const getActiveTierIndex = (days: number) => {
    for (let i = STREAK_TIERS.length - 1; i >= 0; i--) {
      if (days >= STREAK_TIERS[i].minDays) return i;
    }
    return -1;
  };

  const [user_referrals, setUserReferrals] = useState(cachedHome?.userReferrals ?? 0);
  const [timer, setTimer] = useState(0);

  const { formatted: formattedTimer, seconds: timerSecs } = useCountdown(serverTimeRemaining);

  // Current session mined (adds during active mining) + sum from Balance History
  const totalBtc = (btcBalance || 0) + (totalHistoricalBTC || 0);

  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [faqVisible, setFaqVisible] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);

  const [isDailyRewardClaimed, setDailyRewardClaimed] = useState(cachedHome?.dailyRewardClaimed ?? false);


  const [AndroidBTCBalString, SetAndroidBTCBalString] = useState('');

  // Daily video requirement tracking (NEW)
  const [dailyProgress, setDailyProgress] = useState(cachedHome?.dailyProgress ?? {
    videosWatchedToday: 0,
    dailyTarget: 10,
    remaining: 10,
    isComplete: false,
    hasActiveSubscription: false,
    requirementActive: false
  });

  // Loss tracking states (will be updated from API)
  const [cumulativeLoss, setCumulativeLoss] = useState(cachedHome?.lossTracking?.cumulativeLoss ?? 0); // Cumulative loss percentage from API
  const [dailyLossOffset, setDailyLossOffset] = useState(cachedHome?.lossTracking?.dailyLossOffset ?? 3.0); // 3% daily loss offset (fixed)
  const [dailyAdsRequired, setDailyAdsRequired] = useState(cachedHome?.lossTracking?.dailyAdsRequired ?? 30); // 30 ads required daily (fixed)
  const [dailyAdsWatched, setDailyAdsWatched] = useState(cachedHome?.lossTracking?.dailyAdsWatched ?? 0); // Ads watched today to offset loss
  const [previousDayEarnings, setPreviousDayEarnings] = useState(cachedHome?.previousDayEarnings ?? 0); // Previous day BTC earnings
  const [hasLossData, setHasLossData] = useState(cachedHome?.lossTracking?.hasLossData ?? false); // Track if loss data is loaded
  const [showNewcomerModal, setShowNewcomerModal] = useState(false); // Newcomer offer modal
  const [offerMiningPlan, setOfferMiningPlan] = useState<MiningPlan | null>(null); // Mining plan for newcomer offer
  const [showInviteModal, setShowInviteModal] = useState(false); // Invite friends modal
  const [purchasing, setPurchasing] = useState(false); // Track purchase state

  interface Activity {
    type: string;
    method: string;
    amount: string;
    amountNumeric?: { $numberDecimal: string };
    crypto: string;
    date: string;
    isPositive: boolean;
  }

  const animatedHeight = useRef(new Animated.Value(0)).current;
  const thumbAnim = useRef(new Animated.Value(0)).current;
  const trackAnim = useRef(new Animated.Value(0)).current;

  type FAQResponse = {
    success: boolean;
    faqs: FAQItem[];
  };

  const [faqData, setFaqData] = useState<FAQItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFAQ = async () => {
      try {
        const response = await axios.get<FAQResponse>(
          get_data_uri('GET_FAQS')
        );
        setFaqData(response.data.faqs);
      } catch (err) {
        setError('Failed to load FAQ data');
      }
    };

    fetchFAQ();
  }, []);

  // Schedule mining reset notification on mount
  useEffect(() => {
    localNotificationService.scheduleMiningResetNotification();
  }, []);

  // Fetch mining plan for newcomer offer - specifically the 80 GH/s plan
  useEffect(() => {
    const fetchMiningPlan = async () => {
      try {
        const response = await axios.get(get_data_uri('GET_SUBSCRIPTIONS'));

        // Get the first plan (80 GH/s) for the newcomer offer
        if (response.data.plans && response.data.plans.length > 0) {
          // Find the 80 GH/s plan explicitly
          let targetPlan = response.data.plans.find((plan: MiningPlan) => plan.hashrate === 80 && plan.unit === 'Gh/s');

          // If not found, use the first plan as fallback
          if (!targetPlan) {
            targetPlan = response.data.plans[0];
          }


          // Try to fetch RevenueCat offerings and match with the plan
          try {
            let offerings: PurchasesOfferings | null = null;
            try {
              offerings = await Purchases.getOfferings();

              if (!offerings || Object.keys(offerings).length === 0) {
              }
            } catch (rcError) {
            }

            let matchedPackage: any = undefined;

            if (offerings && offerings.all) {
              // Directly target the specific Mini Miner Pack 80gh package
              const miniMinerOffering = Platform.OS === 'ios' ? offerings.all['com.bitplaypro.bitplaypro.mini_miner_pack'] : offerings.all['bitplay.mini_miner_pack_80ghs:mini-minor-pack-80gh'] || offerings.all['bitplay.mini_miner_pack_80ghs'];


              if (miniMinerOffering) {

                // Prefer the monthly package if available, otherwise use first available package
                if (miniMinerOffering.monthly) {
                  matchedPackage = miniMinerOffering.monthly;
                } else if (miniMinerOffering.availablePackages && miniMinerOffering.availablePackages.length > 0) {
                  matchedPackage = miniMinerOffering.availablePackages[0];
                }

                if (!matchedPackage) {
                }
              } else {
              }
            }

            if (matchedPackage) {
            } else {
            }

            setOfferMiningPlan({
              ...targetPlan,
              revenueCatPackage: matchedPackage,
            });
          } catch (rcError) {
            setOfferMiningPlan(targetPlan);
          }
        }
      } catch (err) {
      }
    };

    fetchMiningPlan();
  }, []);

  // Balance history is now fetched inside useFocusEffect AFTER mining details
  // to ensure day-change settlements are included in the history.

  // stockGameBonus is now loaded from server in the main data fetch below

  const toggleExpanded = (id: string) => {
    setExpandedItems(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const renderFAQItem = (item: FAQItem) => {
    const isExpanded = expandedItems.includes(item._id);

    return (
      <View key={item._id} style={styles.faqItem}>
        <TouchableOpacity
          style={styles.questionContainer}
          onPress={() => toggleExpanded(item._id)}
          activeOpacity={0.7}
        >
          <Text style={styles.questionText}>{item.name}</Text>
          <Text style={[styles.expandIcon, isExpanded && styles.expandIconRotated]}>
            ▼
          </Text>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.answerContainer}>
            <Text style={styles.answerText}>{item.message}</Text>
          </View>
        )}
      </View>
    );
  };

  const refreshStreakData = async () => {
    try {
      if (!user?.id) return;
      const local_time = formatMiningLocalTimeForApi(new Date());
      const url = `${get_data_uri("USERMININGDETAILS")}/${user.id}?local_time=${encodeURIComponent(local_time)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.mining_details) {
        const details = data.mining_details;
        setStreakDays(details.streak_days ?? 0);
        setStreakBonusGh(details.streak_bonus_gh ?? 0);
      }
    } catch (e) {
    }
  };

  /**
   * Activating mining server-side, made durable.
   *
   * The activation POST fires the instant a full-screen rewarded ad closes,
   * which is the worst moment to need the network: on iOS the stack is often
   * still being restored as the ad's view controller is dismissed, so a single
   * attempt can fail while the device is perfectly online. That failure used to
   * be invisible -- mining looked active locally, the server never heard about
   * it, and the next refresh silently flipped it back off. Restarting the app
   * "fixed" it because by then the network state was warm.
   *
   * So: retry with backoff, and if every attempt fails, remember the intent and
   * finish it the next time the app comes to the foreground.
   */
  const ensureMiningActivated = async (): Promise<boolean> => {
    const backoffMs = [0, 600, 2000, 5000];
    for (let attempt = 0; attempt < backoffMs.length; attempt++) {
      if (backoffMs[attempt] > 0) {
        await new Promise<void>(resolve => setTimeout(resolve, backoffMs[attempt]));
      }
      const ok = await syncUserData(0, undefined, true);
      if (ok) {
        try { await AsyncStorage.removeItem(ACTIVATION_PENDING_KEY); } catch {}
        return true;
      }
      await logToFile(`Mining activation attempt ${attempt + 1} failed`);
    }
    // Out of attempts: keep the intent so foregrounding the app completes it.
    try { await AsyncStorage.setItem(ACTIVATION_PENDING_KEY, '1'); } catch {}
    return false;
  };

  const ClaimDailyReward = async () => {
    // Deliberately no NetInfo pre-check here. This runs the moment the
    // activation ad closes, when iOS routinely reports isConnected: false for a
    // beat while the network stack comes back -- and bailing out here abandoned
    // the activation entirely, with the ad already watched. The requests below
    // are the real test of connectivity, and they retry.
    const daily_check_uri = get_data_uri('USERDAILYREWARD');

    const local_time = formatMiningLocalTimeForApi(new Date());


    // IMPORTANT: Set mining_isactive first in backend before claiming daily reward
    // This ensures the daily reward endpoint check passes
    setIsMiningEnabled(true);
    // Pass 0 as hashpower to set mining_isactive without changing hashpower (0 adds nothing)
    const activated = await ensureMiningActivated();
    if (!activated) {
      // The ad was watched, so never strand the user: the intent is stored and
      // retried on foreground, and the local state stays on meanwhile.
      Alert.alert(
        'Mining Starting',
        "You're all set -- we're still confirming with the server. This finishes automatically in a moment.",
      );
      return;
    }

    const res = await fetch(daily_check_uri, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        local_time: local_time
      }),
    });

    const data = await res.json();


    if (data.success) {
      setServerTimeRemaining(secondsUntilLocalMidnight(new Date()));

      setDailyRewardClaimed(data.success ?? false);

      // First-ever mining start: grant 25 Gh/s once (per user, persisted).
      // After that, the daily reward stays 3 Gh/s.
      let rewardHp = DAILY_REWARD_HASHPOWER;
      try {
        if (user?.id) {
          const key = `mining:first_start_reward_granted:${user.id}`;
          const alreadyGranted = (await AsyncStorage.getItem(key)) === '1';
          rewardHp = alreadyGranted ? DAILY_REWARD_HASHPOWER : FIRST_MINING_START_HASHPOWER;
          if (!alreadyGranted) {
            await AsyncStorage.setItem(key, '1');
          }
        }
      } catch (e) {
        rewardHp = DAILY_REWARD_HASHPOWER;
      }

      addHashPower(rewardHp);
      setLocalHashPower(prev => prev + rewardHp);

      // Send the increment to backend - mining_isactive is already set
      await syncUserData(rewardHp, adsWatched, true);

      // Refresh streak/achievement data so HomeScreen shows latest streak info
      await refreshStreakData();

      // Schedule the next mining-reset reminder (fires at noon, see localNotificationService)
      localNotificationService.scheduleMiningResetNotification();
    } else {
      Alert.alert('Daily Reward', data.message ?? "Error Claiming Daily Reward");
    }
  }

  const toggleFAQ = () => {
    const toValue = faqVisible ? 0 : contentHeight;

    setFaqVisible(!faqVisible);

    Animated.timing(animatedHeight, {
      toValue,
      duration: 350,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  };

  const logToFile = async (_message: string) => {
    // Disabled in production — disk writes block the JS thread and can cause ANR on low-end devices
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[HomeScreen]', _message);
    }
  };

  const formattedBTC = (value: string) => {
    if (!value) return '';
    const str = value.toString();
    const breakIndex = 14;
    return str.length > breakIndex
      ? `${str.slice(0, breakIndex)}\n${str.slice(breakIndex)}`
      : str;
  };

  const firstlaunchlog = () => {

    logToFile('App launched');
    logToFile(`Start time: ${Date.now()}`);

    logToFile(`--------------- Initial Values ---------------`);

    logToFile(`Initial HashPower: ${hashPower}`);
    logToFile(`UserID: ${!user?.id}`);
    logToFile(`BTC Balance: ${btcBalance}`);
    logToFile(`User Balance: ${userBalance}`);
    logToFile(`Ads Watched: ${adsWatched}`);
    logToFile(`Mining Enabled ? - ${isMiningEnabled}`);

    logToFile(`----------------------------------------------`);

  }

  const [recent_activity_list, setRecentActivityList] = useState<Activity[]>([]);

  // -----------------------------
  // Daily Video Requirement Functions (NEW)
  // -----------------------------

  /**
   * Increment daily video count when user watches ad
   */
  const incrementDailyVideoCount = async () => {
    try {
      const response = await fetch(`${get_data_uri('USERMININGDETAILS')}/increment-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: user.id }),
      });

      const data = await response.json();

      if (data.success) {
        setDailyAdsWatched(data.daily_ads_watched);
        setCumulativeLoss(data.cumulative_loss);

        // ADD THIS: Show feedback when loss is reduced
        if (data.loss_reduced) {
          // Show toast/alert: "Great! Loss reduced by 3%"
        }

      }
    } catch (err) {
    }
  };

  /**
   * Increment loss offset ad count (for 30 ads requirement)
   */
  const incrementLossOffsetAd = async () => {
    try {
      const response = await fetch(`${get_data_uri('USERMININGDETAILS')}/increment-loss-ad`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: user.id }),
      });

      const data = await response.json();

      if (data.success) {
        setDailyAdsWatched(data.daily_ads_watched);
        setCumulativeLoss(data.cumulative_loss);
      }
    } catch (error) {
    }
  };

  /**
   * Fetch daily video progress
   */
  const fetchDailyProgress = async () => {
    try {
      const response = await fetch(`${get_data_uri('USERMININGDETAILS')}/daily-progress/${user.id}`);
      const data = await response.json();

      if (data.success) {
        setDailyProgress(data.daily_progress);
      }
    } catch (error) {
    }
  };

  async function saveFcmTokenToBackend(id: any, token: string) {
    try {
      const fcm_uri = get_data_uri('CREATE_FCM');


      const response = await fetch(fcm_uri, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: id,
          token: token
        }),
      });

      // console.log("FCMHome - API Response: ", response);
      // console.log("FCMHome - API Response JSON : ", response.json());

      const contentType = response.headers.get('content-type');
      let data;

      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error("FCMHome - Invalid response from server");
      }

    } catch (error) {
    }
  }

  // Get and save FCM token when user is available
  useEffect(() => {
    if (!user || !user.id) {
      return;
    }

    const getToken = async () => {
      try {
        // Request permission (on iOS, if previously denied, this returns DENIED without showing dialog)
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (enabled) {
        } else {
        }

        // Always try to get token - Firebase may provide a token even with provisional/denied permission
        // On Android, token might be available even without explicit permission
        try {
          const token = await messaging().getToken();

          if (token) {
            await saveFcmTokenToBackend(user.id, token);
            // Forward FCM token to Apptrove for push attribution (Android)
            if (Platform.OS === 'android') {
              try { ApptroveSDK.sendFcmToken(token); } catch { /* non-critical */ }
            }
            // Forward APNs token to Apptrove for push attribution (iOS)
            if (Platform.OS === 'ios') {
              try {
                const apnsToken = await messaging().getAPNSToken();
                if (apnsToken) { ApptroveSDK.sendAPNToken(apnsToken); }
              } catch { /* non-critical */ }
            }
          }
        } catch (tokenError: any) {
          // If permission is denied, token retrieval will fail
          if (tokenError?.code === 'messaging/permission-default' || tokenError?.code === 'messaging/permission-denied') {
          }
        }
      } catch (error: any) {
      }
    };

    getToken();

    const unsubscribe = messaging().onTokenRefresh(async (token) => {
      if (token && user?.id) {
        await saveFcmTokenToBackend(user.id, token);
      }
    });

    return unsubscribe;
  }, [user]);

  // -----------------------------
  // Reward Handler (Ad Watched)
  // -----------------------------
  const handleReward = async () => {
    setIsMiningEnabled(true);

    // Activation is handled before the daily-cap guard below. Ordered the other
    // way round, a user who had hit the 60-ad cap watched the activation ad and
    // got nothing: the guard returned before mining was ever sent to the server,
    // leaving the toggle on locally and off everywhere else.
    if (shouldClaimDailyRewardRef.current) {
      shouldClaimDailyRewardRef.current = false; // Reset the flag
      await ClaimDailyReward();
      return; // Exit early - don't process ad reward
    }

    if (adsWatched >= MAX_VIDEO_CLAIMS_PER_TRACK_PER_DAY) {
      return;
    }

    const newAdsCount = adsWatched + 1;
    setAdsWatched(newAdsCount);

    // update hashPower via global store
    const updatedHashPower = hashPower + BASE_HASHPOWER_PER_AD;
    addHashPower(BASE_HASHPOWER_PER_AD);
    setLocalHashPower(prev => prev + BASE_HASHPOWER_PER_AD);

    if (!startTime) {
      const now = Date.now();
      setStartTime(now);
    }


    // Send only the increment (BASE_HASHPOWER_PER_AD) to backend
    await syncUserData(BASE_HASHPOWER_PER_AD, newAdsCount, true);

    await incrementDailyVideoCount();
    // NEW: Increment daily ads watched for loss offset (only if user has purchased mining power)
    if (hashPower > 3) {
      await incrementLossOffsetAd();
    }
  };

  // -----------------------------
  // Three Gh/s Reward Handler (Special 30 Gh/s button)
  // -----------------------------
  const handleThreeGhReward = async () => {
    setIsMiningEnabled(true);

    if (threeGhAdsWatched >= MAX_SUPER_AD_MINER_CLAIMS_PER_DAY) {
      return;
    }

    const newAdsCount = threeGhAdsWatched + 1;
    setThreeGhAdsWatched(newAdsCount);

    // Unified with the regular ad-watch track: same 5.5 Gh/s reward, same 60/day cap.
    const THREE_GH_REWARD = BASE_HASHPOWER_PER_AD;
    const updatedHashPower = hashPower + THREE_GH_REWARD;
    addHashPower(THREE_GH_REWARD);
    setLocalHashPower(prev => prev + THREE_GH_REWARD);

    if (!startTime) {
      const now = Date.now();
      setStartTime(now);
    }


    // Pass isThreeGhReward: true so the backend updates the separate
    // thirty_gh_rewarded_ads_watched counter. Send only the increment
    // (THREE_GH_REWARD) to backend.
    await syncUserData(THREE_GH_REWARD, newAdsCount, true, true);

    // NEW: Increment daily video count for subscription holders
    await incrementDailyVideoCount();

    // NEW: Increment daily ads watched for loss offset (only if user has purchased mining power)
    if (hashPower > 3) {
      await incrementLossOffsetAd();
    }
  };

  const { show: showActivationAd, loading: activationLoading, loaded: activationLoaded } = useRewardedVideoAd(handleReward, {
    primaryUnitId: ads.rewardedVideoId,
  });
  const { show: showFiveGhAd, loading: fiveGhLoading, loaded: fiveGhLoaded } = useRewardedVideoAd(handleReward, {
    primaryUnitId: ads.rewardedVideoId,
  });
  const { show: showThreeGh, loading: threeGhLoading, loaded: threeGhLoaded } = useRewardedVideoAd(handleThreeGhReward, {
    primaryUnitId: ads.rewardedVideoId,
  });

  // If user attempted activation while ads were loading, stop showing loader once ads are ready or mining is enabled.
  useEffect(() => {
    if (!activationLoading || isMiningEnabled) {
      setIsMiningActivationPending(false);
    }
  }, [activationLoading, isMiningEnabled]);

  // -----------------------------
  // Load State
  // -----------------------------

  const lastFetchRef = useRef<number>(0);
  // Only the very first load should blank the screen with the full-page
  // loader. Refocus refetches (e.g. switching tabs and back) update data
  // silently in the background so navigation doesn't feel like a reload.
  const hasLoadedOnceRef = useRef(false);


  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      // blinkAnim removed — was running useNativeDriver:false loop with no visible effect

      const init = async () => {
        if (!user?.id) return;
        // Skip re-fetch if we already loaded within the last 30 seconds (e.g. quick tab switch)
        const now = Date.now();
        if (now - lastFetchRef.current < 30_000) return;
        lastFetchRef.current = now;
        const isFirstLoad = !hasLoadedOnceRef.current;
        hasLoadedOnceRef.current = true;
        // Populated as the main batch below is processed, then persisted to
        // MMKV once, and re-persisted after balance-history resolves so the
        // next cold start's cache includes those fields too.
        let cacheSnapshot: HomeCacheShape | null = null;
        try {
          if (isFirstLoad) setIsLoading(true);
          await logToFile('Home focused - reloading data');
          const local_time = formatMiningLocalTimeForApi(new Date());
          // btcPrice has no dependency on the batch below — kick it off
          // alongside it instead of awaiting it afterward.
          const btcPricePromise = getBtcUsdPriceCached();
          const [balanceRes, userRes, txnsRes, refRes, referralRewardsRes, privilegesRes] = await Promise.all([
            fetch(`${get_data_uri("GET_WALLET_BALANCE")}?userId=${user.id}`),
            fetch(`${get_data_uri("USERMININGDETAILS")}/${user.id}?local_time=${encodeURIComponent(local_time)}`),
            fetch(`${get_data_uri("GET_RECENT_TRANSACTIONS")}/${user.id}`),
            fetch(`${get_data_uri("REFERRALS")}?code=${encodeURIComponent(user.referralCode)}`),
            fetch(`${get_data_uri("REFERRAL_REWARDS")}/${user.id}`),
            fetch(`${get_data_uri("PRIVILEGES")}/${user.id}`).catch(() => null),
          ]);
          const [balanceData, userData, txnsData, refData, referralRewardsData] = await Promise.all([
            balanceRes.json(),
            userRes.json(),
            txnsRes.json(),
            refRes.json(),
            referralRewardsRes.json(),
          ]);
          if (privilegesRes) {
            try {
              const privilegesData = await privilegesRes.json();
              if (privilegesData?.success) {
                setPrivilegeMultiplier(privilegesData.effective_multiplier ?? 1);
              }
            } catch {
              // Non-critical — leave multiplier at its previous value.
            }
          }

          if (!isMounted) return;

          const btcDeposited = parseFloat(balanceData?.balance?.BTC_DEPOSIT?.$numberDecimal ?? balanceData?.balance?.BTC_DEPOSIT ?? '0');

          // null when no price source answered: keep the dollar figure that is
          // already on screen rather than showing $0.00 or NaN.
          const btcPrice = await btcPricePromise;
          const usdBalance = btcPrice != null
            ? parseFloat(((btcDeposited * btcPrice) / 4).toFixed(2))
            : null;

          setUserBTCWalletBalance(btcDeposited);

          // Referral balance for invite modal (same as My Profile)
          const refReward = referralRewardsData?.totalRewardsRaw ?? referralRewardsData?.totalRewards ?? 0;
          setBtcRefBalance(typeof refReward === 'number' ? refReward : parseFloat(refReward) || 0);

          const formatted_btc = formattedBTC(`${btcDeposited.toFixed(16)} BTC`);

          SetAndroidBTCBalString(formatted_btc);

          if (usdBalance != null) setUserWalletBalance(usdBalance);

          // Guard against missing mining_details from API
          const details = userData?.mining_details ?? {};
          const rawHashpower = parseFloat(details.hashpower ?? 0);
          const effectiveHp = parseFloat(details.effective_hashpower ?? details.hashpower ?? 0);
          const purchasedPh = parseFloat(details.purchasedHashpower ?? 0);
          setPurchasedHashpowerGh(purchasedPh);
          const serverStockBonus = parseFloat(details.stock_game_bonus ?? 0);
          const miningActive = !!details.mining_isactive;
          const startTimeMs = typeof details.start_time === 'number'
            ? details.start_time
            : Number(details.start_time) || null;

          // If mining was activated locally but the server hasn't caught up yet
          // (returns inactive/zero hashpower), preserve the entire local mining state.
          const serverStale = miningActivatedLocallyRef.current && (!miningActive || effectiveHp <= 0);
          // Cache-snapshot counterparts for the fields guarded by serverStale
          // below: when stale, this pass doesn't apply the server's numbers
          // to state (deliberately preserves what's already there), so the
          // persisted cache should preserve the same current values rather
          // than writing the not-applied server numbers.
          let btcBalanceForCache = btcBalance;
          let localHashPowerForCache = localHashPower;
          let hashPowerForCache = hashPower;
          let isMiningEnabledForCache = isMiningEnabled;
          let startTimeForCache = startTime;
          if (serverStale) {
            setServerTimeRemaining(secondsUntilLocalMidnight(new Date()));
          } else {
            // Self-heal: some users have mining active but no start_time saved yet.
            if (miningActive && effectiveHp > 0 && (!startTimeMs || startTimeMs <= 0)) {
              try {
                setStartTime(Date.now());
                await syncUserData(0, undefined, true);
              } catch (e) {
              }
            }

            // Start from server-calculated BTC, then ensure elapsed-time
            // calculation is at least as large so app-closed time is captured.
            const serverBtc = parseFloat(userData?.calculated_btc ?? 0);
            let computedSessionBtc = serverBtc;

            if (miningActive && effectiveHp > 0 && startTimeMs && startTimeMs > 0) {
              const now = new Date();
              const start = new Date(startTimeMs);
              if (isSameLocalDay(start, now)) {
                const initTotalPower = capFreeUserTotalMiningPowerGh(
                  effectiveHp + serverStockBonus,
                  purchasedPh,
                  privilegeMultiplier > 1
                );
                const elapsedSec = Math.max(0, (now.getTime() - startTimeMs) / 1000);
                const miningDurationSec = Math.min(elapsedSec, MAX_MINING_DURATION / 1000);
                const localCalc = initTotalPower * BTC_PER_HASHPOWER_PER_SEC * miningDurationSec;
                computedSessionBtc = Math.max(computedSessionBtc, localCalc);
              }
            }
            const computedSessionBtcFixed = parseFloat(computedSessionBtc.toFixed(16));
            setBtcBalance(computedSessionBtcFixed);
            balanceRef.current = computedSessionBtcFixed;
            btcBalanceForCache = computedSessionBtcFixed;

            setLocalHashPower(rawHashpower);
            setHashPower(effectiveHp);
            setEffectiveHashPower(effectiveHp);
            setIsMiningEnabled(miningActive);
            miningActivatedLocallyRef.current = miningActive;
            setStartTime(startTimeMs ?? null);
            setServerTimeRemaining(secondsUntilLocalMidnight(new Date()));
            localHashPowerForCache = rawHashpower;
            hashPowerForCache = effectiveHp;
            isMiningEnabledForCache = miningActive;
            startTimeForCache = startTimeMs ?? null;
          }

          setStockGameBonus(serverStockBonus);

          setAdsWatched(parseFloat(details.rewarded_ads_watched ?? 0));
          setThreeGhAdsWatched(parseFloat(details.thirty_gh_rewarded_ads_watched ?? 0));

          setDailyRewardClaimed(userData?.daily_reward_claimed ?? false);

          setStreakDays(details.streak_days ?? 0);
          setStreakBonusGh(details.streak_bonus_gh ?? 0);

          // NEW: Set loss tracking data if available
          if (userData?.mining_details?.lossTracking) {
            const lossData = userData.mining_details.lossTracking;
            setCumulativeLoss(lossData.cumulative_loss ?? 0);
            setDailyLossOffset(lossData.daily_loss_offset ?? 3.0);
            setDailyAdsWatched(lossData.daily_ads_watched ?? 0);
            setDailyAdsRequired(lossData.daily_ads_required ?? 10);
            setHasLossData(true);
          } else {
            // Calculate cumulative loss based on days without watching required ads
            // This will be calculated by backend, but for now show 0 if no data
            setHasLossData(false);
          }

          // Previous day earnings are now set from balance history fetch below

          // NEW: Set daily progress if available
          if (userData?.daily_progress) {
            setDailyProgress(userData.daily_progress);
          } else {
            // Fallback: fetch separately if not included
            await fetchDailyProgress();
          }

          if (Array.isArray(txnsData?.transactions)) {
            setRecentActivity(txnsData.transactions);
          }

          setUserReferrals(Number(refData?.count) || 0);

          // Everything above is enough to consider the screen "loaded" --
          // balance history (below) has a real data dependency on this batch
          // (must run after so day-change settlement is included) but
          // doesn't need to hold up isLoading; it updates in place when it
          // resolves, same as the cache-first fields already do.
          cacheSnapshot = {
            version: HOME_CACHE_VERSION,
            cachedAtMs: Date.now(),
            btcBalance: btcBalanceForCache,
            btcReferralBalance: typeof refReward === 'number' ? refReward : parseFloat(refReward) || 0,
            userBalance: usdBalance ?? userBalance,
            userBalanceBTC: btcDeposited,
            totalHistoricalBTC, // stale/cached value until balance-history resolves below
            previousDayEarnings, // stale/cached value until balance-history resolves below
            localHashPower: localHashPowerForCache,
            hashPower: hashPowerForCache,
            purchasedHashpowerGh: purchasedPh,
            isMiningEnabled: isMiningEnabledForCache,
            startTime: startTimeForCache,
            stockGameBonus: serverStockBonus,
            adsWatched: parseFloat(details.rewarded_ads_watched ?? 0),
            threeGhAdsWatched: parseFloat(details.thirty_gh_rewarded_ads_watched ?? 0),
            streakDays: details.streak_days ?? 0,
            streakBonusGh: details.streak_bonus_gh ?? 0,
            userReferrals: Number(refData?.count) || 0,
            recentActivity: Array.isArray(txnsData?.transactions) ? txnsData.transactions : recentActivity,
            privilegeMultiplier,
            dailyRewardClaimed: userData?.daily_reward_claimed ?? false,
            dailyProgress: userData?.daily_progress ?? dailyProgress,
            lossTracking: userData?.mining_details?.lossTracking ? {
              cumulativeLoss: userData.mining_details.lossTracking.cumulative_loss ?? 0,
              dailyLossOffset: userData.mining_details.lossTracking.daily_loss_offset ?? 3.0,
              dailyAdsWatched: userData.mining_details.lossTracking.daily_ads_watched ?? 0,
              dailyAdsRequired: userData.mining_details.lossTracking.daily_ads_required ?? 10,
              hasLossData: true,
            } : null,
          };
          saveObjectToStorage(getHomeCacheKey(user.id), cacheSnapshot);
        } catch (err) {
        } finally {
          if (isMounted) setIsLoading(false);
        }

        if (!isMounted || !user?.id) return;

        // Fetch balance history AFTER mining details so day-change settlement
        // is included. Runs after the block above (still sequential, same
        // ordering as before) but no longer blocks isLoading -- the rest of
        // the screen has already rendered by the time this resolves.
        try {
          const historyRes = await fetch(
            `${get_data_uri('GET_BALANCE_HISTORY')}?userId=${user.id}`
          );
          const historyJson = await historyRes.json();

          let nextTotalHistoricalBTC = 0;
          let nextPreviousDayEarnings = 0;

          if (historyRes.ok && historyJson.success) {
            const historyEntries = historyJson.balances || [];

            if (typeof historyJson.totalHistoricalBTC === 'number' && !Number.isNaN(historyJson.totalHistoricalBTC)) {
              nextTotalHistoricalBTC = historyJson.totalHistoricalBTC;
            } else if (historyEntries.length > 0) {
              nextTotalHistoricalBTC = historyEntries.reduce((acc: number, item: any) => {
                const itemBtcValue = item.balances?.BTC;
                const btcNum = typeof itemBtcValue === 'object' && itemBtcValue && '$numberDecimal' in itemBtcValue
                  ? parseFloat(itemBtcValue.$numberDecimal || '0')
                  : typeof itemBtcValue === 'number' ? itemBtcValue : 0;
                return acc + btcNum;
              }, 0);
            }

            if (historyEntries.length > 0) {
              const latestBalance = historyEntries[0];
              const btcValue = latestBalance.balances?.BTC;
              if (typeof btcValue === 'object' && btcValue && '$numberDecimal' in btcValue) {
                nextPreviousDayEarnings = parseFloat(btcValue.$numberDecimal || '0');
              } else if (typeof btcValue === 'number') {
                nextPreviousDayEarnings = btcValue;
              }
            }
          }

          if (!isMounted) return;
          setTotalHistoricalBTC(nextTotalHistoricalBTC);
          setPreviousDayEarnings(nextPreviousDayEarnings);

          if (cacheSnapshot && user?.id) {
            saveObjectToStorage(getHomeCacheKey(user.id), {
              ...cacheSnapshot,
              cachedAtMs: Date.now(),
              totalHistoricalBTC: nextTotalHistoricalBTC,
              previousDayEarnings: nextPreviousDayEarnings,
            });
          }
        } catch (histErr) {
          if (isMounted) {
            setPreviousDayEarnings(0);
            setTotalHistoricalBTC(0);
          }
        }
      };

      init();

      return () => {
        isMounted = false;
        // blinkAnimation removed
      };
    }, [user])
  );

  const totalMiningPower = capFreeUserTotalMiningPowerGh(
    hashPower + stockGameBonus,
    purchasedHashpowerGh,
    privilegeMultiplier > 1
  );
  const isFreeUserCapReached =
    purchasedHashpowerGh <= 0 && totalMiningPower >= MAX_FREE_USER_TOTAL_HASHPOWER_GH;

  useEffect(() => { startTimeRef.current = startTime; }, [startTime]);
  useEffect(() => { totalMiningPowerRef.current = totalMiningPower; }, [totalMiningPower]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (isMiningEnabled && totalMiningPower > 0) {
      intervalRef.current = setInterval(() => {
        setBtcBalance(prev => {
          const updated = prev + totalMiningPower * BTC_PER_HASHPOWER_PER_SEC;
          balanceRef.current = updated;
          return updated;
        });
      }, 1000);
      miningAnimationRef.current?.play();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isMiningEnabled, totalMiningPower]);

  /** null when no price source answered -- callers show "--", never $0.00. */
  async function getBTCPrice(): Promise<number | null> {
    try {
      return await getBtcUsdPriceCached();
    } catch (err: any) {
      return null;
    }
  }

  // -----------------------------
  // API Calls
  // -----------------------------

  // blinkAnim removed — dead code, was never applied to any view

  const syncUserData = async (
    hp?: number,
    ads?: number,
    mining_status?: boolean,
    isThreeGhReward = false,
  ): Promise<boolean> => {
    try {

      const offset = new Date().getTimezoneOffset();
      const timezone = typeof Intl !== 'undefined' && Intl.DateTimeFormat?.().resolvedOptions?.()?.timeZone
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : undefined;
      const local_time: string | null = formatMiningLocalTimeForApi(new Date());

      let starttime: number | null = null;
      let endtime: number | null = null;

      let local_start_time: string | null = null;
      let local_stop_time: string | null = null;

      const nextMiningActive = mining_status ?? isMiningEnabled;

      if (nextMiningActive) {
        // Only set a NEW start time when starting a new session.
        // If we keep sending fresh timestamps, the backend may keep old `local_start_time`
        // and session day-boundary logic can behave unexpectedly.
        const shouldStartNewSession = !startTime || startTime <= 0;
        starttime = shouldStartNewSession ? Date.now() : startTime;
        endtime = null;

        local_start_time = shouldStartNewSession ? local_time : null;
        local_stop_time = null;
      } else {
        starttime = null;
        endtime = Date.now();

        local_start_time = null;
        local_stop_time = local_time;
      }

      const user_mining_data = {
        user_id: user.id,
        // Never send full displayed power as an increment when `hp` is omitted (e.g. mining off).
        hashpower: hp !== undefined && hp !== null ? hp : 0,
        mining_isactive: nextMiningActive,
        [isThreeGhReward ? 'thirty_gh_rewarded_ads_watched' : 'rewarded_ads_watched']: ads ?? adsWatched,
        random_ads_watched: 0,
        start_time: starttime,
        stop_time: endtime,
        local_start_time: local_start_time,
        local_stop_time: local_stop_time,
        offset: offset,
        ...(timezone ? { timezone } : {}),
      };

      const set_user_data_uri = get_data_uri("USERMININGDETAILS");



      const res = await fetch(set_user_data_uri, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user_mining_data),
      });

      const data = await res.json();

      if (data.success) {
        if (nextMiningActive) {
          trackMiningStarted(totalMiningPower, String(user.id));
          trackMmpMiningStarted(totalMiningPower, String(user.id));
        } else {
        }
      }
      if (data.success && data.mining_details) {
        const details = data.mining_details;
        const effectiveHp = parseFloat(details.effective_hashpower ?? details.hashpower ?? 0);
        const rawHp = parseFloat(details.hashpower ?? 0);
        const purchasedPh = parseFloat(details.purchasedHashpower ?? 0);
        if (!Number.isNaN(purchasedPh)) {
          setPurchasedHashpowerGh(purchasedPh);
        }
        if (!Number.isNaN(effectiveHp)) {
          setHashPower(effectiveHp);
          setEffectiveHashPower(effectiveHp);
        }
        if (!Number.isNaN(rawHp)) {
          setLocalHashPower(rawHp);
        }
        if (details.streak_days != null) setStreakDays(details.streak_days);
        if (details.streak_bonus_gh != null) setStreakBonusGh(details.streak_bonus_gh);
      }
      return data?.success === true;
    } catch (err) {
      // Was swallowed silently. A failed activation POST looked identical to a
      // successful one, so mining showed as on locally and flipped back off at
      // the next refresh with nothing logged and nothing retrying.
      logToFile(`syncUserData failed: ${String(err)}`);
      return false;
    }
  };

  const buttonLabel = fiveGhLoading
    ? "Loading..."
    : adsWatched === 0
      ? "Claim Now"
      : `Claimed (${adsWatched})`;

  const threeGhButtonLabel = threeGhLoading
    ? "Loading..."
    : threeGhAdsWatched === 0
      ? "Claim Now"
      : `Claimed (${threeGhAdsWatched})`;

  const DailyClaimLabel = isDailyRewardClaimed ? formattedTimer : "Claim";

  // Handle purchase for newcomer modal
  const handlePurchase = async () => {
    if (!offerMiningPlan) {
      Alert.alert('Error', 'No mining plan available');
      return;
    }

    if (!offerMiningPlan.revenueCatPackage) {
      Alert.alert(
        'Package Not Available',
        'This subscription package is not available for in-app purchase. Please try again later.',
      );
      return;
    }

    if (purchasing) {
      return;
    }

    try {
      setPurchasing(true);


      // Purchase the package through RevenueCat
      const { customerInfo, productIdentifier } = await Purchases.purchasePackage(
        offerMiningPlan.revenueCatPackage
      );


      // For consumable products, check if the purchase was successful
      // For consumables, we check the purchase transactions rather than entitlements
      const latestTransaction = customerInfo.latestExpirationDate ||
        customerInfo.nonSubscriptionTransactions.length > 0;

      const hasActiveEntitlements = Object.keys(customerInfo.entitlements.active).length > 0;
      const hasNonSubscriptionPurchases = customerInfo.nonSubscriptionTransactions.length > 0;

      // Since these are consumable products, check for successful purchase
      const purchaseSuccessful = hasActiveEntitlements || hasNonSubscriptionPurchases || latestTransaction;

      if (purchaseSuccessful) {
        // Purchase successful - now sync with backend
        try {
          const payload = {
            plan_id: offerMiningPlan._id,
            product_identifier: productIdentifier,
            revenuecat_customer_id: customerInfo.originalAppUserId,
            price_paid: offerMiningPlan.revenueCatPackage.product.price,
            currency: offerMiningPlan.revenueCatPackage.product.currencyCode,
            purchase_date: new Date().toISOString(),
          };


          const response = await axios.post(`${get_data_uri('SYNC_PURCHASE')}/${user?.id}`, payload, {
            headers: { 'Content-Type': 'application/json' },
          });


          // Use API as single source of truth — do NOT add purchased power locally (avoids double counting).
          // Refetch mining details and set from response only.
          try {
            const local_time = formatMiningLocalTimeForApi(new Date());
            const miningDetailsResponse = await fetch(
              `${get_data_uri("USERMININGDETAILS")}/${user?.id}?local_time=${encodeURIComponent(local_time)}`
            );
            const miningDetailsData = await miningDetailsResponse.json();

            if (miningDetailsData.success && miningDetailsData.mining_details) {
              const details = miningDetailsData.mining_details;
              const updatedRawHP = parseFloat(details.hashpower ?? 0);
              const updatedEffective = parseFloat(details.effective_hashpower ?? details.hashpower ?? 0);
              const purchasedPh = parseFloat(details.purchasedHashpower ?? 0);
              setPurchasedHashpowerGh(purchasedPh);
              setLocalHashPower(updatedRawHP);
              setHashPower(updatedEffective);
              setEffectiveHashPower(updatedEffective);
            }
          } catch (fetchError) {
          }

          setShowNewcomerModal(false);
          Alert.alert(
            'Purchase Successful',
            `Your ${offerMiningPlan.name} (${offerMiningPlan.hashrate} ${offerMiningPlan.unit}) has been activated successfully!`,
            [
              {
                text: 'OK',
                onPress: () => {
                  // Refresh the data
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Main' }],
                  });
                },
              },
            ]
          );
        } catch (backendError: any) {
          setShowNewcomerModal(false);
          Alert.alert(
            'Purchase Completed',
            'Your purchase was successful, but we encountered an issue syncing with our servers. Please contact support if your mining power is not activated.',
            [{ text: 'OK' }]
          );
        }
      } else {
        Alert.alert('Purchase Failed', 'The purchase could not be completed. Please try again.');
      }
    } catch (purchaseError: any) {

      // Handle user cancellation
      if (purchaseError.userCancelled) {
        return;
      }

      // Handle other errors
      let errorMessage = 'Failed to complete purchase. Please try again.';
      if (purchaseError.code === 'NETWORK_ERROR') {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (purchaseError.code === 'PURCHASE_NOT_ALLOWED') {
        errorMessage = 'Purchases are not allowed on this device.';
      } else if (purchaseError.code === 'PAYMENT_PENDING') {
        errorMessage = 'Payment is pending. Please check your payment method.';
      } else if (purchaseError.code === 'INVALID_CREDENTIALS') {
        errorMessage = 'Invalid payment credentials. Please try again.';
      } else if (purchaseError.code === 'PURCHASE_INVALID') {
        errorMessage = 'This purchase is invalid. Please try a different plan.';
      }

      Alert.alert('Purchase Error', errorMessage);
    } finally {
      setPurchasing(false);
    }
  };
  // console.log("Btc balances", totalHistoricalBTC, btcBalance);
  // No more full-screen blocking gate here -- the real layout always
  // renders. If there's a cached snapshot (hasCache), values are the
  // last-known real numbers from frame one; if not (true first-ever
  // install), the individual displays below show a placeholder only until
  // the background fetch resolves (see `!hasCache && isLoading` below).
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#050914" translucent={false} />
      <ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >


        {/* Header Section */}
        <View style={styles.headerSection}>
          <View style={styles.headerTop}>
            <View style={styles.balanceContent}>
              <View style={styles.balanceLeft}>
                <Icon5 name="bitcoin" size={25} color="#ffb700ff" />
                <View style={styles.balanceTextContainer}>
                  {!hasCache && isLoading ? (
                    <Text style={styles.balanceAmount}>—</Text>
                  ) : (
                    <>
                      <OdometerCounter value={totalBtc} />
                      {showBalanceHint && (
                        <Text style={styles.detailSubtitle}>Your total balance — never resets</Text>
                      )}
                    </>
                  )}
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.detailsRow}>
          {/* Box 1 - Earning Details */}
          <TouchableOpacity
            style={[styles.detailBox, { flex: 1 }]}
            onPress={() => navigation.navigate('BalanceHistoryScreen')}
          >
            <View style={styles.detailLeft}>
              {Platform.OS === 'ios' ? (
                <Text
                  style={styles.detailBTCValue}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                >
                  <Text style={styles.detailBTCNumber}>
                    {previousDayEarnings > 0
                      ? previousDayEarnings.toFixed(16)
                      : userBalanceBTC?.toFixed(16)}
                  </Text>

                  <Text style={styles.detailBTCUnit}> BTC</Text>
                </Text>
              ) : (
                <Text
                  style={styles.detailBTCNumber}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                >
                  {previousDayEarnings > 0
                    ? `${previousDayEarnings.toFixed(16)} BTC`
                    : `${userBalanceBTC?.toFixed(16)} BTC`}
                </Text>
              )}

              <Text style={styles.detailSubtitle}>
                {previousDayEarnings > 0
                  ? 'Previous Day Earnings'
                  : 'Saved Balance'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Box 2 - Invitation Rewards */}
          <TouchableOpacity
            onPress={() => setShowInviteModal(true)}
            style={[styles.detailReferralBox, { flex: 1 }]}
          >
            <View style={styles.detailReferralLeft}>
              <Image
                source={require('../assets/images/referral_banner.png')}
                style={styles.rewardIcon}
                resizeMode="contain"
              />

              {/* Text Block beside icon */}
              <View style={styles.detailTextContainer}>
                <Text
                  style={styles.detailTitle}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  Invite Friends
                </Text>

                <Text
                  style={styles.detailReferralSubtitle}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {user_referrals > 0
                    ? `${user_referrals} friend${user_referrals > 1 ? 's' : ''} joined`
                    : 'Earn rewards'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* A "recent purchases" ticker lived here. It cycled ten hardcoded
            messages at random every 5s, presented as live activity with no
            real purchase behind any of them -- fabricated social proof, which
            Google flagged under Misrepresentation. Removed rather than wired to
            real data; add it back only from actual purchase records. */}

        {/* Mining Power Section */}
        <View style={styles.miningSection}>
          {/* Header Row */}
          <View style={styles.miningHeader}>
            <View style={styles.miningTitleContainer}>
              <Icon name="pickaxe" size={15} color="#18D4F2" />
              <Text style={styles.miningTitle}>Mining Power</Text>
            </View>

            {/* Activate text */}
            <View style={styles.toggleLabelContainer}>
              {isMiningEnabled ? (
                <Text style={styles.toggleLabel}>Activated</Text>
              ) : isMiningActivationPending && activationLoading ? (
                <BitPlayLoader size="sm" />
              ) : (
                <Text style={styles.toggleLabel}>Activate</Text>
              )}
            </View>
          </View>

          {/* Mining Power + Toggle inline */}
          <View style={styles.hashrateRow}>
            <View style={styles.hashrateTextContent}>
              <Text style={styles.hashrateValue}>
                {totalMiningPower.toFixed(1)}{' '}
                <Text style={styles.hashrateUnit}>Gh/s</Text>
              </Text>
              {isFreeUserCapReached && (
                <Text style={styles.maxMiningReachedLabel} numberOfLines={2}>
                  You reached max mining power ({MAX_FREE_USER_TOTAL_HASHPOWER_GH} Gh/s) for free users.
                </Text>
              )}
              {!isFreeUserCapReached && totalMiningPower <= 0 && !isMiningEnabled && (
                <Text style={styles.maxMiningReachedLabel} numberOfLines={2}>
                  Your BTC from yesterday is saved — claim your daily reward and activate mining to keep earning.
                </Text>
              )}
              {/* {stockGameBonus > 0 && (
                <Text style={styles.stockGameBonusLabel} numberOfLines={2}>
                  +{stockGameBonus.toFixed(1)} GH/s total bonus from all games
                </Text>
              )} */}
            </View>

            {/* Custom premium toggle */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={async () => {
                const newValue = !isMiningEnabled;
                if (newValue) {
                  const netState = await NetInfo.fetch();
                  if (!netState.isConnected) {
                    Alert.alert('No Connection', 'Please check your internet connection and try again.');
                    return;
                  }
                  if (!isNotificationEnabled) {
                    try {
                      const enabled = await localNotificationService.isNotificationPermissionGranted();
                      if (!enabled) {
                        const isNowEnabled = await localNotificationService.requestNotificationPermissionForMining();
                        setIsNotificationEnabled(isNowEnabled);
                        if (!isNowEnabled) {
                          await new Promise<void>((resolve) => {
                            Alert.alert(
                              "Enable Notifications",
                              "Get notified when your mining session ends! Enable notifications for the best experience.",
                              [
                                { text: "Start Mining Anyway", style: "cancel", onPress: () => resolve() },
                                { text: "Settings", onPress: () => { Linking.openSettings(); setIsMiningEnabled(false); resolve(); } }
                              ]
                            );
                          });
                        }
                      } else {
                        setIsNotificationEnabled(true);
                      }
                    } catch (error) {
                    }
                  }
                }
                if (activationLoading) {
                  if (newValue) setIsMiningActivationPending(true);
                  Alert.alert(
                    'Please wait for Ads to load',
                    'The mining activation ad is still loading. Try again in some seconds.',
                    [{ text: 'OK', onPress: () => { if (!newValue) setIsMiningEnabled(false); } }],
                    { cancelable: false },
                  );
                } else {
                  if (newValue) {
                    Alert.alert(
                      'Start Mining',
                      'Watch an ad to start mining. After activation mining will continue until 12AM, When your daily mining cycle resets.',
                      [
                        { text: 'Cancel', style: 'cancel', onPress: () => setIsMiningEnabled(false) },
                        {
                          text: 'OK',
                          onPress: async () => {
                            setStartTime(null);
                            setIsMiningEnabled(true);
                            miningActivatedLocallyRef.current = true;
                            setIsMiningActivationPending(false);
                            shouldClaimDailyRewardRef.current = true;
                            showActivationAd();
                          },
                        },
                      ],
                      { cancelable: false },
                    );
                  } else {
                    if (isDailyRewardClaimed) {
                      Alert.alert('Mining in Cooling Time', 'Please wait for the cooling time to finish.', [{ text: 'OK' }], { cancelable: false });
                      return;
                    }
                    setIsMiningEnabled(false);
                    miningActivatedLocallyRef.current = false;
                    setStartTime(null);
                    syncUserData(0, undefined, false);
                    Alert.alert('Mining Disabled', 'Mining has been turned off.');
                  }
                }
              }}
            >
              {/* Clean reliable toggle — no mixed-driver animations */}
              <View style={[
                styles.customToggleTrack,
                isMiningEnabled ? styles.customToggleTrackOn : styles.customToggleTrackOff,
              ]}>
                <Animated.View style={[
                  styles.customToggleThumb,
                  isMiningEnabled ? styles.customToggleThumbOn : styles.customToggleThumbOff,
                  {
                    transform: [{
                      translateX: thumbAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [2, Platform.OS === 'android' ? 30 : 26],
                      }),
                    }],
                  },
                ]}>
                  <Text style={styles.customToggleThumbIcon}>
                    {isMiningEnabled ? '⚡' : '○'}
                  </Text>
                </Animated.View>
              </View>
            </TouchableOpacity>
          </View>
        </View>


        {/* NEW: Loss Tracking Section (shown when user has purchased mining power AND has loss data from API) */}
        {hashPower > 3 && hasLossData && (cumulativeLoss) > 0 && dailyAdsWatched < dailyAdsRequired && (
          <View style={styles.lossTrackingSection}>
            {/* Loss Percentages Row */}
            <View style={styles.lossPercentagesRow}>
              <View style={styles.lossBox}>
                <Text style={styles.lossPercentage}>
                  {cumulativeLoss?.toFixed(1)}%
                </Text>
                <Text style={styles.lossLabel}>Cumulative Loss</Text>
                <Text style={styles.lossLabeldown}>Effective:{' '}
                  <Text style={styles.lossLabeldownValue}>
                    {capFreeUserTotalMiningPowerGh(effectiveHashPower ?? 0, purchasedHashpowerGh, privilegeMultiplier > 1).toFixed(1)}
                  </Text>{' '}Gh/s</Text>

              </View>
              <View style={styles.offsetBox}>
                <Text style={styles.offsetPercentage}>
                  {dailyLossOffset?.toFixed(1)}%
                </Text>
                <Text style={styles.offsetLabel}>Loss Offset Today</Text>
              </View>
            </View>

            {/* Watch Ads to Offset Loss */}
            <View style={styles.watchAdsSection}>
              <View style={styles.watchAdsContent}>
                <Icon name="video" size={20} color="#18D4F2" />
                <Text style={styles.watchAdsText}>
                  Watch{' '}
                  <Text style={styles.watchAdsHighlight}>
                    {dailyAdsRequired}
                  </Text>{' '}
                  ads to offset{' '}
                  <Text style={styles.watchAdsHighlight}>
                    {dailyLossOffset.toFixed(1)}%
                  </Text>{' '}
                  of the loss
                </Text>
              </View>
              <View style={styles.ticketBadge}>
                <Icon name="ticket" size={16} color="#FBBF24" />
                <Text style={styles.ticketBadgeText}>+{dailyAdsRequired}</Text>
              </View>
            </View>

            {/* Progress indicator */}
            <View style={styles.adsProgressContainer}>
              <View style={styles.adsProgressBar}>
                <View
                  style={[
                    styles.adsProgressFill,
                    {
                      width: `${Math.min(
                        (dailyAdsWatched / dailyAdsRequired) * 100,
                        100,
                      )}%`,
                    },
                  ]}
                />
              </View>
              <View style={styles.adsProgressPill}>
                <Icon
                  name="play-circle"
                  size={14}
                  color="#18D4F2"
                  style={styles.adsProgressIcon}
                />
                <Text style={styles.adsProgressText}>
                  {dailyAdsWatched}/{dailyAdsRequired} Offset
                </Text>
              </View>

            </View>
          </View>
        )}

        {/* NEW: Daily Video Requirement Progress (shown only for subscription holders) */}
        {dailyProgress.requirementActive &&
          dailyProgress.hasActiveSubscription && (
            <View style={styles.dailyProgressSection}>
              <View style={styles.dailyProgressHeader}>
                <Icon name="video-check" size={18} color="#18D4F2" />
                <Text style={styles.dailyProgressTitle}>
                  Daily Video Requirement
                </Text>
              </View>

              <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBackground}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${(dailyProgress.videosWatchedToday /
                          dailyProgress.dailyTarget) *
                          100
                          }%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {dailyProgress.videosWatchedToday}/{dailyProgress.dailyTarget}{' '}
                  videos
                </Text>
              </View>

              {!dailyProgress.isComplete && dailyProgress.remaining <= 3 && (
                <View style={styles.warningBox}>
                  <Icon name="alert-circle" size={16} color="#FBBF24" />
                  <Text style={styles.warningText}>
                    ⚠️ Watch {dailyProgress.remaining} more video
                    {dailyProgress.remaining > 1 ? 's' : ''} to avoid 13%
                    penalty!
                  </Text>
                </View>
              )}

              {dailyProgress.isComplete && (
                <View style={styles.successBox}>
                  <Icon name="check-circle" size={16} color="#10B981" />
                  <Text style={styles.successText}>
                    ✅ Daily requirement met!
                  </Text>
                </View>
              )}
            </View>
          )}

        {/* Best Offer - Buy 1, Get 1 Free (premium / paid — shown near top for visibility) */}
        <View style={[styles.bestOfferBanner, { marginTop: 12 }]}>
          <View style={styles.bestOfferContent}>
            <Text style={styles.bestOfferLabel}>Best offer</Text>
            <Text style={styles.bestOfferTitle}>Buy 1, Get 1 Free</Text>
            <TouchableOpacity
              style={styles.bestOfferButton}
              onPress={() => setShowNewcomerModal(true)}
            >
              <Text style={styles.bestOfferButtonText}>Claim</Text>
            </TouchableOpacity>
          </View>

          <Image
            source={require('../assets/images/offer_banner.png')}
            style={styles.bestOfferImage}
            resizeMode="contain"
          />
        </View>

        <View style={styles.claimRow}>
          {/* Box 1 - Gift Claim (25 Gh/s) */}
          <TouchableOpacity style={styles.claimBox}>
            {/* Top Row */}
            <View style={styles.claimTopRow}>
              <View style={styles.iconCorner}>
                <Icon name="gift" size={16} color="#F5F7FA" />
              </View>
              <TouchableOpacity
                style={styles.infoButton}
                onPress={() =>
                  Alert.alert(
                    '25 Gh/s Daily Claim',
                    'Cooling time: After claiming your daily 25 Gh/s reward, there is a cooling period. During this time you cannot turn off mining. The timer shows the remaining time.'
                  )
                }
              >
                <Icon name="information" size={14} color="#7E8CA3" />
              </TouchableOpacity>
            </View>

            {/* +100% Claim Tag */}
            <View style={styles.bonusTag}>
              <Text style={styles.bonusTagText}>+100% Claim</Text>
            </View>

            {/* Power Row */}
            <View style={styles.powerRow}>
              <Text style={styles.powerValue}>25</Text>
              <Text style={styles.powerUnit}> Gh/s</Text>
            </View>

            {/* Cooling time tooltip */}
            {/* <Text style={styles.coolingTooltipText}>
              Cooling period after claim
            </Text> */}

            {/* Claim Button */}
            <GradientButton
              onPress={() => {
                if (!isMiningEnabled) {
                  Alert.alert(
                    'Mining Not Activated',
                    'Please activate mining before claiming rewards.',
                    [{ text: 'OK' }]
                  );
                  return;
                }
                ClaimDailyReward();
              }}
              text={DailyClaimLabel}
              enabled={!isDailyRewardClaimed}
            />
          </TouchableOpacity>

          {/* Box 2 - Video Claim */}
          <TouchableOpacity style={styles.claimBox} onPress={async () => {
            if (adsWatched >= MAX_VIDEO_CLAIMS_PER_TRACK_PER_DAY) {
              return;
            }
            if (!isMiningEnabled) {
              Alert.alert(
                'Mining Not Activated',
                'Please activate mining before claiming rewards.',
                [{ text: 'OK' }]
              );
              return;
            }
            const netState = await NetInfo.fetch();
            if (!netState.isConnected) {
              Alert.alert('No Connection', 'Please check your internet connection and try again.');
              return;
            }
            showFiveGhAd();
          }}>
            {/* Top Row */}
            <View style={styles.claimTopRow}>
              <View style={styles.iconCorner}>
                <Icon name="video" size={16} color="#F5F7FA" />
              </View>
              <TouchableOpacity
                style={styles.infoButton}
                onPress={() =>
                  Alert.alert(
                    'Video claim',
                    `Maximum ${MAX_VIDEO_CLAIMS_PER_TRACK_PER_DAY} ads per day on this track. Watch ads to claim more mining speed (+5.5 Gh/s each).`
                  )
                }
              >
                <Icon name="information" size={14} color="#7E8CA3" />
              </TouchableOpacity>
            </View>

            {/* +100% Claim Tag */}
            <View style={styles.bonusTag}>
              <Text style={styles.bonusTagText}>+100% Claim</Text>
            </View>

            {/* Power Row */}
            <View style={styles.powerRow}>
              <Text style={styles.powerValue}>5.5</Text>
              <Text style={styles.powerUnit}> Gh/s</Text>
            </View>

            {/* Claim Button */}
            <GradientButton
              onPress={async () => {
                if (!isMiningEnabled) {
                  Alert.alert(
                    'Mining Not Activated',
                    'Please activate mining before claiming rewards.',
                    [{ text: 'OK' }]
                  );
                  return;
                }
                const netState = await NetInfo.fetch();
                if (!netState.isConnected) {
                  Alert.alert('No Connection', 'Please check your internet connection and try again.');
                  return;
                }
                showFiveGhAd();
              }}
              text={buttonLabel}
              enabled={!fiveGhLoading && adsWatched < MAX_VIDEO_CLAIMS_PER_TRACK_PER_DAY}
            />
          </TouchableOpacity>
        </View>



        {/* Games — Play & Earn with dynamic top-3 + Explore GameZone CTA */}
        <View style={styles.gamesPlayEarnSection}>
          <View style={styles.gamesPlayEarnTitleChipWrap} pointerEvents="box-none">
            <View style={styles.gamesPlayEarnTitleChip}>
              <Text style={styles.gamesPlayEarnTitle}>Play & Earn</Text>
            </View>
          </View>
          <View style={styles.gamesPlayEarnIconsRow}>
            {featuredGames.map((game) => (
              <Pressable
                key={game.route}
                onPress={() => navigation.navigate(game.route as any)}
                android_ripple={{ color: 'rgba(34, 211, 238, 0.22)', borderless: false }}
                style={({ pressed }) => [
                  styles.gamesPlayEarnIconWrap,
                  pressed && styles.gamesPlayEarnIconWrapPressed,
                ]}
              >
                {({ pressed }) => (
                  <View style={styles.gamesPlayEarnIconColumn}>
                    <View style={[styles.gamesPlayEarnIconCircle, pressed && styles.gamesPlayEarnIconCirclePressed]}>
                      {game.iconImage ? (
                        <Image
                          source={game.iconImage}
                          style={styles.gamesPlayEarnIconImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <Icon name="gamepad-variant-outline" size={32} color="#18D4F2" />
                      )}
                    </View>
                    <Text style={[styles.gamesPlayEarnIconName, pressed && styles.gamesPlayEarnIconTextPressed]} numberOfLines={1}>
                      {game.name}
                    </Text>
                    <Text style={[styles.gamesPlayEarnIconHint, pressed && styles.gamesPlayEarnIconTextPressed]} numberOfLines={2}>
                      {game.hint}
                    </Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
          {/* Explore GameZone CTA */}
          <Pressable
            onPress={() => navigation.navigate('Games' as any)}
            android_ripple={{ color: 'rgba(34, 211, 238, 0.3)', borderless: false }}
            style={({ pressed }) => [styles.exploreGameZoneBtn, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.exploreGameZoneBtnText}>🎮 Explore GameZone</Text>
          </Pressable>
        </View>

        {/* Crypto News — same entry pattern as Explore GameZone */}
        <View style={styles.newsSection}>
          <View style={styles.newsRow}>
            <View style={styles.newsIconBadge}>
              <Icon name="newspaper-variant-outline" size={22} color="#18D4F2" />
            </View>
            <View style={styles.newsCopy}>
              <Text style={styles.newsTitle}>Crypto News</Text>
              <Text style={styles.newsHint} numberOfLines={2}>
                Today's Bitcoin headlines, updated through the day
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => navigation.navigate('News' as any)}
            android_ripple={{ color: 'rgba(34, 211, 238, 0.3)', borderless: false }}
            style={({ pressed }) => [styles.exploreGameZoneBtn, pressed && { opacity: 0.8 }]}
          >
            <View style={styles.newsBtnInner}>
              <Icon name="newspaper-variant-outline" size={16} color="#18D4F2" />
              <Text style={styles.exploreGameZoneBtnText}>Read the News</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.dailyRewardSection}>
          <View style={styles.dailyRewardContainer}>
            {/* Left Icon */}
            <Image
              source={require('../assets/images/daily_reward_icon.png')}
              style={styles.rewardIcon}
              resizeMode="contain"
            />
            {/* Center Texts */}
            <View style={styles.rewardTextContainer}>
              {privilegeMultiplier === 1 && (
                // Marketing bait shown only to non-VIP users -- these two lines
                // are deliberately not tied to BASE_HASHPOWER_PER_AD/real reward
                // math, they're an upsell hook for Super Privileges. Users who
                // already own a real multiplier see their true value below
                // instead (superPrivilegesVipLabel / the computed Gh/s branch).
                <View style={{ ...styles.bonusTag, marginLeft: 0 }}>
                  <Text style={{ ...styles.bonusTagText }}>VIP +15000%</Text>
                </View>
              )}
              <View style={styles.powerRow}>
                {privilegeMultiplier === 1 ? (
                  <>
                    <Text style={styles.powerValue}>1.5</Text>
                    <Text style={styles.powerUnit}> TH/s</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.powerValue}>
                      {(BASE_HASHPOWER_PER_AD * privilegeMultiplier).toFixed(1)}
                    </Text>
                    <Text style={styles.powerUnit}> Gh/s</Text>
                  </>
                )}
                <TouchableOpacity
                  onPress={() => navigation.navigate('SuperPrivileges' as any)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.superPrivilegesInfoIcon}
                >
                  <Icon name="alert-circle-outline" size={16} color="#94A3B8" />
                </TouchableOpacity>
              </View>
              {privilegeMultiplier > 1 && (
                <Text style={styles.superPrivilegesVipLabel}>
                  VIP +{((privilegeMultiplier - 1) * 100).toLocaleString()}%
                </Text>
              )}
            </View>

            {/* Right Button -- this card is a Super Privileges upsell, so the
                button (like the info icon above) opens Super Privileges
                directly rather than running the ad-watch claim flow. */}
            <View style={styles.dailyRewardButton}>
              <GradientButton
                styleProps={styles.dailyRewardGradientButton}
                gradientStyleProps={{ marginTop: 0 }}
                onPress={() => navigation.navigate('SuperPrivileges' as any)}
                text="Claim Now"
                enabled
              />
            </View>
          </View>
        </View>

        {/* Streak Bonus Banner */}
        {(() => {
          const activeTierIdx = getActiveTierIndex(streakDays);
          const currentTier = activeTierIdx >= 0 ? STREAK_TIERS[activeTierIdx] : null;
          const nextTier =
            activeTierIdx >= 0 && activeTierIdx < STREAK_TIERS.length - 1
              ? STREAK_TIERS[activeTierIdx + 1]
              : null;
          const daysInTier =
            currentTier && nextTier
              ? activeTierIdx === 0
                ? 7
                : nextTier.minDays - currentTier.minDays
              : 7;
          const daysIntoCurrentTier = currentTier ? streakDays - currentTier.minDays : 0;
          const progressInTier =
            currentTier && daysInTier > 0
              ? Math.min(1, daysIntoCurrentTier / daysInTier)
              : 0;
          const isMaxTier = activeTierIdx === STREAK_TIERS.length - 1;
          return (
            <TouchableOpacity
              style={styles.streakBanner}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('AchievementsScreen')}
            >
              <View style={styles.streakBannerLeft}>
                <View style={styles.streakFireRow}>
                  <Icon name="fire" size={22} color="#F59E0B" />
                  <Text style={styles.streakBannerDays}>{streakDays}</Text>
                  <Text style={styles.streakBannerDaysLabel}> day streak</Text>
                </View>
                {streakBonusGh > 0 && (
                  <Text style={styles.streakBannerBonus}>+{streakBonusGh} Gh/s bonus active</Text>
                )}
                {!isMaxTier && nextTier ? (
                  <View style={styles.streakProgressRow}>
                    <View style={styles.streakProgressBarBg}>
                      <View
                        style={[
                          styles.streakProgressBarFill,
                          { width: `${Math.round(progressInTier * 100)}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.streakNextLabel}>
                      Day {daysIntoCurrentTier} of {daysInTier} in this tier · Next +{nextTier.bonusGh} Gh/s
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.streakMaxLabel}>Max streak bonus reached!</Text>
                )}
              </View>
              <Icon name="chevron-right" size={20} color="#7E8CA3" />
            </TouchableOpacity>
          );
        })()}

        {/* <View style={styles.FAQHeading}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <HelpCircle size={22} color="#18D4F2" style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>FAQ</Text>
          </View>
        </View> */}

        <View style={styles.faqSection}>
          <View
            style={[
              styles.faqContainer,
              faqVisible
                ? styles.faqContainerExpanded
                : styles.faqContainerCollapsed,
            ]}
          >
            {/* Header Button */}
            <TouchableOpacity
              style={styles.faqHeaderButton}
              onPress={toggleFAQ}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MessageCircle
                  size={18}
                  color="#a855f7"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.faqHeaderText}>FAQs</Text>
              </View>
              <Animated.Text
                style={[
                  styles.faqArrow,
                  {
                    transform: [
                      {
                        rotate: animatedHeight.interpolate({
                          inputRange: [0, contentHeight],
                          outputRange: ['0deg', '90deg'],
                        }),
                      },
                    ],
                  },
                ]}
              >
                ▶
              </Animated.Text>
            </TouchableOpacity>

            {/* Animated expanding section */}
            <Animated.View
              style={[
                styles.faqExpandedArea,
                Platform.OS === 'android' ? null : { height: animatedHeight },
              ]}
            >
              {/* The visible FAQ content */}
              {faqVisible && (
                Platform.OS === 'android' ? (
                  <View style={styles.scrollContent}>
                    {faqData.length > 0 ? (
                      faqData.map(renderFAQItem)
                    ) : error ? (
                      <Text style={styles.errorText}>{error}</Text>
                    ) : (
                      <Text style={styles.loadingText}>Loading FAQs...</Text>
                    )}
                    <View style={styles.bottomSpacing} />
                  </View>
                ) : (
                  <ScrollView contentContainerStyle={styles.scrollContent}>
                    {faqData.length > 0 ? (
                      faqData.map(renderFAQItem)
                    ) : error ? (
                      <Text style={styles.errorText}>{error}</Text>
                    ) : (
                      <Text style={styles.loadingText}>Loading FAQs...</Text>
                    )}
                    <View style={styles.bottomSpacing} />
                  </ScrollView>
                )
              )}

              {/* Invisible layout measurer */}
              <View
                style={styles.hiddenContentWrapper}
                onLayout={e => {
                  const { height } = e.nativeEvent.layout;
                  setContentHeight(height);
                }}
              >
                {Platform.OS === 'android' ? (
                  <View style={styles.scrollContent}>
                    {faqData.length > 0 ? faqData.map(renderFAQItem) : null}
                  </View>
                ) : (
                  <ScrollView contentContainerStyle={styles.scrollContent}>
                    {faqData.length > 0 ? faqData.map(renderFAQItem) : null}
                  </ScrollView>
                )}
              </View>
            </Animated.View>
          </View>
        </View>

        {/* Social Media Links Section */}
        <SocialMediaLinks />
      </ScrollView>

      {/* Newcomer Modal - ONE-TIME ONLY Offer */}
      <Modal
        visible={showNewcomerModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowNewcomerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Close Button */}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowNewcomerModal(false)}
            >
              <Icon name="close-circle" size={28} color="#7E8CA3" />
            </TouchableOpacity>

            {/* Newcomer Badge */}
            <View style={styles.newcomerBadge}>
              <Text style={styles.newcomerText}>Newcomer</Text>
            </View>

            {/* ONE-TIME ONLY Text */}
            <Text style={styles.oneTimeText}>ONE-TIME ONLY</Text>

            {/* Mining Machine Image with x2 Badge */}
            <View style={styles.miningMachineContainer}>
              <Icon5 name="bitcoin" size={80} color="#F7931A" />
              <Icon
                name="pickaxe"
                size={60}
                color="#18D4F2"
                style={{ position: 'absolute', right: 40, bottom: 40 }}
              />
              <View style={styles.x2Badge}>
                <Text style={styles.x2Text}>x2</Text>
              </View>
            </View>

            {/* +Hashrate Text */}
            <Text style={styles.bonusHashpowerText}>
              +
              {offerMiningPlan
                ? `${offerMiningPlan.hashrate} ${offerMiningPlan.unit}`
                : '...'}
            </Text>

            {/* Offer Details - 2x2 Grid */}
            <View style={styles.offerDetailsContainer}>
              <View style={styles.offerDetailsRow}>
                <View style={styles.offerDetailItem}>
                  <View style={styles.iconCircle}>
                    <Icon name="pickaxe" size={18} color="#18D4F2" />
                  </View>
                  <Text
                    style={styles.offerDetailText}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {offerMiningPlan
                      ? `${offerMiningPlan.hashrate} ${offerMiningPlan.unit}`
                      : 'Loading...'}
                  </Text>
                </View>
                <View style={styles.offerDetailItem}>
                  <View style={styles.iconCircle}>
                    <Icon name="calendar-clock" size={18} color="#18D4F2" />
                  </View>
                  <Text
                    style={styles.offerDetailText}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {offerMiningPlan
                      ? `${offerMiningPlan.duration} Month`
                      : 'Loading...'}
                  </Text>
                </View>
              </View>
              <View style={styles.offerDetailsRow}>
                <View style={styles.offerDetailItem}>
                  <View style={styles.iconCircle}>
                    <Icon name="cash" size={18} color="#18D4F2" />
                  </View>
                  <Text
                    style={styles.offerDetailText}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    $
                    {offerMiningPlan
                      ? offerMiningPlan.maintenance_cost.toFixed(2)
                      : '...'}
                    /day
                  </Text>
                </View>
                <View style={styles.offerDetailItem}>
                  <View style={styles.iconCircle}>
                    <Icon name="gift" size={18} color="#18D4F2" />
                  </View>
                  <Text
                    style={styles.offerDetailText}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    Special Offer
                  </Text>
                </View>
              </View>
            </View>

            {/* Price Section with Decorative Border */}
            <View style={styles.priceSection}>
              <TouchableOpacity
                style={styles.modalPriceButton}
                onPress={handlePurchase}
                disabled={!offerMiningPlan || purchasing}
              >
                <LinearGradient
                  colors={['#18D4F2', '#C084FC']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.priceButtonGradient}
                >
                  {purchasing ? (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 16,
                      }}
                    >
                      <ActivityIndicator
                        size="small"
                        color="#F5F7FA"
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.priceButtonText}>Processing...</Text>
                    </View>
                  ) : (
                    <Text style={styles.priceButtonText}>
                      {offerMiningPlan
                        ? offerMiningPlan.revenueCatPackage
                          ? `Subscribe ${offerMiningPlan.revenueCatPackage.product.priceString}`
                          : `Mint $${offerMiningPlan.plan_cost.toFixed(2)}`
                        : 'Loading...'}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* A struck-through "original price" of price x 1.37 used to sit
                  here. The plan was never sold at that price, so the discount it
                  implied was invented -- deceptive pricing under Google Ads and
                  Play policy. The real price is on the button above. */}
            </View>
          </View>
        </View>
      </Modal>

      {/* Invite Friends Modal */}
      <InviteFriendsModal
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        referralCode={user?.referralCode || ''}
        invitationRewards={btcReferralBalance}
        referralCount={user_referrals}
      />

      {BANNER_ADS_ENABLED && (
      <View style={styles.bannerWrapper}>
        <View style={styles.bannerContainer}>
          {bannerAdError ? (
            <TouchableOpacity onPress={() => Linking.openURL('https://thecaphevietnam.com/')}>
              <Image
                source={require('../assets/images/addbanner.png')}
                style={{ width: Dimensions.get('window').width, height: 60, resizeMode: 'stretch' }}
              />
            </TouchableOpacity>
          ) : (
            <BannerAdWithGamFallback
              primaryUnitId={ads.homeBannerId ?? DEFAULT_ADMOB_BANNER_ID}
              size={BannerAdSize.ADAPTIVE_BANNER}
              onAdFailedToLoad={(error) => {
                console.warn('[HomeScreen] Banner ad failed to load:', error);
              }}
              onAllFailed={() => setBannerAdError(true)}
            />
          )}
        </View>
      </View>
      )}
    </SafeAreaView>
  );
};


export default Page;

// Styles
const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  splashText: {
    color: '#F5F7FA',
    marginTop: 16,
    fontSize: 16,
  },
  toggle_switch: {
    transform: [{ scaleX: 0.5 }, { scaleY: 0.5 }]
  },
  iconBox: {
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: 25,
    height: 28,
    paddingBottom: 5
  },
  iconImage: {
    width: 35,
    height: 35,
  },
  switchWrapper: {
    borderRadius: 16,
    alignSelf: "flex-start",
  },
  gradientButtonContainer: {
    marginBottom: 16,
  },


  gamesPlayEarnSection: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 22,
    marginTop: 22,
    borderWidth: 1,
    borderColor: '#D08A13',
    position: 'relative',
    overflow: 'visible',
    backgroundColor: '#0B111D',
  },
  gamesPlayEarnTitleChipWrap: {
    position: 'absolute',
    top: -12,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
  gamesPlayEarnTitleChip: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 999,
    borderTopWidth: 2,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderColor: '#D08A13',
    backgroundColor: '#0B111D',
  },
  gamesPlayEarnTitle: {
    color: '#F5F7FA',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.35,
    textAlign: 'center',
  },
  gamesPlayEarnIconsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  gamesPlayEarnIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '32%',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  gamesPlayEarnIconWrapPressed: {
    opacity: 0.96,
  },
  gamesPlayEarnIconColumn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gamesPlayEarnIconCircle: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050914',
    shadowColor: '#D08A13',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#D08A13',
    overflow: 'hidden',
  },
  gamesPlayEarnIconCirclePressed: {
    transform: [{ scale: 0.94 }],
    shadowColor: '#18D4F2',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
  },
  gamesPlayEarnIconCirclePressedSpin: {
    shadowColor: '#FBBF24',
    shadowOpacity: 0.48,
  },
  gamesPlayEarnIconCirclePressedMemory: {
    shadowColor: '#818CF8',
    shadowOpacity: 0.48,
  },
  gamesPlayEarnIconImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  gamesPlayEarnIconImagePressed: {
    opacity: 0.9,
  },
  gamesPlayEarnIconTextPressed: {
    opacity: 0.75,
  },
  gamesPlayEarnIconName: {
    color: '#E99C16',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
  gamesPlayEarnIconHint: {
    color: '#FDF5E8',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 14,
  },
  newsSection: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 16,
    marginTop: 22,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.35)',
    backgroundColor: '#0B111D',
  },
  newsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  newsIconBadge: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
    borderWidth: 1, borderColor: 'rgba(34, 211, 238, 0.28)',
  },
  newsBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  newsCopy: { flex: 1, marginLeft: 12 },
  newsTitle: { color: '#F1F5F9', fontSize: 15, fontWeight: '800' },
  newsHint: { color: '#94A3B8', fontSize: 12, marginTop: 2, lineHeight: 16 },
  exploreGameZoneBtn: {
    marginTop: 8,
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.35)',
  },
  exploreGameZoneBtnText: {
    color: '#18D4F2',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  superPrivilegesInfoIcon: {
    marginLeft: 4,
  },
  superPrivilegesVipLabel: {
    color: '#FBBF24',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },

  container: {
    flex: 1,
    backgroundColor: '#050914',
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerSection: {
    marginBottom: 4,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeContainer: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#F5F7FA',
    marginBottom: 4,
  },
  subWelcomeText: {
    fontSize: 16,
    color: '#7E8CA3',
  },
  menuButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#0B111D',
  },
  balanceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  shadowWrapper: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    borderRadius: 20,
    marginVertical: 8,
  },

  balanceCard: {
    borderRadius: 20,
    overflow: 'hidden',
  },

  balanceGradient: {
    padding: Platform.OS === 'ios' ? 5 : 20,
    minHeight: 80,
    borderRadius: 20,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#F5F7FA',
    marginBottom: 4,
  },

  balanceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
  },

  balanceTextContainer: {
    marginLeft: 6,
    flexShrink: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  balanceAmount: {
    fontSize: 20,
    fontWeight: 500,
    color: '#F5F7FA',
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
    flexShrink: 1,
  },
  // iOS: stabilize numeric rendering to avoid flicker during fast updates
  balanceAmountIOSStable: {
    fontVariant: ['tabular-nums'],
    // Tabular numbers + monospace reduces glyph-width changes (visual blinking)
    fontFamily: 'Menlo',
  },
  balanceAmountTail: {
    fontVariant: ['tabular-nums'],
    fontFamily: 'Menlo',
  },
  miningSection: {
    backgroundColor: '#0B111D',
    padding: 20,
    borderRadius: 16,
    // marginBottom: 16,
  },

  miningHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  miningTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  miningTitle: {
    marginLeft: 8,
    fontSize: 17,
    fontWeight: '600',
    color: '#F5F7FA',
  },

  toggleLabel: {
    fontSize: 13,
    color: '#F5F7FA',
    fontWeight: '500',
  },

  toggleLabelContainer: {
    minWidth: 80,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  hashrateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  hashrateTextContent: {
    flex: 1,
    paddingRight: 8,
  },

  hashrateValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#F5F7FA',
  },

  switchWrapperSmall: {
    borderRadius: 16,
    marginTop: 2,
    marginLeft: 8,
    alignSelf: 'flex-start',
  },

  toggleSwitchSmall: {},

  customToggleTrack: {
    width: Platform.OS === 'android' ? 60 : 50,
    height: Platform.OS === 'android' ? 32 : 26,
    borderRadius: 16,
    borderWidth: 1.5,
    justifyContent: 'center',
    marginLeft: 8,
  },
  customToggleTrackOn: {
    backgroundColor: '#0e7490',
    borderColor: '#18D4F2',
  },
  customToggleTrackOff: {
    backgroundColor: '#0B111D',
    borderColor: '#232B3A',
  },

  customToggleThumb: {
    width: Platform.OS === 'android' ? 26 : 20,
    height: Platform.OS === 'android' ? 26 : 20,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  customToggleThumbOn: {
    backgroundColor: '#18D4F2',
    shadowColor: '#18D4F2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  customToggleThumbOff: {
    backgroundColor: '#556277',
  },

  customToggleThumbIcon: {
    fontSize: Platform.OS === 'android' ? 12 : 10,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#0B111D',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F5F7FA',
    marginVertical: 6,
  },
  statLabel: {
    fontSize: 14,
    color: '#F5F7FA',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    borderRadius: 40,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Platform.OS === 'ios' ? 8 : 4,
    minHeight: Platform.OS === 'ios' ? 54 : 55,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F5F7FA',
  },
  premiumCard: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  premiumGradient: {
    padding: 20,
  },
  premiumContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  premiumLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  premiumTextContainer: {
    marginLeft: 16,
  },
  premiumTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F5F7FA',
    marginBottom: 4,
  },
  premiumSubtitle: {
    fontSize: 14,
    color: '#7E8CA3',
  },
  portfolioSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F5F7FA',
  },
  chartContainer: {
    backgroundColor: '#0B111D',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  chartPlaceholder: {
    alignItems: 'center',
  },
  chartText: {
    fontSize: 16,
    color: '#F5F7FA',
    marginTop: 12,
    fontWeight: '600',
  },
  chartSubtext: {
    fontSize: 14,
    color: '#7E8CA3',
    marginTop: 4,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: '#232B3A',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
  },
  quickActionText: {
    fontSize: 13,
    color: '#F5F7FA',
    marginTop: 8,
    fontWeight: 'bold',
  },
  activitySection: {
    marginBottom: Platform.OS === 'ios' ? 65 : 110
  },
  emptyActivity: {
    backgroundColor: '#0B111D',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  emptyActivityText: {
    fontSize: 18,
    color: '#F5F7FA',
    marginTop: 16,
    fontWeight: '600',
  },
  emptyActivitySubtext: {
    fontSize: 14,
    color: '#7E8CA3',
    marginTop: 4,
    textAlign: 'center',
  },
  activityList: {
    backgroundColor: '#0B111D',
    borderRadius: 12,
    padding: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#232B3A',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#232B3A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityDetails: {
    flex: 1,
  },
  activityType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F5F7FA',
    marginBottom: 2,
  },
  activityCrypto: {
    fontSize: 12,
    color: '#7E8CA3',
  },
  activityAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
  },
  bannerWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#F5F7FA',
    paddingHorizontal: 0,
    alignItems: 'center',
  },

  bannerContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#F5F7FA',
    fontWeight: '600',
    alignSelf: "center",
  },
  gradientButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 40,
    minHeight: Platform.OS === 'ios' ? 45 : 55,
  },
  gradientClaimButton: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 13,
    minHeight: Platform.OS === 'ios' ? 35 : 40,
  },
  rewardButtonGradient: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },

  rewardButtonContent: {
    alignItems: 'center',
  },

  rewardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  rewardTimerText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#fffae0ff',
    marginTop: 2,
    opacity: 0.9,
  },

  // Top Boxes 

  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    marginTop: 0,
    gap: 14,
  },

  detailBox: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: '48%',
    backgroundColor: '#0B111D',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    justifyContent: 'space-between',
    flexDirection: 'row',
    alignItems: 'center',
  },

  detailReferralBox: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: '48%',
    backgroundColor: '#0B111D',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    justifyContent: 'space-between',
    flexDirection: 'row',
    alignItems: 'center',
  },

  detailLeft: {
    flex: 1,
    justifyContent: 'center',
  },

  detailBTCValue: {
    flexShrink: 1,
    textAlign: 'left',
  },

  detailBTCNumber: {
    color: '#F5F7FA',
    fontWeight: 'bold',
    fontSize: 16.5,
  },

  detailBTCUnit: {
    color: '#7E8CA3',
    fontWeight: '600',
    fontSize: 15,
  },

  detailSubtitle: {
    color: '#7E8CA3',
    fontSize: 12,
    marginTop: 5,
  },

  detailArrow: {
    marginLeft: 8,
    alignSelf: 'center',
  },

  // Claim Boxes

  claimRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
    // marginBottom: 16,
  },

  claimBox: {
    flex: 1,
    backgroundColor: '#0B111D',
    borderRadius: 14,
    padding: 8,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 110,
  },

  claimTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  iconCorner: {
    width: 28,
    height: 28,
    backgroundColor: '#18D4F2',
    borderTopLeftRadius: 12,
    borderBottomRightRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },

  infoButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },

  bonusTag: {
    borderWidth: 1,
    borderColor: '#FBBF24',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
    marginLeft: 28
  },

  bonusTagText: {
    color: '#FBBF24',
    fontWeight: '600',
    fontSize: 11,
  },

  claimButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 8,
    marginTop: 12,
    alignItems: 'center',
  },

  claimButtonText: {
    color: '#F5F7FA',
    fontWeight: '600',
    fontSize: 13,
  },

  powerRow: {
    flexDirection: 'row',
    marginTop: 10,
    alignItems: 'baseline',
  },

  powerValue: {
    color: '#F5F7FA',
    fontSize: 18,
    fontWeight: '700',
  },

  powerUnit: {
    color: '#7E8CA3',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },

  coolingTooltipText: {
    fontSize: 10,
    color: '#7E8CA3',
    marginTop: 4,
    marginBottom: 2,
  },

  // FAQs

  FAQHeading: {
    marginTop: 10
  },

  scrollView: {
    flex: 1,
    backgroundColor: "#0B111D",
    borderRadius: 20,
    paddingTop: 30
  },
  bottomSpacing: {
    height: 50,
  },
  answerContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#0B111D',
  },
  answerText: {
    color: '#7E8CA3',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 15,
  },
  questionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  questionText: {
    color: '#F5F7FA',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 10,
  },
  faqItem: {
    marginBottom: 15,
    borderRadius: 12,
    backgroundColor: '#0B111D',
    overflow: 'hidden',
  },
  expandIcon: {
    color: '#18D4F2',
    fontSize: 14,
    fontWeight: 'bold',
    transform: [{ rotate: '0deg' }],
  },
  expandIconRotated: {
    transform: [{ rotate: '180deg' }],
  },
  faqSection: {
    width: '100%',
    marginTop: 20,
    marginBottom: 0,
  },


  faqArrowRotated: {
    transform: [{ rotate: '90deg' }],
  },

  errorText: {
    color: '#F87171',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
  },

  loadingText: {
    color: '#7E8CA3',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
  },

  faqContainer: {
    overflow: 'scroll',
    backgroundColor: '#0B111D',
    borderRadius: 14,
  },

  faqContainerCollapsed: {
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },

  faqContainerExpanded: {
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },

  faqHeaderButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 30,
  },

  faqHeaderText: {
    color: '#F5F7FA',
    fontSize: 16,
    fontWeight: '600',
  },

  faqArrow: {
    color: '#7E8CA3',
    fontSize: 16,
  },

  faqExpandedArea: {
    overflow: 'hidden',
    backgroundColor: '#232B3A',
    marginBottom: -30,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },

  hiddenContentWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    opacity: 0,
  },

  hashrateUnit: {
    fontSize: 15,
    color: '#7E8CA3',
    fontWeight: 'normal',
  },
  stockGameBonusLabel: {
    fontSize: 11,
    color: '#18D4F2',
    fontWeight: '600',
    marginTop: 2,
  },
  maxMiningReachedLabel: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '700',
    marginTop: 3,
  },

  dailyRewardSection: {
    width: '100%',
    alignItems: 'center',
    marginTop: 16,
    // marginBottom: 16,
  },

  dailyRewardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: '#0B111D',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#232B3A',
  },

  rewardIcon: {
    width: 40,
    height: 40,
    marginRight: 12,
  },

  rewardTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },

  rewardTitle: {
    color: '#F5F7FA',
    fontSize: 15,
    fontWeight: '600',
  },

  rewardSubtitle: {
    color: '#7E8CA3',
    fontSize: 13,
    marginTop: 2,
  },

  NewClaimButton: {
    backgroundColor: '#232B3A',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#556277',
    alignItems: 'center',
    justifyContent: 'center',
  },

  NewClaimButtonText: {
    color: '#F5F7FA',
    fontSize: 14,
    fontWeight: '600',
  },

  dailyRewardButton: {
    flexShrink: 0,
    width: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dailyRewardGradientButton: {
    flex: 0,
    width: '100%',
  },

  detailReferralLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    flexGrow: 1,
    flexBasis: 0,
  },

  detailTextContainer: {
    flexShrink: 1,
    flexGrow: 1,
    justifyContent: 'center',
  },

  detailTitle: {
    color: '#F5F7FA',
    fontSize: 13,
    fontWeight: '600',
  },

  detailReferralSubtitle: {
    color: '#7E8CA3',
    fontSize: 11,
    marginTop: 2,
  },

  offerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: '#0B111D',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    marginTop: 20,
    marginBottom: 20,
  },

  offerTextContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingRight: 10,
  },

  offerLabel: {
    color: '#7E8CA3',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },

  offerTitle: {
    color: '#F5F7FA',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
    flexShrink: 1,
  },

  offerButton: {
    borderWidth: 1,
    borderColor: '#7E8CA3',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 25,
  },

  offerButtonText: {
    color: '#F5F7FA',
    fontSize: 14,
    fontWeight: '600',
  },

  offerImage: {
    width: 80,
    height: 80,
    marginLeft: 10,
  },

  // NEW: Best Offer Banner Styles
  bestOfferBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: '#0B111D',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    marginTop: 16,
    // marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },

  bestOfferContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingRight: 10,
  },

  bestOfferLabel: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'capitalize',
  },

  bestOfferTitle: {
    color: '#F5F7FA',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },

  bestOfferButton: {
    borderWidth: 2,
    borderColor: '#F59E0B',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 30,
    backgroundColor: 'transparent',
  },

  bestOfferButtonText: {
    color: '#F59E0B',
    fontSize: 15,
    fontWeight: '700',
  },

  bestOfferImage: {
    width: 90,
    height: 90,
    marginLeft: 10,
  },

  // Newcomer Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  modalContainer: {
    backgroundColor: '#0B111D',
    borderRadius: 24,
    width: '90%',
    maxWidth: 400,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
    position: 'relative',
    borderWidth: 2,
    borderColor: '#18D4F2',
  },

  modalCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
  },

  newcomerBadge: {
    backgroundColor: '#18D4F2',
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 28,
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#C084FC',
    shadowColor: '#18D4F2',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },

  newcomerText: {
    color: '#0B111D',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
  },

  oneTimeText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#18D4F2',
    marginBottom: 24,
    letterSpacing: 2,
    textShadowColor: 'rgba(34, 211, 238, 0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },

  miningMachineContainer: {
    backgroundColor: '#232B3A',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    width: '100%',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 2,
    borderColor: '#18D4F2',
  },

  miningMachineImage: {
    width: 120,
    height: 120,
  },

  x2Badge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },

  x2Text: {
    color: '#F5F7FA',
    fontSize: 16,
    fontWeight: '900',
  },

  bonusHashpowerText: {
    color: '#18D4F2',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },

  offerDetailsContainer: {
    width: '100%',
    marginBottom: 24,
  },

  offerDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  offerDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
  },

  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0B111D',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#18D4F2',
  },

  offerDetailText: {
    color: '#F5F7FA',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    flexShrink: 1,
  },

  priceSection: {
    width: '100%',
    padding: 16,
    borderWidth: 2,
    borderColor: '#18D4F2',
    borderRadius: 20,
    backgroundColor: '#232B3A',
    shadowColor: '#18D4F2',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  modalPriceButton: {
    width: '100%',
    marginBottom: 12,
  },

  priceButtonGradient: {
    borderRadius: 14,
    alignItems: 'center',
  },

  priceButtonText: {
    paddingVertical: 16,
    color: '#F5F7FA',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  originalPriceText: {
    color: '#7E8CA3',
    fontSize: 18,
    fontWeight: '600',
    textDecorationLine: 'line-through',
    textAlign: 'center',
  },

  // NEW: Loss Tracking Styles
  lossTrackingSection: {
    backgroundColor: '#0B111D',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    // marginBottom: 16,
    borderWidth: 1,
    borderColor: '#232B3A',
  },

  lossPercentagesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },

  lossBox: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 16,
    padding: 5,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#EF4444',
  },

  lossPercentage: {
    color: '#EF4444',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },

  lossLabel: {
    color: '#7E8CA3',
    fontSize: 10,
    textAlign: 'center',
  },

  lossLabeldown: {
    color: '#7E8CA3',
    paddingTop: 4,
    fontSize: 11,
    textAlign: 'center',
  },

  lossLabeldownValue: {
    color: '#18D4F2',
    fontWeight: '700',
  },

  offsetBox: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 16,
    padding: 5,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FBBF24',
  },

  offsetPercentage: {
    color: '#FBBF24',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },

  offsetLabel: {
    color: '#7E8CA3',
    fontSize: 10,
    textAlign: 'center',
  },

  watchAdsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0B111D',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },

  watchAdsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },

  watchAdsText: {
    color: '#F5F7FA',
    fontSize: 13,
    marginLeft: 10,
    flex: 1,
  },

  watchAdsHighlight: {
    color: '#18D4F2',
    fontWeight: '700',
  },

  ticketBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#232B3A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },

  ticketBadgeText: {
    color: '#FBBF24',
    fontSize: 14,
    fontWeight: '700',
  },

  adsProgressContainer: {
    marginTop: 4,
  },

  adsProgressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#232B3A',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },

  adsProgressFill: {
    height: '100%',
    backgroundColor: '#18D4F2',
    borderRadius: 4,
  },

  adsProgressText: {
    color: '#7E8CA3',
    fontSize: 12,
    textAlign: 'center',
  },
  adsProgressPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#050914',
    marginTop: 2,
  },

  adsProgressIcon: {
    marginRight: 6,
  },

  // NEW: Daily Progress Styles
  dailyProgressSection: {
    backgroundColor: '#0B111D',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    // marginBottom: 16,
    borderWidth: 1,
    borderColor: '#232B3A',
  },

  dailyProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  dailyProgressTitle: {
    color: '#F5F7FA',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  progressBarContainer: {
    marginBottom: 12,
  },

  progressBarBackground: {
    width: '100%',
    height: 8,
    backgroundColor: '#232B3A',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },

  progressBarFill: {
    height: '100%',
    backgroundColor: '#18D4F2',
    borderRadius: 4,
  },

  progressText: {
    color: '#7E8CA3',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },

  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FBBF24',
  },

  warningText: {
    color: '#92400E',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },

  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#10B981',
  },

  successText: {
    color: '#065F46',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },

  // // Notification Warning Banner
  // notificationWarningBanner: {
  //   backgroundColor: '#FEF2F2', // Light red background
  //   borderRadius: 12,
  //   padding: 12,
  //   marginBottom: 16,
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   justifyContent: 'space-between',
  //   borderWidth: 1,
  //   borderColor: '#FCA5A5', // Red border
  // },
  // notificationWarningContent: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   flex: 1,
  //   marginRight: 10,
  // },
  // notificationWarningTitle: {
  //   fontSize: 14,
  //   fontWeight: 'bold',
  //   color: '#991B1B', // Dark red
  //   marginBottom: 2,
  // },
  // notificationWarningText: {
  //   fontSize: 12,
  //   color: '#B91C1C', // Red text
  //   flexWrap: 'wrap',
  // },
  // settingsButton: {
  //   backgroundColor: '#EF4444',
  //   paddingHorizontal: 12,
  //   paddingVertical: 8,
  //   borderRadius: 8,
  // },
  // settingsButtonText: {
  //   color: '#F5F7FA',
  //   fontSize: 12,
  //   fontWeight: 'bold',
  // },

  streakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B111D',
    marginTop: 16,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#232B3A',
  },
  streakBannerLeft: {
    flex: 1,
  },
  streakFireRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakBannerDays: {
    color: '#F5F7FA',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  streakBannerDaysLabel: {
    color: '#7E8CA3',
    fontSize: 14,
  },
  streakBannerBonus: {
    color: '#00FFA6',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  streakProgressRow: {
    marginTop: 8,
  },
  streakProgressBarBg: {
    height: 5,
    backgroundColor: '#232B3A',
    borderRadius: 3,
    overflow: 'hidden',
    width: '80%',
  },
  streakProgressBarFill: {
    height: 5,
    backgroundColor: '#F59E0B',
    borderRadius: 3,
  },
  streakNextLabel: {
    color: '#7E8CA3',
    fontSize: 11,
    marginTop: 4,
  },
  streakMaxLabel: {
    color: '#00FFA6',
    fontSize: 11,
    marginTop: 6,
    fontWeight: '600',
  },

});
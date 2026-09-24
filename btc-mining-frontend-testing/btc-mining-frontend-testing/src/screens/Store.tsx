import { StackNavigationProp } from '@react-navigation/stack';
import { BANNER_ADS_ENABLED } from '../config/adPlacements';
import BitPlayLoader from '../components/BitPlayLoader';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Platform,
  ActivityIndicator,
  Image,
  Dimensions,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import { RootStackParamList } from '../components/types';
import { useNavigation } from '@react-navigation/native';
import { get_data_uri, getMobileSecurityHeaders } from '../config/api';
import axios from 'axios';
import MinerBotSVG from '../components/MinerBotSVG';
import { useHashPower } from '../stores/HashPowerStore';
import Purchases, { PurchasesPackage, PurchasesOfferings } from 'react-native-purchases';
import { useAuth } from '../auth/AuthProvider';
import { getPlanDetails, formatGain } from '../data/planDetailsMapping';
import { formatMiningLocalTimeForApi } from '../utils/miningTime';
import { capFreeUserTotalMiningPowerGh } from '../utils/miningPowerCap';
import { usePrivilegeMultiplier } from '../hooks/usePrivilegeMultiplier';
import { getObjectFromStorage, saveObjectToStorage } from '../config/storage';
import { BannerAdSlot } from '../components/ads/BannerAdSlot';
import { BannerAdSize } from 'react-native-google-mobile-ads';
import { DEFAULT_ADMOB_BANNER_ID } from '../services/adUnitDefaults';
import { useAdConfig } from '../providers/AdConfigProvider';
import {
  trackCheckoutStarted,
  trackPurchase,
} from '../services/apptroveAnalytics';
import { trackMmpCheckoutStarted, trackMmpPurchase } from '../services/mmpAnalytics';

// Import mining pack images
const MiningPack01 = require('../assets/images/MiningPack01.svg').default;
const MiningPack02 = require('../assets/images/MiningPack02.svg').default;
const MiningPack03 = require('../assets/images/MiningPack03.svg').default;
const MiningPack04 = require('../assets/images/MiningPack04.svg').default;
const MiningPack05 = require('../assets/images/MiningPack05.svg').default;
const MiningPack06 = require('../assets/images/MiningPack06.svg').default;
const MiningPack07 = require('../assets/images/MiningPack07.svg').default;

// BitPlayPro branding (same asset as SplashScreen, InviteFriendsModal)
const AppLogo = require('../assets/images/main_app_icon.png');

const { width } = Dimensions.get('window');
const scale = width / 375; // Base width (iPhone 11/X/XR size)

const normalize = (size: number) => {
  const newSize = size * scale;
  return Math.round(newSize);
};

interface SubscriptionItem {
  _id: string;
  name: string;
  hashrate: number;
  unit: string;
  duration: number;
  maintenance_cost: number;
  plan_cost: number;
  apple_identifier?: string;
  google_identifier?: string;
}

interface SubscriptionItemWithPackage extends SubscriptionItem {
  revenueCatPackage?: PurchasesPackage;
}

const STORE_CACHE_VERSION = 1;
const getStoreCacheKey = (userId: string) => `store_cache_${userId}`;

const SYNC_RETRY_DELAYS_MS = [2000, 5000, 10000];

// The server checks the purchase with RevenueCat the moment we post it, and
// RevenueCat can still be processing the receipt for a few seconds. A single
// attempt dropped the purchase whenever that (or a bad connection) lost the
// race, leaving it paid for but never recorded. 409 means the RevenueCat
// webhook already recorded it, which is success.
const postPurchaseWithRetry = async (url: string, payload: unknown, headers: Record<string, string>) => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await axios.post(url, payload, { headers });
    } catch (err: any) {
      const status = err?.response?.status;
      const code = err?.response?.data?.code;
      if (status === 409 && code === 'TRANSACTION_ALREADY_USED') return err.response;
      const retriable =
        !err?.response ||
        status >= 500 ||
        code === 'VERIFICATION_NO_PURCHASE' ||
        code === 'VERIFICATION_NO_SUBSCRIBER';
      if (!retriable || attempt >= SYNC_RETRY_DELAYS_MS.length) throw err;
      await new Promise<void>(resolve => setTimeout(() => resolve(), SYNC_RETRY_DELAYS_MS[attempt]));
    }
  }
};

const StoreScreen = () => {
  const { user } = useAuth();
  // Server-configured banner unit, same source HomeScreen uses. The hardcoded
  // DEFAULT_ADMOB_BANNER_ID is only a last-resort fallback -- on iOS that unit
  // does not serve, which is why this screen showed no ad on TestFlight while
  // Home did.
  const { ads } = useAdConfig();
  const bannerUnitId = ads?.homeBannerId ?? DEFAULT_ADMOB_BANNER_ID;
  // Plan/product catalog display, backend fields only -- deliberately NEVER
  // includes revenueCatPackage (a live RevenueCat SDK object tied to this
  // session's Purchases.getOfferings() call; a JSON-round-tripped copy would
  // not be usable for an actual purchase). Every downstream read of
  // revenueCatPackage already falls back gracefully when it's undefined
  // (base backend price for display, and handlePurchase itself refuses to
  // proceed without a live package) -- see below -- so seeding the catalog
  // from cache with revenueCatPackage absent is safe by construction, not
  // just for display.
  const [cachedStore] = useState(() => {
    if (!user?.id) return null;
    const raw = getObjectFromStorage(getStoreCacheKey(user.id));
    return raw?.version === STORE_CACHE_VERSION ? raw.plans : null;
  });
  const [hasStoreCache] = useState(() => cachedStore != null);
  const [SubscriptionData, setSubscriptionData] = useState<SubscriptionItemWithPackage[]>(cachedStore ?? []);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(0);
  const [purchasing, setPurchasing] = useState(false);
  const [fetchedHashPower, setFetchedHashPower] = useState<number | null>(null);
  const [userPackages, setUserPackages] = useState<string[]>([]); // store purchased plan ids
  const [localHashPower, setLocalHashPower] = useState(0);

  const scrollViewRef = useRef<ScrollView>(null);
  const { hashPower, setHashPower, addHashPower, purchasedHashpowerGh, setPurchasedHashpowerGh } = useHashPower();
  // Called unconditionally here (before the `loading` early-return below) per Rules of Hooks.
  const privilegeMultiplier = usePrivilegeMultiplier(user?.id);

  type SubscriptionResponse = {
    success: boolean;
    plans: SubscriptionItem[];
  };

  type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Store'>;
  const navigation = useNavigation<LoginScreenNavigationProp>();

  const prevHashPowerRef = useRef(0);

  // Fetch user mining details to get current hashpower (initial load)
  useEffect(() => {
    // Fetch user's purchased packages
    const fetchUserPackages = async () => {
      if (!user?.id) {
        setUserPackages([]);
        setFetchedHashPower(null);
        return;
      }
      try {
        const response = await axios.get(`${get_data_uri('SYNC_PURCHASE')}/${user.id}`, {
          headers: getMobileSecurityHeaders(),
        });
        if (response.data && Array.isArray(response.data.purchases)) {
          // FIX: Extract plan_id as string for correct UI comparison
          // Some purchases return plan_id as an object, not a string.
          // This ensures userPackages contains only plan _id strings, so purchased packages are correctly grayed out and disabled in the UI.
          setUserPackages(
            response.data.purchases.map((p: any) =>
              typeof p.plan_id === 'string' ? p.plan_id : p.plan_id?._id
            )
          );
        }
      } catch (err) {
      }
    };
    fetchUserPackages();
    // Mining details are already fetched in useFocusEffect below — skip duplicate fetch on mount.
  }, [user?.id]);

  // Sync localHashPower when hashPower from store changes (for instant updates)
  useEffect(() => {
    if (hashPower > prevHashPowerRef.current && localHashPower > 0) {
      // Hash power increased - update localHashPower proportionally
      const difference = hashPower - prevHashPowerRef.current;
      setLocalHashPower(prev => prev + difference);
    }
    prevHashPowerRef.current = hashPower;
  }, [hashPower, localHashPower]);

  // Refresh hashpower when screen is focused (like HomeScreen)
  useFocusEffect(
    useCallback(() => {
      const fetchMiningDetails = async () => {
        if (!user?.id) return;

        try {
          const local_time = formatMiningLocalTimeForApi(new Date());
          const response = await fetch(
            `${get_data_uri("USERMININGDETAILS")}/${user.id}?local_time=${encodeURIComponent(local_time)}`
          );
          const data = await response.json();

          if (data.success && data.mining_details) {
            // Use hashpower (raw) to match HomeScreen display
            const rawHP = data.mining_details.hashpower ?? 0;
            const parsedHP = parseFloat(rawHP);
            setPurchasedHashpowerGh(parseFloat(String(data.mining_details.purchasedHashpower ?? 0)));
            setFetchedHashPower(parsedHP);
            setLocalHashPower(parsedHP);
            prevHashPowerRef.current = hashPower || parsedHP;
          }
        } catch (error) {
        }
      };

      fetchMiningDetails();
    }, [user?.id, hashPower])
  );

  // paywall_viewed — fires every time the Store screen comes into focus
  useFocusEffect(
    useCallback(() => {
    }, [SubscriptionData.length])
  );

  // Listen for RevenueCat customerInfo changes — fire events only on transitions
  const prevEntitlementStateRef = React.useRef<Record<string, boolean>>({});
  useEffect(() => {
    const unsubscribe = Purchases.addCustomerInfoUpdateListener((info) => {
      const active = info.entitlements.active;
      const all = info.entitlements.all;
      Object.entries(all).forEach(([key, entitlement]) => {
        const wasActive = prevEntitlementStateRef.current[key];
        const isNowActive = !!active[key];
        // Only fire if the entitlement just became inactive (transition, not initial load)
        if (wasActive === true && !isNowActive) {
          const expDate = entitlement.expirationDate;
          const willRenew = (entitlement as any).willRenew;
          if (expDate && new Date(expDate) < new Date()) {
          } else if (willRenew === false) {
          }
        }
        prevEntitlementStateRef.current[key] = isNowActive;
      });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch backend subscription plans
        const response = await axios.get<SubscriptionResponse>(
          get_data_uri('GET_SUBSCRIPTIONS'),
          { headers: getMobileSecurityHeaders() }
        );
        const backendPlans = response.data.plans;

        // Fetch RevenueCat offerings
        let offerings: PurchasesOfferings | null = null;
        try {
          offerings = await Purchases.getOfferings();

          if (!offerings || Object.keys(offerings).length === 0) {
          }
        } catch (rcError) {
        }

        // Map backend plans with RevenueCat packages
        const mappedPlans: SubscriptionItemWithPackage[] = backendPlans.map((plan) => {
          let matchedPackage: PurchasesPackage | undefined;

          if (offerings && offerings.all) {
            // Get all available packages from all offerings
            const allPackages: PurchasesPackage[] = [];

            // Iterate through all offerings in offerings.all
            Object.values(offerings.all).forEach((offering: any) => {
              if (offering && offering.availablePackages) {
                allPackages.push(...offering.availablePackages);
              }
            });

            // PRIORITY 1: Try matching by platform-specific identifier
            const platformIdentifier = Platform.OS === 'ios' ? plan.apple_identifier : plan.google_identifier;

            if (platformIdentifier) {
              matchedPackage = allPackages.find((pkg) => {
                const match = pkg.product.identifier === platformIdentifier;
                return match;
              });

              if (matchedPackage) {
              }
            }

            // PRIORITY 2: If no platform identifier match, try the other platform's identifier as fallback
            if (!matchedPackage) {
              const fallbackIdentifier = Platform.OS === 'ios' ? plan.google_identifier : plan.apple_identifier;
              if (fallbackIdentifier) {
                matchedPackage = allPackages.find((pkg) => {
                  const match = pkg.product.identifier === fallbackIdentifier;
                  return match;
                });

                if (matchedPackage) {
                }
              }
            }

            // PRIORITY 3: Try matching by hashrate and unit in product title (legacy fallback)
            if (!matchedPackage) {
              matchedPackage = allPackages.find((pkg) => {
                const title = pkg.product.title.toLowerCase();
                const planHashrate = plan.hashrate;
                const planUnit = plan.unit.toLowerCase();


                // Match hashrate and unit in title (e.g., "1.1th")
                if (planUnit.includes('th')) {
                  const hashrateInTh = planHashrate / 1000;
                  // Matches "3.5th", "3.5 th", "3500gh", "3500 gh"
                  const thRegex = new RegExp(`\\b${hashrateInTh}\\s*th`, 'i');
                  const ghRegex = new RegExp(`\\b${planHashrate}\\s*gh`, 'i');

                  const match = thRegex.test(title) || ghRegex.test(title);
                  if (match) console.log(`[Store] ✅ TH/GH regex match for ${planHashrate}GH / ${hashrateInTh}TH: ${title}`);
                  return match;
                } else if (planUnit.includes('gh')) {
                  // Matches "100gh", "100 gh"
                  const regex = new RegExp(`\\b${planHashrate}\\s*gh`, 'i');
                  const match = regex.test(title);
                  if (match) console.log(`[Store] ✅ GH regex match for ${planHashrate}: ${title}`);
                  return match;
                }
                return false;
              });
            }

            // PRIORITY 4: Try matching by plan name keywords
            if (!matchedPackage) {
              matchedPackage = allPackages.find((pkg) => {
                const title = pkg.product.title.toLowerCase();
                const planName = plan.name.toLowerCase();

                // Check for specific keywords
                const nameMatch = (
                  (planName.includes('starter') && title.includes('starter')) ||
                  (planName.includes('pro') && title.includes('pro')) ||
                  (planName.includes('ultimate') && title.includes('ultimate')) ||
                  (planName.includes('advanced') && title.includes('advanced')) ||
                  (planName.includes('mini') && title.includes('mini')) ||
                  title.includes(planName)
                );

                if (nameMatch) console.log(`[Store] ✅ Name match for ${planName}: ${title}`);
                return nameMatch;
              });
            }

            // PRIORITY 5: Try matching by price (within tolerance)
            if (!matchedPackage) {
              const planTotalPrice = plan.plan_cost;
              matchedPackage = allPackages.find((pkg) => {
                const packagePrice = pkg.product.price;
                const priceDifference = Math.abs(packagePrice - planTotalPrice);
                const priceMatch = priceDifference < 5.0; // Allow $5 difference
                return priceMatch;
              });
            }

            // PRIORITY 6: Fallback removed (Safe Mode)
            // if (!matchedPackage && allPackages.length > 0) {
            //   console.log('No matches found. Skipping dangerous fallback to first available package.');
            // }

            if (matchedPackage) {
            } else {
            }
          } else {
          }

          return {
            ...plan,
            revenueCatPackage: matchedPackage,
          };
        });

        // Exclude 80 Gh/s plan from Store (do not show in plan list)
        const filteredPlans = mappedPlans.filter((plan) => {
          const is80Gh = plan.hashrate === 80 && (plan.unit || '').toLowerCase().includes('gh');
          return !is80Gh;
        });

        setSubscriptionData(filteredPlans);

        // Cache backend plan fields only -- never revenueCatPackage (see the
        // comment at the top of the component for why).
        if (user?.id) {
          saveObjectToStorage(getStoreCacheKey(user.id), {
            version: STORE_CACHE_VERSION,
            plans: filteredPlans.map(({ revenueCatPackage, ...plan }) => plan),
          });
        }
      } catch (err) {
        setError('Failed to load store data');
      } finally {

        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (!hasStoreCache && loading) {
    // Debug: print all plan._id values for comparison
    return (
      <View style={styles.loadingContainer}>
        <BitPlayLoader size="lg" label="Loading store..." color="#3B82F6" />
      </View>
    );
  }

  // Use localHashPower (base hashpower) for display, fallback to fetchedHashPower or hashPower
  const rawCurrentPower = localHashPower > 0 ? localHashPower : (fetchedHashPower !== null ? fetchedHashPower : hashPower);
  const currentPower = capFreeUserTotalMiningPowerGh(rawCurrentPower, purchasedHashpowerGh, privilegeMultiplier > 1);
  const selectedPlan = SubscriptionData[selectedPlanIndex];
  // const currentPower = hashPower; // Current mining power from useHashPower hook
  const selectedHashrate = selectedPlan ? selectedPlan.hashrate : 0;

  // Get dynamic plan details based on selected plan
  const planDetails = selectedPlan ? getPlanDetails(selectedPlan.hashrate, selectedPlan.unit) : null;
  const gainText = selectedPlan
    ? formatGain(
        currentPower,
        (selectedPlan.unit.includes('TH') || selectedPlan.unit.includes('Th'))
          ? currentPower / 1000 + selectedPlan.hashrate
          : currentPower + selectedPlan.hashrate,
        selectedPlan.unit,
      )
    : '0.0 - 0.0 GH/s';

  const handlePurchase = async () => {
    if (!selectedPlan) {
      Alert.alert('Error', 'Please select a plan');
      return;
    }
    // Restrict duplicate purchase
    if (userPackages.includes(selectedPlan._id)) {
      Alert.alert(
        'Already Purchased',
        'You have already purchased this package. You can only upgrade or downgrade your plan.',
      );
      return;
    }
    if (!selectedPlan.revenueCatPackage) {
      Alert.alert(
        'Package Not Available',
        'This subscription package is not available for in-app purchase. Please try again later.',
      );
      return;
    }

    if (purchasing) {
      return;
    }
    trackCheckoutStarted(selectedPlan.name, selectedPlan.plan_cost, 'USD');
    trackMmpCheckoutStarted(selectedPlan.name, selectedPlan.plan_cost, 'USD');
    try {
      setPurchasing(true);


      // Purchases are made under an anonymous RevenueCat id. Tag it with our user
      // id so the server-side RevenueCat webhook can attribute the purchase even
      // if the sync call below never arrives.
      try {
        if (user?.id) await Purchases.setAttributes({ bitplay_user_id: String(user.id) });
      } catch {}

      // Purchase the package through RevenueCat
      const { customerInfo, productIdentifier } = await Purchases.purchasePackage(
        selectedPlan.revenueCatPackage
      );


      // For consumable products, check if the purchase was successful
      // For consumables, we check the purchase transactions rather than entitlements
      const latestTransaction = customerInfo.latestExpirationDate ||
        customerInfo.nonSubscriptionTransactions.length > 0;

      const hasActiveEntitlements = Object.keys(customerInfo.entitlements.active).length > 0;
      const hasNonSubscriptionPurchases = customerInfo.nonSubscriptionTransactions.length > 0;

      // Since these might be consumable products, check for successful purchase
      const purchaseSuccessful = hasActiveEntitlements || hasNonSubscriptionPurchases || latestTransaction;

      if (purchaseSuccessful) {
        // Fire trial_started if this product has a free trial period
        const introPrice = (selectedPlan.revenueCatPackage?.product as any)?.introPrice;
        if (introPrice && introPrice.price === 0) {
        }
        // Purchase successful - now sync with backend
        try {
          const payload = {
            plan_id: selectedPlan._id,
            product_identifier: productIdentifier,
            revenuecat_customer_id: customerInfo?.originalAppUserId || 'dummy',
            price_paid: selectedPlan.revenueCatPackage.product.price,
            currency: selectedPlan.revenueCatPackage.product.currencyCode,
            purchase_date: new Date().toISOString(),
            platform: Platform.OS,
          };


          await postPurchaseWithRetry(`${get_data_uri('SYNC_PURCHASE')}/${user?.id}`, payload, {
            'Content-Type': 'application/json',
            ...getMobileSecurityHeaders(),
          });


          // Update local state to show plan as purchased immediately
          setUserPackages(prev => [...prev, selectedPlan._id]);

          // Immediately update mining power locally for instant UI update
          // Convert plan hashrate to Gh/s if needed
          let addedHashPower = selectedPlan.hashrate;
          if (selectedPlan.unit.toLowerCase().includes('th')) {
            // Convert Th/s to Gh/s (1 Th/s = 1000 Gh/s)
            addedHashPower = selectedPlan.hashrate * 1000;
          }

          // FIX: Don't set localHashPower manually here because addHashPower triggers 
          // the effect at line 144 which updates localHashPower automatically.
          // Doing both causes double-counting until next refresh.
          // setLocalHashPower(prev => prev + addedHashPower);

          // Update hashPower store so HomeScreen also reflects the change instantly
          addHashPower(addedHashPower);

          // Fetch updated mining details to ensure accuracy
          try {
            const local_time = formatMiningLocalTimeForApi(new Date());
            const miningDetailsResponse = await fetch(
              `${get_data_uri("USERMININGDETAILS")}/${user?.id}?local_time=${encodeURIComponent(local_time)}`
            );
            const miningDetailsData = await miningDetailsResponse.json();

            if (miningDetailsData.success && miningDetailsData.mining_details) {
              const updatedRawHP = miningDetailsData.mining_details.hashpower ?? 0;
              const updatedParsedHP = parseFloat(updatedRawHP);
              setPurchasedHashpowerGh(parseFloat(String(miningDetailsData.mining_details.purchasedHashpower ?? 0)));
              setFetchedHashPower(updatedParsedHP);
              setLocalHashPower(updatedParsedHP);
            }
          } catch (fetchError) {
            // Continue even if fetch fails, we've already updated locally
          }

          trackPurchase(
            selectedPlan.name,
            productIdentifier,
            selectedPlan.revenueCatPackage?.product.price ?? 0,
            selectedPlan.revenueCatPackage?.product.currencyCode ?? 'USD',
          );
          trackMmpPurchase(
            selectedPlan.name,
            productIdentifier,
            selectedPlan.revenueCatPackage?.product.price ?? 0,
            selectedPlan.revenueCatPackage?.product.currencyCode ?? 'USD',
          );

          Alert.alert(
            'Purchase Successful',
            `Your ${selectedPlan.name} (${selectedPlan.hashrate} ${selectedPlan.unit}) has been activated successfully!`,
            [
              {
                text: 'OK',
                onPress: () => {
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Main' }],
                  });
                },
              },
            ]
          );
        } catch (backendError: any) {
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

  const handleRestorePurchases = async () => {
    try {
      const customerInfo = await Purchases.restorePurchases();
      const entitlementCount = Object.keys(customerInfo.entitlements.active).length;
      Alert.alert('Restore Complete', entitlementCount > 0
        ? `${entitlementCount} purchase(s) restored successfully.`
        : 'No previous purchases found.');
    } catch (error: any) {
      Alert.alert('Restore Failed', 'Unable to restore purchases. Please try again.');
    }
  };

  const formatPrice = (price: number, currencyCode: string = 'USD') => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
      }).format(price);
    } catch (e) {
      return `${currencyCode} ${price.toFixed(2)}`;
    }
  };

  // Get the mining pack image based on selected plan index (optional size for compact layout)
  const getMiningPackImage = (planIndex: number, size: number = 200) => {
    const miningPacks = [
      MiningPack01,
      MiningPack02,
      MiningPack03,
      MiningPack04,
      MiningPack05,
      MiningPack06,
      MiningPack07,
    ];
    const index = Math.max(0, Math.min(planIndex, miningPacks.length - 1));
    const SelectedPack = miningPacks[index];
    return <SelectedPack width={size} height={size} />;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header: logo + BitPlayPro Store */}
      <View style={styles.topBar}>
        <View style={styles.headerLogoWrap}>
          <Image source={AppLogo} style={styles.headerLogoImage} resizeMode="contain" />
        </View>
        <Text style={styles.topBarTitle}>BitPlayPro Store</Text>
      </View>

      {/* Top banner ad — same placement as GameZoneScreen: directly below the
          header and outside the ScrollView, so it renders reliably and never
          scrolls away. */}
      {BANNER_ADS_ENABLED && (
        <View style={styles.bannerTop}>
          <BannerAdSlot unitId={bannerUnitId} size={BannerAdSize.ADAPTIVE_BANNER} />
        </View>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer}>
        {/* Mining power first */}
        <View style={styles.miningPowerCard}>
          <View style={styles.miningPowerHeader}>
            <Text style={styles.miningPowerLabel}>All mining power</Text>
            <Icon name="construct" size={20} color="#64748B" style={styles.constructIcon} />
          </View>
          <View style={styles.miningPowerContent}>
            <View style={styles.miningPowerStats}>
              <Text style={styles.currentPower}>{currentPower.toFixed(1)} <Text style={styles.unit}>Gh/s</Text></Text>
              <Text style={styles.additionalPower}>+{selectedHashrate} <Text style={styles.unit}>Gh/s</Text></Text>
            </View>
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => navigation.navigate('MyMiner')}
            >
              <Text style={styles.viewButtonText}>View</Text>
              <Icon name="chevron-forward" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Plan: mining pack card — title, centered image, label (original layout) */}
        <View style={styles.firstFold}>
          {selectedPlan && (
            <View style={styles.minerBotCard}>
              <Text style={styles.minerBotTitle}>{selectedPlan.name}</Text>
              <View style={styles.minerImageContainer}>
                <View style={styles.minerPlaceholder}>
                  {getMiningPackImage(selectedPlanIndex)}
                  <View style={styles.minerLabel}>
                    <Icon name="cube-outline" size={12} color="#22D4EE" />
                    <Text style={styles.minerLabelText}>{selectedPlan.name}</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          <Text style={styles.sectionTitle}>Choose computing power</Text>
          <ScrollView
            ref={scrollViewRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hashrateScrollContainer}
            style={styles.hashrateScroll}
          >
            {SubscriptionData.map((plan, index) => (
              <TouchableOpacity
                key={plan._id}
                style={[
                  styles.hashrateOption,
                  selectedPlanIndex === index && styles.hashrateOptionSelected,
                  userPackages.includes(plan._id) && { opacity: 0.5, backgroundColor: '#64748B' },
                ]}
                onPress={() => {
                  if (!userPackages.includes(plan._id)) {
                    setSelectedPlanIndex(index);
                  }
                }}
                disabled={userPackages.includes(plan._id)}
              >
                <Text
                  style={[
                    styles.hashrateText,
                    selectedPlanIndex === index && styles.hashrateTextSelected,
                    userPackages.includes(plan._id) && { color: '#CBD5E1' },
                  ]}
                >
                  {userPackages.includes(plan._id)
                    ? 'Purchased'
                    : `${plan.hashrate} ${plan.unit}`}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Plan Details Section */}
        {selectedPlan && planDetails && (
          <View style={styles.planDetailsContainer}>


            {/* Offer */}
            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <View style={styles.bulletPoint} />
                <Text style={styles.detailLabel}>Offer</Text>
              </View>
              <Text style={styles.detailValue}>{planDetails.offer}</Text>
            </View>

            {/* Free Computing Power */}
            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <View style={styles.bulletPoint} />
                <Text style={styles.detailLabel}>Free computing power</Text>
              </View>
              <Text style={styles.detailValue}>{planDetails.freeComputingPower}</Text>
            </View>

            {/* Gain */}
            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <View style={styles.bulletPoint} />
                <Text style={styles.detailLabel}>Gain</Text>
              </View>
              <Text style={[styles.detailValue, styles.gainValue]}>
                {gainText}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <View style={styles.bulletPoint} />
                <Text style={styles.detailLabel}>Price</Text>
              </View>
              {/* No struck-through "original price": it was price x 1.37, a
                  price the plan was never sold at. Only the real price shows. */}
              <View style={styles.priceRow}>
                <Text style={styles.detailValue}>
                  {selectedPlan?.revenueCatPackage?.product?.priceString || formatPrice(selectedPlan.plan_cost, 'USD')}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Empty space before bottom panel */}
        <View style={styles.spacer} />
      </ScrollView>

      {/* Bottom Purchase Panel */}
      {selectedPlan && (
        <View style={[styles.bottomPanel, userPackages.includes(selectedPlan._id) && { opacity: 0.5, backgroundColor: '#CBD5E1' }]}>
          <View style={styles.priceContainer}>
            <Text style={[styles.priceLabel, userPackages.includes(selectedPlan._id) && { color: '#CBD5E1' }]}>
              {selectedPlan.hashrate} {selectedPlan.unit}
            </Text>
            <View style={styles.saveBadge}>
              <Text style={styles.saveBadgeText}>
                Save {((selectedPlan.maintenance_cost / selectedPlan.plan_cost) * 100).toFixed(2)}%
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.mintButton, (purchasing || userPackages.includes(selectedPlan._id)) && styles.mintButtonDisabled]}
            onPress={handlePurchase}
            activeOpacity={0.9}
            disabled={purchasing || userPackages.includes(selectedPlan._id)}
          >
            <LinearGradient
              colors={['#22D3EE', '#C084FC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.mintGradient}
            >
              {purchasing ? (
                <View style={styles.purchasingContainer}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.mintPrice}>Processing...</Text>
                </View>
              ) : (
                <>
                  {selectedPlan.revenueCatPackage ? (
                    <>
                      <Text style={styles.mintPrice}>
                        Subscribe for {selectedPlan.revenueCatPackage.product.priceString} / {selectedPlan.duration} {selectedPlan.duration > 1 ? 'months' : 'month'}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.mintPrice}>Mint {formatPrice(selectedPlan.plan_cost, 'USD')}</Text>
                    </>
                  )}
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom banner ad — a plain flex sibling (not absolutely pinned) so
          it stacks *below* the conditional purchase panel above rather than
          covering the Mint button when a plan is selected. */}
      {BANNER_ADS_ENABLED && (
        <View style={styles.bottomBannerWrap}>
          <BannerAdSlot unitId={bannerUnitId} size={BannerAdSize.ADAPTIVE_BANNER} />
        </View>
      )}
    </View>
  );
};

export default StoreScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: Platform.OS === 'ios' ? 50 : 45,
  },
  headerLogoWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(34, 211, 238, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLogoImage: {
    width: 24,
    height: 24,
  },
  topBarTitle: {
    marginLeft: 10,
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  firstFold: {
    marginTop: 14,
    marginBottom: 14,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#E2E8F0',
    fontSize: 14,
  },
  miningPowerCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    marginBottom: 0,
  },
  miningPowerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  miningPowerLabel: {
    color: '#94A3B8',
    fontSize: 14,
  },
  constructIcon: {
    opacity: 0.5,
  },
  miningPowerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
  },
  miningPowerStats: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flex: 1,
    minWidth: '50%',
  },
  currentPower: {
    color: '#fff',
    fontSize: normalize(20),
    fontWeight: '700',
    marginRight: 12,
  },
  additionalPower: {
    color: '#fff',
    fontSize: normalize(14),
    fontWeight: '600',
  },
  unit: {
    color: '#94A3B8',
    fontSize: normalize(12),
    fontWeight: '400',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#334155',
    paddingHorizontal: normalize(16),
    paddingVertical: normalize(8),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#475569',
    minWidth: normalize(80),
  },
  viewButtonText: {
    color: '#fff',
    fontSize: normalize(13),
    fontWeight: '600',
    marginRight: 4,
  },
  minerBotCard: {
    backgroundColor: '#CBD5E1',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  minerBotTitle: {
    color: '#1E293B',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 0,
  },
  minerImageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
    maxHeight: 200,
    paddingVertical: 8,
  },
  minerPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  minerLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: -20,
  },
  minerLabelText: {
    color: '#22D4EE',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  hashrateScroll: {
    marginBottom: 16,
  },
  hashrateScrollContainer: {
    paddingRight: 16,
  },
  hashrateOption: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  hashrateOptionSelected: {
    backgroundColor: '#22D3EE',
    borderColor: '#3B82F6',
  },
  hashrateText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600',
  },
  hashrateTextSelected: {
    color: '#fff',
  },
  planDetailsContainer: {
    marginBottom: 24,
    marginTop: 0,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 0,
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bulletPoint: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3B82F6',
    marginRight: 12,
  },
  detailLabel: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '400',
  },
  detailValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  gainValue: {
    color: '#22D3EE',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  originalPriceStrike: {
    color: '#94A3B8',
    fontSize: 14,
    textDecorationLine: 'line-through',
    fontWeight: '400',
  },
  bottomPanel: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 16 : 12,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  priceLabel: {
    color: '#1F2937',
    fontSize: 20,
    fontWeight: '700',
    marginRight: 10,
  },
  saveBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  saveBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  mintButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  mintGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
  },
  originalPrice: {
    paddingTop: 6,
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    textDecorationLine: 'line-through',
    marginRight: 8,
    fontWeight: '500',
  },
  mintPrice: {
    paddingVertical: 6,
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  mintButtonDisabled: {
    opacity: 0.6,
  },
  purchasingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  spacer: {
    height: 100,
  },
  bannerTop: {
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(11,17,29,0.4)',
  },
  bottomBannerWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(5,9,20,0.92)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
});
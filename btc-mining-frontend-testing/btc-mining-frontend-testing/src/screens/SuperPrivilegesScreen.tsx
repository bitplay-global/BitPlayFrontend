import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Linking,
  Dimensions,
  LayoutChangeEvent,
} from 'react-native';
// react-native's own SafeAreaView is a no-op on Android (iOS only) — always use
// react-native-safe-area-context here, same as HomeScreen/GameZoneScreen do.
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import Purchases, { PurchasesStoreProduct, PURCHASE_TYPE } from 'react-native-purchases';
import { BannerAdSize } from 'react-native-google-mobile-ads';
import axios from 'axios';
import { RootStackParamList } from '../components/types';
import { useAuth } from '../auth/AuthProvider';
import { useAdConfig } from '../providers/AdConfigProvider';
import { BannerAdWithGamFallback } from '../components/ads/BannerAdWithGamFallback';
import { DEFAULT_ADMOB_BANNER_ID } from '../services/adUnitDefaults';
import { get_data_uri, getMobileSecurityHeaders } from '../config/api';
import {
  PRIVILEGE_TIERS, PRIVILEGE_PRODUCT_IDS, getTierByProductId,
  PRIVILEGE_ADS_PER_DAY, dailyGhForTier, formatHashrate,
} from '../config/superPrivileges';
import { getObjectFromStorage, saveObjectToStorage } from '../config/storage';
import { useRewardedVideoAd } from '../services/googleAds';
import { useHashPower } from '../stores/HashPowerStore';
import { formatMiningLocalTimeForApi } from '../utils/miningTime';

type NavigationProp = StackNavigationProp<RootStackParamList>;

// Match the app's primary CTA gradient (same as Store.tsx's Mint button).
const PRIMARY_GRADIENT: [string, string] = ['#22D3EE', '#C084FC'];

const SuperPrivilegesScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const { ads } = useAdConfig();
  const { addHashPower, isMiningActive: storeMiningActive } = useHashPower();

  const [products, setProducts] = useState<PurchasesStoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [activeTiers, setActiveTiers] = useState<Record<string, string>>({}); // tier -> expires_at
  const [effectiveMultiplier, setEffectiveMultiplier] = useState(1);
  const [selectedTierKey, setSelectedTierKey] = useState<string>(PRIVILEGE_TIERS[0].tier);

  // Same banner-ad fallback pattern as HomeScreen: on total failure, show the
  // static fallback image for 60s before retrying the real ad.
  const [bannerAdError, setBannerAdError] = useState(false);
  useEffect(() => {
    if (!bannerAdError) return;
    const timer = setTimeout(() => setBannerAdError(false), 60000);
    return () => clearTimeout(timer);
  }, [bannerAdError]);

  // The ad is pinned with position:'absolute' below (see bannerContainer),
  // so it no longer claims flex space and can't squeeze the ScrollView.
  // But an absolutely-positioned sibling also no longer pushes the
  // ScrollView's own content out of the way, so the last item inside the
  // ScrollView (the Claim button) would sit *underneath* the ad instead --
  // this measures the ad's real rendered height and adds it to the
  // ScrollView's bottom padding so nothing ever ends up hidden behind it.
  const [bannerHeight, setBannerHeight] = useState(60);
  const onBannerLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && h !== bannerHeight) setBannerHeight(h);
  }, [bannerHeight]);

  // --- Super Privileges "Watch Ads" allowance ---------------------------
  // This is the privilege holder's OWN 50-video daily allowance, counted
  // separately from HomeScreen's 60/day Super Ad Miner track. Watching here
  // no longer consumes Home's allowance and vice versa.
  //
  // NOTE ON PERSISTENCE: the backend has no field for this counter yet, so it
  // is stored on-device (MMKV), keyed by user + local calendar day. That means
  // it resets if the app is reinstalled or storage is cleared. The Gh/s credit
  // itself still goes through the server, so only the daily cap is local. Once
  // a backend counter exists this should read from it instead.
  const [adsWatched, setAdsWatched] = useState<number | null>(null);
  const [adCrediting, setAdCrediting] = useState(false);
  const [miningActive, setMiningActive] = useState<boolean | null>(storeMiningActive);
  const adEarnedRef = useRef(false);

  const adsRemaining =
    adsWatched == null ? null : Math.max(0, PRIVILEGE_ADS_PER_DAY - adsWatched);

  /** Storage key scoped to user + local day, so it self-resets at midnight. */
  const privilegeAdsKey = useCallback(() => {
    const d = new Date();
    const localDay = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    return `privilege_ads_${user?.id ?? 'anon'}_${localDay}`;
  }, [user?.id]);

  /** Pulls the authoritative daily counter + mining state. */
  const fetchMiningDetails = useCallback(async () => {
    if (!user?.id) return;
    try {
      // `local_time` is REQUIRED by this endpoint -- without it the server
      // returns {success:false, error:...} and no `mining_details` at all,
      // which would leave the daily counter stuck on "Checking...". Same
      // URL shape HomeScreen and AchievementsScreen use.
      const url = `${get_data_uri('USERMININGDETAILS')}/${user.id}?local_time=${encodeURIComponent(
        formatMiningLocalTimeForApi(new Date()),
      )}`;
      const res = await fetch(url);
      const data = await res.json();
      const details = data?.mining_details;
      if (details != null) {
        setMiningActive(!!details.mining_isactive);
      }
    } catch {
      // Mining state stays as-is; the local allowance below is unaffected.
    }
  }, [user?.id]);

  /** Loads today's privilege-ad tally from device storage. */
  const loadPrivilegeAds = useCallback(() => {
    const stored = getObjectFromStorage(privilegeAdsKey());
    setAdsWatched(typeof stored?.count === 'number' ? stored.count : 0);
  }, [privilegeAdsKey]);

  useFocusEffect(
    useCallback(() => {
      setMiningActive(storeMiningActive);
      fetchMiningDetails();
      loadPrivilegeAds();
    }, [fetchMiningDetails, loadPrivilegeAds, storeMiningActive]),
  );

  const selectedTierConfig = PRIVILEGE_TIERS.find(t => t.tier === selectedTierKey) ?? PRIVILEGE_TIERS[0];
  const selectedProduct = products.find(p => p.identifier === selectedTierConfig.productId);
  const selectedIsActive = !!activeTiers[selectedTierConfig.tier];

  /**
   * Gh/s credited per video watched from THIS screen's "Watch Ads" button.
   *
   * A flat per-tier amount (10 for +5000%, 20 for +10000%), NOT
   * BASE_HASHPOWER_PER_AD * multiplier. The plans are sold as a daily total --
   * ghPerAd x PRIVILEGE_ADS_PER_DAY, i.e. 500 and 1000 Gh/s/day -- and the old
   * 5.5-times-multiplier arithmetic produced 275/550 instead.
   *
   * The backend stores the increment it is sent verbatim (it does not apply the
   * multiplier itself), so this is exactly what gets POSTed.
   *
   * Scoped to this button only; HomeScreen's Super Ad Miner card is untouched.
   */
  const adRewardGh = selectedTierConfig.ghPerAd;
  /** Headline figure: what the plan is worth per day if fully watched.
   *  Promoted to Th/s once it reaches a whole terahash, so the +10000% plan
   *  reads as "1 Th/s / day" rather than "1000 Gh/s / day". */
  const selectedDaily = formatHashrate(dailyGhForTier(selectedTierConfig));

  const fetchProducts = useCallback(async () => {
    console.log('[SuperPrivileges] Requesting product IDs:', PRIVILEGE_PRODUCT_IDS);
    try {
      // Must pass INAPP explicitly — these are one-time (Consumable) products, not
      // subscriptions. Without this, the SDK defaulted to querying them as "subs",
      // which is a different Play Billing catalog and always returned
      // PRODUCT_NOT_FOUND regardless of how correctly the products were configured.
      const storeProducts = await Purchases.getProducts(PRIVILEGE_PRODUCT_IDS, PURCHASE_TYPE.INAPP);
      console.log(
        '[SuperPrivileges] getProducts() returned',
        storeProducts.length,
        'product(s):',
        storeProducts.map(p => p.identifier),
      );
      setProducts(storeProducts);
    } catch (err) {
      console.warn('[SuperPrivileges] Failed to fetch products:', err);
    }
  }, []);

  const fetchActivePrivileges = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await axios.get(`${get_data_uri('PRIVILEGES')}/${user.id}`, {
        headers: getMobileSecurityHeaders(),
      });
      if (res.data?.success) {
        setEffectiveMultiplier(res.data.effective_multiplier ?? 1);
        const map: Record<string, string> = {};
        (res.data.privileges ?? []).forEach((p: any) => {
          map[p.tier] = p.expires_at;
        });
        setActiveTiers(map);
      }
    } catch (err) {
      console.warn('[SuperPrivileges] Failed to fetch active privileges:', err);
    }
  }, [user?.id]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchProducts(), fetchActivePrivileges()]);
      setLoading(false);
    };
    init();
  }, [fetchProducts, fetchActivePrivileges]);

  // Fires only on EARNED_REWARD (a full watch) -- never on a skipped ad.
  const onAdReward = useCallback(async () => {
    adEarnedRef.current = true;
    if (!user?.id || adsWatched == null) return;
    if (adsWatched >= PRIVILEGE_ADS_PER_DAY) return;

    const newCount = adsWatched + 1;
    setAdsWatched(newCount);
    saveObjectToStorage(privilegeAdsKey(), { count: newCount });
    setAdCrediting(true);

    // Credit the tier-boosted amount (see adRewardGh above). The backend
    // stores the increment verbatim rather than applying the multiplier
    // itself, so the boost has to be baked in here.
    addHashPower(adRewardGh);

    try {
      // `rewarded_ads_watched` is an ABSOLUTE count in this payload while
      // `hashpower` is an INCREMENT -- matching HomeScreen's syncUserData.
      //
      // Deliberately minimal: HomeScreen's full payload also carries
      // mining_isactive/start_time/stop_time because it owns the mining
      // session lifecycle. This screen only credits a reward, so it sends
      // the same reduced shape the game screens use -- sending session
      // fields from here could reset an in-progress mining session.
      const res = await fetch(get_data_uri('USERMININGDETAILS'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          hashpower: adRewardGh,
          // Deliberately NOT sending rewarded_ads_watched: that is HomeScreen's
          // shared 60/day Super Ad Miner counter, and this 50/day privilege
          // allowance is independent. Sending it here would consume Home's
          // allowance too. `privilege_ads_watched` is sent so the backend can
          // adopt this counter later; it is ignored until then.
          privilege_ads_watched: newCount,
          offset: new Date().getTimezoneOffset(),
        }),
      });
      await res.json().catch(() => null);
    } catch {
      // Local credit above already stands; the backend record is best-effort,
      // and the next focus refresh will reconcile the counter.
    }
    setAdCrediting(false);
  }, [user?.id, adsWatched, addHashPower, adRewardGh, privilegeAdsKey]);

  const onAdClosed = useCallback(() => {
    if (adEarnedRef.current) {
      adEarnedRef.current = false;
    } else {
      Alert.alert('Ad not completed', 'Please watch the full video to earn your reward.');
    }
  }, []);

  const {
    show: showRewardAd, loading: adLoading, loaded: adLoaded,
  } = useRewardedVideoAd(onAdReward, { primaryUnitId: ads.rewardedVideoId }, onAdClosed);

  const handleWatchAds = () => {
    if (miningActive === false) {
      Alert.alert('Mining Not Activated', 'Please activate mining on the home screen before watching ads.');
      return;
    }
    if (adsRemaining != null && adsRemaining <= 0) {
      Alert.alert(
        'Daily limit reached',
        `You've watched all ${PRIVILEGE_ADS_PER_DAY} videos for today. Come back tomorrow.`,
      );
      return;
    }
    if (!adLoaded) {
      Alert.alert('Almost ready', 'The video is still loading. Try again in a second.');
      return;
    }
    showRewardAd();
  };

  const handleClaim = async () => {
    if (!user?.id || !selectedProduct || selectedIsActive) return;
    setPurchasing(true);
    try {
      const { customerInfo, productIdentifier } = await Purchases.purchaseStoreProduct(selectedProduct);

      const hasNonSubscriptionPurchase = customerInfo.nonSubscriptionTransactions.length > 0;
      const hasActiveEntitlements = Object.keys(customerInfo.entitlements.active).length > 0;
      const purchaseSuccessful = hasNonSubscriptionPurchase || hasActiveEntitlements;

      if (!purchaseSuccessful) {
        Alert.alert('Purchase Not Completed', 'Please try again.');
        return;
      }

      const tierConfig = getTierByProductId(productIdentifier);
      const payload = {
        tier: tierConfig?.tier ?? selectedTierConfig.tier,
        product_identifier: productIdentifier,
        revenuecat_customer_id: customerInfo?.originalAppUserId || 'dummy',
        price_paid: selectedProduct.price,
        currency: selectedProduct.currencyCode,
        purchase_date: new Date().toISOString(),
      };

      const res = await axios.post(`${get_data_uri('PRIVILEGES')}/${user.id}`, payload, {
        headers: {
          'Content-Type': 'application/json',
          ...getMobileSecurityHeaders(),
        },
      });

      if (res.data?.success) {
        const newMultiplier = res.data.effective_multiplier ?? effectiveMultiplier;
        setEffectiveMultiplier(newMultiplier);
        await fetchActivePrivileges();
        Alert.alert('Privilege Activated', `Your Super Ad Miner is now boosted by ${newMultiplier}x.`);
      }
    } catch (err: any) {
      if (err?.userCancelled) return;
      console.error('[SuperPrivileges] Purchase failed:', err);
      Alert.alert('Purchase Failed', err?.message || 'Something went wrong. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  // No `edges` override -- pad all 4 sides, same fix as GameZoneScreen/
  // HomeScreen. Excluding 'bottom' here left the banner ad sitting flush
  // against (and rendered behind) the device's system nav/gesture bar.
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Super Privileges Store</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#22D3EE" />
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + bannerHeight }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Summary card — reflects whichever tier is currently selected below */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryLeft}>
                <View style={styles.summaryHeadlineRow}>
                  <Text style={styles.summaryHeadlineValue}>
                    {selectedDaily.value}
                    <Text style={styles.summaryHeadlineUnit}> {selectedDaily.unit} / day</Text>
                  </Text>
                </View>
                <View style={styles.summaryBadge}>
                  <Text style={styles.summaryBadgeText}>{selectedTierConfig.label}</Text>
                </View>
                {/* Describes how the headline is actually earned. The old
                    "=5.50Gh/s x 5000%" line no longer holds: the reward is a
                    flat per-video amount now, not base x multiplier. */}
                <Text style={styles.summaryFormula}>
                  ={selectedTierConfig.ghPerAd} Gh/s x {PRIVILEGE_ADS_PER_DAY} videos
                </Text>
              </View>
              <Image
                source={require('../assets/images/daily_reward_icon.png')}
                style={styles.summaryIcon}
                resizeMode="contain"
              />
            </View>

            {/* Tier selector chips */}
            <View style={styles.tierRow}>
              {PRIVILEGE_TIERS.map(tierConfig => {
                const isSelected = tierConfig.tier === selectedTierKey;
                const isActive = !!activeTiers[tierConfig.tier];
                const product = products.find(p => p.identifier === tierConfig.productId);
                return (
                  <TouchableOpacity
                    key={tierConfig.tier}
                    style={[styles.tierChip, isSelected && styles.tierChipSelected]}
                    activeOpacity={0.85}
                    onPress={() => setSelectedTierKey(tierConfig.tier)}
                  >
                    <Text style={[styles.tierChipLabel, isSelected && styles.tierChipLabelSelected]}>
                      {tierConfig.label}
                    </Text>
                    <Text style={[styles.tierChipSubtitle, isSelected && styles.tierChipSubtitleSelected]}>
                      1 Year
                    </Text>
                    <Text style={[styles.tierChipPrice, isSelected && styles.tierChipPriceSelected]}>
                      {isActive ? 'Active' : product ? product.priceString : '—'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.aboutCard}>
              <Text style={styles.aboutTitle}>About Super Privileges</Text>
              <Text style={styles.aboutText}>
                1. You are purchasing bonus privileges that enhance the Super Ad Miner, obtained by watching ads — not included in this purchase.
              </Text>
              <Text style={styles.aboutText}>
                2. These privileges only increase the hashrate of the Super Ad Miner.
              </Text>
              <Text style={styles.aboutText}>
                3. Each privilege is valid for one year from the date of purchase.
              </Text>
              <Text style={styles.aboutText}>
                4. Once a privilege expires, it can be purchased again. Multiple privileges can be stacked.
              </Text>
            </View>

            {/* Claim button — right after the About box, acts on whichever tier is selected above */}
            <View style={styles.claimSection}>
              {selectedIsActive ? (
                <>
                  <View style={styles.claimButtonActive}>
                    <Icon name="checkmark-circle" size={18} color="#22C55E" />
                    <Text style={styles.claimButtonActiveText}>Active</Text>
                  </View>

                  {/* Shortcut into the Super Ad Miner track. Shares Home's
                      daily 60-ad counter -- this is not extra allowance. */}
                  <TouchableOpacity
                    style={styles.watchAdsButtonWrap}
                    activeOpacity={0.9}
                    disabled={adCrediting || adsRemaining === 0}
                    onPress={handleWatchAds}
                  >
                    <LinearGradient
                      colors={PRIMARY_GRADIENT}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.btnGradient,
                        (adCrediting || adsRemaining === 0) && styles.claimButtonDisabled,
                      ]}
                    >
                      <View style={styles.btnInner}>
                        {adCrediting || (adLoading && !adLoaded) ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Icon name="play-circle" size={20} color="#FFFFFF" />
                            <Text
                              style={[styles.claimButtonText, styles.watchAdsButtonLabel]}
                              numberOfLines={1}
                            >
                              {adsRemaining === 0 ? 'Daily Limit Reached' : 'Watch Ads'}
                            </Text>
                          </>
                        )}
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>

                  <Text style={styles.watchAdsHint}>
                    {/* Shows adRewardGh (what is actually credited), not the
                        selected tier's headline figure -- with stacked plans
                        those differ, and the hint must not overstate. */}
                    {adsRemaining == null
                      ? 'Checking your daily ad balance…'
                      : `${adsRemaining} of ${PRIVILEGE_ADS_PER_DAY} videos left today · +${adRewardGh} Gh/s each`}
                  </Text>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.claimButtonWrap}
                  disabled={!selectedProduct || purchasing}
                  activeOpacity={0.9}
                  onPress={handleClaim}
                >
                  <LinearGradient
                    colors={PRIMARY_GRADIENT}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.btnGradient, !selectedProduct && styles.claimButtonDisabled]}
                  >
                    <View style={styles.btnInner}>
                      {purchasing ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.claimButtonText} numberOfLines={1}>Claim</Text>
                      )}
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>

          {/* Banner ad — same component/fallback pattern as HomeScreen.
              Pinned to the screen bottom via position:'absolute' (not a
              flex sibling) so it can never squeeze the ScrollView above it;
              its measured height instead pads the ScrollView's content
              (see onBannerLayout) so the Claim button is never hidden
              behind it. */}
          <View style={styles.bannerContainer} onLayout={onBannerLayout}>
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
                  console.warn('[SuperPrivileges] Banner ad failed to load:', error);
                }}
                onAllFailed={() => setBannerAdError(true)}
              />
            )}
          </View>
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  topBarTitle: { color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: 0.2 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Without an explicit flex:1 here, the ScrollView sized itself to its own
  // content height instead of the space actually available in the flex-
  // column SafeAreaView, which could get it squeezed/clipped from the
  // bottom -- cutting off exactly the vertically-centered "Claim" text
  // inside the last item (the button), while leaving its background
  // gradient's top sliver visible. This bounds it correctly so it scrolls
  // instead of clipping.
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 },

  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  summaryLeft: { flex: 1 },
  summaryHeadlineRow: { flexDirection: 'row', alignItems: 'baseline' },
  summaryHeadlineValue: { color: '#fff', fontSize: 26, fontWeight: '800' },
  summaryHeadlineUnit: { color: '#94A3B8', fontSize: 15, fontWeight: '600' },
  summaryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FBBF24',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 6,
  },
  summaryBadgeText: { color: '#1E293B', fontWeight: '700', fontSize: 12 },
  summaryFormula: { color: '#94A3B8', fontSize: 13, marginTop: 8 },
  summaryIcon: { width: 64, height: 64, marginLeft: 12 },

  tierRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  tierChip: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tierChipSelected: { backgroundColor: '#2563EB', borderColor: '#3B82F6' },
  tierChipLabel: { color: '#fff', fontWeight: '700', fontSize: 15 },
  tierChipLabelSelected: { color: '#fff' },
  tierChipSubtitle: { color: '#94A3B8', fontSize: 12, marginTop: 4 },
  tierChipSubtitleSelected: { color: 'rgba(255,255,255,0.8)' },
  tierChipPrice: { color: '#fff', fontWeight: '700', fontSize: 16, marginTop: 10 },
  tierChipPriceSelected: { color: '#fff' },

  aboutCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
  },
  aboutTitle: { color: '#22D3EE', fontWeight: '700', fontSize: 15, marginBottom: 10 },
  aboutText: { color: '#CBD5E1', fontSize: 13, lineHeight: 20, marginBottom: 8 },

  bannerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimSection: { marginTop: 16 },
  claimButtonWrap: { borderRadius: 12, overflow: 'hidden' },
  // Shared by both CTAs. The LinearGradient carries ONLY width/background --
  // never padding or height. react-native-linear-gradient is a native view on
  // iOS that does not reliably derive its own height from padding + children,
  // so sizing it that way rendered it shorter than its label and the wrapper's
  // overflow:'hidden' sliced the text in half (Android measures it fine, which
  // is why this only ever showed up on TestFlight). All sizing lives in the
  // plain inner View instead -- the same split ScratchAndWinScreen's ad buttons
  // already use successfully.
  btnGradient: { width: '100%' },
  btnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  claimButtonDisabled: { opacity: 0.5 },
  claimButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  claimButtonActive: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderWidth: 1,
    borderColor: '#22C55E',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimButtonActiveText: { color: '#22C55E', fontWeight: '700', fontSize: 16 },
  watchAdsButtonWrap: { borderRadius: 12, overflow: 'hidden', marginTop: 12 },
  watchAdsButtonLabel: { marginLeft: 8 },
  watchAdsHint: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 17,
  },
});

export default SuperPrivilegesScreen;

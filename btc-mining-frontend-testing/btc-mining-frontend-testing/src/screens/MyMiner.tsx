import React, { useState, useEffect } from 'react';
import { BANNER_ADS_ENABLED } from '../config/adPlacements';
import BitPlayLoader from '../components/BitPlayLoader';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../components/types';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BannerAdSize } from 'react-native-google-mobile-ads';
import { BannerAdWithGamFallback } from '../components/ads/BannerAdWithGamFallback';
import { DEFAULT_ADMOB_BANNER_ID } from '../services/adUnitDefaults';
import { useAdConfig } from '../providers/AdConfigProvider';
import { useHashPower } from '../stores/HashPowerStore';
import MinerBotSVG from '../components/MinerBotSVG';
import { get_data_uri } from '../config/api';
import { useAuth } from '../auth/AuthProvider';
import axios from 'axios';
import { formatMiningLocalTimeForApi, secondsUntilLocalMidnight } from '../utils/miningTime';
import { getObjectFromStorage, saveObjectToStorage } from '../config/storage';

type NavigationProp = StackNavigationProp<RootStackParamList, 'MyMiner'>;

const MAX_MINING_DURATION = 24 * 60 * 60 * 1000; // 24 hours in ms

interface UserSubscription {
  _id: string;
  user_id: string;
  plan_id: string;
  hashrate: number;
  unit: string;
  duration: number;
  purchase_date: string;
  status: 'active' | 'expired';
  plan_name?: string;
}

interface Purchase {
  _id: string;
  user: string;
  plan_id: {
    _id: string;
    name: string;
    hashrate: number;
    unit: string;
    duration: number;
  };
  product_identifier: string;
  price_paid: number;
  currency: string;
  purchase_date: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  existing_hashpower: number;
  updated_hashpower: number;
  mining_power_added: boolean;
  createdAt: string;
  updatedAt: string;
}

const MY_MINER_CACHE_VERSION = 1;
const getMyMinerCacheKey = (userId: string) => `my_miner_cache_${userId}`;

const MyMiner = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const { ads } = useAdConfig();
  const [activeTab, setActiveTab] = useState<'premium' | 'free'>('free');
  const { hashPower } = useHashPower();
  const [startTime, setStartTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('00:00:00');
  const [claimedHashPower, setClaimedHashPower] = useState<number>(25); // Daily claim is always 3 Gh/s from home

  // Purchased-miner/subscription display data -- same reasoning as Store.tsx:
  // display-only, staleness is cosmetic at worst. Seed from last-known
  // snapshot so the Premium tab renders immediately.
  const [cachedMyMiner] = useState(() => {
    if (!user?.id) return null;
    const raw = getObjectFromStorage(getMyMinerCacheKey(user.id));
    return raw?.version === MY_MINER_CACHE_VERSION ? raw : null;
  });
  const [hasCache] = useState(() => cachedMyMiner != null);
  const [userSubscriptions, setUserSubscriptions] = useState<UserSubscription[]>(cachedMyMiner?.userSubscriptions ?? []);
  const [userPurchases, setUserPurchases] = useState<Purchase[]>(cachedMyMiner?.userPurchases ?? []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serverTimeRemaining, setServerTimeRemaining] = useState(0);
  const [isDailyRewardClaimed, setDailyRewardClaimed] = useState(cachedMyMiner?.isDailyRewardClaimed ?? false);

  // Load mining data from AsyncStorage
  useEffect(() => {
    const loadData = async () => {
      try {
        const storedStart = await AsyncStorage.getItem("startTime");
        if (storedStart) {
          setStartTime(Number(storedStart));
        }
      } catch (error) {
      }
    };
    loadData();
  }, []);

  // Update countdown timer (using serverTimeRemaining like HomeScreen)
  useEffect(() => {
    if (!isDailyRewardClaimed) {
      // Show "Claim" when not claimed
      setTimeRemaining('Claim');
      return;
    }

    if (serverTimeRemaining <= 0) {
      setTimeRemaining('Claim');
      return;
    }

    // Start countdown from serverTimeRemaining
    let remainingSeconds = serverTimeRemaining;

    const interval = setInterval(() => {
      if (remainingSeconds <= 0) {
        setTimeRemaining('Claim');
        setDailyRewardClaimed(false);
        clearInterval(interval);
        return;
      }

      const hours = Math.floor(remainingSeconds / 3600);
      const minutes = Math.floor((remainingSeconds % 3600) / 60);
      const seconds = remainingSeconds % 60;

      setTimeRemaining(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
      remainingSeconds--;
    }, 1000);

    return () => clearInterval(interval);
  }, [serverTimeRemaining, isDailyRewardClaimed]);

  // Fetch user's mining details and subscriptions (same as HomeScreen)
  useEffect(() => {
    const fetchUserMiningData = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const local_time = formatMiningLocalTimeForApi(new Date());

        // Fetch user mining details (same API as HomeScreen)
        const userDetailsUrl = `${get_data_uri("USERMININGDETAILS")}/${user.id}?local_time=${encodeURIComponent(local_time)}`;

        const userDetailsRes = await fetch(userDetailsUrl);
        const userData = await userDetailsRes.json();


        // Set daily reward claim status and timer (from home screen logic)
        setServerTimeRemaining(secondsUntilLocalMidnight(new Date()));
        setDailyRewardClaimed(userData?.daily_reward_claimed ?? false);

        // Fetch user's hashpower from purchased subscriptions for premium tab
        let nextSubscriptions = userSubscriptions;
        try {
          const hashpowerUrl = `${get_data_uri('GET_USER_HASHPOWER')}?userId=${user.id}`;

          const response = await axios.get(hashpowerUrl);

          if (response.data.success) {
            // Set user subscriptions for premium tab
            if (response.data.subscriptions && Array.isArray(response.data.subscriptions)) {
              setUserSubscriptions(response.data.subscriptions);
              nextSubscriptions = response.data.subscriptions;
            }
          }
        } catch (subscriptionErr) {
          // Don't set error for premium tab API, only log it
        }

        // Fetch user's purchase history
        let nextPurchases = userPurchases;
        try {
          const purchasesUrl = `${get_data_uri('SYNC_PURCHASE')}/${user.id}`;

          const purchasesResponse = await axios.get(purchasesUrl);

          if (purchasesResponse.data.success && purchasesResponse.data.purchases) {
            setUserPurchases(purchasesResponse.data.purchases);
            nextPurchases = purchasesResponse.data.purchases;
          }
        } catch (purchaseErr) {
          // Don't set error, just log it
        }

        saveObjectToStorage(getMyMinerCacheKey(user.id), {
          version: MY_MINER_CACHE_VERSION,
          userSubscriptions: nextSubscriptions,
          userPurchases: nextPurchases,
          isDailyRewardClaimed: userData?.daily_reward_claimed ?? false,
        });

      } catch (err: any) {
        setError('API yet to be connected');
      } finally {
        setLoading(false);
      }
    };

    fetchUserMiningData();
  }, [user?.id]);

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>My Miner</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab('premium')}
        >
          <Text style={[styles.tabText, activeTab === 'premium' && styles.activeTabText]}>
            Premium
          </Text>
          {activeTab === 'premium' && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab('free')}
        >
          <Text style={[styles.tabText, activeTab === 'free' && styles.activeTabText]}>
            Free
          </Text>
          {activeTab === 'free' && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
        {/* Super Ad Miner tab removed as per requirement */}
        {/* <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab('superAd')}
        >
          <Text style={[styles.tabText, activeTab === 'superAd' && styles.activeTabText]}>
            Super Ad Miner
          </Text>
          {activeTab === 'superAd' && <View style={styles.tabIndicator} />}
        </TouchableOpacity> */}
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 80}}>
        {!hasCache && loading ? (
          <View style={styles.loadingContainer}>
            <BitPlayLoader size="lg" label="Loading miners..." color="#3B82F6" />
          </View>
        ) : activeTab === 'premium' ? (
          <View>
            {error ? (
              <View style={styles.errorContainer}>
                <Icon name="alert-circle-outline" size={60} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : userPurchases.length > 0 ? (
              <View>
                {/* Total Premium Mining Power */}
                <View style={styles.totalPowerCard}>
                  <Text style={styles.totalPowerLabel}>Total Premium Mining Power</Text>
                  <Text style={styles.totalPowerValue}>
                    {userPurchases.reduce((sum, purchase) => sum + purchase.plan_id.hashrate, 0)} Gh/s
                  </Text>
                  <Text style={styles.totalPurchasesLabel}>
                    {userPurchases.length} {userPurchases.length === 1 ? 'Purchase' : 'Purchases'}
                  </Text>
                </View>

                {/* Premium Miners List from Purchases */}
                {userPurchases.map((purchase) => (
                  <View key={purchase._id} style={styles.premiumMinerCard}>
                    <View style={styles.premiumMinerHeader}>
                      <Text style={styles.premiumMinerTitle}>
                        {purchase.plan_id.name}
                      </Text>
                      <View style={[
                        styles.statusBadge,
                        purchase.status === 'completed' ? styles.statusActive : 
                        purchase.status === 'pending' ? styles.statusPending :
                        styles.statusExpired
                      ]}>
                        <Text style={styles.statusText}>
                          {purchase.status.charAt(0).toUpperCase() + purchase.status.slice(1)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.premiumMinerImageArea}>
                      <MinerBotSVG size={80} />
                    </View>
                    <View style={styles.premiumMinerStats}>
                      <View style={styles.premiumStatItem}>
                        <Text style={styles.premiumStatLabel}>Hashrate Added</Text>
                        <Text style={styles.premiumStatValue}>
                          {purchase.plan_id.hashrate} {purchase.plan_id.unit}
                        </Text>
                      </View>
                      <View style={styles.premiumStatItem}>
                        <Text style={styles.premiumStatLabel}>Duration</Text>
                        <Text style={styles.premiumStatValue}>{purchase.plan_id.duration} months</Text>
                      </View>
                      <View style={styles.premiumStatItem}>
                        <Text style={styles.premiumStatLabel}>Price Paid</Text>
                        <Text style={styles.premiumStatValue}>
                          {purchase.currency} {purchase.price_paid.toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.premiumStatItem}>
                        <Text style={styles.premiumStatLabel}>Purchase Date</Text>
                        <Text style={styles.premiumStatValue}>
                          {new Date(purchase.purchase_date).toLocaleDateString()}
                        </Text>
                      </View>
                      <View style={styles.premiumStatItem}>
                        <Text style={styles.premiumStatLabel}>Hashpower Before</Text>
                        <Text style={styles.premiumStatValue}>
                          {purchase.existing_hashpower} Gh/s
                        </Text>
                      </View>
                      <View style={styles.premiumStatItem}>
                        <Text style={styles.premiumStatLabel}>Hashpower After</Text>
                        <Text style={styles.premiumStatValue}>
                          {purchase.updated_hashpower} Gh/s
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : userSubscriptions.length > 0 ? (
              <View>
                {/* Fallback to old subscriptions if purchases not available */}
                <View style={styles.totalPowerCard}>
                  <Text style={styles.totalPowerLabel}>Total Premium Mining Power</Text>
                  <Text style={styles.totalPowerValue}>
                    {userSubscriptions.reduce((sum, sub) => sum + sub.hashrate, 0)} Gh/s
                  </Text>
                </View>

                {/* Premium Miners List */}
                {userSubscriptions.map((subscription) => (
                  <View key={subscription._id} style={styles.premiumMinerCard}>
                    <View style={styles.premiumMinerHeader}>
                      <Text style={styles.premiumMinerTitle}>
                        {subscription.plan_name || `${subscription.hashrate} ${subscription.unit} Miner`}
                      </Text>
                      <View style={[
                        styles.statusBadge,
                        subscription.status === 'active' ? styles.statusActive : styles.statusExpired
                      ]}>
                        <Text style={styles.statusText}>
                          {subscription.status === 'active' ? 'Active' : 'Expired'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.premiumMinerImageArea}>
                      <MinerBotSVG size={80} />
                    </View>
                    <View style={styles.premiumMinerStats}>
                      <View style={styles.premiumStatItem}>
                        <Text style={styles.premiumStatLabel}>Hashrate</Text>
                        <Text style={styles.premiumStatValue}>
                          {subscription.hashrate} {subscription.unit}
                        </Text>
                      </View>
                      <View style={styles.premiumStatItem}>
                        <Text style={styles.premiumStatLabel}>Duration</Text>
                        <Text style={styles.premiumStatValue}>{subscription.duration} days</Text>
                      </View>
                      <View style={styles.premiumStatItem}>
                        <Text style={styles.premiumStatLabel}>Purchase Date</Text>
                        <Text style={styles.premiumStatValue}>
                          {new Date(subscription.purchase_date).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyStateContainer}>
                <View style={styles.emptyIconContainer}>
                  <Icon name="cube-outline" size={80} color="#334155" />
                </View>
                <Text style={styles.emptyText}>You don't have a miner NFT yet.</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.minerCard}>
            <Text style={styles.minerCardTitle}>Daily reward</Text>
            <View style={styles.minerImageArea}>
              <MinerBotSVG size={120} />
            </View>
            <View style={styles.minerStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{claimedHashPower} Gh/s</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{timeRemaining}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Ad Banner */}
      {BANNER_ADS_ENABLED && (
        <View style={styles.bannerContainer}>
          <BannerAdWithGamFallback
            primaryUnitId={ads.homeBannerId ?? DEFAULT_ADMOB_BANNER_ID}
            size={BannerAdSize.FULL_BANNER}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: Platform.OS === 'ios' ? 50 : 45,
  },
  topBarTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    gap: 20,
  },
  tab: {
    paddingBottom: 8,
    position: 'relative',
  },
  tabText: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#fff',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#3B82F6',
    borderRadius: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '500',
  },
  minerCard: {
    backgroundColor: '#CBD5E1',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  minerCardTitle: {
    color: '#1E293B',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  minerImageArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  minerStats: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    overflow: 'hidden',
  },
  statItem: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 12,
    color: '#94A3B8',
    fontSize: 14,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  errorText: {
    marginTop: 16,
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  errorBannerText: {
    color: '#991B1B',
    fontSize: 12,
    textAlign: 'center',
  },
  totalPowerCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  totalPowerLabel: {
    color: '#94A3B8',
    fontSize: 14,
    marginBottom: 8,
  },
  totalPowerValue: {
    color: '#22D3EE',
    fontSize: 32,
    fontWeight: '700',
  },
  totalPurchasesLabel: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
  premiumMinerCard: {
    backgroundColor: '#CBD5E1',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  premiumMinerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  premiumMinerTitle: {
    color: '#1E293B',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusActive: {
    backgroundColor: '#10B981',
  },
  statusPending: {
    backgroundColor: '#F59E0B',
  },
  statusExpired: {
    backgroundColor: '#EF4444',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  premiumMinerImageArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  premiumMinerStats: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
  },
  premiumStatItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  premiumStatLabel: {
    color: '#94A3B8',
    fontSize: 14,
  },
  premiumStatValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bannerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0F172A',
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
});

export default MyMiner;

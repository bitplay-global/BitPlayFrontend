import { StackNavigationProp } from "@react-navigation/stack";
import BitPlayLoader from '../components/BitPlayLoader';
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Modal,
  Platform,
  Alert,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { RootStackParamList } from "../components/types";
import { useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/Ionicons";
import LottieView from "lottie-react-native";
import { get_data_uri } from '../config/api';
import { useAuth } from '../auth/AuthProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useHashPower } from "../stores/HashPowerStore";
import { BannerAdWithGamFallback } from '../components/ads/BannerAdWithGamFallback';
import { BannerAdSize } from 'react-native-google-mobile-ads';
import { DEFAULT_ADMOB_BANNER_ID } from '../services/adUnitDefaults';
import { useAdConfig } from '../providers/AdConfigProvider';
import { getObjectFromStorage, saveObjectToStorage } from '../config/storage';

type NavigationProp = StackNavigationProp<
  RootStackParamList,
  "DailyRewardsScreen"
>;

interface Reward {
  _id: string;
  rewardType: string;
  amount: number;
  isRecurring: boolean;
  day?: number | null;
  claimed: boolean;
}

const API_BASE = get_data_uri("GET_REWARDS");
const REWARDS_CACHE_VERSION = 1;
const getRewardsCacheKey = (userId: string) => `daily_rewards_cache_${userId}`;

const DailyRewardsScreen = () => {
  const { user } = useAuth();
  const user_id = user?.id;

  // Display-only catalog data (reward list + claimed status) -- staleness is
  // cosmetic at worst, the actual claim is validated server-side regardless
  // of what's shown. Seed from last-known cache so the list renders
  // immediately instead of blocking behind a full-screen spinner.
  const [cachedRewards] = useState<Reward[] | null>(() => {
    if (!user_id) return null;
    const raw = getObjectFromStorage(getRewardsCacheKey(user_id));
    return raw?.version === REWARDS_CACHE_VERSION ? raw.rewards : null;
  });
  const [hasCache] = useState(() => cachedRewards != null);
  const [rewards, setRewards] = useState<Reward[]>(cachedRewards ?? []);
  const [loading, setLoading] = useState(true);
  const [showPopup, setShowPopup] = useState(false);
  const [claimedReward, setClaimedReward] = useState<Reward | null>(null);

  const navigation = useNavigation<NavigationProp>();

  const { hashPower, addHashPower } = useHashPower();

  // NOTE: previously `const ads = useAdConfig()` (the whole context value,
  // { ads, loading }) with call sites reading `ads?.homeBannerId` -- that
  // property doesn't exist at that level, so it silently always fell back
  // to DEFAULT_ADMOB_BANNER_ID instead of the real fetched ad unit id.
  // Destructuring here matches how every other screen in the codebase reads
  // it (HomeScreen, Store, MyMiner, etc.).
  const { ads } = useAdConfig();

  // Fetch rewards
  useEffect(() => {
    const fetchRewards = async () => {
      try {
        const res = await fetch(`${API_BASE}?userId=${user_id}`);
        const data = await res.json();
        if (data.success) {
          setRewards(data.rewards);
          if (user_id) {
            saveObjectToStorage(getRewardsCacheKey(user_id), {
              version: REWARDS_CACHE_VERSION,
              rewards: data.rewards,
            });
          }
        }
      } catch (err) {
      } finally {
        setLoading(false);
      }
    };

    fetchRewards();
  }, []);

  const syncUserData = async (incrementGh: number) => {
    try {
      const user_mining_data = {
        user_id: user.id,
        hashpower: incrementGh,
        mining_isactive: null,
        rewarded_ads_watched: null,
        random_ads_watched: 0,
      };

      const set_user_data_uri = get_data_uri("USERMININGDETAILS");

      const res = await fetch(set_user_data_uri, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user_mining_data),
      });

      await res.json().catch(() => null);
    } catch (err) {
    }
  };

  const CheckDailyClaimed = async () => {

    const ApiBase = get_data_uri("USERDAILYREWARD");
    const final_check_uri = `${ApiBase}/${user_id}`

    try {
      const res = await fetch(final_check_uri)

      const data = await res.json();

      const DailyRewardClaimed = data.success

      if (DailyRewardClaimed) {
        return true;
      } else {
        Alert.alert('Notice', data.message);
        return false;
      }
    } catch (err) {
    }
  }

  const handleClaim = async (rewardId: string, reward_amount: any) => {
    try {

      const CheckDailyRewardClaimed = await CheckDailyClaimed();


      if (!CheckDailyRewardClaimed) {
        return;
      }

      const res = await fetch(`${API_BASE}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user_id, rewardId }),
      });

      const data = await res.json();

      const parsed_hashpower = parseFloat(reward_amount);

      if (data.success) {
        addHashPower(parsed_hashpower);
        setRewards((prev) =>
          prev.map((r) =>
            r._id === rewardId ? { ...r, claimed: true } : r
          )
        );
        setClaimedReward(data.reward);
        setShowPopup(true);
        setTimeout(() => setShowPopup(false), 2500);
        await syncUserData(parsed_hashpower);
      } else {
        Alert.alert('Error', data.error || "Failed to claim reward");
      }
    } catch (err) {
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Banner Ad */}
      <BannerAdWithGamFallback
        primaryUnitId={ads?.homeBannerId ?? DEFAULT_ADMOB_BANNER_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
      />
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Daily Rewards</Text>
        <View style={{ width: 24 }} />
      </View>

      <StatusBar barStyle="light-content" backgroundColor="#15213B" />

      <ScrollView contentContainerStyle={styles.scrollView}>
        {!hasCache && loading && rewards.length === 0 && (
          <BitPlayLoader size="lg" label="Loading rewards..." />
        )}
        {rewards.map((reward) => (
          <View key={reward._id} style={styles.rewardCard}>
            <View style={styles.rewardInfo}>
              <Text style={styles.rewardTitle}>
                {reward.rewardType}
              </Text>
              <Text style={styles.rewardAmount}>
                + {reward.amount} GH/s
              </Text>
            </View>

            {reward.claimed ? (
              <View style={[styles.claimButton, styles.claimedButton]}>
                <Text style={styles.claimedText}>Claimed</Text>
              </View>
            ) : (
              <LinearGradient
                colors={["#4F46E5", "#9333EA"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.claimButton}
              >
                <TouchableOpacity
                  style={styles.claimTouchable}
                  onPress={() => handleClaim(reward._id, reward.amount)}
                >
                  <Text style={styles.claimText}>Claim</Text>
                </TouchableOpacity>
              </LinearGradient>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Bottom Banner Ad */}
      <BannerAdWithGamFallback
        primaryUnitId={ads?.homeBannerId ?? DEFAULT_ADMOB_BANNER_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
      />

      {/* Claim Popup with Lottie */}
      <Modal transparent visible={showPopup} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <LottieView
              source={{
                uri: "https://lottie.host/6c2ebe48-6e55-4edb-9c0b-6fd48360beae/AyZ7cmF141.json",
              }}
              autoPlay
              loop={false}
              style={{ width: 250, height: 250 }}
            />
            <Text style={styles.modalText}>
              {claimedReward
                ? `${claimedReward.rewardType} Claimed!`
                : "Reward Claimed!"}
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default DailyRewardsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#15213B",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    marginTop: Platform.OS === 'ios' ? 0 : 40
  },
  topTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },
  scrollView: {
    padding: 16,
    paddingTop: 60,
  },
  rewardCard: {
    backgroundColor: "rgba(240, 255, 255, 0.08)",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rewardInfo: {
    flex: 1,
  },
  rewardTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },
  rewardAmount: {
    color: "#34D399",
    fontSize: 14,
  },
  claimButton: {
    borderRadius: 12,
    overflow: "hidden",
    minWidth: 100,
  },
  claimTouchable: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  claimText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  claimedButton: {
    backgroundColor: "#374151",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  claimedText: {
    color: "#9CA3AF",
    fontWeight: "600",
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    backgroundColor: "#1E293B",
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
  },
  modalText: {
    marginTop: 12,
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});

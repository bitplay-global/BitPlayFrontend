import React, { useEffect, useState } from 'react';
import BitPlayLoader from '../components/BitPlayLoader';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../components/types';
import { useAuth } from '../auth/AuthProvider';
import { get_data_uri } from '../config/api';
import LottieView from 'lottie-react-native';
import { formatMiningLocalTimeForApi } from '../utils/miningTime';
import { getObjectFromStorage, saveObjectToStorage } from '../config/storage';

type NavigationProp = StackNavigationProp<RootStackParamList, 'BalanceHistoryScreen'>;

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

const BalanceHistoryScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();

  const user_id = user?.id;

  // Historical data, doesn't change once recorded -- lowest-risk screen for
  // cache-first display. Seed from last-known snapshot so the list renders
  // immediately instead of blocking behind the loader.
  const BALANCE_HISTORY_CACHE_VERSION = 1;
  const [cached] = useState(() => {
    if (!user_id) return null;
    const raw = getObjectFromStorage(`balance_history_cache_${user_id}`);
    return raw?.version === BALANCE_HISTORY_CACHE_VERSION ? raw : null;
  });
  const [hasCache] = useState(() => cached != null);
  const [history, setHistory] = useState<BalanceHistory[]>(cached?.history ?? []);
  const [loading, setLoading] = useState(true);
  const [totalHistoricalBTC, setTotalHistoricalBTC] = useState(cached?.totalHistoricalBTC ?? 0);
  const [currentSessionBtc, setCurrentSessionBtc] = useState(cached?.currentSessionBtc ?? 0);
  const [isMiningActive, setIsMiningActive] = useState(cached?.isMiningActive ?? false);

  const fetchData = async () => {
    try {
      setLoading(true);

      const local_time = formatMiningLocalTimeForApi(new Date());

      // Fetch mining details first (may trigger day-change settlement)
      const miningRes = await fetch(
        `${get_data_uri('USERMININGDETAILS')}/${user_id}?local_time=${encodeURIComponent(local_time)}`
      );
      const miningData = await miningRes.json();

      // Captured locally (not just via the state setters below) so the
      // cache-persist step further down uses this call's fresh values
      // instead of a stale pre-update closure.
      let isActiveForCache = isMiningActive;
      let currentSessionBtcForCache = currentSessionBtc;

      if (miningData.success && miningData.mining_details) {
        const details = miningData.mining_details;
        const isActive = !!details.mining_isactive;
        setIsMiningActive(isActive);
        isActiveForCache = isActive;

        // Use server-calculated BTC for current session
        const serverBtc = parseFloat(miningData.calculated_btc ?? 0);
        setCurrentSessionBtc(serverBtc);
        currentSessionBtcForCache = serverBtc;
      }

      // Then fetch balance history (includes any newly settled entries)
      const historyRes = await fetch(
        `${get_data_uri('GET_BALANCE_HISTORY')}?userId=${user_id}`
      );
      const data = await historyRes.json();

      if (historyRes.ok && data.success) {
        const historyData = data.balances || [];
        setHistory(historyData);

        let nextTotalHistoricalBTC = 0;
        if (typeof data.totalHistoricalBTC === 'number' && !Number.isNaN(data.totalHistoricalBTC)) {
          nextTotalHistoricalBTC = data.totalHistoricalBTC;
        } else {
          nextTotalHistoricalBTC = historyData.reduce((acc: number, item: BalanceHistory) => {
            const btcVal = item.balances?.BTC;
            const btcNum = typeof btcVal === 'object' && btcVal && '$numberDecimal' in btcVal
              ? parseFloat(btcVal.$numberDecimal || '0')
              : typeof btcVal === 'number' ? btcVal : 0;
            return acc + btcNum;
          }, 0);
        }
        setTotalHistoricalBTC(nextTotalHistoricalBTC);

        if (user_id) {
          saveObjectToStorage(`balance_history_cache_${user_id}`, {
            version: BALANCE_HISTORY_CACHE_VERSION,
            history: historyData,
            totalHistoricalBTC: nextTotalHistoricalBTC,
            currentSessionBtc: currentSessionBtcForCache,
            isMiningActive: isActiveForCache,
          });
        }
      }
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatBalance = (val: number | BalanceDecimal, decimals = 16) => {
    if (typeof val === 'object' && '$numberDecimal' in val) {
      return parseFloat(val.$numberDecimal || '0').toFixed(decimals);
    }
    return typeof val === 'number' ? val.toFixed(decimals) : '0.0000000000000000';
  };

  const formatDate = (dateStr: string) => {
    const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-GB', options);
  };

  const grandTotal = totalHistoricalBTC + currentSessionBtc;

  return (
    <ScrollView style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Balance History</Text>
        <View style={{ width: 24 }} />
      </View>

      {!hasCache && loading ? (
        <BitPlayLoader size="lg" label="Loading history..." color="#53D3F6" />
      ) : history.length === 0 && currentSessionBtc <= 0 ? (
        <View style={styles.noRecordsBox}>
          <LottieView
            source={{ uri: 'https://lottie.host/014c662a-e804-42de-a029-486d14645e9c/rcfStinxUX.lottie' }}
            autoPlay
            loop
            style={{ width: 200, height: 200 }}
          />
          <Text style={styles.noRecordsText}>No records yet, Keep mining!!</Text>
        </View>
      ) : (
        <>
          {/* Total Earnings Summary (history + current session) */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Earnings (All Time)</Text>
            <Text style={styles.summaryValue}>{grandTotal.toFixed(16)} BTC</Text>
            {currentSessionBtc > 0 && (
              <Text style={styles.summaryBreakdown}>
                History: {totalHistoricalBTC.toFixed(16)} + Today: {currentSessionBtc.toFixed(16)}
              </Text>
            )}
          </View>

          {/* Current Session (if mining is active) */}
          {isMiningActive && currentSessionBtc > 0 && (
            <View style={styles.currentSessionCard}>
              <View style={styles.currentSessionHeader}>
                <MCIcon name="pickaxe" size={16} color="#22D3EE" />
                <Text style={styles.currentSessionTitle}>Today (In Progress)</Text>
              </View>
              <Text style={styles.currentSessionValue}>
                {currentSessionBtc.toFixed(16)} BTC
              </Text>
              <Text style={styles.currentSessionNote}>
                Will be saved to history at midnight
              </Text>
            </View>
          )}

          {/* Past Day History Records */}
          {history.length > 0 && (
            <Text style={styles.sectionHeader}>Past Days</Text>
          )}
          {history.map((item) => {
            const { BTC } = item.balances;
            return (
              <View key={item._id} style={styles.historyRow}>
                <Text style={styles.dateText}>{formatDate(item.date)}</Text>
                <Text style={styles.value}>{formatBalance(BTC, 16)} BTC</Text>
              </View>
            );
          })}
        </>
      )}

      <TouchableOpacity
        onPress={() => navigation.goBack()}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#53D3F6', '#BD85FC', '#F472B6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111827',
    flex: 1,
    paddingHorizontal: 16,
  },
  topBar: {
    paddingVertical: Platform.OS === 'ios' ? 80 : 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Platform.OS === 'ios' ? 0 : 10,
    marginBottom: 0
  },
  topBarTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#22D3EE',
  },
  summaryLabel: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
  },
  summaryValue: {
    color: '#22D3EE',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  summaryBreakdown: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 6,
  },
  currentSessionCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#22D3EE',
  },
  currentSessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  currentSessionTitle: {
    color: '#22D3EE',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  currentSessionValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  currentSessionNote: {
    color: '#6B7280',
    fontSize: 11,
    fontStyle: 'italic',
  },
  sectionHeader: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  dateText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  value: {
    color: '#53D3F6',
    fontSize: 15,
    fontWeight: '600',
  },
  noRecordsBox: {
    alignItems: 'center',
    marginTop: 100,
  },
  noRecordsText: {
    color: '#ccc',
    fontSize: 16,
    marginTop: 8,
  },
  backButton: {
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 40,
    minHeight: 40,
    marginTop: Platform.OS === 'ios' ? 150 : 20,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default BalanceHistoryScreen;

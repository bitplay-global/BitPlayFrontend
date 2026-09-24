import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Modal,
  RefreshControl,
  Platform,
  Image,
  Pressable,
  Vibration,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import { get_data_uri, getMobileSecurityHeaders } from '../config/api';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../components/types';
import { StackNavigationProp } from '@react-navigation/stack';
import BTCWithdrawal from '../components/WithDrawal/BTC';
import Lightning from '../components/WithDrawal/Lightning';
import { WALLET_COLLECTION } from '../types/wallet';
import axios from 'axios';
import LinearGradient from 'react-native-linear-gradient';
import { getBtcUsdPriceCached } from '../services/btcPriceService';
import {
  trackWithdrawalRequested,
} from '../services/apptroveAnalytics';
import { trackMmpWithdrawalRequested } from '../services/mmpAnalytics';

const currencies = [
  {
    code: 'USD',
    label: 'United States Dollar',
    method: 'Bank Transfer',
    redirect: 'BankTransferPage',
  },
  { code: 'BTC', label: 'Bitcoin', method: 'Crypto', redirect: 'BitcoinPage' },
  {
    code: 'BTC',
    label: 'SpeedWallet',
    method: 'Crypto',
    redirect: 'SpeedWalletPage',
  },
  {
    code: 'BTC',
    label: 'ZDB-Wallet',
    method: 'Crypto',
    redirect: 'ZdbWalletPage',
  },
  { code: 'BTC', label: 'MUUN', method: 'Crypto', redirect: 'MuunWalletPage' },
  { code: 'USDT', label: 'BEP20', method: 'Crypto', redirect: 'UsdtPage' },
  { code: 'USDC', label: 'BEP20', method: 'Crypto', redirect: 'UsdcPage' },
];

const Collection_Wallet: WALLET_COLLECTION[] = [
  {
    id: 1,
    name: 'Speed',
    icon: require('../assets/images/speed.png'),
  },
  {
    id: 2,
    name: 'ZBD',
    icon: require('../assets/images/zbd.png'),
  },
  {
    id: 3,
    name: 'Muun',
    icon: require('../assets/images/muun.jpg'),
  },
  {
    id: 4,
    name: 'Bitrefill',
    icon: require('../assets/images/bitrefill.png'),
  },
  {
    id: 5,
    name: 'Others',
    icon: require('../assets/images/otherwallets.jpg'),
  },
];

type WithdrawalScreen = StackNavigationProp<
  RootStackParamList,
  'WithdrawScreen'
>;
type WithdrawalRouteProp = RouteProp<RootStackParamList, 'WithdrawScreen'>;

const DEFAULT_MIN_BTC = 0.0000005;
const DEFAULT_MAX_BTC = 0.000009;

const WithdrawScreen = () => {
  const [withdrawalLimits, setWithdrawalLimits] = useState<{
    minBtc: number;
    maxBtc: number;
  }>({ minBtc: DEFAULT_MIN_BTC, maxBtc: DEFAULT_MAX_BTC });

  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(currencies[0]);
  const [notes, setNotes] = useState('');
  const [btcBal, setBtcBal] = useState('loading...');
  const [selectedAddressLightning, setSelectedAddressLightning] = useState<
    'Lightning Address' | 'Invoice'
  >('Invoice');
  const amountInput = useRef<TextInput>(null);
  const [currencyDropdownVisible, setCurrencyDropdownVisible] = useState(false);
  const navigation = useNavigation<WithdrawalScreen>();
  const { params } = useRoute<WithdrawalRouteProp>();
  const { user } = useAuth();
  const [belowMin, setBelowMin] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState(
    Collection_Wallet[0],
  );
  /** null = the price is not known yet; never 0, which reads as a $0.00 wallet. */
  const [btcPrice, setBtcPrice] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [_balanceUSD, setBalanceUSD] = useState(0);
  /** On-chain BTC (withdrawals are debited from BTC_DEPOSIT in backend). */
  const [btcDeposit, setBtcDeposit] = useState<number>(0);
  const method = params.method;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWarning, setShowWarning] = useState(true);

  const getBTCPrice = async () => {
    try {
      const price = await getBtcUsdPriceCached();
      setBtcPrice(price);
      return price;
    } catch (err) {
      if (err instanceof Error) {
      } else {
      }
    }
  };

  const fetchBalance = useCallback(
    async (btc_price: any) => {
      try {
        const url = `${get_data_uri('GET_WALLET_BALANCE')}?userId=${user.id}`;
        const res = await fetch(url, { headers: getMobileSecurityHeaders() });
        const data = await res.json();

        // console.log("User Balance: ", data);

        if (res.ok && data.balance) {
          let usdValue = parseFloat(data.balance.USD ?? '0');

          // Convert BTC → USD
          const btcVal = parseFloat(
            data.balance.BTC?.$numberDecimal ?? data.balance.BTC ?? '0',
          );
          if (!isNaN(btcVal) && btc_price) {
            usdValue += btcVal * btc_price;
          }

          // Convert USDT/USDC → USD
          const usdtVal = parseFloat(
            data.balance.USDT?.$numberDecimal ?? data.balance.USDT ?? '0',
          );
          const usdcVal = parseFloat(
            data.balance.USDC?.$numberDecimal ?? data.balance.USDC ?? '0',
          );
          const btcDepVal = parseFloat(
            data.balance.BTC_DEPOSIT?.$numberDecimal ??
            data.balance.BTC_DEPOSIT ??
            '0',
          );

          usdValue += isNaN(usdtVal) ? 0 : usdtVal;
          usdValue += isNaN(usdcVal) ? 0 : usdcVal;

          if (!isNaN(btcDepVal) && btc_price) {
            usdValue += btcDepVal * btc_price;
          }

          // console.log("User Balance - USDValue: ", usdValue);

          setBtcDeposit(isNaN(btcDepVal) ? 0 : btcDepVal);
          const final_btc_value = btcVal + btcDepVal;
          setBalanceUSD(usdValue);
          setBtcBal(final_btc_value.toFixed(16));
        }
      } catch (err) {
      }
    },
    [user.id],
  );

  const fetchWithdrawalLimits = useCallback(async () => {
    try {
      const url = get_data_uri('GET_WITHDRAWAL_LIMITS');
      const res = await fetch(url, { headers: getMobileSecurityHeaders() });
      const data = await res.json();
      if (res.ok && typeof data.minBtc === 'number' && typeof data.maxBtc === 'number') {
        setWithdrawalLimits({ minBtc: data.minBtc, maxBtc: data.maxBtc });
      }
    } catch (err) {
    }
  }, []);

  const refreshData = useCallback(async () => {
    setRefreshing(true);
    const btc_price = await getBTCPrice();
    await fetchBalance(btc_price);
    await fetchWithdrawalLimits();
    setRefreshing(false);
  }, [fetchBalance, fetchWithdrawalLimits]);

  // Fetch wallet balance when screen loads
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Also refresh whenever user returns to this screen
  useFocusEffect(
    useCallback(() => {
      refreshData();
    }, [refreshData])
  );

  // Validation

  const { minBtc: MIN_WITHDRAW_BTC, maxBtc: MAX_WITHDRAW_BTC } = withdrawalLimits;
  const amountBTC = parseFloat(amount || '0');
  // Null while the price is unknown: the request carries this as its USD
  // notional, and sending 0 got the withdrawal rejected as below the minimum.
  const amountUSD = btcPrice != null ? amountBTC * btcPrice : null;
  const balanceBtcNum =
    btcBal === 'loading...' ? Number.NaN : parseFloat(btcBal);
  // On-chain BTC method: only BTC_DEPOSIT is available (server validates amountBtc and amountNumeric vs deposit).
  const capForRequest =
    method === 'BTC'
      ? Math.min(MAX_WITHDRAW_BTC, Math.max(0, btcDeposit))
      : Math.min(
        MAX_WITHDRAW_BTC,
        Number.isFinite(balanceBtcNum) ? balanceBtcNum : MAX_WITHDRAW_BTC,
      );
  const maxWithdrawableBtcNum = capForRequest;
  const maxWithdrawableBtcStr = maxWithdrawableBtcNum.toFixed(16);
  const exceedsBalance = !!amount && amountBTC > maxWithdrawableBtcNum;

  useEffect(() => {
    const updateMin = () => {
      if (amount && amountBTC < MIN_WITHDRAW_BTC) {
        setBelowMin(true);
      } else {
        setBelowMin(false);
      }
    };
    updateMin();
  }, [amount, amountBTC, MIN_WITHDRAW_BTC]);

  // Handle Withdraw
  const handleWithdraw = async () => {
    if (amountUSD == null) {
      Alert.alert(
        'Price unavailable',
        "We can't reach the Bitcoin price right now, so this withdrawal can't be valued. Please try again in a moment.",
      );
      return;
    }
    if (exceedsBalance) {
      if (method === 'BTC') {
        Alert.alert(
          'Insufficient on-chain balance',
          'On-chain withdrawal is limited to your BTC_DEPOSIT (on-chain) balance. amountBtc and the USDT notional (amountNumeric) must not exceed that balance.',
        );
      }
      amountInput.current?.blur();
      setTimeout(
        () => {
          amountInput.current?.focus();
        },
        Platform.OS === 'ios' ? 250 : 150,
      );
      return;
    }
    if (belowMin || !amount) {
      setBelowMin(true);
      amountInput.current?.blur();
      setTimeout(
        () => {
          amountInput.current?.focus();
        },
        Platform.OS === 'ios' ? 250 : 150,
      );
      return;
    }
    if (amountBTC > MAX_WITHDRAW_BTC) {
      Alert.alert(`Maximum withdrawal amount is ${MAX_WITHDRAW_BTC} BTC`);
      return;
    }

    if (!notes?.trim()) {
      const msg =
        method === 'BTC'
          ? 'Please enter a wallet address to continue'
          : selectedAddressLightning === 'Invoice'
            ? 'Please enter an invoice ID to continue'
            : 'Please enter a Speed Wallet address to continue';
      Alert.alert(msg);
      return;
    }
    try {
      setIsSubmitting(true);

      if (method === 'BTC') {
        // --- BTC Withdrawal ---
        const res = await fetch(get_data_uri('CREATE_WITHDRAWAL'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getMobileSecurityHeaders() },
          body: JSON.stringify({
            userId: user.id,
            asset: currency.code,
            chain: currency.method === 'Crypto' ? currency.code : 'BANK',
            toAddress: notes.trim(),
            amountNumeric: amountUSD, // send USD converted value
            amountBtc: amountBTC, // so backend can validate min/max BTC
          }),
        });

        const data = await res.json();

        if (res.ok) {
          trackWithdrawalRequested('BTC', amountBTC, String(user.id));
          trackMmpWithdrawalRequested('BTC', amountBTC, String(user.id));
          Alert.alert('Success', 'Withdrawal request created successfully!');
          navigation.goBack();
        } else {
          Alert.alert('Failed', data?.error || 'Unable to process withdrawal.');
        }

        return;
      }

      // --- Lightning Withdrawals ---
      if (selectedAddressLightning === 'Invoice') {
        const data = await handle_speed_withdraw(notes.trim());
        if (data && !data.error) {
          trackWithdrawalRequested('Lightning', amountBTC, String(user.id));
          trackMmpWithdrawalRequested('Lightning', amountBTC, String(user.id));
          Alert.alert('Success', 'Withdrawal request created successfully!');
          navigation.goBack();
        } else if (data && data.error) {
          Alert.alert('Failed', data.error);
        }
      } else {
        const data = await handle_speed_wallet(
          amountUSD,
          amountBTC,
          user.id,
          notes.trim(),
        );
        if (data && !data.error) {
          Alert.alert('Success', 'Withdrawal request created successfully!');
          navigation.goBack();
        } else if (data && data.error) {
          Alert.alert('Failed', data.error);
        }
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Top Bar */}
      <View style={styles.topBar}>
        <Pressable
          style={styles.topBarPressable}
          onPress={() => {
            Vibration.vibrate([0, 100, 200]);
            navigation.goBack();
          }}
        >
          <Icon
            onPress={() => {
              Vibration.vibrate([0, 100, 200]);
              navigation.goBack();
            }}
            name="arrow-back-ios"
            size={25}
            color="white"
          />
        </Pressable>
        <Text style={styles.topBarTitle}>Withdraw</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refreshData} />
        }
      >
        <View style={styles.btc}>
          <Image
            source={require('../assets/images/bitcoin.png')}
            style={styles.btcImage}
          />
          <Text style={styles.btcText}>Bitcoin Balance</Text>
        </View>
        <View style={styles.balanceContainer}>
          <Text style={styles.balance}>{btcBal}</Text>
          <Text style={styles.unit}> {'BTC'}</Text>
        </View>
        {method === 'BTC' && (
          <Text style={styles.depositHint} accessibilityRole="text">
            On-chain BTC_DEPOSIT (max for this path): {btcDeposit.toFixed(8)} BTC
          </Text>
        )}

        {method === 'BTC' ? (
          <BTCWithdrawal
            amountInput={amountInput}
            amount={amount}
            setAmount={setAmount}
            setCurrencyDropdownVisible={setCurrencyDropdownVisible}
            currencyCode={currency.code}
            belowMin={belowMin}
            exceedsBalance={exceedsBalance}
            setAddress={setNotes}
            address={notes}
            btcBal={btcBal}
            maxWithdrawable={maxWithdrawableBtcStr}
            minBtc={MIN_WITHDRAW_BTC}
            maxBtc={MAX_WITHDRAW_BTC}
          />
        ) : (
          <Lightning
            Collection_Wallet={Collection_Wallet}
            amountInput={amountInput}
            amount={amount}
            setAmount={setAmount}
            selectedAddressLightning={selectedAddressLightning}
            setSelectedAddressLightning={setSelectedAddressLightning}
            belowMin={belowMin}
            exceedsBalance={exceedsBalance}
            setAddress={setNotes}
            address={notes}
            btcBal={btcBal}
            maxWithdrawable={maxWithdrawableBtcStr}
            selectedCollection={selectedCollection.id}
            selectedWalletName={selectedCollection.name}
            handleSelection={(collection: WALLET_COLLECTION) => {
              setSelectedCollection(collection);
              // Only Speed supports a Lightning Address; every other wallet
              // (ZBD, Muun, Others) is invoice-only for now.
              if (collection.name !== 'Speed') {
                setSelectedAddressLightning('Invoice');
              }
            }}
            minBtc={MIN_WITHDRAW_BTC}
            maxBtc={MAX_WITHDRAW_BTC}
          />
        )}

        {/* Confirm Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleWithdraw}
          disabled={isSubmitting}
          style={[styles.withdrawButton, isSubmitting && styles.disabledButton]}
        >
          <LinearGradient
            colors={['#4F46E5', '#9333EA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.actionButton}
          >
            <Text style={styles.confirmText}>Withdraw</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Warning Box */}
        {showWarning && (
          <View style={styles.warningBox}>
            <Text
              style={[styles.warningTitle, styles.underline, styles.underlinedMargin]}
            >
              Please read carefully before withdrawing
            </Text>
            {method === 'BTC' ? (
              <Text style={styles.warningText}>
                On-chain BTC withdrawals have a minimum withdrawal amount
                requirement. Please refer to the specified range.{'\n\n'}
                Transaction fees are required for blockchain transactions and
                are not controlled by this platform. Fees vary based on network
                conditions; the amount credited will be the withdrawal amount
                minus the blockchain fee. BTC network fees can be high — you
                can verify current fees on the blockchain.{'\n\n'}
                Please use a secure and reliable BTC wallet and double-check
                the wallet address before submitting. We cannot verify the
                security of your address and are not responsible for the
                outcome once a transaction is completed.{'\n\n'}
                Once your withdrawal request is successfully submitted, we will
                process it within 48 hours. For questions contact us at
                support@bitplaypro.com
              </Text>
            ) : (
              <Text style={styles.warningText}>
                The Lightning Network only supports a limited withdrawal amount.
                Please refer to the specified range.{'\n\n'}Ensure you are
                sending to a supported Lightning wallet address.{'\n\n'}
                Incorrect addresses or incompatible wallets may result in
                permanent loss of funds.{'\n\n'}When withdrawing via Lightning,
                follow the tutorial carefully and confirm the Lightning address
                is correct before proceeding.
              </Text>
            )}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setShowWarning(false)}
              style={styles.understandButton}
            >
              <LinearGradient
                colors={['#4F46E5', '#9333EA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.understandButtonGradient}
              >
                <Text style={styles.understandButtonText}>I Understand</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Currency Modal */}
      <Modal
        transparent
        visible={currencyDropdownVisible}
        animationType="fade"
        onRequestClose={() => setCurrencyDropdownVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPressOut={() => setCurrencyDropdownVisible(false)}
        >
          <View style={styles.modalDropdown}>
            {currencies.map(item => (
              <TouchableOpacity
                key={`${item.code}-${item.label}`}
                onPress={() => {
                  setCurrency(item);
                  setCurrencyDropdownVisible(false);
                }}
              >
                <Text
                  style={styles.dropdownOption}
                >{`${item.code} - ${item.label}`}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

export default WithdrawScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#15213B' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  topBarPressable: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 5,
  },
  topBarTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginLeft: -20,
  },
  scrollView: { padding: 16, paddingBottom: 40 },
  box: {
    marginBottom: 24,
    gap: 8,
  },

  label: { color: '#CBD5E1', fontSize: 14, marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 24 : 20,
    color: '#F1F5F9',
    fontSize: 16,
    marginBottom: 24,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#334155',
    paddingVertical: Platform.OS === 'ios' ? 24 : 20,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
    borderColor: '#1F67E9',
    borderWidth: 1.5,
  },
  dropdownText: { color: '#F1F5F9', fontSize: 16, fontWeight: '500' },

  confirmText: { color: '#fff', fontSize: 16, fontWeight: '600', margin: 16 },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 32,
  },
  modalDropdown: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 12,
  },
  dropdownOption: {
    padding: 12,
    color: '#E2E8F0',
    fontSize: 16,
  },
  withdrawButton: {
    padding: 16,
    // borderRadius: 10,
    overflow: 'hidden',
    // marginBottom: 18,
  },
  actionButton: {
    flex: 1,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  note: {
    fontSize: 12,
    color: '#fff',
  },
  underline: {
    textDecorationLine: 'underline',
  },
  underlinedMargin: {
    marginBottom: 10,
  },
  warningBox: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    // marginBottom: 40,
    borderWidth: 1,
    borderColor: '#334155',
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F1F5F9',
    marginBottom: 12,
  },
  warningText: {
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 18,
    marginBottom: 16,
  },
  understandButton: {
    borderRadius: 10,
    // overflow: 'hidden',
    marginTop: 8,
  },
  understandButtonGradient: {
    // padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  understandButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    padding: 8
  },
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 3,
    marginBottom: 8,
  },
  depositHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 12,
  },
  balance: {
    fontSize: 20,
    fontWeight: '500',
    color: '#fff',
    flexShrink: 1,
    textAlign: 'right',
  },
  unit: {
    fontSize: 18,
    fontWeight: '500',
    color: '#fff',
    opacity: 0.5,
  },
  btc: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginBottom: 15,
  },
  btcImage: {
    height: 22,
    width: 22,
    elevation: 5,
    shadowColor: '#00000066',
    shadowOffset: {
      width: 1,
      height: 1,
    },
  },
  btcText: { opacity: 0.5, color: '#fff', fontSize: 16 },
});

// ================== Utility Functions (Commented) ==================

async function handle_speed_withdraw(inv_id: any) {
  try {
    const speed_payment_uri = get_data_uri('PROCESS_SPEED_TRANSACTION');

    const response = await fetch(speed_payment_uri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getMobileSecurityHeaders(),
      },
      body: JSON.stringify({
        invoice: inv_id,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error || data.message || 'Unable to process withdrawal.' };
    }

    return data;
  } catch (error) {
    Alert.alert('Error', 'Something went wrong while initiating Speed Wallet.');
  }
}

function isValidSpeedLN(address: string) {
  const regex = /^[a-zA-Z0-9_-]+@speed\.app$/;
  return regex.test(address);
}

async function handle_speed_wallet(
  amountUSD: any,
  baseAmount: any,
  userId: any,
  speed_wallet_address: any,
) {
  try {
    const speed_wallet_uri = get_data_uri('CREATE_SPEED_TRANSACTION');

    const new_speed_wallet = speed_wallet_address.toLowerCase();

    const is_speed_valid = isValidSpeedLN(new_speed_wallet);

    if (!is_speed_valid) {
      Alert.alert('Please enter a valid speed wallet address');
      return;
    }

    const response = await fetch(speed_wallet_uri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getMobileSecurityHeaders(),
      },
      body: JSON.stringify({
        amount: amountUSD,
        baseAmount,
        defaultAmountNumeric: baseAmount,
        currency: 'USD',
        target_currency: 'USDT',
        payment_methods: ['lightning'],
        metadata: { user_id: userId },
        speed_wallet_address: new_speed_wallet,
        idempotency_key: `${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      return { error: data.error || data.message || 'Unable to create Speed payment.' };
    }

    return data;
  } catch (error) {
    Alert.alert('Error', 'Something went wrong while initiating Speed Wallet.');
  }
}

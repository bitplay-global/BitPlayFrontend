import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Clipboard,
  Platform,
  FlatList,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import { Picker } from '@react-native-picker/picker';
import { get_data_uri } from '../config/api';
import { useAuth } from '../auth/AuthProvider';
import axios from 'axios';

const paymentMethods =
  Platform.OS === 'android'
  ? [
      { key: 'crypto', label: 'Pay with Crypto', icon: 'logo-bitcoin' },
    ]
  : [
      { key: 'crypto', label: 'Pay with Crypto', icon: 'logo-bitcoin' },
      { key: 'card', label: 'Credit/Debit Card', icon: 'card-outline' },
      { key: 'bank', label: 'Bank Deposit', icon: 'business-outline' },
    ];

const coinOptions = ['BTC', 'USDT', 'USDC'];
const chainOptions = ['BTC', 'BEP20'];

const MakePaymentScreen = ({ navigation, route }: any) => {
  const { plan } = route.params;
  const [selectedMethod, setSelectedMethod] = useState('crypto');
  const [planAmount, setPlanAmount] = useState('0.0015');
  const [btcUSDValue, setBtcUSDValue] = useState('');
  const [coin, setCoin] = useState('USDT');
  const [chain, setChain] = useState('BEP20');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const PlanPrice = parseFloat(plan.plan_cost) + parseFloat(plan.maintenance_cost);

  const [planUSD, setPlanUSD] = useState(PlanPrice);
  const [planBTC, setPlanBTC] = useState<string>("");
  const [btcValue, setBtcValue] = useState<number>(0);

  const [PlanId, setPlanId] = useState<string | null>(plan.id);
  const [payment_method, SetPaymentMethod] = useState('Crypto');

  // User Wallet Addresses
  const [coinAddress, setcoinAddress] = useState('');
  const [btcAddress, setBtcAddress] = useState('');
  const [bnbAddress, setBnbAddress] = useState('');
  const [usdtAddress, setUsdtAddress] = useState('');
  const [usdcAddress, setUsdcAddress] = useState('');

  const { user } = useAuth();
  
  const user_id = user?.id;

  useEffect(() => {
    if (!user_id) {
      return;
    }

    setPlanAmount(PlanPrice.toString());

    const final_url = `${get_data_uri('GET_DEPOSIT_ADDRESSES')}/${user_id}`;

    const fetchAddress = async () => {
      try {

        const res = await fetch(final_url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        const data = await res.json();

        if (res.ok) {
          // console.log("User Addresses ResponseData: ", data);

          if (data.BTC) setBtcAddress(data.BTC);
          if (data.USDT) setUsdtAddress(data.USDT);
          if (data.USDC) setUsdcAddress(data.USDC);
          if (data.BNB) setBnbAddress(data.BNB);
          
        } else {
          setError(data?.message || 'Failed to fetch wallet address.');
        }
      } catch (err) {
        setError('Network error. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchAddress();
  }, [user_id]);

  async function getBTCPrice() {
    try {
      // CoinGecko first
      const res = await axios.get("https://api.coingecko.com/api/v3/simple/price", {
        params: { ids: "bitcoin", vs_currencies: "usd" },
      });
      return res.data.bitcoin.usd;
    } catch (err: any) {
      if (err.response && err.response.status === 429) {

        try {
          // Binance fallback
          const res = await axios.get("https://api.binance.com/api/v3/ticker/price", {
            params: { symbol: "BTCUSDT" },
          });
          return parseFloat(res.data.price);
        } catch (binanceErr: any) {
          return 0;
        }
      }

      return 0;
    }
  }

  useEffect(() => {
    fetchLiveBTCPrice();
  }, [planAmount]);

  const fetchLiveBTCPrice = async () => {
    try {
      const btcPrice = await getBTCPrice();

      setBtcValue(btcPrice);
      
    } catch (err) {
    }
  };

  function setcoinandchain(coin: string) {
    setCoin(coin);

    if (coin === "BTC") {
      setChain("BTC");

      if (btcValue > 0) {
        const plan_value_btc = (planUSD / btcValue).toFixed(8);
        setPlanBTC(plan_value_btc);

        setPlanAmount(plan_value_btc);
      }
    } else {
      setChain("BEP20");
      setPlanBTC("");
      setPlanAmount(planUSD.toString());
    }

    if (coin === "BTC") setcoinAddress(btcAddress);
    if (coin === "BNB") setcoinAddress(bnbAddress);
    if (coin === "USDT") setcoinAddress(usdtAddress);
    if (coin === "USDC") setcoinAddress(usdcAddress);
  }

  type PaymentMethod = "Crypto" | "Bank" | "Gateway";

  interface CreateUserPlanParams {
    user: string;         
    plan_id: string;       
    crypto: "BTC" | "ETH" | "USDT" | "USDC";
    chain: "BTC" | "BNB";
    paymentMethod: PaymentMethod;
  }

  async function createOrUpdateUserPlan(params: CreateUserPlanParams) {
    try {
      const res = await axios.post(get_data_uri('BUY_SUBSCRIPTION'), params, {
        headers: { "Content-Type": "application/json" },
      });

      return { success: true, data: res.data };
    } catch (err: any) {
      if (err.response) {
        return { success: false, error: err.response.data.error };
      }
      return { success: false, error: "Network error. Please try again." };
    }
  }

  async function CreateUserSub() {
    const payload = {
      user: user?.id,
      plan_id: PlanId!,
      crypto: coin as "BTC" | "ETH" | "USDT" | "USDC",
      chain: chain as "BTC" | "BNB",
      paymentMethod: payment_method as "Crypto" | "Bank" | "Gateway",
    };

    const result = await createOrUpdateUserPlan(payload);

    if (result.success) {
      Alert.alert(
        "Payment Confirmation",
        "Please wait until we confirm your payment!!",
        [
          {
            text: "OK",
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: "Main" }],
              });
            },
          },
        ]
      );
    } else {
      alert(`Error: ${result.error}`);
    }
  }

  useEffect(() => {
    if (selectedMethod === "crypto") {
      SetPaymentMethod("Crypto");
    } else if (selectedMethod === "card") {
      SetPaymentMethod("Gateway");
    } else if (selectedMethod === "bank") {
      SetPaymentMethod("Bank");
    }
  }, [selectedMethod]);

  const renderCryptoForm = () => (
    <View style={styles.formBox}>
      <Text style={styles.formTitle}>Pay with {coin} ({chain})</Text>
      <Text style={styles.formSub}>Send the exact amount to the address below. Your order will be processed after network confirmation.</Text>

      <Text style={styles.inputLabel}>Coin Type</Text>
      <View style={styles.dropdownContainer}>
        <Picker selectedValue={coin} onValueChange={setcoinandchain} style={styles.picker}>
          {coinOptions.map((c) => (
            <Picker.Item label={c} value={c} key={c} />
          ))}
        </Picker>
      </View>

      <Text style={styles.inputLabel}>Network</Text>
      <View style={styles.dropdownContainer}>
        <Picker selectedValue={chain} onValueChange={setChain} style={styles.picker}>
          {chainOptions.map((c) => (
            <Picker.Item label={c} value={c} key={c} />
          ))}
        </Picker>
      </View>

      <Text style={styles.inputLabel}>{coin} Address</Text>
      <View style={styles.inputRow}>
        <Text
          style={styles.CointextInput}
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {coinAddress}
        </Text>
        <TouchableOpacity onPress={() => Clipboard.setString(coinAddress)}>
          <Icon name="copy-outline" size={17} color="#22D3EE" style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      </View>

      <Text style={styles.inputLabel}>Amount ({coin}):</Text>
      <TextInput
        style={styles.textInput}
        value={planAmount}
        onChangeText={setPlanAmount}
        keyboardType="decimal-pad"
      />

      <TouchableOpacity activeOpacity={0.8} onPress={CreateUserSub}>
        <LinearGradient
          colors={["#22D3EE", "#C084FC"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.confirmButton}
        >
          <View style={styles.confirmButtonInner}>
            <Text style={styles.confirmButtonText}>I've Made The Payment</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderCardForm = () => (
    <View style={styles.formBox}>
      <Text style={styles.formTitle}>Pay with Credit/Debit Card</Text>
      <Text style={styles.formSub}>You'll be redirected to a secure payment gateway to complete your transaction.</Text>
    </View>
  );

  const renderBankForm = () => (
    <View style={styles.formBox}>
      <Text style={styles.formTitle}>Pay via Bank Deposit</Text>
      <Text style={styles.formSub}>Please transfer the total amount to our bank account and upload proof of payment on the dashboard.</Text>
    </View>
  );

  const renderPaymentForm = () => {
    switch (selectedMethod) {
      case 'crypto': return renderCryptoForm();
      case 'card': return renderCardForm();
      case 'bank': return renderBankForm();
      default: return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Make a Payment</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={{ paddingHorizontal: Platform.OS === 'ios' ? 13 : 16 }}>
        {/* Order Summary */}
        <LinearGradient
          colors={["#334155", "#1E293B"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.orderSummary}
        >
          <View style={styles.orderSummaryContent}>
            <Text style={styles.sectionTitle}>Order Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryText}>{plan.name} ({plan.hashrate} TH/s)</Text>
              <Text style={styles.summaryText}>${plan.plan_cost}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryText}>Service Fee</Text>
              <Text style={styles.summaryText}>${plan.maintenance_cost}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryText, { fontWeight: '600' }]}>
                Total Amount Due
              </Text>
              <Text
                style={[
                  styles.summaryText,
                  { fontWeight: '600', color: '#22D3EE' },
                ]}
              >
                ${plan.plan_cost + plan.maintenance_cost}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Payment Method Selection */}
        <View style={styles.paymentMethodBox}>
          <Text style={styles.sectionTitle}>Choose Payment Method</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {paymentMethods.map((method) => (
              <TouchableOpacity
                key={method.key}
                onPress={() => setSelectedMethod(method.key)}
                style={[styles.methodCard, selectedMethod === method.key && styles.methodCardActive]}
              >
                <Icon
                  name={method.icon}
                  size={18}
                  color={selectedMethod === method.key ? '#06B6D4' : 'white'}
                  style={{ marginBottom: 4 }}
                />
                <Text
                  style={{
                    color: selectedMethod === method.key ? '#06B6D4' : 'white',
                    fontSize: 12,
                  }}
                >
                  {method.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Dynamic Form */}
        {renderPaymentForm()}
      </ScrollView>
    </View>
  );
};

export default MakePaymentScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginTop: Platform.OS === 'ios' ? 50 : 20
  },
  topTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  orderSummary: {
    borderRadius: 12,
    marginVertical: 16,
    overflow: 'hidden',
  },
  orderSummaryContent: {
    padding: 16,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryText: {
    color: '#E2E8F0',
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: '#475569',
    marginVertical: 8,
  },
  paymentMethodBox: {
    backgroundColor: 'rgba(240,255,255,0.14)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  methodCard: {
    backgroundColor: '#334155',
    padding: 10,
    borderRadius: 10,
    marginRight: 8,
    alignItems: 'center',
    width: 120,
  },
  methodCardActive: {
    backgroundColor: 'rgba(240,255,255,0.2)',
    borderColor: '#06B6D4',
    borderWidth: 1,
  },
  formBox: {
    backgroundColor: 'rgba(240,255,255,0.14)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 40,
  },
  formTitle: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
    marginBottom: 6,
  },
  formSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 12,
  },
  inputLabel: {
    color: '#E2E8F0',
    fontSize: 13,
    marginTop: 8,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: '#1E293B',
    color: 'white',
    padding: 10,
    borderRadius: 8,
  },
  CointextInput: {
    flex: 1,
    backgroundColor: '#1E293B',
    color: 'white',
    paddingVertical: 10,
    paddingHorizontal: 0,
    borderRadius: 8,
    fontSize: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  qrBox: {
    backgroundColor: '#1E293B',
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    marginTop: 16,
  },
  qrText: {
    color: 'white',
    fontSize: 16,
  },
  qrSub: {
    color: '#94A3B8',
    fontSize: 12,
  },
  confirmButton: {
    borderRadius: 10,
    marginTop: 20,
    overflow: 'hidden',
  },

  confirmButtonInner: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },

  confirmButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  dropdownContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    marginBottom: 8,
  },
  picker: {
    color: 'white',
  },
});

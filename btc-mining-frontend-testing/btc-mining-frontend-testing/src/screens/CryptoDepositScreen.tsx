import React, { useEffect, useState } from 'react';
import BitPlayLoader from '../components/BitPlayLoader';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Clipboard,
  Alert,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { get_data_uri } from '../config/api';
import { useAuth } from '../auth/AuthProvider';
import { CommonActions } from '@react-navigation/native';

const CryptoDepositScreen = ({ navigation, route }: any) => {
  const { amount, currency, notes } = route.params;
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const user_id = user?.id;
    const shortCurrency = currency.split('-')[0].trim();
  const final_url = `${get_data_uri('GET_DEPOSIT_ADDRESS')}/${user_id}/${shortCurrency}`;

useEffect(() => {
    const fetchAddress = async () => {
        try {
        const res = await fetch(
        final_url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            }
        );
        const data = await res.json();

        if (res.ok && data.address) {
            setWalletAddress(data.address);
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
}, [currency]);

  // Copy to clipboard
  const handleCopy = () => {
    if (walletAddress) {
      Clipboard.setString(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

const handleConfirmDeposit = async () => {
  setProcessing(true);
  setMessage(null);
  setError(null);

  try {
    // const shortCurrency = currency.split('-')[0].trim();

    // const res = await fetch('https://your-backend.com/api/confirmDeposit', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ amount, currency: shortCurrency, notes }),
    // });

    // const data = await res.json();

    // if (res.ok) {
    //   setMessage('Wait for sometime, the deposit is processing and will display in your wallet.');
    // } else {
    //   setError(data?.message || 'Deposit confirmation failed.');
    // }

    setMessage('Wait for sometime, the deposit is processing and will display in your wallet.');
  } catch (err) {
    setError('Network error. Please try again.');
  } finally {
    setProcessing(false);
  }
};

  // Loading state
  if (loading) {
    return (
      <View style={styles.centered}>
        <BitPlayLoader size="lg" label="Fetching wallet address..." color="#9333EA" />
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* Error State */}
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Success: Wallet Address */}
      {walletAddress && !message && (
        <View style={styles.box}>
          <Text style={styles.heading}>Deposit Address</Text>
          <View style={styles.addressRow}>
            <Text style={styles.addressText}>{walletAddress}</Text>
            <TouchableOpacity onPress={handleCopy}>
              <Icon name="content-copy" size={22} color="#9333EA" />
            </TouchableOpacity>
          </View>
          {copied && <Text style={styles.copiedText}>Copied to clipboard!</Text>}

          <TouchableOpacity
                  onPress={async () => {
                    handleConfirmDeposit
                  }}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#53D3F6', '#BD85FC', '#F472B6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.backButton}
                  >
                    <Text style={styles.backButtonText}>
                      {processing ? 'Processing...' : "I've Sent Deposit"}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
        </View>
      )}

      {/* Final Message */}
      {message && (
        <View style={styles.box}>
          <Text style={styles.heading}>Deposit Status</Text>
          <Text style={styles.messageText}>{message}</Text>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={
                navigation.dispatch(
                    CommonActions.reset({
                    index: 0,
                    routes: [{ name: 'Main' }],
                    })
                )
            }
          >
            <LinearGradient
              colors={['#334155', '#1E293B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonText}>Dismiss</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default CryptoDepositScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#15213B',
    padding: 16,
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#15213B',
  },
  loadingText: {
    marginTop: 12,
    color: '#CBD5E1',
    fontSize: 14,
  },
  box: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 20,
  },
  heading: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  addressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#334155',
    padding: 12,
    borderRadius: 8,
  },
  addressText: {
    color: '#F1F5F9',
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  copiedText: {
    color: '#10B981',
    fontSize: 13,
    marginTop: 8,
  },
  actionButton: {
    marginTop: 20,
  },
  buttonGradient: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  errorBox: {
    backgroundColor: '#B91C1C',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
  },
  messageText: {
    color: '#F1F5F9',
    fontSize: 14,
    marginBottom: 20,
  },
  topBar: {
    paddingVertical: Platform.OS === 'ios' ? 80 : 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 40,
    minHeight: 40,
    marginTop: Platform.OS === 'ios' ? 150 : 250,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

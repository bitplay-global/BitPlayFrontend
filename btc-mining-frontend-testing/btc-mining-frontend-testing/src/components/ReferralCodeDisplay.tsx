import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { getReferralCode } from '../auth/auth';
import Clipboard from '@react-native-clipboard/clipboard';

const ReferralCodeDisplay: React.FC = () => {
  const [referralCode, setReferralCode] = useState<string | null>(null);

  useEffect(() => {
    const loadReferralCode = async () => {
      const code = getReferralCode();
      setReferralCode(code);
    };
    loadReferralCode();
  }, []);

  const copyToClipboard = () => {
    if (referralCode) {
      Clipboard.setString(referralCode);
      Alert.alert('Copied!', 'Referral code copied to clipboard');
    }
  };

  if (!referralCode) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Referral Code</Text>
      <TouchableOpacity style={styles.codeContainer} onPress={copyToClipboard}>
        <Text style={styles.code}>{referralCode}</Text>
        <Text style={styles.copyText}>Tap to copy</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    alignItems: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  codeContainer: {
    backgroundColor: 'rgba(0, 212, 255, 0.2)',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  code: {
    color: '#00d4ff',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  copyText: {
    color: '#ffffff',
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
});

export default ReferralCodeDisplay;

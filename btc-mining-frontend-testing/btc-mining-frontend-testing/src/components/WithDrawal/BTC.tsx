import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const BTCWithdrawal = ({
  btcBal,
  maxWithdrawable,
  address,
  setAddress,
  amountInput,
  amount,
  setAmount,
  setCurrencyDropdownVisible,
  currencyCode,
  belowMin,
  exceedsBalance,
  minBtc = 0.0000005,
  maxBtc = 0.000009,
}: {
  amountInput: React.RefObject<TextInput | null>;
  amount: string;
  setAmount: React.Dispatch<React.SetStateAction<string>>;
  setCurrencyDropdownVisible: React.Dispatch<React.SetStateAction<boolean>>;
  currencyCode: string;
  belowMin: boolean;
  exceedsBalance: boolean;
  setAddress: React.Dispatch<React.SetStateAction<string>>;
  address: string;
  btcBal: string;
  maxWithdrawable: string;
  minBtc?: number;
  maxBtc?: number;
}) => {
  return (
    <View>
      <View style={styles.box}>
        {/* ===== Currency Dropdown ===== */}
        <TouchableOpacity
          style={styles.dropdownTrigger}
          onPress={() => setCurrencyDropdownVisible(true)}
        >
          <Text style={styles.dropdownText}>{currencyCode}</Text>
          <Icon name="arrow-drop-down" size={24} color="#94A3B8" />
        </TouchableOpacity>

        {/* ===== Amount Input ===== */}
        <Text style={styles.label}>
          Amount <Text style={styles.minText}>(Min: {minBtc} {'  '}Max: {maxBtc} )</Text>
        </Text>

        <View
          style={[
            styles.amountContainer,
            belowMin && styles.warningBorder,
            exceedsBalance && styles.errorBorder,
          ]}
        >
          <TextInput
            value={amount}
            onChangeText={(text) => {
              const normalized = text.replace(/,/g, '.');
              const parts = normalized.split('.');
              if (parts.length > 2) return;
              const valid = normalized.replace(/[^0-9.]/g, '');
              if (valid !== normalized) return;
              setAmount(normalized);
            }}
            ref={amountInput}
            placeholder={`${minBtc} - ${maxBtc}`}
            keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'decimal-pad'}
            placeholderTextColor="#94A3B8"
            style={styles.amountInput}
          />
          <Text style={styles.amountCode}>BTC</Text>
          <Text style={styles.amountAll} onPress={() => setAmount(maxWithdrawable)}>
            All
          </Text>
        </View>

        {exceedsBalance && (
          <Text style={styles.errorText}>Max withdrawable: {maxWithdrawable}</Text>
        )}
        {belowMin && (
          <Text style={styles.warningText}>
            Minimum withdrawal amount is {minBtc}
          </Text>
        )}

        {/* ===== Wallet Address ===== */}
        <Text style={styles.label}>BTC Address</Text>
        <TextInput
          value={address}
          onChangeText={setAddress}
          style={styles.input}
        />
      </View>
    </View>
  );
};

export default BTCWithdrawal;

/* =========================
   🎨 Styles
   ========================= */
const styles = StyleSheet.create({
  // ===== Layout =====
  box: {
    marginBottom: 24,
    gap: 8,
  },

  // ===== Labels =====
  label: {
    color: '#CBD5E1',
    fontSize: 14,
    marginTop: 12,
    marginBottom: 6,
  },
  minText: { color: 'orange' },

  // ===== Input Fields =====
  input: {
    backgroundColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    ...Platform.select({
      ios: { paddingVertical: 24 },
      android: { paddingVertical: 20 },
    }),
    color: '#F1F5F9',
    fontSize: 16,
    marginBottom: 24,
  },

  amountContainer: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    ...Platform.select({
      ios: { paddingVertical: 15 },
      android: { paddingVertical: 11 },
    }),
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },

  amountInput: {
    color: '#F1F5F9',
    flex: 1,
    fontSize: 16,
  },
  amountCode: { color: '#fff', fontSize: 16 },
  amountAll: { color: '#22D3EE', fontSize: 16 },

  // ===== Dropdown =====
  dropdownTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#334155',
    ...Platform.select({
      ios: { paddingVertical: 24 },
      android: { paddingVertical: 20 },
    }),
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
    borderColor: '#22D3EE',
    borderWidth: 1.5,
  },
  dropdownText: { color: '#F1F5F9', fontSize: 16, fontWeight: '500' },

  // ===== Status Styles =====
  warningBorder: { borderColor: 'orange', borderWidth: 1, marginBottom: 5 },
  errorBorder: { borderColor: 'red', borderWidth: 1, marginBottom: 5 },
  warningText: { color: 'orange' },
  errorText: { color: 'red' },
});

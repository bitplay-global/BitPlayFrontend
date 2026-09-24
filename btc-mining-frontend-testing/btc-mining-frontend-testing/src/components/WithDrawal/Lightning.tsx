import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  Image,
  View,
} from 'react-native';
import React from 'react';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { WALLET_COLLECTION } from '../../types/wallet';
import RadioButton from './RadioButton';

/** Only Speed supports a Lightning Address today; every other wallet
 *  (ZBD, Muun, Others) can only be paid via a pasted invoice. */
const radioOptionsForWallet = (
  walletName: string,
): ('Lightning Address' | 'Invoice')[] =>
  walletName === 'Speed' ? ['Lightning Address', 'Invoice'] : ['Invoice'];

// Fixed card sizing so snapToInterval below has a constant pixel stride to
// snap to -- an auto-sized (content-driven) card width can't be used with
// scroll snapping.
const WALLET_CARD_WIDTH = 120;
const WALLET_CARD_GAP = 8;
const WALLET_CARD_STRIDE = WALLET_CARD_WIDTH + WALLET_CARD_GAP;

const Lightning = ({
  btcBal,
  maxWithdrawable,
  address,
  setAddress,
  amountInput,
  amount,
  setAmount,
  belowMin,
  exceedsBalance,
  Collection_Wallet,
  handleSelection,
  selectedCollection,
  selectedWalletName,
  selectedAddressLightning,
  setSelectedAddressLightning,
  minBtc = 0.0000005,
  maxBtc = 0.000009,
}: {
  Collection_Wallet: WALLET_COLLECTION[];
  amountInput: React.RefObject<TextInput>;
  amount: string;
  setAmount: React.Dispatch<React.SetStateAction<string>>;
  selectedAddressLightning: 'Lightning Address' | 'Invoice';
  setSelectedAddressLightning: React.Dispatch<
    React.SetStateAction<'Lightning Address' | 'Invoice'>
  >;
  belowMin: boolean;
  exceedsBalance: boolean;
  setAddress: React.Dispatch<React.SetStateAction<string>>;
  address: string;
  btcBal: string;
  maxWithdrawable: string;
  selectedCollection: number;
  selectedWalletName: string;
  handleSelection: (collection: WALLET_COLLECTION) => void;
  minBtc?: number;
  maxBtc?: number;
}) => {
  const radioOptions = radioOptionsForWallet(selectedWalletName);
  return (
    <View style={styles.box}>
      {/* ===== Wallet Selector ===== */}
      <FlatList
        horizontal
        keyExtractor={item => item.id.toString()}
        data={Collection_Wallet}
        // isSelected below depends on `selectedCollection`, which lives
        // outside `data` -- without extraData, FlatList has no signal that
        // a selection change should re-render the other (unselected) rows.
        extraData={selectedCollection}
        // Android's FlatList defaults removeClippedSubviews to true, which
        // has a known native bug where sibling cells in a short horizontal
        // list get incorrectly clipped/hidden after a state-driven re-render
        // (exactly the "other wallet icons vanish after selecting one"
        // symptom reported here). This list is small and fully in memory
        // anyway, so there's no virtualization benefit worth the bug.
        removeClippedSubviews={false}
        // Snap to a full card at rest instead of allowing the scroll gesture
        // to stop mid-card. Selecting a card adds a border (walletCardSelected),
        // which changes that card's rendered width in RN's box model and can
        // shift where later cards land in the row; without snapping, a card
        // can end up resting only partially in the visible width, and since
        // its icon/label are centered within the FULL card, that centered
        // content lands outside the visible sliver -- looking blank even
        // though it rendered correctly. Snapping guarantees every card that's
        // showing at all is showing in full.
        snapToInterval={WALLET_CARD_STRIDE}
        snapToAlignment="start"
        decelerationRate="fast"
        renderItem={({ item }) => {
          const isSelected = selectedCollection === item.id;
          return (
            <Pressable
              onPress={() => handleSelection(item)}
              style={[
                styles.walletCard,
                isSelected && styles.walletCardSelected,
              ]}
            >
              <Image source={item.icon} style={styles.walletIcon} />
              <Text style={styles.walletName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {item.name}
              </Text>

              {isSelected && (
                <View style={styles.checkOverlayContainer}>
                  <View style={styles.checkOverlayCorner} />
                  <Icon
                    name="check"
                    size={14}
                    color="#fff"
                    style={styles.checkIcon}
                  />
                </View>
              )}
            </Pressable>
          );
        }}
        contentContainerStyle={styles.walletList}
      />

      {/* ===== Amount Input ===== */}
      <Text style={styles.label}>
        Amount{' '}
        <Text style={styles.orangeText}>
          (Min: {minBtc} {'  '}Max: {maxBtc} )
        </Text>
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
        <Text style={styles.currencyCode}>BTC</Text>
        <Text style={styles.allText} onPress={() => setAmount(maxWithdrawable)}>
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

      {/* ===== Lightning Address / Invoice Selection ===== */}
      {/* Only shown when the selected wallet actually offers a choice — Speed
          is the only one with both options; everyone else is invoice-only,
          so there's nothing to pick and the row would just be noise. */}
      {radioOptions.length > 1 && (
        <View style={styles.radioRow}>
          {radioOptions.map(option => (
            <RadioButton
              key={option}
              label={option}
              selected={selectedAddressLightning === option}
              size={18}
              onPress={() => setSelectedAddressLightning(option)}
            />
          ))}
        </View>
      )}

      <TextInput
        value={address}
        onChangeText={setAddress}
        style={styles.input}
        placeholder={
          selectedAddressLightning === 'Lightning Address'
            ? 'e.g. miningspeed@speed.app'
            : 'Paste your invoice'
        }
        placeholderTextColor="#94A3B8"
      />
    </View>
  );
};

export default Lightning;

// ================== Styles ==================

const styles = StyleSheet.create({
  box: {
    marginBottom: 24,
    gap: 8,
  },

  // ===== Wallet Selector =====
  walletList: {
    gap: WALLET_CARD_GAP,
  },
  walletCard: {
    width: WALLET_CARD_WIDTH,
    paddingVertical: 18,
    paddingHorizontal: 12,
    backgroundColor: '#334155',
    borderRadius: 8,
    // Border is reserved (transparent) on every card, not just the selected
    // one -- selection only ever changes color, never the card's rendered
    // size, so it can't shift where sibling cards land in the row.
    borderWidth: 1.5,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    rowGap: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  walletCardSelected: {
    borderColor: '#22D3EE',
    backgroundColor: '#162B56',
  },
  walletIcon: {
    height: 33,
    width: 33,
    borderWidth: 1,
    borderRadius: 5,
    borderColor: '#fff',
  },
  walletName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },

  // ===== Blue Corner with Checkmark =====
  checkOverlayContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 40,
    height: 25,
    overflow: 'hidden',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  checkOverlayCorner: {
    position: 'absolute',
    bottom: -15,
    right: -15,
    width: 45,
    height: 30,
    backgroundColor: '#22D3EE',
    transform: [{ rotate: '-40deg' }],
  },
  checkIcon: {
    position: 'absolute',
    bottom: 2,
    right: 2,
  },

  // ===== Amount Input =====
  label: {
    color: '#CBD5E1',
    fontSize: 14,
    marginTop: 12,
    marginBottom: 6,
  },
  orangeText: {
    color: 'orange',
  },
  amountContainer: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 15, android: 11 }),
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  amountInput: {
    color: '#F1F5F9',
    flex: 1,
    fontSize: 16,
  },
  currencyCode: {
    color: '#fff',
    fontSize: 16,
  },
  allText: {
    color: '#22D3EE',
    fontSize: 16,
  },

  warningBorder: {
    borderColor: 'orange',
    marginBottom: 5,
    borderWidth: 1,
  },
  errorBorder: {
    borderColor: 'red',
    marginBottom: 5,
    borderWidth: 1,
  },

  errorText: {
    color: 'red',
  },
  warningText: {
    color: 'orange',
  },

  // ===== Lightning Address Input =====
  radioRow: {
    flexDirection: 'row',
    gap: 15,
    marginTop: 5,
  },
  input: {
    backgroundColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 24, android: 20 }),
    color: '#F1F5F9',
    fontSize: 16,
    marginBottom: 24,
  },
});

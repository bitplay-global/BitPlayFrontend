import {
  StyleSheet,
  Text,
  View,
  Image,
  ImageBackground,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import React from 'react';
import LinearGradient from 'react-native-linear-gradient';

const { width } = Dimensions.get('window');
const scale = width / 375; // Base width (iPhone 11/X/XR size)

const normalize = (size: number) => {
  const newSize = size * scale;
  return Math.round(newSize);
};
const BalanceCard = ({
  balance,
  showUSd,
  buttonText,
  handleButtonPress,
}: {
  balance: string;
  showUSd: boolean;
  handleButtonPress: () => void;
  buttonText: string;
}) => {
  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('../../assets/images/cardBg.png')}
        style={styles.bgImage}
        resizeMode="stretch"
      />
      <View style={styles.row}>
        <View style={styles.btc}>
          <Image
            source={require('../../assets/images/bitcoin.png')}
            style={styles.btcImage}
          />
          <Text style={styles.btcText}>BITCOIN</Text>
        </View>
        <TouchableOpacity style={styles.button} onPress={handleButtonPress}>
          <LinearGradient
            colors={['#22D3EE', '#C084FC']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.actionButton}
          >
            <Text style={styles.buttonText}>{buttonText}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <View style={styles.balanceContainer}>
        <Text style={styles.balance}>{balance}</Text>
        <Text style={styles.unit}> {showUSd ? '$' : 'BTC'} </Text>
      </View>
    </View>
  );
};

export default BalanceCard;

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(240, 255, 255, 0.17)',
    borderRadius: 10,
    padding: 20,
    overflow: 'hidden',
    rowGap: 20,
    paddingBottom: 40,
  },
  bgImage: {
    position: 'absolute',
    top: -80,
    opacity: 0.5,
    bottom: 0,
    left: 0,
    right: 0,
  },
  btc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  btcImage: {
    height: 20,
    width: 20,
    elevation: 5,
    shadowColor: '#00000066',
    shadowOffset: {
      width: 1,
      height: 1,
    },
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flex: 1,
  },
  btcText: { opacity: 0.5, color: '#fff', fontSize: 14 },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    overflow: 'hidden',
  },
  actionButton: {
    borderRadius : 10,
    flex: 1,
    margin:16,
    shadowColor : '#00000066',
    shadowOffset: {
      width: 1,
      height: 1,
    },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    margin:10,
    shadowColor: '#00000066',
    shadowOffset: {
      width: 10,
      height: 10,
    },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 10,
  },
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  balance: {
    fontSize: normalize(20),
    fontWeight: '500',
    color: '#fff',
    flexShrink: 1,
    textAlign: 'right',
  },
  unit: {
    fontSize: normalize(16),
    fontWeight: '500',
    color: '#fff',
  },
});

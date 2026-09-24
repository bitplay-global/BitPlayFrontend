import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Image,
  Share,
  Linking,
  Platform,
  ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import QRCode from 'react-native-qrcode-svg';

interface InviteFriendsModalProps {
  visible: boolean;
  onClose: () => void;
  referralCode: string;
  invitationRewards: number | string;
  referralCount?: number;
}

const IOS_APP_STORE_URL =
  'https://apps.apple.com/us/app/bitplaypro/id6751984255';
const ANDROID_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.bitplay.app&pcampaignid=web_share';

const InviteFriendsModal: React.FC<InviteFriendsModalProps> = ({
  visible,
  onClose,
  referralCode,
  invitationRewards,
  referralCount = 0,
}) => {
  // Auto-open share when modal becomes visible
  useEffect(() => {
    if (visible) {
      setTimeout(async () => {
        try {
          const downloadUrl = Platform.select({
            // ios: IOS_APP_STORE_URL,
            // android: ANDROID_PLAY_STORE_URL,
            default: 'https://bitplaypro.com/download',
          });
          await Share.share({
            message: `Join me on BitPlay Pro, the cloud mining app. Use my invitation code: ${referralCode}\n\nDownload the app: ${downloadUrl}`,
            title: 'Join BitPlay Pro',
          });
        } catch (error) {
          console.error('Error sharing:', error);
        }
      }, 500);
    }
  }, [visible, referralCode]);

  const openAppStore = () => {
    Linking.openURL(IOS_APP_STORE_URL);
  };

  const openGooglePlay = () => {
    Linking.openURL(ANDROID_PLAY_STORE_URL);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>

          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Icon name="close" size={24} color="#666" />
          </TouchableOpacity>

          {/* Scrollable: modalContent is capped at 85% of the screen, and on a
              small device (320x640) everything below the gradient -- invitation
              code, store buttons, QR -- fell outside that cap with no way to
              reach it, so the user could not see or scan their own QR. */}
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >

          {/* Top Blue Section */}
          <LinearGradient
            colors={['#22D3EE', '#C084FC']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modalTopSection}
          >
            {/* Header with logo */}
            <View style={styles.modalHeader}>
              <View style={styles.logoContainer}>
                <Image
                  source={require('../assets/images/main_app_icon.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.modalAppName}>BitPlayPro</Text>
            </View>

            {/* Floating coins */}
            <Image
              source={require('../assets/images/btc_icon.png')}
              style={styles.topCoin}
              resizeMode="contain"
            />

            {/* Main Title */}
            <Text style={styles.modalTitle}>SHARE/INVITE</Text>
            <Text style={styles.modalSubtitle}>TODAY!</Text>

            {/* Earnings Display */}
            <View style={styles.earningsContainer}>
              <Text style={styles.earningsLabel}>Total Earnings</Text>
              <View style={styles.earningsAmountBox}>
                <Text style={styles.earningsNumber}>
                  {(() => {
                    if (typeof invitationRewards === 'string') {
                      // If it's already a formatted string with 16 decimals, use it as-is
                      // Otherwise parse and format to 16 decimals
                      const parsed = parseFloat(invitationRewards);
                      return isNaN(parsed) ? '0.0000000000000000' : parsed.toFixed(16);
                    }
                    // Always show 16 decimal places
                    return invitationRewards.toFixed(16);
                  })()}
                </Text>
                <Text style={styles.earningsCurrency}>BTC</Text>
              </View>
              {referralCount !== undefined && referralCount > 0 && (
                <Text style={styles.referralCountText}>
                  {referralCount} {referralCount === 1 ? 'referral' : 'referrals'}
                </Text>
              )}
              {/* States the actual backend rule (referralRewardService.js): 5% of the
                  referred user's daily mined BTC, credited daily for as long as they
                  mine. This modal is the only referral surface users can actually
                  reach, so the rule has to be stated here. */}
              <Text style={styles.earnRuleText}>
                You earn 5% of everything your friends mine — every day
              </Text>
            </View>

            {/* Bottom right coin */}
            <Image
              source={require('../assets/images/btc_icon.png')}
              style={styles.bottomCoin}
              resizeMode="contain"
            />
          </LinearGradient>

          {/* Bottom White Section */}
          <View style={styles.modalBottomSection}>
            {/* Code and QR Container */}
            <View style={styles.codeAndQrContainer}>
              {/* Left: Code */}
              <View style={styles.codeSection}>
                <Text style={styles.codeLabel}>My invitation code</Text>
                <Text
                  style={styles.codeValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                >
                  {referralCode}
                </Text>
                {/* Store Icons Horizontal */}
                <View style={styles.storeIconsRow}>
                  <TouchableOpacity onPress={openAppStore}>
                    <Icon name="apple" size={44} color="#000" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={openGooglePlay}>
                    <Icon name="google-play" size={44} color="#000" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Right: QR Code */}
              <View style={styles.qrSection}>
                <View style={styles.qrBox}>
                  {/* Carries the referral code. The QR previously encoded a bare
                      https://bitplaypro.com/ , so scanning it attributed nothing
                      and the scanner had to be told the code separately. */}
                  <QRCode
                    value={`https://bitplaypro.com/?ref=${encodeURIComponent(referralCode || '')}`}
                    size={120}
                    color="#000"
                    backgroundColor="#fff"
                  />
                </View>
              </View>
            </View>
          </View>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%',
    maxHeight: '85%',
    padding: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  modalScroll: {
    width: '100%',
  },
  modalScrollContent: {
    // No flexGrow: the sheet should hug its content and only scroll once it
    // hits modalContent's 85% cap, otherwise it stretches and leaves a band of
    // empty white below the QR.
    paddingBottom: 12,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 100,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  modalTopSection: {
    padding: Platform.OS === 'ios' ? 16 : 24,

    position: 'relative',
    minHeight: 300,
    // The negative margins bleed this section past the sheet's padding so the
    // gradient reaches the edges. They must NOT include the bottom: `margin`
    // shorthand did, which pulled the white card below up over the last 16pt of
    // this section -- burying the "You earn 5% ..." line on iOS while Android,
    // where the margin is 0, showed it fine.
    marginTop: Platform.OS === 'ios' ? -16 : 0,
    marginLeft: Platform.OS === 'ios' ? -16 : 0,
    marginRight: Platform.OS === 'ios' ? -16 : 0,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoContainer: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    padding: 4,
  },
  logoImage: {
    width: 42,
    height: 42,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  modalAppName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  topCoin: {
    position: 'absolute',
    width: 50,
    height: 50,
    top: 50,
    right: 30,
    opacity: 0.7,
  },
  modalTitle: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFA500',
    textShadowColor: 'rgba(255, 255, 255, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 1,
    letterSpacing: 1,
    lineHeight: 50,
  },
  modalSubtitle: {
    fontSize: 42,
    fontWeight: '900',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 2,
    letterSpacing: 1,
    lineHeight: 50,
    marginBottom: 16,

  },
  earningsContainer: {
    alignSelf: 'flex-start',
  },
  earningsLabel: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 6,
  },
  earningsAmountBox: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  earningsNumber: {
    color: '#FFA500',
    fontSize: 18,
    fontWeight: '700',
    marginRight: 6,
  },
  earningsCurrency: {
    color: '#4A9EFF',
    fontSize: 18,
    fontWeight: '600',
  },
  earnRuleText: {
    marginTop: 10,
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.95,
  },
  referralCountText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 8,
    opacity: 0.9,
    fontWeight: '500',
  },
  bottomCoin: {
    position: 'absolute',
    width: 100,
    height: 100,
    bottom: -20,
    right: 10,
  },
  modalBottomSection: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 24,
    paddingVertical: 30,
    marginBottom: 420 //change the styling with height and alighnment later
  },
  codeAndQrContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  codeSection: {
    flex: 1,
    paddingRight: 16,
    alignItems: 'flex-start',
  },
  codeLabel: {
    fontSize: 15,
    color: '#666',
    marginBottom: 8,
    textAlign: 'left',
  },
  codeValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 1,
    textAlign: 'left',
  },
  qrSection: {
    alignItems: 'center',
  },
  qrBox: {
    width: 140,
    height: 140,
    backgroundColor: '#fff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  storeIconsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 40,
    // paddingVertical: 20,
    marginTop: 10,
  },
});

export default InviteFriendsModal;
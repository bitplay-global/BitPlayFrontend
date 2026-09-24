import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Dimensions,
  ImageBackground,
  StatusBar,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { apiRequest, API_ENDPOINTS } from '../config/api';
import { testApiConnectivity, getApiInfo } from '../utils/testApi';
// Social sharing imports removed - not needed for referral screen
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../components/types';
import BackgroundWrapper from '../components/BackgroundWrapper';
import { Image, Linking, Share } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useAuth } from '../auth/AuthProvider';
import { getReferralCode } from '../auth/auth';
import Icon from 'react-native-vector-icons/Ionicons';

const { width, height } = Dimensions.get('window');

interface InternalReferralScreenProps { }

const InternalReferralScreen: React.FC<InternalReferralScreenProps> = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [userReferralCode, setUserReferralCode] = useState<string>('');
  const { login } = useAuth();

  const route = useRoute();

  type InternalReferralScreenNavigationProp = StackNavigationProp<RootStackParamList, 'InternalReferral'>;

  const navigation = useNavigation<InternalReferralScreenNavigationProp>();
  const { user } = useAuth();

  // Entering someone else's code, available here too -- not only on the screen
  // shown right after signup. Anyone invited who signed up without the code (or
  // through Google/Apple, where there is no field) otherwise had nowhere to add
  // it. The backend applies it write-once and rejects a second attempt.
  const hasReferrer =
    !!(user as any)?.referralUsed &&
    String((user as any).referralUsed).trim().toLowerCase() !== 'null';
  const [inviteCode, setInviteCode] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(hasReferrer);
  const [claimError, setClaimError] = useState('');

  const applyInviteCode = async () => {
    const code = inviteCode.trim();
    if (!code) { setClaimError("Enter the code your friend gave you."); return; }
    setClaiming(true);
    setClaimError('');
    try {
      const res = await apiRequest(API_ENDPOINTS.REFERRAL_CLAIM, {
        method: 'POST',
        body: JSON.stringify({ referral_code: code.toLowerCase() }),
      });
      if (res?.success) setClaimed(true);
      else setClaimError(res?.message || 'Could not apply that code.');
    } catch (e: any) {
      setClaimError(e?.message || 'Could not apply that code.');
    } finally {
      setClaiming(false);
    }
  };

  useEffect(() => {
    const fetchReferralCode = async () => {
      try {
        const code = await getReferralCode();
        if (code) {
          setUserReferralCode(code);
        } else if (user?.referralCode) {
          setUserReferralCode(user.referralCode);
        }
      } catch (error) {
        // Fallback to user object if async fetch fails
        if (user?.referralCode) {
          setUserReferralCode(user.referralCode);
        }
      }
    };

    fetchReferralCode();
  }, [user]);

  const copyReferralCode = () => {
    Clipboard.setString(userReferralCode);
    Alert.alert('Copied!', 'Referral code copied to clipboard', [{ text: 'OK' }]);
  };

  const handleInvite = async () => {
    setIsLoading(true);
    try {
      const downloadUrl = Platform.select({
        default: 'https://bitplaypro.com/download',
      });
      const result = await Share.share({
        message: `Join me on BitPlay Pro, the cloud mining app. Use my invitation code: ${userReferralCode}\n\nDownload the app: ${downloadUrl}`,
        title: 'Join BitPlay Pro',
      });

      if (result.action === Share.sharedAction) {
        const channel = result.activityType ?? 'direct';
      }
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require('../assets/images/bg_pattern1.png')}
      style={[styles.backgroundImage, { backgroundColor: '#1B202C' }]}
      resizeMode="cover">

      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          <View style={styles.content}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() =>
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Main' }],
                })
              } style={styles.backButton}>
                <Icon name="chevron-back" size={30} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}></Text>
            </View>


            {/* Bitcoin Logo */}
            <View style={styles.logoContainer}>
              <View style={styles.bitcoinLogo}>
                <Image
                  source={require('../assets/images/icon_referral_screen.png')}
                  style={styles.bitcoinImage}
                  resizeMode="contain"
                />
              </View>
            </View>

            <View style={styles.screenContainer}>

              {/* Referral Code Box */}
              <Text style={styles.referralTitle}>REFERRAL CODE</Text>
              <TouchableOpacity onPress={copyReferralCode}>
                <LinearGradient
                  colors={['#1B202CAA', '#2E3646AA']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.referralBox}
                >
                  <Text style={styles.referralCode}>{userReferralCode}</Text>
                  <View style={styles.underline} />
                  <Text style={styles.tapToCopy}>Tap to copy</Text>
                </LinearGradient>
              </TouchableOpacity>

              {!claimed ? (
                <View style={styles.claimBox}>
                  <Text style={styles.claimTitle}>Were you invited?</Text>
                  <Text style={styles.claimBody}>
                    Enter your friend's code and they'll earn 5% of what you mine.
                  </Text>
                  <TextInput
                    style={styles.claimInput}
                    placeholder="INVITE CODE"
                    placeholderTextColor="#7A8699"
                    value={inviteCode}
                    onChangeText={t => { setInviteCode(t); if (claimError) setClaimError(''); }}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={12}
                  />
                  {claimError ? <Text style={styles.claimError}>{claimError}</Text> : null}
                  <TouchableOpacity
                    onPress={applyInviteCode}
                    disabled={claiming}
                    activeOpacity={0.85}
                    style={styles.claimBtn}
                  >
                    <Text style={styles.claimBtnText}>{claiming ? 'Applying...' : 'Apply Code'}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.claimDone}>
                  <Text style={styles.claimDoneText}>Invite code applied</Text>
                </View>
              )}

              {/* Invite Section */}
              <LinearGradient
                colors={['#1B202CAA', '#2E3646AA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.formBox}
              >
                <View style={styles.formContainer}>
                  {/* Copy must match the backend rule in referralRewardService.js:
                      5% of the referred user's daily mined BTC, credited every day
                      for as long as they keep mining. There is no fixed bounty and
                      no qualifying period -- the previous "$50 after 5 days" wording
                      described a scheme that was never implemented. */}
                  <Text style={styles.earnText}>
                    Earn <Text style={styles.earnHighlight}>5% of everything your friends mine</Text> — paid
                    into your BTC balance every day, for as long as they keep mining.
                  </Text>

                  {/* Fixed Invite Button */}
                  <TouchableOpacity
                    onPress={handleInvite}
                    disabled={isLoading}
                    activeOpacity={0.8}
                    style={{ borderRadius: 15, overflow: "hidden", alignSelf: "center" }}
                  >
                    <LinearGradient
                      colors={['#2ACFEF', '#BD85FC']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.loginButton}
                    >
                      <View style={styles.loginButtonInner}>
                        <Text style={styles.loginButtonText}>
                          {isLoading ? 'Loading...' : 'INVITE'}
                        </Text>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </LinearGradient>

              {/* Share From Section */}
              <LinearGradient
                colors={['#1B202CAA', '#2E3646AA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.shareBox}
              >
                <Text style={styles.shareTitle}>Share with friends</Text>
                <Text style={styles.shareSubtitle}>
                  Invite others using your referral code
                </Text>

                <View style={styles.iconRow}>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() =>
                      Linking.openURL(`whatsapp://send?text=Join me using my referral code: ${userReferralCode}`)
                    }
                  >
                    <Image source={require('../assets/images/icon_wa.png')} style={styles.shareIcon} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() =>
                      Linking.openURL(`sms:?body=Join me using my referral code: ${userReferralCode}`)
                    }
                  >
                    <Image source={require('../assets/images/icon_sms.png')} style={styles.shareIcon} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() =>
                      Linking.openURL(`tg://msg?text=Join me using my referral code: ${userReferralCode}`)
                    }
                  >
                    <Image source={require('../assets/images/icon_tel.png')} style={styles.shareIcon} />
                  </TouchableOpacity>
                </View>
              </LinearGradient>

            </View>

          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  // Same values as referral_code.tsx so the card reads identically on both screens.
  claimBox: {
    width: '100%',
    marginTop: 18,
    padding: 16,
    borderRadius: 15,
    backgroundColor: '#1B202CAA',
    borderWidth: 1,
    borderColor: '#2E3646',
  },
  claimTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  claimBody: { color: '#9AA6B8', fontSize: 12.5, marginTop: 4, marginBottom: 12, lineHeight: 17 },
  claimInput: {
    height: 46,
    borderRadius: 10,
    paddingHorizontal: 14,
    color: '#fff',
    fontSize: 16,
    letterSpacing: 2,
    backgroundColor: '#11151E',
    borderWidth: 1,
    borderColor: '#2E3646',
  },
  claimError: { color: '#FF8A8A', fontSize: 12, marginTop: 8 },
  claimBtn: {
    marginTop: 12,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#2ACFEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimBtnText: { color: '#0B1220', fontSize: 14, fontWeight: '800' },
  claimDone: {
    width: '100%',
    marginTop: 18,
    padding: 14,
    borderRadius: 15,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.4)',
  },
  claimDoneText: { color: '#DCFCE7', fontSize: 13.5, fontWeight: '700', textAlign: 'center' },
  screenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  formBox: {
    width: Platform.OS === 'ios' ? '100%' : 'auto',
    borderRadius: 16,
    padding: 16,
  },
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  safeArea: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  bitcoinLogo: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bitcoinImage: {
    width: '100%',
    height: '100%',
    transform: [{ rotate: '3deg' }],
  },
  formContainer: {
    marginBottom: 1,
    width: 300
  },
  loginButton: {
    borderRadius: 15,
    marginTop: 20,
    marginBottom: 45,
    height: 45,
    width: 160,
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
  },
  loginButtonInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  referralTitle: {
    color: '#4ACDFC',
    fontSize: 14,
    marginBottom: 6,
    marginLeft: 10,
  },

  referralBox: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderRadius: 15,
    minHeight: 100,
    minWidth: 200
  },

  referralCode: {
    fontSize: 40,
    color: '#4ACDFC',
    fontWeight: 'bold',
  },

  underline: {
    width: '100%',
    height: 1,
    backgroundColor: '#fff',
    marginTop: 5
  },

  tapToCopy: {
    color: '#ffffff',
    fontSize: 10,
    opacity: 0.7,
    marginTop: 5,
    textAlign: 'center',
  },

  earnText: {
    color: '#fff',
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 18,
  },

  earnHighlight: {
    color: '#6AF3FC',
    fontWeight: '700',
  },

  skipButton: {
    borderRadius: 70,
    marginTop: 20,
    justifyContent: "center",
    alignItems: "center",
    minHeight: Platform.OS === 'ios' ? 40 : 45,
    width: 150
  },

  skipButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 5,
    backgroundColor: 'transparent',
  },

  backButton: {
    marginRight: 5,
    marginTop: Platform.OS === 'ios' ? 0 : 40
  },

  headerTitle: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '600',
  },

  shareBox: {
    width: '90%',
    alignSelf: 'center',
    marginVertical: 25,
    borderRadius: 16,
    paddingVertical: Platform.OS === 'ios' ? 0 : 20,
    minHeight: Platform.OS === 'ios' ? 150 : 130,
    justifyContent: 'center',
  },

  shareTitle: {
    color: '#4ACDFC',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
  },

  shareSubtitle: {
    color: '#FFFFFFAA',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 18,
  },

  iconRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },

  iconButton: {
    width: 55,
    height: 55,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
    overflow: 'hidden',
  },

  shareIcon: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
});

export default InternalReferralScreen;

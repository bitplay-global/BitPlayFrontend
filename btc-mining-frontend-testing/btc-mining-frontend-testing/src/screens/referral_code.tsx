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
import AsyncStorage from '@react-native-async-storage/async-storage';
const { width, height } = Dimensions.get('window');

interface ReferralScreenProps { }

const ReferralScreen: React.FC<ReferralScreenProps> = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [userReferralCode, setUserReferralCode] = useState<string>(''); // Default fallback
  const { login } = useAuth();

  const route = useRoute();

  // Safely extract route params with fallbacks
  const routeParams = route.params as { token?: string; user?: any; fromLogin?: boolean; isNewUser?: boolean } | undefined;
  const { token = '', user = null, fromLogin = false, isNewUser = false } = routeParams || {};

  // A social sign-in that CREATED the account had no chance to supply a
  // referral code: the Login screen has no such field, so anyone invited by a
  // friend who tapped "Login with Google" was permanently unattributable.
  // Offer the code here instead. The backend applies it write-once.
  const [inviteCode, setInviteCode] = useState('');
  const [claiming, setClaiming] = useState(false);
  // An account that already has a referrer gets the confirmation state rather
  // than an input that can only fail: the backend applies a code write-once.
  const hasReferrer =
    !!user?.referralUsed && String(user.referralUsed).trim().toLowerCase() !== 'null';
  const [claimed, setClaimed] = useState(hasReferrer);
  const [claimError, setClaimError] = useState('');

  const applyInviteCode = async () => {
    const code = inviteCode.trim();
    if (!code) { setClaimError('Enter the code your friend gave you.'); return; }
    setClaiming(true);
    setClaimError('');
    try {
      const res = await apiRequest(API_ENDPOINTS.REFERRAL_CLAIM, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: JSON.stringify({ referral_code: code.toLowerCase() }),
      });
      if (res?.success) {
        setClaimed(true);
      } else {
        setClaimError(res?.message || 'Could not apply that code.');
      }
    } catch (e: any) {
      setClaimError(e?.message || 'Could not apply that code.');
    } finally {
      setClaiming(false);
    }
  };


  type ReferralScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

  const navigation = useNavigation<ReferralScreenNavigationProp>();

  // Initialize Google Sign-In and load referral code when component mounts
  React.useEffect(() => {
    // initializeGoogleSignIn();

    // Load user's referral code
    const loadReferralCode = () => {
      // First try to get from user object passed in route params
      if (user && user.referralCode) {
        setUserReferralCode(user.referralCode);
      } else {
        // Fallback to AsyncStorage
        const savedCode = getReferralCode();
        if (savedCode) {
          setUserReferralCode(savedCode);
        }
      }
    };

    loadReferralCode();
  }, [user]);

  const handleSocialShareSuccess = () => {
    Alert.alert(
      'Shared Successfully',
      'Your referral code has been shared!',
      [{ text: 'OK' }]
    );
  };

  const handleSocialShareError = (error: string) => {
    Alert.alert('Share Error', error, [{ text: 'OK' }]);
  };

  async function handleSkip(): Promise<void> {
    try {

      if (!token || !user) {
        // console.error('Missing token or user data');
        Alert.alert('Account Created, Please login to continue.');
        navigation.navigate('Login');
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
        return;
      }

      await login(token, user);

      // Fire onboarding_completed only once per account
      try {
        const key = `apptrove_onboarding_completed_${user?.id}`;
        const alreadyFired = await AsyncStorage.getItem(key);
        if (!alreadyFired) {
          await AsyncStorage.setItem(key, '1');
        }
      } catch {}

      navigation.replace('Main');
      // After authentication, navigation will be handled by AuthProvider
      // User will automatically be redirected to Main screen
    } catch (error) {
      Alert.alert('Error', 'Failed to complete authentication. Please try again.');
    }
  }

  const copyReferralCode = () => {
    Clipboard.setString(userReferralCode);
    Alert.alert('Copied!', 'Referral code copied to clipboard', [{ text: 'OK' }]);
  };

  const handleInvite = async () => {
    try {
      const downloadUrl = Platform.select({
        default: 'https://bitplaypro.com/download',
      });
      const result = await Share.share({
        message: `Join me on BitPlay Pro, the cloud mining app. Use my invitation code: ${userReferralCode}\n\nDownload the app: ${downloadUrl}`,
        title: 'Join BitPlay Pro',
      });

      if (result.action === Share.sharedAction) {
        if (result.activityType) {
        } else {
        }
      } else if (result.action === Share.dismissedAction) {
      }
    } catch (error) {
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

              <TouchableOpacity onPress={copyReferralCode} activeOpacity={0.8} style={{ borderRadius: 15, overflow: "hidden" }}>
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

              {/* Shown to everyone, not just accounts created moments ago: a user
                  who was invited but reached this screen any other way still
                  needs somewhere to enter the code. The backend applies it
                  write-once and rejects an account that already has one. */}
              {!claimed && (
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
              )}

              {claimed && (
                <View style={styles.claimDone}>
                  <Text style={styles.claimDoneText}>Invite code applied</Text>
                </View>
              )}

              {/* Invite Section */}
              <TouchableOpacity
                style={{ borderRadius: 15, overflow: "hidden", alignSelf: "center" }}
                onPress={handleInvite}
                disabled={isLoading}
                activeOpacity={0.8}
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

              {/* Skip Button */}
              <TouchableOpacity
                onPress={handleSkip}
                activeOpacity={0.8}
                style={{ borderRadius: 30, alignSelf: "center" }}
              >
                <LinearGradient
                  colors={['#2ACFEF', '#BD85FC']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.skipButton}
                >
                  <Text style={styles.skipButtonText}>SKIP FOR NOW</Text>
                </LinearGradient>
              </TouchableOpacity>

            </View>

          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  formBox: {
    width: '100%',
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
  },
  loginButton: {
    borderRadius: 15,
    marginTop: 20,
    marginBottom: 20,
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

  learnMore: {
    color: '#6AF3FC',
    textDecorationLine: 'underline',
  },

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

export default ReferralScreen;

import React, { useEffect, useState } from 'react';
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
  ImageBackground,
  Alert,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../components/types';
import LinearGradient from 'react-native-linear-gradient';
import { apiRequest, API_ENDPOINTS } from '../config/api';
import { getPendingReferralCode, clearPendingReferralCode } from '../utils/referralLink';
import { Image } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { getUser, getSession } from '../auth/auth';
import {
  trackSignupCompleted,
} from '../services/apptroveAnalytics';
import { trackMmpSignupCompleted } from '../services/mmpAnalytics';

interface SignUpScreenProps { }

type SignUpScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SignUp'>;

const SignUpScreen: React.FC<SignUpScreenProps> = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const [referral_code, setReferral] = useState('');
  const [referralError, setReferralError] = useState('');

  // Prefill from an invite link, so the invitee does not have to retype a code
  // they were already sent. Left editable, and cleared once used.
  useEffect(() => {
    const pending = getPendingReferralCode();
    if (pending) setReferral(pending);
  }, []);

  const [password, setPassword] = useState('');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation<SignUpScreenNavigationProp>();

  const { login, loginWithApple, loginWithGoogle } = useAuth();

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string): boolean => {
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    // Check for any character that is not a letter or number (i.e. a symbol)
    const hasSymbol = /[^a-zA-Z0-9]/.test(password);
    return password.length >= 8 && hasLetter && hasNumber && hasSymbol;
  };

  const validateName = (name: string): boolean => {
    return name.trim().length >= 2;
  };

  const handleSignUp = async () => {
    // Reset errors
    setNameError('');
    setEmailError('');
    setPasswordError('');

    // Validate inputs
    let isValid = true;

    if (!name) {
      setNameError('Name is required');
      isValid = false;
    } else if (!validateName(name)) {
      setNameError('Name must be at least 2 characters');
      isValid = false;
    }

    if (!email) {
      setEmailError('Email is required');
      isValid = false;
    } else if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Password is required');
      isValid = false;
    } else if (!validatePassword(password)) {
      setPasswordError('Password must be 8+ chars with a letter, number, and symbol');
      isValid = false;
    }

    if (!isValid) return;

    setIsLoading(true);

    try {
      // Call backend API using new configuration
      const data = await apiRequest(API_ENDPOINTS.REGISTER, {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          email: email.toLowerCase(),
          password: password,
          referral_code: referral_code.trim().toLowerCase(),
        }),
      });

      setIsLoading(false);

      if (data.success) {
        clearPendingReferralCode(); // consumed -- do not prefill a later signup
        trackSignupCompleted(String(data.user?.id ?? ''), 'email');
        trackMmpSignupCompleted(String(data.user?.id ?? ''), 'email');
        Alert.alert('Success', 'Account created successfully! Please verify your email.', [
          {
            text: 'OK',
            onPress: () => navigation.navigate('OTPVerification', {
              email: email.toLowerCase(),
              type: 'email_verification',
              user: data.user,
              token: data.token
            }),
          },
        ]);
      } else {
        Alert.alert('Error', data.message || 'Registration failed');
      }
    } catch (error: any) {
      setIsLoading(false);
      Alert.alert('Error', error.message || 'Network error. Please check your connection.');
    }
  };

  return (
    <ImageBackground
      source={require('../assets/images/bg_pattern1.png')}
      style={[styles.backgroundImage, { backgroundColor: '#1B202C' }]}
      resizeMode="cover">

      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ flex: 1, justifyContent: 'center' }}>

              {/* Logo */}
              <View style={styles.logoContainer}>
                <View style={styles.bitcoinLogo}>
                  <Image
                    source={require('../assets/images/main_app_icon.png')}
                    style={styles.bitcoinImage}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.logoTagline}>Cloud Mining Made Simple</Text>
              </View>

              {/* Form Box */}
              <LinearGradient
                colors={['#1B202CAA', '#2E3646AA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ borderRadius: 16, padding: Platform.OS === 'ios' ? 20 : 10 }}
              >
                <View style={styles.signup_input}>

                  {/* Name */}
                  <View style={{ marginBottom: 15 }}>
                    <View style={styles.inputWrapper}>
                      <Image source={require('../assets/images/icon_input_box_user.png')} style={styles.inputIconImage} />
                      <TextInput
                        style={{ ...styles.input, flex: 1 }}
                        placeholder="NAME"
                        placeholderTextColor="#888"
                        value={name}
                        onChangeText={(text) => {
                          setName(text);
                          if (nameError) setNameError('');
                        }}
                        autoCapitalize="words"
                        autoCorrect={false}
                      />
                    </View>
                    {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
                  </View>

                  {/* Email */}
                  <View style={{ marginBottom: 15 }}>
                    <View style={styles.inputWrapper}>
                      <Image source={require('../assets/images/icon_input_box_email.png')} style={styles.inputIconImage} />
                      <TextInput
                        style={{ ...styles.input, flex: 1 }}
                        placeholder="EMAIL"
                        placeholderTextColor="#888"
                        value={email}
                        onChangeText={(text) => {
                          setEmail(text);
                          if (emailError) setEmailError('');
                        }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                    {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
                  </View>

                  {/* Password */}
                  <View style={{ marginBottom: 15 }}>
                    <View style={styles.inputWrapper}>
                      <Image source={require('../assets/images/icon_input_box_pass.png')} style={styles.inputIconImage} />
                      <TextInput
                        style={{ ...styles.input, flex: 1 }}
                        placeholder="PASSWORD"
                        placeholderTextColor="#888"
                        value={password}
                        onChangeText={(text) => {
                          const noWhitespace = text.replace(/\s/g, '');
                          setPassword(noWhitespace);
                          if (passwordError) setPasswordError('');
                        }}
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                    {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
                  </View>

                  <View style={{ marginBottom: 15 }}>
                    <View style={styles.inputWrapper}>
                      <Image source={require('../assets/images/icon_input_box_pass.png')} style={styles.inputIconImage} />
                      <TextInput
                        style={{ ...styles.input, flex: 1 }}
                        placeholder="REFERRAL (OPTIONAL)"
                        placeholderTextColor="#888"
                        value={referral_code}
                        onChangeText={(text) => {
                          setReferral(text);
                          if (referralError) setReferralError('');
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                    {referralError ? <Text style={styles.errorText}>{referralError}</Text> : null}
                  </View>

                  {/* Signup Button */}
                  <TouchableOpacity
                    style={styles.loginButton}
                    onPress={handleSignUp}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#2ACFEF', '#BD85FC']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.loginButtonGradient}
                    >
                      <Text style={styles.loginButtonText}>
                        {isLoading ? 'SIGNING IN...' : 'SIGNUP'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Already a user */}
                  <TouchableOpacity
                    style={{ marginTop: 10, alignItems: 'center' }}
                    onPress={() => navigation.navigate('Login' as never)}
                  >
                    <Text style={{ color: 'white', paddingBottom: Platform.OS === 'ios' ? 40 : 10, fontWeight: '600', marginLeft: Platform.OS === 'ios' ? '-15%' : 0 }}>Already a user? <Text style={styles.signUpLink}>Sign In</Text></Text>
                  </TouchableOpacity>

                </View>

              </LinearGradient>

              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or continue with</Text>
                <View style={styles.dividerLine} />
              </View>

              {Platform.OS === 'ios' ? (
                <View style={styles.socialButtonsRow}>
                  <TouchableOpacity
                    style={[styles.socialButtonSmall, styles.googleBtn]}
                    onPress={async () => {
                      try {
                        const social = await loginWithGoogle(referral_code);
                        // Navigate after successful login
                        const user = await getUser();
                        if (user) {
                          navigation.replace('ReferralScreen', {
                            token: await getSession(),
                            user: user,
                            fromLogin: false,
                            isNewUser: social.isNewUser
                          });
                        }
                      } catch (error) {
                        // Error already handled in AuthProvider
                      }
                    }}
                    activeOpacity={0.85}
                    disabled={isLoading}
                  >
                    <Image
                      source={require('../assets/images/icon_google.png')}
                      style={styles.socialIconImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.socialButtonText}>Google</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.socialButtonSmall, styles.appleBtn]}
                    onPress={async () => {
                      try {
                        const social = await loginWithApple(referral_code);
                        // Navigate after successful login
                        const user = await getUser();
                        if (user) {
                          navigation.replace('ReferralScreen', {
                            token: await getSession(),
                            user: user,
                            fromLogin: false,
                            isNewUser: social.isNewUser
                          });
                        }
                      } catch (error) {
                        // Error already handled in AuthProvider
                      }
                    }}
                    activeOpacity={0.85}
                    disabled={isLoading}
                  >
                    <Image
                      source={require('../assets/images/icon_apple.png')}
                      style={styles.socialIconImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.socialButtonText}>Apple</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.socialButtonWide, styles.googleBtn, styles.marginbottom]}
                    onPress={async () => {
                      try {
                        const social = await loginWithGoogle(referral_code);
                        // Navigate after successful login
                        const user = await getUser();
                        if (user) {
                          navigation.replace('ReferralScreen', {
                            token: await getSession(),
                            user: user,
                            fromLogin: false,
                            isNewUser: social.isNewUser
                          });
                        }
                      } catch (error) {
                        // Error already handled in AuthProvider
                      }
                    }}
                    activeOpacity={0.85}
                    disabled={isLoading}
                  >
                    <Image
                      source={require('../assets/images/icon_google.png')}
                      style={styles.socialIconImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.socialButtonText}>Sign in with Google</Text>
                  </TouchableOpacity>
                </>
              )}

              <View style={styles.footer}>
                <Text style={styles.footerText}>BitPlayPro</Text>
              </View>

            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({

  formBox: {
    width: '100%',
    borderRadius: 16,
    padding: 16,
  },

  signup_input: {
    ...(Platform.OS === "ios" && Platform.isPad
      ? {
        width: 500,
        alignSelf: "center",
        justifyContent: "center",
        alignItems: "center",
      }
      : {}),
  },

  loginButtonGradient: {
    height: Platform.OS === 'ios' ? 40 : 50,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 25,
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
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Platform.OS === 'ios' ? 0 : 20,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },

  bitcoinLogo: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bitcoinImage: {
    width: '100%',
    height: '100%',
  },
  bitcoinSymbol: {
    fontSize: 80,
    color: '#8b45ff',
    fontWeight: 'bold',
  },
  formContainer: {
    marginBottom: 1,
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    height: 55,
    width: Platform.OS === 'ios' ? '90%' : '100%',
  },
  inputIcon: {
    fontSize: 16,
    marginRight: 12,
    color: '#8a8a8a',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
    letterSpacing: 0.5,
    textAlignVertical: 'center',
    includeFontPadding: false,
    paddingVertical: 0,
    margin: 0
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 12,
    marginTop: 5,
    marginLeft: 15,
  },
  loginButton: {
    borderRadius: 15,
    marginTop: 20,
    marginBottom: 20,
    height: 45,
    width: 160,
    alignSelf: 'center',
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
  signUpButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },


  forgotPasswordContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  forgotPasswordText: {
    color: '#42B0FF',
    fontSize: 16,
    fontWeight: '600',
  },
  signUpContainer: {
    alignItems: 'center',
  },
  loginText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '400',
  },
  loginLink: {
    color: '#00d4ff',
    marginTop: 0,
    fontWeight: '600',
  },
  signUpText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
  },
  signUpLink: {
    color: '#42B0FF',
    fontWeight: '600',
  },
  socialContainer: {
    alignItems: 'center'
  },
  socialText: {
    color: '#ffffff',
    fontSize: 12,
    marginBottom: 20,
    letterSpacing: 1.5,
    fontWeight: '500',
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  socialButton: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  facebookButton: {
    backgroundColor: '#3b5998',
  },
  googleButton: {
    backgroundColor: '#dd4b39',
  },
  linkedinButton: {
    backgroundColor: '#0077b5',
  },
  socialIcon: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    alignItems: 'center',
    position: 'absolute',
    bottom: -30,
    left: 0,
    right: 0,
  },
  footerText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '400'
  },
  testApiButton: {
    backgroundColor: '#333',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    marginTop: 20,
    alignSelf: 'center',
  },
  testApiText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  inputIconImage: {
    width: 20,
    height: 20,
    marginRight: 8,
  },
  logoTagline: {
    fontSize: 20,
    color: '#ffffffe5',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: 0.5,
    marginBottom: Platform.OS === 'ios' ? 10 : 30
  },
  socialLoginContainer: {
    paddingTop: 25,
    paddingBottom: 25,
    alignItems: 'center',
    width: '100%',
  },

  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    width: '80%',
    alignSelf: 'center',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  dividerText: {
    color: '#aaaaaa',
    fontSize: 13,
    marginHorizontal: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  socialButtonWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 12,
    marginVertical: 8,
    width: '80%',
    alignSelf: 'center',
  },

  googleBtn: {
    backgroundColor: '#2E3646', // matches your gradient tone
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },

  appleBtn: {
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },

  socialButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 10,
    letterSpacing: 0.3,
  },

  socialIconImage: {
    width: 22,
    height: 22,
  },
  socialButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    width: '80%',
    alignSelf: 'center',
    marginTop: 10,
  },

  socialButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    width: '45%',
  },
  marginbottom: {
    marginBottom: 100
  }
});

export default SignUpScreen;

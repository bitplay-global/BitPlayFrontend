import React, { useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { apiRequest, API_ENDPOINTS } from '../config/api';
import { testApiConnectivity, getApiInfo } from '../utils/testApi';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../components/types';
import BackgroundWrapper from '../components/BackgroundWrapper';
import { Image } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../auth/AuthProvider';
import { getUser, getSession } from '../auth/auth';
import {
  trackLogin,
} from '../services/apptroveAnalytics';
import { trackMmpLogin } from '../services/mmpAnalytics';
const { width, height } = Dimensions.get('window');

interface LoginScreenProps {}

const LoginScreen: React.FC<LoginScreenProps> = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, loginWithApple, loginWithGoogle } = useAuth();

  // Added state for showing/hiding password
  const [showPassword, setShowPassword] = useState(false);

  type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

  const navigation = useNavigation<LoginScreenNavigationProp>();

  // Initialize Google Sign-In when component mounts
  // React.useEffect(() => {
  //   initializeGoogleSignIn();
  // }, []);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string): boolean => {
    return password.length >= 6;
  };

  const handleLogin = async () => {
    // Reset errors
    setEmailError('');
    setPasswordError('');

    // Validate inputs
    let isValid = true;

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
      setPasswordError('Password must be at least 6 characters');
      isValid = false;
    }

    if (!isValid) return;

    setIsLoading(true);

    try {
      // Call backend API using new configuration
      const data = await apiRequest(API_ENDPOINTS.LOGIN, {
        method: 'POST',
        body: JSON.stringify({
          email: email.toLowerCase(),
          password: password,
        }),
      });

      setIsLoading(false);

      if (data.success) {
        trackLogin(String(data.user?.id ?? ''), 'email');
        trackMmpLogin(String(data.user?.id ?? ''), 'email');

        if (!data.user.isActive) {
          Alert.alert('Error', 'Your account is not active, please contact the admin');
          return;
        }

        // Check if user's email is verified
        if (data.user && data.user.emailVerified && !data.user.twofactor) {
          await login(data.token, data.user);
          navigation.replace('ReferralScreen', {
                token: data?.token,
                user: data.user,
                fromLogin: false
              });
        } else {
          navigation.replace('TwoFactorLoginScreen', {
            token: data.token,
            user: data.user,
          });
        }
      } else {

        // Check if email verification is required (status 403)
        if (data.emailVerified === false && data.user) {
          Alert.alert('Error', 'User Email Not Verified');
          // navigation.replace('OTPVerification', {
          //   email: email.toLowerCase(),
          //   type: 'email_verification',
          //   user: data.user,
          //   fromLogin: true
          // });
        } else {
          Alert.alert('Error', data.message || 'Login failed');
        }
      }
    } catch (error: any) {
      setIsLoading(false);
      Alert.alert('Error', error.message || 'Network error. Please check your connection.');
    }
  };

  const handleSignUpPress = () => {
    navigation.navigate('SignUp' as never);
  };

  const handleTestApi = async () => {
    const apiInfo = getApiInfo();
    const result = await testApiConnectivity();

    Alert.alert(
      'API Test Result',
      `URL: ${result.url}\nStatus: ${result.success ? 'Connected' : 'Failed'}\nMessage: ${result.message}\n\nConfig: ${apiInfo.isLocal ? 'Local' : 'Production'}`,
      [{ text: 'OK' }]
    );
  };


  const handleResendVerification = async (email: string) => {
    try {
      const data = await apiRequest(API_ENDPOINTS.RESEND_VERIFICATION, {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      if (data.success) {
        Alert.alert(
          'Success',
          'Verification email sent successfully. Please check your email.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', data.message || 'Failed to send verification email');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Network error. Please try again.');
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
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <View style={styles.content}>
            {/* Bitcoin Logo */}
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

            <View style={styles.screenContainer}>
              {/* Gradient Form Box */}
              <LinearGradient
                colors={['#1B202CAA', '#2E3646AA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.formBox}
              >

                <View style={styles.formContainer}>
                  {/* Email Input */}
                  <View style={styles.inputContainer}>
                    <View style={styles.inputWrapper}>
                      <Image
                        source={require('../assets/images/icon_input_box_user.png')}
                        style={styles.inputIconImage}
                        resizeMode="contain"
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="EMAIL"
                        placeholderTextColor="#aaaaaa"
                        value={email}
                        onChangeText={(text) => {
                          setEmail(text);
                          if (emailError) setEmailError('');
                        }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        selectionColor="#00d4ff"
                        underlineColorAndroid="transparent"
                      />
                    </View>
                    {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
                  </View>

                  {/* Password Input */}
                  <View style={styles.inputContainer}>
                    <View style={styles.inputWrapper}>
                      <Image
                        source={require('../assets/images/icon_input_box_pass.png')}
                        style={styles.inputIconImage}
                        resizeMode="contain"
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="PASSWORD"
                        placeholderTextColor="#aaaaaa"
                        value={password}
                        onChangeText={(text) => {
                          setPassword(text);
                          if (passwordError) setPasswordError('');
                        }}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        selectionColor="#00d4ff"
                        underlineColorAndroid="transparent"
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword((prev) => !prev)}
                        style={styles.showPasswordToggle}
                        activeOpacity={0.7}
                        accessible
                        accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                      >
                        <Icon
                          name={showPassword ? "eye" : "eye-off"}
                          size={20}
                          color="#9CA3AF"
                          style={styles.eyeIconImage}
                        />
                      </TouchableOpacity>
                    </View>
                    {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
                  </View>

                  {/* Login Button */}
                  <TouchableOpacity 
                    style={styles.loginButton} 
                    onPress={handleLogin} 
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
                        {isLoading ? 'SIGNING IN...' : 'LOG IN'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Sign Up Link */}
                  <TouchableOpacity style={styles.signUpContainer} onPress={handleSignUpPress}>
                    <Text style={styles.signUpText}>
                      Don't have an account? <Text style={styles.signUpLink}>Sign Up</Text>
                    </Text>
                  </TouchableOpacity>

                  {/* Forgot Password Link */}
                  <TouchableOpacity
                    style={styles.forgotPasswordContainer}
                    onPress={() => navigation.navigate('ForgotPassword', {screen_heading: 'Forgot Password'})}
                  >
                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                  </TouchableOpacity>
                </View>


              </LinearGradient>

            </View>
            
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
                      const social = await loginWithGoogle();
                      // Navigation will be handled by useEffect watching authenticated state
                      // Or navigate directly after successful login
                      const user = await getUser();
                      if (user) {
                        navigation.replace('ReferralScreen', {
                          token: await getSession(),
                          user: user,
                          fromLogin: true,
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
                      const social = await loginWithApple();
                      // Navigation will be handled by useEffect watching authenticated state
                      // Or navigate directly after successful login
                      const user = await getUser();
                      if (user) {
                        navigation.replace('ReferralScreen', {
                          token: await getSession(),
                          user: user,
                          fromLogin: true,
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
                  style={[styles.socialButtonWide, styles.googleBtn]}
                  onPress={async () => {
                    try {
                      const social = await loginWithGoogle();
                      // Navigation will be handled by useEffect watching authenticated state
                      // Or navigate directly after successful login
                      const user = await getUser();
                      if (user) {
                        navigation.replace('ReferralScreen', {
                          token: await getSession(),
                          user: user,
                          fromLogin: true,
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

            {/* Footer */}
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
  screenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },

  formBox: {
    width: '100%',
    borderRadius: 16,
    padding: 16,
    height: "100%",
  },

  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  backgroundPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1a1a2e',
  },
  safeArea: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20, 
  },
  content: {
    flex: 1,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: '5%'
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
    marginTop: 30
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
    // add paddingRight for the eye icon
    paddingRight: 38,
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
    margin: 0,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 12,
    marginTop: 5,
    marginLeft: 15,
  },
  loginButton: {
    borderRadius: 25,
    overflow: "hidden",
    width: Platform.OS === 'ios' ? '45%' : '50%', 
    alignSelf: "center",
    marginVertical: 10,
    marginBottom: Platform.OS === 'ios' ? '10%' : "5%",
    marginLeft: Platform.OS === 'ios' ? '-10%' : 0,
    marginTop: 30
  },

  loginButtonGradient: {
    height: Platform.OS === 'ios' ? 40 : 50,       
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 25,
  },

  loginButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  loginButtonInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forgotPasswordContainer: {
    alignItems: 'center',
    paddingVertical: 10,
    marginLeft: Platform.OS === 'ios' ? '-10%' : 0
  },
  forgotPasswordText: {
    color: '#42B0FF',
    fontSize: 16,
    fontWeight: '600',
    paddingBottom: Platform.OS === 'ios' ? '8%' : 0
  },
  signUpContainer: {
    alignItems: 'center',
    marginLeft: Platform.OS === 'ios' ? '-10%' : 0
  },
  signUpText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '400',
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
    bottom: -35,
    left: 0,
    right: 0,
  },
  footerText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '400',
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
  // Add styles for the eye icon and password toggle
  showPasswordToggle: {
    position: 'absolute',
    right: 12,
    padding: 5,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    // width: 30,
    zIndex: 2,
  },
  eyeIconImage: {
    width: 22,
    height: 22,
    tintColor: '#aaaaaa',
  },
  logoTagline: {
    fontSize: 20,
    color: '#ffffffe5',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: 0.5,
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
    backgroundColor: '#2E3646',
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
});

export default LoginScreen;
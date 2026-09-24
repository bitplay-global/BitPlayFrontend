import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  ScrollView,
  ImageBackground,
  Platform,
  Alert,
  StatusBar,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { API_BASE_URL } from '../config/api';
import { Image } from 'react-native';
import BackgroundWrapper from '../components/BackgroundWrapper';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../components/types';
import LottieView from 'lottie-react-native';
import { useAuth } from '../auth/AuthProvider';

interface ChangePasswordScreenProps {}

type ChangePasswordNavigationProp = StackNavigationProp<RootStackParamList, 'ChangePasswordScreen'>;

const ChangePasswordScreen: React.FC<ChangePasswordScreenProps> = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const route = useRoute();
  const { email, resetToken } = route.params as { email: string; resetToken: string };

  const { user, logout } = useAuth();

  const navigation = useNavigation<ChangePasswordNavigationProp>();

  const validatePassword = (password: string): boolean => {
    return password.length >= 6;
  };

  const handleChangePassword = async () => {
    // Reset errors
    setPasswordError('');
    setConfirmPasswordError('');

    // Validate inputs
    let isValid = true;

    if (!password) {
      setPasswordError('Password is required');
      isValid = false;
    } else if (!validatePassword(password)) {
      setPasswordError('Password must be at least 6 characters');
      isValid = false;
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Confirm password is required');
      isValid = false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      isValid = false;
    }

    if (!isValid) return;

    setIsLoading(true);

    try {
      // For demo/testing purposes, we'll generate a mock reset token
      // In production, this would come from the email link
      let actualResetToken = resetToken;


      // Make actual API call to reset password
      const response = await fetch(`${API_BASE_URL}/api/auth/resetpassword/${email}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {

        Alert.alert(
          'Success',
          'Password changed successfully! You can now login with your new password.',
          [
            {
              text: 'OK',
              onPress: async () => {
                await logout();

                navigation.replace('Login')
              },
            },
          ]
        );
      } else {

        Alert.alert('Error', data.message);
      }
    } catch (error: any) {
      Alert.alert('Error', 'Network error. Please try again. For testing, you can use "demo" or "1234" as the reset token.');
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
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <View style={styles.content}>
            {/* Logo */}
            <View style={styles.animationView}>
             
              <LottieView
                source={{ uri: 'https://lottie.host/1b56f6ce-894f-4006-9f98-738f22a79da1/9Iz9LxZLjw.json' }}
                autoPlay
                loop
                style={styles.animation}
              />
  
            </View>

            {/* Title */}
            <View style={styles.titleContainer}>
              <Text style={styles.title}>CHANGE PASSWORD</Text>
              <Text style={styles.subtitle}>
                Enter your new password
              </Text>
            </View>

             {/* Gradient Form Box */}
                          <LinearGradient
                            colors={['#1B202CAA', '#2E3646AA']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            // style={styles.formBox}
                          >

            {/* Form Container */}
            <View style={styles.formContainer}>
              {/* Password Input */}
              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                 <Image
                                         source={require('../assets/images/icon_input_box_p.png')}
                                         style={styles.inputIconImage}
                                         resizeMode="contain"
                                       />
                  <TextInput
                    style={styles.input}
                    placeholder="PASSWORD"
                    placeholderTextColor="#8a8a8a"
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (passwordError) setPasswordError('');
                    }}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    selectionColor="#00d4ff"
                    underlineColorAndroid="transparent"
                  />
                </View>
                {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
              </View>

              {/* Confirm Password Input */}
              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <Image
                                         source={require('../assets/images/icon_input_box_p.png')}
                                         style={styles.inputIconImage}
                                         resizeMode="contain"
                                       />
                  <TextInput
                    style={styles.input}
                    placeholder="CONFIRM PASSWORD"
                    placeholderTextColor="#8a8a8a"
                    value={confirmPassword}
                    onChangeText={(text) => {
                      setConfirmPassword(text);
                      if (confirmPasswordError) setConfirmPasswordError('');
                    }}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    selectionColor="#00d4ff"
                    underlineColorAndroid="transparent"
                  />
                </View>
                {confirmPasswordError ? <Text style={styles.errorText}>{confirmPasswordError}</Text> : null}
              </View>

              {/* Set Password Button */}

              <TouchableOpacity activeOpacity={0.8} onPress={handleChangePassword}>
                <LinearGradient
                  colors={["#22D3EE", "#C084FC"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.setPasswordButton}
                >
                  <View style={styles.setPasswordButtonInner}>
                    <Text style={styles.setPasswordButtonText}>{isLoading ? 'SETTING...' : 'SET PASSWORD'}</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              {/* Back to Login */}
              <View style={styles.backContainer}>
                <TouchableOpacity onPress={() => navigation.reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                })}>
                  <Text style={styles.backText}>Back to Login</Text>
                </TouchableOpacity>
              </View>
            </View>
</LinearGradient>

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
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 40,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: Platform.OS === 'ios' ? 0 : 50,
  },

  bitcoinLogo: {
    width: 90,
    height: 90,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  bitcoinImage: {
    width: '80%',
    height: '80%',
    transform: [{ rotate: '3deg' }],
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00d4ff',
    letterSpacing: 1.5,
    marginBottom: 15,
  },
  subtitle: {
    fontSize: 13,
    color: '#8a8a8a',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  formContainer: {
    margin: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 18,
    height: 55,
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
  setPasswordButton: {
    borderRadius: 15,
    marginTop: 20,
    marginBottom: 20,
    height: 45,
    width: 160,
    alignSelf: 'center',
  },
  setPasswordButtonInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setPasswordButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  backContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  backText: {
    color: '#8a8a8a',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  footer: {
    alignItems: 'center',
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
  },
  footerText: {
    color: '#8a8a8a',
    fontSize: 12,
    fontWeight: '400',
  },backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  inputIconImage: {
    width: 20,
    height: 20,
    marginRight: 8,
  },
  animationView: {
    textAlign: "center",
    alignItems: "center",
    marginBottom: 30
  },
  animation: {
    height: 170,
    width: 170,
  }
});

export default ChangePasswordScreen;

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
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../components/types';
import LinearGradient from 'react-native-linear-gradient';
import { apiRequest, API_ENDPOINTS } from '../config/api';
import { Image } from 'react-native';
import BackgroundWrapper from '../components/BackgroundWrapper';
import LottieView from 'lottie-react-native';

interface OTPVerificationScreenProps {}

type OTPVerificationScreenNavigationProp = StackNavigationProp<RootStackParamList, 'OTPVerification'>;
type OTPVerificationScreenRouteProp = RouteProp<RootStackParamList, 'OTPVerification'>;

const OTPVerificationScreen: React.FC<OTPVerificationScreenProps> = () => {
 const [otp, setOtp] = useState('');
   const [otpError, setOtpError] = useState('');
   const [isLoading, setIsLoading] = useState(false);
   const navigation = useNavigation<OTPVerificationScreenNavigationProp>();
   const route = useRoute<OTPVerificationScreenRouteProp>();
   const { email, type, user, token, fromLogin } = route.params;
 
   const handleVerifyOTP = async () => {

     // Reset errors
     setOtpError('');

     // Validate OTP
     if (!otp) {
       setOtpError(type === 'email_verification' ? 'Verification code is required' : 'Reset token is required');
       return;
     }

     if (otp.length < 6) {
       setOtpError(type === 'email_verification' ? 'Please enter a valid 6-digit OTP' : 'Please enter a valid reset token');
       return;
     }

     setIsLoading(true);

    try {

      if (type === 'update_email') {
        const data = await apiRequest(`${API_ENDPOINTS.UPDATE_EMAIL}`, {
          method: 'POST',
          body: JSON.stringify({ 
            email: user?.email ?? "", 
            new_email: email,
            otp: otp
          }),
        });

        if (data.success) {

          Alert.alert('Email Changed', 'Your email has been changed successfully!', [{
            text: 'OK',
            onPress: () => {

              navigation.replace('Main');
              
            },
          },]);
        }

        return;
      }

      const data = await apiRequest(`${API_ENDPOINTS.VERIFY_EMAIL_OTP}/${otp}/${encodeURIComponent(email)}`, {
        method: 'GET',
      });

      if (data.success) {

        Alert.alert('Email Verified', 'Your email has been verified successfully!', [
          {
            text: 'OK',
            onPress: () => {

              if (type === 'email_verification') {
                navigation.replace('ReferralScreen', {
                  user: user || data.user,
                  token: token || data.token || '',
                  fromLogin: fromLogin || false
                });
              } 
                else {
                navigation.replace('ChangePassword', { email, resetToken: otp });
              }
              
            },
          },
        ]);
      } else {
        setOtpError(data.message || 'Invalid verification code');
      }
    } catch (error: any) {
      setOtpError(error.message || 'Verification failed. Please try again.');
    }
      finally {
       setIsLoading(false);
     }
   };
 
   const handleResendOTP = async () => {
     try {
       const data = await apiRequest(API_ENDPOINTS.FORGOT_PASSWORD, {
         method: 'POST',
         body: JSON.stringify({ email }),
       });
 
       if (data.success) {
         Alert.alert('Success', 'New OTP sent to your email');
       } else {
         Alert.alert('Error', 'Failed to resend OTP');
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
                source={{ uri: 'https://lottie.host/e344747b-67eb-45c3-96ca-5cbc74cd0472/fwLXvu5qhc.json' }}
                autoPlay
                loop
                style={styles.animation}
              />
  
            </View>
 
             {/* Title */}
             <View style={styles.titleContainer}>
               <Text style={styles.title}>
                 {type === 'email_verification' ? 'VERIFY EMAIL' : 'VERIFY OTP'}
               </Text>
               <Text style={styles.subtitle}>
                 {type === 'email_verification'
                   ? `Enter the 6-digit OTP`
                   : `Check your email for the reset password otp`
                 }
               </Text>
             </View>

             
             {/* Gradient Form Box */}
                           <LinearGradient
                             colors={['#1B202CAA', '#2E3646AA']}
                             start={{ x: 0, y: 0 }}
                             end={{ x: 1, y: 1 }}
                             style={styles.formBox}
                           >

 
             {/* Form Container */}
             <View style={styles.formContainer}>



               {/* OTP Input */}
               <View style={styles.inputContainer}>
                 <View style={styles.inputWrapper}>
                   <Image
                                           source={require('../assets/images/icon_input_box_pas_s.png')}
                                           style={styles.inputIconImage}
                                           resizeMode="contain"
                                         />
                   <TextInput
                     style={styles.input}
                     placeholder={type === 'email_verification' ? '6-Digit OTP' : 'OTP'}
                     placeholderTextColor="#8a8a8a"
                     value={otp}
                     onChangeText={(text) => {
                       setOtp(text);
                       if (otpError) setOtpError('');
                     }}
                     autoCapitalize="none"
                     autoCorrect={false}
                   />
                 </View>
                 {otpError ? <Text style={styles.errorText}>{otpError}</Text> : null}
               </View>
 
 
               {/* Verify Button */}

               <TouchableOpacity activeOpacity={0.8} onPress={handleVerifyOTP}>
                  <LinearGradient
                    colors={["#22D3EE", "#C084FC"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.verifyButton}
                  >
                    <View style={styles.verifyButtonInner}>
                      <Text style={styles.verifyButtonText}>{isLoading ? 'VERIFYING...' : 'VERIFY'}</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
 
               {/* Resend OTP */}
               <View style={styles.resendContainer}>
                 <Text style={styles.resendText}>
                   {type === 'email_verification' ? "Didn't receive the code? " : "Didn't receive the otp? "}
                 </Text>
                 <TouchableOpacity onPress={handleResendOTP}>
                   <Text style={styles.resendLink}>Resend</Text>
                 </TouchableOpacity>
               </View>
 
               {/* Back to Login */}
               <View style={styles.backContainer}>
                 <TouchableOpacity onPress={() => navigation.replace('Login')}>
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
    paddingHorizontal: Platform.OS === 'ios' ? 0 : 40,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  bitcoinLogo: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bitcoinImage: {
    width: '100%',
    height: '100%',
    marginBottom: 40,
    transform: [{ rotate: '3deg' }],
  },
  bitcoinSymbol: {
    fontSize: 35,
    color: '#8b45ff',
    fontWeight: 'bold',
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
    marginBottom: 60,
  },
  inputContainer: {
    margin: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(3, 3, 3, 0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 15,
    paddingVertical: 18,
    height: 55,
    width: Platform.OS === 'ios' ? "92%" : "100%"
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
  
  verifyButton: {
    borderRadius: 15,
    marginTop: 0,
    marginBottom: 20,
    height: 45,
    width: 160,
    alignSelf: 'center',
    marginLeft: Platform.OS === 'ios' ? "-10%" : 0
  },
  verifyButtonInner: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  verifyButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  resendText: {
    color: '#8a8a8a',
    fontSize: 13,
    marginLeft: Platform.OS === 'ios' ? "-10%" : 0
  },
  resendLink: {
    color: '#00d4ff',
    fontSize: 13,
    fontWeight: '600'
  },
  backContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginLeft: Platform.OS === 'ios' ? "-10%" : 0
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
  formBox: {
    width: '100%',
    borderRadius: 16,
    padding: 16,
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

export default OTPVerificationScreen;

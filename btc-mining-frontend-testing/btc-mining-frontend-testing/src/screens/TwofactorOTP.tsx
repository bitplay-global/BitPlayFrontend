import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  ImageBackground,
  Platform,
  Alert,
  StatusBar,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { apiRequest, API_ENDPOINTS } from '../config/api';
import { Image } from 'react-native';
import BackgroundWrapper from '../components/BackgroundWrapper';
import { RootStackParamList } from '../components/types';
import { StackNavigationProp } from '@react-navigation/stack';

interface TwofactorOTPProps {}

const TwofactorOTP: React.FC<TwofactorOTPProps> = () => {

    type TwofactorOTPProp = StackNavigationProp<RootStackParamList, 'TwofactorOTP'>;

    const navigation = useNavigation<TwofactorOTPProp>();

    const [otp, setOtp] = useState('');
    const [otpError, setOtpError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const route = useRoute();

    const { token, user } = route.params as { token: string; user: any };
 
   const handleVerifyOTP = async () => {
     // Reset errors
     setOtpError('');
 
     // Validate OTP
     if (!otp) {
       setOtpError('Reset token is required');
       return;
     }
 
     if (otp.length < 4) {
       setOtpError('Please enter a valid reset token');
       return;
     }
 
     setIsLoading(true);
 
     try {
       // For demo purposes, we'll treat the OTP as a reset token
       // In a real implementation, the user would get this token from their email
       // We'll pass this token to the ChangePassword screen
 
       // Simulate API delay
       await new Promise(resolve => setTimeout(resolve, 1000));
 
       navigation.replace('ReferralScreen', {
          token: token,
          user: user,
        });

     } catch (error) {
       Alert.alert('Error', 'Network error. Please try again.');
     } finally {
       setIsLoading(false);
     }
   };
 
   const handleResendOTP = async () => {
     try {
       Alert.alert('Success', 'New OTP sent to your email');
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
           <View style={styles.content}>
             {/* Logo */}
              <View style={styles.logoContainer}>
                                       <View style={styles.bitcoinLogo}>
                                         <Image
                                           source={require('../assets/images/setting.png')}
                                           style={styles.bitcoinImage}
                                           resizeMode="contain"
                                         />
                                       </View>
                                     </View>
 
             {/* Title */}
             <View style={styles.titleContainer}>
               <Text style={styles.title}>VERIFY OTP</Text>
               <Text style={styles.subtitle}>
                 Check your email for the reset password otp
               </Text>
             </View>

             
             {/* Gradient Form Box */}
            <LinearGradient
                colors={['#1B202CAA', '#2E3646AA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
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
                     placeholder="OTP"
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
               <LinearGradient
                 colors={['#2ACFEF', '#BD85FC']}
                 style={styles.verifyButton}
                 start={{x: 0, y: 0}}
                 end={{x: 1, y: 0}}
               >
                 <TouchableOpacity
                   style={styles.verifyButtonInner}
                   onPress={handleVerifyOTP}
                   disabled={isLoading}
                 >
                   <Text style={styles.verifyButtonText}>
                     {isLoading ? 'VERIFYING...' : 'VERIFY'}
                   </Text>
                 </TouchableOpacity>
               </LinearGradient>
 
               {/* Resend OTP */}
               <View style={styles.resendContainer}>
                 <Text style={styles.resendText}>Didn't receive the otp? </Text>
                 <TouchableOpacity onPress={handleResendOTP}>
                   <Text style={styles.resendLink}>Resend</Text>
                 </TouchableOpacity>
               </View>
 
               {/* Back to Login */}
               <View style={styles.backContainer}>
                 <TouchableOpacity onPress={() => navigation.navigate('Login' as never)}>
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
  geometricShape: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(139, 69, 255, 0.3)',
  },
  shape1: {
    width: 200,
    height: 200,
    borderRadius: 100,
    top: -100,
    right: -100,
    borderColor: 'rgba(139, 69, 255, 0.2)',
  },
  shape2: {
    width: 150,
    height: 150,
    borderRadius: 75,
    bottom: 100,
    left: -75,
    borderColor: 'rgba(139, 69, 255, 0.15)',
  },
  shape3: {
    width: 100,
    height: 100,
    borderRadius: 50,
    top: 200,
    left: 50,
    borderColor: 'rgba(139, 69, 255, 0.1)',
  },
  shape4: {
    width: 80,
    height: 80,
    borderRadius: 40,
    bottom: 300,
    right: 30,
    borderColor: 'rgba(139, 69, 255, 0.2)',
  },
  safeArea: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 40,
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
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
  verifyButton: {
    borderRadius: 15,
    marginTop: 0,
    marginBottom: 20,
    height: 45,
    width: 160,
    alignSelf: 'center',
  },
  verifyButtonInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  resendText: {
    color: '#8a8a8a',
    fontSize: 13,
  },
  resendLink: {
    color: '#00d4ff',
    fontSize: 13,
    fontWeight: '600',
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
});

export default TwofactorOTP;

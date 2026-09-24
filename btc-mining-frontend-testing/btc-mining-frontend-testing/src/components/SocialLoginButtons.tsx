/**
 * Social Login Buttons Component
 * Provides Google, Facebook, and LinkedIn sign-in buttons
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';

interface SocialLoginButtonsProps {
  onSuccess: (userData: any) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}

const SocialLoginButtons: React.FC<SocialLoginButtonsProps> = ({
  onSuccess,
  onError,
  disabled = false,
}) => {
  const [loading, setLoading] = useState<{
    google: boolean;
    facebook: boolean;
    linkedin: boolean;
    telegram: boolean;
  }>({
    google: false,
    facebook: false,
    linkedin: false,
    telegram: false,
  });

  const handleGoogleSignIn = async () => {
    return;
  };

  const handleFacebookSignIn = async () => {
    return;

  };

  const handleLinkedInSignIn = async () => {
    return;
  };

  const handleTelegramSignIn = async () => {
    return;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.orText}>COUNTINUE WITH</Text>
      
      <View style={styles.socialButtonsContainer}>
        {/* Google Sign-In Button */}
        <TouchableOpacity
          style={[
            styles.socialButton,
            styles.googleButton,
            disabled && styles.disabledButton,
          ]}
          onPress={handleGoogleSignIn}
          disabled={disabled || loading.google}
        >
          {loading.google ? (
            <ActivityIndicator size="small" />
          ) : (
            <Image
              source={require('../assets/images/icon_google.png')}
              style={styles.socialIconImage}
              resizeMode="contain"
            />
          )}
        </TouchableOpacity>

        {/* Facebook Sign-In Button */}
        <TouchableOpacity
          style={[
            styles.socialButton,
            styles.facebookButton,
            disabled && styles.disabledButton,
          ]}
          onPress={handleFacebookSignIn}
          disabled={disabled || loading.facebook}
        >
          {loading.facebook ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Image
              source={require('../assets/images/icon_fb.png')}
              style={styles.socialIconImage}
              resizeMode="contain"
            />
          )}
        </TouchableOpacity>

        {/* Telegram Sign-In Button */}
        <TouchableOpacity
          style={[
            styles.socialButton,
            styles.telegramButton,
            disabled && styles.disabledButton,
          ]}
          onPress={handleTelegramSignIn}
          disabled={disabled || loading.telegram}
        >
          {loading.telegram ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Image
              source={require('../assets/images/icon_tel.png')}
              style={styles.socialIconImage}
              resizeMode="contain"
            />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    alignItems: 'center',
  },
  orText: {
    fontSize: 14,
    color: '#4ACDFC',
    marginBottom: 15,
    textAlign: 'center',
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  socialButton: {
    width: 35,
    height: 35,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 35,
    marginHorizontal: 8,

    backgroundColor: 'transparent',
    borderWidth: 2,                
    borderColor: '#fff',
  },
  googleButton: {
    backgroundColor: '',
  },
  facebookButton: {
    backgroundColor: '',
  },
  linkedinButton: {
    backgroundColor: '',
  },
  telegramButton: {
    backgroundColor: '',
  },
  disabledButton: {
    opacity: 0.6,
  },
  socialIcon: {
    marginRight: 8,
  },
  socialIconImage: {
    width: 25,
    height: 25,
  },
  socialButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default SocialLoginButtons;

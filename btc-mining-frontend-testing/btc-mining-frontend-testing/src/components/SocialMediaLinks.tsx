import React from 'react';
import { BANNER_ADS_ENABLED } from '../config/adPlacements';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const SocialMediaLinks: React.FC = () => {
  const handleSocialMediaPress = async (url: string, platform: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', `Cannot open ${platform}. Please check if the app is installed.`);
      }
    } catch (error) {
      console.error(`Error opening ${platform}:`, error);
      Alert.alert('Error', `Failed to open ${platform}`);
    }
  };

  return (
    <View style={styles.socialMediaSection}>
      {/* Social Media Platforms */}
      <View style={styles.socialMediaContainer}>
        <Text style={styles.socialMediaTitle}>Follow Us</Text>
        <View style={styles.socialIconsRow}>
          <TouchableOpacity
            style={styles.socialIconButton}
            onPress={() => handleSocialMediaPress('https://www.facebook.com/profile.php?id=61578092293741', 'Facebook')}
            activeOpacity={0.7}
          >
            <View style={styles.socialIconCircle}>
              <Icon name="facebook" size={24} color="#1877F2" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.socialIconButton}
            onPress={() => handleSocialMediaPress('https://www.instagram.com/bitplay.global/', 'Instagram')}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={['#833AB4', '#FD1D1D', '#FCAF45']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.socialIconCircle, styles.instagramGradient]}
            >
              <Icon name="instagram" size={24} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.socialIconButton}
            onPress={() => handleSocialMediaPress('https://x.com/BitPlayGlobal', 'X (Twitter)')}
            activeOpacity={0.7}
          >
            <View style={styles.socialIconCircle}>
              <Icon name="twitter" size={24} color="#1DA1F2" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.socialIconButton}
            onPress={() => handleSocialMediaPress('https://www.youtube.com/@BitPlay.Global', 'YouTube')}
            activeOpacity={0.7}
          >
            <View style={styles.socialIconCircle}>
              <Icon name="youtube" size={24} color="#FF0000" />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Website Link */}
      <TouchableOpacity
        style={styles.websiteContainer}
        onPress={() => handleSocialMediaPress('https://bitplaypro.com/', 'Website')}
        activeOpacity={0.8}
      >
        <View style={styles.websiteContent}>
          <View style={styles.websiteIconWrapper}>
            <Icon name="web" size={22} color="#22D3EE" />
          </View>
          <View style={styles.websiteTextContainer}>
            <Text style={styles.websiteTitle}>Visit Our Website</Text>
            <Text style={styles.websiteSubtitle}>bitplaypro.com</Text>
          </View>
        </View>
        <Icon name="chevron-right" size={20} color="#9CA3AF" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  socialMediaSection: {
    marginTop: 16,
    // This is the last block in Home's scroll view, and the margin existed to
    // clear the bottom banner that used to float over it. With banners off it
    // was just dead space above the tab bar.
    marginBottom: BANNER_ADS_ENABLED ? (Platform.OS === 'ios' ? 80 : 120) : 16,
  },

  socialMediaContainer: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },

  socialMediaTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },

  socialIconsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 8,
  },

  socialIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  socialIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#374151',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },

  instagramGradient: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },

  websiteContainer: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#374151',
  },

  websiteContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  websiteIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 2,
    borderColor: '#22D3EE',
  },

  websiteTextContainer: {
    flex: 1,
  },

  websiteTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },

  websiteSubtitle: {
    color: '#22D3EE',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default SocialMediaLinks;


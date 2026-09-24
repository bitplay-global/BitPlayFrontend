import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ImageBackground,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import DeviceInfo from 'react-native-device-info';
import { RootStackParamList } from '../components/types';
import SocialMediaLinks from '../components/SocialMediaLinks';

type NavigationProp = StackNavigationProp<RootStackParamList, 'AboutUsScreen'>;

const AboutUsScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const appVersion = DeviceInfo.getVersion();


  return (
    <ImageBackground
      source={require('../assets/images/bg_pattern.png')}
      style={styles.container}
      resizeMode="cover"
    >
      {/* Overlay to darken background */}
      <View style={styles.overlay} />

      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>About Us</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Logo/Icon Section */}
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            {/* <Icon name="bitcoin" size={60} color="#F7931A" /> */}
            <Image source={require('../assets/images/main_app_icon.png')} style={{ width: '100%', height: '100%' }} />
          </View>
          <Text style={styles.appName}>BitPlayPro</Text>
          <Text style={styles.tagline}>Your First Bitcoin Starts Here</Text>
        </View>

        {/* What is BitPlay Card */}
        <View style={styles.contentCard}>
          <View style={styles.sectionHeader}>
            <Icon name="information-outline" size={24} color="#22D3EE" />
            <Text style={styles.sectionTitle}>What is BitPlayPro?</Text>
          </View>
          <Text style={styles.contentText}>
          BitPlayPro is a cloud mining app that makes Bitcoin mining easy to explore. Whether you're new to crypto or just curious, BitPlayPro offers a simple, gamified way to take part. Build mining power, complete daily challenges and play games – all from your smartphone.
          </Text>
        </View>

        {/* How It Works Card */}
        <View style={styles.contentCard}>
          <View style={styles.sectionHeader}>
            <Icon name="cog-outline" size={24} color="#22D3EE" />
            <Text style={styles.sectionTitle}>How It Works</Text>
          </View>

          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Sign up & Start</Text>
              <Text style={styles.stepDescription}>
                Begin mining instantly with free base power.
              </Text>
            </View>
          </View>

          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Boost Your Mining</Text>
              <Text style={styles.stepDescription}>
                Level up through missions, community challenges, and in-app rewards.
              </Text>
            </View>
          </View>

          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Track & Earn</Text>
              <Text style={styles.stepDescription}>
                Watch your mining stats in real time.
              </Text>
            </View>
          </View>

          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>4</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Withdraw Anytime</Text>
              <Text style={styles.stepDescription}>
                Securely transfer your Bitcoin to your wallet.
              </Text>
            </View>
          </View>
        </View>

        {/* Core Features Card */}
        <View style={styles.contentCard}>
          <View style={styles.sectionHeader}>
            <Icon name="star-outline" size={24} color="#22D3EE" />
            <Text style={styles.sectionTitle}>Core Features</Text>
          </View>

          <View style={styles.featureItem}>
            <Icon name="cloud-outline" size={20} color="#22D3EE" />
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Cloud Mining Made Easy</Text>
              <Text style={styles.featureDescription}>No rigs, no setup.</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Icon name="earth" size={20} color="#22D3EE" />
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Global Access</Text>
              <Text style={styles.featureDescription}>
                Multi-language support & local payment options.
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Icon name="trophy-outline" size={20} color="#22D3EE" />
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Gamified Rewards</Text>
              <Text style={styles.featureDescription}>
                Daily missions, achievements, and leaderboards.
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Icon name="flash-outline" size={20} color="#22D3EE" />
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Flexible Boosts</Text>
              <Text style={styles.featureDescription}>
                Speed up your mining through tasks, upgrades, or premium plans.
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Icon name="shield-check-outline" size={20} color="#22D3EE" />
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Secure Wallet</Text>
              <Text style={styles.featureDescription}>
                Store and withdraw Bitcoin safely.
              </Text>
            </View>
          </View>
        </View>

        {/* Why BitPlay Card */}
        <View style={styles.contentCard}>
          <View style={styles.sectionHeader}>
            <Icon name="help-circle-outline" size={24} color="#22D3EE" />
            <Text style={styles.sectionTitle}>Why BitPlayPro</Text>
          </View>

          <View style={styles.whyItem}>
            <View style={styles.whyIconCircle}>
              <Icon name="account-group" size={24} color="#22D3EE" />
            </View>
            <View style={styles.whyContent}>
              <Text style={styles.whyTitle}>For Everyone</Text>
              <Text style={styles.whyDescription}>
                Begin mining instantly with free base power.
              </Text>
            </View>
          </View>

          <View style={styles.whyItem}>
            <View style={styles.whyIconCircle}>
              <Icon name="bitcoin" size={24} color="#F7931A" />
            </View>
            <View style={styles.whyContent}>
              <Text style={styles.whyTitle}>Real Value</Text>
              <Text style={styles.whyDescription}>
                Earn Bitcoin you can actually withdraw.
              </Text>
            </View>
          </View>

          <View style={styles.whyItem}>
            <View style={styles.whyIconCircle}>
              <Icon name="account-multiple" size={24} color="#22D3EE" />
            </View>
            <View style={styles.whyContent}>
              <Text style={styles.whyTitle}>Community-Powered</Text>
              <Text style={styles.whyDescription}>
                Join thousands worldwide who mine together.
              </Text>
            </View>
          </View>

          <View style={styles.whyItem}>
            <View style={styles.whyIconCircle}>
              <Icon name="shield-check" size={24} color="#10B981" />
            </View>
            <View style={styles.whyContent}>
              <Text style={styles.whyTitle}>Safe & Transparent</Text>
              <Text style={styles.whyDescription}>
                Clear mining speeds, trusted partners, strong security.
              </Text>
            </View>
          </View>
        </View>

        {/* Contact Card */}
        <View style={styles.contentCard}>
          <View style={styles.sectionHeader}>
            <Icon name="email-outline" size={24} color="#22D3EE" />
            <Text style={styles.sectionTitle}>Get In Touch</Text>
          </View>
          <Text style={styles.contentText}>
            Have questions or need assistance? Our support team is here to help you 24/7.
          </Text>

          <TouchableOpacity
            style={styles.contactButton}
            onPress={() => navigation.navigate('SupportScreen' as any)}
          >
            <Icon name="message-text-outline" size={20} color="#fff" />
            <Text style={styles.contactButtonText}>Contact Support</Text>
          </TouchableOpacity>

        </View>

        {/* Social Media Links */}
        <View style={styles.socialWrapper}>
          <SocialMediaLinks />
        </View>

        <View style={styles.versionCard}>
          <Text style={styles.versionText}>Version {appVersion}</Text>
          <Text style={styles.copyrightText}>
            © 2026 BitPlayPro. All rights reserved.
          </Text>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 0,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 22, 40, 0.85)',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: Platform.OS === 'ios' ? 0 : 35,
    zIndex: 1,
  },
  topBarTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    zIndex: 1,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1a2942',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#22D3EE',
    overflow: 'hidden',
  },
  appName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  tagline: {
    color: '#9CA3AF',
    fontSize: 16,
    fontWeight: '500',
  },
  contentCard: {
    backgroundColor: '#1a2942',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  contentText: {
    color: '#D1D5DB',
    fontSize: 15,
    lineHeight: 24,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  stepNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#22D3EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  stepDescription: {
    color: '#9CA3AF',
    fontSize: 14,
    lineHeight: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  featureTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  featureTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureDescription: {
    color: '#9CA3AF',
    fontSize: 14,
    lineHeight: 20,
  },
  whyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  whyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 2,
    borderColor: '#22D3EE',
  },
  whyContent: {
    flex: 1,
  },
  whyTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  whyDescription: {
    color: '#9CA3AF',
    fontSize: 14,
    lineHeight: 20,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22D3EE',
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 16,
    gap: 8,
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  socialWrapper: {
    marginBottom: -60,
  },
  versionCard: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    paddingVertical: 20,
    marginTop: 8,
  },
  versionText: {
    color: '#6B7280',
    fontSize: 14,
    marginBottom: 8,
  },
  copyrightText: {
    color: '#6B7280',
    fontSize: 13,
    textAlign: 'center',
  },
  bottomSpacing: {
    height: 30,
  },
});

export default AboutUsScreen;


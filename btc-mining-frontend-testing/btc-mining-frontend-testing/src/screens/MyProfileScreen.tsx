import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Share,
  Alert,
  ImageBackground,
  Modal,
  Linking,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../components/types';
import { useAuth } from '../auth/AuthProvider';
import { get_data_uri } from '../config/api';
import InviteFriendsModal from '../components/InviteFriendsModal';
import InitialsAvatar from '../components/InitialsAvatar';
import { formatMiningLocalTimeForApi } from '../utils/miningTime';

function getDeviceIanaTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat?.().resolvedOptions?.()?.timeZone;
    return typeof tz === 'string' && tz.trim() ? tz.trim() : null;
  } catch {
    return null;
  }
}

type NavigationProp = StackNavigationProp<RootStackParamList, 'MyProfileScreen'>;

const MyProfileScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user, logout } = useAuth();

  const [invitationRewards, setInvitationRewards] = useState('0.0000000000000000');
  const [referralCode, setReferralCode] = useState('');
  const [referralCount, setReferralCount] = useState(0);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [miningTimezone, setMiningTimezone] = useState<string | null>(null);

  const deviceTimezone = getDeviceIanaTimezone();
  const displayTimezone =
    miningTimezone && miningTimezone.trim() ? miningTimezone.trim() : deviceTimezone ?? 'Unknown';

  useEffect(() => {
    // Fetch referral rewards and count
    fetchReferralRewards();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const profileUid = user?.userId ?? user?.id;
      if (!profileUid) {
        setMiningTimezone(null);
        return;
      }
      try {
        const local_time = formatMiningLocalTimeForApi(new Date());
        const res = await fetch(
          `${get_data_uri('USERMININGDETAILS')}/${profileUid}?local_time=${encodeURIComponent(local_time)}`
        );
        const data = await res.json();
        if (cancelled || !data?.success) return;
        const tz = data?.mining_details?.timezone;
        if (typeof tz === 'string' && tz.trim()) {
          setMiningTimezone(tz.trim());
        } else {
          setMiningTimezone(null);
        }
      } catch {
        if (!cancelled) setMiningTimezone(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.userId, user?.id]);

  const fetchReferralRewards = async () => {
    try {
      // Set referral code
      if (user?.referralCode) {
        setReferralCode(user.referralCode);

        // Fetch referral count
        try {
          const refResponse = await fetch(`${get_data_uri('REFERRALS')}?code=${encodeURIComponent(user.referralCode)}`);
          const refData = await refResponse.json();
          if (refData.success) {
            setReferralCount(refData.count || 0);
          }
        } catch (refError) {
        }

        // Fetch total referral rewards
        try {
          const rewardsUid = user?.userId ?? user?.id;
          if (rewardsUid) {
            const rewardsResponse = await fetch(`${get_data_uri('REFERRAL_REWARDS')}/${rewardsUid}`);
            const rewardsData = await rewardsResponse.json();

            if (rewardsData.success) {
              const rewardValue = parseFloat(rewardsData.totalRewards || '0');
              setInvitationRewards(rewardValue.toFixed(16));
            }
          }
        } catch (rewardsError) {
        }
      }
    } catch (error) {
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join BitPlayPro using my referral code: ${referralCode || user?.referralCode}`,
      });
    } catch (error) {
    }
  };

  const handleCopyCode = () => {
    const code = referralCode || user?.referralCode || '';
    Clipboard.setString(code);
    Alert.alert('Copied!', `Referral code ${code} copied to clipboard`);
  };

  const handleInviteFriends = () => {
    setShowInviteModal(true);
  };

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
        <Text style={styles.topBarTitle}>My Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Avatar + ID Section */}
        <View style={styles.avatarSection}>
          <InitialsAvatar name={user?.name} size={90} />
        </View>

        {/* ID Section - No Background Box */}
        <View style={styles.idSection}>
          <View style={styles.idContent}>
            <View style={styles.idRow}>
              <Text style={styles.idText}>ID:{user?.id?.slice(-7) ?? ''}</Text>
              <Text style={styles.timezoneValue} numberOfLines={2}>
                {displayTimezone}
              </Text>
            </View>
            {/* <TouchableOpacity style={styles.inviteCodeBox}>
              <Icon name="plus-circle-outline" size={14} color="#22D3EE" />
              <Text style={styles.inviteCodeLink}>Enter the Invitation code ›</Text>
            </TouchableOpacity> */}
          </View>
        </View>

        {/* Invitation Rewards Card */}
        <View style={styles.rewardsCard}>
          <View style={styles.rewardsInfo}>
            <View style={styles.rewardsRow}>
              <View style={styles.rewardsLeft}>
                <Text style={styles.rewardsLabel}>Invitation Rewards</Text>
                <Text style={styles.rewardsValue}>{invitationRewards} BTC</Text>
              </View>
              <View style={styles.referralCountBadge}>
                <Icon name="account-multiple" size={18} color="#22D3EE" />
                <Text style={styles.referralCountText}>{referralCount}</Text>
                <Text style={styles.referralCountLabel}>joined</Text>
              </View>
            </View>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.codeBtn} onPress={handleCopyCode}>
              <Icon name="content-copy" size={16} color="#fff" />
              <Text style={styles.codeBtnText}>{referralCode || user?.referralCode || ''}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.inviteBtn}
              onPress={handleInviteFriends}
            >
              <Text style={styles.inviteBtnText}>Invite friends</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Account Settings */}
        <View style={styles.menuContainer}>
          <Text style={styles.sectionTitle}>Account Settings</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('MyProfileEditScreen' as any)}
          >
            <Icon name="account-edit-outline" size={22} color="#fff" />
            <Text style={styles.menuText}>My Profile</Text>
            <Icon name="chevron-right" size={22} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('AchievementsScreen')}
          >
            <Icon name="trophy-outline" size={22} color="#fff" />
            <Text style={styles.menuText}>Achievements</Text>
            <Icon name="chevron-right" size={22} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('ForgotPassword', { screen_heading: 'Change Password' })}
          >
            <Icon name="lock-outline" size={22} color="#fff" />
            <Text style={styles.menuText}>Change Password</Text>
            <Icon name="chevron-right" size={22} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('UpdateEmail')}
          >
            <Icon name="email-outline" size={22} color="#fff" />
            <Text style={styles.menuText}>Update Email Address</Text>
            <Icon name="chevron-right" size={22} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('TwoFactorScreen')}
          >
            <Icon name="shield-check-outline" size={22} color="#fff" />
            <Text style={styles.menuText}>Two-Factor Authentication</Text>
            <Icon name="chevron-right" size={22} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.lastMenuItem]}
            onPress={() => navigation.navigate('NotificationPreferencesScreen')}
          >
            <Icon name="bell-outline" size={22} color="#fff" />
            <Text style={styles.menuText}>Notification Preferences</Text>
            <Icon name="chevron-right" size={22} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Support */}
        <View style={styles.menuContainer}>
          <Text style={styles.sectionTitle}>Support</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('FAQScreen' as never)}
          >
            <Icon name="help-circle-outline" size={22} color="#fff" />
            <Text style={styles.menuText}>Help Center & FAQ</Text>
            <Icon name="chevron-right" size={22} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('SupportScreen' as any)}
          >
            <Icon name="message-text-outline" size={22} color="#fff" />
            <Text style={styles.menuText}>Contact Us</Text>
            <Icon name="chevron-right" size={22} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('DeleteAccount' as any)}
          >
            <Icon name="delete-outline" size={22} color="#fff" />
            <Text style={styles.menuText}>Delete Account</Text>
            <Icon name="chevron-right" size={22} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('WebViewScreen', {
              url: 'https://bitplaypro.com/privacy-policy/',
              title: 'Privacy Policy'
            })}
          >
            <Icon name="shield-account-outline" size={22} color="#fff" />
            <Text style={styles.menuText}>Privacy Policy</Text>
            <Icon name="chevron-right" size={22} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('WebViewScreen', {
              url: 'https://bitplaypro.com/terms-and-conditions/',
              title: 'Terms of Service'
            })}
          >
            <Icon name="file-document-outline" size={22} color="#fff" />
            <Text style={styles.menuText}>Terms of Service</Text>
            <Icon name="chevron-right" size={22} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('WebViewScreen', {
              url: 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/',
              title: 'Apple Terms'
            })}
          >
            <Icon name="apple" size={22} color="#fff" />
            <Text style={styles.menuText}>Apple Terms</Text>
            <Icon name="chevron-right" size={22} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.lastMenuItem]}
            onPress={() => navigation.navigate('AboutUsScreen' as any)}
          >
            <Icon name="information-outline" size={22} color="#fff" />
            <Text style={styles.menuText}>About Us</Text>
            <Icon name="chevron-right" size={22} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          onPress={async () => await logout()}
          activeOpacity={0.8}
          style={styles.logoutWrapper}
        >
          <LinearGradient
            colors={['#53D3F6', '#BD85FC', '#F472B6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.logoutButton}
          >
            <Text style={styles.logoutText}>Logout</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      {/* Invite Friends Modal */}
      <InviteFriendsModal
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        referralCode={referralCode || user?.referralCode || ''}
        invitationRewards={parseFloat(invitationRewards)}
        referralCount={referralCount}
      />
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
  avatarSection: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
    zIndex: 1,
  },
  idSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    zIndex: 1,
  },
  rewardsCard: {
    backgroundColor: '#1a2942',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 20,
    zIndex: 1,
  },
  idContent: {
    marginLeft: 10,
    flex: 1,
  },
  idText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  idRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  timezoneValue: {
    color: '#22D3EE',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  inviteCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#22D3EE',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    gap: 4,
  },
  inviteCodeLink: {
    color: '#22D3EE',
    fontSize: 11,
  },
  rewardsInfo: {
    backgroundColor: '#d4f1f4',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  rewardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rewardsLeft: {
    flex: 1,
  },
  rewardsLabel: {
    color: '#333',
    fontSize: 13,
    marginBottom: 4,
  },
  rewardsValue: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },
  referralCountBadge: {
    backgroundColor: '#1a2942',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    minWidth: 70,
    borderWidth: 1,
    borderColor: '#22D3EE',
  },
  referralCountText: {
    color: '#22D3EE',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
  },
  referralCountLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  codeBtn: {
    flex: 1,
    backgroundColor: '#2d3f5f',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  codeBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  inviteBtn: {
    flex: 1,
    backgroundColor: '#22D3EE',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  menuContainer: {
    backgroundColor: '#1a2942',
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
    padding: 16,
    zIndex: 1,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2d3f5f',
  },
  lastMenuItem: {
    borderBottomWidth: 0,
  },
  menuText: {
    color: '#fff',
    fontSize: 15,
    flex: 1,
    marginLeft: 12,
  },
  logoutWrapper: {
    borderRadius: 40,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginBottom: 30,
    zIndex: 1,
  },
  logoutButton: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 40,
    minHeight: 50,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MyProfileScreen;
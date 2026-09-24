import { StackNavigationProp } from '@react-navigation/stack';
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  ImageBackground,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { RootStackParamList } from '../components/types';
import { useNavigation } from '@react-navigation/native';

const notifications = [
  {
    id: 1,
    message: 'Your profile image was removed since it might not be original.',
    timestamp: '32s ago',
    date: 'Today',
  },
  {
    id: 2,
    message: "Tell us about your business and we'll give you personalized recommendations",
    timestamp: '1h ago',
    date: 'Today',
  },
  {
    id: 3,
    message: 'Your subscription is ended, please renew now to keep enjoying high hashrate mining',
    timestamp: '3days ago',
    date: 'Earlier',
  },
  {
    id: 4,
    message: "A user just joined using your referral code, you've been granted an additional mining power of 2 TH/s",
    timestamp: 'Earlier today',
    date: 'Today',
  },
  {
    id: 5,
    message: 'Your profile image was removed since it might not be original.',
    timestamp: '32s ago',
    date: 'Today',
  },
  {
    id: 6,
    message: 'Your profile image was removed since it might not be original.',
    timestamp: '32s ago',
    date: 'Today',
  },
  {
    id: 7,
    message: 'Your profile image was removed since it might not be original.',
    timestamp: '32s ago',
    date: 'Today',
  },
  {
    id: 8,
    message: 'Your profile image was removed since it might not be original. Learn more',
    timestamp: '32s ago',
    date: 'Today',
  },
];

const NotificationScreen = () => {

    type SidebarNavigationProp = StackNavigationProp<RootStackParamList, 'NotificationScreen'>;
    
      const navigation = useNavigation<SidebarNavigationProp>();

  // Group notifications by date
  const grouped = notifications.reduce((acc, curr) => {
    acc[curr.date] = acc[curr.date] || [];
    acc[curr.date].push(curr);
    return acc;
  }, {});

  return (
    <ImageBackground
      source={require('../assets/images/bg_pattern1.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />

      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.topBar}>
            <View style={styles.topBarContent}>
                <TouchableOpacity onPress={() => navigation.reset({index: 0, routes: [{ name: 'Main' }],})} style={styles.backRow}>
                <Icon name="chevron-back" size={24} color="white" />
                <Text style={styles.topBarTitle}>Notifications</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => console.log('Clear pressed')}>
                <Text style={styles.clearText}>Clear</Text>
                </TouchableOpacity>
            </View>
            </View>

        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.box}>
            {Object.entries(grouped).map(([section, items]) => (
              <View key={section}>
                <Text style={styles.sectionTitle}>{section}</Text>
                {notifications.map((item) => (
                  <View key={item.id}>
                    <View style={styles.notificationRow}>
                      <Image
                        source={require('../assets/images/user_profile.png')}
                        style={styles.avatar}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.messageText}>{item.message}</Text>
                        <Text style={styles.timestamp}>{item.timestamp}</Text>
                      </View>
                    </View>
                    <View style={styles.divider} />
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#1B202C',
  },
  container: {
    padding: 16,
    paddingBottom: 50,
  },
  box: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    marginLeft: 8,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  messageText: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 18,
  },
  timestamp: {
    color: '#aaa',
    fontSize: 11,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 8,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 30,
    paddingBottom: 12,
    backgroundColor: 'transparent',
    },

    topBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    },

    backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    },

    topBarTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
    },

    clearText: {
    color: '#60A5FA',
    fontSize: 14,
    fontWeight: '500',
    },
});

export default NotificationScreen;

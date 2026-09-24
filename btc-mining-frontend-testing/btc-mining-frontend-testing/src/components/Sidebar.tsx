import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../auth/AuthProvider';
import { RootStackParamList } from './types';
import { StackNavigationProp } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';

const screenWidth = Dimensions.get('window').width;

type SidebarProps = {
  visible: boolean;
  onClose: () => void;
};

export const Sidebar: React.FC<SidebarProps> = ({ visible, onClose }) => {

  type SidebarNavigationProp = StackNavigationProp<RootStackParamList, 'Sidebar'>;

  const navigation = useNavigation<SidebarNavigationProp>();

  if (!visible) return null;

  const { logout } = useAuth();

  return (
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback>
          <LinearGradient
            colors={['#58759D', '#1F2937']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.sidebar}
          >
            <View style={styles.header}>
              <Icon name="menu" size={24} color="#fff" />
              <Text style={styles.title}>BitPlay Pro</Text>
            </View>
            {[
                { label: 'BTC Trading', onPress: () => {
                  navigation.navigate('TradingScreen');
                } },
                { label: 'Achievements', onPress: () => {
                  navigation.navigate('AchievementsScreen');
                } },
                { label: 'Notifications', onPress: () => {
                  navigation.navigate('NotificationScreen');
                } },
                { label: 'Delete Account', onPress: () => {
                  navigation.navigate('DeleteAccount');
                } },
                { label: 'Settings', onPress: () => {
                  navigation.navigate('MyProfileScreen');
                } },
                { label: 'Help', onPress: () => {
                  navigation.navigate('SupportScreen');
                } },
                { label: 'Logout', onPress: async () => {
                    console.log("Logout Initiated!!");
                    await logout();
                    onClose();
                    // navigation.replace('Login');
                }}
                ].map((item, index) => (
                <TouchableOpacity
                    key={index}
                    style={styles.itemWrapper}
                    onPress={() => {
                    item.onPress();
                    onClose();
                    }}
                >
                    <Text style={styles.item}>{item.label}</Text>
                    <View style={styles.underline} />
                </TouchableOpacity>
            ))}
          </LinearGradient>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    width: '100%',
    zIndex: 100,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  sidebar: {
    width: screenWidth * 0.6,
    height: '100%',
    paddingTop: 35,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    marginLeft: 10,
  },
  itemWrapper: {
    marginBottom: 20,
  },
  item: {
    color: '#fff',
    fontSize: 16,
  },
  underline: {
    height: 1,
    backgroundColor: '#fff',
    marginTop: 20,
    opacity: 0.2,
  },
});

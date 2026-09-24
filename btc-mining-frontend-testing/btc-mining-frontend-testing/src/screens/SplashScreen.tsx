import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

type SplashContentProps = { showLoader?: boolean };

export const SplashContent: React.FC<SplashContentProps> = ({ showLoader = true }) => {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A1A" translucent={false} />
      <View style={styles.center}>
        <Image
          source={require('../assets/images/main_app_icon.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.appName}>
          BitPlay<Text style={styles.accent}>Pro</Text>
        </Text>
        {showLoader && (
          <ActivityIndicator
            size="small"
            color="#22D3EE"
            style={styles.loader}
          />
        )}
      </View>
    </View>
  );
};

const SplashScreen: React.FC = () => {
  const navigation = useNavigation();

  useEffect(() => {
    const t = setTimeout(() => navigation.navigate('Login' as never), 2500);
    return () => clearTimeout(t);
  }, [navigation]);

  return <SplashContent />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    gap: 16,
  },
  logoImage: {
    width: 120,
    height: 120,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 1,
    marginTop: 8,
  },
  accent: { color: '#22D3EE' },
  loader: {
    marginTop: 24,
  },
});

export default SplashScreen;

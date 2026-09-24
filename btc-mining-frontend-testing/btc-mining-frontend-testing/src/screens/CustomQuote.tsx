import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Dimensions,
  ImageBackground,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../components/types';
import { Image } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
const { width, height } = Dimensions.get('window');
import Icon from 'react-native-vector-icons/Ionicons';

interface CustomQuoteProps {}

const CustomQuote: React.FC<CustomQuoteProps> = () => {
  const { login } = useAuth();

  type CustomQuoteNavigationProp = StackNavigationProp<RootStackParamList, 'CustomQuote'>;

  const navigation = useNavigation<CustomQuoteNavigationProp>();

  return (
    <ImageBackground
      source={require('../assets/images/bg_pattern1.png')}
      style={[styles.backgroundImage, { backgroundColor: '#1B202C' }]}
      resizeMode="cover">

      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow}>
            <Icon name="chevron-back" size={24} color="white" />
            <Text style={styles.topBarTitle}>Custom Quote</Text>
        </TouchableOpacity>
        </View>

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

            <View style={styles.screenContainer}>

              <View style={styles.formBox}>
                <Text style={styles.formHeading}>Buy Custom Quote</Text>
                <Text style={styles.subText}>
                  Users can buy custom mining power if the already provided plans doesn’t meet their requirements
                </Text>

                {/* Hashrate Row */}
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Hashrate (TH/s) :</Text>
                    <TextInput style={styles.input} placeholder="600" placeholderTextColor="#aaa" />
                  </View>
                  
                  <TouchableOpacity activeOpacity={0.8} style={styles.getPriceButton}>
                    <LinearGradient
                      colors={['#2ACEEE', '#BC86FC']}
                      start={{ x: 1, y: 0 }}
                      end={{ x: 0, y: 0 }}
                      style={styles.gradientButton}
                    >
                      <Text style={styles.buttonText}>GET PRICE</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

                {/* Amount Input */}
                <Text style={styles.label}>Amount (Approx):</Text>
                <TextInput style={styles.input} placeholder="500$" placeholderTextColor="#aaa" />

                <Text style={styles.noteText}>
                  This is not the final price, the final price depends on availability and demand
                </Text>

                {/* Get Quote Button */}
                <TouchableOpacity activeOpacity={0.8} style={{ borderRadius: 10, overflow: 'hidden' }}>
                  <LinearGradient
                    colors={['#2ACEEE', '#BC86FC']}
                    start={{ x: 1, y: 0 }}
                    end={{ x: 0, y: 0 }}
                    style={styles.gradientButtonFull}
                  >
                    <Text style={styles.buttonText}>Get Quote</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

            </View>

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
  screenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },

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
  scrollContent: {
    flexGrow: 1,
    minHeight: Dimensions.get('window').height - 100,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  footer: {
    alignItems: 'center',
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
  },
  footerText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '400',
  },
  testApiButton: {
    backgroundColor: '#333',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    marginTop: 20,
    alignSelf: 'center',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
backArrow: {
  fontSize: 26,
  color: '#fff',
  marginRight: 10,
},
formBox: {
  backgroundColor: '#1E293B', // Azure 17
  borderRadius: 16,
  padding: 20,
  marginHorizontal: 16,
},
formHeading: {
  fontSize: 18,
  fontWeight: '700',
  color: '#fff',
  marginBottom: 6,
},
subText: {
  color: '#ccc',
  fontSize: 14,
  marginBottom: 16,
},
label: {
  color: '#fff',
  fontSize: 14,
  marginBottom: 4,
},
input: {
  backgroundColor: '#111827',
  borderRadius: 10,
  padding: 12,
  color: '#fff',
  marginBottom: 16,
},
row: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 16,
},
getPriceButton: {
  marginLeft: 12,
  borderRadius: 10,
  overflow: 'hidden',
},

gradientButton: {
  borderRadius: 10,
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: Platform.OS === 'ios' ? 30 : 40,
  minWidth:  100
},

gradientButtonFull: {
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: Platform.OS === 'ios' ? 40 : 50
},
buttonText: {
  color: '#fff',
  fontWeight: '600',
  fontSize: 14,
},
noteText: {
  color: '#9CA3AF',
  fontSize: 12,
  marginBottom: 10,
},
topBar: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 16,
  paddingTop: 30,
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
});

export default CustomQuote;

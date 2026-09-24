import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Dimensions,
  ImageBackground,
  StatusBar,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import { get_data_uri } from '../config/api';
import { useAuth } from '../auth/AuthProvider';

const { width, height } = Dimensions.get('window');

const reasons = [
  'I am no longer using my account',
  'The service is too expensive',
  "I don't understand how to use the app",
  "I can't deposit money",
  "I don't need the service anymore",
  'I found a better option',
  'Other',
];

const DeleteAccountScreen = () => {
  const navigation = useNavigation();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);

  const { user } = useAuth();
  
  async function handleDelete() {
    try {
      const delete_req_uri = get_data_uri("DELETE_REQ");

      const response = await fetch(delete_req_uri, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: user?.id,
          reason: selectedReason
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert("Error", data.message || "Delete request failed.");
        return;
      }

      if (data.message?.toLowerCase().includes("already exists")) {
        Alert.alert("Notice", data.message);
      } else {
        Alert.alert("Success", data.message || "Delete request created successfully.");
      }

      return data;
    } catch (error: any) {
      Alert.alert("Error", error.message || "Something went wrong while deleting.");
    }
  }

  return (
    <ImageBackground
      source={require('../assets/images/bg_pattern1.png')}
      style={[styles.backgroundImage, { backgroundColor: '#1B202C' }]}
      resizeMode="cover"
    >
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      <SafeAreaView style={styles.safeArea}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow}>
            <Icon name="chevron-back" size={24} color="white" />
            <Text style={styles.topBarTitle}>Delete Account</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.screenContainer}>
            <View style={styles.formBox}>
              <Text style={styles.subText}>
                We're really sorry to see you go. Are you sure you want to delete your account? Once you confirm,
                your data will be gone.
              </Text>

              {reasons.map((reason, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.radioRow}
                  onPress={() => setSelectedReason(reason)}
                  activeOpacity={0.7}
                >
                  <View style={styles.radioOuter}>
                    {selectedReason === reason && <View style={styles.radioInner} />}
                  </View>
                  <Text style={styles.radioLabel}>{reason}</Text>
                </TouchableOpacity>
              ))}

              {/* Delete Account Button */}
              <TouchableOpacity
                activeOpacity={0.8}
                style={{ borderRadius: 12, overflow: "hidden", marginTop: 20 }}
                onPress={handleDelete}
              >
                <LinearGradient
                  colors={['#EE5F22', '#D20BBE']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientButtonFull}
                >
                  <Text style={styles.buttonText}>Delete Account</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
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
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  scrollContent: {
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  screenContainer: {
    marginTop: height/5,
  },
  formBox: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
  },
  subText: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 20,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#aaa',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22D3EE',
  },
  radioLabel: {
    color: '#fff',
    fontSize: 14,
    flexShrink: 1,
  },
  gradientButtonFull: {
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.5,
},
});

export default DeleteAccountScreen;

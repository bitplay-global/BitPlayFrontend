import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';

type ForceUpdateModalProps = {
  visible: boolean;
  storeUrl: string;
  currentVersion: string;
  latestVersion: string | null;
  onDismiss: () => void;
};

export default function ForceUpdateModal({
  visible,
  storeUrl,
  currentVersion,
  latestVersion,
  onDismiss,
}: ForceUpdateModalProps) {
  const openStore = () => {
    Linking.openURL(storeUrl).catch(() => {});
  };


  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onDismiss}
      >
        <TouchableOpacity
          style={styles.card}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.title}>Update required</Text>
          <Text style={styles.message}>
            A new version of BitPlayPro is available. Please update to continue
            using the app.
          </Text>
          <View style={styles.versionRow}>
            <Text style={styles.versionLabel}>Current: </Text>
            <Text style={styles.versionValue}>{currentVersion}</Text>
          </View>
          {latestVersion != null && (
            <View style={styles.versionRow}>
              <Text style={styles.versionLabel}>Latest: </Text>
              <Text style={styles.versionValue}>{latestVersion}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.button}
            onPress={openStore}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>
              Update from {Platform.OS === 'ios' ? 'App Store' : 'Play Store'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onDismiss}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelButtonText}>Later</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#a0a0a0',
    lineHeight: 22,
    marginBottom: 16,
    textAlign: 'center',
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 4,
  },
  versionLabel: {
    fontSize: 14,
    color: '#6b6b6b',
  },
  versionValue: {
    fontSize: 14,
    color: '#22D3EE',
    fontWeight: '600',
  },
  button: {
    marginTop: 20,
    backgroundColor: '#F7931A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    color: '#a0a0a0',
  },
});

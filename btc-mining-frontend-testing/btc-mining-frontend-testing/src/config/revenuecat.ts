import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

export const initializeRevenueCat = async (): Promise<void> => {
  try {
    // TEMP: verbose SDK logging to diagnose why the Super Privileges products
    // aren't resolving via getProducts() (shows in adb logcat under "Purchases").
    // Remove once that's root-caused — this is noisy for normal use.
    await Purchases.setLogLevel(LOG_LEVEL.VERBOSE);

    // Configure RevenueCat
    const API_KEY = Platform.select({
      ios: 'appl_ECuLlPZFySqlMEmdYwOFFnRzypm', // LIVE API KEY
      android: 'goog_HulLCbyUNkoBvpTFoimVCntsEpi',
    });
    await Purchases.configure({
      apiKey: API_KEY || '', // Production API key - now works with StoreKit
    });

    console.log('RevenueCat initialized successfully with production API key');
  } catch (error) {
    console.error('Error initializing RevenueCat:', error);
  }
};

export const setUserAttributes = async (
  userId: string,
  attributes?: Record<string, any>,
) => {
  try {
    await Purchases.logIn(userId);

    if (attributes) {
      await Purchases.setAttributes(attributes);
    }

    console.log('User logged in to RevenueCat');
  } catch (error) {
    console.error('Error setting user attributes:', error);
  }
};

export const logoutUser = async () => {
  try {
    await Purchases.logOut();
    console.log('User logged out from RevenueCat');
  } catch (error) {
    console.error('Error logging out user:', error);
  }
};

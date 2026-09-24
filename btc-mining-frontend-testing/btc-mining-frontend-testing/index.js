/**
 * @format
 */

// Must be the very first import in the app -- the MMP SDK refuses to mint
// identifiers without a real CSPRNG rather than falling back to Math.random
// (a weak anonymous_id silently merges two people's data). See
// libs/mmp-react-native/README.md.
import 'react-native-get-random-values';
// Must load next, still ahead of anything that could make a request:
// attaches the user's token to every backend API call.
import './src/config/attachBackendAuth';
import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './App';

messaging().setBackgroundMessageHandler(async remoteMessage => {
  try {
    console.log('Firebase FCM message received in background:', remoteMessage);
  } catch (error) {
    console.error('Error handling background message:', error);
  }
});

AppRegistry.registerComponent('BitPlay', () => App);
AppRegistry.registerComponent('BitPlayPro', () => App);
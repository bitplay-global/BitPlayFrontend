import { Platform } from 'react-native';

/** Last-resort AdMob IDs when API returns null (keep in sync with previous hardcoded values). */
export const DEFAULT_ADMOB_REWARDED_ID = Platform.select({
  ios: 'ca-app-pub-9138199693214957/9133232797',
  android: 'ca-app-pub-9138199693214957/5211655924',
})!;

export const DEFAULT_ADMOB_BANNER_ID = Platform.select({
  ios: 'ca-app-pub-9138199693214957/1972928079',
  android: 'ca-app-pub-9138199693214957/6069958941',
})!;

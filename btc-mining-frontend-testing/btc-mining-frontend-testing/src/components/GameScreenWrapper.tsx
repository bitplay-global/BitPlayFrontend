import React from 'react';
import { BANNER_ADS_ENABLED } from '../config/adPlacements';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { BannerAdSlot } from './ads/BannerAdSlot';
import { BannerAdSize } from 'react-native-google-mobile-ads';
import { DEFAULT_ADMOB_BANNER_ID } from '../services/adUnitDefaults';
import { useAdConfig } from '../providers/AdConfigProvider';

interface Props {
  title: string;
  iconName: string;
  iconColor: string;
  children: React.ReactNode;
  rightContent?: React.ReactNode;
  gradientColors?: string[];
  scrollable?: boolean;
}

export default function GameScreenWrapper({
  title,
  iconName,
  iconColor,
  children,
  rightContent,
  gradientColors = ['#0f172a', '#1e1b4b', '#0f172a'],
  scrollable = true,
}: Props) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  // Use the server-configured banner unit, same as HomeScreen. The hardcoded
  // DEFAULT_ADMOB_BANNER_ID is only a last-resort fallback -- on iOS that unit
  // does not serve, which is why every GameScreenWrapper screen showed no ad
  // on TestFlight while Home (which reads this config) did.
  const { ads } = useAdConfig();
  const bannerUnitId = ads?.homeBannerId ?? DEFAULT_ADMOB_BANNER_ID;

  return (
    <LinearGradient colors={gradientColors} style={styles.gradient}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" translucent={false} />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <View style={styles.backCircle}>
              <MaterialCommunityIcons name="arrow-left" size={20} color="#f8fafc" />
            </View>
          </TouchableOpacity>

          <View style={styles.titleWrap}>
            <View style={[styles.iconBadge, { backgroundColor: iconColor + '22', borderColor: iconColor + '44' }]}>
              <MaterialCommunityIcons name={iconName} size={18} color={iconColor} />
            </View>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
          </View>

          <View style={styles.rightSlot}>
            {rightContent ?? null}
          </View>
        </View>

        {/* Top banner ad — loads immediately, skeleton shown until ready */}
        {BANNER_ADS_ENABLED && (
          <View style={styles.topBannerWrap}>
            <BannerAdSlot unitId={bannerUnitId} size={BannerAdSize.BANNER} />
          </View>
        )}

        {/* Game content */}
        {scrollable ? (
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentInner}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            // Without these, short game screens (Scratch & Win, Tap to Bomb)
            // still behaved like scrollable pages: contentInner had no
            // flexGrow, so the content stacked at the very top leaving dead
            // space below it, and Android's overscroll let the whole thing
            // drag/bounce even though there was nothing to scroll to.
            // flexGrow:1 + centered justifyContent makes the content fill and
            // center in the available space when it fits (no scroll at all),
            // while the ScrollView still scrolls normally on short screens
            // where the content genuinely overflows.
            bounces={false}
            overScrollMode="never"
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, styles.contentInner]}>
            {children}
          </View>
        )}

        {/* Bottom banner ad pinned above safe area */}
        {BANNER_ADS_ENABLED && (
          <View style={[styles.bannerWrap, { paddingBottom: insets.bottom || 8 }]}>
            <BannerAdSlot unitId={bannerUnitId} size={BannerAdSize.ADAPTIVE_BANNER} />
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: { padding: 4 },
  backCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  titleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  iconBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f8fafc',
    letterSpacing: 0.2,
    flex: 1,
  },
  rightSlot: { width: 44, alignItems: 'flex-end' },
  topBannerWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  content: { flex: 1 },
  contentInner: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  bannerWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
});

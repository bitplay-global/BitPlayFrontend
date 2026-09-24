import React, { useEffect, useState } from 'react';
import { Dimensions, Image, Linking, TouchableOpacity } from 'react-native';
import { BannerAdSize } from 'react-native-google-mobile-ads';
import { BANNER_ADS_ENABLED } from '../../config/adPlacements';
import { BannerAdWithGamFallback } from './BannerAdWithGamFallback';

/** How long the static house banner stays up before retrying the real ad. */
const FALLBACK_HOLD_MS = 60_000;

const FALLBACK_URL = 'https://thecaphevietnam.com/';
const FALLBACK_IMAGE = require('../../assets/images/addbanner.png');

export type BannerAdSlotProps = {
  unitId: string;
  size?: BannerAdSize;
};

/**
 * A banner slot that degrades to the static house banner instead of collapsing.
 *
 * HomeScreen, TradingScreen, SuperPrivilegesScreen and SpinAndWinScreen each
 * hand-rolled this same three-part pattern (error flag -> static image -> 60s
 * timer that retries the real ad). Game Zone, the GameScreenWrapper games,
 * Wallet and Store rendered a bare BannerAdWithGamFallback with no
 * onAllFailed handler at all, so on an AdMob NO_FILL -- which is common and
 * confirmed on real devices for this app's units -- those slots simply
 * rendered nothing: no ad and no fallback.
 *
 * This packages the pattern once so those slots degrade the same way the
 * older screens already do. The existing four screens keep their own inline
 * copies for now; this is additive and changes nothing about them.
 */
export function BannerAdSlot({ unitId, size = BannerAdSize.ADAPTIVE_BANNER }: BannerAdSlotProps) {
  const [showFallback, setShowFallback] = useState(false);

  // Swap back to a real ad request after a cool-off, so a slot that fell back
  // during a temporary no-fill window doesn't stay on the house banner for the
  // rest of the session.
  useEffect(() => {
    if (!showFallback) return;
    const timer = setTimeout(() => setShowFallback(false), FALLBACK_HOLD_MS);
    return () => clearTimeout(timer);
  }, [showFallback]);

  // Banners are switched off app-wide; see config/adPlacements. Placed below
  // the hooks so hook order stays identical whichever way the flag is set.
  if (!BANNER_ADS_ENABLED) return null;

  if (showFallback) {
    return (
      <TouchableOpacity activeOpacity={0.9} onPress={() => Linking.openURL(FALLBACK_URL)}>
        <Image
          source={FALLBACK_IMAGE}
          style={{ width: Dimensions.get('window').width, height: 60 }}
          resizeMode="stretch"
        />
      </TouchableOpacity>
    );
  }

  return (
    <BannerAdWithGamFallback
      primaryUnitId={unitId}
      size={size}
      onAllFailed={() => setShowFallback(true)}
    />
  );
}

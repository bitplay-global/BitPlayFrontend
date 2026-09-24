import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import DeviceInfo from "react-native-device-info";
import { get_data_uri } from "../config/api";
import { getObjectFromStorage, saveObjectToStorage } from "../config/storage";

type AdConfig = {
  rewardedVideoId: string | null;
  homeBannerId: string | null;
  gamRewardedVideoId: string | null;
  gamHomeBannerId: string | null;
};

type AdConfigContextType = {
  ads: AdConfig;
  loading: boolean;
};

const AdConfigContext = createContext<AdConfigContextType | undefined>(
  undefined
);

const AD_CONFIG_CACHE_KEY = "adConfigCache";
const DEFAULT_AD_CONFIG: AdConfig = {
  rewardedVideoId: null,
  homeBannerId: null,
  gamRewardedVideoId: null,
  gamHomeBannerId: null,
};

export const AdConfigProvider = ({ children }: { children: React.ReactNode }) => {
  // Seed from last-known config so warm starts have real ad unit ids from
  // frame one instead of the null defaults every consumer already falls
  // back to. Never blocks -- this is a synchronous MMKV read.
  const [ads, setAds] = useState<AdConfig>(
    () => getObjectFromStorage(AD_CONFIG_CACHE_KEY) ?? DEFAULT_AD_CONFIG
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        // detect prod vs dev/test
        const isEmulator = await DeviceInfo.isEmulator();
        const isTestDevice = __DEV__ || isEmulator;
        const production = !isTestDevice;

        const res = await fetch(
          `${get_data_uri("GOOGLE_ADS_IDS")}?production=${production}`
        );
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        const data = await res.json();

        console.log("data: ", data);

        let rewardedVideoId: string | null = null;
        let homeBannerId: string | null = null;
        let gamRewardedVideoId: string | null = null;
        let gamHomeBannerId: string | null = null;

        if (data.success && data.ads) {
          const platformAds = Platform.OS === 'android' ? data.ads.android : data.ads.ios;
          console.log("platformAds: ", platformAds);

          if (platformAds) {
            rewardedVideoId = platformAds.rewardedVideoId ?? null;
            homeBannerId = platformAds.homeBannerId ?? null;
            gamRewardedVideoId = platformAds.gamRewardedVideoId ?? null;
            gamHomeBannerId = platformAds.gamHomeBannerId ?? null;
          }
        }

        const nextAds: AdConfig = {
          rewardedVideoId,
          homeBannerId,
          gamRewardedVideoId,
          gamHomeBannerId,
        };
        setAds(nextAds);
        saveObjectToStorage(AD_CONFIG_CACHE_KEY, nextAds);

      } catch (err) {
        console.error("AdConfig error:", err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  // Never block the tree on this fetch -- every consumer of useAdConfig()
  // already tolerates null ad-unit ids (falls back to a default banner id,
  // or the rewarded-ad hook's own internal fallback), so there's nothing to
  // gain by hiding children until this resolves, and Login/SignUp/Home
  // shouldn't wait on an ad-config fetch they may not even need yet.
  return (
    <AdConfigContext.Provider value={{ ads, loading }}>
      {children}
    </AdConfigContext.Provider>
  );
};

export const useAdConfig = () => {
  const context = useContext(AdConfigContext);
  if (!context) {
    throw new Error("useAdConfig must be used within AdConfigProvider");
  }
  return context;
};

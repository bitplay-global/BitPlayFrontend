import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BANNER_ADS_ENABLED } from '../config/adPlacements';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl,
  TouchableOpacity, StatusBar, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { BannerAdSize } from 'react-native-google-mobile-ads';
import { BannerAdSlot } from '../components/ads/BannerAdSlot';
import { useRewardedVideoAd } from '../services/googleAds';
import { DEFAULT_ADMOB_BANNER_ID } from '../services/adUnitDefaults';
import { useAdConfig } from '../providers/AdConfigProvider';
import { NewsCard } from '../components/news/NewsCard';
import {
  NewsItem, fetchNews, getCachedFirstPage, PAGE_SIZE_INITIAL, PAGE_SIZE_MORE,
} from '../services/newsFeed';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** An inline banner after every Nth story -- the one slot that reads as native in a feed. */
const AD_EVERY = 6;

/**
 * Stories readable before a video is asked for, and every N stories after that.
 *
 * The video is deliberately behind a button rather than fired automatically on
 * scroll. An unprompted full-screen ad mid-article is an interstitial, and
 * Google's policy is explicit that interstitials must not interrupt content
 * consumption -- it is one of the usual causes of ad serving limits. Asking,
 * and giving the next stories in return, is the same rewarded flow as the
 * "Claim Now" video on Home.
 */
const FREE_STORIES = 10;

type Row =
  | { kind: 'news'; item: NewsItem }
  | { kind: 'ad'; key: string }
  | { kind: 'gate'; key: string };

function buildRows(items: NewsItem[], locked: boolean): Row[] {
  const rows: Row[] = [];
  items.forEach((item, index) => {
    rows.push({ kind: 'news', item });
    if (BANNER_ADS_ENABLED && (index + 1) % AD_EVERY === 0 && index !== items.length - 1) {
      rows.push({ kind: 'ad', key: `ad-${index}` });
    }
  });
  if (locked) rows.push({ kind: 'gate', key: `gate-${items.length}` });
  return rows;
}

export default function NewsScreen() {
  const navigation = useNavigation();
  const { ads } = useAdConfig();
  const bannerUnitId = ads?.homeBannerId ?? DEFAULT_ADMOB_BANNER_ID;

  const cached = getCachedFirstPage();
  const [items, setItems] = useState<NewsItem[]>(cached?.news ?? []);
  const [hasMore, setHasMore] = useState(cached?.hasMore ?? true);
  const [loading, setLoading] = useState(!cached);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  /** Stories the reader has unlocked. Rises by FREE_STORIES per video watched. */
  const [unlocked, setUnlocked] = useState(FREE_STORIES);

  // Guards a burst of onEndReached calls -- FlatList fires it more than once
  // while a load is in flight, which would page past a chunk of stories.
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // Credited only on a full watch: onReward fires for EARNED_REWARD, while
  // onAdClosed fires on every close including a skip. The earned flag is set in
  // one and consumed in the other, so a skipped video unlocks nothing.
  const earnedRef = useRef(false);
  const onAdReward = useCallback(() => { earnedRef.current = true; }, []);
  const onAdClosed = useCallback(() => {
    if (!earnedRef.current) return;
    earnedRef.current = false;
    setUnlocked(prev => prev + FREE_STORIES);
  }, []);
  const {
    show: showUnlockAd, loading: unlockAdLoading, loaded: unlockAdLoaded,
  } = useRewardedVideoAd(onAdReward, { primaryUnitId: ads?.rewardedVideoId }, onAdClosed);

  const loadFirstPage = useCallback(async (isRefresh: boolean) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (!isRefresh && items.length === 0) setLoading(true);
    setError(null);
    try {
      const page = await fetchNews(0, PAGE_SIZE_INITIAL);
      if (!mountedRef.current) return;
      setItems(page.news);
      setHasMore(page.hasMore);
    } catch {
      if (!mountedRef.current) return;
      // Cached stories are better than an error screen; only shout if there is nothing.
      if (items.length === 0) setError("Couldn't load the latest news.");
    } finally {
      if (mountedRef.current) { setLoading(false); setRefreshing(false); }
      loadingRef.current = false;
    }
  }, [items.length]);

  useEffect(() => { loadFirstPage(false); /* on mount only */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore || items.length === 0) return;
    // Behind the gate: the video has to be watched before more is fetched.
    if (items.length >= unlocked) return;
    loadingRef.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchNews(items.length, PAGE_SIZE_MORE);
      if (!mountedRef.current) return;
      setItems(prev => {
        const seen = new Set(prev.map(i => i.id));
        return [...prev, ...page.news.filter(i => !seen.has(i.id))];
      });
      setHasMore(page.hasMore);
    } catch {
      // Leave hasMore alone: scrolling again retries.
    } finally {
      if (mountedRef.current) setLoadingMore(false);
      loadingRef.current = false;
    }
  }, [hasMore, items.length, unlocked]);

  useEffect(() => {
    if (items.length > 0 && items.length < unlocked && hasMore) loadMore();
  }, [unlocked, items.length, hasMore, loadMore]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setExpandedId(null);
    setUnlocked(FREE_STORIES);
    loadFirstPage(true);
  }, [loadFirstPage]);

  const toggle = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(prev => (prev === id ? null : id));
  }, []);

  const locked = hasMore && items.length >= unlocked && !loadingMore;
  const rows = buildRows(items, locked);

  const openUnlockAd = useCallback(() => {
    // show() starts a fresh request when nothing is cached, so this is never a
    // button that silently does nothing.
    showUnlockAd();
  }, [showUnlockAd]);

  const renderRow = useCallback(({ item: row }: { item: Row }) => {
    if (row.kind === 'ad') {
      return (
        <View style={s.inlineAd}>
          <BannerAdSlot unitId={bannerUnitId} size={BannerAdSize.BANNER} />
        </View>
      );
    }
    if (row.kind === 'gate') {
      return (
        <View style={s.gate}>
          <Icon name="play-circle-outline" size={30} color="#18D4F2" />
          <Text style={s.gateTitle}>Keep reading</Text>
          <Text style={s.gateBody}>
            Watch a short video to load the next {FREE_STORIES} stories.
          </Text>
          <TouchableOpacity
            style={s.gateBtn}
            onPress={openUnlockAd}
            disabled={unlockAdLoading && !unlockAdLoaded}
            activeOpacity={0.88}
          >
            {unlockAdLoading && !unlockAdLoaded ? (
              <ActivityIndicator color="#04121A" />
            ) : (
              <Text style={s.gateBtnText}>▶  Watch &amp; Continue</Text>
            )}
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <NewsCard
        item={row.item}
        expanded={expandedId === row.item.id}
        onToggle={() => toggle(row.item.id)}
      />
    );
  }, [bannerUnitId, expandedId, toggle, openUnlockAd, unlockAdLoading, unlockAdLoaded]);

  return (
    <LinearGradient colors={['#0f172a', '#131a2e', '#0f172a']} style={s.gradient}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" translucent={false} />
      <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
        <View style={s.header}>
          {/* No back button: this is a tab, so there is nowhere to go back to.
              canGoBack() is not the test -- it reports the parent stack, which
              can always pop, and following it would throw the user out of the
              tab navigator entirely. The width is kept as a spacer so the title
              stays optically centred against the right-hand slot. */}
          <View style={s.backBtn} />
          <View style={s.titleWrap}>
            <View style={s.iconBadge}>
              <Icon name="newspaper-variant-outline" size={18} color="#18D4F2" />
            </View>
            <Text style={s.headerTitle} numberOfLines={1}>Crypto News</Text>
          </View>
          <View style={s.rightSlot} />
        </View>

        {BANNER_ADS_ENABLED && (
          <View style={s.topBanner}>
            <BannerAdSlot unitId={bannerUnitId} size={BannerAdSize.BANNER} />
          </View>
        )}

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator color="#18D4F2" size="large" />
            <Text style={s.centerText}>Fetching the latest…</Text>
          </View>
        ) : error && items.length === 0 ? (
          <View style={s.center}>
            <Icon name="wifi-off" size={34} color="#475569" />
            <Text style={s.centerText}>{error}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={() => loadFirstPage(false)} activeOpacity={0.85}>
              <Text style={s.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={row => (row.kind === 'news' ? row.item.id : row.key)}
            renderItem={renderRow}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            onEndReached={loadMore}
            onEndReachedThreshold={0.6}
            initialNumToRender={PAGE_SIZE_INITIAL}
            windowSize={7}
            removeClippedSubviews={Platform.OS === 'android'}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#18D4F2" colors={['#18D4F2']} />
            }
            ListFooterComponent={
              loadingMore ? (
                <View style={s.footer}><ActivityIndicator color="#18D4F2" /></View>
              ) : !hasMore && items.length > 0 && !locked ? (
                <Text style={s.caughtUp}>You're all caught up</Text>
              ) : null
            }
          />
        )}

        {BANNER_ADS_ENABLED && (
          <View style={s.bottomBanner}>
            <BannerAdSlot unitId={bannerUnitId} size={BannerAdSize.BANNER} />
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingTop: 6, paddingBottom: 10,
  },
  backBtn: { width: 44 },
  backCircle: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  titleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  iconBadge: {
    width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(34,211,238,0.13)', borderWidth: 1, borderColor: 'rgba(34,211,238,0.27)',
  },
  headerTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '800' },
  rightSlot: { width: 44 },
  topBanner: { alignItems: 'center', marginBottom: 8 },
  bottomBanner: { alignItems: 'center', paddingTop: 4 },
  inlineAd: { alignItems: 'center', marginBottom: 10 },
  listContent: { paddingHorizontal: 14, paddingBottom: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  centerText: { color: '#94A3B8', fontSize: 14, textAlign: 'center' },
  retryBtn: {
    marginTop: 4, paddingVertical: 10, paddingHorizontal: 22, borderRadius: 10,
    backgroundColor: 'rgba(34,211,238,0.12)', borderWidth: 1, borderColor: 'rgba(34,211,238,0.35)',
  },
  retryText: { color: '#18D4F2', fontSize: 13.5, fontWeight: '800' },
  footer: { paddingVertical: 18, alignItems: 'center' },
  gate: {
    alignItems: 'center',
    paddingVertical: 22,
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: '#0B111D',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.35)',
  },
  gateTitle: { color: '#F1F5F9', fontSize: 16, fontWeight: '800', marginTop: 8 },
  gateBody: {
    color: '#94A3B8', fontSize: 13, textAlign: 'center',
    marginTop: 6, marginBottom: 16, lineHeight: 19,
  },
  gateBtn: {
    minHeight: 46, alignSelf: 'stretch', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#18D4F2',
  },
  gateBtnText: { color: '#04121A', fontSize: 14.5, fontWeight: '900' },
  caughtUp: { color: '#475569', fontSize: 12.5, textAlign: 'center', paddingVertical: 20 },
});

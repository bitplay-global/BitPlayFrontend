import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BANNER_ADS_ENABLED } from '../config/adPlacements';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Animated, Dimensions, Image, NativeSyntheticEvent, NativeScrollEvent,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import LinearGradient from 'react-native-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { StatusBar } from 'react-native';
import { RootStackParamList } from '../components/types';
import { get_data_uri, getMobileSecurityHeaders } from '../config/api';
import { BannerAdSlot } from '../components/ads/BannerAdSlot';
import { BannerAdSize } from 'react-native-google-mobile-ads';
import { DEFAULT_ADMOB_BANNER_ID } from '../services/adUnitDefaults';
import { useAdConfig } from '../providers/AdConfigProvider';
import { WIN_GH_REWARD as TRADING_WIN_GH } from './TradingScreen';
import { WIN_REWARD_GH as MEMORY_WIN_GH } from './MemoryCardMatchScreen';
import { SLICES as SPIN_SLICES } from './SpinAndWinScreen';
import { WIN_REWARD_GH as SCRATCH_MAX_GH } from './ScratchAndWinScreen';
import { WIN_REWARD_GH as BOMB_MAX_GH } from './TapToBombScreen';
import { WIN_REWARD_GH as HILO_MAX_GH } from './HigherLowerScreen';
import { WIN_REWARD_GH as RPS_MAX_GH } from './RockPaperScissorsScreen';
import { WIN_REWARD_GH as DICE_MAX_GH } from './LuckyDiceScreen';
import { WIN_REWARD_GH as CHEST_MAX_GH } from './TreasureChestScreen';
import { WIN_REWARD_GH as REACT_MAX_GH } from './ReactionTapScreen';
import { WIN_REWARD_GH as ODD_MAX_GH } from './OddOneOutScreen';
import { WIN_REWARD_GH as RUSH_MAX_GH } from './NumberRushScreen';
import { WIN_REWARD_GH as SIMON_MAX_GH } from './SimonSaysScreen';
import { WIN_REWARD_GH as GUESS_MAX_GH } from './GuessBtcPriceScreen';
import { WIN_REWARD_GH as SLOT_MAX_GH } from './SlotMachineScreen';
import { WIN_REWARD_GH as WORD_MAX_GH } from './WordScrambleScreen';
import { WIN_REWARD_GH as MATH_MAX_GH } from './MathBlitzScreen';
import { WIN_REWARD_GH as TAP_MAX_GH } from './SpeedTapScreen';
import { WIN_REWARD_GH as WHACK_MAX_GH } from './WhackABlockScreen';
import { WIN_REWARD_GH as STACK_MAX_GH } from './StackTowerScreen';
import { WIN_REWARD_GH as CRASH_MAX_GH } from './CrashCashOutScreen';
import { WIN_REWARD_GH as QUIZ_MAX_GH } from './CryptoQuizScreen';
import { WIN_REWARD_GH as CLASH_MAX_GH } from './ColorClashScreen';
import { WIN_REWARD_GH as SWIPE_MAX_GH } from './SwipeSortScreen';

type Nav = StackNavigationProp<RootStackParamList>;
const { width: W } = Dimensions.get('window');

// Real per-game reward, sourced from each game's own reward constant/table —
// never hand-typed here, so this can't drift out of sync with what a player
// actually earns.
const SPIN_MAX_GH = Math.max(...SPIN_SLICES.filter(s => s.gh > 0).map(s => s.gh));

interface GameEntry {
  name: string;
  icon: string;
  iconImage?: any;
  color: string;
  route: keyof RootStackParamList;
  category: string;
  desc: string;
  /** Human-readable reward label, derived from the game's real reward constant(s). */
  rewardLabel: string;
}

const GAMES: GameEntry[] = [
  { name: 'BTC Trading', icon: 'bitcoin', iconImage: require('../assets/images/icon_btc_trading.png'), color: '#f59e0b', route: 'TradingScreen', category: 'Featured', desc: 'Trade BTC and earn rewards', rewardLabel: `+${TRADING_WIN_GH} GH/s` },
  { name: 'Spin & Win', icon: 'rotate-3d-variant', iconImage: require('../assets/images/game_spin.png'), color: '#22d3ee', route: 'SpinAndWin', category: 'Featured', desc: 'Spin the wheel, win rewards', rewardLabel: `Up to ${SPIN_MAX_GH} GH/s` },
  { name: 'Memory Match', icon: 'cards', iconImage: require('../assets/images/icon_memory_match.png'), color: '#7c3aed', route: 'MemoryCardMatch', category: 'Featured', desc: 'Match all the pairs', rewardLabel: `+${MEMORY_WIN_GH} GH/s` },
  { name: 'Scratch & Win', icon: 'ticket-confirmation-outline', iconImage: require('../assets/images/icon_scratch_win.png'), color: '#22c55e', route: 'ScratchAndWin', category: 'Featured', desc: 'Scratch to reveal your reward', rewardLabel: `Up to ${SCRATCH_MAX_GH} GH/s` },
  { name: 'Tap to Bomb', icon: 'bomb', iconImage: require('../assets/images/icon_tap_bomb.png'), color: '#ef4444', route: 'TapToBomb', category: 'Featured', desc: 'Tap a tile, dodge the bombs', rewardLabel: `Up to ${BOMB_MAX_GH} GH/s` },
  { name: 'Higher or Lower', icon: 'cards-playing-outline', iconImage: require('../assets/images/icon_higher_lower.png'), color: '#38bdf8', route: 'HigherLower', category: 'Featured', desc: 'Guess the next card', rewardLabel: `Up to ${HILO_MAX_GH} GH/s` },
  { name: 'Rock Paper Scissors', icon: 'hand-front-right', iconImage: require('../assets/images/icon_rps.png'), color: '#f472b6', route: 'RockPaperScissors', category: 'Featured', desc: 'Beat the house', rewardLabel: `Up to ${RPS_MAX_GH} GH/s` },
  { name: 'Lucky Dice', icon: 'dice-multiple', iconImage: require('../assets/images/icon_lucky_dice.png'), color: '#fbbf24', route: 'LuckyDice', category: 'Featured', desc: 'Roll higher than 7', rewardLabel: `Up to ${DICE_MAX_GH} GH/s` },
  { name: 'Treasure Chests', icon: 'treasure-chest', iconImage: require('../assets/images/icon_treasure_chest.png'), color: '#f59e0b', route: 'TreasureChest', category: 'Featured', desc: 'Pick the right chest', rewardLabel: `Up to ${CHEST_MAX_GH} GH/s` },
  { name: 'Reaction Tap', icon: 'lightning-bolt', iconImage: require('../assets/images/icon_reaction_tap.png'), color: '#4ade80', route: 'ReactionTap', category: 'Featured', desc: 'Tap when it turns green', rewardLabel: `Up to ${REACT_MAX_GH} GH/s` },
  { name: 'Odd One Out', icon: 'palette-outline', iconImage: require('../assets/images/icon_odd_one_out.png'), color: '#a78bfa', route: 'OddOneOut', category: 'Featured', desc: 'Spot the different shade', rewardLabel: `Up to ${ODD_MAX_GH} GH/s` },
  { name: 'Number Rush', icon: 'numeric', iconImage: require('../assets/images/icon_number_rush.png'), color: '#22d3ee', route: 'NumberRush', category: 'Featured', desc: 'Tap 1 to 12 in order', rewardLabel: `Up to ${RUSH_MAX_GH} GH/s` },
  { name: 'Simon Says', icon: 'music-note-eighth', iconImage: require('../assets/images/icon_simon_says.png'), color: '#4ade80', route: 'SimonSays', category: 'Featured', desc: 'Repeat the sequence', rewardLabel: `Up to ${SIMON_MAX_GH} GH/s` },
  { name: 'Guess the Price', icon: 'bitcoin', iconImage: require('../assets/images/icon_guess_price.png'), color: '#f7931a', route: 'GuessBtcPrice', category: 'Featured', desc: 'Spot the real BTC price', rewardLabel: `Up to ${GUESS_MAX_GH} GH/s` },
  { name: 'Slot Machine', icon: 'slot-machine', iconImage: require('../assets/images/icon_slot_machine.png'), color: '#f472b6', route: 'SlotMachine', category: 'Featured', desc: 'Match symbols to win', rewardLabel: `Up to ${SLOT_MAX_GH} GH/s` },
  { name: 'Word Scramble', icon: 'format-letter-case', iconImage: require('../assets/images/icon_word_scramble.png'), color: '#38bdf8', route: 'WordScramble', category: 'Featured', desc: 'Unscramble the crypto word', rewardLabel: `Up to ${WORD_MAX_GH} GH/s` },
  { name: 'Math Blitz', icon: 'calculator-variant-outline', iconImage: require('../assets/images/icon_math_blitz.png'), color: '#4ade80', route: 'MathBlitz', category: 'Featured', desc: 'Solve before the clock', rewardLabel: `Up to ${MATH_MAX_GH} GH/s` },
  { name: 'Speed Tap', icon: 'gesture-double-tap', iconImage: require('../assets/images/icon_speed_tap.png'), color: '#fbbf24', route: 'SpeedTap', category: 'Featured', desc: 'Tap as fast as you can', rewardLabel: `Up to ${TAP_MAX_GH} GH/s` },
  { name: 'Whack-a-Block', icon: 'hammer', iconImage: require('../assets/images/icon_whack_block.png'), color: '#f472b6', route: 'WhackABlock', category: 'Featured', desc: 'Hit blocks before they vanish', rewardLabel: `Up to ${WHACK_MAX_GH} GH/s` },
  { name: 'Stack Tower', icon: 'layers-triple-outline', iconImage: require('../assets/images/icon_stack_tower.png'), color: '#22d3ee', route: 'StackTower', category: 'Featured', desc: 'Drop blocks and keep aligned', rewardLabel: `Up to ${STACK_MAX_GH} GH/s` },
  { name: 'Crash Cash-Out', icon: 'chart-line-variant', iconImage: require('../assets/images/icon_crash_cashout.png'), color: '#22c55e', route: 'CrashCashOut', category: 'Featured', desc: 'Cash out before it crashes', rewardLabel: `Up to ${CRASH_MAX_GH} GH/s` },
  { name: 'Crypto Quiz', icon: 'help-circle-outline', iconImage: require('../assets/images/icon_crypto_quiz.png'), color: '#38bdf8', route: 'CryptoQuiz', category: 'Featured', desc: 'Answer 4 crypto questions', rewardLabel: `Up to ${QUIZ_MAX_GH} GH/s` },
  { name: 'Color Clash', icon: 'palette-swatch-outline', iconImage: require('../assets/images/icon_color_clash.png'), color: '#a78bfa', route: 'ColorClash', category: 'Featured', desc: 'Match the word to its colour', rewardLabel: `Up to ${CLASH_MAX_GH} GH/s` },
  { name: 'Swipe Sort', icon: 'gesture-swipe-horizontal', iconImage: require('../assets/images/icon_swipe_sort.png'), color: '#f59e0b', route: 'SwipeSort', category: 'Featured', desc: 'Real coin or fake coin?', rewardLabel: `Up to ${SWIPE_MAX_GH} GH/s` },
];

const CATEGORIES = [
  { key: 'Featured' },
  { key: 'All' },
];

interface PopularGame {
  gameName: string;
  totalSessions: number;
  uniquePlayers: number;
  popularityScore: number;
}

/** Wraps any pressable in a gentle scale-down/spring-back — the app's one shared press micro-interaction. */
function PressScale({
  children, onPress, style, disabled,
}: { children: React.ReactNode; onPress?: () => void; style?: any; disabled?: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} disabled={disabled}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

function SkeletonCard() {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
    ])).start();
  }, [anim]);
  return (
    <Animated.View style={[sk.card, { opacity: anim }]}>
      <View style={sk.iconBox} />
      <View style={sk.line1} />
      <View style={sk.line2} />
    </Animated.View>
  );
}

const sk = StyleSheet.create({
  card: { width: '47%', backgroundColor: '#0B111D', borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  iconBox: { width: '100%', height: 88, borderRadius: 12, backgroundColor: '#101827', marginBottom: 10 },
  line1: { height: 14, backgroundColor: '#101827', borderRadius: 6, marginBottom: 6, width: '70%' },
  line2: { height: 10, backgroundColor: '#0E1522', borderRadius: 6, width: '90%' },
});

// 8px-based spacing scale — kept file-local, matching this codebase's
// established convention of per-screen constants (no centralized theme file
// exists anywhere in src/).
const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

// Carousel geometry: one shared source of truth for slide width, used both
// to size each slide AND to compute the scroll index — this is what keeps
// the "peek of next card" composition and the pagination dots in sync.
const CAROUSEL_PEEK = 28;
const SLIDE_WIDTH = W - SPACING.md * 2 - CAROUSEL_PEEK;
const SLIDE_STRIDE = SLIDE_WIDTH + SPACING.md;

// Space reserved at the end of the list for the bottom banner. With banners off
// the wrapper never renders, so its onLayout never fires and this default would
// otherwise sit there forever as dead space above the tab bar.
const DEFAULT_BOTTOM_BAR_HEIGHT = BANNER_ADS_ENABLED ? 72 : 0;

export default function GameZoneScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  // Server-configured banner unit, same source HomeScreen uses. The hardcoded
  // DEFAULT_ADMOB_BANNER_ID is only a last-resort fallback -- on iOS that unit
  // does not serve, which is why this screen showed no ad on TestFlight while
  // Home did.
  const { ads } = useAdConfig();
  const bannerUnitId = ads?.homeBannerId ?? DEFAULT_ADMOB_BANNER_ID;
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Featured');
  const [popular, setPopular] = useState<PopularGame[]>([]);
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  // Measured height of the fixed bottom ad bar, so scrollable content can
  // reserve exactly enough space to never slide underneath it. Starts at a
  // sane default to avoid a first-frame gap before onLayout fires.
  const [bottomBarHeight, setBottomBarHeight] = useState(DEFAULT_BOTTOM_BAR_HEIGHT);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((text: string) => {
    setSearch(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (text.trim().length >= 2) {
      searchDebounceRef.current = setTimeout(() => {
        const matches = GAMES.filter(g => g.name.toLowerCase().includes(text.toLowerCase())).length;
      }, 800);
    }
  }, []);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const gridAnim = useRef(new Animated.Value(0)).current;
  const hotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(gridAnim, { toValue: 1, duration: 700, delay: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  const fetchPopular = useCallback(async () => {
    try {
      const url = `${get_data_uri('GAME_SESSIONS_POPULAR')}?limit=30`;
      const res = await fetch(url, { headers: getMobileSecurityHeaders() });
      const data = await res.json();
      if (data.success && Array.isArray(data.popular)) {
        setPopular(data.popular.slice(0, 3));
        const counts: Record<string, number> = {};
        data.popular.forEach((g: PopularGame) => { counts[g.gameName] = g.totalSessions; });
        setSessionCounts(counts);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchPopular(); }, [fetchPopular]));

  // Fade the hot-games row in the moment real data actually arrives, rather
  // than animating on mount against still-empty state.
  useEffect(() => {
    if (popular.length > 0) {
      Animated.timing(hotAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start();
    }
  }, [popular.length, hotAnim]);

  const hotNames = new Set(popular.map(g => g.gameName));
  const filtered = GAMES.filter(g => {
    const matchCat = activeCategory === 'All' || g.category === activeCategory;
    const matchSearch = g.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const RANK_COLOR = ['#FFD24C', '#C7CEDA', '#D68A4C'];

  const onFeaturedScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SLIDE_STRIDE);
    if (idx !== featuredIndex) setFeaturedIndex(idx);
  };

  const onBottomBarLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && Math.abs(h - bottomBarHeight) > 0.5) setBottomBarHeight(h);
  };

  const showFeaturedCarousel = activeCategory === 'Featured' && filtered.length > 0;

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#050914', '#0A0F1C']} style={StyleSheet.absoluteFill} />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      {/* No `edges` override — SafeAreaView pads all 4 sides once, exactly
          like HomeScreen, so we never hand-add insets.bottom ourselves. */}
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>

        {/* Header */}
        <Animated.View style={[styles.header, { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>
          {/* No back button: Game Zone is a tab, so there is nowhere to go
              back to, and following the parent stack would drop the user out of
              the tab navigator. The width is kept so the header does not shift. */}
          <View style={styles.backBtn} />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Game Zone</Text>
            <Text style={styles.headerSub}>
              {GAMES.length} games <Text style={styles.headerSubDot}>&middot;</Text> <Text style={styles.accent}>Earn GH/s</Text>
            </Text>
          </View>
          <View style={styles.statusCapsule}>
            <MaterialCommunityIcons name="lightning-bolt" size={13} color="#18D4F2" />
            <Text style={styles.statusCapsuleTxt}>{GAMES.length}</Text>
          </View>
        </Animated.View>

        {/* Banner Ad below header, outside ScrollView for reliable rendering */}
        {BANNER_ADS_ENABLED && (
          <View style={styles.bannerTop}>
            <BannerAdSlot unitId={bannerUnitId} size={BannerAdSize.ADAPTIVE_BANNER} />
          </View>
        )}

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomBarHeight + SPACING.lg }}
        >

          {/* Hot / Popular section */}
          {(loading || popular.length > 0) && (
            <View style={styles.hotSection}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionTitleWithIcon}>
                  <MaterialCommunityIcons name="fire" size={15} color="#f59e0b" />
                  <Text style={styles.hotSectionTitle}>Most Played This Month</Text>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hotRow}>
                {loading ? (
                  [0, 1, 2].map(i => (
                    <View key={i} style={styles.hotCardSkeleton}>
                      <Animated.View style={{ flex: 1, opacity: headerAnim }} />
                    </View>
                  ))
                ) : (
                  <Animated.View style={[styles.hotRow, { opacity: hotAnim, transform: [{ translateY: hotAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
                    {popular.map((p, idx) => {
                      const game = GAMES.find(g => g.name === p.gameName);
                      if (!game) return null;
                      return (
                        <PressScale key={game.route} onPress={() => navigation.navigate(game.route as any)}>
                          <View style={styles.hotCard}>
                            <View style={[styles.hotRankBadge, { backgroundColor: RANK_COLOR[idx] + '22', borderColor: RANK_COLOR[idx] + '55' }]}>
                              <Text style={[styles.hotRankTxt, { color: RANK_COLOR[idx] }]}>#{idx + 1}</Text>
                            </View>
                            <View style={[styles.hotIconBg, { backgroundColor: game.color + '1c' }]}>
                              {game.iconImage ? (
                                <Image source={game.iconImage} style={styles.hotIconImg} resizeMode="cover" />
                              ) : (
                                <MaterialCommunityIcons name={game.icon} size={26} color={game.color} />
                              )}
                            </View>
                            <Text style={styles.hotName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{game.name}</Text>
                            <Text style={styles.hotPlays}>{p.totalSessions.toLocaleString()} plays</Text>
                            <View style={styles.hotPlayPill}>
                              <MaterialCommunityIcons name="play" size={11} color="#18D4F2" />
                              <Text style={styles.hotPlayTxt}>PLAY</Text>
                            </View>
                          </View>
                        </PressScale>
                      );
                    })}
                  </Animated.View>
                )}
              </ScrollView>
            </View>
          )}

          {/* Search */}
          <View style={styles.searchWrap}>
            <MaterialCommunityIcons name="magnify" size={17} color="#7E8CA3" style={styles.searchIcon} />
            <TextInput
              style={styles.search}
              placeholder="Search games..."
              placeholderTextColor="#556277"
              value={search}
              onChangeText={handleSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <MaterialCommunityIcons name="close-circle" size={16} color="#7E8CA3" />
              </TouchableOpacity>
            )}
          </View>

          {/* Category tabs — segmented pill active-state, not just an underline/text-color change */}
          <View style={styles.tabsRow}>
            {CATEGORIES.map(cat => {
              const active = activeCategory === cat.key;
              return (
                <TouchableOpacity
                  key={cat.key}
                  onPress={() => setActiveCategory(cat.key)}
                  activeOpacity={0.75}
                  style={[styles.tab, active && styles.tabActive]}
                >
                  <Text style={[styles.tabTxt, active && styles.tabTxtActive]}>{cat.key === 'All' ? 'All Games' : cat.key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Section label */}
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>{activeCategory === 'All' ? 'All Games' : 'Featured'}</Text>
            <Text style={styles.sectionCount}>{filtered.length} games</Text>
          </View>

          {loading ? (
            <View style={styles.grid}>
              <View style={styles.skeletonRow}>
                {[0, 1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} />)}
              </View>
            </View>
          ) : showFeaturedCarousel ? (
            /* Featured: large spotlight cards, one dominant card + peek of next, swipeable */
            <Animated.View style={{ opacity: gridAnim }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={SLIDE_STRIDE}
                snapToAlignment="start"
                contentContainerStyle={{ paddingHorizontal: SPACING.md }}
                onScroll={onFeaturedScroll}
                scrollEventThrottle={16}
              >
                {filtered.map((game, i) => {
                  const plays = sessionCounts[game.name];
                  const isLast = i === filtered.length - 1;
                  return (
                    <View key={game.route} style={{ width: SLIDE_WIDTH, marginRight: isLast ? 0 : SPACING.md }}>
                      <PressScale onPress={() => navigation.navigate(game.route as any)}>
                        <View style={styles.featuredCard}>
                          <View style={styles.featuredArt}>
                            {game.iconImage ? (
                              <Image source={game.iconImage} style={styles.featuredIconImg} resizeMode="contain" />
                            ) : (
                              <View style={[styles.featuredArtFallback, { backgroundColor: game.color + '12' }]}>
                                <MaterialCommunityIcons name={game.icon} size={56} color={game.color} />
                              </View>
                            )}
                          </View>
                          <View style={styles.featuredBody}>
                            <View style={styles.featuredTag}>
                              <Text style={styles.featuredTagTxt}>FEATURED</Text>
                            </View>
                            <Text style={styles.featuredTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{game.name}</Text>
                            <Text style={styles.featuredDesc} numberOfLines={2}>{game.desc}</Text>
                            <View style={styles.rewardRow}>
                              <MaterialCommunityIcons name="lightning-bolt" size={14} color="#18D4F2" />
                              <Text style={styles.rewardTxt}>{game.rewardLabel}</Text>
                            </View>
                            {plays != null && plays > 0 && (
                              <Text style={styles.playsText}>{plays >= 1000 ? `${(plays / 1000).toFixed(1)}k` : plays} plays</Text>
                            )}
                            <View style={styles.playNowBtn}>
                              <Text style={styles.playNowTxt}>Play Now</Text>
                              <MaterialCommunityIcons name="arrow-right" size={15} color="#18D4F2" />
                            </View>
                          </View>
                        </View>
                      </PressScale>
                    </View>
                  );
                })}
              </ScrollView>
              {filtered.length > 1 && (
                <View style={styles.dots}>
                  {filtered.map((_, i) => (
                    <View key={i} style={[styles.dot, i === featuredIndex && styles.dotActive]} />
                  ))}
                </View>
              )}
            </Animated.View>
          ) : (
            /* All Games: compact grid */
            <Animated.View style={[styles.grid, { opacity: gridAnim, transform: [{ translateY: gridAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }]}>
              <View style={styles.cardRow}>
                {filtered.map(game => {
                  const isHot = hotNames.has(game.name);
                  const plays = sessionCounts[game.name];
                  return (
                    <PressScale key={game.route} onPress={() => navigation.navigate(game.route as any)} style={styles.card}>
                      <View style={[styles.gameArt, { backgroundColor: game.color + '10' }]}>
                        {isHot && (
                          <View style={styles.hotBadge}>
                            <Text style={styles.hotBadgeTxt}>HOT</Text>
                          </View>
                        )}
                        {game.iconImage ? (
                          <Image source={game.iconImage} style={styles.gameArtImg} resizeMode="cover" />
                        ) : (
                          <MaterialCommunityIcons name={game.icon} size={40} color={game.color} />
                        )}
                      </View>
                      <View style={styles.cardInfo}>
                        <Text style={styles.cardName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{game.name}</Text>
                        <Text style={styles.cardDesc} numberOfLines={2}>{game.desc}</Text>
                        <View style={styles.cardFooter}>
                          <View style={styles.rewardRow}>
                            <MaterialCommunityIcons name="lightning-bolt" size={12} color="#18D4F2" />
                            <Text style={styles.cardRewardTxt}>{game.rewardLabel}</Text>
                          </View>
                          <View style={styles.playCircle}>
                            <MaterialCommunityIcons name="play" size={12} color="#18D4F2" />
                          </View>
                        </View>
                        {plays != null && plays > 0 && (
                          <Text style={styles.playsText}>{plays >= 1000 ? `${(plays / 1000).toFixed(1)}k` : plays} plays</Text>
                        )}
                      </View>
                    </PressScale>
                  );
                })}
              </View>

              {filtered.length === 0 && (
                <View style={styles.emptyWrap}>
                  <MaterialCommunityIcons name="magnify" size={40} color="#556277" style={{ marginBottom: 12 }} />
                  <Text style={styles.emptyTitle}>No games found</Text>
                  <Text style={styles.emptyDesc}>Try a different search or category</Text>
                  <PressScale onPress={() => { setSearch(''); setActiveCategory('All'); }}>
                    <View style={styles.clearBtn}>
                      <Text style={styles.clearBtnTxt}>Clear filters</Text>
                    </View>
                  </PressScale>
                </View>
              )}
            </Animated.View>
          )}

          {/* Play More, Earn More */}
          <View style={styles.promo}>
            <View style={styles.promoIcon}>
              <MaterialCommunityIcons name="gift-outline" size={19} color="#C084FC" />
            </View>
            <View style={styles.promoText}>
              <Text style={styles.promoTitle}>Play More, Earn More</Text>
              <Text style={styles.promoDesc}>Play games and earn GH/s to boost your mining power.</Text>
            </View>
            <PressScale onPress={() => navigation.navigate('FAQScreen' as never)}>
              <View style={styles.promoBtn}>
                <Text style={styles.promoBtnTxt}>How it works</Text>
              </View>
            </PressScale>
          </View>
        </ScrollView>

        {/* Fixed bottom banner ad — absolutely pinned, mirrors HomeScreen's
            pattern exactly (no manual insets.bottom math; SafeAreaView above
            already accounts for it since we no longer exclude the bottom
            edge). Reserved-content padding above is driven by this View's
            own measured height via onLayout. */}
        {BANNER_ADS_ENABLED && (
          <View style={styles.bottomBannerWrap} onLayout={onBottomBarLayout}>
            <BannerAdSlot unitId={bannerUnitId} size={BannerAdSize.ADAPTIVE_BANNER} />
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const CYAN = '#18D4F2';
const TEXT = '#F5F7FA';
const TEXT_DIM = '#7E8CA3';
const TEXT_MUTED = '#556277';
const SURFACE = '#0B111D';
const SURFACE_2 = '#101827';
const BORDER = 'rgba(255,255,255,0.08)';
const BORDER_SOFT = 'rgba(255,255,255,0.05)';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050914' },
  safe: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm + 4, paddingBottom: SPACING.md,
  },
  backBtn: { padding: 4, marginRight: SPACING.sm + 4, marginTop: 2 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: TEXT, letterSpacing: -0.3 },
  headerSub: { fontSize: 13.5, color: TEXT_DIM, marginTop: 4, fontWeight: '500' },
  headerSubDot: { color: TEXT_MUTED },
  accent: { color: CYAN },
  statusCapsule: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: BORDER,
    borderRadius: 20, paddingHorizontal: SPACING.md - 3, paddingVertical: SPACING.sm, marginTop: 2,
  },
  statusCapsuleTxt: { color: TEXT, fontWeight: '700', fontSize: 14 },

  bannerTop: {
    alignItems: 'center', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: BORDER_SOFT,
    backgroundColor: 'rgba(11,17,29,0.4)',
  },

  hotSection: { paddingTop: 4, paddingBottom: 4 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, marginBottom: SPACING.md - 4, marginTop: 4 },
  sectionTitleWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hotSectionTitle: { fontSize: 13.5, fontWeight: '700', color: TEXT_DIM },
  sectionTitle: { fontSize: 19, fontWeight: '800', color: TEXT, letterSpacing: -0.2 },
  sectionCount: { fontSize: 12, color: TEXT_MUTED, fontWeight: '600' },

  hotRow: { flexDirection: 'row', gap: SPACING.sm + 4, paddingHorizontal: SPACING.lg, paddingBottom: 4 },
  hotCard: {
    width: 132, borderRadius: 16, padding: SPACING.md - 2, alignItems: 'center',
    backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER,
  },
  hotCardSkeleton: { width: 132, height: 158, borderRadius: 16, backgroundColor: SURFACE, marginLeft: SPACING.lg },
  hotRankBadge: { position: 'absolute', top: 10, left: 10, borderRadius: 8, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  hotRankTxt: { fontSize: 10, fontWeight: '800' },
  hotIconBg: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm + 2, overflow: 'hidden' },
  hotIconImg: { width: '100%', height: '100%' },
  hotName: { fontSize: 12.5, fontWeight: '700', color: TEXT, textAlign: 'center', marginBottom: 3 },
  hotPlays: { fontSize: 10.5, color: TEXT_MUTED, marginBottom: SPACING.sm + 2, fontVariant: ['tabular-nums'] },
  hotPlayPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(24,212,242,0.12)', borderWidth: 1, borderColor: 'rgba(24,212,242,0.25)',
    paddingHorizontal: 11, paddingVertical: 4, borderRadius: 12,
  },
  hotPlayTxt: { fontSize: 10, fontWeight: '800', color: CYAN, letterSpacing: 0.5 },

  searchWrap: {
    marginHorizontal: SPACING.lg, marginTop: SPACING.md + 2, marginBottom: SPACING.md + 2,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: SURFACE_2, borderRadius: 16,
    paddingHorizontal: SPACING.md, height: 52,
    borderWidth: 1, borderColor: BORDER,
  },
  searchIcon: { marginRight: SPACING.sm + 2 },
  search: { flex: 1, color: TEXT, fontSize: 15 },

  tabsRow: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg - 4 },
  tab: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 2, borderRadius: 12,
    borderWidth: 1, borderColor: 'transparent',
  },
  tabActive: {
    backgroundColor: 'rgba(24,212,242,0.12)', borderColor: 'rgba(24,212,242,0.3)',
  },
  tabTxt: { fontSize: 14.5, fontWeight: '600', color: TEXT_MUTED },
  tabTxtActive: { color: CYAN, fontWeight: '700' },

  featuredCard: {
    flexDirection: 'row', borderRadius: 20, borderWidth: 1, borderColor: BORDER,
    backgroundColor: SURFACE, overflow: 'hidden',
    shadowColor: CYAN, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 16,
    elevation: 4,
  },
  /* Bounded, padded, contain-fit art container — no absolute overlap with body,
     never crops the circular wheel, never stretches it. Sized conservatively
     (34%, tight 12px margin) so the body column keeps enough width for the
     title to never clip, down to small ~320dp-wide screens. */
  featuredArt: {
    width: '34%', aspectRatio: 1, alignSelf: 'center',
    margin: SPACING.sm + 4, borderRadius: 16, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  featuredArtFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  featuredIconImg: { width: '100%', height: '100%' },
  featuredBody: { flex: 1, paddingVertical: SPACING.lg, paddingRight: SPACING.md, paddingLeft: 0, justifyContent: 'center' },
  featuredTag: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(24,212,242,0.12)', borderWidth: 1, borderColor: 'rgba(24,212,242,0.3)',
    borderRadius: 7, paddingHorizontal: SPACING.sm + 2, paddingVertical: 5, marginBottom: SPACING.sm + 2,
  },
  featuredTagTxt: { fontSize: 10.5, fontWeight: '700', color: CYAN, letterSpacing: 0.8 },
  featuredTitle: { fontSize: 18, fontWeight: '800', color: TEXT, letterSpacing: -0.2, marginBottom: 6 },
  featuredDesc: { fontSize: 13, color: TEXT_DIM, lineHeight: 18 },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: SPACING.sm + 4 },
  rewardTxt: { fontSize: 14, fontWeight: '700', color: CYAN, fontVariant: ['tabular-nums'] },
  playNowBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    borderWidth: 1.5, borderColor: CYAN, borderRadius: 12,
    paddingHorizontal: SPACING.md + 4, paddingVertical: SPACING.sm + 3, marginTop: SPACING.sm + 4,
    shadowColor: CYAN, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 8,
  },
  playNowTxt: { fontSize: 14, fontWeight: '700', color: CYAN },

  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.md - 2 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: TEXT_MUTED, opacity: 0.5 },
  dotActive: { width: 16, backgroundColor: CYAN, opacity: 1 },

  grid: { paddingHorizontal: SPACING.lg, paddingTop: 4 },
  skeletonRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  cardRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: {
    width: '47.5%', backgroundColor: SURFACE, borderRadius: 16,
    marginBottom: SPACING.md - 2, overflow: 'hidden',
    borderWidth: 1, borderColor: BORDER,
  },
  gameArt: {
    aspectRatio: 1.5, alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden',
  },
  gameArtImg: { width: '100%', height: '100%' },
  hotBadge: {
    position: 'absolute', top: 9, right: 9,
    backgroundColor: 'rgba(245,158,11,0.16)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  hotBadgeTxt: { fontSize: 9, fontWeight: '800', color: '#f59e0b', letterSpacing: 0.4 },
  cardInfo: { padding: SPACING.md - 3 },
  cardName: { fontSize: 14.5, fontWeight: '700', color: TEXT, marginBottom: 3 },
  cardDesc: { fontSize: 11.5, color: TEXT_DIM, lineHeight: 15.5, marginBottom: SPACING.sm + 2, minHeight: 31 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardRewardTxt: { fontSize: 12, fontWeight: '700', color: CYAN, fontVariant: ['tabular-nums'] },
  playCircle: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: CYAN,
    alignItems: 'center', justifyContent: 'center',
  },
  playsText: { fontSize: 10, color: TEXT_MUTED, fontWeight: '600', marginTop: 6, fontVariant: ['tabular-nums'] },

  emptyWrap: { alignItems: 'center', paddingTop: 60, paddingBottom: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: TEXT, marginBottom: 6 },
  emptyDesc: { fontSize: 13.5, color: TEXT_DIM, marginBottom: SPACING.lg - 4 },
  clearBtn: { backgroundColor: CYAN, paddingHorizontal: SPACING.lg - 2, paddingVertical: SPACING.sm + 3, borderRadius: 12 },
  clearBtnTxt: { color: '#050914', fontWeight: '700', fontSize: 13.5 },

  promo: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm + 5,
    backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, borderRadius: 16,
    padding: SPACING.md - 1, marginHorizontal: SPACING.lg,
    // 10px (was 6) so the card clears the Featured carousel's pagination
    // dots, which sit directly above it.
    marginTop: 10,
  },
  promoIcon: {
    width: 40, height: 40, borderRadius: 11,
    backgroundColor: 'rgba(192,132,252,0.14)', borderWidth: 1, borderColor: 'rgba(192,132,252,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  promoText: { flex: 1 },
  promoTitle: { fontSize: 13.5, fontWeight: '700', color: TEXT },
  promoDesc: { fontSize: 11, color: TEXT_DIM, marginTop: 3, lineHeight: 15 },
  promoBtn: {
    borderWidth: 1.5, borderColor: CYAN, borderRadius: 10,
    paddingHorizontal: SPACING.md - 3, paddingVertical: SPACING.sm + 1,
  },
  promoBtnTxt: { fontSize: 11.5, fontWeight: '700', color: CYAN },

  // Fixed, absolutely-pinned bottom ad bar — mirrors HomeScreen's
  // `bannerWrapper` exactly. No manual insets.bottom: SafeAreaView (no
  // `edges` override above) already pads for it on Android's nav-bar inset.
  bottomBannerWrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(5,9,20,0.92)',
    borderTopWidth: 1, borderTopColor: BORDER_SOFT,
  },
});

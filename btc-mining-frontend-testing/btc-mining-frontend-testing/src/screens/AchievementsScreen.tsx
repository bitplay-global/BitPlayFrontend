import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../components/types';
import { useAuth } from '../auth/AuthProvider';
import { get_data_uri } from '../config/api';
import LinearGradient from 'react-native-linear-gradient';
import { formatMiningLocalTimeForApi } from '../utils/miningTime';

const { height: screenHeight } = Dimensions.get('window');

const STREAK_TIERS = [
  { minDays: 0,  bonusGh: 5,  label: 'Day 1–7' },
  { minDays: 8,  bonusGh: 10, label: 'Day 8–14' },
  { minDays: 15, bonusGh: 15, label: 'Day 15–21' },
  { minDays: 22, bonusGh: 20, label: 'Day 22–28' },
  { minDays: 29, bonusGh: 25, label: 'Day 29+' },
];

const AchievementsScreen = () => {
  type SidebarNavigationProp = StackNavigationProp<RootStackParamList, 'AchievementsScreen'>;
  const navigation = useNavigation<SidebarNavigationProp>();
  const { user } = useAuth();

  const [streakDays, setStreakDays] = useState(0);
  const [streakBonusGh, setStreakBonusGh] = useState(0);
  const [loading, setLoading] = useState(true);

  const getActiveTierIndex = (days: number) => {
    for (let i = STREAK_TIERS.length - 1; i >= 0; i--) {
      if (days >= STREAK_TIERS[i].minDays) return i;
    }
    return -1;
  };

  const fetchStreak = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const url = `${get_data_uri('USERMININGDETAILS')}/${user.id}?local_time=${encodeURIComponent(formatMiningLocalTimeForApi(new Date()))}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.mining_details) {
        setStreakDays(data.mining_details.streak_days ?? 0);
        setStreakBonusGh(data.mining_details.streak_bonus_gh ?? 0);
      }
    } catch (e) {
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchStreak();
    }, [fetchStreak])
  );

  const activeTierIdx = getActiveTierIndex(streakDays);
  const currentTier = activeTierIdx >= 0 ? STREAK_TIERS[activeTierIdx] : null;
  const nextTier = activeTierIdx >= 0 && activeTierIdx < STREAK_TIERS.length - 1
    ? STREAK_TIERS[activeTierIdx + 1]
    : null;
  const daysInTier = currentTier && nextTier
    ? (activeTierIdx === 0 ? 7 : nextTier.minDays - currentTier.minDays)
    : currentTier ? 7 : 7;
  const daysIntoCurrentTier = currentTier ? streakDays - currentTier.minDays : 0;
  const progressInTier = currentTier && daysInTier > 0
    ? Math.min(1, daysIntoCurrentTier / daysInTier)
    : 0;
  const isMaxTier = activeTierIdx === STREAK_TIERS.length - 1;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow}>
          <Icon name="chevron-back" size={22} color="white" />
          <Text style={styles.topBarTitle}>Achievements</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Current streak hero */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <Text style={styles.heroStreakNumber}>{streakDays}</Text>
            <Image
              source={require('../assets/images/trophy.png')}
              style={styles.heroTrophy}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.heroLabel}>Day streak</Text>
          <Text style={styles.heroBonus}>+{streakBonusGh} Gh/s bonus active</Text>

          {/* Progress bar: days in current tier */}
          <View style={styles.progressSection}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>
                {isMaxTier
                  ? 'Max tier reached'
                  : nextTier
                    ? `Day ${daysIntoCurrentTier} of ${daysInTier} in this tier`
                    : 'Building streak'}
              </Text>
              {!isMaxTier && nextTier && (
                <Text style={styles.progressNext}>Next: +{nextTier.bonusGh} Gh/s</Text>
              )}
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.round(progressInTier * 100)}%` },
                ]}
              />
            </View>
          </View>
        </View>

        {/* What you have - tier list */}
        <Text style={styles.sectionTitle}>Streak bonus tiers</Text>
        <Text style={styles.sectionSub}>
          Bonus is applied automatically when you start mining.
        </Text>

        {loading ? (
          <ActivityIndicator size="small" color="#00FFA6" style={{ marginVertical: 24 }} />
        ) : (
          <View style={styles.tierList}>
            {STREAK_TIERS.map((tier, index) => {
              const isActive = index === activeTierIdx;
              const isReached = streakDays >= tier.minDays;
              return (
                <View
                  key={index}
                  style={[
                    styles.tierRow,
                    isActive && styles.tierRowActive,
                    isReached && !isActive && styles.tierRowReached,
                  ]}
                >
                  <Image
                    source={require('../assets/images/medal.png')}
                    style={[styles.tierMedal, !isReached && styles.tierMedalLocked]}
                  />
                  <View style={styles.tierContent}>
                    <Text style={[styles.tierLabel, !isReached && styles.tierLabelLocked]}>
                      {tier.label}
                    </Text>
                    <Text style={styles.tierStatus}>
                      {isActive
                        ? `Active · ${streakDays} day streak`
                        : isReached
                          ? 'Completed'
                          : `Locked · ${tier.minDays} days needed`}
                    </Text>
                  </View>
                  {isActive ? (
                    Platform.OS === 'ios' ? (
                      <View style={styles.activeBoxWrapIos}>
                        <LinearGradient
                          colors={['#00FFA6', '#00CC85']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={[StyleSheet.absoluteFillObject, { borderRadius: 10 }]}
                        />
                        <Text style={styles.activeBoxText}>+{tier.bonusGh} Gh/s</Text>
                      </View>
                    ) : (
                      <LinearGradient
                        colors={['#00FFA6', '#00CC85']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.activeBox}
                      >
                        <Text style={styles.activeBoxText}>+{tier.bonusGh} Gh/s</Text>
                      </LinearGradient>
                    )
                  ) : (
                    <View style={[
                      styles.bonusChip,
                      isReached ? styles.bonusChipReached : styles.bonusChipLocked,
                    ]}>
                      <Text style={[
                        styles.bonusChipText,
                        isReached && styles.bonusChipTextReached,
                      ]}>
                        +{tier.bonusGh} Gh/s
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.warningBox}>
          <Icon name="information-circle-outline" size={18} color="#94A3B8" />
          <Text style={styles.warningText}>
            Mine every day to keep your streak. Miss a day and your streak resets; your bonus matches your current tier.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

export default AchievementsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topBarTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 24,
    marginBottom: 28,
    alignItems: 'center',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroStreakNumber: {
    fontSize: 48,
    color: 'white',
    fontWeight: '800',
  },
  heroTrophy: {
    width: 44,
    height: 44,
    marginLeft: 10,
  },
  heroLabel: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 6,
  },
  heroBonus: {
    color: '#00FFA6',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  progressSection: {
    width: '100%',
    marginTop: 20,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    color: '#94A3B8',
    fontSize: 12,
  },
  progressNext: {
    color: '#00FFA6',
    fontSize: 12,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 8,
    backgroundColor: '#00FFA6',
    borderRadius: 4,
  },
  sectionTitle: {
    color: '#F1F5F9',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 16,
  },
  tierList: {},
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tierRowActive: {
    borderColor: 'rgba(0, 255, 166, 0.4)',
    backgroundColor: 'rgba(0, 255, 166, 0.08)',
  },
  tierRowReached: {
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
  },
  tierMedal: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  tierMedalLocked: {
    opacity: 0.35,
  },
  tierContent: {
    flex: 1,
    marginLeft: 14,
  },
  tierLabel: {
    color: '#F1F5F9',
    fontSize: 15,
    fontWeight: '600',
  },
  tierLabelLocked: {
    color: '#64748B',
  },
  tierStatus: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  bonusChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#334155',
  },
  bonusChipReached: {
    backgroundColor: 'rgba(5, 150, 105, 0.25)',
  },
  bonusChipLocked: {
    opacity: 0.6,
  },
  bonusChipText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  bonusChipTextReached: {
    color: '#34D399',
  },
  activeBox: {
    marginLeft: 'auto',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBoxWrapIos: {
    marginLeft: 'auto',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    overflow: 'hidden',
    flexShrink: 0,
  },
  activeBoxText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '700',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginTop: 24,
  },
  warningText: {
    flex: 1,
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },
});

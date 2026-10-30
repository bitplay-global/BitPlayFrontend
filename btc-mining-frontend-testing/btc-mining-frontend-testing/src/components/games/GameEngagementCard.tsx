import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../auth/AuthProvider';
import { get_data_uri } from '../../config/api';

/**
 * Game Zone header card: the daily game streak and this week's leaderboard.
 * Data from GET /api/user_mining/game-engagement/:userId (backend
 * helpers/gameEngagement.js). Days count when a game reward is claimed;
 * days 3, 5 and 7 of each week-long cycle pay bonus GH/s for 24 hours.
 */
type Streak = {
  streakDays: number; playedToday: boolean; cycleDay: number;
  nextBonusDay: number; nextBonusGh: number; daysToNextBonus: number;
};
type Row = { rank: number; name: string; gh: number; wins: number; isMe: boolean };
type Data = { streak: Streak; leaderboard: { rows: Row[] }; me: { gh: number; rank: number | null } };

const MILESTONES = [{ day: 3, gh: 10 }, { day: 5, gh: 20 }, { day: 7, gh: 30 }];
const MEDAL = ['#FFD24C', '#C7CEDA', '#D68A4C'];

export default function GameEngagementCard() {
  const { user } = useAuth();
  const [data, setData] = useState<Data | null>(null);
  const [showBoard, setShowBoard] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      let cancelled = false;
      fetch(`${get_data_uri('USERMININGDETAILS')}/game-engagement/${user.id}`)
        .then(r => r.json())
        .then(d => { if (!cancelled && d?.success) setData(d); })
        .catch(() => {});
      return () => { cancelled = true; };
    }, [user?.id]),
  );

  if (!data) return null;
  const { streak, leaderboard, me } = data;
  const rows = leaderboard.rows.slice(0, showBoard ? 20 : 3);

  return (
    <View style={s.card}>
      {/* Streak */}
      <View style={s.row}>
        <MaterialCommunityIcons name="fire" size={20} color="#F59E0B" />
        <Text style={s.title}>Game Streak: {streak.streakDays} {streak.streakDays === 1 ? 'day' : 'days'}</Text>
      </View>
      <View style={s.steps}>
        {Array.from({ length: 7 }, (_, i) => {
          const day = i + 1;
          const done = day <= streak.cycleDay;
          const prize = MILESTONES.find(m => m.day === day);
          return (
            <View key={day} style={[s.step, done && s.stepDone, prize && s.stepPrize]}>
              <Text style={[s.stepTxt, done && s.stepTxtDone]}>{prize ? `+${prize.gh}` : day}</Text>
            </View>
          );
        })}
      </View>
      <Text style={s.sub}>
        {streak.playedToday
          ? `Today counted. ${streak.daysToNextBonus === 0 ? '' : `${streak.daysToNextBonus} more ${streak.daysToNextBonus === 1 ? 'day' : 'days'} to +${streak.nextBonusGh} GH/s.`}`
          : 'Win and claim any game reward today to keep your streak.'}
      </Text>

      {/* Leaderboard */}
      <View style={[s.row, { marginTop: 14 }]}>
        <MaterialCommunityIcons name="trophy" size={18} color="#FFD24C" />
        <Text style={s.title}>Top Players This Week</Text>
      </View>
      {rows.length === 0 ? (
        <Text style={s.sub}>No winners yet this week — be the first!</Text>
      ) : rows.map(r => (
        <View key={r.rank} style={[s.lbRow, r.isMe && s.lbMe]}>
          <Text style={[s.lbRank, { color: MEDAL[r.rank - 1] ?? '#94A3B8' }]}>#{r.rank}</Text>
          <Text style={s.lbName} numberOfLines={1}>{r.isMe ? `${r.name} (you)` : r.name}</Text>
          <Text style={s.lbGh}>{r.gh} GH/s</Text>
        </View>
      ))}
      <Text style={s.sub}>
        {me.rank ? `You: #${me.rank} with ${me.gh} GH/s from games this week.` : 'Claim a game reward to join this week’s board.'}
        {' '}Resets every Monday (UTC).
      </Text>
      {leaderboard.rows.length > 3 && (
        <TouchableOpacity onPress={() => setShowBoard(v => !v)} style={s.more} accessibilityRole="button">
          <Text style={s.moreTxt}>{showBoard ? 'Show less' : 'See top 20'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 16,
    backgroundColor: 'rgba(15,23,42,0.85)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: '#F8FAFC', fontSize: 15, fontWeight: '800' },
  sub: { color: '#94A3B8', fontSize: 12, marginTop: 8, lineHeight: 17 },
  steps: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  step: {
    width: 38, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(148,163,184,0.12)',
  },
  stepPrize: { borderWidth: 1, borderColor: 'rgba(245,158,11,0.6)' },
  stepDone: { backgroundColor: 'rgba(245,158,11,0.85)' },
  stepTxt: { color: '#CBD5E1', fontSize: 11.5, fontWeight: '700' },
  stepTxtDone: { color: '#111827' },
  lbRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 6, borderRadius: 8, marginTop: 4 },
  lbMe: { backgroundColor: 'rgba(24,212,242,0.12)' },
  lbRank: { width: 34, fontWeight: '800', fontSize: 13 },
  lbName: { flex: 1, color: '#E2E8F0', fontSize: 13.5 },
  lbGh: { color: '#18D4F2', fontWeight: '700', fontSize: 13 },
  more: { alignSelf: 'center', marginTop: 8, paddingVertical: 4, paddingHorizontal: 10 },
  moreTxt: { color: '#93C5FD', fontSize: 12.5, fontWeight: '700', textDecorationLine: 'underline' },
});

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../auth/AuthProvider';
import { get_data_uri } from '../../config/api';

/**
 * Game Zone header: the daily game streak and this week's leaderboard.
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

const PRIZE: Record<number, number> = { 3: 10, 5: 20, 7: 30 };
const DAYS = [1, 2, 3, 4, 5, 6, 7];
const MEDAL = ['#FFD24C', '#C7CEDA', '#D68A4C'];
const GOLD = '#FBBF24';
const CYAN = '#18D4F2';

function StreakTrack({ cycleDay }: { cycleDay: number }) {
  const fill = cycleDay <= 1 ? 0 : ((cycleDay - 1) / 6) * 100;
  return (
    <View style={s.track}>
      <View style={s.rail} />
      <LinearGradient
        colors={['#F59E0B', GOLD]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[s.railFill, { width: `${fill * 0.86}%` }]}
      />
      <View style={s.nodes}>
        {DAYS.map(day => {
          const done = day <= cycleDay;
          const prize = PRIZE[day];
          return (
            <View key={day} style={s.nodeCol}>
              <View style={[s.node, prize ? s.nodePrize : null, done && s.nodeDone]}>
                {prize ? (
                  <MaterialCommunityIcons name={done ? 'check-bold' : 'gift'} size={14} color={done ? '#1A1206' : GOLD} />
                ) : done ? (
                  <MaterialCommunityIcons name="check-bold" size={11} color="#1A1206" />
                ) : (
                  <Text style={s.nodeTxt}>{day}</Text>
                )}
              </View>
              <Text style={[s.nodeLabel, prize ? s.nodeLabelPrize : null]} numberOfLines={1}>
                {prize ? `+${prize}` : ' '}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function GameEngagementCard() {
  const { user } = useAuth();
  const [data, setData] = useState<Data | null>(null);
  const [expanded, setExpanded] = useState(false);

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
  const rows = leaderboard.rows.slice(0, expanded ? 20 : 3);
  const active = streak.streakDays > 0;
  const hint = streak.playedToday
    ? `${streak.daysToNextBonus} ${streak.daysToNextBonus === 1 ? 'day' : 'days'} to +${streak.nextBonusGh} GH/s`
    : active ? 'Win a game today to keep it' : 'Win a game to start';

  return (
    <View style={s.wrap}>
      {/* Streak */}
      <LinearGradient colors={['#2A1B0A', '#141019']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.streakCard}>
        <View style={s.streakHead}>
          <LinearGradient colors={active ? ['#F59E0B', '#EF4444'] : ['#3A3F4B', '#2A2E38']} style={s.flame}>
            <MaterialCommunityIcons name="fire" size={24} color="#FFF" />
          </LinearGradient>
          <View style={s.streakText}>
            <Text style={s.streakTitle} numberOfLines={1}>
              {active ? `${streak.streakDays}-day streak` : 'Daily streak'}
            </Text>
            <Text style={s.streakHint} numberOfLines={1}>{hint}</Text>
          </View>
          <View style={[s.pill, streak.playedToday ? s.pillDone : s.pillTodo]}>
            <Text style={[s.pillTxt, streak.playedToday ? s.pillTxtDone : s.pillTxtTodo]}>
              {streak.playedToday ? 'Done today' : 'Play today'}
            </Text>
          </View>
        </View>
        <StreakTrack cycleDay={streak.cycleDay} />
      </LinearGradient>

      {/* Leaderboard */}
      <View style={s.boardCard}>
        <View style={s.boardHead}>
          <MaterialCommunityIcons name="trophy" size={16} color={GOLD} />
          <Text style={s.boardTitle}>Top Players</Text>
          <Text style={s.boardReset}>Resets Monday</Text>
        </View>
        {rows.length === 0 ? (
          <Text style={s.empty}>No winners yet this week. Be the first!</Text>
        ) : rows.map(r => (
          <View key={r.rank} style={[s.row, r.isMe && s.rowMe]}>
            <View style={[s.rank, { backgroundColor: (MEDAL[r.rank - 1] ?? '#64748B') + '26' }]}>
              <Text style={[s.rankTxt, { color: MEDAL[r.rank - 1] ?? '#94A3B8' }]}>{r.rank}</Text>
            </View>
            <Text style={s.name} numberOfLines={1}>{r.isMe ? `${r.name} (you)` : r.name}</Text>
            <Text style={s.gh}>{r.gh} GH/s</Text>
          </View>
        ))}
        <View style={s.boardFoot}>
          <Text style={s.footTxt} numberOfLines={1}>
            {me.rank ? `You: #${me.rank} · ${me.gh} GH/s` : 'Win a game to join the board'}
          </Text>
          {leaderboard.rows.length > 3 && (
            <TouchableOpacity onPress={() => setExpanded(v => !v)} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={s.more}>{expanded ? 'Show less' : 'See top 20'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const NODE = 26;
const s = StyleSheet.create({
  wrap: { marginHorizontal: 24, marginTop: 8, marginBottom: 12, gap: 10 },

  streakCard: { borderRadius: 18, padding: 14, borderWidth: 1, borderColor: 'rgba(245,158,11,0.22)' },
  streakHead: { flexDirection: 'row', alignItems: 'center' },
  flame: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  streakText: { flex: 1, marginLeft: 10, marginRight: 8 },
  streakTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '800' },
  streakHint: { color: '#CBB994', fontSize: 12, marginTop: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  pillDone: { backgroundColor: 'rgba(74,222,128,0.12)', borderColor: 'rgba(74,222,128,0.35)' },
  pillTodo: { backgroundColor: 'rgba(251,191,36,0.1)', borderColor: 'rgba(251,191,36,0.35)' },
  pillTxt: { fontSize: 11, fontWeight: '700' },
  pillTxtDone: { color: '#86EFAC' },
  pillTxtTodo: { color: GOLD },

  track: { marginTop: 14 },
  rail: {
    position: 'absolute', top: NODE / 2 - 1.5, left: '7%', right: '7%', height: 3,
    borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)',
  },
  railFill: { position: 'absolute', top: NODE / 2 - 1.5, left: '7%', height: 3, borderRadius: 2 },
  nodes: { flexDirection: 'row', justifyContent: 'space-between' },
  nodeCol: { width: '14.28%', alignItems: 'center' },
  node: {
    width: NODE, height: NODE, borderRadius: NODE / 2, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1E1A22', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  nodePrize: { borderColor: 'rgba(251,191,36,0.7)', backgroundColor: '#2A2011' },
  nodeDone: { backgroundColor: GOLD, borderColor: GOLD },
  nodeTxt: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },
  nodeLabel: { marginTop: 4, fontSize: 10.5, color: 'transparent' },
  nodeLabelPrize: { color: GOLD, fontWeight: '800' },

  boardCard: {
    borderRadius: 18, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10,
    backgroundColor: '#0B111D', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  boardHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  boardTitle: { flex: 1, color: '#F8FAFC', fontSize: 14, fontWeight: '800' },
  boardReset: { color: '#7E8CA3', fontSize: 11 },
  empty: { color: '#94A3B8', fontSize: 12.5, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4, borderRadius: 10 },
  rowMe: { backgroundColor: 'rgba(24,212,242,0.1)' },
  rank: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  rankTxt: { fontSize: 12, fontWeight: '800' },
  name: { flex: 1, color: '#E2E8F0', fontSize: 13.5, fontWeight: '600', marginRight: 8 },
  gh: { color: CYAN, fontSize: 13, fontWeight: '700' },
  boardFoot: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  footTxt: { flex: 1, color: '#94A3B8', fontSize: 12, marginRight: 8 },
  more: { color: CYAN, fontSize: 12, fontWeight: '700' },
});

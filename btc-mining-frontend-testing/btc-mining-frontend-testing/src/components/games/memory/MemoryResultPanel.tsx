import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { CoinBurst } from './CoinBurst';
import { MM } from './theme';

type Props = {
  won: boolean;
  claimed: boolean;
  claiming: boolean;
  matches: number;
  totalPairs: number;
  timeUsed: number;
  bestCombo: number;
  rewardGh: number;
  compact: boolean;
  /** Shown only when won && !claimed. */
  claimLabel: string;
  claimedLabel: string;
  onClaim: () => void;
  replayLabel: string;
  /** Free (no video) replay -> filled cyan button; otherwise ad-gated outline. */
  replayFree: boolean;
  onReplay: () => void;
};

/**
 * End-of-round panel that covers the board. Purely presentational: every
 * press handler and label comes from MemoryCardMatchScreen, which owns the
 * reward / replay rules.
 */
export function MemoryResultPanel(p: Props) {
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(enter, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 9 }).start();
  }, []);
  const scale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });

  const left = p.totalPairs - p.matches;
  const title = p.won ? 'Perfect Memory!' : "Time's Up!";
  const sub = p.won
    ? (p.claimed ? 'Reward added to your mining power.' : `All ${p.totalPairs} pairs matched! Claim your +${p.rewardGh} GH/s boost.`)
    : p.matches >= p.totalPairs - 2
      ? `So close! Only ${left} pair${left === 1 ? '' : 's'} left — you've got this.`
      : p.matches > 0
        ? `You found ${p.matches} of ${p.totalPairs} pairs. Warm up and go again!`
        : `Match all ${p.totalPairs} pairs before time runs out.`;

  const iconSize = p.compact ? 46 : 58;

  return (
    <Animated.View style={[s.scrim, { opacity: enter }]}>
      <LinearGradient
        colors={p.won ? ['rgba(34,197,94,0.20)', 'rgba(5,9,20,0.0)'] : ['rgba(248,113,113,0.16)', 'rgba(5,9,20,0.0)']}
        style={StyleSheet.absoluteFill}
      />
      {p.won && <CoinBurst trigger={p.claimed} />}

      <Animated.View style={[s.body, { transform: [{ scale }] }]}>
        <View
          style={[
            s.icon,
            { width: iconSize, height: iconSize, borderRadius: iconSize / 2 },
            p.won ? s.iconWon : s.iconLost,
          ]}
        >
          <MaterialCommunityIcons
            name={p.won ? 'trophy' : 'timer-sand-complete'}
            size={Math.round(iconSize * 0.52)}
            color={p.won ? MM.gold : MM.red}
          />
        </View>

        <Text style={[s.title, p.compact && s.titleCompact]}>{title}</Text>
        <Text style={s.sub}>{sub}</Text>

        {!p.compact && (
          <View style={s.stats}>
            {p.won ? (
              <>
                <Stat icon="timer-outline" text={`${p.timeUsed}s`} color={MM.cyan} />
                <Stat icon="fire" text={`Best x${Math.max(1, p.bestCombo)}`} color="#FB923C" />
              </>
            ) : (
              <>
                <Stat icon="cards-outline" text={`${p.matches}/${p.totalPairs} pairs`} color={MM.lavender} />
                {p.bestCombo >= 2 && <Stat icon="fire" text={`Best x${p.bestCombo}`} color="#FB923C" />}
              </>
            )}
          </View>
        )}

        {p.won && !p.claimed && (
          <TouchableOpacity style={s.btnWrap} activeOpacity={0.85} onPress={p.onClaim} disabled={p.claiming}>
            <LinearGradient colors={['#FDE047', '#FBBF24', '#d97706']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.claimGrad}>
              {p.claiming ? <ActivityIndicator color="#000" /> : <Text style={s.claimTxt} numberOfLines={1} adjustsFontSizeToFit>{p.claimLabel}</Text>}
            </LinearGradient>
          </TouchableOpacity>
        )}

        {p.claimed && (
          <View style={s.claimedBadge}>
            <MaterialCommunityIcons name="check-decagram" size={18} color={MM.green} />
            <Text style={s.claimedTxt}>{p.claimedLabel}</Text>
          </View>
        )}

        <TouchableOpacity style={s.btnWrap} activeOpacity={0.85} onPress={p.onReplay}>
          {p.replayFree ? (
            <LinearGradient colors={['#18D4F2', '#0891b2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.replayGrad}>
              <Text style={[s.replayTxt, { color: '#04121a' }]} numberOfLines={1} adjustsFontSizeToFit>{p.replayLabel}</Text>
            </LinearGradient>
          ) : (
            <View style={s.replayOutline}>
              <Text style={s.replayTxt} numberOfLines={1} adjustsFontSizeToFit>{p.replayLabel}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

function Stat({ icon, text, color }: { icon: string; text: string; color: string }) {
  return (
    <View style={s.stat}>
      <MaterialCommunityIcons name={icon} size={13} color={color} />
      <Text style={s.statTxt}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(5,9,20,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
    elevation: 30,
  },
  body: { width: '100%', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  icon: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, marginBottom: 8 },
  iconWon: { backgroundColor: 'rgba(251,191,36,0.14)', borderColor: 'rgba(251,191,36,0.6)', boxShadow: '0 0 22px 2px rgba(251,191,36,0.45)' },
  iconLost: { backgroundColor: 'rgba(248,113,113,0.12)', borderColor: 'rgba(248,113,113,0.5)', boxShadow: '0 0 18px 0 rgba(248,113,113,0.35)' },
  title: { color: MM.text, fontSize: 24, fontWeight: '900', letterSpacing: 0.3 },
  titleCompact: { fontSize: 21 },
  sub: { color: MM.muted, fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 12, lineHeight: 18, maxWidth: 300 },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statTxt: { color: MM.text, fontSize: 12, fontWeight: '800' },
  btnWrap: { width: '100%', maxWidth: 340, borderRadius: 14, overflow: 'hidden', marginBottom: 8 },
  claimGrad: { paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  claimTxt: { color: '#000', fontSize: 15, fontWeight: '900' },
  claimedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(74,222,128,0.15)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.5)',
  },
  claimedTxt: { color: MM.green, fontSize: 15, fontWeight: '800' },
  replayGrad: { paddingVertical: 13, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  replayOutline: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(124,58,237,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(165,180,252,0.45)',
  },
  replayTxt: { color: MM.lavender, fontSize: 14, fontWeight: '800' },
});

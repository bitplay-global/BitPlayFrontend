import React, { MutableRefObject } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

export interface GameAdsHook {
  showEarnAd: () => void;
  earnAdLoaded: boolean;
  earnAdLoading: boolean;
  earnAdPending?: MutableRefObject<boolean>;
  showRetryAd: () => void;
  retryAdLoaded: boolean;
  retryAdLoading: boolean;
  retryAdPending?: MutableRefObject<boolean>;
  ghEarned: number;
  rewardGh: number;
}

interface Props {
  // Shorthand: pass the useGameAds() return value + onFreePlay separately
  gameAds?: GameAdsHook;
  onFreePlay?: () => void;
  // Legacy individual props (backward compat)
  onEarnAd?: () => void;
  earnAdLoaded?: boolean;
  earnAdLoading?: boolean;
  earnAdPending?: MutableRefObject<boolean>;
  onRetryAd?: () => void;
  retryAdLoaded?: boolean;
  retryAdLoading?: boolean;
  retryAdPending?: MutableRefObject<boolean>;
  ghEarned?: number;
  rewardGh?: number;
}

const GameAdButtons = React.memo(function GameAdButtons(props: Props) {
  const {
    gameAds, onFreePlay,
    onEarnAd, onRetryAd,
  } = props;

  const earnCb        = onEarnAd        ?? gameAds?.showEarnAd   ?? (() => {});
  const earnLoaded    = props.earnAdLoaded    ?? gameAds?.earnAdLoaded   ?? false;
  const earnLoading   = props.earnAdLoading   ?? gameAds?.earnAdLoading  ?? false;
  const earnPending   = props.earnAdPending   ?? gameAds?.earnAdPending;
  const retryCb       = onRetryAd       ?? gameAds?.showRetryAd  ?? (() => {});
  const retryLoaded   = props.retryAdLoaded   ?? gameAds?.retryAdLoaded  ?? false;
  const retryLoading  = props.retryAdLoading  ?? gameAds?.retryAdLoading ?? false;
  const retryPending  = props.retryAdPending  ?? gameAds?.retryAdPending;
  const freeCb        = onFreePlay ?? (() => {});
  const earned        = props.ghEarned  ?? gameAds?.ghEarned  ?? 0;
  const reward        = props.rewardGh  ?? gameAds?.rewardGh  ?? 5;

  return (
    <View style={s.wrap}>
      {earned > 0 && (
        <View style={s.earnedBadge}>
          <MaterialCommunityIcons name="lightning-bolt" size={14} color="#4ade80" />
          <Text style={s.earnedTxt}>+{earned} GH/s earned this session!</Text>
        </View>
      )}

      <TouchableOpacity onPress={earnCb} activeOpacity={0.82} style={s.btnTouch}>
        <LinearGradient
          colors={earnLoaded ? ['#06b6d4', '#0891b2'] : ['#1e293b', '#334155']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[s.btn, !earnLoaded && s.btnDim]}
        >
          {earnLoading && !earnLoaded ? (
            <>
              <ActivityIndicator color="#94a3b8" size="small" />
              <View style={s.btnTextWrap}>
                <Text style={[s.btnLabel, { color: '#64748b' }]}>
                  {earnPending?.current ? 'Ad queued — launching soon…' : 'Preparing ad…'}
                </Text>
                <Text style={[s.btnSub, { color: '#475569' }]}>Tap again once ready to earn {reward} GH/s</Text>
              </View>
            </>
          ) : (
            <>
              <View style={s.playIcon}>
                <MaterialCommunityIcons name="play-circle" size={20} color={earnLoaded ? '#0f172a' : '#64748b'} />
              </View>
              <View style={s.btnTextWrap}>
                <Text style={[s.btnLabel, { color: earnLoaded ? '#0f172a' : '#64748b' }]}>Watch Ad → Earn</Text>
                <Text style={[s.btnSub, { color: earnLoaded ? '#0c4a6e' : '#475569' }]}>{reward} GH/s added to mining</Text>
              </View>
              <View style={[s.ghBadge, { backgroundColor: earnLoaded ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.05)' }]}>
                <Text style={[s.ghBadgeTxt, { color: earnLoaded ? '#0f172a' : '#475569' }]}>+{reward}</Text>
              </View>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity onPress={retryCb} activeOpacity={0.82} style={s.btnTouch}>
        <LinearGradient
          colors={retryLoaded ? ['#7c3aed', '#6d28d9'] : ['#1e293b', '#334155']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[s.btn, !retryLoaded && s.btnDim]}
        >
          {retryLoading && !retryLoaded ? (
            <>
              <ActivityIndicator color="#94a3b8" size="small" />
              <View style={s.btnTextWrap}>
                <Text style={[s.btnLabel, { color: '#64748b' }]}>
                  {retryPending?.current ? 'Ad queued — launching soon…' : 'Preparing ad…'}
                </Text>
                <Text style={[s.btnSub, { color: '#475569' }]}>Tap again once ready to replay</Text>
              </View>
            </>
          ) : (
            <>
              <View style={s.playIcon}>
                <MaterialCommunityIcons name="refresh-circle" size={20} color={retryLoaded ? '#e9d5ff' : '#64748b'} />
              </View>
              <View style={s.btnTextWrap}>
                <Text style={[s.btnLabel, { color: retryLoaded ? '#f8fafc' : '#64748b' }]}>Watch Ad → Play Again</Text>
                <Text style={[s.btnSub, { color: retryLoaded ? '#c4b5fd' : '#475569' }]}>Free retry with short video</Text>
              </View>
              <MaterialCommunityIcons name="play" size={16} color={retryLoaded ? '#c4b5fd' : '#475569'} />
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <View style={s.dividerRow}>
        <View style={s.divider} />
        <Text style={s.dividerTxt}>or</Text>
        <View style={s.divider} />
      </View>

      <TouchableOpacity style={s.freeBtn} onPress={freeCb} activeOpacity={0.7}>
        <MaterialCommunityIcons name="skip-next" size={14} color="#64748b" />
        <Text style={s.freeTxt}>Play Again (Free, no reward)</Text>
      </TouchableOpacity>
    </View>
  );
});

const s = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  earnedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(74,222,128,0.12)', borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.25)', paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 20,
  },
  earnedTxt: { color: '#4ade80', fontWeight: '700', fontSize: 13 },
  btnTouch: { width: '100%' },
  btn: {
    width: '100%', flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16,
    gap: 10, minHeight: 56,
  },
  btnDim: { opacity: 0.7 },
  playIcon: { width: 24, alignItems: 'center' },
  btnTextWrap: { flex: 1 },
  btnLabel: { fontWeight: '800', fontSize: 15, letterSpacing: 0.1 },
  btnSub: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  ghBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  ghBadgeTxt: { fontWeight: '900', fontSize: 13 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', marginVertical: 2 },
  divider: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  dividerTxt: { color: '#475569', fontSize: 12, fontWeight: '600' },
  freeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  freeTxt: { color: '#64748b', fontSize: 12, fontWeight: '500' },
});

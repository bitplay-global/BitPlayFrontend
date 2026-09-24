import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

/**
 * Shared win / lose / locked panels for the mini-games.
 *
 * Every game renders the same three states, so they live here rather than
 * being re-implemented per screen. Notably the CTA uses the gradient-with-
 * inner-View split: the LinearGradient carries only width, and a plain inner
 * View carries padding/minHeight. Putting padding directly on the gradient
 * makes it render shorter than its label on iOS and the label gets clipped.
 */

export function MiningLockCard({ gameName, onPress }: { gameName: string; onPress: () => void }) {
  return (
    <View style={s.lockCard}>
      <Icon name="pickaxe" size={32} color="#FBBF24" />
      <Text style={s.lockTitle}>Mining Not Active</Text>
      <Text style={s.lockBody}>Start mining on the home screen to unlock {gameName}.</Text>
      <TouchableOpacity style={s.lockBtn} onPress={onPress}>
        <Text style={s.lockBtnText}>Start Mining</Text>
      </TouchableOpacity>
    </View>
  );
}

export function ClaimedBanner({ text }: { text: string }) {
  return (
    <View style={s.banner}>
      <Icon name="check-circle" size={18} color="#4ADE80" />
      <Text style={s.bannerText}>{text}</Text>
    </View>
  );
}

export function WinPanel({
  title, body, gh, crediting, adLoading, adLoaded, onClaim,
}: {
  title: string; body?: string; gh: number;
  crediting: boolean; adLoading: boolean; adLoaded: boolean; onClaim: () => void;
}) {
  return (
    <View style={[s.card, s.cardWin]}>
      <LinearGradient colors={['#2D1B4E', '#1A0F2E']} style={s.cardGrad}>
        <View style={s.cardInner}>
          <Icon name="cash-multiple" size={34} color="#FBBF24" />
          <Text style={s.title}>{title}</Text>
          <Text style={s.body}>{body ?? `Watch the video to add +${gh} GH/s to your mining power.`}</Text>
          <TouchableOpacity style={s.btn} onPress={onClaim} disabled={crediting} activeOpacity={0.88}>
            <LinearGradient colors={['#FBBF24', '#D97706']} style={s.btnGrad}>
              <View style={s.btnInner}>
                {crediting || (adLoading && !adLoaded) ? (
                  <ActivityIndicator color="#1C1917" />
                ) : (
                  <>
                    <Icon name="play-circle" size={20} color="#1C1917" />
                    <Text style={s.btnTxtDark} numberOfLines={1}>Watch Ad &amp; Redeem</Text>
                  </>
                )}
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

export function LosePanel({
  title, body, adLoading, adLoaded, onRetry,
}: {
  title: string; body?: string; adLoading: boolean; adLoaded: boolean; onRetry: () => void;
}) {
  return (
    <View style={[s.card, s.cardLose]}>
      <LinearGradient colors={['#2D1020', '#1A0A18']} style={s.cardGrad}>
        <View style={s.cardInner}>
          <Icon name="emoticon-sad-outline" size={34} color="#F87171" />
          <Text style={s.title}>{title}</Text>
          <Text style={s.body}>{body ?? 'Watch a short video to try again.'}</Text>
          <TouchableOpacity style={s.btn} onPress={onRetry} disabled={adLoading && !adLoaded} activeOpacity={0.88}>
            <LinearGradient colors={['#EF4444', '#B91C1C']} style={s.btnGrad}>
              <View style={s.btnInner}>
                {adLoading && !adLoaded ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Icon name="play-circle" size={20} color="#FFF" />
                    <Text style={s.btnTxtLight} numberOfLines={1}>Watch Ad &amp; Try Again</Text>
                  </>
                )}
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: 14, padding: 10, borderRadius: 12,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.35)', width: '100%',
  },
  bannerText: { flex: 1, color: '#DCFCE7', fontSize: 13 },

  card: { width: '100%', borderRadius: 18, overflow: 'hidden', borderWidth: 1, marginTop: 4 },
  cardWin: { borderColor: 'rgba(251,191,36,0.25)' },
  cardLose: { borderColor: 'rgba(248,113,113,0.25)' },
  cardGrad: { width: '100%' },
  cardInner: { paddingHorizontal: 20, paddingVertical: 20, alignItems: 'center', width: '100%' },
  title: { fontSize: 19, fontWeight: '900', color: '#FFF', textAlign: 'center', marginTop: 8 },
  body: { marginTop: 6, fontSize: 13.5, color: '#C4B5FD', textAlign: 'center', marginBottom: 16 },

  btn: { alignSelf: 'stretch', width: '100%', borderRadius: 14, overflow: 'hidden' },
  btnGrad: { width: '100%' },
  btnInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    minHeight: 50, paddingVertical: 14, paddingHorizontal: 16,
  },
  btnTxtDark: { fontSize: 15.5, fontWeight: '900', color: '#1C1917', marginLeft: 10 },
  btnTxtLight: { fontSize: 15.5, fontWeight: '800', color: '#fff', marginLeft: 10 },

  lockCard: {
    backgroundColor: 'rgba(30,14,54,0.97)', borderRadius: 20,
    borderWidth: 1.5, borderColor: 'rgba(251,191,36,0.45)',
    padding: 28, alignItems: 'center', gap: 12, width: '100%',
  },
  lockTitle: { fontSize: 18, fontWeight: '900', color: '#FFF', textAlign: 'center' },
  lockBody: { fontSize: 14, color: '#C4B5FD', textAlign: 'center', lineHeight: 20 },
  lockBtn: {
    marginTop: 4, backgroundColor: '#FBBF24', borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center',
  },
  lockBtnText: { color: '#1C1917', fontSize: 14, fontWeight: '900' },
});

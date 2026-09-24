import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  trackFirstOpen,
  trackSignupCompleted,
  trackLogin,
  trackPurchase,
  trackCheckoutStarted,
  trackMiningStarted,
  trackAdFailedToLoad,
  trackNotificationClicked,
  trackWithdrawalRequested,
} from '../services/apptroveAnalytics';

const TEST_USER_ID = 'debug-test-user-001';
const TEST_SESSION_ID = `debug-${Date.now()}`;

type EventResult = { name: string; status: 'ok' | 'fail'; ts: number };

const EVENTS: { label: string; id: string; fn: () => void }[] = [
  // Only the events kept for reporting. "Install" is fired by
  // ApptroveSDK.fireInstall() at startup, not as a tracked event, so it has no
  // row here.
  { label: 'first_open', id: 'first_open', fn: () => trackFirstOpen(Platform.OS) },
  { label: 'Sign-Up', id: 'signup', fn: () => trackSignupCompleted(TEST_USER_ID, 'email') },
  { label: 'Login', id: 'login', fn: () => trackLogin(TEST_USER_ID, 'email') },
  { label: 'Checkout Started', id: 'checkout_started', fn: () => trackCheckoutStarted('Debug Plan', 9.99, 'USD') },
  { label: 'Purchase', id: 'purchase', fn: () => trackPurchase('Debug Plan', 'debug.product.id', 9.99, 'USD') },
  { label: 'mining_started', id: 'mining_started', fn: () => trackMiningStarted(100, TEST_USER_ID) },
  { label: 'withdrawal_requested', id: 'withdrawal_requested', fn: () => trackWithdrawalRequested(0.0005, 'BTC', 'Lightning') },
  { label: 'ad_failed_to_load', id: 'ad_failed_to_load', fn: () => trackAdFailedToLoad('debug-ad-unit', 'debug: no fill') },
  { label: 'notification_clicked', id: 'notification_clicked', fn: () => trackNotificationClicked('debug-notif-1', 'Debug title') },
];

export default function ApptroveDebugScreen() {
  const navigation = useNavigation();
  const [results, setResults] = useState<EventResult[]>([]);
  const [firing, setFiring] = useState(false);

  const fire = (ev: typeof EVENTS[0]) => {
    try {
      ev.fn();
      setResults(r => [{ name: ev.label, status: 'ok', ts: Date.now() }, ...r]);
    } catch {
      setResults(r => [{ name: ev.label, status: 'fail', ts: Date.now() }, ...r]);
    }
  };

  const fireAll = async () => {
    setFiring(true);
    setResults([]);
    for (const ev of EVENTS) {
      fire(ev);
      await new Promise(r => setTimeout(r, 120)); // 120ms gap between events
    }
    setFiring(false);
    Alert.alert('Done', `${EVENTS.length} events fired. Check your Apptrove dashboard real-time stream.`);
  };

  return (
    <View style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Text style={s.backTxt}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>🔧 Apptrove Debug</Text>
        <Text style={s.sub}>{EVENTS.length} events • TEST DATA ONLY</Text>
      </View>

      <TouchableOpacity
        style={[s.fireAllBtn, firing && s.fireAllBtnDisabled]}
        onPress={fireAll}
        disabled={firing}
      >
        <Text style={s.fireAllTxt}>{firing ? 'Firing...' : `🚀 Fire ALL ${EVENTS.length} Events`}</Text>
      </TouchableOpacity>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {/* Results */}
        {results.length > 0 && (
          <View style={s.resultsBox}>
            <Text style={s.resultsHeader}>Recent fires</Text>
            {results.slice(0, 8).map((r, i) => (
              <View key={i} style={s.resultRow}>
                <Text style={r.status === 'ok' ? s.ok : s.fail}>
                  {r.status === 'ok' ? '✅' : '❌'} {r.name}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Individual events */}
        {EVENTS.map(ev => (
          <TouchableOpacity key={ev.id} style={s.eventBtn} onPress={() => fire(ev)}>
            <Text style={s.eventTxt}>{ev.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0f1e' },
  header: { paddingTop: Platform.OS === 'ios' ? 54 : 40, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  back: { marginBottom: 8 },
  backTxt: { color: '#22D3EE', fontSize: 14 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  sub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  fireAllBtn: { margin: 16, backgroundColor: '#22D3EE', borderRadius: 12, padding: 14, alignItems: 'center' },
  fireAllBtnDisabled: { opacity: 0.5 },
  fireAllTxt: { color: '#0a0f1e', fontWeight: '800', fontSize: 15 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 8 },
  resultsBox: { backgroundColor: '#1e293b', borderRadius: 10, padding: 12, marginBottom: 16 },
  resultsHeader: { color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  resultRow: { paddingVertical: 2 },
  ok: { color: '#4ade80', fontSize: 12 },
  fail: { color: '#f87171', fontSize: 12 },
  eventBtn: { backgroundColor: '#1e293b', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#334155' },
  eventTxt: { color: '#e2e8f0', fontSize: 13 },
});

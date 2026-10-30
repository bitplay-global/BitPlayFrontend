import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/**
 * Official rules and sponsor disclaimer for the chance games (App Store
 * guideline 5.3.1-5.3.2: the developer is the sponsor, rules are in the app,
 * Apple is not involved). Keep the prize figures in step with each game.
 */
export default function GameRulesNote({ game, prizes }: { game: string; prizes: string }) {
  const showRules = () =>
    Alert.alert(
      `${game} — Official Rules`,
      [
        'Sponsor: BitPlayPro (AdaptsMedia LLC). No purchase is necessary to play.',
        `Prizes: ${prizes}. Prizes are mining power (GH/s) in BitPlayPro only; they are not cash, cannot be transferred or exchanged, and count toward your mining for the current day.`,
        'Eligibility: users aged 18 or older with an active BitPlayPro account and mining started for the day.',
        'Each play shows a rewarded video. Daily limits apply to game rewards.',
        'BitPlayPro may change or end this game at any time. Abuse, automation or multiple accounts void rewards.',
        'Apple Inc. and Google LLC are not sponsors of, and are not involved in any way with, this game.',
      ].join('\n\n'),
    );

  return (
    <View style={styles.wrap}>
      <TouchableOpacity onPress={showRules} accessibilityRole="button">
        <Text style={styles.link}>Official Rules</Text>
      </TouchableOpacity>
      <Text style={styles.note}>
        Prizes are in-app mining power, not cash. Apple and Google are not sponsors of this game.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginTop: 12, marginBottom: 8, paddingHorizontal: 16 },
  link: { color: '#93C5FD', fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  note: { color: '#94A3B8', fontSize: 11, lineHeight: 15, textAlign: 'center', marginTop: 4 },
});

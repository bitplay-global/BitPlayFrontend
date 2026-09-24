import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { NewsItem, relativeTime } from '../../services/newsFeed';

/**
 * A headline that opens in place.
 *
 * There is deliberately no link out: the whole story stays on this screen. What
 * is shown is the feed's own summary, with the publisher named -- that is what
 * RSS is for, and the full article remains theirs.
 */
export const NewsCard = React.memo(function NewsCard({
  item,
  expanded,
  onToggle,
}: {
  item: NewsItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const time = relativeTime(item.publishedAt);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onToggle}
      style={[s.card, expanded && s.cardOpen]}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
    >
      <View style={s.metaRow}>
        <View style={s.sourceChip}>
          <Text style={s.sourceText}>{item.source}</Text>
        </View>
        {time ? <Text style={s.time}>{time}</Text> : null}
        <Icon
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#64748B"
          style={s.chevron}
        />
      </View>

      <Text style={s.title} numberOfLines={expanded ? undefined : 3}>
        {item.title}
      </Text>

      {expanded && item.summary ? <Text style={s.summary}>{item.summary}</Text> : null}
      {expanded && !item.summary ? (
        <Text style={s.noSummary}>No summary was published with this story.</Text>
      ) : null}
    </TouchableOpacity>
  );
});

const s = StyleSheet.create({
  card: {
    backgroundColor: '#0B111D',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 10,
  },
  cardOpen: { borderColor: 'rgba(34,211,238,0.35)', backgroundColor: '#0C1524' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  sourceChip: {
    backgroundColor: 'rgba(34,211,238,0.12)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sourceText: { color: '#18D4F2', fontSize: 11, fontWeight: '800' },
  time: { color: '#64748B', fontSize: 11.5, marginLeft: 10, flex: 1 },
  chevron: { marginLeft: 8 },
  title: { color: '#F1F5F9', fontSize: 15, fontWeight: '700', lineHeight: 21 },
  summary: {
    color: '#94A3B8',
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 10,
  },
  noSummary: { color: '#475569', fontSize: 13, fontStyle: 'italic', marginTop: 10 },
});

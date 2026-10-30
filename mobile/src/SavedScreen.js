import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useTheme, prettyDate } from './theme';
import { loadSaved, removeItem, clearRecent } from './storage';

const when = (v, q) => v === 'flights' ? prettyDate(q.date) : v === 'hotels' ? `${prettyDate(q.checkIn)} – ${prettyDate(q.checkOut)}` : `${prettyDate(q.pickupDate)} – ${prettyDate(q.dropoffDate)}`;
const ICON = { flights: '✈', hotels: '⌂', cars: '◉' };

export default function SavedScreen({ onOpen, focused }) {
  const t = useTheme();
  const [d, setD] = useState({ recent: [], starred: [] });
  const [confirm, setConfirm] = useState(false);
  const refresh = useCallback(() => loadSaved().then(setD), []);
  useEffect(() => { if (focused) refresh(); }, [focused, refresh]);

  const today = new Date().toISOString().slice(0, 10);
  const Row = ({ item, list }) => {
    const past = (item.query.date || item.query.checkIn || item.query.pickupDate) < today;
    return (
      <View style={[st.row, { backgroundColor: t.surface, borderColor: t.line }]}>
        <Pressable style={{ flex: 1, flexDirection: 'row', gap: 12, alignItems: 'center' }} onPress={() => onOpen(item.vertical, item.query, item.label)} accessibilityRole="button" accessibilityLabel={`Search again: ${item.label}`}>
          <View style={[st.icon, { backgroundColor: t.chip }]}><Text style={{ color: t.teal, fontSize: 16 }}>{ICON[item.vertical]}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.ink, fontWeight: '600' }}>{item.label}</Text>
            <Text style={{ color: past ? t.bad : t.muted, fontSize: 12 }}>{when(item.vertical, item.query)}{past ? ' · dates passed' : ''}</Text>
          </View>
        </Pressable>
        <Pressable onPress={() => removeItem(list, item.key).then(setD)} hitSlop={10} accessibilityLabel={`Remove ${item.label}`}>
          <Text style={{ color: t.muted, fontSize: 18 }}>✕</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
      <Text style={[st.h, { color: t.ink }]}>Saved</Text>
      <Text style={[st.section, { color: t.muted }]}>STARRED SEARCHES</Text>
      {d.starred.length ? d.starred.map(i => <Row key={i.key} item={i} list="starred" />) :
        <Text style={{ color: t.muted }}>Tap ☆ on a results page to keep a search here and check prices again later.</Text>}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
        <Text style={[st.section, { color: t.muted }]}>RECENT</Text>
        {d.recent.length > 0 && (
          <Pressable onPress={() => confirm ? clearRecent().then(x => { setD(x); setConfirm(false); }) : setConfirm(true)} hitSlop={8}>
            <Text style={{ color: confirm ? t.bad : t.teal, fontWeight: '700', fontSize: 13 }}>{confirm ? 'Tap again to clear' : 'Clear'}</Text>
          </Pressable>
        )}
      </View>
      {d.recent.length ? d.recent.map(i => <Row key={i.key} item={i} list="recent" />) :
        <Text style={{ color: t.muted }}>Your recent searches will appear here.</Text>}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  h: { fontSize: 28, fontWeight: '800', marginBottom: 6 },
  section: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderWidth: 1, borderRadius: 12 },
  icon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});

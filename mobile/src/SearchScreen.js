import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, plusDays } from './theme';
import { Input, DateField, Chip, Button } from './components';

const TABS = [['flights', 'Flights'], ['hotels', 'Hotels'], ['cars', 'Car hire']];
const ROUTES = ['DEL-BOM', 'BLR-DEL', 'BOM-GOI', 'CCU-BLR', 'DEL-DXB', 'HYD-MAA'];
const HEAD = {
  flights: ['One search.\nEvery fare.', 'We check airlines and travel sites together and show who sells the same ticket for less.'],
  hotels: ['Same room.\nCheaper price.', 'Compare one hotel across booking sites, with free cancellation and breakfast shown up front.'],
  cars: ['Hire the car,\nskip the overpaying.', 'Compare rental companies for the same car and dates.'],
};

export default function SearchScreen({ onSearch, vertical, setVertical }) {
  const t = useTheme();
  const [f, setF] = useState({ origin: 'DEL', destination: 'BOM', date: plusDays(14), returnDate: plusDays(18), roundTrip: false, adults: 1, cabin: 'economy' });
  const [h, setH] = useState({ city: 'Goa', checkIn: plusDays(21), checkOut: plusDays(24), adults: 2, rooms: 1 });
  const [c, setC] = useState({ pickup: 'Bengaluru Airport', pickupDate: plusDays(10), dropoffDate: plusDays(13) });
  const [err, setErr] = useState('');

  const go = (override) => {
    setErr('');
    let q, label;
    if (vertical === 'flights') {
      const ff = override || f;
      if (ff.origin.length !== 3 || ff.destination.length !== 3) return setErr('Enter 3-letter airport codes, like DEL or BOM.');
      if (ff.origin === ff.destination) return setErr('Departure and arrival airports must be different.');
      q = { origin: ff.origin, destination: ff.destination, date: ff.date, returnDate: ff.roundTrip ? ff.returnDate : '', adults: ff.adults, cabin: ff.cabin };
      label = `${ff.origin} → ${ff.destination}${ff.roundTrip ? ' (return)' : ''}`;
    } else if (vertical === 'hotels') {
      if (!h.city.trim()) return setErr('Enter a city or area.');
      if (h.checkOut <= h.checkIn) return setErr('Check-out must be after check-in.');
      q = { city: h.city.trim(), checkIn: h.checkIn, checkOut: h.checkOut, adults: h.adults, rooms: h.rooms };
      label = `Hotels in ${h.city.trim()}`;
    } else {
      if (!c.pickup.trim()) return setErr('Enter a pick-up location.');
      if (c.dropoffDate <= c.pickupDate) return setErr('Drop-off must be after pick-up.');
      q = { pickup: c.pickup.trim(), pickupDate: c.pickupDate, dropoffDate: c.dropoffDate };
      label = `Cars at ${c.pickup.trim()}`;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onSearch(vertical, q, label);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1, backgroundColor: t.bg }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={[st.band, { backgroundColor: t.band }]}>
          <Text style={[st.brand, { color: t.accent }]}>FareNest</Text>
          <Text style={[st.h1, { color: t.bandInk }]}>{HEAD[vertical][0]}</Text>
          <Text style={[st.sub, { color: t.bandInk }]}>{HEAD[vertical][1]}</Text>
          <View style={st.tabs}>
            {TABS.map(([k, l]) => (
              <Pressable key={k} onPress={() => { setVertical(k); setErr(''); }} accessibilityRole="tab" accessibilityState={{ selected: vertical === k }}
                style={[st.tab, { borderColor: 'rgba(255,255,255,0.25)' }, vertical === k && { backgroundColor: t.bandInk, borderColor: t.bandInk }]}>
                <Text style={{ color: vertical === k ? t.band : t.bandInk, fontWeight: '600' }}>{l}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[st.panel, { backgroundColor: t.surface, borderColor: t.line }]}>
          {vertical === 'flights' && (<>
            <View style={st.row}>
              <Chip label="One way" active={!f.roundTrip} onPress={() => setF({ ...f, roundTrip: false })} />
              <Chip label="Return" active={f.roundTrip} onPress={() => setF({ ...f, roundTrip: true })} />
            </View>
            <View style={st.row}>
              <Input label="From" code value={f.origin} onChangeText={v => setF({ ...f, origin: v })} />
              <Pressable onPress={() => setF({ ...f, origin: f.destination, destination: f.origin })} style={[st.swap, { backgroundColor: t.chip }]} accessibilityLabel="Swap airports" hitSlop={8}>
                <Text style={{ color: t.teal, fontSize: 18, fontWeight: '700' }}>⇄</Text>
              </Pressable>
              <Input label="To" code value={f.destination} onChangeText={v => setF({ ...f, destination: v })} />
            </View>
            <View style={st.row}>
              <DateField label="Depart" value={f.date} onChange={v => setF({ ...f, date: v, returnDate: v > f.returnDate ? v : f.returnDate })} style={{ flex: 1 }} />
              <DateField label="Return" value={f.returnDate} minDate={f.date} disabled={!f.roundTrip} onChange={v => setF({ ...f, returnDate: v })} style={{ flex: 1 }} />
            </View>
            <View style={st.row}>
              {[1, 2, 3, 4].map(n => <Chip key={n} label={`${n} adult${n > 1 ? 's' : ''}`} active={f.adults === n} onPress={() => setF({ ...f, adults: n })} />)}
            </View>
            <View style={st.row}>
              {[['economy', 'Economy'], ['premium_economy', 'Premium'], ['business', 'Business']].map(([k, l]) =>
                <Chip key={k} label={l} active={f.cabin === k} onPress={() => setF({ ...f, cabin: k })} />)}
            </View>
          </>)}

          {vertical === 'hotels' && (<>
            <View style={st.row}><Input label="City or area" value={h.city} onChangeText={v => setH({ ...h, city: v })} /></View>
            <View style={st.row}>
              <DateField label="Check-in" value={h.checkIn} onChange={v => setH({ ...h, checkIn: v, checkOut: v >= h.checkOut ? plusFrom(v, 1) : h.checkOut })} style={{ flex: 1 }} />
              <DateField label="Check-out" value={h.checkOut} minDate={plusFrom(h.checkIn, 1)} onChange={v => setH({ ...h, checkOut: v })} style={{ flex: 1 }} />
            </View>
            <View style={st.row}>
              {[[1, 1], [2, 1], [3, 1], [4, 2]].map(([a, r]) =>
                <Chip key={a} label={`${a} guest${a > 1 ? 's' : ''} · ${r} room${r > 1 ? 's' : ''}`} active={h.adults === a} onPress={() => setH({ ...h, adults: a, rooms: r })} />)}
            </View>
          </>)}

          {vertical === 'cars' && (<>
            <View style={st.row}><Input label="Pick-up location" value={c.pickup} onChangeText={v => setC({ ...c, pickup: v })} /></View>
            <View style={st.row}>
              <DateField label="Pick-up" value={c.pickupDate} onChange={v => setC({ ...c, pickupDate: v, dropoffDate: v >= c.dropoffDate ? plusFrom(v, 1) : c.dropoffDate })} style={{ flex: 1 }} />
              <DateField label="Drop-off" value={c.dropoffDate} minDate={plusFrom(c.pickupDate, 1)} onChange={v => setC({ ...c, dropoffDate: v })} style={{ flex: 1 }} />
            </View>
          </>)}

          {!!err && <Text style={{ color: t.bad, fontSize: 13 }}>{err}</Text>}
          <Button kind="accent" title={`Search ${vertical === 'cars' ? 'cars' : vertical}`} onPress={() => go()} />
        </View>

        {vertical === 'flights' && (
          <View style={{ paddingHorizontal: 16, gap: 10 }}>
            <Text style={[st.section, { color: t.muted }]}>POPULAR ROUTES</Text>
            <View style={[st.row, { flexWrap: 'wrap' }]}>
              {ROUTES.map(r => {
                const [o, d] = r.split('-');
                return <Chip key={r} label={`${o} → ${d}`} onPress={() => { const nf = { ...f, origin: o, destination: d }; setF(nf); go(nf); }} />;
              })}
            </View>
          </View>
        )}
        <Text style={[st.disclose, { color: t.muted }]}>FareNest is free to use. We may earn a commission from travel partners when you book through our links. It never changes the price you pay.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function plusFrom(iso, n) { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

const st = StyleSheet.create({
  band: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 56 },
  brand: { fontWeight: '800', fontSize: 15, letterSpacing: 0.5, marginBottom: 14 },
  h1: { fontSize: 32, fontWeight: '800', lineHeight: 36, letterSpacing: -0.5 },
  sub: { opacity: 0.8, marginTop: 8, fontSize: 14, lineHeight: 20 },
  tabs: { flexDirection: 'row', gap: 8, marginTop: 18 },
  tab: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  panel: { marginHorizontal: 16, marginTop: -38, borderRadius: 14, padding: 14, gap: 10, borderWidth: 1, marginBottom: 20,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  swap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  section: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  disclose: { fontSize: 12, lineHeight: 17, paddingHorizontal: 16, marginTop: 24 },
});

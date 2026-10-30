import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, RefreshControl, Platform, ScrollView } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from 'expo-haptics';
import { useTheme, fmt, hm, dur, hue, prettyDate } from './theme';
import { search, dealUrl } from './api';
import { Chip, Button, Pill } from './components';
import { loadSaved, toggleStar, isStarred } from './storage';

const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });

export default function ResultsScreen({ vertical, query, label, onBack }) {
  const t = useTheme();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('best');
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState({});
  const [starred, setStarred] = useState(false);

  const run = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await search(vertical, query)); }
    catch (e) { setError(e.message || 'Search failed. Please try again.'); }
    finally { setLoading(false); }
  }, [vertical, query]);

  useEffect(() => { run(); loadSaved().then(d => setStarred(isStarred(d, vertical, query))); }, [run]);

  const filters = useMemo(() => {
    if (!data) return [];
    if (vertical === 'flights') return [['all', 'All'], ['direct', 'Direct only']];
    if (vertical === 'hotels') return [['all', 'All'], ['fc', 'Free cancellation'], ['4', '4★ and up']];
    return [['all', 'All'], ...[...new Set(data.results.map(r => r.category))].map(c => [c, c])];
  }, [data, vertical]);

  const rows = useMemo(() => {
    if (!data) return [];
    let r = data.results.slice();
    if (filter === 'direct') r = r.filter(x => !x.stops);
    else if (filter === 'fc') r = r.filter(x => x.deals.some(d => d.freeCancellation));
    else if (filter === '4') r = r.filter(x => x.stars >= 4);
    else if (filter !== 'all') r = r.filter(x => x.category === filter);
    const key = { best: x => x.score, cheapest: x => x.price,
      third: x => vertical === 'flights' ? x.durationMin : vertical === 'hotels' ? -(x.rating || 0) : -(x.seats || 0) }[sort];
    return r.sort((a, b) => key(a) - key(b));
  }, [data, sort, filter, vertical]);

  const openDeal = async (deal) => {
    const url = dealUrl(data.base, deal.link);
    Haptics.selectionAsync().catch(() => {});
    if (!url) return setError(data.demo ? 'Booking links are disabled for demo prices. Connect a live FareNest server in Settings.' : 'This partner has no booking link for this deal.');
    await WebBrowser.openBrowserAsync(url, { toolbarColor: t.band, controlsColor: t.accent, presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET }).catch(() => {});
  };

  const star = async () => {
    const d = await toggleStar(vertical, query, label);
    setStarred(isStarred(d, vertical, query));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const third = vertical === 'flights' ? 'Fastest' : vertical === 'hotels' ? 'Top rated' : 'Most seats';
  const sub = vertical === 'flights' ? `${prettyDate(query.date)}${query.returnDate ? ' – ' + prettyDate(query.returnDate) : ''} · ${query.adults} adult${query.adults > 1 ? 's' : ''}`
    : vertical === 'hotels' ? `${prettyDate(query.checkIn)} – ${prettyDate(query.checkOut)} · ${query.adults} guests`
    : `${prettyDate(query.pickupDate)} – ${prettyDate(query.dropoffDate)}`;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[st.head, { backgroundColor: t.band }]}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back to search">
          <Text style={{ color: t.bandInk, fontSize: 26, lineHeight: 28 }}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[st.title, { color: t.bandInk }]} numberOfLines={1}>{label}</Text>
          <Text style={{ color: t.bandInk, opacity: 0.75, fontSize: 12 }}>{sub}</Text>
        </View>
        <Pressable onPress={star} hitSlop={12} accessibilityRole="button" accessibilityLabel={starred ? 'Remove from saved' : 'Save this search'}>
          <Text style={{ color: starred ? t.accent : t.bandInk, fontSize: 22 }}>{starred ? '★' : '☆'}</Text>
        </Pressable>
      </View>

      {loading && !data ? (
        <View style={st.center}><ActivityIndicator color={t.teal} size="large" /><Text style={{ color: t.muted, marginTop: 12 }}>Checking travel sites…</Text></View>
      ) : error && !data ? (
        <View style={st.center}><Text style={{ color: t.ink, textAlign: 'center', marginBottom: 14 }}>{error}</Text><Button title="Try again" onPress={run} /></View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r, i) => (r.flightNumber || r.name || r.model) + i}
          contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={run} tintColor={t.teal} />}
          ListHeaderComponent={
            <View style={{ gap: 10 }}>
              <View style={[st.sortbar, { backgroundColor: t.surface, borderColor: t.line }]}>
                {[['best', 'Best'], ['cheapest', 'Cheapest'], ['third', third]].map(([k, l]) => (
                  <Pressable key={k} onPress={() => setSort(k)} style={[st.sortBtn, sort === k && { borderBottomColor: t.accent, backgroundColor: t.chip }]} accessibilityRole="button" accessibilityState={{ selected: sort === k }}>
                    <Text style={{ color: t.ink, fontWeight: '700', fontSize: 13 }}>{l}</Text>
                  </Pressable>
                ))}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {filters.map(([k, l]) => <Chip key={k} label={l} active={filter === k} onPress={() => setFilter(k)} />)}
              </ScrollView>
              <Text style={{ color: t.muted, fontSize: 12 }}>
                {rows.length} results from {data.providers.filter(p => p.ok).length} sites{data.demo ? ' · sample prices' : ''}
              </Text>
              {!!error && <Text style={{ color: t.bad, fontSize: 13 }}>{error}</Text>}
            </View>
          }
          ListEmptyComponent={<Text style={{ color: t.muted, textAlign: 'center', marginTop: 40 }}>No results match this filter.</Text>}
          renderItem={({ item: r }) => {
            const k = r.flightNumber + r.departAt || r.name || r.model;
            const isOpen = open[k];
            return (
              <View style={[st.card, { backgroundColor: t.surface, borderColor: t.line }]}>
                <View style={{ padding: 14, gap: 10 }}>
                  {vertical === 'flights' ? <FlightRow r={r} t={t} /> : vertical === 'hotels' ? <HotelRow r={r} t={t} /> : <CarRow r={r} t={t} />}
                  <View style={[st.buyRow, { borderTopColor: t.line }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: t.muted, fontSize: 12 }}>{r.deals.length > 1 ? `${r.deals.length} deals from` : r.deals[0].provider}</Text>
                      <Text style={[st.price, { color: t.ink }]}>{fmt(r.price, r.currency)}</Text>
                      {r.maxPrice > r.price && <Text style={{ color: t.good, fontSize: 12, fontWeight: '600' }}>Save up to {fmt(r.maxPrice - r.price, r.currency)}</Text>}
                    </View>
                    <View style={{ gap: 6, alignItems: 'flex-end' }}>
                      <Button title="Select" onPress={() => openDeal(r.deals[0])} style={{ paddingVertical: 9, paddingHorizontal: 20 }} />
                      {r.deals.length > 1 && (
                        <Pressable onPress={() => setOpen({ ...open, [k]: !isOpen })} hitSlop={8}>
                          <Text style={{ color: t.teal, fontWeight: '700', fontSize: 13 }}>{isOpen ? 'Hide' : 'Compare'} {r.deals.length} sites</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>
                {isOpen && (
                  <View style={{ backgroundColor: t.bg, borderTopWidth: 1, borderTopColor: t.line }}>
                    {r.deals.map((d, i) => (
                      <Pressable key={d.provider} onPress={() => openDeal(d)} style={[st.deal, { borderBottomColor: t.line }]} accessibilityRole="link">
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text style={{ color: t.ink, fontWeight: '600' }}>{d.provider}{i === 0 ? <Text style={{ color: t.good, fontSize: 12 }}>  Cheapest</Text> : null}</Text>
                          <View style={{ flexDirection: 'row', gap: 4 }}>
                            {d.freeCancellation && <Pill>Free cancellation</Pill>}
                            {d.breakfast && <Pill>Breakfast</Pill>}
                          </View>
                        </View>
                        <Text style={{ color: t.ink, fontWeight: '700', fontFamily: mono }}>{fmt(d.price, d.currency)}</Text>
                        <Text style={{ color: t.teal, fontSize: 20 }}>›</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

function Badge({ code, t, size = 34, text }) {
  return (
    <View style={{ width: size, height: size, borderRadius: 8, backgroundColor: `hsl(${hue(code)}, 45%, 38%)`, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: text || 12, fontFamily: mono }}>{code}</Text>
    </View>
  );
}

function FlightRow({ r, t }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Badge code={r.airlineCode} t={t} />
        <Text style={{ color: t.ink, fontWeight: '600', flex: 1 }}>{r.airline} <Text style={{ color: t.muted, fontFamily: mono, fontSize: 12 }}>{r.flightNumber}</Text></Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View><Text style={[st.time, { color: t.ink }]}>{hm(r.departAt)}</Text><Text style={{ color: t.muted, fontFamily: mono, fontSize: 12 }}>{r.from}</Text></View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: t.muted, fontSize: 12 }}>{dur(r.durationMin)}</Text>
          <View style={{ height: 2, alignSelf: 'stretch', backgroundColor: t.line, marginVertical: 4, alignItems: 'center', justifyContent: 'center' }}>
            {r.stops > 0 && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.accent }} />}
          </View>
          <Text style={{ color: r.stops ? t.muted : t.good, fontSize: 12, fontWeight: '600' }}>{r.stops ? `${r.stops} stop` : 'Direct'}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}><Text style={[st.time, { color: t.ink }]}>{hm(r.arriveAt)}</Text><Text style={{ color: t.muted, fontFamily: mono, fontSize: 12 }}>{r.to}</Text></View>
      </View>
    </View>
  );
}

function HotelRow({ r, t }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ width: 72, height: 72, borderRadius: 10, backgroundColor: `hsl(${hue(r.name)}, 40%, 38%)`, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800' }}>{r.name[0]}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: t.ink, fontWeight: '700', fontSize: 16 }}>{r.name}</Text>
        {!!r.stars && <Text style={{ color: t.accent, letterSpacing: 2 }} accessibilityLabel={`${r.stars} star hotel`}>{'★'.repeat(r.stars)}</Text>}
        <Text style={{ color: t.muted, fontSize: 12 }}>{r.area} · {r.nights} night{r.nights > 1 ? 's' : ''}</Text>
        {!!r.rating && <Text style={{ color: t.muted, fontSize: 12 }}><Text style={{ color: t.teal, fontWeight: '800' }}>{r.rating.toFixed(1)}</Text> guest rating</Text>}
        <Text style={{ color: t.muted, fontSize: 12 }}>{fmt(r.pricePerNight || r.price / r.nights, r.currency)} per night</Text>
      </View>
    </View>
  );
}

function CarRow({ r, t }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <Badge code={r.category.slice(0, 3).toUpperCase()} t={t} size={72} text={16} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: t.ink, fontWeight: '700', fontSize: 16 }}>{r.model} <Text style={{ color: t.muted, fontWeight: '400', fontSize: 12 }}>or similar</Text></Text>
        <Text style={{ color: t.muted, fontSize: 12 }}>{r.supplier} · {r.seats} seats · {r.transmission}</Text>
        <Text style={{ color: t.muted, fontSize: 12 }}>{r.unlimitedKm ? 'Unlimited km' : 'Limited km'} · {r.fuelPolicy}</Text>
        <Text style={{ color: t.muted, fontSize: 12 }}>{fmt(r.pricePerDay || r.price / r.days, r.currency)} per day</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 17, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  sortbar: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  sortBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  card: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  buyRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderStyle: 'dashed', paddingTop: 10 },
  price: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  time: { fontSize: 20, fontWeight: '700', fontFamily: mono },
  deal: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
});

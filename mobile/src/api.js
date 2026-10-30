// Talks to the FareNest backend (the Node server in the repo root).
// Set the live server address in app.json -> expo.extra.apiUrl before building.
// With no address set, the app runs in demo mode with sample prices.
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_URL = (Constants.expoConfig?.extra?.apiUrl || '').replace(/\/$/, '');
let override = null;

export async function getApiUrl() {
  if (override === null) {
    try { override = (await AsyncStorage.getItem('fn_api_url')) || ''; } catch { override = ''; }
  }
  return (override || DEFAULT_URL).replace(/\/$/, '');
}
export async function setApiUrl(url) {
  override = url.trim();
  try { await AsyncStorage.setItem('fn_api_url', override); } catch {}
}
export const defaultApiUrl = DEFAULT_URL;

export async function search(vertical, query) {
  const base = await getApiUrl();
  if (!base) return { ...Mock[vertical](query), demo: true, base };
  const qs = Object.entries(query).filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const r = await fetch(`${base}/api/search/${vertical}?${qs}`, { signal: ctrl.signal });
    const body = await r.json().catch(() => null);
    if (!r.ok) throw new Error(body?.error || `Server error ${r.status}`);
    return { ...body, demo: body.providers?.some(p => /demo/i.test(p.provider)), base };
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('The search took too long. Check your connection and try again.');
    if (/Network request failed/i.test(e.message)) throw new Error('Could not reach FareNest. Check your internet connection.');
    throw e;
  } finally { clearTimeout(t); }
}

// Turns a deal's /go/... path into a full link on the backend.
export const dealUrl = (base, link) => (!link ? '' : /^https?:/.test(link) ? link : `${base}${link}`);

// ---------- Demo data, same shape as the backend ----------
const rng = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; };
const P = [['SkyBazaar (demo)', 1], ['TripKart (demo)', 0.97], ['GoFareX (demo)', 1.04]];
const AIR = [['6E', 'IndiGo'], ['AI', 'Air India'], ['UK', 'Vistara'], ['SG', 'SpiceJet'], ['QP', 'Akasa Air'], ['IX', 'Air India Express']];

function wrap(items, vertical) {
  const res = items.map(it => {
    const pr = rng(it.k);
    const deals = P.filter(() => pr() > 0.15).map(([n, b]) => ({
      provider: n, price: Math.round(it.base * b * (0.94 + pr() * 0.12)), currency: 'INR', link: '',
      freeCancellation: pr() > 0.4, breakfast: pr() > 0.55,
    }));
    if (!deals.length) return null;
    deals.sort((a, b) => a.price - b.price);
    return { ...it.row, currency: 'INR', deals, price: deals[0].price, maxPrice: deals[deals.length - 1].price };
  }).filter(Boolean);
  const minP = Math.min(...res.map(r => r.price));
  const minD = Math.min(...res.map(r => r.durationMin || 9e9));
  res.forEach(r => { r.score = r.price / minP + (vertical === 'flights' ? 0.5 * r.durationMin / minD + 0.25 * r.stops : vertical === 'hotels' ? -(r.rating - 7) * 0.08 : 0); });
  res.sort((a, b) => a.score - b.score);
  return { vertical, count: res.length, providers: P.map(([n]) => ({ provider: n, ok: true, count: res.length })), results: res };
}

const Mock = {
  flights(q) {
    const r = rng(q.origin + q.destination + q.date); const out = [];
    for (let i = 0; i < 12; i++) {
      const [c, a] = AIR[Math.floor(r() * AIR.length)]; const stops = r() < 0.65 ? 0 : 1;
      const d = 95 + Math.floor(r() * 90) + stops * (60 + Math.floor(r() * 120));
      const dep = new Date(`${q.date}T00:00:00`); dep.setMinutes(300 + Math.floor(r() * 1000));
      const fn = c + (100 + Math.floor(r() * 899));
      out.push({ k: fn + i, base: (3200 + Math.floor(r() * 6500) - stops * 600) * (Number(q.adults) || 1),
        row: { airline: a, airlineCode: c, flightNumber: fn, from: q.origin, to: q.destination, departAt: dep.toISOString(),
          arriveAt: new Date(dep.getTime() + d * 6e4).toISOString(), durationMin: d, stops } });
    }
    return wrap(out, 'flights');
  },
  hotels(q) {
    const r = rng(q.city + q.checkIn);
    const W = [['Grand', 'Royal', 'Lotus', 'Harbour', 'Palm', 'Orchid', 'Sapphire', 'Heritage'], ['Residency', 'Suites', 'Inn', 'Palace', 'Retreat', 'Hotel', 'Stay', 'Court']];
    const nights = Math.max(1, Math.round((new Date(q.checkOut) - new Date(q.checkIn)) / 864e5)); const out = []; const seen = new Set();
    for (let i = 0; i < 10; i++) {
      const name = `${W[0][Math.floor(r() * 8)]} ${W[1][Math.floor(r() * 8)]} ${q.city}`;
      const stars = 2 + Math.floor(r() * 4); const nightly = 1500 + stars * 1100 + Math.floor(r() * 2500);
      const row = { name, stars, rating: Number((6.8 + r() * 2.9).toFixed(1)), area: ['City Centre', 'Airport', 'Old Town', 'Business District', 'Beachside'][Math.floor(r() * 5)], nights, pricePerNight: nightly };
      if (!seen.has(name)) { seen.add(name); out.push({ k: name, base: nightly * nights, row }); }
    }
    return wrap(out, 'hotels');
  },
  cars(q) {
    const r = rng(q.pickup + q.pickupDate);
    const days = Math.max(1, Math.round((new Date(q.dropoffDate) - new Date(q.pickupDate)) / 864e5));
    const C = [['Zoomcar', 'Maruti Swift', 'Hatchback', 4], ['Revv', 'Hyundai Creta', 'SUV', 5], ['Myles', 'Toyota Innova', 'MPV', 7], ['Savaari', 'Honda City', 'Sedan', 5], ['Zoomcar', 'Mahindra XUV700', 'SUV', 7], ['Revv', 'Tata Nexon EV', 'Compact SUV', 5]];
    return wrap(C.map(([s, m, c, seats]) => {
      const pd = 1400 + seats * 220 + Math.floor(r() * 900);
      return { k: s + m, base: pd * days, row: { supplier: s, model: m, category: c, seats, transmission: r() > 0.5 ? 'Automatic' : 'Manual', fuelPolicy: 'Full to full', unlimitedKm: r() > 0.5, days, pricePerDay: pd } };
    }), 'cars');
  },
};

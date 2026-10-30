require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const store = require('./lib/store');
const adapters = require('./providers');
const { search } = require('./lib/aggregate');
const affiliate = require('./lib/affiliate');

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '1mb' }));
store.seedIfEmpty();

const CURRENCY = process.env.DEFAULT_CURRENCY || 'INR';
const iata = s => String(s || '').trim().toUpperCase().slice(0, 3);
const date = s => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s : null);
const int = (s, d, max = 9) => Math.min(max, Math.max(1, parseInt(s, 10) || d));

// ---------- Public search API ----------
app.get('/api/search/flights', async (req, res) => {
  const q = {
    origin: iata(req.query.origin), destination: iata(req.query.destination),
    date: date(req.query.date), returnDate: date(req.query.returnDate) || '',
    adults: int(req.query.adults, 1), cabin: req.query.cabin || 'economy', currency: CURRENCY,
  };
  if (q.origin.length !== 3 || q.destination.length !== 3 || !q.date)
    return res.status(400).json({ error: 'origin, destination (3-letter codes) and date (YYYY-MM-DD) are required' });
  res.json(await search('flights', q));
});

app.get('/api/search/hotels', async (req, res) => {
  const q = {
    city: String(req.query.city || '').trim(), cityCode: iata(req.query.cityCode || ''),
    checkIn: date(req.query.checkIn), checkOut: date(req.query.checkOut),
    adults: int(req.query.adults, 2), rooms: int(req.query.rooms, 1), currency: CURRENCY,
  };
  if (!q.city || !q.checkIn || !q.checkOut) return res.status(400).json({ error: 'city, checkIn and checkOut are required' });
  res.json(await search('hotels', q));
});

app.get('/api/search/cars', async (req, res) => {
  const q = {
    pickup: String(req.query.pickup || '').trim(), pickupDate: date(req.query.pickupDate),
    dropoffDate: date(req.query.dropoffDate), currency: CURRENCY,
  };
  if (!q.pickup || !q.pickupDate || !q.dropoffDate) return res.status(400).json({ error: 'pickup, pickupDate and dropoffDate are required' });
  res.json(await search('cars', q));
});

// Affiliate redirect: logs the click, then sends the user to the partner.
app.get('/go/:id', (req, res) => {
  const url = affiliate.resolveClick(req.params.id, req);
  if (!url) return res.status(410).send('This deal link has expired. Please search again.');
  res.redirect(302, url);
});

// ---------- Admin API ----------
const sessions = new Set();
app.post('/api/admin/login', (req, res) => {
  const pw = String(req.body?.password || '');
  const expected = process.env.ADMIN_PASSWORD || 'change-me';
  const ok = pw.length === expected.length && crypto.timingSafeEqual(Buffer.from(pw), Buffer.from(expected));
  if (!ok) return res.status(401).json({ error: 'Wrong password' });
  const token = crypto.randomBytes(24).toString('hex');
  sessions.add(token);
  res.json({ token });
});
const auth = (req, res, next) => {
  const t = (req.get('authorization') || '').replace('Bearer ', '');
  if (!sessions.has(t)) return res.status(401).json({ error: 'Not logged in' });
  next();
};

const mask = p => {
  const ad = adapters[p.adapter];
  const credentials = { ...p.credentials };
  for (const f of ad?.credentialFields || []) if (f.secret && credentials[f.key]) credentials[f.key] = '••••••';
  return { ...p, credentials };
};

app.get('/api/admin/adapters', auth, (req, res) => {
  res.json(Object.entries(adapters).map(([key, a]) => ({
    key, label: a.label, verticals: a.verticals, credentialFields: a.credentialFields,
    settingFields: a.settingFields, fields: a.fields,
  })));
});
app.get('/api/admin/providers', auth, (req, res) => res.json(store.all().map(mask)));
app.post('/api/admin/providers', auth, (req, res) => {
  const b = req.body || {};
  if (!b.name || !adapters[b.adapter]) return res.status(400).json({ error: 'name and a valid adapter are required' });
  res.json(mask(store.create({
    name: b.name, adapter: b.adapter, verticals: b.verticals || [], enabled: b.enabled !== false,
    priority: Number(b.priority || 0), logoUrl: b.logoUrl || '', credentials: b.credentials || {},
    settings: b.settings || {}, affiliate: b.affiliate || {},
  })));
});
app.put('/api/admin/providers/:id', auth, (req, res) => {
  const p = store.update(req.params.id, req.body || {});
  p ? res.json(mask(p)) : res.status(404).json({ error: 'Not found' });
});
app.delete('/api/admin/providers/:id', auth, (req, res) => res.json({ ok: store.remove(req.params.id) }));

app.post('/api/admin/providers/:id/test', auth, async (req, res) => {
  const p = store.get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  const d = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
  const d2 = new Date(Date.now() + 16 * 864e5).toISOString().slice(0, 10);
  const sampleQ = { origin: 'DEL', destination: 'BOM', date: d, adults: 1, currency: CURRENCY,
    city: 'Mumbai', cityCode: 'BOM', checkIn: d, checkOut: d2, rooms: 1, pickup: 'Mumbai', pickupDate: d, dropoffDate: d2 };
  try { res.json(await adapters[p.adapter].test(p, sampleQ)); }
  catch (e) { res.json({ ok: false, message: e.message }); }
});

app.get('/api/admin/stats', auth, (req, res) => res.json(affiliate.stats()));

// ---------- Static pages ----------
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`FareNest running on http://localhost:${PORT}  (admin: /admin)`));

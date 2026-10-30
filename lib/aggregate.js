// Fan a search out to every enabled provider in parallel, normalise, merge identical
// trips/hotels/cars into one card with multiple deals, and rank them.
const store = require('./store');
const adapters = require('../providers');
const { registerClick } = require('./affiliate');

const TIMEOUT = Number(process.env.PROVIDER_TIMEOUT_MS || 12000);
const cache = new Map(); // key -> { at, data }
const CACHE_MS = 5 * 60e3;

function withTimeout(promise, ms, name) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error(`${name} timed out`)), ms))]);
}

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const KEY = {
  flights: o => `${norm(o.flightNumber)}|${String(o.departAt).slice(0, 16)}`,
  hotels: o => norm(o.name),
  cars: o => `${norm(o.supplier)}|${norm(o.model)}`,
};

async function search(vertical, query) {
  const cacheKey = vertical + JSON.stringify(query);
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const providers = store.enabledFor(vertical).sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  const status = [];
  const settled = await Promise.allSettled(providers.map(async p => {
    const ad = adapters[p.adapter];
    if (!ad?.[vertical]) throw new Error(`adapter ${p.adapter} has no ${vertical} support`);
    const t0 = Date.now();
    const rows = await withTimeout(ad[vertical](p, query), TIMEOUT, p.name);
    status.push({ provider: p.name, ok: true, count: rows.length, ms: Date.now() - t0 });
    return rows.map(r => ({ ...r, _p: p }));
  }));
  settled.forEach((s, i) => {
    if (s.status === 'rejected') status.push({ provider: providers[i].name, ok: false, error: String(s.reason?.message || s.reason) });
  });

  // Group identical items, collecting each provider's deal.
  const groups = new Map();
  for (const row of settled.flatMap(s => (s.status === 'fulfilled' ? s.value : []))) {
    const p = row._p; delete row._p;
    const k = KEY[vertical](row);
    const g = groups.get(k) || { ...row, deals: [] };
    const link = registerClick(p, row.deepLink, query, { vertical, price: row.price, currency: row.currency, item: row.flightNumber || row.name || row.model });
    g.deals.push({ provider: p.name, logoUrl: p.logoUrl || '', price: row.price, currency: row.currency, link,
      freeCancellation: row.freeCancellation, breakfast: row.breakfast });
    groups.set(k, g);
  }

  let results = [...groups.values()].map(g => {
    g.deals.sort((a, b) => a.price - b.price);
    g.price = g.deals[0].price;
    g.maxPrice = g.deals[g.deals.length - 1].price;
    delete g.deepLink;
    return g;
  });

  // "Best" score: price, plus duration/stops for flights, rating for hotels.
  if (results.length) {
    const minP = Math.min(...results.map(r => r.price));
    results.forEach(r => {
      let s = r.price / minP;
      if (vertical === 'flights') {
        const minD = Math.min(...results.map(x => x.durationMin || 9e9));
        s += 0.5 * ((r.durationMin || minD) / minD) + 0.25 * (r.stops || 0);
      }
      if (vertical === 'hotels' && r.rating) s -= (r.rating - 7) * 0.08;
      r.score = Number(s.toFixed(4));
    });
    results.sort((a, b) => a.score - b.score);
  }

  const data = { vertical, query, count: results.length, providers: status, results };
  cache.set(cacheKey, { at: Date.now(), data });
  return data;
}

module.exports = { search };

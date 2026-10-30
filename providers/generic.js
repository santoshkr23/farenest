// Generic REST adapter: plug in ANY partner API from the admin panel without writing code.
// You configure: URL template, method, headers, optional body template, the path to the
// results array, and a field mapping from the partner's JSON to our standard fields.
const { http } = require('./http');

function get(obj, path) {
  if (!path) return undefined;
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}
function fill(tpl, vars) {
  return String(tpl || '').replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}
function parseJSON(s, fallback) { try { return s ? JSON.parse(s) : fallback; } catch { return fallback; } }

const FIELDS = {
  flights: ['airline', 'airlineCode', 'flightNumber', 'from', 'to', 'departAt', 'arriveAt', 'durationMin', 'stops', 'price', 'currency', 'deepLink'],
  hotels: ['name', 'stars', 'rating', 'area', 'price', 'pricePerNight', 'currency', 'freeCancellation', 'breakfast', 'deepLink'],
  cars: ['supplier', 'model', 'category', 'seats', 'transmission', 'price', 'pricePerDay', 'currency', 'deepLink'],
};

function make(vertical) {
  return async (p, q) => {
    const cfg = p.settings?.[vertical] || {};
    if (!cfg.url) return [];
    const vars = { ...q, ...p.credentials };
    const headers = parseJSON(fill(cfg.headers, vars), {});
    const body = cfg.body ? fill(cfg.body, vars) : undefined;
    const r = await http(fill(cfg.url, vars), { method: cfg.method || 'GET', headers, body });
    const rows = cfg.resultsPath ? get(r, cfg.resultsPath) : r;
    if (!Array.isArray(rows)) throw new Error(`resultsPath "${cfg.resultsPath}" did not point to an array`);
    const map = parseJSON(cfg.mapping, {});
    return rows.map(row => {
      const o = {};
      for (const f of FIELDS[vertical]) if (map[f]) o[f] = get(row, map[f]);
      o.price = Number(o.price);
      if (o.durationMin != null) o.durationMin = Number(o.durationMin);
      if (o.stops != null) o.stops = Number(o.stops);
      o.currency ||= q.currency;
      return o;
    }).filter(o => Number.isFinite(o.price));
  };
}

module.exports = {
  label: 'Custom REST API (no-code mapping)',
  verticals: ['flights', 'hotels', 'cars'],
  credentialFields: [{ key: 'apiKey', label: 'API key (use {apiKey} in templates)', secret: true }],
  settingFields: 'generic', // admin UI renders the per-vertical mapping editor
  fields: FIELDS,
  flights: make('flights'), hotels: make('hotels'), cars: make('cars'),
  async test(p, q) {
    const v = p.verticals[0];
    const rows = await this[v](p, q);
    return { ok: true, message: `Got ${rows.length} ${v} results`, sample: rows.slice(0, 2) };
  },
};

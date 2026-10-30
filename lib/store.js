// Simple JSON-file store for provider configs. Swap for Postgres/Mongo later if needed.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, '..', 'data', 'providers.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return []; }
}
function save(list) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2));
}

// Seed demo providers on first run so the site works out of the box.
function seedIfEmpty() {
  if (fs.existsSync(FILE)) return;
  const demo = [
    { name: 'SkyBazaar (demo)', priceBias: 1.00 },
    { name: 'TripKart (demo)', priceBias: 0.97 },
    { name: 'GoFareX (demo)', priceBias: 1.04 },
  ].map((d, i) => ({
    id: crypto.randomUUID(),
    name: d.name,
    adapter: 'mock',
    verticals: ['flights', 'hotels', 'cars'],
    enabled: true,
    priority: i,
    logoUrl: '',
    credentials: {},
    settings: { priceBias: d.priceBias },
    createdAt: new Date().toISOString(),
  }));
  save(demo);
}

module.exports = {
  all: () => load(),
  enabledFor: (vertical) => load().filter(p => p.enabled && p.verticals.includes(vertical)),
  get: (id) => load().find(p => p.id === id),
  create(data) {
    const list = load();
    const p = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    list.push(p); save(list); return p;
  },
  update(id, patch) {
    const list = load();
    const i = list.findIndex(p => p.id === id);
    if (i < 0) return null;
    // Keep existing secret values when the admin UI sends back the masked placeholder.
    const creds = { ...list[i].credentials };
    for (const [k, v] of Object.entries(patch.credentials || {})) {
      if (v !== '••••••') creds[k] = v;
    }
    list[i] = { ...list[i], ...patch, credentials: creds, id };
    save(list); return list[i];
  },
  remove(id) {
    const list = load();
    const next = list.filter(p => p.id !== id);
    save(next); return next.length !== list.length;
  },
  seedIfEmpty,
};

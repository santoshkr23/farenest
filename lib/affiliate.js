// Affiliate link building + click tracking.
// Every "Book" button points to /go/<clickId>. We log the click, then 302 to the
// provider's affiliate URL so the partner network credits you the commission.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CLICKS = path.join(__dirname, '..', 'data', 'clicks.jsonl');
const pending = new Map(); // clickId -> { url, meta } (short-lived, built at search time)

// Template placeholders: {url} (provider deep link, URL-encoded), {rawUrl},
// {affiliateId}, {subId} (unique per click, use it to match conversions),
// {origin} {destination} {date} {returnDate} {city} {checkIn} {checkOut} {pickup}
function buildAffiliateUrl(provider, deepLink, query, subId) {
  const a = provider.affiliate || {};
  const vars = {
    url: encodeURIComponent(deepLink || ''),
    rawUrl: deepLink || '',
    affiliateId: encodeURIComponent(a.affiliateId || ''),
    subId,
    ...Object.fromEntries(Object.entries(query || {}).map(([k, v]) => [k, encodeURIComponent(v ?? '')])),
  };
  if (a.linkTemplate) {
    return a.linkTemplate.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  }
  if (!deepLink) return '';
  // No template: append affiliate param to the deep link if configured.
  if (a.affiliateId && a.paramName) {
    const u = new URL(deepLink);
    u.searchParams.set(a.paramName, a.affiliateId);
    if (a.subIdParam) u.searchParams.set(a.subIdParam, subId);
    return u.toString();
  }
  return deepLink;
}

// Called by the aggregator for each offer: returns the /go/ link shown to users.
function registerClick(provider, deepLink, query, offerMeta) {
  const clickId = crypto.randomBytes(8).toString('hex');
  const url = buildAffiliateUrl(provider, deepLink, query, clickId);
  if (!url) return null;
  pending.set(clickId, {
    url,
    meta: {
      providerId: provider.id, provider: provider.name,
      commissionPercent: Number(provider.affiliate?.commissionPercent || 0),
      flatCommission: Number(provider.affiliate?.flatCommission || 0),
      ...offerMeta,
    },
    at: Date.now(),
  });
  return `/go/${clickId}`;
}

// Drop unused links after 2 hours so memory stays small.
setInterval(() => {
  const cutoff = Date.now() - 2 * 3600e3;
  for (const [k, v] of pending) if (v.at < cutoff) pending.delete(k);
}, 10 * 60e3).unref();

function resolveClick(clickId, req) {
  const entry = pending.get(clickId);
  if (!entry) return null;
  const rec = {
    clickId, ts: new Date().toISOString(), ...entry.meta,
    ip: req.ip, ua: req.get('user-agent') || '', referer: req.get('referer') || '',
  };
  fs.mkdirSync(path.dirname(CLICKS), { recursive: true });
  fs.appendFileSync(CLICKS, JSON.stringify(rec) + '\n');
  return entry.url;
}

function readClicks() {
  try {
    return fs.readFileSync(CLICKS, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
  } catch { return []; }
}

// Estimated commission if every click converted at the configured conversion rate.
function stats() {
  const clicks = readClicks();
  const byProvider = {};
  for (const c of clicks) {
    const s = byProvider[c.provider] ||= { provider: c.provider, clicks: 0, flights: 0, hotels: 0, cars: 0, clickedValue: 0, potentialCommission: 0 };
    s.clicks++; s[c.vertical] = (s[c.vertical] || 0) + 1;
    s.clickedValue += c.price || 0;
    s.potentialCommission += (c.price || 0) * (c.commissionPercent || 0) / 100 + (c.flatCommission || 0);
  }
  const last7 = {};
  for (let i = 6; i >= 0; i--) last7[new Date(Date.now() - i * 864e5).toISOString().slice(0, 10)] = 0;
  for (const c of clicks) { const d = c.ts.slice(0, 10); if (d in last7) last7[d]++; }
  return {
    totalClicks: clicks.length,
    byProvider: Object.values(byProvider).sort((a, b) => b.clicks - a.clicks),
    last7Days: last7,
    recent: clicks.slice(-25).reverse(),
  };
}

module.exports = { registerClick, resolveClick, stats, buildAffiliateUrl };

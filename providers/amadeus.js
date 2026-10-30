// Amadeus Self-Service APIs (flights + hotels). Sign up: developers.amadeus.com
const { http, isoDurationToMin } = require('./http');

const tokens = new Map(); // providerId -> { token, exp }

function host(p) {
  return p.settings?.environment === 'production' ? 'https://api.amadeus.com' : 'https://test.api.amadeus.com';
}

async function token(p) {
  const cached = tokens.get(p.id);
  if (cached && cached.exp > Date.now() + 60e3) return cached.token;
  const r = await http(`${host(p)}/v1/security/oauth2/token`, {
    method: 'POST',
    form: { grant_type: 'client_credentials', client_id: p.credentials.apiKey, client_secret: p.credentials.apiSecret },
  });
  tokens.set(p.id, { token: r.access_token, exp: Date.now() + r.expires_in * 1000 });
  return r.access_token;
}

async function flights(p, q) {
  const params = new URLSearchParams({
    originLocationCode: q.origin, destinationLocationCode: q.destination,
    departureDate: q.date, adults: String(q.adults || 1), currencyCode: q.currency, max: '30',
  });
  if (q.returnDate) params.set('returnDate', q.returnDate);
  if (q.cabin) params.set('travelClass', q.cabin.toUpperCase());
  const r = await http(`${host(p)}/v2/shopping/flight-offers?${params}`, {
    headers: { Authorization: `Bearer ${await token(p)}` },
  });
  const carriers = r.dictionaries?.carriers || {};
  return (r.data || []).map(o => {
    const it = o.itineraries[0];
    const segs = it.segments;
    const code = segs[0].carrierCode;
    return {
      airline: carriers[code] || code, airlineCode: code,
      flightNumber: `${code}${segs[0].number}`,
      from: segs[0].departure.iataCode, to: segs[segs.length - 1].arrival.iataCode,
      departAt: segs[0].departure.at, arriveAt: segs[segs.length - 1].arrival.at,
      durationMin: isoDurationToMin(it.duration), stops: segs.length - 1,
      price: Number(o.price.grandTotal), currency: o.price.currency,
      deepLink: '', // Amadeus has no consumer booking page; set a linkTemplate in Affiliate settings
    };
  });
}

async function hotels(p, q) {
  const auth = { Authorization: `Bearer ${await token(p)}` };
  // q.city must be an IATA city code here (e.g. BOM, DEL, PAR)
  const list = await http(`${host(p)}/v1/reference-data/locations/hotels/by-city?cityCode=${encodeURIComponent(q.cityCode || q.city)}`, { headers: auth });
  const ids = (list.data || []).slice(0, 40).map(h => h.hotelId);
  if (!ids.length) return [];
  const params = new URLSearchParams({
    hotelIds: ids.join(','), checkInDate: q.checkIn, checkOutDate: q.checkOut,
    adults: String(q.adults || 1), roomQuantity: String(q.rooms || 1), currency: q.currency,
  });
  const r = await http(`${host(p)}/v3/shopping/hotel-offers?${params}`, { headers: auth });
  const nights = Math.max(1, Math.round((new Date(q.checkOut) - new Date(q.checkIn)) / 864e5));
  return (r.data || []).filter(h => h.offers?.length).map(h => {
    const total = Number(h.offers[0].price.total);
    return {
      name: h.hotel.name, stars: Number(h.hotel.rating) || null, rating: null, area: h.hotel.cityCode,
      price: total, pricePerNight: Math.round(total / nights), currency: h.offers[0].price.currency, nights,
      freeCancellation: h.offers[0].policies?.cancellations?.[0]?.type === 'FULL_STAY' ? false : !!h.offers[0].policies?.cancellations,
      breakfast: /BREAKFAST/i.test(h.offers[0].boardType || ''),
      deepLink: '',
    };
  });
}

module.exports = {
  label: 'Amadeus Self-Service',
  verticals: ['flights', 'hotels'],
  credentialFields: [{ key: 'apiKey', label: 'API Key' }, { key: 'apiSecret', label: 'API Secret', secret: true }],
  settingFields: [{ key: 'environment', label: 'Environment', type: 'select', options: ['test', 'production'] }],
  flights, hotels,
  async test(p) { await token(p); return { ok: true, message: 'Authenticated with Amadeus' }; },
};

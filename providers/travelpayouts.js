// Travelpayouts (Aviasales data API). Affiliate network: you earn commission on bookings
// made through the links it returns. Sign up: travelpayouts.com -> get API token + marker.
// Prices are cached from recent searches (good for comparison, may differ slightly at checkout).
const { http } = require('./http');

async function flights(p, q) {
  const params = new URLSearchParams({
    origin: q.origin, destination: q.destination, departure_at: q.date,
    currency: (q.currency || 'INR').toLowerCase(), sorting: 'price', direct: 'false',
    limit: '30', one_way: q.returnDate ? 'false' : 'true', token: p.credentials.token,
  });
  if (q.returnDate) params.set('return_at', q.returnDate);
  const r = await http(`https://api.travelpayouts.com/aviasales/v3/prices_for_dates?${params}`);
  const marker = p.affiliate?.affiliateId || p.credentials.marker || '';
  return (r.data || []).map(f => {
    const dep = new Date(f.departure_at);
    const dur = f.duration_to || f.duration || 0;
    return {
      airline: f.airline, airlineCode: f.airline,
      flightNumber: `${f.airline}${f.flight_number}`,
      from: f.origin_airport || f.origin, to: f.destination_airport || f.destination,
      departAt: dep.toISOString(), arriveAt: new Date(dep.getTime() + dur * 60e3).toISOString(),
      durationMin: dur, stops: f.transfers || 0,
      price: Number(f.price), currency: (r.currency || q.currency).toUpperCase(),
      deepLink: `https://www.aviasales.com${f.link}${f.link.includes('?') ? '&' : '?'}marker=${encodeURIComponent(marker)}`,
    };
  });
}

module.exports = {
  label: 'Travelpayouts / Aviasales (affiliate)',
  verticals: ['flights'],
  credentialFields: [{ key: 'token', label: 'API token', secret: true }, { key: 'marker', label: 'Partner marker' }],
  settingFields: [],
  flights,
  async test(p) {
    await http(`https://api.travelpayouts.com/aviasales/v3/prices_for_dates?origin=DEL&destination=BOM&limit=1&token=${p.credentials.token}`);
    return { ok: true, message: 'Travelpayouts token is valid' };
  },
};

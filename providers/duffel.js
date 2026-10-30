// Duffel flights API. Sign up: duffel.com (you can also sell tickets directly and earn markup).
const { http, isoDurationToMin } = require('./http');

async function flights(p, q) {
  const slices = [{ origin: q.origin, destination: q.destination, departure_date: q.date }];
  if (q.returnDate) slices.push({ origin: q.destination, destination: q.origin, departure_date: q.returnDate });
  const r = await http('https://api.duffel.com/air/offer_requests?return_offers=true&supplier_timeout=10000', {
    method: 'POST',
    headers: { Authorization: `Bearer ${p.credentials.accessToken}`, 'Duffel-Version': 'v2' },
    body: {
      data: {
        slices,
        passengers: Array.from({ length: q.adults || 1 }, () => ({ type: 'adult' })),
        cabin_class: (q.cabin || 'economy').toLowerCase(),
      },
    },
    timeoutMs: 20000,
  });
  return (r.data?.offers || []).slice(0, 40).map(o => {
    const s = o.slices[0];
    const segs = s.segments;
    const mc = segs[0].marketing_carrier;
    return {
      airline: mc.name, airlineCode: mc.iata_code,
      flightNumber: `${mc.iata_code}${segs[0].marketing_carrier_flight_number}`,
      from: segs[0].origin.iata_code, to: segs[segs.length - 1].destination.iata_code,
      departAt: segs[0].departing_at, arriveAt: segs[segs.length - 1].arriving_at,
      durationMin: isoDurationToMin(s.duration), stops: segs.length - 1,
      price: Number(o.total_amount), currency: o.total_currency,
      deepLink: '',
    };
  });
}

module.exports = {
  label: 'Duffel',
  verticals: ['flights'],
  credentialFields: [{ key: 'accessToken', label: 'Access token', secret: true }],
  settingFields: [],
  flights,
  async test(p) {
    await http('https://api.duffel.com/air/airlines?limit=1', {
      headers: { Authorization: `Bearer ${p.credentials.accessToken}`, 'Duffel-Version': 'v2' },
    });
    return { ok: true, message: 'Duffel token is valid' };
  },
};

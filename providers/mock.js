// Demo adapter: deterministic fake inventory. Same flights/hotels/cars appear across
// mock providers with slightly different prices, so the comparison UI can be tested
// before any real API keys are added.
function rng(seedStr) {
  let h = 2166136261;
  for (const c of seedStr) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
}

const AIRLINES = [['6E', 'IndiGo'], ['AI', 'Air India'], ['UK', 'Vistara'], ['SG', 'SpiceJet'], ['QP', 'Akasa Air'], ['IX', 'Air India Express']];
const HOTEL_WORDS = [['Grand', 'Royal', 'Lotus', 'Harbour', 'Palm', 'Orchid', 'Sapphire', 'Heritage'], ['Residency', 'Suites', 'Inn', 'Palace', 'Retreat', 'Hotel', 'Stay', 'Grand']];
const CARS = [['Zoomcar', 'Maruti Swift', 'Hatchback', 4], ['Revv', 'Hyundai Creta', 'SUV', 5], ['Myles', 'Toyota Innova', 'MPV', 7], ['Savaari', 'Honda City', 'Sedan', 5], ['Zoomcar', 'Mahindra XUV700', 'SUV', 7], ['Revv', 'Tata Nexon EV', 'Compact SUV', 5]];

function bias(p, r) { return (p.settings?.priceBias || 1) * (0.94 + r() * 0.12); }

async function flights(p, q) {
  const base = rng(`${q.origin}-${q.destination}-${q.date}`);
  const pr = rng(`${p.name}-${q.origin}-${q.date}`);
  const out = [];
  for (let i = 0; i < 12; i++) {
    const [code, airline] = AIRLINES[Math.floor(base() * AIRLINES.length)];
    const depMin = 300 + Math.floor(base() * 1000);
    const stops = base() < 0.65 ? 0 : 1;
    const dur = 95 + Math.floor(base() * 90) + stops * (60 + Math.floor(base() * 120));
    const basePrice = 3200 + Math.floor(base() * 6500) + stops * -600;
    if (pr() < 0.15) continue; // not every provider sells every flight
    const dep = new Date(`${q.date}T00:00:00`); dep.setMinutes(depMin);
    const arr = new Date(dep.getTime() + dur * 60e3);
    out.push({
      airline, airlineCode: code, flightNumber: `${code}${100 + Math.floor(base() * 899)}`,
      from: q.origin, to: q.destination,
      departAt: dep.toISOString(), arriveAt: arr.toISOString(),
      durationMin: dur, stops,
      price: Math.round(basePrice * bias(p, pr) * (q.adults || 1)), currency: q.currency,
      deepLink: `https://example.com/book?f=${code}&d=${q.date}&p=${encodeURIComponent(p.name)}`,
    });
  }
  return out;
}

async function hotels(p, q) {
  const base = rng(`${q.city}-${q.checkIn}`);
  const pr = rng(`${p.name}-${q.city}-${q.checkIn}`);
  const nights = Math.max(1, Math.round((new Date(q.checkOut) - new Date(q.checkIn)) / 864e5));
  const out = [];
  for (let i = 0; i < 10; i++) {
    const name = `${HOTEL_WORDS[0][Math.floor(base() * 8)]} ${HOTEL_WORDS[1][Math.floor(base() * 8)]} ${q.city}`;
    const stars = 2 + Math.floor(base() * 4);
    const nightly = 1500 + stars * 1100 + Math.floor(base() * 2500);
    const rating = (6.8 + base() * 2.9).toFixed(1);
    const area = ['City Centre', 'Airport', 'Old Town', 'Business District', 'Beachside'][Math.floor(base() * 5)];
    if (pr() < 0.15) continue;
    out.push({
      name, stars, rating: Number(rating), area,
      pricePerNight: Math.round(nightly * bias(p, pr)),
      price: Math.round(nightly * bias(p, pr) * nights * (q.rooms || 1)), currency: q.currency, nights,
      freeCancellation: pr() > 0.4, breakfast: pr() > 0.55,
      deepLink: `https://example.com/hotel?n=${encodeURIComponent(name)}&p=${encodeURIComponent(p.name)}`,
    });
  }
  return out;
}

async function cars(p, q) {
  const base = rng(`${q.pickup}-${q.pickupDate}`);
  const pr = rng(`${p.name}-${q.pickup}`);
  const days = Math.max(1, Math.round((new Date(q.dropoffDate) - new Date(q.pickupDate)) / 864e5));
  return CARS.filter(() => pr() > 0.12).map(([supplier, model, category, seats]) => {
    const perDay = 1400 + seats * 220 + Math.floor(base() * 900);
    return {
      supplier, model, category, seats,
      transmission: base() > 0.5 ? 'Automatic' : 'Manual',
      fuelPolicy: 'Full to full', unlimitedKm: base() > 0.5,
      pricePerDay: Math.round(perDay * bias(p, pr)),
      price: Math.round(perDay * bias(p, pr) * days), currency: q.currency, days,
      deepLink: `https://example.com/car?m=${encodeURIComponent(model)}&p=${encodeURIComponent(p.name)}`,
    };
  });
}

module.exports = {
  label: 'Demo data (mock)',
  verticals: ['flights', 'hotels', 'cars'],
  credentialFields: [],
  settingFields: [{ key: 'priceBias', label: 'Price multiplier (e.g. 0.97)', type: 'number' }],
  flights, hotels, cars,
  async test() { return { ok: true, message: 'Mock adapter always works' }; },
};

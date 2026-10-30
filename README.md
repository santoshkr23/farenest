# FareNest — travel price comparison (flights, hotels, car hire)

A metasearch site: one search goes to every travel partner you connect, identical flights / hotels / cars are merged into one card, and visitors see who sells it cheapest. Every "View deal" click goes through your affiliate link, so you earn commission when they book.

## Run it

```bash
cp .env.example .env      # set ADMIN_PASSWORD!
npm install
npm start                 # http://localhost:3000   admin: http://localhost:3000/admin
```

Requires Node 18+. On first run three **demo partners** are created so the site works immediately. Delete or pause them once real partners are live.

## How it works

```
Browser ──> /api/search/{flights|hotels|cars}
              └─ lib/aggregate.js  → calls every enabled partner in parallel (12s timeout each)
                                   → normalises results, merges duplicates, ranks Best/Cheapest/Fastest
                                   → wraps each deal link as /go/<clickId>
Browser ──> /go/<clickId>  → logs click (data/clicks.jsonl) → 302 to partner with your affiliate ID
Admin   ──> /admin         → add partners, keys, affiliate IDs, commission %, test, see clicks
```

| Path | What it is |
|---|---|
| `server.js` | Express app, search + admin API, `/go` redirect |
| `lib/aggregate.js` | Fan-out, merge, rank, 5-minute cache |
| `lib/affiliate.js` | Affiliate link builder + click log + earnings stats |
| `lib/store.js` | Partner configs in `data/providers.json` |
| `providers/*.js` | One adapter per API |
| `public/index.html` | The search site (built from `src/site.html`) |
| `admin/index.html` | Admin panel |

## Partner integrations included

| Integration | Covers | Earn money by | Sign up |
|---|---|---|---|
| **Travelpayouts / Aviasales** | Flights | Affiliate commission, links come pre-tagged with your marker | travelpayouts.com |
| **Amadeus Self-Service** | Flights, hotels | Prices only; set a Link template to send users to a partner you're affiliated with | developers.amadeus.com |
| **Duffel** | Flights | Can sell tickets directly with your own markup (needs a booking flow) | duffel.com |
| **Custom REST API** | Any | Map any partner's JSON in the admin, no code | — |

Good affiliate programs for India to add with the **Custom REST API** type or just a link template: Travelpayouts (also has hotel and car-rental brands), Booking.com Affiliate Partner Program, Expedia Group / Agoda partner programs, Kiwi.com, Cleartrip and MakeMyTrip affiliate via networks like Cuelinks, vCommission or INRDeals.

## Setting up affiliate links (admin → Edit partner → Affiliate)

- **Affiliate ID + param name**: e.g. ID `SANTOSH1`, param `aid` → `https://partner.com/deal?...&aid=SANTOSH1`
- **Sub-ID param**: adds the unique click ID so you can match bookings in the partner dashboard to clicks here.
- **Link template** (most flexible), e.g. for a network deeplink:
  `https://linksredirect.com/?cid=YOURID&source=linkkit&url={url}&subid={subId}`
- **Commission %**: only used for the "potential commission" estimate in the dashboard.

## Adding a hand-coded adapter

Create `providers/myapi.js` exporting `{ label, verticals, credentialFields, settingFields, flights?, hotels?, cars?, test }` where each search function returns normalised rows (see `providers/mock.js` for the exact fields), then register it in `providers/index.js`.

## Before going live

- Change `ADMIN_PASSWORD`, serve over HTTPS, keep `data/` out of git (it holds API keys).
- Prices from different partners must be in the same currency (set `DEFAULT_CURRENCY`, and request that currency from each API).
- Read each partner's terms: most require showing their name, not caching prices too long, and an affiliate disclosure (the footer already has one).
- For real traffic, move `data/*.json` to a database (Postgres/MongoDB) and the in-memory cache/sessions to Redis.

## Mobile apps

The `mobile/` folder has the Android and iOS app (Expo / React Native). See [mobile/README.md](mobile/README.md) for building and submitting to Google Play and the App Store. Store-required pages: `privacy.html`, `terms.html`, `support.html`.

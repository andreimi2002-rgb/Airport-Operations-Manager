// Fills names, coordinates, runway geometry and distances from OurAirports.
//
// Usage (Node 18+):
//   node tools/refresh-geo.mjs <path/to/airports.csv> <path/to/runways.csv>
//
// Download the CSVs once from https://ourairports.com/data/ (public domain).
// They are not stored in the repo. The script only overwrites geo fields;
// gameplay fields (unlock, airlines, aircraft, gates) are left as they are.

import { readFileSync, writeFileSync } from 'node:fs';
import { pretty } from './pretty.mjs';

const [airportsCsv, runwaysCsv] = process.argv.slice(2);
if (!airportsCsv || !runwaysCsv) {
  console.error('Usage: node tools/refresh-geo.mjs <airports.csv> <runways.csv>');
  process.exit(1);
}

const SFO_FILE = 'data/airports/SFO.json';
const DEST_FILE = 'data/destinations.json';

// Minimal CSV parser (handles quoted fields with commas and "" escapes).
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

const num = v => (v === '' ? null : Number(v));
const pad = ident => ident.replace(/^(\d)(?!\d)/, '0$1'); // "1L" -> "01L"

function haversineKm(a, b) {
  const R = 6371, rad = d => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

const airports = parseCsv(readFileSync(airportsCsv, 'utf8'));
const runways = parseCsv(readFileSync(runwaysCsv, 'utf8'));
const byIata = new Map(airports.filter(a => a.iata_code).map(a => [a.iata_code, a]));

// OurAirports "municipality" is the exact town (e.g. "Dulles"); players expect the city served.
const CITY_SERVED = {
  IAD: 'Washington', NRT: 'Tokyo', TPE: 'Taipei', CDG: 'Paris', SYD: 'Sydney',
  HNL: 'Honolulu', FRA: 'Frankfurt', SNA: 'Orange County', DFW: 'Dallas'
};

function airportGeo(iata) {
  const a = byIata.get(iata);
  if (!a) throw new Error(`Airport ${iata} not found in OurAirports`);
  return {
    name: a.name,
    city: CITY_SERVED[iata] ?? a.municipality,
    country: a.iso_country,
    region: a.iso_region,
    location: { lat: num(a.latitude_deg), lon: num(a.longitude_deg), elevationFt: num(a.elevation_ft) }
  };
}

// --- SFO ---
const sfo = JSON.parse(readFileSync(SFO_FILE, 'utf8'));
const sfoGeo = airportGeo(sfo.iata);
Object.assign(sfo, { name: sfoGeo.name, city: sfoGeo.city, country: sfoGeo.country, region: sfoGeo.region, location: sfoGeo.location });

const sfoRunways = runways.filter(r => r.airport_ident === sfo.icao && r.closed !== '1');
for (const rwy of sfo.runways) {
  const row = sfoRunways.find(r => pad(r.le_ident) === rwy.ends[0] && pad(r.he_ident) === rwy.ends[1]);
  if (!row) throw new Error(`Runway ${rwy.id} not found for ${sfo.icao}`);
  const end = p => ({
    ident: pad(row[`${p}_ident`]),
    lat: num(row[`${p}_latitude_deg`]),
    lon: num(row[`${p}_longitude_deg`]),
    elevationFt: num(row[`${p}_elevation_ft`]),
    headingDeg: num(row[`${p}_heading_degT`]),
    displacedThresholdFt: num(row[`${p}_displaced_threshold_ft`]) ?? 0
  });
  Object.assign(rwy, {
    lengthFt: num(row.length_ft),
    widthFt: num(row.width_ft),
    surface: row.surface,
    thresholds: [end('le'), end('he')]
  });
}
// Keep a stable, readable key order.
sfo.runways = sfo.runways.map(({ id, ends, lengthFt, widthFt, surface, realUse, thresholds, unlock }) =>
  ({ id, ends, lengthFt, widthFt, surface, realUse, thresholds, unlock }));
writeFileSync(SFO_FILE, pretty(sfo));

// --- Destinations ---
const dest = JSON.parse(readFileSync(DEST_FILE, 'utf8'));
const origin = sfo.location;
dest.destinations = dest.destinations.map(d => {
  const g = airportGeo(d.iata);
  return {
    iata: d.iata,
    name: g.name,
    city: g.city,
    country: g.country,
    lat: g.location.lat,
    lon: g.location.lon,
    distanceKm: haversineKm(origin, g.location),
    type: d.type,
    airlines: d.airlines,
    aircraft: d.aircraft,
    unlock: d.unlock
  };
});
writeFileSync(DEST_FILE, pretty(dest));

console.log(`Updated ${SFO_FILE} (${sfo.runways.length} runways) and ${DEST_FILE} (${dest.destinations.length} destinations).`);

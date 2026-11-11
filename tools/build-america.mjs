// Builds data/america.json: the stadiums and cities of every team outside Florida, as plain facts.
//   - stadium name, city, roof, grass and an official photo: ESPN (the same source as the logos);
//   - coordinates, time zone and population of the city: Open-Meteo geocoding (free, no key);
//   - opening year, capacity, former names: the American Sports Encyclopedia, when it has the stadium
//     (pass its folder: node tools/build-america.mjs ../usa-places-explorer).
// Florida's stadiums and cities stay in data/places.json, with their Romanian texts.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { LEAGUES, TEAMS, norm } from '../js/teams.js';

const ENC = process.argv[2] || 'C:/Users/stroe/Desktop/usa-places-explorer';
const SITE = 'https://site.api.espn.com/apis/site/v2/sports/';
const UA = { 'user-agent': 'florida-games-calendar/1.0 (personal project; build script)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
      if (r.status === 429) throw Object.assign(new Error('429'), { wait: 30000 });
      if (!r.ok) throw new Error(r.status + ' ' + url);
      return await r.json();
    } catch (e) { if (i >= tries) throw e; await sleep(e.wait || 1000 * i); }
  }
}
async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}
const slug = s => norm(s).replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const STATES = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  ON: 'Ontario', QC: 'Quebec', BC: 'British Columbia', AB: 'Alberta', MB: 'Manitoba' };
const CANADA = new Set(['ON', 'QC', 'BC', 'AB', 'MB', 'Ontario', 'Quebec', 'British Columbia', 'Alberta', 'Manitoba']);

// ---------- encyclopedia: venues and cities by name ----------
const enc = { venues: new Map(), cities: new Map() };
if (existsSync(join(ENC, 'src/data/venues'))) {
  for (const f of readdirSync(join(ENC, 'src/data/cities'))) { const c = JSON.parse(readFileSync(join(ENC, 'src/data/cities', f), 'utf8')); enc.cities.set(f.replace('.json', ''), c); }
  for (const f of readdirSync(join(ENC, 'src/data/venues'))) {
    const v = JSON.parse(readFileSync(join(ENC, 'src/data/venues', f), 'utf8'));
    for (const n of [v.name, ...(v.formerNames || []).map(x => x.name)]) enc.venues.set(norm(n).replace(/[^a-z0-9]/g, ''), { ...v, id: f.replace('.json', '') });
  }
  // MLS teams: the encyclopedia knows their stadium when ESPN does not say.
  enc.franchise = new Map();
  for (const f of readdirSync(join(ENC, 'src/data/franchises'))) { const j = JSON.parse(readFileSync(join(ENC, 'src/data/franchises', f), 'utf8')); enc.franchise.set(norm(j.name), j); }
  console.log(`encyclopedia: ${enc.venues.size} venue names, ${enc.cities.size} cities`);
}
const encVenue = name => enc.venues.get(norm(name).replace(/[^a-z0-9]/g, '')) || null;

// ---------- ESPN: every team and its home ----------
const flNames = new Set(Object.values(TEAMS).map(t => t.l + '|' + norm(t.espn)));
const teams = [];
for (const l of Object.keys(LEAGUES)) {
  const j = await get(`${SITE}${LEAGUES[l].path}/teams`);
  for (const x of j.sports?.[0]?.leagues?.[0]?.teams || []) {
    const t = x.team;
    if (!flNames.has(l + '|' + norm(t.displayName)) && !/^tbd\b/i.test(t.displayName)) teams.push({ l, id: String(t.id), name: t.displayName });
  }
}
console.log('teams outside Florida:', teams.length);
const LG_SLUG = { NBA: 'nba', NHL: 'nhl', NFL: 'nfl', MLS: 'soccer', MLB: 'mlb' };
// The stadium of the team's home game nearest to today: ESPN's "franchise venue" is often historic
// (Warriors at Oracle Arena, Rams at the Coliseum), the games are not.
async function currentHome(t) {
  const qs = t.l === 'MLB' ? ['seasontype=2', ''] : t.l === 'MLS' ? ['', 'fixture=true'] : [''];
  let best = null;
  for (const q of qs) {
    const j = await get(`${SITE}${LEAGUES[t.l].path}/teams/${t.id}/schedule${q ? '?' + q : ''}`).catch(() => null);
    for (const ev of j?.events || []) {
      const c = ev.competitions?.[0], h = c?.competitors?.find(x => x.homeAway === 'home');
      if (!c?.venue?.fullName || String(h?.team?.id) !== t.id || c.neutralSite) continue;
      const dist = Math.abs(new Date(ev.date) - Date.now());
      if (!best || dist < best.dist) best = { dist, id: ev.id, v: c.venue };
    }
  }
  if (!best) return null;
  // The game summary names the stadium with its ESPN id and photo.
  const s = await get(`${SITE}${LEAGUES[t.l].path}/summary?event=${best.id}`).catch(() => null);
  return s?.gameInfo?.venue?.fullName ? s.gameInfo.venue : best.v;
}
// Roofs ESPN does not say for the current stadiums (2026): fixed domes and retractable roofs.
const ROOF = {
  'ford field': 'closed', 'caesars superdome': 'closed', 'us bank stadium': 'closed', 'allegiant stadium': 'closed', 'sofi stadium': 'closed',
  'att stadium': 'retractable', 'nrg stadium': 'retractable', 'reliant stadium': 'retractable', 'lucas oil stadium': 'retractable', 'state farm stadium': 'retractable',
  'mercedesbenz stadium': 'retractable', 'chase field': 'retractable', 'rogers centre': 'retractable', 'globe life field': 'retractable', 'daikin park': 'retractable',
  'minute maid park': 'retractable', 'american family field': 'retractable', 'tmobile park': 'retractable', 'bc place': 'retractable'
};
const roofOf = (name, l, indoor) => (l === 'NBA' || l === 'NHL' ? 'closed' : ROOF[norm(name).replace(/[^a-z0-9 ]/g, '')] || (indoor ? 'closed' : 'open'));
await pool(teams, 6, async t => {
  // MLS: the encyclopedia knows every club's current stadium, with a licensed photo.
  if (t.l === 'MLS') {
    const ALIAS = { lafc: 'los angeles fc', 'red bull new york': 'new york red bulls', 'vancouver whitecaps': 'vancouver whitecaps fc' };
    const n = norm(t.name), f = enc.franchise?.get(ALIAS[n] || n) || [...(enc.franchise?.values() || [])].find(x => norm(x.name).includes(n) || n.includes(norm(x.name)));
    const vid = f?.venues?.find(x => x.to == null)?.venue;
    if (vid) {
      const ev = JSON.parse(readFileSync(join(ENC, 'src/data/venues', vid + '.json'), 'utf8')), ec = enc.cities.get(ev.city);
      t.venue = { espnId: '', name: ev.name, city: ec?.name || '', state: ec?.region || '', country: ec?.country || '', indoor: false, grass: true, image: '', enc: ev };
      return;
    }
  }
  const j = await get(`${SITE}${LEAGUES[t.l].path}/teams/${t.id}`).catch(() => null);
  const fv = j?.team?.franchise?.venue || j?.team?.venue || null;
  const v = (await currentHome(t)) || fv;
  if (v?.fullName) {
    const same = fv && v.id && String(fv.id) === String(v.id);
    const imgs = v.images?.length ? v.images : same ? fv.images : [];
    let [city, state] = [v.address?.city || '', v.address?.state || ''];
    if (city.includes(',') && !state) [city, state] = city.split(',').map(s => s.trim());
    t.venue = { espnId: String(v.id || ''), name: v.fullName, city, state, country: v.address?.country || '', indoor: same ? fv.indoor : undefined, grass: v.grass ?? (same ? fv.grass : undefined), image: (imgs || []).find(i => (i.rel || []).includes('day'))?.href || imgs?.[0]?.href || '' };
  } else {
    // ESPN and the encyclopedia name a few clubs differently.
    const ALIAS = { lafc: 'los angeles fc', 'red bull new york': 'new york red bulls', 'vancouver whitecaps': 'vancouver whitecaps fc' };
    const n = norm(t.name), f = enc.franchise?.get(ALIAS[n] || n) || [...(enc.franchise?.values() || [])].find(x => norm(x.name).includes(n) || n.includes(norm(x.name)));
    const vid = f?.venues?.find(x => x.to == null)?.venue;
    if (vid) {
      const ev = JSON.parse(readFileSync(join(ENC, 'src/data/venues', vid + '.json'), 'utf8')), ec = enc.cities.get(ev.city);
      t.venue = { espnId: '', name: ev.name, city: ec?.name || '', state: ec?.region || '', country: ec?.country || '', indoor: false, grass: true, image: '' };
    }
  }
  if (!t.venue) console.warn('no venue:', t.l, t.name);
});

// ---------- cities: geocode once each ----------
// ESPN leaves out the province of the Canadian cities.
const CA_CITY = { toronto: 'ON', montreal: 'QC', 'montréal': 'QC', vancouver: 'BC', ottawa: 'ON', calgary: 'AB', edmonton: 'AB', winnipeg: 'MB' };
for (const t of teams) if (t.venue && !t.venue.state && CA_CITY[norm(t.venue.city)]) { t.venue.state = CA_CITY[norm(t.venue.city)]; t.venue.country = 'CAN'; }
// One key per city whatever the spelling of the state ("ON" or "Ontario").
const ABBR = Object.fromEntries(Object.entries(STATES).map(([a, n]) => [norm(n), a]));
const cityKey = v => slug(`${v.city} ${ABBR[norm(v.state)] || v.state}`);
const cityList = [...new Map(teams.filter(t => t.venue).map(t => [cityKey(t.venue), t.venue])).entries()];
const cities = {};
await pool(cityList, 4, async ([key, v]) => {
  const st = STATES[v.state] || v.state, cc = CANADA.has(v.state) || /can/i.test(v.country) ? 'CA' : 'US';
  const j = await get(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(v.city)}&count=10&language=en&countryCode=${cc}`).catch(() => null);
  const r = (j?.results || []).find(x => !st || norm(x.admin1) === norm(st)) || j?.results?.[0];
  if (!r) { console.warn('city not found:', v.city, v.state); return; }
  const e = [...enc.cities.values()].find(c => norm(c.name) === norm(v.city) && (!st || norm(c.region) === norm(st)));
  cities[key] = {
    id: key, name: v.city, state: st, country: cc === 'CA' ? 'Canada' : 'SUA',
    lat: +r.latitude.toFixed(4), lon: +r.longitude.toFixed(4), tz: r.timezone, pop: r.population || null,
    image: e?.image ? { url: e.image.url, page: e.image.page, author: e.image.author, license: e.image.license } : null, venues: []
  };
  await sleep(150);
});

// ---------- venues ----------
const venues = {};
for (const t of teams) {
  if (!t.venue) continue;
  const v = t.venue, id = slug(v.name), city = cities[cityKey(v)];
  if (!city) continue;
  const e = v.enc || encVenue(v.name);
  const cap = e?.capacity ? Object.values(e.capacity)[0]?.value : null;
  // A photo: ESPN's official one, or the encyclopedia's licensed one (with its credit).
  const encImg = e?.image?.url ? { url: e.image.url, page: e.image.page, author: e.image.author, license: e.image.license } : null;
  venues[id] ||= {
    id, name: v.name, city: city.id, lat: city.lat, lon: city.lon,
    roof: roofOf(v.name, t.l, v.indoor), kind: t.l === 'NBA' || t.l === 'NHL' ? 'arena' : 'stadium',
    surface: v.grass === true ? 'iarbă naturală' : v.grass === false && !(t.l === 'NBA' || t.l === 'NHL') ? 'gazon artificial' : '',
    photo: v.image || '', credit: v.image ? null : encImg, opened: e?.opened?.value ? String(e.opened.value).slice(0, 4) : null, capacity: cap || null,
    names: (e?.formerNames || []).map(x => [x.name, x.from ?? null, x.to ?? null]),
    teams: [], espn: [v.name]
  };
  venues[id].teams.push({ l: t.l, id: t.id, name: t.name });
  if (!venues[id].photo && v.image) { venues[id].photo = v.image; venues[id].credit = null; }
  if (t.l === 'NBA' || t.l === 'NHL') venues[id].roof = 'closed';
  if (t.l === 'NBA' || t.l === 'NHL') venues[id].kind = 'arena';
  if (!city.venues.includes(id)) city.venues.push(id);
}
const out = {
  updated: new Date().toISOString().slice(0, 10),
  about: 'Generat de tools/build-america.mjs. Nu edita de mână. Florida e în data/places.json.',
  credits: { espn: 'ESPN (stadioane, poze)', geo: 'Open-Meteo Geocoding (coordonate, fus orar, populație)', enc: 'American Sports Encyclopedia (deschidere, capacitate, nume vechi)' },
  cities, venues
};
writeFileSync(new URL('../data/america.json', import.meta.url), JSON.stringify(out) + '\n');
console.log(`wrote data/america.json: ${Object.keys(cities).length} cities, ${Object.keys(venues).length} venues`);

// Builds data/places.json (city and stadium pages) from tools/places-src.json.
// Adds what can be looked up, so it is never typed by hand:
//   - coordinates, from Wikipedia;
//   - photo URL, author and licence, from Wikimedia Commons;
//   - climate by month (2016–2025 averages), from the Open-Meteo historical archive;
//   - driving distance and time between the cities, from the public OSRM router.
// All of these are free and need no key. Run: node tools/build-places.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const src = JSON.parse(readFileSync(new URL('./places-src.json', import.meta.url), 'utf8'));
const UA = { 'user-agent': 'florida-games-calendar/1.0 (personal project; build script)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = async (url, tries = 4) => {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60000) });
      if (r.status === 429) throw Object.assign(new Error('429 ' + url), { wait: 65000 });   // free tier: wait a minute
      if (!r.ok) throw new Error(r.status + ' ' + url);
      return await r.json();
    } catch (e) { if (i >= tries) throw e; console.warn('  retry:', e.message.slice(0, 60)); await sleep(e.wait || 1500 * i); }
  }
};
const strip = s => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

// ---------- Wikimedia Commons: photo + licence ----------
async function images(titles) {
  const out = {};
  for (let i = 0; i < titles.length; i += 40) {
    const batch = titles.slice(i, i + 40);
    const q = new URLSearchParams({ action: 'query', titles: batch.join('|'), prop: 'imageinfo', iiprop: 'url|extmetadata|size', iiurlwidth: '1280', format: 'json', origin: '*' });
    const j = await get('https://commons.wikimedia.org/w/api.php?' + q);
    const norm = Object.fromEntries((j.query.normalized || []).map(n => [n.to, n.from]));
    for (const p of Object.values(j.query.pages)) {
      const ii = p.imageinfo?.[0];
      if (!ii) { console.warn('no image:', p.title); continue; }
      const m = ii.extmetadata || {};
      const big = (ii.thumburl || ii.url).split('?')[0];   // drop the utm_* tracking parameters
      out[norm[p.title] || p.title] = {
        big, small: /\/\d+px-/.test(big) ? big.replace(/\/\d+px-/, '/500px-') : big,
        w: ii.thumbwidth || ii.width, h: ii.thumbheight || ii.height,
        page: ii.descriptionurl, author: strip(m.Artist?.value) || 'necunoscut',
        license: strip(m.LicenseShortName?.value), licenseUrl: m.LicenseUrl?.value || ''
      };
    }
  }
  return out;
}

// ---------- Wikipedia: coordinates ----------
async function coords(titles) {
  const out = {};
  const q = new URLSearchParams({ action: 'query', titles: titles.join('|'), prop: 'coordinates', colimit: 'max', redirects: '1', format: 'json', origin: '*' });
  const j = await get('https://en.wikipedia.org/w/api.php?' + q);
  const back = {};
  for (const n of j.query.normalized || []) back[n.to] = n.from;
  for (const r of j.query.redirects || []) back[r.to] = back[r.from] || r.from;
  for (const p of Object.values(j.query.pages)) {
    const c = p.coordinates?.[0];
    if (!c) { console.warn('no coordinates:', p.title); continue; }
    out[back[p.title] || p.title] = { lat: +c.lat.toFixed(4), lon: +c.lon.toFixed(4) };
  }
  return out;
}

// ---------- Open-Meteo archive: climate by month ----------
async function climate({ lat, lon }) {
  const q = new URLSearchParams({ latitude: lat, longitude: lon, start_date: '2016-01-01', end_date: '2025-12-31', daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum', timezone: 'America/New_York' });
  const j = await get('https://archive-api.open-meteo.com/v1/archive?' + q);
  const d = j.daily, m = Array.from({ length: 12 }, () => ({ hi: 0, lo: 0, n: 0, rain: 0, wet: 0 }));
  const years = new Set();
  d.time.forEach((t, i) => {
    const k = +t.slice(5, 7) - 1, x = m[k];
    if (d.temperature_2m_max[i] == null) return;
    years.add(t.slice(0, 4));
    x.hi += d.temperature_2m_max[i]; x.lo += d.temperature_2m_min[i]; x.n++;
    x.rain += d.precipitation_sum[i] || 0; if ((d.precipitation_sum[i] || 0) >= 1) x.wet++;
  });
  const y = years.size || 1, r1 = v => Math.round(v * 10) / 10;
  return m.map(x => ({ hi: r1(x.hi / x.n), lo: r1(x.lo / x.n), rain: Math.round(x.rain / y), wet: Math.round(x.wet / y) }));
}

// ---------- OSRM: driving distance and time between cities ----------
async function drives(ids, pts) {
  const list = ids.map(id => `${pts[id].lon},${pts[id].lat}`).join(';');
  const j = await get(`https://router.project-osrm.org/table/v1/driving/${list}?annotations=duration,distance`);
  const out = {};
  ids.forEach((a, i) => { out[a] = {}; ids.forEach((b, k) => { if (a !== b) out[a][b] = { km: Math.round(j.distances[i][k] / 1000), min: Math.round(j.durations[i][k] / 60) }; }); });
  return out;
}

const cityIds = Object.keys(src.cities), venueIds = Object.keys(src.venues);
const all = [...cityIds.map(k => src.cities[k]), ...venueIds.map(k => src.venues[k])];
console.log('photos…');
const img = await images([...new Set(all.map(x => x.image).filter(Boolean))]);
console.log('coordinates…');
const co = await coords([...new Set(all.map(x => x.wiki))]);

const cities = {}, venues = {}, pts = {};
for (const id of cityIds) {
  const c = src.cities[id];
  pts[id] = co[c.wiki];
  if (!pts[id]) throw new Error('missing coordinates for ' + id);
  console.log('climate', id);
  cities[id] = { id, ...c, ...pts[id], image: img[c.image] || null, climate: await climate(pts[id]) };
  await sleep(5000);   // the archive API counts ten years of data as many calls
}
console.log('driving times…');
const dr = await drives(cityIds, pts);
for (const id of cityIds) cities[id].drive = dr[id];
for (const id of venueIds) {
  const v = src.venues[id];
  const p = co[v.wiki];
  if (!p) console.warn('venue without coordinates, using its city:', id);
  venues[id] = { id, ...v, ...(p || { lat: cities[v.city].lat, lon: cities[v.city].lon }), image: img[v.image] || null };
}

const out = {
  updated: new Date().toISOString().slice(0, 10),
  about: 'Generat de tools/build-places.mjs din tools/places-src.json. Nu edita de mână.',
  credits: {
    climate: { title: 'Open-Meteo, arhiva istorică (ERA5), medii 2016–2025', url: 'https://open-meteo.com/en/docs/historical-weather-api' },
    drive: { title: 'OSRM, rute cu mașina (OpenStreetMap)', url: 'https://project-osrm.org/' },
    photos: { title: 'Wikimedia Commons', url: 'https://commons.wikimedia.org/' }
  },
  cities, venues
};
writeFileSync(new URL('../data/places.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log(`wrote data/places.json: ${cityIds.length} cities, ${venueIds.length} venues, ${Object.keys(img).length} photos`);

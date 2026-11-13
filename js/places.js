// Cities, stadiums and weather: the data file (data/places.json), the /api/weather calls,
// and the HTML for the city and stadium pages, the weather strip and the game-page weather card.
// app.js owns routing and the overlay; it passes a small `ctx` with the game helpers it has.
import { TEAMS, okImg } from './teams.js';
import { esc } from './ui.js';

export const PLACES = { data: null, ready: null };
export function loadPlaces() {
  PLACES.ready ||= fetch('data/places.json', { signal: AbortSignal.timeout(12000) })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(j => (PLACES.data = j))
    .catch(() => (PLACES.ready = null, null));
  return PLACES.ready;
}
// The rest of the US and Canada (data/america.json): facts only, loaded when first needed.
export const AMERICA = { data: null, ready: null };
export function loadAmerica() {
  AMERICA.ready ||= fetch('data/america.json', { signal: AbortSignal.timeout(12000) })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(j => {
      // The store app shows no ESPN photo: those stadiums keep their Wikimedia photo (credit) or none.
      for (const v of Object.values(j.venues)) { v.lite = true; if (!okImg(v.photo)) v.photo = ''; }
      for (const c of Object.values(j.cities)) c.lite = true;
      return (AMERICA.data = j);
    })
    .catch(() => (AMERICA.ready = null, null));
  return AMERICA.ready;
}
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
// A stadium by the name ESPN gives a game: Florida first, then the rest of America.
export function venueByName(name) {
  const n = norm(name);
  if (!n) return null;
  for (const src of [PLACES.data?.venues, AMERICA.data?.venues]) {
    const hit = src && Object.values(src).find(x => (x.espn || [x.name]).some(e => norm(e) === n));
    if (hit) return hit;
  }
  return null;
}
export const getVenue = id => PLACES.data?.venues?.[id] || AMERICA.data?.venues?.[id] || null;
export const getCity = id => PLACES.data?.cities?.[id] || AMERICA.data?.cities?.[id] || null;
export const venueOfTeam = k => Object.values(PLACES.data?.venues || {}).find(v => v.teams.includes(k)) || null;
export const venueOfClub = (l, id) => Object.values(AMERICA.data?.venues || {}).find(v => v.teams.some(t => t.l === l && t.id === String(id))) || null;
export const cityOf = v => (v.lite ? AMERICA.data?.cities?.[v.city] : PLACES.data?.cities?.[v.city]) || null;

/* ================= every city and stadium: the "Orașe și stadioane" tab and the search ================= */
// Florida (places.json) and the rest (america.json) in one shape:
//   { id, name, region, country, fl, img, venues: [{ id, name, kind, img, alias, teams: [{ l, name }] }] }
export function allPlaces() {
  const out = [], P = PLACES.data, A = AMERICA.data;
  if (P) for (const c of Object.values(P.cities)) {
    const venues = Object.values(P.venues).filter(v => v.city === c.id).map(v => ({
      id: v.id, name: v.name, kind: v.kind, img: v.image?.small || '',
      alias: [...(v.espn || []), ...(v.names || []).map(n => n[0])],
      teams: v.teams.map(k => ({ l: TEAMS[k].l, name: TEAMS[k].espn })) }));
    out.push({ id: c.id, name: c.name, region: 'Florida', country: 'SUA', fl: true, img: c.image?.small || '', venues });
  }
  if (A) for (const c of Object.values(A.cities)) {
    const venues = c.venues.map(id => A.venues[id]).filter(Boolean).map(v => ({
      id: v.id, name: v.name, kind: v.kind, img: v.photo || '',
      alias: [...(v.espn || []), ...(v.names || []).map(n => n[0])],
      teams: v.teams.map(t => ({ l: t.l, name: t.name })) }));
    out.push({ id: c.id, name: c.name, region: c.state, country: c.country, fl: false, img: c.image?.url?.replace('/1280px-', '/330px-') || venues.find(v => v.img)?.img || '', venues });
  }
  return out;
}

// The tab: one block per state (Florida first, Canada at the end), a card per city with its stadiums.
// `chosen`: the leagues ticked above; a stadium shows when one of its teams plays in them.
export function placesIndexHtml(chosen, col) {
  const list = allPlaces();
  if (!list.length) return '<div class="skeleton" style="height:240px"></div>';
  const groups = new Map();
  for (const c of list) {
    const venues = c.venues.filter(v => v.teams.some(t => chosen.has(t.l)));
    if (!venues.length) continue;
    const g = c.region + '|' + c.country;
    if (!groups.has(g)) groups.set(g, { region: c.region, country: c.country, fl: c.fl, cities: [] });
    groups.get(g).cities.push({ ...c, venues });
  }
  const coll = new Intl.Collator('ro');
  const order = [...groups.values()].sort((a, b) => (b.fl - a.fl) || ((a.country === 'Canada') - (b.country === 'Canada')) || coll.compare(a.region, b.region));
  let nc = 0, nv = 0;
  const html = order.map(g => {
    g.cities.sort((a, b) => coll.compare(a.name, b.name));
    const v = g.cities.reduce((s, c) => s + c.venues.length, 0); nc += g.cities.length; nv += v;
    return `<section class="lgblock"><h3>${esc(g.region)}${g.country === 'Canada' ? ', Canada' : ''} <small>${g.cities.length} ${g.cities.length === 1 ? 'oraș' : 'orașe'} · ${v} ${v === 1 ? 'stadion' : 'stadioane'}</small></h3><div class="pgrid">${g.cities.map(c => `<div class="pcity${c.fl ? ' fl' : ''}">
      <button class="pcname" type="button" data-city="${esc(c.id)}">${c.img ? `<img src="${esc(c.img)}" alt="" loading="lazy" decoding="async">` : '<span class="noimg"></span>'}<b>${esc(c.name)}</b></button>
      <div class="pvs">${c.venues.map(v => `<button class="pv" type="button" data-venue="${esc(v.id)}"><b>${esc(v.name)}</b><small>${v.teams.map(t => `<span class="ldot" style="--c:${col(t.l)}"></span>${esc(t.name)}`).join(' · ')}</small></button>`).join('')}</div>
    </div>`).join('')}</div></section>`;
  }).join('');
  return (html ? `<div class="fn">${nc} orașe și ${nv} stadioane ale echipelor din ligile alese. Apasă pe un oraș sau pe un stadion: fapte, ora locală și vremea.</div>` + html
    : '<div class="empty">Niciun stadion pentru ligile alese.</div>');
}

/* ================= weather data ================= */
const WCACHE = new Map();
// points: [{lat, lon}]; brief = current + 7 days only. Cached 10 minutes in the page (30 on the CDN).
export async function getWeather(points, brief) {
  const key = (brief ? 'b|' : 'f|') + points.map(p => `${(+p.lat).toFixed(2)},${(+p.lon).toFixed(2)}`).join(';');
  const hit = WCACHE.get(key);
  if (hit && Date.now() - hit.t < 600e3) return hit.p;
  const p = fetch(`/api/weather?lat=${points.map(x => (+x.lat).toFixed(2)).join(',')}&lon=${points.map(x => (+x.lon).toFixed(2)).join(',')}${brief ? '&brief=1' : ''}`, { signal: AbortSignal.timeout(10000) })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(j => j.places || []);
  WCACHE.set(key, { t: Date.now(), p });
  p.catch(() => WCACHE.delete(key));
  return p;
}

/* ================= weather codes (WMO) and icons ================= */
const WMO = {
  0: ['Senin', 'clear'], 1: ['Mai mult senin', 'mostly'], 2: ['Parțial noros', 'partly'], 3: ['Înnorat', 'cloud'],
  45: ['Ceață', 'fog'], 48: ['Ceață cu chiciură', 'fog'],
  51: ['Burniță slabă', 'drizzle'], 53: ['Burniță', 'drizzle'], 55: ['Burniță deasă', 'drizzle'], 56: ['Burniță înghețată', 'drizzle'], 57: ['Burniță înghețată', 'drizzle'],
  61: ['Ploaie slabă', 'rain'], 63: ['Ploaie', 'rain'], 65: ['Ploaie puternică', 'heavy'], 66: ['Ploaie înghețată', 'rain'], 67: ['Ploaie înghețată', 'heavy'],
  71: ['Ninsoare slabă', 'snow'], 73: ['Ninsoare', 'snow'], 75: ['Ninsoare abundentă', 'snow'], 77: ['Grăunțe de zăpadă', 'snow'],
  80: ['Averse slabe', 'showers'], 81: ['Averse', 'showers'], 82: ['Averse puternice', 'heavy'], 85: ['Averse de ninsoare', 'snow'], 86: ['Averse de ninsoare', 'snow'],
  95: ['Furtună', 'storm'], 96: ['Furtună cu grindină', 'storm'], 99: ['Furtună cu grindină', 'storm']
};
export const wxText = c => (WMO[c] || ['—'])[0];
export const isStorm = c => c >= 95;
const SUN = '<circle cx="12" cy="12" r="4.6" class="sun"/><g class="sun-r" stroke-width="1.8" stroke-linecap="round"><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.5 1.5M17.1 17.1l1.5 1.5M5.4 18.6l1.5-1.5M17.1 6.9l1.5-1.5"/></g>';
const MOON = '<path d="M18.5 14.6A7 7 0 0 1 9.4 5.5a7 7 0 1 0 9.1 9.1z" class="moon"/>';
const CLOUD = (y = 0, cls = 'cloud') => `<path transform="translate(0 ${y})" class="${cls}" d="M7.2 19h10.3a3.9 3.9 0 0 0 .4-7.8 5.6 5.6 0 0 0-10.8 1.5A3.2 3.2 0 0 0 7.2 19z"/>`;
const DROPS = n => `<g class="drop" stroke-width="1.8" stroke-linecap="round">${n >= 3 ? '<path d="M8 20.5l-1 2.2M12 20.5l-1 2.2M16 20.5l-1 2.2"/>' : '<path d="M9.5 20.5l-1 2.2M14.5 20.5l-1 2.2"/>'}</g>`;
const ICON = {
  clear: d => (d ? SUN : MOON),
  mostly: d => `<g transform="translate(-2 -2) scale(.85)">${d ? SUN : MOON}</g>${CLOUD(3, 'cloud lite')}`,
  partly: d => `<g transform="translate(-3 -3) scale(.8)">${d ? SUN : MOON}</g>${CLOUD(2)}`,
  cloud: () => CLOUD(-1),
  fog: () => `${CLOUD(-3)}<g class="fogl" stroke-width="1.8" stroke-linecap="round"><path d="M5 20h14M7 23h10"/></g>`,
  drizzle: () => `${CLOUD(-3)}${DROPS(2)}`,
  rain: () => `${CLOUD(-3)}${DROPS(3)}`,
  heavy: () => `${CLOUD(-3, 'cloud dark')}${DROPS(3)}`,
  showers: d => `<g transform="translate(-3 -4) scale(.8)">${d ? SUN : MOON}</g>${CLOUD(-2)}${DROPS(2)}`,
  storm: () => `${CLOUD(-4, 'cloud dark')}<path class="bolt" d="M12.6 15.5l-3 4.6h2.6l-1.4 3.9 4.4-5.6h-2.7l1.6-2.9z"/>`,
  snow: () => `${CLOUD(-3)}<g class="drop" stroke-width="1.6" stroke-linecap="round"><path d="M9 20.5v2M8 21.5h2M15 20.5v2M14 21.5h2"/></g>`
};
export function wxIcon(code, day = true, size = 28) {
  const k = (WMO[code] || [null, 'cloud'])[1];
  return `<svg class="wx" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${ICON[k](day)}</svg>`;
}

/* ================= time ================= */
const DOWS = ['dum.', 'lun.', 'mar.', 'mie.', 'joi', 'vin.', 'sâm.'];
const MON = ['ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sept.', 'oct.', 'nov.', 'dec.'];
const MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
const dayName = iso => { const [y, m, d] = iso.split('-').map(Number); return DOWS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]; };
const hm = iso => (iso || '').slice(11, 16);
const fmtNY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false });
// A Date -> the Open-Meteo hour key in Florida time, "2026-11-15T13:00".
export function nyHourKey(d) {
  const p = Object.fromEntries(fmtNY.formatToParts(d).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour === '24' ? '00' : p.hour}:00`;
}
// Hours between Romania and a US time zone right now (Florida: 7 most of the year, 6 for a few
// weeks when clocks change; Los Angeles: 10).
export function hoursBehindRomania(d = new Date(), tz = 'America/New_York') {
  const off = z => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: z, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(d).map(x => [x.type, +x.value])); return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute); };
  return Math.round((off('Europe/Bucharest') - off(tz)) / 36e5);
}
export const clockIn = (tz = 'America/New_York') => new Intl.DateTimeFormat('ro-RO', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
export const floridaClock = () => clockIn('America/New_York');
const mins = m => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') + ' min' : ''}` : `${m} min`);
const num = n => Number(n).toLocaleString('ro-RO');

/* ================= weather pieces ================= */
function nowHtml(w, title) {
  if (!w?.now) return '';
  const n = w.now, d0 = w.days?.[0];
  return `<div class="wxnow">${wxIcon(n.code, n.day, 52)}<div><div class="t">${Math.round(n.temp)}°</div><div class="c">${esc(wxText(n.code))}</div></div>
    <dl><dt>Se simte ca</dt><dd>${Math.round(n.feels)}°</dd><dt>Umiditate</dt><dd>${n.hum}%</dd><dt>Vânt</dt><dd>${n.wind} km/h${n.gust > n.wind + 10 ? `, rafale ${n.gust}` : ''}</dd>${d0 ? `<dt>Azi</dt><dd>${Math.round(d0.lo)}° – ${Math.round(d0.hi)}°${d0.pp != null ? `, ploaie ${d0.pp}%` : ''}</dd>${d0.uv >= 6 ? `<dt>Indice UV</dt><dd>${d0.uv} (${d0.uv >= 8 ? 'foarte ridicat' : 'ridicat'})</dd>` : ''}` : ''}</dl>
    ${title ? `<small>${esc(title)} · ora locală ${esc(hm(n.time))}</small>` : ''}</div>`;
}
function daysHtml(w, n = 7) {
  if (!w?.days?.length) return '';
  const all = w.days.slice(0, n);
  const lo = Math.min(...all.map(d => d.lo)), hi = Math.max(...all.map(d => d.hi)), span = hi - lo || 1;
  return `<div class="wxdays" role="list">${all.map((d, i) => `<div class="wxd" role="listitem"><b>${i === 0 ? 'Azi' : dayName(d.date)}</b>${wxIcon(d.code, true, 30)}<span class="rng" aria-label="minim ${Math.round(d.lo)}, maxim ${Math.round(d.hi)} grade"><i style="left:${((d.lo - lo) / span * 100).toFixed(0)}%;right:${((hi - d.hi) / span * 100).toFixed(0)}%"></i></span><span class="hl"><b>${Math.round(d.hi)}°</b> ${Math.round(d.lo)}°</span><small class="${d.pp >= 50 ? 'wet' : ''}">${d.pp != null ? d.pp + '%' : ''}</small></div>`).join('')}</div>
    <div class="fn">Bara arată intervalul de temperatură al zilei față de restul săptămânii. Procentul de jos e șansa de ploaie.</div>`;
}

// Forecast for a game: the hours it is played, from Open-Meteo's hourly data.
export function gameWeatherHtml(g, v, w, durMin) {
  const roof = v.roof, city = cityOf(v);
  const link = `<button class="linkish" type="button" data-venue="${esc(v.id)}">${esc(v.name)}</button>`;
  const hrs = w?.hours;
  const k0 = nyHourKey(g.d), i0 = hrs ? hrs.time.indexOf(k0) : -1;
  if (i0 < 0) {
    // Too far ahead (or the forecast is missing): the usual weather of that month instead.
    const m = +nyHourKey(g.d).slice(5, 7) - 1, c = city?.climate?.[m];
    if (!c) return '';
    const far = g.d - Date.now() > 15 * 864e5;
    return `<section class="gwx"><h3>Vremea</h3><p>${far ? 'Prognoza apare cu cel mult 16 zile înainte de meci. ' : ''}De obicei în ${MONTHS[m]}, la ${esc(city.name)}: maxime de <b>${Math.round(c.hi)}°</b>, minime de <b>${Math.round(c.lo)}°</b> și ${c.wet} zile cu ploaie.${roof === 'closed' ? ` Meciul e sub acoperiș, la ${link}.` : ` Stadion: ${link}.`}</p></section>`;
  }
  const n = Math.max(1, Math.round(durMin / 60)), idx = [];
  for (let i = i0; i < Math.min(hrs.time.length, i0 + n + 1); i++) idx.push(i);
  const at = i => ({ t: hrs.time[i], temp: hrs.temp[i], feels: hrs.feels[i], pp: hrs.pp[i], rain: hrs.rain[i], code: hrs.code[i], wind: hrs.wind[i], gust: hrs.gust[i] });
  const H = idx.map(at), s = H[0];
  const ppMax = Math.max(...H.map(h => h.pp ?? 0)), gust = Math.max(...H.map(h => h.gust ?? 0)), storm = H.some(h => isStorm(h.code)), feels = Math.max(...H.map(h => h.feels ?? -99));
  const day = +s.t.slice(11, 13) >= 7 && +s.t.slice(11, 13) < 19;
  if (roof === 'closed' || roof === 'retractable') {
    const where = roof === 'retractable' ? `Stadionul ${link} are acoperiș retractabil, care se închide dacă plouă sau e foarte cald, deci meciul se joacă oricum.`
      : `Meciul e ${v.kind === 'arena' ? 'în sală' : 'sub acoperiș'}, la ${link}, deci vremea nu contează pentru joc.`;
    return `<section class="gwx"><h3>Vremea</h3><div class="gwxrow">${wxIcon(s.code, day, 40)}<p>${where} Afară, la ora de start: <b>${Math.round(s.temp)}°</b>, ${esc(wxText(s.code).toLowerCase())}${s.pp >= 30 ? `, șanse de ploaie ${s.pp}%` : ''}.</p></div></section>`;
  }
  const notes = [];
  if (storm) notes.push(['warn', 'Risc de furtună cu fulgere. În aer liber, jocul se întrerupe când sunt fulgere în apropiere și se reia după cel puțin 30 de minute fără descărcări.']);
  else if (ppMax >= 60) notes.push(['rain', `Ploaie probabilă în timpul meciului (până la ${ppMax}%).`]);
  else if (ppMax >= 30) notes.push(['rain', `Se poate să plouă puțin (până la ${ppMax}%).`]);
  if (feels >= 32) notes.push(['hot', `Cald și umed: temperatura resimțită ajunge la ${Math.round(feels)}°.`]);
  if (gust >= 45) notes.push(['wind', `Vânt puternic, cu rafale de până la ${gust} km/h${g.l === 'NFL' ? ': contează la pasele lungi și la field goal-uri' : ''}.`]);
  if (!notes.length) notes.push(['ok', g.l === 'NFL' ? 'Vreme bună de fotbal american.' : 'Vreme bună de fotbal.']);
  if (roof === 'canopy') notes.push(['info', 'Tribunele sunt acoperite de copertină; terenul nu.']);
  return `<section class="gwx"><h3>Vremea la meci <small>prognoză Open-Meteo, ${link}</small></h3>
    <div class="gwxtop">${wxIcon(s.code, day, 48)}<div><div class="t">${Math.round(s.temp)}°</div><div class="c">${esc(wxText(s.code))} la ora de start</div></div>
      <dl><dt>Se simte ca</dt><dd>${Math.round(s.feels)}°</dd><dt>Ploaie</dt><dd>${ppMax}%</dd><dt>Vânt</dt><dd>${s.wind} km/h${gust > s.wind + 10 ? `, rafale ${gust}` : ''}</dd></dl></div>
    <div class="gwxhours">${H.map(h => `<div><small>${esc(hm(h.t))}</small>${wxIcon(h.code, +h.t.slice(11, 13) >= 7 && +h.t.slice(11, 13) < 19, 26)}<b>${Math.round(h.temp)}°</b><small class="${h.pp >= 50 ? 'wet' : ''}">${h.pp ?? 0}%</small></div>`).join('')}</div>
    <ul class="wxnotes">${notes.map(([k, t]) => `<li class="${k}">${esc(t)}</li>`).join('')}</ul>
    <div class="fn">Orele sunt cele locale. Prognoza se actualizează la 30 de minute.</div></section>`;
}

/* ================= weather strip (home page) ================= */
export const STRIP = ['miami', 'tampa', 'orlando', 'jacksonville'];   // one city per metro area
// `cities`: the city records to show (default: the Florida strip).
export function stripHtml(list, cities) {
  const C = PLACES.data?.cities;
  const L = cities || (C ? STRIP.map(id => C[id]) : []);
  if (!L.length) return '';
  return L.map((c, i) => {
    const id = c.id, w = list?.[i], n = w?.now, d = w?.days?.[0];
    return `<button class="wxtile" type="button" data-city="${id}"><span class="nm">${esc(c.name)}</span>${n ? `${wxIcon(n.code, n.day, 34)}<span class="tt">${Math.round(n.temp)}°</span><span class="cc">${esc(wxText(n.code))}</span>${d ? `<span class="dd">${Math.round(d.lo)}° – ${Math.round(d.hi)}°${d.pp >= 20 ? ` · ploaie ${d.pp}%` : ''}</span>` : ''}` : '<span class="cc">…</span>'}</button>`;
  }).join('');
}

/* ================= climate chart ================= */
// Two small charts, one measure each (never two scales on one chart): monthly temperature range,
// then monthly rain. The current month is outlined. Hover or tap a month for its numbers.
export function climateHtml(c) {
  const cl = c.climate; if (!cl?.length) return '';
  const cur = new Date().getMonth();
  const W = 600, L = 46, R = 594, step = (R - L) / 12, bw = step * 0.56;
  const tmin = Math.floor(Math.min(...cl.map(x => x.lo)) / 5) * 5, tmax = Math.ceil(Math.max(...cl.map(x => x.hi)) / 5) * 5;
  const T1 = 10, B1 = 150, y = v => B1 - (v - tmin) / (tmax - tmin) * (B1 - T1);
  const rmax = Math.ceil(Math.max(...cl.map(x => x.rain)) / 50) * 50, T2 = 10, B2 = 110, yr = v => B2 - v / rmax * (B2 - T2);
  const xs = i => L + step * i + (step - bw) / 2;
  let grid = '';
  for (let t = tmin; t <= tmax; t += 5) grid += `<line class="gl" x1="${L}" x2="${R}" y1="${y(t)}" y2="${y(t)}"/><text class="ax" x="${L - 6}" y="${y(t) + 4}" text-anchor="end">${t}°</text>`;
  let rgrid = '';
  for (let r = 0; r <= rmax; r += rmax > 150 ? 100 : 50) rgrid += `<line class="gl" x1="${L}" x2="${R}" y1="${yr(r)}" y2="${yr(r)}"/><text class="ax" x="${L - 6}" y="${yr(r) + 4}" text-anchor="end">${r}</text>`;
  const months = cl.map((_, i) => `<text class="mo${i === cur ? ' on' : ''}" x="${xs(i) + bw / 2}" y="16" text-anchor="middle">${MON[i].replace('.', '')}</text>`).join('');
  const tb = cl.map((x, i) => `<rect class="tb${i === cur ? ' on' : ''}" x="${xs(i)}" y="${y(x.hi)}" width="${bw}" height="${Math.max(3, y(x.lo) - y(x.hi))}" rx="4"/>`).join('');
  const rb = cl.map((x, i) => `<rect class="rb${i === cur ? ' on' : ''}" x="${xs(i)}" y="${yr(x.rain)}" width="${bw}" height="${Math.max(2, B2 - yr(x.rain))}" rx="4"/>`).join('');
  const hits = cl.map((_, i) => `<rect class="hit" data-m="${i}" x="${L + step * i}" y="0" width="${step}" height="100%"/>`).join('');
  const data = esc(JSON.stringify(cl));
  const wettest = cl.reduce((a, x, i) => (x.rain > cl[a].rain ? i : a), 0), driest = cl.reduce((a, x, i) => (x.rain < cl[a].rain ? i : a), 0);
  return `<section><h3>Clima pe luni</h3>
    <div class="clim" data-clim="${data}">
      <div class="clh">Temperatura: maxima și minima medie, °C</div>
      <svg class="cl" viewBox="0 0 ${W} 160" role="img" aria-label="Temperaturi medii la ${esc(c.name)}: de la ${Math.round(Math.min(...cl.map(x => x.lo)))}° minima în ${MONTHS[cl.reduce((a, x, i) => (x.lo < cl[a].lo ? i : a), 0)]} la ${Math.round(Math.max(...cl.map(x => x.hi)))}° maxima în ${MONTHS[cl.reduce((a, x, i) => (x.hi > cl[a].hi ? i : a), 0)]}.">${grid}${tb}${hits}</svg>
      <div class="clh">Ploaia: milimetri pe lună</div>
      <svg class="cl" viewBox="0 0 ${W} 120" role="img" aria-label="Ploaie medie la ${esc(c.name)}: cea mai ploioasă lună e ${MONTHS[wettest]} (${cl[wettest].rain} mm), cea mai uscată ${MONTHS[driest]} (${cl[driest].rain} mm).">${rgrid}<rect class="hurr" x="${L + step * 5}" y="${T2}" width="${step * 6}" height="${B2 - T2}"/>${rb}${hits}</svg>
      <svg class="cl months" viewBox="0 0 ${W} 22" aria-hidden="true">${months}</svg>
      <div class="cltip" hidden></div>
    </div>
    <div class="fn">Medii 2016–2025, Open-Meteo. Zona umbrită e sezonul uraganelor (1 iunie – 30 noiembrie). Luna curentă e evidențiată. Sezonul ploios, cu furtuni scurte după-amiaza, ține de obicei din mai până în octombrie.</div>
    <details class="cltable"><summary>Vezi valorile</summary><div class="scroll"><table class="box"><thead><tr><th scope="col">Luna</th><th scope="col">Max.</th><th scope="col">Min.</th><th scope="col">Ploaie</th><th scope="col">Zile cu ploaie</th></tr></thead><tbody>${cl.map((x, i) => `<tr><th scope="row">${MONTHS[i]}</th><td>${x.hi}°</td><td>${x.lo}°</td><td>${x.rain} mm</td><td>${x.wet}</td></tr>`).join('')}</tbody></table></div></details></section>`;
}
export function climateHover(e) {
  const box = e.target.closest && e.target.closest('.clim');
  if (!box) return;
  const tip = box.querySelector('.cltip');
  box.querySelectorAll('.hov').forEach(x => x.classList.remove('hov'));
  const hit = e.type !== 'pointerleave' && e.target.closest('rect.hit');
  if (!hit) { tip.hidden = true; return; }
  const i = +hit.dataset.m, x = JSON.parse(box.dataset.clim)[i];
  box.querySelectorAll('svg.cl').forEach(s => { const bars = s.querySelectorAll('.tb,.rb'); if (bars[i]) bars[i].classList.add('hov'); });
  tip.innerHTML = `<b>${MONTHS[i]}</b><span>max. ${x.hi}° · min. ${x.lo}°</span><span>${x.rain} mm ploaie · ${x.wet} zile cu ploaie</span>`;
  tip.hidden = false;
  const r = box.getBoundingClientRect(), hr = hit.getBoundingClientRect();
  const left = hr.left - r.left + hr.width / 2;
  tip.style.left = Math.max(0, Math.min(r.width - tip.offsetWidth, left - tip.offsetWidth / 2)) + 'px';
}

/* ================= shared bits ================= */
function photo(img, alt) {
  if (!img) return '';
  return `<figure class="hero-ph"><img src="${esc(img.big)}" srcset="${esc(img.small)} 500w, ${esc(img.big)} 1280w" sizes="(max-width: 640px) 100vw, 640px" alt="${esc(alt)}" loading="eager" decoding="async"><figcaption>Foto: ${esc(img.author)}, <a href="${esc(img.page)}" target="_blank" rel="noopener">${esc(img.license || 'Wikimedia Commons')}</a></figcaption></figure>`;
}
const ROOF = { closed: 'Acoperiș fix (se joacă în sală)', open: 'Deschis', canopy: 'Deschis, cu copertină peste tribune', retractable: 'Retractabil: se închide la ploaie sau căldură mare' };
// Short words for a card: "arenă", "stadion acoperit", "acoperiș retractabil", "aer liber".
export const roofWord = v => (v.roof === 'closed' ? (v.kind === 'arena' ? 'arenă' : 'stadion acoperit') : v.roof === 'retractable' ? 'acoperiș retractabil' : v.roof === 'canopy' ? 'stadion cu copertină' : 'stadion în aer liber');
function sourcesHtml(list) {
  return `<details class="srcs"><summary>Surse</summary><ul>${list.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join('')}</ul></details>`;
}
const venueCard = (v, ctx) => `<button class="vcard" type="button" data-venue="${esc(v.id)}">${v.image ? `<img src="${esc(v.image.small)}" alt="" loading="lazy" decoding="async">` : ''}<span class="vb"><b>${esc(v.name)}</b><small>${v.teams.map(k => ctx.emb(k) + esc(TEAMS[k].s)).join(' · ')}</small><small>${num(v.capacity[0][1])} locuri · ${roofWord(v)}</small></span></button>`;
export const cityCard = c => `<button class="ccard" type="button" data-city="${esc(c.id)}">${c.image ? `<img src="${esc(c.image.small)}" alt="" loading="lazy" decoding="async">` : ''}<span><b>${esc(c.name)}</b><small>${esc(c.summary)}</small></span></button>`;

/* ================= city page ================= */
export function cityHtml(c, ctx) {
  const P = PLACES.data, venues = Object.values(P.venues).filter(v => v.city === c.id);
  const teams = venues.flatMap(v => v.teams);
  const behind = hoursBehindRomania();
  const games = ctx.gamesAt(venues.map(v => v.id));
  const drive = Object.entries(c.drive || {}).sort((a, b) => a[1].min - b[1].min);
  return `<div class="band photo">${photo(c.image, c.name)}<div class="bandtxt"><div class="lgn">Oraș · Florida · comitatul ${esc(c.county)}</div><h2 id="prof-name">${esc(c.name)}</h2></div>
      <button class="x" type="button" id="prof-x" aria-label="Închide">×</button></div>
    <div class="pbody">
    <p class="lead">${esc(c.summary)}</p>
    <div class="stats">
      <div class="stat"><div class="v" id="flclock">${floridaClock()}</div><div class="l">Ora acum în ${esc(c.name)}, cu ${behind} ore în urma României</div></div>
      <div class="stat"><div class="v">${num(c.pop)}</div><div class="l">locuitori (recensământul din 2020)</div></div>
      <div class="stat"><div class="v">${esc(c.airport.code)}</div><div class="l">${esc(c.airport.name)}</div></div>
    </div>
    <section><h3>Vremea acum</h3><div id="pwx"><div class="skeleton" style="height:120px"></div></div></section>
    ${climateHtml(c)}
    ${teams.length ? `<section><h3>Echipe</h3><div class="mteams">${teams.map(k => `<button type="button" data-team="${k}">${ctx.emb(k)}${esc(TEAMS[k].espn)}</button>`).join('')}</div></section>` : ''}
    ${venues.length ? `<section><h3>${venues.length === 1 ? 'Stadionul' : 'Stadioanele'}</h3><div class="vcards">${venues.map(v => venueCard(v, ctx)).join('')}</div></section>` : ''}
    ${games.up.length ? `<section><h3>Următoarele meciuri aici</h3><div class="rows">${games.up.slice(0, 6).map(ctx.row).join('')}</div></section>` : ''}
    <section><h3>Despre oraș</h3>${c.about.map(p => `<p>${esc(p)}</p>`).join('')}${(c.tips || []).map(p => `<p class="tip">${esc(p)}</p>`).join('')}</section>
    ${drive.length ? `<section><h3>Cu mașina până la</h3><div class="rows">${drive.map(([id, d]) => `<button class="row" type="button" data-city="${esc(id)}"><span class="when">${d.km} km</span><span>${esc(P.cities[id].name)}</span><span class="r">${mins(d.min)}</span></button>`).join('')}</div><div class="fn">Distanțe și timpi fără trafic, calculați cu OSRM pe hărțile OpenStreetMap.</div></section>` : ''}
    <dl class="facts"><dt>Comitat</dt><dd>${esc(c.county)}</dd><dt>Oraș din</dt><dd>${esc(c.founded)}</dd><dt>Fus orar</dt><dd>ora Coastei de Est (America/New_York)</dd></dl>
    ${sourcesHtml(c.sources)}
    <div class="btns"><button class="ghost" type="button" data-share>Copiază linkul</button></div>
    </div>`;
}

/* ================= stadium page ================= */
export function venueHtml(v, ctx) {
  const c = cityOf(v), games = ctx.gamesAt([v.id]);
  const now = new Date().getFullYear();
  const names = v.names.slice().reverse();
  return `<div class="band photo">${photo(v.image, v.name)}<div class="bandtxt"><div class="lgn">${v.kind === 'arena' ? 'Arenă' : 'Stadion'} · <button class="linkish" type="button" data-city="${esc(v.city)}">${esc(c?.name || '')}</button></div><h2 id="prof-name">${esc(v.name)}</h2></div>
      <button class="x" type="button" id="prof-x" aria-label="Închide">×</button></div>
    <div class="pbody">
    <p class="lead">${esc(v.summary)}</p>
    <div class="stats">
      ${v.capacity.map(([k, n]) => `<div class="stat"><div class="v">${num(n)}</div><div class="l">locuri, ${esc(k)}</div></div>`).join('')}
      <div class="stat"><div class="v">${esc(v.opened)}</div><div class="l">deschis${+v.opened < now ? ` (acum ${now - +v.opened} ani)` : ''}</div></div>
      <div class="stat"><div class="v roof-${v.roof}">${v.roof === 'closed' ? (v.kind === 'arena' ? 'În sală' : 'Acoperit') : v.roof === 'canopy' ? 'Copertină' : v.roof === 'retractable' ? 'Retractabil' : 'Aer liber'}</div><div class="l">${esc(ROOF[v.roof])}</div></div>
    </div>
    <section><h3>Echipa gazdă</h3><div class="hosts">${v.teams.map(k => `<button class="host" type="button" data-team="${k}">${ctx.emb(k, 'lg')}<span><b>${esc(TEAMS[k].espn)}</b><small>${esc(TEAMS[k].l)}${ctx.homeRecord(k) ? ` · acasă în acest sezon: ${esc(ctx.homeRecord(k))}` : ''}</small></span></button>`).join('')}</div></section>
    <section><h3>${v.roof === 'closed' ? 'Vremea afară' : 'Vremea'}</h3><div id="pwx"><div class="skeleton" style="height:110px"></div></div></section>
    ${games.up.length ? `<section><h3>Meciuri programate aici</h3><div class="rows">${games.up.slice(0, 6).map(ctx.row).join('')}</div></section>` : ''}
    ${games.past.length ? `<section><h3>Ultimele rezultate aici</h3><div class="rows">${games.past.slice(0, 5).map(ctx.row).join('')}</div></section>` : ''}
    <section><h3>Despre ${v.kind === 'arena' ? 'arenă' : 'stadion'}</h3>${v.about.map(p => `<p>${esc(p)}</p>`).join('')}</section>
    ${v.moments?.length ? `<section><h3>De știut</h3><ul class="notes">${v.moments.map(m => `<li>${esc(m)}</li>`).join('')}</ul></section>` : ''}
    ${names.length > 1 ? `<section><h3>Numele de-a lungul timpului</h3><ol class="tline">${names.map(([n, a, b]) => `<li class="${b == null ? 'cur' : ''}"><span class="yr">${a}${b == null ? ' – azi' : b !== a ? '–' + b : ''}</span><span>${esc(n)}</span></li>`).join('')}</ol><div class="fn">Arenele și stadioanele americane își vând numele unor firme, de obicei pe 10–20 de ani.</div></section>` : ''}
    <dl class="facts"><dt>Adresă</dt><dd>${esc(v.address)} · <a href="https://www.openstreetmap.org/?mlat=${v.lat}&amp;mlon=${v.lon}#map=16/${v.lat}/${v.lon}" target="_blank" rel="noopener">hartă</a></dd>${v.owner ? `<dt>Proprietar</dt><dd>${esc(v.owner)}</dd>` : ''}${v.surface ? `<dt>Gazon</dt><dd>${esc(v.surface)}</dd>` : ''}<dt>Acoperiș</dt><dd>${esc(ROOF[v.roof])}</dd>${c ? `<dt>Aeroport</dt><dd>${esc(c.airport.name)} (${esc(c.airport.code)})</dd>` : ''}</dl>
    ${sourcesHtml(v.sources)}
    <div class="btns">${c ? `<button class="ghost" type="button" data-city="${esc(c.id)}">Despre ${esc(c.name)}</button>` : ''}<button class="ghost" type="button" data-share>Copiază linkul</button></div>
    </div>`;
}
/* ================= the rest of America: plain facts ================= */
// Big metropolitan areas: the main city's page also shows the stadiums and teams of the towns around it
// (New York: 11 teams, not only the 2 of Madison Square Garden). Ids of data/america.json; written by hand.
// `image`: a photo of the city (Wikimedia Commons) when the data file has none.
export const AREAS = {
  'new-york-ny': { name: 'New York', with: ['brooklyn-ny', 'new-york-city-ny', 'bronx-ny', 'queens-ny', 'elmont-ny', 'newark-nj', 'harrison-nj', 'east-rutherford-nj'],
    image: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Midtown_Manhattan_from_Jersey_City_September_2020_HDR.jpg/1280px-Midtown_Manhattan_from_Jersey_City_September_2020_HDR.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Midtown_Manhattan_from_Jersey_City_September_2020_HDR.jpg', author: 'King of Hearts', license: 'CC BY-SA 4.0' } },
  'los-angeles-ca': { name: 'Los Angeles', with: ['inglewood-ca', 'anaheim-ca', 'carson-ca'] },
  'san-francisco-ca': { name: 'San Francisco', with: ['santa-clara-ca', 'san-jose-ca'] },
  'dallas-tx': { name: 'Dallas', with: ['arlington-tx', 'frisco-tx'] },
  'washington-dc': { name: 'Washington', with: ['washington-d-c-dc', 'landover-md'] },
  'boston-ma': { name: 'Boston', with: ['foxborough-ma'] },
  'philadelphia-pa': { name: 'Philadelphia', with: ['chester-pa'] },
  'phoenix-az': { name: 'Phoenix', with: ['glendale-az'] },
  'denver-co': { name: 'Denver', with: ['commerce-city-co'] },
  'kansas-city-mo': { name: 'Kansas City', with: ['kansas-city-ks'] },
  'minneapolis-mn': { name: 'Minneapolis', with: ['saint-paul-mn'] },
  'salt-lake-city-ut': { name: 'Salt Lake City', with: ['sandy-ut'] },
  'buffalo-ny': { name: 'Buffalo', with: ['orchard-park-ny'] }
};
// The metro area a town belongs to (its main city's id), or null.
export const metroOf = id => AREAS[id] ? id : Object.keys(AREAS).find(k => AREAS[k].with.includes(id)) || null;
// Every stadium of a city page: its own, plus the metro area's when it is the main city (each once).
function cityVenueIds(c) {
  const ids = [...c.venues];
  for (const t of AREAS[c.id]?.with || []) for (const v of AMERICA.data.cities[t]?.venues || []) if (!ids.includes(v)) ids.push(v);
  return ids;
}
const TZ_RO = { 'America/New_York': 'ora Coastei de Est', 'America/Toronto': 'ora Coastei de Est', 'America/Detroit': 'ora Coastei de Est', 'America/Chicago': 'ora Centrală', 'America/Winnipeg': 'ora Centrală', 'America/Denver': 'ora Munților Stâncoși', 'America/Edmonton': 'ora Munților Stâncoși', 'America/Phoenix': 'ora Munților Stâncoși (fără ora de vară)', 'America/Los_Angeles': 'ora Pacificului', 'America/Vancouver': 'ora Pacificului', 'America/Indiana/Indianapolis': 'ora Coastei de Est', 'America/Boise': 'ora Munților Stâncoși' };
const litePhoto = (v, alt) => v.photo ? `<figure class="hero-ph"><img src="${esc(v.photo)}" alt="${esc(alt)}" loading="eager" decoding="async"><figcaption>Foto: ESPN</figcaption></figure>`
  : v.credit ? `<figure class="hero-ph"><img src="${esc(v.credit.url)}" alt="${esc(alt)}" loading="eager" decoding="async"><figcaption>Foto: ${esc(v.credit.author || '')}, <a href="${esc(v.credit.page)}" target="_blank" rel="noopener">${esc(v.credit.license || 'Wikimedia Commons')}</a></figcaption></figure>` : '';
const clubBtn = (t, ctx) => `<button class="host" type="button" data-club="${esc(t.l)}|${esc(t.id)}">${ctx.clubEmb(t)}<span><b>${esc(t.name)}</b><small>${esc(t.l)}${ctx.clubRecord(t) ? ' · ' + esc(ctx.clubRecord(t)) : ''}</small></span></button>`;
export function cityLiteHtml(c, ctx) {
  const A = AMERICA.data, M = AREAS[c.id], area = metroOf(c.id), ids = cityVenueIds(c);
  const venues = ids.map(id => A.venues[id]).filter(Boolean);
  const behind = hoursBehindRomania(new Date(), c.tz);
  const img = c.image ? { photo: '', credit: c.image } : M?.image ? { photo: '', credit: M.image } : venues.find(v => v.photo) || { };
  const games = ctx.gamesAt(ids);
  // Each team once (two venue entries can list the same one), in league order.
  const seen = new Set(), teams = venues.flatMap(v => v.teams).filter(t => !seen.has(t.l + t.id) && seen.add(t.l + t.id))
    .sort((a, b) => ['NBA', 'NHL', 'NFL', 'MLB', 'MLS'].indexOf(a.l) - ['NBA', 'NHL', 'NFL', 'MLB', 'MLS'].indexOf(b.l));
  // In a metro area, a stadium outside the main city says where it is.
  const town = v => M && v.city !== c.id && A.cities[v.city] && !A.cities[v.city].name.startsWith(c.name) ? ` · ${esc(A.cities[v.city].name)}` : '';
  const zone = M ? ` din zona ${esc(M.name)}` : '';
  return `<div class="band photo">${litePhoto(img, c.name)}<div class="bandtxt"><div class="lgn">Oraș · ${esc(c.state)} · ${esc(c.country)}</div><h2 id="prof-name">${esc(c.name)}</h2></div>
      <button class="x" type="button" id="prof-x" aria-label="Închide">×</button></div>
    <div class="pbody">
    <div class="stats">
      <div class="stat"><div class="v" id="flclock" data-tz="${esc(c.tz)}">${clockIn(c.tz)}</div><div class="l">Ora acum în ${esc(c.name)}, cu ${behind} ore în urma României</div></div>
      ${c.pop ? `<div class="stat"><div class="v">${num(c.pop)}</div><div class="l">locuitori</div></div>` : ''}
      ${M ? `<div class="stat"><div class="v">${teams.length}</div><div class="l">echipe în zona ${esc(M.name)}</div></div>` : ''}
      <div class="stat"><div class="v" style="font-size:17px">${esc(TZ_RO[c.tz] || c.tz)}</div><div class="l">fusul orar</div></div>
    </div>
    ${area && !M ? `<div class="fn">${esc(c.name)} face parte din zona ${esc(AREAS[area].name)}. <button class="linkish" type="button" data-city="${esc(area)}">Toate echipele din zona ${esc(AREAS[area].name)}</button></div>` : ''}
    <section><h3>Vremea acum</h3><div id="pwx"><div class="skeleton" style="height:120px"></div></div></section>
    <section><h3>Echipe${zone}</h3><div class="hosts">${teams.map(t => clubBtn(t, ctx)).join('')}</div></section>
    <section><h3>${venues.length === 1 ? 'Stadionul' : 'Stadioanele'}${zone}</h3><div class="vcards">${venues.map(v => `<button class="vcard" type="button" data-venue="${esc(v.id)}">${v.photo || v.credit ? `<img src="${esc(v.photo || v.credit.url)}" alt="" loading="lazy">` : ''}<span class="vb"><b>${esc(v.name)}</b><small>${v.teams.map(t => esc(t.name)).join(' · ')}</small><small>${v.capacity ? num(v.capacity) + ' locuri · ' : ''}${roofWord(v)}${town(v)}</small></span></button>`).join('')}</div></section>
    ${games.up.length ? `<section><h3>Echipele tale joacă aici</h3><div class="rows">${games.up.slice(0, 6).map(ctx.row).join('')}</div></section>` : ''}
    <div class="fn">Oraș din afara Floridei: pagina are faptele de bază (ora, vremea, echipele), fără textele în română de la orașele din Florida.</div>
    <div class="btns"><button class="ghost" type="button" data-share>Copiază linkul</button></div>
    </div>`;
}
export function venueLiteHtml(v, ctx) {
  const c = cityOf(v), games = ctx.gamesAt([v.id]);
  const now = new Date().getFullYear();
  return `<div class="band photo">${litePhoto(v, v.name)}<div class="bandtxt"><div class="lgn">${v.kind === 'arena' ? 'Arenă' : 'Stadion'} · ${c ? `<button class="linkish" type="button" data-city="${esc(c.id)}">${esc(c.name)}</button>, ${esc(c.state)}` : ''}</div><h2 id="prof-name">${esc(v.name)}</h2></div>
      <button class="x" type="button" id="prof-x" aria-label="Închide">×</button></div>
    <div class="pbody">
    <div class="stats">
      ${v.capacity ? `<div class="stat"><div class="v">${num(v.capacity)}</div><div class="l">locuri</div></div>` : ''}
      ${v.opened ? `<div class="stat"><div class="v">${esc(v.opened)}</div><div class="l">deschis${+v.opened < now ? ` (acum ${now - +v.opened} ani)` : ''}</div></div>` : ''}
      <div class="stat"><div class="v roof-${v.roof}">${v.roof === 'closed' ? (v.kind === 'arena' ? 'În sală' : 'Acoperit') : v.roof === 'retractable' ? 'Retractabil' : 'Aer liber'}</div><div class="l">${esc(ROOF[v.roof] || '')}</div></div>
      ${c ? `<div class="stat"><div class="v" id="flclock" data-tz="${esc(c.tz)}">${clockIn(c.tz)}</div><div class="l">ora acum, cu ${hoursBehindRomania(new Date(), c.tz)} ore în urma României</div></div>` : ''}
    </div>
    <section><h3>${v.teams.length === 1 ? 'Echipa gazdă' : 'Echipele gazdă'}</h3><div class="hosts">${v.teams.map(t => clubBtn(t, ctx)).join('')}</div></section>
    <section><h3>${v.roof === 'closed' ? 'Vremea afară' : 'Vremea'}</h3><div id="pwx"><div class="skeleton" style="height:110px"></div></div></section>
    ${games.up.length ? `<section><h3>Echipele tale joacă aici</h3><div class="rows">${games.up.slice(0, 6).map(ctx.row).join('')}</div></section>` : ''}
    ${games.past.length ? `<section><h3>Ultimele meciuri ale echipelor tale aici</h3><div class="rows">${games.past.slice(0, 4).map(ctx.row).join('')}</div></section>` : ''}
    ${v.names?.length ? `<section><h3>Nume anterioare</h3><ol class="tline">${v.names.slice().reverse().map(([n, a, b]) => `<li><span class="yr">${a ?? ''}${b ? '–' + b : ''}</span><span>${esc(n)}</span></li>`).join('')}</ol></section>` : ''}
    <dl class="facts">${c ? `<dt>Oraș</dt><dd><button class="linkish" type="button" data-city="${esc(c.id)}">${esc(c.name)}</button>, ${esc(c.state)}, ${esc(c.country)}</dd>` : ''}${v.surface ? `<dt>Gazon</dt><dd>${esc(v.surface)}</dd>` : ''}<dt>Acoperiș</dt><dd>${esc(ROOF[v.roof] || '')}</dd><dt>Hartă</dt><dd><a href="https://www.openstreetmap.org/search?query=${encodeURIComponent(v.name + ', ' + (c?.name || ''))}" target="_blank" rel="noopener">OpenStreetMap</a></dd></dl>
    <div class="fn">Date: ESPN, Open-Meteo${v.opened || v.capacity ? ', American Sports Encyclopedia' : ''}.</div>
    <div class="btns">${c ? `<button class="ghost" type="button" data-city="${esc(c.id)}">Despre ${esc(c.name)}</button>` : ''}<button class="ghost" type="button" data-share>Copiază linkul</button></div>
    </div>`;
}

// The weather block of a city or stadium page, filled in when the forecast arrives.
export function placeWeatherHtml(w, v, next) {
  let html = nowHtml(w, v ? (v.roof === 'closed' ? 'Afară' : '') : '') + daysHtml(w);
  if (v && next && v.roof !== 'closed') html += `<div class="fn">Prognoza pentru următorul meci de aici e pe pagina meciului: <button class="linkish" type="button" data-game="${esc(next.id)}">${esc(next.label)}</button>.</div>`;
  return html || '<div class="fn">Prognoza nu e disponibilă acum.</div>';
}

// Builds data/clubs.json: the profile facts of every team in the five leagues (Florida included).
//   - "Despre": the opening of the team's Wikipedia article, in Romanian when ro.wikipedia has one,
//     otherwise in English (CC BY-SA 4.0, credited on the page);
//   - founded, first season, former names, legends, head coach (MLS), photo: the American Sports
//     Encyclopedia, when it has the team (pass its folder: node tools/build-clubs.mjs ../usa-places-explorer);
//     founded otherwise from Wikidata;
//   - titles: the encyclopedia's championships (NBA, NFL, MLB, MLS); Stanley Cups from the team's
//     Wikipedia infobox (the encyclopedia has no hockey).
// Run once in a while (new champions, a renamed team): node tools/build-clubs.mjs
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { LEAGUES, norm } from '../js/teams.js';

const ENC = process.argv[2] || 'C:/Users/stroe/Desktop/usa-places-explorer';
const SITE = 'https://site.api.espn.com/apis/site/v2/sports/';
const UA = { 'user-agent': 'florida-games-calendar/1.0 (personal project; build script)', accept: 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Wikimedia asks for one request at a time and a pause when it says so (429 + Retry-After).
let lastWiki = 0;
async function get(url, tries = 6) {
  const wiki = /wiki(pedia|data)\.org/.test(url);
  for (let i = 1; ; i++) {
    try {
      if (wiki) { const w = lastWiki + 350 - Date.now(); if (w > 0) await sleep(w); lastWiki = Date.now(); }
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
      if (r.status === 429) throw Object.assign(new Error('429'), { wait: (+r.headers.get('retry-after') || 10) * 1000 + 500 });
      if (r.status === 404) return null;
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
const key = s => norm(s).replace(/[^a-z0-9]/g, '');
const val = x => (x && typeof x === 'object' && 'value' in x ? x.value : x);

// Wikidata ids of the leagues (P118 "league" on a team's item), to be sure a Wikipedia page is the team.
const LEAGUE_Q = { NBA: 'Q155223', NHL: 'Q1215892', NFL: 'Q1215884', MLB: 'Q1163715', MLS: 'Q18543' };
const SPORT_WORD = { NBA: 'basketball', NHL: 'ice hockey', NFL: 'American football', MLB: 'baseball', MLS: 'soccer' };
const TITLE = { NBA: 'titluri NBA', NFL: 'Super Bowl', MLB: 'World Series', MLS: 'MLS Cup', NHL: 'Cupa Stanley' };
// Champions under an old name, for the MLB teams the encyclopedia has no history of.
const OLD_NAMES = { 'philadelphia athletics': 'Athletics', 'oakland athletics': 'Athletics', 'cleveland indians': 'Cleveland Guardians', 'washington senators': 'Minnesota Twins', 'florida marlins': 'Miami Marlins', 'anaheim angels': 'Los Angeles Angels' };

// ---------- ESPN: every team ----------
const teams = [];
for (const l of Object.keys(LEAGUES)) {
  const j = await get(`${SITE}${LEAGUES[l].path}/teams`);
  for (const x of j.sports?.[0]?.leagues?.[0]?.teams || []) {
    const t = x.team;
    if (!/^tbd\b/i.test(t.displayName)) teams.push({ l, id: String(t.id), name: t.displayName });
  }
}
console.log(`ESPN: ${teams.length} teams`);
const byName = new Map(teams.map(t => [t.l + '|' + key(t.name), t]));

// ---------- the encyclopedia ----------
const D = join(ENC, 'src/data');
const enc = { fr: new Map(), people: new Map(), ids: [], champs: [] };
if (existsSync(join(D, 'franchises'))) {
  const read = dir => readdirSync(join(D, dir)).map(f => ({ slug: f.replace('.json', ''), ...JSON.parse(readFileSync(join(D, dir, f), 'utf8')) }));
  for (const f of read('franchises')) enc.fr.set(f.slug, f);
  for (const p of read('people')) enc.people.set(p.slug, p.name);
  enc.ids = read('team_identities');
  enc.champs = read('championships').filter(c => c.level === 'league');
  console.log(`encyclopedia: ${enc.fr.size} teams, ${enc.champs.length} titles, ${enc.ids.length} names`);
} else console.log('encyclopedia not found: only Wikipedia / Wikidata');

// Encyclopedia team -> ESPN team: by name, current or any of its names in the same league.
// ESPN's own name where it differs.
const ESPN_NAME = { 'los-angeles-fc': 'LAFC', 'new-york-red-bulls': 'Red Bull New York', 'vancouver-whitecaps-fc': 'Vancouver Whitecaps' };
const espnOf = new Map();   // franchise slug -> ESPN team
for (const [slug, f] of enc.fr) {
  const l = f.league.toUpperCase();
  const names = [f.name, ESPN_NAME[slug], ...enc.ids.filter(i => i.franchise === slug).map(i => i.name)].filter(Boolean);
  const t = names.map(n => byName.get(l + '|' + key(n))).find(Boolean);
  if (t) espnOf.set(slug, t); else console.log('  no ESPN team for', slug);
}
const slugOf = new Map([...espnOf].map(([s, t]) => [t.l + '-' + t.id, s]));

// Titles per ESPN team (years; counts when only the number is known).
const titles = new Map(), counts = new Map();
for (const c of enc.champs) {
  const l = c.league.toUpperCase();
  let t = c.winner ? espnOf.get(c.winner) : null;
  if (!t) t = byName.get(l + '|' + key(OLD_NAMES[norm(c.winnerName)] || c.winnerName));
  if (!t) { console.log('  title without a current team:', l, c.season, c.winnerName); continue; }
  // The year the title was won: NBA "2025-26" -> 2026, NFL season 2025 -> Super Bowl in 2026.
  const s = String(c.season);
  const year = /^\d{4}-\d{2}$/.test(s) ? +s.slice(0, 2) * 100 + +s.slice(5) + (+s.slice(5) < +s.slice(2, 4) ? 100 : 0) : l === 'NFL' ? +s + 1 : +s;
  const k = t.l + '-' + t.id;
  (titles.get(k) || titles.set(k, []).get(k)).push(year);
}

// ---------- Wikipedia / Wikidata ----------
async function enTitleFor(t) {
  const slug = slugOf.get(t.l + '-' + t.id), f = slug && enc.fr.get(slug);
  const src = f?.sources?.map(s => s.url).find(u => /en\.wikipedia\.org\/wiki\//.test(u));
  const cands = [];
  if (src) cands.push(decodeURIComponent(src.split('/wiki/')[1].split('#')[0]).replace(/_/g, ' '));
  cands.push(t.name);
  const tried = new Set();
  const check = async c => {
    if (tried.has(c)) return null; tried.add(c);
    const p = await get(`https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item&redirects=1&format=json&titles=${encodeURIComponent(c)}`);
    const page = Object.values(p?.query?.pages || {})[0];
    const q = page?.pageprops?.wikibase_item;
    if (!q) return null;
    const e = (await get(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims|sitelinks&sitefilter=rowiki|enwiki&ids=${q}`))?.entities?.[q];
    const leagues = (e?.claims?.P118 || []).map(c => c.mainsnak?.datavalue?.value?.id);
    return leagues.includes(LEAGUE_Q[t.l]) ? { en: page.title, q, e } : null;
  };
  for (const c of cands) { const r = await check(c); if (r) return r; }
  // Not found by name: search.
  const s = await get(`https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=4&srsearch=${encodeURIComponent(`${t.name} ${SPORT_WORD[t.l]} team`)}`);
  for (const x of s?.query?.search || []) { const r = await check(x.title); if (r) return r; }
  return null;
}
// The opening of the article: a few sentences, without the pronunciation brackets.
function shorten(text, max = 620) {
  const t = String(text || '').replace(/\s*\([^()]*(pronunț|pronounc|IPA|ascultă|listen)[^()]*\)/gi, '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max), end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.” '));
  return end > 200 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + '…';
}
async function stanleyCups(enTitle) {
  const j = await get(`https://en.wikipedia.org/w/api.php?action=parse&format=json&prop=wikitext&section=0&redirects=1&page=${encodeURIComponent(enTitle)}`);
  // The field can run over several lines (Montreal: 24 cups): read until the next "| field =".
  const lines = (j?.parse?.wikitext?.['*'] || '').split('\n');
  const i = lines.findIndex(x => /^\s*\|\s*stanley_cups\s*=/.test(x));
  if (i < 0) return null;
  let field = lines[i];
  for (let k = i + 1; k < lines.length && !/^\s*(\|\s*[\w' ]+\s*=|\}\})/.test(lines[k]); k++) field += ' ' + lines[k];
  field = field.replace(/<!--[\s\S]*?-->/g, '');
  const years = [...field.matchAll(/\[\[(\d{4}) Stanley Cup Final/g)].map(m => +m[1]);
  const n = +(field.match(/'''(\d+)'''/) || [])[1];
  if (!Number.isFinite(n)) return null;
  return { n, years: years.length === n ? years : [] };   // the count alone when the years do not add up
}

const out = {};
let done = 0;
await pool(teams, 1, async t => {
  const k = t.l + '-' + t.id, slug = slugOf.get(k), f = slug && enc.fr.get(slug);
  const rec = { name: t.name };
  try {
    const w = await enTitleFor(t);
    if (w) {
      const ro = w.e.sitelinks?.rowiki?.title;
      const sum = await get(ro ? `https://ro.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(ro.replace(/ /g, '_'))}` : `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(w.en.replace(/ /g, '_'))}`);
      if (sum?.extract) {
        rec.about = shorten(sum.extract);
        rec.wiki = { lang: ro ? 'ro' : 'en', title: ro || w.en, url: sum.content_urls?.desktop?.page || '' };
      }
      const inc = w.e.claims?.P571?.[0]?.mainsnak?.datavalue?.value?.time;
      if (inc) rec.founded = +inc.slice(1, 5);
      if (t.l === 'NHL') { const s = await stanleyCups(w.en); if (s) { titles.set(k, s.years); counts.set(k, s.n); } }
    } else console.log('  no Wikipedia page for', t.l, t.name);
  } catch (e) { console.log('  wiki error', t.l, t.name, e.message); }
  if (f) {
    if (val(f.founded)) rec.founded = +val(f.founded);
    if (val(f.firstSeason)) rec.first = String(val(f.firstSeason));
    if (f.headCoach?.name) rec.coach = { name: f.headCoach.name, asOf: f.headCoach.asOf || '' };
    const legends = (f.legends || []).map(p => enc.people.get(p)).filter(Boolean);
    if (legends.length) rec.legends = legends;
    const old = enc.ids.filter(i => i.franchise === slug && !i.current && key(i.name) !== key(t.name))
      .map(i => [i.name, val(i.from) ?? null, val(i.to) ?? null]).sort((a, b) => (a[1] || 0) - (b[1] || 0));
    if (old.length) rec.names = old;
    if (f.image?.url) rec.photo = { url: f.image.url.replace('/1280px-', '/960px-'), page: f.image.page, author: f.image.author, license: f.image.license, alt: f.image.alt || '' };
  }
  const y = titles.get(k);
  rec.titles = { what: TITLE[t.l], n: counts.get(k) ?? (y || []).length, years: (y || []).sort((a, b) => a - b), known: !!y || !!f };
  out[k] = rec;
  if (++done % 10 === 0) console.log(`  ${done}/${teams.length}`);
});

const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })));
writeFileSync(new URL('../data/clubs.json', import.meta.url), JSON.stringify({
  updated: new Date().toISOString().slice(0, 10),
  about: 'Generat de tools/build-clubs.mjs. Nu se editează de mână.',
  credits: 'Texte: Wikipedia (CC BY-SA 4.0). Fapte și poze: American Sports Encyclopedia (usa-places-explorer), Wikidata, Wikimedia Commons.',
  teams: sorted
}));
const v = Object.values(sorted);
console.log(`clubs.json: ${v.length} teams, ${v.filter(x => x.wiki?.lang === 'ro').length} with Romanian text, ${v.filter(x => x.wiki?.lang === 'en').length} English, ${v.filter(x => !x.about).length} none; ${v.filter(x => x.photo).length} photos`);
for (const [k, x] of Object.entries(sorted)) if (x.titles.n >= 5 || ['NBA-2', 'NHL-1', 'NHL-10', 'MLB-10', 'MLB-19', 'MLB-26', 'NFL-26', 'MLS-187'].includes(k)) console.log(`  ${k} ${x.name}: ${x.titles.n} ${x.titles.what}`);

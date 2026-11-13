// "În lume și evenimente": the games played outside the US and Canada (Europe first) and the big days of the
// season (Thanksgiving, Christmas, Super Bowl, All-Star, outdoor games), found in ESPN's scoreboards, not
// written by hand: nothing to keep up to date. The selection is pure (tested offline); `worldGames` reads ESPN.
import { LEAGUES } from '../../js/teams.js';
import { getJSON, normalizeEvent } from './espn.mjs';

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/';
// ESPN venue countries in Europe (it writes England, Scotland… for the UK).
export const EUROPE = new Set(['england', 'scotland', 'wales', 'northern ireland', 'united kingdom', 'uk', 'great britain', 'ireland', 'germany',
  'spain', 'france', 'italy', 'sweden', 'finland', 'norway', 'denmark', 'czechia', 'czech republic', 'switzerland', 'austria', 'netherlands',
  'belgium', 'portugal', 'poland', 'hungary', 'slovakia', 'latvia', 'romania']);
const HOME = new Set(['usa', 'united states', 'us', 'canada', '']);
// Named special games: ESPN writes them in the event's note or name.
export const SPECIAL = /super bowl|all-star|all star|winter classic|stadium series|heritage classic|global series|nba cup final|emirates nba cup|mls cup|world series|stanley cup final|nba finals|thanksgiving|christmas/i;

// The US dates (New York) of Thanksgiving (4th Thursday of November) and Christmas for a year.
export function bigDays(year) {
  const first = new Date(Date.UTC(year, 10, 1)).getUTCDay();   // 0 = Sunday
  const thu = 1 + ((4 - first + 7) % 7) + 21;
  return { thanksgiving: `${year}-11-${String(thu).padStart(2, '0')}`, christmas: `${year}-12-25` };
}
const usDay = iso => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(iso));

// From raw ESPN events (each { ev, l }): the games abroad and the events, from `now` on (a day back).
export function selectWorld(raw, now = Date.now()) {
  const from = now - 864e5, seen = new Set(), abroad = [], special = [], days = {};
  const years = [new Date(now).getUTCFullYear(), new Date(now).getUTCFullYear() + 1];
  const big = Object.fromEntries(years.flatMap(y => Object.entries(bigDays(y)).map(([k, d]) => [d, k])));
  for (const { ev, l } of raw) {
    if (!ev?.id || seen.has(l + ev.id)) continue;
    seen.add(l + ev.id);
    const g = normalizeEvent(ev, l);
    if (!g || new Date(g.date).getTime() < from) continue;
    const country = String(ev.competitions?.[0]?.venue?.address?.country || '').trim();
    const c = country.toLowerCase();
    if (!HOME.has(c)) { abroad.push({ ...g, country, europe: EUROPE.has(c) }); continue; }   // listed apart, not again as an event
    const name = `${g.note} ${ev.name || ''}`;
    if (SPECIAL.test(g.note) || /all-star|all star/i.test(ev.name || '')) special.push({ ...g, special: (SPECIAL.exec(g.note) || /all-?star/i.exec(name))?.[0] || '' });
    const d = usDay(g.date), k = big[d];
    if (k && (l === 'NFL' || (k === 'christmas' && l === 'NBA'))) (days[k + '|' + d] ||= []).push(g);
  }
  const t = g => new Date(g.date).getTime();
  const events = [
    ...Object.entries(days).map(([kd, games]) => { const [kind, day] = kd.split('|'); return { kind, day, games: games.sort((a, b) => t(a) - t(b)) }; }),
    ...special.filter(g => !Object.values(days).flat().some(x => x.id === g.id)).map(g => ({ kind: 'special', day: usDay(g.date), title: g.note || g.special, games: [g] }))
  ].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  return { abroad: abroad.sort((a, b) => t(a) - t(b)), events };
}

// The months to read: this one and the next `n`.
export function monthsFrom(now, n) {
  const d = new Date(now), out = [];
  for (let i = 0; i <= n; i++) { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + i, 1)); out.push(`${x.getUTCFullYear()}${String(x.getUTCMonth() + 1).padStart(2, '0')}`); }
  return out;
}
// Every league's scoreboard, month by month, for the next four months (about 25 requests, cached a day).
export async function worldGames(now = Date.now(), errors = []) {
  const months = monthsFrom(now, 4);
  const lists = await Promise.all(Object.keys(LEAGUES).flatMap(l => months.map(ym =>
    getJSON(`${SITE}${LEAGUES[l].path}/scoreboard?dates=${ym}&limit=400`, 9000)
      .then(j => (j.events || []).map(ev => ({ ev, l })), e => { errors.push(`${l} ${ym}: ${e.message || e}`); return []; }))));
  return { updated: new Date(now).toISOString(), ...selectWorld(lists.flat(), now), errors };
}

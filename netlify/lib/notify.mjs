// Which notifications a subscriber is due, and their Romanian text. Pure functions: tested offline.
// A subscription: { id, endpoint, keys, teams: ['heat', 'NBA-2'], lead: 60 (minutes, 0 = none), final: true,
//                   morning: true (absent = true), night: false (the morning summary also tells the whole night),
//                   morningDay: '2026-11-12' (last morning summary, Romanian date),
//                   created (ms), sent: { [gameId]: { p: ms, f: ms } } }
import { LEAGUES, ALL_TEAMS as TEAMS, sideIn } from '../../js/teams.js';
import { detailRo } from '../../js/ro.js';

const SPORT = { NBA: '🏀', NHL: '🏒', NFL: '🏈', MLS: '⚽', MLB: '⚾' };
const fmtRO = new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', hour: '2-digit', minute: '2-digit', hour12: false });
const short = s => (s.key && TEAMS[s.key] ? TEAMS[s.key].s : s.name || '');
export const LEADS = [0, 15, 30, 60, 120, 180];

// "în 10 minute", "în 30 de minute", "într-o oră", "în 2 ore"
export function inTime(min) {
  if (min < 1) return 'acum';
  if (min < 60) return `în ${min}${min >= 20 ? ' de' : ''} minute`;
  const h = Math.round(min / 60);
  return h === 1 ? 'într-o oră' : `în ${h} ore`;
}

export function preMessage(g, min, site) {
  return {
    title: `${SPORT[g.l] || ''} ${short(g.home)} – ${short(g.away)} ${inTime(min)}`.trim(),
    body: [`Start la ${fmtRO.format(new Date(g.date))}, ora României`, g.venue, g.tv ? 'TV SUA: ' + g.tv : ''].filter(Boolean).join(' · '),
    url: `${site}/#meci/${g.l}/${g.id}`, tag: `pre-${g.id}`
  };
}
export function finalMessage(g, teams, site) {
  const hs = g.home.score ?? 0, as = g.away.score ?? 0;
  const want = new Set(teams), mine = [g.home, g.away].find(s => sideIn(want, g.l, s));
  let verdict = '';
  if (mine) {
    const my = mine === g.home ? hs : as, their = mine === g.home ? as : hs;
    verdict = my > their ? `Victorie pentru ${short(mine)}` : my < their ? `Înfrângere pentru ${short(mine)}` : 'Egal';
  }
  const how = detailRo(g.detail, g.l);
  return {
    title: `Final: ${short(g.home)} ${hs}–${as} ${short(g.away)}`,
    body: [verdict, how && how !== 'Final' ? how.replace(/^Final /, '') : '', g.l].filter(Boolean).join(' · '),
    url: `${site}/#meci/${g.l}/${g.id}`, tag: `final-${g.id}`
  };
}

// The morning summary: at 8:00 Romanian time (the first run after it, until noon), the results of the
// night: the games of the subscriber's teams that started in the last 24 hours and are over.
export const MORNING = { from: 8, to: 12 };
const roParts = now => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(now)).map(x => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hour: +p.hour };
};
// "Heat 112–104 Celtics ✓": the mark is for the subscriber's team (none when both teams are theirs).
const resultLine = (g, want) => {
  const hs = g.home.score ?? 0, as = g.away.score ?? 0;
  const mine = [g.home, g.away].filter(s => sideIn(want, g.l, s));
  let mark = '';
  if (mine.length === 1) { const my = mine[0] === g.home ? hs : as, th = mine[0] === g.home ? as : hs; mark = my > th ? ' ✓' : my < th ? ' ✗' : ' ='; }
  return `${short(g.home)} ${hs}–${as} ${short(g.away)}${mark}`;
};
// The whole night (subscribers who tick "toată noaptea"): every finished game of every league. The most
// gripping ones (overtime, a close score) are named; the notification opens the day's scores.
const TWO = /\s(Trail Blazers|Maple Leafs|Golden Knights|Red Wings|Blue Jackets|Red Sox|White Sox|Blue Jays)$/;
const nick = s => (s.key && TEAMS[s.key] ? TEAMS[s.key].s : (TWO.exec(s.name || '')?.[1] || String(s.name || '').split(' ').pop()));
const extraTime = g => /OT|SO|\/\d+/.test(g.detail || '');
const CLOSE = { NBA: 5, NFL: 7 };
export function nightPicks(night, n = 3) {
  const margin = g => Math.abs((g.home.score ?? 0) - (g.away.score ?? 0));
  const grip = g => (extraTime(g) ? 2 : 0) + (margin(g) <= (CLOSE[g.l] || 1) ? 2 : 0);
  return night.slice().sort((a, b) => grip(b) - grip(a) || margin(a) / (CLOSE[a.l] || 1) - margin(b) / (CLOSE[b.l] || 1)).slice(0, n);
}
const nightLine = g => `${nick(g.home)} ${g.home.score ?? 0}–${g.away.score ?? 0} ${nick(g.away)}${extraTime(g) ? ' (prel.)' : ''}`;
// The US date of the night's games (New York), for the link to that day's scores.
const usDate = g => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(g.date));

export function morningMessage(results, next, teams, site, night = null) {
  const want = new Set(teams), lines = results.map(g => resultLine(g, want));
  const nextLine = next ? `Urmează: ${short(next.home)} – ${short(next.away)}, ${fmtRO.format(new Date(next.date))}` : '';
  if (night?.length) {
    const ids = new Set(results.map(g => g.id)), picks = nightPicks(night.filter(g => !ids.has(g.id)));
    const leagues = [...new Set(night.map(g => g.l))].join(', ');
    const url = `${site}/#ligi/scoruri/${usDate(night[0])}`;
    if (!results.length) return { title: `☀️ Azi-noapte: ${night.length} meciuri în ${leagues}`, body: [...picks.map(nightLine), nextLine].filter(Boolean).join('\n'), url, tag: 'morning' };
    return {
      title: results.length === 1 ? `☀️ Azi-noapte: ${lines[0]}` : `☀️ Azi-noapte: ${results.length} meciuri ale echipelor tale`,
      body: [...(results.length === 1 ? [] : lines), `Toată noaptea: ${night.length} meciuri${picks.length ? ' · ' + picks.map(nightLine).join(' · ') : ''}`, nextLine].filter(Boolean).join('\n'),
      url, tag: 'morning'
    };
  }
  return {
    title: results.length === 1 ? `☀️ Azi-noapte: ${lines[0]}` : `☀️ Azi-noapte: ${results.length} meciuri ale echipelor tale`,
    body: [...(results.length === 1 ? [] : lines), nextLine].filter(Boolean).join('\n'),
    url: site + '/', tag: 'morning'
  };
}
// The Romanian date when a morning summary may go out now (8:00–12:00), else null.
export function morningWindow(now) {
  const { day, hour } = roParts(now);
  return hour >= MORNING.from && hour < MORNING.to ? day : null;
}
// `night`: every game of the night in all leagues (only fetched when a subscriber wants it), or null.
export function morningDue(sub, games, now, site, night = null) {
  if (sub.morning === false) return null;
  const day = morningWindow(now);
  if (!day || sub.morningDay === day) return null;
  const want = new Set(sub.teams || []);
  const mine = games.filter(g => sideIn(want, g.l, g.home) || sideIn(want, g.l, g.away));
  const t = g => new Date(g.date).getTime();
  const recent = g => g.state === 'post' && t(g) < now && now - t(g) < 24 * 36e5;
  const results = mine.filter(recent).sort((a, b) => t(a) - t(b));
  const all = sub.night ? (night || []).filter(recent) : [];
  if (!results.length && !all.length) return null;
  const next = mine.filter(g => g.state === 'pre' && !g.tbd && t(g) > now && t(g) - now < 24 * 36e5).sort((a, b) => t(a) - t(b))[0];
  return { kind: 'm', day, game: null, message: morningMessage(results, next, [...want], site, all) };
}

// The week's summary: on Sunday evening (19:00–23:00 Romanian time, once), each of the subscriber's teams with
// its week (wins and losses, ✓ ✗ in order) and what comes next week. `weekly: false` turns it off.
export const WEEKLY = { from: 19, to: 23 };
export function weeklyWindow(now) {
  const { day, hour } = roParts(now);
  const dow = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Bucharest', weekday: 'short' }).format(new Date(now));
  return dow === 'Sun' && hour >= WEEKLY.from && hour < WEEKLY.to ? day : null;
}
const fmtDayRO = new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
export function weeklyDue(sub, games, now, site) {
  if (sub.weekly === false) return null;
  const day = weeklyWindow(now);
  if (!day || sub.weekDay === day) return null;
  const t = g => new Date(g.date).getTime();
  const lines = [];
  let total = 0;
  for (const id of sub.teams || []) {
    const one = new Set([id]), side = g => [g.home, g.away].find(s => sideIn(one, g.l, s));
    const week = games.filter(g => side(g) && g.state === 'post' && t(g) < now && now - t(g) < 7 * 864e5).sort((a, b) => t(a) - t(b));
    if (!week.length) continue;
    total += week.length;
    let w = 0, l = 0, e = 0;
    const marks = week.map(g => {
      const s = side(g), my = (s === g.home ? g.home.score : g.away.score) ?? 0, th = (s === g.home ? g.away.score : g.home.score) ?? 0;
      return my > th ? (w++, '✓') : my < th ? (l++, '✗') : (e++, '=');
    }).join('');
    lines.push(`${short(side(week[0]))}: ${w}–${l}${e ? '–' + e : ''} ${marks}`);
  }
  if (!lines.length) return null;
  const want = new Set(sub.teams || []);
  const ahead = games.filter(g => (sideIn(want, g.l, g.home) || sideIn(want, g.l, g.away)) && g.state === 'pre' && !g.tbd && t(g) > now && t(g) - now < 7 * 864e5).sort((a, b) => t(a) - t(b));
  const nextLine = ahead.length ? `Săptămâna viitoare: ${ahead.length} ${ahead.length === 1 ? 'meci' : 'meciuri'} · primul: ${short(ahead[0].home)} – ${short(ahead[0].away)}, ${fmtDayRO.format(new Date(ahead[0].date))}` : '';
  return {
    kind: 'w', day, game: null,
    message: {
      title: lines.length === 1 ? `📅 Săptămâna: ${lines[0].replace(/ [✓✗=]+$/, '')}` : `📅 Săptămâna echipelor tale: ${total} meciuri`,
      body: [...(lines.length === 1 ? [lines[0].replace(/^.*?: [\d–]+ /, 'Meci cu meci: ')] : lines), nextLine].filter(Boolean).join('\n'),
      url: site + '/', tag: 'weekly'
    }
  };
}

// The notifications due now for one subscriber: [{ kind: 'p'|'f'|'m'|'w', game, message }].
export function due(sub, games, now, site, night = null) {
  const out = [], want = new Set(sub.teams || []), sent = sub.sent || {};
  for (const g of games) {
    if (!(sideIn(want, g.l, g.home) || sideIn(want, g.l, g.away))) continue;
    const start = new Date(g.date).getTime(), s = sent[g.id] || {};
    if (sub.lead > 0 && g.state === 'pre' && !g.tbd && !s.p) {
      const min = Math.round((start - now) / 6e4);
      // Inside the reminder window. A late subscriber still gets "in 10 minutes" for a game about to start.
      if (min > 0 && min <= sub.lead) out.push({ kind: 'p', game: g, message: preMessage(g, min, site) });
    }
    if (sub.final && g.state === 'post' && !s.f) {
      const end = start + (LEAGUES[g.l]?.dur || 150) * 6e4;
      // Only games that ended recently, and after the subscription began.
      if (now - start < 10 * 36e5 && end > (sub.created || 0)) out.push({ kind: 'f', game: g, message: finalMessage(g, [...want], site) });
    }
  }
  const m = morningDue(sub, games, now, site, night);
  if (m) out.push(m);
  const w = weeklyDue(sub, games, now, site);
  if (w) out.push(w);
  return out;
}

// Remembers what was sent, and forgets games older than four days.
export function markSent(sub, items, now) {
  const sent = { ...(sub.sent || {}) };
  let morningDay = sub.morningDay, weekDay = sub.weekDay;
  for (const it of items) {
    if (it.kind === 'm') { morningDay = it.day; continue; }
    if (it.kind === 'w') { weekDay = it.day; continue; }
    sent[it.game.id] = { ...(sent[it.game.id] || {}), [it.kind]: now };
  }
  for (const [id, s] of Object.entries(sent)) if (now - Math.max(s.p || 0, s.f || 0) > 4 * 864e5) delete sent[id];
  const out = { ...sub, sent };
  if (morningDay) out.morningDay = morningDay;
  if (weekDay) out.weekDay = weekDay;
  return out;
}

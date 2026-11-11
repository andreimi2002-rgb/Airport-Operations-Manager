// Which notifications a subscriber is due, and their Romanian text. Pure functions: tested offline.
// A subscription: { id, endpoint, keys, teams: ['heat', 'NBA-2'], lead: 60 (minutes, 0 = none), final: true,
//                   morning: true (absent = true), morningDay: '2026-11-12' (last morning summary, Romanian date),
//                   created (ms), sent: { [gameId]: { p: ms, f: ms } } }
import { LEAGUES, TEAMS, sideIn } from '../../js/teams.js';
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
export function morningMessage(results, next, teams, site) {
  const want = new Set(teams), lines = results.map(g => resultLine(g, want));
  return {
    title: results.length === 1 ? `☀️ Azi-noapte: ${lines[0]}` : `☀️ Azi-noapte: ${results.length} meciuri ale echipelor tale`,
    body: [...(results.length === 1 ? [] : lines), next ? `Urmează: ${short(next.home)} – ${short(next.away)}, ${fmtRO.format(new Date(next.date))}` : ''].filter(Boolean).join('\n'),
    url: site + '/', tag: 'morning'
  };
}
export function morningDue(sub, games, now, site) {
  if (sub.morning === false) return null;
  const { day, hour } = roParts(now);
  if (hour < MORNING.from || hour >= MORNING.to || sub.morningDay === day) return null;
  const want = new Set(sub.teams || []);
  const mine = games.filter(g => sideIn(want, g.l, g.home) || sideIn(want, g.l, g.away));
  const t = g => new Date(g.date).getTime();
  const results = mine.filter(g => g.state === 'post' && t(g) < now && now - t(g) < 24 * 36e5).sort((a, b) => t(a) - t(b));
  if (!results.length) return null;
  const next = mine.filter(g => g.state === 'pre' && !g.tbd && t(g) > now && t(g) - now < 24 * 36e5).sort((a, b) => t(a) - t(b))[0];
  return { kind: 'm', day, game: null, message: morningMessage(results, next, [...want], site) };
}

// The notifications due now for one subscriber: [{ kind: 'p'|'f'|'m', game, message }].
export function due(sub, games, now, site) {
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
  const m = morningDue(sub, games, now, site);
  if (m) out.push(m);
  return out;
}

// Remembers what was sent, and forgets games older than four days.
export function markSent(sub, items, now) {
  const sent = { ...(sub.sent || {}) };
  let morningDay = sub.morningDay;
  for (const it of items) {
    if (it.kind === 'm') { morningDay = it.day; continue; }
    sent[it.game.id] = { ...(sent[it.game.id] || {}), [it.kind]: now };
  }
  for (const [id, s] of Object.entries(sent)) if (now - Math.max(s.p || 0, s.f || 0) > 4 * 864e5) delete sent[id];
  return morningDay ? { ...sub, sent, morningDay } : { ...sub, sent };
}

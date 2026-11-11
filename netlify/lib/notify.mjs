// Which notifications a subscriber is due, and their Romanian text. Pure functions: tested offline.
// A subscription: { id, endpoint, keys, teams: ['heat'], lead: 60 (minutes, 0 = none), final: true,
//                   created (ms), sent: { [gameId]: { p: ms, f: ms } } }
import { LEAGUES, TEAMS } from '../../js/teams.js';
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
  const mine = [g.home, g.away].find(s => s.key && teams.includes(s.key));
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

// The notifications due now for one subscriber: [{ kind: 'p'|'f', game, message }].
export function due(sub, games, now, site) {
  const out = [], want = new Set(sub.teams || []), sent = sub.sent || {};
  for (const g of games) {
    if (!(want.has(g.home.key) || want.has(g.away.key))) continue;
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
  return out;
}

// Remembers what was sent, and forgets games older than four days.
export function markSent(sub, items, now) {
  const sent = { ...(sub.sent || {}) };
  for (const it of items) sent[it.game.id] = { ...(sent[it.game.id] || {}), [it.kind]: now };
  for (const [id, s] of Object.entries(sent)) if (now - Math.max(s.p || 0, s.f || 0) > 4 * 864e5) delete sent[id];
  return { ...sub, sent };
}

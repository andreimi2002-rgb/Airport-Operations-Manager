// GET /api/schedule — season games of the Florida teams plus standings of their leagues.
// Cached on Netlify's CDN for 15 minutes, so ESPN is asked at most a few times an hour.
import { TEAMS } from '../../js/teams.js';
import { floridaIds, teamSchedule, scoreboardRange, standings, normalizeEvent, json } from '../lib/espn.mjs';

const ymd = d => d.toISOString().slice(0, 10).replace(/-/g, '');

export async function buildSchedule() {
  const errors = [];
  const ids = await floridaIds(errors);
  const fl = Object.fromEntries(Object.entries(ids).map(([k, t]) => [TEAMS[k].l + ':' + t.id, k]));
  const games = new Map();
  const teams = {};

  const jobs = [];
  const counts = {};
  const addEvents = (l, events) => {
    let n = 0;
    for (const ev of events) {
      const g = normalizeEvent(ev, l, fl);
      if (!g || !(g.home.key || g.away.key)) continue;
      const prev = games.get(g.id);
      // Keep the most informative copy: a finished or live game beats a scheduled one.
      if (!prev || (prev.state === 'pre' && g.state !== 'pre')) { games.set(g.id, g); n++; }
    }
    return n;
  };
  for (const [k, t] of Object.entries(TEAMS)) {
    const info = ids[k];
    if (!info) continue;
    teams[k] = { ...info };
    // Default list first; then the extra lists ESPN keeps separately (postseason, soccer fixtures).
    const queries = t.l === 'MLS' ? ['', 'fixture=true', 'seasontype=3', 'fixture=true&seasontype=3']
      : t.l === 'NFL' ? ['', 'seasontype=3'] : [''];
    for (const q of queries) {
      jobs.push(teamSchedule(t.l, info.id, q).then(({ events, team }) => {
        if (!q) {
          teams[k].record = team.recordSummary || null;
          teams[k].standing = team.standingSummary || null;
        }
        counts[`${k}${q ? '?' + q : ''}`] = `${events.length}/${addEvents(t.l, events)}`;
      }).catch(e => { if (!q) errors.push(String(e.message || e)); else counts[`${k}?${q}`] = 'err'; }));
    }
  }
  // Safety net for MLS: every league game in the next 45 days, kept only if a Florida team plays.
  if (Object.values(TEAMS).some(t => t.l === 'MLS')) {
    const now = new Date();
    jobs.push(scoreboardRange('MLS', ymd(new Date(now - 864e5)), ymd(new Date(+now + 45 * 864e5)))
      .then(events => { counts['MLS scoreboard'] = `${events.length}/${addEvents('MLS', events)}`; })
      .catch(() => { counts['MLS scoreboard'] = 'err'; }));
  }

  const tables = {};
  for (const l of [...new Set(Object.values(TEAMS).map(t => t.l))]) {
    jobs.push(standings(l).then(s => { tables[l] = s; }).catch(e => errors.push(String(e.message || e))));
  }
  await Promise.all(jobs);
  console.log('schedule sources (events/new games):', JSON.stringify(counts));

  return {
    updated: new Date().toISOString(),
    source: 'espn',
    teams,
    games: [...games.values()].sort((a, b) => String(a.date).localeCompare(String(b.date))),
    standings: tables,
    errors,
    sources: counts
  };
}

export default async () => {
  try {
    const body = await buildSchedule();
    const ok = body.games.length > 0;
    return json(body, ok ? { browser: 120, cdn: 900 } : { browser: 0, cdn: 60, status: 502 });
  } catch (e) {
    return json({ error: String(e.message || e) }, { browser: 0, cdn: 30, status: 502 });
  }
};

export const config = { path: '/api/schedule' };

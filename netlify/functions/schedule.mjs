// GET /api/schedule — season games of the Florida teams plus standings of their leagues.
// Cached on Netlify's CDN for 15 minutes, so ESPN is asked at most a few times an hour.
import { TEAMS } from '../../js/teams.js';
import { floridaIds, teamSchedule, standings, normalizeEvent, json } from '../lib/espn.mjs';

export async function buildSchedule() {
  const errors = [];
  const ids = await floridaIds(errors);
  const fl = Object.fromEntries(Object.entries(ids).map(([k, t]) => [t.id, k]));
  const games = new Map();
  const teams = {};

  const jobs = [];
  for (const [k, t] of Object.entries(TEAMS)) {
    const info = ids[k];
    if (!info) continue;
    teams[k] = { ...info };
    // Regular season by default; postseason too where it can fall in the window.
    const types = t.l === 'MLS' || t.l === 'NFL' ? [null, 3] : [null];
    for (const st of types) {
      jobs.push(teamSchedule(t.l, info.id, st).then(({ events, team }) => {
        if (!st) {
          teams[k].record = team.recordSummary || null;
          teams[k].standing = team.standingSummary || null;
        }
        for (const ev of events) {
          const g = normalizeEvent(ev, t.l, fl);
          if (g && !games.has(g.id)) games.set(g.id, g);
        }
      }).catch(e => { if (!st) errors.push(String(e.message || e)); }));
    }
  }

  const tables = {};
  for (const l of [...new Set(Object.values(TEAMS).map(t => t.l))]) {
    jobs.push(standings(l).then(s => { tables[l] = s; }).catch(e => errors.push(String(e.message || e))));
  }
  await Promise.all(jobs);

  return {
    updated: new Date().toISOString(),
    source: 'espn',
    teams,
    games: [...games.values()].sort((a, b) => String(a.date).localeCompare(String(b.date))),
    standings: tables,
    errors
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

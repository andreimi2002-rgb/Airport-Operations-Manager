// GET /api/teamgames?l=NBA&id=2 — the season games of any team (for the simple team page). Cached 30 minutes.
import { LEAGUES } from '../../js/teams.js';
import { teamGames, json } from '../lib/espn.mjs';

export default async req => {
  const q = new URL(req.url).searchParams;
  const l = (q.get('l') || '').toUpperCase(), id = q.get('id') || '';
  if (!LEAGUES[l] || !/^\d{1,8}$/.test(id)) return json({ error: 'bad request' }, { browser: 0, cdn: 0, status: 400 });
  try {
    return json(await teamGames(l, id), { browser: 300, cdn: 1800, swr: 86400 });
  } catch (e) {
    return json({ error: String(e.message || e) }, { browser: 0, cdn: 60, status: 502 });
  }
};

export const config = { path: '/api/teamgames' };

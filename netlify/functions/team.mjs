// GET /api/team?l=NBA&id=14 — roster, season leaders and ESPN news for a team page. Cached 3 hours.
import { LEAGUES } from '../../js/teams.js';
import { teamExtras, json } from '../lib/espn.mjs';

export default async req => {
  const q = new URL(req.url).searchParams;
  const l = (q.get('l') || '').toUpperCase(), id = q.get('id') || '';
  if (!LEAGUES[l] || !/^\d{1,8}$/.test(id)) return json({ error: 'bad request' }, { browser: 0, cdn: 0, status: 400 });
  try {
    return json(await teamExtras(l, id), { browser: 1800, cdn: 3 * 3600, swr: 86400 });
  } catch (e) {
    return json({ error: String(e.message || e) }, { browser: 0, cdn: 60, status: 502 });
  }
};

export const config = { path: '/api/team' };

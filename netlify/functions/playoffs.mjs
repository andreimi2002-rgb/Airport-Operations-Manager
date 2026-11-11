// GET /api/playoffs?l=MLS — every playoff game of a league this season (for the bracket). Cached 1 hour.
import { LEAGUES } from '../../js/teams.js';
import { playoffs, json } from '../lib/espn.mjs';

export default async req => {
  const l = (new URL(req.url).searchParams.get('l') || '').toUpperCase();
  if (!LEAGUES[l]) return json({ error: 'bad request' }, { browser: 0, cdn: 0, status: 400 });
  try {
    return json(await playoffs(l), { browser: 600, cdn: 3600, swr: 86400 });
  } catch (e) {
    return json({ error: String(e.message || e) }, { browser: 0, cdn: 60, status: 502 });
  }
};

export const config = { path: '/api/playoffs' };

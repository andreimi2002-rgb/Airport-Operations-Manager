// GET /api/game?l=NBA&id=401585... — details of one game: line score, leaders, goals, win probability.
import { LEAGUES } from '../../js/teams.js';
import { summary, json } from '../lib/espn.mjs';

export default async req => {
  const q = new URL(req.url).searchParams;
  const l = (q.get('l') || '').toUpperCase();
  const id = q.get('id') || '';
  if (!LEAGUES[l] || !/^\d{1,12}$/.test(id)) return json({ error: 'bad request' }, { browser: 0, cdn: 0, status: 400 });
  try {
    const s = await summary(l, id);
    // A finished game no longer changes: cache it for a day.
    return json(s, s.state === 'post' ? { browser: 3600, cdn: 86400 } : s.state === 'in' ? { browser: 15, cdn: 30 } : { browser: 300, cdn: 900 });
  } catch (e) {
    return json({ error: String(e.message || e) }, { browser: 0, cdn: 30, status: 502 });
  }
};

export const config = { path: '/api/game' };

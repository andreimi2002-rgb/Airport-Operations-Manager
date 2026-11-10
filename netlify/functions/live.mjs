// GET /api/live?l=NBA,NHL — today's scoreboard for the given leagues, for live scores.
// Cached 30 seconds on the CDN.
import { LEAGUES } from '../../js/teams.js';
import { scoreboard, json } from '../lib/espn.mjs';

export default async req => {
  const want = (new URL(req.url).searchParams.get('l') || '')
    .split(',').map(s => s.trim().toUpperCase()).filter(l => LEAGUES[l] && !LEAGUES[l].off);
  const games = [];
  const errors = [];
  await Promise.all(want.map(l => scoreboard(l)
    .then(list => games.push(...list.map(g => ({ id: g.id, l: g.l, state: g.state, detail: g.detail, hs: g.home.score, as: g.away.score }))))
    .catch(e => errors.push(String(e.message || e)))));
  return json({ updated: new Date().toISOString(), games, errors }, { browser: 15, cdn: 30, swr: 60 });
};

export const config = { path: '/api/live' };

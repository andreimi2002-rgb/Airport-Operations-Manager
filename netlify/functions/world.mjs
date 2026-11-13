// GET /api/world — the games outside the US and Canada and the big days of the season, for the next four
// months (all leagues). Cached on the CDN for 12 hours: the schedule abroad rarely changes.
import { worldGames } from '../lib/world.mjs';
import { json } from '../lib/espn.mjs';

export default async () => {
  try {
    const body = await worldGames();
    return json(body, { browser: 3600, cdn: 43200, swr: 86400 });
  } catch (e) {
    return json({ error: String(e.message || e) }, { browser: 0, cdn: 60, status: 502 });
  }
};

export const config = { path: '/api/world' };

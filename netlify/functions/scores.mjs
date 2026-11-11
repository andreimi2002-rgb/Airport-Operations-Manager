// GET /api/scores?d=20261111 — every game of that day (US date) in every league.
// Cached on the CDN: a finished day for a day, today for 30 seconds, a future day for 10 minutes.
import { scoresDay, json } from '../lib/espn.mjs';

const usToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()).replace(/-/g, '');

export default async req => {
  const d = new URL(req.url).searchParams.get('d') || usToday();
  if (!/^20\d{6}$/.test(d)) return json({ error: 'bad date' }, { browser: 0, cdn: 0, status: 400 });
  try {
    const body = await scoresDay(d);
    const t = usToday();
    const cache = d < t ? { browser: 3600, cdn: 86400 } : d === t ? { browser: 15, cdn: 30, swr: 120 } : { browser: 300, cdn: 600 };
    return json(body, cache);
  } catch (e) {
    return json({ error: String(e.message || e) }, { browser: 0, cdn: 30, status: 502 });
  }
};

export const config = { path: '/api/scores' };

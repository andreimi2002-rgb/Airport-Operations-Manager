// The games of followed teams outside Florida ('NBA-2'), for the calendar feed and the notifications.
// From /api/teamgames (cached on the CDN, so many subscribers cost ESPN one request per team),
// straight from ESPN when that does not answer.
import { parseClub } from '../../js/teams.js';
import { teamGames } from './espn.mjs';

export const clubIds = ids => [...new Set(ids)].filter(s => parseClub(s)).slice(0, 40);

export async function clubGames(site, ids) {
  const lists = await Promise.all(clubIds(ids).map(async s => {
    const { l, id } = parseClub(s);
    try {
      const r = await fetch(`${site}/api/teamgames?l=${l}&id=${id}`, { signal: AbortSignal.timeout(10000) });
      if (r.ok) { const j = await r.json(); if (Array.isArray(j.games)) return j.games; }
    } catch (e) { /* ask ESPN below */ }
    try { return (await teamGames(l, id)).games || []; } catch (e) { return []; }
  }));
  return lists.flat();
}

// Adds the games of `more` that `games` does not have yet (a Florida team playing a followed team).
export function mergeGames(games, more) {
  const seen = new Set(games.map(g => g.id)), out = games.slice();
  for (const g of more) if (!seen.has(g.id)) { seen.add(g.id); out.push(g); }
  return out;
}

// The name of a followed team, from its games: 'NBA-2' -> 'Boston Celtics'.
export function clubName(s, games) {
  const c = parseClub(s); if (!c) return '';
  for (const g of games) for (const side of [g.home, g.away]) if (g.l === c.l && String(side.id) === c.id) return side.name;
  return '';
}

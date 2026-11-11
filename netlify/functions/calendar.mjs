// GET /api/calendar.ics?e=heat,panthers,NBA-2[&a=60] — a calendar to subscribe to (Google Calendar, iPhone,
// Outlook) with the games of the chosen teams: Florida keys, and any other team as 'NBA-2'.
// a = reminder, minutes before the start. The games come from /api/schedule and /api/teamgames
// (already cached on the CDN); the feed itself is cached 1 hour.
import { TEAMS, validTeamId } from '../../js/teams.js';
import { calendar, pick } from '../../js/ics.js';
import { buildSchedule } from './schedule.mjs';
import { clubIds, clubGames, mergeGames, clubName } from '../lib/clubs.mjs';

const ALARMS = new Set([0, 15, 30, 60, 120, 180]);

async function schedule(origin) {
  try {
    const r = await fetch(origin + '/api/schedule', { signal: AbortSignal.timeout(12000) });
    if (r.ok) { const j = await r.json(); if (j.games?.length) return j; }
  } catch (e) { /* fall back to asking ESPN directly */ }
  return buildSchedule();
}

export default async req => {
  const u = new URL(req.url);
  const teams = [...new Set((u.searchParams.get('e') || '').split(',').map(s => s.trim()).filter(validTeamId))];
  const alarm = +(u.searchParams.get('a') || 0);
  if (!teams.length || !ALARMS.has(alarm)) return new Response('Alege cel puțin o echipă: ?e=heat,panthers', { status: 400, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  try {
    const fl = teams.filter(k => TEAMS[k]), clubs = clubIds(teams);
    const [data, more] = await Promise.all([fl.length ? schedule(u.origin) : { games: [] }, clubGames(u.origin, clubs)]);
    const games = pick(mergeGames(data.games || [], more), teams);
    const allFL = fl.length === Object.keys(TEAMS).length && !clubs.length;
    const name = allFL ? 'American Sports Hub: Florida' : 'American Sports Hub: ' + [...fl.map(k => TEAMS[k].s), ...clubs.map(s => clubName(s, more) || s)].join(', ');
    const body = calendar(games, { name, site: u.origin, alarm });
    return new Response(body, {
      headers: {
        'content-type': 'text/calendar; charset=utf-8',
        'content-disposition': 'inline; filename="american-sports-hub.ics"',
        'cache-control': 'public, max-age=900',
        'netlify-cdn-cache-control': 'public, durable, s-maxage=3600, stale-while-revalidate=86400'
      }
    });
  } catch (e) {
    return new Response('Calendarul nu a putut fi generat acum.', { status: 502, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  }
};

export const config = { path: '/api/calendar.ics' };

// GET /api/calendar.ics?e=heat,panthers[&a=60] — a calendar to subscribe to (Google Calendar, iPhone,
// Outlook) with the games of the chosen Florida teams. a = reminder, minutes before the start.
// The games come from /api/schedule (already cached on the CDN); the feed itself is cached 1 hour.
import { TEAMS } from '../../js/teams.js';
import { calendar, pick } from '../../js/ics.js';
import { buildSchedule } from './schedule.mjs';

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
  const teams = (u.searchParams.get('e') || '').split(',').map(s => s.trim()).filter(k => TEAMS[k]);
  const alarm = +(u.searchParams.get('a') || 0);
  if (!teams.length || !ALARMS.has(alarm)) return new Response('Alege cel puțin o echipă: ?e=heat,panthers', { status: 400, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  try {
    const data = await schedule(u.origin);
    const games = pick(data.games || [], teams);
    const name = teams.length === Object.keys(TEAMS).length ? 'Meciuri Florida' : 'Meciuri: ' + teams.map(k => TEAMS[k].s).join(', ');
    const body = calendar(games, { name, site: u.origin, alarm });
    return new Response(body, {
      headers: {
        'content-type': 'text/calendar; charset=utf-8',
        'content-disposition': 'inline; filename="meciuri-florida.ics"',
        'cache-control': 'public, max-age=900',
        'netlify-cdn-cache-control': 'public, durable, s-maxage=3600, stale-while-revalidate=86400'
      }
    });
  } catch (e) {
    return new Response('Calendarul nu a putut fi generat acum.', { status: 502, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  }
};

export const config = { path: '/api/calendar.ics' };

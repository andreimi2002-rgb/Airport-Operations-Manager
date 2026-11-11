// Every 15 minutes (UTC), on the published site only: sends the notifications that are due.
// Netlify runs scheduled functions only on the production deploy, never on previews.
import { sendPush } from '../lib/webpush.mjs';
import { subsStore, vapid, env } from '../lib/subs.mjs';
import { due, markSent } from '../lib/notify.mjs';
import { buildSchedule } from './schedule.mjs';
import { clubGames, mergeGames } from '../lib/clubs.mjs';

async function getJSON(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(r.status + ' ' + url);
  return r.json();
}

// The season from /api/schedule (cached on the CDN), plus the games of the followed teams outside
// Florida (clubs, 'NBA-2'), with fresh scores from /api/live for games started in the last hours,
// so a final whistle is noticed within one run.
export async function currentGames(site, now = Date.now(), clubs = []) {
  let data;
  try { data = await getJSON(site + '/api/schedule'); } catch (e) { data = await buildSchedule(); }
  const games = clubs.length ? mergeGames(data.games || [], await clubGames(site, clubs)) : (data.games || []);
  const recent = games.filter(g => g.state !== 'post' && Math.abs(new Date(g.date).getTime() - now) < 6 * 36e5);
  const leagues = [...new Set(recent.map(g => g.l))];
  if (leagues.length) {
    try {
      const live = await getJSON(`${site}/api/live?l=${leagues.join(',')}`);
      const by = new Map((live.games || []).map(x => [x.id, x]));
      for (const g of games) {
        const x = by.get(g.id);
        if (x) { g.state = x.state; g.detail = x.detail; g.home.score = x.hs; g.away.score = x.as; }
      }
    } catch (e) { /* the schedule's scores are a little older, still fine */ }
  }
  return games;
}

export default async () => {
  const v = vapid();
  if (!v) return new Response('notifications not configured');
  const store = await subsStore('production');
  const subs = await store.list();
  if (!subs.length) return new Response('no subscribers');
  const site = env('URL') || 'https://florida-sp-calendar.netlify.app';
  const now = Date.now();
  const games = await currentGames(site, now, subs.flatMap(s => s.teams || []));
  let sent = 0, removed = 0;
  for (const sub of subs) {
    const items = due(sub, games, now, sub.site || site);
    if (!items.length) continue;
    const done = [];
    for (const it of items) {
      const r = await sendPush(sub, it.message, v, { ttl: it.kind === 'p' ? 1800 : 6 * 3600 }).catch(() => ({ ok: false }));
      if (r.gone) { await store.del(sub.id); removed++; break; }
      if (r.ok) { done.push(it); sent++; }
    }
    if (done.length) await store.set(sub.id, markSent(sub, done, now));
  }
  console.log(`push-cron: ${subs.length} subscribers, ${sent} sent, ${removed} removed`);
  return new Response('ok');
};

// Every 15 minutes, in UTC (the time zone does not matter for a fixed interval).
export const config = { schedule: '*/15 * * * *' };

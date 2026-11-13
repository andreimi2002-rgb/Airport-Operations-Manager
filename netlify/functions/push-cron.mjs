// Every 15 minutes (UTC), on the published site only: sends the notifications that are due.
// Netlify runs scheduled functions only on the production deploy, never on previews.
import { sendPush } from '../lib/webpush.mjs';
import { subsStore, vapid, env } from '../lib/subs.mjs';
import { due, markSent, morningWindow } from '../lib/notify.mjs';
import { buildSchedule } from './schedule.mjs';
import { packOf } from '../../js/teams.js';
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
  // One schedule per pack of default teams the subscribers follow (Florida, New York), plus any other team.
  const packs = [...new Set(['fl', ...clubs.map(packOf).filter(Boolean)])];
  const lists = await Promise.all(packs.map(p => getJSON(site + '/api/schedule' + (p === 'fl' ? '' : '?pack=' + p)).catch(() => buildSchedule(p))));
  const base = mergeGames(lists[0].games || [], lists.slice(1).flatMap(d => d.games || []));
  const games = clubs.length ? mergeGames(base, await clubGames(site, clubs)) : base;
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

// Every finished game of the night in all leagues, for the morning summaries that tell the whole night.
// Asked only in the morning window and only when such a summary is still due (one /api/scores call, cached).
export async function nightGames(site, now, subs) {
  const day = morningWindow(now);
  if (!day || !subs.some(s => s.night && s.morning !== false && s.morningDay !== day)) return null;
  // The night's US date: New York, 12 hours ago (at 8:00 in Romania it is just past midnight there).
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(now - 12 * 36e5)).replace(/-/g, '');
  try {
    const j = await getJSON(`${site}/api/scores?d=${d}`);
    return Object.values(j.leagues || {}).flat().filter(g => g.state === 'post');
  } catch (e) { return null; }
}

export default async () => {
  const v = vapid();
  if (!v) return new Response('notifications not configured');
  const store = await subsStore('production');
  const subs = await store.list();
  if (!subs.length) return new Response('no subscribers');
  const site = env('URL') || 'https://americansportshub.netlify.app';
  // Subscriptions made on the old address keep it; their links go to the new one (the old one redirects anyway).
  const siteOf = sub => (!sub.site || sub.site.includes('florida-sp-calendar') ? site : sub.site);
  const now = Date.now();
  const games = await currentGames(site, now, subs.flatMap(s => s.teams || []));
  const night = await nightGames(site, now, subs);
  let sent = 0, removed = 0;
  for (const sub of subs) {
    const items = due(sub, games, now, siteOf(sub), night);
    if (!items.length) continue;
    const done = [];
    for (const it of items) {
      const r = await sendPush(sub, it.message, v, { ttl: it.kind === 'p' ? 1800 : it.kind === 'm' ? 4 * 3600 : 6 * 3600 }).catch(() => ({ ok: false }));
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

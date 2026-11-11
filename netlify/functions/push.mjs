// /api/push — notifications before the games of the chosen teams.
//   GET                          -> { publicKey } (null when notifications are not set up on this site)
//   POST { action: 'save', subscription, prefs: { teams, lead, final } }   save or update
//   POST { action: 'get', subscription }      the saved settings of this browser, or null
//   POST { action: 'test', subscription }     send a test notification now
//   POST { action: 'delete', subscription }   stop
// The notifications themselves are sent by push-cron.mjs, every 15 minutes, on the published site.
import { validTeamId } from '../../js/teams.js';
import { sendPush, validSubscription } from '../lib/webpush.mjs';
import { subsStore, subId, vapid } from '../lib/subs.mjs';
import { LEADS, inTime } from '../lib/notify.mjs';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export default async (req, context) => {
  const v = vapid();
  if (req.method === 'GET') return json({ publicKey: v?.publicKey || null });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  if (!v) return json({ error: 'Notificările nu sunt configurate pe acest site.' }, 503);
  let body;
  try { body = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  const sub = body?.subscription;
  if (!sub || !validSubscription(sub)) return json({ error: 'Abonament invalid.' }, 400);
  const store = await subsStore(context?.deploy?.context || 'local');
  const id = subId(sub.endpoint);
  const old = await store.get(id);

  if (body.action === 'get') return json({ prefs: old ? { teams: old.teams, lead: old.lead, final: old.final } : null });
  if (body.action === 'delete') { await store.del(id); return json({ ok: true }); }
  if (body.action === 'save') {
    const p = body.prefs || {};
    const teams = [...new Set((Array.isArray(p.teams) ? p.teams : []).filter(validTeamId))].slice(0, 40);
    const lead = LEADS.includes(+p.lead) ? +p.lead : 60;
    if (!teams.length) return json({ error: 'Alege cel puțin o echipă.' }, 400);
    const rec = {
      id, endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      teams, lead, final: !!p.final, site: new URL(req.url).origin,
      created: old?.created || Date.now(), updated: Date.now(), sent: old?.sent || {}, lastTest: old?.lastTest || 0
    };
    await store.set(id, rec);
    return json({ ok: true, prefs: { teams, lead, final: rec.final } });
  }
  if (body.action === 'test') {
    if (!old) return json({ error: 'Salvează întâi setările.' }, 400);
    if (Date.now() - (old.lastTest || 0) < 20e3) return json({ error: 'Așteaptă câteva secunde între teste.' }, 429);
    const r = await sendPush(old, {
      title: 'Notificările merg ✓',
      body: old.lead ? `Vei primi o notificare ${inTime(old.lead).replace(/^în /, 'cu ').replace(/^într-o oră$/, 'cu o oră')} înainte de meciurile echipelor alese.` : 'Vei primi rezultatul final al meciurilor echipelor alese.',
      url: old.site, tag: 'test'
    }, v, { ttl: 300 }).catch(e => ({ ok: false, status: 0, error: String(e.message || e) }));
    if (r.gone) { await store.del(id); return json({ error: 'Abonamentul nu mai e valid; activează din nou.' }, 410); }
    await store.set(id, { ...old, lastTest: Date.now() });
    return json(r.ok ? { ok: true } : { error: `Serviciul de notificări a răspuns ${r.status}.` }, r.ok ? 200 : 502);
  }
  return json({ error: 'action' }, 400);
};

export const config = { path: '/api/push' };

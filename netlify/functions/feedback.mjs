// POST /api/feedback — a message from "Spune-ne ce crezi": { text, contact? }. Kept for the stats page.
import crypto from 'node:crypto';
import { blobStore, storeName } from '../lib/stats.mjs';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export default async (req, context) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  let b;
  try { b = await req.json(); } catch (e) { return json({ error: 'Mesaj invalid.' }, 400); }
  const text = String(b?.text || '').trim(), contact = String(b?.contact || '').trim();
  if (text.length < 3) return json({ error: 'Scrie câteva cuvinte.' }, 400);
  if (text.length > 2000 || contact.length > 200) return json({ error: 'Mesajul e prea lung.' }, 400);
  const store = await blobStore(storeName('feedback', context?.deploy?.context));
  const at = new Date().toISOString();
  await store.set(`${at.replace(/[:.]/g, '-')}-${crypto.randomBytes(3).toString('hex')}`, { at, text, contact, page: String(b?.page || '').slice(0, 80) });
  // Messages are kept at most 12 months (as the privacy page says): the older ones go now. Keys start with
  // the date, so the key alone tells their age.
  try {
    const limit = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
    for (const k of await store.list()) if (k.slice(0, 10) < limit) await store.del(k);
  } catch (e) { /* tidied at the next message */ }
  return json({ ok: true });
};

export const config = { path: '/api/feedback' };

// POST /api/hit — one page view or action, counted per day (see netlify/lib/stats.mjs).
// No cookies, no IP address, nothing that identifies the visitor is stored.
import { blobStore, storeName, cleanHit, addHit, roDay, BOT } from '../lib/stats.mjs';

export default async (req, context) => {
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  if (BOT.test(req.headers.get('user-agent') || '')) return new Response(null, { status: 204 });
  let b;
  try { b = JSON.parse(await req.text()); } catch (e) { return new Response(null, { status: 400 }); }
  const h = cleanHit(b);
  if (!h) return new Response(null, { status: 400 });
  const store = await blobStore(storeName('stats', context?.deploy?.context));
  const day = roDay();
  await store.set(day, addHit(await store.get(day), h));
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
};

export const config = { path: '/api/hit' };

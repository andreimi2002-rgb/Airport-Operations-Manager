// Visit counts with no cookies and nothing personal: per day (Romanian date), page views, visitors
// (new or returning, told apart by a date the page keeps in the visitor's own browser), views per kind
// of page, opens of the installed app, and a few actions. Plus the "Spune-ne ce crezi" messages.
// Netlify Blobs on Netlify (production and previews apart), JSON files when run locally.
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import os from 'node:os';

export async function blobStore(name) {
  if (globalThis.Netlify) {
    const { getStore } = await import('@netlify/blobs');
    const s = getStore({ name, consistency: 'strong' });
    return {
      get: id => s.get(id, { type: 'json' }),
      set: (id, v) => s.setJSON(id, v),
      async list() { const { blobs } = await s.list(); return blobs.map(b => b.key); }
    };
  }
  const dir = join(os.tmpdir(), 'meciuri-florida-blobs', name);
  await mkdir(dir, { recursive: true });
  const file = id => join(dir, id.replace(/[^\w.-]/g, '') + '.json');
  return {
    get: id => readFile(file(id), 'utf8').then(JSON.parse, () => null),
    set: (id, v) => writeFile(file(id), JSON.stringify(v)),
    async list() { return (await readdir(dir)).map(f => f.replace(/\.json$/, '')); }
  };
}
export const storeName = (kind, context) => (context === 'production' ? kind : kind + '-test');

export const KINDS = ['acasa', 'ligi', 'ghid', 'meci', 'echipa', 'club', 'oras', 'stadion', 'calendar', 'notificari', 'parere'];
export const EVENTS = ['install', 'notify-on', 'calendar', 'follow', 'share', 'feedback'];
export const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse/i;
export const roDay = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(now);

// A valid hit from the page, or null: { k: page kind, f: first view today, n: first visit ever, a: in the app }
// or { e: event }.
export function cleanHit(b) {
  if (!b || typeof b !== 'object') return null;
  if (b.e != null) return EVENTS.includes(b.e) ? { e: b.e } : null;
  return KINDS.includes(b.k) ? { k: b.k, f: !!b.f, n: !!b.n, a: !!b.a } : null;
}
// One day's counts with this hit added (pure).
export function addHit(rec, h) {
  const r = { views: 0, visitors: 0, fresh: 0, back: 0, app: 0, pages: {}, events: {}, ...(rec || {}) };
  r.pages = { ...r.pages }; r.events = { ...r.events };
  if (h.e) { r.events[h.e] = (r.events[h.e] || 0) + 1; return r; }
  r.views++;
  r.pages[h.k] = (r.pages[h.k] || 0) + 1;
  if (h.f) { r.visitors++; h.n ? r.fresh++ : r.back++; if (h.a) r.app++; }
  return r;
}

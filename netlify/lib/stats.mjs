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

export const KINDS = ['acasa', 'ligi', 'ghid', 'meci', 'echipa', 'club', 'oras', 'stadion', 'calendar', 'notificari', 'parere', 'confidentialitate'];
export const EVENTS = ['install', 'notify-on', 'calendar', 'follow', 'share', 'feedback'];
export const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse/i;
export const roDay = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(now);

// What is counted besides pages and actions, each as { value: count } per day. Visitor facts (where they
// came from, the device, the system, an in-app browser) count once per visitor and day; the rest each time.
export const COUNTS = {
  src: 'de unde vin', dev: 'dispozitiv', os: 'sistem', inapp: 'browser în aplicație', dur: 'cât stau',
  sec: 'secțiuni văzute', team: 'echipe deschise', game: 'meciuri, pe ligă', click: 'clicuri', watch: 'streaming',
  search: 'căutări alese', err: 'erori'
};
const VISITOR = ['src', 'dev', 'os', 'inapp'];
const VALUE = /^[\p{L}\p{N} .,'&()+:/-]{1,40}$/u;
const MAX_KEYS = 300;   // per kind and day, so junk cannot grow a day's record without end
const val = v => (typeof v === 'string' && VALUE.test(v.trim()) ? v.trim() : null);

// A valid hit from the page, or null:
//   a view   { k: page kind, f: first view today, n: first visit ever, a: in the app, + on f: src, dev, os, inapp }
//   an event { e }      a count { c: one of COUNTS, v: value }
export function cleanHit(b) {
  if (!b || typeof b !== 'object') return null;
  if (b.e != null) return EVENTS.includes(b.e) ? { e: b.e } : null;
  if (b.c != null) { const v = val(b.v); return COUNTS[b.c] && !VISITOR.includes(b.c) && v ? { c: b.c, v } : null; }
  if (!KINDS.includes(b.k)) return null;
  const h = { k: b.k, f: !!b.f, n: !!b.n, a: !!b.a };
  if (h.f) for (const c of VISITOR) { const v = val(b[c]); if (v) h[c] = v; }
  return h;
}
// The page sends what it gathered in one request: { b: [hits] } (at most 60), or a single hit.
export function cleanBatch(body) {
  const list = Array.isArray(body?.b) ? body.b.slice(0, 60) : [body];
  return list.map(cleanHit).filter(Boolean);
}
const bump = (r, c, v) => {
  const m = (r.counts[c] = { ...(r.counts[c] || {}) });
  if (m[v] == null && Object.keys(m).length >= MAX_KEYS) return;
  m[v] = (m[v] || 0) + 1;
};
// One day's counts with this hit added (pure).
export function addHit(rec, h) {
  const r = { views: 0, visitors: 0, fresh: 0, back: 0, app: 0, pages: {}, events: {}, counts: {}, ...(rec || {}) };
  r.pages = { ...r.pages }; r.events = { ...r.events }; r.counts = { ...(r.counts || {}) };
  if (h.e) { r.events[h.e] = (r.events[h.e] || 0) + 1; return r; }
  if (h.c) { bump(r, h.c, h.v); return r; }
  r.views++;
  r.pages[h.k] = (r.pages[h.k] || 0) + 1;
  if (h.f) {
    r.visitors++; h.n ? r.fresh++ : r.back++; if (h.a) r.app++;
    for (const c of VISITOR) if (h[c]) bump(r, c, h[c]);
  }
  return r;
}

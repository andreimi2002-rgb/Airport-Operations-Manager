// GET /api/stats?key=… — the visit counts of the last 30 days and the "Spune-ne ce crezi" messages,
// as a small page. Only with the owner's key (STATS_KEY in the Netlify environment).
// POST (same key) action=reset-day: today's counts start again from zero.
// The page also switches counting off for the browser it is opened in (the owner's devices).
import crypto from 'node:crypto';
import { blobStore, storeName, roDay, KINDS, EVENTS, COUNTS } from '../lib/stats.mjs';
import { ALL_TEAMS as TEAMS } from '../../js/teams.js';
import { env } from '../lib/subs.mjs';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const page = (body, status = 200) => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
const KIND_RO = { confidentialitate: 'Confidențialitate', acasa: 'Acasă', ligi: 'Ligile', ghid: 'Ghid', meci: 'Meciuri', echipa: 'Echipele implicite', club: 'Alte echipe', oras: 'Orașe', stadion: 'Stadioane', calendar: 'Calendar', notificari: 'Notificări', parere: 'Părere' };
const EVENT_RO = { install: 'Instalări', 'notify-on': 'Notificări pornite', calendar: 'Abonări la calendar', follow: 'Echipe urmărite', share: 'Distribuiri', feedback: 'Păreri trimise' };

export default async (req, context) => {
  const key = env('STATS_KEY');
  if (!key) return page('<p>Statisticile nu sunt configurate (lipsește STATS_KEY).</p>', 503);
  if (!same(new URL(req.url).searchParams.get('key') || '', key)) return page('<p>Cheie greșită.</p>', 403);
  const ctx = context?.deploy?.context;
  const stats = await blobStore(storeName('stats', ctx)), fb = await blobStore(storeName('feedback', ctx));
  if (req.method === 'POST') {
    const form = new URLSearchParams(await req.text());
    if (form.get('action') === 'reset-day') await stats.del(roDay());
    // Back to the page (303: the browser loads it with GET).
    return new Response(null, { status: 303, headers: { location: new URL(req.url).pathname + new URL(req.url).search, 'cache-control': 'no-store' } });
  }
  const days = [];
  for (let i = 0; i < 30; i++) days.push(roDay(new Date(Date.now() - i * 864e5)));
  const recs = await Promise.all(days.map(d => stats.get(d)));
  const rows = days.map((d, i) => [d, recs[i]]).filter(([, r]) => r);
  const sum = (list, f) => list.reduce((s, [, r]) => s + (f(r) || 0), 0);
  const week = rows.filter(([d]) => d >= days[6]);
  const keys = (await fb.list()).sort().reverse().slice(0, 50);
  const notes = (await Promise.all(keys.map(k => fb.get(k)))).filter(Boolean);
  const tbl = (head, body) => `<table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;
  // Team names: Florida keys from teams.js, any other team ('NBA-2') from the site's own data/clubs.json.
  const clubs = await fetch(new URL('/data/clubs.json', req.url), { signal: AbortSignal.timeout(5000) }).then(r => r.json()).catch(() => null);
  const nameOf = (c, v) => c !== 'team' ? v : TEAMS[v]?.espn || clubs?.teams?.[v]?.name || v;
  // One table per kind of count, last 7 days, most first (top 25).
  const countTables = Object.entries(COUNTS).map(([c, title]) => {
    const m = {};
    for (const [, r] of week) for (const [v, n] of Object.entries(r.counts?.[c] || {})) m[v] = (m[v] || 0) + n;
    const list = Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 25);
    return list.length ? `<section><h2>${esc(title[0].toUpperCase() + title.slice(1))}, ultimele 7 zile</h2>${tbl(['', 'De câte ori'], list.map(([v, n]) => `<tr><td>${esc(nameOf(c, v))}</td><td>${n}</td></tr>`).join(''))}</section>` : '';
  }).join('');
  return page(`<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Statistici · American Sports Hub</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:0;padding:20px 16px 48px;color:#1b2333;background:#f4f6fa}main{max-width:820px;margin:0 auto;display:flex;flex-direction:column;gap:22px}
h1{font:italic 800 26px/1 'Arial Narrow',Arial,sans-serif;text-transform:uppercase;color:#0e1f3d;margin:0;border-bottom:3px solid #c8102e;padding-bottom:10px}h2{font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:#5d6678;margin:0 0 8px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.c{background:#fff;border:1px solid #dde2ea;border-radius:10px;padding:12px}.c b{display:block;font-size:26px;color:#0e1f3d}.c span{color:#5d6678;font-size:13px}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #dde2ea;border-radius:10px;font-variant-numeric:tabular-nums}th,td{text-align:left;padding:7px 10px;border-bottom:1px solid #eef1f5}th{font-size:12px;color:#5d6678}
.n{background:#fff;border:1px solid #dde2ea;border-radius:10px;padding:10px 12px;margin-bottom:8px}.n small{color:#5d6678}
.own{background:#fff;border:1px solid #dde2ea;border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:10px;align-items:flex-start}.own p{margin:0}.own .hint{color:#5d6678;font-size:13px}
.own button{font:600 14px system-ui,sans-serif;border-radius:8px;padding:9px 14px;border:0;background:#c8102e;color:#fff;cursor:pointer}.own .ghost{background:none;border:1px solid #dde2ea;color:#1b2333}
.ok{color:#1f8a4c}.no{color:#c8102e}</style></head><body><main>
<h1>Statistici</h1>
<section class="own"><h2>Dispozitivul tău</h2><p id="devstate">…</p>
<button type="button" id="devbtn"></button>
<p class="hint">Fiecare browser se numără separat: deschide pagina asta și apasă o dată în fiecare (Chrome, Edge, Safari pe iPhone). În aplicația instalată: 5 atingeri pe „Versiunea” din subsol.</p>
<form method="post" onsubmit="return confirm('Ștergi cifrele de azi? Numărarea de azi pornește de la zero.')"><input type="hidden" name="action" value="reset-day"><button type="submit" class="ghost">Pornește numărarea de azi de la zero</button></form></section>
<script>
(() => {
  const K = 'flgames-notrack', st = document.getElementById('devstate'), b = document.getElementById('devbtn');
  const get = () => { try { return localStorage.getItem(K) === '1'; } catch (e) { return false; } };
  const draw = () => { const off = get(); st.innerHTML = off ? '<b class="ok">✓ Vizitele din acest browser nu se numără.</b>' : '<b class="no">Vizitele din acest browser se numără.</b>'; b.textContent = off ? 'Numără-mă din nou' : 'Nu număra acest browser'; };
  b.onclick = () => { try { get() ? localStorage.removeItem(K) : localStorage.setItem(K, '1'); } catch (e) {} draw(); };
  draw();
})();
</script>
<section><h2>Ultimele 7 zile</h2><div class="cards">
<div class="c"><b>${sum(week, r => r.visitors)}</b><span>vizitatori pe zi, adunați</span></div>
<div class="c"><b>${sum(week, r => r.fresh)}</b><span>vizitatori noi</span></div>
<div class="c"><b>${sum(week, r => r.back)}</b><span>vizite ale celor care revin</span></div>
<div class="c"><b>${sum(week, r => r.views)}</b><span>pagini văzute</span></div>
<div class="c"><b>${sum(week, r => r.app)}</b><span>deschideri din aplicația instalată</span></div></div></section>
<section><h2>Pe zile</h2>${tbl(['Zi', 'Vizitatori', 'Noi', 'Revin', 'Pagini', 'Din aplicație'], rows.map(([d, r]) => `<tr><td>${d}</td><td>${r.visitors}</td><td>${r.fresh}</td><td>${r.back}</td><td>${r.views}</td><td>${r.app}</td></tr>`).join('') || '<tr><td colspan="6">Nicio vizită încă.</td></tr>')}</section>
<section><h2>Ce pagini, ultimele 7 zile</h2>${tbl(['Pagina', 'Vizualizări'], KINDS.map(k => [k, sum(week, r => r.pages?.[k])]).filter(([, n]) => n).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<tr><td>${KIND_RO[k]}</td><td>${n}</td></tr>`).join('') || '<tr><td colspan="2">—</td></tr>')}</section>
<section><h2>Acțiuni, ultimele 7 zile</h2>${tbl(['Acțiune', 'De câte ori'], EVENTS.map(e => `<tr><td>${EVENT_RO[e]}</td><td>${sum(week, r => r.events?.[e])}</td></tr>`).join(''))}</section>
${countTables}
<section><h2>Păreri (${notes.length})</h2>${notes.map(n => `<div class="n"><small>${esc(n.at.slice(0, 16).replace('T', ' '))} UTC${n.page ? ' · ' + esc(n.page) : ''}${n.contact ? ' · ' + esc(n.contact) : ''}</small><div>${esc(n.text)}</div></div>`).join('') || '<p>Nicio părere încă.</p>'}</section>
</main></body></html>`);
};

export const config = { path: '/api/stats' };

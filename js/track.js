// Counts what happens on the site, for the owner's stats page (/api/stats): pages, where visitors came
// from, the device, how long they stay, the home sections they see, the teams and games they open, what
// they click, search picks, streaming services they look at, errors. Counted per day, never per person:
// no cookies, no IP, nothing personal; only two dates kept in this browser to tell new from returning.
// Not counted: "Do Not Track", and a device the owner switched off (?eu=1, or 5 taps on the version).
// What is gathered goes out in one request every few seconds, and when the page is left.
import { isStandalone } from './phone.js';
import { STORE } from './teams.js';

const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const set = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* blocked */ } };
const day = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(new Date());
const Q = new URLSearchParams(location.search);
if (Q.get('eu') === '1') set('flgames-notrack', '1');
if (Q.get('eu') === '0') set('flgames-notrack', null);   // the only way to take the owner's mark away
export const notCounted = () => get('flgames-notrack') === '1';
export function setNotCounted(on) { set('flgames-notrack', on ? '1' : null); }
const off = () => notCounted() || navigator.doNotTrack === '1' || location.protocol === 'file:';
const UA = navigator.userAgent || '';
const clean = s => String(s || '').replace(/[^\p{L}\p{N} .,'&()+:/-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);

/* ----- the visitor's facts, counted once per visitor and day ----- */
// Where this visit came from: ?sursa=instagram (or utm_source) in the link, else the in-app browser or the
// page before. Read once at start: the page later rewrites its own address.
const LANDING = (() => {
  const s = (Q.get('sursa') || Q.get('utm_source') || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30);
  // Kept for this tab: an automatic update reloads the page after its address lost ?sursa=.
  try { if (s) sessionStorage.setItem('flgames-src', s); else { const kept = sessionStorage.getItem('flgames-src'); if (kept) return kept; } } catch (e) { /* blocked */ }
  if (s) return s;
  // The Microsoft Store app starts at /?app=store (the packager dropped ?sursa from its start address).
  if (STORE) return 'msstore';
  if (/Instagram/i.test(UA)) return 'instagram';
  // TikTok's in-app browser (it sends no referrer): "musical_ly", "BytedanceWebview", "TikTok", "trill".
  if (/musical_ly|Bytedance|TikTok|\btrill_/i.test(UA)) return 'tiktok';
  if (/FBAN|FBAV|FB_IAB/i.test(UA)) return 'facebook';
  let h = '';
  try { h = new URL(document.referrer).hostname; } catch (e) { /* none */ }
  if (!h || h === location.hostname) return isStandalone() ? 'aplicatie' : 'direct';
  const known = [[/instagram/, 'instagram'], [/facebook|fb\.com/, 'facebook'], [/google\./, 'google'], [/bing\./, 'bing'], [/whatsapp/, 'whatsapp'],
    [/^t\.co$|twitter|(^|\.)x\.com$/, 'x'], [/reddit/, 'reddit'], [/tiktok/, 'tiktok'], [/youtube/, 'youtube'], [/linkedin/, 'linkedin']];
  return (known.find(([re]) => re.test(h)) || [])[1] || h.replace(/^www\./, '').slice(0, 40);
})();
const deviceOf = () => {
  const coarse = matchMedia('(pointer:coarse)').matches, small = Math.min(screen.width, screen.height) < 600;
  return coarse ? (small ? 'telefon' : 'tabletă') : 'calculator';
};
const osOf = () => /iPhone|iPod/.test(UA) ? 'iOS' : /iPad/.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1) ? 'iPadOS'
  : /Android/.test(UA) ? 'Android' : /Windows/.test(UA) ? 'Windows' : /Mac OS X/.test(UA) ? 'macOS' : /Linux/.test(UA) ? 'Linux' : 'altul';
const inappOf = () => /Instagram/i.test(UA) ? 'Instagram' : /FBAN|FBAV|FB_IAB/i.test(UA) ? 'Facebook' : /TikTok|musical_ly/i.test(UA) ? 'TikTok' : 'nu';

/* ----- the queue: one request every few seconds, and on leaving ----- */
let queue = [], timer = 0;
function flush() {
  clearTimeout(timer); timer = 0;
  if (!queue.length) return;
  const b = JSON.stringify({ b: queue.splice(0, 60) });
  try {
    if (!navigator.sendBeacon?.('/api/hit', new Blob([b], { type: 'application/json' }))) fetch('/api/hit', { method: 'POST', body: b, keepalive: true }).catch(() => {});
  } catch (e) { /* counting never breaks the page */ }
  if (queue.length) flush();
}
function push(hit) {
  if (off()) return;
  queue.push(hit);
  if (!timer) timer = setTimeout(flush, 4000);
}
export const count = (c, v) => { const x = clean(v); if (x) push({ c, v: x }); };
const once = new Set();
const countOnce = (c, v) => { const k = c + '|' + v; if (!once.has(k)) { once.add(k); count(c, v); } };

/* ----- pages ----- */
// "#meci/NBA/1" -> 'meci'; "#ligi/ghid" -> 'ghid'; no hash -> 'acasa'.
const PAGES = ['meci', 'echipa', 'club', 'oras', 'stadion', 'calendar', 'notificari', 'parere', 'confidentialitate', 'termeni', 'sustine'];
export function kindOf(hash) {
  const [a, b] = String(hash || '').replace(/^#/, '').split('/');
  if (!a) return 'acasa';
  if (a === 'ligi') return b === 'ghid' ? 'ghid' : 'ligi';
  return PAGES.includes(a) ? a : 'acasa';
}
let lastKind = '', lastAt = 0;
export function trackView(hash = location.hash) {
  if (off()) return;
  const parts = decodeURIComponent(String(hash || '').replace(/^#/, '')).split('/'), k = kindOf(hash);
  // The team or game behind the page (a team as its key, 'heat', or 'NBA-2'; a game by its league).
  if (k === 'echipa' && parts[1]) count('team', parts[1]);
  if (k === 'club' && parts[1] && parts[2]) count('team', `${parts[1]}-${parts[2]}`);
  if (k === 'meci' && parts[1]) count('game', parts[1]);
  if (k === 'ligi' && parts[1]) count('click', 'ligi ' + parts[1]);
  if (k === lastKind && Date.now() - lastAt < 3000) return;
  lastKind = k; lastAt = Date.now();
  const today = day(), first = !get('flgames-first'), f = get('flgames-seen') !== today;
  if (f) set('flgames-seen', today);
  if (first) set('flgames-first', today);
  const hit = { k, f, n: f && first, a: isStandalone() };
  if (f) Object.assign(hit, { src: LANDING, dev: deviceOf(), os: osOf(), inapp: inappOf() });
  push(hit);
}
export function trackEvent(e) { push({ e }); }

/* ----- what people do: clicks, sections seen, time on the site, errors ----- */
// A click on any of these counts as the named action (the first that matches).
const CLICKS = [
  ['[data-theme-set]', el => 'tema ' + el.dataset.themeSet],
  ['#tz-ro', () => 'ora României'], ['#tz-fl', () => 'ora SUA'],
  ['[data-jump]', el => 'bara ' + el.dataset.jump],
  ['[data-view]', el => 'calendar ' + el.dataset.view],
  ['[data-day]', () => 'calendar zi'],
  ['[data-goview]', el => 'fila ' + el.dataset.goview],
  ['.ytbtn', () => 'rezumat YouTube'],
  ['a[href*="espn.com"]', () => 'cronica ESPN'],
  ['[data-lgguide]', () => 'ghid din meci'],
  ['[data-welcome-done]', () => 'prima vizită: echipe alese'],
  ['[data-welcome-skip]', () => 'prima vizită: mai târziu'],
  ['[data-mine-add]', () => 'adaugă echipă'],
  ['[data-mine-toggle]', () => 'modifică echipele mele'],
  ['[data-install]', () => 'instalează'],
  ['[data-msstore]', () => 'Microsoft Store'],
  ['[data-nospoil]', () => 'fără spoilere'],
  ['[data-donate]', el => 'donează ' + el.dataset.donate],
  ['[data-donate-open]', () => 'susține proiectul'],
  ['[data-update]', () => 'caută actualizare'],
  ['[data-team-cal]', () => 'deschide calendar'],
  ['[data-team-ntf]', () => 'deschide notificări'],
  ['[data-tab]', el => 'meci ' + el.dataset.tab],
  ['[data-ttab]', el => 'echipă ' + el.dataset.ttab],
  ['[data-city]', () => 'oraș'], ['[data-venue]', () => 'stadion'],
  ['[data-share]', () => 'distribuie'],
  ['[data-sharecard]', () => 'imagine de distribuit'],
  ['#prof-x', () => 'închide fereastra']
];
const SECTIONS = ['hero', 'echipe', 'motd', 'todaylg', 'orase', 'deurmarit', 'program', 'upwrap', 'reswrap', 'harta', 'clasamente', 'playoffs', 'telefon'];
const SECTION_RO = { hero: 'urmează', echipe: 'echipele mele', motd: 'meciul zilei', todaylg: 'azi în ligi', orase: 'orașe', deurmarit: 'de urmărit', program: 'program',
  upwrap: 'următoarele meciuri', reswrap: 'rezultate', harta: 'hartă', clasamente: 'clasamente', playoffs: 'playoff', telefon: 'pe telefon' };
const DUR = s => s < 10 ? 'sub 10 s' : s < 60 ? '10-60 s' : s < 300 ? '1-5 min' : s < 900 ? '5-15 min' : 'peste 15 min';

export function setupActivity() {
  if (off()) return;
  document.addEventListener('click', e => {
    const t = e.target;
    // Search: the result picked (a team, a city, a stadium; never what was typed).
    const opt = t.closest?.('#qres [data-qi]');
    if (opt) { count('search', opt.querySelector('small')?.previousElementSibling?.textContent || ''); return; }
    // The streaming services in the guide: interest worth knowing for partnerships.
    const w = t.closest?.('.wopts a');
    if (w) { count('watch', w.textContent); return; }
    for (const [sel, name] of CLICKS) { const el = t.closest?.(sel); if (el) { count('click', name(el)); return; } }
  }, true);
  document.addEventListener('play', e => { if (e.target?.tagName === 'VIDEO') count('click', 'rezumat video'); }, true);
  // Home page sections: counted once per page load when at least 40% shows.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) { countOnce('sec', SECTION_RO[x.target.id] || x.target.id); io.unobserve(x.target); } }), { threshold: 0.4 });
    const watch = () => SECTIONS.forEach(id => { const el = document.getElementById(id); if (el && !el.hidden) io.observe(el); });
    setTimeout(watch, 2500);
  }
  // Time on the site: the visible time of this page load, sent when it is left (each opening counts).
  let shown = document.hidden ? 0 : Date.now(), total = 0, sent = false;
  const leave = () => {
    if (shown) { total += Date.now() - shown; shown = 0; }
    if (!sent && total > 1500) { sent = true; count('dur', DUR(total / 1000)); }
    flush();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) leave();
    else { shown = Date.now(); if (sent && total > 0) { sent = false; total = 0; } }
  });
  window.addEventListener('pagehide', leave);
  // Errors on visitors' devices, at most three per page load.
  let errs = 0;
  const err = msg => { if (errs++ < 3) count('err', 'js: ' + msg); };
  window.addEventListener('error', e => err(e.message || 'eroare'));
  window.addEventListener('unhandledrejection', e => err(String(e.reason?.message || e.reason || 'promisiune')));
}

// The app opened from the home screen for the first time on this device counts as an install (iPhone has
// no install event); on Android, the browser's own event.
export function trackInstall() {
  window.addEventListener('appinstalled', () => { set('flgames-app', '1'); trackEvent('install'); });
  if ((isStandalone() || STORE) && !get('flgames-app')) { set('flgames-app', '1'); trackEvent(STORE ? 'install-store' : 'install'); }
}

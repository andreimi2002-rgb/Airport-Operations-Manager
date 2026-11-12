// Counts visits for the owner's stats page (/api/stats): the kind of page, whether it is this browser's
// first view today and its first visit ever, whether it runs as the installed app, and a few actions.
// No cookies, nothing personal: only two dates kept in this browser. Not counted: "Do Not Track", and a
// device the owner switched off (?eu=1 in the address, or 5 taps on the version in the footer).
import { isStandalone } from './phone.js';

const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const set = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* blocked */ } };
const day = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(new Date());
if (new URLSearchParams(location.search).get('eu') === '1') set('flgames-notrack', '1');
export const notCounted = () => get('flgames-notrack') === '1';
export function setNotCounted(on) { set('flgames-notrack', on ? '1' : null); }
const off = () => notCounted() || navigator.doNotTrack === '1' || location.protocol === 'file:';
function send(body) {
  try {
    const b = JSON.stringify(body);
    if (!navigator.sendBeacon?.('/api/hit', new Blob([b], { type: 'application/json' }))) fetch('/api/hit', { method: 'POST', body: b, keepalive: true }).catch(() => {});
  } catch (e) { /* counting never breaks the page */ }
}

// "#meci/NBA/1" -> 'meci'; "#ligi/ghid" -> 'ghid'; no hash -> 'acasa'.
const PAGES = ['meci', 'echipa', 'club', 'oras', 'stadion', 'calendar', 'notificari', 'parere'];
export function kindOf(hash) {
  const [a, b] = String(hash || '').replace(/^#/, '').split('/');
  if (!a) return 'acasa';
  if (a === 'ligi') return b === 'ghid' ? 'ghid' : 'ligi';
  return PAGES.includes(a) ? a : 'acasa';
}
let lastKind = '', lastAt = 0;
export function trackView(hash = location.hash) {
  if (off()) return;
  const k = kindOf(hash);
  if (k === lastKind && Date.now() - lastAt < 3000) return;
  lastKind = k; lastAt = Date.now();
  const today = day(), first = !get('flgames-first'), f = get('flgames-seen') !== today;
  if (f) set('flgames-seen', today);
  if (first) set('flgames-first', today);
  send({ k, f, n: f && first, a: isStandalone() });
}
export function trackEvent(e) { if (!off()) send({ e }); }

// The app opened from the home screen for the first time on this device counts as an install (iPhone has
// no install event); on Android, the browser's own event.
export function trackInstall() {
  window.addEventListener('appinstalled', () => { set('flgames-app', '1'); trackEvent('install'); });
  if (isStandalone() && !get('flgames-app')) { set('flgames-app', '1'); trackEvent('install'); }
}

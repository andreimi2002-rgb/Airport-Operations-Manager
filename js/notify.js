// Notifications page (#notificari): permission, push subscription, the viewer's choices.
// The server side is netlify/functions/push.mjs; the sending, every 15 minutes, push-cron.mjs.
import { TEAMS, parseClub } from './teams.js';
import { esc } from './ui.js';
import { isStandalone } from './phone.js';
import { trackEvent } from './track.js';

export const N = { status: 'unknown', teams: [], lead: 60, final: true, morning: true, msg: '', busy: false, key: null };
let onChange = () => {};
export const setNotifyRender = fn => { onChange = fn; };
const LEADS = [[15, 'cu 15 minute înainte'], [30, 'cu 30 de minute înainte'], [60, 'cu o oră înainte'], [120, 'cu 2 ore înainte'], [180, 'cu 3 ore înainte'], [0, 'fără anunț înainte']];
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const keyBytes = k => { const b = atob(k.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((k.length + 3) % 4)); return Uint8Array.from(b, c => c.charCodeAt(0)); };
const post = (body) => fetch('/api/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Eroare ' + r.status); return j; });
const reg = () => navigator.serviceWorker.ready;

// Works out where this browser stands: not supported, iPhone not installed, off, on (with its saved choices)…
export async function refreshNotify(defaults) {
  if (!N.teams.length) N.teams = defaults;
  if (!supported()) { N.status = isIOS() && !isStandalone() ? 'ios-install' : 'unsupported'; return onChange(); }
  try {
    N.key ??= (await fetch('/api/push').then(r => r.json())).publicKey;
    if (!N.key) { N.status = 'noconfig'; return onChange(); }
    if (Notification.permission === 'denied') { N.status = 'denied'; return onChange(); }
    const s = await (await reg()).pushManager.getSubscription();
    if (!s) { N.status = 'off'; return onChange(); }
    const { prefs } = await post({ action: 'get', subscription: s.toJSON() });
    // Teams of the other pack (saved while this device showed it) are not on the page: they drop out at the
    // next save, so no notification comes for a team that cannot be seen or unticked here.
    if (prefs) { Object.assign(N, prefs); N.teams = N.teams.filter(k => TEAMS[k] || parseClub(k)); N.status = 'on'; } else N.status = 'off';
  } catch (e) { N.status = navigator.onLine ? 'error' : 'offline'; N.msg = navigator.onLine ? String(e.message || e) : ''; }
  onChange();
}

async function run(fn, ok) {
  N.busy = true; N.msg = ''; onChange();
  try { await fn(); if (ok) N.msg = ok; } catch (e) { N.msg = String(e.message || e); }
  N.busy = false; onChange();
}
const prefs = () => ({ teams: N.teams, lead: N.lead, final: N.final, morning: N.morning });
// Turning on must start from a tap: browsers only show the permission question after one.
export const enableNotify = () => run(async () => {
  const p = await Notification.requestPermission();
  if (p !== 'granted') { N.status = p === 'denied' ? 'denied' : 'off'; throw new Error('Notificările nu au fost permise.'); }
  const r = await reg();
  const s = (await r.pushManager.getSubscription()) || await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(N.key) });
  await post({ action: 'save', subscription: s.toJSON(), prefs: prefs() });
  N.status = 'on';
  trackEvent('notify-on');
}, 'Gata: notificările sunt pornite. Încearcă „Trimite o notificare de test”.');
export const saveNotify = () => run(async () => {
  const s = await (await reg()).pushManager.getSubscription();
  if (!s) { N.status = 'off'; throw new Error('Notificările nu mai sunt pornite în acest browser.'); }
  await post({ action: 'save', subscription: s.toJSON(), prefs: prefs() });
}, 'Am salvat alegerile.');
export const testNotify = () => run(async () => {
  const s = await (await reg()).pushManager.getSubscription();
  if (!s) throw new Error('Pornește întâi notificările.');
  await post({ action: 'test', subscription: s.toJSON() });
}, 'Am trimis notificarea de test; ar trebui să apară în câteva secunde.');
export const disableNotify = () => run(async () => {
  const s = await (await reg()).pushManager.getSubscription();
  if (s) { await post({ action: 'delete', subscription: s.toJSON() }).catch(() => {}); await s.unsubscribe(); }
  N.status = 'off';
}, 'Notificările sunt oprite pe acest dispozitiv.');

const STATUS = {
  unknown: ['info', 'Verific dacă browserul acceptă notificări…'],
  unsupported: ['warn', 'Browserul acesta nu acceptă notificări. Merg în Chrome, Edge, Firefox și Samsung Internet, iar pe iPhone în aplicația instalată.'],
  'ios-install': ['warn', 'Pe iPhone, notificările merg doar din aplicația instalată: în Safari apasă Partajează → Adaugă pe ecranul principal, deschide aplicația de pe ecran și pornește notificările de acolo.'],
  noconfig: ['warn', 'Notificările nu sunt încă pornite pe această versiune a site-ului.'],
  denied: ['warn', 'Notificările sunt blocate pentru acest site. Le poți permite din setările browserului (iconița de lângă adresă) sau ale telefonului, apoi revii aici.'],
  off: ['info', 'Notificările sunt oprite pe acest dispozitiv.'],
  on: ['ok', 'Notificările sunt pornite pe acest dispozitiv.'],
  offline: ['warn', 'Ești offline. Setările notificărilor se pot schimba doar cu internet.'],
  error: ['warn', 'Nu am putut verifica notificările acum.']
};

// `emb(id)` draws a team emblem; `clubs` = the followed teams from outside Florida: [{ id, l, name }].
export function notifyHtml(emb, clubs = [], addHtml = '') {
  const [kind, text] = STATUS[N.status] || STATUS.unknown;
  const can = ['off', 'on'].includes(N.status), on = N.status === 'on';
  const byL = {};
  for (const k in TEAMS) (byL[TEAMS[k].l] ||= []).push(k);
  return `<div class="band plain"><div><div class="lgn" style="color:var(--accent)">Pe telefon</div><h2 id="prof-name" style="font-size:24px">Notificări</h2></div>
      <button class="x" type="button" id="prof-x" aria-label="Închide">×</button></div>
    <div class="pbody">
    <p class="lead">Un anunț înainte de meciurile echipelor tale, rezultatul final și, dimineața, ce s-a întâmplat azi-noapte, chiar și cu aplicația închisă.</p>
    <p class="nstat ${kind}" role="status">${esc(text)}</p>
    ${can ? `<section><h3>Echipele</h3>
      <div class="calteams">${Object.entries(byL).map(([l, ks]) => `<div class="calgrp"><b>${l}</b>${ks.map(k => `<label class="calteam"><input type="checkbox" data-ntfteam="${k}" ${N.teams.includes(k) ? 'checked' : ''}>${emb(k)}<span>${esc(TEAMS[k].espn)}</span></label>`).join('')}</div>`).join('')}${clubs.length ? `<div class="calgrp"><b>Din alte orașe</b>${clubs.map(c => `<label class="calteam"><input type="checkbox" data-ntfteam="${esc(c.id)}" ${N.teams.includes(c.id) ? 'checked' : ''}>${emb(c.id)}<span>${esc(c.name)} <small>${esc(c.l)}</small></span></label>`).join('')}</div>` : ''}</div>
      ${addHtml}
    </section>
    <section><h3>Când</h3>
      <select id="ntflead" aria-label="Cu cât timp înainte de meci">${LEADS.map(([m, t]) => `<option value="${m}" ${m === N.lead ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <label class="check" style="margin-top:8px"><input type="checkbox" id="ntffinal" ${N.final ? 'checked' : ''}> Și rezultatul final, când se termină meciul</label>
      <label class="check" style="margin-top:8px"><input type="checkbox" id="ntfmorning" ${N.morning ? 'checked' : ''}> Rezumatul de dimineață, la 8:00: rezultatele de azi-noapte și meciul următor</label>
    </section>
    <div class="btns">${on
      ? `<button class="primary" type="button" data-ntf="save" ${N.busy ? 'disabled' : ''}>Salvează alegerile</button><button class="ghost" type="button" data-ntf="test" ${N.busy ? 'disabled' : ''}>Trimite o notificare de test</button><button class="ghost" type="button" data-ntf="off" ${N.busy ? 'disabled' : ''}>Oprește notificările</button>`
      : `<button class="primary" type="button" data-ntf="on" ${N.busy || !N.teams.length ? 'disabled' : ''}>Pornește notificările</button>`}</div>` : ''}
    ${N.msg ? `<p class="nmsg" role="status">${esc(N.msg)}</p>` : ''}
    <section><h3>De știut</h3><ul class="notes">
      <li>Anunțurile pleacă de pe server la fiecare 15 minute, deci pot veni cu câteva minute mai devreme sau mai târziu.</li>
      <li>Setările sunt pe fiecare dispozitiv în parte: pe telefon și pe calculator le pornești separat.</li>
      <li>Pentru meciurile fără oră anunțată nu vine anunț înainte; rezultatul final vine.</li>
      <li>Rezumatul de dimineață vine doar în zilele în care echipele tale au jucat: ✓ înseamnă victorie, ✗ înfrângere.</li>
    </ul></section>
    </div>`;
}

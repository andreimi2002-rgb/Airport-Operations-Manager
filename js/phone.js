// The phone side: offline support (service worker), installing the app, the calendar subscription page
// and the "add this game to my calendar" download.
import { TEAMS, parseClub } from './teams.js';
import { esc } from './ui.js';
import { calendar } from './ics.js';

/* ================= offline ================= */
export function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const sw = navigator.serviceWorker;
  // After the page has loaded, so the first visit is not slowed down.
  window.addEventListener('load', () => sw.register('/sw.js', { updateViaCache: 'none' }).catch(() => {}));
  // An installed app is usually brought back from the background, not started again: the old page
  // stays in memory and the browser only looks for a new version on a full start. So look on every
  // return to the app (at most every 2 minutes) and, when the new version has taken over, reload once.
  let checked = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (pendingReload) { location.reload(); return; }
    if (Date.now() - checked < 120e3) return;
    checked = Date.now();
    sw.getRegistration().then(r => r?.update()).catch(() => {});
  });
  const hadController = !!sw.controller;   // the first install also "takes over": no reload for that
  let reloaded = false, pendingReload = false;
  sw.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    if (document.hidden) pendingReload = true; else location.reload();
  });
}

/* ================= install ================= */
let deferred = null;
const listeners = new Set();
export const onInstallChange = fn => listeners.add(fn);
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; listeners.forEach(f => f()); });
window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach(f => f()); });
export const canInstall = () => !!deferred;
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export async function install() {
  if (!deferred) return false;
  deferred.prompt();
  const r = await deferred.userChoice.catch(() => null);
  deferred = null; listeners.forEach(f => f());
  return r?.outcome === 'accepted';
}
const SHARE = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" style="vertical-align:-3px"><path d="M12 3v12M7.5 7.5L12 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 11H5v10h14V11h-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
export function installHtml() {
  if (isStandalone()) return '<p class="ok">Folosești aplicația instalată. Merge și fără internet, cu datele salvate la ultima deschidere.</p>';
  if (deferred) return '<p>Pune Meciuri Florida pe ecranul principal: se deschide ca o aplicație, fără bara browserului, și merge și fără internet.</p><button class="primary" type="button" data-install>Instalează aplicația</button>';
  if (isIOS()) return `<p>Pe iPhone, din Safari: apasă <b>Partajează</b> ${SHARE}, apoi <b>Adaugă pe ecranul principal</b>. Aplicația se deschide fără bara browserului și merge și fără internet.</p>`;
  return '<p>Din meniul browserului alege <b>Instalează aplicația</b> sau <b>Adaugă pe ecranul principal</b> (Chrome, Edge, Samsung Internet). Pe iPhone: Safari → Partajează → Adaugă pe ecranul principal.</p>';
}

/* ================= calendar subscription ================= */
export const ALARMS = [[0, 'fără amintire'], [15, 'cu 15 minute înainte'], [30, 'cu 30 de minute înainte'], [60, 'cu o oră înainte'], [120, 'cu 2 ore înainte'], [180, 'cu 3 ore înainte']];
export function feedUrl(teams, alarm) {
  // Florida teams in their usual order, then the followed teams from elsewhere ('NBA-2').
  const list = [...Object.keys(TEAMS).filter(k => teams.includes(k)), ...teams.filter(k => parseClub(k))];
  return `${location.origin}/api/calendar.ics?e=${list.join(',')}${alarm ? `&a=${alarm}` : ''}`;
}
export function calendarLinks(url, name) {
  const webcal = url.replace(/^https?:/, 'webcal:');
  return {
    google: 'https://calendar.google.com/calendar/r?cid=' + encodeURIComponent(webcal),
    apple: webcal,
    outlook: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`
  };
}
// The page content; `sel` = chosen teams (Florida keys, 'NBA-2'), `alarm` = minutes, `emb(id)` draws a
// team emblem, `clubs` = the followed teams from outside Florida: [{ id, l, name }].
export function calendarHtml(sel, alarm, emb, clubs = []) {
  const url = sel.length ? feedUrl(sel, alarm) : '';
  const nameOf = k => TEAMS[k]?.s || clubs.find(c => c.id === k)?.name || k;
  const name = sel.length === Object.keys(TEAMS).length && sel.every(k => TEAMS[k]) ? 'Meciuri Florida' : 'Meciuri: ' + sel.map(nameOf).join(', ');
  const L = url ? calendarLinks(url, name) : null;
  const byL = {};
  for (const k in TEAMS) (byL[TEAMS[k].l] ||= []).push(k);
  return `<div class="band plain"><div><div class="lgn" style="color:var(--accent)">Pe telefon și în calendar</div><h2 id="prof-name" style="font-size:24px">Abonare la calendar</h2></div>
      <button class="x" type="button" id="prof-x" aria-label="Închide">×</button></div>
    <div class="pbody">
    <p class="lead">Meciurile echipelor alese apar singure în calendarul tău (Google, iPhone, Outlook), la ora ta, și se actualizează când se schimbă ora sau se termină un meci.</p>
    <section><h3>1. Alege echipele</h3>
      <div class="calteams">${Object.entries(byL).map(([l, ks]) => `<div class="calgrp"><b>${l}</b>${ks.map(k => `<label class="calteam"><input type="checkbox" data-calteam="${k}" ${sel.includes(k) ? 'checked' : ''}>${emb(k)}<span>${esc(TEAMS[k].espn)}</span></label>`).join('')}</div>`).join('')}${clubs.length ? `<div class="calgrp"><b>Din alte orașe</b>${clubs.map(c => `<label class="calteam"><input type="checkbox" data-calteam="${esc(c.id)}" ${sel.includes(c.id) ? 'checked' : ''}>${emb(c.id)}<span>${esc(c.name)} <small>${esc(c.l)}</small></span></label>`).join('')}</div>` : ''}</div>
      <div class="btns"><button class="ghost" type="button" data-calall="1">Toate</button><button class="ghost" type="button" data-calall="0">Niciuna</button></div>
    </section>
    <section><h3>2. Amintire</h3>
      <select id="calalarm" aria-label="Amintire înainte de meci">${ALARMS.map(([m, t]) => `<option value="${m}" ${m === alarm ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <div class="fn">Amintirea o afișează aplicația de calendar. iPhone, Mac și Outlook o preiau; Google Calendar de obicei nu preia amintirile din calendarele la care ești abonat.</div>
    </section>
    <section><h3>3. Adaugă calendarul</h3>
      ${url ? `<div class="calbtns">
        <a class="primary" href="${esc(L.google)}" target="_blank" rel="noopener">Google Calendar</a>
        <a class="primary" href="${esc(L.apple)}">iPhone, iPad, Mac</a>
        <a class="ghost" href="${esc(L.outlook)}" target="_blank" rel="noopener">Outlook</a>
      </div>
      <div class="calurl"><input id="calurl" type="text" readonly value="${esc(url)}" aria-label="Linkul calendarului"><button class="ghost" type="button" data-copycal>Copiază linkul</button></div>
      <div class="fn">Pentru alte aplicații: adaugă un calendar „din URL” sau „prin abonare” și lipește linkul.</div>` : '<div class="empty">Alege cel puțin o echipă.</div>'}
    </section>
    <section><h3>De știut</h3><ul class="notes">
      <li>Calendarul are meciurile din ultimele 45 de zile (cu scorul final) și toate meciurile programate ale sezonului.</li>
      <li>Orele sunt scrise în timpul universal, așa că apar automat la ora ta, în România sau oriunde ai fi.</li>
      <li>Meciurile fără oră anunțată apar ca eveniment pe toată ziua și primesc ora când o anunță ligile.</li>
      <li>iPhone și Mac verifică noutățile după cum alegi la setările calendarului. Google Calendar actualizează calendarele abonate în ritmul lui, de obicei de câteva ori pe zi.</li>
    </ul></section>
    </div>`;
}

// One game as a downloadable .ics file (raw game from /api/schedule).
export function downloadGame(raw) {
  const body = calendar([raw], { name: 'Meci', site: location.origin });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([body], { type: 'text/calendar;charset=utf-8' }));
  a.download = `meci-${raw.l.toLowerCase()}-${raw.id}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

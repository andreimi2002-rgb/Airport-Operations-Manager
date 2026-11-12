// Entry point: theme, the page events, loading the season (live, then cached, then the snapshot),
// live scores. The rest is in core.js (data, state), home.js, pages.js (overlays, router), views.js, search.js.
import { LEAGUES, TEAMS, parseClub } from './teams.js';
import { toggleMine, resetMine } from './mine.js';
import { $, theme, isDark, onSystemTheme } from './ui.js';
import { wpHover } from './game.js';
import { registerSW, onInstallChange, install, downloadGame, APP_VERSION, checkUpdate } from './phone.js';
import { seasonHover } from './teamx.js';
import { N, setNotifyRender, enableNotify, saveNotify, testNotify, disableNotify, notifyHtml } from './notify.js';
import { PLACES, loadPlaces, climateHover, AMERICA, loadAmerica } from './places.js';
import { CACHE_KEY, DATA, GAMES, addDays, awake, build, gameById, getJSON, isLive, parts, played, state, store, weekStart } from './core.js';
import { PLAYOFFS, PO, minePick, render, renderHero, renderMap, renderMine, renderPhone, renderPlayoffs, renderSources, renderStatic, renderStatus, renderStrip } from './home.js';
import { OV, cal, closeOv, clubSide, clubView, gameView, go, loadGame, notifyOpen, openCalendar, openClub, openTeam, pickerClubs, refreshGame, route, saveCal, setTeamTab, share, show, teamEmb } from './pages.js';
import { LG, navView, renderLeagues, renderTodayStrip, setLgHash, setupJump, usKey } from './views.js';
import { pickSearch } from './search.js';
import { loadHealth } from './health.js';
import { trackEvent, trackInstall, setNotCounted, notCounted } from './track.js';

/* ----- theme ----- */
function applyTheme() {
  const r = document.documentElement;
  if (theme.pref === 'auto') delete r.dataset.theme; else r.dataset.theme = theme.pref;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = isDark() ? '#060d1a' : '#0e1f3d'; // the brand bar
  document.querySelectorAll('[data-theme-set]').forEach(b => b.setAttribute('aria-pressed', b.dataset.themeSet === theme.pref));
}
function setTheme(t) {
  theme.pref = t;
  t === 'auto' ? store.del('flgames-theme') : store.set('flgames-theme', t);
  applyTheme();
  rerenderAll();
}
// Logos differ between light and dark, so everything with an emblem is drawn again.
function rerenderAll() {
  if (!GAMES.length) return;
  renderStatic(); render();
  if (!$('ov').hidden) route(true);
}
applyTheme();
onSystemTheme(() => { applyTheme(); rerenderAll(); });

/* ================= events ================= */
let vtaps = 0, vtapAt = 0;
function setTz(z) { state.tz = z; state.day = null; state.week = null; state.month = null; store.set('flgames-tz', z); render(); }
function resetFilters() { state.team = ''; state.home = false; state.awake = false; $('homeonly').checked = false; $('awake').checked = false; Object.keys(LEAGUES).forEach(l => state.leagues.add(l)); renderStatic(); }
$('tz-ro').onclick = () => setTz('ro');
$('tz-fl').onclick = () => setTz('fl');
$('team').onchange = e => { state.team = e.target.value; render(); };
$('homeonly').onchange = e => { state.home = e.target.checked; render(); };
$('awake').onchange = e => { state.awake = e.target.checked; render(); };
$('clear').onclick = () => { state.day = null; render(); };
$('more').onclick = () => { state.agendaDays += 7; render(); };
// Open or closed, the schedule stays as the viewer left it.
{
  const s = store.get('flgames-prog'); if (s === 'closed') $('upwrap').open = false;
  $('upwrap').addEventListener('toggle', () => store.set('flgames-prog', $('upwrap').open ? 'open' : 'closed'));
}
const gameHash = (g, tab) => `#meci/${g.l}/${g.id}${tab && tab !== 'rezumat' ? '/' + tab : ''}`;
function setTab(t) {
  const g = gameById(OV.game); if (!g) return;
  gameView.tab = t;
  history.replaceState(history.state, '', location.pathname + location.search + gameHash(g, t));
  refreshGame(g);
  const b = document.querySelector(`#gtabs [data-tab="${t}"]`); if (b) b.focus({ preventScroll: true });
}
function handle(e) {
  const q = s => e.target.closest(s);
  let el;
  if ((el = q('[data-theme-set]'))) { setTheme(el.dataset.themeSet); return; }
  if (q('.clim rect.hit')) { climateHover(e); return; }   // a tap on a month shows its numbers
  if (!GAMES.length && !q('#reload')) return;
  if (q('#prof-x') || e.target === $('ov')) { closeOv(); return; }
  if ((el = q('#reload'))) { load(true); return; }
  if ((el = q('[data-share]'))) { share(el); return; }
  if ((el = q('[data-install]'))) { install(); return; }
  if ((el = q('[data-team-ntf]'))) { const k = el.dataset.teamNtf; go('#notificari' + (k ? '/' + k : '')); return; }
  if ((el = q('[data-ntf]'))) { ({ on: enableNotify, save: saveNotify, test: testNotify, off: disableNotify })[el.dataset.ntf]?.(); return; }
  if ((el = q('[data-team-cal]'))) { const k = el.dataset.teamCal; go('#calendar' + (k ? '/' + k : '')); return; }
  if ((el = q('[data-calall]'))) { cal.teams = el.dataset.calall === '1' ? [...Object.keys(TEAMS), ...pickerClubs(cal.teams).map(c => c.id)] : []; saveCal(); openCalendar(true); return; }
  if ((el = q('[data-copycal]'))) {
    const inp = $('calurl');
    navigator.clipboard?.writeText(inp.value).then(() => { el.textContent = 'Link copiat ✓'; }, () => { inp.select(); el.textContent = 'Selectat: apasă Ctrl+C'; });
    setTimeout(() => { if (el.isConnected) el.textContent = 'Copiază linkul'; }, 2500);
    return;
  }
  if ((el = q('[data-ics-game]'))) { const raw = gameById(el.dataset.icsGame)?.raw; if (raw) downloadGame(raw); return; }
  if ((el = q('[data-tab]'))) { setTab(el.dataset.tab); return; }
  if ((el = q('[data-ttab]'))) {
    if (location.hash.startsWith('#club/')) {
      const [, l, id] = location.hash.slice(1).split('/');
      clubView.tab = el.dataset.ttab;
      history.replaceState(history.state, '', location.pathname + location.search + `#club/${l}/${id}${clubView.tab !== 'rezumat' ? '/' + clubView.tab : ''}`);
      openClub(l, id, true);
    } else setTeamTab(el.dataset.ttab);
    return;
  }
  // Counted actions that also go on to their normal handling.
  if (e.target.closest('a[href^="webcal:"], a[href*="calendar.google.com"], [data-copycal]')) trackEvent('calendar');
  if ((el = q('[data-feedback]'))) { e.preventDefault(); go('#parere'); return; }
  if ((el = q('[data-fb-send]'))) {
    const text = $('fbtext').value.trim(), contact = $('fbcontact').value.trim(), msg = $('fbmsg');
    if (text.length < 3) { msg.textContent = 'Scrie câteva cuvinte.'; return; }
    el.disabled = true; msg.textContent = 'Se trimite…';
    fetch('/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, contact, page: matchMedia('(display-mode: standalone)').matches || navigator.standalone ? 'din aplicație' : 'din browser' }) })
      .then(r => r.json().then(j => { if (!r.ok) throw new Error(j.error || 'Eroare ' + r.status); }))
      .then(() => { trackEvent('feedback'); $('fbtext').value = ''; msg.className = 'nmsg ok'; msg.textContent = 'Mulțumim! Am primit mesajul.'; })
      .catch(x => { msg.className = 'nmsg'; msg.textContent = navigator.onLine ? String(x.message || x) : 'Ești offline; încearcă din nou cu internet.'; })
      .finally(() => { el.disabled = false; });
    return;
  }
  if ((el = q('#appver'))) {
    // Five taps on the version: this device's visits are (no longer) counted. For the owner.
    vtaps = Date.now() - vtapAt < 1500 ? vtaps + 1 : 1; vtapAt = Date.now();
    if (vtaps >= 5) { vtaps = 0; setNotCounted(!notCounted()); el.textContent = notCounted() ? 'Vizitele de pe acest dispozitiv nu se numără' : 'Vizitele de pe acest dispozitiv se numără'; }
    return;
  }
  // Footer: look for a newer version now (the installed app also does it on every return).
  if ((el = q('[data-update]'))) {
    el.textContent = 'Caut…';
    checkUpdate(true).then(v => { el.textContent = !v ? 'Nu am putut verifica' : v === APP_VERSION ? 'Ai ultima versiune ✓' : 'Se actualizează…'; });
    return;
  }
  if ((el = q('[data-goview]'))) {
    e.preventDefault();
    if (el.dataset.lgonly) { LG.chosen = new Set([el.dataset.lgonly]); LG.tab = 'scoruri'; LG.day = null; }
    if (el.dataset.lgto) LG.tab = el.dataset.lgto;
    if (el.dataset.lgguide && LEAGUES[el.dataset.lgguide]) LG.chosen = new Set([el.dataset.lgguide]);
    if (el.dataset.goview === 'ligi') navView('#ligi' + (LG.tab !== 'scoruri' ? '/' + LG.tab : ''));
    else navView('');
    return;
  }
  if ((el = q('[data-lgtab]'))) { LG.tab = el.dataset.lgtab; setLgHash(); renderLeagues(); return; }
  if ((el = q('[data-lgl]'))) { const l = el.dataset.lgl; LG.chosen.has(l) && LG.chosen.size > 1 ? LG.chosen.delete(l) : LG.chosen.add(l); renderLeagues(); return; }
  if ((el = q('[data-lgday]'))) { const n = +el.dataset.lgday; LG.day = n ? addDays(LG.day || usKey(new Date()), n) : usKey(new Date()); setLgHash(); renderLeagues(); return; }
  if ((el = q('[data-club]'))) { const [l, id] = el.dataset.club.split('|'); go(`#club/${l}/${id}`); return; }
  if ((el = q('[data-qi]'))) { pickSearch(+el.dataset.qi); return; }
  if ((el = q('[data-pl]'))) { PO.league = el.dataset.pl; renderPlayoffs(); return; }
  if ((el = q('[data-side]'))) { gameView.side = el.dataset.side; const g = gameById(OV.game); if (g) refreshGame(g); return; }
  if ((el = q('[data-mine-toggle]'))) {
    const id = el.dataset.mineToggle, inPick = !!el.closest('.minepick');
    toggleMine(id, parseClub(id) ? clubSide(id) : {});
    renderMine(); renderHero();
    // Keep the place: the same button in the list, or the "add" card after a team was taken out.
    (inPick ? document.querySelector(`.minepick [data-mine-toggle="${CSS.escape(id)}"]`) : document.querySelector('[data-mine-add]'))?.focus({ preventScroll: true });
    return;
  }
  if ((el = q('[data-mine-add]'))) { minePick.open = !minePick.open; renderMine(); if (minePick.open) $('minefilter')?.focus({ preventScroll: true }); return; }
  if ((el = q('[data-mine-close]'))) { minePick.open = false; minePick.q = ''; renderMine(); document.querySelector('[data-mine-add]')?.focus({ preventScroll: true }); return; }
  if ((el = q('[data-mine-reset]'))) { resetMine(); renderMine(); renderHero(); return; }
  if ((el = q('[data-follow]'))) {
    // Follow / stop following: a Florida team, or any team ('NBA-2'), with its name and logo.
    const id = el.dataset.follow, c = parseClub(id);
    toggleMine(id, c ? clubSide(id) : {});
    renderStatic(); render();
    if (c) openClub(c.l, c.id, true); else openTeam(id, true);
    return;
  }
  if ((el = q('[data-only]'))) { resetFilters(); state.team = el.dataset.only; state.day = null; closeOv(); render(); $('cal').scrollIntoView({ block: 'start' }); return; }
  if ((el = q('[data-game]'))) { const g = gameById(el.dataset.game); if (g) { gameView.tab = 'rezumat'; gameView.side = ''; go(gameHash(g)); } return; }
  if ((el = q('[data-team]'))) { go('#echipa/' + el.dataset.team); return; }
  if ((el = q('[data-city]'))) { go('#oras/' + el.dataset.city); return; }
  if ((el = q('[data-venue]'))) { go('#stadion/' + el.dataset.venue); return; }
  if ((el = q('[data-l]'))) { const l = el.dataset.l; state.leagues.has(l) ? state.leagues.delete(l) : state.leagues.add(l); el.setAttribute('aria-pressed', state.leagues.has(l)); render(); return; }
  if ((el = q('[data-view]'))) { state.view = el.dataset.view; store.set('flgames-view', state.view); render(); return; }
  if ((el = q('[data-wk]'))) { state.week = addDays(state.week, +el.dataset.wk); render(); return; }
  if ((el = q('[data-mo]'))) { const [y, m] = parts(state.month + '-01'); const d = new Date(Date.UTC(y, m - 1 + (+el.dataset.mo), 1)); state.month = d.toISOString().slice(0, 7); render(); return; }
  if ((el = q('[data-metro]'))) { state.metro = el.dataset.metro; renderMap(); return; }
  if ((el = q('[data-day]'))) {
    const k = el.dataset.day, jump = !!el.dataset.jump;
    state.day = (state.day === k && !jump) ? null : k;
    if (jump) { resetFilters(); if (!$('ov').hidden) closeOv(); state.week = weekStart(k); state.month = k.slice(0, 7); }
    // A chosen day always shows its games, even if the schedule was folded away.
    if (state.day) $('upwrap').open = true;
    render(); if (jump || state.view === 'week') $('upwrap').scrollIntoView({ block: 'start' });
  }
}
document.addEventListener('click', handle);
// Calendar page: ticking a team or choosing a reminder rebuilds the links at once.
document.addEventListener('change', e => {
  const t = e.target;
  // Notifications page: choices change in place; "Salvează" sends them.
  if (t.dataset?.ntfteam || t.id === 'ntflead' || t.id === 'ntffinal' || t.id === 'ntfmorning') {
    if (t.dataset.ntfteam) { const k = t.dataset.ntfteam; N.teams = t.checked ? [...new Set([...N.teams, k])] : N.teams.filter(x => x !== k); }
    if (t.id === 'ntflead') N.lead = +t.value;
    if (t.id === 'ntffinal') N.final = t.checked;
    if (t.id === 'ntfmorning') N.morning = t.checked;
    N.msg = N.status === 'on' ? 'Apasă „Salvează alegerile” ca să se aplice.' : '';
    show(notifyHtml(teamEmb, pickerClubs(N.teams)), true);
    const again = t.id ? $(t.id) : document.querySelector(`[data-ntfteam="${t.dataset.ntfteam}"]`);
    if (again) again.focus({ preventScroll: true });
    return;
  }
  if (t.dataset && t.dataset.calteam) {
    const k = t.dataset.calteam;
    cal.teams = t.checked ? [...new Set([...cal.teams, k])] : cal.teams.filter(x => x !== k);
  } else if (t.id === 'calalarm') cal.alarm = +t.value;
  else return;
  saveCal(); openCalendar(true);
  const again = t.id === 'calalarm' ? $('calalarm') : document.querySelector(`[data-calteam="${t.dataset.calteam}"]`);
  if (again) again.focus({ preventScroll: true });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('ov').hidden) closeOv();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('g[data-metro]')) { e.preventDefault(); handle(e); }
  // Arrow keys move between the game tabs.
  const tab = e.target.closest && e.target.closest('[role="tab"]');
  if (tab && (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Home' || e.key === 'End')) {
    const all = [...tab.parentNode.querySelectorAll('[role="tab"]')], i = all.indexOf(tab);
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length;
    e.preventDefault(); all[j].dataset.ttab ? setTeamTab(all[j].dataset.ttab) : setTab(all[j].dataset.tab);
  }
});
document.addEventListener('pointermove', e => { wpHover(e); climateHover(e); seasonHover(e); });
document.addEventListener('pointerleave', e => {
  if (!e.target.matches) return;
  if (e.target.matches('.clim svg, .clim svg *')) climateHover({ type: 'pointerleave', target: e.target });
  if (e.target.matches('.seas svg, .seas svg *')) seasonHover({ type: 'pointerleave', target: e.target });
}, true);
document.addEventListener('pointerleave', e => { if (e.target.matches && e.target.matches('svg.wp, svg.wp *')) wpHover({ ...e, type: 'pointerleave', target: e.target, clientX: e.clientX }); }, true);

/* ================= loading, refresh, live scores ================= */
function apply(raw, mode) {
  DATA.raw = raw; DATA.mode = mode; DATA.loadedAt = mode === 'live' ? Date.now() : new Date(raw.updated).getTime();
  build(raw);
  $('banner').hidden = true;
  renderStatic(); render();
  scheduleLive();
  PLAYOFFS.clear(); renderPlayoffs();
  if (mode !== 'snapshot') renderTodayStrip();
  // The rest of America's stadiums: links on away games, weather for Florida's away games.
  if (!AMERICA.data) loadAmerica()?.then(d => { if (d && GAMES.length) { render(); if (!$('ov').hidden) route(true); } });
  if (LG.view === 'ligi') renderLeagues();
  // First data: open the game or team named in the address. Later reloads only refresh what is open.
  if (!routed) { routed = true; route(); }
  else if (!$('ov').hidden) { const g = gameById(OV.game); if (g) refreshGame(g); }
}
let routed = false;
let loading = false;
async function load(manual) {
  if (loading) return; loading = true;
  if (manual) { $('status').className = 'status'; $('status').textContent = 'Se reîncarcă…'; }
  try {
    const raw = await getJSON('/api/schedule');
    if (!raw.games || !raw.games.length) throw new Error('fără meciuri');
    store.set(CACHE_KEY, JSON.stringify(raw));
    apply(raw, 'live');
  } catch (e) {
    if (DATA.mode === 'live' || DATA.mode === 'cache') { renderStatus(); }
    else {
      const c = store.get(CACHE_KEY);
      let used = false;
      if (c) { try { apply(JSON.parse(c), 'cache'); used = true; } catch (x) { store.del(CACHE_KEY); } }
      if (!used) {
        try { apply(await getJSON('data/snapshot.json'), 'snapshot'); }
        catch (x) { $('banner').hidden = false; $('banner').className = 'banner'; $('banner').textContent = 'Nu am putut încărca datele. Verifică conexiunea și reîncarcă pagina.'; $('status').textContent = ''; }
      }
    }
  } finally {
    loading = false;
    // Then ask which sources work, for a clear message when one does not.
    loadHealth().then(() => { renderStatus(); renderSources(); });
  }
}
// Show cached data instantly, then ask for fresh data.
{
  const c = store.get(CACHE_KEY);
  if (c) { try { apply(JSON.parse(c), 'cache'); } catch (e) { store.del(CACHE_KEY); } }
  load();
}

let liveTimer = null;
function scheduleLive() {
  clearTimeout(liveTimer);
  if (DATA.mode === 'snapshot') return;
  const now = Date.now();
  const active = GAMES.filter(g => isLive(g) || (!played(g) && !g.tbd && g.d.getTime() <= now + 60e3 && g.end + 2 * 36e5 > now));
  if (active.length) liveTimer = setTimeout(() => pollLive([...new Set(active.map(g => g.l))]), 30e3);
  else {
    const next = GAMES.find(g => !played(g) && !g.tbd && g.d.getTime() > now);
    if (next) liveTimer = setTimeout(scheduleLive, Math.min(next.d.getTime() - now + 30e3, 30 * 60e3));
  }
}
async function pollLive(leagues) {
  if (document.hidden) { liveTimer = setTimeout(() => pollLive(leagues), 30e3); return; }
  try {
    const r = await getJSON('/api/live?l=' + leagues.join(','), 10000);
    let changed = false, finished = false;
    const scored = [];
    for (const x of r.games || []) {
      const g = gameById(x.id); if (!g) continue;
      if (g.state !== x.state || g.hs !== x.hs || g.as !== x.as || g.detail !== x.detail) {
        if (x.state === 'post' && g.state !== 'post') finished = true;
        if ((x.hs ?? 0) !== (g.hs ?? 0) || (x.as ?? 0) !== (g.as ?? 0)) scored.push(g.id);
        Object.assign(g, { state: x.state, hs: x.hs, as: x.as, detail: x.detail }); changed = true;
      }
    }
    if (changed) {
      render();
      flash(scored);
      const og = OV.game && gameById(OV.game);
      if (og && changed) { refreshGame(og); if (isLive(og) || finished) loadGame(og); }
    }
    if (finished) { load(); return; }
  } catch (e) { /* keep the last known scores */ }
  scheduleLive();
}
// A short highlight on every card whose score just changed.
function flash(ids) {
  for (const id of ids) {
    document.querySelectorAll(`[data-gid="${CSS.escape(id)}"]`).forEach(el => { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); });
    if (OV.game === id && $('gscore')) { const el = $('gscore'); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  }
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && DATA.mode !== 'snapshot' && Date.now() - DATA.loadedAt > 15 * 60e3) load();
});
setInterval(() => { if (GAMES.length) { renderHero(); renderStatus(); } }, 30000);
setInterval(() => { if (!document.hidden) load(); }, 15 * 60e3);

/* ================= start ================= */
$('appver').textContent = 'Versiunea ' + APP_VERSION.replace(/^v/, '');
loadPlaces()?.then(d => { if (!d) return; renderStrip(); if (GAMES.length) { render(); if (!$('ov').hidden) route(true); } });
setInterval(() => { if (!document.hidden && PLACES.data) renderStrip(); }, 30 * 60e3);
setNotifyRender(() => { if (notifyOpen && location.hash.startsWith('#notificari') && !$('ov').hidden) show(notifyHtml(teamEmb, pickerClubs(N.teams)), true); });
onInstallChange(renderPhone);
renderPhone();
registerSW();
// Back online: fresh data at once instead of waiting for the next refresh.
window.addEventListener('online', () => load());
window.addEventListener('offline', () => renderStatus());
setupJump();
trackInstall();


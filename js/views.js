// The two views (Florida | Ligile), the "Ligile" page with its scores, and the jump bar.
import { LEAGUES } from './teams.js';
import { esc, $, emb } from './ui.js';
import { detailRo } from './ro.js';
import { lgHeadHtml, scoresHtml, standingsHtml, teamsHtml, todayStripHtml } from './leagues.js';
import { guideHtml } from './guide.js';
import { PLACES, loadPlaces, AMERICA, loadAmerica, placesIndexHtml } from './places.js';
import { DATA, TZNAME, col, dayLabel, flKey, fmtKey, fmtTime, gameById, getJSON, keepExtra, keyOf, state, tShort } from './core.js';
import { OV, refreshGame, route } from './pages.js';

/* ================= views: Florida | Ligile ================= */
export const LG = { view: 'florida', tab: 'scoruri', day: null, chosen: new Set(Object.keys(LEAGUES)), scores: new Map() };
export const usKey = d => fmtKey.fl.format(d);   // the US (Eastern) date: ESPN's scoreboards are by US day
export const lgCtx = () => ({
  emb, flKey, col, dayLabel, zoneName: TZNAME[state.tz], today: usKey(new Date()),
  status: g => g.state === 'in' ? `<b class="lv">LIVE</b><small>${esc(detailRo(g.detail, g.l))}</small>`
    : g.state === 'post' ? `<small>${esc(detailRo(g.detail, g.l) || 'Final')}</small>`
      : g.tbd ? '<small>oră neanunțată</small>' : `<b>${fmtTime[state.tz].format(g.d)}</b>${keyOf(g.d, state.tz) !== LG.day ? `<small>${esc(tShort(g.d))}</small>` : ''}`
});
export function setView(v) {
  LG.view = v;
  $('flview').hidden = v !== 'florida'; $('lgview').hidden = v !== 'ligi';
  document.querySelectorAll('.viewtabs [data-goview]').forEach(a => a.setAttribute('aria-current', a.dataset.goview === v ? 'page' : 'false'));
  if (v === 'ligi') renderLeagues();
}
export function navView(hash) {
  history.pushState({ view: 1 }, '', location.pathname + location.search + hash);
  route();
  window.scrollTo({ top: 0 });
}
/* ---------- jump bar: the homepage sections, one tap away (the bar stays at the top) ---------- */
export function setupJump() {
  const bar = $('jump'); if (!bar) return;
  const btns = [...bar.querySelectorAll('[data-jump]')], target = b => $(b.dataset.jump);
  // A button only for sections that are shown (Azi în ligi, Playoff come and go).
  const sync = () => { btns.forEach(b => { b.hidden = !target(b) || target(b).hidden; }); mark(); };
  const mo = new MutationObserver(sync);
  btns.forEach(b => target(b) && mo.observe(target(b), { attributes: true, attributeFilter: ['hidden'] }));
  bar.addEventListener('click', e => {
    const b = e.target.closest('[data-jump]'); if (!b) return;
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    target(b)?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  });
  // Light up the section being read; keep its button visible in the bar on a phone.
  let cur = null, raf = 0;
  function mark() {
    raf = 0;
    if ($('flview').hidden) return;
    const line = bar.getBoundingClientRect().bottom + 24;
    let on = null;
    for (const b of btns) if (!b.hidden && target(b).getBoundingClientRect().top <= line) on = b;
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) on = btns.filter(b => !b.hidden).pop() || on;
    on = on || btns.find(b => !b.hidden);
    if (on === cur) return;
    cur?.removeAttribute('aria-current'); cur = on; on?.setAttribute('aria-current', 'true');
    if (on) bar.scrollTo({ left: on.offsetLeft - (bar.clientWidth - on.offsetWidth) / 2, behavior: 'auto' });
  }
  addEventListener('scroll', () => { raf ||= requestAnimationFrame(mark); }, { passive: true });
  addEventListener('resize', () => { raf ||= requestAnimationFrame(mark); });
  sync();
}

export async function loadScores(day) {
  const j = await getJSON('/api/scores?d=' + day.replace(/-/g, ''), 12000).catch(() => null);
  if (!j) { LG.scores.set(day, { _err: true }); return; }
  const data = { _t: Date.now() };
  for (const [l, list] of Object.entries(j.leagues || {})) data[l] = keepExtra(list);
  LG.scores.set(day, data);
}
export function renderLeagues() {
  if (LG.view !== 'ligi') return;
  const el = $('lgview'), ctx = lgCtx();
  const head = lgHeadHtml(LG.tab, Object.keys(LEAGUES), LG.chosen);
  if (LG.tab === 'scoruri') {
    LG.day ||= ctx.today;
    const day = LG.day, data = LG.scores.get(day);
    el.innerHTML = head + (data?._err ? '<div class="empty">Scorurile nu au putut fi încărcate. Încearcă din nou mai târziu.</div>' : scoresHtml(day, data, LG.chosen, ctx));
    if (!data) loadScores(day).then(() => { if (LG.day === day) renderLeagues(); });
  } else if (LG.tab === 'clasamente') el.innerHTML = head + standingsHtml(DATA.raw?.standings, LG.chosen, ctx);
  else if (LG.tab === 'orase') {
    el.innerHTML = head + placesIndexHtml(LG.chosen, ctx.col);
    const wait = [!PLACES.data && loadPlaces(), !AMERICA.data && loadAmerica()].filter(Boolean);
    // Redraw only when something arrived (a failed load would otherwise retry in a loop).
    if (wait.length) Promise.all(wait).then(r => { if (r.some(Boolean) && LG.view === 'ligi' && LG.tab === 'orase') renderLeagues(); });
  } else if (LG.tab === 'ghid') el.innerHTML = head + guideHtml(LG.chosen, ctx.col);
  else el.innerHTML = head + teamsHtml(DATA.raw?.standings, LG.chosen, ctx);
}
export function setLgHash() { history.replaceState(history.state, '', location.pathname + location.search + `#ligi/${LG.tab}${LG.tab === 'scoruri' && LG.day && LG.day !== usKey(new Date()) ? '/' + LG.day : ''}`); }
// "Azi în ligi" on the Florida page.
export async function renderTodayStrip() {
  const day = usKey(new Date());
  if (!LG.scores.has(day) || Date.now() - (LG.scores.get(day)._t || 0) > 60e3) await loadScores(day);
  const data = LG.scores.get(day), html = data && !data._err ? todayStripHtml(data, { ...lgCtx(), today: day }) : '';
  $('todaylg').innerHTML = html; $('todaylg').hidden = !html;
}
// Live games today: fresh scores every 30 seconds while the scores (or the strip) are on screen.
setInterval(() => {
  if (document.hidden || DATA.mode === 'snapshot') return;
  const day = usKey(new Date()), data = LG.scores.get(day);
  const busy = data && Object.keys(LEAGUES).some(l => (data[l] || []).some(g => g.state === 'in' || (g.state === 'pre' && g.d - Date.now() < 15 * 60e3 && g.d - Date.now() > -3 * 36e5)));
  if (!busy) return;
  loadScores(day).then(() => { if (LG.view === 'ligi' && LG.tab === 'scoruri' && LG.day === day) renderLeagues(); if (LG.view === 'florida') renderTodayStrip(); const og = OV.game && gameById(OV.game); if (og && !og.teams.length) refreshGame(og); });
}, 30e3);

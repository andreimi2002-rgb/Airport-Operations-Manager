// The two views (Florida | Ligile), the "Ligile" page with its scores, and the jump bar.
import { LEAGUES, DIVISIONS, norm } from './teams.js';
import { esc, $, emb } from './ui.js';
import { pickMotd } from './motd.js';
import { watchLine } from './guide.js';
import { detailRo } from './ro.js';
import { lgHeadHtml, scoresHtml, standingsHtml, teamsHtml, todayStripHtml, worldHtml, eventInfo, countryRo } from './leagues.js';
import { guideHtml } from './guide.js';
import { PLACES, loadPlaces, AMERICA, loadAmerica, placesIndexHtml } from './places.js';
import { DATA, TZNAME, col, dayLabel, flKey, fmtKey, fmtTime, gameById, getJSON, keepExtra, keyOf, state, tShort, sp, mineOf, entryOf, isLive, played, teamBtn, teamEmbBtn } from './core.js';
import { OV, refreshGame, route } from './pages.js';

/* ================= views: Florida | Ligile ================= */
export const LG = { view: 'florida', tab: 'scoruri', day: null, chosen: new Set(Object.keys(LEAGUES)), scores: new Map() };
export const usKey = d => fmtKey.fl.format(d);   // the US (Eastern) date: ESPN's scoreboards are by US day
export const lgCtx = () => ({
  emb, flKey, col, dayLabel, sp, ro: d => fmtTime.ro.format(d), dayOf: d => dayLabel(keyOf(d, 'ro')), zoneName: TZNAME[state.tz], today: usKey(new Date()),
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
/* ---------- Europe and the big days (/api/world): the "Ligile" tab and the "De urmărit" cards ---------- */
export const WORLD = { data: null, p: null };
export function loadWorld() {
  WORLD.p ||= getJSON('/api/world', 20000).then(j => {
    const games = list => keepExtra(list || []);
    WORLD.data = { abroad: games(j.abroad), events: (j.events || []).map(e => ({ ...e, games: games(e.games) })).filter(e => e.games.length) };
  }, () => { WORLD.data = { _err: true }; WORLD.p = null; });
  return WORLD.p;
}
// The next game in Europe and the next big day, within 30 days, as cards for "De urmărit".
export function worldCardsHtml() {
  const W = WORLD.data; if (!W || W._err) return '';
  const now = Date.now(), soon = g => g.state !== 'post' && g.d.getTime() > now - 3 * 36e5 && g.d.getTime() - now < 30 * 864e5;
  const day = d => `${dayLabel(keyOf(d, 'ro'))}, ${fmtTime.ro.format(d)}`;
  let html = '';
  const eu = W.abroad.filter(g => g.raw?.europe && soon(g)).slice(0, 2);
  for (const g of eu) html += `<button class="hlc world" type="button" data-game="${esc(g.id)}"><span class="k">În Europa · ${g.l}</span><span class="t">${esc(g.A.name)} – ${esc(g.H.name)}</span><span class="d">${esc(day(g.d))} · ${esc(g.raw.city || '')}, ${esc(countryRo(g.raw.country))}</span></button>`;
  const ev = W.events.find(e => e.games.some(soon));
  if (ev) { const i = eventInfo(ev), g = ev.games[0]; html += `<a class="hlc world" href="#ligi/evenimente" data-goview="ligi" data-lgto="evenimente"><span class="k">Eveniment · ${[...new Set(ev.games.map(x => x.l))].join(', ')}</span><span class="t">${esc(i.title)}</span><span class="d">${esc(day(g.d))}${ev.games.length > 1 ? ` · ${ev.games.length} meciuri` : ''}</span></a>`; }
  return html;
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
  else if (LG.tab === 'evenimente') {
    el.innerHTML = head + worldHtml(WORLD.data, LG.chosen, ctx);
    if (!WORLD.data) loadWorld().then(() => { if (LG.view === 'ligi' && LG.tab === 'evenimente') renderLeagues(); });
  }
  else el.innerHTML = head + teamsHtml(DATA.raw?.standings, LG.chosen, ctx);
}
export function setLgHash() { history.replaceState(history.state, '', location.pathname + location.search + `#ligi/${LG.tab}${LG.tab === 'scoruri' && LG.day && LG.day !== usKey(new Date()) ? '/' + LG.day : ''}`); }
// "Azi în ligi" on the Florida page.
export async function renderTodayStrip() {
  const day = usKey(new Date());
  if (!LG.scores.has(day) || Date.now() - (LG.scores.get(day)._t || 0) > 60e3) await loadScores(day);
  const data = LG.scores.get(day), html = data && !data._err ? todayStripHtml(data, { ...lgCtx(), today: day }) : '';
  $('todaylg').innerHTML = html; $('todaylg').hidden = !html;
  renderMotd(data && !data._err ? data : null);
}

/* ---------- "Meciul zilei pentru România": the day's best game to watch, with the reasons ---------- */
const rivalsOf = g => g.l !== 'MLS' && Object.values(DIVISIONS).some(D => D.l === g.l && D.members?.some(m => norm(m) === norm(g.h)) && D.members?.some(m => norm(m) === norm(g.a)));
export function motdOf(data) {
  const games = Object.keys(LEAGUES).flatMap(l => data?.[l] || []);
  games.forEach(g => { g.mine = mineOf(g); });
  return pickMotd(games, { entry: entryOf, rivals: rivalsOf });
}
export function renderMotd(data) {
  const sec = $('motd'); if (!sec) return;
  const m = data && motdOf(data);
  if (!m) { sec.hidden = true; return; }
  const g = m.g, on = isLive(g), done = played(g), ro = fmtTime.ro.format(g.d);
  const when = m.watch === 2 ? `La ${ro}, oră bună în România.` : m.watch === 1 ? `Începe la ${ro}, târziu în România.` : `Începe la ${ro} ora României, noaptea: bun de văzut în reluare sau dimineața, în rezumat.`;
  const mid = on || done ? sp(g.id, `${g.hs ?? 0}–${g.as ?? 0}`) : esc(ro);
  const watch = watchLine(g.l);
  sec.hidden = false;
  sec.innerHTML = `<div class="tnhead"><h2 class="sec">Meciul zilei</h2><span class="motdsub">ales pentru România</span></div>
    <div class="motdc" style="--c:${col(g.l)}" data-gid="${esc(g.id)}">
      <div class="k"><span class="ldot" style="--c:${col(g.l)}"></span>${g.l} · ${esc(dayLabel(keyOf(g.d, 'ro')))}${on ? ` · <b class="lv">LIVE</b> ${esc(detailRo(g.detail, g.l))}` : done ? ' · Final' : ''}</div>
      <div class="mduo"><span class="mside">${teamEmbBtn(g.l, g.H, 'lg')}<span>${teamBtn(g.l, g.H)}</span></span><span class="mmid">${mid}<small>${on || done ? '' : 'ora României'}</small></span><span class="mside">${teamEmbBtn(g.l, g.A, 'lg')}<span>${teamBtn(g.l, g.A)}</span></span></div>
      <ul class="notes">${[...m.reasons.slice(0, 3), done ? '' : when].filter(Boolean).map(r => `<li>${esc(r)}</li>`).join('')}</ul>
      ${watch && !done ? `<div class="fn">Unde îl vezi: ${esc(watch)}</div>` : ''}
      <div class="btns"><button class="primary" type="button" data-game="${esc(g.id)}">Detalii meci</button>${done ? '' : `<button class="ghost" type="button" data-ics-game="${esc(g.id)}">Adaugă în calendar</button>`}</div>
    </div>`;
}
// Live games today: fresh scores every 30 seconds while the scores (or the strip) are on screen.
setInterval(() => {
  if (document.hidden || DATA.mode === 'snapshot') return;
  const day = usKey(new Date()), data = LG.scores.get(day);
  const busy = data && Object.keys(LEAGUES).some(l => (data[l] || []).some(g => g.state === 'in' || (g.state === 'pre' && g.d - Date.now() < 15 * 60e3 && g.d - Date.now() > -3 * 36e5)));
  if (!busy) return;
  loadScores(day).then(() => { if (LG.view === 'ligi' && LG.tab === 'scoruri' && LG.day === day) renderLeagues(); if (LG.view === 'florida') renderTodayStrip(); const og = OV.game && gameById(OV.game); if (og && !og.teams.length) refreshGame(og); });
}, 30e3);

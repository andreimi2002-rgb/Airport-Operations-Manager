// The overlay pages and the address router: team, club, city, stadium, calendar, notifications, game.
import { LEAGUES, TEAMS, DIVISIONS, DIVISION_OF, norm, parseClub } from './teams.js';
import { MINE, mineIds, isMine, mineClubs, clubId, refreshMine } from './mine.js';
import { esc, $, emb, pickInk } from './ui.js';
import { detailRo, noteRo } from './ro.js';
import { tabsHtml, panelHtml } from './game.js';
import { install, calendarHtml } from './phone.js';
import { groupTableHtml as groupTbl } from './leagues.js';
import { CLUBS, loadClubs, clubInfo, aboutHtml, infoFactsHtml } from './clubinfo.js';
import { watchLine } from './guide.js';
import { teamTabsHtml, seasonChartHtml, leadersHtml, rosterHtml, newsHtml } from './teamx.js';
import { N, refreshNotify, notifyHtml } from './notify.js';
import { PLACES, loadPlaces, venueByName, venueOfTeam, cityOf, getWeather, gameWeatherHtml, cityHtml, venueHtml, placeWeatherHtml, floridaClock, AMERICA, loadAmerica, getVenue, getCity, venueOfClub, cityLiteHtml, venueLiteHtml, clockIn, hoursBehindRomania } from './places.js';
import { teamBtn, teamEmbBtn, DATA, GAMES, OUT, OUTL, REC_LABEL, TEAMINFO, TZNAME, col, confShort, countdown, dayLabel, flKey, flSide, fmtShort, fmtTime, formChips, gameById, getJSON, isLive, keepExtra, keyOf, lastGames, oppInfo, outcome, played, recordOf, state, store, streakRo, tShort, teamStats } from './core.js';
import { card, tableHtml } from './home.js';
import { LG, lgCtx, loadScores, setView, usKey } from './views.js';

/* ================= overlays ================= */
// Each overlay has its own address: #meci/NBA/401909963[/tab] or #echipa/heat. Opening one adds a
// history entry, so the phone's Back button closes it; the × closes the whole chain at once.
export const OV = { focus: null, game: null, place: null };   // what the overlay shows
export const gameView = { tab: 'rezumat', side: '' };
export function show(html, keep) {
  const ov = $('ov'), wasHidden = ov.hidden;
  if (wasHidden) OV.focus = document.activeElement;
  const top = ov.scrollTop;
  $('prof').innerHTML = html;
  ov.hidden = false;
  document.body.classList.add('noscroll');
  $('page').inert = true;
  if (keep) { ov.scrollTop = top; return; }
  ov.scrollTop = 0;
  const x = $('prof-x'); if (x) x.focus({ preventScroll: true });
}
export function hideOv() {
  if ($('ov').hidden) return;
  $('ov').hidden = true; OV.game = null; OV.place = null;
  document.body.classList.remove('noscroll');
  $('page').inert = false;
  if (OV.focus && OV.focus.focus && document.contains(OV.focus)) OV.focus.focus({ preventScroll: true });
}
export function closeOv() {
  const depth = history.state && history.state.ov;
  if (depth) history.go(-depth);            // popstate then hides it
  else { history.replaceState(null, '', location.pathname + location.search); hideOv(); }
}
export function go(hash) {
  if (location.hash === hash) { route(); return; }
  const depth = (history.state && history.state.ov) || 0;
  history.pushState({ ov: depth + 1 }, '', location.pathname + location.search + hash);
  route();
}
export function route(keep) {
  const h = decodeURIComponent(location.hash.slice(1)).split('/');
  if (h[0] === 'meci' && gameById(h[2])) { const t = h[3] || 'rezumat'; if (OV.game !== h[2]) gameView.side = ''; gameView.tab = t; openGame(h[2], keep); return; }
  if (h[0] === 'echipa' && TEAMS[h[1]]) { teamView.tab = ['sezon', 'lot', 'stiri'].includes(h[2]) ? h[2] : 'rezumat'; openTeam(h[1], keep); return; }
  if (h[0] === 'notificari') {
    const pre = (h[1] || '').split(',').filter(k => TEAMS[k] || parseClub(k));
    if (pre.length && !keep && N.status !== 'on') N.teams = pre;
    openNotify(keep); return;
  }
  if (h[0] === 'calendar') {
    // #calendar/heat,panthers preselects teams (from a team page); plain #calendar uses the saved choice.
    const pre = (h[1] || '').split(',').filter(k => TEAMS[k] || parseClub(k));
    if (pre.length && !keep) cal.teams = pre;
    openCalendar(keep); return;
  }
  if (h[0] === 'oras' || h[0] === 'stadion') {
    // Place pages need data/places.json (Florida) or data/america.json (the rest); both load on demand.
    if (!PLACES.data) { const p = loadPlaces(); if (p) { p.then(d => { if (d) route(keep); }); return; } }
    const known = h[0] === 'oras' ? getCity(h[1]) : getVenue(h[1]);
    if (!known && !AMERICA.data) { const p = loadAmerica(); if (p) { p.then(d => { if (d) route(keep); }); return; } }
    if (h[0] === 'oras' && getCity(h[1])) { openCity(h[1], keep); return; }
    if (h[0] === 'stadion' && getVenue(h[1])) { openVenue(h[1], keep); return; }
  }
  if (h[0] === 'club' && LEAGUES[h[1]] && /^\d+$/.test(h[2] || '')) { clubView.tab = ['sezon', 'lot', 'stiri'].includes(h[3]) ? h[3] : 'rezumat'; openClub(h[1], h[2], keep); return; }
  // Pages (not overlays): the Florida page (no hash) and "Ligile" (#ligi/scoruri/2026-11-11).
  if (h[0] === 'ligi') {
    LG.tab = ['scoruri', 'clasamente', 'echipe', 'orase', 'ghid'].includes(h[1]) ? h[1] : 'scoruri';
    if (/^\d{4}-\d{2}-\d{2}$/.test(h[2] || '')) LG.day = h[2];
    hideOv(); setView('ligi'); return;
  }
  if (h[0] === 'meci' && LEAGUES[h[1]] && h[2] && !gameById(h[2]) && GAMES.length && !keep) {
    // A shared link to a game outside Florida: today's scores usually have it.
    const day = usKey(new Date());
    if (!LG.scores.has(day)) { loadScores(day).then(() => { if (gameById(h[2])) route(); }); return; }
  }
  if (location.hash && GAMES.length) history.replaceState(null, '', location.pathname + location.search);
  hideOv();
  if (!location.hash) setView('florida');
}
window.addEventListener('popstate', () => route());

// Swipe the overlay down from its top edge to close it (phones).
{
  let y0 = null, dy = 0;
  const prof = () => $('prof');
  $('ov').addEventListener('touchstart', e => { y0 = $('ov').scrollTop <= 0 && e.touches.length === 1 && e.target.closest('.band') ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
  $('ov').addEventListener('touchmove', e => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); prof().style.transform = `translateY(${dy}px)`; }, { passive: true });
  $('ov').addEventListener('touchend', () => { if (y0 == null) return; prof().style.transform = ''; if (dy > 90) closeOv(); y0 = null; });
}

export function openTeam(k, keep) {
  const T = TEAMS[k]; if (!T) return;
  OV.game = null; OV.place = null;
  teamView.k = k;
  loadTeamX(k);
  if (!CLUBS.data) loadClubs()?.then(d => { if (d && teamView.k === k && location.hash.startsWith('#echipa/' + k)) openTeam(k, true); });
  // Wikipedia text, legends, former names; the titles and the start year stay the hand-written ones.
  const fi = clubInfo(T.l, TEAMINFO[k]?.id), fiShort = fi && { ...fi, titles: null, founded: null };
  const st = teamStats(k), now = Date.now(), side = flSide(k);
  const mine = GAMES.filter(g => g.teams.includes(k));
  const last = lastGames(k).reverse(), next = mine.filter(g => !played(g) && (isLive(g) || g.end > now)).slice(0, 5);
  const opp = g => (g.H.key === k ? 'vs ' : 'la ') + esc(g.H.key === k ? g.a : g.h);
  const isMLS = T.l === 'MLS', fav = isMine(k);
  const bandBg = side.color || T.col[0], bandFg = pickInk(bandBg, side.alt || T.col[1]);
  show(`<div class="band" style="background:${bandBg};color:${bandFg}"><div class="id">${emb(side, 'xl', true)}<div><div class="lgn">${T.l} · ${esc(T.city)}</div><h2 id="prof-name">${esc(T.espn)}</h2></div></div>
      <button class="x" type="button" id="prof-x" aria-label="Închide">×</button></div>
    <div class="ttabs">${teamTabsHtml(teamView.tab)}</div>
    <div class="pbody" id="tpanel">
    ${teamView.tab !== 'rezumat' ? teamPanel(k) : ''}${teamView.tab === 'rezumat' ? `
    <div class="stats">
      <div class="stat"><div class="v">${st.rec}</div><div class="l">Bilanț (${st.recL})</div></div>
      ${st.conf != null ? `<div class="stat"><div class="v">Locul ${st.conf}</div><div class="l">${T.l === 'NFL' || T.l === 'MLB' ? 'în ' + esc(st.confN) : 'în conferința de ' + esc(st.confN)}</div></div>` : st.standing ? `<div class="stat"><div class="v" style="font-size:16px">${esc(st.standing)}</div><div class="l">Clasament</div></div>` : ''}
      ${isMLS && st.pts != null ? `<div class="stat"><div class="v">${st.pts}</div><div class="l">puncte</div></div>` : st.div ? `<div class="stat"><div class="v">Locul ${st.div}</div><div class="l">în ${esc(DIVISIONS[DIVISION_OF[k]].t.split(' · ')[1])}</div></div>` : ''}
      ${st.home ? `<div class="stat"><div class="v">${st.home}</div><div class="l">Acasă</div></div>` : ''}
      ${st.away ? `<div class="stat"><div class="v">${st.away}</div><div class="l">În deplasare</div></div>` : ''}
      ${st.streak ? `<div class="stat"><div class="v" style="font-size:17px">${esc(st.streak)}</div><div class="l">Serie curentă</div></div>` : ''}
    </div>
    <div><h3>Forma, ultimele ${last.length} meciuri</h3><div class="form">${formChips(k)}<span>cel mai recent în dreapta</span></div></div>
    ${aboutHtml(fi)}
    <dl class="facts">
      <dt>Rivali</dt><dd>${esc(T.rivals)}</dd>
      <dt>Arenă</dt><dd>${(() => { const v = venueOfTeam(k), c = v && cityOf(v); return v ? `<button class="linkish" type="button" data-venue="${v.id}">${esc(v.name)}</button>${c ? `, <button class="linkish" type="button" data-city="${c.id}">${esc(c.name)}</button>` : ''}` : esc(T.arena); })()}</dd>
      <dt>Capacitate</dt><dd>${esc(T.cap)}</dd>
      <dt>În ligă din</dt><dd>${T.since}</dd>
      <dt>Palmares</dt><dd>${esc(T.titles)}</dd>
      <dt>De știut</dt><dd>${esc(T.fact)}</dd>
      ${infoFactsHtml(fiShort, TEAMX.get(k)?.coach)}
    </dl>
    <div><h3>Următoarele meciuri</h3><div class="rows">${next.length ? next.map(g => `<button class="row" type="button" data-game="${g.id}"><span class="when">${tShort(g.d)}</span><span>${opp(g)}${g.note ? ` <span style="color:var(--muted);font-size:12.5px">· ${esc(noteRo(g.note))}</span>` : ''}</span><span class="r">${isLive(g) ? 'LIVE' : g.tbd ? 'oră neanunțată' : fmtTime[state.tz].format(g.d)}</span></button>`).join('') : '<div class="row"><span></span><span>Niciun meci programat.</span><span></span></div>'}</div></div>
    <div><h3>Ultimele rezultate</h3><div class="rows">${last.map(g => { const o = outcome(g, k); const a = g.H.key === k ? g.hs : g.as, b = g.H.key === k ? g.as : g.hs; return `<button class="row" type="button" data-game="${g.id}"><span class="when">${tShort(g.d)}</span><span>${opp(g)}</span><span class="r ${o}">${OUTL[o]} ${a}–${b}</span></button>`; }).join('') || '<div class="row"><span></span><span>Niciun meci jucat încă.</span><span></span></div>'}</div></div>
    ${tableHtml(DIVISION_OF[k])}` : ''}
    <div class="btns"><button class="primary" type="button" data-only="${k}">Arată doar meciurile echipei</button>
      <button class="ghost" type="button" data-team-cal="${k}">Calendarul echipei</button>
      <button class="ghost" type="button" data-team-ntf="${k}">Notificări</button>
      <button class="ghost${fav ? ' on' : ''}" type="button" data-follow="${k}" aria-pressed="${fav}">${fav ? '★ În echipele mele (apasă ca s-o scoți)' : '☆ Adaugă la echipele mele'}</button>
      <button class="ghost" type="button" data-share>Copiază linkul</button></div>
    </div>`, keep);
}

/* ----- team page tabs: season, roster, news (from /api/team, loaded on first use) ----- */
export const teamView = { k: '', tab: 'rezumat' };
export const TEAMX = new Map();
export function teamPanel(k) {
  const T = TEAMS[k], x = TEAMX.get(k), info = TEAMINFO[k];
  if (teamView.tab === 'sezon') {
    const rows = GAMES.filter(g => g.teams.includes(k) && played(g) && g.hs != null).map(g => {
      const home = g.H.key === k;
      return { id: g.id, d: g.d, opp: home ? g.a : g.h, home, mine: home ? g.hs : g.as, their: home ? g.as : g.hs };
    });
    return `<section><h3>Sezonul, meci cu meci</h3>${seasonChartHtml(rows, T.l)}</section>${x ? leadersHtml(x) : info?.id ? '<div class="skeleton" style="height:120px"></div>' : ''}`;
  }
  if (!info?.id) return '<div class="fn">Datele echipei nu sunt disponibile acum.</div>';
  if (!x) return '<div class="skeleton" style="height:180px"></div>';
  return teamView.tab === 'lot' ? `<section>${rosterHtml(x, T.l)}</section>` : `<section>${newsHtml(x)}</section>`;
}
export async function loadTeamX(k) {
  const info = TEAMINFO[k];
  if (!info?.id || TEAMX.has(k) || DATA.mode === 'snapshot') return;
  try {
    const x = await getJSON(`/api/team?l=${TEAMS[k].l}&id=${info.id}`, 12000);
    TEAMX.set(k, x);
  } catch (e) { TEAMX.set(k, { roster: [], leaders: [], news: [] }); }
  if (teamView.k === k && $('tpanel') && location.hash.startsWith('#echipa/' + k)) openTeam(k, true);
}
export function setTeamTab(t) {
  const k = teamView.k; if (!TEAMS[k]) return;
  teamView.tab = t;
  history.replaceState(history.state, '', location.pathname + location.search + `#echipa/${k}${t !== 'rezumat' ? '/' + t : ''}`);
  openTeam(k, true);
  const b = document.querySelector(`[data-ttab="${t}"]`); if (b) b.focus({ preventScroll: true });
}

/* ================= the page of a team outside Florida (#club/NBA/2) ================= */
export const CLUB = new Map();
export const clubView = { key: '', tab: 'rezumat' };
export function entryById(l, id) {
  for (const g of DATA.raw?.standings?.[l] || []) { const e = g.entries.find(x => String(x.id) === String(id)); if (e) return { ...e, conf: confShort(g.name, l) }; }
  return null;
}
// A team outside Florida ('NBA-2') as an emblem side: from the standings, else as saved in "Echipele mele".
export function clubSide(cid) {
  const c = parseClub(cid), e = c && entryById(c.l, c.id), m = MINE.list.find(x => x.id === cid) || {};
  return { id: cid, l: c?.l, name: e?.name || m.name || cid, abbr: e?.abbr || m.abbr, logo: e?.logo || m.logo, logoDark: e?.logoDark || m.logoDark, color: e?.color || m.color, alt: e?.alt || m.alt };
}
// The teams from outside Florida on the calendar / notifications pages: the followed ones and any chosen.
export function pickerClubs(sel) { return [...new Set([...mineClubs().map(x => x.id), ...sel.filter(k => parseClub(k))])].map(clubSide); }
export function teamEmb(id) { return emb(TEAMS[id] ? flSide(id) : clubSide(id), 'sm'); }
// V / I / E for the team with ESPN id id in a finished game.
export function outcomeOf(g, id) { const home = g.H.id === String(id), a = home ? g.hs : g.as, b = home ? g.as : g.hs; return a > b ? 'V' : a < b ? 'I' : 'E'; }
// The conference (or league) table of a team, with the team marked.
export function groupTableHtml(l, id) {
  const g = (DATA.raw?.standings?.[l] || []).find(x => x.entries.some(e => String(e.id) === String(id)));
  return g ? `<section><h3>Clasament</h3>${groupTbl(g, l, lgCtx(), id)}</section>` : '';
}

export async function loadClub(l, id) {
  const key = l + '|' + id;
  if (CLUB.has(key) || DATA.mode === 'snapshot') return;
  CLUB.set(key, null);
  const [games, x] = await Promise.all([
    getJSON(`/api/teamgames?l=${l}&id=${id}`, 12000).catch(() => null),
    getJSON(`/api/team?l=${l}&id=${id}`, 12000).catch(() => null)
  ]);
  CLUB.set(key, { games: games ? keepExtra(games.games || []) : [], record: games?.record, standing: games?.standing, x: x || { roster: [], leaders: [], news: [] } });
  if (clubView.key === key && location.hash.startsWith(`#club/${l}/${id}`)) openClub(l, id, true);
}
export function openClub(l, id, keep) {
  const e = entryById(l, id), k = e && flKey(l, e.name);
  if (k) { history.replaceState(history.state, '', location.pathname + location.search + '#echipa/' + k); openTeam(k, keep); return; }
  const key = l + '|' + id;
  if (clubView.key !== key) clubView.tab = 'rezumat';
  clubView.key = key; OV.game = null; OV.place = null; teamView.k = '';
  loadClub(l, id);
  const again = d => { if (d && clubView.key === key && location.hash.startsWith(`#club/${l}/${id}`)) openClub(l, id, true); };
  if (!AMERICA.data) loadAmerica()?.then(again);
  if (!CLUBS.data) loadClubs()?.then(again);
  const home = venueOfClub(l, id), homeCity = home && cityOf(home);
  const c = CLUB.get(key), now = Date.now();
  const name = e?.name || c?.games?.[0] && [c.games[0].H, c.games[0].A].find(s => s.id === String(id))?.name || 'Echipă';
  const side = { name, abbr: e?.abbr, logo: e?.logo, logoDark: e?.logoDark, color: e?.color, alt: e?.alt };
  const bg = e?.color || '#38474b', fg = pickInk(bg, e?.alt || '#ffffff');
  const info = clubInfo(l, id), cid = clubId(l, id), following = isMine(cid);
  if (e) refreshMine(cid, side);
  const mine = c?.games || [];
  const opp = g => { const home = g.H.id === String(id); return (home ? 'vs ' : 'la ') + esc(home ? g.a : g.h); };
  const res = g => { const home = g.H.id === String(id), a = home ? g.hs : g.as, b = home ? g.as : g.hs; const o = a > b ? 'V' : a < b ? 'I' : 'E'; return `<span class="r ${o}">${OUTL[o]} ${a}–${b}</span>`; };
  const next = mine.filter(g => g.state !== 'post' && g.end > now).slice(0, 5), last = mine.filter(g => g.state === 'post').slice(-5).reverse();
  // Same league only: ESPN reuses team ids across leagues (Pacers, Colts and Devils are all "11").
  const vsFL = GAMES.filter(g => g.l === l && g.state !== 'post' && g.end > now && [g.H, g.A].some(s => s.id === String(id) || norm(s.name) === norm(name))).slice(0, 4);
  let body = '';
  if (clubView.tab === 'rezumat') {
    body = `<div class="stats">
        <div class="stat"><div class="v">${e ? recordOf(e, l) : esc(c?.record || '–')}</div><div class="l">Bilanț (${REC_LABEL[l]})</div></div>
        ${e && (e.seed ?? e.order) ? `<div class="stat"><div class="v">Locul ${e.seed ?? e.order}</div><div class="l">${l === 'NFL' || l === 'MLB' ? 'în ' + esc(e.conf) : 'în conferința de ' + esc(e.conf)}</div></div>` : ''}
        ${e?.home ? `<div class="stat"><div class="v">${esc(e.home.replace(/-/g, '–'))}</div><div class="l">Acasă</div></div>` : ''}
        ${e?.away ? `<div class="stat"><div class="v">${esc(e.away.replace(/-/g, '–'))}</div><div class="l">În deplasare</div></div>` : ''}
        ${e?.streak ? `<div class="stat"><div class="v" style="font-size:17px">${esc(streakRo(e.streak))}</div><div class="l">Serie curentă</div></div>` : ''}
      </div>
      ${last.length ? `<div><h3>Forma, ultimele ${last.length} meciuri</h3><div class="form">${last.slice().reverse().map(g => { const o = outcomeOf(g, id); return `<i class="${o}" title="${OUT[o]}">${OUTL[o]}</i>`; }).join('')}<span>cel mai recent în dreapta</span></div></div>` : ''}
      ${aboutHtml(info)}
      <dl class="facts">${home ? `<dt>${home.kind === 'arena' ? 'Arenă' : 'Stadion'}</dt><dd><button class="linkish" type="button" data-venue="${esc(home.id)}">${esc(home.name)}</button>${homeCity ? `, <button class="linkish" type="button" data-city="${esc(homeCity.id)}">${esc(homeCity.name)}</button> (${esc(homeCity.state)})` : ''}</dd>${home.capacity ? `<dt>Capacitate</dt><dd>aprox. ${Number(home.capacity).toLocaleString('ro-RO')} de locuri</dd>` : ''}${homeCity ? `<dt>Ora acum</dt><dd>${clockIn(homeCity.tz)}, cu ${hoursBehindRomania(new Date(), homeCity.tz)} ore în urma României</dd>` : ''}` : ''}${infoFactsHtml(info, c?.x?.coach)}</dl>
      ${vsFL.length ? `<section><h3>Cu echipele din Florida</h3><div class="rows">${vsFL.map(g => `<button class="row" type="button" data-game="${g.id}"><span class="when">${tShort(g.d)}</span><span>${esc(g.h)} – ${esc(g.a)}</span><span class="r">${g.tbd ? 'oră neanunțată' : fmtTime[state.tz].format(g.d)}</span></button>`).join('')}</div></section>` : ''}
      ${c ? `<section><h3>Următoarele meciuri</h3><div class="rows">${next.map(g => `<button class="row" type="button" data-game="${g.id}"><span class="when">${tShort(g.d)}</span><span>${opp(g)}</span><span class="r">${g.state === 'in' ? 'LIVE' : g.tbd ? 'oră neanunțată' : fmtTime[state.tz].format(g.d)}</span></button>`).join('') || '<div class="row"><span></span><span>Niciun meci programat.</span><span></span></div>'}</div></section>
      <section><h3>Ultimele rezultate</h3><div class="rows">${last.map(g => `<button class="row" type="button" data-game="${g.id}"><span class="when">${tShort(g.d)}</span><span>${opp(g)}</span>${res(g)}</button>`).join('') || '<div class="row"><span></span><span>Niciun meci jucat încă.</span><span></span></div>'}</div></section>` : '<div class="skeleton" style="height:160px"></div>'}
      ${groupTableHtml(l, id)}`;
  } else if (!c) body = '<div class="skeleton" style="height:180px"></div>';
  else if (clubView.tab === 'sezon') {
    const rows = mine.filter(g => g.state === 'post' && g.hs != null).map(g => { const home = g.H.id === String(id); return { id: g.id, d: g.d, opp: home ? g.a : g.h, home, mine: home ? g.hs : g.as, their: home ? g.as : g.hs }; });
    body = `<section><h3>Sezonul, meci cu meci</h3>${seasonChartHtml(rows, l)}</section>${leadersHtml(c.x)}`;
  } else body = clubView.tab === 'lot' ? `<section>${rosterHtml(c.x, l)}</section>` : `<section>${newsHtml(c.x)}</section>`;
  show(`<div class="band" style="background:${bg};color:${fg}"><div class="id">${emb(side, 'xl', true)}<div><div class="lgn">${l}${e?.conf ? ' · ' + esc(e.conf) : ''}</div><h2 id="prof-name">${esc(name)}</h2></div></div>
      <button class="x" type="button" id="prof-x" aria-label="Închide">×</button></div>
    <div class="ttabs">${teamTabsHtml(clubView.tab)}</div>
    <div class="pbody">${body}<div class="btns"><button class="${following ? 'ghost on' : 'primary'}" type="button" data-follow="${cid}" aria-pressed="${following}">${following ? '★ În echipele mele (apasă ca s-o scoți)' : '☆ Adaugă la echipele mele'}</button>
      <button class="ghost" type="button" data-team-cal="${cid}">Calendarul echipei</button><button class="ghost" type="button" data-team-ntf="${cid}">Notificări</button>
      <button class="ghost" type="button" data-share>Copiază linkul</button></div></div>`, keep);
}

/* ================= city and stadium pages ================= */
export const placeCtx = {
  emb: (k, cls = 'sm') => emb(flSide(k), cls),
  // Teams outside Florida, by league and ESPN id (their logo and record come from the standings).
  clubEmb: t => { const e = entryById(t.l, t.id); return emb({ name: t.name, abbr: e?.abbr, logo: e?.logo, logoDark: e?.logoDark, color: e?.color, alt: e?.alt }, 'lg'); },
  clubRecord: t => { const e = entryById(t.l, t.id); return e ? recordOf(e, t.l) : ''; },
  homeRecord: k => teamStats(k).home || '',
  // Games played at these venues: upcoming first-to-last, finished last-to-first.
  gamesAt(ids) {
    const now = Date.now(), at = GAMES.filter(g => { const v = venueByName(g.v); return v && ids.includes(v.id); });
    return { up: at.filter(g => !played(g) && (isLive(g) || g.end > now)), past: at.filter(played).reverse() };
  },
  row: g => `<button class="row" type="button" data-game="${g.id}"><span class="when">${tShort(g.d)}</span><span>${esc(g.h)} – ${esc(g.a)} <span style="color:var(--muted);font-size:12.5px">· ${g.l}</span></span><span class="r">${played(g) || isLive(g) ? `${g.hs ?? 0}–${g.as ?? 0}` : g.tbd ? 'oră neanunțată' : fmtTime[state.tz].format(g.d)}</span></button>`
};
export let clockTimer = null;
export function startClock() {
  clearInterval(clockTimer);
  clockTimer = setInterval(() => { const el = $('flclock'); if (el) el.textContent = el.dataset.tz ? clockIn(el.dataset.tz) : floridaClock(); else clearInterval(clockTimer); }, 20e3);
}
export async function fillPlaceWeather(pt, venue, ownerId) {
  try {
    const [w] = await getWeather([pt], false);
    if (OV.place !== ownerId || !$('pwx')) return;
    let next = null;
    if (venue) { const g = placeCtx.gamesAt([venue.id]).up[0]; if (g) next = { id: g.id, label: `${g.h} – ${g.a}, ${tShort(g.d)}` }; }
    $('pwx').innerHTML = placeWeatherHtml(w, venue, next);
  } catch (e) { if ($('pwx')) $('pwx').innerHTML = `<div class="fn">${navigator.onLine ? 'Prognoza nu a putut fi încărcată. Încearcă din nou mai târziu.' : 'Ești offline: vremea apare când ai din nou internet. Clima pe luni de mai jos e salvată pe telefon.'}</div>`; }
}
export function openCity(id, keep) {
  const c = getCity(id);
  OV.game = null; OV.place = 'c:' + id;
  show(c.lite ? cityLiteHtml(c, placeCtx) : cityHtml(c, placeCtx), keep);
  startClock();
  fillPlaceWeather(c, null, OV.place);
}
export function openVenue(id, keep) {
  const v = getVenue(id);
  OV.game = null; OV.place = 'v:' + id;
  show(v.lite ? venueLiteHtml(v, placeCtx) : venueHtml(v, placeCtx), keep);
  startClock();
  fillPlaceWeather(v, v, OV.place);
}

/* ================= phone: install, calendar subscription ================= */
export const cal = { teams: [], alarm: 60 };
{
  try { const s = JSON.parse(store.get('flgames-cal') || 'null'); if (s) { cal.teams = (s.teams || []).filter(k => TEAMS[k] || parseClub(k)); cal.alarm = +s.alarm || 0; } } catch (e) { /* ignore */ }
  if (!cal.teams.length) cal.teams = MINE.list.length ? mineIds() : Object.keys(TEAMS);
}
export const saveCal = () => store.set('flgames-cal', JSON.stringify(cal));
export function openCalendar(keep) {
  OV.game = null; OV.place = null;
  show(calendarHtml(cal.teams, cal.alarm, teamEmb, pickerClubs(cal.teams)), keep);
}
/* ----- notifications page ----- */
export let notifyOpen = false, notifyChecked = false;
export function openNotify(keep) {
  OV.game = null; OV.place = null; notifyOpen = true;
  show(notifyHtml(teamEmb, pickerClubs(N.teams)), keep);
  if (!notifyChecked) { notifyChecked = true; refreshNotify(MINE.list.length ? mineIds() : Object.keys(TEAMS)); }
}

export function sideInfo(g, side) {
  const k = side.key;
  if (k && TEAMS[k]) { const st = teamStats(k); return `<small>${st.rec}${st.conf != null ? ` · locul ${st.conf} ${esc(st.confN)}` : ''}</small><div class="form">${formChips(k)}</div>`; }
  const o = oppInfo(g.l, side.name); return o ? `<small>${esc(o)}</small>` : '<small>&nbsp;</small>';
}
export function gameStatus(g) {
  const now = Date.now(), d = detailRo(g.detail, g.l);
  if (played(g)) return d && d !== 'Final' ? d : 'Final';
  if (isLive(g)) return 'LIVE · ' + d;
  if (/postponed|canceled|cancelled|suspended|delayed/i.test(g.detail || '')) return d;
  return g.tbd ? 'oră neanunțată' : g.d.getTime() > now ? 'începe în ' + countdown(g.d.getTime() - now) : 'urmează să înceapă';
}
export const midScore = g => (played(g) || isLive(g) ? (g.hs ?? 0) + '–' + (g.as ?? 0) : g.tbd ? 'vs' : fmtTime[state.tz].format(g.d));
export function openGame(id, keep) {
  const g = gameById(id); if (!g) return;
  keep = keep && OV.game === g.id;
  OV.game = g.id;
  const done = played(g), on = isLive(g), other = state.tz === 'ro' ? 'fl' : 'ro', k = keyOf(g.d, state.tz);
  const ctx = gameContext(g);
  const canFetch = DATA.mode !== 'snapshot';
  const s = SUMMARY.get(g.l + g.id);
  show(`<div class="band plain"><div><div class="lgn" style="color:${col(g.l)}">${g.l}${g.note ? ' · ' + esc(noteRo(g.note)) : ''}</div><h2 id="prof-name" style="font-size:22px">${dayLabel(k)}</h2></div>
      <button class="x" type="button" id="prof-x" aria-label="Închide">×</button></div>
    <div class="pbody">
    <div class="duel">
      <div class="side">${teamEmbBtn(g.l, g.H, 'lg')}<span>${teamBtn(g.l, g.H)}</span>${sideInfo(g, g.H)}</div>
      <div class="mid${on ? ' on' : ''}" id="gscore" aria-live="polite">${midScore(g)}<small>${esc(gameStatus(g))}</small></div>
      <div class="side">${teamEmbBtn(g.l, g.A, 'lg')}<span>${teamBtn(g.l, g.A)}</span>${sideInfo(g, g.A)}</div>
    </div>
    <div id="gtabs">${tabsHtml(g, s, gameView.tab)}</div>
    <div id="gdetail" role="tabpanel">${gameView.tab === 'rezumat' || !s ? summaryTop(g, ctx, k, other, done, on) : ''}${s ? panelHtml(g, s, viewFor()) : canFetch ? '<div class="skeleton" style="height:70px"></div>' : '<div class="fn">Detaliile meciului (statistici, jucători, faze) apar când sursa live răspunde.</div>'}</div>
    <div class="btns">${[g.H, g.A].map(s => s.key ? `<button class="ghost" type="button" data-team="${s.key}">Profil ${esc(TEAMS[s.key].s)}</button>` : s.id ? `<button class="ghost" type="button" data-club="${g.l}|${esc(s.id)}">${esc(s.name)}</button>` : '').join('')}${g.teams.length ? `<button class="ghost" type="button" data-day="${k}" data-jump="1">Toate meciurile zilei</button>` : ''}${done ? '' : `<button class="ghost" type="button" data-ics-game="${g.id}">Adaugă în calendar</button>`}<button class="ghost" type="button" data-share>Copiază linkul</button></div>
    </div>`, keep);
  OV.place = null;
  if (canFetch && (!s || isLive(g))) loadGame(g);
  // The stadium link and the weather card need data/places.json; draw again once it is here.
  if (PLACES.data) { if (canFetch) loadGameWeather(g); }
  else loadPlaces()?.then(d => { if (d && OV.game === g.id) { refreshGame(g); if (canFetch) loadGameWeather(g); } });
}
export function gameContext(g) {
  const ctx = [];
  if (g.derby) ctx.push('Derby al Floridei: ambele echipe sunt din stat.');
  const sameDiv = (() => { if (g.l === 'MLS') return null; for (const [dk, D] of Object.entries(DIVISIONS)) if (D.members && D.members.some(m => norm(m) === norm(g.h)) && D.members.some(m => norm(m) === norm(g.a))) return D.t.split(' · ')[1]; return null; })();
  if (sameDiv) ctx.push(`Rivale de divizie (${sameDiv}): meciurile directe contează mult pentru locul în divizie.`);
  if (/wild card/i.test(g.note) && g.l === 'MLS') ctx.push('Meci eliminatoriu, într-o singură manșă: cine pierde a încheiat sezonul.');
  else if (/round|playoff|semifinal|final/i.test(g.note)) ctx.push('Meci de playoff.');
  if (/night football/i.test(g.note)) ctx.push('Meci televizat național în SUA, singurul din acea seară.');
  if (g.inFL && !g.derby && g.H.key) { const st = teamStats(g.H.key); if (st.home) ctx.push(`${TEAMS[g.H.key].s} are ${st.home} acasă în acest sezon.`); }
  if (!g.inFL && g.teams.length === 1) { const st = teamStats(g.teams[0]); if (st.away) ctx.push(`${TEAMS[g.teams[0]].s} are ${st.away} în deplasare în acest sezon.`); }
  const h2h = GAMES.filter(x => x !== g && played(x) && x.l === g.l && [x.h, x.a].includes(g.h) && [x.h, x.a].includes(g.a)).pop();
  if (h2h) ctx.push(`Ultimul meci direct (${tShort(h2h.d)}): ${h2h.h} ${h2h.hs}–${h2h.as} ${h2h.a}.`);
  return ctx;
}
export const viewFor = () => ({ ...gameView, known: id => !!gameById(id) });
export function summaryTop(g, ctx, k, other, done, on) {
  return `<dl class="facts">
      ${g.tbd ? '' : `<dt>Start</dt><dd>${fmtTime[state.tz].format(g.d)} ${TZNAME[state.tz]} · ${fmtTime[other].format(g.d)} ${TZNAME[other]} (${fmtShort[other].format(g.d).replace('.', '')})</dd>`}
      <dt>Unde</dt><dd>${(() => { const v = venueByName(g.v), c = v && cityOf(v); return v ? `<button class="linkish" type="button" data-venue="${v.id}">${esc(g.v)}</button>, ${c ? `<button class="linkish" type="button" data-city="${c.id}">${esc(c.name)}</button>, ${c.lite ? esc(c.state) : 'FL'}` : esc(g.city)}` : `${g.v ? esc(g.v) + ', ' : ''}${esc(g.city)}`; })()}</dd>
      ${g.tv ? `<dt>Transmisie SUA</dt><dd>${esc(g.tv)}</dd>` : ''}
      ${watchLine(g.l) ? `<dt>Unde îl vezi</dt><dd>${esc(watchLine(g.l))} · <a class="linkish" href="#ligi/ghid" data-goview="ligi" data-lgto="ghid" data-lgguide="${g.l}">ghid ›</a></dd>` : ''}
      ${done || on || g.tbd ? '' : `<dt>Pentru România</dt><dd>${{ good: 'Oră bună, se poate urmări seara.', late: 'Târziu, începe în jurul miezului nopții.', night: 'Noapte albă, începe după ora 01:00.' }[g.aw]}</dd>`}
    </dl>
    ${ctx.length ? `<section><h3>Context</h3><ul class="notes">${ctx.map(c => `<li>${esc(c)}</li>`).join('')}</ul></section>` : ''}
    ${!done && g.teams.length && venueByName(g.v) ? `<div id="gwx">${GWX.get(g.id) || ''}</div>` : ''}`;
}
// Weather for a game in a Florida venue (not for finished games). Kept per game, so redraws reuse it.
export const GWX = new Map();
export async function loadGameWeather(g) {
  // Florida's games only, at home or away (other games show just the stadium link).
  const v = venueByName(g.v);
  if (!v || played(g) || !g.teams.length) return;
  try {
    const [w] = await getWeather([v], false);
    const html = gameWeatherHtml(g, v, w, LEAGUES[g.l].dur);
    GWX.set(g.id, html);
    if (OV.game === g.id && $('gwx')) $('gwx').innerHTML = html;
  } catch (e) { /* the weather card is optional */ }
}
// Draws the tabs and the open tab again, keeping the scroll position (new data, tab switch, live score).
export function refreshGame(g) {
  if (OV.game !== g.id || !$('gdetail')) return;
  const s = SUMMARY.get(g.l + g.id);
  $('gscore').innerHTML = `${midScore(g)}<small>${esc(gameStatus(g))}</small>`;
  $('gscore').classList.toggle('on', isLive(g));
  $('gtabs').innerHTML = tabsHtml(g, s, gameView.tab);
  const other = state.tz === 'ro' ? 'fl' : 'ro';
  const top = gameView.tab === 'rezumat' ? summaryTop(g, gameContext(g), keyOf(g.d, state.tz), other, played(g), isLive(g)) : '';
  $('gdetail').innerHTML = top + (s ? (panelHtml(g, s, viewFor()) || '') : '');
}
export const SUMMARY = new Map();
export async function loadGame(g) {
  const key = g.l + g.id;
  try {
    const s = await getJSON(`/api/game?l=${g.l}&id=${encodeURIComponent(g.id)}`, 10000);
    SUMMARY.set(key, s);
    refreshGame(g);
  } catch (e) {
    if (OV.game === g.id && $('gdetail') && !SUMMARY.has(key)) {
      $('gdetail').querySelector('.skeleton')?.replaceWith(Object.assign(document.createElement('div'), { className: 'fn', textContent: 'Nu am putut încărca detaliile meciului. Încearcă din nou mai târziu.' }));
    }
  }
}

export async function share(btn) {
  const url = location.href;
  try {
    if (navigator.share && matchMedia('(pointer:coarse)').matches) { await navigator.share({ title: document.title, url }); return; }
    await navigator.clipboard.writeText(url);
    btn.textContent = 'Link copiat ✓';
  } catch (e) { if (e && e.name !== 'AbortError') btn.textContent = 'Nu am putut copia linkul'; }
  setTimeout(() => { if (btn.isConnected) btn.textContent = 'Copiază linkul'; }, 2500);
}

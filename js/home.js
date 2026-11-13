// The home page: status line, "Echipele mele", the next game, highlights, calendar, agenda, map,
// playoff bracket, weather strip and the phone section.
import { LEAGUES, TEAMS, DIVISIONS, METROS, norm, HOME } from './teams.js';
import { MINE, isMine, mineFL, clubId, mineIds, welcomeDue } from './mine.js';
import { esc, $, emb } from './ui.js';
import { detailRo, noteRo } from './ro.js';
import { installHtml, canInstall, isWindows, isStandalone, offerStore } from './phone.js';
import { buildSeries, bracketLayout, roundRo, confRo } from './bracket.js';
import { PLACES, venueByName, cityOf, getWeather, stripHtml, STRIP, cityCard, roofWord, AMERICA, loadAmerica } from './places.js';
import { teamBtn, teamEmbBtn, AW, DATA, DOW, GAMES, MONTHS, OUT, TZNAME, addDays, ago, awake, busyMap, col, countdown, dayLabel, divisionRows, dowOf, entryOf, filtered, flKey, flSide, fmtHM, fmtShort, fmtTime, getJSON, horizonEnd, isLive, keyOf, lastGames, outcome, parts, played, ptsOf, recordOf, shortDate, state, tShort, teamStats, todayKey, writeFilters, myShort, outcomeFor, keepExtra, gameById, sp } from './core.js';
import { cal, clubSide, entryById, go, canDonate } from './pages.js';
import { HEALTH, healthNote, sourcesHtml } from './health.js';
import { WORLD, loadWorld, worldCardsHtml } from './views.js';

/* ================= render: header & static ================= */
export function renderStatus() {
  const el = $('status');
  if (!navigator.onLine && DATA.raw) {
    // No internet: say so plainly, and how old the data on screen is.
    el.className = 'status stale';
    el.innerHTML = `<i></i>Ești offline · datele sunt din ${new Date(DATA.mode === 'live' ? DATA.loadedAt : DATA.raw.updated).toLocaleString('ro-RO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}; scorurile și vremea revin când ai internet`;
    return;
  }
  if (DATA.mode === 'live') {
    el.className = 'status';
    el.innerHTML = `<i></i>Date live de la ESPN · actualizate ${ago(DATA.loadedAt)} <button type="button" id="reload">Reîncarcă</button>`;
  } else if (DATA.mode === 'cache') {
    el.className = 'status stale';
    el.innerHTML = `<i></i>Date salvate pe dispozitiv, din ${new Date(DATA.raw.updated).toLocaleString('ro-RO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · se reîncearcă <button type="button" id="reload">Reîncarcă</button>`;
  } else if (DATA.mode === 'snapshot') {
    const [y, m, d] = parts(DATA.raw.updated.slice(0, 10));
    el.className = 'status stale';
    el.innerHTML = `<i></i>Sursa live nu răspunde; afișez datele salvate din ${d} ${MONTHS[m - 1]} ${y} <button type="button" id="reload">Reîncearcă</button>`;
  }
  // Which source has trouble, from /api/health (also in the footer).
  const note = DATA.raw && healthNote();
  if (note) el.insertAdjacentHTML('beforeend', ` <span class="srcwarn">${esc(note)}</span>`);
}
// The footer line with the state of ESPN and Open-Meteo.
export function renderSources() {
  $('sources').innerHTML = sourcesHtml(HEALTH, DATA.mode === 'live' ? (DATA.raw?.errors?.length || 0) : 0);
}
export function renderStatic() {
  $('chips').innerHTML = Object.keys(LEAGUES).map(l => {
    const L = LEAGUES[l];
    return L.off
      ? `<button class="chip" type="button" disabled style="--c:${L.color}" title="Extrasezon"><span class="dot"></span>${l} · extrasezon</button>`
      : `<button class="chip" type="button" data-l="${l}" aria-pressed="${state.leagues.has(l)}" style="--c:${L.color}"><span class="dot"></span>${l}</button>`;
  }).join('');
  let opts = '<option value="">Toate echipele</option>'; const byL = {};
  for (const k in TEAMS) (byL[TEAMS[k].l] ||= []).push(k);
  for (const l in byL) opts += `<optgroup label="${l}">` + byL[l].map(k => `<option value="${k}">${TEAMS[k].espn}</option>`).join('') + '</optgroup>';
  $('team').innerHTML = opts;
  renderMine();
  $('tables').innerHTML = Object.keys(DIVISIONS).map(tableHtml).join('');
}

/* ================= "Echipele mele": the teams on the home page ================= */
// By default the Florida teams; × takes one out, "Adaugă o echipă" opens a list of every team.
export const minePick = { open: false, q: '' };
export function mineCardHtml(x) {
  const out = `<button class="mx" type="button" data-mine-toggle="${esc(x.id)}" aria-label="Scoate din echipele mele" title="Scoate din echipele mele">×</button>`;
  if (TEAMS[x.id]) {
    const T = TEAMS[x.id], st = teamStats(x.id);
    return `<div class="mcard"><button class="tbtn" type="button" data-team="${x.id}">${emb(flSide(x.id))}<span><b>${esc(T.s)}</b><small>${T.l} · ${st.rec}</small></span></button>${out}</div>`;
  }
  const s = clubSide(x.id), e = entryById(x.l, x.eid);
  return `<div class="mcard"><button class="tbtn" type="button" data-club="${x.l}|${esc(x.eid)}">${emb(s)}<span><b>${esc(s.name)}</b><small>${x.l}${e ? ' · ' + recordOf(e, x.l) : ''}</small></span></button>${out}</div>`;
}
// Every team of the five leagues, for the "add" list: Florida teams by key, the rest as 'NBA-2'.
export function allTeamsList() {
  const out = [];
  for (const l of Object.keys(LEAGUES)) {
    const seen = new Set();
    for (const k of Object.keys(TEAMS).filter(k => TEAMS[k].l === l)) { out.push({ id: k, l, name: TEAMS[k].espn, side: flSide(k) }); seen.add(norm(TEAMS[k].espn)); }
    const entries = (DATA.raw?.standings?.[l] || []).flatMap(g => g.entries).filter(e => e.id && !seen.has(norm(e.name)) && !flKey(l, e.name));
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) out.push({ id: clubId(l, e.id), l, name: e.name, side: e });
  }
  return out;
}
export function minePickHtml() {
  const q = norm(minePick.q), list = allTeamsList().filter(t => !q || norm(t.name + ' ' + t.l).includes(q));
  const byL = {};
  for (const t of list) (byL[t.l] ||= []).push(t);
  return `<div class="minepick"><div class="mphead"><input id="minefilter" type="search" autocomplete="off" placeholder="Caută echipa (ex. Celtics, Yankees)" aria-label="Caută echipa" value="${esc(minePick.q)}">
      <button class="ghost" type="button" data-mine-close>Gata</button></div>
    <div class="mplist">${Object.entries(byL).map(([l, ts]) => `<div class="mpgrp"><b><span class="ldot" style="--c:${col(l)}"></span>${l}</b>${ts.map(t => { const on = isMine(t.id); return `<button class="mpteam${on ? ' on' : ''}" type="button" data-mine-toggle="${esc(t.id)}" aria-pressed="${on}">${emb(t.side, 'sm')}<span class="nm">${esc(t.name)}</span><i>${on ? '★' : '+'}</i></button>`; }).join('')}</div>`).join('') || `<div class="empty">Nicio echipă pentru „${esc(minePick.q)}”.</div>`}</div>
    ${MINE.custom ? '<button class="link" type="button" data-mine-reset>Înapoi la echipele implicite</button>' : ''}</div>`;
}
/* ----- the first visit: "Ce echipe urmărești?" instead of the list, until answered or put off ----- */
export const WELCOME = { on: welcomeDue(), picked: [], q: '' };
// The best-known teams of each league, offered first (ESPN names); the search finds any other.
const KNOWN = {
  NBA: ['Los Angeles Lakers', 'Boston Celtics', 'Golden State Warriors', 'New York Knicks', 'Chicago Bulls', 'Miami Heat'],
  NFL: ['Kansas City Chiefs', 'Dallas Cowboys', 'Philadelphia Eagles', 'San Francisco 49ers', 'Green Bay Packers', 'New England Patriots'],
  NHL: ['New York Rangers', 'Toronto Maple Leafs', 'Boston Bruins', 'Edmonton Oilers'],
  MLB: ['New York Yankees', 'Los Angeles Dodgers', 'Boston Red Sox'],
  MLS: ['Inter Miami CF', 'LA Galaxy', 'LAFC']
};
function welcomeGridHtml() {
  const all = allTeamsList(), q = norm(WELCOME.q);
  const chip = t => { const on = WELCOME.picked.includes(t.id); return `<button class="wteam" type="button" data-welcome-pick="${esc(t.id)}" aria-pressed="${on}">${emb(t.side, 'sm')}<span>${esc(t.name)}</span><i aria-hidden="true">${on ? '✓' : '+'}</i></button>`; };
  if (q) {
    const hits = all.filter(t => norm(t.name + ' ' + t.l).includes(q)).slice(0, 24);
    return `<div class="wgrid">${hits.length ? `<div class="wgrp">${hits.map(chip).join('')}</div>` : `<div class="empty">Nicio echipă pentru „${esc(WELCOME.q)}”.</div>`}</div>`;
  }
  // The known teams, plus any picked from the search, by league.
  const want = new Set(Object.values(KNOWN).flat().map(norm));
  const shown = all.filter(t => want.has(norm(t.name)) || WELCOME.picked.includes(t.id));
  return `<div class="wgrid">${['NBA', 'NFL', 'NHL', 'MLB', 'MLS'].map(l => { const ts = shown.filter(t => t.l === l); return ts.length ? `<div class="wgrp"><b><span class="ldot" style="--c:${col(l)}"></span>${l}</b>${ts.map(chip).join('')}</div>` : ''; }).join('')}</div>`;
}
const welcomeDoneHtml = () => { const n = WELCOME.picked.length; return `<button class="primary" type="button" data-welcome-done ${n ? '' : 'disabled'}>${n ? `Gata · ${n} ${n === 1 ? 'echipă' : 'echipe'}` : 'Alege cel puțin o echipă'}</button>`; };
export function welcomeHtml() {
  return `<div class="welcome"><h3>Bun venit! Ce echipe urmărești?</h3>
    <p>Alege-le și pagina devine a ta: următorul meci cu ora României, rezultatele, clasamentele și, dacă vrei, notificări. Le poți schimba oricând.</p>
    <input id="welcomefilter" type="search" autocomplete="off" placeholder="Caută orice echipă (ex. Celtics, Real Salt Lake)" aria-label="Caută echipa" value="${esc(WELCOME.q)}">
    ${welcomeGridHtml()}
    <div class="wbtns"><span class="wdone">${welcomeDoneHtml()}</span><button class="link" type="button" data-welcome-skip>Mai târziu: arată-mi ${esc(HOME.name)}</button></div></div>`;
}
// Typing or ticking: redraw only the list and the button, so the search field keeps the focus.
export function renderWelcomeList() {
  const box = document.querySelector('#teams .welcome'); if (!box) return;
  const tmp = document.createElement('div'); tmp.innerHTML = welcomeGridHtml();
  box.querySelector('.wgrid').replaceWith(tmp.firstElementChild);
  box.querySelector('.wdone').innerHTML = welcomeDoneHtml();
}
export function renderMine() {
  const el = $('teams'); if (!el) return;
  // The question comes first on the page (above "Urmează"); answered, the section goes back to its place.
  const sec = $('echipe'), hero = $('hero');
  if (sec && hero) { if (WELCOME.on && sec.nextElementSibling !== hero) hero.before(sec); else if (!WELCOME.on && hero.nextElementSibling !== sec) hero.after(sec); }
  if (WELCOME.on) { el.innerHTML = welcomeHtml(); return; }
  el.innerHTML = `<div class="teams">${MINE.list.map(mineCardHtml).join('')}
      <button class="tbtn add" type="button" data-mine-add aria-expanded="${minePick.open}"><span class="plus" aria-hidden="true">+</span><span><b>Adaugă o echipă</b><small>din oricare ligă</small></span></button></div>
    ${MINE.list.length ? '' : '<div class="fn">Nu urmărești nicio echipă. Adaugă una sau revino la echipele implicite.</div>'}
    ${minePick.open ? minePickHtml() : ''}`;
}
export function renderMinePickList() {
  // Typing in the filter: redraw only the list, so the field keeps the focus.
  const box = document.querySelector('#teams .minepick'); if (!box) return;
  const tmp = document.createElement('div'); tmp.innerHTML = minePickHtml();
  box.querySelector('.mplist').replaceWith(tmp.querySelector('.mplist'));
}
export function tableHtml(k) {
  const D = DIVISIONS[k], rows = divisionRows(k);
  const cols = D.l === 'NHL' ? ['V', 'Î', 'Îp', 'Pct'] : D.l === 'MLS' ? ['V–Î–E', 'Pct'] : ['V', 'Î'];
  const cells = e => D.l === 'NHL' ? [e.w, e.l, e.otl ?? 0, ptsOf(e, 'NHL')] : D.l === 'MLS' ? [recordOf(e, 'MLS'), ptsOf(e, 'MLS')] : [e.w, e.l];
  const flKey = name => Object.keys(TEAMS).find(t => TEAMS[t].l === D.l && norm(TEAMS[t].espn) === norm(name));
  if (!rows.length) return `<div class="tbl"><h3><span class="ldot" style="--c:${col(D.l)}"></span>${D.t}</h3><div class="fn">Clasament indisponibil momentan.</div></div>`;
  return `<div class="tbl"><h3><span class="ldot" style="--c:${col(D.l)}"></span>${D.t}</h3><table><thead><tr><th></th><th>Echipă</th>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>` +
    rows.map((e, i) => { const fk = flKey(e.name); return `<tr class="${fk ? 'fl' : ''}"><td>${i + 1}</td><td>${emb({ ...e, key: fk }, 'sm')}${teamBtn(D.l, { name: e.name, key: fk, id: e.id })}</td>${cells(e).map(c => `<td>${c ?? '–'}</td>`).join('')}</tr>`; }).join('') +
    '</tbody></table></div>';
}

/* ================= render: hero & highlights ================= */
export function renderHero() {
  // The next game of my teams ("Echipele mele": the pack's teams still followed, and any added team).
  const now = Date.now(), ups = GAMES.filter(g => g.mine?.length && !played(g) && !g.tbd && (isLive(g) || g.end > now));
  const live = ups.filter(isLive);
  const g = live[0] || ups[0], mine = MINE.custom && g ? [g] : [];
  if (!g) { $('hero').innerHTML = '<div><div class="k">Urmează</div><div class="m">Niciun meci programat în datele curente.</div></div>'; return; }
  const k = keyOf(g.d, state.tz), on = isLive(g);
  const soon = ups.filter(x => x !== g && x.d.getTime() - now < 864e5).slice(0, 6);
  const big = on ? sp(g.id, `${g.hs ?? 0}–${g.as ?? 0}`) : g.d.getTime() <= now ? 'Urmează să înceapă' : 'în ' + countdown(g.d.getTime() - now);
  $('hero').innerHTML = `<div data-gid="${esc(g.id)}">
      <div class="k">${mine[0] === g ? 'Echipa ta · ' + esc(myShort(g.mine[0], g)) : on ? 'În desfășurare' : 'Următorul meci'} · ${g.l}</div>
      <div class="duo">${teamEmbBtn(g.l, g.H, '', true)}<span class="at">vs</span>${teamEmbBtn(g.l, g.A, '', true)}</div>
      <div class="cd">${big}</div>
      <div class="m">${teamBtn(g.l, g.H)} – ${teamBtn(g.l, g.A)}${on && g.detail ? ` <span class="tag live">LIVE · ${esc(detailRo(g.detail, g.l))}</span>` : ''}</div>
      <div class="w">${dayLabel(k)}, ${fmtTime[state.tz].format(g.d)} ${TZNAME[state.tz]} · ${g.v ? esc(g.v) + ', ' : ''}${esc(g.city)}${g.tv ? ' · ' + esc(g.tv) : ''}</div>
      <button class="go" type="button" data-game="${g.id}">Detalii meci</button>
    </div>
    <div class="soon"><div class="k">În următoarele 24 de ore</div>${soon.length ? soon.map(x => `<button class="srow" type="button" data-game="${x.id}"><b>${isLive(x) ? sp(x.id, `${x.hs}–${x.as}`) : fmtTime[state.tz].format(x.d)}</b><span>${esc(x.h)} – ${esc(x.a)} <span style="opacity:.7">· ${x.l}${isLive(x) ? ' · LIVE' : ''}</span></span></button>`).join('') : '<div class="w">Niciun alt meci în următoarele 24 de ore.</div>'}</div>`;
}

export function renderHighlights(busy) {
  const now = Date.now(), today = todayKey(), lim = keyOf(new Date(horizonEnd()), state.tz);
  let html = '';
  GAMES.filter(g => g.derby && !played(g) && g.end > now && g.d.getTime() < horizonEnd() + 30 * 864e5).slice(0, 3).forEach(g => {
    const k = keyOf(g.d, state.tz);
    html += `<button class="hlc derby" type="button" data-game="${g.id}"><span class="k">Derby ${esc(HOME.name)} · ${g.l}</span><span class="t">${esc(TEAMS[g.H.key].s)} – ${esc(TEAMS[g.A.key].s)}</span><span class="d">${dayLabel(k)}, ${fmtTime[state.tz].format(g.d)} · ${esc(g.v)}</span></button>`;
  });
  Object.keys(busy).filter(k => k >= today && k <= lim && busy[k].teams.size >= HOME.busy)
    .sort((a, b) => busy[b].teams.size - busy[a].teams.size || (a < b ? -1 : 1)).slice(0, 3).sort()
    .forEach(k => {
      html += `<button class="hlc" type="button" data-day="${k}" data-jump="1"><span class="k">Zi plină</span><span class="t">${dayLabel(k)}</span><span class="d">${busy[k].teams.size} echipe din ${esc(HOME.name)} · ${[...busy[k].leagues].join(', ')}</span></button>`;
    });
  // The next game in Europe and the next big day of the season (loaded once, then drawn again).
  if (!WORLD.data) loadWorld().then(() => renderHighlights(busyMap()));
  html += worldCardsHtml();
  $('hl').innerHTML = html || '<div class="empty">Nimic special în următoarele zile.</div>';
}

/* ================= render: calendar ================= */
export function monthsHtml(list, busy) {
  const today = todayKey();
  if (!state.month) state.month = today.slice(0, 7);
  const byDay = {};
  list.forEach(g => { const k = keyOf(g.d, state.tz); (byDay[k] ||= []).push(g); });
  const [y0, m0] = parts(state.month + '-01');
  let html = `<div class="wkhead"><button class="link" type="button" data-mo="-1" aria-label="Luna anterioară">‹</button><span class="fn" style="margin:0">Apasă pe o zi pentru meciurile ei</span><button class="link" type="button" data-mo="1" aria-label="Luna următoare">›</button></div><div class="months">`;
  for (let i = 0; i < 2; i++) {
    const dt = new Date(Date.UTC(y0, m0 - 1 + i, 1)), yy = dt.getUTCFullYear(), mm = dt.getUTCMonth();
    const n = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate();
    const lead = (dt.getUTCDay() + 6) % 7;
    html += `<section class="month"><h2>${MONTHS[mm]} ${yy}</h2><div class="grid">` + DOW.map(d => `<div class="dow">${d}</div>`).join('') + '<div></div>'.repeat(lead);
    for (let d = 1; d <= n; d++) {
      const k = `${yy}-${String(mm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const gs = byDay[k] || [];
      const cls = ['day']; if (gs.length) cls.push('has'); if (k === today) cls.push('today'); if (k === state.day) cls.push('sel'); if (k < today) cls.push('old');
      const full = busy[k] && busy[k].teams.size >= HOME.busy; if (full && gs.length) cls.push('busy');
      const dots = [...new Set(gs.map(g => g.l))].map(l => `<i style="--c:${col(l)}"></i>`).join('');
      html += gs.length
        ? `<button type="button" class="${cls.join(' ')}" data-day="${k}" aria-pressed="${k === state.day}" aria-label="${dayLabel(k)}: ${gs.length} ${gs.length === 1 ? 'meci' : 'meciuri'}${full ? ', zi plină' : ''}"><span class="n">${d}</span><span class="dots">${dots}</span></button>`
        : `<div class="${cls.join(' ')}"><span class="n">${d}</span></div>`;
    }
    html += '</div></section>';
  }
  return html + '</div>';
}
export function weekHtml(list, busy) {
  if (!state.week) { const a = todayKey(); state.week = addDays(a, -((dowOf(a) + 6) % 7)); }
  const today = todayKey(), byDay = {};
  list.forEach(g => { const k = keyOf(g.d, state.tz); (byDay[k] ||= []).push(g); });
  const end = addDays(state.week, 6);
  let html = `<div class="week"><div class="wkhead"><button class="link" type="button" data-wk="-7" aria-label="Săptămâna anterioară">‹</button><h2>${shortDate(state.week)} – ${shortDate(end)}</h2><button class="link" type="button" data-wk="7" aria-label="Săptămâna următoare">›</button></div>`;
  html += `<div class="wkrow axis"><span></span><div class="track ax">${[0, 6, 12, 18, 24].map(h => `<span style="left:${h / 24 * 100}%">${String(h).padStart(2, '0')}</span>`).join('')}</div></div>`;
  for (let i = 0; i < 7; i++) {
    const k = addDays(state.week, i), gs = (byDay[k] || []).slice().sort((a, b) => a.d - b.d), lanes = [];
    let pills = '';
    gs.forEach(g => {
      const [h, m] = fmtHM[state.tz].format(g.d).split(':').map(Number), st = (h % 24) * 60 + m, du = Math.min(LEAGUES[g.l].dur, 1440 - st);
      let ln = lanes.findIndex(e => e <= st); if (ln < 0) { ln = lanes.length; lanes.push(0); } lanes[ln] = st + du + 10;
      const lab = g.mine.map(t => myShort(t, g)).join(' · ');
      pills += `<button class="pill${played(g) ? ' done' : ''}" type="button" data-game="${g.id}" style="--c:${col(g.l)};left:${st / 1440 * 100}%;width:${du / 1440 * 100}%;top:${5 + ln * 23}px" title="${fmtTime[state.tz].format(g.d)} ${esc(g.h)} – ${esc(g.a)}" aria-label="${fmtTime[state.tz].format(g.d)}, ${esc(g.h)} – ${esc(g.a)}">${esc(lab)}</button>`;
    });
    const full = busy[k] && busy[k].teams.size >= HOME.busy;
    html += `<div class="wkrow"><button class="wkday${k === today ? ' today' : ''}${full ? ' busy' : ''}" type="button" data-day="${k}" aria-label="${dayLabel(k)}">${DOW[i]} ${parts(k)[2]}</button><div class="track" style="height:${Math.max(30, 10 + lanes.length * 23)}px">${pills}</div></div>`;
  }
  return html + `<div class="fn">Fiecare bandă e un meci, așezat după ora de start (${TZNAME[state.tz]}). Apasă pe un meci pentru detalii sau pe zi pentru lista ei.</div></div>`;
}

/* ================= render: agenda ================= */
export function tn(g, side) {
  const k = side.key;
  return `${emb(side, 'sm')}${teamBtn(g.l, side)}`;
}
export function card(g) {
  const other = state.tz === 'ro' ? 'fl' : 'ro', done = played(g), on = isLive(g);
  const where = g.derby ? `<span class="tag derby">Derby ${esc(HOME.name)}</span>` : g.inFL ? '<span class="tag home">Acasă</span>' : '<span class="tag away">Deplasare</span>';
  const time = g.tbd ? '<span style="font-size:15px">oră neanunțată</span>' : fmtTime[state.tz].format(g.d);
  const alt = g.tbd ? '' : `<small>${fmtTime[other].format(g.d)} ${TZNAME[other]}<br>${fmtShort[other].format(g.d)}</small>`;
  let extra = '';
  if (on) extra = `<span class="tag live">LIVE${g.detail ? ' · ' + esc(detailRo(g.detail, g.l)) : ''}</span>`;
  else if (done) { const o = outcomeFor(g, g.mine?.[0] || g.teams[0]); extra = sp(g.id, `<span class="tag r-${o}">${OUT[o]}</span>`); }
  else if (!g.tbd) extra = `<span class="tag aw-${g.aw}">${AW[g.aw]}</span>`;
  const mid = done || on ? `<span class="sc">${sp(g.id, `${g.hs ?? 0}–${g.as ?? 0}`)}</span>` : '<span class="vs">vs</span>';
  return `<article class="game${g.derby ? ' derby' : ''}${on ? ' live' : ''}" style="--c:${col(g.l)}" data-gid="${esc(g.id)}">
    <div class="time">${time}${alt}</div>
    <div><div class="tags"><span class="tag lg">${g.l}</span>${where}${extra}${g.note ? `<span class="tag note">${esc(noteRo(g.note))}</span>` : ''}</div>
    <div class="match">${tn(g, g.H)}${mid}${tn(g, g.A)}</div>
    <div class="vrow"><span class="venue">${venueLine(g)}${g.tv ? ` · <span class="tv">${esc(g.tv)}</span>` : ''}</span><button class="more" type="button" data-game="${g.id}">Detalii ›</button></div></div></article>`;
}
// "Stadium · City": links to the stadium and city pages for the Florida venues.
export function venueLine(g) {
  const v = venueByName(g.v), c = v && cityOf(v);
  if (!v) return `${g.v ? esc(g.v) + ' · ' : ''}${esc(g.city)}`;
  return `<button class="linkish" type="button" data-venue="${v.id}">${esc(g.v)}</button> · ${c ? `<button class="linkish" type="button" data-city="${c.id}">${esc(c.name)}</button>, ${c.lite ? esc(c.state) : 'FL'}` : esc(g.city)}`;
}
export function grouped(list, busy, showFull) {
  let html = '', cur = '';
  list.forEach(g => {
    const k = keyOf(g.d, state.tz);
    if (k !== cur) {
      if (cur) html += '</div>';
      const b = busy[k], full = showFull && b && b.teams.size >= HOME.busy;
      html += `<h3 class="dayhead"><span>${dayLabel(k)}</span>${full ? `<span class="full">Zi plină · ${b.teams.size} echipe</span>` : ''}</h3><div class="list">`; cur = k;
    }
    html += card(g);
  });
  return html + (cur ? '</div>' : '');
}
export const nextDays = n => `următoarele ${n}${n >= 20 ? ' de' : ''} zile`;   // „14 zile”, „21 de zile”
export function renderAgenda(list, busy) {
  // The list shows whole calendar days: today and the next ones, 7 at first, then 7 more per click.
  const now = Date.now(), lastDay = addDays(todayKey(), state.agendaDays - 1);
  const inDay = g => keyOf(g.d, state.tz) === state.day;
  const inRange = g => keyOf(g.d, state.tz) <= lastDay;
  const up = state.day ? list.filter(g => !played(g) && inDay(g)) : list.filter(g => !played(g) && inRange(g) && (isLive(g) || g.end > now - 6 * 36e5));
  const recent = new Set(mineIds().flatMap(k => lastGames(k).map(g => g.id)));
  const past = (state.day ? list.filter(g => played(g) && inDay(g)) : list.filter(g => played(g) && recent.has(g.id))).reverse();
  const inFL = up.filter(g => g.inFL).length, good = up.filter(g => g.aw === 'good' && !g.tbd).length;
  $('count').innerHTML = `${up.length} ${up.length === 1 ? 'meci programat' : 'meciuri programate'} <span>· ${inFL} în ${esc(HOME.name)} · ${good} la ore bune în România${state.day ? ' · ' + dayLabel(state.day) : ` · ${nextDays(state.agendaDays)}`}</span>`;
  $('upcount').textContent = state.day ? `${up.length} ${up.length === 1 ? 'meci' : 'meciuri'}, ${dayLabel(state.day)}` : `${up.length} ${up.length === 1 ? 'meci' : 'meciuri'} în ${nextDays(state.agendaDays)}`;
  $('clear').hidden = !state.day;
  const more = list.some(g => !played(g) && !inRange(g));
  $('more').hidden = !!state.day || !more;
  $('agenda').innerHTML = up.length ? grouped(up, busy, true) : `<div class="empty">${state.day && past.length ? 'Meciurile din această zi s-au jucat. Scorurile sunt mai jos.' : 'Niciun meci programat pentru filtrele alese. Schimbă liga, echipa sau ziua.'}</div>`;
  $('rescount').textContent = state.day ? `${past.length} ${past.length === 1 ? 'meci' : 'meciuri'}` : `${past.length} ${past.length === 1 ? 'meci' : 'meciuri'}, ultimele 5 ale fiecărei echipe`;
  $('results').innerHTML = past.length ? grouped(past, busy, false) : '<div class="empty" style="margin-top:10px">Niciun rezultat pentru filtrele alese.</div>';
  $('reswrap').hidden = !past.length && !!state.day;
  if (state.day && past.length) $('reswrap').open = true;
}

/* ================= render: map ================= */
export const FL_OUTLINE = [[31.0, -87.6], [31.0, -85.0], [30.7, -84.9], [30.7, -82.2], [30.36, -82.05], [30.7, -81.45], [30.3, -81.4], [29.9, -81.3], [29.0, -80.9], [28.4, -80.55], [27.8, -80.4], [27.0, -80.05], [26.3, -80.07], [25.6, -80.25], [25.2, -80.4], [25.12, -81.1], [25.85, -81.7], [26.5, -82.1], [27.0, -82.4], [27.6, -82.75], [28.2, -82.8], [28.9, -82.7], [29.5, -83.4], [30.05, -84.0], [29.9, -84.4], [29.65, -85.1], [29.7, -85.4], [30.2, -85.9], [30.4, -86.6], [30.3, -87.5]];
export function renderMap() {
  // The map is of Florida: shown only with the Florida pack.
  if (!HOME.map) { $('harta').hidden = true; return; }
  const K = 40, px = lon => (lon + 88.2) * K, py = lat => (31.4 - lat) * K * 1.13, now = Date.now(), lim = horizonEnd();
  const home = {}; for (const m in METROS) home[m] = [];
  GAMES.forEach(g => { if (!played(g) && g.inFL && g.end > now && g.d.getTime() < lim && g.H.key) home[TEAMS[g.H.key].metro].push(g); });
  let svg = `<svg viewBox="0 0 340 300" role="img" aria-label="Harta Floridei cu orașele echipelor"><path class="land" d="M${FL_OUTLINE.map(p => px(p[1]).toFixed(1) + ',' + py(p[0]).toFixed(1)).join('L')}Z"/>`;
  for (const m in METROS) {
    const M = METROS[m], x = px(M.lon), y = py(M.lat), n = home[m].length;
    const r = 11 + Math.min(n, 14) * .5, lx = M.lx === -10 ? M.lx : Math.sign(M.lx) * (r + 5);
    svg += `<g class="city${state.metro === m ? ' on' : ''}" data-metro="${m}" tabindex="0" role="button" aria-label="${M.n}: ${n} meciuri acasă"><circle cx="${x}" cy="${y}" r="${r}"/><text class="cnt" x="${x}" y="${y + 4}">${n}</text><text x="${x + lx}" y="${y + M.ly - (M.lx === -10 ? r - 11 : 0)}" text-anchor="${M.anc}">${M.short || M.n}</text></g>`;
  }
  $('map').innerHTML = svg + '</svg>';
  const M = METROS[state.metro], ks = Object.keys(TEAMS).filter(k => TEAMS[k].metro === state.metro), gs = home[state.metro];
  const P = PLACES.data, cities = P ? Object.values(P.cities).filter(c => c.metro === state.metro) : [];
  const venues = P ? Object.values(P.venues).filter(v => cities.some(c => c.id === v.city)) : [];
  $('mpanel').innerHTML = `<h3>${M.n}</h3><p>${gs.length} ${gs.length === 1 ? 'meci' : 'meciuri'} acasă în următoarele ${state.horizon} de zile. Numărul din cerc arată meciurile de acasă.</p>
    ${cities.length ? `<div class="mcities">${cities.map(cityCard).join('')}</div>` : ''}
    ${venues.length ? `<div class="mvenues">${venues.map(v => `<button type="button" data-venue="${v.id}">${v.image ? `<img src="${esc(v.image.small)}" alt="" loading="lazy">` : ''}<span><b>${esc(v.name)}</b><small>${v.teams.map(k => esc(TEAMS[k].s)).join(', ')} · ${roofWord(v)}</small></span></button>`).join('')}</div>` : `<div class="mteams">${ks.map(k => `<button type="button" data-team="${k}">${emb(flSide(k), 'sm')}${esc(TEAMS[k].s)}</button>`).join('')}</div>`}
    <div class="rows">${gs.slice(0, 7).map(g => `<button class="row" type="button" data-game="${g.id}"><span class="when">${tShort(g.d)}</span><span>${esc(TEAMS[g.H.key].s)} – ${esc(g.a)}</span><span class="r">${g.tbd ? '' : fmtTime[state.tz].format(g.d)}</span></button>`).join('') || '<div class="row"><span></span><span>Niciun meci acasă în perioadă.</span><span></span></div>'}</div>
    ${gs.length > 7 ? `<div class="fn">și încă ${gs.length - 7}; vezi lista completă cu filtrul „Jucate în ${esc(HOME.name)}”.</div>` : ''}`;
}

export function render() {
  $('tz-ro').setAttribute('aria-pressed', state.tz === 'ro');
  $('tz-fl').setAttribute('aria-pressed', state.tz === 'fl');
  $('v-month').setAttribute('aria-pressed', state.view === 'month');
  $('v-week').setAttribute('aria-pressed', state.view === 'week');
  $('team').value = state.team;
  $('homeonly').checked = state.home; $('awake').checked = state.awake;
  const list = filtered(), busy = busyMap();
  if (state.day && !list.some(g => keyOf(g.d, state.tz) === state.day)) state.day = null;
  renderStatus(); renderHero(); renderHighlights(busy);
  $('cal').innerHTML = state.view === 'week' ? weekHtml(list, busy) : monthsHtml(list, busy);
  renderAgenda(list, busy); renderMap();
  writeFilters();
}

/* ================= playoff bracket ================= */
// Shown for each league where a Florida team has playoff games around now (60 days back, 45 ahead).
export const PLAYOFFS = new Map();
export const PO = { league: '' };
export const playoffLike = n => /playoff|round|runda|wild card|final|play-in|semifinal|championship|super bowl/i.test(n || '') && !/nba cup|cupa nba/i.test(n || '');
export function playoffLeagues() {
  const now = Date.now();
  return [...new Set(GAMES.filter(g => playoffLike(g.note) && Math.abs(g.d.getTime() - now) < 60 * 864e5).map(g => g.l))];
}
export async function renderPlayoffs() {
  const sec = $('playoffs'), ls = playoffLeagues();
  if (!ls.length || DATA.mode === 'snapshot') { sec.hidden = true; return; }
  if (!ls.includes(PO.league)) PO.league = ls[0];
  const l = PO.league;
  if (!PLAYOFFS.has(l)) {
    PLAYOFFS.set(l, null);
    // Every playoff game is kept, so any series opens its game page, not only the home teams'.
    getJSON(`/api/playoffs?l=${l}`, 15000).then(j => { keepExtra(j.games || []); PLAYOFFS.set(l, j); renderPlayoffs(); }, () => PLAYOFFS.delete(l));
  }
  const data = PLAYOFFS.get(l);
  const head = `<div class="tnhead"><h2 class="sec">Playoff ${l}</h2>${ls.length > 1 ? `<div class="seg" role="group" aria-label="Liga">${ls.map(x => `<button type="button" data-pl="${x}" aria-pressed="${x === l}">${x}</button>`).join('')}</div>` : ''}</div>`;
  if (!data) { sec.hidden = false; sec.innerHTML = head + '<div class="skeleton" style="height:140px"></div>'; return; }
  const layout = bracketLayout(buildSeries(data.games || []));
  if (!layout.length) { sec.hidden = true; return; }
  const flName = n => Object.keys(TEAMS).find(k => TEAMS[k].l === l && norm(TEAMS[k].espn) === norm(n));
  const card = s => {
    const fl = s.teams.map(t => flName(t.name)).find(Boolean);
    const target = gameById((s.next || s.games[s.games.length - 1]).id);
    const many = s.games.length > 1;
    const status = s.winner ? `${esc(TEAMS[flName(s.winner.name)]?.s || s.winner.abbr || s.winner.name)} merge mai departe${many ? ` (${s.winner.wins}–${Math.min(...s.teams.map(t => t.wins))})` : ''}`
      : s.next ? `${s.next.tbd ? 'oră neanunțată' : `${tShort(new Date(s.next.date))}, ${fmtTime.ro.format(new Date(s.next.date))}`}${many && s.teams.some(t => t.wins) ? ` · seria ${s.teams[0].wins}–${s.teams[1].wins}` : ''}`
      : '';
    const row = t => {
      const k = flName(t.name), e = !t.tbd && entryOf(l, t.name), seed = e && (e.seed ?? e.order);
      const side = { name: t.name, abbr: t.abbr, logo: t.logo, logoDark: t.logoDark, color: t.color, key: k || null };
      return `<div class="srow2${s.winner && s.winner.name !== t.name ? ' out' : ''}${k ? ' fl' : ''}">${t.tbd ? '<span class="emb sm neutral"><b>?</b></span>' : emb(side, 'sm')}<span class="nm">${seed ? `<small>${seed}</small>` : ''}${esc(k ? TEAMS[k].s : t.name)}</span>${many || s.done ? `<b>${many ? t.wins : (t.score ?? '')}</b>` : ''}</div>`;
    };
    return `<${target ? `button type="button" data-game="${target.id}"` : 'div'} class="ser${fl ? ' fl' : ''}">${row(s.teams[0])}${row(s.teams[1])}${status ? `<small class="ss">${status}</small>` : ''}</${target ? 'button' : 'div'}>`;
  };
  sec.hidden = false;
  sec.innerHTML = head + layout.map(b => `<div class="bconf">${b.conf ? `<h3>${esc(confRo(b.conf))}</h3>` : ''}<div class="bcols">${b.rounds.map(r => `<div class="bcol"><div class="bround">${esc(roundRo(r.stage, l))}</div><div class="bser">${r.series.map(card).join('')}</div></div>`).join('')}</div></div>`).join('')
    + '<div class="fn">Numărul mic din fața echipei e locul din sezonul regulat. Echipele tale sunt evidențiate; apasă pe seria lor pentru pagina meciului.</div>';
}

/* ----- weather strip on the home page ----- */
export async function renderStrip() {
  // New York (and any pack outside Florida): its cities and stadiums from data/america.json.
  if (HOME.strip.src === 'america') {
    const A = AMERICA.data || await loadAmerica();
    if (!A) return;
    const names = Object.fromEntries(Object.values(TEAMS).map(t => [t.espn, t.s]));
    $('vstrip').innerHTML = HOME.strip.venues.map(id => A.venues[id]).filter(Boolean).map(v => `<button type="button" class="vchip" data-venue="${v.id}">${v.photo ? `<img src="${esc(v.photo)}" alt="" loading="lazy" decoding="async">` : ''}<span><b>${esc(v.name)}</b><small>${esc((v.teams || []).map(t => names[t.name]).filter(Boolean).join(', '))} · ${esc(A.cities[v.city]?.name || '')}</small></span></button>`).join('');
    const cities = HOME.strip.cities.map(id => A.cities[id]).filter(Boolean);
    $('wxstrip').innerHTML = stripHtml(null, cities);
    try { $('wxstrip').innerHTML = stripHtml(await getWeather(cities, true), cities); }
    catch (e) { $('wxstrip').innerHTML = stripHtml(null, cities).replace(/…/g, 'vremea nu e disponibilă'); }
    return;
  }
  if (!PLACES.data) return;
  // The nine stadiums, north to south, as a row that scrolls sideways on a phone.
  $('vstrip').innerHTML = Object.values(PLACES.data.venues).sort((a, b) => b.lat - a.lat).map(v => `<button type="button" class="vchip" data-venue="${v.id}">${v.image ? `<img src="${esc(v.image.small)}" alt="" loading="lazy" decoding="async">` : ''}<span><b>${esc(v.name)}</b><small>${v.teams.map(k => esc(TEAMS[k].s)).join(', ')} · ${esc(cityOf(v)?.name || '')}</small></span></button>`).join('');
  $('wxstrip').innerHTML = stripHtml(null);
  try {
    const list = await getWeather(STRIP.map(id => PLACES.data.cities[id]), true);
    $('wxstrip').innerHTML = stripHtml(list);
  } catch (e) { $('wxstrip').innerHTML = stripHtml(null).replace(/…/g, 'vremea nu e disponibilă'); }
}

export function renderPhone() {
  // The header "Instalează" button appears only when the browser can install the app right away.
  // On Windows the Microsoft Store app is offered instead.
  $('hstore').hidden = !offerStore();
  $('donlink').hidden = !canDonate();
  $('hinstall').hidden = !canInstall() || offerStore();
  $('phone').innerHTML = `<div class="phcard"><h3>${isWindows() && !isStandalone() ? 'Aplicația pe calculator' : 'Aplicația pe telefon'}</h3>${installHtml()}</div>
    <div class="phcard"><h3>Meciurile în calendarul tău</h3><p>Abonează-te o dată și meciurile echipelor alese apar singure în Google Calendar, pe iPhone sau în Outlook, cu ora ta și cu amintire.</p><button class="primary" type="button" data-team-cal="">Abonare la calendar</button></div>
    ${canDonate() ? '<div class="phcard"><h3>Susține proiectul</h3><p>Gratuit, fără reclame, făcut de o singură persoană. Dacă îți e de folos, o cafea ajută.</p><button class="ghost" type="button" data-donate-open>Susține ❤</button></div>' : ''}
    <div class="phcard"><h3>Notificări</h3><p>Un anunț înainte de meciurile echipelor tale și rezultatul final, chiar cu aplicația închisă.</p><button class="primary" type="button" data-team-ntf="">Setează notificările</button></div>`;
}

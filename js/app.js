import { LEAGUES, TEAMS, DIVISIONS, DIVISION_OF, METROS, norm } from './teams.js';
import { esc, $, emb, pickInk, theme, isDark, onSystemTheme } from './ui.js';
import { detailRo, noteRo } from './ro.js';
import { tabsHtml, panelHtml, wpHover } from './game.js';
import { registerSW, onInstallChange, install, installHtml, calendarHtml, downloadGame, canInstall } from './phone.js';
import { buildSeries, bracketLayout, roundRo, confRo } from './bracket.js';
import { lgHeadHtml, scoresHtml, standingsHtml, teamsHtml, todayStripHtml } from './leagues.js';
import { teamTabsHtml, seasonChartHtml, seasonHover, leadersHtml, rosterHtml, newsHtml } from './teamx.js';
import { N, setNotifyRender, refreshNotify, enableNotify, saveNotify, testNotify, disableNotify, notifyHtml } from './notify.js';
import { PLACES, loadPlaces, venueByName, venueOfTeam, cityOf, getWeather, gameWeatherHtml, stripHtml, STRIP, cityHtml, venueHtml, placeWeatherHtml, climateHover, floridaClock, cityCard, roofWord, AMERICA, loadAmerica, getVenue, getCity, venueOfClub, cityLiteHtml, venueLiteHtml, clockIn, hoursBehindRomania } from './places.js';

/* ================= data loading ================= */
const CACHE_KEY = 'flcal-cache-v1';
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage full or blocked */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
};
async function getJSON(url, ms = 12000) {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(r.status + ' ' + url);
  return r.json();
}
const DATA = { raw: null, mode: 'loading', loadedAt: 0 };

/* ================= model ================= */
let GAMES = [], BY_ID = new Map(), ENTRY = new Map(), TEAMINFO = {};
const OUT = { V: 'Victorie', I: 'Înfrângere', E: 'Egal' }, OUTL = { V: 'V', I: 'Î', E: 'E' };
const AW = { good: 'Oră bună în RO', late: 'Târziu în RO', night: 'Noapte în RO' };
const played = g => g.state === 'post';
const isLive = g => g.state === 'in';

const fmtRoH = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bucharest', hour: '2-digit', minute: '2-digit', hour12: false });
function awake(d) {
  const [h, m] = fmtRoH.format(d).split(':').map(Number); const t = (h % 24) * 60 + m;
  return t >= 720 && t <= 1380 ? 'good' : (t > 1380 || t < 60) ? 'late' : 'night';
}
// Conference names: "Eastern Conference" -> Est; NFL -> AFC/NFC; baseball's leagues -> AL/NL.
function confShort(n, l) {
  const x = norm(n);
  if (x.includes('east')) return 'Est';
  if (x.includes('west')) return 'Vest';
  if (x.includes('american')) return l === 'MLB' ? 'AL' : 'AFC';
  if (x.includes('national')) return l === 'MLB' ? 'NL' : 'NFC';
  return n;
}
// Florida team key by league and ESPN name (games from other lists come without keys).
const FL_BY_NAME = Object.fromEntries(Object.entries(TEAMS).map(([k, t]) => [t.l + '|' + norm(t.espn), k]));
const flKey = (l, name) => FL_BY_NAME[l + '|' + norm(name)] || null;
function teamSide(t, l) {
  return { id: t.id ? String(t.id) : '', name: t.name, abbr: t.abbr || '', logo: t.logo, logoDark: t.logoDark, color: t.color, alt: t.alt, key: t.key || flKey(l, t.name) };
}
// One game from any ESPN list (schedule, day scores, a team's season) -> the page's game object.
function toGame(x) {
  const d = new Date(x.date);
  if (isNaN(d) || !LEAGUES[x.l]) return null;
  const H = teamSide(x.home, x.l), A = teamSide(x.away, x.l);
  const g = {
    id: String(x.id), l: x.l, d, tbd: x.tbd, state: x.state, detail: x.detail,
    H, A, h: x.home.name, a: x.away.name, hs: x.home.score, as: x.away.score,
    v: x.venue, city: [x.city, x.region].filter(Boolean).join(', '), inFL: x.region === 'FL', note: x.note || '', tv: x.tv || '', raw: x
  };
  g.teams = [H.key, A.key].filter(k => k && TEAMS[k]);
  g.derby = g.teams.length === 2;
  g.aw = awake(d);
  g.end = d.getTime() + LEAGUES[g.l].dur * 6e4;
  return g;
}
// Games of other teams (day scores, a team's season): opened on the same game page.
const EXTRA = new Map();
const gameById = id => BY_ID.get(String(id)) || EXTRA.get(String(id)) || null;
const keepExtra = list => list.map(x => { const g = toGame(x); if (g && !BY_ID.has(g.id)) EXTRA.set(g.id, g); return g && (BY_ID.get(g.id) || g); }).filter(Boolean);

function build(raw) {
  ENTRY = new Map();
  for (const [l, groups] of Object.entries(raw.standings || {})) {
    for (const g of groups) for (const e of g.entries) ENTRY.set(l + '|' + norm(e.name), { ...e, conf: confShort(g.name || g.abbr, l), lg: l });
  }
  TEAMINFO = raw.teams || {};
  GAMES = (raw.games || []).map(toGame).filter(g => g && g.teams.length).sort((a, b) => a.d - b.d);
  BY_ID = new Map(GAMES.map(g => [g.id, g]));
  // Baseball is "extrasezon" while no game of the Florida teams is ahead (the schedule keeps 60 days).
  LEAGUES.MLB.off = !GAMES.some(g => g.l === 'MLB' && g.state !== 'post');
}

/* ----- per-team numbers ----- */
function entryOf(l, name) { return ENTRY.get(l + '|' + norm(name)) || null; }
function recordOf(e, l) {
  if (!e || e.w == null) return null;
  if (l === 'NHL') return `${e.w}–${e.l}–${e.otl ?? 0}`;
  if (l === 'MLS') return `${e.w}–${e.l}–${e.t ?? 0}`;
  return `${e.w}–${e.l}`;
}
const REC_LABEL = { NBA: 'V–Î', NFL: 'V–Î', NHL: 'V–Î–Îp', MLS: 'V–Î–E', MLB: 'V–Î' };
function ptsOf(e, l) { return e.pts ?? (l === 'NHL' ? 2 * (e.w || 0) + (e.otl || 0) : l === 'MLS' ? 3 * (e.w || 0) + (e.t || 0) : null); }
function pctOf(e) { return e.pct ?? ((e.w || 0) + (e.l || 0) ? (e.w || 0) / ((e.w || 0) + (e.l || 0) + (e.t || 0)) : 0); }
function sortDiv(rows, l) {
  return rows.slice().sort((a, b) =>
    l === 'NHL' || l === 'MLS' ? (ptsOf(b, l) - ptsOf(a, l)) || ((b.w || 0) - (a.w || 0))
      : (pctOf(b) - pctOf(a)) || ((b.w || 0) - (a.w || 0)));
}
function divisionRows(k) {
  const D = DIVISIONS[k];
  if (D.conference) {
    const groups = (DATA.raw.standings || {})[D.l] || [];
    const g = groups.find(x => norm(x.name).includes(D.conference)) || groups[0];
    return g ? g.entries.slice().sort((a, b) => (a.seed ?? a.order) - (b.seed ?? b.order)) : [];
  }
  return sortDiv(D.members.map(n => entryOf(D.l, n)).filter(Boolean), D.l);
}
function streakRo(s) {
  if (!s) return '';
  const m = String(s).match(/^(W|L|T|OTL|OT|D)\s*(\d+)$/i);
  if (!m) return s;
  const n = +m[2], t = m[1].toUpperCase();
  if (t === 'W') return n === 1 ? '1 victorie' : `${n} victorii la rând`;
  if (t === 'L') return n === 1 ? '1 înfrângere' : `${n} înfrângeri la rând`;
  if (t === 'OT' || t === 'OTL') return n === 1 ? '1 înfrângere în prelungiri' : `${n} înfrângeri în prelungiri la rând`;
  return n === 1 ? '1 egal' : `${n} egaluri la rând`;
}
function teamStats(k) {
  const T = TEAMS[k], info = TEAMINFO[k] || {}, e = entryOf(T.l, T.espn);
  const st = { rec: recordOf(e, T.l) || (info.record ? info.record.replace(/-/g, '–') : '–'), recL: REC_LABEL[T.l] };
  if (e) {
    st.conf = e.seed ?? e.order; st.confN = e.conf;
    const rows = divisionRows(DIVISION_OF[k]);
    const i = rows.findIndex(r => norm(r.name) === norm(T.espn));
    st.div = i >= 0 ? i + 1 : null;
    st.pts = ptsOf(e, T.l);
    st.home = e.home ? e.home.replace(/-/g, '–') : ''; st.away = e.away ? e.away.replace(/-/g, '–') : '';
    st.streak = streakRo(e.streak);
  } else st.standing = info.standing || '';
  return st;
}
function oppInfo(l, name) {
  const e = entryOf(l, name);
  return e ? `${recordOf(e, l)} · locul ${e.seed ?? e.order} ${e.conf}` : '';
}

/* ================= formatting ================= */
const TZ = { ro: 'Europe/Bucharest', fl: 'America/New_York' };
const TZNAME = { ro: 'ora României', fl: 'ora Floridei' };
const fmtKey = {}, fmtTime = {}, fmtShort = {}, fmtHM = {};
for (const k in TZ) {
  fmtKey[k] = new Intl.DateTimeFormat('en-CA', { timeZone: TZ[k], year: 'numeric', month: '2-digit', day: '2-digit' });
  fmtTime[k] = new Intl.DateTimeFormat('ro-RO', { timeZone: TZ[k], hour: '2-digit', minute: '2-digit', hour12: false });
  fmtShort[k] = new Intl.DateTimeFormat('ro-RO', { timeZone: TZ[k], weekday: 'short', day: 'numeric', month: 'short' });
  fmtHM[k] = new Intl.DateTimeFormat('en-GB', { timeZone: TZ[k], hour: '2-digit', minute: '2-digit', hour12: false });
}
const MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
const DOW = ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'];
const DOWFULL = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];
const col = l => LEAGUES[l].color;
const parts = k => k.split('-').map(Number);
function addDays(k, n) { const [y, m, d] = parts(k); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); }
function dowOf(k) { const [y, m, d] = parts(k); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
function dayLabel(k) { const [, m, d] = parts(k); return DOWFULL[dowOf(k)] + ', ' + d + ' ' + MONTHS[m - 1]; }
function shortDate(k) { const [, m, d] = parts(k); return d + ' ' + MONTHS[m - 1]; }
const keyOf = (d, tz) => fmtKey[tz].format(d);
const tShort = (d) => fmtShort[state.tz].format(d).replace('.', '');
function countdown(ms) {
  if (ms <= 0) return 'a început';
  const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
  return d > 0 ? `${d} z ${h} h` : h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}
function ago(ts) {
  const m = Math.round((Date.now() - ts) / 6e4);
  return m < 1 ? 'acum' : m < 60 ? `acum ${m} min` : `acum ${Math.round(m / 60)} h`;
}

const flSide = k => { const i = TEAMINFO[k] || {}; return { name: TEAMS[k].espn, abbr: i.abbr || TEAMS[k].ab, logo: i.logo, logoDark: i.logoDark, color: i.color, alt: i.alt, key: k }; };

/* ================= state ================= */
const state = { tz: 'ro', leagues: new Set(['NBA', 'NHL', 'NFL', 'MLS', 'MLB']), team: '', home: false, awake: false, day: null, view: 'month', week: null, month: null, metro: 'mia', fav: '', horizon: 30, agendaDays: 7 };
{
  const s = store.get('flgames-tz'); if (s === 'fl' || s === 'ro') state.tz = s;
  const f = store.get('flgames-fav'); if (f && TEAMS[f]) state.fav = f;
  const v = store.get('flgames-view'); if (v === 'week' || v === 'month') state.view = v;
  const t = store.get('flgames-theme'); if (t === 'light' || t === 'dark') theme.pref = t;
}

/* ----- filters live in the address (?ligi=NBA,NHL&echipa=heat&florida=1&ore=1&zi=2026-11-15), so a view can be shared ----- */
const ALL_L = Object.keys(LEAGUES).filter(l => !LEAGUES[l].off);
function readFilters() {
  const q = new URLSearchParams(location.search);
  const ls = (q.get('ligi') || '').split(',').map(x => x.trim().toUpperCase()).filter(l => ALL_L.includes(l));
  if (ls.length) state.leagues = new Set(ls);
  const t = q.get('echipa'); if (t && TEAMS[t]) state.team = t;
  state.home = q.get('florida') === '1';
  state.awake = q.get('ore') === '1';
  const z = q.get('zi'); if (/^\d{4}-\d{2}-\d{2}$/.test(z || '')) { state.day = z; state.month = z.slice(0, 7); state.week = weekStart(z); }
}
function writeFilters() {
  const q = new URLSearchParams();
  if (ALL_L.some(l => !state.leagues.has(l))) q.set('ligi', ALL_L.filter(l => state.leagues.has(l)).join(','));
  if (state.team) q.set('echipa', state.team);
  if (state.home) q.set('florida', '1');
  if (state.awake) q.set('ore', '1');
  if (state.day) q.set('zi', state.day);
  const s = q.toString().replace(/%2C/g, ',');
  const url = location.pathname + (s ? '?' + s : '') + location.hash;
  if (url !== location.pathname + location.search + location.hash) history.replaceState(history.state, '', url);
}
function weekStart(k) { return addDays(k, -((dowOf(k) + 6) % 7)); }
readFilters();

/* ----- theme ----- */
function applyTheme() {
  const r = document.documentElement;
  if (theme.pref === 'auto') delete r.dataset.theme; else r.dataset.theme = theme.pref;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = isDark() ? '#0c1a1d' : '#f3f6f6';
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

function filtered() {
  return GAMES.filter(g => state.leagues.has(g.l) && (!state.team || g.teams.includes(state.team)) && (!state.home || g.inFL) && (!state.awake || played(g) || isLive(g) || g.aw === 'good'));
}
function busyMap() {
  const m = {};
  GAMES.forEach(g => { const k = keyOf(g.d, state.tz); (m[k] ||= { teams: new Set(), leagues: new Set() }); g.teams.forEach(t => m[k].teams.add(t)); m[k].leagues.add(g.l); });
  return m;
}
const todayKey = () => keyOf(new Date(), state.tz);
const horizonEnd = () => Date.now() + state.horizon * 864e5;
function lastGames(k, n = 5) { return GAMES.filter(g => g.teams.includes(k) && played(g)).slice(-n); }
function outcome(g, k) {
  const home = g.H.key === k, mine = home ? g.hs : g.as, their = home ? g.as : g.hs;
  return mine > their ? 'V' : mine < their ? 'I' : 'E';
}
function formChips(k) { return lastGames(k).map(g => { const o = outcome(g, k); return `<i class="${o}" title="${OUT[o]}">${OUTL[o]}</i>`; }).join(''); }

/* ================= render: header & static ================= */
function renderStatus() {
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
}
function renderStatic() {
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
  $('teams').innerHTML = Object.keys(TEAMS).map(k => {
    const T = TEAMS[k], st = teamStats(k);
    return `<button class="tbtn${state.fav === k ? ' fav' : ''}" type="button" data-team="${k}">${emb(flSide(k))}<span><b>${esc(T.s)}${state.fav === k ? ' ★' : ''}</b><small>${T.l} · ${st.rec}</small></span></button>`;
  }).join('');
  $('tables').innerHTML = Object.keys(DIVISIONS).map(tableHtml).join('');
}
function tableHtml(k) {
  const D = DIVISIONS[k], rows = divisionRows(k);
  const cols = D.l === 'NHL' ? ['V', 'Î', 'Îp', 'Pct'] : D.l === 'MLS' ? ['V–Î–E', 'Pct'] : ['V', 'Î'];
  const cells = e => D.l === 'NHL' ? [e.w, e.l, e.otl ?? 0, ptsOf(e, 'NHL')] : D.l === 'MLS' ? [recordOf(e, 'MLS'), ptsOf(e, 'MLS')] : [e.w, e.l];
  const flKey = name => Object.keys(TEAMS).find(t => TEAMS[t].l === D.l && norm(TEAMS[t].espn) === norm(name));
  if (!rows.length) return `<div class="tbl"><h3><span class="ldot" style="--c:${col(D.l)}"></span>${D.t}</h3><div class="fn">Clasament indisponibil momentan.</div></div>`;
  return `<div class="tbl"><h3><span class="ldot" style="--c:${col(D.l)}"></span>${D.t}</h3><table><thead><tr><th></th><th>Echipă</th>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>` +
    rows.map((e, i) => { const fk = flKey(e.name); return `<tr class="${fk ? 'fl' : ''}"><td>${i + 1}</td><td>${emb({ ...e, key: fk }, 'sm')}${fk ? `<button class="tname" type="button" data-team="${fk}">${esc(e.name)}</button>` : esc(e.name)}</td>${cells(e).map(c => `<td>${c ?? '–'}</td>`).join('')}</tr>`; }).join('') +
    '</tbody></table></div>';
}

/* ================= render: hero & highlights ================= */
function renderHero() {
  const now = Date.now(), ups = GAMES.filter(g => !played(g) && !g.tbd && (isLive(g) || g.end > now));
  const mine = state.fav ? ups.filter(g => g.teams.includes(state.fav)) : [];
  const live = ups.filter(isLive);
  const g = mine[0] || live[0] || ups[0];
  if (!g) { $('hero').innerHTML = '<div><div class="k">Urmează</div><div class="m">Niciun meci programat în datele curente.</div></div>'; return; }
  const k = keyOf(g.d, state.tz), on = isLive(g);
  const soon = ups.filter(x => x !== g && x.d.getTime() - now < 864e5).slice(0, 6);
  const big = on ? `${g.hs ?? 0}–${g.as ?? 0}` : g.d.getTime() <= now ? 'Urmează să înceapă' : 'în ' + countdown(g.d.getTime() - now);
  $('hero').innerHTML = `<div data-gid="${esc(g.id)}">
      <div class="k">${mine[0] === g ? 'Echipa ta · ' + esc(TEAMS[state.fav].s) : on ? 'În desfășurare' : 'Următorul meci'} · ${g.l}</div>
      <div class="duo">${emb(g.H, '', true)}<span class="at">vs</span>${emb(g.A, '', true)}</div>
      <div class="cd">${big}</div>
      <div class="m">${esc(g.h)} – ${esc(g.a)}${on && g.detail ? ` <span class="tag live">LIVE · ${esc(detailRo(g.detail, g.l))}</span>` : ''}</div>
      <div class="w">${dayLabel(k)}, ${fmtTime[state.tz].format(g.d)} ${TZNAME[state.tz]} · ${g.v ? esc(g.v) + ', ' : ''}${esc(g.city)}${g.tv ? ' · ' + esc(g.tv) : ''}</div>
      <button class="go" type="button" data-game="${g.id}">Detalii meci</button>
    </div>
    <div class="soon"><div class="k">În următoarele 24 de ore</div>${soon.length ? soon.map(x => `<button class="srow" type="button" data-game="${x.id}"><b>${isLive(x) ? `${x.hs}–${x.as}` : fmtTime[state.tz].format(x.d)}</b><span>${esc(x.h)} – ${esc(x.a)} <span style="opacity:.7">· ${x.l}${isLive(x) ? ' · LIVE' : ''}</span></span></button>`).join('') : '<div class="w">Niciun alt meci în următoarele 24 de ore.</div>'}</div>`;
}

function renderHighlights(busy) {
  const now = Date.now(), today = todayKey(), lim = keyOf(new Date(horizonEnd()), state.tz);
  let html = '';
  GAMES.filter(g => g.derby && !played(g) && g.end > now && g.d.getTime() < horizonEnd() + 30 * 864e5).slice(0, 3).forEach(g => {
    const k = keyOf(g.d, state.tz);
    html += `<button class="hlc derby" type="button" data-game="${g.id}"><span class="k">Derby Florida · ${g.l}</span><span class="t">${esc(TEAMS[g.H.key].s)} – ${esc(TEAMS[g.A.key].s)}</span><span class="d">${dayLabel(k)}, ${fmtTime[state.tz].format(g.d)} · ${esc(g.v)}</span></button>`;
  });
  Object.keys(busy).filter(k => k >= today && k <= lim && busy[k].teams.size >= 4)
    .sort((a, b) => busy[b].teams.size - busy[a].teams.size || (a < b ? -1 : 1)).slice(0, 3).sort()
    .forEach(k => {
      html += `<button class="hlc" type="button" data-day="${k}" data-jump="1"><span class="k">Zi plină</span><span class="t">${dayLabel(k)}</span><span class="d">${busy[k].teams.size} echipe din Florida · ${[...busy[k].leagues].join(', ')}</span></button>`;
    });
  $('hl').innerHTML = html || '<div class="empty">Nimic special în următoarele zile.</div>';
}

/* ================= render: calendar ================= */
function monthsHtml(list, busy) {
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
      const full = busy[k] && busy[k].teams.size >= 4; if (full && gs.length) cls.push('busy');
      const dots = [...new Set(gs.map(g => g.l))].map(l => `<i style="--c:${col(l)}"></i>`).join('');
      html += gs.length
        ? `<button type="button" class="${cls.join(' ')}" data-day="${k}" aria-pressed="${k === state.day}" aria-label="${dayLabel(k)}: ${gs.length} ${gs.length === 1 ? 'meci' : 'meciuri'}${full ? ', zi plină' : ''}"><span class="n">${d}</span><span class="dots">${dots}</span></button>`
        : `<div class="${cls.join(' ')}"><span class="n">${d}</span></div>`;
    }
    html += '</div></section>';
  }
  return html + '</div>';
}
function weekHtml(list, busy) {
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
      const lab = g.teams.map(t => TEAMS[t].s).join(' · ');
      pills += `<button class="pill${played(g) ? ' done' : ''}" type="button" data-game="${g.id}" style="--c:${col(g.l)};left:${st / 1440 * 100}%;width:${du / 1440 * 100}%;top:${5 + ln * 23}px" title="${fmtTime[state.tz].format(g.d)} ${esc(g.h)} – ${esc(g.a)}" aria-label="${fmtTime[state.tz].format(g.d)}, ${esc(g.h)} – ${esc(g.a)}">${esc(lab)}</button>`;
    });
    const full = busy[k] && busy[k].teams.size >= 4;
    html += `<div class="wkrow"><button class="wkday${k === today ? ' today' : ''}${full ? ' busy' : ''}" type="button" data-day="${k}" aria-label="${dayLabel(k)}">${DOW[i]} ${parts(k)[2]}</button><div class="track" style="height:${Math.max(30, 10 + lanes.length * 23)}px">${pills}</div></div>`;
  }
  return html + `<div class="fn">Fiecare bandă e un meci, așezat după ora de start (${TZNAME[state.tz]}). Apasă pe un meci pentru detalii sau pe zi pentru lista ei.</div></div>`;
}

/* ================= render: agenda ================= */
function tn(g, side) {
  const k = side.key;
  return `${emb(side, 'sm')}${k && TEAMS[k] ? `<button class="tname" type="button" data-team="${k}">${esc(side.name)}</button>` : esc(side.name)}`;
}
function card(g) {
  const other = state.tz === 'ro' ? 'fl' : 'ro', done = played(g), on = isLive(g);
  const where = g.derby ? '<span class="tag derby">Derby Florida</span>' : g.inFL ? '<span class="tag home">Acasă</span>' : '<span class="tag away">Deplasare</span>';
  const time = g.tbd ? '<span style="font-size:15px">oră neanunțată</span>' : fmtTime[state.tz].format(g.d);
  const alt = g.tbd ? '' : `<small>${fmtTime[other].format(g.d)} ${TZNAME[other]}<br>${fmtShort[other].format(g.d)}</small>`;
  let extra = '';
  if (on) extra = `<span class="tag live">LIVE${g.detail ? ' · ' + esc(detailRo(g.detail, g.l)) : ''}</span>`;
  else if (done) { const o = outcome(g, g.teams[0]); extra = `<span class="tag r-${o}">${OUT[o]}</span>`; }
  else if (!g.tbd) extra = `<span class="tag aw-${g.aw}">${AW[g.aw]}</span>`;
  const mid = done || on ? `<span class="sc">${g.hs ?? 0}–${g.as ?? 0}</span>` : '<span class="vs">vs</span>';
  return `<article class="game${g.derby ? ' derby' : ''}${on ? ' live' : ''}" style="--c:${col(g.l)}" data-gid="${esc(g.id)}">
    <div class="time">${time}${alt}</div>
    <div><div class="tags"><span class="tag lg">${g.l}</span>${where}${extra}${g.note ? `<span class="tag note">${esc(noteRo(g.note))}</span>` : ''}</div>
    <div class="match">${tn(g, g.H)}${mid}${tn(g, g.A)}</div>
    <div class="vrow"><span class="venue">${venueLine(g)}${g.tv ? ` · <span class="tv">${esc(g.tv)}</span>` : ''}</span><button class="more" type="button" data-game="${g.id}">Detalii ›</button></div></div></article>`;
}
// "Stadium · City": links to the stadium and city pages for the Florida venues.
function venueLine(g) {
  const v = venueByName(g.v), c = v && cityOf(v);
  if (!v) return `${g.v ? esc(g.v) + ' · ' : ''}${esc(g.city)}`;
  return `<button class="linkish" type="button" data-venue="${v.id}">${esc(g.v)}</button> · ${c ? `<button class="linkish" type="button" data-city="${c.id}">${esc(c.name)}</button>, ${c.lite ? esc(c.state) : 'FL'}` : esc(g.city)}`;
}
function grouped(list, busy, showFull) {
  let html = '', cur = '';
  list.forEach(g => {
    const k = keyOf(g.d, state.tz);
    if (k !== cur) {
      if (cur) html += '</div>';
      const b = busy[k], full = showFull && b && b.teams.size >= 4;
      html += `<h3 class="dayhead"><span>${dayLabel(k)}</span>${full ? `<span class="full">Zi plină · ${b.teams.size} echipe</span>` : ''}</h3><div class="list">`; cur = k;
    }
    html += card(g);
  });
  return html + (cur ? '</div>' : '');
}
const nextDays = n => `următoarele ${n}${n >= 20 ? ' de' : ''} zile`;   // „14 zile”, „21 de zile”
function renderAgenda(list, busy) {
  // The list shows whole calendar days: today and the next ones, 7 at first, then 7 more per click.
  const now = Date.now(), lastDay = addDays(todayKey(), state.agendaDays - 1);
  const inDay = g => keyOf(g.d, state.tz) === state.day;
  const inRange = g => keyOf(g.d, state.tz) <= lastDay;
  const up = state.day ? list.filter(g => !played(g) && inDay(g)) : list.filter(g => !played(g) && inRange(g) && (isLive(g) || g.end > now - 6 * 36e5));
  const recent = new Set(Object.keys(TEAMS).flatMap(k => lastGames(k).map(g => g.id)));
  const past = (state.day ? list.filter(g => played(g) && inDay(g)) : list.filter(g => played(g) && recent.has(g.id))).reverse();
  const inFL = up.filter(g => g.inFL).length, good = up.filter(g => g.aw === 'good' && !g.tbd).length;
  $('count').innerHTML = `${up.length} ${up.length === 1 ? 'meci programat' : 'meciuri programate'} <span>· ${inFL} în Florida · ${good} la ore bune în România${state.day ? ' · ' + dayLabel(state.day) : ` · ${nextDays(state.agendaDays)}`}</span>`;
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
const FL_OUTLINE = [[31.0, -87.6], [31.0, -85.0], [30.7, -84.9], [30.7, -82.2], [30.36, -82.05], [30.7, -81.45], [30.3, -81.4], [29.9, -81.3], [29.0, -80.9], [28.4, -80.55], [27.8, -80.4], [27.0, -80.05], [26.3, -80.07], [25.6, -80.25], [25.2, -80.4], [25.12, -81.1], [25.85, -81.7], [26.5, -82.1], [27.0, -82.4], [27.6, -82.75], [28.2, -82.8], [28.9, -82.7], [29.5, -83.4], [30.05, -84.0], [29.9, -84.4], [29.65, -85.1], [29.7, -85.4], [30.2, -85.9], [30.4, -86.6], [30.3, -87.5]];
function renderMap() {
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
    ${gs.length > 7 ? `<div class="fn">și încă ${gs.length - 7}; vezi lista completă cu filtrul „Jucate în Florida”.</div>` : ''}`;
}

function render() {
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

/* ================= overlays ================= */
// Each overlay has its own address: #meci/NBA/401909963[/tab] or #echipa/heat. Opening one adds a
// history entry, so the phone's Back button closes it; the × closes the whole chain at once.
let lastFocus = null, openGameId = null;
const gameView = { tab: 'rezumat', side: '' };
function show(html, keep) {
  const ov = $('ov'), wasHidden = ov.hidden;
  if (wasHidden) lastFocus = document.activeElement;
  const top = ov.scrollTop;
  $('prof').innerHTML = html;
  ov.hidden = false;
  document.body.classList.add('noscroll');
  $('page').inert = true;
  if (keep) { ov.scrollTop = top; return; }
  ov.scrollTop = 0;
  const x = $('prof-x'); if (x) x.focus({ preventScroll: true });
}
function hideOv() {
  if ($('ov').hidden) return;
  $('ov').hidden = true; openGameId = null; openPlaceId = null;
  document.body.classList.remove('noscroll');
  $('page').inert = false;
  if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
}
function closeOv() {
  const depth = history.state && history.state.ov;
  if (depth) history.go(-depth);            // popstate then hides it
  else { history.replaceState(null, '', location.pathname + location.search); hideOv(); }
}
function go(hash) {
  if (location.hash === hash) { route(); return; }
  const depth = (history.state && history.state.ov) || 0;
  history.pushState({ ov: depth + 1 }, '', location.pathname + location.search + hash);
  route();
}
function route(keep) {
  const h = decodeURIComponent(location.hash.slice(1)).split('/');
  if (h[0] === 'meci' && gameById(h[2])) { const t = h[3] || 'rezumat'; if (openGameId !== h[2]) gameView.side = ''; gameView.tab = t; openGame(h[2], keep); return; }
  if (h[0] === 'echipa' && TEAMS[h[1]]) { teamView.tab = ['sezon', 'lot', 'stiri'].includes(h[2]) ? h[2] : 'rezumat'; openTeam(h[1], keep); return; }
  if (h[0] === 'notificari') {
    const pre = (h[1] || '').split(',').filter(k => TEAMS[k]);
    if (pre.length && !keep && N.status !== 'on') N.teams = pre;
    openNotify(keep); return;
  }
  if (h[0] === 'calendar') {
    // #calendar/heat,panthers preselects teams (from a team page); plain #calendar uses the saved choice.
    const pre = (h[1] || '').split(',').filter(k => TEAMS[k]);
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
    LG.tab = ['scoruri', 'clasamente', 'echipe'].includes(h[1]) ? h[1] : 'scoruri';
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

function openTeam(k, keep) {
  const T = TEAMS[k]; if (!T) return;
  openGameId = null; openPlaceId = null;
  teamView.k = k;
  loadTeamX(k);
  const st = teamStats(k), now = Date.now(), side = flSide(k);
  const mine = GAMES.filter(g => g.teams.includes(k));
  const last = lastGames(k).reverse(), next = mine.filter(g => !played(g) && (isLive(g) || g.end > now)).slice(0, 5);
  const opp = g => (g.H.key === k ? 'vs ' : 'la ') + esc(g.H.key === k ? g.a : g.h);
  const isMLS = T.l === 'MLS', fav = state.fav === k;
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
    <dl class="facts">
      <dt>Rivali</dt><dd>${esc(T.rivals)}</dd>
      <dt>Arenă</dt><dd>${(() => { const v = venueOfTeam(k), c = v && cityOf(v); return v ? `<button class="linkish" type="button" data-venue="${v.id}">${esc(v.name)}</button>${c ? `, <button class="linkish" type="button" data-city="${c.id}">${esc(c.name)}</button>` : ''}` : esc(T.arena); })()}</dd>
      <dt>Capacitate</dt><dd>${esc(T.cap)}</dd>
      <dt>În ligă din</dt><dd>${T.since}</dd>
      <dt>Palmares</dt><dd>${esc(T.titles)}</dd>
      <dt>De știut</dt><dd>${esc(T.fact)}</dd>
    </dl>
    <div><h3>Următoarele meciuri</h3><div class="rows">${next.length ? next.map(g => `<button class="row" type="button" data-game="${g.id}"><span class="when">${tShort(g.d)}</span><span>${opp(g)}${g.note ? ` <span style="color:var(--muted);font-size:12.5px">· ${esc(noteRo(g.note))}</span>` : ''}</span><span class="r">${isLive(g) ? 'LIVE' : g.tbd ? 'oră neanunțată' : fmtTime[state.tz].format(g.d)}</span></button>`).join('') : '<div class="row"><span></span><span>Niciun meci programat.</span><span></span></div>'}</div></div>
    <div><h3>Ultimele rezultate</h3><div class="rows">${last.map(g => { const o = outcome(g, k); const a = g.H.key === k ? g.hs : g.as, b = g.H.key === k ? g.as : g.hs; return `<button class="row" type="button" data-game="${g.id}"><span class="when">${tShort(g.d)}</span><span>${opp(g)}</span><span class="r ${o}">${OUTL[o]} ${a}–${b}</span></button>`; }).join('') || '<div class="row"><span></span><span>Niciun meci jucat încă.</span><span></span></div>'}</div></div>
    ${tableHtml(DIVISION_OF[k])}` : ''}
    <div class="btns"><button class="primary" type="button" data-only="${k}">Arată doar meciurile echipei</button>
      <button class="ghost" type="button" data-team-cal="${k}">Calendarul echipei</button>
      <button class="ghost" type="button" data-team-ntf="${k}">Notificări</button>
      <button class="ghost" type="button" data-fav="${k}">${fav ? '★ Echipa mea (apasă ca să renunți)' : '☆ Setează ca echipa mea'}</button>
      <button class="ghost" type="button" data-share>Copiază linkul</button></div>
    </div>`, keep);
}

/* ----- team page tabs: season, roster, news (from /api/team, loaded on first use) ----- */
const teamView = { k: '', tab: 'rezumat' };
const TEAMX = new Map();
function teamPanel(k) {
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
async function loadTeamX(k) {
  const info = TEAMINFO[k];
  if (!info?.id || TEAMX.has(k) || DATA.mode === 'snapshot') return;
  try {
    const x = await getJSON(`/api/team?l=${TEAMS[k].l}&id=${info.id}`, 12000);
    TEAMX.set(k, x);
  } catch (e) { TEAMX.set(k, { roster: [], leaders: [], news: [] }); }
  if (teamView.k === k && $('tpanel') && teamView.tab !== 'rezumat' && location.hash.startsWith('#echipa/' + k)) openTeam(k, true);
}
function setTeamTab(t) {
  const k = teamView.k; if (!TEAMS[k]) return;
  teamView.tab = t;
  history.replaceState(history.state, '', location.pathname + location.search + `#echipa/${k}${t !== 'rezumat' ? '/' + t : ''}`);
  openTeam(k, true);
  const b = document.querySelector(`[data-ttab="${t}"]`); if (b) b.focus({ preventScroll: true });
}

/* ================= playoff bracket ================= */
// Shown for each league where a Florida team has playoff games around now (60 days back, 45 ahead).
const PLAYOFFS = new Map();
let poLeague = '';
const playoffLike = n => /playoff|round|runda|wild card|final|play-in|semifinal|championship|super bowl/i.test(n || '') && !/nba cup|cupa nba/i.test(n || '');
function playoffLeagues() {
  const now = Date.now();
  return [...new Set(GAMES.filter(g => playoffLike(g.note) && Math.abs(g.d.getTime() - now) < 60 * 864e5).map(g => g.l))];
}
async function renderPlayoffs() {
  const sec = $('playoffs'), ls = playoffLeagues();
  if (!ls.length || DATA.mode === 'snapshot') { sec.hidden = true; return; }
  if (!ls.includes(poLeague)) poLeague = ls[0];
  const l = poLeague;
  if (!PLAYOFFS.has(l)) {
    PLAYOFFS.set(l, null);
    getJSON(`/api/playoffs?l=${l}`, 15000).then(j => { PLAYOFFS.set(l, j); renderPlayoffs(); }, () => PLAYOFFS.delete(l));
  }
  const data = PLAYOFFS.get(l);
  const head = `<div class="tnhead"><h2 class="sec">Playoff ${l}</h2>${ls.length > 1 ? `<div class="seg" role="group" aria-label="Liga">${ls.map(x => `<button type="button" data-pl="${x}" aria-pressed="${x === l}">${x}</button>`).join('')}</div>` : ''}</div>`;
  if (!data) { sec.hidden = false; sec.innerHTML = head + '<div class="skeleton" style="height:140px"></div>'; return; }
  const layout = bracketLayout(buildSeries(data.games || []));
  if (!layout.length) { sec.hidden = true; return; }
  const flName = n => Object.keys(TEAMS).find(k => TEAMS[k].l === l && norm(TEAMS[k].espn) === norm(n));
  const card = s => {
    const fl = s.teams.map(t => flName(t.name)).find(Boolean);
    const target = fl && (s.next ? BY_ID.get(s.next.id) : BY_ID.get(s.games[s.games.length - 1].id));
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
    + '<div class="fn">Numărul mic din fața echipei e locul din sezonul regulat. Echipele din Florida sunt evidențiate; apasă pe seria lor pentru pagina meciului.</div>';
}

/* ================= views: Florida | Ligile ================= */
const LG = { view: 'florida', tab: 'scoruri', day: null, chosen: new Set(Object.keys(LEAGUES)), scores: new Map() };
const usKey = d => fmtKey.fl.format(d);   // the US (Eastern) date: ESPN's scoreboards are by US day
const lgCtx = () => ({
  emb, flKey, col, dayLabel, zoneName: TZNAME[state.tz], today: usKey(new Date()),
  status: g => g.state === 'in' ? `<b class="lv">LIVE</b><small>${esc(detailRo(g.detail, g.l))}</small>`
    : g.state === 'post' ? `<small>${esc(detailRo(g.detail, g.l) || 'Final')}</small>`
      : g.tbd ? '<small>oră neanunțată</small>' : `<b>${fmtTime[state.tz].format(g.d)}</b>${keyOf(g.d, state.tz) !== LG.day ? `<small>${esc(tShort(g.d))}</small>` : ''}`
});
function setView(v) {
  LG.view = v;
  $('flview').hidden = v !== 'florida'; $('lgview').hidden = v !== 'ligi';
  document.querySelectorAll('.viewtabs [data-goview]').forEach(a => a.setAttribute('aria-current', a.dataset.goview === v ? 'page' : 'false'));
  if (v === 'ligi') renderLeagues();
}
function navView(hash) {
  history.pushState({ view: 1 }, '', location.pathname + location.search + hash);
  route();
  window.scrollTo({ top: 0 });
}
/* ---------- jump bar: the homepage sections, one tap away (the bar stays at the top) ---------- */
(function setupJump() {
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
})();

async function loadScores(day) {
  const j = await getJSON('/api/scores?d=' + day.replace(/-/g, ''), 12000).catch(() => null);
  if (!j) { LG.scores.set(day, { _err: true }); return; }
  const data = { _t: Date.now() };
  for (const [l, list] of Object.entries(j.leagues || {})) data[l] = keepExtra(list);
  LG.scores.set(day, data);
}
function renderLeagues() {
  if (LG.view !== 'ligi') return;
  const el = $('lgview'), ctx = lgCtx();
  const head = lgHeadHtml(LG.tab, Object.keys(LEAGUES), LG.chosen);
  if (LG.tab === 'scoruri') {
    LG.day ||= ctx.today;
    const day = LG.day, data = LG.scores.get(day);
    el.innerHTML = head + (data?._err ? '<div class="empty">Scorurile nu au putut fi încărcate. Încearcă din nou mai târziu.</div>' : scoresHtml(day, data, LG.chosen, ctx));
    if (!data) loadScores(day).then(() => { if (LG.day === day) renderLeagues(); });
  } else if (LG.tab === 'clasamente') el.innerHTML = head + standingsHtml(DATA.raw?.standings, LG.chosen, ctx);
  else el.innerHTML = head + teamsHtml(DATA.raw?.standings, LG.chosen, ctx);
}
function setLgHash() { history.replaceState(history.state, '', location.pathname + location.search + `#ligi/${LG.tab}${LG.tab === 'scoruri' && LG.day && LG.day !== usKey(new Date()) ? '/' + LG.day : ''}`); }
// "Azi în ligi" on the Florida page.
async function renderTodayStrip() {
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
  loadScores(day).then(() => { if (LG.view === 'ligi' && LG.tab === 'scoruri' && LG.day === day) renderLeagues(); if (LG.view === 'florida') renderTodayStrip(); const og = openGameId && gameById(openGameId); if (og && !og.teams.length) refreshGame(og); });
}, 30e3);

/* ================= the page of a team outside Florida (#club/NBA/2) ================= */
const CLUB = new Map();
const clubView = { key: '', tab: 'rezumat' };
function entryById(l, id) {
  for (const g of DATA.raw?.standings?.[l] || []) { const e = g.entries.find(x => String(x.id) === String(id)); if (e) return { ...e, conf: confShort(g.name, l) }; }
  return null;
}
async function loadClub(l, id) {
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
function openClub(l, id, keep) {
  const e = entryById(l, id), k = e && flKey(l, e.name);
  if (k) { history.replaceState(history.state, '', location.pathname + location.search + '#echipa/' + k); openTeam(k, keep); return; }
  const key = l + '|' + id;
  if (clubView.key !== key) clubView.tab = 'rezumat';
  clubView.key = key; openGameId = null; openPlaceId = null; teamView.k = '';
  loadClub(l, id);
  if (!AMERICA.data) loadAmerica()?.then(d => { if (d && clubView.key === key && location.hash.startsWith(`#club/${l}/${id}`)) openClub(l, id, true); });
  const home = venueOfClub(l, id), homeCity = home && cityOf(home);
  const c = CLUB.get(key), now = Date.now();
  const name = e?.name || c?.games?.[0] && [c.games[0].H, c.games[0].A].find(s => s.id === String(id))?.name || 'Echipă';
  const side = { name, abbr: e?.abbr, logo: e?.logo, logoDark: e?.logoDark, color: e?.color, alt: e?.alt };
  const bg = e?.color || '#38474b', fg = pickInk(bg, e?.alt || '#ffffff');
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
      ${home ? `<dl class="facts"><dt>${home.kind === 'arena' ? 'Arenă' : 'Stadion'}</dt><dd><button class="linkish" type="button" data-venue="${esc(home.id)}">${esc(home.name)}</button>${homeCity ? `, <button class="linkish" type="button" data-city="${esc(homeCity.id)}">${esc(homeCity.name)}</button> (${esc(homeCity.state)})` : ''}</dd>${homeCity ? `<dt>Ora acum</dt><dd>${clockIn(homeCity.tz)}, cu ${hoursBehindRomania(new Date(), homeCity.tz)} ore în urma României</dd>` : ''}</dl>` : ''}
      ${vsFL.length ? `<section><h3>Cu echipele din Florida</h3><div class="rows">${vsFL.map(g => `<button class="row" type="button" data-game="${g.id}"><span class="when">${tShort(g.d)}</span><span>${esc(g.h)} – ${esc(g.a)}</span><span class="r">${g.tbd ? 'oră neanunțată' : fmtTime[state.tz].format(g.d)}</span></button>`).join('')}</div></section>` : ''}
      ${c ? `<section><h3>Următoarele meciuri</h3><div class="rows">${next.map(g => `<button class="row" type="button" data-game="${g.id}"><span class="when">${tShort(g.d)}</span><span>${opp(g)}</span><span class="r">${g.state === 'in' ? 'LIVE' : g.tbd ? 'oră neanunțată' : fmtTime[state.tz].format(g.d)}</span></button>`).join('') || '<div class="row"><span></span><span>Niciun meci programat.</span><span></span></div>'}</div></section>
      <section><h3>Ultimele rezultate</h3><div class="rows">${last.map(g => `<button class="row" type="button" data-game="${g.id}"><span class="when">${tShort(g.d)}</span><span>${opp(g)}</span>${res(g)}</button>`).join('') || '<div class="row"><span></span><span>Niciun meci jucat încă.</span><span></span></div>'}</div></section>` : '<div class="skeleton" style="height:160px"></div>'}
      <div class="fn">Echipă din afara Floridei: pagina are datele de la ESPN, fără textele în română de la echipele din Florida.</div>`;
  } else if (!c) body = '<div class="skeleton" style="height:180px"></div>';
  else if (clubView.tab === 'sezon') {
    const rows = mine.filter(g => g.state === 'post' && g.hs != null).map(g => { const home = g.H.id === String(id); return { id: g.id, d: g.d, opp: home ? g.a : g.h, home, mine: home ? g.hs : g.as, their: home ? g.as : g.hs }; });
    body = `<section><h3>Sezonul, meci cu meci</h3>${seasonChartHtml(rows, l)}</section>${leadersHtml(c.x)}`;
  } else body = clubView.tab === 'lot' ? `<section>${rosterHtml(c.x, l)}</section>` : `<section>${newsHtml(c.x)}</section>`;
  show(`<div class="band" style="background:${bg};color:${fg}"><div class="id">${emb(side, 'xl', true)}<div><div class="lgn">${l}${e?.conf ? ' · ' + esc(e.conf) : ''}</div><h2 id="prof-name">${esc(name)}</h2></div></div>
      <button class="x" type="button" id="prof-x" aria-label="Închide">×</button></div>
    <div class="ttabs">${teamTabsHtml(clubView.tab)}</div>
    <div class="pbody">${body}<div class="btns"><button class="ghost" type="button" data-share>Copiază linkul</button></div></div>`, keep);
}

/* ================= search ================= */
// Everything findable: Florida teams, every opponent in the schedule, cities, stadiums.
function searchIndex() {
  const out = [];
  for (const k in TEAMS) out.push({ kind: 'Echipă', text: `${TEAMS[k].espn} ${TEAMS[k].s} ${TEAMS[k].city} ${TEAMS[k].l}`, label: TEAMS[k].espn, sub: `${TEAMS[k].l} · ${TEAMS[k].city}`, hash: '#echipa/' + k, side: flSide(k), rank: 0 });
  const now = Date.now(), opp = new Map();
  for (const g of GAMES) for (const s of [g.H, g.A]) {
    if (s.key) continue;
    const o = opp.get(s.name) || { side: s, l: g.l, next: null, last: null };
    if (!played(g) && g.end > now) { if (!o.next) o.next = g; } else if (played(g)) o.last = g;
    opp.set(s.name, o);
  }
  for (const [name, o] of opp) {
    const g = o.next || o.last; if (!g) continue;
    out.push({ kind: 'Meci', text: `${name} ${o.side.abbr} ${o.l}`, label: name, sub: o.next ? `următorul meci: ${tShort(g.d)}, ${g.teams.map(t => TEAMS[t].s).join(', ')}` : `ultimul meci: ${tShort(g.d)}, ${g.hs}–${g.as}`, hash: `#meci/${g.l}/${g.id}`, side: o.side, rank: 1 });
  }
  // Every other team of the five leagues, from the standings: its own page.
  for (const [l, groups] of Object.entries(DATA.raw?.standings || {})) for (const g of groups) for (const e of g.entries) {
    if (flKey(l, e.name) || !e.id) continue;
    out.push({ kind: 'Echipă', text: `${e.name} ${e.abbr} ${l}`, label: e.name, sub: `${l} · ${recordOf(e, l) || ''}`, hash: `#club/${l}/${e.id}`, side: e, rank: 1 });
  }
  const P = PLACES.data;
  if (P) {
    for (const c of Object.values(P.cities)) out.push({ kind: 'Oraș', text: `${c.name} ${c.county} florida`, label: c.name, sub: `comitatul ${c.county}`, hash: '#oras/' + c.id, img: c.image?.small, rank: 2 });
    for (const v of Object.values(P.venues)) out.push({ kind: 'Stadion', text: `${v.name} ${(v.espn || []).join(' ')} ${(v.names || []).map(n => n[0]).join(' ')} ${P.cities[v.city]?.name || ''}`, label: v.name, sub: `${v.teams.map(k => TEAMS[k].s).join(', ')} · ${P.cities[v.city]?.name || ''}`, hash: '#stadion/' + v.id, img: v.image?.small, rank: 3 });
  }
  return out;
}
let qSel = -1, qHits = [];
function runSearch() {
  const raw = $('q').value, q = norm(raw);
  const box = $('qres');
  if (q.length < 2) { box.hidden = true; $('q').setAttribute('aria-expanded', 'false'); qHits = []; return; }
  const words = q.split(/\s+/).filter(Boolean);
  qHits = searchIndex().map(x => {
    const t = norm(x.text), lab = norm(x.label);
    if (!words.every(w => t.includes(w))) return null;
    return { ...x, score: (lab.startsWith(q) ? 0 : lab.split(' ').some(p => p.startsWith(words[0])) ? 1 : 2) * 10 + x.rank };
  }).filter(Boolean).sort((a, b) => a.score - b.score || a.label.localeCompare(b.label)).slice(0, 8);
  qSel = qHits.length ? 0 : -1;
  box.innerHTML = qHits.length ? qHits.map((x, i) => `<button type="button" role="option" id="qo${i}" class="qopt${i === qSel ? ' sel' : ''}" aria-selected="${i === qSel}" data-qi="${i}">${x.side ? emb(x.side, 'sm') : x.img ? `<img src="${esc(x.img)}" alt="" loading="lazy">` : ''}<span><b>${esc(x.label)}</b><small>${esc(x.kind)} · ${esc(x.sub)}</small></span></button>`).join('')
    : `<div class="qnone">Nimic găsit pentru „${esc(raw)}”.</div>`;
  box.hidden = false;
  $('q').setAttribute('aria-expanded', 'true');
  $('q').setAttribute('aria-activedescendant', qSel >= 0 ? 'qo' + qSel : '');
}
function pickSearch(i) {
  const x = qHits[i]; if (!x) return;
  $('q').value = ''; $('qres').hidden = true; $('q').setAttribute('aria-expanded', 'false');
  if (x.hash.startsWith('#meci/')) { gameView.tab = 'rezumat'; gameView.side = ''; }
  go(x.hash);
}
$('q').addEventListener('input', runSearch);
$('q').addEventListener('focus', runSearch);
$('q').addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!qHits.length) return;
    e.preventDefault();
    qSel = (qSel + (e.key === 'ArrowDown' ? 1 : -1) + qHits.length) % qHits.length;
    document.querySelectorAll('.qopt').forEach((b, i) => { b.classList.toggle('sel', i === qSel); b.setAttribute('aria-selected', i === qSel); });
    $('q').setAttribute('aria-activedescendant', 'qo' + qSel);
  } else if (e.key === 'Enter') { e.preventDefault(); pickSearch(Math.max(0, qSel)); }
  else if (e.key === 'Escape') { $('q').value = ''; runSearch(); }
});
document.addEventListener('click', e => { if (!e.target.closest('.search')) { $('qres').hidden = true; $('q').setAttribute('aria-expanded', 'false'); } });

/* ================= city and stadium pages ================= */
const placeCtx = {
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
let clockTimer = null;
function startClock() {
  clearInterval(clockTimer);
  clockTimer = setInterval(() => { const el = $('flclock'); if (el) el.textContent = el.dataset.tz ? clockIn(el.dataset.tz) : floridaClock(); else clearInterval(clockTimer); }, 20e3);
}
async function fillPlaceWeather(pt, venue, ownerId) {
  try {
    const [w] = await getWeather([pt], false);
    if (openPlaceId !== ownerId || !$('pwx')) return;
    let next = null;
    if (venue) { const g = placeCtx.gamesAt([venue.id]).up[0]; if (g) next = { id: g.id, label: `${g.h} – ${g.a}, ${tShort(g.d)}` }; }
    $('pwx').innerHTML = placeWeatherHtml(w, venue, next);
  } catch (e) { if ($('pwx')) $('pwx').innerHTML = `<div class="fn">${navigator.onLine ? 'Prognoza nu a putut fi încărcată. Încearcă din nou mai târziu.' : 'Ești offline: vremea apare când ai din nou internet. Clima pe luni de mai jos e salvată pe telefon.'}</div>`; }
}
let openPlaceId = null;
function openCity(id, keep) {
  const c = getCity(id);
  openGameId = null; openPlaceId = 'c:' + id;
  show(c.lite ? cityLiteHtml(c, placeCtx) : cityHtml(c, placeCtx), keep);
  startClock();
  fillPlaceWeather(c, null, openPlaceId);
}
function openVenue(id, keep) {
  const v = getVenue(id);
  openGameId = null; openPlaceId = 'v:' + id;
  show(v.lite ? venueLiteHtml(v, placeCtx) : venueHtml(v, placeCtx), keep);
  startClock();
  fillPlaceWeather(v, v, openPlaceId);
}

/* ================= phone: install, calendar subscription ================= */
const cal = { teams: [], alarm: 60 };
{
  try { const s = JSON.parse(store.get('flgames-cal') || 'null'); if (s) { cal.teams = (s.teams || []).filter(k => TEAMS[k]); cal.alarm = +s.alarm || 0; } } catch (e) { /* ignore */ }
  if (!cal.teams.length) cal.teams = state.fav ? [state.fav] : Object.keys(TEAMS);
}
const saveCal = () => store.set('flgames-cal', JSON.stringify(cal));
function openCalendar(keep) {
  openGameId = null; openPlaceId = null;
  show(calendarHtml(cal.teams, cal.alarm, k => emb(flSide(k), 'sm')), keep);
}
/* ----- notifications page ----- */
let notifyOpen = false, notifyChecked = false;
function openNotify(keep) {
  openGameId = null; openPlaceId = null; notifyOpen = true;
  show(notifyHtml(k => emb(flSide(k), 'sm')), keep);
  if (!notifyChecked) { notifyChecked = true; refreshNotify(state.fav ? [state.fav] : Object.keys(TEAMS)); }
}
setNotifyRender(() => { if (notifyOpen && location.hash.startsWith('#notificari') && !$('ov').hidden) show(notifyHtml(k => emb(flSide(k), 'sm')), true); });

function renderPhone() {
  // The header "Instalează" button appears only when the browser can install the app right away.
  $('hinstall').hidden = !canInstall();
  $('phone').innerHTML = `<div class="phcard"><h3>Aplicația pe telefon</h3>${installHtml()}</div>
    <div class="phcard"><h3>Meciurile în calendarul tău</h3><p>Abonează-te o dată și meciurile echipelor alese apar singure în Google Calendar, pe iPhone sau în Outlook, cu ora ta și cu amintire.</p><button class="primary" type="button" data-team-cal="">Abonare la calendar</button></div>
    <div class="phcard"><h3>Notificări</h3><p>Un anunț înainte de meciurile echipelor tale și rezultatul final, chiar cu aplicația închisă.</p><button class="primary" type="button" data-team-ntf="">Setează notificările</button></div>`;
}
onInstallChange(renderPhone);
renderPhone();
registerSW();
// Back online: fresh data at once instead of waiting for the next refresh.
window.addEventListener('online', () => load());
window.addEventListener('offline', () => renderStatus());

/* ----- weather strip on the home page ----- */
async function renderStrip() {
  if (!PLACES.data) return;
  // The nine stadiums, north to south, as a row that scrolls sideways on a phone.
  $('vstrip').innerHTML = Object.values(PLACES.data.venues).sort((a, b) => b.lat - a.lat).map(v => `<button type="button" class="vchip" data-venue="${v.id}">${v.image ? `<img src="${esc(v.image.small)}" alt="" loading="lazy" decoding="async">` : ''}<span><b>${esc(v.name)}</b><small>${v.teams.map(k => esc(TEAMS[k].s)).join(', ')} · ${esc(cityOf(v)?.name || '')}</small></span></button>`).join('');
  $('wxstrip').innerHTML = stripHtml(null);
  try {
    const list = await getWeather(STRIP.map(id => PLACES.data.cities[id]), true);
    $('wxstrip').innerHTML = stripHtml(list);
  } catch (e) { $('wxstrip').innerHTML = stripHtml(null).replace(/…/g, 'vremea nu e disponibilă'); }
}
loadPlaces()?.then(d => { if (!d) return; renderStrip(); if (GAMES.length) { render(); if (!$('ov').hidden) route(true); } });
setInterval(() => { if (!document.hidden && PLACES.data) renderStrip(); }, 30 * 60e3);

function sideInfo(g, side) {
  const k = side.key;
  if (k && TEAMS[k]) { const st = teamStats(k); return `<small>${st.rec}${st.conf != null ? ` · locul ${st.conf} ${esc(st.confN)}` : ''}</small><div class="form">${formChips(k)}</div>`; }
  const o = oppInfo(g.l, side.name); return o ? `<small>${esc(o)}</small>` : '<small>&nbsp;</small>';
}
function gameStatus(g) {
  const now = Date.now(), d = detailRo(g.detail, g.l);
  if (played(g)) return d && d !== 'Final' ? d : 'Final';
  if (isLive(g)) return 'LIVE · ' + d;
  if (/postponed|canceled|cancelled|suspended|delayed/i.test(g.detail || '')) return d;
  return g.tbd ? 'oră neanunțată' : g.d.getTime() > now ? 'începe în ' + countdown(g.d.getTime() - now) : 'urmează să înceapă';
}
const midScore = g => (played(g) || isLive(g) ? (g.hs ?? 0) + '–' + (g.as ?? 0) : g.tbd ? 'vs' : fmtTime[state.tz].format(g.d));
function openGame(id, keep) {
  const g = gameById(id); if (!g) return;
  keep = keep && openGameId === g.id;
  openGameId = g.id;
  const done = played(g), on = isLive(g), other = state.tz === 'ro' ? 'fl' : 'ro', k = keyOf(g.d, state.tz);
  const ctx = gameContext(g);
  const canFetch = DATA.mode !== 'snapshot';
  const s = SUMMARY.get(g.l + g.id);
  show(`<div class="band plain"><div><div class="lgn" style="color:${col(g.l)}">${g.l}${g.note ? ' · ' + esc(noteRo(g.note)) : ''}</div><h2 id="prof-name" style="font-size:22px">${dayLabel(k)}</h2></div>
      <button class="x" type="button" id="prof-x" aria-label="Închide">×</button></div>
    <div class="pbody">
    <div class="duel">
      <div class="side">${emb(g.H, 'lg')}<span>${esc(g.h)}</span>${sideInfo(g, g.H)}</div>
      <div class="mid${on ? ' on' : ''}" id="gscore" aria-live="polite">${midScore(g)}<small>${esc(gameStatus(g))}</small></div>
      <div class="side">${emb(g.A, 'lg')}<span>${esc(g.a)}</span>${sideInfo(g, g.A)}</div>
    </div>
    <div id="gtabs">${tabsHtml(g, s, gameView.tab)}</div>
    <div id="gdetail" role="tabpanel">${gameView.tab === 'rezumat' || !s ? summaryTop(g, ctx, k, other, done, on) : ''}${s ? panelHtml(g, s, viewFor()) : canFetch ? '<div class="skeleton" style="height:70px"></div>' : '<div class="fn">Detaliile meciului (statistici, jucători, faze) apar când sursa live răspunde.</div>'}</div>
    <div class="btns">${[g.H, g.A].map(s => s.key ? `<button class="ghost" type="button" data-team="${s.key}">Profil ${esc(TEAMS[s.key].s)}</button>` : s.id ? `<button class="ghost" type="button" data-club="${g.l}|${esc(s.id)}">${esc(s.name)}</button>` : '').join('')}${g.teams.length ? `<button class="ghost" type="button" data-day="${k}" data-jump="1">Toate meciurile zilei</button>` : ''}${done ? '' : `<button class="ghost" type="button" data-ics-game="${g.id}">Adaugă în calendar</button>`}<button class="ghost" type="button" data-share>Copiază linkul</button></div>
    </div>`, keep);
  openPlaceId = null;
  if (canFetch && (!s || isLive(g))) loadGame(g);
  // The stadium link and the weather card need data/places.json; draw again once it is here.
  if (PLACES.data) { if (canFetch) loadGameWeather(g); }
  else loadPlaces()?.then(d => { if (d && openGameId === g.id) { refreshGame(g); if (canFetch) loadGameWeather(g); } });
}
function gameContext(g) {
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
const viewFor = () => ({ ...gameView, known: id => !!gameById(id) });
function summaryTop(g, ctx, k, other, done, on) {
  return `<dl class="facts">
      ${g.tbd ? '' : `<dt>Start</dt><dd>${fmtTime[state.tz].format(g.d)} ${TZNAME[state.tz]} · ${fmtTime[other].format(g.d)} ${TZNAME[other]} (${fmtShort[other].format(g.d).replace('.', '')})</dd>`}
      <dt>Unde</dt><dd>${(() => { const v = venueByName(g.v), c = v && cityOf(v); return v ? `<button class="linkish" type="button" data-venue="${v.id}">${esc(g.v)}</button>, ${c ? `<button class="linkish" type="button" data-city="${c.id}">${esc(c.name)}</button>, ${c.lite ? esc(c.state) : 'FL'}` : esc(g.city)}` : `${g.v ? esc(g.v) + ', ' : ''}${esc(g.city)}`; })()}</dd>
      ${g.tv ? `<dt>Transmisie SUA</dt><dd>${esc(g.tv)}</dd>` : ''}
      ${done || on || g.tbd ? '' : `<dt>Pentru România</dt><dd>${{ good: 'Oră bună, se poate urmări seara.', late: 'Târziu, începe în jurul miezului nopții.', night: 'Noapte albă, începe după ora 01:00.' }[g.aw]}</dd>`}
    </dl>
    ${ctx.length ? `<section><h3>Context</h3><ul class="notes">${ctx.map(c => `<li>${esc(c)}</li>`).join('')}</ul></section>` : ''}
    ${!done && g.teams.length && venueByName(g.v) ? `<div id="gwx">${GWX.get(g.id) || ''}</div>` : ''}`;
}
// Weather for a game in a Florida venue (not for finished games). Kept per game, so redraws reuse it.
const GWX = new Map();
async function loadGameWeather(g) {
  // Florida's games only, at home or away (other games show just the stadium link).
  const v = venueByName(g.v);
  if (!v || played(g) || !g.teams.length) return;
  try {
    const [w] = await getWeather([v], false);
    const html = gameWeatherHtml(g, v, w, LEAGUES[g.l].dur);
    GWX.set(g.id, html);
    if (openGameId === g.id && $('gwx')) $('gwx').innerHTML = html;
  } catch (e) { /* the weather card is optional */ }
}
// Draws the tabs and the open tab again, keeping the scroll position (new data, tab switch, live score).
function refreshGame(g) {
  if (openGameId !== g.id || !$('gdetail')) return;
  const s = SUMMARY.get(g.l + g.id);
  $('gscore').innerHTML = `${midScore(g)}<small>${esc(gameStatus(g))}</small>`;
  $('gscore').classList.toggle('on', isLive(g));
  $('gtabs').innerHTML = tabsHtml(g, s, gameView.tab);
  const other = state.tz === 'ro' ? 'fl' : 'ro';
  const top = gameView.tab === 'rezumat' ? summaryTop(g, gameContext(g), keyOf(g.d, state.tz), other, played(g), isLive(g)) : '';
  $('gdetail').innerHTML = top + (s ? (panelHtml(g, s, viewFor()) || '') : '');
}
const SUMMARY = new Map();
async function loadGame(g) {
  const key = g.l + g.id;
  try {
    const s = await getJSON(`/api/game?l=${g.l}&id=${encodeURIComponent(g.id)}`, 10000);
    SUMMARY.set(key, s);
    refreshGame(g);
  } catch (e) {
    if (openGameId === g.id && $('gdetail') && !SUMMARY.has(key)) {
      $('gdetail').querySelector('.skeleton')?.replaceWith(Object.assign(document.createElement('div'), { className: 'fn', textContent: 'Nu am putut încărca detaliile meciului. Încearcă din nou mai târziu.' }));
    }
  }
}

/* ================= events ================= */
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
  const g = gameById(openGameId); if (!g) return;
  gameView.tab = t;
  history.replaceState(history.state, '', location.pathname + location.search + gameHash(g, t));
  refreshGame(g);
  const b = document.querySelector(`#gtabs [data-tab="${t}"]`); if (b) b.focus({ preventScroll: true });
}
async function share(btn) {
  const url = location.href;
  try {
    if (navigator.share && matchMedia('(pointer:coarse)').matches) { await navigator.share({ title: document.title, url }); return; }
    await navigator.clipboard.writeText(url);
    btn.textContent = 'Link copiat ✓';
  } catch (e) { if (e && e.name !== 'AbortError') btn.textContent = 'Nu am putut copia linkul'; }
  setTimeout(() => { if (btn.isConnected) btn.textContent = 'Copiază linkul'; }, 2500);
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
  if ((el = q('[data-calall]'))) { cal.teams = el.dataset.calall === '1' ? Object.keys(TEAMS) : []; saveCal(); openCalendar(true); return; }
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
  if ((el = q('[data-goview]'))) {
    e.preventDefault();
    if (el.dataset.lgonly) { LG.chosen = new Set([el.dataset.lgonly]); LG.tab = 'scoruri'; LG.day = null; }
    if (el.dataset.goview === 'ligi') navView('#ligi' + (LG.tab !== 'scoruri' ? '/' + LG.tab : ''));
    else navView('');
    return;
  }
  if ((el = q('[data-lgtab]'))) { LG.tab = el.dataset.lgtab; setLgHash(); renderLeagues(); return; }
  if ((el = q('[data-lgl]'))) { const l = el.dataset.lgl; LG.chosen.has(l) && LG.chosen.size > 1 ? LG.chosen.delete(l) : LG.chosen.add(l); renderLeagues(); return; }
  if ((el = q('[data-lgday]'))) { const n = +el.dataset.lgday; LG.day = n ? addDays(LG.day || usKey(new Date()), n) : usKey(new Date()); setLgHash(); renderLeagues(); return; }
  if ((el = q('[data-club]'))) { const [l, id] = el.dataset.club.split('|'); go(`#club/${l}/${id}`); return; }
  if ((el = q('[data-qi]'))) { pickSearch(+el.dataset.qi); return; }
  if ((el = q('[data-pl]'))) { poLeague = el.dataset.pl; renderPlayoffs(); return; }
  if ((el = q('[data-side]'))) { gameView.side = el.dataset.side; const g = gameById(openGameId); if (g) refreshGame(g); return; }
  if ((el = q('[data-fav]'))) { const k = el.dataset.fav; state.fav = state.fav === k ? '' : k; state.fav ? store.set('flgames-fav', state.fav) : store.del('flgames-fav'); renderStatic(); render(); openTeam(k, true); return; }
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
  if (t.dataset?.ntfteam || t.id === 'ntflead' || t.id === 'ntffinal') {
    if (t.dataset.ntfteam) { const k = t.dataset.ntfteam; N.teams = t.checked ? [...new Set([...N.teams, k])] : N.teams.filter(x => x !== k); }
    if (t.id === 'ntflead') N.lead = +t.value;
    if (t.id === 'ntffinal') N.final = t.checked;
    N.msg = N.status === 'on' ? 'Apasă „Salvează alegerile” ca să se aplice.' : '';
    show(notifyHtml(k => emb(flSide(k), 'sm')), true);
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
  else if (!$('ov').hidden) { const g = gameById(openGameId); if (g) refreshGame(g); }
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
  } finally { loading = false; }
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
      const og = openGameId && gameById(openGameId);
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
    if (openGameId === id && $('gscore')) { const el = $('gscore'); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  }
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && DATA.mode !== 'snapshot' && Date.now() - DATA.loadedAt > 15 * 60e3) load();
});
setInterval(() => { if (GAMES.length) { renderHero(); renderStatus(); } }, 30000);
setInterval(() => { if (!document.hidden) load(); }, 15 * 60e3);

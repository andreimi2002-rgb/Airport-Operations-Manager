// Shared data and state: the games and standings, the viewer's filters, dates and times, storage.
import { LEAGUES, TEAMS, DIVISIONS, DIVISION_OF, norm, HOME, PACK } from './teams.js';
import { $, esc, emb, theme } from './ui.js';

/* ================= data loading ================= */
export const CACHE_KEY = 'flcal-cache-v1' + (PACK === 'fl' ? '' : '-' + PACK);   // one saved season per pack
export const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage full or blocked */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
};
export async function getJSON(url, ms = 12000) {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(r.status + ' ' + url);
  return r.json();
}
export const DATA = { raw: null, mode: 'loading', loadedAt: 0 };

/* ================= model ================= */
export let GAMES = [], BY_ID = new Map(), ENTRY = new Map(), TEAMINFO = {};
export const OUT = { V: 'Victorie', I: 'Înfrângere', E: 'Egal' }, OUTL = { V: 'V', I: 'Î', E: 'E' };
export const AW = { good: 'Oră bună în RO', late: 'Târziu în RO', night: 'Noapte în RO' };
export const played = g => g.state === 'post';
export const isLive = g => g.state === 'in';

export const fmtRoH = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bucharest', hour: '2-digit', minute: '2-digit', hour12: false });
export function awake(d) {
  const [h, m] = fmtRoH.format(d).split(':').map(Number); const t = (h % 24) * 60 + m;
  return t >= 720 && t <= 1380 ? 'good' : (t > 1380 || t < 60) ? 'late' : 'night';
}
// Conference names: "Eastern Conference" -> Est; NFL -> AFC/NFC; baseball's leagues -> AL/NL.
export function confShort(n, l) {
  const x = norm(n);
  if (x.includes('east')) return 'Est';
  if (x.includes('west')) return 'Vest';
  if (x.includes('american')) return l === 'MLB' ? 'AL' : 'AFC';
  if (x.includes('national')) return l === 'MLB' ? 'NL' : 'NFC';
  return n;
}
// Florida team key by league and ESPN name (games from other lists come without keys).
export const FL_BY_NAME = Object.fromEntries(Object.entries(TEAMS).map(([k, t]) => [t.l + '|' + norm(t.espn), k]));
export const flKey = (l, name) => FL_BY_NAME[l + '|' + norm(name)] || null;
export function teamSide(t, l) {
  return { id: t.id ? String(t.id) : '', name: t.name, abbr: t.abbr || '', logo: t.logo, logoDark: t.logoDark, color: t.color, alt: t.alt, key: t.key || flKey(l, t.name) };
}
// One game from any ESPN list (schedule, day scores, a team's season) -> the page's game object.
export function toGame(x) {
  const d = new Date(x.date);
  if (isNaN(d) || !LEAGUES[x.l]) return null;
  const H = teamSide(x.home, x.l), A = teamSide(x.away, x.l);
  const g = {
    id: String(x.id), l: x.l, d, tbd: x.tbd, state: x.state, detail: x.detail,
    H, A, h: x.home.name, a: x.away.name, hs: x.home.score, as: x.away.score,
    v: x.venue, city: [x.city, x.region].filter(Boolean).join(', '), inFL: HOME.regions.includes(x.region), note: x.note || '', tv: x.tv || '', raw: x
  };
  g.teams = [H.key, A.key].filter(k => k && TEAMS[k]);
  g.derby = g.teams.length === 2;
  g.aw = awake(d);
  g.end = d.getTime() + LEAGUES[g.l].dur * 6e4;
  return g;
}
// Any team as a link: a Florida team opens its full profile, any other its club page (#club/NBA/2).
export const teamAttr = (l, side) => side?.key && TEAMS[side.key] ? `data-team="${side.key}"` : side?.id ? `data-club="${l}|${esc(side.id)}"` : '';
export function teamBtn(l, side, label = side.name) {
  const a = teamAttr(l, side);
  return a ? `<button class="tname" type="button" ${a}>${esc(label)}</button>` : esc(label);
}
// The emblem, as a button to the team when it has a page.
export function teamEmbBtn(l, side, cls = '', onWhite = false) {
  const a = teamAttr(l, side), e = emb(side, cls, onWhite);
  return a ? `<button class="embtn" type="button" ${a} aria-label="${esc(side.name)}">${e}</button>` : e;
}
// Games of other teams (day scores, a team's season): opened on the same game page.
export const EXTRA = new Map();
export const gameById = id => BY_ID.get(String(id)) || EXTRA.get(String(id)) || null;
export const keepExtra = list => list.map(x => { const g = toGame(x); if (g && !BY_ID.has(g.id)) EXTRA.set(g.id, g); return g && (BY_ID.get(g.id) || g); }).filter(Boolean);

export function build(raw) {
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
export function entryOf(l, name) { return ENTRY.get(l + '|' + norm(name)) || null; }
export function recordOf(e, l) {
  if (!e || e.w == null) return null;
  if (l === 'NHL') return `${e.w}–${e.l}–${e.otl ?? 0}`;
  if (l === 'MLS') return `${e.w}–${e.l}–${e.t ?? 0}`;
  return `${e.w}–${e.l}`;
}
export const REC_LABEL = { NBA: 'V–Î', NFL: 'V–Î', NHL: 'V–Î–Îp', MLS: 'V–Î–E', MLB: 'V–Î' };
export function ptsOf(e, l) { return e.pts ?? (l === 'NHL' ? 2 * (e.w || 0) + (e.otl || 0) : l === 'MLS' ? 3 * (e.w || 0) + (e.t || 0) : null); }
export function pctOf(e) { return e.pct ?? ((e.w || 0) + (e.l || 0) ? (e.w || 0) / ((e.w || 0) + (e.l || 0) + (e.t || 0)) : 0); }
export function sortDiv(rows, l) {
  return rows.slice().sort((a, b) =>
    l === 'NHL' || l === 'MLS' ? (ptsOf(b, l) - ptsOf(a, l)) || ((b.w || 0) - (a.w || 0))
      : (pctOf(b) - pctOf(a)) || ((b.w || 0) - (a.w || 0)));
}
export function divisionRows(k) {
  const D = DIVISIONS[k];
  if (D.conference) {
    const groups = (DATA.raw.standings || {})[D.l] || [];
    const g = groups.find(x => norm(x.name).includes(D.conference)) || groups[0];
    return g ? g.entries.slice().sort((a, b) => (a.seed ?? a.order) - (b.seed ?? b.order)) : [];
  }
  return sortDiv(D.members.map(n => entryOf(D.l, n)).filter(Boolean), D.l);
}
export function streakRo(s) {
  if (!s) return '';
  const m = String(s).match(/^(W|L|T|OTL|OT|D)\s*(\d+)$/i);
  if (!m) return s;
  const n = +m[2], t = m[1].toUpperCase();
  if (t === 'W') return n === 1 ? '1 victorie' : `${n} victorii la rând`;
  if (t === 'L') return n === 1 ? '1 înfrângere' : `${n} înfrângeri la rând`;
  if (t === 'OT' || t === 'OTL') return n === 1 ? '1 înfrângere în prelungiri' : `${n} înfrângeri în prelungiri la rând`;
  return n === 1 ? '1 egal' : `${n} egaluri la rând`;
}
export function teamStats(k) {
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
export function oppInfo(l, name) {
  const e = entryOf(l, name);
  return e ? `${recordOf(e, l)} · locul ${e.seed ?? e.order} ${e.conf}` : '';
}

/* ================= formatting ================= */
export const TZ = { ro: 'Europe/Bucharest', fl: 'America/New_York' };
export const TZNAME = { ro: 'ora României', fl: 'ora SUA (Est)' };
export const fmtKey = {}, fmtTime = {}, fmtShort = {}, fmtHM = {};
for (const k in TZ) {
  fmtKey[k] = new Intl.DateTimeFormat('en-CA', { timeZone: TZ[k], year: 'numeric', month: '2-digit', day: '2-digit' });
  fmtTime[k] = new Intl.DateTimeFormat('ro-RO', { timeZone: TZ[k], hour: '2-digit', minute: '2-digit', hour12: false });
  fmtShort[k] = new Intl.DateTimeFormat('ro-RO', { timeZone: TZ[k], weekday: 'short', day: 'numeric', month: 'short' });
  fmtHM[k] = new Intl.DateTimeFormat('en-GB', { timeZone: TZ[k], hour: '2-digit', minute: '2-digit', hour12: false });
}
export const MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
export const DOW = ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'];
export const DOWFULL = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];
export const col = l => LEAGUES[l].color;
export const parts = k => k.split('-').map(Number);
export function addDays(k, n) { const [y, m, d] = parts(k); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); }
export function dowOf(k) { const [y, m, d] = parts(k); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
export function dayLabel(k) { const [, m, d] = parts(k); return DOWFULL[dowOf(k)] + ', ' + d + ' ' + MONTHS[m - 1]; }
export function shortDate(k) { const [, m, d] = parts(k); return d + ' ' + MONTHS[m - 1]; }
export const keyOf = (d, tz) => fmtKey[tz].format(d);
export const tShort = (d) => fmtShort[state.tz].format(d).replace('.', '');
export function countdown(ms) {
  if (ms <= 0) return 'a început';
  const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
  return d > 0 ? `${d} z ${h} h` : h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}
export function ago(ts) {
  const m = Math.round((Date.now() - ts) / 6e4);
  return m < 1 ? 'acum' : m < 60 ? `acum ${m} min` : `acum ${Math.round(m / 60)} h`;
}

export const flSide = k => { const i = TEAMINFO[k] || {}; return { name: TEAMS[k].espn, abbr: i.abbr || TEAMS[k].ab, logo: i.logo, logoDark: i.logoDark, color: i.color, alt: i.alt, key: k }; };

/* ================= state ================= */
export const state = { tz: 'ro', leagues: new Set(['NBA', 'NHL', 'NFL', 'MLS', 'MLB']), team: '', home: false, awake: false, day: null, view: 'month', week: null, month: null, metro: 'mia', horizon: 30, agendaDays: 7 };
{
  const s = store.get('flgames-tz'); if (s === 'fl' || s === 'ro') state.tz = s;
  const v = store.get('flgames-view'); if (v === 'week' || v === 'month') state.view = v;
  const t = store.get('flgames-theme'); if (t === 'light' || t === 'dark') theme.pref = t;
}

/* ----- filters live in the address (?ligi=NBA,NHL&echipa=heat&florida=1&ore=1&zi=2026-11-15), so a view can be shared ----- */
export const ALL_L = Object.keys(LEAGUES).filter(l => !LEAGUES[l].off);
export function readFilters() {
  const q = new URLSearchParams(location.search);
  const ls = (q.get('ligi') || '').split(',').map(x => x.trim().toUpperCase()).filter(l => ALL_L.includes(l));
  if (ls.length) state.leagues = new Set(ls);
  const t = q.get('echipa'); if (t && TEAMS[t]) state.team = t;
  state.home = q.get('florida') === '1';
  state.awake = q.get('ore') === '1';
  const z = q.get('zi'); if (/^\d{4}-\d{2}-\d{2}$/.test(z || '')) { state.day = z; state.month = z.slice(0, 7); state.week = weekStart(z); }
}
export function writeFilters() {
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
export function weekStart(k) { return addDays(k, -((dowOf(k) + 6) % 7)); }
readFilters();

export function filtered() {
  return GAMES.filter(g => state.leagues.has(g.l) && (!state.team || g.teams.includes(state.team)) && (!state.home || g.inFL) && (!state.awake || played(g) || isLive(g) || g.aw === 'good'));
}
export function busyMap() {
  const m = {};
  GAMES.forEach(g => { const k = keyOf(g.d, state.tz); (m[k] ||= { teams: new Set(), leagues: new Set() }); g.teams.forEach(t => m[k].teams.add(t)); m[k].leagues.add(g.l); });
  return m;
}
export const todayKey = () => keyOf(new Date(), state.tz);
export const horizonEnd = () => Date.now() + state.horizon * 864e5;
export function lastGames(k, n = 5) { return GAMES.filter(g => g.teams.includes(k) && played(g)).slice(-n); }
export function outcome(g, k) {
  const home = g.H.key === k, mine = home ? g.hs : g.as, their = home ? g.as : g.hs;
  return mine > their ? 'V' : mine < their ? 'I' : 'E';
}
export function formChips(k) { return lastGames(k).map(g => { const o = outcome(g, k); return `<i class="${o}" title="${OUT[o]}">${OUTL[o]}</i>`; }).join(''); }

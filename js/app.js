import { LEAGUES, TEAMS, DIVISIONS, DIVISION_OF, METROS, norm } from './teams.js';

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
function confShort(n) {
  const x = norm(n);
  if (x.includes('east')) return 'Est';
  if (x.includes('west')) return 'Vest';
  if (x.includes('american')) return 'AFC';
  if (x.includes('national')) return 'NFC';
  return n;
}
function teamSide(t) {
  return { name: t.name, abbr: t.abbr || '', logo: t.logo, logoDark: t.logoDark, color: t.color, alt: t.alt, key: t.key || null };
}

function build(raw) {
  ENTRY = new Map();
  for (const [l, groups] of Object.entries(raw.standings || {})) {
    for (const g of groups) for (const e of g.entries) ENTRY.set(l + '|' + norm(e.name), { ...e, conf: confShort(g.name || g.abbr), lg: l });
  }
  TEAMINFO = raw.teams || {};
  GAMES = (raw.games || []).map(x => {
    const d = new Date(x.date);
    if (isNaN(d)) return null;
    const city = [x.city, x.region].filter(Boolean).join(', ');
    const g = {
      id: x.id, l: x.l, d, tbd: x.tbd, state: x.state, detail: x.detail,
      H: teamSide(x.home), A: teamSide(x.away), h: x.home.name, a: x.away.name,
      hs: x.home.score, as: x.away.score,
      v: x.venue, city, inFL: x.region === 'FL', note: x.note || '', tv: x.tv || ''
    };
    g.teams = [x.home.key, x.away.key].filter(k => k && TEAMS[k]);
    g.derby = g.teams.length === 2;
    g.aw = awake(d);
    g.end = d.getTime() + LEAGUES[g.l].dur * 6e4;
    return g;
  }).filter(g => g && g.teams.length).sort((a, b) => a.d - b.d);
  BY_ID = new Map(GAMES.map(g => [g.id, g]));
}

/* ----- per-team numbers ----- */
function entryOf(l, name) { return ENTRY.get(l + '|' + norm(name)) || null; }
function recordOf(e, l) {
  if (!e || e.w == null) return null;
  if (l === 'NHL') return `${e.w}–${e.l}–${e.otl ?? 0}`;
  if (l === 'MLS') return `${e.w}–${e.l}–${e.t ?? 0}`;
  return `${e.w}–${e.l}`;
}
const REC_LABEL = { NBA: 'V–Î', NFL: 'V–Î', NHL: 'V–Î–Îp', MLS: 'V–Î–E' };
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
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const $ = id => document.getElementById(id);
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

// Team emblem: the official logo when it loads, a coloured circle with the abbreviation otherwise.
function emb(side, cls = '') {
  const k = side.key, T = k && TEAMS[k];
  const bg = side.color || (T && T.col[0]) || null, fg = side.alt && side.alt.toLowerCase() !== (bg || '').toLowerCase() ? side.alt : (T ? T.col[1] : '#fff');
  const style = bg ? `style="--bg-e:${bg};--fg-e:${pickInk(bg, fg)}"` : '';
  const ab = esc(side.abbr || (side.name || '').split(' ').pop().slice(0, 3).toUpperCase());
  const pic = side.logo ? `<picture>${side.logoDark ? `<source media="(prefers-color-scheme: dark)" srcset="${esc(side.logoDark)}">` : ''}<img src="${esc(side.logo)}" alt="" loading="lazy" decoding="async" onerror="this.parentNode.remove()"></picture>` : '';
  return `<span class="emb ${cls}${bg ? '' : ' neutral'}" ${style}>${pic}<b>${ab}</b></span>`;
}
function pickInk(bg, fg) {
  // Keep the abbreviation readable on the team colour.
  const lum = h => { const n = parseInt(String(h).replace('#', ''), 16); if (isNaN(n)) return 0.5; const r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255; return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
  return Math.abs(lum(bg) - lum(fg)) > 0.35 ? fg : (lum(bg) > 0.6 ? '#111' : '#fff');
}
const flSide = k => { const i = TEAMINFO[k] || {}; return { name: TEAMS[k].espn, abbr: i.abbr || TEAMS[k].ab, logo: i.logo, logoDark: i.logoDark, color: i.color, alt: i.alt, key: k }; };

/* ================= state ================= */
const state = { tz: 'ro', leagues: new Set(['NBA', 'NHL', 'NFL', 'MLS']), team: '', home: false, awake: false, day: null, view: 'month', week: null, month: null, metro: 'mia', fav: '', horizon: 30 };
{
  const s = store.get('flgames-tz'); if (s === 'fl' || s === 'ro') state.tz = s;
  const f = store.get('flgames-fav'); if (f && TEAMS[f]) state.fav = f;
  const v = store.get('flgames-view'); if (v === 'week' || v === 'month') state.view = v;
}

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
  $('hero').innerHTML = `<div>
      <div class="k">${mine[0] === g ? 'Echipa ta · ' + esc(TEAMS[state.fav].s) : on ? 'În desfășurare' : 'Următorul meci'} · ${g.l}</div>
      <div class="duo">${emb(g.H)}<span class="at">vs</span>${emb(g.A)}</div>
      <div class="cd">${big}</div>
      <div class="m">${esc(g.h)} – ${esc(g.a)}${on && g.detail ? ` <span class="tag live">LIVE · ${esc(g.detail)}</span>` : ''}</div>
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
  if (on) extra = `<span class="tag live">LIVE${g.detail ? ' · ' + esc(g.detail) : ''}</span>`;
  else if (done) { const o = outcome(g, g.teams[0]); extra = `<span class="tag r-${o}">${OUT[o]}</span>`; }
  else if (!g.tbd) extra = `<span class="tag aw-${g.aw}">${AW[g.aw]}</span>`;
  const mid = done || on ? `<span class="sc">${g.hs ?? 0}–${g.as ?? 0}</span>` : '<span class="vs">vs</span>';
  return `<article class="game${g.derby ? ' derby' : ''}${on ? ' live' : ''}" style="--c:${col(g.l)}">
    <div class="time">${time}${alt}</div>
    <div><div class="tags"><span class="tag lg">${g.l}</span>${where}${extra}${g.note ? `<span class="tag note">${esc(g.note)}</span>` : ''}</div>
    <div class="match">${tn(g, g.H)}${mid}${tn(g, g.A)}</div>
    <div class="vrow"><span class="venue">${g.v ? esc(g.v) + ' · ' : ''}${esc(g.city)}${g.tv ? ` · <span class="tv">${esc(g.tv)}</span>` : ''}</span><button class="more" type="button" data-game="${g.id}">Detalii ›</button></div></div></article>`;
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
function renderAgenda(list, busy) {
  const now = Date.now(), lim = horizonEnd();
  const inDay = g => keyOf(g.d, state.tz) === state.day;
  const up = state.day ? list.filter(g => !played(g) && inDay(g)) : list.filter(g => !played(g) && g.d.getTime() < lim && (isLive(g) || g.end > now - 6 * 36e5));
  const recent = new Set(Object.keys(TEAMS).flatMap(k => lastGames(k).map(g => g.id)));
  const past = (state.day ? list.filter(g => played(g) && inDay(g)) : list.filter(g => played(g) && recent.has(g.id))).reverse();
  const inFL = up.filter(g => g.inFL).length, good = up.filter(g => g.aw === 'good' && !g.tbd).length;
  $('count').innerHTML = `${up.length} ${up.length === 1 ? 'meci programat' : 'meciuri programate'} <span>· ${inFL} în Florida · ${good} la ore bune în România${state.day ? ' · ' + dayLabel(state.day) : ` · următoarele ${state.horizon} de zile`}</span>`;
  $('clear').hidden = !state.day;
  const more = list.some(g => !played(g) && g.d.getTime() >= lim);
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
  $('mpanel').innerHTML = `<h3>${M.n}</h3><p>${gs.length} ${gs.length === 1 ? 'meci' : 'meciuri'} acasă în următoarele ${state.horizon} de zile. Numărul din cerc arată meciurile de acasă.</p>
    <div class="mteams">${ks.map(k => `<button type="button" data-team="${k}">${emb(flSide(k), 'sm')}${esc(TEAMS[k].s)}</button>`).join('')}</div>
    <div class="rows">${gs.slice(0, 7).map(g => `<button class="row" type="button" data-game="${g.id}"><span class="when">${tShort(g.d)}</span><span>${esc(TEAMS[g.H.key].s)} – ${esc(g.a)}</span><span class="r">${g.tbd ? '' : fmtTime[state.tz].format(g.d)}</span></button>`).join('') || '<div class="row"><span></span><span>Niciun meci acasă în perioadă.</span><span></span></div>'}</div>
    ${gs.length > 7 ? `<div class="fn">și încă ${gs.length - 7}; vezi lista completă cu filtrul „Jucate în Florida”.</div>` : ''}`;
}

function render() {
  $('tz-ro').setAttribute('aria-pressed', state.tz === 'ro');
  $('tz-fl').setAttribute('aria-pressed', state.tz === 'fl');
  $('v-month').setAttribute('aria-pressed', state.view === 'month');
  $('v-week').setAttribute('aria-pressed', state.view === 'week');
  $('team').value = state.team;
  const list = filtered(), busy = busyMap();
  if (state.day && !list.some(g => keyOf(g.d, state.tz) === state.day)) state.day = null;
  renderStatus(); renderHero(); renderHighlights(busy);
  $('cal').innerHTML = state.view === 'week' ? weekHtml(list, busy) : monthsHtml(list, busy);
  renderAgenda(list, busy); renderMap();
}

/* ================= overlays ================= */
let lastFocus = null, openGameId = null;
function show(html) { if ($('ov').hidden) lastFocus = document.activeElement; $('prof').innerHTML = html; $('ov').hidden = false; $('ov').scrollTop = 0; const x = $('prof-x'); if (x) x.focus(); }
function closeOv() { $('ov').hidden = true; openGameId = null; if (lastFocus && lastFocus.focus) lastFocus.focus(); }

function openTeam(k) {
  const T = TEAMS[k]; if (!T) return;
  openGameId = null;
  const st = teamStats(k), now = Date.now(), side = flSide(k);
  const mine = GAMES.filter(g => g.teams.includes(k));
  const last = lastGames(k).reverse(), next = mine.filter(g => !played(g) && (isLive(g) || g.end > now)).slice(0, 5);
  const opp = g => (g.H.key === k ? 'vs ' : 'la ') + esc(g.H.key === k ? g.a : g.h);
  const isMLS = T.l === 'MLS', fav = state.fav === k;
  const bandBg = side.color || T.col[0], bandFg = pickInk(bandBg, side.alt || T.col[1]);
  show(`<div class="band" style="background:${bandBg};color:${bandFg}"><div class="id">${emb(side, 'xl')}<div><div class="lgn">${T.l} · ${esc(T.city)}</div><h2 id="prof-name">${esc(T.espn)}</h2></div></div>
      <button class="x" type="button" id="prof-x" aria-label="Închide">×</button></div>
    <div class="pbody">
    <div class="stats">
      <div class="stat"><div class="v">${st.rec}</div><div class="l">Bilanț (${st.recL})</div></div>
      ${st.conf != null ? `<div class="stat"><div class="v">Locul ${st.conf}</div><div class="l">${T.l === 'NFL' ? 'în ' + esc(st.confN) : 'în conferința de ' + esc(st.confN)}</div></div>` : st.standing ? `<div class="stat"><div class="v" style="font-size:16px">${esc(st.standing)}</div><div class="l">Clasament</div></div>` : ''}
      ${isMLS && st.pts != null ? `<div class="stat"><div class="v">${st.pts}</div><div class="l">puncte</div></div>` : st.div ? `<div class="stat"><div class="v">Locul ${st.div}</div><div class="l">în ${esc(DIVISIONS[DIVISION_OF[k]].t.split(' · ')[1])}</div></div>` : ''}
      ${st.home ? `<div class="stat"><div class="v">${st.home}</div><div class="l">Acasă</div></div>` : ''}
      ${st.away ? `<div class="stat"><div class="v">${st.away}</div><div class="l">În deplasare</div></div>` : ''}
      ${st.streak ? `<div class="stat"><div class="v" style="font-size:17px">${esc(st.streak)}</div><div class="l">Serie curentă</div></div>` : ''}
    </div>
    <div><h3>Forma, ultimele ${last.length} meciuri</h3><div class="form">${formChips(k)}<span>cel mai recent în dreapta</span></div></div>
    <dl class="facts">
      <dt>Rivali</dt><dd>${esc(T.rivals)}</dd>
      <dt>Arenă</dt><dd>${esc(T.arena)}</dd>
      <dt>Capacitate</dt><dd>${esc(T.cap)}</dd>
      <dt>În ligă din</dt><dd>${T.since}</dd>
      <dt>Palmares</dt><dd>${esc(T.titles)}</dd>
      <dt>De știut</dt><dd>${esc(T.fact)}</dd>
    </dl>
    <div><h3>Următoarele meciuri</h3><div class="rows">${next.length ? next.map(g => `<button class="row" type="button" data-game="${g.id}"><span class="when">${tShort(g.d)}</span><span>${opp(g)}${g.note ? ` <span style="color:var(--muted);font-size:12.5px">· ${esc(g.note)}</span>` : ''}</span><span class="r">${isLive(g) ? 'LIVE' : g.tbd ? 'oră neanunțată' : fmtTime[state.tz].format(g.d)}</span></button>`).join('') : '<div class="row"><span></span><span>Niciun meci programat.</span><span></span></div>'}</div></div>
    <div><h3>Ultimele rezultate</h3><div class="rows">${last.map(g => { const o = outcome(g, k); const a = g.H.key === k ? g.hs : g.as, b = g.H.key === k ? g.as : g.hs; return `<button class="row" type="button" data-game="${g.id}"><span class="when">${tShort(g.d)}</span><span>${opp(g)}</span><span class="r ${o}">${OUTL[o]} ${a}–${b}</span></button>`; }).join('') || '<div class="row"><span></span><span>Niciun meci jucat încă.</span><span></span></div>'}</div></div>
    ${tableHtml(DIVISION_OF[k])}
    <div class="btns"><button class="primary" type="button" data-only="${k}">Arată doar meciurile echipei</button>
      <button class="ghost" type="button" data-fav="${k}">${fav ? '★ Echipa mea (apasă ca să renunți)' : '☆ Setează ca echipa mea'}</button></div>
    </div>`);
}

function sideInfo(g, side) {
  const k = side.key;
  if (k && TEAMS[k]) { const st = teamStats(k); return `<small>${st.rec}${st.conf != null ? ` · locul ${st.conf} ${esc(st.confN)}` : ''}</small><div class="form">${formChips(k)}</div>`; }
  const o = oppInfo(g.l, side.name); return o ? `<small>${esc(o)}</small>` : '<small>&nbsp;</small>';
}
const CAT_RO = { points: 'Puncte', rebounds: 'Recuperări', assists: 'Pase decisive', goals: 'Goluri', 'passing yards': 'Yarzi din pase', 'rushing yards': 'Yarzi din alergare', 'receiving yards': 'Yarzi la recepție', saves: 'Parade', 'save percentage': 'Procent parade', steals: 'Intercepții', blocks: 'Capace', shots: 'Șuturi', 'plus/minus': '+/-', sacks: 'Sack-uri', tackles: 'Placaje', 'goals against average': 'Goluri primite în medie', 'shots on goal': 'Șuturi pe poartă' };
const catRo = c => CAT_RO[norm(c)] || c;
function periodLabels(l, n) {
  const base = l === 'NHL' ? ['R1', 'R2', 'R3'] : l === 'MLS' ? ['Rep. 1', 'Rep. 2'] : ['S1', 'S2', 'S3', 'S4'];
  const out = []; for (let i = 0; i < n; i++) out.push(base[i] || (l === 'MLS' ? 'Prel.' : i === base.length ? 'Prel.' : 'Prel. ' + (i - base.length + 1)));
  if (l === 'NHL' && n === 5) out[4] = 'Lov.';
  return out;
}
function detailHtml(g, s) {
  if (!s) return '';
  let html = '';
  const fh = !!g.H.key, fa = !!g.A.key;
  if (s.predictor && !played(g)) {
    const p = s.predictor, t = p.tie && g.l === 'MLS' ? p.tie : 0, sum = (p.home || 0) + (p.away || 0) + t || 1;
    const pc = v => Math.round(v / sum * 100);
    html += `<div><h3>Șanse de victorie</h3><div class="prob"><span class="${fh ? 'fl' : ''}" style="flex:${p.home}">${pc(p.home)}%</span>${t ? `<span class="dr" style="flex:${t}">egal ${pc(t)}%</span>` : ''}<span class="${fa ? 'fl' : ''}" style="flex:${p.away}">${pc(p.away)}%</span></div><div class="fn">Stânga: ${esc(g.h)}. Dreapta: ${esc(g.a)}. Estimare ESPN.</div></div>`;
  }
  const n = Math.max(s.home.lines.length, s.away.lines.length);
  if (n && (played(g) || isLive(g))) {
    const lab = periodLabels(g.l, n);
    html += `<div><h3>Scor pe ${g.l === 'MLS' ? 'reprize' : g.l === 'NHL' ? 'reprize' : 'sferturi'}</h3><table><thead><tr><th></th><th>Echipă</th>${lab.map(x => `<th>${x}</th>`).join('')}<th>Total</th></tr></thead><tbody>
      <tr><td></td><td>${esc(g.h)}</td>${s.home.lines.map(x => `<td>${x ?? ''}</td>`).join('')}<td><b>${s.home.score ?? ''}</b></td></tr>
      <tr><td></td><td>${esc(g.a)}</td>${s.away.lines.map(x => `<td>${x ?? ''}</td>`).join('')}<td><b>${s.away.score ?? ''}</b></td></tr></tbody></table></div>`;
  }
  if (s.goals && s.goals.length) html += `<div><h3>Goluri</h3><ul class="notes">${s.goals.map(x => `<li>${esc(x.min)} ${esc(x.who)}${x.team ? ` <span style="color:var(--muted)">(${esc(x.team)})</span>` : ''}</li>`).join('')}</ul></div>`;
  if (s.leaders && s.leaders.length) html += `<div><h3>${played(g) || isLive(g) ? 'Cei mai buni jucători' : 'Liderii echipelor în sezon'}</h3><div class="leaders">${s.leaders.map(t => `<div class="tbl"><h3>${esc(t.team)}</h3><ul>${t.items.map(i => `<li><span class="c">${esc(catRo(i.cat))}:</span> ${esc(i.who)} · <b>${esc(i.val)}</b></li>`).join('')}</ul></div>`).join('')}</div></div>`;
  if (s.attendance) html += `<div class="fn">Spectatori: ${s.attendance.toLocaleString('ro-RO')}</div>`;
  return html;
}
function openGame(id, cached) {
  const g = BY_ID.get(String(id)); if (!g) return;
  openGameId = g.id;
  const done = played(g), on = isLive(g), other = state.tz === 'ro' ? 'fl' : 'ro', k = keyOf(g.d, state.tz), now = Date.now();
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
  const status = done ? 'Final' + (g.detail && !/^final$/i.test(g.detail) ? ' · ' + g.detail : '') : on ? 'LIVE · ' + g.detail : g.tbd ? 'oră neanunțată' : g.d.getTime() > now ? 'începe în ' + countdown(g.d.getTime() - now) : 'urmează să înceapă';
  const canFetch = DATA.mode !== 'snapshot';
  show(`<div class="band plain"><div><div class="lgn" style="color:${col(g.l)}">${g.l}${g.note ? ' · ' + esc(g.note) : ''}</div><h2 id="prof-name" style="font-size:22px">${dayLabel(k)}</h2></div>
      <button class="x" type="button" id="prof-x" aria-label="Închide">×</button></div>
    <div class="pbody">
    <div class="duel">
      <div class="side">${emb(g.H, 'lg')}<span>${esc(g.h)}</span>${sideInfo(g, g.H)}</div>
      <div class="mid">${done || on ? (g.hs ?? 0) + '–' + (g.as ?? 0) : g.tbd ? 'vs' : fmtTime[state.tz].format(g.d)}<small>${esc(status)}</small></div>
      <div class="side">${emb(g.A, 'lg')}<span>${esc(g.a)}</span>${sideInfo(g, g.A)}</div>
    </div>
    <dl class="facts">
      ${g.tbd ? '' : `<dt>Start</dt><dd>${fmtTime[state.tz].format(g.d)} ${TZNAME[state.tz]} · ${fmtTime[other].format(g.d)} ${TZNAME[other]} (${fmtShort[other].format(g.d).replace('.', '')})</dd>`}
      <dt>Unde</dt><dd>${g.v ? esc(g.v) + ', ' : ''}${esc(g.city)}</dd>
      ${g.tv ? `<dt>Transmisie SUA</dt><dd>${esc(g.tv)}</dd>` : ''}
      ${done || on || g.tbd ? '' : `<dt>Pentru România</dt><dd>${{ good: 'Oră bună, se poate urmări seara.', late: 'Târziu, începe în jurul miezului nopții.', night: 'Noapte albă, începe după ora 01:00.' }[g.aw]}</dd>`}
    </dl>
    ${ctx.length ? `<div><h3>Context</h3><ul class="notes">${ctx.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>` : ''}
    <div id="gdetail">${cached ? detailHtml(g, cached) : canFetch ? '<div class="skeleton" style="height:70px"></div>' : '<div class="fn">Detaliile meciului apar când sursa live răspunde.</div>'}</div>
    <div class="btns">${g.teams.map(t => `<button class="ghost" type="button" data-team="${t}">Profil ${esc(TEAMS[t].s)}</button>`).join('')}<button class="ghost" type="button" data-day="${k}" data-jump="1">Toate meciurile zilei</button></div>
    </div>`);
  if (canFetch && !cached) loadGame(g);
}
const SUMMARY = new Map();
async function loadGame(g) {
  const key = g.l + g.id;
  try {
    let s = SUMMARY.get(key);
    if (!s || isLive(g)) { s = await getJSON(`/api/game?l=${g.l}&id=${encodeURIComponent(g.id)}`, 10000); SUMMARY.set(key, s); }
    if (openGameId === g.id && $('gdetail')) $('gdetail').innerHTML = detailHtml(g, s) || '<div class="fn">ESPN nu are încă detalii pentru acest meci.</div>';
  } catch (e) {
    if (openGameId === g.id && $('gdetail')) $('gdetail').innerHTML = '<div class="fn">Nu am putut încărca detaliile meciului. Încearcă din nou mai târziu.</div>';
  }
}

/* ================= events ================= */
function setTz(z) { state.tz = z; state.day = null; state.week = null; state.month = null; store.set('flgames-tz', z); render(); }
function resetFilters() { state.team = ''; state.home = false; state.awake = false; $('homeonly').checked = false; $('awake').checked = false; ['NBA', 'NHL', 'NFL', 'MLS'].forEach(l => state.leagues.add(l)); renderStatic(); }
$('tz-ro').onclick = () => setTz('ro');
$('tz-fl').onclick = () => setTz('fl');
$('team').onchange = e => { state.team = e.target.value; render(); };
$('homeonly').onchange = e => { state.home = e.target.checked; render(); };
$('awake').onchange = e => { state.awake = e.target.checked; render(); };
$('clear').onclick = () => { state.day = null; render(); };
$('more').onclick = () => { state.horizon += 30; render(); };
function handle(e) {
  const q = s => e.target.closest(s);
  if (!GAMES.length && !q('#reload')) return;
  if (q('#prof-x') || e.target === $('ov')) { closeOv(); return; }
  let el;
  if ((el = q('#reload'))) { load(true); return; }
  if ((el = q('[data-fav]'))) { const k = el.dataset.fav; state.fav = state.fav === k ? '' : k; state.fav ? store.set('flgames-fav', state.fav) : store.del('flgames-fav'); renderStatic(); render(); openTeam(k); return; }
  if ((el = q('[data-only]'))) { resetFilters(); state.team = el.dataset.only; state.day = null; closeOv(); render(); $('cal').scrollIntoView({ block: 'start' }); return; }
  if ((el = q('[data-game]'))) { openGame(el.dataset.game); return; }
  if ((el = q('[data-team]'))) { openTeam(el.dataset.team); return; }
  if ((el = q('[data-l]'))) { const l = el.dataset.l; state.leagues.has(l) ? state.leagues.delete(l) : state.leagues.add(l); el.setAttribute('aria-pressed', state.leagues.has(l)); render(); return; }
  if ((el = q('[data-view]'))) { state.view = el.dataset.view; store.set('flgames-view', state.view); render(); return; }
  if ((el = q('[data-wk]'))) { state.week = addDays(state.week, +el.dataset.wk); render(); return; }
  if ((el = q('[data-mo]'))) { const [y, m] = parts(state.month + '-01'); const d = new Date(Date.UTC(y, m - 1 + (+el.dataset.mo), 1)); state.month = d.toISOString().slice(0, 7); render(); return; }
  if ((el = q('[data-metro]'))) { state.metro = el.dataset.metro; renderMap(); return; }
  if ((el = q('[data-day]'))) {
    const k = el.dataset.day, jump = !!el.dataset.jump;
    state.day = (state.day === k && !jump) ? null : k;
    if (jump) { resetFilters(); if (!$('ov').hidden) closeOv(); state.week = addDays(k, -((dowOf(k) + 6) % 7)); state.month = k.slice(0, 7); }
    render(); if (jump || state.view === 'week') $('count').scrollIntoView({ block: 'start' });
  }
}
document.addEventListener('click', handle);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('ov').hidden) closeOv();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('g[data-metro]')) { e.preventDefault(); handle(e); }
});

/* ================= loading, refresh, live scores ================= */
function apply(raw, mode) {
  DATA.raw = raw; DATA.mode = mode; DATA.loadedAt = mode === 'live' ? Date.now() : new Date(raw.updated).getTime();
  build(raw);
  $('banner').hidden = true;
  renderStatic(); render();
  scheduleLive();
}
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
  if (active.length) liveTimer = setTimeout(() => pollLive([...new Set(active.map(g => g.l))]), 60e3);
  else {
    const next = GAMES.find(g => !played(g) && !g.tbd && g.d.getTime() > now);
    if (next) liveTimer = setTimeout(scheduleLive, Math.min(next.d.getTime() - now + 30e3, 30 * 60e3));
  }
}
async function pollLive(leagues) {
  if (document.hidden) { liveTimer = setTimeout(() => pollLive(leagues), 60e3); return; }
  try {
    const r = await getJSON('/api/live?l=' + leagues.join(','), 10000);
    let changed = false, finished = false;
    for (const x of r.games || []) {
      const g = BY_ID.get(String(x.id)); if (!g) continue;
      if (g.state !== x.state || g.hs !== x.hs || g.as !== x.as || g.detail !== x.detail) {
        if (x.state === 'post' && g.state !== 'post') finished = true;
        Object.assign(g, { state: x.state, hs: x.hs, as: x.as, detail: x.detail }); changed = true;
      }
    }
    if (finished) { load(); return; }
    if (changed) { render(); if (openGameId && BY_ID.get(openGameId) && isLive(BY_ID.get(openGameId))) loadGame(BY_ID.get(openGameId)); }
  } catch (e) { /* keep the last known scores */ }
  scheduleLive();
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && DATA.mode !== 'snapshot' && Date.now() - DATA.loadedAt > 15 * 60e3) load();
});
setInterval(() => { if (GAMES.length) { renderHero(); renderStatus(); } }, 30000);
setInterval(() => { if (!document.hidden) load(); }, 15 * 60e3);

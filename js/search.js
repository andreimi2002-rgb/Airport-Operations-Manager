// The search box: teams, opponents, cities and stadiums from all of America.
import { TEAMS, norm } from './teams.js';
import { esc, $, emb } from './ui.js';
import { PLACES, loadPlaces, AMERICA, loadAmerica, allPlaces } from './places.js';
import { DATA, GAMES, flKey, flSide, played, recordOf, tShort } from './core.js';
import { minePick, renderMinePickList, WELCOME, renderWelcomeList } from './home.js';
import { gameView, go } from './pages.js';

/* ================= search ================= */
// Everything findable: Florida teams, every opponent in the schedule, cities, stadiums.
export function searchIndex() {
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
    out.push({ kind: 'Meci', text: `${name} ${o.side.abbr} ${o.l}`, label: name, sub: o.next ? `următorul meci: ${tShort(g.d)}, ${g.teams.map(t => TEAMS[t].s).join(', ')}` : `ultimul meci: ${tShort(g.d)}, ${g.hs}–${g.as}`, hash: `#meci/${g.l}/${g.id}`, side: o.side, rank: 4 });
  }
  // Every other team of the five leagues, from the standings: its own page.
  for (const [l, groups] of Object.entries(DATA.raw?.standings || {})) for (const g of groups) for (const e of g.entries) {
    if (flKey(l, e.name) || !e.id) continue;
    out.push({ kind: 'Echipă', text: `${e.name} ${e.abbr} ${l}`, label: e.name, sub: `${l} · ${recordOf(e, l) || ''}`, hash: `#club/${l}/${e.id}`, side: e, rank: 1 });
  }
  // Cities and stadiums: Florida and the rest of America (america.json loads with the first search).
  for (const c of allPlaces()) {
    const where = c.fl ? `Florida, comitatul ${PLACES.data.cities[c.id].county}` : `${c.region}, ${c.country}`;
    out.push({ kind: 'Oraș', text: `${c.name} ${c.region} ${c.country}`, label: c.name, sub: where, hash: '#oras/' + c.id, img: c.img, rank: 2 });
    for (const v of c.venues) out.push({ kind: v.kind === 'arena' ? 'Arenă' : 'Stadion', text: `${v.name} ${v.alias.join(' ')} ${v.teams.map(t => t.name).join(' ')} ${c.name}`, label: v.name, sub: `${v.teams.map(t => t.name).join(', ')} · ${c.name}`, hash: '#stadion/' + v.id, img: v.img, rank: 3 });
  }
  return out;
}
export let qSel = -1, qHits = [];
export function runSearch() {
  const raw = $('q').value, q = norm(raw);
  const box = $('qres');
  if (q.length < 2) { box.hidden = true; $('q').setAttribute('aria-expanded', 'false'); qHits = []; return; }
  const words = q.split(/\s+/).filter(Boolean);
  qHits = searchIndex().map(x => {
    const t = norm(x.text), lab = norm(x.label);
    if (!words.every(w => t.includes(w))) return null;
    return { ...x, score: (lab.startsWith(q) ? 0 : lab.split(' ').some(p => p.startsWith(words[0])) ? 1 : 2) * 10 + x.rank };
  }).filter(Boolean).sort((a, b) => a.score - b.score || a.label.localeCompare(b.label)).slice(0, 10);
  qSel = qHits.length ? 0 : -1;
  box.innerHTML = qHits.length ? qHits.map((x, i) => `<button type="button" role="option" id="qo${i}" class="qopt${i === qSel ? ' sel' : ''}" aria-selected="${i === qSel}" data-qi="${i}">${x.side ? emb(x.side, 'sm') : x.img ? `<img src="${esc(x.img)}" alt="" loading="lazy">` : ''}<span><b>${esc(x.label)}</b><small>${esc(x.kind)} · ${esc(x.sub)}</small></span></button>`).join('')
    : `<div class="qnone">Nimic găsit pentru „${esc(raw)}”.</div>`;
  box.hidden = false;
  $('q').setAttribute('aria-expanded', 'true');
  $('q').setAttribute('aria-activedescendant', qSel >= 0 ? 'qo' + qSel : '');
}
export function pickSearch(i) {
  const x = qHits[i]; if (!x) return;
  $('q').value = ''; $('qres').hidden = true; $('q').setAttribute('aria-expanded', 'false');
  if (x.hash.startsWith('#meci/')) { gameView.tab = 'rezumat'; gameView.side = ''; }
  go(x.hash);
}
$('q').addEventListener('input', runSearch);
document.addEventListener('input', e => {
  if (e.target.id === 'minefilter') { minePick.q = e.target.value; renderMinePickList(); }
  if (e.target.id === 'welcomefilter') { WELCOME.q = e.target.value; renderWelcomeList(); }
});
$('q').addEventListener('focus', () => {
  runSearch();
  for (const p of [!PLACES.data && loadPlaces(), !AMERICA.data && loadAmerica()]) p?.then?.(() => { if (document.activeElement === $('q')) runSearch(); });
});
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

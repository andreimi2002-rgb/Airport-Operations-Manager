// Game page: the tabs under the score (summary, players, team stats, plays, absentees)
// and the win-probability chart. Pure rendering from the /api/game data; app.js owns the overlay.
import { TEAMS } from './teams.js';
import { esc, emb } from './ui.js';
import { detailRo, TEAM_STATS, statNum, statText, boxCols, NFL_GROUP, injStatusRo, injSerious, bodyRo, nflKindRo, nflPlayRo, catRo, dnpRo, leaderValRo } from './ro.js';

const played = g => g.state === 'post';
const isLive = g => g.state === 'in';
const sideOf = (g, s) => (s === 'away' ? g.A : g.H);
const nameOf = (g, s) => (s === 'away' ? g.a : g.h);
// Short team name: "Heat" for Florida teams (from teams.js), the nickname for the others
// ("Chicago Bears" -> "Bears", "Detroit Red Wings" -> "Red Wings", "Charlotte FC" -> "Charlotte").
const TWO_WORD = /\b(Red Wings|Blue Jackets|Maple Leafs|Golden Knights|Trail Blazers|Red Sox|White Sox|Blue Jays|Red Bulls|Sounders FC|Whitecaps FC)$/;
export function nick(name) {
  const n = String(name || '').trim();
  const two = n.match(TWO_WORD); if (two) return two[1].replace(/ FC$/, '');
  const w = n.split(/\s+/).filter(x => !/^(FC|SC|CF|AFC)$/i.test(x));
  if (!w.length) return n;
  // Soccer clubs named after a city ("Charlotte FC", "FC Cincinnati", "Toronto FC") keep the city.
  return /\b(FC|SC|CF)\b/.test(n) ? w.join(' ') : w[w.length - 1];
}
const shortOf = (g, s) => { const x = sideOf(g, s); return x.key && TEAMS[x.key] ? TEAMS[x.key].s : nick(nameOf(g, s)) || x.abbr; };
const fmtDay = new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', day: 'numeric', month: 'short' });
const fmtDayY = new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', day: 'numeric', month: 'short', year: 'numeric' });
const dayShort = (iso, ref) => {
  const d = new Date(iso); if (isNaN(d)) return '';
  const other = ref && Math.abs(d - ref) > 200 * 864e5;
  return (other ? fmtDayY : fmtDay).format(d).replace('.', '');
};

function periodTitle(l, n) {
  if (n == null) return '';
  if (l === 'MLS') return n === 1 ? 'Prima repriză' : n === 2 ? 'A doua repriză' : n <= 4 ? 'Prelungiri' : 'Lovituri de la 11 metri';
  if (l === 'NHL') return n <= 3 ? `Repriza ${n}` : n === 4 ? 'Prelungiri' : 'Lovituri de departajare';
  return n <= 4 ? `Sfertul ${n}` : n === 5 ? 'Prelungiri' : `Prelungiri ${n - 4}`;
}
const periodShort = (l, n) => (l === 'NHL' ? (n <= 3 ? 'R' + n : 'Prel.') : l === 'MLS' ? (n <= 2 ? 'R' + n : 'Prel.') : (n <= 4 ? 'S' + n : 'Prel.'));

/* ================= tabs ================= */
export function gameTabs(g, s) {
  const t = [['rezumat', 'Rezumat']];
  if (!s) return t;
  if (s.box?.length) t.push(['jucatori', 'Jucători']);
  if (cmpRows(g, s).length) t.push(['statistici', played(g) || isLive(g) ? 'Statistici' : 'Comparație']);
  if (s.plays?.length) t.push(['faze', g.l === 'MLS' ? 'Goluri și cartonașe' : g.l === 'NFL' ? 'Puncte marcate' : 'Goluri']);
  if (s.injuries?.length) t.push(['absenti', 'Absenți']);
  return t;
}
export function tabsHtml(g, s, tab) {
  const t = gameTabs(g, s);
  if (t.length < 2) return '';
  return `<div class="tabs" role="tablist" aria-label="Secțiuni meci">${t.map(([k, n]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${k === tab}" ${k === tab ? '' : 'tabindex="-1"'}>${n}</button>`).join('')}</div>`;
}
export function panelHtml(g, s, view) {
  const ok = gameTabs(g, s).some(([k]) => k === view.tab);
  const tab = ok ? view.tab : 'rezumat';
  if (tab === 'jucatori') return boxHtml(g, s, view.side);
  if (tab === 'statistici') return cmpHtml(g, s);
  if (tab === 'faze') return playsHtml(g, s);
  if (tab === 'absenti') return injHtml(g, s);
  return summaryHtml(g, s, view.known || (() => false));
}

/* ================= summary ================= */
function summaryHtml(g, s, known) {
  if (!s) return '';
  let html = '';
  if (s.predictor && !played(g) && !isLive(g)) {
    const p = s.predictor, t = p.tie && g.l === 'MLS' ? p.tie : 0, sum = (p.home || 0) + (p.away || 0) + t || 1;
    const pc = v => Math.round(v / sum * 100);
    html += `<section><h3>Șanse de victorie</h3><div class="prob"><span class="h" style="flex:${p.home}">${esc(shortOf(g, 'home'))} ${pc(p.home)}%</span>${t ? `<span class="dr" style="flex:${t}">egal ${pc(t)}%</span>` : ''}<span class="a" style="flex:${p.away}">${esc(shortOf(g, 'away'))} ${pc(p.away)}%</span></div><div class="fn">Estimare ESPN înainte de meci.</div></section>`;
  }
  if (s.wp?.length > 5 && (played(g) || isLive(g))) html += wpHtml(g, s);
  const n = Math.max(s.home.lines.length, s.away.lines.length);
  if (n && (played(g) || isLive(g))) {
    const lab = []; for (let i = 0; i < n; i++) lab.push(i < (g.l === 'NHL' ? 3 : g.l === 'MLS' ? 2 : 4) ? periodShort(g.l, i + 1) : (g.l === 'NHL' && i === 4 ? 'Lov.' : 'Prel.'));
    html += `<section><h3>Scor pe ${g.l === 'NBA' || g.l === 'NFL' ? 'sferturi' : 'reprize'}</h3><div class="scroll"><table class="lines"><thead><tr><th>Echipă</th>${lab.map(x => `<th>${x}</th>`).join('')}<th>Total</th></tr></thead><tbody>
      ${['home', 'away'].map(w => `<tr><td>${emb(sideOf(g, w), 'sm')}${esc(shortOf(g, w))}</td>${s[w].lines.map(x => `<td>${x ?? ''}</td>`).join('')}<td><b>${s[w].score ?? ''}</b></td></tr>`).join('')}</tbody></table></div></section>`;
  }
  if (s.goalies?.length && !played(g)) html += `<section><h3>Portari probabili</h3><ul class="notes">${s.goalies.map(x => `<li>${esc(shortOf(g, x.side))}: <b>${esc(x.n)}</b>${x.j ? ` (#${esc(x.j)})` : ''}</li>`).join('')}</ul></section>`;
  if (s.leaders?.length) html += `<section><h3>${played(g) || isLive(g) ? 'Cei mai buni jucători' : 'Liderii echipelor în sezon'}</h3><div class="leaders">${s.leaders.map(t => `<div class="tbl"><h4>${t.side ? emb(sideOf(g, t.side), 'sm') : ''}${esc(t.side ? shortOf(g, t.side) : t.team)}</h4><ul>${t.items.map(i => `<li><span class="c">${esc(catRo(i.cat))}</span> ${esc(i.who)} · <b>${esc(leaderValRo(i.val))}</b></li>`).join('')}</ul></div>`).join('')}</div></section>`;
  if (s.videos?.length) html += `<section><h3>Rezumate video</h3><div class="vids">${s.videos.map(v => `<figure><video controls preload="none" playsinline src="${esc(v.mp4)}"${v.thumb ? ` poster="${esc(v.thumb)}"` : ''}></video><figcaption>${esc(v.title)}${v.dur ? ` <span>· ${Math.floor(v.dur / 60)}:${String(v.dur % 60).padStart(2, '0')}</span>` : ''}</figcaption></figure>`).join('')}</div><div class="fn">Clipuri ESPN, în engleză.</div></section>`;
  if (s.series?.games?.length) html += seriesHtml(g, s, known);
  if (s.last5?.length) html += `<section><h3>Forma, ultimele 5 meciuri</h3><div class="l5">${s.last5.map(t => `<div class="tbl"><h4>${emb(sideOf(g, t.side), 'sm')}${esc(shortOf(g, t.side))}</h4><div class="rows">${t.games.map(x => `<div class="row"><span class="when">${dayShort(x.date)}</span><span>${x.at ? 'la' : 'vs'} ${esc(x.opp)}</span><span class="r ${x.res}">${x.res === 'V' ? 'V' : x.res === 'I' ? 'Î' : 'E'} ${x.mine ?? ''}–${x.their ?? ''}</span></div>`).join('')}</div></div>`).join('')}</div></section>`;
  if (s.attendance) html += `<div class="fn">Spectatori: ${s.attendance.toLocaleString('ro-RO')}</div>`;
  return html;
}

function seriesHtml(g, s, known) {
  let wh = 0, wa = 0, d = 0;
  const recent = g.l === 'MLS';
  // A season series reads oldest first; a multi-year soccer history reads newest first.
  const rows = s.series.games.slice().sort((a, b) => (recent ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date))).map(x => {
    const done = x.state === 'post' && x.home.score != null;
    if (done) {
      const homeIsH = x.home.abbr === s.home.abbr;
      const hs = homeIsH ? x.home.score : x.away.score, as = homeIsH ? x.away.score : x.home.score;
      if (hs > as) wh++; else if (as > hs) wa++; else d++;
    }
    const cur = x.id === String(g.id);
    const link = !cur && known(x.id);
    return `<${link ? `button type="button" data-game="${esc(x.id)}"` : 'div'} class="row${cur ? ' cur' : ''}"><span class="when">${dayShort(x.date, g.d)}</span><span>${esc(x.home.abbr)} – ${esc(x.away.abbr)}${cur ? ' <small>(acest meci)</small>' : ''}</span><span class="r">${done ? `${x.home.score}–${x.away.score}` : 'urmează'}</span></${link ? 'button' : 'div'}>`;
  });
  const sum =wh + wa + d ? `${esc(shortOf(g, 'home'))} ${wh} · ${esc(shortOf(g, 'away'))} ${wa}${d ? ` · egal ${d}` : ''}` : '';
  return `<section><h3>${recent ? 'Ultimele meciuri directe' : 'Meciurile directe din sezon'}</h3>${sum ? `<div class="fn" style="margin:0 0 4px">Victorii: ${sum}</div>` : ''}<div class="rows">${rows.join('')}</div></section>`;
}

/* ================= win probability ================= */
// One series: the home team's chance to win (0–100). Above the 50% line the area takes the home
// colour, below it the away colour; both ends are labelled with the team name, so colour is never alone.
function wpHtml(g, s) {
  const pts = s.wp, n = pts.length, W = 600, H = 168, L = 8, R = 592, T = 16, B = 150;
  const x = i => L + (R - L) * i / (n - 1), y = p => T + (B - T) * (100 - p) / 100;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[0]).toFixed(1)}`).join('');
  const area = `${line}L${x(n - 1).toFixed(1)},${y(50)}L${L},${y(50)}Z`;
  let marks = '', last = pts[0][1] ?? 1;
  pts.forEach((p, i) => {
    const per = p[1];
    if (per != null && per !== last && i > 0) { marks += `<line class="per" x1="${x(i).toFixed(1)}" x2="${x(i).toFixed(1)}" y1="${T}" y2="${B}"/><text class="perl" x="${(x(i) + 4).toFixed(1)}" y="${T + 12}">${periodShort(g.l, per)}</text>`; last = per; }
  });
  const end = pts[n - 1][0];
  // Largest edge while the game was still open: the last moments of a finished game always reach 100%.
  let best = { p: 50, i: 0 };
  pts.slice(0, played(g) ? Math.max(1, Math.floor(n * 0.94)) : n).forEach((p, i) => { if (Math.abs(p[0] - 50) > Math.abs(best.p - 50)) best = { p: p[0], i }; });
  const bestSide = best.p >= 50 ? 'home' : 'away', bestPct = Math.round(best.p >= 50 ? best.p : 100 - best.p);
  const id = 'wp' + g.id;
  const data = esc(JSON.stringify({ p: pts, h: shortOf(g, 'home'), a: shortOf(g, 'away'), l: g.l }));
  return `<section><h3>Șansele de victorie pe parcursul meciului</h3>
    <div class="wpbox"><svg class="wp" viewBox="0 0 ${W} ${H}" role="img" aria-label="Șansa de victorie: ${esc(shortOf(g, 'home'))} ${Math.round(end)}% la ${isLive(g) ? 'momentul actual' : 'final'}; cel mai mare avantaj ${esc(shortOf(g, bestSide))} ${bestPct}%." data-wp="${data}">
      <defs><clipPath id="${id}t"><rect x="0" y="0" width="${W}" height="${y(50)}"/></clipPath><clipPath id="${id}b"><rect x="0" y="${y(50)}" width="${W}" height="${H}"/></clipPath></defs>
      <rect class="bg" x="${L}" y="${T}" width="${R - L}" height="${B - T}"/>
      <path class="ah" d="${area}" clip-path="url(#${id}t)"/><path class="aa" d="${area}" clip-path="url(#${id}b)"/>
      <line class="mid" x1="${L}" x2="${R}" y1="${y(50)}" y2="${y(50)}"/>${marks}
      <path class="ln" d="${line}"/>
      <text class="lab" x="${L + 4}" y="${T + 13}">${esc(shortOf(g, 'home'))} 100%</text>
      <text class="lab" x="${L + 4}" y="${B - 5}">${esc(shortOf(g, 'away'))} 100%</text>
      <line class="cross" x1="0" x2="0" y1="${T}" y2="${B}" hidden/><circle class="dot" r="4.5" cx="0" cy="0" hidden/>
      <rect class="hit" x="${L}" y="0" width="${R - L}" height="${H}"/>
    </svg><div class="wptip" hidden></div></div>
    <div class="fn">Linia arată șansa estimată de ESPN pentru fiecare echipă. Cel mai mare avantaj: ${esc(shortOf(g, bestSide))} ${bestPct}%${pts[best.i][1] ? `, în ${periodTitle(g.l, pts[best.i][1]).toLowerCase()}` : ''}.</div></section>`;
}
// Hover / touch on the chart: crosshair, dot and a tooltip with both teams' chances.
export function wpHover(e) {
  const svg = e.target.closest && e.target.closest('svg.wp');
  if (!svg) return;
  const d = JSON.parse(svg.dataset.wp), n = d.p.length;
  const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
  const px = (e.clientX - r.left) / r.width * vb.width;
  const i = Math.max(0, Math.min(n - 1, Math.round((px - 8) / (592 - 8) * (n - 1))));
  const [p, per] = d.p[i], cx = 8 + 584 * i / (n - 1), cy = 16 + 134 * (100 - p) / 100;
  const cross = svg.querySelector('.cross'), dot = svg.querySelector('.dot'), tip = svg.parentNode.querySelector('.wptip');
  if (e.type === 'pointerleave') { cross.setAttribute('hidden', ''); dot.setAttribute('hidden', ''); tip.hidden = true; return; }
  cross.removeAttribute('hidden'); dot.removeAttribute('hidden');
  cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); dot.setAttribute('cx', cx); dot.setAttribute('cy', cy);
  const ph = Math.round(p), pa = 100 - ph;
  tip.innerHTML = `${per ? `<small>${esc(periodTitle(d.l, per))}</small>` : ''}<span><b>${ph}%</b> ${esc(d.h)}</span><span><b>${pa}%</b> ${esc(d.a)}</span>`;
  tip.hidden = false;
  const left = cx / vb.width * r.width;
  tip.style.left = Math.max(0, Math.min(r.width - tip.offsetWidth, left + (left > r.width / 2 ? -tip.offsetWidth - 10 : 10))) + 'px';
}

/* ================= players ================= */
function boxHtml(g, s, want) {
  const sides = s.box.map(b => b.side);
  const pref = g.H.key ? 'home' : g.A.key ? 'away' : 'home';
  const side = sides.includes(want) ? want : sides.includes(pref) ? pref : sides[0];
  const b = s.box.find(x => x.side === side);
  const sw = `<div class="seg sides" role="group" aria-label="Echipa">${['home', 'away'].filter(w => sides.includes(w)).map(w => `<button type="button" data-side="${w}" aria-pressed="${w === side}">${emb(sideOf(g, w), 'sm')}${esc(shortOf(g, w))}</button>`).join('')}</div>`;
  let html = sw + (b.formation ? `<div class="fn" style="margin:0">Formație: ${esc(b.formation)}</div>` : '');
  const legend = new Map();
  const table = (title, cols, rows, grp, opts = {}) => {
    if (!rows.length || !cols) return '';
    cols.forEach(c => legend.set(c[1], c[2]));
    const val = (r, k) => { const i = grp.keys.indexOf(k); return i >= 0 ? r.v[i] ?? '' : ''; };
    const tr = r => `<tr><th scope="row"><span class="pn">${esc(r.n)}</span><small>${[r.pos, r.j ? '#' + r.j : ''].filter(Boolean).join(' · ')}${r.sub ? ' · <span class="in" title="a intrat pe parcurs">intrat</span>' : ''}${r.out ? ' · <span class="out" title="a fost înlocuit">ieșit</span>' : ''}</small></th>${cols.map(c => `<td>${esc(val(r, c[0]))}</td>`).join('')}</tr>`;
    const starters = opts.split ? rows.filter(r => r.st) : rows, bench = opts.split ? rows.filter(r => !r.st) : [];
    const tot = grp.tot?.length && opts.tot ? `<tr class="tot"><th scope="row">Total</th>${cols.map(c => { const i = grp.keys.indexOf(c[0]); return `<td>${esc(i >= 0 ? grp.tot[i] ?? '' : '')}</td>`; }).join('')}</tr>` : '';
    return `${title ? `<h4 class="bxh">${esc(title)}</h4>` : ''}<div class="scroll"><table class="box"><thead><tr><th scope="col">Jucător</th>${cols.map(c => `<th scope="col" title="${esc(c[2])}">${esc(c[1])}</th>`).join('')}</tr></thead><tbody>${starters.map(tr).join('')}${bench.length ? `<tr class="sep"><td colspan="${cols.length + 1}">Rezerve</td></tr>${bench.map(tr).join('')}` : ''}${tot}</tbody></table></div>`;
  };
  if (g.l === 'NBA') {
    const grp = b.groups[0], dnp = grp.rows.filter(r => r.dnp || !r.v.length);
    html += table('', boxCols('NBA', grp.name), grp.rows.filter(r => !r.dnp && r.v.length), grp, { split: true, tot: true });
    if (dnp.length) html += `<div class="fn">N-au jucat: ${dnp.map(r => `${esc(r.n)}${r.why ? ` (${esc(dnpRo(r.why))})` : ''}`).join(', ')}.</div>`;
  } else if (g.l === 'NHL') {
    const sk = b.groups.filter(x => x.name !== 'goalies');
    for (const grp of sk) html += table(grp.name === 'forwards' ? 'Atacanți' : grp.name === 'defenses' ? 'Fundași' : 'Jucători', boxCols('NHL', grp.name), grp.rows, grp);
    const gk = b.groups.find(x => x.name === 'goalies');
    if (gk) html += table('Portari', boxCols('NHL', 'goalies'), gk.rows, gk);
  } else if (g.l === 'NFL') {
    for (const grp of b.groups) { const cols = boxCols('NFL', grp.name); if (cols) html += table(NFL_GROUP[grp.name] || grp.name, cols, grp.rows.slice(0, 8), grp); }
  } else if (g.l === 'MLS') {
    const grp = b.groups[0], gkRows = grp.rows.filter(r => r.pos === 'G'), field = grp.rows.filter(r => r.pos !== 'G');
    html += table('Jucători de câmp', boxCols('MLS', 'soccer'), field, grp, { split: true });
    html += table('Portar', boxCols('MLS', 'keeper'), gkRows, grp);
  }
  html += `<div class="fn legend-cols">${[...legend].filter(([a, b]) => a !== b).map(([a, b]) => `<b>${esc(a)}</b> = ${esc(b)}`).join(' · ')}</div>`;
  return `<section class="boxsec">${html}</section>`;
}

/* ================= team stats ================= */
function cmpRows(g, s) {
  const by = Object.fromEntries((s?.teamStats || []).map(x => [x.k, x]));
  return (TEAM_STATS[g.l] || []).filter(([k]) => by[k]).map(([k, label, o = {}]) => ({ k, label, o, h: by[k].h, a: by[k].a }));
}
function cmpHtml(g, s) {
  const rows = cmpRows(g, s), pre = !played(g) && !isLive(g);
  const body = rows.map(r => {
    const h = statNum(r.h, r.o.fmt), a = statNum(r.a, r.o.fmt);
    const tot = (h || 0) + (a || 0);
    const sh = tot ? (h || 0) / tot * 100 : 50;
    const better = h == null || a == null || h === a ? '' : (h > a) !== !!r.o.low ? 'h' : 'a';
    return `<div class="crow"><b class="${better === 'h' ? 'win' : ''}">${esc(statText(r.h, r.o.fmt))}</b><span>${esc(r.label)}</span><b class="${better === 'a' ? 'win' : ''}">${esc(statText(r.a, r.o.fmt))}</b><div class="cbar" aria-hidden="true"><i class="h" style="width:${sh.toFixed(1)}%"></i><i class="a" style="width:${(100 - sh).toFixed(1)}%"></i></div></div>`;
  }).join('');
  return `<section><h3>${pre ? 'Mediile echipelor în acest sezon' : 'Statisticile echipelor'}</h3>
    <div class="cmp"><div class="cmph"><span>${emb(g.H, 'sm')}${esc(shortOf(g, 'home'))}</span><span>${esc(shortOf(g, 'away'))}${emb(g.A, 'sm')}</span></div>${body}</div>
    <div class="fn">Cifra mai bună e îngroșată. Bara arată cât din total îi revine fiecărei echipe.</div></section>`;
}

/* ================= plays ================= */
function playsHtml(g, s) {
  let html = '', cur;
  for (const p of s.plays) {
    if (p.per !== cur) { if (cur !== undefined) html += '</div>'; html += `<h4 class="bxh">${esc(periodTitle(g.l, p.per))}</h4><div class="rows">`; cur = p.per; }
    let what = '';
    if (g.l === 'MLS') {
      const tag = p.kind === 'goal' ? '<span class="ev goal">Gol</span>' : p.kind === 'og' ? '<span class="ev goal">Autogol</span>' : p.kind === 'yc' ? '<span class="ev yc" title="Cartonaș galben"></span>' : p.kind === 'rc' ? '<span class="ev rc" title="Cartonaș roșu"></span>' : p.kind === 'pmiss' ? '<span class="ev">Penalty ratat</span>' : '';
      what = `${tag}<b>${esc(p.who)}</b>${p.pen && p.kind === 'goal' ? ' (penalty)' : ''}${p.ast?.length ? ` <small>pasă: ${esc(p.ast.join(', '))}</small>` : ''}${p.kind === 'yc' ? ' <small>cartonaș galben</small>' : p.kind === 'rc' ? ' <small>cartonaș roșu</small>' : ''}`;
    } else if (g.l === 'NHL') {
      const how = [p.pp && 'în superioritate', p.sh && 'în inferioritate', p.en && 'cu poarta goală'].filter(Boolean).join(', ');
      what = `<span class="ev goal">Gol</span><b>${esc(p.who)}</b>${how ? ` <small>${how}</small>` : ''}<small class="blk">${p.ast?.length ? 'pase: ' + esc(p.ast.join(', ')) : 'fără pase'}</small>`;
    } else {
      what = `<span class="ev goal">${esc(nflKindRo(p.kind))}</span>${esc(nflPlayRo(p.text))}`;
    }
    const sc = p.hs != null && p.as != null ? `${p.hs}–${p.as}` : '';
    html += `<div class="row play"><span class="when">${esc(p.clock)}</span><span>${emb(sideOf(g, p.side), 'sm')}${what}</span><span class="r">${sc}</span></div>`;
  }
  if (cur !== undefined) html += '</div>';
  const hdr = g.l === 'MLS' ? '' : `<div class="fn" style="margin:0 0 4px">Scorul din dreapta: ${esc(shortOf(g, 'home'))}–${esc(shortOf(g, 'away'))}.${g.l === 'NHL' || g.l === 'NFL' ? ' Ora e timpul rămas din perioadă.' : ''}</div>`;
  return `<section>${hdr}${html}</section>`;
}

/* ================= injuries ================= */
const fmtRet = new Intl.DateTimeFormat('ro-RO', { timeZone: 'UTC', day: 'numeric', month: 'long' });
function injHtml(g, s) {
  const html = ['home', 'away'].map(w => {
    const t = s.injuries.find(x => x.side === w);
    if (!t) return `<div class="tbl"><h4>${emb(sideOf(g, w), 'sm')}${esc(shortOf(g, w))}</h4><div class="fn">Niciun jucător indisponibil anunțat.</div></div>`;
    return `<div class="tbl"><h4>${emb(sideOf(g, w), 'sm')}${esc(shortOf(g, w))}</h4><div class="rows">${t.items.map(x => {
      const ret = x.ret && !isNaN(new Date(x.ret)) ? `revine estimat pe ${fmtRet.format(new Date(x.ret))}` : '';
      const what = bodyRo(x.what, x.det, x.side);
      return `<div class="inj"><div><b>${esc(x.n)}</b> <small>${esc(x.pos)}</small></div><span class="tag ${injSerious(x.st) ? 'out' : 'gtd'}">${esc(injStatusRo(x.st))}</span><small>${[what, ret].filter(Boolean).map(esc).join(' · ')}</small></div>`;
    }).join('')}</div></div>`;
  }).join('');
  return `<section><div class="injs">${html}</div><div class="fn">Lista vine de la ESPN și se poate schimba până la începutul meciului.</div></section>`;
}

export { detailRo };

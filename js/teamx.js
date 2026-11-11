// Team page tabs beyond the summary: the season chart and leaders, the roster, ESPN news.
// Pure rendering; app.js owns the overlay and passes the games it has.
import { esc } from './ui.js';

export const TEAM_TABS = [['rezumat', 'Rezumat'], ['sezon', 'Sezon'], ['lot', 'Lot'], ['stiri', 'Știri']];
export function teamTabsHtml(tab) {
  return `<div class="tabs" role="tablist" aria-label="Secțiuni echipă">${TEAM_TABS.map(([k, n]) => `<button type="button" role="tab" data-ttab="${k}" aria-selected="${k === tab}" ${k === tab ? '' : 'tabindex="-1"'}>${n}</button>`).join('')}</div>`;
}

/* ---------- season ---------- */
const LEAD_RO = {
  pointsPerGame: 'Puncte pe meci', reboundsPerGame: 'Recuperări pe meci', assistsPerGame: 'Pase decisive pe meci', stealsPerGame: 'Mingi furate pe meci', blocksPerGame: 'Capace pe meci',
  points: 'Puncte (goluri + pase)', goals: 'Goluri', assists: 'Pase de gol', plusMinus: '+/-', savePct: 'Procent de parade', wins: 'Victorii ca portar',
  passingYards: 'Yarzi din pase', rushingYards: 'Yarzi din alergare', receivingYards: 'Yarzi la recepție', totalTackles: 'Placaje', sacks: 'Sack-uri', interceptions: 'Interceptări',
  totalShots: 'Șuturi', saves: 'Parade', avg: 'Medie la bătaie', homeRuns: 'Home run-uri', RBIs: 'Puncte aduse (RBI)', ERA: 'ERA (aruncător)', strikeouts: 'Strikeout-uri'
};
const fmtD = new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', day: 'numeric', month: 'short' });

// One bar per game played, up for a win, down for a loss, height = the score difference.
// Status colours (win/loss) match the V/Î chips used everywhere else; the labels carry the meaning too.
export function seasonChartHtml(rows, l) {
  if (!rows.length) return '<div class="fn">Echipa nu a jucat încă niciun meci în acest sezon.</div>';
  const n = rows.length, W = 600, H = 170, mid = 85, L = 30, R = 594;
  const cap = Math.max(5, ...rows.map(r => Math.abs(r.mine - r.their)));
  const bw = Math.min(26, (R - L) / n * 0.7), step = (R - L) / n;
  const y = v => (v / cap) * (mid - 14);
  const bars = rows.map((r, i) => {
    const m = r.mine - r.their, h = Math.max(2, Math.abs(y(m))), x = L + step * i + (step - bw) / 2;
    const cls = m > 0 ? 'w' : m < 0 ? 'l' : 'd';
    return `<rect class="${cls}" x="${x.toFixed(1)}" y="${(m >= 0 ? mid - h : mid).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3"/>`;
  }).join('');
  const hits = rows.map((r, i) => `<rect class="hit" data-i="${i}" data-game="${esc(r.id)}" x="${(L + step * i).toFixed(1)}" y="0" width="${step.toFixed(1)}" height="${H}"/>`).join('');
  const unit = l === 'NBA' || l === 'NFL' ? 'puncte' : 'goluri';
  const data = esc(JSON.stringify(rows.map(r => [fmtD.format(r.d).replace('.', ''), r.opp, r.home, r.mine, r.their])));
  const w = rows.filter(r => r.mine > r.their).length, lo = rows.filter(r => r.mine < r.their).length, t = n - w - lo;
  const pf = rows.reduce((a, r) => a + r.mine, 0) / n, pa = rows.reduce((a, r) => a + r.their, 0) / n;
  const best = rows.reduce((a, r) => (r.mine - r.their > a.mine - a.their ? r : a), rows[0]);
  return `<div class="seas" data-seas="${data}">
    <svg class="sz" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sezonul, meci cu meci: ${w} victorii, ${lo} înfrângeri${t ? `, ${t} egaluri` : ''}.">
      <line class="ax0" x1="${L}" x2="${R}" y1="${mid}" y2="${mid}"/>
      <line class="axg" x1="${L}" x2="${R}" y1="14" y2="14"/><line class="axg" x1="${L}" x2="${R}" y1="${H - 14}" y2="${H - 14}"/>
      <text class="axl" x="${L - 6}" y="18" text-anchor="end">+${cap}</text>
      <text class="axl" x="${L - 6}" y="${mid + 4}" text-anchor="end">0</text>
      <text class="axl" x="${L - 6}" y="${H - 10}" text-anchor="end">−${cap}</text>
      <text class="lab" x="${R}" y="28" text-anchor="end">victorii ↑</text><text class="lab" x="${R}" y="${H - 22}" text-anchor="end">înfrângeri ↓</text>
      ${bars}${hits}
    </svg><div class="sztip" hidden></div></div>
    <div class="fn">Fiecare bară e un meci, în ordine: în sus victoriile, în jos înfrângerile; înălțimea e diferența de ${unit}. Apasă pe o bară pentru pagina meciului.</div>
    <div class="stats">
      <div class="stat"><div class="v">${pf.toFixed(1).replace('.', ',')}</div><div class="l">${unit} marcate pe meci</div></div>
      <div class="stat"><div class="v">${pa.toFixed(1).replace('.', ',')}</div><div class="l">${unit} primite pe meci</div></div>
      <div class="stat"><div class="v">+${best.mine - best.their}</div><div class="l">cea mai mare victorie: ${best.home ? 'vs' : 'la'} ${esc(best.opp)}, ${best.mine}–${best.their}</div></div>
    </div>`;
}
export function seasonHover(e) {
  const box = e.target.closest && e.target.closest('.seas');
  if (!box) return;
  const tip = box.querySelector('.sztip'), hit = e.type !== 'pointerleave' && e.target.closest('rect.hit');
  box.querySelectorAll('.hov').forEach(x => x.classList.remove('hov'));
  if (!hit) { tip.hidden = true; return; }
  const i = +hit.dataset.i, [d, opp, home, a, b] = JSON.parse(box.dataset.seas)[i];
  const bar = box.querySelectorAll('svg.sz rect:not(.hit)')[i]; if (bar) bar.classList.add('hov');
  tip.innerHTML = `<b>${esc(d)} · ${home ? 'vs' : 'la'} ${esc(opp)}</b><span>${a > b ? 'Victorie' : a < b ? 'Înfrângere' : 'Egal'} ${a}–${b}</span>`;
  tip.hidden = false;
  const r = box.getBoundingClientRect(), hr = hit.getBoundingClientRect();
  tip.style.left = Math.max(0, Math.min(r.width - tip.offsetWidth, hr.left - r.left + hr.width / 2 - tip.offsetWidth / 2)) + 'px';
}
// ESPN writes numbers the American way: "27.7", "1,396", ".900" -> "27,7", "1.396", "0,900".
export function roNum(v) {
  const s = String(v ?? '').trim();
  if (/^-?\d{1,3}(,\d{3})+$/.test(s)) return s.replace(/,/g, '.');
  if (/^-?\d*\.\d+$/.test(s)) return (s.startsWith('.') ? '0' + s : s.startsWith('-.') ? '-0' + s.slice(1) : s).replace('.', ',');
  return s;
}
export function leadersHtml(x) {
  if (!x?.leaders?.length) return '';
  return `<section><h3>Liderii echipei în sezon</h3><div class="tleaders">${x.leaders.map(p => `<div class="tlead">${p.head ? `<img src="${esc(p.head)}" alt="" loading="lazy">` : '<span class="ph"></span>'}<span><small>${esc(LEAD_RO[p.cat] || p.label)}</small><b>${esc(p.who)}</b></span><span class="v">${esc(roNum(p.val))}</span></div>`).join('')}</div></section>`;
}

/* ---------- roster ---------- */
const GROUP_RO = {
  Centers: 'Centri', 'Left Wings': 'Extreme stânga', 'Right Wings': 'Extreme dreapta', Defense: 'Fundași', Goalies: 'Portari',
  offense: 'Atac', defense: 'Apărare', specialTeam: 'Echipe speciale', injuredReserveOrOut: 'Accidentați sau indisponibili', suspended: 'Suspendați', practiceSquad: 'Lotul de antrenament'
};
// NBA and MLS rosters come as one list: grouped here by position.
const BY_POS = {
  NBA: [['G', 'Fundași'], ['F', 'Extreme'], ['C', 'Pivoți']],
  MLS: [['G', 'Portari'], ['D', 'Fundași'], ['M', 'Mijlocași'], ['F', 'Atacanți']]
};
export function rosterHtml(x, l) {
  if (!x?.roster?.length) return '<div class="fn">Lotul nu e disponibil acum.</div>';
  let groups = x.roster;
  if (groups.length === 1 && BY_POS[l]) {
    const all = groups[0].players;
    groups = BY_POS[l].map(([p, name]) => ({ name, players: all.filter(q => (q.pos || '').startsWith(p)) })).filter(g => g.players.length);
    const rest = all.filter(q => !groups.some(g => g.players.includes(q)));
    if (rest.length) groups.push({ name: 'Alții', players: rest });
  }
  return groups.map((g, gi) => `<details class="rgrp" ${gi < 2 ? 'open' : ''}><summary>${esc(GROUP_RO[g.name] || g.name || 'Jucători')} <span>${g.players.length}</span></summary><div class="rlist">${g.players.slice().sort((a, b) => (+a.j || 99) - (+b.j || 99)).map(p => `<div class="rp">${p.head ? `<img src="${esc(p.head)}" alt="" loading="lazy">` : '<span class="ph"></span>'}<span><b>${esc(p.n)}</b><small>${[p.j ? '#' + esc(p.j) : '', esc(p.pos), p.age ? p.age + ' ani' : '', p.cm ? p.cm + ' cm' : '', p.born ? esc(p.born) : ''].filter(Boolean).join(' · ')}</small></span>${p.out ? '<span class="tag out">indisponibil</span>' : ''}</div>`).join('')}</div></details>`).join('')
    + '<div class="fn">Lotul vine de la ESPN; înălțimea e convertită în centimetri.</div>';
}

/* ---------- news ---------- */
const fmtNews = new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const TYPE_RO = { Recap: 'Cronică', Preview: 'Înainte de meci', Story: 'Articol', HeadlineNews: 'Știre', Media: 'Video' };
export function newsHtml(x) {
  if (!x?.news?.length) return '<div class="fn">Nicio știre ESPN acum.</div>';
  return `<div class="news">${x.news.map(a => `<a class="nw" href="${esc(a.link)}" target="_blank" rel="noopener">${a.img ? `<img src="${esc(a.img)}" alt="" loading="lazy">` : ''}<span><small>${esc(TYPE_RO[a.type] || 'Știre')}${a.date ? ' · ' + esc(fmtNews.format(new Date(a.date))) : ''}</small><b>${esc(a.h)}</b>${a.d ? `<span class="dsc">${esc(a.d)}</span>` : ''}</span></a>`).join('')}</div>
    <div class="fn">Știrile sunt de pe ESPN, în engleză; se deschid pe site-ul lor.</div>`;
}

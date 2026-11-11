// The "Ligile" page: every game of a day, full standings, every team; and the "Azi în ligi" strip.
// Pure rendering. app.js owns the data, the routing and passes `ctx` with its helpers:
//   ctx.emb(side, cls), ctx.time(date) (time in the chosen zone), ctx.status(g), ctx.dayLabel(key),
//   ctx.flKey(l, name) (Florida team key or null), ctx.col(l) (league colour)
import { esc } from './ui.js';

export const LG_TABS = [['scoruri', 'Scoruri'], ['clasamente', 'Clasamente'], ['echipe', 'Echipe'], ['orase', 'Orașe și stadioane']];
const L_ORDER = ['NBA', 'NHL', 'NFL', 'MLS', 'MLB'];
const L_NAME = { NBA: 'NBA, baschet', NHL: 'NHL, hochei', NFL: 'NFL, fotbal american', MLS: 'MLS, fotbal', MLB: 'MLB, baseball' };

export function lgHeadHtml(tab, leagues, chosen) {
  return `<div class="lghead">
    <div class="tabs lgtabs" role="tablist" aria-label="Ligile">${LG_TABS.map(([k, n]) => `<button type="button" role="tab" data-lgtab="${k}" aria-selected="${k === tab}" ${k === tab ? '' : 'tabindex="-1"'}>${n}</button>`).join('')}</div>
    <div class="filters">${L_ORDER.filter(l => leagues.includes(l)).map(l => `<button class="chip" type="button" data-lgl="${l}" aria-pressed="${chosen.has(l)}" style="--c:var(--${l.toLowerCase()})"><span class="dot"></span>${l}</button>`).join('')}</div>
  </div>`;
}

/* ---------- scores ---------- */
const side = (g, s, ctx) => {
  const t = s === 'home' ? g.H : g.A, sc = s === 'home' ? g.hs : g.as, other = s === 'home' ? g.as : g.hs;
  const win = g.state === 'post' && sc != null && other != null && sc > other;
  return `<span class="gsd${t.key ? ' fl' : ''}${win ? ' win' : ''}">${ctx.emb(t, 'sm')}<span class="nm">${esc(t.name)}${t.key ? ' <i aria-label="echipă din Florida">★</i>' : ''}</span>${g.state !== 'pre' ? `<b>${sc ?? 0}</b>` : ''}</span>`;
};
export function gameRowHtml(g, ctx) {
  const st = ctx.status(g);
  return `<button class="grow${g.teams.length ? ' fl' : ''}${g.state === 'in' ? ' live' : ''}" type="button" data-game="${esc(g.id)}" style="--c:${ctx.col(g.l)}">
    <span class="gt">${st}</span><span class="gsides">${side(g, 'away', ctx)}${side(g, 'home', ctx)}</span></button>`;
}
export function scoresHtml(day, data, chosen, ctx) {
  const nav = `<div class="daynav"><button class="link" type="button" data-lgday="-1" aria-label="Ziua anterioară">‹</button><div><b>${esc(ctx.dayLabel(day))}</b><small>ziua din SUA; orele sunt ${esc(ctx.zoneName)}</small></div><button class="link" type="button" data-lgday="1" aria-label="Ziua următoare">›</button>${day !== ctx.today ? '<button class="link" type="button" data-lgday="0">Azi</button>' : ''}</div>`;
  if (!data) return nav + '<div class="skeleton" style="height:240px"></div>';
  const blocks = L_ORDER.filter(l => chosen.has(l) && data[l]?.length).map(l => `<section class="lgblock"><h3><span class="ldot" style="--c:${ctx.col(l)}"></span>${L_NAME[l]} <small>${data[l].length} ${data[l].length === 1 ? 'meci' : 'meciuri'}</small></h3><div class="grows">${data[l].map(g => gameRowHtml(g, ctx)).join('')}</div></section>`);
  return nav + (blocks.join('') || '<div class="empty">Niciun meci în această zi pentru ligile alese.</div>')
    + '<div class="fn">Echipele din Florida sunt marcate cu ★. Apasă pe un meci pentru pagina lui: statistici, faze, jucători.</div>';
}

/* ---------- standings ---------- */
const recCols = l => (l === 'NHL' ? [['V', e => e.w], ['Î', e => e.l], ['Îp', e => e.otl ?? 0], ['Pct', e => e.pts]] : l === 'MLS' ? [['V', e => e.w], ['E', e => e.t ?? 0], ['Î', e => e.l], ['Pct', e => e.pts]] : [['V', e => e.w], ['Î', e => e.l], ['%', e => (e.pct != null ? e.pct.toFixed(3).replace(/^0/, '') : '')]]);
// Order inside a conference: the playoff seed when ESPN gives it to everyone, otherwise points / win share.
export function orderEntries(entries, l) {
  const all = entries.every(e => e.seed != null);
  return entries.slice().sort((a, b) => all ? a.seed - b.seed
    : (l === 'NHL' || l === 'MLS') ? (b.pts ?? 0) - (a.pts ?? 0) || (b.w ?? 0) - (a.w ?? 0)
      : (b.pct ?? 0) - (a.pct ?? 0) || (b.w ?? 0) - (a.w ?? 0));
}
const groupName = (n, l) => ({ 'Eastern Conference': 'Conferința de Est', 'Western Conference': 'Conferința de Vest', 'American Football Conference': 'AFC', 'National Football Conference': 'NFC', 'American League': 'American League', 'National League': 'National League' }[n] || n);
export function standingsHtml(standings, chosen, ctx) {
  const out = L_ORDER.filter(l => chosen.has(l) && standings?.[l]?.length).map(l => `<section class="lgblock"><h3><span class="ldot" style="--c:${ctx.col(l)}"></span>${L_NAME[l]}</h3><div class="stgrid">${standings[l].map(g => {
    const cols = recCols(l), rows = orderEntries(g.entries, l);
    return `<div class="tbl"><h4>${esc(groupName(g.name, l))}</h4><div class="scroll"><table class="box st"><thead><tr><th scope="col">Echipă</th>${cols.map(c => `<th scope="col">${c[0]}</th>`).join('')}<th scope="col">Serie</th></tr></thead><tbody>${rows.map((e, i) => {
      const k = ctx.flKey(l, e.name);
      return `<tr class="${k ? 'fl' : ''}"><th scope="row"><button class="tname" type="button" ${k ? `data-team="${k}"` : `data-club="${l}|${esc(e.id)}"`}><span class="rk">${i + 1}</span>${ctx.emb({ ...e, key: k }, 'sm')}<span class="pn">${esc(e.name)}</span></button></th>${cols.map(c => `<td>${c[1](e) ?? '–'}</td>`).join('')}<td>${esc((e.streak || '').replace(/^W/, 'V').replace(/^L/, 'Î').replace(/^T/, 'E'))}</td></tr>`;
    }).join('')}</tbody></table></div></div>`;
  }).join('')}</div></section>`);
  return (out.join('') || '<div class="empty">Clasamentele nu sunt disponibile acum.</div>')
    + '<div class="fn">NHL: Îp = înfrângeri în prelungiri, Pct = puncte. MLS: E = egaluri. Serie: V = victorii la rând, Î = înfrângeri, E = egaluri. Apasă pe o echipă pentru pagina ei.</div>';
}

/* ---------- all teams ---------- */
export function teamsHtml(standings, chosen, ctx) {
  const out = L_ORDER.filter(l => chosen.has(l) && standings?.[l]?.length).map(l => {
    const teams = standings[l].flatMap(g => g.entries).slice().sort((a, b) => a.name.localeCompare(b.name));
    return `<section class="lgblock"><h3><span class="ldot" style="--c:${ctx.col(l)}"></span>${L_NAME[l]} <small>${teams.length} echipe</small></h3><div class="tgrid">${teams.map(e => {
      const k = ctx.flKey(l, e.name);
      return `<button class="tcard${k ? ' fl' : ''}" type="button" ${k ? `data-team="${k}"` : `data-club="${l}|${esc(e.id)}"`}>${ctx.emb({ ...e, key: k }, 'lg')}<span><b>${esc(e.name)}</b><small>${e.w ?? 0}–${e.l ?? 0}${l === 'NHL' ? '–' + (e.otl ?? 0) : l === 'MLS' ? '–' + (e.t ?? 0) : ''}${k ? ' · ★ Florida' : ''}</small></span></button>`;
    }).join('')}</div></section>`;
  });
  return out.join('') || '<div class="empty">Lista echipelor nu e disponibilă acum.</div>';
}

/* ---------- the strip on the Florida page ---------- */
export function todayStripHtml(data, ctx) {
  if (!data) return '';
  const ls = L_ORDER.filter(l => data[l]?.length);
  if (!ls.length) return '';
  const all = ls.flatMap(l => data[l]);
  const live = all.filter(g => g.state === 'in' && !g.teams.length).slice(0, 3);
  const pick = live.length ? live : all.filter(g => g.state === 'pre' && !g.teams.length).slice(0, 3);
  return `<div class="tnhead"><h2 class="sec">Azi în ligi</h2><a class="link" href="#ligi" data-goview="ligi">Toate scorurile ›</a></div>
    <div class="tlchips">${ls.map(l => { const n = data[l].length, on = data[l].filter(g => g.state === 'in').length; return `<a class="chip" href="#ligi" data-goview="ligi" data-lgonly="${l}" style="--c:var(--${l.toLowerCase()})"><span class="dot"></span>${l} ${n}${on ? ` <b class="lv">· ${on} LIVE</b>` : ''}</a>`; }).join('')}</div>
    ${pick.length ? `<div class="grows">${pick.map(g => gameRowHtml(g, ctx)).join('')}</div>` : ''}`;
}

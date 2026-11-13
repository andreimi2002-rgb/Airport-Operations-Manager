// The "Ligile" page: every game of a day, full standings, every team; and the "Azi în ligi" strip.
// Pure rendering. app.js owns the data, the routing and passes `ctx` with its helpers:
//   ctx.emb(side, cls), ctx.time(date) (time in the chosen zone), ctx.status(g), ctx.dayLabel(key),
//   ctx.flKey(l, name) (Florida team key or null), ctx.col(l) (league colour)
import { HOME } from './teams.js';
import { esc } from './ui.js';

export const LG_TABS = [['scoruri', 'Scoruri'], ['clasamente', 'Clasamente'], ['echipe', 'Echipe'], ['evenimente', 'Europa și evenimente'], ['orase', 'Orașe și stadioane'], ['ghid', 'Ghid']];
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
  return `<span class="gsd${t.key ? ' fl' : ''}${win ? ' win' : ''}">${ctx.emb(t, 'sm')}<span class="nm">${esc(t.name)}${t.key ? ' <i aria-label="una dintre echipele tale">★</i>' : ''}</span>${g.state !== 'pre' ? `<b>${ctx.sp ? ctx.sp(g.id, sc ?? 0) : sc ?? 0}</b>` : ''}</span>`;
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
    + `<div class="fn">Echipele din ${esc(HOME.name)} sunt marcate cu ★. Apasă pe un meci pentru pagina lui: statistici, faze, jucători.</div>`;
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

/* ----- the playoff lines in a conference table ----- */
// How many teams of a conference (or MLB league) reach the post-season: [direct places, last place still in]
// (NBA: 1–6 playoff, 7–10 play-in; MLS: 1–7 playoff, 8–9 wild card; NHL: 8, by divisions and wild cards).
export const CUTS = { NBA: [6, 10], NHL: [8], NFL: [7], MLS: [7, 9], MLB: [6] };
const half = x => (x === 0 ? '0' : `${Math.floor(x) || ''}${x % 1 ? '½' : ''}`);
// The distance of a team behind the last place still in: points (NHL, MLS) or games behind (the others).
export function behind(e, cut, l) {
  if (l === 'NHL' || l === 'MLS') { const d = (cut.pts ?? 0) - (e.pts ?? 0); return d > 0 ? `−${d} p` : '='; }
  const gb = ((cut.w ?? 0) - (e.w ?? 0) + (e.l ?? 0) - (cut.l ?? 0)) / 2;
  return gb > 0 ? `${half(gb)} m` : '=';
}
// Only for a whole conference (not a division) once the season has started.
const cutsFor = (rows, l) => (CUTS[l] && rows.length > CUTS[l].at(-1) && rows.some(e => (e.w ?? 0) + (e.l ?? 0) > 0) ? CUTS[l] : null);
export const cutNote = {
  NBA: 'Linia plină: primele 6 merg direct în playoff; linia punctată: locurile 7–10 joacă play-in-ul.',
  NHL: 'Linia: 8 echipe din fiecare conferință merg în playoff (primele 3 din fiecare divizie și 2 wild card), deci linia e orientativă.',
  NFL: 'Linia: 7 echipe din fiecare conferință merg în playoff (cele 4 câștigătoare de divizie și 3 wild card).',
  MLS: 'Linia plină: primele 7 merg direct în playoff; linia punctată: locurile 8–9 joacă wild card.',
  MLB: 'Linia: 6 echipe din fiecare ligă merg în playoff (cele 3 câștigătoare de divizie și 3 wild card).'
};

// One conference / league table. `me`: the ESPN id of a team to mark (on its own page).
export function groupTableHtml(g, l, ctx, me = null) {
  const cols = recCols(l), rows = orderEntries(g.entries, l), cuts = cutsFor(rows, l);
  const last = cuts && rows[cuts.at(-1) - 1];
  return `<div class="tbl"><h4>${esc(groupName(g.name, l))}</h4><div class="scroll"><table class="box st${cuts ? ' cuts' : ''}"><thead><tr><th scope="col">Echipă</th>${cols.map(c => `<th scope="col">${c[0]}</th>`).join('')}${cuts ? '<th scope="col" title="Cât lipsește până la ultimul loc de playoff">Dif.</th>' : ''}<th scope="col">Serie</th></tr></thead><tbody>${rows.map((e, i) => {
    const k = ctx.flKey(l, e.name), mine = me != null && String(e.id) === String(me);
    const line = cuts && (i + 1 === cuts[0] && i + 1 < rows.length ? 'cut' : cuts[1] && i + 1 === cuts[1] ? 'cut2' : '');
    return `<tr class="${[k ? 'fl' : '', mine ? 'me' : '', line].filter(Boolean).join(' ')}"><th scope="row"><button class="tname" type="button" ${k ? `data-team="${k}"` : `data-club="${l}|${esc(e.id)}"`}><span class="rk">${i + 1}</span>${ctx.emb({ ...e, key: k }, 'sm')}<span class="pn">${esc(e.name)}</span></button></th>${cols.map(c => `<td>${c[1](e) ?? '–'}</td>`).join('')}${cuts ? `<td class="gb">${i >= cuts.at(-1) ? esc(behind(e, last, l)) : ''}</td>` : ''}<td>${esc((e.streak || '').replace(/^W/, 'V').replace(/^L/, 'Î').replace(/^T/, 'E'))}</td></tr>`;
  }).join('')}</tbody></table></div>${cuts ? `<div class="fn cutfn">${esc(cutNote[l])} Dif. = cât lipsește până la locul ${cuts.at(-1)} (${l === 'NHL' || l === 'MLS' ? 'puncte' : 'meciuri'}).</div>` : ''}</div>`;
}
export function standingsHtml(standings, chosen, ctx) {
  const out = L_ORDER.filter(l => chosen.has(l) && standings?.[l]?.length).map(l => `<section class="lgblock"><h3><span class="ldot" style="--c:${ctx.col(l)}"></span>${L_NAME[l]}</h3><div class="stgrid">${standings[l].map(g => groupTableHtml(g, l, ctx)).join('')}</div></section>`);
  return (out.join('') || '<div class="empty">Clasamentele nu sunt disponibile acum.</div>')
    + '<div class="fn">NHL: Îp = înfrângeri în prelungiri, Pct = puncte. MLS: E = egaluri. Serie: V = victorii la rând, Î = înfrângeri, E = egaluri. Apasă pe o echipă pentru pagina ei.</div>';
}

/* ---------- all teams ---------- */
export function teamsHtml(standings, chosen, ctx) {
  const out = L_ORDER.filter(l => chosen.has(l) && standings?.[l]?.length).map(l => {
    const teams = standings[l].flatMap(g => g.entries).slice().sort((a, b) => a.name.localeCompare(b.name));
    return `<section class="lgblock"><h3><span class="ldot" style="--c:${ctx.col(l)}"></span>${L_NAME[l]} <small>${teams.length} echipe</small></h3><div class="tgrid">${teams.map(e => {
      const k = ctx.flKey(l, e.name);
      return `<button class="tcard${k ? ' fl' : ''}" type="button" ${k ? `data-team="${k}"` : `data-club="${l}|${esc(e.id)}"`}>${ctx.emb({ ...e, key: k }, 'lg')}<span><b>${esc(e.name)}</b><small>${e.w ?? 0}–${e.l ?? 0}${l === 'NHL' ? '–' + (e.otl ?? 0) : l === 'MLS' ? '–' + (e.t ?? 0) : ''}${k ? ' · ★ ' + esc(HOME.name) : ''}</small></span></button>`;
    }).join('')}</div></section>`;
  });
  return out.join('') || '<div class="empty">Lista echipelor nu e disponibilă acum.</div>';
}

/* ---------- Europe and the big days of the season (/api/world) ---------- */
export const COUNTRY_RO = { England: 'Anglia', Scotland: 'Scoția', Wales: 'Țara Galilor', Ireland: 'Irlanda', 'United Kingdom': 'Marea Britanie', Germany: 'Germania', Spain: 'Spania',
  France: 'Franța', Italy: 'Italia', Sweden: 'Suedia', Finland: 'Finlanda', Norway: 'Norvegia', Denmark: 'Danemarca', Czechia: 'Cehia', 'Czech Republic': 'Cehia', Switzerland: 'Elveția',
  Austria: 'Austria', Netherlands: 'Țările de Jos', Belgium: 'Belgia', Portugal: 'Portugalia', Poland: 'Polonia', Hungary: 'Ungaria', Slovakia: 'Slovacia', Latvia: 'Letonia', Romania: 'România',
  Mexico: 'Mexic', Brazil: 'Brazilia', Japan: 'Japonia', Australia: 'Australia', 'Puerto Rico': 'Puerto Rico', 'Dominican Republic': 'Republica Dominicană', 'South Korea': 'Coreea de Sud' };
export const countryRo = c => COUNTRY_RO[c] || c;
// What each kind of big day is, for someone new to American sports.
export const EVENT_RO = [
  [/thanksgiving/, () => 'Thanksgiving: NFL de Ziua Recunoștinței', 'Tradiție din 1934: Detroit Lions și Dallas Cowboys joacă acasă în fiecare an, iar seara e încă un meci. Trei meciuri într-o zi, de seara până noaptea, ora României.'],
  [/christmas/, () => 'Crăciunul în NBA și NFL', 'Cea mai urmărită zi a sezonului regulat în NBA: cele mai mari echipe joacă una după alta, toată ziua și toată noaptea. De câțiva ani joacă și NFL.'],
  [/super bowl/i, t => t, 'Finala NFL: cel mai urmărit eveniment sportiv din SUA, cu spectacolul de la pauză. În România se joacă noaptea, în jurul orei 01:30.'],
  [/winter classic/i, t => t, 'Meci NHL în aer liber, pe un stadion mare, în prima zi a anului: hochei ca pe vremuri, pe zăpadă.'],
  [/stadium series/i, () => 'NHL Stadium Series', 'Meci NHL în aer liber, pe un stadion de fotbal american, cu zeci de mii de spectatori.'],
  [/heritage classic/i, t => t, 'Meciul NHL în aer liber din Canada.'],
  [/all-?star/i, t => t, 'Meciul vedetelor: cei mai buni jucători ai sezonului, aleși de fani, în același meci.'],
  [/./, t => t, '']
];
export function eventInfo(e) {
  const key = e.kind === 'special' ? e.title : e.kind;
  const [, title, text] = EVENT_RO.find(([re]) => re.test(key));
  return { title: title(e.title || ''), text };
}
const wrow = (g, ctx) => `<button class="row" type="button" data-game="${esc(g.id)}"><span class="when">${esc(ctx.dayOf(g.d))}</span><span><span class="ldot" style="--c:${ctx.col(g.l)}"></span>${g.l} · ${g.A.name === g.H.name && /stabilit/.test(g.H.name) ? 'echipele se decid în playoff' : `${esc(g.A.name)} – ${esc(g.H.name)}`}${g.raw?.country ? ` <small>${esc(g.v || '')}, ${esc(g.raw.city || '')} (${esc(countryRo(g.raw.country))})</small>` : ''}</span><span class="r">${g.state === 'pre' ? (g.tbd ? 'oră neanunțată' : esc(ctx.ro(g.d))) : ctx.sp(g.id, `${g.as ?? 0}–${g.hs ?? 0}`)}</span></button>`;
export function worldHtml(data, chosen, ctx) {
  if (!data) return '<div class="skeleton" style="height:240px"></div>';
  if (data._err) return '<div class="empty">Lista nu a putut fi încărcată. Încearcă din nou mai târziu.</div>';
  const pick = list => list.filter(g => chosen.has(g.l));
  const eu = pick(data.abroad.filter(g => g.raw?.europe)), rest = pick(data.abroad.filter(g => !g.raw?.europe));
  const events = data.events.map(e => ({ ...e, games: pick(e.games) })).filter(e => e.games.length);
  return `<section class="lgblock"><h3>Meciuri în Europa</h3>
      <p class="lead">Ligile americane joacă în fiecare sezon câteva meciuri în Europa: la ore bune pentru România și, uneori, la două ore de zbor de București.</p>
      ${eu.length ? `<div class="rows">${eu.map(g => wrow(g, ctx)).join('')}</div>` : '<div class="empty">Niciun meci în Europa în următoarele luni.</div>'}
      ${rest.length ? `<h3 style="margin-top:18px">Și în restul lumii</h3><div class="rows">${rest.map(g => wrow(g, ctx)).join('')}</div>` : ''}
    </section>
    <section class="lgblock"><h3>Evenimentele sezonului</h3>
      ${events.length ? `<div class="evgrid">${events.map(e => { const i = eventInfo(e); return `<div class="evcard"><div class="k">${esc(ctx.dayOf(e.games[0].d))}</div><h4>${esc(i.title)}</h4>${i.text ? `<p>${esc(i.text)}</p>` : ''}<div class="rows">${e.games.map(g => wrow(g, ctx)).join('')}</div></div>`; }).join('')}</div>` : '<div class="empty">Niciun eveniment special în următoarele luni.</div>'}
    </section>
    <div class="fn">Lista se face singură din programul ligilor, pentru următoarele patru luni. Orele sunt ale României.</div>`;
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

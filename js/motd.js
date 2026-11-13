// "Meciul zilei pentru România": the one game of the day most worth watching from Romania, with the reasons.
// Pure (no DOM): the page passes the day's games and a way to read the standings; the tests call it too.
//   pickMotd(games, { entry(l, name), rivals(g), now }) -> { g, score, reasons: [text] } | null
// A game: { l, d: Date, state, H: { name, key }, A, note, tv, mine: [team keys] }.

const roHour = d => {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bucharest', hour: '2-digit', minute: '2-digit', hour12: false }).format(d).split(':').map(Number);
  return (h % 24) + m / 60;
};
// How strong a team is this season, 0–1: win share (NBA, NFL, MLB), points share (NHL, MLS).
export function strength(e, l) {
  if (!e) return null;
  const w = e.w || 0, lo = e.l || 0, otl = e.otl || 0, t = e.t || 0, gp = w + lo + otl + t;
  if (!gp) return null;
  if (l === 'NHL') return (e.pts ?? 2 * w + otl) / (2 * gp);
  if (l === 'MLS') return (e.pts ?? 3 * w + t) / (3 * gp);
  return e.pct ?? w / gp;
}
const NATIONAL = /\b(ESPN|ABC|TNT|NBC|CBS|FOX|Prime Video|Peacock|NFL Network|TBS|Apple TV)\b/i;
const PLAYOFF = /playoff|round|wild card|semifinal|final|play-in|championship|super bowl/i;
// Romanian time: 19:00–00:30 is the evening to watch; until 02:00 still possible; later is the night.
export const watchable = d => { const h = roHour(d); return h >= 18 && h <= 23.99 ? 2 : h < 2 ? 1 : 0; };

export function scoreGame(g, { entry = () => null, rivals = () => false } = {}) {
  const eh = entry(g.l, g.H.name), ea = entry(g.l, g.A.name);
  const sh = strength(eh, g.l), sa = strength(ea, g.l);
  const known = sh != null && sa != null;
  const reasons = [];
  let score = 0;
  if (g.mine?.length) {
    const s = [g.H, g.A].find(x => g.mine.includes(x.key) || g.mine.includes(`${g.l}-${x.id}`));
    score += 30; reasons.push({ w: 30, t: s ? `Joacă ${s.name}, una dintre echipele tale.` : 'Joacă una dintre echipele tale.' });
  }
  if (PLAYOFF.test(g.note || '')) { score += 25; reasons.push({ w: 25, t: 'Meci de playoff.' }); }
  if (known) {
    const avg = (sh + sa) / 2, close = 1 - Math.min(1, Math.abs(sh - sa) * 2.5);
    score += avg * 40 + close * 15;
    const rank = e => (e?.seed ?? e?.order) ? `locul ${e.seed ?? e.order}${e.conf ? ' în ' + e.conf : ''}` : '';
    const rec = e => [e.w, e.l].concat(g.l === 'NHL' ? [e.otl ?? 0] : g.l === 'MLS' ? [e.t ?? 0] : []).join('–');
    if (sh >= 0.6 && sa >= 0.6) reasons.push({ w: 20, t: `Două echipe de top: ${g.H.name} (${rec(eh)}${rank(eh) ? ', ' + rank(eh) : ''}) și ${g.A.name} (${rec(ea)}${rank(ea) ? ', ' + rank(ea) : ''}).` });
    else if (close > 0.75 && avg >= 0.45) reasons.push({ w: 10, t: `Echipe apropiate ca formă: ${rec(eh)} și ${rec(ea)}.` });
  }
  if (rivals(g)) { score += 8; reasons.push({ w: 8, t: 'Rivale de divizie: meciul contează direct în clasament.' }); }
  if (NATIONAL.test(g.tv || '')) { score += 5; reasons.push({ w: 5, t: `Transmis național în SUA (${g.tv.split(/[,/]/)[0].trim()}).` }); }
  if (g.l === 'NFL') score += 10;   // 17 games a season: every NFL game counts
  const w = watchable(g.d);
  score += w === 2 ? 14 : w === 1 ? 6 : 0;
  return { g, score, reasons: reasons.sort((a, b) => b.w - a.w).map(r => r.t), watch: w };
}

// The best game of one day's games: an evening one when there is any. Finished games stay candidates, so the
// pick holds all day (once played, the page shows its result, covered in "Fără spoilere").
export function pickMotd(games, opts = {}) {
  const list = games.filter(g => !g.tbd && g.d && !/postponed|canceled|cancelled/i.test(g.detail || ''));
  if (!list.length) return null;
  const scored = list.map(g => scoreGame(g, opts)).sort((a, b) => b.score - a.score || a.g.d - b.g.d);
  return scored.find(x => x.watch) || scored[0];
}

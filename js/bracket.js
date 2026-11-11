// Playoff bracket from /api/playoffs: games grouped into series (round + pair of teams), wins counted.
// Pure: tested in Node. app.js draws it with the emblems and seeds it has.
const ROUND_RO = { 1: 'Wild card / play-in', 2: 'Runda 1', 3: 'Semifinale', 4: 'Finala conferinței', 5: 'Finala' };
const CONF_RO = { east: 'Conferința de Est', west: 'Conferința de Vest', afc: 'AFC', nfc: 'NFC', '': '' };
export const roundRo = (stage, l) => (l === 'NFL' && stage === 3 ? 'Runda divizională' : l === 'NFL' && stage === 5 ? 'Super Bowl' : l === 'MLS' && stage === 5 ? 'MLS Cup' : l === 'NHL' && stage === 5 ? 'Finala Cupei Stanley' : ROUND_RO[stage] || 'Playoff');
export const confRo = c => CONF_RO[c] ?? c;
const isTbd = s => /^tbd\b/i.test(s.name || '') || !s.name;

export function buildSeries(games) {
  const by = new Map();
  for (const g of games) {
    const r = g.round || {};
    const names = [g.home, g.away].map(s => (isTbd(s) ? 'TBD' : s.name));
    const key = `${r.conf}|${r.stage}|${[...names].sort().join('~')}`;
    let s = by.get(key);
    if (!s) {
      s = { key, conf: r.conf || '', stage: r.stage || 0, teams: [g.home, g.away].map(t => ({ ...t, name: isTbd(t) ? 'De stabilit' : t.name, tbd: isTbd(t), wins: 0 })), games: [] };
      by.set(key, s);
    }
    s.games.push(g);
    if (g.state === 'post' && g.home.score != null && g.away.score != null && g.home.score !== g.away.score) {
      const winner = g.home.score > g.away.score ? g.home : g.away;
      const t = s.teams.find(x => x.name === winner.name); if (t) t.wins++;
    }
  }
  const series = [...by.values()];
  for (const s of series) {
    // A series is over when nothing is left to play in it.
    s.done = s.games.every(g => g.state === 'post' || /postponed|canceled|cancelled/i.test(g.detail || ''));
    s.next = s.games.find(g => g.state !== 'post') || null;
    s.winner = s.done && s.teams[0].wins !== s.teams[1].wins ? (s.teams[0].wins > s.teams[1].wins ? s.teams[0] : s.teams[1]) : null;
  }
  return series;
}

// [{ conf, rounds: [{ stage, series: [...] }] }], conferences first, then the final.
export function bracketLayout(series) {
  const confs = [...new Set(series.map(s => (s.stage === 5 ? '' : s.conf)))].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)));
  return confs.map(conf => {
    const mine = series.filter(s => (s.stage === 5 ? '' : s.conf) === conf);
    const stages = [...new Set(mine.map(s => s.stage))].sort((a, b) => a - b);
    return { conf, rounds: stages.map(stage => ({ stage, series: mine.filter(s => s.stage === stage) })) };
  }).filter(b => b.rounds.length);
}

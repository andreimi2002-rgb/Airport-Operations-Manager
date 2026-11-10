// Offline checks for the ESPN readers. Run: node tools/test.mjs
// Fixtures follow the shape of ESPN's public site API; the real thing is checked on the deploy preview.
import assert from 'node:assert/strict';
import { normalizeEvent, normalizeStandings, normalizeSummary } from '../netlify/lib/espn.mjs';

const ev = {
  id: '401810123', date: '2026-11-15T18:00Z', week: { number: 10 }, seasonType: { type: 2 },
  competitions: [{
    timeValid: true,
    venue: { fullName: 'Lucas Oil Stadium', address: { city: 'Indianapolis', state: 'IN' } },
    competitors: [
      { homeAway: 'home', team: { id: '11', abbreviation: 'IND', displayName: 'Indianapolis Colts', color: '003b75', logos: [{ href: 'https://a.espncdn.com/i/teamlogos/nfl/500/ind.png', rel: ['full', 'default'] }, { href: 'https://a.espncdn.com/i/teamlogos/nfl/500-dark/ind.png', rel: ['full', 'dark'] }] }, score: { value: 21, displayValue: '21' } },
      { homeAway: 'away', team: { id: '15', abbreviation: 'MIA', displayName: 'Miami Dolphins', logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/mia.png' }, score: '17' }
    ],
    status: { type: { state: 'post', completed: true, shortDetail: 'Final' } },
    broadcasts: [{ names: ['CBS'] }]
  }]
};
const g = normalizeEvent(ev, 'NFL', { 'NFL:15': 'dolphins', 'NBA:11': 'heat' });
assert.equal(g.home.key, null, 'an id from another league must not match');
assert.equal(g.home.name, 'Indianapolis Colts');
assert.equal(g.home.logoDark, 'https://a.espncdn.com/i/teamlogos/nfl/500-dark/ind.png');
assert.equal(g.away.key, 'dolphins');
assert.equal(g.away.logo, 'https://a.espncdn.com/i/teamlogos/nfl/500/mia.png');
assert.equal(g.home.score, 21); assert.equal(g.away.score, 17);
assert.equal(g.state, 'post'); assert.equal(g.note, 'Etapa 10'); assert.equal(g.region, 'IN'); assert.equal(g.tv, 'CBS');
assert.equal(normalizeEvent({ id: 1 }, 'NBA'), null);

const st = normalizeStandings({
  children: [{
    name: 'Eastern Conference', abbreviation: 'East',
    standings: { entries: [{
      team: { id: '26', displayName: 'Florida Panthers', abbreviation: 'FLA', logos: [{ href: 'x.png' }] },
      stats: [
        { name: 'wins', value: 9 }, { name: 'losses', value: 7 }, { name: 'otLosses', value: 2 }, { name: 'points', value: 20 },
        { name: 'playoffSeed', value: 8 }, { name: 'streak', displayValue: 'L2' },
        { name: 'Home', type: 'home', summary: '4-2-1' }, { name: 'Road', type: 'road', summary: '5-5-1' }
      ]
    }] }
  }]
});
const p = st[0].entries[0];
assert.deepEqual([p.w, p.l, p.otl, p.pts, p.seed, p.streak, p.home, p.away], [9, 7, 2, 20, 8, 'L2', '4-2-1', '5-5-1']);

const sm = normalizeSummary({
  header: { competitions: [{ status: { type: { state: 'post', shortDetail: 'Final' } }, competitors: [
    { homeAway: 'home', team: { displayName: 'Sacramento Kings' }, score: '108', linescores: [{ displayValue: '30' }, { displayValue: '29' }, { displayValue: '22' }, { displayValue: '27' }] },
    { homeAway: 'away', team: { displayName: 'Miami Heat' }, score: '114', linescores: [{ displayValue: '34' }, { displayValue: '34' }, { displayValue: '23' }, { displayValue: '23' }] }
  ] }] },
  leaders: [{ team: { displayName: 'Miami Heat' }, leaders: [{ name: 'points', displayName: 'Points', leaders: [{ displayValue: '29', athlete: { displayName: 'Giannis Antetokounmpo' } }] }] }],
  keyEvents: [{ type: { text: 'Goal' }, scoringPlay: true, clock: { displayValue: "14'" }, team: { displayName: 'Inter Miami CF' }, participants: [{ athlete: { displayName: 'Lionel Messi' } }] }],
  predictor: { homeTeam: { gameProjection: '55.1' }, awayTeam: { gameProjection: '44.9' } },
  gameInfo: { attendance: 17611 }
}, 'NBA');
assert.deepEqual(sm.home.lines, [30, 29, 22, 27]); assert.equal(sm.away.score, 114);
assert.equal(sm.leaders[0].items[0].who, 'Giannis Antetokounmpo');
assert.equal(sm.predictor.home, 55.1); assert.equal(sm.attendance, 17611);
// Missing sections come back empty, never undefined.
assert.deepEqual([sm.box, sm.teamStats, sm.wp, sm.injuries, sm.last5, sm.videos, sm.goalies], [[], [], [], [], [], [], []]);
assert.equal(sm.series, null);

// Full game summary: players, team stats, win probability, injuries, history, clips.
const hdr = { competitions: [{ status: { type: { state: 'post' } }, competitors: [
  { homeAway: 'home', team: { id: '23', displayName: 'Sacramento Kings', abbreviation: 'SAC' }, score: '108' },
  { homeAway: 'away', team: { id: '14', displayName: 'Miami Heat', abbreviation: 'MIA' }, score: '114' }
] }] };
const full = normalizeSummary({
  header: hdr,
  boxscore: {
    players: [{ team: { id: '14' }, statistics: [{ keys: ['minutes', 'points'], athletes: [
      { athlete: { displayName: 'Bam Adebayo', jersey: '13', position: { abbreviation: 'C' } }, starter: true, stats: ['34', '18'] },
      { athlete: { displayName: 'Nikola Jovic' }, didNotPlay: true, reason: "COACH'S DECISION", stats: [] }
    ], totals: ['', '114'] }] }],
    teams: [{ team: { id: '23' }, statistics: [{ name: 'fieldGoalPct', label: 'FG%', displayValue: '47' }] },
      { team: { id: '14' }, statistics: [{ name: 'fieldGoalPct', label: 'FG%', displayValue: '52' }] }]
  },
  winprobability: [{ homeWinPercentage: 0.535, playId: '1' }, { homeWinPercentage: 0.2, playId: '2' }, { homeWinPercentage: 0, playId: '3' }],
  plays: [{ id: '1', period: { number: 1 } }, { id: '2', period: { number: 2 } }, { id: '3', period: { number: 4 } }],
  injuries: [{ team: { id: '14' }, injuries: [{ status: 'Day-To-Day', athlete: { displayName: 'Giannis Antetokounmpo', position: { abbreviation: 'F' } }, details: { type: 'Wrist', side: 'Right', detail: 'Sprain', returnDate: '2026-11-10' } }] }],
  seasonseries: [{ title: 'Regular Season Series', events: [{ id: '9', date: '2026-11-09T02:00Z', statusType: { state: 'post' }, competitors: [
    { homeAway: 'home', team: { id: '23', abbreviation: 'SAC' }, score: '108' }, { homeAway: 'away', team: { id: '14', abbreviation: 'MIA' }, score: '114' }] }] }],
  lastFiveGames: [{ team: { id: '14' }, events: [{ id: '5', gameDate: '2026-11-05T02:00Z', atVs: '@', gameResult: 'W', homeTeamId: '12', homeTeamScore: '116', awayTeamScore: '117', opponent: { displayName: 'LA Clippers', abbreviation: 'LAC' } }] }],
  videos: [
    { headline: 'Highlights', duration: 74, thumbnail: 'https://espnmedia-cdn.akamaized.net/a.jpg', links: { source: { href: 'https://espnmedia-cdn.akamaized.net/a.mp4' } } },
    { headline: 'Elsewhere', links: { source: { href: 'https://evil.example/x.mp4' } } }
  ]
}, 'NBA');
const heat = full.box.find(b => b.side === 'away');
assert.equal(heat.groups[0].rows[0].n, 'Bam Adebayo'); assert.deepEqual(heat.groups[0].rows[0].v, ['34', '18']);
assert.equal(heat.groups[0].rows[1].dnp, true); assert.equal(heat.groups[0].tot[1], '114');
assert.deepEqual(full.teamStats, [{ k: 'fieldGoalPct', label: 'FG%', h: '47', a: '52' }]);
assert.deepEqual(full.wp, [[53.5, 1], [20, 2], [0, 4]]);
assert.equal(full.injuries[0].side, 'away'); assert.equal(full.injuries[0].items[0].what, 'Wrist');
assert.equal(full.series.games[0].home.score, 108);
assert.deepEqual([full.last5[0].side, full.last5[0].games[0].res, full.last5[0].games[0].mine, full.last5[0].games[0].their, full.last5[0].games[0].at], ['away', 'V', 117, 116, true]);
assert.equal(full.videos.length, 1, 'clips from other hosts are dropped');

// NHL goals with assists, NFL scoring plays, soccer cards and line-ups.
const nhl = normalizeSummary({ header: hdr, plays: [{ scoringPlay: true, period: { number: 2 }, clock: { displayValue: '1:53' }, team: { id: '23' }, strength: { text: 'Power Play' }, homeScore: 1, awayScore: 0,
  participants: [{ type: 'scorer', athlete: { displayName: 'Cole Perfetti' } }, { type: 'assister', athlete: { displayName: 'Mark Scheifele' } }] }] }, 'NHL');
assert.deepEqual([nhl.plays[0].who, nhl.plays[0].ast, nhl.plays[0].pp, nhl.plays[0].side], ['Cole Perfetti', ['Mark Scheifele'], true, 'home']);
const nfl = normalizeSummary({ header: hdr, scoringPlays: [{ type: { abbreviation: 'TD' }, text: 'X 3 Yd Run (Y Kick)', period: { number: 1 }, clock: { displayValue: '9:38' }, team: { id: '14' }, homeScore: 0, awayScore: 7 }] }, 'NFL');
assert.deepEqual([nfl.plays[0].kind, nfl.plays[0].side, nfl.plays[0].as], ['TD', 'away', 7]);
const mls = normalizeSummary({ header: hdr,
  keyEvents: [{ type: { text: 'Yellow Card' }, clock: { displayValue: "9'" }, team: { id: '23' }, participants: [{ athlete: { displayName: 'A' } }] },
    { type: { text: 'Goal - Volley' }, scoringPlay: true, clock: { displayValue: "90'" }, team: { id: '14' }, participants: [{ athlete: { displayName: 'B' } }, { athlete: { displayName: 'C' } }] },
    { type: { text: 'Substitution' }, clock: { displayValue: "60'" } }],
  rosters: [{ homeAway: 'home', formation: '4-3-3', roster: [
    { starter: true, athlete: { displayName: 'Keeper' }, position: { abbreviation: 'G' }, stats: [{ name: 'goalsConceded', displayValue: '3' }] },
    { starter: false, subbedIn: false, athlete: { displayName: 'Unused' }, stats: [] }] }] }, 'MLS');
assert.deepEqual(mls.plays.map(p => p.kind), ['yc', 'goal']); assert.deepEqual(mls.plays[1].ast, ['C']);
assert.equal(mls.box[0].formation, '4-3-3'); assert.equal(mls.box[0].groups[0].rows.length, 1, 'unused substitutes are left out');
// A broken section does not break the rest.
const broken = normalizeSummary({ header: hdr, boxscore: { players: 'nonsense' }, injuries: [null], leaders: [{ team: { displayName: 'T' }, leaders: [] }] }, 'NBA');
assert.deepEqual([broken.box, broken.injuries], [[], []]);

// Romanian wording of ESPN strings.
const ro = await import('../js/ro.js');
assert.equal(ro.detailRo('7:21 - 3rd', 'NBA'), 'Sfertul 3 · 7:21');
assert.equal(ro.detailRo('12:01 - 2nd', 'NHL'), 'Repriza 2 · 12:01');
assert.equal(ro.detailRo('Final/OT', 'NBA'), 'Final după prelungiri');
assert.equal(ro.detailRo('Final/SO', 'NHL'), 'Final după lovituri de departajare');
assert.equal(ro.detailRo('HT', 'MLS'), 'Pauză');
assert.equal(ro.detailRo('End of 2nd Period', 'NHL'), 'Finalul reprizei 2');
assert.equal(ro.detailRo("67'", 'MLS'), "67'");
assert.equal(ro.detailRo('Something new', 'NBA'), 'Something new', 'unknown wording is kept');
assert.equal(ro.noteRo('NBA Cup - Group Play'), 'Cupa NBA · faza grupelor');
assert.equal(ro.nflPlayRo('Bucky Irving 2 Yd Rush (Chase McLaughlin Kick)'), 'Bucky Irving, alergare de 2 yarzi (transformare Chase McLaughlin)');
assert.equal(ro.bodyRo('Ankle', 'Sprain', 'Right'), 'gleznă (partea dreaptă), entorsă');
assert.equal(ro.statNum('7-13', 'ratio'), 7 / 13); assert.equal(ro.statNum('31:15', 'clock'), 1875); assert.equal(ro.statNum('0.9', 'pct'), 90);
assert.equal(ro.boxCols('NHL', 'forwards'), ro.boxCols('NHL', 'defenses'));

console.log('all ESPN reader checks passed');

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
assert.equal(sm.goals[0].who, 'Lionel Messi');
assert.equal(sm.predictor.home, 55.1); assert.equal(sm.attendance, 17611);

console.log('all ESPN reader checks passed');

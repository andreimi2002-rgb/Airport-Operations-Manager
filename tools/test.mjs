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
// Soccer venues have no state: a Florida team at home counts as Florida, an away game does not.
const soccer = (homeId, neutral) => normalizeEvent({ id: '9', date: '2026-11-21T23:00Z', competitions: [{ neutralSite: neutral, venue: { fullName: 'Nu Stadium', address: { country: 'USA' } },
  competitors: [{ homeAway: 'home', team: { id: homeId, displayName: 'H' } }, { homeAway: 'away', team: { id: '2', displayName: 'A' } }], status: { type: { state: 'pre' } } }] }, 'MLS', { 'MLS:20232': 'intermiami' });
assert.equal(soccer('20232', false).region, 'FL');
assert.equal(soccer('20232', true).region, 'USA');
assert.equal(soccer('183', false).region, 'USA');

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
assert.equal(ro.leaderValRo('Matches: 31, Goals: 26'), '26 de goluri în 31 de meciuri');
assert.equal(ro.leaderValRo('Matches: 14, Goals: 6'), '6 goluri în 14 meciuri');
assert.equal(ro.leaderValRo('Matches: 30, Assists: 1'), '1 pasă decisivă în 30 de meciuri');
assert.equal(ro.leaderValRo('21.4'), '21.4');

// Weather: Open-Meteo answer -> page format; the Florida check of the weather function.
const wx = await import('../netlify/lib/weather.mjs');
const f = wx.normalizeForecast({ latitude: 25.96, longitude: -80.24,
  current: { time: '2026-11-10T19:00', temperature_2m: 26.04, apparent_temperature: 30.5, relative_humidity_2m: 83, weather_code: 0, wind_speed_10m: 7.2, wind_gusts_10m: 16, precipitation: 0, is_day: 0 },
  daily: { time: ['2026-11-10'], weather_code: [3], temperature_2m_max: [30], temperature_2m_min: [22.5], precipitation_probability_max: [6], precipitation_sum: [0], sunrise: ['2026-11-10T06:35'], sunset: ['2026-11-10T17:33'], uv_index_max: [5.9], wind_speed_10m_max: [14] },
  hourly: { time: ['2026-11-10T19:00', '2026-11-10T20:00'], temperature_2m: [26, 25.3], weather_code: [0, 95], precipitation_probability: [1, 70] } });
assert.deepEqual([f.now.temp, f.now.wind, f.now.day, f.days[0].hi, f.hours.code[1], f.hours.pp[1], f.hours.gust.length], [26, 7, false, 30, 95, 70, 0]);
assert.equal(wx.normalizeForecast({ current: {} }, true).hours, undefined);
assert.equal(wx.inFlorida(25.78, -80.19), true); assert.equal(wx.inFlorida(40.7, -74), false);
const pl = await import('../js/places.js');
assert.equal(pl.nyHourKey(new Date('2026-11-15T18:00:00Z')), '2026-11-15T13:00');
assert.equal(pl.nyHourKey(new Date('2026-07-04T23:30:00Z')), '2026-07-04T19:00');
assert.equal(pl.hoursBehindRomania(new Date('2026-11-15T12:00:00Z')), 7);
assert.equal(pl.hoursBehindRomania(new Date('2026-03-20T12:00:00Z')), 6, 'US clocks change three weeks before Europe');

// Calendar feed (.ics).
const ics = await import('../js/ics.js');
const G = (id, date, extra = {}) => ({ id, l: 'NBA', date, tbd: false, state: 'pre', detail: '', venue: 'Kaseya Center', city: 'Miami', region: 'FL', note: 'NBA Cup - Group Play', tv: 'NBA TV',
  home: { name: 'Miami Heat', key: 'heat', score: null }, away: { name: 'Boston Celtics, Inc; test', key: null, score: null }, ...extra });
const feed = ics.calendar([G('1', '2026-11-15T01:00:00Z'), G('2', '2026-11-20T00:00:00Z', { tbd: true }), G('3', '2026-11-01T00:00:00Z', { state: 'post', home: { name: 'Miami Heat', key: 'heat', score: 114 }, away: { name: 'Boston Celtics', key: null, score: 108 } })],
  { name: 'Meciuri: Heat', site: 'https://x.example', alarm: 60, stamp: new Date('2026-11-11T00:00:00Z') });
assert.ok(feed.startsWith('BEGIN:VCALENDAR\r\n') && feed.endsWith('END:VCALENDAR\r\n'));
const flat = feed.replace(/\r\n /g, '');   // undo line folding before looking for text
assert.ok(flat.includes('Final: 114–108') && flat.includes('Detalii: https://x.example/#meci/NBA/1'));
assert.equal(feed.match(/BEGIN:VEVENT/g).length, 3);
assert.ok(feed.includes('DTSTART:20261115T010000Z') && feed.includes('DTEND:20261115T033000Z'), 'UTC start, end after the league duration');
assert.ok(feed.includes('DTSTART;VALUE=DATE:20261119') && feed.includes('DTEND;VALUE=DATE:20261120'), 'no time yet: all-day event on the US date');
assert.ok(flat.includes('Celtics\\, Inc\\; test'), 'commas and semicolons escaped');
assert.ok(feed.includes('TRIGGER:-PT60M'));
assert.equal(feed.match(/TRIGGER/g).length, 1, 'reminder only for a timed game still to come');

assert.ok(feed.split('\r\n').every(l => new TextEncoder().encode(l).length <= 75), 'lines folded at 75 octets');
assert.ok(ics.fold('x'.repeat(200)).split('\r\n ').length === 3);
assert.deepEqual(ics.pick([G('a', '2026-11-15T00:00:00Z'), G('b', '2026-01-01T00:00:00Z'), { ...G('c', '2026-11-15T00:00:00Z'), home: { key: null }, away: { key: 'magic' } }], ['heat'], 45, Date.parse('2026-11-11')).map(g => g.id), ['a']);

// Web Push: a message encrypted for a browser decrypts with that browser's keys; VAPID signature verifies.
{
  const crypto = await import('node:crypto');
  const wp = await import('../netlify/lib/webpush.mjs');
  const ua = crypto.createECDH('prime256v1'); ua.generateKeys();
  const auth = crypto.randomBytes(16).toString('base64url');
  const keys = { p256dh: ua.getPublicKey().toString('base64url'), auth };
  const msg = JSON.stringify({ title: '🏀 Heat – Celtics într-o oră', body: 'ăîșț' });
  const body = wp.encrypt(msg, keys);
  assert.equal(body.readUInt32BE(16), 4096); assert.equal(body[20], 65);
  assert.equal(wp.decrypt(body, ua, auth), msg);
  const v = wp.generateVapidKeys();
  const head = wp.vapidHeader('https://fcm.googleapis.com/fcm/send/abc', { ...v, subject: 'https://x.example' });
  const claims = wp.verifyVapid(head, v.publicKey);
  assert.equal(claims.aud, 'https://fcm.googleapis.com'); assert.equal(claims.sub, 'https://x.example');
  assert.ok(head.endsWith('k=' + v.publicKey));
  assert.equal(wp.validSubscription({ endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys }), true);
  assert.equal(wp.validSubscription({ endpoint: 'https://evil.example/x', keys }), false, 'only known push services');
  assert.equal(wp.validSubscription({ endpoint: 'https://web.push.apple.com/x', keys: { p256dh: 'abc', auth } }), false);
}

// Which notifications are due.
{
  const nt = await import('../netlify/lib/notify.mjs');
  const now = Date.parse('2026-11-14T23:30:00Z');
  const game = (id, startMin, extra = {}) => ({ id, l: 'NBA', date: new Date(now + startMin * 6e4).toISOString(), tbd: false, state: 'pre', detail: '', venue: 'Kaseya Center', tv: 'NBA TV',
    home: { name: 'Miami Heat', key: 'heat', score: null }, away: { name: 'Cleveland Cavaliers', key: null, score: null }, ...extra });
  const sub = { id: 's', teams: ['heat'], lead: 60, final: true, created: now - 864e5, sent: {} };
  const games = [game('a', 45), game('b', 90), game('c', 30, { tbd: true }), game('d', -150, { state: 'post', detail: 'Final/OT', home: { name: 'Miami Heat', key: 'heat', score: 120 }, away: { name: 'Cleveland Cavaliers', key: null, score: 118 } }),
    game('e', 20, { home: { name: 'Orlando Magic', key: 'magic' } })];
  const d = nt.due(sub, games, now, 'https://x.example');
  assert.deepEqual(d.map(x => x.kind + x.game.id), ['pa', 'fd']);
  assert.equal(d[0].message.title, '🏀 Heat – Cleveland Cavaliers în 45 de minute');
  assert.ok(d[0].message.body.startsWith('Start la 02:15, ora României'));
  assert.equal(d[1].message.title, 'Final: Heat 120–118 Cleveland Cavaliers');
  assert.ok(d[1].message.body.startsWith('Victorie pentru Heat · după prelungiri'));
  assert.equal(d[0].message.url, 'https://x.example/#meci/NBA/a');
  const after = nt.markSent(sub, d, now);
  assert.deepEqual(nt.due(after, games, now + 5 * 6e4, 'https://x.example'), [], 'nothing is sent twice');
  assert.deepEqual(nt.due({ ...sub, created: now }, games, now, 'x').map(x => x.kind), ['p'], 'no old finals for a new subscriber');
  assert.deepEqual(nt.due({ ...sub, lead: 0, final: false }, games, now, 'x'), []);
  assert.equal(nt.inTime(60), 'într-o oră'); assert.equal(nt.inTime(10), 'în 10 minute'); assert.equal(nt.inTime(120), 'în 2 ore');
  assert.deepEqual(Object.keys(nt.markSent({ sent: { old: { p: now - 5 * 864e5 } } }, [], now).sent), [], 'old entries forgotten');
}

// Standings: MLS gives a rank instead of a playoff seed.
assert.equal(normalizeStandings({ children: [{ name: 'Eastern Conference', standings: { entries: [{ team: { displayName: 'Inter Miami CF' }, stats: [{ name: 'rank', value: 2 }, { name: 'points', value: 60 }] }] } }] })[0].entries[0].seed, 2);

// Playoffs: rounds from ESPN slugs and notes; series and wins.
{
  const e = await import('../netlify/lib/espn.mjs');
  assert.deepEqual(e.playoffRound({ season: { slug: 'eastern-conference-playoffs---round-one' } }), { conf: 'east', stage: 2, label: 'eastern conference playoffs round one' });
  assert.equal(e.playoffRound({ competitions: [{ notes: [{ headline: 'East 1st Round - Game 3' }] }] }).stage, 2);
  assert.equal(e.playoffRound({ competitions: [{ notes: [{ headline: 'NBA Finals - Game 1' }] }] }).stage, 5);
  assert.equal(e.playoffRound({ competitions: [{ notes: [{ headline: 'AFC Wild Card Playoffs' }] }] }).conf, 'afc');
  const b = await import('../js/bracket.js');
  const pg = (id, h, a, hs, as, state = 'post') => ({ id, date: '2026-11-2' + id + 'T00:00Z', state, detail: '', round: { conf: 'east', stage: 2 }, home: { name: h, score: hs }, away: { name: a, score: as } });
  const s = b.buildSeries([pg('1', 'Inter Miami CF', 'Columbus Crew', 2, 1), pg('2', 'Columbus Crew', 'Inter Miami CF', 1, 0), pg('3', 'Inter Miami CF', 'Columbus Crew', 3, 1), pg('4', 'Nashville SC', 'TBD Away', null, null, 'pre')]);
  assert.equal(s.length, 2);
  const mia = s.find(x => x.teams.some(t => t.name === 'Inter Miami CF'));
  assert.deepEqual([mia.teams.find(t => t.name === 'Inter Miami CF').wins, mia.done, mia.winner.name], [2, true, 'Inter Miami CF']);
  assert.equal(s.find(x => x !== mia).teams[1].name, 'De stabilit');
  assert.equal(b.roundRo(5, 'MLS'), 'MLS Cup');
  assert.equal(b.bracketLayout(s)[0].rounds[0].series.length, 2);
}
assert.equal((await import('../js/teamx.js')).roNum('1,396'), '1.396');
assert.equal((await import('../js/teamx.js')).roNum('.900'), '0,900');
assert.equal((await import('../js/teamx.js')).roNum('27.7'), '27,7');

console.log('all ESPN reader checks passed');

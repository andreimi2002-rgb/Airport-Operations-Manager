// Offline tests for the Netlify functions: each handler is called with a Request, while a fake fetch plays
// ESPN and Open-Meteo (working, failing, or answering in a changed format). No network, no keys.
//   node tools/test-functions.mjs        (also run by: npm test)
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const realFetch = globalThis.fetch;
let routes = [];
// Each route: [substring of the URL, (url) => Response | object (sent as JSON) | Error (thrown)].
globalThis.fetch = async (input, opts) => {
  const url = String(input?.url || input);
  const hit = routes.find(([s]) => url.includes(s));
  if (!hit) throw new Error('no fake route for ' + url);
  const r = await hit[1](url, opts);
  if (r instanceof Error) throw r;
  if (r instanceof Response) return r;
  return new Response(JSON.stringify(r), { headers: { 'content-type': 'application/json' } });
};
const fail = status => () => new Response('{}', { status });
const req = (path, init) => new Request('http://site.test' + path, init);
const body = async r => JSON.parse(await r.text());

// ESPN-shaped samples, cut down to the fields the readers use.
const espnEvent = (id, state, hs, as) => ({
  id, date: '2026-11-12T00:30Z',
  competitions: [{
    venue: { fullName: 'Kaseya Center', address: { city: 'Miami', state: 'FL' } },
    competitors: [
      { homeAway: 'home', team: { id: '14', displayName: 'Miami Heat', abbreviation: 'MIA' }, score: String(hs) },
      { homeAway: 'away', team: { id: '2', displayName: 'Boston Celtics', abbreviation: 'BOS' }, score: String(as) }
    ],
    status: { type: { state, completed: state === 'post', shortDetail: state === 'post' ? 'Final' : '3rd 5:00' } }
  }]
});
const scoreboard = events => ({ leagues: [{ id: '46' }], events });
const standings = { children: [{ name: 'Eastern Conference', standings: { entries: [{ team: { displayName: 'Florida Panthers' }, stats: [{ name: 'wins', value: 10 }] }] } }] };
const meteo = { latitude: 25.78, longitude: -80.19, current: { time: '2026-11-11T19:00', temperature_2m: 24.3, weather_code: 1 }, daily: { time: ['2026-11-11'], temperature_2m_max: [27] } };

let n = 0;
const test = async (name, fn) => { routes = []; await fn(); n++; console.log('ok', name); };

/* ---------- /api/live ---------- */
const live = (await import('../netlify/functions/live.mjs')).default;
await test('live: scores of the asked leagues, unknown leagues ignored', async () => {
  routes = [['basketball/nba/scoreboard', () => scoreboard([espnEvent('401', 'in', 50, 48)])]];
  const r = await live(req('/api/live?l=NBA,XYZ'));
  assert.equal(r.status, 200);
  assert.match(r.headers.get('netlify-cdn-cache-control'), /s-maxage=30/);
  const j = await body(r);
  assert.deepEqual(j.games, [{ id: '401', l: 'NBA', state: 'in', detail: '3rd 5:00', hs: 50, as: 48 }]);
  assert.deepEqual(j.errors, []);
});
await test('live: one league down still gives the others', async () => {
  routes = [['basketball/nba/scoreboard', () => scoreboard([espnEvent('401', 'post', 112, 104)])], ['hockey/nhl/scoreboard', fail(500)]];
  const j = await body(await live(req('/api/live?l=NBA,NHL')));
  assert.equal(j.games.length, 1);
  assert.equal(j.errors.length, 1);
  assert.match(j.errors[0], /500/);
});

/* ---------- /api/health ---------- */
const health = (await import('../netlify/functions/health.mjs')).default;
const sourcesOf = async () => Object.fromEntries((await body(await health(req('/api/health')))).sources.map(s => [s.id, s]));
await test('health: everything answers in the expected format', async () => {
  routes = [['nba/scoreboard', () => scoreboard([espnEvent('1', 'pre', 0, 0)])], ['nhl/standings', () => standings], ['open-meteo', () => meteo]];
  const r = await health(req('/api/health'));
  assert.match(r.headers.get('netlify-cdn-cache-control'), /s-maxage=300/);
  const j = await body(r);
  assert.equal(j.ok, true);
  assert.deepEqual(j.sources.map(s => [s.id, s.ok]), [['espn', true], ['meteo', true]]);
});
await test('health: ESPN down, with an error, or in a changed format', async () => {
  routes = [['nba/scoreboard', fail(503)], ['nhl/standings', () => standings], ['open-meteo', () => meteo]];
  let s = await sourcesOf();
  assert.equal(s.espn.ok, false); assert.equal(s.espn.problem, 'răspunde cu eroare (503)'); assert.equal(s.meteo.ok, true);
  routes = [['nba/scoreboard', () => new Error('timeout')], ['nhl/standings', () => standings], ['open-meteo', () => meteo]];
  assert.equal((await sourcesOf()).espn.problem, 'nu răspunde');
  routes = [['nba/scoreboard', () => ({ sports: [] })], ['nhl/standings', () => standings], ['open-meteo', () => meteo]];
  assert.equal((await sourcesOf()).espn.problem, 'a schimbat formatul scorurilor');
  routes = [['nba/scoreboard', () => scoreboard([])], ['nhl/standings', () => ({ children: [] })], ['open-meteo', () => meteo]];
  assert.equal((await sourcesOf()).espn.problem, 'a schimbat formatul clasamentelor');
  routes = [['nba/scoreboard', () => scoreboard([])], ['nhl/standings', () => standings], ['open-meteo', () => ({ hourly: {} })]];
  s = await sourcesOf();
  assert.equal(s.espn.ok, true); assert.equal(s.meteo.problem, 'a schimbat formatul prognozei');
});
await test('health: the page sentence and the footer line', async () => {
  const h = await import('../js/health.js');
  const data = { checked: '2026-11-12T08:00:00Z', ok: false, sources: [{ id: 'espn', name: 'ESPN', what: 'scoruri', ok: false, problem: 'nu răspunde' }, { id: 'meteo', name: 'Open-Meteo', what: 'vremea', ok: true, problem: '' }] };
  assert.equal(h.healthNote({ data, failed: false }), 'ESPN nu răspunde acum: unele date pot lipsi');
  assert.equal(h.healthNote({ data: { ...data, sources: [data.sources[1]] }, failed: false }), '');
  assert.equal(h.healthNote({ data: null, failed: true }), 'Serverul site-ului nu răspunde acum');
  assert.match(h.sourcesHtml({ data, failed: false }, 2), /2 cereri către ESPN au eșuat/);
});

/* ---------- /api/weather ---------- */
const weather = (await import('../netlify/functions/weather.mjs')).default;
await test('weather: only places in North America, Open-Meteo trimmed', async () => {
  assert.equal((await weather(req('/api/weather?lat=44.43&lon=26.10'))).status, 400, 'Bucharest is not served');
  assert.equal((await weather(req('/api/weather?lat=25.78'))).status, 400);
  routes = [['open-meteo', () => meteo]];
  const j = await body(await weather(req('/api/weather?lat=25.78&lon=-80.19&brief=1')));
  assert.equal(j.places[0].now.temp, 24.3);
  routes = [['open-meteo', fail(500)]];
  assert.equal((await weather(req('/api/weather?lat=25.78&lon=-80.19&brief=1'))).status, 502);
});

/* ---------- /api/calendar.ics ---------- */
const cal = (await import('../netlify/functions/calendar.mjs')).default;
await test('calendar: asks for a team, gives an iCalendar feed', async () => {
  assert.equal((await cal(req('/api/calendar.ics'))).status, 400);
  assert.equal((await cal(req('/api/calendar.ics?e=heat&a=7'))).status, 400, 'reminders from a fixed list');
  assert.equal((await cal(req('/api/calendar.ics?e=constructor'))).status, 400);
  const g = { id: '401', l: 'NBA', date: '2026-11-20T00:30:00Z', tbd: false, state: 'pre', detail: '', venue: 'Kaseya Center', city: 'Miami', region: 'FL', tv: '',
    home: { id: '14', name: 'Miami Heat', abbr: 'MIA', key: 'heat', score: null }, away: { id: '2', name: 'Boston Celtics', abbr: 'BOS', key: null, score: null } };
  routes = [['/api/schedule', () => ({ games: [g] })]];
  const r = await cal(req('/api/calendar.ics?e=heat&a=60'));
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/calendar/);
  const t = await r.text();
  assert.match(t, /X-WR-CALNAME:American Sports Hub: Heat/);
  assert.match(t, /UID:NBA-401@meciuri-florida/, 'event ids stay the same, or subscribed calendars would show each game twice');
  assert.match(t, /BEGIN:VALARM/);
});

/* ---------- /api/push and push-cron ---------- */
const push = (await import('../netlify/functions/push.mjs')).default;
const cron = (await import('../netlify/functions/push-cron.mjs')).default;
const b64u = b => Buffer.from(b).toString('base64url');
const post = (o, raw) => push(req('/api/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw ?? JSON.stringify(o) }), {});
await test('push: off when the site has no keys', async () => {
  delete process.env.VAPID_PUBLIC_KEY; delete process.env.VAPID_PRIVATE_KEY;
  assert.deepEqual(await body(await push(req('/api/push'), {})), { publicKey: null });
  assert.equal((await post({ action: 'get' })).status, 503);
  assert.equal(await (await cron()).text(), 'notifications not configured');
});
await test('push: save, read, delete a subscription', async () => {
  const ec = crypto.createECDH('prime256v1'); ec.generateKeys();
  process.env.VAPID_PUBLIC_KEY = b64u(ec.getPublicKey()); process.env.VAPID_PRIVATE_KEY = b64u(ec.getPrivateKey());
  const user = crypto.createECDH('prime256v1'); user.generateKeys();
  const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/test-' + crypto.randomUUID(), keys: { p256dh: b64u(user.getPublicKey()), auth: b64u(crypto.randomBytes(16)) } };
  assert.equal((await post(null, '{nope')).status, 400);
  assert.equal((await post({ action: 'save', subscription: { endpoint: 'https://evil.example/x', keys: subscription.keys } })).status, 400);
  assert.equal((await body(await post({ action: 'save', subscription, prefs: { teams: ['nope'] } }))).error, 'Alege cel puțin o echipă.');
  const saved = await body(await post({ action: 'save', subscription, prefs: { teams: ['heat', 'NBA-2', 'heat'], lead: 999, final: true } }));
  assert.deepEqual(saved.prefs, { teams: ['heat', 'NBA-2'], lead: 60, final: true, morning: true });
  const off = await body(await post({ action: 'save', subscription, prefs: { teams: ['heat'], lead: 30, final: false, morning: false } }));
  assert.equal(off.prefs.morning, false);
  assert.deepEqual((await body(await post({ action: 'get', subscription }))).prefs, { teams: ['heat'], lead: 30, final: false, morning: false });
  assert.equal((await post({ action: 'delete', subscription })).status, 200);
  assert.equal((await body(await post({ action: 'get', subscription }))).prefs, null);
  delete process.env.VAPID_PUBLIC_KEY; delete process.env.VAPID_PRIVATE_KEY;
});

globalThis.fetch = realFetch;
console.log(`all ${n} function checks passed`);

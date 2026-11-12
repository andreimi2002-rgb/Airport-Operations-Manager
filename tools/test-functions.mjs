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

/* ---------- /api/game ---------- */
const game = (await import('../netlify/functions/game.mjs')).default;
const summaryJ = (state, videos) => ({
  header: { competitions: [{ status: { type: { state, shortDetail: 'Final' } }, competitors: [
    { homeAway: 'home', team: { id: '14', displayName: 'Miami Heat', abbreviation: 'MIA' }, score: '112' },
    { homeAway: 'away', team: { id: '2', displayName: 'Boston Celtics', abbreviation: 'BOS' }, score: '104' }] }] },
  videos
});
const shortClip = (h, host = 'https://media.video-cdn.espn.com') => ({ headline: h, duration: 20, links: { source: { href: host + '/a.mp4' } }, thumbnail: '' });
await test('game: a finished game shows only its recap, found in the news', async () => {
  routes = [['summary?event', () => summaryJ('post', [shortClip('Bam dunks'), shortClip('Tatum three')])],
    ['/news?event=401', () => ({ articles: [{ type: 'Story', id: 1, headline: 'Heat beat Celtics' }, { type: 'Media', id: 55, headline: 'Boston Celtics vs. Miami Heat: Game Highlights' }] })],
    ['video/clips/55', () => ({ videos: [{ headline: 'Boston Celtics vs. Miami Heat: Game Highlights', duration: 92, links: { source: { HD: { href: 'https://espnmedia-cdn.akamaized.net/r.mp4' } } }, thumbnail: 'https://espnmedia-cdn.akamaized.net/r.jpg' }] })]];
  const r = await game(req('/api/game?l=NBA&id=401'));
  assert.match(r.headers.get('netlify-cdn-cache-control'), /s-maxage=86400/);
  const j = await body(r);
  assert.equal(j.recap, true);
  assert.deepEqual(j.videos.map(v => [v.title, v.dur]), [['Boston Celtics vs. Miami Heat: Game Highlights', 92]]);
});
await test('game: the recap among the clips; no recap keeps the clips, cached briefly', async () => {
  routes = [['summary?event', () => summaryJ('post', [shortClip('Bam dunks'), shortClip('Celtics vs. Heat: Game Highlights')])]];
  let j = await body(await game(req('/api/game?l=NBA&id=401')));
  assert.equal(j.recap, true); assert.equal(j.videos.length, 1);
  routes = [['summary?event', () => summaryJ('post', [shortClip('Bam dunks'), shortClip('Bad host', 'https://evil.example')])], ['/news?event', () => ({ articles: [] })]];
  const r = await game(req('/api/game?l=NBA&id=401'));
  assert.match(r.headers.get('netlify-cdn-cache-control'), /s-maxage=900/);
  j = await body(r);
  assert.equal(j.recap, undefined);
  assert.deepEqual(j.videos.map(v => v.title), ['Bam dunks'], 'only clips from ESPN servers');
  routes = [['summary?event', () => summaryJ('pre', [shortClip('Preview: Game Highlights')])]];
  j = await body(await game(req('/api/game?l=NBA&id=401')));
  assert.equal(j.recap, undefined, 'no recap lookup before the game');
  assert.equal((await game(req('/api/game?l=XYZ&id=1'))).status, 400);
});

await test('game: the written recap, as plain text, with a link only to ESPN', async () => {
  const { recapArticle } = await import('../netlify/lib/espn.mjs');
  const story = '<p>MADRID -- — Joe Burrow threw for three touchdowns and the <a href="x">Bengals</a>\' offense kept rolling &amp; won.</p><p>Short.</p><p>Ja’Marr Chase had eight receptions for 142 yards in a career-high first half for him.</p>';
  const a = recapArticle({ article: { type: 'Recap', headline: 'Burrow powers Bengals', story, links: { web: { href: 'http://www.espn.com/nfl/recap?gameId=1' } } } });
  assert.equal(a.title, 'Burrow powers Bengals');
  assert.deepEqual(a.text, ["MADRID — Joe Burrow threw for three touchdowns and the Bengals' offense kept rolling & won.", 'Ja’Marr Chase had eight receptions for 142 yards in a career-high first half for him.']);
  assert.equal(a.url, 'https://www.espn.com/nfl/recap?gameId=1');
  assert.equal(recapArticle({ article: { type: 'Preview', story } }), null, 'a preview is not a recap');
  assert.equal(recapArticle({ article: { type: 'Recap', story, links: { web: { href: 'https://evil.example/x' } } } }).url, '');
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

/* ---------- /api/hit, /api/feedback, /api/stats (beta) ---------- */
await test('stats: counting views and actions, nothing else accepted', async () => {
  const st = await import('../netlify/lib/stats.mjs');
  assert.equal(st.cleanHit({ k: 'meci', f: 1, n: 0, a: 1, ip: '1.2.3.4' }).ip, undefined, 'nothing extra is kept');
  assert.equal(st.cleanHit({ k: 'evil' }), null);
  assert.equal(st.cleanHit({ e: 'nope' }), null);
  let r = st.addHit(null, { k: 'acasa', f: true, n: true, a: false });
  r = st.addHit(r, { k: 'meci', f: false, n: false, a: false });
  r = st.addHit(r, { k: 'acasa', f: true, n: false, a: true });
  r = st.addHit(r, { e: 'follow' });
  assert.deepEqual(r, { views: 3, visitors: 2, fresh: 1, back: 1, app: 1, pages: { acasa: 2, meci: 1 }, events: { follow: 1 }, counts: {} });
  // Visitor facts count once per visitor and day (on the first view only); other counts each time.
  const hits = st.cleanBatch({ b: [
    { k: 'acasa', f: true, n: true, a: false, src: 'instagram', dev: 'telefon', os: 'iOS', inapp: 'Instagram' },
    { k: 'meci', f: false, src: 'google' },
    { c: 'team', v: 'heat' }, { c: 'team', v: 'NBA-2' }, { c: 'team', v: 'heat' },
    { c: 'click', v: 'tema dark' }, { c: 'watch', v: 'ESPN pe Disney+' }, { c: 'dur', v: '1-5 min' },
    { c: 'src', v: 'spam' }, { c: 'click', v: '<script>' }, { c: 'nope', v: 'x' }
  ] });
  assert.equal(hits.length, 8, 'a visitor fact sent as a count, odd characters and unknown kinds are dropped');
  assert.equal(hits[1].src, undefined, 'the source only rides on the first view of the day');
  const d = hits.reduce(st.addHit, null);
  assert.deepEqual(d.counts, { src: { instagram: 1 }, dev: { telefon: 1 }, os: { iOS: 1 }, inapp: { Instagram: 1 }, team: { heat: 2, 'NBA-2': 1 }, click: { 'tema dark': 1 }, watch: { 'ESPN pe Disney+': 1 }, dur: { '1-5 min': 1 } });
  assert.equal(st.cleanBatch({ b: Array(100).fill({ c: 'click', v: 'x' }) }).length, 60, 'at most 60 per request');
  let big = null;
  for (let i = 0; i < 320; i++) big = st.addHit(big, { c: 'search', v: 'x' + i });
  assert.equal(Object.keys(big.counts.search).length, 300, 'a day keeps at most 300 values per kind');
  const track = await import('../js/track.js').catch(() => null);
  if (track) {
    assert.equal(track.kindOf(''), 'acasa'); assert.equal(track.kindOf('#ligi/ghid'), 'ghid');
    assert.equal(track.kindOf('#meci/NBA/1'), 'meci'); assert.equal(track.kindOf('#ceva'), 'acasa');
  }
});
await test('stats: the hit and feedback functions, and the key on the stats page', async () => {
  const hit = (await import('../netlify/functions/hit.mjs')).default;
  const fb = (await import('../netlify/functions/feedback.mjs')).default;
  const stats = (await import('../netlify/functions/stats.mjs')).default;
  const post = (fn, path, o, ua = 'Mozilla/5.0') => fn(req(path, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': ua }, body: JSON.stringify(o) }), {});
  assert.equal((await post(hit, '/api/hit', { k: 'ghid', f: true, n: true, a: false })).status, 204);
  assert.equal((await post(hit, '/api/hit', { k: 'nope' })).status, 400);
  assert.equal((await post(hit, '/api/hit', { k: 'ghid', f: true }, 'Googlebot/2.1')).status, 204, 'bots answered, not counted');
  assert.equal((await post(hit, '/api/hit', { b: [{ k: 'meci', f: true, n: false, src: 'instagram' }, { c: 'team', v: 'heat' }] })).status, 204, 'a batch');
  assert.equal((await post(hit, '/api/hit', { b: [{ c: 'nope' }] })).status, 400);
  assert.equal((await post(fb, '/api/feedback', { text: '' })).status, 400);
  assert.equal((await post(fb, '/api/feedback', { text: 'x'.repeat(2001) })).status, 400);
  assert.equal((await post(fb, '/api/feedback', { text: 'Îmi place ghidul <b>mult</b>', contact: 'test' })).status, 200);
  delete process.env.STATS_KEY;
  assert.equal((await stats(req('/api/stats?key=x'), {})).status, 503);
  process.env.STATS_KEY = 'secret-key-123';
  assert.equal((await stats(req('/api/stats?key=wrong'), {})).status, 403);
  const page = await stats(req('/api/stats?key=secret-key-123'), {});
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /Ghid<\/td><td>\d+/);
  assert.match(html, /De unde vin, ultimele 7 zile[\s\S]*instagram/);
  assert.match(html, /Echipe deschise[\s\S]*Miami Heat/, 'team keys shown by name');
  assert.match(html, /Îmi place ghidul &lt;b&gt;mult&lt;\/b&gt;/, 'messages are escaped');
  delete process.env.STATS_KEY;
});

globalThis.fetch = realFetch;
console.log(`all ${n} function checks passed`);

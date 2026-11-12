// Reads ESPN's public JSON endpoints (free, no key) and turns them into the small format the page uses.
// ESPN's site API is unofficial: every reader below is defensive and returns partial data instead of throwing.
import { LEAGUES, TEAMS, norm } from '../../js/teams.js';

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/';
const CORE = 'https://site.api.espn.com/apis/v2/sports/';

export async function getJSON(url, ms = 8000) {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

const num = v => {
  if (v == null || v === '') return null;
  if (typeof v === 'object') return num(v.value ?? v.displayValue);
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function pickLogos(t) {
  const list = t?.logos || (t?.logo ? [{ href: t.logo, rel: ['default'] }] : []);
  const def = list.find(x => (x.rel || []).includes('default')) || list[0];
  const dark = list.find(x => (x.rel || []).includes('dark'));
  return { logo: def?.href || null, logoDark: dark?.href || null };
}

export function teamInfo(t) {
  if (!t) return null;
  return {
    id: String(t.id ?? ''),
    name: t.displayName || t.name || '',
    abbr: t.abbreviation || '',
    color: t.color ? '#' + t.color : null,
    alt: t.alternateColor ? '#' + t.alternateColor : null,
    ...pickLogos(t)
  };
}

// One ESPN event -> one game. `fl` maps 'LEAGUE:espnId' -> Florida team key.
// ESPN ids repeat across leagues (NBA Jazz and NHL Panthers can share an id), so the league is part of the key.
export function normalizeEvent(ev, l, fl = {}) {
  const c = ev?.competitions?.[0];
  if (!c) return null;
  const side = w => (c.competitors || []).find(x => x.homeAway === w);
  const H = side('home'), A = side('away');
  if (!H || !A) return null;
  const st = c.status?.type || ev.status?.type || {};
  const addr = c.venue?.address || {};
  const team = x => {
    const t = teamInfo(x.team);
    return { ...t, key: fl[l + ':' + t.id] || null, score: num(x.score), winner: x.winner ?? null };
  };
  let note = c.notes?.[0]?.headline || '';
  if (!note && l === 'NFL' && ev.week?.number && (ev.seasonType?.type ?? 2) === 2) note = 'Etapa ' + ev.week.number;
  // Soccer playoffs carry the round only in the season slug ("eastern-conference-playoffs---round-one").
  if (!note && /playoff/i.test(ev.season?.slug || '')) note = ev.season.slug.replace(/-+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const home = team(H), away = team(A);
  // Soccer venues come without a state (only "USA"): a Florida team at home, not on a neutral
  // ground, is playing in Florida.
  const region = addr.state || (home.key && !c.neutralSite ? 'FL' : addr.country || '');
  return {
    id: String(ev.id),
    l,
    date: ev.date || c.date,
    tbd: c.timeValid === false || ev.timeValid === false,
    state: st.state || (st.completed ? 'post' : 'pre'),
    detail: st.shortDetail || st.detail || '',
    home,
    away,
    venue: c.venue?.fullName || '',
    city: addr.city || '',
    region,
    neutral: !!c.neutralSite,
    note,
    tv: c.broadcasts?.[0]?.names?.[0] || c.geoBroadcasts?.[0]?.media?.shortName || ''
  };
}

// Finds the ESPN ids of the Florida teams by display name.
export async function floridaIds(errors) {
  const out = {};
  const byLeague = {};
  for (const [k, t] of Object.entries(TEAMS)) (byLeague[t.l] ||= []).push(k);
  await Promise.all(Object.entries(byLeague).map(async ([l, keys]) => {
    try {
      const j = await getJSON(SITE + LEAGUES[l].path + '/teams');
      const list = (j.sports?.[0]?.leagues?.[0]?.teams || []).map(x => x.team);
      for (const k of keys) {
        const hit = list.find(t => norm(t.displayName) === norm(TEAMS[k].espn));
        if (hit) out[k] = teamInfo(hit);
        else errors.push(`team not found: ${TEAMS[k].espn}`);
      }
    } catch (e) { errors.push(String(e.message || e)); }
  }));
  return out;
}

// `query` examples: '' (default), 'seasontype=3' (postseason), 'fixture=true' (soccer: upcoming games;
// without it ESPN lists only played soccer games).
export async function teamSchedule(l, id, query = '') {
  const j = await getJSON(`${SITE}${LEAGUES[l].path}/teams/${id}/schedule${query ? '?' + query : ''}`);
  return { events: j.events || [], team: j.team || {} };
}

// All league games between two dates (YYYYMMDD). Used for MLS as a safety net for playoff fixtures.
// The soccer scoreboard rejects date ranges ("Failed to get events endpoint") but accepts a whole
// month (dates=YYYYMM), so it is asked month by month and the result trimmed to the range.
export async function scoreboardRange(l, from, to) {
  const months = [];
  for (let y = +from.slice(0, 4), m = +from.slice(4, 6); y * 100 + m <= +to.slice(0, 6); m === 12 ? (y++, m = 1) : m++) months.push(`${y}${String(m).padStart(2, '0')}`);
  const lists = await Promise.all(months.map(ym => getJSON(`${SITE}${LEAGUES[l].path}/scoreboard?dates=${ym}&limit=300`).then(j => j.events || [])));
  const lo = `${from.slice(0, 4)}-${from.slice(4, 6)}-${from.slice(6, 8)}`, hi = `${to.slice(0, 4)}-${to.slice(4, 6)}-${to.slice(6, 8)}T23:59Z`;
  return lists.flat().filter(e => !e.date || (e.date >= lo && e.date <= hi));
}

// Standings stat lookup: ESPN uses `name` for numbers and `type` for record splits.
function stat(stats, ...names) {
  for (const n of names) {
    const s = stats.find(x => x.name === n || x.type === n || x.abbreviation === n);
    if (s) return s;
  }
  return null;
}

export function normalizeStandings(j) {
  const groups = j.children?.length ? j.children : [j];
  return groups.map(g => ({
    name: g.name || '',
    abbr: g.abbreviation || '',
    entries: (g.standings?.entries || []).map((e, i) => {
      const s = e.stats || [];
      const v = (...n) => num(stat(s, ...n)?.value);
      const d = (...n) => { const x = stat(s, ...n); return x ? (x.summary || x.displayValue || null) : null; };
      return {
        ...teamInfo(e.team),
        order: i + 1,
        // MLS has no playoffSeed, only its conference rank; its list is not in rank order.
        seed: v('playoffSeed') ?? v('rank'),
        w: v('wins'), l: v('losses'), otl: v('otLosses', 'overtimeLosses'), t: v('ties'),
        pts: v('points'), pct: v('winPercent'),
        gp: v('gamesPlayed'),
        home: d('home', 'Home'), away: d('road', 'away', 'Road', 'Away'),
        streak: d('streak')
      };
    })
  }));
}

export async function standings(l) {
  return normalizeStandings(await getJSON(`${CORE}${LEAGUES[l].path}/standings`));
}

export async function scoreboard(l, yyyymmdd) {
  const q = yyyymmdd ? `?dates=${yyyymmdd}` : '';
  const j = await getJSON(`${SITE}${LEAGUES[l].path}/scoreboard${q}`, 6000);
  return (j.events || []).map(ev => normalizeEvent(ev, l)).filter(Boolean);
}

// Each reader below takes one part of ESPN's game summary. A missing or reshaped part gives an empty
// result, never an exception: one broken section must not take the whole game page down.
const safe = (f, fallback) => { try { return f() ?? fallback; } catch (e) { return fallback; } };
const athleteName = a => a?.displayName || a?.fullName || '';

// Player stats. ESPN groups them (NBA: one group; NHL: forwards, defenses, goalies; NFL: passing,
// rushing, …). Each group carries its column keys, so the page picks columns by key, not by position.
function boxPlayers(j, sideOf) {
  const out = [];
  for (const t of j.boxscore?.players || []) {
    const groups = (t.statistics || []).map(s => ({
      name: s.name || s.type || '',
      keys: s.keys || [],
      rows: (s.athletes || []).map(a => ({
        n: athleteName(a.athlete), pos: a.athlete?.position?.abbreviation || '', j: a.athlete?.jersey || '',
        st: !!a.starter, dnp: !!a.didNotPlay, why: a.didNotPlay ? (a.reason || '') : '',
        v: (a.stats || []).map(String)
      })).filter(r => r.n),
      tot: (s.totals || []).map(String)
    })).filter(g => g.rows.length && g.keys.length);
    if (groups.length) out.push({ side: sideOf(t.team?.id), groups });
  }
  if (out.length) return out;
  // Soccer has no box score: the line-ups carry each player's numbers.
  for (const r of j.rosters || []) {
    const rows = (r.roster || []).filter(p => p.starter || p.subbedIn).map(p => {
      const s = Object.fromEntries((p.stats || []).map(x => [x.name, String(x.displayValue ?? x.value ?? '')]));
      return {
        n: athleteName(p.athlete), pos: p.position?.abbreviation || '', j: p.jersey || '',
        st: !!p.starter, sub: !!p.subbedIn, out: !!p.subbedOut, v: SOCCER_KEYS.map(k => s[k] ?? '')
      };
    }).filter(x => x.n);
    if (rows.length) out.push({ side: r.homeAway === 'away' ? 'away' : 'home', formation: r.formation || '', groups: [{ name: 'soccer', keys: SOCCER_KEYS, rows, tot: [] }] });
  }
  return out;
}
const SOCCER_KEYS = ['totalGoals', 'goalAssists', 'totalShots', 'shotsOnTarget', 'foulsCommitted', 'yellowCards', 'redCards', 'goalsConceded', 'shotsFaced'];

// Team stats side by side: [{ k, label, h, a }].
function teamStats(j, sideOf) {
  const by = {};
  for (const t of j.boxscore?.teams || []) {
    const s = sideOf(t.team?.id);
    for (const x of t.statistics || []) {
      if (!x.name) continue;
      (by[x.name] ||= { k: x.name, label: x.label || x.name })[s === 'away' ? 'a' : 'h'] = x.displayValue ?? '';
    }
  }
  return Object.values(by).filter(x => x.h != null && x.a != null);
}

// Scoring plays and cards, oldest first: [{ per, clock, side, kind, who, ast, text, hs, as }].
function timeline(j, l, sideOf) {
  if (l === 'MLS') {
    return (j.keyEvents || []).filter(e => /goal|card|penalty - (scored|missed|saved)/i.test(e.type?.text || '')).map(e => {
      const t = e.type?.text || '';
      const kind = /own goal/i.test(t) ? 'og' : /goal|penalty - scored/i.test(t) ? 'goal' : /red/i.test(t) ? 'rc' : /yellow/i.test(t) ? 'yc' : /penalty/i.test(t) ? 'pmiss' : 'other';
      const ps = (e.participants || []).map(p => athleteName(p.athlete)).filter(Boolean);
      return { per: e.period?.number ?? null, clock: e.clock?.displayValue || '', side: sideOf(e.team?.id), kind, pen: /penalty/i.test(t), who: ps[0] || '', ast: kind === 'goal' ? ps.slice(1) : [], text: '' };
    });
  }
  if (l === 'NFL') {
    return (j.scoringPlays || []).map(p => ({
      per: p.period?.number ?? null, clock: p.clock?.displayValue || '', side: sideOf(p.team?.id),
      kind: p.type?.abbreviation || p.type?.text || '', text: p.text || '', hs: num(p.homeScore), as: num(p.awayScore)
    }));
  }
  if (l === 'NHL') {
    return (j.plays || []).filter(p => p.scoringPlay).map(p => {
      const ps = p.participants || [];
      return {
        per: p.period?.number ?? null, clock: p.clock?.displayValue || '', side: sideOf(p.team?.id), kind: 'goal',
        who: athleteName((ps.find(x => x.type === 'scorer') || ps[0])?.athlete),
        ast: ps.filter(x => x.type === 'assister').map(x => athleteName(x.athlete)).filter(Boolean),
        pp: /power play/i.test(p.strength?.text || ''), sh: /short ?handed/i.test(p.strength?.text || ''), en: /empty net/i.test(p.text || ''),
        text: '', hs: num(p.homeScore), as: num(p.awayScore)
      };
    });
  }
  return [];
}

// Home win probability during the game, thinned to at most `max` points: [[percent, period], …].
function winProbability(j, max = 160) {
  const wp = j.winprobability || [];
  if (wp.length < 2) return [];
  const per = new Map();
  for (const p of j.plays || []) per.set(String(p.id), p.period?.number ?? null);
  for (const d of [...(j.drives?.previous || []), ...(j.drives?.current ? [j.drives.current] : [])])
    for (const p of d.plays || []) per.set(String(p.id), p.period?.number ?? null);
  const step = Math.max(1, Math.ceil(wp.length / max));
  const out = [];
  for (let i = 0; i < wp.length; i += step) out.push(wp[i]);
  if (out.at(-1) !== wp.at(-1)) out.push(wp.at(-1));
  return out.map(x => [Math.round(num(x.homeWinPercentage) * 1000) / 10, per.get(String(x.playId)) ?? null])
    .filter(x => Number.isFinite(x[0]));
}

function injuries(j, sideOf) {
  return (j.injuries || []).map(t => ({
    side: sideOf(t.team?.id),
    items: (t.injuries || []).map(x => ({
      n: athleteName(x.athlete), pos: x.athlete?.position?.abbreviation || '',
      st: x.status || x.type?.description || '', what: x.details?.type || '', side: x.details?.side || '',
      det: x.details?.detail || '', ret: x.details?.returnDate || ''
    })).filter(x => x.n)
  })).filter(t => t.items.length);
}

// Meetings between the two teams (this season; for soccer ESPN lists recent years).
function series(j) {
  const s = j.seasonseries?.[0];
  if (!s) return null;
  const games = (s.events || []).map(e => {
    const c = e.competitors || [];
    const one = w => { const x = c.find(y => y.homeAway === w) || {}; return { id: String(x.team?.id ?? x.id ?? ''), abbr: x.team?.abbreviation || '', score: num(x.score) }; };
    return { id: String(e.id), date: e.date || '', state: e.statusType?.state || e.status?.type?.state || '', home: one('home'), away: one('away') };
  }).filter(g => g.date);
  return games.length ? { title: s.title || '', games } : null;
}

function lastFive(j, sideOf) {
  return (j.lastFiveGames || []).map(t => {
    const id = String(t.team?.id ?? '');
    return {
      side: sideOf(id),
      games: (t.events || []).map(e => {
        const home = String(e.homeTeamId) === id;
        const mine = num(home ? e.homeTeamScore : e.awayTeamScore), their = num(home ? e.awayTeamScore : e.homeTeamScore);
        return {
          id: String(e.id), date: e.gameDate || '', at: e.atVs === '@', res: { W: 'V', L: 'I', D: 'E', T: 'E' }[e.gameResult] || '',
          opp: e.opponent?.displayName || '', oppAbbr: e.opponent?.abbreviation || '', oppLogo: e.opponent?.logo || '', mine, their
        };
      })
    };
  }).filter(t => t.games.length);
}

// Highlight clips: only ESPN's own media hosts, so the page never embeds anything else.
const MEDIA = /^https:\/\/[a-z0-9.-]*(espncdn\.com|espn\.com|akamaized\.net)\//i;
const clip = v => ({
  title: v.headline || '', dur: num(v.duration),
  mp4: v.links?.source?.HD?.href || v.links?.source?.href || '', thumb: v.thumbnail || ''
});
const safeClip = v => MEDIA.test(v.mp4) && (!v.thumb || MEDIA.test(v.thumb));
function videos(j) {
  return (j.videos || []).map(clip).filter(safeClip);
}

// The official recap of a finished game ("Game Highlights", one to three minutes). ESPN puts it among the
// game's clips (NBA) or only in the news filed under the game (NHL, MLS), where the clip page has the file.
export const RECAP = /game highlights|full highlights?|condensed game|extended highlights/i;
export function recapInNews(j) {
  return (j?.articles || []).find(a => a.type === 'Media' && a.id &&
    (RECAP.test(a.headline || '') || (a.categories || []).some(c => /full highlight/i.test(c.description || '')))) || null;
}
export async function recapVideo(l, id, clips = []) {
  const own = clips.find(v => RECAP.test(v.title));
  if (own) return own;
  const news = await getJSON(`${SITE}${LEAGUES[l].path}/news?event=${encodeURIComponent(id)}`, 5000).catch(() => null);
  const a = recapInNews(news);
  if (!a) return null;
  const c = await getJSON(`https://content.core.api.espn.com/v1/video/clips/${encodeURIComponent(a.id)}`, 5000).catch(() => null);
  const v = c?.videos?.[0] && clip(c.videos[0]);
  return v && safeClip(v) ? { ...v, title: v.title || a.headline || '' } : null;
}

// The written recap of a finished game (ESPN / AP, in English): the headline and the first paragraphs.
const ENT = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' };
const plain = s => String(s || '').replace(/<[^>]+>/g, '').replace(/--\s*—/g, '—').replace(/&(amp|quot|#39|apos|lt|gt|nbsp);/g, m => ENT[m]).replace(/\s+/g, ' ').trim();
export function recapArticle(j) {
  const a = j?.article;
  if (!a || !/recap/i.test(a.type || '') || !a.story) return null;
  const paras = String(a.story).split(/<\/p>|\n\s*\n/).map(plain).filter(p => p.length > 40);
  const text = [];
  let len = 0;
  for (const p of paras) { if (text.length && len + p.length > 900) break; text.push(p); len += p.length; if (text.length >= 3) break; }
  // ESPN gives http:// links; only its own pages, always over https.
  const url = String(a.links?.web?.href || '').replace(/^http:\/\//, 'https://');
  return text.length ? { title: plain(a.headline), text, url: /^https:\/\/(www\.)?espn\.com\//.test(url) ? url : '' } : null;
}

// NHL, before the game: the expected goalies.
function goalies(j) {
  const g = j.goalies;
  if (!g) return [];
  return [['home', g.homeTeam], ['away', g.awayTeam]].map(([side, t]) => {
    const a = t?.athletes?.[0];
    return a ? { side, n: athleteName(a), j: a.jersey || '' } : null;
  }).filter(Boolean);
}

// Game page: line score, leaders, players, team stats, plays, win probability, injuries, history.
export function normalizeSummary(j, l) {
  const comp = j.header?.competitions?.[0] || {};
  const side = w => (comp.competitors || []).find(x => x.homeAway === w) || {};
  const H = side('home'), A = side('away');
  const homeId = String(H.team?.id ?? H.id ?? '');
  const sideOf = id => (id != null && String(id) === homeId ? 'home' : 'away');
  const lines = x => (x.linescores || []).map(s => num(s.displayValue ?? s.value));
  const leaders = safe(() => (j.leaders || []).map(t => ({
    team: t.team?.displayName || '',
    side: sideOf(t.team?.id),
    items: (t.leaders || []).slice(0, 4).map(c => ({
      cat: c.displayName || c.name || '',
      who: c.leaders?.[0]?.athlete?.displayName || '',
      val: c.leaders?.[0]?.displayValue || ''
    })).filter(x => x.who)
  })).filter(t => t.items.length), []);
  const p = j.predictor;
  const predictor = p ? {
    home: num(p.homeTeam?.gameProjection), away: num(p.awayTeam?.gameProjection),
    tie: num(p.homeTeam?.teamChanceTie ?? p.awayTeam?.teamChanceTie)
  } : null;
  const g = j.gameInfo || {};
  const plays = safe(() => timeline(j, l, sideOf), []);
  return {
    l,
    state: comp.status?.type?.state || '',
    detail: comp.status?.type?.shortDetail || '',
    home: { name: H.team?.displayName || '', abbr: H.team?.abbreviation || '', score: num(H.score), lines: lines(H) },
    away: { name: A.team?.displayName || '', abbr: A.team?.abbreviation || '', score: num(A.score), lines: lines(A) },
    leaders,
    plays,
    box: safe(() => boxPlayers(j, sideOf), []),
    teamStats: safe(() => teamStats(j, sideOf), []),
    wp: safe(() => winProbability(j), []),
    injuries: safe(() => injuries(j, sideOf), []),
    series: safe(() => series(j), null),
    last5: safe(() => lastFive(j, sideOf), []),
    videos: safe(() => videos(j), []).slice(0, 4),
    allVideos: safe(() => videos(j), []),
    goalies: safe(() => goalies(j), []),
    article: safe(() => recapArticle(j), null),
    predictor: predictor && predictor.home != null ? predictor : null,
    attendance: num(g.attendance),
    officials: (g.officials || []).slice(0, 1).map(o => o.displayName).join(''),
    note: comp.notes?.[0]?.headline || ''
  };
}

export async function summary(l, id) {
  const s = normalizeSummary(await getJSON(`${SITE}${LEAGUES[l].path}/summary?event=${encodeURIComponent(id)}`), l);
  // A finished game: only its recap, when ESPN has one, instead of the short clips.
  const all = s.allVideos; delete s.allVideos;
  if (s.state === 'post') {
    const r = await recapVideo(l, id, all).catch(() => null);
    if (r) { s.videos = [r]; s.recap = true; }
  }
  return s;
}

/* ---------- scores: every game of one day, in every league (one request per league) ---------- */
export async function scoresDay(ymd, leagues = Object.keys(LEAGUES)) {
  const errors = [], out = {};
  await Promise.all(leagues.map(async l => {
    try {
      const j = await getJSON(`${SITE}${LEAGUES[l].path}/scoreboard?dates=${ymd}&limit=300`, 8000);
      out[l] = (j.events || []).map(ev => normalizeEvent(ev, l)).filter(Boolean)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    } catch (e) { out[l] = []; errors.push(`${l}: ${e.message || e}`); }
  }));
  return { date: ymd, leagues: out, errors };
}

// A team's season games, for the page of any team (Florida teams already have theirs in /api/schedule).
export async function teamGames(l, id) {
  const qs = l === 'MLS' ? ['', 'fixture=true'] : l === 'NFL' ? ['', 'seasontype=3'] : [''];
  const lists = await Promise.all(qs.map(q => teamSchedule(l, id, q).catch(() => ({ events: [], team: {} }))));
  const seen = new Set(), games = [];
  for (const { events } of lists) for (const ev of events) {
    const g = normalizeEvent(ev, l);
    if (g && !seen.has(g.id)) { seen.add(g.id); games.push(g); }
  }
  games.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const team = lists[0].team || {};
  return { l, id: String(id), record: team.recordSummary || null, standing: team.standingSummary || null, games };
}

/* ---------- playoffs: every postseason game of a league, for the bracket ---------- */
const isPlayoff = ev => /playoff|post-?season/i.test(ev.season?.slug || '') || ev.season?.type === 3;
// "eastern-conference-playoffs---round-one" -> { conf: 'east', round: 'round one' }; NBA/NHL notes: "East 1st Round - Game 3".
export function playoffRound(ev) {
  const note = ev.competitions?.[0]?.notes?.[0]?.headline || '';
  const slug = ev.season?.slug || '';
  const text = (note || slug.replace(/-+/g, ' ')).replace(/\s*-\s*game\s*\d+.*$/i, '').replace(/\bgame\s*\d+\b/i, '').trim();
  const conf = /\beast/i.test(text) ? 'east' : /\bwest/i.test(text) ? 'west' : /\bafc\b/i.test(text) ? 'afc' : /\bnfc\b/i.test(text) ? 'nfc' : '';
  const r = text.toLowerCase();
  const stage = /wild ?card|play-?in/.test(r) ? 1 : /round one|1st round|first round/.test(r) ? 2 : /semifinal|2nd round|second round|divisional/.test(r) ? 3
    : /conference final|conference championship|afc championship|nfc championship/.test(r) ? 4 : /final|cup|super bowl|championship/.test(r) ? 5 : 0;
  return { conf, stage, label: text };
}
export async function playoffs(l, now = new Date()) {
  const months = [];
  for (let i = -3; i <= 1; i++) { const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1)); months.push(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`); }
  const lists = await Promise.all(months.map(ym => getJSON(`${SITE}${LEAGUES[l].path}/scoreboard?dates=${ym}&limit=400`, 8000).then(j => j.events || [], () => [])));
  const seen = new Set(), games = [];
  for (const ev of lists.flat()) {
    if (!isPlayoff(ev) || seen.has(ev.id)) continue;
    seen.add(ev.id);
    const g = normalizeEvent(ev, l);
    if (!g) continue;
    games.push({ ...g, round: playoffRound(ev) });
  }
  games.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return { l, updated: now.toISOString(), games };
}

/* ---------- team page extras: roster, season leaders, news ---------- */
const CORE_API = 'https://sports.core.api.espn.com/v2/sports/';
const CORE_PATH = { NBA: 'basketball/leagues/nba', NHL: 'hockey/leagues/nhl', NFL: 'football/leagues/nfl', MLS: 'soccer/leagues/usa.1', MLB: 'baseball/leagues/mlb' };
// The categories worth showing, in order, per league (ESPN has many more).
export const LEADER_CATS = {
  NBA: ['pointsPerGame', 'reboundsPerGame', 'assistsPerGame', 'stealsPerGame', 'blocksPerGame'],
  NHL: ['points', 'goals', 'assists', 'plusMinus', 'savePct', 'wins'],
  NFL: ['passingYards', 'rushingYards', 'receivingYards', 'totalTackles', 'sacks', 'interceptions'],
  MLS: ['goals', 'assists', 'totalShots', 'saves'],
  MLB: ['avg', 'homeRuns', 'RBIs', 'ERA', 'strikeouts']
};
const cm = s => { const m = /(\d+)'\s*(\d+)?/.exec(s || ''); return m ? Math.round((+m[1] * 12 + (+m[2] || 0)) * 2.54) : null; };
const kg = s => { const m = /([\d.]+)\s*lbs/.exec(s || ''); return m ? Math.round(+m[1] * 0.4536) : null; };

export function normalizeRoster(j) {
  const a = j?.athletes || [];
  // NHL and NFL group the roster by position; NBA and MLS give one list.
  const groups = a[0]?.items ? a.map(g => ({ name: g.position || '', items: g.items })) : [{ name: '', items: a }];
  return groups.map(g => ({
    name: g.name,
    players: (g.items || []).map(p => ({
      id: String(p.id ?? ''), n: p.displayName || p.fullName || '', j: p.jersey || '',
      pos: p.position?.abbreviation || '', posName: p.position?.displayName || '',
      age: num(p.age), cm: cm(p.displayHeight), kg: kg(p.displayWeight),
      born: [p.birthPlace?.city, p.birthPlace?.state || p.birthPlace?.country].filter(Boolean).join(', '),
      head: p.headshot?.href || '', out: (p.injuries || []).length > 0 || (p.status?.type && p.status.type !== 'active'),
      exp: num(p.experience?.years)
    })).filter(p => p.n)
  })).filter(g => g.players.length);
}
export function normalizeNews(j) {
  return (j?.articles || []).map(x => ({
    h: x.headline || '', d: x.description || '', date: x.published || '', type: x.type || '',
    img: x.images?.[0]?.url || '', link: x.links?.web?.href || ''
  })).filter(x => x.h && /^https?:\/\/([a-z0-9-]+\.)*espn\.com\//i.test(x.link)).slice(0, 8);
}
// Core API leaders name athletes only by link; the roster gives their names.
export function normalizeLeaders(j, l, roster) {
  const byId = new Map(roster.flatMap(g => g.players).map(p => [p.id, p]));
  const want = LEADER_CATS[l] || [];
  return want.map(name => {
    const c = (j?.categories || []).find(x => x.name === name);
    const top = c?.leaders?.[0];
    const id = /athletes\/(\d+)/.exec(top?.athlete?.$ref || '')?.[1];
    const p = id && byId.get(id);
    return p ? { cat: name, label: c.displayName || name, val: top.displayValue || '', who: p.n, id, head: p.head, pos: p.pos } : null;
  }).filter(Boolean);
}
export async function teamExtras(l, id) {
  const base = `${SITE}${LEAGUES[l].path}`;
  const [rosterJ, newsJ, teamJ] = await Promise.all([
    getJSON(`${base}/teams/${id}/roster`).catch(() => null),
    getJSON(`${base}/news?team=${id}&limit=10`).catch(() => null),
    getJSON(`${base}/teams/${id}`).catch(() => null)
  ]);
  const roster = normalizeRoster(rosterJ);
  // The season of the team's next (or last) game, e.g. 2027 for the NBA's 2026–27 season.
  const ev = teamJ?.team?.nextEvent?.[0];
  const year = ev?.season?.year || new Date().getFullYear();
  let leaders = [];
  let coach = null;
  const [leadersJ, coachesJ] = await Promise.all([
    getJSON(`${CORE_API}${CORE_PATH[l]}/seasons/${year}/types/2/teams/${id}/leaders`, 8000).catch(() => null),
    getJSON(`${CORE_API}${CORE_PATH[l]}/seasons/${year}/teams/${id}/coaches`, 8000).catch(() => null)
  ]);
  try { if (leadersJ) leaders = normalizeLeaders(leadersJ, l, roster); } catch (e) { /* leaders are optional */ }
  // The head coach: the first coach of the season (ESPN lists only the head coach there; none for MLS).
  try {
    const ref = coachesJ?.items?.[0]?.$ref;
    if (ref) { const p = await getJSON(ref.replace(/^http:/, 'https:'), 6000); const n = [p.firstName, p.lastName].filter(Boolean).join(' '); if (n) coach = n; }
  } catch (e) { /* the coach is optional */ }
  return { l, id: String(id), season: year, roster, leaders, coach, news: normalizeNews(newsJ) };
}

export function json(body, { browser = 60, cdn = 300, swr = 86400, status = 200 } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${browser}`,
      'netlify-cdn-cache-control': `public, durable, s-maxage=${cdn}, stale-while-revalidate=${swr}`
    }
  });
}

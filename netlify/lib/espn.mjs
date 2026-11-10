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

// One ESPN event -> one game. `fl` maps ESPN team id -> Florida team key.
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
    return { ...t, key: fl[t.id] || null, score: num(x.score), winner: x.winner ?? null };
  };
  let note = c.notes?.[0]?.headline || '';
  if (!note && l === 'NFL' && ev.week?.number && (ev.seasonType?.type ?? 2) === 2) note = 'Etapa ' + ev.week.number;
  return {
    id: String(ev.id),
    l,
    date: ev.date || c.date,
    tbd: c.timeValid === false || ev.timeValid === false,
    state: st.state || (st.completed ? 'post' : 'pre'),
    detail: st.shortDetail || st.detail || '',
    home: team(H),
    away: team(A),
    venue: c.venue?.fullName || '',
    city: addr.city || '',
    region: addr.state || addr.country || '',
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
export async function scoreboardRange(l, from, to) {
  const j = await getJSON(`${SITE}${LEAGUES[l].path}/scoreboard?dates=${from}-${to}&limit=300`);
  return j.events || [];
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
        seed: v('playoffSeed'),
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

// Game page: line score, leaders, goals, win probability.
export function normalizeSummary(j, l) {
  const comp = j.header?.competitions?.[0] || {};
  const side = w => (comp.competitors || []).find(x => x.homeAway === w) || {};
  const H = side('home'), A = side('away');
  const lines = x => (x.linescores || []).map(s => num(s.displayValue ?? s.value));
  const leaders = (j.leaders || []).map(t => ({
    team: t.team?.displayName || '',
    items: (t.leaders || []).slice(0, 4).map(c => ({
      cat: c.displayName || c.name || '',
      who: c.leaders?.[0]?.athlete?.displayName || '',
      val: c.leaders?.[0]?.displayValue || ''
    })).filter(x => x.who)
  })).filter(t => t.items.length);
  const goals = (j.keyEvents || [])
    .filter(e => e.scoringPlay || /goal/i.test(e.type?.text || ''))
    .map(e => ({
      min: e.clock?.displayValue || '',
      who: e.participants?.[0]?.athlete?.displayName || '',
      team: e.team?.displayName || ''
    }));
  const p = j.predictor;
  const predictor = p ? {
    home: num(p.homeTeam?.gameProjection), away: num(p.awayTeam?.gameProjection),
    tie: num(p.homeTeam?.teamChanceTie ?? p.awayTeam?.teamChanceTie)
  } : null;
  const g = j.gameInfo || {};
  return {
    l,
    state: comp.status?.type?.state || '',
    detail: comp.status?.type?.shortDetail || '',
    home: { name: H.team?.displayName || '', score: num(H.score), lines: lines(H) },
    away: { name: A.team?.displayName || '', score: num(A.score), lines: lines(A) },
    leaders, goals,
    predictor: predictor && predictor.home != null ? predictor : null,
    attendance: num(g.attendance),
    officials: (g.officials || []).slice(0, 1).map(o => o.displayName).join(''),
    note: comp.notes?.[0]?.headline || ''
  };
}

export async function summary(l, id) {
  return normalizeSummary(await getJSON(`${SITE}${LEAGUES[l].path}/summary?event=${encodeURIComponent(id)}`), l);
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

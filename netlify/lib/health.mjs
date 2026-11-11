// Checks the free sources the site depends on: ESPN (scores, standings) and Open-Meteo (weather).
// Each check asks one small, typical question and looks at the shape of the answer, so a silent format
// change at ESPN (its API is unofficial) shows up as clearly as an outage. The judges are pure: tested offline.
const SITE = 'https://site.api.espn.com/apis/site/v2/sports/';
const CORE = 'https://site.api.espn.com/apis/v2/sports/';
const METEO = 'https://api.open-meteo.com/v1/forecast?latitude=25.78&longitude=-80.19&current=temperature_2m,weather_code&timezone=America/New_York';

// Each judge returns '' when the answer looks right, else what is wrong (Romanian, for the page).
export function judgeScoreboard(j) {
  if (!j || !Array.isArray(j.events) || !Array.isArray(j.leagues)) return 'a schimbat formatul scorurilor';
  const c = j.events[0]?.competitions?.[0];
  if (j.events.length && (!c || c.competitors?.length !== 2 || !c.competitors[0]?.team?.displayName)) return 'a schimbat formatul meciurilor';
  return '';
}
export function judgeStandings(j) {
  const g = j?.children?.[0]?.standings?.entries;
  if (!Array.isArray(g) || !g.length || !g[0]?.team?.displayName || !Array.isArray(g[0]?.stats)) return 'a schimbat formatul clasamentelor';
  return '';
}
export function judgeWeather(j) {
  if (!j?.current || typeof j.current.temperature_2m !== 'number') return 'a schimbat formatul prognozei';
  return '';
}

export const CHECKS = [
  { id: 'espn', name: 'ESPN', what: 'program, scoruri, clasamente', parts: [
    { url: SITE + 'basketball/nba/scoreboard', judge: judgeScoreboard },
    { url: CORE + 'hockey/nhl/standings', judge: judgeStandings }
  ] },
  { id: 'meteo', name: 'Open-Meteo', what: 'vremea', parts: [{ url: METEO, judge: judgeWeather }] }
];

// "nu răspunde", "răspunde cu eroare (503)" or the judge's verdict; '' when all is well.
async function ask(part, fetchFn, ms) {
  let r;
  try { r = await fetchFn(part.url, { signal: AbortSignal.timeout(ms), headers: { accept: 'application/json' } }); }
  catch (e) { return 'nu răspunde'; }
  if (!r.ok) return `răspunde cu eroare (${r.status})`;
  let j;
  try { j = await r.json(); } catch (e) { return 'trimite date care nu se pot citi'; }
  return part.judge(j);
}

// -> { checked, ok, sources: [{ id, name, what, ok, ms, problem }] }
export async function checkSources(fetchFn = fetch, ms = 6000) {
  const sources = await Promise.all(CHECKS.map(async c => {
    const t0 = Date.now();
    const problems = (await Promise.all(c.parts.map(p => ask(p, fetchFn, ms)))).filter(Boolean);
    return { id: c.id, name: c.name, what: c.what, ok: !problems.length, ms: Date.now() - t0, problem: problems[0] || '' };
  }));
  return { checked: new Date().toISOString(), ok: sources.every(s => s.ok), sources };
}

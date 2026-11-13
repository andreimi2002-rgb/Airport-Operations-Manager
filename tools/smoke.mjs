// After a deploy: asks a published site (preview or production) for its pages and data, the way the page
// does, and says plainly what does not work. Uses the real ESPN and Open-Meteo through the site.
//   node tools/smoke.mjs https://deploy-preview-10--americansportshub.netlify.app
const site = (process.argv[2] || 'https://americansportshub.netlify.app').replace(/\/$/, '');
const usDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()).replace(/-/g, '');

const checks = [
  ['Pagina', '/', async r => (await r.text()).includes('American Sports Hub') || 'lipsește numele site-ului'],
  ['Sezonul (program, clasamente)', '/api/schedule', async r => { const j = await r.json(); return (j.games?.length > 0 && Object.keys(j.standings || {}).length > 0) || 'fără meciuri sau clasamente'; }],
  ['Scorurile zilei', `/api/scores?d=${usDay}`, async r => { const j = await r.json(); return !!j.leagues || 'răspuns fără ligi'; }],
  ['Europa și evenimente', '/api/world', async r => { const j = await r.json(); return (Array.isArray(j.abroad) && Array.isArray(j.events)) || 'răspuns fără liste'; }],
  ['Scor live', '/api/live?l=NBA,NHL', async r => Array.isArray((await r.json()).games) || 'răspuns fără meciuri'],
  ['Sursele', '/api/health', async r => { const j = await r.json(); return j.ok || j.sources.filter(s => !s.ok).map(s => `${s.name} ${s.problem}`).join(', '); }],
  ['Vremea', '/api/weather?lat=25.78&lon=-80.19&brief=1', async r => (await r.json()).places?.[0]?.now?.temp != null || 'fără temperatură'],
  ['Profil de echipă', '/api/team?l=NBA&id=14', async r => ((await r.json()).roster?.length > 0) || 'lot gol'],
  ['Calendar .ics', '/api/calendar.ics?e=heat,NBA-2', async r => (await r.text()).includes('BEGIN:VCALENDAR') || 'nu e iCalendar'],
  ['Notificări', '/api/push', async r => 'publicKey' in (await r.json()) || 'răspuns ciudat'],
  ['Profilurile echipelor', '/data/clubs.json', async r => Object.keys((await r.json()).teams || {}).length > 100 || 'prea puține echipe'],
  ['Orașele și stadioanele', '/data/places.json', async r => !!(await r.json()).cities || 'fără orașe'],
  ['Aplicația (service worker)', '/sw.js', async r => /VERSION = '/.test(await r.text()) || 'fără versiune'],
];

let bad = 0;
console.log(`Verific ${site}\n`);
for (const [name, path, judge] of checks) {
  const t0 = Date.now();
  let verdict;
  try {
    const r = await fetch(site + path, { signal: AbortSignal.timeout(30000) });
    verdict = r.ok ? await judge(r) : `eroare ${r.status}`;
  } catch (e) { verdict = 'nu răspunde (' + (e.message || e) + ')'; }
  const ok = verdict === true;
  if (!ok) bad++;
  console.log(`${ok ? '✓' : '✗'} ${name.padEnd(30)} ${String(Date.now() - t0).padStart(5)} ms${ok ? '' : '  ' + verdict}`);
}
console.log(bad ? `\n${bad} din ${checks.length} nu merg.` : `\nToate cele ${checks.length} merg.`);
process.exit(bad ? 1 : 0);

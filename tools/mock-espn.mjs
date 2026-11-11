// Dev tool: builds ESPN-shaped responses from a data.js file of the old claude.ai calendar
// (constants TEAMS, TABLES, OPP, V, RAW, PAST), and serves them through a fake fetch.
// Used to test the functions offline and to write data/snapshot.json, the page's fallback data.
//
//   node tools/mock-espn.mjs <path/to/data.js> [--snapshot]
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
import { TEAMS as FL, LEAGUES, norm } from '../js/teams.js';

export function loadOld(path) {
  const src = readFileSync(path, 'utf8') + '\n;({UPDATED,TEAMS,TABLES,OPP,V,RAW,PAST,PROB,DETAIL})';
  return vm.runInNewContext(src);
}

export function mockFetch(old) {
  const names = {};           // league -> name -> {id, abbr, color}
  const next = {};
  const flByName = Object.fromEntries(Object.values(FL).map(t => [norm(t.espn), t]));
  const team = (l, name) => {
    const m = (names[l] ||= {});
    if (!m[name]) {
      const f = flByName[norm(name)];
      next[l] = (next[l] || 0) + 1;
      m[name] = { id: String(next[l]), displayName: name, abbreviation: f ? f.ab : name.split(' ').pop().slice(0, 3).toUpperCase(), color: f ? f.col[0].slice(1) : '777777', logos: [] };
    }
    return m[name];
  };
  const oldFl = Object.fromEntries(Object.entries(old.TEAMS).map(([n, t]) => [n, t]));
  for (const n of Object.keys(oldFl)) team(oldFl[n].l, n);

  const events = [];
  const add = (r, played) => {
    const ven = old.V[r[4]] || [r[4] === 'Londra, Anglia' ? 'Tottenham Hotspur Stadium' : '', r[4]];
    const [city, st] = String(ven[1]).split(', ');
    const H = team(r[1], r[2]), A = team(r[1], r[3]);
    const comp = (t, w, s) => ({ homeAway: w, team: t, ...(played ? { score: { value: s, displayValue: String(s) }, winner: null } : {}) });
    events.push({
      l: r[1], ids: [H.id, A.id],
      ev: {
        id: String(events.length + 401000000), date: r[0] + 'Z',
        competitions: [{
          timeValid: !(r[6] === 1 && !played),
          venue: { fullName: ven[0], address: { city, state: st } },
          competitors: [comp(H, 'home', r[5]), comp(A, 'away', r[6])],
          status: { type: { state: played ? 'post' : 'pre', completed: played, shortDetail: played ? 'Final' : '' } },
          notes: !played && r[5] ? [{ headline: r[5] }] : []
        }]
      }
    });
  };
  old.RAW.forEach(r => add(r, false));
  old.PAST.forEach(r => add(r, true));

  const standingsOf = l => {
    const conf = {};
    const put = (name, w, lo, otl, pts, seed, confName) => {
      (conf[confName] ||= []).push({ team: team(l, name), stats: [
        { name: 'wins', value: w }, { name: 'losses', value: lo },
        ...(otl != null ? [{ name: 'otLosses', value: otl }] : []),
        ...(pts != null ? [{ name: 'points', value: pts }] : []),
        { name: 'playoffSeed', value: seed }
      ] });
    };
    for (const [n, t] of Object.entries(old.TEAMS)) {
      if (t.l !== l) continue;
      const p = t.rec.split('–').map(Number);
      const cn = l === 'NFL' ? t.confN : t.confN === 'Est' ? 'Eastern Conference' : 'Western Conference';
      if (l === 'MLS') put(n, p[0], p[1], null, Number(t.div), Number(t.conf), cn);
      else put(n, p[0], p[1], l === 'NHL' ? p[2] : null, null, Number(t.conf), cn);
      const e = conf[cn][conf[cn].length - 1];
      if (l === 'MLS') e.stats.push({ name: 'ties', value: p[2] });
      if (t.home) e.stats.push({ name: 'Home', type: 'home', summary: t.home.replace('–', '-') }, { name: 'Road', type: 'road', summary: t.away.replace('–', '-') });
      e.stats.push({ name: 'streak', displayValue: t.streak });
    }
    for (const [n, o] of Object.entries(old.OPP)) {
      if (team(l, n) && !events.some(x => x.l === l && x.ids.includes(names[l][n].id))) continue;
      if (Object.values(conf).flat().some(e => e.team.displayName === n)) continue;
      const [rk, cf] = o[1].split(' ');
      const p = o[0].split('–').map(Number);
      const cn = l === 'NFL' ? cf : cf === 'Est' ? 'Eastern Conference' : 'Western Conference';
      put(n, p[0], p[1], null, l === 'MLS' ? null : null, Number(rk), cn);
    }
    for (const tb of Object.values(old.TABLES)) {
      if (tb.l !== l) continue;
      for (const r of tb.r) {
        if (Object.values(conf).flat().some(e => norm(e.team.displayName) === norm(r[0]))) continue;
        const cn = l === 'NFL' ? (tb.t.includes('NFC') ? 'NFC' : 'AFC') : 'Eastern Conference';
        if (l === 'MLS') { const p = String(r[1]).split('–').map(Number); put(r[0], p[0], p[1], null, r[2], tb.r.indexOf(r) + 1, cn); }
        else put(r[0], r[1], r[2], null, null, 99, cn);
      }
    }
    return { children: Object.entries(conf).map(([name, entries]) => ({ name, abbreviation: name.split(' ')[0], standings: { entries: entries.sort((a, b) => a.stats.find(s => s.name === 'playoffSeed').value - b.stats.find(s => s.name === 'playoffSeed').value) } })) };
  };

  const calls = [];
  const fetchMock = async url => {
    calls.push(url);
    const u = new URL(url);
    const p = u.pathname;
    const l = Object.keys(LEAGUES).find(k => p.includes('/' + LEAGUES[k].path + '/'));
    let body;
    if (/\/teams$/.test(p)) body = { sports: [{ leagues: [{ teams: Object.values(names[l] || {}).map(t => ({ team: t })) }] }] };
    else if (/\/teams\/\d+\/schedule$/.test(p)) {
      const id = p.split('/').at(-2);
      if (u.searchParams.get('seasontype') === '3' || u.searchParams.has('fixture')) body = { events: [], team: {} };
      else {
        const name = Object.keys(names[l]).find(n => names[l][n].id === id);
        const ot = old.TEAMS[name] || {};
        body = { team: { recordSummary: ot.rec, standingSummary: ot.conf ? `${ot.conf}th in ${ot.confN}` : '' }, events: events.filter(e => e.l === l && e.ids.includes(id)).map(e => e.ev) };
      }
    } else if (/\/standings$/.test(p)) body = standingsOf(l);
    else return new Response('not mocked', { status: 404 });
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { fetchMock, calls };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const old = loadOld(process.argv[2]);
  const { fetchMock, calls } = mockFetch(old);
  globalThis.fetch = fetchMock;
  const { buildSchedule } = await import('../netlify/functions/schedule.mjs');
  const out = await buildSchedule();
  out.updated = old.UPDATED + 'T06:00:00.000Z';
  out.source = 'snapshot';
  console.log(`requests ${calls.length}, games ${out.games.length}, teams ${Object.keys(out.teams).length}, errors ${out.errors.length}`, out.errors);
  if (process.argv.includes('--snapshot')) {
    writeFileSync(new URL('../data/snapshot.json', import.meta.url), JSON.stringify(out));
    console.log('wrote data/snapshot.json');
  }
}

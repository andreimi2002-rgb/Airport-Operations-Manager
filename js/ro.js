// Romanian wording for the English strings that come from ESPN: game status, notes, stats, injuries.
// Pure functions, no DOM: the page uses them and tools/test.mjs checks them in Node.
// Anything not recognised is returned unchanged, so a new ESPN wording shows in English instead of breaking.

const ORD = { '1st': 1, '2nd': 2, '3rd': 3, '4th': 4, '5th': 5 };
const PERIOD = { NBA: 'sfertul', NFL: 'sfertul', NHL: 'repriza', MLS: 'repriza', MLB: 'repriza' };
const periodName = (l, n) => {
  const p = PERIOD[l] || 'perioada';
  return `${p[0].toUpperCase() + p.slice(1)} ${n}`;
};
const endOf = (l, n) => (PERIOD[l] === 'sfertul' ? `Finalul sfertului ${n}` : `Finalul reprizei ${n}`);
const otN = s => { const n = parseInt(s, 10); return n > 1 ? ` ${n}` : ''; };

// "7:21 - 3rd" -> "Sfertul 3 · 7:21", "Final/OT" -> "Final după prelungiri", "HT" -> "Pauză"…
export function detailRo(d, l) {
  const s = String(d || '').trim();
  if (!s) return '';
  let m;
  if (/^(final|ft|full time|full-time)$/i.test(s)) return 'Final';
  if ((m = s.match(/^final\s*\/\s*(\d*)\s*OT$/i))) return 'Final după prelungiri' + (m[1] > 1 ? ` (${m[1]})` : '');
  if (/^final\s*\/\s*SO$/i.test(s)) return 'Final după lovituri de departajare';
  // Baseball: "Final/11", "Top 5th", "Bot 7th", "Mid 3rd", "End 6th".
  if ((m = s.match(/^final\s*\/\s*(\d+)$/i))) return `Final după ${m[1]} inning-uri`;
  if ((m = s.match(/^(top|bot|bottom|mid|middle|end)\s+(\d+)(?:st|nd|rd|th)$/i))) {
    const k = m[1].toLowerCase(), n = m[2];
    return k === 'top' ? `Inning-ul ${n}, prima parte` : k.startsWith('bot') ? `Inning-ul ${n}, a doua parte` : k.startsWith('mid') ? `Pauză în inning-ul ${n}` : `Finalul inning-ului ${n}`;
  }
  if (/^(AET|FT-AET|final\s*\/\s*AET)$/i.test(s)) return 'Final după prelungiri';
  if (/pens|penalties|FT-Pens/i.test(s) && /^(final|ft|aet|ft-pens)/i.test(s)) return 'Final după lovituri de la 11 metri';
  if (/^(HT|half|halftime|half-time)$/i.test(s)) return 'Pauză';
  if (/^end of (\d*)\s*OT$/i.test(s)) return 'Finalul prelungirilor';
  if ((m = s.match(/^end of (?:the )?(\d)(?:st|nd|rd|th)(?: (?:period|quarter|qtr|inning))?$/i))) return endOf(l, m[1]);
  if ((m = s.match(/^(\d)(?:st|nd|rd|th) (?:period |quarter )?intermission$/i))) return `Pauză după ${PERIOD[l] === 'sfertul' ? 'sfertul' : 'repriza'} ${m[1]}`;
  if (/intermission/i.test(s)) return 'Pauză';
  if ((m = s.match(/^([\d:.]+)\s*-\s*(\d)(st|nd|rd|th)(?: (?:period|quarter|qtr))?$/i))) return `${periodName(l, m[2])} · ${m[1]}`;
  if ((m = s.match(/^([\d:.]+)\s*-\s*(\d*)\s*OT$/i))) return `Prelungiri${otN(m[2])} · ${m[1]}`;
  if ((m = s.match(/^(\d)(st|nd|rd|th) (half|period|quarter)$/i))) return periodName(l, m[1]);
  if ((m = s.match(/^(\d*)\s*OT$/i))) return 'Prelungiri' + otN(m[1]);
  if (/^(SO|shootout)$/i.test(s)) return 'Lovituri de departajare';
  if (/^postponed$/i.test(s)) return 'Amânat';
  if (/^(canceled|cancelled)$/i.test(s)) return 'Anulat';
  if (/^(suspended)$/i.test(s)) return 'Suspendat';
  if (/^(delayed|delay|start delayed|rain delay|weather delay)$/i.test(s)) return 'Întârziat';
  if (/^(forfeit)$/i.test(s)) return 'Neprezentare';
  if (/^\d+'(\s*\+\s*\d+'?)?$/.test(s)) return s.replace(/\s+/g, '');        // 67', 45'+2'
  if (/^(TBD)$/i.test(s)) return 'Oră neanunțată';
  return s;
}

// Notes such as "NBA Cup - Group Play", "East 1st Round - Game 3", "AFC Wild Card".
const NOTE_RULES = [
  [/\bNBA Cup\b/gi, 'Cupa NBA'], [/\bEmirates NBA Cup\b/gi, 'Cupa NBA'],
  [/\bGroup Play\b/gi, 'faza grupelor'], [/\bQuarterfinals?\b/gi, 'sferturi de finală'],
  [/\bSemifinals?\b/gi, 'semifinale'], [/\bChampionship\b/gi, 'finala'],
  [/\bNBA Finals\b/gi, 'Finala NBA'], [/\bStanley Cup Final\b/gi, 'Finala Cupei Stanley'],
  [/\bConference Finals?\b/gi, 'finala conferinței'], [/\bConference Semifinals?\b/gi, 'semifinala conferinței'],
  [/\b1st Round\b/gi, 'runda 1'], [/\b2nd Round\b/gi, 'runda 2'], [/\bFirst Round\b/gi, 'runda 1'], [/\bSecond Round\b/gi, 'runda 2'],
  [/\bRound One\b/gi, 'runda 1'], [/\bRound Two\b/gi, 'runda 2'],
  [/\bPlay-In Tournament\b/gi, 'turneul play-in'], [/\bPlay-In\b/gi, 'play-in'],
  [/\bWild Card( Round)?\b/gi, 'wild card'], [/\bDivisional Round\b/gi, 'runda divizională'],
  [/\bSuper Bowl\b/gi, 'Super Bowl'], [/\bMLS Cup\b/gi, 'MLS Cup'], [/\bMLS Is Back\b/gi, 'MLS Is Back'],
  [/\bBest of (\d)\b/gi, 'cel mai bun din $1'], [/\bGame (\d+)\b/gi, 'meciul $1'],
  [/\bEastern Conference Playoffs\b ?/gi, 'Playoff Est · '], [/\bWestern Conference Playoffs\b ?/gi, 'Playoff Vest · '],
  [/\bEastern Conference\b/gi, 'Conferința de Est'], [/\bWestern Conference\b/gi, 'Conferința de Vest'],
  [/\bPlayoffs\b/gi, 'playoff'],
  [/\bEast\b/g, 'Est'], [/\bWest\b/g, 'Vest'],
  [/\bPreseason\b/gi, 'amical de pregătire'], [/\bRegular Season\b/gi, 'sezon regulat'],
  [/\bInternational Series\b/gi, 'meci în străinătate'], [/\bNeutral Site\b/gi, 'teren neutru'],
  [/\bThanksgiving\b/gi, 'Ziua Recunoștinței'], [/\bChristmas Day\b/gi, 'Crăciun'],
  [/\bin London\b/gi, 'la Londra'], [/\bin Mexico City\b/gi, 'la Ciudad de México']
];
export function noteRo(n) {
  let s = String(n || '').trim();
  if (!s) return '';
  for (const [re, to] of NOTE_RULES) s = s.replace(re, to);
  s = s.replace(/\s+-\s+/g, ' · ');
  return s[0].toUpperCase() + s.slice(1);
}

/* ---------- team stats compared side by side ---------- */
// Per league: which ESPN keys to show, in order, the Romanian label and whether lower is better.
// Keys that a game lacks are skipped, so one list covers the pre-game averages and the final numbers.
const pct = { fmt: 'pct' };
export const TEAM_STATS = {
  NBA: [
    ['avgPoints', 'Puncte pe meci'], ['avgPointsAgainst', 'Puncte primite pe meci', { low: true }],
    ['fieldGoalPct', 'Aruncări reușite %', pct], ['threePointFieldGoalPct', 'Aruncări de 3 reușite %', pct],
    ['freeThrowPct', 'Aruncări libere %', pct],
    ['totalRebounds', 'Recuperări'], ['avgRebounds', 'Recuperări pe meci'], ['offensiveRebounds', 'Recuperări în atac'],
    ['assists', 'Pase decisive'], ['avgAssists', 'Pase decisive pe meci'],
    ['steals', 'Mingi furate'], ['avgSteals', 'Mingi furate pe meci'], ['blocks', 'Capace'], ['avgBlocks', 'Capace pe meci'],
    ['totalTurnovers', 'Mingi pierdute', { low: true }], ['avgTotalTurnovers', 'Mingi pierdute pe meci', { low: true }],
    ['pointsInPaint', 'Puncte din zona de sub coș'], ['fastBreakPoints', 'Puncte din contraatac'],
    ['turnoverPoints', 'Puncte din mingi pierdute de adversar'], ['largestLead', 'Cel mai mare avantaj'],
    ['fouls', 'Faulturi', { low: true }]
  ],
  NHL: [
    ['avgGoals', 'Goluri marcate pe meci'], ['avgGoalsAgainst', 'Goluri primite pe meci', { low: true }],
    ['shotsTotal', 'Șuturi pe poartă'], ['avgShots', 'Șuturi pe meci'], ['avgShotsAgainst', 'Șuturi primite pe meci', { low: true }],
    ['powerPlayGoals', 'Goluri în superioritate'], ['powerPlayOpportunities', 'Situații de superioritate'],
    ['powerPlayPct', 'Eficiență în superioritate %', pct], ['penaltyKillPct', 'Eficiență în inferioritate %', pct],
    ['shortHandedGoals', 'Goluri în inferioritate'],
    ['faceoffPercent', 'Bully-uri câștigate %', pct], ['hits', 'Body-check-uri'], ['blockedShots', 'Șuturi blocate'],
    ['takeaways', 'Pucuri recuperate'], ['giveaways', 'Pucuri pierdute', { low: true }],
    ['penaltyMinutes', 'Minute de penalizare', { low: true }]
  ],
  NFL: [
    ['totalYards', 'Yarzi în total'], ['netPassingYards', 'Yarzi din pase'], ['rushingYards', 'Yarzi din alergare'],
    ['yardsPerPlay', 'Yarzi pe fază'], ['firstDowns', 'First down-uri'],
    ['thirdDownEff', 'Conversii la încercarea a 3-a', { fmt: 'ratio' }], ['fourthDownEff', 'Conversii la încercarea a 4-a', { fmt: 'ratio' }],
    ['redZoneAttempts', 'Puncte din zona roșie (reușite–încercări)', { fmt: 'ratio' }],
    ['completionAttempts', 'Pase reușite / încercate', { fmt: 'ratio' }],
    ['sacksYardsLost', 'Sack-uri suferite', { low: true, fmt: 'first' }],
    ['turnovers', 'Mingi pierdute', { low: true }], ['totalPenaltiesYards', 'Penalizări', { low: true, fmt: 'first' }],
    ['possessionTime', 'Timp de posesie', { fmt: 'clock' }]
  ],
  MLS: [
    ['possessionPct', 'Posesie %', pct], ['totalShots', 'Șuturi'], ['shotsOnTarget', 'Șuturi pe poartă'],
    ['wonCorners', 'Cornere'], ['saves', 'Parade'], ['passPct', 'Precizia paselor %', pct], ['totalPasses', 'Pase'],
    ['totalCrosses', 'Centrări'], ['totalTackles', 'Deposedări încercate'], ['interceptions', 'Intercepții'],
    ['offsides', 'Ofsaiduri', { low: true }], ['foulsCommitted', 'Faulturi', { low: true }],
    ['yellowCards', 'Cartonașe galbene', { low: true }], ['redCards', 'Cartonașe roșii', { low: true }]
  ]
};

// A stat value -> number for the bar. "3-12" -> 3/12, "31:15" -> seconds, "0.9" (soccer %) -> 90.
export function statNum(v, fmt) {
  const s = String(v ?? '').trim();
  if (!s || s === '--') return null;
  if (fmt === 'clock') { const [m, x] = s.split(':').map(Number); return Number.isFinite(m) ? m * 60 + (x || 0) : null; }
  if (fmt === 'ratio') { const [a, b] = s.split(/[-/]/).map(Number); return b ? a / b : 0; }
  if (fmt === 'first') return parseFloat(s.split(/[-/]/)[0]);
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return fmt === 'pct' && n > 0 && n <= 1 && s.includes('.') ? n * 100 : n;
}
export function statText(v, fmt) {
  const s = String(v ?? '').trim();
  if (fmt === 'pct') { const n = statNum(s, 'pct'); return n == null ? s : (Math.round(n * 10) / 10).toLocaleString('ro-RO') + '%'; }
  if (fmt === 'ratio' || fmt === 'first') return s.replace('-', '–');
  return s;
}

/* ---------- player tables ---------- */
// Per league and ESPN stat group: [key, short Romanian header, title for the header tooltip/legend].
const P = (k, h, t) => [k, h, t || h];
export const BOX_COLS = {
  NBA: {
    _: [P('minutes', 'Min', 'minute jucate'), P('points', 'Pct', 'puncte'), P('rebounds', 'Rec', 'recuperări'), P('assists', 'PD', 'pase decisive'),
      P('fieldGoalsMade-fieldGoalsAttempted', 'Aruncări', 'aruncări reușite–încercate'), P('threePointFieldGoalsMade-threePointFieldGoalsAttempted', '3 pct', 'aruncări de 3 reușite–încercate'),
      P('freeThrowsMade-freeThrowsAttempted', 'Libere', 'aruncări libere reușite–încercate'), P('steals', 'MF', 'mingi furate'), P('blocks', 'Cap', 'capace'),
      P('turnovers', 'MP', 'mingi pierdute'), P('fouls', 'F', 'faulturi'), P('plusMinus', '+/-', 'diferența de scor cât a fost pe teren')]
  },
  NHL: {
    forwards: 'skaters', defenses: 'skaters',
    skaters: [P('goals', 'G', 'goluri'), P('assists', 'A', 'pase de gol'), P('plusMinus', '+/-', 'diferența de goluri cât a fost pe gheață'),
      P('shotsTotal', 'Ș', 'șuturi pe poartă'), P('hits', 'BC', 'body-check-uri'), P('blockedShots', 'ȘB', 'șuturi blocate'),
      P('faceoffPercent', 'Bully %', 'bully-uri câștigate'), P('timeOnIce', 'Timp', 'timp pe gheață'), P('penaltyMinutes', 'Pen', 'minute de penalizare')],
    goalies: [P('shotsAgainst', 'ȘP', 'șuturi primite'), P('saves', 'Par', 'parade'), P('savePct', 'Par %', 'procent de parade'),
      P('goalsAgainst', 'GP', 'goluri primite'), P('timeOnIce', 'Timp', 'timp pe gheață')]
  },
  NFL: {
    passing: [P('completions/passingAttempts', 'R/Î', 'pase reușite / încercate'), P('passingYards', 'Yarzi'), P('passingTouchdowns', 'TD', 'touchdown-uri'),
      P('interceptions', 'Int', 'pase interceptate'), P('sacks-sackYardsLost', 'Sack', 'sack-uri suferite – yarzi pierduți'), P('QBRating', 'Rating', 'rating de quarterback')],
    rushing: [P('rushingAttempts', 'Alerg.', 'alergări'), P('rushingYards', 'Yarzi'), P('yardsPerRushAttempt', 'Medie', 'yarzi pe alergare'),
      P('rushingTouchdowns', 'TD', 'touchdown-uri'), P('longRushing', 'Max', 'cea mai lungă alergare')],
    receiving: [P('receptions', 'Recep.', 'recepții'), P('receivingTargets', 'Ținte', 'pase spre el'), P('receivingYards', 'Yarzi'),
      P('receivingTouchdowns', 'TD', 'touchdown-uri'), P('longReception', 'Max', 'cea mai lungă recepție')],
    defensive: [P('totalTackles', 'Plac.', 'placaje'), P('soloTackles', 'Singur', 'placaje fără ajutor'), P('sacks', 'Sack', 'sack-uri'),
      P('tacklesForLoss', 'Plac. −', 'placaje cu pierdere de teren'), P('passesDefended', 'Pase ap.', 'pase apărate'), P('QBHits', 'QB', 'lovituri pe quarterback')],
    interceptions: [P('interceptions', 'Int', 'pase interceptate'), P('interceptionYards', 'Yarzi'), P('interceptionTouchdowns', 'TD', 'touchdown-uri')],
    fumbles: [P('fumbles', 'Scăpări', 'mingi scăpate'), P('fumblesLost', 'Pierdute', 'mingi scăpate și pierdute'), P('fumblesRecovered', 'Recup.', 'mingi recuperate')],
    kicking: [P('fieldGoalsMade/fieldGoalAttempts', 'FG', 'field goal-uri reușite / încercate'), P('longFieldGoalMade', 'Max', 'cel mai lung field goal'),
      P('extraPointsMade/extraPointAttempts', 'PE', 'puncte suplimentare reușite / încercate'), P('totalKickingPoints', 'Pct', 'puncte')],
    punting: [P('punts', 'Nr.', 'degajări'), P('grossAvgPuntYards', 'Medie', 'yarzi pe degajare'), P('puntsInside20', 'În 20', 'degajări în ultimele 20 de yarzi'), P('longPunt', 'Max')],
    kickReturns: [P('kickReturns', 'Nr.', 'returnări'), P('kickReturnYards', 'Yarzi'), P('longKickReturn', 'Max'), P('kickReturnTouchdowns', 'TD')],
    puntReturns: [P('puntReturns', 'Nr.', 'returnări'), P('puntReturnYards', 'Yarzi'), P('longPuntReturn', 'Max'), P('puntReturnTouchdowns', 'TD')]
  },
  MLB: {
    batting: [P('hits-atBats', 'L-B', 'lovituri bune – bătăi'), P('runs', 'P', 'puncte (run-uri)'), P('RBIs', 'RBI', 'puncte aduse coechipierilor'),
      P('homeRuns', 'HR', 'home run-uri'), P('walks', 'BB', 'ajunsuri pe bază din 4 aruncări greșite'), P('strikeouts', 'K', 'strikeout-uri'), P('avg', 'Medie', 'medie la bătaie în sezon')],
    pitching: [P('fullInnings.partInnings', 'Inn.', 'inning-uri aruncate'), P('hits', 'L', 'lovituri primite'), P('earnedRuns', 'PM', 'puncte primite din vina aruncătorului'),
      P('walks', 'BB', 'ajunsuri pe bază acordate'), P('strikeouts', 'K', 'strikeout-uri'), P('pitches', 'Arunc.', 'aruncări'), P('ERA', 'ERA', 'puncte primite la 9 inning-uri, în sezon')]
  },
  MLS: {
    soccer: [P('totalGoals', 'G', 'goluri'), P('goalAssists', 'PG', 'pase de gol'), P('totalShots', 'Ș', 'șuturi'), P('shotsOnTarget', 'ȘP', 'șuturi pe poartă'),
      P('foulsCommitted', 'F', 'faulturi'), P('yellowCards', 'CG', 'cartonașe galbene'), P('redCards', 'CR', 'cartonașe roșii')],
    keeper: [P('shotsFaced', 'ȘP', 'șuturi pe poartă primite'), P('goalsConceded', 'GP', 'goluri primite')]
  }
};
export const NFL_GROUP = {
  passing: 'Pase', rushing: 'Alergări', receiving: 'Recepții', defensive: 'Apărare', interceptions: 'Interceptări',
  fumbles: 'Mingi scăpate', kicking: 'Lovituri la poartă', punting: 'Degajări', kickReturns: 'Returnări de kick-off', puntReturns: 'Returnări de degajări'
};
export function boxCols(l, group) {
  const L = BOX_COLS[l] || {};
  let c = L[group] ?? L._;
  if (typeof c === 'string') c = L[c];
  return c || null;
}

/* ---------- injuries ---------- */
const INJ_STATUS = [
  [/^out$/i, 'Absent'], [/day[- ]to[- ]day/i, 'Incert'], [/questionable/i, 'Incert'],
  [/doubtful/i, 'Puțin probabil să joace'], [/probable/i, 'Probabil joacă'], [/injured reserve|^ir$/i, 'Accidentat pe termen lung'],
  [/suspen/i, 'Suspendat'], [/physically unable|pup/i, 'Indisponibil fizic'], [/non[- ]football/i, 'Indisponibil'],
  [/game ?time/i, 'Decizie în ziua meciului'], [/inactive/i, 'Inactiv'], [/day/i, 'Incert']
];
export const injStatusRo = s => { for (const [re, t] of INJ_STATUS) if (re.test(s || '')) return t; return s || ''; };
export const injSerious = s => /^out$|injured reserve|^ir$|suspen|physically/i.test(s || '');
const BODY = {
  knee: 'genunchi', ankle: 'gleznă', hamstring: 'ischiogambieri', foot: 'laba piciorului', back: 'spate', 'lower back': 'zona lombară',
  shoulder: 'umăr', groin: 'zona inghinală', hip: 'șold', concussion: 'comoție cerebrală', illness: 'boală', calf: 'gambă', wrist: 'încheietura mâinii',
  hand: 'mână', toe: 'deget de la picior', achilles: 'tendonul lui Ahile', elbow: 'cot', thigh: 'coapsă', quadriceps: 'cvadriceps', neck: 'gât',
  rest: 'odihnă', personal: 'motive personale', 'upper body': 'partea superioară a corpului', 'lower body': 'partea inferioară a corpului',
  finger: 'deget', thumb: 'degetul mare', head: 'cap', ribs: 'coaste', chest: 'piept', abdomen: 'abdomen', abdominal: 'abdomen', oblique: 'mușchi oblici',
  biceps: 'biceps', triceps: 'triceps', pectoral: 'pectoral', face: 'față', eye: 'ochi', jaw: 'maxilar', nose: 'nas', leg: 'picior', arm: 'braț',
  undisclosed: 'nespecificat', 'not specified': 'nespecificat', shin: 'tibie', heel: 'călcâi', fibula: 'peroneu', tibia: 'tibie', pelvis: 'bazin',
  spine: 'coloană', collarbone: 'claviculă', clavicle: 'claviculă', 'plantar fascia': 'fascia plantară', mcl: 'ligament colateral (MCL)', acl: 'ligament încrucișat (ACL)',
  covid: 'COVID-19', 'g league': 'trimis în G League', 'two-way': 'contract two-way', conditioning: 'pregătire fizică', 'not injury related': 'motive care nu țin de accidentare',
  strain: 'întindere', sprain: 'entorsă', fracture: 'fractură', surgery: 'operație', inflammation: 'inflamație', soreness: 'dureri', contusion: 'contuzie', torn: 'ruptură', tear: 'ruptură', bruise: 'contuzie'
};
// "partea stângă/dreaptă" agrees with any body part, unlike an adjective (gleznă dreaptă, genunchi drept).
const SIDE = { left: 'partea stângă', right: 'partea dreaptă' };
export function bodyRo(what, detail, side) {
  const w = BODY[String(what || '').toLowerCase()] || what || '';
  const d = BODY[String(detail || '').toLowerCase()] || (detail && !/not specified/i.test(detail) ? detail : '');
  const sd = SIDE[String(side || '').toLowerCase()] || '';
  return [w + (sd && w ? ` (${sd})` : ''), d].filter(Boolean).join(', ');
}

/* ---------- leaders ---------- */
const CAT_RO = {
  points: 'Puncte', rebounds: 'Recuperări', assists: 'Pase decisive', goals: 'Goluri', 'passing yards': 'Yarzi din pase',
  'rushing yards': 'Yarzi din alergare', 'receiving yards': 'Yarzi la recepție', saves: 'Parade', 'save percentage': 'Procent de parade',
  steals: 'Mingi furate', blocks: 'Capace', shots: 'Șuturi', 'plus/minus': '+/-', sacks: 'Sack-uri', tackles: 'Placaje',
  'goals against average': 'Goluri primite în medie', 'shots on goal': 'Șuturi pe poartă', 'points per game': 'Puncte pe meci',
  'rebounds per game': 'Recuperări pe meci', 'assists per game': 'Pase decisive pe meci', 'goal assists': 'Pase de gol',
  'shots on target': 'Șuturi pe poartă', 'quarterback rating': 'Rating de quarterback', 'passing leader': 'Pase',
  'rushing leader': 'Alergări', 'receiving leader': 'Recepții', 'sacks leader': 'Sack-uri', 'tackles leader': 'Placaje',
  'interceptions': 'Interceptări', 'time on ice': 'Timp pe gheață', 'power play goals': 'Goluri în superioritate', rating: 'Rating',
  'total shots': 'Șuturi', 'accurate passes': 'Pase reușite', 'defensive interventions': 'Intervenții defensive',
  'goals scored': 'Goluri', 'key passes': 'Pase decisive spre șut', 'tackles won': 'Deposedări reușite', 'clearances': 'Degajări',
  'passing': 'Pase', 'rushing': 'Alergări', 'receiving': 'Recepții', 'receptions': 'Recepții', 'field goal percentage': 'Aruncări reușite %',
  'three point percentage': 'Aruncări de 3 reușite %', 'blocked shots': 'Șuturi blocate', 'hits': 'Body-check-uri', 'faceoffs won': 'Bully-uri câștigate'
};
export const catRo = c => CAT_RO[String(c || '').toLowerCase().trim()] || c;

// Leader values such as "Matches: 31, Goals: 26" -> "26 de goluri în 31 de meciuri".
const VAL_WORD = { goals: ['gol', 'goluri'], assists: ['pasă decisivă', 'pase decisive'], matches: ['meci', 'meciuri'], games: ['meci', 'meciuri'], shots: ['șut', 'șuturi'], saves: ['paradă', 'parade'], appearances: ['meci', 'meciuri'] };
const count = (n, [one, many]) => (n === 1 ? `1 ${one}` : `${n}${n % 100 >= 20 || n % 100 === 0 && n ? ' de' : ''} ${many}`);
export function leaderValRo(v) {
  const pairs = [...String(v || '').matchAll(/([A-Za-z]+):\s*(\d+)/g)].map(m => [m[1].toLowerCase(), +m[2]]);
  if (!pairs.length || pairs.some(([k]) => !VAL_WORD[k])) return v;
  const games = pairs.find(([k]) => k === 'matches' || k === 'games' || k === 'appearances'), rest = pairs.filter(p => p !== games);
  const main = rest.map(([k, n]) => count(n, VAL_WORD[k])).join(', ');
  return games && main ? `${main} în ${count(games[1], VAL_WORD[games[0]])}` : main || count(games[1], VAL_WORD[games[0]]);
}

// NBA "did not play" reasons, e.g. "COACH'S DECISION", "INJURY/ILLNESS - LEFT KNEE; SPRAIN".
export function dnpRo(r) {
  const s = String(r || '');
  if (!s) return '';
  if (/coach/i.test(s)) return 'decizia antrenorului';
  if (/injur|illness/i.test(s)) return 'accidentare sau boală';
  if (/not with team/i.test(s)) return 'nu e cu echipa';
  if (/suspen/i.test(s)) return 'suspendat';
  if (/g league|two-way/i.test(s)) return 'în G League';
  if (/personal/i.test(s)) return 'motive personale';
  if (/rest/i.test(s)) return 'odihnă';
  return s.toLowerCase();
}

/* ---------- plays ---------- */
const NFL_KIND = {
  TD: 'Touchdown', FG: 'Field goal', SF: 'Safety', XP: 'Punct suplimentar', '2PT': 'Conversie de 2 puncte', D2P: 'Conversie de 2 puncte în apărare',
  'Passing Touchdown': 'Touchdown din pasă', 'Rushing Touchdown': 'Touchdown din alergare', 'Field Goal Good': 'Field goal',
  'Interception Return Touchdown': 'Touchdown din interceptare', 'Fumble Return Touchdown': 'Touchdown din minge recuperată', 'Safety': 'Safety',
  'Punt Return Touchdown': 'Touchdown din returnare', 'Kickoff Return Touchdown': 'Touchdown din returnare', 'Blocked Punt Touchdown': 'Touchdown din degajare blocată'
};
export const nflKindRo = k => NFL_KIND[k] || k || '';
// "Jahmyr Gibbs 3 Yd Run (Jake Bates Kick)" -> "Jahmyr Gibbs, alergare de 3 yarzi (transformare Jake Bates)"
export function nflPlayRo(t) {
  return String(t || '')
    .replace(/(\d+) (?:Yd|Yard|Yds) (?:Run|Rush)/gi, 'alergare de $1 yarzi')
    .replace(/(\d+) (?:Yd|Yard|Yds) pass from ([^(,]+)/gi, 'pasă de $1 yarzi de la $2')
    .replace(/(\d+) (?:Yd|Yard|Yds) Field Goal/gi, 'field goal de la $1 yarzi')
    .replace(/(\d+) (?:Yd|Yard|Yds) (Interception|Fumble|Punt|Kickoff|Blocked Punt|Blocked FG) Return/gi, (m, n, k) =>
      `returnare de ${n} yarzi ${{ interception: 'după interceptare', fumble: 'după minge scăpată', punt: 'după degajare', kickoff: 'după kick-off', 'blocked punt': 'după degajare blocată', 'blocked fg': 'după field goal blocat' }[k.toLowerCase()]}`)
    .replace(/(\d+) (?:Yd|Yard|Yds) Fumble Recovery/gi, 'minge recuperată, $1 yarzi')
    .replace(/\(([^)]+?) Kick\)/gi, '(transformare $1)')
    .replace(/\(([^)]+?) (?:Pass|Run) (?:to [^)]+ )?for Two-Point Conversion\)/gi, '(conversie de 2 puncte)')
    .replace(/\(two-point (?:pass|run) conversion failed\)/gi, '(conversie de 2 puncte ratată)')
    .replace(/\(([^)]+?) PAT failed\)/gi, '(transformare ratată)')
    .replace(/ (?=(alergare|pasă|field goal|returnare|minge recuperată) )/i, ', ')
    .replace(/\s+/g, ' ').trim();
}

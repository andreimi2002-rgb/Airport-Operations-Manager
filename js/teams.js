// Shared configuration: used by the page (browser) and by the Netlify functions (Node).
// Facts that do not change during a season live here; everything else comes from the data functions.

export const LEAGUES = {
  NBA: { path: 'basketball/nba', color: 'var(--nba)', dur: 150 },
  NHL: { path: 'hockey/nhl', color: 'var(--nhl)', dur: 155 },
  NFL: { path: 'football/nfl', color: 'var(--nfl)', dur: 195 },
  MLS: { path: 'soccer/usa.1', color: 'var(--mls)', dur: 115 },
  MLB: { path: 'baseball/mlb', color: 'var(--mlb)', dur: 180, off: true }
};

// key -> team. `espn` is the team's displayName on ESPN, used to find its id.
// `col` is the fallback emblem colour when the logo cannot load.
export const TEAMS = {
  heat: {
    l: 'NBA', espn: 'Miami Heat', s: 'Heat', ab: 'MIA', col: ['#98002E', '#ffffff'], metro: 'mia',
    city: 'Miami', arena: 'Kaseya Center', cap: 'aprox. 19.600', since: '1988',
    titles: '3 titluri NBA (2006, 2012, 2013)', rivals: 'Orlando Magic, New York Knicks, Boston Celtics',
    fact: 'Arena e pe malul golfului Biscayne, în centrul orașului Miami.'
  },
  magic: {
    l: 'NBA', espn: 'Orlando Magic', s: 'Magic', ab: 'ORL', col: ['#0077C0', '#ffffff'], metro: 'orl',
    city: 'Orlando', arena: 'Kia Center', cap: 'aprox. 18.800', since: '1989',
    titles: 'Niciun titlu; finale NBA în 1995 și 2009', rivals: 'Miami Heat',
    fact: 'Numele vine de la Magic Kingdom, parcul Disney de lângă Orlando.'
  },
  panthers: {
    l: 'NHL', espn: 'Florida Panthers', s: 'Panthers', ab: 'FLA', col: ['#C8102E', '#ffffff'], metro: 'mia',
    city: 'Sunrise (zona Miami–Fort Lauderdale)', arena: 'Amerant Bank Arena', cap: 'aprox. 19.250', since: '1993',
    titles: 'Cupa Stanley în 2024 și 2025', rivals: 'Tampa Bay Lightning',
    fact: 'Fanii aruncă șobolani de plastic pe gheață după victorii, tradiție din 1996.'
  },
  lightning: {
    l: 'NHL', espn: 'Tampa Bay Lightning', s: 'Lightning', ab: 'TB', col: ['#002868', '#ffffff'], metro: 'tpa',
    city: 'Tampa', arena: 'Benchmark International Arena', cap: 'aprox. 19.100', since: '1992',
    titles: 'Cupa Stanley în 2004, 2020 și 2021', rivals: 'Florida Panthers',
    fact: 'În arenă sunt bobine Tesla care scot fulgere reale la fiecare gol al gazdelor.'
  },
  dolphins: {
    l: 'NFL', espn: 'Miami Dolphins', s: 'Dolphins', ab: 'MIA', col: ['#008E97', '#ffffff'], metro: 'mia',
    city: 'Miami Gardens', arena: 'Hard Rock Stadium', cap: 'aprox. 65.000', since: '1966',
    titles: '2 Super Bowl (VII, VIII)', rivals: 'Buffalo Bills, New York Jets, New England Patriots',
    fact: 'Singura echipă din NFL cu un sezon perfect: 17–0 în 1972.'
  },
  bucs: {
    l: 'NFL', espn: 'Tampa Bay Buccaneers', s: 'Buccaneers', ab: 'TB', col: ['#D50A0A', '#ffffff'], metro: 'tpa',
    city: 'Tampa', arena: 'Raymond James Stadium', cap: 'aprox. 69.000', since: '1976',
    titles: '2 Super Bowl (XXXVII, LV)', rivals: 'New Orleans Saints, Atlanta Falcons, Carolina Panthers',
    fact: 'Pe stadion e o corabie de pirați care trage cu tunurile la fiecare touchdown.'
  },
  jaguars: {
    l: 'NFL', espn: 'Jacksonville Jaguars', s: 'Jaguars', ab: 'JAX', col: ['#006778', '#ffffff'], metro: 'jax',
    city: 'Jacksonville', arena: 'EverBank Stadium', cap: 'redusă în 2026, stadionul e în renovare', since: '1995',
    titles: 'Niciun Super Bowl', rivals: 'Tennessee Titans, Houston Texans, Indianapolis Colts',
    fact: 'Joacă aproape în fiecare an meciuri „acasă” la Londra.'
  },
  intermiami: {
    l: 'MLS', espn: 'Inter Miami CF', s: 'Inter Miami', ab: 'MIA', col: ['#F7B5CD', '#231F20'], metro: 'mia',
    city: 'Miami', arena: 'Nu Stadium', cap: 'stadion nou, deschis în 2026', since: '2020',
    titles: 'MLS Cup 2025, Supporters’ Shield 2024, Leagues Cup 2023', rivals: 'Orlando City SC',
    fact: 'Campioana en-titre din MLS, cu Lionel Messi în echipă.'
  },
  orlandocity: {
    l: 'MLS', espn: 'Orlando City SC', s: 'Orlando City', ab: 'ORL', col: ['#633492', '#FDE192'], metro: 'orl',
    city: 'Orlando', arena: 'Inter&Co Stadium', cap: 'aprox. 25.500', since: '2015',
    titles: 'U.S. Open Cup 2022', rivals: 'Inter Miami CF',
    fact: 'Poreclită „The Lions”; culoarea clubului e movul.'
  }
};

// Division tables shown on the page. Members are ESPN display names.
export const DIVISIONS = {
  SE: { l: 'NBA', t: 'NBA · Southeast', members: ['Atlanta Hawks', 'Charlotte Hornets', 'Miami Heat', 'Orlando Magic', 'Washington Wizards'] },
  ATL: { l: 'NHL', t: 'NHL · Atlantic', members: ['Boston Bruins', 'Buffalo Sabres', 'Detroit Red Wings', 'Florida Panthers', 'Montreal Canadiens', 'Ottawa Senators', 'Tampa Bay Lightning', 'Toronto Maple Leafs'] },
  AFCE: { l: 'NFL', t: 'NFL · AFC East', members: ['Buffalo Bills', 'Miami Dolphins', 'New England Patriots', 'New York Jets'] },
  NFCS: { l: 'NFL', t: 'NFL · NFC South', members: ['Atlanta Falcons', 'Carolina Panthers', 'New Orleans Saints', 'Tampa Bay Buccaneers'] },
  AFCS: { l: 'NFL', t: 'NFL · AFC South', members: ['Houston Texans', 'Indianapolis Colts', 'Jacksonville Jaguars', 'Tennessee Titans'] },
  MLSE: { l: 'MLS', t: 'MLS · Conferința de Est', conference: 'east' }
};
export const DIVISION_OF = { heat: 'SE', magic: 'SE', panthers: 'ATL', lightning: 'ATL', dolphins: 'AFCE', bucs: 'NFCS', jaguars: 'AFCS', intermiami: 'MLSE', orlandocity: 'MLSE' };

export const METROS = {
  jax: { n: 'Jacksonville', lat: 30.33, lon: -81.66, lx: -10, ly: -12, anc: 'end' },
  orl: { n: 'Orlando', lat: 28.54, lon: -81.38, lx: 14, ly: 4, anc: 'start' },
  tpa: { n: 'Tampa', lat: 27.95, lon: -82.46, lx: -14, ly: 4, anc: 'end' },
  mia: { n: 'Miami și sudul Floridei', short: 'Miami', lat: 25.95, lon: -80.25, lx: -14, ly: 4, anc: 'end' }
};

// Lowercase, no accents: "Montréal Canadiens" and "Montreal Canadiens" compare equal.
export const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

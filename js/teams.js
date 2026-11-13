// Shared configuration: used by the page (browser) and by the Netlify functions (Node).
// Facts that do not change during a season live here; everything else comes from the data functions.

export const LEAGUES = {
  NBA: { path: 'basketball/nba', color: 'var(--nba)', dur: 150 },
  NHL: { path: 'hockey/nhl', color: 'var(--nhl)', dur: 155 },
  NFL: { path: 'football/nfl', color: 'var(--nfl)', dur: 195 },
  MLS: { path: 'soccer/usa.1', color: 'var(--mls)', dur: 115 },
  // MLB plays March–October; the page marks it "extrasezon" by itself when no games are near.
  MLB: { path: 'baseball/mlb', color: 'var(--mlb)', dur: 180 }
};

// key -> team. `espn` is the team's displayName on ESPN, used to find its id.
// `col` is the fallback emblem colour when the logo cannot load; `st` the state the team plays home games in.
// Two packs of default teams: Florida (the owner's) and New York (everyone else); see PACKS below.
const FLORIDA = {
  heat: {
    l: 'NBA', espn: 'Miami Heat', s: 'Heat', ab: 'MIA', col: ['#98002E', '#ffffff'], metro: 'mia', st: 'FL',
    city: 'Miami', arena: 'Kaseya Center', cap: 'aprox. 19.600', since: '1988',
    titles: '3 titluri NBA (2006, 2012, 2013)', rivals: 'Orlando Magic, New York Knicks, Boston Celtics',
    fact: 'Arena e pe malul golfului Biscayne, în centrul orașului Miami.'
  },
  magic: {
    l: 'NBA', espn: 'Orlando Magic', s: 'Magic', ab: 'ORL', col: ['#0077C0', '#ffffff'], metro: 'orl', st: 'FL',
    city: 'Orlando', arena: 'Kia Center', cap: 'aprox. 18.800', since: '1989',
    titles: 'Niciun titlu; finale NBA în 1995 și 2009', rivals: 'Miami Heat',
    fact: 'Numele vine de la Magic Kingdom, parcul Disney de lângă Orlando.'
  },
  panthers: {
    l: 'NHL', espn: 'Florida Panthers', s: 'Panthers', ab: 'FLA', col: ['#C8102E', '#ffffff'], metro: 'mia', st: 'FL',
    city: 'Sunrise (zona Miami–Fort Lauderdale)', arena: 'Amerant Bank Arena', cap: 'aprox. 19.250', since: '1993',
    titles: 'Cupa Stanley în 2024 și 2025', rivals: 'Tampa Bay Lightning',
    fact: 'Fanii aruncă șobolani de plastic pe gheață după victorii, tradiție din 1996.'
  },
  lightning: {
    l: 'NHL', espn: 'Tampa Bay Lightning', s: 'Lightning', ab: 'TB', col: ['#002868', '#ffffff'], metro: 'tpa', st: 'FL',
    city: 'Tampa', arena: 'Benchmark International Arena', cap: 'aprox. 19.100', since: '1992',
    titles: 'Cupa Stanley în 2004, 2020 și 2021', rivals: 'Florida Panthers',
    fact: 'În arenă sunt bobine Tesla care scot fulgere reale la fiecare gol al gazdelor.'
  },
  dolphins: {
    l: 'NFL', espn: 'Miami Dolphins', s: 'Dolphins', ab: 'MIA', col: ['#008E97', '#ffffff'], metro: 'mia', st: 'FL',
    city: 'Miami Gardens', arena: 'Hard Rock Stadium', cap: 'aprox. 65.000', since: '1966',
    titles: '2 Super Bowl (VII, VIII)', rivals: 'Buffalo Bills, New York Jets, New England Patriots',
    fact: 'Singura echipă din NFL cu un sezon perfect: 17–0 în 1972.'
  },
  bucs: {
    l: 'NFL', espn: 'Tampa Bay Buccaneers', s: 'Buccaneers', ab: 'TB', col: ['#D50A0A', '#ffffff'], metro: 'tpa', st: 'FL',
    city: 'Tampa', arena: 'Raymond James Stadium', cap: 'aprox. 69.000', since: '1976',
    titles: '2 Super Bowl (XXXVII, LV)', rivals: 'New Orleans Saints, Atlanta Falcons, Carolina Panthers',
    fact: 'Pe stadion e o corabie de pirați care trage cu tunurile la fiecare touchdown.'
  },
  jaguars: {
    l: 'NFL', espn: 'Jacksonville Jaguars', s: 'Jaguars', ab: 'JAX', col: ['#006778', '#ffffff'], metro: 'jax', st: 'FL',
    city: 'Jacksonville', arena: 'EverBank Stadium', cap: 'redusă în 2026, stadionul e în renovare', since: '1995',
    titles: 'Niciun Super Bowl', rivals: 'Tennessee Titans, Houston Texans, Indianapolis Colts',
    fact: 'Joacă aproape în fiecare an meciuri „acasă” la Londra.'
  },
  intermiami: {
    l: 'MLS', espn: 'Inter Miami CF', s: 'Inter Miami', ab: 'MIA', col: ['#F7B5CD', '#231F20'], metro: 'mia', st: 'FL',
    city: 'Miami', arena: 'Nu Stadium', cap: 'stadion nou, deschis în 2026', since: '2020',
    titles: 'MLS Cup 2025, Supporters’ Shield 2024, Leagues Cup 2023', rivals: 'Orlando City SC',
    fact: 'Campioana en-titre din MLS, cu Lionel Messi în echipă.'
  },
  orlandocity: {
    l: 'MLS', espn: 'Orlando City SC', s: 'Orlando City', ab: 'ORL', col: ['#633492', '#FDE192'], metro: 'orl', st: 'FL',
    city: 'Orlando', arena: 'Inter&Co Stadium', cap: 'aprox. 25.500', since: '2015',
    titles: 'U.S. Open Cup 2022', rivals: 'Inter Miami CF',
    fact: 'Poreclită „The Lions”; culoarea clubului e movul.'
  },
  marlins: {
    l: 'MLB', espn: 'Miami Marlins', s: 'Marlins', ab: 'MIA', col: ['#00A3E0', '#000000'], metro: 'mia', st: 'FL',
    city: 'Miami', arena: 'loanDepot park', cap: 'aprox. 37.000', since: '1993',
    titles: '2 World Series (1997, 2003)', rivals: 'Atlanta Braves, New York Mets, Philadelphia Phillies',
    fact: 'Au câștigat ambele World Series venind din wild card, fără să fi câștigat vreodată divizia.'
  },
  rays: {
    l: 'MLB', espn: 'Tampa Bay Rays', s: 'Rays', ab: 'TB', col: ['#092C5C', '#8FBCE6'], metro: 'tpa', st: 'FL',
    city: 'St. Petersburg (zona Tampa Bay)', arena: 'Tropicana Field', cap: 'aprox. 25.000', since: '1998',
    titles: 'Niciun World Series; finale în 2008 și 2020', rivals: 'New York Yankees, Boston Red Sox',
    fact: 'Tropicana Field e singurul stadion din MLB cu acoperiș fix. După uraganul Milton din 2024 au jucat un sezon la Tampa, apoi s-au întors în 2026.'
  }
};
const NEW_YORK = {
  knicks: {
    l: 'NBA', espn: 'New York Knicks', s: 'Knicks', ab: 'NY', col: ['#006BB6', '#F58426'], metro: 'nyc', st: 'NY',
    city: 'New York (Manhattan)', arena: 'Madison Square Garden', cap: 'aprox. 19.800', since: '1946',
    titles: '3 titluri NBA (1970, 1973, 2026)', rivals: 'Brooklyn Nets, Boston Celtics, Miami Heat',
    fact: 'Madison Square Garden, „cea mai faimoasă arenă din lume”, e construită chiar deasupra gării Penn Station.'
  },
  rangers: {
    l: 'NHL', espn: 'New York Rangers', s: 'Rangers', ab: 'NYR', col: ['#0038A8', '#CE1126'], metro: 'nyc', st: 'NY',
    city: 'New York (Manhattan)', arena: 'Madison Square Garden', cap: 'aprox. 18.000', since: '1926',
    titles: '4 Cupe Stanley (1928, 1933, 1940, 1994)', rivals: 'New York Islanders, New Jersey Devils, Philadelphia Flyers',
    fact: 'După titlul din 1940 au așteptat 54 de ani următoarea Cupă Stanley, câștigată în 1994.'
  },
  giants: {
    l: 'NFL', espn: 'New York Giants', s: 'Giants', ab: 'NYG', col: ['#0B2265', '#A71930'], metro: 'nyc', st: 'NJ',
    city: 'East Rutherford, New Jersey (zona New York)', arena: 'MetLife Stadium', cap: 'aprox. 82.500', since: '1925',
    titles: '4 Super Bowl (XXI, XXV, XLII, XLVI) și 4 titluri NFL dinainte de Super Bowl', rivals: 'Dallas Cowboys, Philadelphia Eagles, Washington Commanders',
    fact: 'Împart stadionul cu New York Jets; pe MetLife Stadium s-a jucat finala Cupei Mondiale din 2026.'
  },
  nycfc: {
    l: 'MLS', espn: 'New York City FC', s: 'NYCFC', ab: 'NYC', col: ['#6CACE4', '#041E42'], metro: 'nyc', st: 'NY',
    city: 'New York', arena: 'Yankee Stadium și Citi Field', cap: 'variabilă; stadion propriu din 2027', since: '2015',
    titles: 'MLS Cup 2021', rivals: 'New York Red Bulls',
    fact: 'Au jucat ani la rând pe Yankee Stadium, un stadion de baseball; din 2027 au stadion propriu în Queens.'
  },
  yankees: {
    l: 'MLB', espn: 'New York Yankees', s: 'Yankees', ab: 'NYY', col: ['#003087', '#E4002C'], metro: 'nyc', st: 'NY',
    city: 'New York (Bronx)', arena: 'Yankee Stadium', cap: 'aprox. 46.500', since: '1903',
    titles: '27 de World Series, record în MLB', rivals: 'Boston Red Sox, New York Mets',
    fact: 'Au cele mai multe titluri din sportul american: 27 de World Series, ultimul în 2009.'
  }
};
export const ALL_TEAMS = { ...FLORIDA, ...NEW_YORK };

// The packs of default teams. `regions`: states that count as "at home"; `busy`: how many of the pack's teams
// playing make a "zi plină"; `map`: the Florida map; `strip`: the cities (weather) and stadiums on the home page.
export const PACKS = {
  fl: { id: 'fl', name: 'Florida', keys: Object.keys(FLORIDA), regions: ['FL'], busy: 4, map: true, strip: { src: 'places', cities: ['miami', 'tampa', 'orlando', 'jacksonville'] } },
  ny: { id: 'ny', name: 'New York', keys: Object.keys(NEW_YORK), regions: ['NY', 'NJ'], busy: 3, map: false,
    strip: { src: 'america', cities: ['new-york-city-ny', 'east-rutherford-nj'], venues: ['madison-square-garden', 'metlife-stadium', 'yankee-stadium'] } }
};
export const packOf = k => Object.values(PACKS).find(p => p.keys.includes(k))?.id || null;
// The page's pack: the owner's devices (marked with ?eu=1, which also stops counting their visits) keep
// Florida; everyone else gets New York. The Netlify functions (no browser) start from Florida.
export const PACK = (() => {
  if (typeof window === 'undefined') return 'fl';
  try { if (new URLSearchParams(location.search).get('eu') === '1' || localStorage.getItem('flgames-notrack') === '1') return 'fl'; } catch (e) { /* storage blocked */ }
  return 'ny';
})();
export const HOME = PACKS[PACK];
// The app from the Microsoft Store (it starts at /?app=store, remembered on the device): only content we may
// show in a store app, so no official team logos, ESPN photos or ESPN video (Store Policy 11.2); the rest is
// the same site. ?app=web turns it off again (for testing).
export const STORE = (() => {
  if (typeof window === 'undefined') return false;
  try {
    const a = new URLSearchParams(location.search).get('app');
    if (a === 'store') localStorage.setItem('flgames-store', '1');
    if (a === 'web') localStorage.removeItem('flgames-store');
    return localStorage.getItem('flgames-store') === '1' || a === 'store';
  } catch (e) { return new URLSearchParams(location.search).get('app') === 'store'; }
})();
// May this picture be shown? In the store app, not when it comes from ESPN (logos, players, stadiums, news).
export const okImg = url => !(STORE && /(^|\.)espn(cdn)?\.com\//i.test(String(url || '').replace(/^https?:\/\//, '')));
export const TEAMS = Object.fromEntries(HOME.keys.map(k => [k, ALL_TEAMS[k]]));

// Division tables shown on the page. Members are ESPN display names.
export const DIVISIONS = {
  SE: { l: 'NBA', t: 'NBA · Southeast', members: ['Atlanta Hawks', 'Charlotte Hornets', 'Miami Heat', 'Orlando Magic', 'Washington Wizards'] },
  ATL: { l: 'NHL', t: 'NHL · Atlantic', members: ['Boston Bruins', 'Buffalo Sabres', 'Detroit Red Wings', 'Florida Panthers', 'Montreal Canadiens', 'Ottawa Senators', 'Tampa Bay Lightning', 'Toronto Maple Leafs'] },
  AFCE: { l: 'NFL', t: 'NFL · AFC East', members: ['Buffalo Bills', 'Miami Dolphins', 'New England Patriots', 'New York Jets'] },
  NFCS: { l: 'NFL', t: 'NFL · NFC South', members: ['Atlanta Falcons', 'Carolina Panthers', 'New Orleans Saints', 'Tampa Bay Buccaneers'] },
  AFCS: { l: 'NFL', t: 'NFL · AFC South', members: ['Houston Texans', 'Indianapolis Colts', 'Jacksonville Jaguars', 'Tennessee Titans'] },
  MLSE: { l: 'MLS', t: 'MLS · Conferința de Est', conference: 'east' },
  NLE: { l: 'MLB', t: 'MLB · NL East', members: ['Atlanta Braves', 'Miami Marlins', 'New York Mets', 'Philadelphia Phillies', 'Washington Nationals'] },
  ALE: { l: 'MLB', t: 'MLB · AL East', members: ['Baltimore Orioles', 'Boston Red Sox', 'New York Yankees', 'Tampa Bay Rays', 'Toronto Blue Jays'] },
  ATLD: { l: 'NBA', t: 'NBA · Atlantic', members: ['Boston Celtics', 'Brooklyn Nets', 'New York Knicks', 'Philadelphia 76ers', 'Toronto Raptors'] },
  MET: { l: 'NHL', t: 'NHL · Metropolitan', members: ['Carolina Hurricanes', 'Columbus Blue Jackets', 'New Jersey Devils', 'New York Islanders', 'New York Rangers', 'Philadelphia Flyers', 'Pittsburgh Penguins', 'Washington Capitals'] },
  NFCE: { l: 'NFL', t: 'NFL · NFC East', members: ['Dallas Cowboys', 'New York Giants', 'Philadelphia Eagles', 'Washington Commanders'] }
};
export const DIVISION_OF = { heat: 'SE', magic: 'SE', panthers: 'ATL', lightning: 'ATL', dolphins: 'AFCE', bucs: 'NFCS', jaguars: 'AFCS', intermiami: 'MLSE', orlandocity: 'MLSE', marlins: 'NLE', rays: 'ALE', knicks: 'ATLD', rangers: 'MET', giants: 'NFCE', nycfc: 'MLSE', yankees: 'ALE' };

export const METROS = {
  jax: { n: 'Jacksonville', lat: 30.33, lon: -81.66, lx: -10, ly: -12, anc: 'end' },
  orl: { n: 'Orlando', lat: 28.54, lon: -81.38, lx: 14, ly: 4, anc: 'start' },
  tpa: { n: 'Tampa', lat: 27.95, lon: -82.46, lx: -14, ly: 4, anc: 'end' },
  mia: { n: 'Miami și sudul Floridei', short: 'Miami', lat: 25.95, lon: -80.25, lx: -14, ly: 4, anc: 'end' },
  nyc: { n: 'New York', lat: 40.75, lon: -73.99, lx: 14, ly: 4, anc: 'start' }
};

// Lowercase, no accents: "Montréal Canadiens" and "Montreal Canadiens" compare equal.
export const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// "Echipele mele": a followed team is a Florida key ('heat') or any other team as 'NBA-2'
// (league + ESPN id: ESPN reuses ids across leagues, so the league is part of it).
export const CLUB_RE = /^(NBA|NHL|NFL|MLS|MLB)-(\d{1,8})$/;
export const parseClub = s => { const m = CLUB_RE.exec(String(s || '')); return m ? { l: m[1], id: m[2] } : null; };
export const validTeamId = s => Object.prototype.hasOwnProperty.call(ALL_TEAMS, s) || !!parseClub(s);
// Is this side of a game (league l) one of the teams in the Set `want`?
export const sideIn = (want, l, s) => !!s && ((!!s.key && want.has(s.key)) || want.has(`${l}-${s.id}`));

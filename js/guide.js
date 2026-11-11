// The "Ghid" tab of the Ligile page (#ligi/ghid): where to watch each league from Romania (a list kept
// by hand, with the date it was checked) and plain explanations for beginners (started from the
// glossary of the American Sports Encyclopedia). Pure data and HTML; no DOM.
import { esc } from './ui.js';

// When the list below was last checked. Broadcast rights change between seasons: check again each autumn.
export const WATCH_CHECKED = '12 noiembrie 2026';

// For each league: the ways to watch, the widest first. `all`: every game of the season.
export const WATCH = {
  NBA: {
    opts: [
      { n: 'ESPN pe Disney+', url: 'https://www.disneyplus.com/', pay: 'inclus în abonamentul Disney+', d: 'Meciuri în nopțile de joi, sâmbătă și duminică, până la 24 de meciuri din playoff (cu finala Conferinței de Vest) și toată Finala NBA din 2027. Comentariu în engleză.' },
      { n: 'AntenaPlay', url: 'https://antenaplay.ro/', pay: 'abonament AntenaPlay', d: 'O selecție de meciuri din sezonul regulat.' },
      { n: 'NBA League Pass', url: 'https://www.nba.com/watch/league-pass-stream', pay: 'abonament separat', d: 'Toate meciurile, live și reluări complete.', all: true }
    ],
    src: [['Flashscore', 'https://www.flashscore.ro/stiri/baschet-nba-romania-2026-2027-unde-se-vad-meciurile-tv/dxH2z59m/']]
  },
  NHL: {
    opts: [
      { n: 'ESPN pe Disney+', url: 'https://www.disneyplus.com/', pay: 'inclus în abonamentul Disney+', d: 'Peste 1.300 de meciuri: sezonul regulat, playoff-ul și finala Cupei Stanley, plus rezumate a doua zi. Comentariu în engleză.', all: true },
      { n: 'AntenaPlay', url: 'https://antenaplay.ro/', pay: 'abonament AntenaPlay', d: 'O selecție de meciuri.' }
    ],
    src: [['Pagina de media', 'https://www.paginademedia.ro/stiri-media/nhl-romania-disney-plus-22785043']]
  },
  NFL: {
    opts: [
      { n: 'NFL Game Pass (DAZN)', url: 'https://www.dazn.com/', pay: 'abonament separat', d: 'Toate meciurile, live și reluări, cu playoff-ul și Super Bowl. Are și o variantă de reluări condensate, de 40 de minute.', all: true }
    ],
    note: 'Nu am găsit un post TV din România care să transmită NFL în acest sezon.',
    src: [['DAZN', 'https://www.dazn.com/en-US/news/football/nfl-gamepass-live-cost-dazn-country-price-subscription-instalment-watch-season/214xfjy73nnw1o2olstv9ks5x']]
  },
  MLS: {
    opts: [
      { n: 'Apple TV', url: 'https://tv.apple.com/', pay: 'inclus în abonamentul Apple TV', d: 'Toate meciurile, cu playoff-ul și MLS Cup. Din 2026 nu mai există abonamentul separat MLS Season Pass.', all: true }
    ],
    src: [['Apple', 'https://www.apple.com/newsroom/2025/11/major-league-soccer-is-coming-to-apple-tv-starting-in-2026/']]
  },
  MLB: {
    opts: [
      { n: 'MLB.TV International', url: 'https://www.mlb.com/live-stream-games/subscribe/intl', pay: 'abonament separat', d: 'Toate meciurile, fără restricții regionale. Sezonul ține de la sfârșitul lui martie până în octombrie.', all: true }
    ],
    src: [['MLB', 'https://www.mlb.com/live-stream-games/subscribe/intl']]
  }
};

// One line for a game page: "ESPN pe Disney+, AntenaPlay, NBA League Pass (toate meciurile)".
export function watchLine(l) {
  const w = WATCH[l];
  if (!w) return '';
  const many = w.opts.length > 1;
  return w.opts.map(o => o.n + (o.all && many ? ' (toate meciurile)' : '')).join(', ');
}

// Plain explanations. `l`: the league, or null for every league.
export const TERMS = [
  { t: 'Sezonul regulat', l: null, d: 'Fiecare echipă joacă un număr fix de meciuri: 82 în NBA și NHL, 17 în NFL, 34 în MLS, 162 în MLB. Clasamentul de la final decide cine merge în playoff.' },
  { t: 'Playoff', l: null, d: 'Faza eliminatorie de după sezonul regulat. În NBA, NHL și MLB se joacă serii (de exemplu, câștigă cine ajunge primul la 4 victorii din 7 meciuri), în NFL un singur meci, pe terenul echipei mai bine clasate.' },
  { t: 'Conferințe și divizii', l: null, d: 'Ligile sunt împărțite geografic în două conferințe (Est și Vest; în NFL, AFC și NFC; în MLB, Liga Americană și Liga Națională), iar acestea în divizii. Cu rivalii din divizie joci mai des, iar locul în divizie contează pentru playoff.' },
  { t: 'Wild Card', l: null, d: 'Un loc în playoff pentru o echipă care nu și-a câștigat divizia, dar are un bilanț bun. NFL: 3 pe conferință; NHL: 2 pe conferință, după primele 3 din fiecare divizie; MLB: 3 pe ligă.' },
  { t: 'Bilanțul (V–Î)', l: null, d: 'Victorii–înfrângeri, ca 9–2. În NHL apare și o a treia cifră, înfrângerile în prelungiri; în NFL și MLS, egalurile.' },
  { t: 'Draft', l: null, d: 'Selecția anuală a tinerilor jucători, din colegii sau din străinătate. Echipele cele mai slabe aleg primele, ca liga să rămână echilibrată. Jucătorii nu se cumpără pe bani, ca în fotbalul european.' },
  { t: 'Salary cap (plafonul salarial)', l: null, d: 'Suma maximă pe care o echipă o poate cheltui pe salarii într-un sezon, ca bogații să nu adune toți starurile. NFL și NHL au un plafon strict, NBA unul flexibil, cu taxe mari peste anumite praguri, MLB nu are plafon, doar o „taxă de lux” pentru cine cheltuie mult.' },
  { t: 'Free agency (agenții liberi)', l: null, d: 'Un jucător al cărui contract s-a terminat poate semna cu orice echipă. Perioada agenților liberi (vara în NBA și NHL, primăvara în NFL, iarna în MLB) e momentul marilor mutări.' },
  { t: 'Trade (schimbul)', l: null, d: 'Echipele își dau jucători și alegeri de draft între ele, de obicei fără bani la mijloc. Schimburile se pot face până la un termen-limită (trade deadline), pe la mijlocul sezonului.' },
  { t: 'Rookie și MVP', l: null, d: 'Rookie: jucătorul aflat în primul sezon în ligă. MVP (Most Valuable Player): cel mai valoros jucător al sezonului, votat de jurnaliști; există și MVP-ul finalei.' },
  { t: 'Liga închisă', l: null, d: 'În ligile americane nimeni nu retrogradează și nimeni nu promovează. Echipe noi intră doar când liga decide să se extindă (expansion team), iar o echipă se poate muta în alt oraș.' },

  { t: 'Sferturi și prelungiri', l: 'NBA', d: '4 sferturi de 12 minute. La egalitate urmează prelungiri de 5 minute, câte e nevoie, până câștigă cineva.' },
  { t: 'Play-in', l: 'NBA', d: 'Un mini-turneu pentru locurile 7–10 din fiecare conferință: două dintre aceste echipe intră în playoff, ca locurile 7 și 8.' },
  { t: 'NBA Cup', l: 'NBA', d: 'Turneul din timpul sezonului, în noiembrie și decembrie, cu finala la Las Vegas. Meciurile lui contează și în clasamentul obișnuit, în afară de finală.' },
  { t: 'Loteria draftului', l: 'NBA', d: 'Cele 14 echipe care ratează playoff-ul trag la sorți primele 4 alegeri. Cele mai slabe au cele mai mari șanse, dar nu au garantat locul 1.' },

  { t: 'Prelungiri și shootout', l: 'NHL', d: 'În sezonul regulat, la egalitate după 60 de minute urmează 5 minute de prelungire cu câte 3 jucători de câmp, apoi loviturile de departajare (shootout). În playoff se joacă reprize întregi de 20 de minute, 5 la 5, până la primul gol.' },
  { t: 'Punctele NHL', l: 'NHL', d: 'Victoria aduce 2 puncte, înfrângerea în prelungiri sau la shootout 1 punct, cea în timpul regulamentar 0. De aceea clasamentul se face pe puncte, nu pe victorii.' },
  { t: 'Power play', l: 'NHL', d: 'Când un jucător e eliminat (de obicei 2 minute), echipa lui joacă cu un om mai puțin, iar adversarul are „power play”, cea mai bună șansă de gol.' },
  { t: 'Cupa Stanley', l: 'NHL', d: 'Trofeul campioanei NHL, cel mai vechi din sportul profesionist nord-american (din 1893). Fiecare jucător campion o primește acasă pentru o zi.' },

  { t: 'Downs (încercările)', l: 'NFL', d: 'Atacul are 4 încercări să avanseze 10 yarzi; dacă reușește, primește alte 4. „3rd & 5” înseamnă a treia încercare, cu 5 yarzi rămași. La a patra, de obicei se trimite mingea departe (punt) sau se încearcă un field goal.' },
  { t: 'Punctele NFL', l: 'NFL', d: 'Touchdown: 6 puncte, plus 1 dintr-o lovitură sau 2 dintr-o nouă încercare. Field goal (lovitura printre buturi): 3. Safety (atacantul prins în propria zonă de puncte): 2.' },
  { t: 'Quarterback', l: 'NFL', d: 'Jucătorul care primește mingea la începutul fiecărei faze și o pasează sau o dă mai departe. E cel mai important post din echipă.' },
  { t: 'Super Bowl', l: 'NFL', d: 'Finala, la începutul lui februarie, între campioanele AFC și NFC, pe un stadion ales cu ani înainte. Locul 1 din fiecare conferință sare peste primul tur al playoff-ului.' },

  { t: 'Supporters’ Shield și MLS Cup', l: 'MLS', d: 'Supporters’ Shield e trofeul pentru cea mai bună echipă din sezonul regulat. Campioana e însă cea care câștigă MLS Cup, finala playoff-ului.' },
  { t: 'Playoff-ul MLS', l: 'MLS', d: 'Merg primele 9 din fiecare conferință. Locurile 8 și 9 joacă un meci pentru calificare, primul tur e la cel mai bun din 3 meciuri, cu egalurile decise direct la penalty-uri, apoi totul se joacă într-un singur meci.' },
  { t: 'Designated Player', l: 'MLS', d: 'Fiecare club poate avea până la 3 jucători al căror salariu contează doar parțial în plafon. Așa au ajuns în MLS Beckham, Henry sau Messi.' },

  { t: 'Inning (repriza)', l: 'MLB', d: '9 reprize; în fiecare, ambele echipe bat câte o dată, până la 3 eliminări (outs). La egalitate se joacă reprize în plus; în sezonul regulat, fiecare începe cu un alergător pe baza a doua, ca meciul să se termine mai repede.' },
  { t: 'Pitcher', l: 'MLB', d: 'Aruncătorul. Titularul (starting pitcher) iese de obicei după 5–6 reprize, apoi intră rezervele (relievers); ultimul, „closer”, închide meciul.' },
  { t: 'Home run', l: 'MLB', d: 'Lovitura care trimite mingea peste gard: aduce un punct pentru cel care a lovit și pentru fiecare coechipier aflat pe baze.' },
  { t: 'World Series', l: 'MLB', d: 'Finala, la cel mai bun din 7 meciuri, între campioanele Ligii Americane și Ligii Naționale, la sfârșitul lui octombrie. În playoff intră 12 echipe, câte 6 din fiecare ligă.' }
];

const L_ORDER = ['NBA', 'NHL', 'NFL', 'MLS', 'MLB'];
const L_NAME = { NBA: 'NBA, baschet', NHL: 'NHL, hochei', NFL: 'NFL, fotbal american', MLS: 'MLS, fotbal', MLB: 'MLB, baseball' };

// `chosen`: the leagues ticked on the page; `col(l)`: the league colour.
export function guideHtml(chosen, col) {
  const ls = L_ORDER.filter(l => chosen.has(l));
  const watch = ls.map(l => {
    const w = WATCH[l];
    return `<section class="wcard"><h3><span class="ldot" style="--c:${col(l)}"></span>${L_NAME[l]}</h3>
      <ul class="wopts">${w.opts.map(o => `<li><a href="${esc(o.url)}" target="_blank" rel="noopener"><b>${esc(o.n)}</b></a> <span class="pay">${esc(o.pay)}</span>${o.all ? ' <span class="all">toate meciurile</span>' : ''}<p>${esc(o.d)}</p></li>`).join('')}</ul>
      ${w.note ? `<p class="fn">${esc(w.note)}</p>` : ''}
      <div class="fn">Sursa: ${w.src.map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(n)}</a>`).join(', ')}</div></section>`;
  }).join('');
  const terms = TERMS.filter(x => !x.l || chosen.has(x.l));
  const group = (title, list) => list.length ? `<div class="tgrp"><h3>${title}</h3><dl class="terms">${list.map(x => `<div><dt>${esc(x.t)}</dt><dd>${esc(x.d)}</dd></div>`).join('')}</dl></div>` : '';
  return `<div class="guide">
    <section id="unde"><h2 class="sec">Cum vezi meciurile din România</h2>
      <p class="lead">Meciurile se joacă de obicei noaptea, ora României. În aplicațiile de mai jos le poți vedea și dimineața, în reluare. Dacă nu vrei să afli scorul dinainte, oprește notificarea cu rezultatul final și rezumatul de dimineață.</p>
      <div class="wgrid">${watch}</div>
      <div class="fn">Verificat pe ${WATCH_CHECKED}. Drepturile TV se schimbă de la un sezon la altul; prețurile le găsești în aplicații.</div>
    </section>
    <section id="termeni"><h2 class="sec">Explicații pentru începători</h2>
      ${group('În toate ligile', terms.filter(x => !x.l))}
      ${ls.map(l => group(L_NAME[l], terms.filter(x => x.l === l))).join('')}
      <div class="fn">Pornind de la glosarul American Sports Encyclopedia.</div>
    </section>
  </div>`;
}

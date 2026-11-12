# American Sports Hub

Sportul american pe românește (fost „Meciuri Florida”): echipele tale din NBA, NHL, NFL, MLS și
MLB, implicit cele din Florida, cu ora României, rezultate, clasamente, profiluri de echipă și pagini de meci.
Proiect pentru uz personal. Repo-ul a fost înainte jocul Airport Operations Manager (rămas în
istoricul git, pe `main` până la merge-ul etapei 1).

## Reguli

- **Fără API-uri plătite și fără chei API.** Datele vin din API-ul public al ESPN
  (`site.api.espn.com`), gratuit și fără cheie, dar neoficial: poate schimba formatul fără
  anunț. Tot codul care îl citește e în `netlify/lib/espn.mjs`, defensiv, și întoarce date
  parțiale în loc să crape. Vremea vine de la Open-Meteo (`netlify/lib/weather.mjs`), tot
  gratuit și fără cheie. La generarea `data/places.json` se folosesc, o singură dată, Wikipedia
  (coordonate), Wikimedia Commons (poze cu licență), arhiva Open-Meteo (clima) și OSRM (rute).
- **Notificări (Web Push):** standardul gratuit al browserelor, fără serviciu plătit. Site-ul se
  semnează cu propria pereche de chei VAPID, în variabilele de mediu Netlify `VAPID_PUBLIC_KEY`
  și `VAPID_PRIVATE_KEY` (secretă, niciodată în repo; generare: `node tools/vapid-keys.mjs`).
  Abonamentele stau în Netlify Blobs (`push-subs` în producție, `push-subs-test` pe preview).
  Singura dependență npm e `@netlify/blobs`, pentru funcții; pagina rămâne fără build.
- **Poze:** orașele și stadioanele au poze de pe Wikimedia Commons, cu autorul și licența
  afișate pe pagină. Se încarcă de pe serverul Wikimedia, nu se copiază în repo.
- **Logo-uri:** cele oficiale, încărcate direct de pe serverul ESPN (`a.espncdn.com`), nu
  copiate în repo. Sunt mărci înregistrate: acceptabil pentru uz personal, de înlocuit dacă
  site-ul devine public sau comercial. Dacă un logo nu se încarcă, apare emblema cu culorile
  echipei și abrevierea.
- **Site static + funcții Netlify subțiri.** HTML/CSS/JavaScript cu module ES, fără framework
  și fără pas de build. Funcțiile doar citesc ESPN sau Open-Meteo, normalizează și pun în
  cache pe CDN.
- **Rezervă:** dacă `/api/schedule` nu răspunde, pagina folosește ultimele date salvate în
  browser, apoi `data/snapshot.json`.
- **Interfața e în română.** Comunicarea cu utilizatorul: în română.
- **Lucrăm pe branch-uri** (`stage-N-...`). Spune pe scurt ce faci pe parcurs și întreabă
  înainte de deciziile importante.
- **Un PR pe etapă:** deploy preview-urile (PR-urile) sunt gratuite pe Netlify, doar
  publicarea în producție (merge în `main`) consumă credit. Lucrăm local, verificăm cu
  serverul local și capturi de ecran, iar la final facem push și deschidem PR-ul.
- Trebuie să meargă bine pe telefon și pe desktop, în temă luminoasă și întunecată.
- **Identitate (varianta „Arena”, etapa 7):** bleumarin `#0E1F3D`, roșu `#C8102E` (noaptea `#FF5A6E`),
  steaua albă pe roșu (`favicon.svg`, bara de sus) și în cercul roșu (`icons/icon.svg`; PNG-urile se
  fac din el). Titluri: Saira Condensed înclinat, majuscule; text: Figtree. Butoanele apăsate sunt
  bleumarin, roșul e pentru logo, accente și acțiunea principală. Identificatorii interni rămân
  vechi: `UID …@meciuri-florida` în calendar (altfel abonamentele ar dubla meciurile), cheile
  `flgames-*` din browser, numele stocărilor de notificări.
- **Versiunea aplicației:** la orice schimbare a fișierelor site-ului, crește `VERSION` în `sw.js` și,
  la fel, `APP_VERSION` în `js/phone.js`
  (`tools/test.mjs` verifică față de `main`). Doar așa aplicația instalată vede versiunea nouă:
  la revenirea în aplicație caută una nouă și, când e gata, se reîncarcă singură (`js/phone.js`).

## Plan pe etape

Etapele 1–3 sunt în producție (PR #5, 11 noiembrie 2026): site cu date live, pagini de meci
complete, orașele, stadioanele și vremea Floridei; aplicație instalabilă, offline, abonare la
calendar; notificări (Web Push, `push-cron` la 15 minute, doar în producție).

**Cum publicăm:** creditele Netlify sunt puține. Preview-urile (PR-uri spre `main`) sunt
gratuite, fiecare merge în `main` consumă. Mai multe etape merg pe un singur branch / PR cu
baza `main` (altfel Netlify nu face preview) și se unesc o singură dată, la final.

4. **Etapa 4** (în producție, PR #6, 11 noiembrie 2026):
   - **Partea 1, în plus pentru Florida:** profil de echipă bogat (lot,
     lideri, grafic al sezonului, știri), căutare, tabloul de playoff, MLB automat
     (Marlins, Rays).
   - **Partea 2, restul Americii, varianta ușoară:** profiluri bogate doar pentru Florida; pentru
     restul: scoruri pe zile din toate ligile, clasamente complete, pagină simplă de echipă,
     orașe și stadioane cu fapte, ora locală și vremea. Datele pe ligă și zi (nu pe echipă),
     ca să nu se înmulțească cererile la ESPN.
5. **Etapa 5** (în producție, PR #7): pagina de start mai ușor de parcurs, cu o
   bară de secțiuni lipită sus (`#jump` în `index.html`, `setupJump` în `js/app.js`): un buton
   duce direct la secțiune, fără să schimbe adresa. Playoff-ul MLS e mutat după Clasamente. Fila
   „Orașe și stadioane” din Ligile (toată America, `allPlaces` în `js/places.js`); căutarea
   găsește orașele și stadioanele din toată America.
6. **Etapa 6** (în producție, PR #8): profil complet pentru toate echipele și
   „Echipele mele”. Profilul oricărei echipe are textul „Despre” (Wikipedia, în română când
   există), antrenorul (ESPN), palmaresul, numele vechi, legendele, poza, forma și clasamentul
   conferinței (`data/clubs.json`, `js/clubinfo.js`). „Echipele mele” (`js/mine.js`) e secțiunea
   de echipe de pe pagina de start: implicit cele 11 din Florida, se scot cu × și se adaugă
   oricare echipă; calendarul (.ics) și notificările primesc orice echipă ca `NBA-2`.
7. **Etapa 7: American Sports Hub** (în producție, PR #8). Proiectul se redenumește (titlu, antet, aplicația instalată,
   calendar, notificări, documentație) și primește identitate vizuală proprie (logo, iconițe, culori,
   titluri): un produs sportiv american, nu un calendar. Pagina de start pornește de la „Echipele
   mele” (implicit Florida). **Adresa rămâne** `florida-sp-calendar.netlify.app` (decizia
   utilizatorului): aplicația instalată, calendarul și notificările sunt legate de ea.
8. **Etapa 8: zilnic** (în producție, PR #9). Rezumatul de dimineață: o notificare
   la 8:00, ora României (prima rulare `push-cron` după 8:00, până la 12:00, o dată pe zi,
   `morningDay`), cu rezultatele din ultimele 24 de ore ale echipelor tale (✓/✗) și meciul următor;
   bifa „Rezumatul de dimineață” (implicit pornită, `morning`). Fila „Ghid” din Ligile
   (`#ligi/ghid`, `js/guide.js`): „Cum vezi meciurile din România” pe ligă (listă scrisă de mână,
   `WATCH_CHECKED` = data verificării; de reverificat în fiecare toamnă) și explicații pentru
   începători, pornind de la glosarul enciclopediei. Pagina de meci are rândul „Unde îl vezi”.
9. **Etapa 9: tehnic** (în producție, PR #10). `app.js` împărțit pe module (`core`,
   `home`, `pages`, `views`, `search`; vezi Structura). Verificarea surselor: `/api/health` întreabă
   ESPN și Open-Meteo și se uită și la formatul răspunsului (ESPN poate schimba formatul fără anunț);
   pagina arată rândul „Surse” în subsol și o frază roșie în linia de stare când o sursă are probleme
   (`js/health.js`). Teste: `npm test` rulează `tools/test.mjs` (cititoare, traduceri, notificări) și
   `tools/test-functions.mjs` (funcțiile Netlify cu ESPN și Open-Meteo simulate, inclusiv căderi și
   format schimbat); după un deploy, `node tools/smoke.mjs <adresa>` verifică site-ul publicat.
   Mai târziu, doar dacă site-ul devine public: varianta în engleză.
10. **Rezumatul meciului și echipe clicabile** (în producție, PR #11). La un meci
    terminat, pagina arată doar rezumatul oficial ESPN („Game Highlights”, 1–3 minute) în locul
    clipurilor scurte: întâi printre clipurile meciului, apoi în știrile ESPN ale meciului
    (`news?event=`) și pagina clipului (`content.core.api.espn.com/v1/video/clips/`); fără rezumat
    (NFL nu are video) rămân clipurile. La NFL: butonul „Rezumatul pe YouTube” (căutare pe YouTube
    după rezumatul oficial NFL). La orice meci terminat: cronica ESPN, în engleză (`article`). Orice echipă de pe pagina de start (carduri de meci,
    clasamente, următorul meci) și din antetul paginii de meci duce la pagina ei (`teamBtn` în
    `js/core.js`: Florida → `#echipa/…`, restul → `#club/…`).
11. **Actualizarea pe iPhone** (în lucru, branch `stage-11-actualizare`). Pe iPhone, aplicația instalată
    nu primea versiunile noi: semnalele service worker-ului nu vin sigur la revenirea în aplicație.
    Acum pagina își compară `APP_VERSION` cu `VERSION` din `sw.js` publicat (citit fără cache) la pornire
    și la fiecare revenire; dacă e mai nouă, lasă noul service worker să preia, șterge cache-urile vechi
    și se reîncarcă (cel mult o dată la 10 minute pe versiune). Subsolul arată „Versiunea N” și butonul
    „Caută actualizare”. Numele și iconița de pe ecranul iPhone-ului nu se schimbă niciodată singure: iOS
    le păstrează de la adăugare.

## Structura

```
index.html                  pagina
css/app.css                 stiluri (tokeni de culoare la început, temă luminoasă și întunecată)
js/teams.js                 configurație comună pagină + funcții: ligi, echipe, divizii, orașe
js/app.js                   pornirea: tema, evenimentele paginii, încărcarea datelor (live, salvate, rezervă), scor live
js/core.js                  datele și starea comune: meciuri, clasamente, filtre în adresă, date și ore, stocare
js/home.js                  pagina de start: stare, Echipele mele, următorul meci, calendar, agendă, hartă, playoff
js/pages.js                 ferestrele și adresele (#…): echipă, club, oraș, stadion, calendar, notificări, meci
js/views.js                 Florida | Ligile, pagina „Ligile” cu scorurile zilei, bara de secțiuni
js/search.js                căutarea: echipe, adversari, orașe, stadioane
js/health.js                starea surselor (/api/health): rândul „Surse” și fraza din linia de stare
js/game.js                  pagina de meci: filele Rezumat, Jucători, Statistici, Faze, Absenți; graficul de șanse
js/ro.js                    traducerea textelor ESPN (stare meci, note, statistici, accidentări); fără DOM
js/ui.js                    funcții comune: esc, temă (auto/luminoasă/întunecată), embleme cu logo
js/places.js                orașe și stadioane: pagini, vremea, banda cu vremea, graficul de climă
js/phone.js                 service worker, instalarea aplicației, pagina de abonare la calendar
js/ics.js                   fișiere .ics (iCalendar), folosit de pagină și de funcția de calendar; fără DOM
js/notify.js                pagina de notificări: permisiune, abonare push, alegerile (#notificari)
js/teamx.js                 filele profilului de echipă: Sezon (grafic, lideri), Lot, Știri
js/bracket.js               tabloul de playoff: serii din meciurile de playoff; fără DOM
js/mine.js                  „Echipele mele”: lista din browser (implicit Florida), `NBA-2` pentru restul
js/clubinfo.js              faptele din data/clubs.json pe pagina echipei: Despre, palmares, nume vechi, legende
js/guide.js                 fila „Ghid” din Ligile: unde vezi fiecare ligă din România (verificat de mână), explicații
js/leagues.js               pagina „Ligile” (#ligi): scoruri pe zi, clasamente complete, toate echipele, orașele și stadioanele; banda „Azi în ligi”
sw.js                       service worker: fișierele site-ului rețea-întâi, logo/poze din cache, offline
manifest.webmanifest        manifestul aplicației (nume, iconițe, culori); icons/ are iconițele
netlify/lib/espn.mjs        citirea și normalizarea datelor ESPN
netlify/lib/weather.mjs     prognoza Open-Meteo, redusă la ce arată pagina
netlify/functions/schedule.mjs   GET /api/schedule  meciurile sezonului + clasamente (cache 15 min)
netlify/functions/live.mjs       GET /api/live?l=NBA,NHL  scorurile de azi (cache 30 s)
netlify/functions/game.mjs       GET /api/game?l=NBA&id=…  detaliile unui meci
netlify/functions/weather.mjs    GET /api/weather?lat=…&lon=…[&brief=1]  vremea, doar în Florida (cache 30 min)
netlify/functions/calendar.mjs   GET /api/calendar.ics?e=heat,panthers[&a=60]  calendar de abonare (cache 1 h)
netlify/functions/team.mjs       GET /api/team?l=NBA&id=14  lot, liderii sezonului, știri ESPN (cache 3 h)
netlify/functions/playoffs.mjs   GET /api/playoffs?l=MLS  meciurile de playoff ale ligii, pentru tablou (cache 1 h)
netlify/functions/scores.mjs     GET /api/scores?d=20261111  toate meciurile unei zile (SUA), din toate ligile
netlify/functions/teamgames.mjs  GET /api/teamgames?l=NBA&id=2  sezonul oricărei echipe (pagina simplă de echipă)
netlify/functions/health.mjs     GET /api/health  ESPN și Open-Meteo răspund, în formatul așteptat? (cache 5 min)
netlify/functions/push.mjs       /api/push  salvează / citește / testează / șterge un abonament la notificări
netlify/functions/push-cron.mjs  programată, la 15 minute, doar în producție: trimite notificările datorate
netlify/lib/webpush.mjs     Web Push fără bibliotecă: semnătură VAPID (RFC 8292), criptare (RFC 8291)
netlify/lib/notify.mjs      ce notificări sunt datorate și textul lor; fără rețea
netlify/lib/health.mjs      verificarea surselor: o întrebare tipică fiecăreia și forma răspunsului
netlify/lib/subs.mjs        stocarea abonamentelor (Netlify Blobs; local, fișiere JSON)
netlify/lib/clubs.mjs       meciurile echipelor urmărite din afara Floridei, pentru calendar și notificări
tools/vapid-keys.mjs        generează perechea de chei VAPID: node tools/vapid-keys.mjs
data/snapshot.json          date de rezervă (format /api/schedule)
data/places.json            orașe și stadioane, GENERAT: nu se editează de mână
data/america.json           stadioanele și orașele echipelor din afara Floridei (fapte), GENERAT de
                            tools/build-america.mjs: stadionul din meciurile de acasă (nu „franchise
                            venue” de la ESPN, adesea istoric), poze ESPN, oraș geocodat Open-Meteo
tools/places-src.json       sursa lui places.json: textele în română, fapte, surse, numele pozelor
data/clubs.json             profilul tuturor echipelor (Despre, titluri, nume vechi, legende, poză), GENERAT de
                            tools/build-clubs.mjs (Wikipedia, Wikidata, enciclopedia; titlurile NHL din
                            caseta Wikipedia). Wikimedia limitează cererile: scriptul merge una câte una, ~20 min
tools/build-places.mjs      generează places.json (coordonate, poze, climă, rute): node tools/build-places.mjs
tools/test.mjs              teste offline pentru cititoare, traduceri, notificări: npm test (rulează ambele)
tools/test-functions.mjs    teste offline pentru funcțiile Netlify, cu ESPN și Open-Meteo simulate
tools/smoke.mjs             după deploy: node tools/smoke.mjs <adresa> verifică paginile și datele publicate
tools/mock-espn.mjs         ESPN simulat din date vechi; regenerează snapshot.json
```

Orașele (6) și stadioanele (9) din Florida pornesc din proiectul usa-places-explorer
(American Sports Encyclopedia, pe Desktop / GitHub). Pentru o modificare: schimbi
`tools/places-src.json`, apoi rulezi `node tools/build-places.mjs`. Arhiva Open-Meteo limitează
cererile; scriptul așteaptă singur un minut dacă primește 429.

Rulare locală cu funcții: `npx netlify dev`. Doar pagina (cu datele de rezervă):
`python -m http.server`.

## Formatul datelor (`/api/schedule`)

```js
{ updated, source: 'espn' | 'snapshot',
  teams: { heat: { id, name, abbr, color, alt, logo, logoDark, record, standing } },
  games: [{ id, l, date /* ISO UTC */, tbd, state: 'pre'|'in'|'post', detail,
            home: { id, name, abbr, color, logo, logoDark, key /* echipă Florida sau null */, score },
            away: { ... }, venue, city, region /* stat sau țară */, neutral, note, tv }],
  standings: { NBA: [{ name /* conferința */, entries: [{ name, w, l, otl, t, pts, seed, home, away, streak, ... }] }] },
  errors: [] }
```

`/api/game` (o pagină de meci) are în plus, fiecare secțiune goală dacă ESPN nu o trimite:
`box` (jucători, pe grupe cu `keys` ESPN), `teamStats` (`{k, label, h, a}`), `plays` (goluri,
puncte, cartonașe), `wp` (`[procent gazde, perioadă]`), `injuries`, `series`, `last5`, `videos`
(doar de pe serverele ESPN), `goalies`, `predictor`, `leaders`. Partea (`side`) e `home`/`away`. La un meci terminat cu rezumat, `videos` are
doar rezumatul și `recap: true` (cache o zi; fără rezumat, 15 minute, până îl publică ESPN).

Adrese: `#meci/NBA/401909963[/jucatori|statistici|faze|absenti]`, `#echipa/heat`,
`#echipa/heat[/sezon|lot|stiri]`, `#club/NBA/2[/sezon|lot|stiri]` (echipă din afara Floridei), `#calendar/heat,NBA-2`, `#notificari/NBA-2`,
`#ligi[/scoruri|clasamente|echipe|orase|ghid][/2026-11-11]` (pagina „Ligile”, nu fereastră), `#oras/miami`, `#stadion/hard-rock-stadium`, `#calendar[/heat,panthers]`, `#notificari[/heat]`;
filtrele în
`?ligi=NBA,NHL&echipa=heat&florida=1&ore=1&zi=2026-11-15`. Butonul Înapoi închide fereastra.

Cheile echipelor din Florida sunt în `js/teams.js` (`heat`, `magic`, `panthers`, `lightning`,
`dolphins`, `bucs`, `jaguars`, `intermiami`, `orlandocity`, `marlins`, `rays`). MLB nu mai e
marcată de mână „extrasezon”: pagina o marchează singură când nu urmează niciun meci MLB, iar
`/api/schedule` păstrează pentru MLB doar meciurile de la 45 de zile în urmă la 60 înainte. Id-urile ESPN se caută după nume,
nu se scriu de mână.

## Stare la predare (11 noiembrie 2026, PR #3 pe branch-ul `stage-1-calendar`)

- Funcțiile primesc date reale de la ESPN pe deploy preview (verificat în jurnalele Netlify).
- Reparat: ESPN refolosește id-urile de echipă în ligi diferite; maparea echipelor din Florida
  folosește acum cheia `LIGA:id` (altfel Utah Jazz apărea ca Florida Panthers, „derby” fals).
- De verificat: meciurile viitoare MLS (Inter Miami, Orlando City). Funcția cere acum și
  `fixture=true`, `seasontype=3` și scoreboard-ul MLS pe 45 de zile; jurnalul funcției
  `schedule` scrie câte meciuri a adus fiecare sursă (`schedule sources`), iar răspunsul
  `/api/schedule` le are în câmpul `sources`.
- După verificare: merge PR #3 în `main` (site Netlify: florida-sp-calendar).
- Adăugat tot în PR #3 (11 noiembrie): pagina de meci cu file (jucători, statistici comparate,
  faze, absenți, grafic de șanse, rezumate video, meciuri directe, forma), linkuri pentru meciuri
  și echipe cu butonul Înapoi, filtre în adresă, temă aleasă manual, textele ESPN în română,
  scor live la 30 s cu evidențierea scorului schimbat.
- MLS (11 noiembrie): scoreboard-ul de fotbal nu mai acceptă intervale de date (400), doar o lună
  întreagă (`dates=YYYYMM`); `scoreboardRange` cere acum lună cu lună. Local aduce meciurile de
  playoff (Inter Miami–Columbus, Orlando–Cincinnati). Meciurile viitoare vin și din `fixture=true`.
- Adăugat tot în PR #3 (11 noiembrie, la cererea utilizatorului): orașele (6) și stadioanele (9)
  echipelor din Florida, cu pagini proprii (`#oras/…`, `#stadion/…`), poze Wikimedia cu licență,
  vremea (Open-Meteo, `/api/weather`) pe paginile de oraș/stadion și la meciurile din Florida,
  clima pe luni, distanțe cu mașina; banda „Vremea acum” pe pagina principală.
- Reparat: la MLS, ESPN dă regiunea „USA”, nu statul; meciurile de acasă ale lui Inter Miami și
  Orlando City apăreau „Deplasare”. Acum un meci de acasă al unei echipe din Florida e în Florida.
- Etapa 2 (11 noiembrie), branch `stage-2-telefon`: PWA (manifest, iconițe, `sw.js`), offline,
  abonare la calendar (`/api/calendar.ics`, pagina `#calendar`), „Adaugă în calendar” la un meci,
  butoane Calendar/Instalează în antet. Verificat local: offline cu programul salvat, feed .ics.
- Etapa 3 (11 noiembrie), branch `stage-3-notificari`: notificări Web Push (pagina `#notificari`,
  `/api/push`, `push-cron` la 15 minute). Verificat local: criptarea (test), semnătura VAPID
  acceptată de serverul Google (răspunde 410 pentru un abonament inventat, 403 cu cheia greșită).
  O notificare reală nu se poate vedea în browserul fără fereastră: se testează pe preview.
  Necesită variabilele VAPID în Netlify înainte de deploy.
- Etapa 4, partea 1 (11 noiembrie), branch `stage-4-america`: file în profilul
  echipei (Sezon, Lot, Știri; `/api/team`), căutare în antet, tabloul de playoff (`/api/playoffs`),
  MLB (Marlins, Rays, loanDepot park, Tropicana Field, St. Petersburg). Reparat: locul în
  clasamentul MLS (ESPN dă `rank`, nu `playoffSeed`), notele de playoff MLS, AL/NL la MLB.
- Etapa 4, partea 2 (11 noiembrie): pagina „Ligile” (scoruri pe zi din toate ligile, clasamente
  complete, toate cele 154 de echipe), pagină simplă pentru orice echipă (#club), banda „Azi în
  ligi”, orice meci se deschide pe pagina de meci, stadioanele și orașele din toată America
  (data/america.json), vremea la meciurile din deplasare ale echipelor din Florida. Funcția de
  vreme acceptă acum SUA și Canada.

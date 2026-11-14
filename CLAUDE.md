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
   mele” (implicit Florida). **Adresa rămâne** `americansportshub.netlify.app` (decizia
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
11. **Actualizarea pe iPhone** (în producție, PR #12). Pe iPhone, aplicația instalată
    nu primea versiunile noi: semnalele service worker-ului nu vin sigur la revenirea în aplicație.
    Acum pagina își compară `APP_VERSION` cu `VERSION` din `sw.js` publicat (citit fără cache) la pornire
    și la fiecare revenire; dacă e mai nouă, lasă noul service worker să preia, șterge cache-urile vechi
    și se reîncarcă (cel mult o dată la 10 minute pe versiune). Subsolul arată „Versiunea N” și butonul
    „Caută actualizare”. Numele și iconița de pe ecranul iPhone-ului nu se schimbă niciodată singure: iOS
    le păstrează de la adăugare.
12. **Beta publică** (în producție, PR #13). Site-ul se deschide gratuit, fără reclame, ca beta,
    cât timp datele sunt încă de la ESPN. Măsurarea vizitelor fără cookie-uri și fără nimic personal
    (`js/track.js` → `/api/hit`, pe zile în Netlify Blobs `stats`): vizitatori noi și care revin, pagini,
    deschideri din aplicație, acțiuni (instalare, notificări, calendar, urmărire, distribuire, păreri).
    Nu se numără roboții, „Do Not Track” și dispozitivul proprietarului (`?eu=1` sau 5 atingeri pe
    versiune). „Spune-ne ce crezi” (`#parere` → `/api/feedback`, Blobs `feedback`). Statisticile și
    părerile: `/api/stats?key=…` cu `STATS_KEY` din mediul Netlify (secret). Previzualizarea pentru
    distribuire (`og:` și `icons/og.png`), `robots.txt`, `sitemap.xml`, eticheta „Beta”.
    În paralel: testul BALLDONTLIE (cheia doar local, apoi `BDL_KEY` în Netlify), vezi documentul despre
    monetizare. Adresele reale și indexarea complete vin în etapa „Pregătit pentru public”.
13. **Activitatea pe site** (în producție, PR #14). Adresa nouă `americansportshub.netlify.app` (PR #15). Tot ce se întâmplă, numărat pe zile,
    niciodată pe persoană: sursa vizitei (`?sursa=instagram`, `utm_source`, browserul din Instagram sau
    Facebook, pagina de dinainte), dispozitivul, sistemul, cât durează o vizită, secțiunile văzute pe pagina
    de start, echipele și meciurile deschise, clicurile, alegerile din căutare, serviciile de streaming din
    ghid, erorile. Pagina trimite pachete (`{ b: [...] }`) la 4 secunde și la ieșire. Pagina
    „Confidențialitate” (`#confidentialitate`) spune ce se numără. Statisticile au un tabel pe categorie.
15. **Varianta publică** (în producție, PR #16; continuată în PR #19–#20: „Echipele mele” pe pachet, orice echipă pe Acasă). Două pachete de echipe implicite în
    `js/teams.js` (`PACKS`): Florida (11 echipe) pe dispozitivele proprietarului, marcate cu `?eu=1`, și
    New York (Knicks, Rangers, Giants, NYCFC, Yankees) pentru toți ceilalți. `TEAMS` e pachetul activ,
    `ALL_TEAMS` toate cheile (serverul le recunoaște pe toate). Pagina de start urmează pachetul: program
    (`/api/schedule?pack=ny`, cache separat), clasamentele diviziilor, „zi plină” (`busy`), derby-uri,
    orașele și stadioanele (Florida din places.json, New York din america.json); harta doar pentru Florida.
    Calendarul și notificările primesc chei din orice pachet.
20. **Primii pași** (în producție, PR #21, v24), pentru vizitatorii aduși de promovare. Tot aici: fila
    „Clasament” pe pagina de meci, a doua echipă la „Jucători” (marcajul zonei e `data-shown`, nu `data-tab`),
    rezumatul video cerut din nou la 5 minute până îl publică ESPN. La prima vizită
    (pachetul public, nimic ales, nu proprietarul) „Echipele mele” urcă în capul paginii ca „Bun venit! Ce echipe
    urmărești?” (`WELCOME` în `js/home.js`, `welcomeDue`/`setMine` în `js/mine.js`; „Mai târziu” păstrează pachetul,
    `flgames-welcome`). Pagina unui oraș mare cuprinde toată zona (`AREAS` în `js/places.js`: New York 11 echipe,
    Los Angeles 10…). TikTok recunoscut ca sursă (browserul din aplicație). Rezumatul de dimineață poate spune
    toată noaptea (`night`: câte meciuri, cele mai strânse 3, linkul la scorurile zilei; `nightGames` în `push-cron`).
21. **Microsoft Store** (în producție, PR #22, v25; aplicația trimisă la verificare pe 13 noiembrie 2026, Store ID
    `9MVZCGB9LB9V`, identitate `SportsHub.AmericanSportsHub`, publicare manuală după aprobare). Pachetul se face cu
    PWABuilder de la adresa `/?app=store&sursa=msstore` (PWABuilder n-are câmp de adresă de start); se încarcă doar
    `.msixbundle`. Aplicația din magazin e site-ul pornit la
    `/?app=store` (ținut minte, `flgames-store`; `?app=web` îl oprește): `STORE` și `okImg` în `js/teams.js`.
    În modul magazin: emblemele noastre în locul siglelor (culorile din `js/colors.js`, generat de
    `tools/build-colors.mjs`), fără poze ESPN (stadioane, jucători, știri), fără clipuri ESPN (rezumatul pe
    YouTube la orice ligă, `recapUrl`), cronica doar ca link. Pentru toate: pagina „Termeni” (`#termeni`),
    confidențialitatea completată (contact, cine primește date, păstrare, drepturi), nota „neafiliată” în subsol,
    manifestul cu `id`, categorii și capturi (`icons/screens/`). Ghidul de trimitere, textele și capturile sunt în
    `Downloads\AMERICAN SPORTS HUB\american-sports-hub-magazin\` (în afara repo-ului). Politicile Microsoft Store 7.20:
    editorul a rămas „Sports Hub” (decizia proprietarului, riscul 10.14 asumat), notificările fără promoții, orice
    sursă nouă de imagini trece prin `okImg`.
22. **Motive să revii** (în producție, PR #23, v26, 13 noiembrie 2026; aplicația din Microsoft Store e publicată din aceeași zi;
    notificările din ea pot cere „rulează în fundal” pornit în Setări Windows, altfel butonul „Pornește-le din browser”):
    - **Microsoft Store:** butonul „Descarcă din Microsoft Store” (doar în browser, pe Windows: în bara de sus și la „Pe
      telefon”, `offerStore` în `js/phone.js`); aplicația din magazin se numără separat (sursa `msstore`, evenimentul
      `install-store`).
    - **Fără spoilere** (ochiul din bara de sus, `flgames-nospoil`): scorurile și rezultatele (V/Î, forma, seria) se
      acoperă până le atingi; atingerea arată meciul peste tot (`sp()`, `SPOIL`, `revealGame` în `js/core.js`; clasa
      `nospoil` pe `<html>`). Pagina de meci ascunde filele sub „rezultatul e ascuns”.
    - **Meciul zilei pentru România** (`js/motd.js`, pur, testat): din meciurile zilei (SUA) din toate ligile, după
      forța echipelor, cât de apropiate sunt, echipele tale, playoff, rivalitate, TV național și ora României; cu motivele.
    - **Europa și evenimente** (`/api/world`, `netlify/lib/world.mjs`): meciurile din afara SUA și Canadei și zilele
      mari (Thanksgiving, Crăciun, Super Bowl, Winter Classic, All-Star…), găsite singure în programul ESPN pe 4 luni;
      fila „Europa și evenimente” din Ligile și cardurile din „De urmărit”.
    - **Liniile de playoff** în clasamentele de conferință (`CUTS` în `js/leagues.js`) și coloana „Dif.”.
    - **Imagine de distribuit** (`js/sharecard.js`): pagina de meci face o imagine 4:5 cu emblemele noastre.
    - **Rezumatul săptămânii:** duminică 19–23, ora României (`weeklyDue`, `weekDay`, bifa `weekly`).
    Rămase pentru o etapă viitoare: Pagina de jucător.
23. **După lansare** (în producție, 14 noiembrie 2026): PR #24 (v27) „Susține proiectul” (`#sustine`, doar Revolut.me,
    `DONATE` în `js/pages.js`, nu în aplicația din magazin) și marcajul de proprietar (5 atingeri doar marchează, `?eu=0`
    îl scoate); PR #25 (v28) **căutarea era stricată pentru toți vizitatorii publici** (orașele din Florida citeau echipele
    din pachetul activ, nu din `ALL_TEAMS`); PR #26 (v29) verificarea completă (45 de pagini × 3 variante): linkuri spre
    orice meci (`event` în `/api/game`) și spre echipele altui pachet (`#echipa/heat` → `#club/…`), datele de rezervă,
    sursa vizitei păstrată pe sesiune, linia de playoff din clasamente. **Regulă:** orice verificare se face și ca
    vizitator public (fără `?eu=1`, memoria ștearsă), nu doar ca proprietar.

## Promovare (în afara repo-ului)

Totul stă pe laptop, în `C:\Users\stroe\Downloads\AMERICAN SPORTS HUB\`. **Postările gata de publicat stau într-un singur
loc, `postari\<data>-<tip>\`** (aceleași imagini 4:5 pentru amândouă rețelele, plus `instagram.txt` și `tiktok.txt`; story-urile
în `postari\story-…\` cu `linkuri.txt`), făcute din butoanele `1 Postarea de dimineata`, `2 Postarea de seara`, `3 Orice alta
postare` din același folder (din 14 noiembrie 2026; vechile foldere pe rețea sunt în `arhiva\`). Generatoarele: `instagram-american-sports-hub\`
(generatoarele „Azi-noapte” / „Diseară” = `generator\azi-noapte.mjs [diseara]`, „The City” = `generator\the-city.mjs`
cu datele în `orase.mjs`), `tiktok-american-sports-hub\` (`generator\tiktok.mjs` copiază orice postare de Instagram
pentru TikTok: aceleași imagini 4:5, care în modul foto umplu lățimea; adresa site-ului scrisă în text), `american-sports-hub-magazin\` (Microsoft Store), `American-Sports-Hub-functii.pdf`
(catalogul de funcții) și `American Sports Hub linkuri si stare.pdf`. Linkurile spre site poartă sursa
(`?sursa=instagram`, `?sursa=tiktok`), ca să apară separat în statistici. TikTok: `@american_sports_h`.

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
js/track.js                 numărarea vizitelor (fără cookie-uri) și a câtorva acțiuni, pentru /api/stats
js/health.js                starea surselor (/api/health): rândul „Surse” și fraza din linia de stare
js/game.js                  pagina de meci: filele Rezumat, Jucători, Statistici, Faze, Absenți; graficul de șanse
js/ro.js                    traducerea textelor ESPN (stare meci, note, statistici, accidentări); fără DOM
js/ui.js                    funcții comune: esc, temă (auto/luminoasă/întunecată), embleme cu logo
js/colors.js                culorile și abrevierile tuturor echipelor, GENERAT de tools/build-colors.mjs
js/places.js                orașe și stadioane: pagini, vremea, banda cu vremea, graficul de climă
js/phone.js                 service worker, instalarea aplicației, pagina de abonare la calendar
js/ics.js                   fișiere .ics (iCalendar), folosit de pagină și de funcția de calendar; fără DOM
js/notify.js                pagina de notificări: permisiune, abonare push, alegerile (#notificari)
js/teamx.js                 filele profilului de echipă: Sezon (grafic, lideri), Lot, Știri
js/bracket.js               tabloul de playoff: serii din meciurile de playoff; fără DOM
js/mine.js                  „Echipele mele”: lista din browser (implicit Florida), `NBA-2` pentru restul
js/clubinfo.js              faptele din data/clubs.json pe pagina echipei: Despre, palmares, nume vechi, legende
js/guide.js                 fila „Ghid” din Ligile: unde vezi fiecare ligă din România (verificat de mână), explicații
js/leagues.js               pagina „Ligile” (#ligi): scoruri pe zi, clasamente complete (cu liniile de playoff), toate echipele, Europa și evenimente, orașele și stadioanele; banda „Azi în ligi”
js/motd.js                  „Meciul zilei pentru România”: alegerea și motivele; fără DOM
js/sharecard.js             imaginea de distribuit a unui meci (canvas, emblemele noastre)
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
netlify/functions/world.mjs      GET /api/world  meciurile din afara SUA și Canadei și zilele mari, pe 4 luni (cache 12 h)
netlify/lib/world.mjs       alegerea lor din programul ESPN (pură, testată)
netlify/functions/health.mjs     GET /api/health  ESPN și Open-Meteo răspund, în formatul așteptat? (cache 5 min)
netlify/functions/hit.mjs        POST /api/hit  o vizită sau o acțiune, numărată pe zi (fără date personale)
netlify/functions/feedback.mjs   POST /api/feedback  un mesaj din „Spune-ne ce crezi”
netlify/functions/stats.mjs      GET /api/stats?key=…  vizitele pe 30 de zile și părerile, doar cu STATS_KEY
netlify/functions/push.mjs       /api/push  salvează / citește / testează / șterge un abonament la notificări
netlify/functions/push-cron.mjs  programată, la 15 minute, doar în producție: trimite notificările datorate
netlify/lib/webpush.mjs     Web Push fără bibliotecă: semnătură VAPID (RFC 8292), criptare (RFC 8291)
netlify/lib/notify.mjs      ce notificări sunt datorate și textul lor; fără rețea
netlify/lib/health.mjs      verificarea surselor: o întrebare tipică fiecăreia și forma răspunsului
netlify/lib/stats.mjs       numărarea pe zile (pură, testată) și stocarea în Blobs (`stats`, `feedback`)
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
(doar de pe serverele ESPN), `goalies`, `predictor`, `leaders`, `event` (meciul în formatul programului: un link spre orice meci, chiar din altă zi
sau din alt pachet, își deschide pagina). Partea (`side`) e `home`/`away`. La un meci terminat cu rezumat, `videos` are
doar rezumatul și `recap: true` (cache o zi; fără rezumat, 15 minute, până îl publică ESPN).

Adrese: `#meci/NBA/401909963[/jucatori|statistici|faze|absenti]`, `#echipa/heat`,
`#echipa/heat[/sezon|lot|stiri]`, `#club/NBA/2[/sezon|lot|stiri]` (echipă din afara Floridei), `#calendar/heat,NBA-2`, `#notificari/NBA-2`,
`#ligi[/scoruri|clasamente|echipe|evenimente|orase|ghid][/2026-11-11]` (pagina „Ligile”, nu fereastră), `#oras/miami`, `#stadion/hard-rock-stadium`, `#calendar[/heat,panthers]`, `#notificari[/heat]`;
filtrele în
`?ligi=NBA,NHL&echipa=heat&florida=1&ore=1&zi=2026-11-15`. Butonul Înapoi închide fereastra.

Cheile echipelor din Florida sunt în `js/teams.js` (`heat`, `magic`, `panthers`, `lightning`,
`dolphins`, `bucs`, `jaguars`, `intermiami`, `orlandocity`, `marlins`, `rays`). MLB nu mai e
marcată de mână „extrasezon”: pagina o marchează singură când nu urmează niciun meci MLB, iar
`/api/schedule` păstrează pentru MLB doar meciurile de la 45 de zile în urmă la 60 înainte. Id-urile ESPN se caută după nume,
nu se scriu de mână.

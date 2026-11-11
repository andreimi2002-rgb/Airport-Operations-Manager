# Meciuri Florida

Calendar web al meciurilor echipelor profesioniste din Florida (NBA, NHL, NFL, MLS; MLB în
sezon), cu ora României, rezultate, clasamente, profiluri de echipă și pagini de meci.
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

## Plan pe etape

Etapele 1–3 sunt în producție (PR #5, 11 noiembrie 2026): site cu date live, pagini de meci
complete, orașele, stadioanele și vremea Floridei; aplicație instalabilă, offline, abonare la
calendar; notificări (Web Push, `push-cron` la 15 minute, doar în producție).

**Cum publicăm:** creditele Netlify sunt puține. Preview-urile (PR-uri spre `main`) sunt
gratuite, fiecare merge în `main` consumă. Mai multe etape merg pe un singur branch / PR cu
baza `main` (altfel Netlify nu face preview) și se unesc o singură dată, la final.

4. **Etapa 4** (în lucru, branch `stage-4-america`, un singur merge la final):
   - **Partea 1, în plus pentru Florida:** profil de echipă bogat (lot,
     lideri, grafic al sezonului, știri), căutare, tabloul de playoff, MLB automat
     (Marlins, Rays).
   - **Partea 2, restul Americii, varianta ușoară:** profiluri bogate doar pentru Florida; pentru
     restul: scoruri pe zile din toate ligile, clasamente complete, pagină simplă de echipă,
     orașe și stadioane cu fapte, ora locală și vremea. Datele pe ligă și zi (nu pe echipă),
     ca să nu se înmulțească cererile la ESPN.

## Structura

```
index.html                  pagina
css/app.css                 stiluri (tokeni de culoare la început, temă luminoasă și întunecată)
js/teams.js                 configurație comună pagină + funcții: ligi, echipe, divizii, orașe
js/app.js                   încărcare date, randare, filtre în adresă, ferestre (meci/echipă), scor live
js/game.js                  pagina de meci: filele Rezumat, Jucători, Statistici, Faze, Absenți; graficul de șanse
js/ro.js                    traducerea textelor ESPN (stare meci, note, statistici, accidentări); fără DOM
js/ui.js                    funcții comune: esc, temă (auto/luminoasă/întunecată), embleme cu logo
js/places.js                orașe și stadioane: pagini, vremea, banda cu vremea, graficul de climă
js/phone.js                 service worker, instalarea aplicației, pagina de abonare la calendar
js/ics.js                   fișiere .ics (iCalendar), folosit de pagină și de funcția de calendar; fără DOM
js/notify.js                pagina de notificări: permisiune, abonare push, alegerile (#notificari)
js/teamx.js                 filele profilului de echipă: Sezon (grafic, lideri), Lot, Știri
js/bracket.js               tabloul de playoff: serii din meciurile de playoff; fără DOM
js/leagues.js               pagina „Ligile” (#ligi): scoruri pe zi, clasamente complete, toate echipele; banda „Azi în ligi”
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
netlify/functions/push.mjs       /api/push  salvează / citește / testează / șterge un abonament la notificări
netlify/functions/push-cron.mjs  programată, la 15 minute, doar în producție: trimite notificările datorate
netlify/lib/webpush.mjs     Web Push fără bibliotecă: semnătură VAPID (RFC 8292), criptare (RFC 8291)
netlify/lib/notify.mjs      ce notificări sunt datorate și textul lor; fără rețea
netlify/lib/subs.mjs        stocarea abonamentelor (Netlify Blobs; local, fișiere JSON)
tools/vapid-keys.mjs        generează perechea de chei VAPID: node tools/vapid-keys.mjs
data/snapshot.json          date de rezervă (format /api/schedule)
data/places.json            orașe și stadioane, GENERAT: nu se editează de mână
data/america.json           stadioanele și orașele echipelor din afara Floridei (fapte), GENERAT de
                            tools/build-america.mjs: stadionul din meciurile de acasă (nu „franchise
                            venue” de la ESPN, adesea istoric), poze ESPN, oraș geocodat Open-Meteo
tools/places-src.json       sursa lui places.json: textele în română, fapte, surse, numele pozelor
tools/build-places.mjs      generează places.json (coordonate, poze, climă, rute): node tools/build-places.mjs
tools/test.mjs              teste offline pentru cititoare și traduceri: node tools/test.mjs
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
(doar de pe serverele ESPN), `goalies`, `predictor`, `leaders`. Partea (`side`) e `home`/`away`.

Adrese: `#meci/NBA/401909963[/jucatori|statistici|faze|absenti]`, `#echipa/heat`,
`#echipa/heat[/sezon|lot|stiri]`, `#club/NBA/2[/sezon|lot|stiri]` (echipă din afara Floridei),
`#ligi[/scoruri|clasamente|echipe][/2026-11-11]` (pagina „Ligile”, nu fereastră), `#oras/miami`, `#stadion/hard-rock-stadium`, `#calendar[/heat,panthers]`, `#notificari[/heat]`;
filtrele în
`?ligi=NBA,NHL&echipa=heat&florida=1&ore=1&zi=2026-11-15`. Butonul Înapoi închide fereastra.

Cheile echipelor din Florida sunt în `js/teams.js` (`heat`, `magic`, `panthers`, `lightning`,
`dolphins`, `bucs`, `jaguars`, `intermiami`, `orlandocity`, `marlins`, `rays`). MLB nu mai e
marcată de mână „extrasezon”: pagina o marchează singură când nu urmează niciun meci MLB, iar
`/api/schedule` păstrează pentru MLB doar meciurile de la 45 de zile în urmă la 60 înainte. Id-urile ESPN se caută după nume,
nu se scriu de mână.

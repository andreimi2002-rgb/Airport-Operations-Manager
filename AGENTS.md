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

1. **Site cu date live** (în lucru, PR #3): calendarul mutat de pe claude.ai, cu date ESPN
   live, logo-uri oficiale, scor live, pagini de meci complete, plus orașele, stadioanele și
   vremea pentru echipele din Florida.
2. **Pe telefon:** PWA instalabilă, merge offline, abonare la calendar (link .ics pentru
   Google Calendar/iPhone) cu meciurile echipelor alese.
3. **Notificări** înainte de meciurile echipei favorite.
4. **Toate echipele** din cele 5 ligi, cu „Echipele mele” și filtru pe stat/oraș.

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
netlify/lib/espn.mjs        citirea și normalizarea datelor ESPN
netlify/lib/weather.mjs     prognoza Open-Meteo, redusă la ce arată pagina
netlify/functions/schedule.mjs   GET /api/schedule  meciurile sezonului + clasamente (cache 15 min)
netlify/functions/live.mjs       GET /api/live?l=NBA,NHL  scorurile de azi (cache 30 s)
netlify/functions/game.mjs       GET /api/game?l=NBA&id=…  detaliile unui meci
netlify/functions/weather.mjs    GET /api/weather?lat=…&lon=…[&brief=1]  vremea, doar în Florida (cache 30 min)
data/snapshot.json          date de rezervă (format /api/schedule)
data/places.json            orașe și stadioane, GENERAT: nu se editează de mână
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
`#oras/miami`, `#stadion/hard-rock-stadium`; filtrele în
`?ligi=NBA,NHL&echipa=heat&florida=1&ore=1&zi=2026-11-15`. Butonul Înapoi închide fereastra.

Cheile echipelor din Florida sunt în `js/teams.js` (`heat`, `magic`, `panthers`, `lightning`,
`dolphins`, `bucs`, `jaguars`, `intermiami`, `orlandocity`). Id-urile ESPN se caută după nume,
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

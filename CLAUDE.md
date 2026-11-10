# Meciuri Florida

Calendar web al meciurilor echipelor profesioniste din Florida (NBA, NHL, NFL, MLS; MLB în
sezon), cu ora României, rezultate, clasamente, profiluri de echipă și pagini de meci.
Proiect pentru uz personal. Repo-ul a fost înainte jocul Airport Operations Manager (rămas în
istoricul git, pe `main` până la merge-ul etapei 1).

## Reguli

- **Fără API-uri plătite și fără chei API.** Datele vin din API-ul public al ESPN
  (`site.api.espn.com`), gratuit și fără cheie, dar neoficial: poate schimba formatul fără
  anunț. Tot codul care îl citește e în `netlify/lib/espn.mjs`, defensiv, și întoarce date
  parțiale în loc să crape.
- **Logo-uri:** cele oficiale, încărcate direct de pe serverul ESPN (`a.espncdn.com`), nu
  copiate în repo. Sunt mărci înregistrate: acceptabil pentru uz personal, de înlocuit dacă
  site-ul devine public sau comercial. Dacă un logo nu se încarcă, apare emblema cu culorile
  echipei și abrevierea.
- **Site static + funcții Netlify subțiri.** HTML/CSS/JavaScript cu module ES, fără framework
  și fără pas de build. Funcțiile doar citesc ESPN, normalizează și pun în cache pe CDN.
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

1. **Site cu date live** (în lucru): calendarul mutat de pe claude.ai, cu date ESPN live,
   logo-uri oficiale, scor live, pagini de meci cu scor pe sferturi, lideri și șanse de victorie.
2. **Pe telefon:** PWA instalabilă, merge offline, abonare la calendar (link .ics pentru
   Google Calendar/iPhone) cu meciurile echipelor alese.
3. **Notificări** înainte de meciurile echipei favorite.
4. **Toate echipele** din cele 5 ligi, cu „Echipele mele” și filtru pe stat/oraș.

## Structura

```
index.html                  pagina
css/app.css                 stiluri (tokeni de culoare la început, temă luminoasă și întunecată)
js/teams.js                 configurație comună pagină + funcții: ligi, echipe, divizii, orașe
js/app.js                   încărcare date, randare, profiluri, pagini de meci, scor live
netlify/lib/espn.mjs        citirea și normalizarea datelor ESPN
netlify/functions/schedule.mjs   GET /api/schedule  meciurile sezonului + clasamente (cache 15 min)
netlify/functions/live.mjs       GET /api/live?l=NBA,NHL  scorurile de azi (cache 30 s)
netlify/functions/game.mjs       GET /api/game?l=NBA&id=…  detaliile unui meci
data/snapshot.json          date de rezervă (format /api/schedule)
tools/test.mjs              teste offline pentru cititoarele ESPN: node tools/test.mjs
tools/mock-espn.mjs         ESPN simulat din date vechi; regenerează snapshot.json
```

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

Cheile echipelor din Florida sunt în `js/teams.js` (`heat`, `magic`, `panthers`, `lightning`,
`dolphins`, `bucs`, `jaguars`, `intermiami`, `orlandocity`). Id-urile ESPN se caută după nume,
nu se scriu de mână.

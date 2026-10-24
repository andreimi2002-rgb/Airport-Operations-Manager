# Airport Operations Manager

Joc web de management de aeroport, realist, cu aeroporturi, rute și avioane reale.
Începem foarte simplu și creștem pe etape.

**Concept:** primul aeroport e San Francisco International (SFO). Datele conțin tot
aeroportul real, dar la start e deschisă doar o parte mică: pista 10L/28R, gate-urile
D10–D17 din Terminal 2 și rutele LAX, LAS, SEA, PDX. Restul (piste, terminale,
gate-uri, rute, companii) se deblochează cu bani și reputație.

## Reguli

- **Fără API-uri plătite și fără chei API.** Toate datele sunt fișiere JSON statice în
  proiect (surse: OurAirports, OpenFlights, Wikipedia). Zborurile sunt generate de joc
  din rute reale, nu preluate live. Excepție permisă în etapa 4: Open-Meteo (gratuit,
  fără cheie) pentru vreme.
- **Fără logo-uri sau liveries de companii aeriene**, doar nume și coduri.
- **Site static** (HTML/CSS/JavaScript, module ES, fără framework, fără pas de build,
  fără backend). Deploy pe Netlify. Trebuie să meargă bine pe desktop și pe telefon.
- **Design întunecat și minimalist**, în stilul Airport Live
  (https://live-airport.netlify.app). Tokenii de culoare stau în `css/theme.css`.
- **Lucrăm pe branch-uri** (`stage-N-...`). Spune pe scurt ce faci pe parcurs și
  întreabă înainte de deciziile importante.
- **Push și PR-uri rar:** fiecare deploy preview consumă credit Netlify. Lucrăm și facem
  commit local, verificăm cu un server local și capturi de ecran, și facem push / PR
  doar când o etapă e gata, **după ce întrebi**. Modificările mici se adună în PR-ul
  etapei.
- Interfața jocului e în engleză (ca Airport Live). Comunicarea cu utilizatorul: în română.
- Fiecare etapă trebuie să fie jucabilă și completă înainte de următoarea.

## Plan pe etape

0. **Fundație** ✅: structura proiectului, pagina de start cu SFO (nume, oră locală,
   dată), fișiere de date: SFO cu toate pistele și terminalele (marcate
   blocat/deblocat), 30 de destinații reale, 10 tipuri de avioane.
1. **Harta 2D** simplificată a întregului SFO; zonele blocate apar gri.
2. **Orarul zilei:** generator de zboruri pentru o zi, doar pe rutele deblocate, plus
   ecran departures/arrivals.
3. **Prima mecanică:** atribuirea zborurilor la gate-uri, ceasul jocului, bani,
   reputație și penalizări.
4. **Operațiuni:** turnaround, personal, vreme reală cu ceață (Open-Meteo).
5. **Creștere:** deblocare gate-uri, terminale, piste, rute, contracte, statistici,
   salvare, al doilea aeroport (ONT/SMF, SAN sau SEA).

Nu intră la început: 3D, multiplayer, logo-uri, date live.

## Structura

```
index.html            pagina de start
css/theme.css         tokeni de design (culori, fonturi)
css/main.css          layout și componente
js/main.js            pornire și randare
js/data.js            încărcarea fișierelor JSON
js/clock.js           ora locală în fusul orar al aeroportului
js/unlocks.js         singurul loc care decide ce e deblocat
data/airports/SFO.json  piste, terminale, gate-uri
data/destinations.json  rutele din SFO
data/aircraft.json      tipurile de avioane
data/airlines.json      companii (nume + coduri)
fonts/                Inter + JetBrains Mono (OFL), găzduite local
tools/                scripturi pentru date (Node 18+), nu rulează în browser
```

Rulare locală: orice server static din rădăcina repo-ului, de exemplu
`npx serve .` sau `python -m http.server`. Paginile nu merg din `file://`, pentru că
`fetch` nu poate citi JSON de acolo.

## Formatul datelor

**Deblocare.** Fiecare element care se poate debloca (pistă, terminal, gate, rută,
companie) are câmpul `unlock`:

```json
"unlock": { "initial": true }
"unlock": { "initial": false, "cost": 400000, "reputation": 35, "requires": ["terminal:T1"] }
```

- Fișierele din `data/` nu se modifică în timpul jocului. Progresul jucătorului stă
  în starea jocului, ca listă de chei `"<kind>:<id>"` (de exemplu `"gate:D18"`,
  `"route:SAN"`, `"airline:B6"`).
- Tipurile de chei sunt `runway`, `terminal`, `gate`, `route` și `airline`. Rutele și
  companiile au ca id codul IATA; restul au câmpul `id`.
- Un element e deblocat dacă are `initial: true` sau dacă cheia lui e în
  `state.unlocked`. Folosește mereu `isUnlocked()` din `js/unlocks.js`, nu verifica
  manual.
- `requires` = chei care trebuie deblocate înainte (gate-urile unui terminal blocat
  cer terminalul).
- Un zbor pe o rută există doar dacă sunt deblocate **și ruta, și compania**.
- Costurile și pragurile de reputație sunt provizorii; le echilibrăm în etapa 5.

**Mărimi.** Avioanele și gate-urile au `size`: `regional` < `narrowbody` < `widebody`.
Un gate primește avioane de mărimea lui sau mai mici.

**Avioane.** Id-urile sunt coduri de tip ICAO (`E175`, `A320`, `B738`, `B789`, `A359`...).
Destinațiile listează în `aircraft` tipurile folosite realist pe ruta respectivă.

**Date geografice.** Numele, coordonatele, pistele și distanțele vin din OurAirports
prin `node tools/refresh-geo.mjs <airports.csv> <runways.csv>`. Câmpurile de joc
(unlock, companii, avioane, gate-uri) se editează de mână. Detalii în
`tools/README.md`.

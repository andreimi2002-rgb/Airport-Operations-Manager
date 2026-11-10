# Meciuri Florida

Calendar al meciurilor echipelor din Florida (Heat, Magic, Panthers, Lightning, Dolphins,
Buccaneers, Jaguars, Inter Miami, Orlando City), cu ora României, scor live, rezultate,
clasamente, profiluri de echipă și pagini de meci.

- Site static (HTML, CSS, module JavaScript) plus trei funcții Netlify care citesc datele
  publice gratuite ale ESPN. Fără chei API, fără servicii plătite.
- Logo-urile oficiale se încarcă de pe serverul ESPN; proiect pentru uz personal.
- Dacă sursa live nu răspunde, pagina arată ultimele date salvate.

## Rulare locală

```sh
npx netlify dev          # pagina + funcțiile /api/*
# sau doar pagina, cu datele de rezervă:
python -m http.server 8000
```

Teste pentru cititoarele de date: `node tools/test.mjs`.

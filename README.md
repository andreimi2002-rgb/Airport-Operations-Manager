# Airport Operations Manager

A realistic airport management game for the web, with real airports, routes and aircraft.
You start at San Francisco International (SFO) with one runway and eight gates, and unlock the
rest of the real airport as you grow.

- Static site (HTML, CSS, JavaScript modules), no build step and no backend.
- All data is static JSON in `data/` from free sources (OurAirports, OpenFlights, Wikipedia).
- Airline names and codes only, no logos or liveries.

## Run locally

```sh
npx serve .
# or
python -m http.server 8000
```

Open the address it prints. Opening `index.html` directly from disk does not work, because the
browser blocks loading the JSON files.

See [CLAUDE.md](CLAUDE.md) for the rules, the stage plan and the data format.

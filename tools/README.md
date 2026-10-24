# Data sources and tools

| Data | Source | Notes |
|---|---|---|
| Airport names, coordinates, runways | [OurAirports](https://ourairports.com/data/) (public domain) | Filled by `refresh-geo.mjs`. |
| Routes, airlines | [OpenFlights](https://openflights.org/data) | Old data, so routes and airlines were checked by hand against current SFO service. |
| Aircraft (seats, range, speed) | Wikipedia | Rounded typical values, written by hand. |
| Terminals, gates | SFO public terminal maps | Simplified. Gate numbering per boarding area is approximate and will be checked against OpenStreetMap when the map is drawn (stage 1). |

## refresh-geo.mjs

Updates the geographic fields in `data/airports/SFO.json` and `data/destinations.json`
and leaves the gameplay fields alone.

```sh
# Download once; the CSVs are not committed.
curl -LO https://davidmegginson.github.io/ourairports-data/airports.csv
curl -LO https://davidmegginson.github.io/ourairports-data/runways.csv

node tools/refresh-geo.mjs airports.csv runways.csv
```

It fills:
- `SFO.json`: `name`, `city`, `country`, `region`, `location`, and for each runway (matched
  by its `ends`) `lengthFt`, `widthFt`, `surface`, `thresholds`.
- `destinations.json`: `name`, `city`, `country`, `lat`, `lon`, `distanceKm` (great-circle
  distance from SFO). City names that OurAirports gives as a suburb (e.g. "Dulles") are
  replaced with the city served (`CITY_SERVED` in the script).

To add a destination, add an entry with `iata`, `type`, `airlines`, `aircraft` and `unlock`,
then run the script.

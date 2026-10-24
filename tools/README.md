# Data sources and tools

| Data | Source | Notes |
|---|---|---|
| Airport names, coordinates, runways | [OurAirports](https://ourairports.com/data/) (public domain) | Filled by `refresh-geo.mjs`. |
| Routes, airlines | [OpenFlights](https://openflights.org/data) | Old data, so routes and airlines were checked by hand against current SFO service. |
| Aircraft (seats, range, speed) | Wikipedia | Rounded typical values, written by hand. |
| Map: boundary, aprons, taxiways, gates, tower | [OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL) | Built by `build-map.mjs`. Credit "© OpenStreetMap contributors" must stay visible on the map. |
| Terminal ring and piers | Drawn by hand | `schematic` section of `SFO-map.json`, traced from the OSM gate positions. |
| Airport photo | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Aerial_view_of_San_Francisco_International_Airport_dllu.jpg) | Daniel L. Lu, CC BY-SA 4.0. Credited on the page. |

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

## build-map.mjs

Builds `data/airports/SFO-map.json` from an OpenStreetMap export and syncs the gate list
in `SFO.json` with the real gates (existing gates keep their size and unlock; new ones get
defaults from `defaultGate` in the script). The hand-drawn `schematic` section is kept.

```sh
# Download once from Overpass; the export is not committed.
curl -s --data-urlencode "data@tools/sfo.overpassql" https://overpass-api.de/api/interpreter -o sfo-osm.json

node tools/build-map.mjs sfo-osm.json
```

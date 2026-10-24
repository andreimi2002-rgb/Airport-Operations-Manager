// Loads the static game data (JSON files in /data).

async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Could not load ${path} (HTTP ${res.status})`);
  return res.json();
}

export async function loadGameData(airportCode = 'SFO') {
  const [airport, destinations, aircraft, airlines] = await Promise.all([
    loadJson(`data/airports/${airportCode}.json`),
    loadJson('data/destinations.json'),
    loadJson('data/aircraft.json'),
    loadJson('data/airlines.json')
  ]);
  return {
    airport,
    destinations: destinations.destinations,
    aircraft: aircraft.aircraft,
    airlines: airlines.airlines
  };
}

// Builds data/airports/SFO-map.json from an OpenStreetMap export and syncs the gate list
// in data/airports/SFO.json with the real gates found in OSM.
//
// Usage (Node 18+):
//   node tools/build-map.mjs <path/to/sfo-osm.json>
//
// Get the OSM export once from Overpass (query in tools/README.md). It is not stored in the repo.
//
// What it writes into SFO-map.json:
//   - generated from OSM: airport boundary, aprons, taxiways, gate positions, tower
//   - generated from SFO.json: runway rectangles (from OurAirports thresholds)
//   - kept as is: the "schematic" section (terminal ring and piers), drawn by hand
// All coordinates are meters from the airport reference point: x east, y south (SVG order).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pretty } from './pretty.mjs';

const [osmFile] = process.argv.slice(2);
if (!osmFile) {
  console.error('Usage: node tools/build-map.mjs <sfo-osm.json>');
  process.exit(1);
}

const AIRPORT_FILE = 'data/airports/SFO.json';
const MAP_FILE = 'data/airports/SFO-map.json';

const airport = JSON.parse(readFileSync(AIRPORT_FILE, 'utf8'));
const osm = JSON.parse(readFileSync(osmFile, 'utf8')).elements;
const oldMap = existsSync(MAP_FILE) ? JSON.parse(readFileSync(MAP_FILE, 'utf8')) : {};

// --- projection: local meters around the airport reference point ---
const { lat: LAT0, lon: LON0 } = airport.location;
const M_PER_DEG = 111320;
const KX = M_PER_DEG * Math.cos((LAT0 * Math.PI) / 180);
const project = ({ lat, lon }) => [Math.round((lon - LON0) * KX), Math.round(-(lat - LAT0) * M_PER_DEG)];

// --- Douglas-Peucker simplification (keeps the drawing clean and the file small) ---
function simplify(points, eps) {
  if (points.length < 3) return points;
  const [a, b] = [points[0], points.at(-1)];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  let maxDist = 0, index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const d = Math.abs((b[1] - a[1]) * p[0] - (b[0] - a[0]) * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
    if (d > maxDist) { maxDist = d; index = i; }
  }
  if (maxDist <= eps) return [a, b];
  return simplify(points.slice(0, index + 1), eps).slice(0, -1).concat(simplify(points.slice(index), eps));
}

// Closed rings: split at the point farthest from the start, simplify both halves.
function simplifyRing(points, eps) {
  const pts = points.slice(0, -1);
  let far = 0, farDist = 0;
  pts.forEach((p, i) => {
    const d = Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]);
    if (d > farDist) { farDist = d; far = i; }
  });
  return simplify(pts.slice(0, far + 1), eps).slice(0, -1)
    .concat(simplify(pts.slice(far).concat([pts[0]]), eps).slice(0, -1));
}

const tag = (e, k) => e.tags?.[k];
const ways = kind => osm.filter(e => e.type === 'way' && tag(e, 'aeroway') === kind && e.geometry);

// --- boundary, aprons, taxiways ---
const aerodrome = ways('aerodrome').find(e => tag(e, 'icao') === airport.icao);
const boundary = aerodrome ? simplifyRing(aerodrome.geometry.map(project), 15) : [];

const aprons = ways('apron').map(e => simplifyRing(e.geometry.map(project), 6)).filter(r => r.length >= 3);

const taxiways = ways('taxiway')
  .map(e => ({ ref: tag(e, 'ref') ?? '', points: simplify(e.geometry.map(project), 4) }))
  .filter(t => t.points.length >= 2);

// --- tower ---
const towerWay = osm.find(e => tag(e, 'aeroway') === 'tower' && e.geometry);
let tower = null;
if (towerWay) {
  const pts = towerWay.geometry.map(project);
  tower = [0, 1].map(i => Math.round(pts.reduce((s, p) => s + p[i], 0) / pts.length));
}

// --- runways from OurAirports thresholds (already in SFO.json) ---
const runways = airport.runways.map(r => ({
  id: r.id,
  ends: r.thresholds.map(t => ({ ident: t.ident, at: project(t) })),
  widthM: Math.round(r.widthFt * 0.3048)
}));

// --- gates: positions from OSM, one entry per gate ref ---
// OSM sometimes maps one gate on two levels (two nodes, same ref) and a few
// shared stands as "G11-G12". Average duplicates; split shared stands.
const gateNodes = new Map();
for (const e of osm.filter(e => e.type === 'node' && tag(e, 'aeroway') === 'gate' && tag(e, 'ref'))) {
  const refs = tag(e, 'ref').split('-');
  refs.forEach((ref, i) => {
    const [x, y] = project(e);
    const offset = (i - (refs.length - 1) / 2) * 14; // spread shared stands a little
    const list = gateNodes.get(ref) ?? [];
    list.push([x + offset, y]);
    gateNodes.set(ref, list);
  });
}
const gatePositions = Object.fromEntries(
  [...gateNodes.entries()]
    .map(([ref, pts]) => [ref, [0, 1].map(i => Math.round(pts.reduce((s, p) => s + p[i], 0) / pts.length))])
    .sort(([a], [b]) => a[0].localeCompare(b[0]) || parseInt(a.slice(1)) - parseInt(b.slice(1)))
);

// --- sync the gate list in SFO.json with the real gates ---
// Existing gates keep their size and unlock; new gates get a default from GATE_RULES.
const AREA_TERMINAL = Object.fromEntries(airport.terminals.flatMap(t => t.areas.map(a => [a, t])));
const COST = { regional: 250000, narrowbody: 400000, widebody: 900000 };
function defaultGate(id) {
  const terminal = AREA_TERMINAL[id[0]];
  const n = parseInt(id.slice(1), 10);
  const area = id[0];
  const size =
    area === 'G' || (area === 'A' && n > 3) || (area === 'F' && n >= 11 && n <= 15) ? 'widebody'
    : (area === 'B' && n <= 4) || (area === 'F' && n <= 10) ? 'regional'
    : 'narrowbody';
  const rep = terminal.unlock.initial ? 5 : terminal.unlock.reputation;
  const unlock = { initial: false, cost: COST[size], reputation: rep };
  if (!terminal.unlock.initial) unlock.requires = [`terminal:${terminal.id}`];
  return { id, area, size, unlock };
}

let added = 0, removed = 0;
for (const terminal of airport.terminals) {
  const existing = new Map(terminal.gates.map(g => [g.id, g]));
  const ids = Object.keys(gatePositions).filter(id => terminal.areas.includes(id[0]));
  removed += terminal.gates.filter(g => !gatePositions[g.id]).length;
  terminal.gates = ids.map(id => existing.get(id) ?? (added++, defaultGate(id)));
}
writeFileSync(AIRPORT_FILE, pretty(airport));

// --- write the map ---
const xs = boundary.map(p => p[0]), ys = boundary.map(p => p[1]);
const map = {
  source: 'OpenStreetMap contributors (ODbL), simplified. Runways: OurAirports. Built by tools/build-map.mjs.',
  attribution: '© OpenStreetMap contributors',
  units: 'm',
  origin: { lat: LAT0, lon: LON0 },
  bounds: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
  schematic: oldMap.schematic ?? null,
  tower,
  runways,
  gates: gatePositions,
  boundary,
  aprons,
  taxiways
};
writeFileSync(MAP_FILE, pretty(map));

const gateCount = airport.terminals.reduce((n, t) => n + t.gates.length, 0);
console.log(`Map: ${aprons.length} aprons, ${taxiways.length} taxiways, ${Object.keys(gatePositions).length} gate positions.`);
console.log(`Gates in ${AIRPORT_FILE}: ${gateCount} (${added} added, ${removed} removed).`);
if (!map.schematic) console.log('Note: no "schematic" section yet; add the terminal ring and piers by hand.');

import { loadGameData } from './data.js';
import { startClock } from './clock.js';
import { createState, isUnlocked, countUnlocked } from './unlocks.js';

const $ = id => document.getElementById(id);

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function money(n) {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${n}`;
}

const nf = new Intl.NumberFormat('en-US');

function costLabel(unlock) {
  return `<div class="cost"><b>${money(unlock.cost)}</b><br>rep ${unlock.reputation}</div>`;
}

function badge(open) {
  return open ? '<span class="badge open">Open</span>' : '<span class="badge locked">Locked</span>';
}

function renderHero(airport) {
  $('hero').dataset.code = airport.iata;
  $('airportCode').textContent = airport.iata;
  $('airportName').textContent = airport.name;
  const country = new Intl.DisplayNames(['en'], { type: 'region' }).of(airport.country);
  const region = airport.region.split('-')[1];
  $('airportLocation').textContent = `${airport.city}, ${region} · ${country}`;
  const chips = [
    ['ICAO', airport.icao],
    ['Elevation', `${airport.location.elevationFt} ft`],
    ['Runways', airport.runways.length],
    ['Terminals', airport.terminals.length]
  ];
  $('airportChips').innerHTML = chips.map(([k, v]) => `<div class="chip"><small>${esc(k)}</small><strong>${esc(v)}</strong></div>`).join('');

  startClock(airport.timezone, t => {
    $('localTime').textContent = t.time;
    $('localSec').textContent = t.seconds;
    $('localDate').textContent = `${t.date} · ${t.zone}`;
    $('utcTime').textContent = `${t.utc} UTC`;
  });
}

function renderKpis(data, state) {
  const gates = data.airport.terminals.flatMap(t => t.gates);
  const kpis = [
    ['Runways', countUnlocked('runway', data.airport.runways, state), data.airport.runways.length],
    ['Terminals', countUnlocked('terminal', data.airport.terminals, state), data.airport.terminals.length],
    ['Gates', countUnlocked('gate', gates, state), gates.length],
    ['Routes', countUnlocked('route', data.destinations, state), data.destinations.length],
    ['Airlines', countUnlocked('airline', data.airlines, state), data.airlines.length],
    ['Aircraft types', data.aircraft.length, data.aircraft.length]
  ];
  $('kpis').innerHTML = kpis.map(([label, open, total]) => `
    <div class="kpi">
      <small>${esc(label)}</small>
      <div class="kpi-val">${open}<span> / ${total}</span></div>
      <div class="bar"><i style="width:${(open / total) * 100}%"></i></div>
    </div>`).join('');
}

function renderRunways(runways, state) {
  $('runwayCount').textContent = `${countUnlocked('runway', runways, state)} of ${runways.length} open`;
  $('runwayList').innerHTML = runways.map(r => {
    const open = isUnlocked('runway', r, state);
    return `<li class="${open ? 'open' : 'locked'}">
      <div class="r-main">
        <div class="r-title"><span class="r-code">${esc(r.ends.join(' / '))}</span>${badge(open)}</div>
        <div class="r-sub">${nf.format(r.lengthFt)} × ${r.widthFt} ft · ${esc(r.realUse)}</div>
      </div>
      ${open ? '' : costLabel(r.unlock)}
    </li>`;
  }).join('');
}

function renderTerminals(terminals, state) {
  $('terminalCount').textContent = `${countUnlocked('terminal', terminals, state)} of ${terminals.length} open`;
  $('terminalList').innerHTML = terminals.map(t => {
    const open = isUnlocked('terminal', t, state);
    const openGates = t.gates.filter(g => isUnlocked('gate', g, state)).map(g => g.id);
    const gateText = openGates.length
      ? `${openGates.length} of ${t.gates.length} gates open (${openGates[0]}–${openGates.at(-1)})`
      : `${t.gates.length} gates`;
    return `<li class="${open ? 'open' : 'locked'}">
      <div class="r-main">
        <div class="r-title">${esc(t.name)}${badge(open)}</div>
        <div class="r-sub">Boarding areas ${esc(t.areas.join(', '))} · ${esc(gateText)}</div>
      </div>
      ${open ? '' : costLabel(t.unlock)}
    </li>`;
  }).join('');
}

function renderRoutes(destinations, state) {
  // Open routes first, then by distance.
  const sorted = [...destinations].sort((a, b) =>
    (isUnlocked('route', b, state) - isUnlocked('route', a, state)) || a.distanceKm - b.distanceKm);
  $('routeCount').textContent = `${countUnlocked('route', destinations, state)} of ${destinations.length} open`;
  $('routeList').innerHTML = sorted.map(d => {
    const open = isUnlocked('route', d, state);
    return `<li class="route ${open ? 'open' : 'locked'}">
      <div class="route-top"><span class="route-code">${esc(d.iata)}</span><span class="route-dist">${nf.format(d.distanceKm)} km</span></div>
      <div class="route-city" title="${esc(d.name)}">${esc(d.city)}, ${esc(d.country)}</div>
      <div class="route-meta">
        <span class="${d.type === 'international' ? 'intl' : ''}">${esc(d.airlines.join(' · '))}</span>
        <span>${open ? 'OPEN' : `${money(d.unlock.cost)} · rep ${d.unlock.reputation}`}</span>
      </div>
    </li>`;
  }).join('');
}

function renderAircraft(aircraft) {
  $('aircraftCount').textContent = `${aircraft.length} types`;
  $('aircraftList').innerHTML = aircraft.map(a => `
    <li>
      <div class="ac-top"><span class="ac-code">${esc(a.id)}</span><span class="ac-size ${esc(a.size)}">${esc(a.size)}</span></div>
      <div class="ac-name">${esc(a.name)}</div>
      <div class="ac-stats">${a.seats} seats · ${nf.format(a.rangeKm)} km · ${a.cruiseKmh} km/h</div>
    </li>`).join('');
}

function showError(err) {
  const view = $('statusView');
  view.classList.add('error');
  $('statusTitle').textContent = 'Could not load the airport';
  $('statusText').textContent = err.message;
  console.error(err);
}

async function init() {
  try {
    const data = await loadGameData('SFO');
    const state = createState(); // Saved games come in stage 5; for now everything starts fresh.
    renderHero(data.airport);
    renderKpis(data, state);
    renderRunways(data.airport.runways, state);
    renderTerminals(data.airport.terminals, state);
    renderRoutes(data.destinations, state);
    renderAircraft(data.aircraft);
    $('statusView').hidden = true;
    $('airportView').hidden = false;
  } catch (err) {
    showError(err);
  }
}

init();

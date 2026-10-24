import { loadGameData } from './data.js';
import { startClock } from './clock.js';
import { createState, isUnlocked, countUnlocked } from './unlocks.js';
import { createAirportMap } from './map.js';

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

function renderPhoto(photo) {
  if (!photo) return;
  const img = $('heroImg');
  img.onload = () => $('hero').classList.add('has-photo');
  img.alt = photo.alt;
  img.sizes = '(max-width: 760px) 100vw, 1280px';
  img.srcset = `${photo.srcSmall} 1280w, ${photo.src} 2400w`;
  img.src = photo.src;
  $('heroCredit').innerHTML =
    `Photo: <a href="${esc(photo.sourceUrl)}" target="_blank" rel="noopener">${esc(photo.author)}</a>, ` +
    `<a href="${esc(photo.licenseUrl)}" target="_blank" rel="noopener">${esc(photo.license)}</a>`;
}

function renderHero(airport) {
  $('hero').dataset.code = airport.iata;
  renderPhoto(airport.photo);
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

const SIZE_LABEL = { regional: 'Regional jets', narrowbody: 'Up to narrowbody', widebody: 'Up to widebody' };

function infoCard({ title, open, lines, unlock, requires }) {
  const req = requires?.length ? `<div class="mi-req">Needs ${esc(requires.join(', '))} first</div>` : '';
  const cost = open ? '' : `<div class="mi-cost"><b>${money(unlock.cost)}</b> · reputation ${unlock.reputation}</div>${req}`;
  return `<div class="mi-head"><strong>${esc(title)}</strong>${badge(open)}</div>
    ${lines.map(l => `<div class="mi-line">${esc(l)}</div>`).join('')}${cost}`;
}

function renderMapInfo(selection, data, state) {
  const box = $('mapInfo');
  if (!selection) {
    box.classList.remove('show');
    box.innerHTML = '';
    return;
  }
  const { kind, item } = selection;
  let html = '';
  if (kind === 'runway') {
    html = infoCard({
      title: `Runway ${item.ends.join(' / ')}`,
      open: isUnlocked('runway', item, state),
      lines: [`${nf.format(item.lengthFt)} × ${item.widthFt} ft`, item.realUse],
      unlock: item.unlock
    });
  } else if (kind === 'terminal') {
    const openGates = countUnlocked('gate', item.gates, state);
    html = infoCard({
      title: item.name,
      open: isUnlocked('terminal', item, state),
      lines: [`Boarding areas ${item.areas.join(', ')}`, `${openGates} of ${item.gates.length} gates open`],
      unlock: item.unlock
    });
  } else if (kind === 'gate') {
    const terminal = data.airport.terminals.find(t => t.areas.includes(item.area));
    const needs = (item.unlock.requires ?? [])
      .filter(key => !state.unlocked.includes(key))
      .map(key => data.airport.terminals.find(t => `terminal:${t.id}` === key)?.name ?? key);
    html = infoCard({
      title: `Gate ${item.id}`,
      open: isUnlocked('gate', item, state),
      lines: [`${terminal.name} · Boarding area ${item.area}`, SIZE_LABEL[item.size]],
      unlock: item.unlock,
      requires: needs
    });
  }
  box.innerHTML = `<button class="mi-close" aria-label="Close">×</button>${html}`;
  box.classList.add('show');
}

function renderMap(data, state) {
  const mapApi = createAirportMap($('mapCanvas'), {
    airport: data.airport,
    map: data.map,
    state,
    onSelect: sel => renderMapInfo(sel, data, state)
  });
  $('mapZoomIn').onclick = () => mapApi.zoomIn();
  $('mapZoomOut').onclick = () => mapApi.zoomOut();
  $('mapReset').onclick = () => mapApi.reset();
  $('mapInfo').addEventListener('click', e => { if (e.target.closest('.mi-close')) mapApi.select(null); });

  // Full screen as a CSS overlay: works the same on desktop and on iPhone.
  const wrap = $('mapWrap');
  const fullBtn = $('mapFull');
  const setFull = on => {
    wrap.classList.toggle('full', on);
    document.body.classList.toggle('map-full', on);
    fullBtn.setAttribute('aria-pressed', String(on));
    fullBtn.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
    fullBtn.textContent = on ? '✕' : '⛶';
  };
  fullBtn.onclick = () => setFull(!wrap.classList.contains('full'));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && wrap.classList.contains('full')) setFull(false); });
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
    renderMap(data, state); // after the view is visible, so the map can measure itself
  } catch (err) {
    showError(err);
  }
}

init();

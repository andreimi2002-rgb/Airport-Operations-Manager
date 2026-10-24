// Schematic 2D airport map (SVG). Coordinates are meters from the airport
// reference point (x east, y south), so 1 SVG unit = 1 m.
//
// createAirportMap(container, { airport, map, state, onSelect }) draws the map,
// handles pan / zoom (mouse, wheel, touch pinch) and reports taps on
// runways, terminals and gates through onSelect({ kind, item }).

import { isUnlocked } from './unlocks.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MIN_VIEW_M = 260;          // closest zoom: about 260 m across
const LABEL_ZOOM_M = 1500;       // gate labels appear when the view is narrower than this
const CLICK_SLOP_PX = 6;         // movement under this counts as a tap, not a drag

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

const pts = list => list.map(p => p.join(',')).join(' ');
const rad = deg => (deg * Math.PI) / 180;
const polar = (c, r, deg) => [c[0] + r * Math.cos(rad(deg)), c[1] + r * Math.sin(rad(deg))];

function arcPath(center, r, a0, a1) {
  const [x0, y0] = polar(center, r, a0);
  const [x1, y1] = polar(center, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${x0.toFixed(1)},${y0.toFixed(1)} A${r},${r} 0 ${large} 1 ${x1.toFixed(1)},${y1.toFixed(1)}`;
}

function runwayShape(rwy, layer, open) {
  const [a, b] = rwy.ends.map(e => e.at);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  const n = [-u[1] * rwy.widthM / 2, u[0] * rwy.widthM / 2];
  const g = el('g', { class: `rwy ${open ? 'open' : 'locked'}`, 'data-kind': 'runway', 'data-id': rwy.id }, layer);
  el('polygon', {
    class: 'rwy-body',
    points: pts([[a[0] + n[0], a[1] + n[1]], [b[0] + n[0], b[1] + n[1]], [b[0] - n[0], b[1] - n[1]], [a[0] - n[0], a[1] - n[1]]])
  }, g);
  if (open) {
    el('line', { class: 'rwy-center', x1: a[0] + u[0] * 90, y1: a[1] + u[1] * 90, x2: b[0] - u[0] * 90, y2: b[1] - u[1] * 90 }, g);
  }
  rwy.ends.forEach((end, i) => {
    const dir = i === 0 ? -1 : 1;
    const t = el('text', { class: 'rwy-label', x: end.at[0] + u[0] * 95 * dir, y: end.at[1] + u[1] * 95 * dir }, g);
    t.textContent = end.ident;
  });
  return g;
}

// Places a gate on the edge of its pier, on the same side as the real gate,
// so the diagram stays clean even where the hand-drawn pier is only approximate.
// Returns { dot, label } positions, or null if the area has no pier.
function snapGate(at, piers) {
  let best = null;
  for (const pier of piers) {
    for (let i = 0; i < pier.path.length - 1; i++) {
      const a = pier.path[i], b = pier.path[i + 1];
      const ab = [b[0] - a[0], b[1] - a[1]];
      const len2 = ab[0] ** 2 + ab[1] ** 2 || 1;
      const t = Math.max(0, Math.min(1, ((at[0] - a[0]) * ab[0] + (at[1] - a[1]) * ab[1]) / len2));
      const q = [a[0] + ab[0] * t, a[1] + ab[1] * t];
      const d = Math.hypot(at[0] - q[0], at[1] - q[1]);
      if (!best || d < best.d) {
        // Outward direction: from the pier line toward the real gate (or the left normal if on the line).
        const len = Math.sqrt(len2);
        const n = d > 1 ? [(at[0] - q[0]) / d, (at[1] - q[1]) / d] : [-ab[1] / len, ab[0] / len];
        best = { d, base: q, n, edge: pier.widthM / 2 };
      }
    }
    if (pier.hub) {
      const c = pier.hub.at;
      const dc = Math.hypot(at[0] - c[0], at[1] - c[1]);
      const d = Math.abs(dc - pier.hub.r);
      if (dc > 1 && (!best || d < best.d)) {
        best = { d, base: c, n: [(at[0] - c[0]) / dc, (at[1] - c[1]) / dc], edge: pier.hub.r };
      }
    }
  }
  if (!best) return null;
  const off = best.edge + 13;
  return {
    dot: [best.base[0] + best.n[0] * off, best.base[1] + best.n[1] * off],
    label: [best.base[0] + best.n[0] * (off + 24), best.base[1] + best.n[1] * (off + 24)]
  };
}

export function createAirportMap(container, { airport, map, state, onSelect }) {
  const s = map.schematic;
  const terminalsById = Object.fromEntries(airport.terminals.map(t => [t.id, t]));
  const gatesById = Object.fromEntries(airport.terminals.flatMap(t => t.gates.map(g => [g.id, g])));
  const runwaysById = Object.fromEntries(airport.runways.map(r => [r.id, r]));
  const terminalOpen = id => isUnlocked('terminal', terminalsById[id], state);

  const svg = el('svg', { class: 'amap', role: 'img', 'aria-label': `Schematic map of ${airport.name}` });
  container.appendChild(svg);

  // Layers, bottom to top.
  const land = el('g', { class: 'm-land' }, svg);
  const ground = el('g', { class: 'm-ground' }, svg);
  const rwyLayer = el('g', { class: 'm-runways' }, svg);
  const termLayer = el('g', { class: 'm-terminals' }, svg);
  const gateLayer = el('g', { class: 'm-gates' }, svg);
  const labelLayer = el('g', { class: 'm-labels' }, svg);

  // Land, aprons, taxiways.
  el('polygon', { class: 'm-boundary', points: pts(map.boundary) }, land);
  for (const apron of map.aprons) el('polygon', { class: 'm-apron', points: pts(apron) }, ground);
  for (const twy of map.taxiways) el('polyline', { class: 'm-twy', points: pts(twy.points) }, ground);

  // Runways.
  for (const rwy of map.runways) runwayShape(rwy, rwyLayer, isUnlocked('runway', runwaysById[rwy.id], state));

  // Garage in the middle of the ring.
  el('circle', { class: 'm-garage', cx: s.garage.center[0], cy: s.garage.center[1], r: s.garage.r }, termLayer);

  // Piers (drawn first so the ring sits on top of their roots).
  for (const pier of s.piers) {
    const open = terminalOpen(pier.terminal);
    const g = el('g', { class: `term ${open ? 'open' : 'locked'}`, 'data-kind': 'terminal', 'data-id': pier.terminal }, termLayer);
    el('polyline', { class: 'term-shape', points: pts(pier.path), 'stroke-width': pier.widthM }, g);
    if (pier.hub) el('circle', { class: 'term-hub', cx: pier.hub.at[0], cy: pier.hub.at[1], r: pier.hub.r }, g);
  }

  // Terminal ring segments.
  const GAP = 1.4;
  for (const seg of s.terminals) {
    const open = terminalOpen(seg.id);
    const g = el('g', { class: `term ${open ? 'open' : 'locked'}`, 'data-kind': 'terminal', 'data-id': seg.id }, termLayer);
    el('path', { class: 'term-shape', d: arcPath(s.ring.center, s.ring.r, seg.arc[0] + GAP, seg.arc[1] - GAP), 'stroke-width': s.ring.widthM }, g);
    // Short terminal name inside the ring.
    const mid = (seg.arc[0] + seg.arc[1]) / 2;
    const [lx, ly] = polar(s.ring.center, s.ring.r - 78, mid);
    const t = el('text', { class: `term-label ${open ? 'open' : 'locked'}`, x: lx, y: ly }, labelLayer);
    t.textContent = seg.id === 'INTL' ? 'INTL' : seg.id;
  }

  // Boarding area letters at the pier tips.
  const seenArea = new Set();
  for (const pier of s.piers) {
    if (seenArea.has(pier.area)) continue;
    seenArea.add(pier.area);
    const tip = pier.hub ? pier.hub.at : pier.path.at(-1);
    const prev = pier.path.at(-2);
    const len = Math.hypot(tip[0] - prev[0], tip[1] - prev[1]) || 1;
    const off = (pier.hub ? pier.hub.r : 0) + 60;
    const t = el('text', {
      class: `area-label ${terminalOpen(pier.terminal) ? 'open' : 'locked'}`,
      x: tip[0] + ((tip[0] - prev[0]) / len) * off,
      y: tip[1] + ((tip[1] - prev[1]) / len) * off
    }, labelLayer);
    t.textContent = pier.area;
  }

  // Gates.
  for (const [id, at] of Object.entries(map.gates)) {
    const gate = gatesById[id];
    if (!gate) continue;
    const pos = snapGate(at, s.piers.filter(p => p.area === gate.area)) ?? { dot: at, label: [at[0], at[1] - 22] };
    const open = isUnlocked('gate', gate, state);
    const g = el('g', { class: `gate ${open ? 'open' : 'locked'}`, 'data-kind': 'gate', 'data-id': id }, gateLayer);
    el('circle', { class: 'gate-hit', cx: pos.dot[0], cy: pos.dot[1], r: 20 }, g);
    el('circle', { class: 'gate-dot', cx: pos.dot[0], cy: pos.dot[1], r: open ? 9 : 7 }, g);
    const t = el('text', { class: 'gate-label', x: pos.label[0], y: pos.label[1] }, g);
    t.textContent = id;
  }

  // Control tower.
  if (map.tower) {
    const g = el('g', { class: 'm-tower' }, labelLayer);
    el('circle', { cx: map.tower[0], cy: map.tower[1], r: 14 }, g);
    el('circle', { cx: map.tower[0], cy: map.tower[1], r: 5, class: 'm-tower-core' }, g);
  }

  // ---------- view: pan and zoom by changing the viewBox ----------
  const home = (() => {
    // Frame the runways and terminals, not the whole airport boundary.
    const xs = [], ys = [];
    for (const r of map.runways) for (const e of r.ends) { xs.push(e.at[0]); ys.push(e.at[1]); }
    for (const at of Object.values(map.gates)) { xs.push(at[0]); ys.push(at[1]); }
    const pad = 180;
    return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + 2 * pad, h: Math.max(...ys) - Math.min(...ys) + 2 * pad };
  })();
  let view = { ...home };
  const maxW = home.w * 1.6;

  function fitAspect(v) {
    // Keep the view's aspect equal to the element's so pixels map 1:1 in both axes.
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return v;
    const aspect = rect.width / rect.height;
    const cx = v.x + v.w / 2, cy = v.y + v.h / 2;
    let w = v.w, h = v.h;
    if (w / h > aspect) h = w / aspect; else w = h * aspect;
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }

  function apply() {
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
    svg.classList.toggle('near', Math.min(view.w, view.h) < LABEL_ZOOM_M);
  }

  function reset() {
    view = fitAspect({ ...home });
    apply();
  }

  function toMap(clientX, clientY) {
    const rect = svg.getBoundingClientRect();
    return [view.x + ((clientX - rect.left) / rect.width) * view.w, view.y + ((clientY - rect.top) / rect.height) * view.h];
  }

  function zoomAt(factor, clientX, clientY) {
    const rect = svg.getBoundingClientRect();
    const [mx, my] = toMap(clientX ?? rect.left + rect.width / 2, clientY ?? rect.top + rect.height / 2);
    const minSide = Math.min(view.w, view.h);
    factor = Math.max(MIN_VIEW_M / minSide, Math.min(factor, maxW / view.w));
    view = { x: mx - (mx - view.x) * factor, y: my - (my - view.y) * factor, w: view.w * factor, h: view.h * factor };
    apply();
  }

  svg.addEventListener('wheel', e => {
    e.preventDefault();
    zoomAt(Math.exp(e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015)), e.clientX, e.clientY);
  }, { passive: false });

  // Pointer handling: one pointer pans, two pointers pinch-zoom, a still tap selects.
  const pointers = new Map();
  let moved = 0;
  let pinch = null;

  svg.addEventListener('pointerdown', e => {
    svg.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) moved = 0;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: [(a.x + b.x) / 2, (a.y + b.y) / 2] };
    }
  });

  svg.addEventListener('pointermove', e => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.set(e.pointerId, cur);
    const rect = svg.getBoundingClientRect();
    const scale = view.w / rect.width;

    if (pointers.size === 1) {
      moved += Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y);
      view.x -= (cur.x - prev.x) * scale;
      view.y -= (cur.y - prev.y) * scale;
      apply();
    } else if (pointers.size === 2 && pinch) {
      moved = Infinity;
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = [(a.x + b.x) / 2, (a.y + b.y) / 2];
      view.x -= (mid[0] - pinch.mid[0]) * scale;
      view.y -= (mid[1] - pinch.mid[1]) * scale;
      if (dist > 0) zoomAt(pinch.dist / dist, mid[0], mid[1]);
      else apply();
      pinch = { dist, mid };
    }
  });

  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0 && moved < CLICK_SLOP_PX && e.type === 'pointerup') {
      const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-kind]');
      select(hit ? { kind: hit.dataset.kind, id: hit.dataset.id } : null);
    }
  }
  svg.addEventListener('pointerup', endPointer);
  svg.addEventListener('pointercancel', endPointer);

  // ---------- selection ----------
  let selectedEls = [];
  function select(target) {
    selectedEls.forEach(n => n.classList.remove('selected'));
    selectedEls = [];
    if (!target) { onSelect?.(null); return; }
    selectedEls = [...svg.querySelectorAll(`[data-kind="${target.kind}"][data-id="${CSS.escape(target.id)}"]`)];
    selectedEls.forEach(n => n.classList.add('selected'));
    const item = target.kind === 'runway' ? runwaysById[target.id]
      : target.kind === 'terminal' ? terminalsById[target.id]
      : gatesById[target.id];
    onSelect?.({ kind: target.kind, item });
  }

  new ResizeObserver(() => { view = fitAspect(view); apply(); }).observe(svg);
  reset();

  return {
    zoomIn: () => zoomAt(0.7),
    zoomOut: () => zoomAt(1 / 0.7),
    reset,
    select
  };
}

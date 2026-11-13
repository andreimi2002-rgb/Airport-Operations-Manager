// "Imagine de distribuit": a 4:5 picture of one game (the result, or the Romanian start time), drawn on a canvas
// with our own emblems (team colours and abbreviation, never the official logos: fine everywhere, the store
// app included). On a phone it opens the share sheet (WhatsApp, Instagram…); elsewhere it is downloaded.
import { TEAMS } from './teams.js';
import { COLORS } from './colors.js';
import { pickInk } from './ui.js';
import { detailRo } from './ro.js';

const W = 1080, H = 1350, NAVY = '#0e1f3d', RED = '#c8102e', PINK = '#ff5a6e';
const nameKey = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
// The same colours and abbreviation as the page's emblem.
export function cardSide(side) {
  const T = side.key && TEAMS[side.key], C = COLORS[nameKey(side.name)];
  const bg = side.color || (T && T.col[0]) || C?.[0] || '#5b6b8a';
  const alt = side.alt || C?.[1], fg = alt && alt.toLowerCase() !== bg.toLowerCase() ? alt : (T ? T.col[1] : '#fff');
  return { bg, fg: pickInk(bg, fg), ab: side.abbr || C?.[2] || String(side.name || '').split(' ').pop().slice(0, 3).toUpperCase(), name: side.name || '' };
}
const fmtRo = (d, o) => new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', ...o }).format(d);

function star(x, cx, cy, r) {
  const pts = [[50, 23], [57.1, 43.3], [78.5, 43.7], [61.4, 56.7], [67.6, 77.3], [50, 65], [32.4, 77.3], [38.6, 56.7], [21.5, 43.7], [42.9, 43.3]];
  x.beginPath();
  pts.forEach(([px, py], i) => { const X = cx + (px - 50) / 50 * r, Y = cy + (py - 50) / 50 * r; i ? x.lineTo(X, Y) : x.moveTo(X, Y); });
  x.closePath(); x.fill();
}
// Text that fits a width: smaller font first, then two lines.
function fitLines(x, text, font, size, maxW, minSize) {
  for (let s = size; s >= minSize; s -= 4) { x.font = font(s); if (x.measureText(text).width <= maxW) return { lines: [text], size: s }; }
  const words = text.split(' '); let best = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
    for (let s = size; s >= minSize; s -= 4) { x.font = font(s); if (Math.max(x.measureText(a).width, x.measureText(b).width) <= maxW) { if (!best || s > best.size) best = { lines: [a, b], size: s }; break; } }
  }
  return best || { lines: [text], size: minSize };
}

export async function cardBlob(g) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  try { await Promise.all(['italic 800 120px "Saira Condensed"', '700 36px Figtree', '600 36px Figtree'].map(f => document.fonts.load(f))); } catch (e) { /* system font */ }
  const SAIRA = s => `italic 800 ${s}px "Saira Condensed", "Arial Narrow", sans-serif`, FIG = (w, s) => `${w} ${s}px Figtree, system-ui, sans-serif`;
  // Background and the brand bar.
  x.fillStyle = NAVY; x.fillRect(0, 0, W, H);
  const glow = x.createRadialGradient(W / 2, 640, 50, W / 2, 640, 700); glow.addColorStop(0, 'rgba(255,255,255,.07)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = glow; x.fillRect(0, 0, W, H);
  x.fillStyle = RED; x.beginPath(); x.roundRect(64, 60, 96, 96, 16); x.fill();
  x.fillStyle = '#fff'; star(x, 112, 110, 40);
  x.textBaseline = 'alphabetic'; x.textAlign = 'left';
  x.font = SAIRA(60); x.fillText('AMERICAN SPORTS', 186, 116);
  x.font = FIG(700, 24); x.fillStyle = '#c9d2e3'; x.fillText('H  U  B', 190, 150);
  x.fillStyle = RED; x.fillRect(0, 200, W, 6);
  // League and day.
  const live = g.state === 'in', done = g.state === 'post';
  x.textAlign = 'center'; x.fillStyle = '#c9d2e3'; x.font = FIG(700, 34);
  x.fillText(`${g.l} · ${fmtRo(g.d, { weekday: 'long', day: 'numeric', month: 'long' })}`.toUpperCase(), W / 2, 300);
  // The two emblems (home on the left, as on the site).
  const sides = [cardSide(g.H), cardSide(g.A)], cx = [280, 800], cy = 540, r = 150;
  sides.forEach((s, i) => {
    x.fillStyle = s.bg; x.beginPath(); x.arc(cx[i], cy, r, 0, 7); x.fill();
    x.lineWidth = 10; x.strokeStyle = 'rgba(255,255,255,.9)'; x.stroke();
    x.fillStyle = s.fg; x.font = SAIRA(s.ab.length > 3 ? 84 : 110); x.textBaseline = 'middle'; x.fillText(s.ab, cx[i], cy + 6);
    x.textBaseline = 'alphabetic';
    const t = fitLines(x, s.name.toUpperCase(), SAIRA, 64, 420, 40);
    x.fillStyle = '#fff'; x.font = SAIRA(t.size);
    t.lines.forEach((ln, j) => x.fillText(ln, cx[i], 790 + j * (t.size + 4)));
  });
  x.fillStyle = '#8f9bb3'; x.font = SAIRA(70); x.textBaseline = 'middle'; x.fillText(done || live ? '–' : 'VS', W / 2, cy); x.textBaseline = 'alphabetic';
  // The score, or the Romanian start time.
  x.fillStyle = '#fff';
  if (done || live) {
    x.font = SAIRA(220); x.fillText(`${g.hs ?? 0}–${g.as ?? 0}`, W / 2, 1100);
    x.fillStyle = PINK; x.font = FIG(700, 40);
    x.fillText(live ? `LIVE · ${detailRo(g.detail, g.l)}` : (detailRo(g.detail, g.l) || 'Final').toUpperCase(), W / 2, 1170);
  } else {
    x.font = SAIRA(200); x.fillText(g.tbd ? '—' : fmtRo(g.d, { hour: '2-digit', minute: '2-digit', hour12: false }), W / 2, 1090);
    x.fillStyle = PINK; x.font = FIG(700, 40); x.fillText(g.tbd ? 'ORĂ NEANUNȚATĂ' : 'ORA ROMÂNIEI', W / 2, 1160);
  }
  // The address.
  x.fillStyle = '#aab4c8'; x.font = FIG(600, 34); x.fillText('americansportshub.netlify.app', W / 2, 1272);
  x.fillStyle = RED; x.fillRect(0, H - 14, W, 14);
  return new Promise(res => c.toBlob(res, 'image/png'));
}

// Share the picture (phone share sheet) or download it. Returns 'shared', 'saved' or 'cancel'.
export async function shareGame(g) {
  const blob = await cardBlob(g);
  const file = new File([blob], `${g.l.toLowerCase()}-${g.id}.png`, { type: 'image/png' });
  const url = `${location.origin}/?sursa=card#meci/${g.l}/${g.id}`;
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text: `${g.h} – ${g.a} · ${url}` }); return 'shared'; }
    catch (e) { if (e?.name === 'AbortError') return 'cancel'; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'saved';
}

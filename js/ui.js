// Small helpers shared by the page modules: escaping, theme, team emblems.
import { TEAMS, STORE } from './teams.js';
import { COLORS } from './colors.js';

export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const $ = id => document.getElementById(id);

/* ---------- theme: 'auto' follows the device, 'light' / 'dark' are chosen by hand ---------- */
const darkQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
export const theme = { pref: 'auto' };
export const isDark = () => theme.pref === 'dark' || (theme.pref === 'auto' && !!darkQuery?.matches);
export function onSystemTheme(fn) { darkQuery?.addEventListener?.('change', () => { if (theme.pref === 'auto') fn(); }); }

// Keep the abbreviation readable on the team colour.
export function pickInk(bg, fg) {
  const lum = h => { const n = parseInt(String(h).replace('#', ''), 16); if (isNaN(n)) return 0.5; const r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255; return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
  return Math.abs(lum(bg) - lum(fg)) > 0.35 ? fg : (lum(bg) > 0.6 ? '#111' : '#fff');
}

// Team emblem: the official logo when it loads (the dark-background version in the dark theme),
// a coloured circle with the abbreviation otherwise. `onWhite`: the emblem sits on a white disc
// (hero, team band), so the normal logo is right in both themes (a white dark-theme logo would vanish).
// In the store app (STORE) only our own emblem is drawn, never the official logo; the colours missing from
// the data come from js/colors.js.
const nameKey = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function emb(side, cls = '', onWhite = false) {
  const k = side.key, T = k && TEAMS[k], C = COLORS[nameKey(side.name)];
  const bg = side.color || (T && T.col[0]) || C?.[0] || null;
  const alt = side.alt || C?.[1], fg = alt && alt.toLowerCase() !== (bg || '').toLowerCase() ? alt : (T ? T.col[1] : '#fff');
  const style = bg ? `style="--bg-e:${esc(bg)};--fg-e:${esc(pickInk(bg, fg))}"` : '';
  const ab = esc(side.abbr || C?.[2] || (side.name || '').split(' ').pop().slice(0, 3).toUpperCase());
  const src = STORE ? '' : isDark() && !onWhite && side.logoDark ? side.logoDark : side.logo;
  const pic = src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : '';
  return `<span class="emb ${cls}${bg ? '' : ' neutral'}${src ? ' has-logo' : ''}" ${style}>${pic}<b>${ab}</b></span>`;
}

// Small helpers shared by the page modules: escaping, theme, team emblems.
import { TEAMS } from './teams.js';

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
export function emb(side, cls = '', onWhite = false) {
  const k = side.key, T = k && TEAMS[k];
  const bg = side.color || (T && T.col[0]) || null, fg = side.alt && side.alt.toLowerCase() !== (bg || '').toLowerCase() ? side.alt : (T ? T.col[1] : '#fff');
  const style = bg ? `style="--bg-e:${esc(bg)};--fg-e:${esc(pickInk(bg, fg))}"` : '';
  const ab = esc(side.abbr || (side.name || '').split(' ').pop().slice(0, 3).toUpperCase());
  const src = isDark() && !onWhite && side.logoDark ? side.logoDark : side.logo;
  const pic = src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : '';
  return `<span class="emb ${cls}${bg ? '' : ' neutral'}${src ? ' has-logo' : ''}" ${style}>${pic}<b>${ab}</b></span>`;
}

// "Echipele mele": the teams on the home page, kept in this browser (localStorage).
// By default the eleven Florida teams; the viewer can take any out and add any team of the five leagues.
// A Florida team by its key ('heat'); any other team as 'NBA-2', with what the page needs to draw it
// before its data loads (name, logo, colours). Replaces the old single "echipa mea" (flgames-fav).
import { TEAMS, PACK, PACKS, parseClub } from './teams.js';
import { trackEvent } from './track.js';

// One list per pack: the owner's device can switch between Florida and New York (when its mark is lost or
// set again) without the other pack's teams being dropped from the saved list.
const OLD = 'flgames-mine', KEY = PACK === 'fl' ? OLD : OLD + '-' + PACK;
const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const set = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* private mode */ } };
const defaults = () => Object.keys(TEAMS).map(id => ({ id }));

// Lists saved before there was one per pack (all under the old name): a New York list moves over; the
// owner's Florida list (it has Florida teams) stays Florida's.
function oldList() {
  if (PACK === 'fl') return null;
  const s = get(OLD);
  try { return JSON.parse(s || 'null')?.some?.(x => PACKS.fl.keys.includes(x?.id)) ? null : s; } catch (e) { return null; }
}
export const MINE = { list: defaults(), custom: false };
{
  try {
    const a = JSON.parse(get(KEY) || oldList() || 'null');
    if (Array.isArray(a)) { MINE.list = a.filter(x => x && (TEAMS[x.id] || parseClub(x.id))); MINE.custom = true; }
  } catch (e) { /* ignore */ }
  set('flgames-fav', null);   // the old single favourite: the list replaces it
}
const save = () => { MINE.custom = true; set(KEY, JSON.stringify(MINE.list)); };

export const mineIds = () => MINE.list.map(x => x.id);
export const isMine = id => MINE.list.some(x => x.id === id);
export const mineFL = () => MINE.list.filter(x => TEAMS[x.id]).map(x => x.id);
export const mineClubs = () => MINE.list.filter(x => !TEAMS[x.id]);
export const clubId = (l, id) => `${l}-${id}`;

// Add / take out. `meta` for a team outside Florida: { name, abbr, logo, logoDark, color, alt }.
export function toggleMine(id, meta = {}) {
  if (isMine(id)) MINE.list = MINE.list.filter(x => x.id !== id);
  else {
    const c = parseClub(id);
    MINE.list.push(c ? { id, l: c.l, eid: c.id, name: meta.name || id, abbr: meta.abbr || '', logo: meta.logo || '', logoDark: meta.logoDark || '', color: meta.color || '', alt: meta.alt || '' } : { id });
  }
  save();
  if (isMine(id)) trackEvent('follow');
  return isMine(id);
}
// Back to the eleven Florida teams.
export function resetMine() { MINE.list = defaults(); MINE.custom = false; set(KEY, null); }

/* ----- the first visit: "Ce echipe urmărești?" ----- */
// A new visitor (the public pack, nothing chosen yet, never asked) is asked for their teams on the home page.
// The owner's devices (Florida) are never asked. Answered or put off ("Mai târziu"), it does not come back.
const WELCOMED = 'flgames-welcome';
export const welcomeDue = () => PACK !== 'fl' && !MINE.custom && !get(WELCOMED);
export const setWelcomed = () => set(WELCOMED, '1');
// The chosen teams replace the list. `metaOf(id)`: name, logo and colours of a team outside the pack.
export function setMine(ids, metaOf) {
  MINE.list = [];
  for (const id of ids) {
    const c = parseClub(id), m = c ? metaOf(id) || {} : {};
    MINE.list.push(c ? { id, l: c.l, eid: c.id, name: m.name || id, abbr: m.abbr || '', logo: m.logo || '', logoDark: m.logoDark || '', color: m.color || '', alt: m.alt || '' } : { id });
  }
  save(); setWelcomed();
}
// Keeps the saved name and logo of a followed team up to date (teams get renamed, logos change).
export function refreshMine(id, meta) {
  const x = MINE.list.find(t => t.id === id);
  if (!x || !meta?.name || TEAMS[id]) return;
  const before = JSON.stringify(x);
  for (const k of ['name', 'abbr', 'logo', 'logoDark', 'color', 'alt']) if (meta[k]) x[k] = meta[k];
  if (JSON.stringify(x) !== before) save();
}

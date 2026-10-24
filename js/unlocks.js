// Single place that decides whether something is open.
//
// The data files never change during play. Each lockable item has
//   "unlock": { "initial": true }                       -> open from the start
//   "unlock": { "initial": false, "cost", "reputation", "requires"? } -> must be bought
// What the player has bought lives in the game state as keys like "gate:D18".

export const KINDS = ['runway', 'terminal', 'gate', 'route', 'airline'];

// Routes and airlines are identified by IATA code, everything else by id.
export function itemId(item) {
  return item.id ?? item.iata;
}

export function unlockKey(kind, item) {
  return `${kind}:${itemId(item)}`;
}

export function createState() {
  return { unlocked: [] };
}

export function isUnlocked(kind, item, state = createState()) {
  return item.unlock?.initial === true || state.unlocked.includes(unlockKey(kind, item));
}

export function countUnlocked(kind, items, state) {
  return items.filter(item => isUnlocked(kind, item, state)).length;
}

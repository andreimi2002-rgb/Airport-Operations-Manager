// The state of the sources (ESPN, Open-Meteo) from /api/health: a line in the footer and, when one of
// them has trouble, a plain sentence in the status line. Pure HTML; app.js loads and places it.
import { esc } from './ui.js';

export const HEALTH = { data: null, failed: false };
export async function loadHealth() {
  try {
    const r = await fetch('/api/health', { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(r.status);
    HEALTH.data = await r.json(); HEALTH.failed = false;
  } catch (e) { HEALTH.failed = navigator.onLine; }   // offline is said elsewhere
  return HEALTH;
}
const hm = iso => new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });

// "ESPN nu răspunde acum", "ESPN a schimbat formatul scorurilor"; '' when all is well.
export function healthNote(h = HEALTH) {
  if (h.failed) return 'Serverul site-ului nu răspunde acum';
  const bad = (h.data?.sources || []).filter(s => !s.ok);
  return bad.map(s => `${s.name} ${s.problem === 'nu răspunde' ? 'nu răspunde acum' : s.problem}`).join(' · ') + (bad.length ? ': unele date pot lipsi' : '');
}

// The footer line. `missed`: how many requests to ESPN failed in the last load of the season.
export function sourcesHtml(h = HEALTH, missed = 0) {
  if (h.failed) return '<b>Surse:</b> <span class="src bad"><i></i>serverul site-ului nu răspunde acum</span>, deci nu pot verifica ESPN și vremea.';
  if (!h.data) return '';
  const list = h.data.sources.map(s => `<span class="src ${s.ok ? 'ok' : 'bad'}" title="${esc(s.what)}"><i></i>${esc(s.name)} ${s.ok ? 'merge' : esc(s.problem)}</span>`).join(' ');
  const note = missed ? ` La ultima încărcare, ${missed === 1 ? 'o cerere către ESPN a eșuat' : `${missed} cereri către ESPN au eșuat`}; unele date pot lipsi până la următoarea.` : '';
  return `<b>Surse:</b> ${list} <span class="when">· verificat la ${hm(h.data.checked)}</span>.${note}`;
}

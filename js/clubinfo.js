// The profile facts of every team (data/clubs.json, made by tools/build-clubs.mjs): the "Despre" text
// from Wikipedia, titles, former names, legends, a photo. Loaded on the first team page; pure HTML here.
import { esc } from './ui.js';

export const CLUBS = { data: null, ready: null };
export function loadClubs() {
  CLUBS.ready ||= fetch('data/clubs.json', { signal: AbortSignal.timeout(12000) })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(j => (CLUBS.data = j))
    .catch(() => (CLUBS.ready = null, null));
  return CLUBS.ready;
}
export const clubInfo = (l, id) => (id != null && CLUBS.data?.teams?.[`${l}-${id}`]) || null;

// "18 titluri NBA (1957, …, 2024)", "Nicio Cupă Stanley"; '' when not known.
export function titlesText(t) {
  if (!t) return '';
  const n = t.n ?? t.years.length, w = t.what;
  if (!n) return t.known ? (w === 'Cupa Stanley' ? 'Nicio Cupă Stanley' : w === 'titluri NBA' ? 'Niciun titlu NBA' : 'Niciun ' + w) : '';
  const name = w === 'titluri NBA' ? (n === 1 ? 'titlu NBA' : 'titluri NBA') : w === 'Cupa Stanley' ? (n === 1 ? 'Cupă Stanley' : 'Cupe Stanley') : w;
  // The years only when there is one for each title (else just the count).
  if (t.years.length !== n) return `${n} ${name}`;
  const ys = n > 8 ? `${t.years.slice(0, 2).join(', ')}, …, ${t.years.slice(-4).join(', ')}` : t.years.join(', ');
  return `${n} ${name} (${ys})`;
}
const span = (a, b) => (a && b ? `${a}–${b}` : a ? `din ${a}` : b ? `până în ${b}` : '');

// Rows for the facts list of a team page (<dt>/<dd> pairs). `coach`: the head coach from ESPN, if any.
export function infoFactsHtml(info, coach) {
  if (!info && !coach) return '';
  const rows = [];
  const c = coach || info?.coach?.name;
  if (c) rows.push(['Antrenor principal', esc(c)]);
  if (info?.founded) rows.push(['Înființată', `${info.founded}${info.first && !String(info.first).startsWith(String(info.founded)) ? `, prima stagiune ${esc(info.first)}` : ''}`]);
  const tt = titlesText(info?.titles);
  if (tt) rows.push(['Palmares', esc(tt)]);
  if (info?.names?.length) rows.push(['Nume anterioare', info.names.map(([n, a, b]) => `${esc(n)}${span(a, b) ? ` <small>(${span(a, b)})</small>` : ''}`).join(', ')]);
  if (info?.legends?.length) rows.push(['Legende', esc(info.legends.join(', '))]);
  return rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
}

// "Despre": the opening of the Wikipedia article, with the photo when the encyclopedia has one.
export function aboutHtml(info) {
  if (!info?.about && !info?.photo) return '';
  const ph = info.photo ? `<figure class="tphoto"><img src="${esc(info.photo.url)}" alt="${esc(info.photo.alt || info.name)}" loading="lazy" decoding="async"><figcaption>Foto: ${esc(info.photo.author || '')}, <a href="${esc(info.photo.page)}" target="_blank" rel="noopener">${esc(info.photo.license || 'Wikimedia Commons')}</a></figcaption></figure>` : '';
  const w = info.wiki;
  const txt = info.about ? `<p class="about"${w?.lang === 'en' ? ' lang="en"' : ''}>${esc(info.about)}</p>
    <div class="fn">${w?.lang === 'en' ? 'Text în engleză: Wikipedia în română nu are încă un articol despre echipă. ' : ''}Sursa: <a href="${esc(w?.url || '#')}" target="_blank" rel="noopener">Wikipedia${w?.lang === 'en' ? ' (engleză)' : ''}</a>, licență CC BY-SA 4.0.</div>` : '';
  return `<section class="tabout"><h3>Despre</h3>${ph}${txt}</section>`;
}

// iCalendar (.ics) for the games: the subscription feed (/api/calendar.ics) and the
// "add this game" download on a game page. Pure functions, no DOM: used in Node and in the browser.
// Times are written in UTC (…Z), so every calendar app shows them in the viewer's own time zone.
import { LEAGUES, TEAMS } from './teams.js';

const SPORT = { NBA: '🏀', NHL: '🏒', NFL: '🏈', MLS: '⚽', MLB: '⚾' };

// RFC 5545 text: escape \ ; , and new lines.
const text = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const utc = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const ymd = d => new Date(d).toISOString().slice(0, 10).replace(/-/g, '');
const fmtNY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });

// Lines longer than 75 octets are folded: CRLF + one space, never splitting a UTF-8 character.
export function fold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = []; let cur = '', size = 0, limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (size + n > limit) { out.push(cur); cur = ''; size = 0; limit = 74; }
    cur += ch; size += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const short = side => (side.key && TEAMS[side.key] ? TEAMS[side.key].s : side.name || '');

// One game (the /api/schedule format) -> VEVENT lines.
export function gameEvent(g, { site = '', alarm = 0, stamp = new Date() } = {}) {
  const L = LEAGUES[g.l] || { dur: 150 };
  const done = g.state === 'post', on = g.state === 'in';
  const score = done || on ? ` ${g.home.score ?? 0}–${g.away.score ?? 0}` : '';
  const title = `${SPORT[g.l] || ''} ${short(g.home)} – ${short(g.away)}${score}${g.tbd && !done ? ' (oră neanunțată)' : ''}`.trim();
  const place = [g.venue, g.city, g.region].filter(Boolean).join(', ');
  const desc = [
    `${g.home.name} – ${g.away.name}`,
    `${g.l}${g.note ? ' · ' + g.note : ''}`,
    done ? `Final: ${g.home.score ?? 0}–${g.away.score ?? 0}` : '',
    g.tv ? `Transmisie SUA: ${g.tv}` : '',
    site ? `Detalii: ${site}/#meci/${g.l}/${g.id}` : ''
  ].filter(Boolean).join('\n');
  const lines = ['BEGIN:VEVENT', `UID:${g.l}-${g.id}@meciuri-florida`, `DTSTAMP:${utc(stamp)}`];
  if (g.tbd && !done) {
    // Time not announced yet: an all-day event on the US date, until ESPN publishes the hour.
    const day = fmtNY.format(new Date(g.date)).replace(/-/g, '');
    const next = ymd(Date.UTC(+day.slice(0, 4), +day.slice(4, 6) - 1, +day.slice(6, 8) + 1));
    lines.push(`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${next}`, 'TRANSP:TRANSPARENT');
  } else {
    lines.push(`DTSTART:${utc(g.date)}`, `DTEND:${utc(new Date(g.date).getTime() + L.dur * 6e4)}`);
  }
  lines.push(`SUMMARY:${text(title)}`);
  if (place) lines.push(`LOCATION:${text(place)}`);
  lines.push(`DESCRIPTION:${text(desc)}`);
  if (site) lines.push(`URL:${site}/#meci/${g.l}/${g.id}`);
  lines.push(`CATEGORIES:${g.l}`, `STATUS:${/postponed|canceled|cancelled/i.test(g.detail || '') ? 'CANCELLED' : 'CONFIRMED'}`);
  if (alarm > 0 && !done && !(g.tbd)) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${text(title)}`, `TRIGGER:-PT${alarm}M`, 'END:VALARM');
  lines.push('END:VEVENT');
  return lines;
}

// A whole calendar. `name` is what calendar apps show for the subscription.
export function calendar(games, { name = 'Meciuri Florida', site = '', alarm = 0, stamp = new Date() } = {}) {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Meciuri Florida//RO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${text(name)}`, 'X-WR-CALDESC:Meciurile echipelor din Florida (date ESPN)',
    // Ask subscribing apps to check again every few hours (Apple honours it; Google refreshes on its own schedule).
    'REFRESH-INTERVAL;VALUE=DURATION:PT4H', 'X-PUBLISHED-TTL:PT4H'
  ];
  for (const g of games) lines.push(...gameEvent(g, { site, alarm, stamp }));
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

// Which games a subscription keeps: those of the chosen Florida teams, from `pastDays` ago on.
export function pick(games, teams, pastDays = 45, now = Date.now()) {
  const want = new Set(teams);
  return games.filter(g => (want.has(g.home.key) || want.has(g.away.key)) && new Date(g.date).getTime() > now - pastDays * 864e5);
}

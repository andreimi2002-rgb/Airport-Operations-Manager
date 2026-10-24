// Live clock in the airport's own time zone (IANA name from the data file).

export function startClock(timeZone, onTick) {
  const hm = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const sec = new Intl.DateTimeFormat('en-GB', { timeZone, second: '2-digit' });
  const date = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const zone = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' });
  const utc = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

  let timer;
  function tick() {
    const now = new Date();
    onTick({
      time: hm.format(now),
      seconds: sec.format(now).padStart(2, '0'),
      date: date.format(now),
      zone: zone.formatToParts(now).find(p => p.type === 'timeZoneName')?.value ?? '',
      utc: utc.format(now)
    });
    // Re-align to the start of the next second.
    timer = setTimeout(tick, 1000 - (Date.now() % 1000));
  }
  tick();
  return () => clearTimeout(timer);
}

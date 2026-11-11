// Weather forecast from Open-Meteo (free, no key), trimmed to what the page shows.
// Times are local Florida time ("2026-11-11T19:00"), as Open-Meteo gives them with timezone=America/New_York.
import { getJSON } from './espn.mjs';

const BASE = 'https://api.open-meteo.com/v1/forecast';
const CURRENT = 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_gusts_10m,precipitation,is_day';
const HOURLY = 'temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,relative_humidity_2m';
const DAILY = 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset,uv_index_max,wind_speed_10m_max';

// Florida and a margin around it: the function only serves places the page knows.
export const inFlorida = (lat, lon) => lat >= 24 && lat <= 31.5 && lon >= -88 && lon <= -79.5;

const r = v => (v == null || !Number.isFinite(+v) ? null : Math.round(+v));
const r1 = v => (v == null || !Number.isFinite(+v) ? null : Math.round(+v * 10) / 10);

// One Open-Meteo location -> { now, days, hours }. `brief` drops the hourly part.
export function normalizeForecast(j, brief) {
  const c = j?.current || {}, d = j?.daily || {}, h = j?.hourly || {};
  const out = {
    lat: j?.latitude ?? null, lon: j?.longitude ?? null,
    now: c.time ? {
      time: c.time, temp: r1(c.temperature_2m), feels: r1(c.apparent_temperature), hum: r(c.relative_humidity_2m),
      code: r(c.weather_code), wind: r(c.wind_speed_10m), gust: r(c.wind_gusts_10m), rain: r1(c.precipitation), day: c.is_day !== 0
    } : null,
    days: (d.time || []).map((t, i) => ({
      date: t, code: r(d.weather_code?.[i]), hi: r1(d.temperature_2m_max?.[i]), lo: r1(d.temperature_2m_min?.[i]),
      pp: r(d.precipitation_probability_max?.[i]), rain: r1(d.precipitation_sum?.[i]),
      sunrise: d.sunrise?.[i] || null, sunset: d.sunset?.[i] || null, uv: r1(d.uv_index_max?.[i]), wind: r(d.wind_speed_10m_max?.[i])
    }))
  };
  if (!brief) {
    // Column arrays keep the 16-day hourly forecast small.
    out.hours = {
      time: h.time || [], temp: (h.temperature_2m || []).map(r1), feels: (h.apparent_temperature || []).map(r1),
      pp: (h.precipitation_probability || []).map(r), rain: (h.precipitation || []).map(r1), code: (h.weather_code || []).map(r),
      wind: (h.wind_speed_10m || []).map(r), gust: (h.wind_gusts_10m || []).map(r), hum: (h.relative_humidity_2m || []).map(r)
    };
  }
  return out;
}

// points: [{lat, lon}] (1–10). Open-Meteo answers several places in one call.
export async function forecast(points, brief) {
  const q = new URLSearchParams({
    latitude: points.map(p => p.lat).join(','), longitude: points.map(p => p.lon).join(','),
    current: CURRENT, daily: DAILY, timezone: 'America/New_York', wind_speed_unit: 'kmh',
    forecast_days: brief ? '7' : '16'
  });
  if (!brief) q.set('hourly', HOURLY);
  const j = await getJSON(`${BASE}?${q}`, 8000);
  return (Array.isArray(j) ? j : [j]).map(x => normalizeForecast(x, brief));
}

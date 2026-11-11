// GET /api/weather?lat=25.78,28.54&lon=-80.19,-81.38[&brief=1] — Open-Meteo forecast for places in the US and Canada.
// brief=1: current weather + 7 days (the weather strip); otherwise also 16 days hour by hour (game and city pages).
// Cached 30 minutes on the CDN.
import { json } from '../lib/espn.mjs';
import { forecast, inArea } from '../lib/weather.mjs';

export default async req => {
  const q = new URL(req.url).searchParams;
  const lat = (q.get('lat') || '').split(',').map(Number), lon = (q.get('lon') || '').split(',').map(Number);
  const brief = q.get('brief') === '1';
  const ok = lat.length && lat.length === lon.length && lat.length <= 10 && lat.every((v, i) => Number.isFinite(v) && Number.isFinite(lon[i]) && inArea(v, lon[i]));
  if (!ok) return json({ error: 'bad request' }, { browser: 0, cdn: 0, status: 400 });
  try {
    // Two decimals (about 1 km) is plenty, and keeps the CDN cache key stable.
    const places = await forecast(lat.map((v, i) => ({ lat: +v.toFixed(2), lon: +lon[i].toFixed(2) })), brief);
    return json({ updated: new Date().toISOString(), source: 'open-meteo', places }, { browser: 600, cdn: 1800, swr: 3600 });
  } catch (e) {
    return json({ error: String(e.message || e) }, { browser: 0, cdn: 60, status: 502 });
  }
};

export const config = { path: '/api/weather' };

// GET /api/health — are ESPN and Open-Meteo answering, in the format the site expects?
// Cached 5 minutes on the CDN, so many visitors cost one check.
import { checkSources } from '../lib/health.mjs';
import { json } from '../lib/espn.mjs';

export default async () => json(await checkSources(), { browser: 60, cdn: 300, swr: 300 });

export const config = { path: '/api/health' };

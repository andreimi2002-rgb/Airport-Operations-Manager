// Where push subscriptions live: Netlify Blobs on Netlify, plain JSON files when run locally.
// Production and previews use separate stores, so a test on a preview never touches real subscribers.
import crypto from 'node:crypto';
import { mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import os from 'node:os';

export const env = name => globalThis.Netlify?.env?.get(name) ?? process.env[name];
export const subId = endpoint => crypto.createHash('sha256').update(String(endpoint)).digest('hex').slice(0, 32);

// `production` = the published site; anything else (deploy previews, local) gets its own store.
export async function subsStore(context = 'local') {
  const name = context === 'production' ? 'push-subs' : 'push-subs-test';
  if (globalThis.Netlify) {
    const { getStore } = await import('@netlify/blobs');
    const s = getStore({ name, consistency: 'strong' });
    return {
      get: id => s.get(id, { type: 'json' }),
      set: (id, v) => s.setJSON(id, v),
      del: id => s.delete(id),
      async list() { const { blobs } = await s.list(); return (await Promise.all(blobs.map(b => s.get(b.key, { type: 'json' })))).filter(Boolean); }
    };
  }
  const dir = join(os.tmpdir(), 'meciuri-florida-blobs', name);
  await mkdir(dir, { recursive: true });
  const file = id => join(dir, id.replace(/[^a-f0-9]/g, '') + '.json');
  return {
    get: id => readFile(file(id), 'utf8').then(JSON.parse, () => null),
    set: (id, v) => writeFile(file(id), JSON.stringify(v)),
    del: id => rm(file(id), { force: true }),
    async list() { return (await Promise.all((await readdir(dir)).map(f => readFile(join(dir, f), 'utf8').then(JSON.parse, () => null)))).filter(Boolean); }
  };
}

export function vapid() {
  const publicKey = env('VAPID_PUBLIC_KEY'), privateKey = env('VAPID_PRIVATE_KEY');
  // The subject tells push services who sends; the site address, not a personal e-mail.
  const subject = env('VAPID_SUBJECT') || (env('URL') ? env('URL') : 'https://americansportshub.netlify.app');
  return publicKey && privateKey ? { publicKey, privateKey, subject } : null;
}

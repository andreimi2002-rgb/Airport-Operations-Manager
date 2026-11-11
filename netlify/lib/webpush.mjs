// Web Push without a library: VAPID signature (RFC 8292) and message encryption (RFC 8291, aes128gcm),
// with node:crypto only. Push services (Google, Mozilla, Apple, Microsoft) are free and need no account:
// the site proves who it is with its own VAPID key pair, kept in environment variables.
import crypto from 'node:crypto';

const b64u = buf => Buffer.from(buf).toString('base64url');
const unb64u = s => Buffer.from(String(s), 'base64url');

// A new VAPID key pair (run once: node tools/vapid-keys.mjs). Public: 65-byte point; private: 32 bytes.
export function generateVapidKeys() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  return { publicKey: b64u(ecdh.getPublicKey()), privateKey: b64u(ecdh.getPrivateKey()) };
}

// Only the push services browsers really use; anything else is refused (no requests to arbitrary hosts).
const HOSTS = /(^|\.)(fcm\.googleapis\.com|android\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com)$/i;
export function validSubscription(s) {
  try {
    const u = new URL(s.endpoint);
    return u.protocol === 'https:' && HOSTS.test(u.hostname) && unb64u(s.keys?.p256dh).length === 65 && unb64u(s.keys?.auth).length === 16;
  } catch (e) { return false; }
}

function vapidHeader(endpoint, { publicKey, privateKey, subject }) {
  const pub = unb64u(publicKey);
  const key = crypto.createPrivateKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256', d: privateKey, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) } });
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }));
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${publicKey}`;
}

// RFC 8291: one record, aes128gcm. Returns the request body.
export function encrypt(payload, { p256dh, auth }, { salt = crypto.randomBytes(16), ecdh = null } = {}) {
  const uaPublic = unb64u(p256dh), authSecret = unb64u(auth);
  const as = ecdh || crypto.createECDH('prime256v1');
  if (!ecdh) as.generateKeys();
  const asPublic = as.getPublicKey();
  const shared = as.computeSecret(uaPublic);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', shared, authSecret, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]), 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const data = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, data]);
}

// The browser side of RFC 8291, used by the tests to prove a message decrypts.
export function decrypt(body, uaEcdh, auth) {
  const salt = body.subarray(0, 16), idlen = body[20], asPublic = body.subarray(21, 21 + idlen), data = body.subarray(21 + idlen);
  const shared = uaEcdh.computeSecret(asPublic);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', shared, unb64u(auth), Buffer.concat([Buffer.from('WebPush: info\0'), uaEcdh.getPublicKey(), asPublic]), 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(data.subarray(data.length - 16));
  const plain = Buffer.concat([d.update(data.subarray(0, data.length - 16)), d.final()]);
  return plain.subarray(0, plain.lastIndexOf(2)).toString();
}

// Sends one message. Returns { ok, gone } — gone: the subscription no longer exists (delete it).
export async function sendPush(sub, message, vapid, { ttl = 3600, urgency = 'high' } = {}) {
  const body = encrypt(JSON.stringify(message), sub.keys);
  const r = await fetch(sub.endpoint, {
    method: 'POST',
    headers: { authorization: vapidHeader(sub.endpoint, vapid), 'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream', ttl: String(ttl), urgency },
    body,
    signal: AbortSignal.timeout(10000)
  });
  return { ok: r.ok, status: r.status, gone: r.status === 404 || r.status === 410 };
}

export const verifyVapid = (header, publicKey) => {
  const t = /t=([^,]+)/.exec(header)[1], [h, b, s] = t.split('.');
  const pub = unb64u(publicKey);
  const key = crypto.createPublicKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256', x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) } });
  return crypto.verify('sha256', Buffer.from(`${h}.${b}`), { key, dsaEncoding: 'ieee-p1363' }, unb64u(s)) ? JSON.parse(unb64u(b)) : null;
};
export { vapidHeader };

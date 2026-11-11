// Prints a new VAPID key pair for the notifications. Run once: node tools/vapid-keys.mjs
// Put both values in the Netlify environment variables (scope: Functions):
//   VAPID_PUBLIC_KEY  — may be public (the browser receives it)
//   VAPID_PRIVATE_KEY — secret: never in the repository
// Changing the pair later means every subscriber has to turn notifications on again.
import { generateVapidKeys } from '../netlify/lib/webpush.mjs';
const k = generateVapidKeys();
console.log(`VAPID_PUBLIC_KEY=${k.publicKey}\nVAPID_PRIVATE_KEY=${k.privateKey}`);

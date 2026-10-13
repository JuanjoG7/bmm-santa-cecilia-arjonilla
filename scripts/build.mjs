import { cp, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const required = ['index.html', 'manifest.webmanifest', 'sw.js', 'assets'];

for (const item of required) {
  try { await stat(path.join(root, item)); }
  catch { throw new Error(`No se puede construir la aplicación: falta ${item}`); }
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const item of required) {
  await cp(path.join(root, item), path.join(dist, item), { recursive: true });
}
console.log(`Build BMM listo en ${dist}`);
console.log('Solo se copian index.html, manifest.webmanifest, sw.js y assets/; las funciones se empaquetan desde netlify/functions.');

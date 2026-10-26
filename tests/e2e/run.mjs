// Tutte le prove nel browser, una dopo l'altra, con un solo server di Vite su una porta libera: node tests/e2e/run.mjs
// [nomi] (senza nomi tutte; i nomi sono quelli dei file senza .e2e.mjs). Esce con 1 se una prova fallisce. Ogni prova
// gira in un processo suo, atteso senza bloccare questo, dove intanto il server deve rispondere al browser
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const HERE = fileURLToPath(new URL('./', import.meta.url));
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SUFFIX = '.e2e.mjs';

const all = readdirSync(HERE)
  .filter((name) => name.endsWith(SUFFIX))
  .map((name) => name.slice(0, -SUFFIX.length));
const wanted = process.argv.slice(2);
const chosen = wanted.length ? all.filter((name) => wanted.includes(name)) : all;
const vite = await createServer({
  root: ROOT,
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
});
await vite.listen();
const env = { ...process.env, E2E_URL: vite.resolvedUrls.local[0] };
const failed = [];
for (const name of chosen) {
  console.log(`\n== ${name}`);
  const child = spawn(process.execPath, [`${HERE}${name}${SUFFIX}`], { stdio: 'inherit', env });
  const status = await new Promise((resolve) => child.on('exit', resolve));
  if (status !== 0) failed.push(name);
}
await vite.close();
console.log(
  failed.length ? `\nprove fallite: ${failed.join(', ')}` : `\nprove nel browser: ${chosen.length} su ${chosen.length}`,
);
process.exitCode = failed.length ? 1 : 0;

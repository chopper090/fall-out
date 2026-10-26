import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
// Le cifre del commit nella versione del gioco, e cosa gli si aggiunge quando il codice non è quello del commit
const COMMIT_DIGITS = 7;
const DIRTY = '-dirty';

// Il commit da cui si costruisce: quello di GitHub Actions, o quello del checkout, con DIRTY se ci sono cambi che non
// sono ancora in un commit (anche file nuovi): allora il codice che gira non è quello del commit, e le battaglie
// registrate o gli errori non si rileggono da lì; senza git, dev
function commit() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, COMMIT_DIGITS);
  try {
    const hash = git(`rev-parse --short=${COMMIT_DIGITS} HEAD`);
    return git('status --porcelain') === '' ? hash : `${hash}${DIRTY}`;
  } catch {
    return 'dev';
  }
}

// Quello che scrive il comando git args
function git(args) {
  return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
}

export default defineConfig(({ mode }) => {
  const release = mode === 'release';
  return {
    // percorsi relativi: la build funziona anche in una sottocartella, come su GitHub Pages
    base: './',
    // la versione del gioco (src/core/build.js): release è la build per l'uscita (npm run build:release), senza gli
    // strumenti di sviluppo. __BUILD__.release anche da solo, scritto com'è al posto suo: main.js lo legge così, e la
    // build lascia fuori il pannello di sviluppo
    define: {
      __BUILD__: JSON.stringify({ version, commit: commit(), release }),
      '__BUILD__.release': JSON.stringify(release),
    },
    // le dipendenze si cercano solo dalla pagina del gioco, non nelle altre cartelle del progetto
    optimizeDeps: { entries: ['index.html'] },
    server: {
      // host attivo: il server è raggiungibile dal telefono sulla stessa Wi-Fi
      host: true,
      port: 5173,
      strictPort: true,
    },
  };
});

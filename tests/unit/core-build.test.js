import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checker } from '../support/check.js';
import { BUILD, buildLabel } from '../../src/core/build.js';
import viteConfig from '../../vite.config.js';

const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

// Senza Vite (qui in node) __BUILD__ non c'è e valgono i valori di riserva; la versione si legge "v<versione> ·
// <commit>"
test('Versione del gioco: senza Vite quella di riserva, e come si legge', (t) => {
  const check = checker(t);
  const label = buildLabel({ version: '0.4.10', commit: 'f6a444a' });
  check(
    `senza Vite: ${JSON.stringify(BUILD)}, «${buildLabel()}»; con versione e commit «${label}»`,
    BUILD.version === 'dev' &&
      BUILD.commit === 'dev' &&
      BUILD.release === false &&
      buildLabel() === 'vdev · dev' &&
      label === 'v0.4.10 · f6a444a',
  );
  check.done();
});

// Vite scrive la versione di package.json, il commit (7 cifre, con -dirty se ci sono cambi non ancora in un commit, o
// dev senza git) e release solo nella build per l'uscita (--mode release); __BUILD__.release anche da solo, con lo
// stesso valore, per main.js
test("Versione del gioco: quella di package.json, il commit e release solo nella build per l'uscita", (t) => {
  const check = checker(t);
  const builds = ['development', 'production', 'release'].map((mode) => {
    const { define } = viteConfig({ command: 'build', mode });
    return { mode, build: JSON.parse(define.__BUILD__), alone: JSON.parse(define['__BUILD__.release']) };
  });
  // Il commit cambia a ogni commit, e -dirty dipende da dove si prova: la riga dice solo se ha la forma giusta
  const commitText = (commit) => (/^[0-9a-f]{7}(-dirty)?$/.test(commit) ? '7 cifre' : commit);
  check(
    `package.json ${version}; ${builds.map(({ mode, build, alone }) => `${mode}: ${build.version}, commit ${commitText(build.commit)}, release ${build.release} (da solo ${alone})`).join('; ')}`,
    builds.every(({ build }) => build.version === version && ['7 cifre', 'dev'].includes(commitText(build.commit))) &&
      builds.every(({ mode, build, alone }) => build.release === (mode === 'release') && alone === build.release),
  );
  check.done();
});

// Revisione. La build per l'uscita (npm run build:release, qui in memoria) lascia fuori gli strumenti di sviluppo:
// nessun pezzo di debug-*.js, nessun modulo di src/debug, di Tweakpane o delle battaglie registrate
// (systems/replay.js); la build di sviluppo (quella del link pubblico) li ha, nel loro pezzo a parte. Basta un import
// fermo di un file degli strumenti in una scena per portarli tutti nell'uscita
test("Build per l'uscita: senza gli strumenti di sviluppo", async (t) => {
  const check = checker(t);
  const { build } = await import('vite');
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const TOOLS = ['/src/debug/', '/node_modules/tweakpane/', '/src/systems/replay.js'];
  const bundle = async (mode) => {
    const out = await build({ root, mode, logLevel: 'silent', build: { write: false } });
    const chunks = [out].flat().flatMap((result) => result.output).filter((file) => file.type === 'chunk');
    const ids = chunks.flatMap((chunk) => chunk.moduleIds).map((id) => id.split('\\').join('/'));
    return {
      files: chunks.map((chunk) => chunk.fileName),
      tools: ids.filter((id) => TOOLS.some((part) => id.includes(part))).length,
      debugFiles: chunks.filter((chunk) => /(^|\/)debug-[^/]*\.js$/.test(chunk.fileName)).length,
    };
  };
  const release = await bundle('release');
  const dev = await bundle('production');
  check(
    `uscita: ${release.files.length} file, moduli degli strumenti ${release.tools}, pezzi debug ${release.debugFiles}; sviluppo: moduli degli strumenti ${dev.tools > 0 ? 'sì' : 'no'}, pezzi debug ${dev.debugFiles}`,
    release.tools === 0 && release.debugFiles === 0 && dev.tools > 0 && dev.debugFiles === 1,
  );
  check.done();
});

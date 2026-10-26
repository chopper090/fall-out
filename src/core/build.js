import { VERSION_LABEL } from '../config/balance.js';

// La versione del gioco: version (quella di package.json), commit (da cui è costruito) e release (la build per
// l'uscita, senza strumenti di sviluppo). La scrive Vite al posto di __BUILD__ (vite.config.js); senza Vite, nelle
// prove in node, valgono quelli di FALLBACK
const FALLBACK = { version: 'dev', commit: 'dev', release: false };

export const BUILD = typeof __BUILD__ === 'undefined' ? FALLBACK : __BUILD__;

// La versione come la si legge: "v0.4.10 · f6a444a"
export function buildLabel(build = BUILD) {
  const { prefix, separator } = VERSION_LABEL;
  return `${prefix}${build.version}${separator}${build.commit}`;
}

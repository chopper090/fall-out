import { DEBUG } from '../config/balance.js';

// I ritocchi globali che cambiano una battaglia, per rigiocarla uguale (systems/replay.js): i valori che il pannello
// di sviluppo cambia mentre il gioco gira (DEBUG.folders: la difficoltà di prova, i comandi, l'ondata iniziale e il
// boss, i soldati di partenza, le armi, i nemici...), compresi quelli delle impostazioni del giocatore (sensibilità e
// aggancio dello swipe). Ogni cartella del pannello si chiama con il suo titolo. I valori di partenza, quelli scritti
// nel codice, si leggono quando questo file si carica: nel gioco lo importa main.js, così succede prima che le
// impostazioni salvate li cambino
const DEFAULTS = Object.fromEntries(
  DEBUG.folders.map(({ title, target, fields }) => [title, pick(target, Object.keys(fields))]),
);

// Le differenze di adesso dai valori di partenza, { titolo: { chiave: valore } }: solo le cartelle con qualcosa di
// diverso
export function tweaksDiff() {
  const diff = {};
  for (const { title, target, fields } of DEBUG.folders) {
    const changed = Object.keys(fields).filter((key) => target[key] !== DEFAULTS[title][key]);
    if (changed.length > 0) diff[title] = pick(target, changed);
  }
  return diff;
}

// Tutti i ritocchi tornano ai valori di partenza, poi prendono quelli di diff (come lo dà tweaksDiff). Restituisce
// quelli che questa versione del gioco non conosce ("cartella.chiave"), lasciati stare
export function applyTweaks(diff) {
  for (const { title, target } of DEBUG.folders) Object.assign(target, DEFAULTS[title]);
  const unknown = [];
  for (const [title, values] of Object.entries(diff)) {
    const folder = DEBUG.folders.find((entry) => entry.title === title);
    for (const [key, value] of Object.entries(values)) {
      if (folder !== undefined && Object.hasOwn(folder.fields, key)) folder.target[key] = value;
      else unknown.push(`${title}.${key}`);
    }
  }
  return unknown;
}

// Le chiavi keys di target, con i loro valori di adesso
function pick(target, keys) {
  return Object.fromEntries(keys.map((key) => [key, target[key]]));
}

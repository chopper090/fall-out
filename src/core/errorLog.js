import { ERROR_LOG } from '../config/balance.js';
import { BUILD } from './build.js';
import { now } from './clock.js';

// Il registro degli errori che il gioco non prende (un'eccezione in un frame o in un tocco, una promessa rifiutata
// senza nessuno che la aspetti), sul telefono sotto ERROR_LOG.storageKey: gli ultimi ERROR_LOG.size, i più vecchi
// escono. Ogni voce ha l'ora del gioco (core/clock.js), il messaggio, lo stack, la versione e il commit (core/build.js)
// e le scene attive in quel momento. Se il browser non lascia leggere o scrivere il registro, valgono gli errori di
// questa pagina. Senza disegno: cosa mostrare lo decide chi lo avvia

// Gli errori di questa pagina, per quando il telefono non lascia leggere o scrivere il registro (saved: l'ultima
// scrittura è riuscita)
let session = [];
let saved = true;

// Ascolta gli errori non presi su target (la finestra del gioco): ognuno va nel registro con le scene attive (scenes(),
// i loro nomi) e poi a onError, con la sua voce. Prima prende quelli arrivati mentre la pagina si caricava, che
// index.html tiene in target.__earlyErrors ({error, text, time}), quando le scene non c'erano ancora; da lì in poi
// index.html non ne tiene più
export function startErrorLog({ target = window, scenes, onError }) {
  const early = target.__earlyErrors ?? [];
  target.__earlyErrors = null;
  for (const { error, text, time } of early) onError(logError(error, text, [], time));
  const report = (error, text) => onError(logError(error, text, activeScenes(scenes)));
  target.addEventListener('error', (event) => report(event.error, event.message));
  target.addEventListener('unhandledrejection', (event) => report(event.reason, ''));
}

// Scrive nel registro l'errore error (quello lanciato, di solito un Error; text: la scritta del browser, se c'è),
// successo all'ora time con le scene scenes attive; restituisce la sua voce
export function logError(error, text = '', scenes = [], time = now()) {
  const stack = typeof error?.stack === 'string' ? error.stack : null;
  const { version, commit } = BUILD;
  const entry = { time, message: messageOf(error, text), stack, version, commit, scenes };
  session = [...session, entry].slice(-ERROR_LOG.size);
  saved = write([...(read() ?? []), entry].slice(-ERROR_LOG.size));
  return entry;
}

// Le voci del registro, dalla più vecchia
export function errorEntries() {
  return (saved ? read() : null) ?? [...session];
}

// Il registro come testo da copiare e mandare a chi sviluppa
export function errorLogText() {
  return JSON.stringify(errorEntries(), null, 2);
}

// Il registro riparte vuoto
export function clearErrors() {
  session = [];
  try {
    localStorage.removeItem(ERROR_LOG.storageKey);
    saved = true;
  } catch {
    saved = false;
  }
}

// I nomi delle scene attive; se non si leggono (un errore mentre il gioco nasce, prima che ci sia) nessuna, perché
// chi ascolta gli errori non deve romperne altri
function activeScenes(scenes) {
  try {
    return scenes();
  } catch {
    return [];
  }
}

// Il messaggio di un errore: un Error si scrive con il suo tipo ("TypeError: …"); per il resto la scritta del browser
// o quello che è stato lanciato
function messageOf(error, text) {
  return error instanceof Error ? String(error) : text || String(error);
}

// Il registro sul telefono, o null se il browser non lo lascia leggere; uno rovinato vale vuoto
function read() {
  let raw;
  try {
    raw = localStorage.getItem(ERROR_LOG.storageKey);
  } catch {
    return null;
  }
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// Scrive le voci list sul telefono; restituisce se ci è riuscito
function write(list) {
  try {
    localStorage.setItem(ERROR_LOG.storageKey, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

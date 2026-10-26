import { SAVE } from '../config/balance.js';
import { createProfile, profileFrom, storedProfile } from '../meta/profile.js';
import { ROAD_TILES, storedRoad } from '../meta/road.js';

// Salvataggio della partita sul telefono (SAVE.storageKey): il profilo del giocatore (meta/profile.js storedProfile)
// con la versione del formato (SAVE.version). Quando il formato cambia, SAVE.version sale e MIGRATIONS[v - 1] porta i
// dati da v a v + 1: un salvataggio vecchio sale una versione alla volta. Prima di ogni scrittura il salvataggio che
// c'era, se si legge, passa nella copia di riserva (SAVE.backupKey), anche quando si cancella; ci va anche quello di
// una versione vecchia appena portato a quella di oggi. Se è rotto (non si legge, o una migrazione manca o si rompe)
// lo si tiene da parte com'era (SAVE.brokenKey) e si riprende la copia di riserva; se è rotta anche lei si parte da
// zero. Se è di una versione più nuova (un gioco più vecchio aperto dopo uno più nuovo) lo si legge ma non lo si
// sovrascrive (readOnly), per non perderlo. Se il browser non permette di salvare, il profilo vale finché la pagina
// resta aperta. status: com'era il salvataggio l'ultima volta che lo si è letto (new: non c'è; ok; migrated: di una
// versione vecchia; newer: di una più nuova; restored: rotto, ripresa la copia di riserva; corrupt: rotti tutti e due;
// unavailable: il browser non lo lascia leggere). writeFailed: l'ultima scrittura non è riuscita
export const MIGRATIONS = [
  // 1 → 2: il cammino sulla strada si salva con l'area e il posto nell'area (meta/road.js storedRoad), non più con il
  // numero della casella. I salvataggi 1 con la strada (dal 4.8) hanno le caselle di oggi; un cammino che non torna
  // resta com'è, e alla lettura riparte dalla porta
  (data) => {
    const road = data?.road;
    return Number.isInteger(road?.at) && ROAD_TILES[road.at] ? { ...data, road: storedRoad(road) } : data;
  },
];

// Gli stati con un salvataggio leggibile sul telefono, che si può prendere al posto del profilo in memoria
const READABLE = ['ok', 'migrated', 'newer'];
// Gli stati che il giocatore deve sapere (saveWarnings)
const WARNED = ['restored', 'corrupt', 'newer'];

export function loadSave() {
  const main = readStored(SAVE.storageKey);
  if (main.state === 'unavailable') return newSave('unavailable');
  if (main.state === 'missing') return newSave('new');
  const save = main.state === 'ok' ? saveFrom(main) : null;
  if (save !== null) return save;
  keep(SAVE.brokenKey, main.raw);
  const backup = readStored(SAVE.backupKey);
  const restored = backup.state === 'ok' ? saveFrom(backup) : null;
  if (restored === null) return newSave('corrupt');
  // Una copia di riserva di una versione più nuova resta da non sovrascrivere, e il giocatore deve saperlo
  return restored.readOnly ? restored : { ...restored, status: 'restored' };
}

// Scrive il profilo; restituisce se ci è riuscito (sempre no in sola lettura, che non è un errore)
export function writeSave(save) {
  if (save.readOnly) return false;
  const text = JSON.stringify({ version: SAVE.version, profile: storedProfile(save.profile) });
  save.writeFailed = !store(text);
  return !save.writeFailed;
}

// Rilegge il salvataggio dal telefono, se ce n'è uno leggibile: un'altra finestra del gioco può averlo cambiato o
// cancellato nel frattempo, e scrivendo sopra il profilo vecchio lo si perderebbe. Senza niente di leggibile (anche
// quando non arriva alla versione di oggi, o si riprende la copia di riserva) resta il profilo in memoria
export function refreshSave(save) {
  const read = loadSave();
  if (READABLE.includes(read.status)) Object.assign(save, read);
}

// Si riparte da zero, anche da un salvataggio di una versione più nuova: lo ha chiesto il giocatore. Quello di prima
// resta nella copia di riserva
export function clearSave(save) {
  Object.assign(save, newSave('new'));
  writeSave(save);
}

// Gli avvisi del salvataggio per il giocatore, uno per tipo: com'era alla lettura (restored, corrupt, newer) e se non
// si riesce a salvare (writeFailed: l'ultima scrittura non è riuscita, o il browser non lascia nemmeno leggere)
export function saveWarnings(save) {
  const warnings = WARNED.includes(save.status) ? [save.status] : [];
  if (save.writeFailed || save.status === 'unavailable') warnings.push('writeFailed');
  return warnings;
}

function newSave(status) {
  return { profile: createProfile(), readOnly: false, status };
}

// Il salvataggio letto (stored, con una versione valida) portato alla versione di oggi, o null se non ci arriva perché
// una migrazione manca o si rompe
function saveFrom({ stored, raw }) {
  if (stored.version > SAVE.version) return { profile: profileFrom(stored.profile), readOnly: true, status: 'newer' };
  let data = stored.profile;
  try {
    for (let version = stored.version; version < SAVE.version; version++) data = MIGRATIONS[version - 1](data);
  } catch {
    return null;
  }
  if (stored.version === SAVE.version) return { profile: profileFrom(data), readOnly: false, status: 'ok' };
  keep(SAVE.backupKey, raw);
  return { profile: profileFrom(data), readOnly: false, status: 'migrated' };
}

// Scrive il testo del salvataggio, dopo aver passato quello che c'era nella copia di riserva (se si legge, e se non
// è lo stesso: la copia resta quella di prima); restituisce se ci è riuscito
function store(text) {
  const current = readStored(SAVE.storageKey);
  if (current.raw === text) return true;
  if (current.state === 'ok') keep(SAVE.backupKey, current.raw);
  try {
    localStorage.setItem(SAVE.storageKey, text);
    return true;
  } catch {
    return false;
  }
}

// Una copia da tenere sotto la chiave key: se il browser non la lascia scrivere si va avanti senza
function keep(key, raw) {
  try {
    localStorage.setItem(key, raw);
  } catch {
    // Copia non permessa: resta quella di prima
  }
}

// Il salvataggio sotto la chiave key com'è sul telefono: state missing (non c'è), ok (si legge e ha una versione
// valida: stored), broken (non si legge o non ha una versione valida) o unavailable (il browser non lo lascia
// leggere); raw è il testo
function readStored(key) {
  let raw;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return { state: 'unavailable', raw: null, stored: null };
  }
  if (raw === null) return { state: 'missing', raw, stored: null };
  const stored = parsed(raw);
  return { state: Number.isInteger(stored?.version) && stored.version >= 1 ? 'ok' : 'broken', raw, stored };
}

function parsed(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

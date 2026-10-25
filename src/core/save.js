import { SAVE } from '../config/balance.js';
import { createProfile, profileFrom } from '../meta/profile.js';

// Salvataggio della partita sul telefono (SAVE.storageKey): il profilo del giocatore (meta/profile.js) con la
// versione del formato (SAVE.version). Quando il formato cambia, SAVE.version sale e MIGRATIONS[v] porta i dati da
// v a v + 1: un salvataggio vecchio sale una versione alla volta. Se manca o è rotto si parte da zero; se è di una
// versione più nuova (un gioco più vecchio aperto dopo uno più nuovo) lo si legge ma non lo si sovrascrive
// (readOnly), per non perderlo. Se il browser non permette di salvare, il profilo vale finché la pagina resta aperta
const MIGRATIONS = [];

export function loadSave() {
  const stored = readStored();
  if (stored === null) return { profile: createProfile(), readOnly: false };
  if (stored.version > SAVE.version) return { profile: profileFrom(stored.profile), readOnly: true };
  let data = stored.profile;
  for (let version = stored.version; version < SAVE.version; version++) data = MIGRATIONS[version](data);
  return { profile: profileFrom(data), readOnly: false };
}

export function writeSave(save) {
  if (save.readOnly) return;
  try {
    localStorage.setItem(SAVE.storageKey, JSON.stringify({ version: SAVE.version, profile: save.profile }));
  } catch {
    // Salvataggio non permesso: il profilo vale finché la pagina resta aperta
  }
}

// Rilegge il salvataggio dal telefono, se ce n'è uno leggibile: un'altra finestra del gioco può averlo cambiato o
// cancellato nel frattempo, e scrivendo sopra il profilo vecchio lo si perderebbe. Senza niente di leggibile resta
// il profilo in memoria
export function refreshSave(save) {
  if (readStored() === null) return;
  Object.assign(save, loadSave());
}

// Si riparte da zero, anche da un salvataggio di una versione più nuova: lo ha chiesto il giocatore
export function clearSave(save) {
  save.profile = createProfile();
  save.readOnly = false;
  writeSave(save);
}

// Il salvataggio com'è sul telefono, o null se manca, non si legge o non ha una versione valida
function readStored() {
  try {
    const stored = JSON.parse(localStorage.getItem(SAVE.storageKey));
    return Number.isInteger(stored?.version) && stored.version >= 1 ? stored : null;
  } catch {
    return null;
  }
}

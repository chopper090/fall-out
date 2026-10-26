import { SAVE } from '../config/balance.js';
import { createProfile, profileFrom, storedProfile } from '../meta/profile.js';
import { ROAD_TILES, storedRoad } from '../meta/road.js';

// Salvataggio della partita sul telefono (SAVE.storageKey): il profilo del giocatore (meta/profile.js storedProfile)
// con la versione del formato (SAVE.version). Quando il formato cambia, SAVE.version sale e MIGRATIONS[v - 1] porta i
// dati da v a v + 1: un salvataggio vecchio sale una versione alla volta. Se manca o è rotto si parte da zero, anche
// quando una migrazione manca o si rompe; se è di una versione più nuova (un gioco più vecchio aperto dopo uno più
// nuovo) lo si legge ma non lo si sovrascrive (readOnly), per non perderlo. Se il browser non permette di salvare, il
// profilo vale finché la pagina resta aperta. status: com'era il salvataggio l'ultima volta che lo si è letto (new:
// niente di leggibile; ok; migrated: di una versione vecchia; newer: di una più nuova; corrupt: una migrazione manca
// o si rompe)
export const MIGRATIONS = [
  // 1 → 2: il cammino sulla strada si salva con l'area e il posto nell'area (meta/road.js storedRoad), non più con il
  // numero della casella. I salvataggi 1 con la strada (dal 4.8) hanno le caselle di oggi; un cammino che non torna
  // resta com'è, e alla lettura riparte dalla porta
  (data) => {
    const road = data?.road;
    return Number.isInteger(road?.at) && ROAD_TILES[road.at] ? { ...data, road: storedRoad(road) } : data;
  },
];

export function loadSave() {
  const stored = readStored();
  if (stored === null) return newSave('new');
  if (stored.version > SAVE.version) return { profile: profileFrom(stored.profile), readOnly: true, status: 'newer' };
  let data = stored.profile;
  try {
    for (let version = stored.version; version < SAVE.version; version++) data = MIGRATIONS[version - 1](data);
  } catch {
    // Una migrazione che manca o si rompe: il salvataggio non arriva alla versione di oggi, come se fosse rotto
    return newSave('corrupt');
  }
  return { profile: profileFrom(data), readOnly: false, status: stored.version < SAVE.version ? 'migrated' : 'ok' };
}

export function writeSave(save) {
  if (save.readOnly) return;
  const text = JSON.stringify({ version: SAVE.version, profile: storedProfile(save.profile) });
  try {
    localStorage.setItem(SAVE.storageKey, text);
  } catch {
    // Salvataggio non permesso: il profilo vale finché la pagina resta aperta
  }
}

// Rilegge il salvataggio dal telefono, se ce n'è uno leggibile: un'altra finestra del gioco può averlo cambiato o
// cancellato nel frattempo, e scrivendo sopra il profilo vecchio lo si perderebbe. Senza niente di leggibile (anche
// quando non arriva alla versione di oggi) resta il profilo in memoria
export function refreshSave(save) {
  const read = loadSave();
  if (read.status !== 'new' && read.status !== 'corrupt') Object.assign(save, read);
}

// Si riparte da zero, anche da un salvataggio di una versione più nuova: lo ha chiesto il giocatore
export function clearSave(save) {
  save.profile = createProfile();
  save.readOnly = false;
  writeSave(save);
}

function newSave(status) {
  return { profile: createProfile(), readOnly: false, status };
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

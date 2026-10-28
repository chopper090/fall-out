import { SAVE } from '../config/balance.js';
import { RECRUIT } from '../data/growth.js';
import { assembledFor } from '../meta/heroes.js';
import { createProfile, profileFrom, storedProfile } from '../meta/profile.js';
import { ROAD_TILES, conqueredAreas, restoredRoad, storedRoad } from '../meta/road.js';

// Salvataggio della partita sul telefono (SAVE.storageKey): il profilo del giocatore (meta/profile.js storedProfile)
// con la versione del formato (SAVE.version). Quando il formato cambia, SAVE.version sale e MIGRATIONS[v - 1] porta i
// dati da v a v + 1: un salvataggio vecchio sale una versione alla volta. Leggere non scrive niente: è la prima
// scrittura (store) a passare il salvataggio che c'era nella copia di riserva (SAVE.backupKey), se si può prendere
// (anche di una versione vecchia o più nuova, anche quando si cancella), o a tenerlo da parte com'era (SAVE.brokenKey)
// se è rotto (non si legge, senza profilo, o una migrazione manca o si rompe). Rotto, alla lettura si riprende la copia
// di riserva; se è rotta anche lei si parte da zero. Se è di una versione più nuova (un gioco più vecchio aperto dopo
// uno più nuovo) lo si legge ma non lo si sovrascrive (readOnly), per non perderlo. Se il browser non permette di
// salvare, il profilo vale finché la pagina resta aperta. status: com'era il salvataggio l'ultima volta che lo si è
// letto (new: non c'è; ok; migrated: di una versione vecchia; newer: di una più nuova; restored: rotto, ripresa la
// copia di riserva; corrupt: rotti tutti e due; unavailable: il browser non lo lascia leggere). writeFailed: l'ultima
// scrittura non è riuscita
export const MIGRATIONS = [
  // 1 → 2: il cammino sulla strada si salva con l'area e il posto nell'area (meta/road.js storedRoad), non più con il
  // numero della casella. I salvataggi 1 con la strada (dal 4.8) hanno le caselle di prima del passo R, uguali a oggi
  // tranne la prima area, che ne aveva SAVE.legacyFirstArea: le caselle dopo si spostano di quante ne ha guadagnate.
  // Del tipo di prima si sa solo il boss, l'ultima casella di ogni area; un cammino che non torna resta com'è, e alla
  // lettura riparte dalla porta
  (data) => {
    const road = data?.road;
    const first = SAVE.legacyFirstArea;
    if (!Number.isInteger(road?.at) || road.at < 0) return data;
    if (road.at > 0 && road.at <= first) {
      const kind = road.at === first ? 'boss' : undefined;
      return { ...data, road: { area: 0, offset: road.at - 1, done: road.done, lost: road.lost, kind } };
    }
    const grown = ROAD_TILES.filter((tile) => tile.area === 0).length - first;
    const at = road.at === 0 ? 0 : road.at + grown;
    if (ROAD_TILES[at] === undefined) return data;
    const stored = storedRoad({ ...road, at });
    const kind = ['gate', 'boss'].includes(stored.kind) ? stored.kind : undefined;
    return { ...data, road: { ...stored, kind } };
  },
  // 2 → 3: il cantiere aperto (construction, o null) diventa la lista dei cantieri (sites), con lui solo o vuota. Un
  // villaggio che non è un oggetto resta com'è, e alla lettura riparte da zero
  (data) => {
    const village = data?.village;
    if (village === null || typeof village !== 'object') return data;
    const { construction, ...rest } = village;
    const sites = construction === null || construction === undefined ? [] : [construction];
    return { ...data, village: { ...rest, sites } };
  },
  // 3 → 4: le scorte si dividono (data/village.js): i materiali in legno (SAVE.woodShare, per difetto) e pietra, i
  // rottami diventano ingranaggi, e arriva un circuito per ogni area già conquistata, come se la conquista l'avesse
  // dato. Le scorte nuove che ci sono già restano come sono; materiali o rottami che mancano (o non sono un numero
  // valido) non danno niente, e alla lettura legno, pietra e ingranaggi prendono quelli di partenza; le risorse che non
  // sono un oggetto restano come sono, e alla lettura ripartono da quelle di partenza
  (data) => {
    const resources = data?.resources;
    if (resources === null || typeof resources !== 'object') return data;
    const { materials, scrap, ...rest } = resources;
    const valid = (value) => Number.isFinite(value) && value >= 0;
    const road = data.road === null || typeof data.road !== 'object' ? null : restoredRoad(data.road);
    const split = { circuits: road === null ? 0 : conqueredAreas(road) };
    if (valid(materials)) {
      split.wood = Math.floor(materials * SAVE.woodShare);
      split.stone = materials - split.wood;
    }
    if (valid(scrap)) split.gears = scrap;
    return { ...data, resources: { ...split, ...rest } };
  },
  // 4 → 5: gli acceleratori diventano gemme, SAVE.gemsPerAccelerator per acceleratore (lo stesso tempo tolto). Gemme
  // che ci sono già restano come sono; acceleratori che mancano (o non sono un numero valido) non danno niente, e alla
  // lettura le gemme prendono quelle di partenza
  (data) => {
    const resources = data?.resources;
    if (resources === null || typeof resources !== 'object') return data;
    const { accelerators, ...rest } = resources;
    const gems =
      Number.isFinite(accelerators) && accelerators >= 0 ? { gems: accelerators * SAVE.gemsPerAccelerator } : {};
    return { ...data, resources: { ...gems, ...rest } };
  },
  // 5 → 6: ogni eroe aveva la sua esperienza (xp), che faceva il livello con la curva di SAVE.legacyXp: ora ha il
  // livello, e l'esperienza dentro il livello va nelle scorte (resources.xp), da spendere. Un'esperienza che manca (o
  // non è un numero valido) dà il livello 1 e niente scorte. Ogni area già conquistata dà i frammenti del suo mitico,
  // come se la conquista li avesse dati (RECRUIT.fragments.conquest). Eroi o risorse che non sono un oggetto restano
  // come sono, e alla lettura ripartono da quelli di partenza
  (data) => {
    const heroes = data?.heroes;
    if (heroes === null || typeof heroes !== 'object') return data;
    let spare = 0;
    const leveled = Object.fromEntries(
      Object.entries(heroes).map(([id, record]) => {
        if (record === null || typeof record !== 'object') return [id, record];
        const { xp, ...rest } = record;
        const { level, left } = legacyLevel(Number.isFinite(xp) && xp >= 0 ? xp : 0);
        spare += left;
        return [id, { ...rest, level }];
      }),
    );
    const road = data.road === null || typeof data.road !== 'object' ? null : restoredRoad(data.road);
    for (let area = 0; area < (road === null ? 0 : conqueredAreas(road)); area++) {
      const id = assembledFor(area);
      const record = leveled[id] ?? {};
      if (record === null || typeof record !== 'object') continue;
      const had = Number.isFinite(record.fragments) && record.fragments >= 0 ? record.fragments : 0;
      leveled[id] = { ...record, fragments: had + RECRUIT.fragments.conquest };
    }
    const resources = data.resources;
    if (resources === null || typeof resources !== 'object') return { ...data, heroes: leveled };
    const pool = Number.isFinite(resources.xp) && resources.xp >= 0 ? resources.xp : 0;
    return { ...data, heroes: leveled, resources: { ...resources, xp: pool + spare } };
  },
];

// Il livello che xp punti davano con la curva dei salvataggi di prima della 6 (SAVE.legacyXp) e i punti rimasti
// dentro il livello (tutti quelli oltre, al livello massimo)
function legacyLevel(xp) {
  const { base, growth, maxLevel } = SAVE.legacyXp;
  const need = (level) => Math.round(base * level ** growth);
  let level = 1;
  let left = xp;
  while (level < maxLevel && left >= need(level)) {
    left -= need(level);
    level += 1;
  }
  return { level, left };
}

// Gli stati del salvataggio sul telefono che la rilettura prende al posto del profilo in memoria: della versione di
// oggi o di una più nuova. Uno di una versione vecchia l'ha scritto un gioco più vecchio aperto in un'altra finestra,
// e il profilo in memoria è più nuovo di lui: resta quello, e il vecchio alla prima scrittura va nella copia di riserva
const ADOPTED = ['ok', 'newer'];
// Gli stati che il giocatore deve sapere (saveWarnings)
const WARNED = ['restored', 'corrupt', 'newer'];

// Il salvataggio com'è sul telefono, senza scrivere niente (lo legge l'avvio e ogni rilettura)
export function loadSave() {
  const main = readStored(SAVE.storageKey);
  if (main.state === 'unavailable') return newSave('unavailable');
  if (main.state === 'missing') return newSave('new');
  const save = main.state === 'ok' ? saveFrom(main.stored) : null;
  if (save !== null) return save;
  const backup = readStored(SAVE.backupKey);
  const restored = backup.state === 'ok' ? saveFrom(backup.stored) : null;
  if (restored === null) return newSave('corrupt');
  // Una copia di riserva di una versione più nuova resta da non sovrascrivere, e il giocatore deve saperlo
  return restored.readOnly ? restored : { ...restored, status: 'restored' };
}

// Scrive il profilo; restituisce se ci è riuscito (sempre no in sola lettura, che non è un errore)
export function writeSave(save) {
  if (save.readOnly) return false;
  save.writeFailed = !store(saveText(save.profile));
  return !save.writeFailed;
}

// Rilegge il salvataggio dal telefono, se ce n'è uno della versione di oggi o di una più nuova (ADOPTED): un'altra
// finestra del gioco può averlo cambiato o cancellato nel frattempo, e scrivendo sopra il profilo vecchio lo si
// perderebbe. Senza (anche quando è di una versione vecchia, o si riprende la copia di riserva) resta il profilo in
// memoria
export function refreshSave(save) {
  const read = loadSave();
  if (ADOPTED.includes(read.status)) Object.assign(save, read);
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

// Il salvataggio come testo da copiare, per portarlo su un altro telefono (strumenti di sviluppo): il profilo in
// memoria come lo scrive writeSave; uno di una versione più nuova (readOnly) com'è sul telefono, perché in memoria ha
// solo quello che questa versione conosce
export function exportSave(save) {
  const current = readStored(SAVE.storageKey);
  return save.readOnly && current.state === 'ok' ? current.raw : saveText(save.profile);
}

// Il salvataggio incollato (text, come lo dà exportSave) prende il posto di quello di adesso, che passa nella copia di
// riserva come prima di ogni scrittura, anche se è di una versione più nuova: lo ha chiesto il giocatore. Se non è un
// salvataggio (non si legge, senza versione o senza profilo, una migrazione che si rompe), se è di una versione più
// nuova o se non si riesce a scriverlo non cambia niente. Restituisce com'è andata: imported, invalid, newer o failed
export function importSave(save, text) {
  const stored = parsed(text);
  if (!hasVersion(stored) || !hasProfile(stored)) return 'invalid';
  if (stored.version > SAVE.version) return 'newer';
  const data = migrated(stored);
  if (data === null) return 'invalid';
  const next = { profile: profileFrom(data), readOnly: false, status: 'ok' };
  if (!writeSave(next)) return 'failed';
  Object.assign(save, next);
  return 'imported';
}

function newSave(status) {
  return { profile: createProfile(), readOnly: false, status };
}

// Il salvataggio letto (stored, con una versione valida) portato alla versione di oggi, o null se non si può prendere
// (usableData)
function saveFrom(stored) {
  const data = usableData(stored);
  if (data === null) return null;
  if (stored.version > SAVE.version) return { profile: profileFrom(data), readOnly: true, status: 'newer' };
  return { profile: profileFrom(data), readOnly: false, status: stored.version === SAVE.version ? 'ok' : 'migrated' };
}

// I dati del profilo salvato (stored, con una versione valida) da leggere: di una versione più nuova come sono, se no
// portati alla versione di oggi; null se non c'è un profilo o una migrazione manca o si rompe
function usableData(stored) {
  if (!hasProfile(stored)) return null;
  return stored.version > SAVE.version ? stored.profile : migrated(stored);
}

// I dati del profilo salvato (stored, di una versione valida e non più nuova) portati alla versione di oggi, una
// migrazione alla volta; null se una manca o si rompe
function migrated(stored) {
  let data = stored.profile;
  try {
    for (let version = stored.version; version < SAVE.version; version++) data = MIGRATIONS[version - 1](data);
  } catch {
    return null;
  }
  return data;
}

// Il testo del salvataggio con il profilo profile, della versione di oggi
function saveText(profile) {
  return JSON.stringify({ version: SAVE.version, profile: storedProfile(profile) });
}

// Scrive il testo del salvataggio; restituisce se ci è riuscito. Prima quello che c'era, se non è lo stesso, passa
// nella copia di riserva se si può prendere (usableData); se è rotto lo si tiene da parte com'era, e la copia resta
// quella di prima
function store(text) {
  const current = readStored(SAVE.storageKey);
  if (current.raw === text) return true;
  if (current.state === 'ok' && usableData(current.stored) !== null) keep(SAVE.backupKey, current.raw);
  else if (current.raw !== null) keep(SAVE.brokenKey, current.raw);
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
  return { state: hasVersion(stored) ? 'ok' : 'broken', raw, stored };
}

// I dati letti hanno una versione valida
function hasVersion(stored) {
  return Number.isInteger(stored?.version) && stored.version >= 1;
}

// I dati letti hanno un profilo
function hasProfile(stored) {
  return stored.profile !== null && typeof stored.profile === 'object';
}

function parsed(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

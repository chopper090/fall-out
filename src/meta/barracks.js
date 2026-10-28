import { BASE_SOLDIER, SOLDIER_TYPES } from '../data/units.js';
import { VILLAGE } from '../data/village.js';

// La caserma (data/village.js barracks): quali tipi di soldati (data/units.js SOLDIER_TYPES) addestra a ogni livello
// e l'esercito che vi si forma. L'esercito (profile.army) dice per ogni tipo che non è la base (BASE_SOLDIER) quanti
// soldati ne ha; i posti che restano fino al tetto della caserma (armyCapacity) sono della base, così quando la
// caserma sale i posti nuovi sono subito fucilieri

// I tipi di soldati che la caserma al livello level addestra, nell'ordine dei dati (nessuno se non è costruita)
export function trainableTypes(level) {
  return Object.keys(SOLDIER_TYPES).filter((id) => SOLDIER_TYPES[id].barracks <= level);
}

// I tipi che la caserma comincia ad addestrare proprio al livello level
export function typesFrom(level) {
  return Object.keys(SOLDIER_TYPES).filter((id) => SOLDIER_TYPES[id].barracks === level);
}

// Quanti soldati ha l'esercito con la caserma al livello level (soldiers[level - 1]; nessuno se non è costruita)
export function armyCapacity(level) {
  return level === 0 ? 0 : VILLAGE.buildings.barracks.soldiers[level - 1];
}

// L'esercito di chi comincia: nessun soldato di un tipo che non è la base
export function createArmy() {
  return Object.fromEntries(specialTypes().map((type) => [type, 0]));
}

// L'esercito dai dati salvati, con la caserma al livello level: per ogni tipo un intero da 0, nessuno dei tipi che la
// caserma non addestra ancora, e in tutto non più del tetto (si tolgono dagli ultimi tipi)
export function armyFrom(saved, level) {
  const army = createArmy();
  let room = armyCapacity(level);
  for (const type of specialTypes()) {
    const value = saved?.[type];
    const wanted = Number.isInteger(value) && value > 0 && SOLDIER_TYPES[type].barracks <= level ? value : 0;
    army[type] = Math.min(wanted, room);
    room -= army[type];
  }
  return army;
}

// L'esercito del profilo, tipo per tipo nell'ordine dei dati (tutti, anche quelli ancora da sbloccare, a 0): la base ha
// i posti che restano
export function armyOf(profile) {
  const { army } = profile;
  const trained = specialTypes().reduce((sum, type) => sum + army[type], 0);
  const base = armyCapacity(profile.village.levels.barracks) - trained;
  return Object.fromEntries(
    Object.keys(SOLDIER_TYPES).map((type) => [type, type === BASE_SOLDIER ? base : army[type]]),
  );
}

// Un soldato della base diventa del tipo type (delta 1) o ne torna (delta -1): il tipo dev'essere uno che la caserma
// addestra, non la base, e deve esserci il soldato da cambiare. Dice se l'esercito è cambiato
export function changeArmy(profile, type, delta) {
  const level = profile.village.levels.barracks;
  if (type === BASE_SOLDIER || !trainableTypes(level).includes(type) || Math.abs(delta) !== 1) return false;
  const from = delta > 0 ? BASE_SOLDIER : type;
  if (armyOf(profile)[from] === 0) return false;
  profile.army[type] += delta;
  return true;
}

// I tipi che non sono la base, nell'ordine dei dati
function specialTypes() {
  return Object.keys(SOLDIER_TYPES).filter((type) => type !== BASE_SOLDIER);
}

import { apportion } from '../core/apportion.js';
import { secondsToMs } from '../core/time.js';
import { BASE_SOLDIER, SOLDIER_TYPES } from '../data/units.js';
import { VILLAGE } from '../data/village.js';

// La caserma (data/village.js barracks): quali tipi di soldati (data/units.js SOLDIER_TYPES) addestra a ogni livello
// e l'esercito che vi si forma. L'esercito (profile.army) dice per ogni tipo che non è la base (BASE_SOLDIER) quanti
// soldati ne ha; i posti che restano fino al tetto della caserma (armyCapacity) sono della base, così quando la
// caserma sale i posti nuovi sono subito fucilieri. I caduti (profile.fallen, per tipo) sono soldati dell'esercito
// morti in battaglia: in battaglia vanno gli altri (readyArmy) finché non si riaddestrano. Il riaddestramento
// (profile.retrain: { endsAt, soldiers: quanti per tipo }, o null) li riporta tutti insieme, quelli caduti fino alla
// partenza: costa e dura come dice VILLAGE.buildings.barracks.retrain, e una gemma lo finisce subito

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
// addestra, non la base, e deve esserci il soldato da cambiare, non caduto. Dice se l'esercito è cambiato
export function changeArmy(profile, type, delta) {
  const level = profile.village.levels.barracks;
  if (type === BASE_SOLDIER || !trainableTypes(level).includes(type) || Math.abs(delta) !== 1) return false;
  const from = delta > 0 ? BASE_SOLDIER : type;
  if (readyArmy(profile)[from] === 0) return false;
  profile.army[type] += delta;
  return true;
}

// Nessun caduto, per ogni tipo
export function createFallen() {
  return Object.fromEntries(Object.keys(SOLDIER_TYPES).map((type) => [type, 0]));
}

// I caduti dai dati salvati: per ogni tipo un intero da 0, non più dei soldati di quel tipo nell'esercito (army,
// armyOf)
export function fallenFrom(saved, army) {
  const fallen = createFallen();
  for (const type of Object.keys(fallen)) {
    const value = saved?.[type];
    fallen[type] = Number.isInteger(value) && value > 0 ? Math.min(value, army[type]) : 0;
  }
  return fallen;
}

// Il riaddestramento dai dati salvati: una fine che è un numero e, per tipo, non più dei caduti; null se non torna o
// non riporta nessuno
export function retrainFrom(saved, fallen) {
  if (!Number.isFinite(saved?.endsAt)) return null;
  const soldiers = fallenFrom(saved.soldiers, fallen);
  return total(soldiers) > 0 ? { endsAt: saved.endsAt, soldiers } : null;
}

// I soldati dell'esercito che vanno in battaglia, per tipo: tutti meno i caduti
export function readyArmy(profile) {
  const army = armyOf(profile);
  return Object.fromEntries(Object.keys(army).map((type) => [type, army[type] - profile.fallen[type]]));
}

// Dopo una battaglia in cui si è persa la parte lostShare dei soldati (systems/army.js lostShare): dei soldati della
// caserma che ci sono andati (sent, per tipo; mai più di quelli che ci sono ora, se intanto qualcosa è cambiato) cade
// la stessa parte, divisa tra i tipi in proporzione. Chi è tornato da un riaddestramento o è arrivato con la caserma
// salita durante la battaglia non c'era, e non cade; senza sent non cade nessuno. Restituisce quanti sono caduti
export function fallInBattle(profile, lostShare, sent = {}) {
  const ready = readyArmy(profile);
  const types = Object.keys(ready);
  const fought = types.map((type) => Math.min(sent[type] ?? 0, ready[type]));
  const count = Math.round(fought.reduce((sum, value) => sum + value, 0) * Math.min(1, Math.max(0, lostShare)));
  const parts = apportion(fought, count);
  types.forEach((type, index) => {
    profile.fallen[type] += parts[index];
  });
  return count;
}

// Quanti sono i caduti in tutto (anche quelli di un riaddestramento in corso) e quanto costa e quanto dura
// riaddestrarli: { count, rations, ms }
export function retrainCost(profile) {
  const { rations, seconds } = VILLAGE.buildings.barracks.retrain;
  const count = total(profile.fallen);
  return { count, rations: Math.floor(count * rations), ms: secondsToMs(count * seconds) };
}

// Parte il riaddestramento di tutti i caduti, all'ora now: ci sono caduti, non ce n'è già uno in corso e le razioni
// bastano. Restituisce { endsAt, count, rations }, o null se non parte
export function startRetrain(profile, now) {
  const { count, rations, ms } = retrainCost(profile);
  if (count === 0 || profile.retrain !== null || profile.resources.rations < rations) return null;
  profile.resources.rations -= rations;
  profile.retrain = { endsAt: now + ms, soldiers: { ...profile.fallen } };
  return { endsAt: profile.retrain.endsAt, count, rations };
}

// Quanti soldati sta riaddestrando il riaddestramento in corso (0 se non ce n'è uno)
export function trainingCount(profile) {
  return profile.retrain === null ? 0 : total(profile.retrain.soldiers);
}

// L'orologio del telefono tornato indietro lascia nel futuro la fine del riaddestramento: non dura mai più di quanto
// dura per i suoi soldati, e se la fine è più lontana riparte da adesso (come i cantieri, meta/village.js). Dice se
// l'ha rimessa a posto
export function clampRetrain(profile, now) {
  if (profile.retrain === null) return false;
  const full = secondsToMs(trainingCount(profile) * VILLAGE.buildings.barracks.retrain.seconds);
  if (profile.retrain.endsAt - now <= full) return false;
  profile.retrain.endsAt = now + full;
  return true;
}

// Il riaddestramento finito entro l'ora now: i suoi soldati non sono più caduti. Restituisce quanti (0 se niente)
export function finishRetrain(profile, now) {
  if (profile.retrain === null || now < profile.retrain.endsAt) return 0;
  return endRetrain(profile);
}

// Una gemma finisce subito il riaddestramento in corso. Restituisce quanti soldati tornano (0 se non si poteva)
export function rushRetrain(profile) {
  if (profile.retrain === null || profile.resources.gems < 1) return 0;
  profile.resources.gems -= 1;
  return endRetrain(profile);
}

// I soldati del riaddestramento in corso tornano tra quelli che vanno in battaglia
function endRetrain(profile) {
  const { soldiers } = profile.retrain;
  for (const type of Object.keys(soldiers)) profile.fallen[type] = Math.max(0, profile.fallen[type] - soldiers[type]);
  profile.retrain = null;
  return total(soldiers);
}

// Quanti soldati in tutto, da un conto per tipo
function total(counts) {
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

// I tipi che non sono la base, nell'ordine dei dati
function specialTypes() {
  return Object.keys(SOLDIER_TYPES).filter((type) => type !== BASE_SOLDIER);
}

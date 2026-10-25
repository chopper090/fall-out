import { minutesToMs, msToHours } from '../core/time.js';
import { VILLAGE } from '../data/village.js';

// Villaggio del giocatore, nel profilo (meta/profile.js): livello di ogni edificio, la costruzione in corso e le
// razioni della fattoria in attesa (numeri in data/village.js). Il tempo è quello vero (now, in millisecondi): settle
// porta il villaggio al momento now, anche dopo ore ad app chiusa. Se l'orologio del telefono torna indietro, la
// fattoria non produce finché non torna dove era arrivata: niente due volte

// Il villaggio al momento now: la costruzione finita entra nel suo edificio, la fattoria produce fino al suo tetto
// (con il livello di prima fino a quando un suo miglioramento finisce)
export function settle(profile, now) {
  const { village } = profile;
  const job = village.construction;
  if (job !== null && job.endsAt <= now) {
    produce(village, job.endsAt);
    village.levels[job.building] += 1;
    village.construction = null;
  }
  produce(village, now);
}

// Le razioni pronte, intere, passano tra le risorse
export function collectRations(profile) {
  const { farm } = profile.village;
  const whole = Math.floor(farm.stored);
  profile.resources.rations += whole;
  farm.stored -= whole;
  return whole;
}

// Costo e durata del prossimo livello dell'edificio id, null al livello massimo
export function upgradeCost(profile, id) {
  const building = VILLAGE.buildings[id];
  const level = profile.village.levels[id];
  if (level >= building.maxLevel) return null;
  return { ...building.costs[level], minutes: building.minutes[level] };
}

// Si può migliorare l'edificio id: nessun altro cantiere aperto, non al massimo, risorse che bastano
export function canUpgrade(profile, id) {
  const cost = upgradeCost(profile, id);
  const { resources } = profile;
  if (profile.village.construction !== null || cost === null) return false;
  return resources.materials >= cost.materials && resources.scrap >= cost.scrap;
}

// Apre il cantiere per il prossimo livello dell'edificio id, pagando: finisce dopo i suoi minuti. Dice se è partito
export function startUpgrade(profile, id, now) {
  if (!canUpgrade(profile, id)) return false;
  const cost = upgradeCost(profile, id);
  profile.resources.materials -= cost.materials;
  profile.resources.scrap -= cost.scrap;
  profile.village.construction = { building: id, endsAt: now + minutesToMs(cost.minutes), challenged: false };
  return true;
}

// Millisecondi che mancano alla fine del cantiere, 0 se non ce n'è uno
export function timeLeft(profile, now) {
  const job = profile.village.construction;
  return job === null ? 0 : Math.max(0, job.endsAt - now);
}

// Un acceleratore toglie VILLAGE.acceleratorMinutes al cantiere aperto. Dice se è stato usato
export function useAccelerator(profile, now) {
  settle(profile, now);
  const job = profile.village.construction;
  if (job === null || profile.resources.accelerators <= 0) return false;
  profile.resources.accelerators -= 1;
  job.endsAt -= minutesToMs(VILLAGE.acceleratorMinutes);
  settle(profile, now);
  return true;
}

// La sfida si può tentare una volta per cantiere, se mancano almeno VILLAGE.challenge.minMinutes: partendo la si
// spende, anche se poi si lascia a metà
export function canChallenge(profile, now) {
  const job = profile.village.construction;
  return job !== null && !job.challenged && timeLeft(profile, now) >= minutesToMs(VILLAGE.challenge.minMinutes);
}

export function startChallenge(profile, now) {
  if (!canChallenge(profile, now)) return false;
  profile.village.construction.challenged = true;
  return true;
}

// Sfida vinta: il cantiere ancora aperto perde VILLAGE.challenge.timeShare del tempo che resta. Restituisce i
// millisecondi tolti (0 se nel frattempo il cantiere è finito)
export function winChallenge(profile, now) {
  settle(profile, now);
  const left = timeLeft(profile, now);
  const saved = left * VILLAGE.challenge.timeShare;
  if (saved > 0) profile.village.construction.endsAt -= saved;
  return saved;
}

// Cosa il villaggio dà a ogni battaglia con gli edifici a quei livelli (levels): soldati in più (caserma) e armi
// migliori (fucina)
export function villageBonus({ barracks, forge }) {
  const forgeData = VILLAGE.buildings.forge;
  return {
    soldiers: barracks === 0 ? 0 : VILLAGE.buildings.barracks.soldiers[barracks - 1],
    weapons: {
      damage: forge === 0 ? 0 : forgeData.damage[forge - 1],
      fireRate: forge === 0 ? 0 : forgeData.fireRate[forge - 1],
      autoAim: forge >= forgeData.autoAimLevel,
    },
  };
}

// Il prossimo obiettivo: senza cantiere aperto, l'edificio più indietro (a pari livello il primo di
// VILLAGE.buildings), con quanto manca per pagarlo (missing); null quando sono tutti al massimo o c'è un cantiere
export function nextGoal(profile) {
  if (profile.village.construction !== null) return null;
  const { levels } = profile.village;
  const open = Object.keys(VILLAGE.buildings).filter((id) => upgradeCost(profile, id) !== null);
  if (open.length === 0) return null;
  const id = open.reduce((best, other) => (levels[other] < levels[best] ? other : best));
  const cost = upgradeCost(profile, id);
  const { materials, scrap } = profile.resources;
  const missing = { materials: Math.max(0, cost.materials - materials), scrap: Math.max(0, cost.scrap - scrap) };
  return { building: id, level: levels[id] + 1, missing };
}

// Razioni l'ora e tetto della fattoria al suo livello (0 e 0 se non c'è)
export function farmOutput(level) {
  const { rationsPerHour, storage } = VILLAGE.buildings.farm;
  return level === 0 ? { perHour: 0, storage: 0 } : { perHour: rationsPerHour[level - 1], storage: storage[level - 1] };
}

// La fattoria produce da fin dove era arrivata (farm.since) fino a now, al massimo fino al suo tetto
function produce(village, now) {
  const { farm } = village;
  if (now <= farm.since) return;
  const { perHour, storage } = farmOutput(village.levels.farm);
  farm.stored = Math.min(storage, farm.stored + perHour * msToHours(now - farm.since));
  farm.since = now;
}

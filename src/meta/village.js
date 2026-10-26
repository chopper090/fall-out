import { hoursToMs, minutesToMs, msToHours } from '../core/time.js';
import { VILLAGE } from '../data/village.js';
import { conqueredAreas, roadTileAt } from './road.js';
import { WORLD_CELLS, cellsOf, inTerritory, overlaps, villageRect } from './world.js';

// Villaggio del giocatore, nel profilo (meta/profile.js): livello e posto di ogni edificio, la costruzione in corso e
// le razioni della fattoria in attesa (numeri in data/village.js). Il tempo è quello vero (now, in millisecondi, da
// core/clock.js): settle porta il villaggio al momento now, anche dopo ore ad app chiusa. L'orologio del telefono che
// va avanti si accetta (il gioco è offline e non c'è niente da comprare); quello che torna indietro lo sistema
// clampFuture

// Il villaggio al momento now: la costruzione finita entra nel suo edificio, la fattoria produce fino al suo tetto
// (con il livello di prima fino a quando un suo miglioramento finisce)
export function settle(profile, now) {
  const { village } = profile;
  clampFuture(profile, now);
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

// Apre il cantiere per il prossimo livello dell'edificio id, già messo al suo posto, pagando: finisce dopo i suoi
// minuti. Dice se è partito
export function startUpgrade(profile, id, now) {
  if (profile.village.positions[id] === null || !canUpgrade(profile, id)) return false;
  const cost = upgradeCost(profile, id);
  profile.resources.materials -= cost.materials;
  profile.resources.scrap -= cost.scrap;
  profile.village.construction = { building: id, endsAt: now + minutesToMs(cost.minutes), challenged: false };
  return true;
}

// Le celle dell'edificio id con l'angolo nord nella cella cell
export function footprint(id, { col, row }) {
  const [cols, rows] = VILLAGE.buildings[id].size;
  return { col, row, cols, rows };
}

// L'edificio id ci sta con l'angolo nord in cell: tutto nel territorio (con conquered aree conquistate), non sulla
// strada (che comincia davanti alla porta) e senza toccare gli altri edifici messi (lui escluso, per spostarlo).
// positions: i posti degli edifici, come nel profilo
export function canPlace(positions, id, cell, conquered) {
  const rect = footprint(id, cell);
  const onRoad = cellsOf(rect).some(({ col, row }) => roadTileAt(col, row) !== null);
  if (!inTerritory(rect, conquered) || onRoad) return false;
  const others = Object.entries(positions).filter(([other, at]) => other !== id && at !== null);
  return others.every(([other, at]) => !overlaps(rect, footprint(other, at)));
}

// Il posto nel territorio (con conquered aree conquistate) per l'edificio id con il centro più vicino al punto near
// (in celle, con le frazioni; di partenza il centro del villaggio), a pari distanza il primo per riga e colonna; null
// se non c'è posto
export function freeSpot(positions, id, conquered, near = null) {
  const area = villageRect();
  const [cols, rows] = VILLAGE.buildings[id].size;
  const target = near ?? { col: area.col + area.cols / 2, row: area.row + area.rows / 2 };
  let best = null;
  let bestDistance = Infinity;
  for (let row = 0; row <= WORLD_CELLS - rows; row++) {
    for (let col = 0; col <= WORLD_CELLS - cols; col++) {
      const distance = (col + cols / 2 - target.col) ** 2 + (row + rows / 2 - target.row) ** 2;
      if (distance < bestDistance && canPlace(positions, id, { col, row }, conquered)) {
        best = { col, row };
        bestDistance = distance;
      }
    }
  }
  return best;
}

// Il primo livello dell'edificio id, non ancora messo, con l'angolo nord in cell: il posto deve andare bene e il
// cantiere deve poter partire. Dice se è partito
export function placeBuilding(profile, id, cell, now) {
  const { positions } = profile.village;
  const conquered = conqueredAreas(profile.road);
  if (positions[id] !== null || !canPlace(positions, id, cell, conquered) || !canUpgrade(profile, id)) return false;
  positions[id] = { col: cell.col, row: cell.row };
  return startUpgrade(profile, id, now);
}

// Sposta l'edificio id, già messo, con l'angolo nord in cell; non costa niente. Dice se si è spostato
export function moveBuilding(profile, id, cell) {
  const { positions } = profile.village;
  if (positions[id] === null || !canPlace(positions, id, cell, conqueredAreas(profile.road))) return false;
  positions[id] = { col: cell.col, row: cell.row };
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

// Millisecondi finché la fattoria non ha count razioni intere in più di adesso (di partenza una); null senza fattoria o
// se il suo tetto non ci arriva
export function nextRationIn(profile, count = 1) {
  const { levels, farm } = profile.village;
  const { perHour, storage } = farmOutput(levels.farm);
  const target = Math.floor(farm.stored) + count;
  if (perHour === 0 || target > storage) return null;
  return hoursToMs((target - farm.stored) / perHour);
}

// Razioni l'ora e tetto della fattoria al suo livello (0 e 0 se non c'è)
export function farmOutput(level) {
  const { rationsPerHour, storage } = VILLAGE.buildings.farm;
  return level === 0 ? { perHour: 0, storage: 0 } : { perHour: rationsPerHour[level - 1], storage: storage[level - 1] };
}

// L'orologio del telefono tornato indietro lascia nel futuro i tempi del villaggio. Un salto corto, meno di quanto la
// fattoria ci mette a riempirsi, la fattoria lo aspetta (niente razioni due volte); con uno più lungo starebbe ferma
// per ore, e riprende da adesso (al massimo si riempie una volta in più). Il cantiere non dura mai più del suo livello
// intero: se la fine è più lontana, riparte da adesso con tutti i suoi minuti
function clampFuture(profile, now) {
  const { farm, levels, construction: job } = profile.village;
  if (farm.since - now > fillMs(levels.farm)) farm.since = now;
  if (job === null) return;
  const full = minutesToMs(upgradeCost(profile, job.building).minutes);
  if (job.endsAt - now > full) job.endsAt = now + full;
}

// Millisecondi per riempire la fattoria vuota al livello level (0 senza fattoria)
function fillMs(level) {
  const { perHour, storage } = farmOutput(level);
  return perHour === 0 ? 0 : hoursToMs(storage / perHour);
}

// La fattoria produce da fin dove era arrivata (farm.since) fino a now, al massimo fino al suo tetto
function produce(village, now) {
  const { farm } = village;
  if (now <= farm.since) return;
  const { perHour, storage } = farmOutput(village.levels.farm);
  farm.stored = Math.min(storage, farm.stored + perHour * msToHours(now - farm.since));
  farm.since = now;
}

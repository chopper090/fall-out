import { hoursToMs, minutesToMs, msToHours } from '../core/time.js';
import { VILLAGE } from '../data/village.js';
import { armyCapacity } from './barracks.js';
import { conqueredAreas, rationsNeeded, roadTileAt } from './road.js';
import { WORLD_CELLS, cellsOf, inTerritory, overlaps, villageRect } from './world.js';

// Villaggio del giocatore, nel profilo (meta/profile.js): livello e posto di ogni edificio, i cantieri aperti (fino ai
// posti cantiere, builders, uno per edificio), le razioni della fattoria in attesa e da quando il centro città conta
// quelle che dà quando non bastano (relief; numeri in data/village.js). Il centro città tiene sotto il suo livello
// tutti gli altri edifici e sale solo con quelli che chiede (lockOf). Il tempo è quello vero (now, in millisecondi, da
// core/clock.js): settle porta il villaggio al momento now, anche dopo ore ad app chiusa. L'orologio del telefono che
// va avanti si accetta (il gioco è offline e non c'è niente da comprare); quello che torna indietro lo sistema
// clampFuture

// Il villaggio al momento now: ogni cantiere finito entra nel suo edificio, uno dopo l'altro in ordine di fine, la
// fattoria produce fino al suo tetto (con il livello di prima fino a quando un suo miglioramento finisce) e il centro
// città dà le razioni che mancano (relieve). Dice se ha cambiato qualcosa oltre alle razioni prodotte, che da un
// salvataggio di prima si rifanno uguali: un cantiere finito, la valvola del centro (che comincia a contare, smette o
// dà razioni), o i tempi rimessi a posto
export function settle(profile, now) {
  const { village } = profile;
  const clamped = clampFuture(profile, now);
  const finished = village.sites.filter((site) => site.endsAt <= now).sort((a, b) => a.endsAt - b.endsAt);
  for (const site of finished) {
    produce(village, site.endsAt);
    village.levels[site.building] += 1;
  }
  village.sites = village.sites.filter((site) => site.endsAt > now);
  produce(village, now);
  const relieved = relieve(profile, now);
  return clamped || finished.length > 0 || relieved;
}

// Le razioni pronte, intere, passano tra le risorse
export function collectRations(profile) {
  const { farm } = profile.village;
  const whole = Math.floor(farm.stored);
  profile.resources.rations += whole;
  farm.stored -= whole;
  return whole;
}

// Costo e durata del prossimo livello dell'edificio id: le scorte da pagare (resources, per tipo) e i minuti; null al
// livello massimo
export function upgradeCost(profile, id) {
  const building = VILLAGE.buildings[id];
  const level = profile.village.levels[id];
  if (level >= building.maxLevel) return null;
  return { resources: building.costs[level], minutes: building.minutes[level] };
}

// I posti cantiere: VILLAGE.builders, più gli operai del Capanno dei mastri al suo livello
export function builders(profile) {
  const level = profile.village.levels.lodge;
  return VILLAGE.builders + (level === 0 ? 0 : VILLAGE.buildings.lodge.workers[level - 1]);
}

// I posti cantiere ancora liberi
export function freeSlots(profile) {
  return Math.max(0, builders(profile) - profile.village.sites.length);
}

// Cosa tiene fermo il prossimo livello dell'edificio id, oltre alle scorte e ai posti cantiere: per il centro città
// gli edifici della sua tabella (requires) ancora sotto il livello che chiede (buildings: { id: livello }); per gli
// altri il centro, che deve essere almeno al livello nuovo, e per costruirli almeno a centerLevel (center: il livello
// che serve). null se niente lo tiene fermo, anche al livello massimo
export function lockOf(profile, id) {
  const building = VILLAGE.buildings[id];
  const { levels } = profile.village;
  const next = levels[id] + 1;
  if (next > building.maxLevel) return null;
  if (id === 'center') {
    const below = Object.entries(building.requires[next - 1]).filter(([other, level]) => levels[other] < level);
    return below.length === 0 ? null : { buildings: Object.fromEntries(below) };
  }
  const center = Math.max(next, building.centerLevel ?? 0);
  return levels.center >= center ? null : { center };
}

// Il cantiere aperto dell'edificio id, o null
export function siteOf(profile, id) {
  return profile.village.sites.find((site) => site.building === id) ?? null;
}

// Il cantiere che finisce per primo (a pari fine il primo aperto), o null se non ce ne sono
export function firstSite(profile) {
  const earlier = (first, site) => (first === null || site.endsAt < first.endsAt ? site : first);
  return profile.village.sites.reduce(earlier, null);
}

// Si può migliorare l'edificio id: un posto cantiere libero, nessun cantiere già aperto per lui, non al massimo, niente
// che lo tiene fermo (lockOf), risorse che bastano
export function canUpgrade(profile, id) {
  const cost = upgradeCost(profile, id);
  const { resources } = profile;
  if (freeSlots(profile) === 0 || siteOf(profile, id) !== null || cost === null) return false;
  if (lockOf(profile, id) !== null) return false;
  return Object.entries(cost.resources).every(([kind, amount]) => resources[kind] >= amount);
}

// Apre il cantiere per il prossimo livello dell'edificio id, già messo al suo posto, pagando: finisce dopo i suoi
// minuti. Dice se è partito
export function startUpgrade(profile, id, now) {
  if (profile.village.positions[id] === null || !canUpgrade(profile, id)) return false;
  const cost = upgradeCost(profile, id);
  for (const [kind, amount] of Object.entries(cost.resources)) profile.resources[kind] -= amount;
  profile.village.sites.push({ building: id, endsAt: now + minutesToMs(cost.minutes), challenged: false });
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

// Millisecondi che mancano alla fine del cantiere dell'edificio id, 0 se non ce n'è uno
export function timeLeft(profile, id, now) {
  const site = siteOf(profile, id);
  return site === null ? 0 : Math.max(0, site.endsAt - now);
}

// Una gemma toglie VILLAGE.gemMinutes al cantiere dell'edificio id, e solo a lui. Dice se è stata usata
export function useGem(profile, id, now) {
  settle(profile, now);
  const site = siteOf(profile, id);
  if (site === null || profile.resources.gems <= 0) return false;
  profile.resources.gems -= 1;
  site.endsAt -= minutesToMs(VILLAGE.gemMinutes);
  settle(profile, now);
  return true;
}

// La sfida si può tentare una volta per cantiere, sul cantiere dell'edificio id, se mancano almeno
// VILLAGE.challenge.minMinutes: partendo la si spende, anche se poi si lascia a metà
export function canChallenge(profile, id, now) {
  const site = siteOf(profile, id);
  return site !== null && !site.challenged && timeLeft(profile, id, now) >= minutesToMs(VILLAGE.challenge.minMinutes);
}

export function startChallenge(profile, id, now) {
  if (!canChallenge(profile, id, now)) return false;
  siteOf(profile, id).challenged = true;
  return true;
}

// Sfida vinta: il cantiere dell'edificio id, se è ancora aperto, perde VILLAGE.challenge.timeShare del tempo che
// resta; gli altri no. Restituisce i millisecondi tolti (0 se nel frattempo il cantiere è finito)
export function winChallenge(profile, id, now) {
  settle(profile, now);
  const left = timeLeft(profile, id, now);
  const saved = left * VILLAGE.challenge.timeShare;
  if (saved > 0) siteOf(profile, id).endsAt -= saved;
  return saved;
}

// Cosa il villaggio dà a ogni battaglia con gli edifici a quei livelli (levels): soldati in più (caserma) e armi
// migliori (fucina)
export function villageBonus({ barracks, forge }) {
  const forgeData = VILLAGE.buildings.forge;
  return {
    soldiers: armyCapacity(barracks),
    weapons: {
      damage: forge === 0 ? 0 : forgeData.damage[forge - 1],
      fireRate: forge === 0 ? 0 : forgeData.fireRate[forge - 1],
      autoAim: forge >= forgeData.autoAimLevel,
    },
  };
}

// Il prossimo obiettivo, per un posto cantiere libero: tra gli edifici senza cantiere aperto e che niente tiene fermi
// (lockOf) quello più indietro (a pari livello il primo di VILLAGE.buildings), con quanto manca per pagarlo (missing,
// per tipo); null senza posti liberi o quando gli altri sono tutti al massimo o fermi
export function nextGoal(profile) {
  if (freeSlots(profile) === 0) return null;
  const { levels } = profile.village;
  const idle = (id) => upgradeCost(profile, id) !== null && siteOf(profile, id) === null && !lockOf(profile, id);
  const open = Object.keys(VILLAGE.buildings).filter(idle);
  if (open.length === 0) return null;
  const id = open.reduce((best, other) => (levels[other] < levels[best] ? other : best));
  const { resources } = profile;
  const short = ([kind, amount]) => [kind, Math.max(0, amount - resources[kind])];
  const missing = Object.fromEntries(Object.entries(upgradeCost(profile, id).resources).map(short));
  return { building: id, level: levels[id] + 1, missing };
}

// Millisecondi alla prossima razione del centro città all'ora now (relieve), null se le razioni bastano
export function reliefIn(profile, now) {
  if (rationsShort(profile) <= 0) return null;
  const step = minutesToMs(VILLAGE.buildings.center.reliefMinutes);
  const { since } = profile.village.relief;
  return since === null ? step : Math.max(0, since + step - now);
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
// per ore, e riprende da adesso (al massimo si riempie una volta in più). Un cantiere non dura mai più del suo livello
// intero: se la fine è più lontana, riparte da adesso con tutti i suoi minuti. Dice se ha rimesso a posto qualcosa
function clampFuture(profile, now) {
  const { farm, levels, sites } = profile.village;
  const farmLate = farm.since - now > fillMs(levels.farm);
  if (farmLate) farm.since = now;
  let siteLate = false;
  for (const site of sites) {
    const full = minutesToMs(upgradeCost(profile, site.building).minutes);
    if (site.endsAt - now <= full) continue;
    site.endsAt = now + full;
    siteLate = true;
  }
  return farmLate || siteLate;
}

// Millisecondi per riempire la fattoria vuota al livello level (0 senza fattoria)
function fillMs(level) {
  const { perHour, storage } = farmOutput(level);
  return perHour === 0 ? 0 : hoursToMs(storage / perHour);
}

// Quante razioni mancano per la prossima battaglia della strada (meta/road.js rationsNeeded), contando anche quelle
// pronte nella fattoria; 0 o meno se bastano
function rationsShort(profile) {
  const { village, resources } = profile;
  return rationsNeeded(profile) - resources.rations - Math.floor(village.farm.stored);
}

// La valvola del centro città: da quando le razioni non bastano (relief.since; null mentre bastano) ne dà una ogni
// reliefMinutes di tempo vero, fino a bastare, e poi smette di contare. Il primo momento in cui mancano comincia a
// contare da lì (anche con l'orologio tornato indietro). Dice se ha cambiato qualcosa (anche solo il conto)
function relieve(profile, now) {
  const { relief } = profile.village;
  const before = relief.since;
  const short = rationsShort(profile);
  if (short <= 0) relief.since = null;
  else if (relief.since === null || relief.since > now) relief.since = now;
  if (relief.since === null || relief.since === now) return relief.since !== before;
  const step = minutesToMs(VILLAGE.buildings.center.reliefMinutes);
  const given = Math.min(short, Math.floor((now - relief.since) / step));
  profile.resources.rations += given;
  relief.since = given === short ? null : relief.since + given * step;
  return relief.since !== before;
}

// La fattoria produce da fin dove era arrivata (farm.since) fino a now, al massimo fino al suo tetto
function produce(village, now) {
  const { farm } = village;
  if (now <= farm.since) return;
  const { perHour, storage } = farmOutput(village.levels.farm);
  farm.stored = Math.min(storage, farm.stored + perHour * msToHours(now - farm.since));
  farm.since = now;
}

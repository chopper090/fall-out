import { ARMY, CHESTS, CONTROLS, FORMATION, HERO, LANES, PLATOONS } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { perFrame } from '../core/time.js';
import { ENEMY_TYPES } from '../data/enemies.js';
import { STARTING_LOADOUT } from '../data/loadout.js';
import { ELITE, WEAPONS } from '../data/units.js';
import { LIMITS } from '../data/waves.js';
import { createFormation } from './formation.js';
import { soldiersFrom } from './gates.js';

// Esercito: gli eroi dello schieramento (data/heroes.js), guidati insieme dallo swipe e ognuno nel suo posto
// attorno al punto guidato (x), e i plotoni di soldati che li seguono con un leggero ritardo.
// size conta tutti, capo compreso, senza tetto. In campo ce ne sono al massimo maxSize, il tetto del livello,
// nei posti dei plotoni: gli altri (reserves) sono riserve che prendono subito il posto di chi muore e alzano
// il danno di tutti i colpi di reserveBonus (ARMY.reserves). Senza riserve i superstiti stringono le file:
// la folla resta sempre raccolta attorno agli eroi, nei primi posti dei plotoni.
// I soldati normali arrivano passando sotto i cancelli, le élite dagli scrigni (elite: quante ce ne sono in campo).
// Ogni SOLDIER_HIT (un colpo nemico, uno schiacciamento o una delle vite che toglie uno scontro) toglie una vita al
// soldato che prende: un soldato normale ne ha una, un'élite ELITE.lives; all'ultima muore (SOLDIER_KILLED);
// ogni eroe perde la vita che gli toglie chi lo colpisce (HERO_HIT porta l'eroe e il danno) e a zero muore:
// sparisce da heroes (leader resta il capo, vivo finché dura la missione). I cancelli −N tolgono soldati (mai gli
// eroi). Gli scrigni aperti ridanno vita agli eroi o alzano fino a fine livello
// il danno (damageScale, 1 = normale) o la cadenza (fireRateScale) di tutti i colpi, oppure danno un'arma.
// Ogni posto della folla ha la sua arma, all'inizio quella dell'eroe più vicino: la usa il soldato normale che ci
// sta (weapon), anche chi ci arriva dopo; le élite hanno sempre la loro (ELITE.weapon) ed entrano nei primi posti, i
// più vicini agli eroi. Uno scrigno d'arma la cambia ai posti davanti a lui quando si apre: la parte
// di folla larga CHESTS.armWidth centrata sullo scrigno, metà esercito se ce n'è davanti metà; se la folla si è già
// spostata, la sua parte più vicina allo scrigno.
// Gli eroi arrivano fino al centro delle corsie laterali e la folla resta dentro la strada: contro il bordo si
// rimodella attorno a loro come una goccia, nei posti ancora aperti (slots, FORMATION)
// loadout (data/loadout.js, STARTING_LOADOUT se non c'è): chi scende in campo e in quale posto con i suoi numeri, i
// soldati in più alla partenza e le migliorie delle armi dei soldati (weapons, le usa systems/combat.js)
export function createArmy(bus, rng, { startX, laneCenters, loadout = STARTING_LOADOUT }) {
  // A ogni partita ogni eroe si sposta a caso dal suo posto, avanti o indietro, così gli eroi non stanno in riga
  const heroes = loadout.heroes.map(({ hero: data, slot }) => {
    const { dx } = HERO.slots[slot];
    const dz = HERO.slots[slot].dz + (rng.float() * 2 - 1) * HERO.slotJitter;
    return { ...data, dx, dz, x: startX + dx, z: dz, size: HERO.size, hp: data.maxHp, phase: rng.float() };
  });
  const { slots, platoonCount } = createFormation(rng, heroes);
  // Il posto prende l'arma dell'eroe più vicino e la sua crescita (growth, meta/heroes.js; 1 per gli eroi di base),
  // che resta del posto: i soldati che ci stanno sparano più forte quando lui cresce
  for (const slot of slots) {
    const hero = nearestHero(heroes, slot);
    slot.weapon = hero.weapon.name;
    slot.growth = hero.growth ?? 1;
  }
  const army = {
    x: startX,
    snapTarget: null,
    size: ARMY.startSize + loadout.soldiers,
    maxSize: LIMITS.maxArmy,
    reserves: 0,
    reserveBonus: 0,
    elites: 0,
    damageScale: 1,
    fireRateScale: 1,
    weapons: loadout.weapons,
    heroes,
    leader: heroes.find((hero) => hero.leader),
    soldiers: [],
    slots,
    platoons: Array.from({ length: platoonCount }, () => ({ x: startX })),
    // Per cercare le catene di posti: il numero dell'ultima ricerca, la coda e la catena trovata
    search: { stamp: 0, queue: [], chain: [] },
    laneCenters,
    left: HERO.size / 2,
    right: HERO.size / 2,
    front: HERO.size / 2,
    back: -HERO.size / 2,
    heroLeft: HERO.size / 2,
    heroRight: HERO.size / 2,
    heroFront: HERO.size / 2,
    minX: laneCenters[0],
    maxX: laneCenters[laneCenters.length - 1],
    snapPoints: laneCenters,
  };
  // phase: frazione dell'intervallo di tiro che manca al prossimo colpo. Parte a caso, così ognuno
  // spara con il suo ritmo. offsetX e offsetZ: distanza dal suo posto, che si riduce mentre ci arriva
  const pool = createPool(
    () => ({
      x: 0,
      z: 0,
      size: PLATOONS.soldierSize,
      phase: 0,
      slot: null,
      weapon: null,
      elite: false,
      lives: 0,
      offsetX: 0,
      offsetZ: 0,
    }),
    LIMITS.maxArmy - 1,
  );

  // Chi arriva prende il primo posto aperto libero, nell'ordine dei plotoni
  function fill() {
    const wanted = Math.min(army.size, army.maxSize) - 1;
    for (const slot of slots) {
      if (army.soldiers.length >= wanted) break;
      if (!slot.open || slot.soldier) continue;
      const soldier = pool.acquire();
      soldier.slot = slot;
      soldier.z = slot.dz;
      soldier.x = insideRoad(army.platoons[slot.platoon].x + slot.dx);
      soldier.phase = rng.float();
      soldier.weapon = slot.weapon;
      soldier.size = PLATOONS.soldierSize;
      soldier.elite = false;
      soldier.lives = 1;
      soldier.offsetX = 0;
      soldier.offsetZ = 0;
      slot.soldier = soldier;
      army.soldiers.push(soldier);
    }
  }

  function remove(soldier) {
    if (soldier.elite) army.elites -= 1;
    soldier.slot.soldier = null;
    soldier.slot = null;
    army.soldiers.splice(army.soldiers.indexOf(soldier), 1);
    pool.release(soldier);
  }

  // Un'élite in più prende il primo posto aperto della folla che non ha già un'élite: il soldato normale che c'era
  // si sposta nel primo posto libero, o torna tra le riserve se la folla è piena (o non ci sono posti liberi); con la
  // folla piena e tutta d'élite resta lei tra le riserve
  function addElite() {
    army.size += 1;
    const full = army.soldiers.length >= army.maxSize - 1;
    const slot = slots.find((candidate) => candidate.open && !candidate.soldier?.elite);
    if (slot === undefined || (slot.soldier === null && full)) return;
    if (slot.soldier !== null) {
      const free = firstFree(slots);
      if (full || free === undefined) remove(slot.soldier);
      else moveTo(army, slot.soldier, free, false);
    }
    const soldier = pool.acquire();
    soldier.slot = slot;
    soldier.z = slot.dz;
    soldier.x = insideRoad(army.platoons[slot.platoon].x + slot.dx);
    soldier.phase = rng.float();
    soldier.weapon = ELITE.weapon;
    soldier.size = ELITE.size;
    soldier.elite = true;
    soldier.lives = ELITE.lives;
    soldier.offsetX = 0;
    soldier.offsetZ = 0;
    slot.soldier = soldier;
    army.soldiers.push(soldier);
    army.elites += 1;
  }

  // Muore un soldato: lo prende il primo posto libero di una riserva, se c'è, poi le file si stringono
  function kill(soldier) {
    bus.emit(EVENTS.SOLDIER_KILLED, { soldier, x: soldier.x, z: soldier.z });
    remove(soldier);
    army.size -= 1;
    fill();
    settle(army, false);
    updateShape(army);
    updateReserves(army);
  }

  // Per ogni posto della folla: fin dove arrivano di lato gli eroi alla sua stessa altezza lungo la strada che ha
  // verso il centro, dalla sua parte (besideReach, null se non ce ne sono): un posto a sinistra guarda solo gli eroi
  // alla sua destra, e al contrario. Cambia solo quando muore un eroe
  function markBeside() {
    const half = HERO.size / 2;
    const halfSoldier = PLATOONS.soldierSize / 2;
    const band = half + halfSoldier + FORMATION.heroGap;
    for (const slot of slots) {
      let reach = null;
      for (const hero of army.heroes) {
        if (Math.abs(slot.dz - hero.dz) >= band || (slot.dx < 0 ? slot.dx > hero.dx : slot.dx < hero.dx)) continue;
        const edge = slot.dx < 0 ? halfSoldier - (hero.dx - half) : halfSoldier + hero.dx + half;
        reach = reach === null ? edge : Math.max(reach, edge);
      }
      slot.besideReach = reach;
    }
  }

  // Prima i limiti degli eroi e i posti aperti dove parte l'esercito, poi i soldati
  markBeside();
  updateShape(army);
  army.x = clampX(army, army.x);
  updateOpen(army);
  fill();
  updateShape(army);
  updateReserves(army);
  for (const hero of army.heroes) hero.x = army.x + hero.dx;
  for (const platoon of army.platoons) platoon.x = army.x;
  for (const soldier of army.soldiers) soldier.x = insideRoad(army.x + soldier.slot.dx);

  // Più soldati, o meno: prima le riserve, poi gli ultimi arrivati, le élite per ultime; gli eroi restano sempre
  function changeSize(delta) {
    if (delta >= 0) {
      army.size += delta;
      fill();
      updateShape(army);
      updateReserves(army);
      return;
    }
    const losses = Math.min(-delta, army.size - 1);
    const fromReserves = Math.min(losses, army.size - 1 - army.soldiers.length);
    army.size -= fromReserves;
    updateReserves(army);
    const order = [...army.soldiers].reverse().sort((a, b) => Number(a.elite) - Number(b.elite));
    for (const soldier of order.slice(0, losses - fromReserves)) kill(soldier);
  }

  // I posti davanti allo scrigno, anche solo con un bordo, pieni o ancora vuoti, prendono la sua arma (le élite
  // tengono la loro). Il centro della parte armata sta dentro la folla
  function arm(chest) {
    const reach = CHESTS.armWidth / 2 + PLATOONS.soldierSize / 2;
    const center = Math.min(army.x + army.right, Math.max(army.x - army.left, chest.x));
    for (const slot of slots) {
      if (Math.abs(army.x + slot.dx - center) >= reach) continue;
      slot.weapon = chest.kind.weapon;
      if (slot.soldier && !slot.soldier.elite) slot.soldier.weapon = slot.weapon;
    }
  }

  // Ogni eroe ancora in campo riprende amount di vita, fino alla sua vita piena
  function heal(amount) {
    for (const hero of army.heroes) hero.hp = Math.min(hero.maxHp, hero.hp + amount);
  }

  bus.on(EVENTS.GATE_PASSED, (gate) => changeSize(soldiersFrom(gate, army.size)));

  bus.on(EVENTS.CHEST_OPENED, (chest) => {
    const { kind } = chest;
    if (kind.effect === 'damage') army.damageScale += kind.amount;
    else if (kind.effect === 'fireRate') army.fireRateScale += kind.amount;
    else if (kind.effect === 'heal') heal(kind.amount);
    else if (kind.effect === 'weapon') arm(chest);
    else if (kind.effect === 'elite') {
      for (let n = 0; n < kind.count; n++) addElite();
      updateShape(army);
      updateReserves(army);
    }
  });

  // Un soldato già morto (posto vuoto o dato a un altro) non conta due volte; all'ultima vita muore
  bus.on(EVENTS.SOLDIER_HIT, ({ soldier }) => {
    if (soldier.slot === null || soldier.slot.soldier !== soldier) return;
    soldier.lives -= 1;
    if (soldier.lives <= 0) kill(soldier);
  });

  // Un eroe già morto non conta due volte
  bus.on(EVENTS.HERO_HIT, ({ hero, damage }) => {
    if (hero.hp === 0 || !army.heroes.includes(hero)) return;
    hero.hp = Math.max(0, hero.hp - damage);
    bus.emit(EVENTS.HERO_DAMAGED, hero);
    if (hero.hp > 0) return;
    army.heroes.splice(army.heroes.indexOf(hero), 1);
    markBeside();
    updateShape(army);
    bus.emit(EVENTS.HERO_KILLED, hero);
  });

  bus.on(EVENTS.STEER, (dx) => {
    army.snapTarget = null;
    army.x = clampX(army, army.x + dx * CONTROLS.sensitivity);
  });

  bus.on(EVENTS.STEER_END, () => {
    if (!CONTROLS.snapEnabled) return;
    const nearest = findNearest(army.snapPoints, army.x);
    if (Math.abs(nearest - army.x) <= CONTROLS.snapRadius) army.snapTarget = nearest;
  });

  return army;
}

// Aggancio, poi la folla si rimodella contro il bordo, gli eroi seguono il punto guidato e i plotoni lo inseguono:
// ognuno si avvicina alla sua posizione con un ritardo di followMs. Chi ha il posto al fianco degli eroi della sua
// fila non gli entra dentro: i soldati di ogni fianco si fermano tutti insieme quando il più vicino tocca un eroe,
// così restano distanziati. Chi ha cambiato posto ci arriva scivolando: prima avanti o indietro lungo la strada, poi
// di lato; mentre passa dall'altra parte degli eroi non viene fermato, gli scivola sopra.
// Un soldato che resterebbe fuori strada si ferma al bordo
export function updateArmy(army, deltaMs) {
  updateReserves(army);
  moveToSnap(army, deltaMs);
  if (reshape(army)) updateShape(army);
  for (const hero of army.heroes) hero.x = army.x + hero.dx;
  const blend = PLATOONS.followMs > 0 ? 1 - Math.exp(-deltaMs / PLATOONS.followMs) : 1;
  for (const platoon of army.platoons) platoon.x += (army.x - platoon.x) * blend;
  // Di quanto ogni fianco può avvicinarsi agli eroi: lo spazio libero del suo soldato più vicino a un eroe
  let roomLeft = Infinity;
  let roomRight = Infinity;
  for (const { slot } of army.soldiers) {
    if (slot.besideReach === null) continue;
    if (slot.dx < 0) roomLeft = Math.min(roomLeft, -slot.dx - slot.besideReach);
    else roomRight = Math.min(roomRight, slot.dx - slot.besideReach);
  }
  const { sideMs, depthMs } = PLATOONS.regroup;
  const settleX = sideMs > 0 ? Math.exp(-deltaMs / sideMs) : 0;
  const settleZ = depthMs > 0 ? Math.exp(-deltaMs / depthMs) : 0;
  for (const soldier of army.soldiers) {
    const { slot } = soldier;
    soldier.offsetX *= settleX;
    soldier.offsetZ *= settleZ;
    let x = army.platoons[slot.platoon].x + slot.dx + soldier.offsetX;
    const onItsSide = slot.besideReach !== null && Math.sign(slot.dx) * (slot.dx + soldier.offsetX) >= slot.besideReach;
    if (onItsSide) {
      x = slot.dx < 0 ? Math.min(x, army.x + slot.dx + roomLeft) : Math.max(x, army.x + slot.dx - roomRight);
    }
    soldier.x = insideRoad(x);
    soldier.z = slot.dz + soldier.offsetZ;
  }
}

// Ingombro della folla com'è adesso (anche contro il bordo) ai due lati degli eroi, davanti e dietro, limiti di
// movimento e punti di aggancio. I limiti li danno solo gli eroi, che arrivano fino al bordo della strada: la folla
// si rimodella attorno a loro. A metà tra due corsie ci si aggancia solo se da lì qualche soldato colpisce i nemici
// normali di entrambe: lì la folla non tocca il bordo e sta nei primi posti, tanti quanti i soldati.
// Ingombro dei soli eroi (heroLeft e heroRight di lato, dal bordo del primo a quello dell'ultimo, e heroFront davanti):
// dove prendono i cancelli (systems/gates.js)
function updateShape(army) {
  const { heroes, soldiers, slots, laneCenters } = army;
  const halfSoldier = PLATOONS.soldierSize / 2;
  const halfGap = (laneCenters[1] - laneCenters[0]) / 2;
  // Portata di lato dei colpi del fucile, l'arma di riferimento per l'aggancio
  const hitReach = (WEAPONS.rifle.size + ENEMY_TYPES.grunt.size) / 2;
  army.heroLeft = -Infinity;
  army.heroRight = -Infinity;
  army.heroFront = -Infinity;
  army.back = 0;
  for (const hero of heroes) {
    army.heroLeft = Math.max(army.heroLeft, HERO.size / 2 - hero.dx);
    army.heroRight = Math.max(army.heroRight, HERO.size / 2 + hero.dx);
    army.heroFront = Math.max(army.heroFront, HERO.size / 2 + hero.dz);
    army.back = Math.min(army.back, hero.dz - HERO.size / 2);
  }
  const heroLeft = Math.max(0, army.heroLeft);
  const heroRight = Math.max(0, army.heroRight);
  army.front = Math.max(0, army.heroFront);
  army.left = heroLeft;
  army.right = heroRight;
  for (const { slot } of soldiers) {
    army.left = Math.max(army.left, halfSoldier - slot.dx);
    army.right = Math.max(army.right, halfSoldier + slot.dx);
    army.front = Math.max(army.front, halfSoldier + slot.dz);
    army.back = Math.min(army.back, slot.dz - halfSoldier);
  }
  // Fino al bordo della strada: i nemici entrano anche nella parte esterna delle corsie laterali
  army.minX = heroLeft;
  army.maxX = LANES.fieldWidth - heroRight;
  const reaching = slots.slice(0, soldiers.length).filter((slot) => Math.abs(Math.abs(slot.dx) - halfGap) < hitReach);
  const both = reaching.some((slot) => slot.dx < 0) && reaching.some((slot) => slot.dx > 0);
  const midpoints = laneCenters.slice(1).map((center, index) => (center + laneCenters[index]) / 2);
  const points = both ? [...laneCenters, ...midpoints] : laneCenters;
  army.snapPoints = [...new Set(points.map((x) => clampX(army, x)))].sort((a, b) => a - b);
  if (army.snapTarget !== null) army.snapTarget = clampX(army, army.snapTarget);
}

function clampX(army, x) {
  return Math.min(army.maxX, Math.max(army.minX, x));
}

// Contro il bordo della strada un posto si chiude quando il suo soldato ne starebbe fuori di più di
// FORMATION.squeeze (fino ad allora resta schiacciato contro il bordo) e si riapre quando ci sta tutto dentro.
// true se qualche posto è cambiato
function updateOpen(army) {
  const half = PLATOONS.soldierSize / 2;
  let changed = false;
  for (const slot of army.slots) {
    const x = army.x + slot.dx;
    const outside = Math.max(half - x, x - (LANES.fieldWidth - half));
    const open = slot.open ? outside <= FORMATION.squeeze : outside <= 0;
    if (open === slot.open) continue;
    slot.open = open;
    changed = true;
  }
  return changed;
}

// La folla si rimodella come una goccia attorno agli eroi, e ognuno si porta dietro la sua arma. true se è cambiato
// qualcosa
function reshape(army) {
  if (!updateOpen(army)) return false;
  settle(army, true);
  return true;
}

// La folla sta nei primi posti aperti, tanti quanti i soldati (dentro). Ogni posto libero dentro, dal più vicino agli
// eroi, si riempie a catena: ci scivola il soldato accanto, nel suo posto quello dopo, e così via fino a un soldato
// rimasto fuori (in un posto chiuso o più lontano), lungo la catena più corta. Ognuno si sposta di un posto: la folla
// scorre e nessuno la attraversa. Se solo posti occupati non ci arrivano (una fila stretta tra un eroe e il bordo),
// la catena passa anche per posti vuoti e chi c'è dopo li scavalca
function settle(army, carry) {
  const { slots, soldiers } = army;
  let boundary = 0;
  for (let open = 0; boundary < slots.length && open < soldiers.length; boundary++) {
    if (slots[boundary].open) open++;
  }
  const inside = (slot) => slot.open && slot.index < boundary;
  for (let index = 0; index < boundary; index++) {
    const hole = slots[index];
    if (!hole.open || hole.soldier !== null) continue;
    const chain = findChain(army, hole, inside, false) ?? findChain(army, hole, inside, true);
    let target = hole;
    for (const slot of chain) {
      if (slot === hole || slot.soldier === null) continue;
      moveTo(army, slot.soldier, target, carry);
      target = slot;
    }
  }
}

// Catena dal posto libero (hole) a un soldato di fuori, passando per posti dentro occupati, uno accanto all'altro, e
// con throughGaps anche per posti vuoti: ricerca in ampiezza, così è la più corta. Restituisce i posti dal libero a
// quello del soldato di fuori, o null. I posti sono tutti legati tra loro (systems/formation.js): passando anche per i
// vuoti la catena c'è sempre
function findChain(army, hole, inside, throughGaps) {
  const { search } = army;
  const { queue, chain } = search;
  search.stamp += 1;
  hole.searched = search.stamp;
  queue.length = 0;
  queue.push(hole);
  for (let head = 0; head < queue.length; head++) {
    for (const neighbor of queue[head].neighbors) {
      if (neighbor.searched === search.stamp || (neighbor.soldier === null && !throughGaps)) continue;
      neighbor.searched = search.stamp;
      neighbor.previous = queue[head];
      if (neighbor.soldier === null || inside(neighbor)) {
        queue.push(neighbor);
        continue;
      }
      chain.length = 0;
      for (let slot = neighbor; slot !== hole; slot = slot.previous) chain.push(slot);
      chain.push(hole);
      return chain.reverse();
    }
  }
  return null;
}

function firstFree(slots) {
  return slots.find((slot) => slot.open && slot.soldier === null);
}

// Il soldato cambia posto ma parte da dove si trova: ci arriva scivolando. Prende l'arma del nuovo posto, se non è
// un'élite; carry: se la folla si sta rimodellando, se la porta dietro (i due posti si scambiano le armi)
function moveTo(army, soldier, slot, carry) {
  const from = soldier.slot;
  if (carry && !soldier.elite) [from.weapon, slot.weapon] = [slot.weapon, from.weapon];
  from.soldier = null;
  soldier.slot = slot;
  slot.soldier = soldier;
  if (!soldier.elite) soldier.weapon = slot.weapon;
  soldier.offsetX = soldier.x - (army.platoons[slot.platoon].x + slot.dx);
  soldier.offsetZ = soldier.z - slot.dz;
}

function insideRoad(x) {
  const half = PLATOONS.soldierSize / 2;
  return Math.min(LANES.fieldWidth - half, Math.max(half, x));
}

function moveToSnap(army, deltaMs) {
  if (army.snapTarget === null) return;
  const step = perFrame(CONTROLS.snapSpeed, deltaMs);
  const distance = army.snapTarget - army.x;
  if (Math.abs(distance) <= step) {
    army.x = army.snapTarget;
    army.snapTarget = null;
  } else {
    army.x += Math.sign(distance) * step;
  }
}

function findNearest(values, x) {
  return values.reduce((best, value) => (Math.abs(value - x) < Math.abs(best - x) ? value : best));
}

// Riserve e loro danno in più: ogni halfCount riserve ne danno metà di quello che manca a maxBonus
function updateReserves(army) {
  const { maxBonus, halfCount } = ARMY.reserves;
  army.reserves = Math.max(0, army.size - army.maxSize);
  army.reserveBonus = maxBonus * (1 - 0.5 ** (army.reserves / halfCount));
}

// Quante volte il danno normale fanno tutti i colpi: gli scrigni (damageScale) per le riserve (reserveBonus)
export function damageMultiplier(army) {
  return army.damageScale * (1 + army.reserveBonus);
}

// L'eroe più vicino a un posto della folla
function nearestHero(heroes, { dx, dz }) {
  let best = heroes[0];
  let bestDistance = Infinity;
  for (const hero of heroes) {
    const distance = Math.hypot(hero.dx - dx, hero.dz - dz);
    if (distance < bestDistance) {
      best = hero;
      bestDistance = distance;
    }
  }
  return best;
}

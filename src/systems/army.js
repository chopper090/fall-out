import { ARMY, CONTROLS, FORMATION, GATES, HERO, LANES, PLATOONS } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { perFrame } from '../core/time.js';
import { ENEMY_TYPES } from '../data/enemies.js';
import { HEROES, LINEUP } from '../data/heroes.js';
import { WEAPONS } from '../data/units.js';
import { LIMITS } from '../data/waves.js';
import { createFormation } from './formation.js';
import { soldiersFrom } from './gates.js';

// Esercito: gli eroi dello schieramento (data/heroes.js), guidati insieme dallo swipe e ognuno nel suo posto
// attorno al punto guidato (x), e i plotoni di soldati che li seguono con un leggero ritardo.
// size conta tutti, capo compreso, senza tetto. In campo ce ne sono al massimo maxSize, il tetto del livello,
// nei posti dei plotoni: gli altri (reserves) sono riserve che prendono subito il posto di chi muore e alzano
// il danno di tutti i colpi di reserveBonus (ARMY.reserves). Senza riserve i superstiti stringono le file:
// la folla resta sempre raccolta attorno agli eroi, nei primi posti dei plotoni.
// I soldati arrivano passando sotto i cancelli e muoiono negli scontri con i nemici e sotto i loro colpi;
// ogni eroe perde la vita che gli toglie chi lo colpisce (HERO_HIT porta l'eroe e il danno) e a zero muore:
// sparisce da heroes (leader resta il capo, vivo finché dura la missione). I cancelli possono anche togliere
// soldati (negativi e ÷2, mai gli eroi), ridare vita agli eroi e aumentare il danno di tutti i colpi fino a fine
// livello (damageScale, 1 = normale). Ogni posto della folla ha la sua arma, all'inizio quella dell'eroe più
// vicino: la usa il soldato che ci sta (weapon), anche chi ci arriva dopo. Un cancello d'arma la cambia ai posti
// che ci passano sotto: la parte di folla sotto la sua trave, metà esercito se ci passa sotto metà.
// La folla resta dentro la strada: gli eroi si fermano prima che i plotoni escano dal bordo
export function createArmy(bus, rng, { startX, laneCenters }) {
  const heroes = LINEUP.map(({ hero, slot }) => {
    const data = HEROES[hero];
    const { dx, dz } = HERO.slots[slot];
    return { ...data, dx, dz, x: startX + dx, z: dz, size: HERO.size, hp: data.maxHp, phase: rng.float() };
  });
  const { slots, platoonCount } = createFormation(rng, heroes);
  for (const slot of slots) slot.weapon = nearestHero(heroes, slot).weapon.name;
  const midpoints = laneCenters.slice(1).map((center, index) => (center + laneCenters[index]) / 2);
  const army = {
    x: startX,
    snapTarget: null,
    size: ARMY.startSize,
    maxSize: LIMITS.maxArmy,
    reserves: 0,
    reserveBonus: 0,
    damageScale: 1,
    heroes,
    leader: heroes.find((hero) => hero.leader),
    soldiers: [],
    platoons: Array.from({ length: platoonCount }, () => ({ x: startX })),
    left: HERO.size / 2,
    right: HERO.size / 2,
    front: HERO.size / 2,
    back: -HERO.size / 2,
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
      offsetX: 0,
      offsetZ: 0,
    }),
    slots.length,
  );

  // Chi arriva prende il primo posto libero, nell'ordine dei plotoni
  function fill() {
    const wanted = Math.min(army.size - 1, slots.length);
    for (const slot of slots) {
      if (army.soldiers.length >= wanted) break;
      if (slot.soldier) continue;
      const soldier = pool.acquire();
      soldier.slot = slot;
      soldier.z = slot.dz;
      soldier.x = insideRoad(army.platoons[slot.platoon].x + slot.dx);
      soldier.phase = rng.float();
      soldier.weapon = slot.weapon;
      soldier.offsetX = 0;
      soldier.offsetZ = 0;
      slot.soldier = soldier;
      army.soldiers.push(soldier);
    }
  }

  function remove(soldier) {
    soldier.slot.soldier = null;
    soldier.slot = null;
    army.soldiers.splice(army.soldiers.indexOf(soldier), 1);
    pool.release(soldier);
  }

  // Chi sta nell'ultimo posto occupato passa nel primo posto libero, finché non restano buchi
  function closeRanks() {
    let free = 0;
    let last = slots.length - 1;
    for (;;) {
      while (free < slots.length && slots[free].soldier) free++;
      while (last >= 0 && !slots[last].soldier) last--;
      if (free >= last) return;
      moveTo(slots[last].soldier, slots[free]);
    }
  }

  // Il soldato cambia posto ma parte da dove si trova: ci arriva scivolando. Prende l'arma del nuovo posto
  function moveTo(soldier, slot) {
    soldier.slot.soldier = null;
    soldier.slot = slot;
    slot.soldier = soldier;
    soldier.weapon = slot.weapon;
    soldier.offsetX = soldier.x - (army.platoons[slot.platoon].x + slot.dx);
    soldier.offsetZ = soldier.z - slot.dz;
  }

  // Ingombro della folla ai due lati degli eroi, davanti e dietro, limiti di movimento e punti di aggancio.
  // A metà tra due corsie ci si aggancia solo se da lì qualche soldato colpisce i nemici normali di entrambe
  function updateShape() {
    const halfSoldier = PLATOONS.soldierSize / 2;
    const halfGap = (laneCenters[1] - laneCenters[0]) / 2;
    // Portata di lato dei colpi del fucile, l'arma di riferimento per l'aggancio
    const hitReach = (WEAPONS.rifle.size + ENEMY_TYPES.grunt.size) / 2;
    let hitsLeft = false;
    let hitsRight = false;
    army.left = 0;
    army.right = 0;
    army.front = 0;
    army.back = 0;
    for (const hero of army.heroes) {
      army.left = Math.max(army.left, HERO.size / 2 - hero.dx);
      army.right = Math.max(army.right, HERO.size / 2 + hero.dx);
      army.front = Math.max(army.front, HERO.size / 2 + hero.dz);
      army.back = Math.min(army.back, hero.dz - HERO.size / 2);
    }
    for (const { slot } of army.soldiers) {
      army.left = Math.max(army.left, halfSoldier - slot.dx);
      army.right = Math.max(army.right, halfSoldier + slot.dx);
      army.front = Math.max(army.front, halfSoldier + slot.dz);
      army.back = Math.min(army.back, slot.dz - halfSoldier);
      const reachesLane = Math.abs(Math.abs(slot.dx) - halfGap) < hitReach;
      if (reachesLane && slot.dx < 0) hitsLeft = true;
      if (reachesLane && slot.dx > 0) hitsRight = true;
    }
    // Fino al bordo della strada: i nemici entrano anche nella parte esterna delle corsie laterali
    army.minX = army.left;
    army.maxX = LANES.fieldWidth - army.right;
    const points = hitsLeft && hitsRight ? [...laneCenters, ...midpoints] : laneCenters;
    army.snapPoints = [...new Set(points.map(clampX))].sort((a, b) => a - b);
    if (army.snapTarget !== null) army.snapTarget = clampX(army.snapTarget);
  }

  const clampX = (x) => Math.min(army.maxX, Math.max(army.minX, x));

  // Per ogni posto della folla: fin dove arrivano di lato gli eroi alla sua stessa altezza lungo la strada
  // (besideReach, null se non ce ne sono). Cambia solo quando muore un eroe
  function markBeside() {
    const half = HERO.size / 2;
    const halfSoldier = PLATOONS.soldierSize / 2;
    const band = half + halfSoldier + FORMATION.heroGap;
    for (const slot of slots) {
      let reach = null;
      for (const hero of army.heroes) {
        if (Math.abs(slot.dz - hero.dz) >= band) continue;
        const edge = slot.dx < 0 ? halfSoldier - (hero.dx - half) : halfSoldier + hero.dx + half;
        reach = reach === null ? edge : Math.max(reach, edge);
      }
      slot.besideReach = reach;
    }
  }

  markBeside();
  fill();
  updateShape();
  updateReserves(army);
  army.x = clampX(army.x);
  for (const hero of army.heroes) hero.x = army.x + hero.dx;
  for (const platoon of army.platoons) platoon.x = army.x;
  for (const soldier of army.soldiers) soldier.x = insideRoad(army.x + soldier.slot.dx);

  // Più soldati, o meno: prima le riserve, poi gli ultimi arrivati; gli eroi restano sempre
  function changeSize(delta) {
    if (delta >= 0) {
      army.size += delta;
      fill();
      updateShape();
      updateReserves(army);
      return;
    }
    const losses = Math.min(-delta, army.size - 1);
    const fromReserves = Math.min(losses, army.size - 1 - army.soldiers.length);
    army.size -= fromReserves;
    updateReserves(army);
    const victims = army.soldiers.slice(army.soldiers.length - (losses - fromReserves));
    for (const soldier of victims) bus.emit(EVENTS.SOLDIER_KILLED, { soldier, x: soldier.x, z: soldier.z });
  }

  // I posti sotto la trave del cancello, anche solo con un bordo, pieni o ancora vuoti, prendono la sua arma
  function arm(gate) {
    const reach = GATES.width / 2 + PLATOONS.soldierSize / 2;
    for (const slot of slots) {
      if (Math.abs(army.x + slot.dx - gate.x) >= reach) continue;
      slot.weapon = gate.kind.weapon;
      if (slot.soldier) slot.soldier.weapon = slot.weapon;
    }
  }

  bus.on(EVENTS.GATE_PASSED, (gate) => {
    const { kind } = gate;
    changeSize(soldiersFrom(gate, army.size));
    if (kind.effect === 'heal') for (const hero of army.heroes) hero.hp = Math.min(hero.maxHp, hero.hp + kind.amount);
    else if (kind.effect === 'power') army.damageScale += kind.amount;
    else if (kind.effect === 'weapon') arm(gate);
  });

  // Un soldato già morto (posto vuoto o dato a un altro) non conta due volte
  bus.on(EVENTS.SOLDIER_KILLED, ({ soldier }) => {
    if (soldier.slot === null || soldier.slot.soldier !== soldier) return;
    remove(soldier);
    army.size -= 1;
    fill();
    closeRanks();
    updateShape();
    updateReserves(army);
  });

  // Un eroe già morto non conta due volte
  bus.on(EVENTS.HERO_HIT, ({ hero, damage }) => {
    if (hero.hp === 0 || !army.heroes.includes(hero)) return;
    hero.hp = Math.max(0, hero.hp - damage);
    bus.emit(EVENTS.HERO_DAMAGED, hero);
    if (hero.hp > 0) return;
    army.heroes.splice(army.heroes.indexOf(hero), 1);
    markBeside();
    updateShape();
    bus.emit(EVENTS.HERO_KILLED, hero);
  });

  // Se la folla è appena cresciuta oltre i limiti, il dito può riportarla dentro ma non spingerla più fuori
  bus.on(EVENTS.STEER, (dx) => {
    army.snapTarget = null;
    const lower = Math.min(army.minX, army.x);
    const upper = Math.max(army.maxX, army.x);
    army.x = Math.min(upper, Math.max(lower, army.x + dx * CONTROLS.sensitivity));
  });

  bus.on(EVENTS.STEER_END, () => {
    if (!CONTROLS.snapEnabled) return;
    const nearest = findNearest(army.snapPoints, army.x);
    if (Math.abs(nearest - army.x) <= CONTROLS.snapRadius) army.snapTarget = nearest;
  });

  return army;
}

// Aggancio e ritorno dentro i limiti, poi gli eroi seguono il punto guidato e i plotoni lo inseguono: ognuno
// si avvicina alla sua posizione con un ritardo di followMs. Chi ha il posto al fianco degli eroi della sua fila
// non gli entra dentro: i soldati di ogni fianco si fermano tutti insieme quando il più vicino tocca un eroe,
// così restano distanziati. Chi ha cambiato posto ci arriva scivolando: prima avanti o indietro lungo la strada, poi
// di lato; mentre passa dall'altra parte degli eroi non viene fermato, gli scivola sopra.
// Un soldato che resterebbe fuori strada si ferma al bordo
export function updateArmy(army, deltaMs) {
  updateReserves(army);
  moveToSnap(army, deltaMs);
  moveInsideLimits(army, deltaMs);
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

// Quando la folla cresce contro il bordo, l'eroe rientra scivolando, alla velocità dell'aggancio.
// Se un aggancio è in corso ci pensa già lui: il suo punto è sempre dentro i limiti
function moveInsideLimits(army, deltaMs) {
  if (army.snapTarget !== null) return;
  const step = perFrame(CONTROLS.snapSpeed, deltaMs);
  if (army.x < army.minX) army.x = Math.min(army.minX, army.x + step);
  if (army.x > army.maxX) army.x = Math.max(army.maxX, army.x - step);
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

// L'eroe più vicino a un posto della folla
// Riserve e loro danno in più: ogni halfCount riserve ne danno metà di quello che manca a maxBonus
function updateReserves(army) {
  const { maxBonus, halfCount } = ARMY.reserves;
  army.reserves = Math.max(0, army.size - army.maxSize);
  army.reserveBonus = maxBonus * (1 - 0.5 ** (army.reserves / halfCount));
}

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

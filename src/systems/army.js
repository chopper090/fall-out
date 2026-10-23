import { ARMY, CONTROLS, FORMATION, HERO, LANES, PLATOONS, WEAPON } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { perFrame } from '../core/time.js';
import { ENEMY_TYPES } from '../data/enemies.js';
import { LIMITS } from '../data/waves.js';
import { createFormation } from './formation.js';

// Esercito: l'eroe guidato dallo swipe e i plotoni di soldati che lo seguono con un leggero ritardo.
// size conta tutti, eroe compreso, fino al tetto del livello (maxSize). Si disegnano al massimo i posti
// dei plotoni: gli altri sono riserve che prendono subito il posto di chi muore. Senza riserve i superstiti
// stringono le file: la folla resta sempre raccolta attorno all'eroe, nei primi posti dei plotoni.
// I soldati arrivano passando sotto i cancelli e muoiono negli scontri con i nemici e sotto i loro colpi;
// l'eroe perde la vita che gli toglie chi lo colpisce (HERO_HIT porta il danno).
// La folla resta dentro la strada: l'eroe si ferma prima che i plotoni escano dal bordo
export function createArmy(bus, rng, { startX, laneCenters }) {
  const { slots, platoonCount } = createFormation(rng);
  const midpoints = laneCenters.slice(1).map((center, index) => (center + laneCenters[index]) / 2);
  const army = {
    x: startX,
    snapTarget: null,
    size: Math.min(ARMY.startSize, LIMITS.maxArmy),
    maxSize: LIMITS.maxArmy,
    hero: { x: startX, z: 0, size: HERO.size, hp: HERO.maxHp, maxHp: HERO.maxHp, phase: rng.float() },
    soldiers: [],
    platoons: Array.from({ length: platoonCount }, () => ({ x: startX })),
    left: HERO.size / 2,
    right: HERO.size / 2,
    front: HERO.size / 2,
    minX: laneCenters[0],
    maxX: laneCenters[laneCenters.length - 1],
    snapPoints: laneCenters,
  };
  // phase: frazione dell'intervallo di tiro che manca al prossimo colpo. Parte a caso, così ognuno
  // spara con il suo ritmo. offsetX e offsetZ: distanza dal suo posto, che si riduce mentre ci arriva
  const pool = createPool(
    () => ({ x: 0, z: 0, size: PLATOONS.soldierSize, phase: 0, slot: null, offsetX: 0, offsetZ: 0 }),
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

  // Il soldato cambia posto ma parte da dove si trova: ci arriva scivolando
  function moveTo(soldier, slot) {
    soldier.slot.soldier = null;
    soldier.slot = slot;
    slot.soldier = soldier;
    soldier.offsetX = soldier.x - (army.platoons[slot.platoon].x + slot.dx);
    soldier.offsetZ = soldier.z - slot.dz;
  }

  // Ingombro della folla ai due lati dell'eroe e davanti a lui, limiti di movimento e punti di aggancio.
  // A metà tra due corsie ci si aggancia solo se da lì qualche soldato colpisce i nemici normali di entrambe
  function updateShape() {
    const halfSoldier = PLATOONS.soldierSize / 2;
    const halfGap = (laneCenters[1] - laneCenters[0]) / 2;
    const hitReach = (WEAPON.size + ENEMY_TYPES.grunt.size) / 2;
    let hitsLeft = false;
    let hitsRight = false;
    army.left = HERO.size / 2;
    army.right = HERO.size / 2;
    army.front = HERO.size / 2;
    for (const { slot } of army.soldiers) {
      army.left = Math.max(army.left, halfSoldier - slot.dx);
      army.right = Math.max(army.right, halfSoldier + slot.dx);
      army.front = Math.max(army.front, halfSoldier + slot.dz);
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

  fill();
  updateShape();
  army.x = clampX(army.x);
  army.hero.x = army.x;
  for (const platoon of army.platoons) platoon.x = army.x;
  for (const soldier of army.soldiers) soldier.x = insideRoad(army.x + soldier.slot.dx);

  bus.on(EVENTS.GATE_PASSED, (gate) => {
    army.size = Math.min(army.maxSize, army.size + gate.value);
    fill();
    updateShape();
  });

  // Un soldato già morto (posto vuoto o dato a un altro) non conta due volte
  bus.on(EVENTS.SOLDIER_KILLED, ({ soldier }) => {
    if (soldier.slot === null || soldier.slot.soldier !== soldier) return;
    remove(soldier);
    army.size -= 1;
    fill();
    closeRanks();
    updateShape();
  });

  bus.on(EVENTS.HERO_HIT, (damage) => {
    const { hero } = army;
    if (hero.hp === 0) return;
    hero.hp = Math.max(0, hero.hp - damage);
    bus.emit(EVENTS.HERO_DAMAGED, hero);
    if (hero.hp === 0) bus.emit(EVENTS.HERO_KILLED, hero);
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

// Aggancio e ritorno dentro i limiti, poi i plotoni inseguono l'eroe: ognuno si avvicina alla sua posizione
// con un ritardo di followMs. Chi ha il posto al fianco dell'eroe non gli entra dentro: i soldati di ogni fianco
// si fermano tutti insieme quando il più vicino tocca l'eroe, così restano distanziati.
// Chi ha cambiato posto ci arriva scivolando: prima avanti o indietro lungo la strada, poi di lato; mentre
// passa dall'altra parte dell'eroe non viene fermato, gli scivola sopra.
// Un soldato che resterebbe fuori strada si ferma al bordo
export function updateArmy(army, deltaMs) {
  moveToSnap(army, deltaMs);
  moveInsideLimits(army, deltaMs);
  army.hero.x = army.x;
  const blend = PLATOONS.followMs > 0 ? 1 - Math.exp(-deltaMs / PLATOONS.followMs) : 1;
  for (const platoon of army.platoons) platoon.x += (army.x - platoon.x) * blend;
  const heroReach = (HERO.size + PLATOONS.soldierSize) / 2;
  const besideBand = heroReach + FORMATION.heroGap;
  const isBeside = (slot) => Math.abs(slot.dz) < besideBand;
  // Di quanto ogni fianco può avvicinarsi all'eroe: lo spazio libero del suo soldato più vicino
  let roomLeft = Infinity;
  let roomRight = Infinity;
  for (const { slot } of army.soldiers) {
    if (!isBeside(slot)) continue;
    if (slot.dx < 0) roomLeft = Math.min(roomLeft, -slot.dx - heroReach);
    else roomRight = Math.min(roomRight, slot.dx - heroReach);
  }
  const { sideMs, depthMs } = PLATOONS.regroup;
  const settleX = sideMs > 0 ? Math.exp(-deltaMs / sideMs) : 0;
  const settleZ = depthMs > 0 ? Math.exp(-deltaMs / depthMs) : 0;
  for (const soldier of army.soldiers) {
    const { slot } = soldier;
    soldier.offsetX *= settleX;
    soldier.offsetZ *= settleZ;
    let x = army.platoons[slot.platoon].x + slot.dx + soldier.offsetX;
    const onItsSide = Math.sign(slot.dx) * (slot.dx + soldier.offsetX) >= heroReach;
    if (isBeside(slot) && onItsSide) {
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

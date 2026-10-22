import { GATES } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { perFrame } from '../core/time.js';
import { LIMITS } from '../data/waves.js';

// Le parti dei colpi di tutto l'esercito sommano a 1 a meno di minimi errori di arrotondamento
const CHARGE_TOLERANCE = 1e-9;

// Cancelli +N: compaiono in fondo alla strada in una corsia a caso, solo durante le ondate,
// e vengono avanti con il campo. Ogni colpo li carica della sua parte dell'esercito:
// a ogni hitsPerPoint colpi di tutto l'esercito il valore sale di 1, fino al tetto del livello
export function createGates(bus, rng, laneCenters) {
  const state = {
    list: [],
    pool: createPool(() => ({ x: 0, z: 0, value: 0, charge: 0 }), GATES.poolSize),
    active: false,
    spawnsDue: 0,
    bus,
    rng,
    laneCenters,
  };

  bus.on(EVENTS.WAVE_STARTED, () => {
    state.active = true;
    state.spawnsDue = 0;
  });
  bus.on(EVENTS.WAVE_ENDED, () => {
    state.active = false;
  });

  bus.on(EVENTS.GATE_HIT, ({ gate, share }) => {
    gate.charge += share;
    while (gate.charge >= GATES.hitsPerPoint - CHARGE_TOLERANCE) {
      gate.charge -= GATES.hitsPerPoint;
      gate.value = Math.min(LIMITS.maxGateValue, gate.value + 1);
    }
  });

  return state;
}

// Muove i cancelli con il campo (scrollSpeed unità/s) e, durante un'ondata, ne fa comparire di nuovi
export function updateGates(state, deltaMs, scrollSpeed) {
  const step = perFrame(scrollSpeed, deltaMs);
  for (const gate of state.list) gate.z -= step;

  if (!state.active) return;
  state.spawnsDue += perFrame(1 / GATES.spawnInterval, deltaMs);
  while (state.spawnsDue >= 1) {
    const gate = state.pool.acquire();
    gate.x = state.laneCenters[state.rng.int(state.laneCenters.length)];
    gate.z = GATES.spawnDistance;
    gate.value = Math.min(LIMITS.maxGateValue, GATES.startValue);
    gate.charge = 0;
    state.list.push(gate);
    state.spawnsDue -= 1;
  }
}

// Va chiamata dopo il combattimento. I cancelli sono in ordine di comparsa: i più vecchi sono i più vicini.
// Quello che arriva al fronte della folla sparisce; se la folla ci passa sotto, anche solo in parte,
// l'esercito cresce
export function reachGates(state, army) {
  const { list, pool, bus } = state;
  const reachZ = army.front + GATES.depth / 2;
  while (list.length > 0 && list[0].z <= reachZ) {
    const gate = list.shift();
    const under = gate.x + GATES.width / 2 > army.x - army.left && gate.x - GATES.width / 2 < army.x + army.right;
    if (under) bus.emit(EVENTS.GATE_PASSED, gate);
    bus.emit(EVENTS.GATE_REMOVED, gate);
    pool.release(gate);
  }
}

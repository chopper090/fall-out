import { FIELD, GATES, HERO } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { perFrame } from '../core/time.js';

// Cancelli +N: compaiono in fondo alla strada in una corsia a caso e vengono avanti con il campo.
// Ogni hitsPerPoint colpi ricevuti il loro valore sale di 1
export function createGates(bus, rng, laneCenters) {
  const state = {
    list: [],
    pool: createPool(() => ({ x: 0, z: 0, value: 0, hits: 0 }), GATES.poolSize),
    spawnsDue: 0,
    bus,
    rng,
    laneCenters,
  };

  bus.on(EVENTS.GATE_HIT, (gate) => {
    gate.hits += 1;
    if (gate.hits % GATES.hitsPerPoint === 0) gate.value += 1;
  });

  return state;
}

// Muove i cancelli con il campo e ne fa comparire di nuovi
export function updateGates(state, deltaMs) {
  const step = perFrame(FIELD.scrollSpeed, deltaMs);
  for (const gate of state.list) gate.z -= step;

  state.spawnsDue += perFrame(1 / GATES.spawnInterval, deltaMs);
  while (state.spawnsDue >= 1) {
    const gate = state.pool.acquire();
    gate.x = state.laneCenters[state.rng.int(state.laneCenters.length)];
    gate.z = GATES.spawnDistance;
    gate.value = GATES.startValue;
    gate.hits = 0;
    state.list.push(gate);
    state.spawnsDue -= 1;
  }
}

// Va chiamata dopo il combattimento. I cancelli sono in ordine di comparsa: i più vecchi sono i più vicini.
// Quello che arriva al fronte dell'esercito sparisce; se l'esercito ci passa sotto, anche solo in parte, cresce
export function reachGates(state, armyX) {
  const { list, pool, bus } = state;
  const reachZ = (HERO.size + GATES.depth) / 2;
  while (list.length > 0 && list[0].z <= reachZ) {
    const gate = list.shift();
    if (Math.abs(armyX - gate.x) < (GATES.width + HERO.size) / 2) bus.emit(EVENTS.GATE_PASSED, gate);
    bus.emit(EVENTS.GATE_REMOVED, gate);
    pool.release(gate);
  }
}

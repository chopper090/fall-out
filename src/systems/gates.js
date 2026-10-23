import { GATES, LEVEL } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { perFrame } from '../core/time.js';
import { LIMITS } from '../data/waves.js';

// Le parti dei colpi di un secondo di fuoco di tutto l'esercito sommano a 1, a meno di minimi arrotondamenti
const CHARGE_TOLERANCE = 1e-9;

// Cancelli +N: compaiono in fondo alla strada in una corsia a caso, solo durante le ondate,
// e vengono avanti con il campo. Ogni colpo li carica della sua parte dell'esercito:
// a ogni hitsPerPoint colpi di tutto l'esercito il valore sale di 1, fino al tetto del livello.
// La prima ondata della partita trova già sulla strada i cancelli degli ultimi secondi, come i nemici
export function createGates(bus, rng, laneCenters) {
  const state = {
    list: [],
    pool: createPool(() => ({ x: 0, z: 0, value: 0, charge: 0 }), GATES.poolSize),
    active: false,
    spawnsDue: 0,
    headStart: true,
    bus,
    rng,
    laneCenters,
  };

  bus.on(EVENTS.WAVE_STARTED, ({ wave }) => {
    state.active = true;
    state.spawnsDue = 0;
    if (state.headStart) fillRoad(state, wave.scrollSpeed);
    state.headStart = false;
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
    spawnGate(state, GATES.spawnDistance);
    state.spawnsDue -= 1;
  }
}

// I cancelli già in arrivo, ognuno dove sarebbe arrivato, dal più vicino fino a quello che compare adesso
// in fondo: la lista resta in ordine di distanza
function fillRoad(state, scrollSpeed) {
  const spacing = GATES.spawnInterval * scrollSpeed;
  const count = Math.floor((GATES.spawnDistance - LEVEL.headStartZ) / spacing);
  for (let n = count; n >= 0; n--) spawnGate(state, GATES.spawnDistance - n * spacing);
}

function spawnGate(state, z) {
  const gate = state.pool.acquire();
  gate.x = state.laneCenters[state.rng.int(state.laneCenters.length)];
  gate.z = z;
  gate.value = Math.min(LIMITS.maxGateValue, GATES.startValue);
  gate.charge = 0;
  state.list.push(gate);
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

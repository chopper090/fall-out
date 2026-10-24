import { GATES, LEVEL } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { perFrame } from '../core/time.js';
import { GATE_KINDS } from '../data/gates.js';

// Cancelli: compaiono in fondo alla strada, soli o in coppia in due corsie diverse, solo durante le ondate,
// e vengono avanti con il campo. Tipi e numeri li decide l'ondata (gates in data/waves.js, tipi in
// data/gates.js): ogni cancello ha il suo numero (value, negativo per i −N) e non cambia; i colpi lo attraversano.
// partner: l'altro cancello della coppia, null per un cancello solo.
// La prima ondata della partita trova già sulla strada i cancelli degli ultimi secondi, come i nemici.
// Eventi: GATE_PASSED con quello che vale per l'esercito quando ci passa sotto
export function createGates(bus, rng, laneCenters) {
  const state = {
    list: [],
    pool: createPool(() => ({ kind: null, x: 0, z: 0, value: 0, partner: null }), GATES.poolSize),
    wave: null,
    spawnsDue: 0,
    headStart: true,
    bus,
    rng,
    laneCenters,
  };

  bus.on(EVENTS.WAVE_STARTED, ({ wave }) => {
    state.wave = wave;
    state.spawnsDue = 0;
    if (state.headStart) fillRoad(state, wave);
    state.headStart = false;
  });
  bus.on(EVENTS.WAVE_ENDED, () => {
    state.wave = null;
  });

  return state;
}

// Muove i cancelli con il campo (scrollSpeed unità/s) e, durante un'ondata, ne fa comparire di nuovi
export function updateGates(state, deltaMs, scrollSpeed) {
  const step = perFrame(scrollSpeed, deltaMs);
  for (const gate of state.list) gate.z -= step;

  const { wave } = state;
  if (wave === null) return;
  state.spawnsDue += perFrame(1 / GATES.spawnInterval, deltaMs);
  while (state.spawnsDue >= 1) {
    spawnArrival(state, wave, GATES.spawnDistance);
    state.spawnsDue -= 1;
  }
}

// I cancelli già in arrivo, ognuno dove sarebbe arrivato, dal più vicino fino a quello che compare adesso
// in fondo: la lista resta in ordine di distanza
function fillRoad(state, wave) {
  const spacing = GATES.spawnInterval * wave.scrollSpeed;
  const count = Math.floor((GATES.spawnDistance - LEVEL.headStartZ) / spacing);
  for (let n = count; n >= 0; n--) spawnArrival(state, wave, GATES.spawnDistance - n * spacing);
}

// Una coppia in due corsie diverse a caso, oppure un cancello solo in una corsia a caso; un −N da solo solo in una
// corsia esterna, così anche un esercito largo lo può schivare dall'altra parte (una coppia si sceglie sempre)
function spawnArrival(state, wave, z) {
  const { rng, laneCenters } = state;
  const { gates } = wave;
  const first = rng.int(laneCenters.length);
  if (rng.float() >= gates.pairChance) {
    const name = rng.pick(Object.entries(gates.singles));
    const outer = rng.int(2) === 0 ? 0 : laneCenters.length - 1;
    spawnGate(state, gates, name, laneCenters[GATE_KINDS[name].malus ? outer : first], z);
    return;
  }
  const second = (first + 1 + rng.int(laneCenters.length - 1)) % laneCenters.length;
  const { kinds } = rng.pick(gates.pairs.map((pair) => [pair, pair.weight]));
  const a = spawnGate(state, gates, kinds[0], laneCenters[first], z);
  const b = spawnGate(state, gates, kinds[1], laneCenters[second], z);
  a.partner = b;
  b.partner = a;
}

// Il numero, a caso tra quelli che l'ondata dà al suo tipo
function spawnGate(state, gates, name, x, z) {
  const gate = state.pool.acquire();
  const values = gates[name];
  gate.kind = GATE_KINDS[name];
  gate.x = x;
  gate.z = z;
  gate.value = values[state.rng.int(values.length)];
  gate.partner = null;
  state.list.push(gate);
  return gate;
}

// Va chiamata dopo il combattimento. I cancelli sono in ordine di comparsa: i più vecchi sono i più vicini,
// e i due di una coppia arrivano insieme. Quello che arriva al fronte della folla sparisce; se la folla ci passa
// sotto, anche solo in parte, vale per l'esercito. Di una coppia ne vale uno solo: quello più vicino al centro
// degli eroi; se il centro sta esattamente in mezzo vale il peggiore, così chi non sceglie paga
export function reachGates(state, army) {
  const { list, bus } = state;
  const reachZ = army.front + GATES.depth / 2;
  while (list.length > 0 && list[0].z <= reachZ) {
    const gate = list.shift();
    const { partner } = gate;
    const passed = [gate, partner].filter((candidate) => candidate !== null && isUnder(candidate, army));
    if (passed.length > 0) bus.emit(EVENTS.GATE_PASSED, chosen(passed, army));
    state.pool.release(gate);
    if (partner !== null) {
      list.splice(list.indexOf(partner), 1);
      state.pool.release(partner);
    }
  }
}

function chosen(passed, army) {
  if (passed.length === 1) return passed[0];
  const [a, b] = passed;
  const gap = Math.abs(a.x - army.x) - Math.abs(b.x - army.x);
  if (gap !== 0) return gap < 0 ? a : b;
  return soldiersFrom(a, army.size) <= soldiersFrom(b, army.size) ? a : b;
}

function isUnder(gate, army) {
  return gate.x + GATES.width / 2 > army.x - army.left && gate.x - GATES.width / 2 < army.x + army.right;
}

// Un cancello che toglie soldati: si disegna rosso
export function isMalus(gate) {
  return gate.kind.malus;
}

// Soldati che il cancello dà a un esercito grande size (negativo se ne toglie), senza mai togliere il capo: oltre il
// tetto della folla diventano riserve
export function soldiersFrom({ value }, size) {
  return Math.max(1 - size, value);
}
